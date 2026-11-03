import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BubbleMenu, EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { NodeSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { ListChecksIcon, NotesIcon, PlusIcon } from '@/components/ui/icons'
import { newUid } from '@/api/mock/documentContent'
import type { DiagramKind, DiagramProposalDto, DocType, GenerateDiagramBody, TipTapDoc } from '@/types/document'
import { pageTemplate, reqStarter } from '../templates'
import { BlockId, Callout, DocCodeBlock, FigmaFrame, ReqHeading } from './extensions'
import { createDocMarks, docMarksKey, type DocMarksHandlers, type DocMarksInput } from './docMarks'
import { DEFAULT_MERMAID, type CodeBlockStorage } from './nodeViews'
import { DiagramProposal, type DiagramProposalState } from './DiagramProposal'
import { DiagramIcon, FigmaIcon, TableIcon, docErrorMessage } from '../docUi'
import './docEditor.css'

export interface DocEditorProps {
  content: TipTapDoc
  editable: boolean
  canComment: boolean
  marks: DocMarksInput
  /** reqUid của REQ đang được tô vàng (di chuột trên dòng ghi chú gốc). */
  highlightReqUid?: string | null
  commentCounts?: Record<string, number>
  onUserChange?: () => void
  onReady?: (editor: Editor) => void
  onCommentRequest?: (anchorId: string, quote: string) => void
  onCommentClick?: (commentId: number) => void
  onCommentBubbleClick?: (anchorId: string) => void
  onBlockCompare?: (blockId: string) => void
  /** Loại tài liệu của trang: nút "Dùng mẫu …" ở trang trống chèn khung mục tương ứng. */
  docType?: DocType | null
  /** Nút "Từ ghi chú họp" ở trang trống (mở trình tạo từ ghi chú họp). */
  onFromNotes?: () => void
  /** AI sinh sơ đồ (§6b). Chỉ truyền khi dự án bật AI; chỉ dùng khi `editable`. */
  generateDiagram?: (body: Omit<GenerateDiagramBody, 'documentId'>) => Promise<DiagramProposalDto>
}

const TEMPLATE_TYPES: DocType[] = ['SRS', 'URD', 'BRD']
const DIAGRAM_KINDS: DiagramKind[] = ['flowchart', 'sequence', 'state']

/** Nơi đặt sơ đồ khi "Áp dụng": chèn sau khối (insert) hoặc thay mã khối sơ đồ (replace). */
interface DiagramTarget {
  blockId: string | null
  pos: number
}
interface DiagramJob {
  text: string
  target: DiagramTarget
  replace: boolean
}
interface DiagramRun {
  job: DiagramJob
  requested?: DiagramKind
  state: DiagramProposalState
}

const blockText = (n: PMNode) =>
  n.type.name === 'codeBlock' || n.type.name === 'figmaFrame' ? '' : n.textBetween(0, n.content.size, '\n', '\n').trim()

/** Khối cấp cao nhất chứa vị trí `pos`. */
function topBlockAt(doc: PMNode, pos: number) {
  const $p = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  const index = Math.min($p.index(0), doc.childCount - 1)
  const node = doc.child(index)
  return { index, node, pos: $p.posAtIndex(index, 0) }
}

/** Thân mục REQ chứa khối thứ `index`; không thuộc REQ → chữ của khối đó (hoặc khối có chữ ngay trước nó). */
function sectionText(doc: PMNode, index: number): string {
  const blocks: PMNode[] = []
  doc.forEach((n) => blocks.push(n))
  let h = -1
  for (let i = index; i >= 0; i--) {
    if (blocks[i]?.type.name === 'heading') {
      h = i
      break
    }
  }
  if (h >= 0 && blocks[h].attrs.req) {
    const level = Number(blocks[h].attrs.level ?? 1)
    const lines: string[] = []
    for (let i = h + 1; i < blocks.length; i++) {
      const n = blocks[i]
      if (n.type.name === 'heading' && Number(n.attrs.level ?? 1) <= level) break
      if (n.type.name !== 'heading') lines.push(blockText(n))
    }
    const text = lines.filter(Boolean).join('\n')
    if (text) return text
  }
  for (let i = index; i >= 0 && i > h; i--) {
    const v = blocks[i] ? blockText(blocks[i]) : ''
    if (v) return v
  }
  return ''
}

function locateTarget(doc: PMNode, target: DiagramTarget): { node: PMNode; pos: number } | null {
  let hit: { node: PMNode; pos: number } | null = null
  if (target.blockId) {
    doc.forEach((n, pos) => {
      if (!hit && n.attrs.id === target.blockId) hit = { node: n, pos }
    })
    if (hit) return hit
  }
  const n = target.pos < doc.content.size ? doc.nodeAt(target.pos) : null
  return n ? { node: n, pos: target.pos } : null
}

/** Trang trống hoàn toàn: đúng một đoạn văn rỗng. */
const isBlankDoc = (editor: Editor) => {
  const { doc } = editor.state
  return doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph' && doc.firstChild.content.size === 0
}

interface GutterState {
  bars: { top: number; height: number; status: string; title: string }[]
  rails: { top: number; height: number; highlight: boolean }[]
  bubbles: { top: number; anchorId: string; count: number }[]
}

interface SlashItem {
  id: string
  label: string
  hint: string
  keywords: string
  icon: ReactNode
  run: (editor: Editor) => void
}

const glyph = (text: string) => <span className="text-[11px] font-semibold leading-none">{text}</span>

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export function DocEditor(props: DocEditorProps) {
  const { content, editable, canComment, marks, highlightReqUid, commentCounts = {}, docType } = props
  const { t } = useI18n()
  const wrapRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  const handlers = useMemo<DocMarksHandlers>(
    () => ({
      onCommentClick: (id) => propsRef.current.onCommentClick?.(id),
      onBlockCompare: (id) => propsRef.current.onBlockCompare?.(id),
    }),
    [],
  )

  // ---------- AI sinh sơ đồ (đề xuất, chưa sửa tài liệu cho tới khi "Áp dụng") ----------
  const canAi = editable && !!props.generateDiagram
  const [diagram, setDiagram] = useState<DiagramRun | null>(null)
  const [diagramTop, setDiagramTop] = useState<number | null>(null)
  const diagramRef = useRef(diagram)
  diagramRef.current = diagram
  const diagramSeq = useRef(0)

  const runDiagram = useCallback(
    (job: DiagramJob, kind?: DiagramKind) => {
      const gen = propsRef.current.generateDiagram
      const seq = ++diagramSeq.current
      const text = job.text.trim()
      if (!gen) return
      if (!text) {
        setDiagram({
          job,
          requested: kind,
          state: {
            status: 'error',
            message: t(
              'Chưa có nội dung để vẽ. Hãy viết mô tả luồng hoặc bôi đen một đoạn.',
              'Nothing to draw yet. Write the flow or select some text.',
            ),
          },
        })
        return
      }
      setDiagram({ job, requested: kind, state: { status: 'loading' } })
      gen({ text: text.slice(0, 8000), kind, anchorId: job.target.blockId ?? undefined })
        .then((result) => {
          if (seq === diagramSeq.current) setDiagram((d) => d && { ...d, state: { status: 'ready', result } })
        })
        .catch((err: unknown) => {
          if (seq === diagramSeq.current)
            setDiagram((d) => d && { ...d, state: { status: 'error', message: docErrorMessage(err) } })
        })
    },
    [t],
  )

  const dismissDiagram = useCallback(() => {
    diagramSeq.current++
    setDiagram(null)
  }, [])

  const retryDiagram = useCallback(() => {
    const d = diagramRef.current
    if (!d) return
    // "Thử lại" đổi loại sơ đồ theo vòng: lưu đồ → tuần tự → trạng thái.
    const base = d.requested ?? (d.state.status === 'ready' ? d.state.result.kind : undefined)
    const next =
      d.state.status === 'error'
        ? d.requested
        : base
          ? DIAGRAM_KINDS[(DIAGRAM_KINDS.indexOf(base) + 1) % DIAGRAM_KINDS.length]
          : undefined
    runDiagram(d.job, next)
  }, [runDiagram])

  /** Lối vào (b) menu "/" và (c) nút trong khối sơ đồ: lấy chữ của mục REQ chứa vị trí `pos`. */
  const diagramFromSection = useCallback(
    (ed: Editor, pos: number, replace: boolean) => {
      const { doc } = ed.state
      const top = topBlockAt(doc, pos)
      const target: DiagramTarget = replace
        ? { blockId: doc.resolve(pos).depth === 0 ? ((doc.nodeAt(pos)?.attrs.id as string | null) ?? null) : null, pos }
        : { blockId: (top.node.attrs.id as string | null) ?? null, pos: top.pos }
      runDiagram({ text: sectionText(doc, top.index), target, replace })
    },
    [runDiagram],
  )
  const diagramFromSectionRef = useRef(diagramFromSection)
  diagramFromSectionRef.current = diagramFromSection

  // ---------- Slash menu ----------
  const [slash, setSlash] = useState<{ query: string; from: number; to: number; top: number; left: number } | null>(
    null,
  )
  const [slashIndex, setSlashIndex] = useState(0)
  const [plus, setPlus] = useState<{ top: number; left: number } | null>(null)

  const slashItems = useMemo<SlashItem[]>(
    () => [
      {
        id: 'p',
        label: t('Đoạn văn', 'Text'),
        hint: t('Văn bản thường', 'Plain text'),
        keywords: 'doan van text paragraph',
        icon: glyph('T'),
        run: (e) => e.chain().focus().setParagraph().run(),
      },
      {
        id: 'h1',
        label: t('Tiêu đề 1', 'Heading 1'),
        hint: t('Chương lớn', 'Section'),
        keywords: 'tieu de heading h1',
        icon: glyph('H1'),
        run: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
      },
      {
        id: 'h2',
        label: t('Tiêu đề 2', 'Heading 2'),
        hint: t('Mục', 'Subsection'),
        keywords: 'tieu de heading h2',
        icon: glyph('H2'),
        run: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        id: 'h3',
        label: t('Tiêu đề 3', 'Heading 3'),
        hint: t('Mục con', 'Minor heading'),
        keywords: 'tieu de heading h3',
        icon: glyph('H3'),
        run: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        id: 'req',
        label: t('Yêu cầu (REQ)', 'Requirement (REQ)'),
        hint: t('Tiêu đề được đánh số REQ', 'Numbered REQ heading'),
        keywords: 'yeu cau req requirement',
        icon: glyph('R'),
        run: (e) =>
          e
            .chain()
            .focus()
            .setHeading({ level: 2 })
            .updateAttributes('heading', { req: true, reqUid: newUid(), priority: 'MEDIUM' })
            .run(),
      },
      {
        id: 'ul',
        label: t('Danh sách', 'Bulleted list'),
        hint: t('Gạch đầu dòng', 'Bullets'),
        keywords: 'danh sach bullet list',
        icon: glyph('•'),
        run: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        id: 'ol',
        label: t('Danh sách số', 'Numbered list'),
        hint: '1. 2. 3.',
        keywords: 'danh sach so numbered ordered',
        icon: glyph('1.'),
        run: (e) => e.chain().focus().toggleOrderedList().run(),
      },
      {
        id: 'todo',
        label: 'Checklist',
        hint: t('Tiêu chí nghiệm thu', 'Acceptance criteria'),
        keywords: 'checklist tieu chi task todo',
        icon: <ListChecksIcon className="h-4 w-4" />,
        run: (e) => e.chain().focus().toggleTaskList().run(),
      },
      {
        id: 'table',
        label: t('Bảng', 'Table'),
        hint: t('Bảng dữ liệu, thêm hàng/cột', 'Rows and columns'),
        keywords: 'bang table',
        icon: <TableIcon />,
        run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: 'callout',
        label: t('Ghi chú', 'Callout'),
        hint: t('Thông tin, cảnh báo, quy tắc', 'Info, warning, rule'),
        keywords: 'ghi chu callout canh bao quy tac note',
        icon: <NotesIcon className="h-4 w-4" />,
        run: (e) =>
          e
            .chain()
            .focus()
            .insertContent({ type: 'callout', attrs: { tone: 'info' }, content: [{ type: 'paragraph' }] })
            .run(),
      },
      {
        id: 'mermaid',
        label: t('Sơ đồ', 'Diagram'),
        hint: 'Mermaid',
        keywords: 'so do diagram mermaid flow',
        icon: <DiagramIcon />,
        run: (e) =>
          e
            .chain()
            .focus()
            .insertContent({
              type: 'codeBlock',
              attrs: { language: 'mermaid' },
              content: [{ type: 'text', text: DEFAULT_MERMAID }],
            })
            .run(),
      },
      ...(canAi
        ? [
            {
              id: 'ai-diagram',
              label: t('Sơ đồ từ AI', 'Diagram from AI'),
              hint: t('Vẽ từ nội dung mục đang viết', 'Draw from the current section'),
              keywords: 'so do tu ai diagram mermaid ve flow sinh',
              icon: <span className="text-[13px] font-semibold leading-none text-brand-600">✦</span>,
              run: (e: Editor) => diagramFromSectionRef.current(e, e.state.selection.from, false),
            },
          ]
        : []),
      {
        id: 'figma',
        label: t('Khung Figma', 'Figma frame'),
        hint: t('Liên kết thiết kế', 'Link a design'),
        keywords: 'figma khung thiet ke design',
        icon: <FigmaIcon />,
        run: (e) =>
          e
            .chain()
            .focus()
            .insertContent({ type: 'figmaFrame', attrs: { url: '', title: '' } })
            .run(),
      },
    ],
    [t, canAi],
  )

  const filtered = useMemo(() => {
    if (!slash) return []
    const q = fold(slash.query.trim())
    return q ? slashItems.filter((i) => fold(i.label).includes(q) || i.keywords.includes(q)) : slashItems
  }, [slash, slashItems])

  const slashRef = useRef({ slash, filtered, slashIndex })
  slashRef.current = { slash, filtered, slashIndex }

  const runSlash = useCallback((editor: Editor, item: SlashItem) => {
    const s = slashRef.current.slash
    if (!s) return
    editor.chain().focus().deleteRange({ from: s.from, to: s.to }).run()
    item.run(editor)
    setSlash(null)
  }, [])

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: false, codeBlock: false }),
      ReqHeading,
      DocCodeBlock,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      // Gợi ý hiện ở khối đang có con trỏ, và luôn hiện ở trang trống kể cả khi editor chưa được focus
      // (trước đây trang trống không có dấu hiệu nào nên người dùng tưởng không gõ được).
      Placeholder.configure({
        showOnlyCurrent: false,
        includeChildren: true,
        placeholder: ({ editor: ed, node, hasAnchor }) => {
          if (!node.isTextblock || node.type.name === 'codeBlock') return ''
          if (!hasAnchor && !ed.isEmpty) return ''
          if (node.type.name === 'heading')
            return node.attrs.req ? t('Tên yêu cầu', 'Requirement name') : t('Tiêu đề', 'Heading')
          return t('Gõ “/” để chèn khối…', 'Type “/” for blocks…')
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      FigmaFrame,
      BlockId,
      createDocMarks(handlers),
    ],
    // Ngôn ngữ đổi thì placeholder đổi theo lần mở trang sau; không dựng lại editor giữa chừng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handlers],
  )

  const editor = useEditor({
    extensions,
    // Trang mới tạo có `content: []`: ProseMirror khi đó không có dòng nào để đặt con trỏ (trông như "không gõ được").
    content: content.content?.length ? content : { ...content, content: [{ type: 'paragraph' }] },
    editable,
    editorProps: {
      attributes: { class: 'doc-prose', 'aria-label': t('Nội dung tài liệu', 'Document content') },
      handleKeyDown: (_view, event) => {
        const { slash: s, filtered: items, slashIndex: idx } = slashRef.current
        if (!s || items.length === 0) return false
        if (event.key === 'ArrowDown') {
          setSlashIndex((idx + 1) % items.length)
          return true
        }
        if (event.key === 'ArrowUp') {
          setSlashIndex((idx - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const ed = editorRef.current
          if (ed) runSlash(ed, items[idx] ?? items[0])
          return true
        }
        if (event.key === 'Escape') {
          setSlash(null)
          return true
        }
        return false
      },
    },
    onUpdate: ({ transaction }) => {
      if (transaction.getMeta('preventUpdate')) return
      propsRef.current.onUserChange?.()
    },
  })
  const editorRef = useRef<Editor | null>(null)
  editorRef.current = editor

  // ---------- Trang trống: gợi ý bắt đầu ----------
  const [blank, setBlank] = useState(false)
  const [tplMenu, setTplMenu] = useState(false)
  useEffect(() => {
    if (!editor) return
    const check = () => setBlank(isBlankDoc(editor))
    check()
    editor.on('update', check)
    return () => {
      editor.off('update', check)
    }
  }, [editor])

  useEffect(() => {
    if (editor) props.onReady?.(editor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false)
  }, [editor, editable])

  // Đẩy dữ liệu đánh dấu (bản gốc, so sánh, REQ stale, bình luận) vào plugin decoration.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dispatch(
      editor.state.tr.setMeta(docMarksKey, marks).setMeta('addToHistory', false).setMeta('preventUpdate', true),
    )
  }, [editor, marks])

  // ---------- Slash / nút "+" theo vị trí con trỏ ----------
  useEffect(() => {
    if (!editor) return
    const update = () => {
      const wrap = wrapRef.current
      const { selection } = editor.state
      if (!wrap || !editor.isEditable || !selection.empty) {
        setSlash(null)
        setPlus(null)
        return
      }
      const $from = selection.$from
      const parent = $from.parent
      const box = wrap.getBoundingClientRect()
      const isPara = parent.type.name === 'paragraph'
      if (isPara && parent.content.size === 0 && $from.depth === 1) {
        const c = editor.view.coordsAtPos($from.pos)
        setPlus({ top: c.top - box.top, left: c.left - box.left })
      } else setPlus(null)
      const before = isPara ? parent.textBetween(0, $from.parentOffset, '\n', '\n') : ''
      const m = /^\/([^\n/]{0,24})$/.exec(before)
      if (!m) {
        setSlash(null)
        return
      }
      const from = $from.start()
      const c = editor.view.coordsAtPos(from)
      setSlash((prev) => {
        if (!prev || prev.from !== from) setSlashIndex(0)
        return { query: m[1], from, to: $from.pos, top: c.bottom - box.top + 6, left: c.left - box.left }
      })
    }
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    editor.on('blur', () => setPlus(null))
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
    }
  }, [editor])

  useEffect(() => setSlashIndex((i) => Math.min(i, Math.max(0, filtered.length - 1))), [filtered.length])

  // ---------- AI sinh sơ đồ: áp dụng, phím tắt, nút trong khối sơ đồ ----------
  const applyDiagram = useCallback(() => {
    const d = diagramRef.current
    const ed = editorRef.current
    if (!d || d.state.status !== 'ready' || !ed || !ed.isEditable) return
    const { state } = ed
    const { schema } = state
    const code = d.state.result.mermaid
    const loc = locateTarget(state.doc, d.job.target)
    const tr = state.tr
    if (d.job.replace && loc && loc.node.type.name === 'codeBlock') {
      tr.replaceWith(loc.pos + 1, loc.pos + loc.node.nodeSize - 1, schema.text(code))
    } else {
      const block = schema.nodes.codeBlock.create({ language: 'mermaid' }, schema.text(code))
      if (!loc) tr.insert(state.doc.content.size, block)
      // Đoạn trống (vừa gõ "/"): thay luôn đoạn đó.
      else if (loc.node.type.name === 'paragraph' && loc.node.content.size === 0)
        tr.replaceWith(loc.pos, loc.pos + loc.node.nodeSize, block)
      else tr.insert(loc.pos + loc.node.nodeSize, block)
    }
    ed.view.dispatch(tr.scrollIntoView())
    dismissDiagram()
  }, [dismissDiagram])

  useEffect(() => {
    if (!diagram) return
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement
      const inEditor = !active || active === document.body || !!wrapRef.current?.contains(active)
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        dismissDiagram()
      } else if (e.key === 'Tab' && !e.shiftKey && inEditor && diagram.state.status === 'ready') {
        e.preventDefault()
        e.stopPropagation()
        applyDiagram()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [diagram, applyDiagram, dismissDiagram])

  // Trang chuyển sang chỉ đọc (so sánh, gửi duyệt…): bỏ đề xuất đang mở.
  useEffect(() => {
    if (!canAi) dismissDiagram()
  }, [canAi, dismissDiagram])

  useEffect(() => {
    if (!editor) return
    const storage = editor.storage.codeBlock as CodeBlockStorage | undefined
    storage?.setAi(canAi ? { generate: (pos) => diagramFromSectionRef.current(editor, pos, true) } : null)
    return () => storage?.setAi(null)
  }, [editor, canAi])

  // ---------- Lề: vạch thay đổi, rail REQ, bong bóng bình luận ----------
  const [gutter, setGutter] = useState<GutterState>({ bars: [], rails: [], bubbles: [] })

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    if (!editor || editor.isDestroyed || !wrap) return
    const box = wrap.getBoundingClientRect()
    const state = docMarksKey.getState(editor.state)
    const bars: GutterState['bars'] = []
    const rails: GutterState['rails'] = []
    const bubbles: GutterState['bubbles'] = []
    const counts = propsRef.current.commentCounts ?? {}
    const hl = propsRef.current.highlightReqUid
    const tops: { el: HTMLElement; node: { type: { name: string }; attrs: Record<string, unknown> } }[] = []
    editor.state.doc.forEach((node, pos) => {
      const dom = editor.view.nodeDOM(pos)
      if (dom instanceof HTMLElement) tops.push({ el: dom, node })
    })
    const rectOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return { top: r.top - box.top, bottom: r.bottom - box.top }
    }
    tops.forEach(({ el, node }, i) => {
      const id = node.attrs.id as string | null
      const r = rectOf(el)
      const change = id ? state?.diff.blocks.get(id) : undefined
      if (change && change.status !== 'format') {
        bars.push({
          top: r.top,
          height: r.bottom - r.top,
          status: change.status,
          title: el.getAttribute('data-chg-title') ?? '',
        })
      }
      if (id && counts[id]) bubbles.push({ top: r.top, anchorId: id, count: counts[id] })
      if (node.type.name === 'heading' && node.attrs.req) {
        const level = Number(node.attrs.level ?? 1)
        let end = r.bottom
        for (let j = i + 1; j < tops.length; j++) {
          const n = tops[j].node
          if (n.type.name === 'heading' && Number(n.attrs.level ?? 1) <= level) break
          end = rectOf(tops[j].el).bottom
        }
        rails.push({ top: r.top - 4, height: end - r.top + 8, highlight: !!hl && node.attrs.reqUid === hl })
      }
    })
    setGutter({ bars, rails, bubbles })
    // Đề xuất sơ đồ nằm ngay dưới khối nguồn.
    const d = diagramRef.current
    const loc = d ? locateTarget(editor.state.doc, d.job.target) : null
    const dom = loc ? editor.view.nodeDOM(loc.pos) : null
    setDiagramTop(d ? (dom instanceof HTMLElement ? rectOf(dom).bottom + 8 : 0) : null)
  }, [editor])

  useLayoutEffect(() => {
    if (!editor) return
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    schedule()
    editor.on('transaction', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(editor.view.dom)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      editor.off('transaction', schedule)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [editor, measure])

  useEffect(() => {
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
  }, [measure, highlightReqUid, commentCounts, diagram])

  // ---------- Bubble menu ----------
  const [linkDraft, setLinkDraft] = useState<string | null>(null)

  if (!editor) return null

  const inHeading = editor.isActive('heading')
  const isReq = inHeading && !!editor.getAttributes('heading').req
  const toggleReq = () => {
    if (isReq) editor.chain().focus().updateAttributes('heading', { req: false, reqUid: null, priority: null }).run()
    else if (inHeading)
      editor.chain().focus().updateAttributes('heading', { req: true, reqUid: newUid(), priority: 'MEDIUM' }).run()
    else
      editor
        .chain()
        .focus()
        .setHeading({ level: 2 })
        .updateAttributes('heading', { req: true, reqUid: newUid(), priority: 'MEDIUM' })
        .run()
  }
  const requestComment = () => {
    const { from, to } = editor.state.selection
    const $from = editor.state.doc.resolve(from)
    const top = $from.depth >= 1 ? $from.node(1) : null
    const anchorId = (top?.attrs.id as string | undefined) ?? null
    const tb = $from.parent
    const end = Math.min(to, $from.end())
    const quote = editor.state.doc.textBetween(from, end, ' ', ' ').trim().slice(0, 300)
    if (anchorId && quote && tb.isTextblock) propsRef.current.onCommentRequest?.(anchorId, quote)
  }
  /** Lối vào (a): bôi đen → "✦ Vẽ sơ đồ"; sơ đồ chèn sau khối chứa cuối vùng chọn. */
  const diagramFromSelection = () => {
    const { from, to } = editor.state.selection
    const { doc } = editor.state
    const top = topBlockAt(doc, to)
    runDiagram({
      text: doc.textBetween(from, to, '\n', '\n'),
      target: { blockId: (top.node.attrs.id as string | null) ?? null, pos: top.pos },
      replace: false,
    })
    // Thu vùng chọn về cuối để thanh định dạng không che đề xuất.
    editor.commands.setTextSelection(to)
  }
  const applyLink = () => {
    const href = (linkDraft ?? '').trim()
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else if (/^(https?:\/\/|mailto:)/i.test(href))
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setLinkDraft(null)
  }

  const starterBtn =
    'inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950'
  const insertTemplate = (d: DocType) => {
    setTplMenu(false)
    editor.chain().setContent(pageTemplate(d, t), true).focus('start').run()
  }
  const insertReq = () => {
    const doc = reqStarter(t)
    const len = doc.content[0]?.content?.[0]?.text?.length ?? 0
    // Chọn sẵn chữ "Tên yêu cầu" để gõ đè ngay.
    editor
      .chain()
      .setContent(doc, true)
      .setTextSelection({ from: 1, to: 1 + len })
      .focus()
      .run()
  }
  const focusEnd = () => {
    const last = editor.state.doc.lastChild
    // Khối cuối không phải đoạn văn (bảng, ghi chú, sơ đồ…): thêm một đoạn trống để có chỗ gõ tiếp.
    if (last && last.type.name !== 'paragraph') {
      editor.chain().insertContentAt(editor.state.doc.content.size, { type: 'paragraph' }).focus('end').run()
    } else editor.commands.focus('end')
  }

  const bubbleBtn = (active: boolean) =>
    clsx(
      'h-8 rounded-[6px] px-2 text-[13px] font-medium transition-colors',
      active ? 'bg-white/15 text-white' : 'text-gray-200 hover:bg-white/10 hover:text-white',
    )
  const sep = <span className="mx-0.5 h-4 w-px bg-white/20" aria-hidden="true" />
  const tableBtn = 'h-7 rounded-[6px] px-2 text-xs font-medium text-gray-700 hover:bg-gray-100'

  const tableRect = () => {
    const dom = editor.view.domAtPos(editor.state.selection.from).node as HTMLElement
    const el = (dom.nodeType === 1 ? dom : dom.parentElement)?.closest('table')
    return el?.getBoundingClientRect() ?? new DOMRect()
  }

  return (
    <div ref={wrapRef} className="doc-editor relative">
      {/* Rail REQ + nền vàng (dưới chữ) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {gutter.rails.map((r, i) => (
          <div
            key={i}
            className={clsx(
              'absolute -left-1.5 right-0 rounded-r-[6px] border-l-2 sm:-left-3',
              r.highlight ? 'border-amber-400 bg-amber-50/80' : 'border-gray-200',
            )}
            style={{ top: r.top, height: r.height }}
          />
        ))}
      </div>

      <EditorContent editor={editor} className="relative" />

      {editable && blank && (
        <div
          className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm text-gray-500"
          data-testid="doc-starter"
        >
          <span className="mr-1">{t('Bắt đầu viết, hoặc:', 'Start writing, or:')}</span>
          {docType && TEMPLATE_TYPES.includes(docType) ? (
            <button type="button" className={starterBtn} onClick={() => insertTemplate(docType)}>
              <NotesIcon className="h-4 w-4" />
              {t(`Dùng mẫu ${docType}`, `Use ${docType} template`)}
            </button>
          ) : (
            <span className="relative">
              <button
                type="button"
                className={starterBtn}
                aria-expanded={tplMenu}
                onClick={() => setTplMenu((v) => !v)}
              >
                <NotesIcon className="h-4 w-4" />
                {t('Dùng mẫu SRS/URD/BRD', 'Use an SRS/URD/BRD template')}
              </button>
              {tplMenu && (
                <span className="absolute left-0 top-full z-20 mt-1 flex w-48 flex-col rounded-card border border-gray-200 bg-white p-1 shadow-pop">
                  {TEMPLATE_TYPES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="rounded-[6px] px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => insertTemplate(d)}
                    >
                      {t(`Mẫu ${d}`, `${d} template`)}
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}
          <button type="button" className={starterBtn} onClick={insertReq}>
            {glyph('R')}
            {t('Thêm yêu cầu (REQ)', 'Add a requirement (REQ)')}
          </button>
          {props.onFromNotes && (
            <button type="button" className={starterBtn} onClick={() => props.onFromNotes?.()}>
              <ListChecksIcon className="h-4 w-4" />
              {t('Từ ghi chú họp', 'From meeting notes')}
            </button>
          )}
        </div>
      )}

      {/* Bấm vào vùng trống dưới nội dung: đặt con trỏ ở cuối trang (như Notion). */}
      {editable && (
        <div
          aria-hidden="true"
          data-testid="doc-tail"
          className="min-h-[30vh] cursor-text"
          onMouseDown={(e) => {
            e.preventDefault()
            focusEnd()
          }}
        />
      )}

      {/* Lớp phủ động nằm trong một khung cố định: BubbleMenu (tippy) dời node của nó ra body, React không được chèn cạnh nó. */}
      <div className="contents">
        {/* Vạch thay đổi ở lề trái, có tooltip */}
        {gutter.bars.map((b, i) => (
          <span
            key={i}
            title={b.title}
            className={clsx(
              'absolute -left-3 w-[3px] rounded-full sm:-left-6',
              b.status === 'modified' && 'bg-brand-500',
              b.status === 'added' && 'bg-success-500',
              b.status === 'moved' && 'bg-gray-400',
            )}
            style={{ top: b.top + 2, height: Math.max(8, b.height - 4) }}
          />
        ))}

        {/* Số bình luận ở lề phải */}
        {gutter.bubbles.map((b) => (
          <button
            key={b.anchorId}
            type="button"
            onClick={() => propsRef.current.onCommentBubbleClick?.(b.anchorId)}
            className="absolute -right-2 translate-x-full whitespace-nowrap rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 shadow-xs hover:border-amber-300 hover:text-gray-900 max-xl:right-0 max-xl:translate-x-0"
            style={{ top: b.top + 2 }}
          >
            {t(`${b.count} bình luận`, `${b.count} ${b.count === 1 ? 'comment' : 'comments'}`)}
          </button>
        ))}

        {plus && !slash && (
          <button
            type="button"
            aria-label={t('Chèn khối', 'Insert block')}
            title={t('Chèn khối', 'Insert block')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().insertContent('/').run()}
            className="absolute flex h-6 w-6 -translate-x-8 items-center justify-center rounded-[6px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            style={{ top: plus.top - 1, left: plus.left }}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        )}

        {slash && filtered.length > 0 && (
          <div
            role="listbox"
            aria-label={t('Chèn khối', 'Insert block')}
            className="absolute z-30 max-h-80 w-72 overflow-y-auto rounded-card border border-gray-200 bg-white p-1 shadow-pop"
            style={{ top: slash.top, left: Math.max(0, slash.left) }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <p className="px-2.5 pb-1 pt-1.5 text-xs text-gray-500">{t('Chèn khối', 'Insert block')}</p>
            {filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={i === slashIndex}
                onMouseEnter={() => setSlashIndex(i)}
                onClick={() => runSlash(editor, item)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left',
                  i === slashIndex ? 'bg-gray-100' : 'hover:bg-gray-50',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-gray-200 bg-white text-gray-600">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-gray-900">{item.label}</span>
                  <span className="block truncate text-xs text-gray-500">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {diagram && diagramTop !== null && (
          <div className="absolute inset-x-0 z-20 sm:-left-2 sm:-right-2" style={{ top: diagramTop }}>
            <DiagramProposal
              key={diagram.state.status === 'ready' ? diagram.state.result.mermaid : diagram.state.status}
              state={diagram.state}
              replacing={diagram.job.replace}
              onApply={applyDiagram}
              onRetry={retryDiagram}
              onDismiss={dismissDiagram}
            />
          </div>
        )}
      </div>

      <BubbleMenu
        editor={editor}
        pluginKey="textBubble"
        tippyOptions={{ duration: 120, placement: 'top', maxWidth: 'none', onHidden: () => setLinkDraft(null) }}
        shouldShow={({ editor: ed, view, state, from, to }) => {
          if (from === to || state.selection instanceof NodeSelection) return false
          if (ed.isActive('codeBlock')) return false
          if (!ed.isEditable) return canComment
          return view.hasFocus()
        }}
      >
        <div className="flex items-center gap-0.5 rounded-control bg-gray-900 p-1 shadow-pop">
          {linkDraft !== null ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                applyLink()
              }}
            >
              <input
                autoFocus
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="https://…"
                aria-label={t('Đường dẫn', 'Link URL')}
                className="h-8 w-56 rounded-[6px] border-0 bg-white/10 px-2 text-[13px] text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-white/40"
              />
              <button type="submit" className={bubbleBtn(false)}>
                {t('Lưu', 'Apply')}
              </button>
            </form>
          ) : (
            <>
              {editor.isEditable && (
                <>
                  <button
                    type="button"
                    title={t('Đậm (Ctrl+B)', 'Bold (Ctrl+B)')}
                    aria-label={t('Đậm', 'Bold')}
                    className={clsx(bubbleBtn(editor.isActive('bold')), 'w-8 font-bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    title={t('Nghiêng (Ctrl+I)', 'Italic (Ctrl+I)')}
                    aria-label={t('Nghiêng', 'Italic')}
                    className={clsx(bubbleBtn(editor.isActive('italic')), 'w-8 italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    title={t('Gạch chân (Ctrl+U)', 'Underline (Ctrl+U)')}
                    aria-label={t('Gạch chân', 'Underline')}
                    className={clsx(bubbleBtn(editor.isActive('underline')), 'w-8 underline')}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                  >
                    U
                  </button>
                  <button
                    type="button"
                    className={bubbleBtn(editor.isActive('link'))}
                    onClick={() => setLinkDraft(String(editor.getAttributes('link').href ?? ''))}
                  >
                    Link
                  </button>
                  {sep}
                </>
              )}
              {canComment && (
                <button type="button" className={bubbleBtn(false)} onClick={requestComment}>
                  {t('Bình luận', 'Comment')}
                </button>
              )}
              {editor.isEditable && (
                <>
                  {sep}
                  <button type="button" className={bubbleBtn(isReq)} onClick={toggleReq}>
                    {isReq ? t('Bỏ đánh dấu REQ', 'Unmark REQ') : t('Đánh dấu REQ', 'Mark as REQ')}
                  </button>
                </>
              )}
              {editor.isEditable && canAi && (
                <>
                  {sep}
                  <button
                    type="button"
                    className="h-8 rounded-[6px] bg-brand-600 px-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-700"
                    onClick={diagramFromSelection}
                  >
                    ✦ {t('Vẽ sơ đồ', 'Draw diagram')}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </BubbleMenu>

      <BubbleMenu
        editor={editor}
        pluginKey="tableBar"
        tippyOptions={{ duration: 100, placement: 'top-start', getReferenceClientRect: tableRect, offset: [0, 6] }}
        shouldShow={({ editor: ed, state }) => ed.isEditable && ed.isActive('table') && state.selection.empty}
      >
        <div className="flex items-center gap-0.5 rounded-control border border-gray-200 bg-white p-0.5 shadow-pop">
          <button type="button" className={tableBtn} onClick={() => editor.chain().focus().addRowAfter().run()}>
            {t('+ Hàng', '+ Row')}
          </button>
          <button type="button" className={tableBtn} onClick={() => editor.chain().focus().addColumnAfter().run()}>
            {t('+ Cột', '+ Column')}
          </button>
          <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />
          <button type="button" className={tableBtn} onClick={() => editor.chain().focus().deleteRow().run()}>
            {t('Xoá hàng', 'Delete row')}
          </button>
          <button type="button" className={tableBtn} onClick={() => editor.chain().focus().deleteColumn().run()}>
            {t('Xoá cột', 'Delete column')}
          </button>
          <button
            type="button"
            className={clsx(tableBtn, 'text-red-700 hover:bg-red-50')}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            {t('Xoá bảng', 'Delete table')}
          </button>
        </div>
      </BubbleMenu>
    </div>
  )
}
