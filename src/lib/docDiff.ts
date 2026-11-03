// So sánh 2 phiên bản tài liệu (A = cũ, B = mới) theo id khối cấp cao nhất
// (doc/Documents-API-Contract.md §3 "Id khối", §7.2b). Pure: không phụ thuộc TipTap; decoration và test cùng dùng.
//
// Thuật toán (đã duyệt):
// 1. Khối: cùng id + cùng nội dung → giữ nguyên; cùng id + khác nội dung → SỬA; chỉ ở B → THÊM; chỉ ở A → XOÁ
//    (hiện ở vị trí cũ trong A); cùng nội dung nhưng đổi thứ tự (id chung không nằm trong LCS) → CHUYỂN.
//    Chỉ đổi định dạng (đậm/nghiêng…) → FORMAT, không tính là thay đổi nội dung.
// 2. Trong khối SỬA: so theo từ; bảng theo ô; checklist / danh sách theo mục; sơ đồ / Figma chỉ báo "đã thay đổi".
// 3. REQ: đổi nếu có khối trong thân bị sửa / thêm / xoá / chuyển hoặc đổi priority; REQ mới / REQ bị xoá theo reqUid.

import { diffWordsWithSpace } from 'diff'
import type { TipTapDoc, TipTapNode } from '@/types/document'

export type BlockStatus = 'modified' | 'added' | 'moved' | 'format'

export interface BlockChange {
  status: BlockStatus
  /** Với khối CHUYỂN: tiêu đề gần nhất phía trên khối này ở bản A. */
  movedFrom?: string | null
}

export interface DeletedGroup {
  /** id khối ở B mà nhóm khối bị xoá nằm ngay sau (theo vị trí cũ ở A); null = đầu trang. */
  afterId: string | null
  blocks: TipTapNode[]
}

export interface ReqSummary {
  modified: string[]
  added: string[]
  removed: string[]
}

export interface DocDiff {
  blocks: Map<string, BlockChange>
  deleted: DeletedGroup[]
  baseById: Map<string, TipTapNode>
  /** Số thay đổi: SỬA + THÊM + XOÁ + CHUYỂN (theo khối). */
  count: number
  reqs: ReqSummary
  /** reqUid của các REQ (ở B) có thay đổi — để vòng xanh trên chip REQ. */
  changedReqUids: Set<string>
}

export const blockIdOf = (n: TipTapNode): string | null => {
  const id = n.attrs?.id
  return typeof id === 'string' && id ? id : null
}

// ---------- So sánh khối ----------

// TipTap trả đủ attr mặc định (null/false, colspan 1…) còn bản lưu có thể thiếu: bỏ chúng trước khi so.
function canonical(value: unknown, dropMarks: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => canonical(v, dropMarks))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v === null || v === undefined || v === false) continue
      if (dropMarks && key === 'marks') continue
      if ((key === 'colspan' || key === 'rowspan') && v === 1) continue
      if (Array.isArray(v) && v.length === 0) continue
      const c = canonical(v, dropMarks)
      if (key === 'attrs' && c && typeof c === 'object' && Object.keys(c).length === 0) continue
      out[key] = c
    }
    return out
  }
  return value
}

// priority của heading REQ tính ở cấp REQ, không phải "sửa nội dung khối".
const stripPriority = (n: TipTapNode): TipTapNode =>
  n.type === 'heading' && n.attrs ? { ...n, attrs: { ...n.attrs, priority: null } } : n

/** Ghép các text node liền nhau (sau khi bỏ mark, "a" + "b" đậm = "ab" thường). */
function mergeText(n: unknown): unknown {
  if (Array.isArray(n)) {
    const out: unknown[] = []
    for (const item of n.map(mergeText)) {
      const prev = out[out.length - 1] as { type?: string; text?: string } | undefined
      const cur = item as { type?: string; text?: string }
      if (
        prev?.type === 'text' &&
        cur?.type === 'text' &&
        Object.keys(prev).length === 2 &&
        Object.keys(cur).length === 2
      ) {
        out[out.length - 1] = { text: (prev.text ?? '') + (cur.text ?? ''), type: 'text' }
      } else out.push(item)
    }
    return out
  }
  if (n && typeof n === 'object') {
    const o = n as Record<string, unknown>
    return o.content ? { ...o, content: mergeText(o.content) } : o
  }
  return n
}

const key = (n: TipTapNode, dropMarks = false) => {
  const c = canonical(stripPriority(n), dropMarks)
  return JSON.stringify(dropMarks ? mergeText(c) : c)
}

/** 'same' | 'format' (chỉ khác định dạng) | 'content'. */
export function compareBlocks(a: TipTapNode, b: TipTapNode): 'same' | 'format' | 'content' {
  if (key(a) === key(b)) return 'same'
  return key(a, true) === key(b, true) ? 'format' : 'content'
}

/** Text thuần của node: khối con cách nhau "\n", hardBreak = "\n" (1 ký tự như ProseMirror). */
export function textOf(node: TipTapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  const children = node.content ?? []
  const inline = children.every((c) => c.type === 'text' || c.type === 'hardBreak')
  return children.map(textOf).join(inline ? '' : '\n')
}

// ---------- LCS ----------

/** Cặp chỉ số [i trong a, j trong b] của dãy con chung dài nhất (so sánh bằng ===). */
export function lcsPairs<T>(a: T[], b: T[]): [number, number][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: [number, number][] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push([i, j])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return out
}

// ---------- REQ ----------

interface ReqSection {
  reqUid: string
  key: string
  priority: unknown
  ids: string[]
}

export function reqSections(doc: TipTapDoc): ReqSection[] {
  const blocks = doc.content ?? []
  const out: ReqSection[] = []
  blocks.forEach((b, i) => {
    if (b.type !== 'heading' || b.attrs?.req !== true || !b.attrs?.reqUid) return
    const level = Number(b.attrs.level ?? 1)
    const ids = [blockIdOf(b)].filter(Boolean) as string[]
    for (let j = i + 1; j < blocks.length; j++) {
      const n = blocks[j]
      if (n.type === 'heading' && Number(n.attrs?.level ?? 1) <= level) break
      const id = blockIdOf(n)
      if (id) ids.push(id)
    }
    out.push({
      reqUid: String(b.attrs.reqUid),
      key: `REQ-${String(out.length + 1).padStart(2, '0')}`,
      priority: b.attrs.priority ?? 'MEDIUM',
      ids,
    })
  })
  return out
}

// ---------- Diff tài liệu ----------

export function diffDocs(a: TipTapDoc | null | undefined, b: TipTapDoc): DocDiff {
  const blocks = new Map<string, BlockChange>()
  const deleted: DeletedGroup[] = []
  const baseById = new Map<string, TipTapNode>()
  const empty: DocDiff = {
    blocks,
    deleted,
    baseById,
    count: 0,
    reqs: { modified: [], added: [], removed: [] },
    changedReqUids: new Set(),
  }
  if (!a) return empty

  const aBlocks = a.content ?? []
  const bBlocks = b.content ?? []
  for (const n of aBlocks) {
    const id = blockIdOf(n)
    if (id && !baseById.has(id)) baseById.set(id, n)
  }
  const bIds = new Set(bBlocks.map(blockIdOf).filter(Boolean) as string[])

  // Thứ tự các id chung → LCS; id chung ngoài LCS là khối bị chuyển chỗ.
  const commonA = aBlocks.map(blockIdOf).filter((id): id is string => !!id && bIds.has(id))
  const commonB = bBlocks.map(blockIdOf).filter((id): id is string => !!id && baseById.has(id))
  const inLcs = new Set(lcsPairs(commonA, commonB).map(([i]) => commonA[i]))

  // Tiêu đề gần nhất phía trên mỗi khối ở A (cho tooltip "Chuyển từ mục …").
  const headingAbove = new Map<string, string | null>()
  let lastHeading: string | null = null
  for (const n of aBlocks) {
    const id = blockIdOf(n)
    if (id) headingAbove.set(id, lastHeading)
    if (n.type === 'heading') lastHeading = textOf(n).trim() || null
  }

  for (const n of bBlocks) {
    const id = blockIdOf(n)
    if (!id) continue
    const old = baseById.get(id)
    if (!old) {
      blocks.set(id, { status: 'added' })
      continue
    }
    const cmp = compareBlocks(old, n)
    if (cmp === 'content') blocks.set(id, { status: 'modified' })
    else if (!inLcs.has(id)) blocks.set(id, { status: 'moved', movedFrom: headingAbove.get(id) ?? null })
    else if (cmp === 'format') blocks.set(id, { status: 'format' })
  }

  // Khối bị xoá: nhóm các khối liên tiếp ở A, neo sau khối A gần nhất còn tồn tại ở B.
  let anchor: string | null = null
  let group: DeletedGroup | null = null
  for (const n of aBlocks) {
    const id = blockIdOf(n)
    if (id && bIds.has(id)) {
      anchor = id
      group = null
      continue
    }
    if (!group) {
      group = { afterId: anchor, blocks: [] }
      deleted.push(group)
    }
    group.blocks.push(n)
  }

  let count = deleted.reduce((s, g) => s + g.blocks.length, 0)
  for (const c of blocks.values()) if (c.status !== 'format') count++

  // REQ
  const aReqs = reqSections(a)
  const bReqs = reqSections(b)
  const aByUid = new Map(aReqs.map((r) => [r.reqUid, r]))
  const bUids = new Set(bReqs.map((r) => r.reqUid))
  const deletedIds = new Set(deleted.flatMap((g) => g.blocks.map(blockIdOf)).filter(Boolean) as string[])
  const reqs: ReqSummary = { modified: [], added: [], removed: [] }
  const changedReqUids = new Set<string>()
  for (const r of bReqs) {
    const old = aByUid.get(r.reqUid)
    if (!old) {
      reqs.added.push(r.key)
      changedReqUids.add(r.reqUid)
      continue
    }
    const bodyChanged = r.ids.some((id) => {
      const s = blocks.get(id)?.status
      return s === 'modified' || s === 'added' || s === 'moved'
    })
    const lostBlocks = old.ids.some((id) => deletedIds.has(id))
    if (bodyChanged || lostBlocks || old.priority !== r.priority) {
      reqs.modified.push(r.key)
      changedReqUids.add(r.reqUid)
    }
  }
  for (const r of aReqs) if (!bUids.has(r.reqUid)) reqs.removed.push(r.key)

  return { blocks, deleted, baseById, count, reqs, changedReqUids }
}

/** "sửa REQ-01, thêm REQ-03, xoá REQ-04" — null nếu không đổi REQ nào. */
export function formatReqSummary(s: ReqSummary, t: (vi: string, en: string) => string = (vi) => vi): string | null {
  const parts: string[] = []
  if (s.modified.length) parts.push(t(`sửa ${s.modified.join(', ')}`, `edited ${s.modified.join(', ')}`))
  if (s.added.length) parts.push(t(`thêm ${s.added.join(', ')}`, `added ${s.added.join(', ')}`))
  if (s.removed.length) parts.push(t(`xoá ${s.removed.join(', ')}`, `removed ${s.removed.join(', ')}`))
  return parts.length ? parts.join(', ') : null
}

// ---------- Diff bên trong khối (chế độ So sánh) ----------

export interface WordPart {
  text: string
  kind: 'same' | 'added' | 'removed'
}

export function wordDiff(before: string, after: string): WordPart[] {
  return diffWordsWithSpace(before, after).map((c) => ({
    text: c.value,
    kind: c.added ? 'added' : c.removed ? 'removed' : 'same',
  }))
}

export interface TableDiff {
  /** "r:c" của ô (ở B) khác nội dung, hoặc thuộc hàng / cột mới. */
  changedCells: Set<string>
  addedRows: number[]
  addedCols: number[]
  removedRows: number
}

const rowsOf = (table: TipTapNode) =>
  (table.content ?? []).map((row) => (row.content ?? []).map((cell) => textOf(cell)))

/** Bảng: ghép hàng theo chỉ số, ô theo chỉ số. */
export function tableDiff(a: TipTapNode, b: TipTapNode): TableDiff {
  const ar = rowsOf(a)
  const br = rowsOf(b)
  const aCols = Math.max(0, ...ar.map((r) => r.length))
  const changedCells = new Set<string>()
  const addedRows: number[] = []
  const addedCols = new Set<number>()
  br.forEach((row, r) => {
    if (r >= ar.length) addedRows.push(r)
    row.forEach((cell, c) => {
      if (c >= aCols) addedCols.add(c)
      if (r >= ar.length || c >= aCols || ar[r][c] !== cell) changedCells.add(`${r}:${c}`)
    })
  })
  return {
    changedCells,
    addedRows,
    addedCols: [...addedCols].sort((x, y) => x - y),
    removedRows: Math.max(0, ar.length - br.length),
  }
}

export interface ListItemDiff {
  /** Trạng thái từng mục của B theo chỉ số. */
  items: ('same' | 'added' | 'checked')[]
  /** Mục của A không còn ở B, kèm chỉ số mục B đứng trước (-1 = đầu danh sách). */
  removed: { afterIndex: number; text: string }[]
}

const itemsOf = (list: TipTapNode) =>
  (list.content ?? []).map((item) => ({ text: textOf(item).trim(), checked: item.attrs?.checked === true }))

/** Danh sách / checklist: ghép mục theo text bằng LCS; mục chung khác trạng thái tick → 'checked'. */
export function listDiff(a: TipTapNode, b: TipTapNode): ListItemDiff {
  const ai = itemsOf(a)
  const bi = itemsOf(b)
  const pairs = lcsPairs(
    ai.map((x) => x.text),
    bi.map((x) => x.text),
  )
  const items: ListItemDiff['items'] = bi.map(() => 'added')
  const matchedA = new Set<number>()
  for (const [i, j] of pairs) {
    matchedA.add(i)
    items[j] = ai[i].checked !== bi[j].checked ? 'checked' : 'same'
  }
  const removed: ListItemDiff['removed'] = []
  const aToB = new Map(pairs)
  let lastB = -1
  ai.forEach((x, i) => {
    if (matchedA.has(i)) lastB = aToB.get(i)!
    else removed.push({ afterIndex: lastB, text: x.text })
  })
  return { items, removed }
}
