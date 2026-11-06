import { type ReactNode } from 'react'
import clsx from 'clsx'
import { tr, useI18n } from '@/i18n'
import type { IssuePriority, IssueTestCounts, IssueType, ReqRefDto, UserRef } from '@/types/issue'
import type { RunResult, TestType } from '@/types/testing'

// Mảnh giao diện dùng chung cho Kanban và Test cases (doc/mockups/mock-kanban-testcases.html).

// ---------- Nhãn ----------

export const issueTypeLabel = (type: IssueType) =>
  ({ TASK: tr('Việc', 'Task'), BUG: 'Bug', STORY: 'Story', DESIGN: tr('Thiết kế', 'Design') })[type]

export const priorityLabel = (p: IssuePriority) =>
  ({ HIGHEST: tr('Cao nhất', 'Highest'), HIGH: tr('Cao', 'High'), MEDIUM: tr('TB', 'Medium'), LOW: tr('Thấp', 'Low') })[
    p
  ]

export const testTypeLabel = (type: TestType) =>
  ({
    FUNCTIONAL: tr('Chức năng', 'Functional'),
    BOUNDARY: tr('Biên (Boundary)', 'Boundary'),
    NEGATIVE: tr('Ngoại lệ (Negative)', 'Negative'),
    UI_UX: 'UI / UX',
    SECURITY: tr('Bảo mật', 'Security'),
    PERFORMANCE: tr('Hiệu năng', 'Performance'),
    INTEGRATION: tr('Tích hợp', 'Integration'),
    E2E: 'E2E',
    UNIT: 'Unit',
    REGRESSION: tr('Hồi quy', 'Regression'),
  })[type] ?? type

export const resultLabel = (r: RunResult | null) =>
  ({
    PASS: tr('Đạt', 'Pass'),
    FAIL: tr('Lỗi', 'Fail'),
    BLOCKED: tr('Bị chặn', 'Blocked'),
    NOT_RUN: tr('Chưa chạy', 'Not run'),
    UNTESTED: tr('Chưa chạy', 'Untested'),
  })[r ?? 'UNTESTED'] ?? tr('Chưa chạy', 'Untested')

/** dd/MM theo giờ máy. */
export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase() || '?'

// ---------- Biểu tượng nhỏ ----------

const TYPE_STYLE: Record<IssueType, [string, string]> = {
  TASK: ['bg-brand-600', '✓'],
  BUG: ['bg-red-600', 'B'],
  STORY: ['bg-success-500', 'S'],
  DESIGN: ['bg-[#ee46bc]', 'D'],
}

export function TypeIcon({ type, className }: { type: IssueType; className?: string }) {
  const [bg, ch] = TYPE_STYLE[type]
  return (
    <span
      title={issueTypeLabel(type)}
      aria-label={issueTypeLabel(type)}
      role="img"
      className={clsx(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold leading-none text-white',
        bg,
        className,
      )}
    >
      {ch}
    </span>
  )
}

const PRIORITY_STYLE: Record<IssuePriority, [string, string]> = {
  HIGHEST: ['text-red-700', '↑↑'],
  HIGH: ['text-red-700', '↑'],
  MEDIUM: ['text-amber-700', '='],
  LOW: ['text-gray-400', '↓'],
}

export function PriorityMark({ priority, withLabel = false }: { priority: IssuePriority; withLabel?: boolean }) {
  const [color, mark] = PRIORITY_STYLE[priority]
  return (
    <span className={clsx('whitespace-nowrap text-xs font-bold', color)} title={priorityLabel(priority)}>
      <span aria-hidden="true">{mark}</span>
      {withLabel ? (
        <span className="ml-1 font-medium">{priorityLabel(priority)}</span>
      ) : (
        <span className="sr-only">{priorityLabel(priority)}</span>
      )}
    </span>
  )
}

const HUES = [150, 30, 210, 90, 0, 180, 330, 60]
const hueOf = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

/** Avatar chữ cái 22–24px (cùng bảng màu với Avatar của app). */
export function PersonDot({
  user,
  size = 24,
  ring = false,
  className,
}: {
  user: UserRef | null
  size?: number
  ring?: boolean
  className?: string
}) {
  if (!user)
    return (
      <span
        aria-label={tr('Chưa giao', 'Unassigned')}
        role="img"
        style={{ width: size, height: size }}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-[10px] text-gray-400',
          className,
        )}
      >
        –
      </span>
    )
  const hue = hueOf(user.fullName)
  return (
    <span
      role="img"
      aria-label={user.fullName}
      title={user.fullName}
      style={{ width: size, height: size, backgroundColor: `hsl(${hue} 45% 90%)`, color: `hsl(${hue} 55% 22%)` }}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
        ring && 'ring-2 ring-white',
        className,
      )}
    >
      {initials(user.fullName)}
    </span>
  )
}

/** Chip REQ: xanh; cam khi REQ đổi sau lần liên kết / xác nhận. */
export function ReqChip({ req, short = false, className }: { req: ReqRefDto; short?: boolean; className?: string }) {
  const { t } = useI18n()
  const changed = !!req.changedNote
  const removed = req.reqKey === null
  const label = removed ? t('REQ đã xoá', 'REQ removed') : req.reqKey
  return (
    <span
      title={[req.documentCode, req.title, req.changedNote].filter(Boolean).join(' · ')}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] border px-1.5 text-[11.5px] font-medium leading-[18px]',
        changed || removed
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-brand-200 bg-brand-50 text-brand-800',
        className,
      )}
    >
      {label}
      {changed && !short && <span>· {t('đổi', 'changed')}</span>}
    </span>
  )
}

export function CodeChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 text-[11.5px] font-medium leading-[18px] text-gray-600',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Vạch kết quả test nhỏ trên thẻ issue (mỗi testcase liên kết một vạch). */
export function TestBars({ tests }: { tests: IssueTestCounts }) {
  const { t } = useI18n()
  if (tests.total === 0) return null
  const bars = [
    ...Array(tests.pass).fill('bg-success-500'),
    ...Array(tests.fail).fill('bg-red-600'),
    ...Array(tests.blocked).fill('bg-amber-500'),
    ...Array(tests.notRun).fill('bg-gray-300'),
  ].slice(0, 8)
  const label = t(
    `Test: ${tests.pass} đạt, ${tests.fail} lỗi, ${tests.blocked} bị chặn, ${tests.notRun} chưa chạy`,
    `Tests: ${tests.pass} pass, ${tests.fail} fail, ${tests.blocked} blocked, ${tests.notRun} not run`,
  )
  return (
    <span className="inline-flex items-center gap-0.5" title={label} role="img" aria-label={label}>
      {bars.map((c, i) => (
        <i key={i} className={clsx('block h-2.5 w-1.5 rounded-[2px]', c)} />
      ))}
    </span>
  )
}

const RESULT_STYLE: Record<RunResult, string> = {
  PASS: 'border-success-200 bg-success-50 text-success-700',
  FAIL: 'border-red-200 bg-red-50 text-red-700',
  BLOCKED: 'border-amber-200 bg-amber-50 text-amber-800',
  NOT_RUN: 'border-gray-300 bg-white text-gray-700',
  UNTESTED: 'border-gray-300 bg-white text-gray-700',
}

export function ResultPill({ result, empty }: { result: RunResult | null; empty?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-[7px] border px-2 py-px text-[12.5px] font-medium',
        RESULT_STYLE[result ?? 'NOT_RUN'],
      )}
    >
      {result === null && empty ? empty : resultLabel(result)}
    </span>
  )
}

/** Chip lọc nhanh. `roleDefault` = mặc định theo vai trò (viền đứt như mockup). */
export function FilterChip({
  active,
  roleDefault,
  count,
  onClick,
  children,
}: {
  active: boolean
  roleDefault?: boolean
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={roleDefault ? t('Mặc định theo vai trò của bạn', 'Default for your role') : undefined}
      className={clsx(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12.5px] font-medium transition-colors lg:h-7',
        roleDefault && 'border-dashed',
        active
          ? 'border-brand-200 bg-brand-50 text-brand-800'
          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
      )}
    >
      {children}
      {count !== undefined && <span className="font-normal text-gray-400">{count}</span>}
    </button>
  )
}

/** Nút chọn kiểu "segmented" (Board / Backlog, Nhóm theo…). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-[9px] bg-gray-100 p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex h-8 items-center gap-1 rounded-[7px] px-2.5 text-[13px] font-medium lg:h-[26px]',
            o.value === value ? 'bg-white text-gray-950 shadow-xs' : 'text-gray-500 hover:text-gray-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Thanh tiến độ xếp chồng (đạt / lỗi / chặn / chưa chạy hoặc điểm). */
export function StackBar({ parts, className }: { parts: { value: number; className: string }[]; className?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <span className={clsx('flex h-2 overflow-hidden rounded-full bg-gray-100', className)} aria-hidden="true">
      {total > 0 &&
        parts.map((p, i) => (
          <i key={i} style={{ width: `${(p.value / total) * 100}%` }} className={clsx('block h-full', p.className)} />
        ))}
    </span>
  )
}

// ---------- Ghi nhớ lựa chọn theo dự án ----------

export function readPref<T>(projectId: number, key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`ssam.work.${projectId}.${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writePref(projectId: number, key: string, value: unknown) {
  try {
    window.localStorage.setItem(`ssam.work.${projectId}.${key}`, JSON.stringify(value))
  } catch {
    // Không lưu được (chế độ riêng tư): bỏ qua.
  }
}

export const fieldLabel = 'text-[13px] text-gray-500'
export const inlineSelect =
  'h-9 rounded-[7px] border border-gray-300 bg-white px-2 text-[13px] text-gray-900 shadow-xs focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-500 lg:h-8'
