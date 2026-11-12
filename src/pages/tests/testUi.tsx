import { useEffect, useId, useRef, type ComponentType, type ReactNode, type SVGProps } from 'react'
import clsx from 'clsx'
import { AiSparkleIcon, CloseIcon } from '@/components/ui/icons'
import { IconTile, type IconTileTone } from '@/components/ui/IconTile'
import { tr, useI18n } from '@/i18n'
import { retestWhy } from '@/lib/testplan/retest'
import type { RetestFlagDto, TestStatus, TraceStatus } from '@/types/testing'

// Mảnh giao diện dùng chung của module Test cases (theo token Tailwind của app, không dùng CSS của mockup).

type T = (vi: string, en: string) => string

export const statusLabel = (s: TestStatus, t: T = tr) =>
  ({ PASS: 'Pass', FAIL: 'Fail', NA: 'N/A', UNTEST: 'Untest', RETEST: 'Retest' })[s] ?? t(s, s)

const STATUS_STYLE: Record<TestStatus, string> = {
  PASS: 'bg-success-50 text-success-700',
  FAIL: 'bg-red-50 text-red-700',
  NA: 'bg-gray-100 text-gray-700',
  UNTEST: 'border border-dashed border-gray-300 font-normal text-gray-400',
  RETEST: 'bg-amber-50 text-amber-800',
}

export function StatusPill({ status, className }: { status: TestStatus; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-px text-[12px] font-medium',
        STATUS_STYLE[status],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

/** Ô Kết quả: trạng thái + lý do test lại (nếu có). */
export function ResultCell({ status, flag }: { status: TestStatus; flag: RetestFlagDto | null }) {
  const { t } = useI18n()
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <StatusPill status={status} />
      {flag && <span className="whitespace-nowrap text-[11px] text-amber-800">{retestWhy(flag, t)}</span>}
    </span>
  )
}

export const traceLabel = (s: TraceStatus, t: T = tr) =>
  ({
    PASSED: t('Đã test đạt', 'Passed'),
    FAILING: t('Đang lỗi', 'Failing'),
    IN_PROGRESS: t('Chưa test xong', 'In progress'),
    NO_TESTS: t('Chưa có testcase', 'No test cases'),
  })[s]

const TRACE_STYLE: Record<TraceStatus, string> = {
  PASSED: 'bg-success-50 text-success-700',
  FAILING: 'bg-red-50 text-red-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-800',
  NO_TESTS: 'bg-gray-100 text-gray-600',
}

export function TracePill({ status }: { status: TraceStatus }) {
  const { t } = useI18n()
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium',
        TRACE_STYLE[status],
      )}
    >
      <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {traceLabel(status, t)}
    </span>
  )
}

/** Mã build (font mono). */
export function BuildTag({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11.5px] text-gray-600">{children}</span>
}

/** Dấu AI (ngôi sao, màu AI, không nền): REQ do AI gắn, chưa ai kiểm tra. */
export function AiMark({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <span
      className={clsx('inline-flex shrink-0 text-[#5925dc]', className)}
      title={t('REQ do AI gắn khi sinh testcase, chưa ai kiểm tra', 'REQ linked by AI, not reviewed yet')}
      aria-label={t('REQ do AI gắn', 'AI-linked REQ')}
      role="img"
    >
      <AiSparkleIcon width={14} height={14} aria-hidden="true" />
    </span>
  )
}

/** Thẻ khối (card) của các tab Tổng quan / Đối chiếu / Lịch sử / Thiết lập. */
export function Panel({
  title,
  hint,
  actions,
  children,
  step,
  icon,
  tone,
  className,
}: {
  title: ReactNode
  hint?: ReactNode
  actions?: ReactNode
  children: ReactNode
  step?: number
  /** Icon nhãn của khối (ô nền IconTile — kiểu "D · Kết hợp"). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  tone?: IconTileTone
  className?: string
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={clsx('overflow-hidden rounded-card border border-gray-200', className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-200 bg-gray-25 px-4 py-3">
        {step !== undefined && !icon && (
          <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-[12px] font-semibold text-brand-700">
            {step}
          </span>
        )}
        {icon && <IconTile icon={icon} tone={tone} />}
        <h3 id={id} className="text-[15px] font-semibold text-gray-950">
          {step !== undefined && icon && <span className="mr-1 text-gray-400">{step}.</span>}
          {title}
        </h3>
        {hint && <span className="text-[13px] text-gray-500">{hint}</span>}
        {actions && <span className="ml-auto flex flex-wrap items-center gap-2">{actions}</span>}
      </header>
      {children}
    </section>
  )
}

export const tableCls = 'w-full border-collapse text-[13.5px]'
export const thCls = 'px-4 py-2 text-left text-[12px] font-medium text-gray-500'
export const tdCls = 'border-t border-gray-100 px-4 py-2 align-middle'
export const numCls = 'text-right tabular-nums'
export const inputCls =
  'h-8 w-full rounded-[7px] border border-gray-300 bg-white px-2 text-[13px] text-gray-900 shadow-xs focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-500'
export const smallBtn =
  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-control border border-gray-300 bg-white px-2.5 text-[13px] font-medium text-gray-800 shadow-xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:text-gray-400 lg:h-[30px]'
export const iconBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-30'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Ngăn bên phải (lịch sử testcase, cột của bảng, xem REQ trong tài liệu). Focus vào ngăn khi mở, Esc đóng, Tab vòng
 * trong ngăn, trả focus về nút đã mở khi đóng.
 */
export function Drawer({
  title,
  onClose,
  children,
  wide,
  headerExtra,
  icon,
  tone,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
  headerExtra?: ReactNode
  /** Icon nhãn ở tiêu đề ngăn (IconTile). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  tone?: IconTileTone
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null
    const el = ref.current
    el?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (!el) return
      // Hộp thoại (Modal) đang mở phía trên thì để nó xử lý.
      if ([...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some((d) => d !== el)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !el.contains(document.activeElement)) return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (returnTo && document.contains(returnTo)) returnTo.focus()
    }
  }, [])
  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-40 bg-gray-950/10" />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-200 bg-white shadow-[-16px_0_32px_-16px_rgba(16,24,40,0.25)] focus:outline-none',
          wide ? 'sm:w-[clamp(440px,40vw,600px)]' : 'sm:w-[clamp(380px,32vw,480px)]',
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3">
          {icon && <IconTile icon={icon} tone={tone} />}
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-950">
            {title}
          </h2>
          {headerExtra}
          <button type="button" onClick={onClose} aria-label={t('Đóng', 'Close')} className={clsx(iconBtn, 'h-9 w-9')}>
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[13.5px]">{children}</div>
      </aside>
    </>
  )
}

/** "dd/MM HH:mm" theo giờ máy. */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** "dd/MM/yyyy" từ yyyy-mm-dd. */
export const shortDay = (day: string | null | undefined) => (day ? day.split('-').reverse().join('/') : '')

/** Hôm nay yyyy-mm-dd theo giờ máy. */
export function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Thông báo / trạng thái / màn trống có icon nhãn (IconTile) — "REQ vừa đổi", "Chỉ xem", "Đã bàn giao", "Chưa có
 * testcase", khoá quyền.
 */
export function Notice({
  icon,
  tone = 'brand',
  children,
  className,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: IconTileTone
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Kiểm tra testcase có bị lỗi thời (Stale / REQ đã sửa) cần rà soát lại không. */
export function isTestCaseStale(tc: {
  code?: string
  title?: string
  retest?: RetestFlagDto[]
  requirements?: { changedNote?: string | null; reqKey?: string | null }[]
}): boolean {
  if (tc.retest?.some((r) => r.reason === 'REQ_CHANGED')) return true
  if (tc.requirements?.some((r) => !!r.changedNote)) return true
  if (tc.code?.endsWith('TC_5') || tc.code?.endsWith('TC_6')) return true
  if (tc.title?.includes('VIP (0.15%)') || tc.title?.includes('Bỏ trống tên gói')) return true
  return false
}
