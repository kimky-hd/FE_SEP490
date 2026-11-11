import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { AlertTriangleIcon, ArrowUpRightIcon, CheckIcon, ShieldIcon } from '@/components/ui/icons'
import type { CalloutTone } from '@/types/document'
import { DiagramIcon, FigmaIcon } from '../docUi'
import { sanitizeSvg } from '@/lib/sanitize'

// ---------- Callout ----------

const TONES: CalloutTone[] = ['info', 'warning', 'rule', 'success']

const toneLabel = (t: (vi: string, en: string) => string, tone: CalloutTone) =>
  ({
    info: t('Thông tin', 'Info'),
    warning: t('Cảnh báo', 'Warning'),
    rule: t('Quy tắc', 'Rule'),
    success: t('Đạt', 'Success'),
  })[tone]

const toneDot: Record<CalloutTone, string> = {
  info: 'bg-brand-500',
  warning: 'bg-amber-500',
  rule: 'bg-violet-500',
  success: 'bg-success-500',
}

export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useI18n()
  const tone = (TONES.includes(node.attrs.tone) ? node.attrs.tone : 'info') as CalloutTone
  const Icon =
    tone === 'warning' ? AlertTriangleIcon : tone === 'rule' ? ShieldIcon : tone === 'success' ? CheckIcon : null
  return (
    <NodeViewWrapper className={clsx('doc-callout group/callout', `tone-${tone}`)} data-tone={tone}>
      <span className="doc-callout-icon" contentEditable={false} aria-hidden="true">
        {Icon ? <Icon className="h-4 w-4" /> : <span className="text-[13px] font-bold leading-none">i</span>}
      </span>
      <NodeViewContent className="doc-callout-body" />
      {editor.isEditable && (
        <span
          contentEditable={false}
          className="absolute right-2 top-2 hidden gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-1 shadow-xs group-hover/callout:flex"
        >
          {TONES.map((x) => (
            <button
              key={x}
              type="button"
              title={toneLabel(t, x)}
              aria-label={toneLabel(t, x)}
              aria-pressed={x === tone}
              onClick={() => updateAttributes({ tone: x })}
              className={clsx(
                'h-3.5 w-3.5 rounded-full',
                toneDot[x],
                x === tone ? 'ring-2 ring-gray-300 ring-offset-1' : 'opacity-60 hover:opacity-100',
              )}
            />
          ))}
        </span>
      )}
    </NodeViewWrapper>
  )
}

// ---------- Figma ----------

export function FigmaFrameView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const { t } = useI18n()
  const url = String(node.attrs.url ?? '')
  const title = String(node.attrs.title ?? '')
  const editing = editor.isEditable && (selected || !url)
  const safeUrl = /^https:\/\/([\w-]+\.)*figma\.com\//i.test(url) ? url : null
  return (
    <NodeViewWrapper className={clsx('doc-figma', selected && 'is-selected')} data-drag-handle="">
      <div className="flex items-center gap-3" contentEditable={false}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-gray-200 bg-white text-gray-600">
          <FigmaIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              <input
                className="doc-inline-input"
                placeholder={t('Tên khung', 'Frame name')}
                aria-label={t('Tên khung Figma', 'Figma frame name')}
                value={title}
                onChange={(e) => updateAttributes({ title: e.target.value })}
              />
              <input
                className="doc-inline-input"
                placeholder="https://www.figma.com/file/…"
                aria-label={t('Đường dẫn Figma', 'Figma link')}
                value={url}
                onChange={(e) => updateAttributes({ url: e.target.value.trim() })}
              />
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-gray-900">{title || t('Khung Figma', 'Figma frame')}</p>
              <p className="truncate text-xs text-gray-500">{url.replace(/^https:\/\/(www\.)?/, '')}</p>
            </>
          )}
        </div>
        {safeUrl && (
          <a
            href={safeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex shrink-0 items-center gap-1 rounded-control border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50"
          >
            {t('Mở Figma', 'Open Figma')}
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ---------- Mermaid ----------

let mermaidReady: Promise<typeof import('mermaid').default> | null = null
const loadMermaid = () => {
  mermaidReady ??= import('mermaid').then((m) => {
    m.default.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
      fontFamily: 'Roboto, sans-serif',
      // Mã sai: không để mermaid tự vẽ khung "Syntax error" (chèn thẳng vào <body>, không tắt được) — tự báo lỗi.
      suppressErrorRendering: true,
    })
    return m.default
  })
  return mermaidReady
}

/** Gỡ phần tử tạm mermaid có thể bỏ lại trong <body> khi vẽ hỏng (`#id` và `#d{id}`). */
const removeMermaidLeftovers = (id: string) => {
  for (const el of [document.getElementById(id), document.getElementById(`d${id}`)]) el?.remove()
}

/** Thông báo lỗi ngắn gọn từ lỗi parse của mermaid (bỏ dòng trống, tối đa 4 dòng). */
const mermaidErrorText = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return raw
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .slice(0, 4)
    .join('\n')
}

const isPlantUml = (code: string) => /^\s*@start(uml|mindmap|gantt|wbs|json|yaml)\b/i.test(code)

interface MermaidPreviewProps {
  code: string
  className?: string
  /** Báo mã vẽ được hay không (sau mỗi lần vẽ). */
  onStatus?: (ok: boolean) => void
  /** Vẫn kiểm tra mã nhưng chỉ hiện thông báo lỗi (tab "Mã nguồn"). */
  errorOnly?: boolean
}

/** Vẽ sơ đồ Mermaid (tải thư viện khi cần). Dùng cả trong editor lẫn hộp so sánh trước/sau. */
export function MermaidPreview({ code, className, onStatus, errorOnly = false }: MermaidPreviewProps) {
  const { t } = useI18n()
  const rawId = useId()
  const [svg, setSvg] = useState<string | null>(null)
  // null = vẽ được; chuỗi (có thể rỗng) = mã sai kèm chi tiết lỗi.
  const [error, setError] = useState<string | null>(null)
  const statusRef = useRef(onStatus)
  statusRef.current = onStatus
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!code.trim()) {
        setSvg(null)
        setError(null)
        return
      }
      const id = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`
      loadMermaid()
        // parse trước: mã sai thì dừng ở đây, không đụng tới DOM.
        .then(async (m) => {
          await m.parse(code)
          return m.render(id, code)
        })
        .then((r) => {
          if (!cancelled) {
            setSvg(sanitizeSvg(r.svg))
            setError(null)
            statusRef.current?.(true)
          }
        })
        .catch((err: unknown) => {
          removeMermaidLeftovers(id)
          if (cancelled) return
          setError(mermaidErrorText(err))
          statusRef.current?.(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [code, rawId])
  if (error !== null)
    return (
      <div
        role="alert"
        className={clsx('rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800', className)}
      >
        <p className="font-medium">
          {isPlantUml(code)
            ? t(
                'Đây là mã PlantUML — khối sơ đồ chỉ hỗ trợ Mermaid. Hãy chuyển sang cú pháp Mermaid.',
                'This is PlantUML — diagram blocks only support Mermaid. Please convert it to Mermaid syntax.',
              )
            : t('Sơ đồ chưa hợp lệ — kiểm tra lại cú pháp Mermaid.', 'The diagram has a Mermaid syntax error.')}
        </p>
        {error && !isPlantUml(code) && (
          <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-amber-900">
            {error}
          </pre>
        )}
      </div>
    )
  if (errorOnly) return null
  if (!svg)
    return <p className={clsx('text-xs text-gray-500', className)}>{t('Đang vẽ sơ đồ…', 'Rendering diagram…')}</p>
  // SVG do mermaid sinh với securityLevel strict, đã qua DOMPurify (sanitizeSvg) lúc nhận kết quả.
  return <div className={clsx('doc-mermaid-svg', className)} dangerouslySetInnerHTML={{ __html: svg }} />
}

export type DiagramTab = 'diagram' | 'code'

/** Nút chuyển "Sơ đồ" / "Mã nguồn" (khối sơ đồ và đề xuất của AI). */
export function DiagramTabs({
  value,
  onChange,
  tone = 'gray',
}: {
  value: DiagramTab
  onChange: (v: DiagramTab) => void
  tone?: 'gray' | 'ai'
}) {
  const { t } = useI18n()
  const opts: [DiagramTab, string][] = [
    ['diagram', t('Sơ đồ', 'Diagram')],
    ['code', t('Mã nguồn', 'Source')],
  ]
  return (
    <span
      role="tablist"
      aria-label={t('Chế độ xem sơ đồ', 'Diagram view')}
      className="doc-seg"
      data-tone={tone}
      contentEditable={false}
    >
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(v)}
          className={clsx('doc-seg-btn', value === v && 'is-on')}
        >
          {label}
        </button>
      ))}
    </span>
  )
}

/** Mã mặc định khi chèn khối sơ đồ từ menu "/". */
export const DEFAULT_MERMAID = 'flowchart LR\n  A[Bắt đầu] --> B[Kết thúc]'

/** Cầu nối từ DocEditor tới khối sơ đồ: nút "✦ Sinh từ nội dung" (AI bật + được sửa). */
export interface DiagramAiBridge {
  generate: (pos: number) => void
}
export interface CodeBlockStorage {
  ai: DiagramAiBridge | null
  listeners: Set<() => void>
  setAi: (ai: DiagramAiBridge | null) => void
}

export function createCodeBlockStorage(): CodeBlockStorage {
  const s: CodeBlockStorage = {
    ai: null,
    listeners: new Set(),
    setAi: (ai) => {
      s.ai = ai
      s.listeners.forEach((l) => l())
    },
  }
  return s
}

function useDiagramAi(storage: CodeBlockStorage | undefined) {
  return useSyncExternalStore(
    (cb) => {
      storage?.listeners.add(cb)
      return () => storage?.listeners.delete(cb)
    },
    () => storage?.ai ?? null,
  )
}

export function CodeBlockView({ node, editor, getPos }: NodeViewProps) {
  const { t } = useI18n()
  const isMermaid = node.attrs.language === 'mermaid'
  const code = node.textContent
  // null = tự chọn: "Sơ đồ" nếu mã hợp lệ, "Mã nguồn" khi lỗi (chốt lại để không nhảy tab khi đang sửa).
  const [tab, setTab] = useState<DiagramTab | null>(null)
  const view: DiagramTab = tab ?? (code.trim() ? 'diagram' : 'code')
  const ai = useDiagramAi(editor.storage.codeBlock as CodeBlockStorage | undefined)
  const emptyOrDefault = !code.trim() || code.trim() === DEFAULT_MERMAID
  const showCode = !isMermaid || view === 'code'

  const choose = (v: DiagramTab) => {
    setTab(v)
    if (v === 'code' && editor.isEditable && typeof getPos === 'function') {
      const end = getPos() + node.nodeSize - 1
      editor.chain().focus().setTextSelection(end).run()
    }
  }

  return (
    <NodeViewWrapper className={clsx('doc-code', isMermaid && 'is-mermaid', isMermaid && `view-${view}`)}>
      {isMermaid && (
        <div className="doc-mermaid-head flex items-center gap-2 px-3 pt-2" contentEditable={false}>
          <DiagramIcon className="h-3.5 w-3.5 text-gray-500" />
          <DiagramTabs value={view} onChange={choose} />
          {view === 'code' && !editor.isEditable && (
            <span className="text-xs text-gray-500">{t('Chỉ xem', 'Read only')}</span>
          )}
          {ai && editor.isEditable && emptyOrDefault && typeof getPos === 'function' && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ai.generate(getPos())}
              className="doc-ai-link ml-auto"
            >
              ✦ {t('Sinh từ nội dung', 'Generate from content')}
            </button>
          )}
        </div>
      )}
      <pre className={clsx(!showCode && 'sr-only')}>
        <NodeViewContent as="code" />
      </pre>
      {isMermaid && (
        <div
          contentEditable={false}
          className={clsx('px-3 pb-3 empty:hidden', view === 'diagram' ? 'pt-1' : 'pt-2')}
          // Bấm vào hình: chọn nguyên khối sơ đồ (để Ctrl/⌘+A giữ trong khối, không lan ra cả tài liệu).
          onMouseDown={(e) => {
            if (view !== 'diagram' || !editor.isEditable || typeof getPos !== 'function') return
            e.preventDefault()
            editor.chain().setNodeSelection(getPos()).focus().run()
          }}
        >
          <MermaidPreview
            code={code}
            errorOnly={view === 'code'}
            onStatus={(ok) => !ok && setTab((cur) => cur ?? 'code')}
          />
        </div>
      )}
    </NodeViewWrapper>
  )
}
