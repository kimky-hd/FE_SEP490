import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { PencilIcon } from '@/components/ui/icons'
import { findOption, optionColor, priorityText, type ColumnDef } from '@/lib/testplan/columns'
import { lastResultIn, retestIn, statusIn } from '@/lib/testplan/status'
import { stepsToText } from '@/lib/testplan/steps'
import { PersonDot } from '../kanban/workUi'
import type { CustomValue, TestCaseDto, TestPlanDto, TestPriority, TestResult } from '@/types/testing'
import { AiMark, BuildTag, ResultCell, shortDateTime, shortDay } from './testUi'

// Ô của bảng testcase: giá trị để sửa, hiển thị theo loại cột, ô sửa (editor). Không giữ state — SheetGrid lo.

export type CellValue = string | string[] | number | null

/** Giá trị hiện tại của ô (dạng chữ để sửa). */
export function cellValue(tc: TestCaseDto, col: ColumnDef, envId: number): CellValue {
  switch (col.id) {
    case 'title':
      return tc.title
    case 'preconditions':
      return tc.preconditions ?? ''
    case 'actual':
      return tc.actual ?? ''
    case 'steps':
      return stepsToText(tc.steps).steps
    case 'expected':
      return stepsToText(tc.steps).expected
    case 'priority':
      return tc.priority
    case 'category':
      return tc.category ?? ''
    case 'browser':
      return tc.browser ?? ''
    case 'result':
      return lastResultIn(tc, envId)?.result ?? 'UNTEST'
  }
  if (!col.custom) return null
  const v: CustomValue | undefined = tc.customFields[col.id]
  if (v === undefined || v === null) return col.multiple ? [] : col.kind === 'number' ? null : ''
  return v
}

const Empty = () => <span className="text-gray-300">—</span>

function OptionChip({ label, color }: { label: string; color?: number }) {
  return (
    <span
      className={clsx(
        'inline-flex whitespace-nowrap rounded-full px-2 py-px text-[12px]',
        color === undefined ? 'bg-gray-100 text-gray-700' : optionColor(color),
      )}
    >
      {label}
    </span>
  )
}

export interface DisplayCtx {
  plan: TestPlanDto
  envId: number
  projectId: number
  docView: boolean
  canEditReq: boolean
  canBug: boolean
  reqTitle: (documentId: number, reqUid: string) => string | null
  onReqClick: (ref: { documentId: number; reqUid: string }) => void
  onReqEdit: () => void
  onBug: () => void
}

/** Hiển thị ô (không sửa). */
export function CellDisplay({ tc, col, ctx }: { tc: TestCaseDto; col: ColumnDef; ctx: DisplayCtx }): ReactNode {
  const { t } = useI18n()
  switch (col.kind) {
    case 'key':
      return <span className="font-mono text-[12px] text-gray-600">{tc.code}</span>
    case 'result':
      return <ResultCell status={statusIn(tc, ctx.envId)} flag={retestIn(tc, ctx.envId)} />
    case 'req': {
      if (!tc.requirements.length)
        return ctx.canEditReq ? <span className="text-gray-400">{t('+ Gắn REQ', '+ Link REQ')}</span> : <Empty />
      return (
        <span className="flex flex-wrap items-center gap-1">
          {tc.aiSuggestedReqs && <AiMark />}
          {tc.requirements.map((r) => {
            const label = r.reqKey ?? t('REQ đã xoá', 'REQ removed')
            const title = [r.documentCode, ctx.reqTitle(r.documentId, r.reqUid) ?? r.title, r.changedNote]
              .filter(Boolean)
              .join(' · ')
            const cls = clsx(
              'whitespace-nowrap rounded-[5px] px-1.5 font-mono text-[11.5px] font-medium leading-[18px]',
              r.changedNote ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-700',
            )
            return ctx.docView ? (
              <button
                key={`${r.documentId}:${r.reqUid}`}
                type="button"
                title={t(`Mở ${label} trong tài liệu: ${title}`, `Open ${label} in the document: ${title}`)}
                onClick={(e) => {
                  e.stopPropagation()
                  ctx.onReqClick(r)
                }}
                className={clsx(
                  cls,
                  'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                )}
              >
                {label}
              </button>
            ) : (
              <span key={`${r.documentId}:${r.reqUid}`} title={title} className={cls}>
                {label}
              </span>
            )
          })}
          {ctx.canEditReq && (
            <button
              type="button"
              aria-label={t(`Sửa REQ của ${tc.code}`, `Edit REQs of ${tc.code}`)}
              title={t('Sửa REQ', 'Edit REQs')}
              onClick={(e) => {
                e.stopPropagation()
                ctx.onReqEdit()
              }}
              className="inline-flex rounded p-0.5 text-gray-400 hover:text-gray-800"
            >
              <PencilIcon width={14} height={14} aria-hidden="true" />
            </button>
          )}
        </span>
      )
    }
    case 'bug':
      if (tc.bug)
        return (
          <Link
            to={`/projects/${ctx.projectId}/kanban?issue=${encodeURIComponent(tc.bug.key)}`}
            onClick={(e) => e.stopPropagation()}
            title={`${tc.bug.title} · ${tc.bug.statusName} · ${t('trên Kanban', 'on Kanban')}`}
            className="whitespace-nowrap rounded-[5px] bg-red-50 px-1.5 font-mono text-[11.5px] font-medium text-red-700 hover:underline"
          >
            {tc.bug.key}
          </Link>
        )
      return ctx.canBug && statusIn(tc, ctx.envId) === 'FAIL' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            ctx.onBug()
          }}
          className="text-[12px] font-medium text-red-700 hover:underline"
        >
          {t('+ Bug', '+ Bug')}
        </button>
      ) : (
        <Empty />
      )
    case 'ro':
      if (col.id === 'build') {
        const last = lastResultIn(tc, ctx.envId)
        return last?.build ? <BuildTag>{last.build}</BuildTag> : <Empty />
      }
      if (col.id === 'bugStatus') {
        if (!tc.bug) return <Empty />
        const c = tc.bug.statusCategory
        return (
          <span
            className={clsx(
              'whitespace-nowrap rounded-[4px] px-1.5 py-px text-[11.5px] font-medium',
              c === 'DONE'
                ? 'bg-success-50 text-success-700'
                : c === 'IN_PROGRESS'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-700',
            )}
          >
            {tc.bug.statusName || c}
          </span>
        )
      }
      return <Empty />
  }
  const v = cellValue(tc, col, ctx.envId)
  if (v === null || v === '' || (Array.isArray(v) && !v.length)) return <Empty />
  if (col.kind === 'select') {
    const vals = Array.isArray(v) ? v : [String(v)]
    return (
      <span className="flex flex-wrap gap-1">
        {vals.map((x) => {
          if (col.id === 'priority') return <OptionChip key={x} label={priorityText(x as TestPriority, t)} />
          const o = findOption(col.options, x)
          return <OptionChip key={x} label={o?.label ?? x} color={col.custom ? o?.color : undefined} />
        })}
      </span>
    )
  }
  if (col.kind === 'person') {
    const p = ctx.plan.people.find((u) => String(u.userId) === String(v))
    return p ? (
      <span className="inline-flex items-center gap-1.5">
        <PersonDot user={p} size={20} />
        {p.fullName}
      </span>
    ) : (
      String(v)
    )
  }
  if (col.kind === 'date') return shortDay(String(v))
  if (col.kind === 'number')
    return (
      <span className="tabular-nums">
        {String(v)}
        {col.custom?.unit ? ` ${col.custom.unit}` : ''}
      </span>
    )
  return String(v)
}

/** Chú thích (title) của ô Kết quả: ai ghi, lúc nào, môi trường + build, ghi thay ai. */
export function resultTooltip(
  tc: TestCaseDto,
  plan: TestPlanDto,
  envId: number,
  t: (vi: string, en: string) => string,
) {
  const r = lastResultIn(tc, envId)
  if (!r) return undefined
  const env = plan.environments.find((e) => e.envId === r.envId)?.name ?? ''
  return [
    r.by.fullName,
    shortDateTime(r.at),
    `${env} ${r.build ?? ''}`.trim(),
    r.behalfOf ? t(`ghi thay ${r.behalfOf.fullName}`, `on behalf of ${r.behalfOf.fullName}`) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export const RESULT_OPTIONS: TestResult[] = ['PASS', 'FAIL', 'NA', 'UNTEST']

/**
 * Ô đang sửa. Enter lưu (textarea: Ctrl+Enter), Esc huỷ, Tab lưu và sang ô bên. Danh sách chọn mở ngay khi vào ô
 * (bấm 1 lần), chọn là lưu.
 */
export function CellEditor({
  tc,
  col,
  envId,
  plan,
  onCommit,
  onCancel,
  onTab,
}: {
  tc: TestCaseDto
  col: ColumnDef
  envId: number
  plan: TestPlanDto
  onCommit: (value: CellValue, move?: 'down') => void
  onCancel: () => void
  /** `undefined` = ô không đổi, chỉ di chuyển. */
  onTab: (value: CellValue | undefined, back: boolean) => void
}) {
  const { t } = useI18n()
  const done = useRef(false)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null)
  // Ô Kết quả của case cần test lại: bắt đầu trống ("— Retest —") để chọn lại đúng kết quả cũ (Fail lại / Pass) vẫn ghi.
  const retest = col.kind === 'result' && statusIn(tc, envId) === 'RETEST'
  const initial = retest ? '' : cellValue(tc, col, envId)
  const label = `${col.label} ${tc.code}`

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    if (el.tagName === 'SELECT' && !el.multiple) {
      try {
        ;(el as HTMLSelectElement & { showPicker?: () => void }).showPicker?.()
      } catch {
        // Trình duyệt không cho mở danh sách bằng script: người dùng bấm thêm một lần.
      }
    } else {
      const input = el as HTMLInputElement | HTMLTextAreaElement
      if (input.type !== 'date' && input.type !== 'number' && 'setSelectionRange' in input) {
        const n = String(input.value).length
        input.setSelectionRange(n, n)
      }
    }
  }, [])

  const read = (): CellValue => {
    const el = ref.current
    if (!el) return initial
    if (el.tagName === 'SELECT' && el.multiple) return [...el.selectedOptions].map((o) => o.value)
    if (col.kind === 'number') return el.value === '' ? null : el.value
    return el.value
  }
  const commit = (move?: 'down') => {
    if (done.current) return
    done.current = true
    const v = read()
    // Ô Kết quả còn ở "— Retest —" (chưa chọn gì): không ghi.
    if (col.kind === 'result' && !v) onCancel()
    else onCommit(v, move)
  }
  const same = (a: CellValue, b: CellValue) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '')
  const onKey = (e: ReactKeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      done.current = true
      onCancel()
    } else if (e.key === 'Enter' && (ref.current?.tagName !== 'TEXTAREA' || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      commit('down')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (done.current) return
      done.current = true
      // Không đổi gì (hoặc Kết quả còn trống) → chỉ sang ô bên, không ghi.
      const v = read()
      onTab(same(v, initial) || (col.kind === 'result' && !v) ? undefined : v, e.shiftKey)
    }
  }
  const common = {
    onKeyDown: onKey,
    // Rời ô mà không đổi gì thì huỷ (nhất là ô Kết quả: không ghi thêm một lần trùng).
    onBlur: () => {
      if (done.current) return
      if (same(read(), initial)) {
        done.current = true
        onCancel()
      } else commit()
    },
    'aria-label': label,
  }
  const field =
    'w-full rounded-[6px] border border-brand-300 bg-white px-1.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-100'

  if (col.kind === 'multi')
    return (
      <textarea
        ref={ref}
        {...common}
        defaultValue={String(initial ?? '')}
        rows={Math.max(3, String(initial ?? '').split('\n').length + 1)}
        className="w-full resize-y bg-transparent p-0 text-[13px] leading-[1.45] focus:outline-none"
      />
    )
  if (col.kind === 'result' || col.kind === 'select' || col.kind === 'person') {
    const opts: { value: string; label: string }[] =
      col.kind === 'result'
        ? RESULT_OPTIONS.map((r) => ({
            value: r,
            label: r === 'NA' ? 'N/A' : r === 'UNTEST' ? 'Untest' : r === 'PASS' ? 'Pass' : 'Fail',
          }))
        : col.kind === 'person'
          ? plan.people
              .filter((p) => col.custom?.personScope !== 'QA' || p.qa)
              .map((p) => ({ value: String(p.userId), label: p.fullName }))
          : col.options.map((o) => ({
              value: o.value,
              label: col.id === 'priority' ? priorityText(o.value as TestPriority, t) : o.label,
            }))
    // Giá trị hiện tại không có trong danh sách (vd phân loại gõ tự do, người đã rời dự án) vẫn phải là một lựa chọn,
    // không thì ô chọn rơi về "" và lưu đè mất giá trị.
    const current = col.kind === 'result' ? [] : Array.isArray(initial) ? initial : initial ? [String(initial)] : []
    for (const v of current)
      if (!opts.some((o) => o.value === v))
        opts.push({
          value: v,
          label: col.kind === 'person' ? (plan.people.find((p) => String(p.userId) === v)?.fullName ?? v) : v,
        })
    if (col.multiple)
      return (
        <select
          ref={ref}
          {...common}
          multiple
          size={Math.min(6, opts.length)}
          defaultValue={Array.isArray(initial) ? initial : []}
          className={clsx(field, 'h-auto py-1')}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    return (
      <select
        ref={ref}
        {...common}
        // Danh sách chọn: chỉ lưu khi chọn (onChange) hoặc Enter; rời ô = huỷ.
        onBlur={() => {
          if (done.current) return
          done.current = true
          onCancel()
        }}
        defaultValue={String(initial ?? '')}
        onChange={() => commit('down')}
        className={clsx(field, 'h-7')}
      >
        {retest && (
          <option value="" disabled>
            {t('— Retest —', '— Retest —')}
          </option>
        )}
        {col.kind !== 'result' && <option value="">—</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  const type = col.kind === 'number' ? 'number' : col.kind === 'date' ? 'date' : 'text'
  return (
    <input
      ref={ref}
      {...common}
      type={type}
      defaultValue={initial === null ? '' : String(initial)}
      min={col.custom?.min ?? undefined}
      max={col.custom?.max ?? undefined}
      maxLength={col.custom?.maxLength ?? (col.id === 'title' ? 300 : undefined)}
      className={clsx(field, 'h-7')}
    />
  )
}
