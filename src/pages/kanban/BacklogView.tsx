import { useState, type DragEvent } from 'react'
import clsx from 'clsx'
import { issueApi } from '@/api/issueApi'
import { Button } from '@/components/ui/Button'
import { PlusIcon } from '@/components/ui/icons'
import { apiErrorMessage } from '@/lib/apiErrors'
import { useI18n } from '@/i18n'
import type { IssueSummaryDto, SprintDto } from '@/types/issue'
import { useProjectContext } from '../projects/ProjectLayout'
import type { IssueDefaults } from './IssueCreateModal'
import type { KanbanData } from './KanbanPage'
import { PersonDot, PriorityMark, ReqChip, shortDate, TypeIcon } from './workUi'

// Backlog & sprint (mockup khung 1c): sprint đang chạy, sprint kế hoạch, backlog; kéo hàng giữa các nhóm (rank + sprintId).
// Bàn phím: mở issue rồi đổi ô Sprint trong bảng chi tiết.

type Group = { key: string; sprint: SprintDto | null; issues: IssueSummaryDto[] }

export function BacklogView({
  data,
  setIssues,
  onOpen,
  notify,
  canCreate,
  canSprint,
  onCreate,
  onComplete,
}: {
  data: KanbanData
  setIssues: (fn: (prev: IssueSummaryDto[]) => IssueSummaryDto[]) => void
  onOpen: (i: IssueSummaryDto) => void
  notify: (text: string, tone?: 'ok' | 'error') => void
  canCreate: boolean
  canSprint: boolean
  onCreate: (d: IssueDefaults) => void
  onComplete: (s: SprintDto) => void
}) {
  const { t } = useI18n()
  const { can, isArchived } = useProjectContext()
  const canRank = !isArchived && can('issue.update')
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<{ group: string; index: number } | null>(null)

  const top = data.issues.filter((i) => i.parentId === null)
  const groups: Group[] = [
    ...data.sprints
      .filter((s) => s.status !== 'COMPLETED')
      .sort((a, b) => (a.status === b.status ? a.sprintId - b.sprintId : a.status === 'ACTIVE' ? -1 : 1))
      .map((s) => ({ key: `s${s.sprintId}`, sprint: s, issues: top.filter((i) => i.sprintId === s.sprintId) })),
    { key: 'backlog', sprint: null, issues: top.filter((i) => i.sprintId === null) },
  ]
  const statusOf = (id: number) => data.statuses.find((s) => s.statusId === id)
  const hasActive = data.sprints.some((s) => s.status === 'ACTIVE')

  const dragOver = (e: DragEvent<HTMLElement>, g: Group) => {
    if (drag === null) return
    e.preventDefault()
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-row]')].filter(
      (el) => Number(el.dataset.row) !== drag,
    )
    let index = rows.length
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) {
        index = k
        break
      }
    }
    if (over?.group !== g.key || over.index !== index) setOver({ group: g.key, index })
  }

  const drop = async (g: Group) => {
    const id = drag
    const target = over
    setDrag(null)
    setOver(null)
    if (id === null || !target) return
    const moved = data.issues.find((i) => i.issueId === id)
    if (!moved) return
    const rest = g.issues.filter((i) => i.issueId !== id)
    const after = target.index > 0 ? (rest[target.index - 1]?.issueId ?? null) : null
    const sprintId = g.sprint?.sprintId ?? null
    if (moved.sprintId === sprintId && g.issues.findIndex((i) => i.issueId === id) === target.index) return
    const before = data.issues
    setIssues((prev) => {
      const list = prev.filter((i) => i.issueId !== id)
      const at = after === null ? 0 : list.findIndex((i) => i.issueId === after) + 1
      list.splice(at, 0, { ...moved, sprintId })
      return list
    })
    try {
      await issueApi.rank(id, { afterIssueId: after, sprintId })
    } catch (err) {
      setIssues(() => before)
      notify(apiErrorMessage(err), 'error')
    }
  }

  const start = async (s: SprintDto) => {
    try {
      await issueApi.updateSprint(s.sprintId, { status: 'ACTIVE' })
      notify(t(`Đã bắt đầu ${s.name}`, `${s.name} started`))
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    }
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const s = g.sprint
        const points = g.issues.reduce((n, i) => n + (i.points ?? 0), 0)
        const cap = s?.capacityPoints ?? null
        const pct = cap ? Math.min(100, Math.round((points / cap) * 100)) : 0
        const dropping = over?.group === g.key
        const visibleRows = g.issues.filter((i) => i.issueId !== drag)
        return (
          <section
            key={g.key}
            aria-label={s ? s.name : 'Backlog'}
            onDragOver={(e) => dragOver(e, g)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o?.group === g.key ? null : o))
            }}
            onDrop={(e) => {
              e.preventDefault()
              void drop(g)
            }}
            className={clsx(
              'overflow-hidden rounded-card border bg-white',
              dropping ? 'border-brand-300' : 'border-gray-200',
            )}
          >
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-[13.5px]">
              <h3 className="font-semibold text-gray-950">{s ? s.name : 'Backlog'}</h3>
              <span className="text-[13px] text-gray-500">
                {s
                  ? [
                      s.startDate || s.endDate ? `${shortDate(s.startDate)} – ${shortDate(s.endDate)}` : null,
                      s.status === 'ACTIVE' ? t('đang chạy', 'active') : t('kế hoạch', 'planned'),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : t(`${g.issues.length} issue · ${points} điểm`, `${g.issues.length} issues · ${points} pts`)}
              </span>
              <span className="flex-1" />
              {s && cap !== null && (
                <>
                  <span
                    className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-200 sm:w-36"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={cap}
                    aria-valuenow={points}
                    aria-label={t('Sức chứa', 'Capacity')}
                  >
                    <i
                      className={clsx('block h-full', points > cap ? 'bg-red-600' : 'bg-brand-600')}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className={clsx('text-[13px] tabular-nums', points > cap ? 'text-red-700' : 'text-gray-500')}>
                    {t(`${points} / ${cap} điểm`, `${points} / ${cap} pts`)}
                  </span>
                </>
              )}
              {s && cap === null && (
                <span className="text-[13px] text-gray-500">{t(`${points} điểm`, `${points} pts`)}</span>
              )}
              {!s && (
                <span className="hidden text-[13px] text-gray-500 sm:inline">
                  {t('Kéo vào sprint để lên kế hoạch', 'Drag into a sprint to plan it')}
                </span>
              )}
              {s && canSprint && s.status === 'PLANNED' && !hasActive && (
                <Button inline variant="secondary" className="lg:h-8" onClick={() => void start(s)}>
                  {t('Bắt đầu sprint', 'Start sprint')}
                </Button>
              )}
              {s && canSprint && s.status === 'ACTIVE' && (
                <Button inline variant="secondary" className="lg:h-8" onClick={() => onComplete(s)}>
                  {t('Hoàn tất', 'Complete')}
                </Button>
              )}
            </header>
            <ul className="divide-y divide-gray-200">
              {g.issues.map((i, idx) => {
                const st = statusOf(i.statusId)
                const showLine =
                  dropping && over.index === visibleRows.findIndex((x) => x.issueId === i.issueId) && i.issueId !== drag
                return (
                  <li
                    key={i.issueId}
                    data-row={i.issueId}
                    draggable={canRank}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', i.key)
                      setDrag(i.issueId)
                    }}
                    onDragEnd={() => (setDrag(null), setOver(null))}
                    className={clsx(
                      'grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-[13.5px] hover:bg-gray-50 sm:grid-cols-[16px_96px_minmax(0,1fr)_120px_76px_36px_24px]',
                      drag === i.issueId && 'opacity-40',
                      showLine && 'shadow-[inset_0_2px_0_#2f5bea]',
                    )}
                    onClick={() => onOpen(i)}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx('select-none text-gray-400', canRank ? 'cursor-grab' : 'invisible')}
                    >
                      ⋮⋮
                    </span>
                    <span className="hidden items-center gap-1.5 text-[12.5px] text-gray-500 sm:flex">
                      <TypeIcon type={i.type} />
                      {i.key}
                    </span>
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 text-left"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpen(i)
                      }}
                    >
                      <span className="sm:hidden">
                        <TypeIcon type={i.type} />
                      </span>
                      <span className="truncate text-gray-950">{i.title}</span>
                      {i.requirements.slice(0, 1).map((r) => (
                        <ReqChip key={r.reqUid} req={r} short />
                      ))}
                      {(i.phaseOrder || i.phaseName) && (
                        <span
                          className="hidden md:inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 truncate max-w-[130px]"
                          title={i.phaseName ?? undefined}
                        >
                          {i.phaseOrder ? `P${i.phaseOrder}: ` : ''}
                          {i.phaseName ?? ''}
                        </span>
                      )}
                      <span className="sr-only">{i.key}</span>
                    </button>
                    <span className="hidden sm:block">
                      <span
                        className={clsx(
                          'inline-flex max-w-full truncate rounded-full border px-2 py-px text-xs font-medium',
                          st?.category === 'IN_PROGRESS'
                            ? 'border-brand-200 bg-brand-50 text-brand-800'
                            : st?.category === 'DONE'
                              ? 'border-success-200 bg-success-50 text-success-700'
                              : 'border-gray-200 bg-gray-50 text-gray-700',
                        )}
                      >
                        {st?.name ?? '—'}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <PriorityMark priority={i.priority} withLabel />
                    </span>
                    <span className="hidden text-right tabular-nums text-gray-700 sm:block">{i.points ?? '–'}</span>
                    <PersonDot user={i.assignee} size={24} />
                    {idx === g.issues.length - 1 && dropping && over.index >= visibleRows.length && (
                      <span aria-hidden="true" className="col-span-full -mb-2 mt-1 h-0.5 rounded-full bg-brand-500" />
                    )}
                  </li>
                )
              })}
              {g.issues.length === 0 && (
                <li className={clsx('px-4 py-4 text-[13px] text-gray-500', dropping && 'bg-brand-50')}>
                  {s ? t('Kéo issue vào đây.', 'Drag issues here.') : t('Backlog trống.', 'The backlog is empty.')}
                </li>
              )}
            </ul>
            {!s && canCreate && (
              <button
                type="button"
                onClick={() => onCreate({ sprintId: null })}
                className="flex w-full items-center gap-1 border-t border-gray-200 px-4 py-2 text-left text-[13px] text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {t('Tạo issue', 'Create issue')}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
