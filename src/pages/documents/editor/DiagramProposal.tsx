import { useState } from 'react'
import { useI18n } from '@/i18n'
import { AlertTriangleIcon } from '@/components/ui/icons'
import type { DiagramKind, DiagramProposalDto } from '@/types/document'
import { DiagramTabs, MermaidPreview, type DiagramTab } from './nodeViews'

export type DiagramProposalState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: DiagramProposalDto }

interface Props {
  state: DiagramProposalState
  /** "Áp dụng" thay mã của khối sơ đồ hiện có (thay vì chèn khối mới). */
  replacing: boolean
  onApply: () => void
  onRetry: () => void
  onDismiss: () => void
}

/** Đề xuất sơ đồ của AI (§6b): chưa chèn gì vào tài liệu cho tới khi bấm "Áp dụng". */
export function DiagramProposal({ state, replacing, onApply, onRetry, onDismiss }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<DiagramTab>('diagram')
  const kindLabel = (k: DiagramKind) =>
    ({ flowchart: t('lưu đồ', 'flowchart'), sequence: t('tuần tự', 'sequence'), state: t('trạng thái', 'state') })[k]

  return (
    <div
      className="doc-ai-prop"
      role="region"
      aria-label={t('Đề xuất sơ đồ', 'Diagram proposal')}
      data-testid="diagram-proposal"
      aria-busy={state.status === 'loading'}
    >
      <div className="doc-ai-prop-head">
        <span aria-hidden="true">✦</span>
        <span>{t('Đề xuất sơ đồ', 'Proposed diagram')}</span>
        {state.status === 'ready' && (
          <span className="font-normal text-gray-500">· {kindLabel(state.result.kind)}</span>
        )}
        {state.status === 'loading' && <span className="font-normal text-gray-500">· {t('đang vẽ…', 'drawing…')}</span>}
        <span className="flex-1" />
        {state.status === 'ready' && <DiagramTabs value={tab} onChange={setTab} tone="ai" />}
      </div>

      <div className="px-3 py-3">
        {state.status === 'loading' && (
          <div className="space-y-2.5 py-1" aria-hidden="true">
            <div className="doc-ai-shimmer mx-auto h-7 w-40" />
            <div className="doc-ai-shimmer mx-auto h-7 w-56" />
            <div className="doc-ai-shimmer mx-auto h-7 w-32" />
          </div>
        )}
        {state.status === 'error' && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {state.message}
          </p>
        )}
        {state.status === 'ready' &&
          (tab === 'diagram' ? (
            // Khung cuộn bọc ngoài: đặt max-height thẳng lên khung flex sẽ ép SVG co nhỏ theo chiều cao.
            <div className="max-h-[45vh] overflow-auto">
              <MermaidPreview code={state.result.mermaid} />
            </div>
          ) : (
            <pre className="max-h-[45vh] overflow-auto rounded-control bg-gray-50 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-gray-800">
              {state.result.mermaid}
            </pre>
          ))}
        {state.status === 'ready' && state.result.notes.length > 0 && (
          <ul
            className="mt-3 space-y-1 border-t border-gray-100 pt-2.5 text-xs text-gray-600"
            aria-label={t('Điểm chưa rõ', 'Open questions')}
          >
            {state.result.notes.map((n, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2">
        {state.status === 'ready' && (
          <button type="button" className="doc-ai-btn" onClick={onApply}>
            {replacing ? t('Áp dụng vào khối', 'Apply to block') : t('Áp dụng', 'Apply')}
            <span className="doc-ai-kbd">Tab</span>
          </button>
        )}
        {state.status !== 'loading' && (
          <button type="button" className="doc-ai-ghost" onClick={onRetry}>
            {t('Thử lại', 'Retry')}
          </button>
        )}
        <button type="button" className="doc-ai-ghost" onClick={onDismiss}>
          {t('Bỏ qua', 'Dismiss')}
          <span className="doc-ai-kbd">Esc</span>
        </button>
      </div>
    </div>
  )
}
