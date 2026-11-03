import { useEffect, useId, useRef, useState } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { ROLE_SHORT, type ProjectRoleKind } from '@/lib/projectRole'
import {
  HELP_SHORTCUTS,
  HELP_TOPICS,
  findHelpTopic,
  helpContextFromPath,
  pick,
  topicTips,
  type HelpTopic,
} from './helpContent'
import { HelpPaletteSection, useHelpAnswer } from './HelpAnswer'
import { useHelpOpen, useHelpTopicOverride } from './HelpProvider'

// Nút "?" 26px ở đầu trang → thẻ nhỏ "Mẹo cho trang <tên>" với 3 mẹo theo trang + vai trò (mock-role-modules.html 4b).
// Chân thẻ: trong dự án nhắc hỏi qua Ctrl K; ngoài dự án (chưa có Ctrl K) là ô hỏi nhanh dùng cùng kho hỏi đáp.
// "Phím tắt" đổi thân thẻ sang danh sách phím tắt. Mở bằng click hoặc phím "?" (HelpProvider); Esc / bấm ra ngoài để đóng.

export function HelpTips(props: { role?: ProjectRoleKind | null; topicId?: string; className?: string }) {
  // PageHeader có thể được render ngoài Router (test): khi đó không hiện nút.
  if (!useInRouterContext()) return null
  return <HelpTipsInRouter {...props} />
}

function HelpTipsInRouter({
  role,
  topicId,
  className,
}: {
  role?: ProjectRoleKind | null
  topicId?: string
  className?: string
}) {
  const { pathname, search } = useLocation()
  const topic = findHelpTopic(pathname, search)
  const override = useHelpTopicOverride()
  const chosen = (topicId && HELP_TOPIC_INDEX.get(topicId)) || (override && HELP_TOPIC_INDEX.get(override)) || topic
  if (!chosen) return null
  return <HelpTipsButton topic={chosen} role={role ?? null} pathname={pathname} className={className} />
}

const HELP_TOPIC_INDEX = new Map(HELP_TOPICS.map((t) => [t.id, t]))

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-[4px] border border-gray-200 bg-white px-1 font-sans text-[11px] font-medium text-gray-600 shadow-xs">
      {children}
    </kbd>
  )
}

function HelpTipsButton({
  topic,
  role,
  pathname,
  className,
}: {
  topic: HelpTopic
  role: ProjectRoleKind | null
  pathname: string
  className?: string
}) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const id = useId()
  const [open, setOpen] = useHelpOpen(id)
  const [view, setView] = useState<'tips' | 'keys'>('tips')
  const [ask, setAsk] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const inProject = /^\/projects\/\d+/.test(pathname)
  const answer = useHelpAnswer(inProject ? '' : ask)
  const ctx = helpContextFromPath(pathname)
  const tips = topicTips(topic, role)
  const roleLabel = role ? ROLE_SHORT[role] : ''
  const titleId = `${id}-title`
  const cardId = `${id}-card`

  // Mở: đưa focus vào thẻ. Đóng: về lại trạng thái mẹo.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => cardRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }
    setView('tips')
    setAsk('')
  }, [open])

  // Đổi trang thì đóng thẻ.
  useEffect(() => {
    setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, setOpen])

  const go = (href: string) => {
    setOpen(false)
    navigate(href)
  }

  return (
    <div ref={wrapRef} className={clsx('relative shrink-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t('Mẹo cho trang này (?)', 'Tips for this page (?)')}
        title={t('Mẹo (?)', 'Tips (?)')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        className={clsx(
          'grid h-[26px] w-[26px] place-items-center rounded-full border bg-white text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
          open
            ? 'border-brand-600 text-brand-600 ring-[3px] ring-brand-50'
            : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900',
        )}
      >
        ?
      </button>
      {open && (
        <div
          ref={cardRef}
          id={cardId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="fixed inset-x-4 top-16 z-40 overflow-hidden rounded-card border border-gray-200 bg-white text-left shadow-pop focus:outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px]"
        >
          <div className="flex items-center gap-2 border-b border-gray-200 px-3.5 py-2.5 text-[13px]">
            <b id={titleId} className="min-w-0 truncate font-semibold text-gray-950">
              {view === 'keys'
                ? t('Phím tắt', 'Keyboard shortcuts')
                : `${t('Mẹo cho trang', 'Tips for')} ${pick(topic.title, lang)}`}
            </b>
            {view === 'tips' && roleLabel && (
              <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-1.5 text-xs font-medium text-gray-600">
                {roleLabel}
              </span>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                buttonRef.current?.focus()
              }}
              aria-label={t('Đóng', 'Close')}
              className="grid h-6 w-6 place-items-center rounded-[6px] text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              ✕
            </button>
          </div>

          {view === 'keys' ? (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {HELP_SHORTCUTS.map((s) => (
                <li key={s.keys.join('+')} className="flex items-center gap-3 px-3.5 py-1.5 text-[13px] text-gray-600">
                  <span className="flex w-16 shrink-0 gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                  <span className="min-w-0">{pick(s.label, lang)}</span>
                </li>
              ))}
            </ul>
          ) : answer ? (
            <div className="max-h-[60vh] overflow-y-auto">
              <HelpPaletteSection answer={answer} ctx={ctx} onNavigate={go} onAsk={setAsk} compact />
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {ask.trim().length >= 2 && (
                <li className="border-b border-gray-200 px-3.5 py-2 text-[13px] text-gray-500">
                  {t('Chưa có câu trả lời, thử hỏi cách khác.', 'No answer yet, try asking another way.')}
                </li>
              )}
              {tips.map((tip) => (
                <li
                  key={tip.title.vi}
                  className="flex gap-2.5 border-b border-gray-200 px-3.5 py-2.5 text-[13px] leading-snug text-gray-600 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-5 min-w-5 shrink-0 place-items-center whitespace-nowrap rounded-[6px] bg-gray-100 px-1 text-[11px] font-semibold text-gray-600"
                  >
                    {tip.icon}
                  </span>
                  <span className="min-w-0">
                    <b className="block font-medium text-gray-950">{pick(tip.title, lang)}</b>
                    {pick(tip.body, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-3.5 py-2 text-[12.5px] text-gray-500">
            {view === 'keys' ? (
              <span>{t('Nhấn ? ở bất kỳ trang nào để mở mẹo', 'Press ? on any page for tips')}</span>
            ) : inProject ? (
              <span className="flex flex-wrap items-center gap-1">
                {t('Hỏi thêm:', 'Ask more:')} <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> {t('rồi gõ câu hỏi', 'then type a question')}
              </span>
            ) : (
              <input
                type="search"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder={t('Hỏi nhanh, vd: mời thành viên', 'Ask, e.g. invite members')}
                aria-label={t('Hỏi nhanh', 'Ask a question')}
                className="h-7 min-w-0 flex-1 rounded-[6px] border border-gray-200 bg-white px-2 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            )}
            <button
              type="button"
              onClick={() => setView(view === 'keys' ? 'tips' : 'keys')}
              className="shrink-0 rounded-[4px] font-medium text-brand-600 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            >
              {view === 'keys' ? t('Mẹo', 'Tips') : t('Phím tắt', 'Shortcuts')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
