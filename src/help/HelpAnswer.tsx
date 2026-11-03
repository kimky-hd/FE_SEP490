import { useMemo } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { pick, type HelpContext, type HelpQA } from './helpContent'
import { answerQuestion, type HelpAnswer } from './searchHelp'

// Thẻ trả lời của kho hỏi đáp (mock-role-modules.html 4c): "Hướng dẫn" (tiêu đề đậm + trả lời), "Làm luôn", "Liên quan".
// Dùng trong Ctrl K (HelpPaletteSection) và trong ô hỏi nhanh của thẻ mẹo ở trang ngoài dự án.

/** Câu trả lời cho câu đang gõ (null nếu không giống câu hỏi / không đủ chắc). */
export function useHelpAnswer(query: string): HelpAnswer | null {
  return useMemo(() => (query.trim().length >= 2 ? answerQuestion(query) : null), [query])
}

export function resolvedActions(entry: HelpQA, ctx: HelpContext) {
  return (entry.actions ?? []).flatMap((a) => {
    const to = a.to(ctx)
    return to ? [{ ...a, href: to }] : []
  })
}

const rowClass =
  'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-950 focus-visible:bg-gray-100 focus-visible:outline-none'

/** Đoạn "Hướng dẫn / Làm luôn / Liên quan" đặt trên đầu danh sách kết quả của Ctrl K. */
export function HelpPaletteSection({
  answer,
  ctx,
  onNavigate,
  onAsk,
  compact = false,
}: {
  answer: HelpAnswer
  ctx: HelpContext
  onNavigate: (href: string) => void
  /** Bấm một câu "Liên quan": thay câu hỏi đang gõ. */
  onAsk: (question: string) => void
  /** Bản gọn trong thẻ mẹo (lề nhỏ hơn). */
  compact?: boolean
}) {
  const { t, lang } = useI18n()
  const { best, related } = answer
  const actions = resolvedActions(best, ctx)
  const pad = compact ? 'px-3.5' : 'px-4'
  const row = clsx(rowClass, compact && '!px-3.5 !py-1.5 text-[13px]')
  return (
    <section aria-label={t('Hướng dẫn', 'Help')} className={compact ? 'py-1' : 'pb-1'}>
      <p className={clsx(pad, 'pb-1 pt-2.5 text-xs text-gray-500')}>{t('Hướng dẫn', 'Help')}</p>
      <div
        className={clsx(
          'mb-2 mt-1 rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13.5px] leading-relaxed text-gray-600',
          compact ? 'mx-3.5' : 'mx-4',
        )}
        aria-live="polite"
      >
        <b className="font-medium text-gray-950">{pick(best.title, lang)}:</b> {pick(best.answer, lang)}
      </div>
      {actions.length > 0 && (
        <>
          <p className={clsx(pad, 'pb-1 pt-1.5 text-xs text-gray-500')}>{t('Làm luôn', 'Do it now')}</p>
          {actions.map((a) => (
            <button key={a.href + a.label.vi} type="button" className={row} onClick={() => onNavigate(a.href)}>
              <span aria-hidden="true" className="w-4 shrink-0 text-center text-brand-600">
                ↗
              </span>
              <span className="min-w-0 flex-1 truncate">{pick(a.label, lang)}</span>
              {a.hint && <span className="shrink-0 text-xs text-gray-400">{pick(a.hint, lang)}</span>}
            </button>
          ))}
        </>
      )}
      {related.length > 0 && (
        <>
          <p className={clsx(pad, 'pb-1 pt-1.5 text-xs text-gray-500')}>{t('Liên quan', 'Related')}</p>
          {related.map((r) => (
            <button key={r.id} type="button" className={row} onClick={() => onAsk(pick(r.q, lang))}>
              <span aria-hidden="true" className="w-4 shrink-0 text-center text-gray-400">
                ?
              </span>
              <span className="min-w-0 flex-1 truncate">{pick(r.q, lang)}</span>
            </button>
          ))}
        </>
      )}
    </section>
  )
}
