import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { tr } from '@/i18n'
import type { TipTapDoc, TipTapNode } from '@/types/document'
import { diffDocs, listDiff, tableDiff, textOf, wordDiff, type DocDiff } from '@/lib/docDiff'

// Dấu hiệu hiển thị TRÊN nội dung, bằng decoration ProseMirror (không sửa content):
// - khối sửa / thêm / chuyển (class + data-chg; vạch lề do DocEditor vẽ), khối xoá (widget "n đoạn đã xoá")
// - chế độ So sánh: chữ thêm / xoá theo từ, ô bảng, mục danh sách, huy hiệu sơ đồ / Figma đã đổi
// - chip REQ-xx trước heading REQ (chấm cam = Stale, viền xanh = đổi so với bản gốc)
// - bôi vàng đoạn chữ có bình luận

export interface CommentMark {
  commentId: number
  anchorId: string | null
  quote: string | null
}

export interface DocMarksInput {
  base: TipTapDoc | null
  baseLabel: string | null
  compare: boolean
  staleReqUids: string[]
  comments: CommentMark[]
  activeCommentId: number | null
}

export interface DocMarksState {
  input: DocMarksInput
  diff: DocDiff
  decorations: DecorationSet
}

export interface DocMarksHandlers {
  onCommentClick?: (commentId: number) => void
  onBlockCompare?: (blockId: string) => void
}

export const docMarksKey = new PluginKey<DocMarksState>('docMarks')

const EMPTY_INPUT: DocMarksInput = {
  base: null,
  baseLabel: null,
  compare: false,
  staleReqUids: [],
  comments: [],
  activeCommentId: null,
}

const el = (tag: string, cls: string, text?: string) => {
  const e = document.createElement(tag)
  e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

const textblockText = (n: PMNode) => n.textBetween(0, n.content.size, '\n', '\n')

/** Các textblock bên trong (hoặc chính) node cấp cao nhất, kèm vị trí tuyệt đối của node. */
function textblocksOf(node: PMNode, pos: number): { node: PMNode; pos: number }[] {
  if (node.isTextblock) return [{ node, pos }]
  const out: { node: PMNode; pos: number }[] = []
  node.descendants((child, rel) => {
    if (child.isTextblock) {
      out.push({ node: child, pos: pos + 1 + rel })
      return false
    }
    return true
  })
  return out
}

function jsonTextblocks(n: TipTapNode): string[] {
  const TEXTBLOCK = ['paragraph', 'heading', 'codeBlock']
  if (TEXTBLOCK.includes(n.type)) return [textOf(n)]
  return (n.content ?? []).flatMap(jsonTextblocks)
}

function wordDecos(decos: Decoration[], tb: { node: PMNode; pos: number }, before: string, keyPrefix: string) {
  const after = textblockText(tb.node)
  if (before === after) return
  let offset = 0
  const start = tb.pos + 1
  wordDiff(before, after).forEach((part, i) => {
    if (part.kind === 'same') offset += part.text.length
    else if (part.kind === 'added') {
      decos.push(Decoration.inline(start + offset, start + offset + part.text.length, { class: 'doc-ins' }))
      offset += part.text.length
    } else {
      decos.push(
        Decoration.widget(start + offset, () => el('del', 'doc-del-inline', part.text), {
          side: -1,
          key: `${keyPrefix}-d${i}-${part.text}`,
          ignoreSelection: true,
        }),
      )
    }
  })
}

function compareDecos(
  decos: Decoration[],
  node: PMNode,
  pos: number,
  base: TipTapNode,
  id: string,
  handlers: DocMarksHandlers,
) {
  const json = node.toJSON() as TipTapNode
  if (node.type.name === 'codeBlock' || node.type.name === 'figmaFrame') {
    const isDiagram = node.type.name === 'codeBlock' && node.attrs.language === 'mermaid'
    const label =
      node.type.name === 'figmaFrame'
        ? tr('Khung Figma đã thay đổi', 'Figma frame changed')
        : isDiagram
          ? tr('Sơ đồ đã thay đổi', 'Diagram changed')
          : tr('Mã đã thay đổi', 'Code changed')
    decos.push(
      Decoration.widget(
        pos,
        () => {
          const b = el('button', 'doc-chg-badge', label)
          b.setAttribute('type', 'button')
          b.setAttribute('title', tr('Xem trước / sau', 'View before / after'))
          b.addEventListener('mousedown', (e) => e.preventDefault())
          b.addEventListener('click', () => handlers.onBlockCompare?.(id))
          return b
        },
        { side: -1, key: `badge-${id}`, stopEvent: () => true, ignoreSelection: true },
      ),
    )
    return
  }
  if (node.type.name === 'table') {
    const d = tableDiff(base, json)
    let r = 0
    node.forEach((row, rowOffset) => {
      let c = 0
      row.forEach((cell, cellOffset) => {
        if (d.changedCells.has(`${r}:${c}`)) {
          const cp = pos + 1 + rowOffset + 1 + cellOffset
          decos.push(Decoration.node(cp, cp + cell.nodeSize, { class: 'doc-cell-chg' }))
        }
        c++
      })
      r++
    })
    return
  }
  if (['taskList', 'bulletList', 'orderedList'].includes(node.type.name)) {
    const d = listDiff(base, json)
    const itemEnds: number[] = []
    let i = 0
    node.forEach((item, offset) => {
      const ip = pos + 1 + offset
      itemEnds.push(ip + item.nodeSize)
      const s = d.items[i]
      if (s === 'added') decos.push(Decoration.node(ip, ip + item.nodeSize, { class: 'doc-item-add' }))
      if (s === 'checked')
        decos.push(
          Decoration.node(ip, ip + item.nodeSize, {
            class: 'doc-item-chk',
            title: tr('Đổi trạng thái tick', 'Check state changed'),
          }),
        )
      i++
    })
    d.removed.forEach((r, k) => {
      const at = r.afterIndex < 0 ? pos + 1 : itemEnds[r.afterIndex]
      decos.push(
        Decoration.widget(at, () => el('div', 'doc-item-del', r.text), {
          side: 1,
          key: `li-del-${id}-${k}-${r.text}`,
          ignoreSelection: true,
        }),
      )
    })
    return
  }
  // Đoạn văn, heading, callout…: ghép textblock theo thứ tự, so theo từ.
  const cur = textblocksOf(node, pos)
  const old = jsonTextblocks(base)
  cur.forEach((tb, i) => {
    if (i < old.length) wordDecos(decos, tb, old[i], `w-${id}-${i}`)
    else if (tb.node.content.size > 0)
      decos.push(Decoration.inline(tb.pos + 1, tb.pos + 1 + tb.node.content.size, { class: 'doc-ins' }))
  })
  if (old.length > cur.length) {
    const rest = old.slice(cur.length).join(' ')
    decos.push(
      Decoration.widget(pos + node.nodeSize, () => el('del', 'doc-del-inline is-block', rest), {
        side: -1,
        key: `w-${id}-rest-${rest}`,
      }),
    )
  }
}

export function computeDocMarks(doc: PMNode, input: DocMarksInput, handlers: DocMarksHandlers): DocMarksState {
  const diff = diffDocs(input.base, doc.toJSON() as TipTapDoc)
  const decos: Decoration[] = []
  const tops: { node: PMNode; pos: number; id: string | null }[] = []
  doc.forEach((node, pos) => tops.push({ node, pos, id: (node.attrs.id as string) ?? null }))
  const byId = new Map(tops.filter((t) => t.id).map((t) => [t.id as string, t]))
  const label = input.baseLabel ?? ''

  // 1. Khối sửa / thêm / chuyển / chỉ đổi định dạng
  for (const t of tops) {
    const change = t.id ? diff.blocks.get(t.id) : undefined
    if (!change) continue
    if (change.status === 'format') {
      decos.push(
        Decoration.node(t.pos, t.pos + t.node.nodeSize, {
          class: 'doc-fmt',
          title: tr('Đổi định dạng', 'Formatting changed'),
        }),
      )
      continue
    }
    const title =
      change.status === 'modified'
        ? tr(`Đã sửa so với bản ${label}`, `Edited since ${label}`)
        : change.status === 'added'
          ? tr(`Mới so với bản ${label}`, `New since ${label}`)
          : change.movedFrom
            ? tr(`Chuyển từ mục "${change.movedFrom}"`, `Moved from "${change.movedFrom}"`)
            : tr('Đã chuyển chỗ', 'Moved')
    decos.push(
      Decoration.node(t.pos, t.pos + t.node.nodeSize, {
        class: `doc-chg is-${change.status}${input.compare ? ' in-compare' : ''}`,
        'data-chg': change.status,
        'data-chg-title': title,
      }),
    )
    if (input.compare && change.status === 'modified' && t.id) {
      const base = diff.baseById.get(t.id)
      if (base) compareDecos(decos, t.node, t.pos, base, t.id, handlers)
    }
  }

  // 2. Khối bị xoá
  for (const g of diff.deleted) {
    const anchor = g.afterId ? byId.get(g.afterId) : null
    const at = anchor ? anchor.pos + anchor.node.nodeSize : 0
    const firstId = String(g.blocks[0]?.attrs?.id ?? at)
    const n = g.blocks.length
    const expanded = input.compare
    decos.push(
      Decoration.widget(
        at,
        () => {
          const wrap = el('div', `doc-del${expanded ? ' is-open' : ''}`)
          wrap.setAttribute('data-chg', 'deleted')
          wrap.setAttribute('contenteditable', 'false')
          const btn = el(
            'button',
            'doc-del-toggle',
            tr(`${n} đoạn đã xoá`, `${n} ${n === 1 ? 'block' : 'blocks'} removed`),
          )
          btn.setAttribute('type', 'button')
          btn.setAttribute('aria-expanded', String(expanded))
          btn.setAttribute('title', tr(`Đã xoá so với bản ${label}`, `Removed since ${label}`))
          const body = el('div', 'doc-del-body')
          for (const b of g.blocks) body.appendChild(el('p', '', textOf(b).trim() || '—'))
          btn.addEventListener('mousedown', (e) => e.preventDefault())
          btn.addEventListener('click', () => {
            const open = wrap.classList.toggle('is-open')
            btn.setAttribute('aria-expanded', String(open))
          })
          wrap.append(btn, body)
          return wrap
        },
        { side: 1, key: `del-${firstId}-${n}-${expanded}`, stopEvent: () => true, ignoreSelection: true },
      ),
    )
  }

  // 3. Chip REQ
  const stale = new Set(input.staleReqUids)
  let reqIndex = 0
  for (const t of tops) {
    if (t.node.type.name !== 'heading' || !t.node.attrs.req) continue
    reqIndex++
    const key = `REQ-${String(reqIndex).padStart(2, '0')}`
    const uid = String(t.node.attrs.reqUid ?? '')
    const isStale = stale.has(uid)
    const isChanged = diff.changedReqUids.has(uid)
    decos.push(
      Decoration.widget(
        t.pos + 1,
        () => {
          const chip = el('span', `doc-req-chip${isStale ? ' is-stale' : ''}${isChanged ? ' is-changed' : ''}`, key)
          chip.setAttribute('contenteditable', 'false')
          const notes = [
            isStale ? 'Stale' : null,
            isChanged ? tr(`đã đổi so với bản ${label}`, `changed since ${label}`) : null,
          ].filter(Boolean)
          chip.setAttribute('title', [key, ...notes].join(' · '))
          return chip
        },
        { side: -1, key: `req-${key}-${uid}-${isStale}-${isChanged}`, ignoreSelection: true },
      ),
    )
  }

  // 4. Bình luận theo đoạn chữ
  for (const c of input.comments) {
    if (!c.anchorId || !c.quote) continue
    const t = byId.get(c.anchorId)
    if (!t) continue
    for (const tb of textblocksOf(t.node, t.pos)) {
      const idx = textblockText(tb.node).indexOf(c.quote)
      if (idx < 0) continue
      const from = tb.pos + 1 + idx
      decos.push(
        Decoration.inline(from, from + c.quote.length, {
          class: `doc-cmt${c.commentId === input.activeCommentId ? ' is-active' : ''}`,
          'data-comment-id': String(c.commentId),
        }),
      )
      break
    }
  }

  return { input, diff, decorations: DecorationSet.create(doc, decos) }
}

export function createDocMarks(handlers: DocMarksHandlers) {
  return Extension.create({
    name: 'docMarks',
    addProseMirrorPlugins() {
      return [
        new Plugin<DocMarksState>({
          key: docMarksKey,
          state: {
            init: (_config, state) => computeDocMarks(state.doc, EMPTY_INPUT, handlers),
            apply: (trn, prev, _old, state) => {
              const meta = trn.getMeta(docMarksKey) as Partial<DocMarksInput> | undefined
              if (!meta && !trn.docChanged) return prev
              return computeDocMarks(state.doc, meta ? { ...prev.input, ...meta } : prev.input, handlers)
            },
          },
          props: {
            decorations: (state) => docMarksKey.getState(state)?.decorations,
            handleDOMEvents: {
              click: (_view, event) => {
                const target = (event.target as HTMLElement | null)?.closest?.('[data-comment-id]')
                if (target) handlers.onCommentClick?.(Number(target.getAttribute('data-comment-id')))
                return false
              },
            },
          },
        }),
      ]
    },
  })
}
