import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { apiErrorMessage } from '@/lib/apiErrors'
import { useI18n } from '@/i18n'
import { HistoryIcon } from '@/components/ui/icons'
import { PersonDot } from '../kanban/workUi'
import {
  TEST_ACTIVITY_TYPES,
  type TestActivityDto,
  type TestActivityType,
  type TestCaseDto,
  type TestPlanDto,
} from '@/types/testing'
import { BuildTag, Drawer, Panel, shortDateTime, StatusPill, tableCls, tdCls, thCls } from './testUi'

// Tab Lịch sử + ngăn lịch sử từng testcase: mọi thao tác (kết quả cũ → mới kèm môi trường + build và "ghi thay",
// phân công, bug, REQ, AI, build, regression, bàn giao), lọc theo người / thao tác / module.

type T = (vi: string, en: string) => string

export const activityLabel = (k: TestActivityType, t: T) =>
  ({
    RESULT: t('Ghi kết quả', 'Result'),
    ASSIGN: t('Giao việc', 'Assignment'),
    BUG: 'Bug',
    REQ: 'REQ',
    TESTCASE: 'Testcase',
    BUILD: t('Build', 'Build'),
    SETUP: t('Thiết lập', 'Setup'),
    HANDOVER: t('Bàn giao', 'Handover'),
  })[k]

const TYPE_STYLE: Record<TestActivityType, string> = {
  RESULT: 'bg-brand-50 text-brand-700',
  ASSIGN: 'bg-blue-50 text-blue-700',
  BUG: 'bg-red-50 text-red-700',
  REQ: 'bg-violet-50 text-violet-700',
  TESTCASE: 'bg-gray-100 text-gray-700',
  BUILD: 'bg-success-50 text-success-700',
  SETUP: 'bg-gray-100 text-gray-700',
  HANDOVER: 'bg-success-50 text-success-700',
}

export function ActivityType({ type }: { type: TestActivityType }) {
  const { t } = useI18n()
  return (
    <span className={clsx('whitespace-nowrap rounded-[4px] px-1.5 py-px text-[11.5px] font-medium', TYPE_STYLE[type])}>
      {activityLabel(type, t)}
    </span>
  )
}

export function ActivityDetail({ a, plan }: { a: TestActivityDto; plan: TestPlanDto }) {
  const { t } = useI18n()
  if (a.type !== 'RESULT' || !a.to) return <>{a.text}</>
  const env = plan.environments.find((e) => e.envId === a.envId)?.name ?? ''
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {a.from && <StatusPill status={a.from} />}→<StatusPill status={a.to} />
      <BuildTag>
        {env} {a.build ?? ''}
      </BuildTag>
      {a.behalfOf && (
        <span className="text-[11.5px] text-amber-800">
          · {t(`ghi thay ${a.behalfOf.fullName}`, `on behalf of ${a.behalfOf.fullName}`)}
        </span>
      )}
    </span>
  )
}

export function HistoryTab({
  plan,
  cases,
  onGoto,
}: {
  plan: TestPlanDto
  cases: TestCaseDto[]
  onGoto: (tc: TestCaseDto) => void
}) {
  const { t } = useI18n()
  const [actorId, setActorId] = useState('')
  const [type, setType] = useState<TestActivityType | ''>('')
  const [moduleId, setModuleId] = useState('')
  const [list, setList] = useState<TestActivityDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    testApi
      .activity(plan.planId, {
        actorId: actorId ? Number(actorId) : undefined,
        type: type || undefined,
        moduleId: moduleId ? Number(moduleId) : undefined,
      })
      .then((x) => alive && setList(x))
      .catch((err) => alive && setError(apiErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [plan.planId, actorId, type, moduleId, tick, cases])

  const people = useMemo(() => {
    const out = new Map<number, string>()
    for (const p of plan.people) out.set(p.userId, p.fullName)
    for (const a of list ?? []) out.set(a.actor.userId, a.actor.fullName)
    return [...out.entries()]
  }, [plan.people, list])

  const caseOf = (id: number | null) => (id ? cases.find((c) => c.testCaseId === id) : undefined)
  const modOf = (id: number) => plan.modules.find((m) => m.moduleId === id)
  const select =
    'h-8 rounded-control border border-gray-300 bg-white px-2 text-[13px] shadow-xs focus:outline-none focus:ring-4 focus:ring-brand-100'

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
      <Panel icon={HistoryIcon} title={t('Lịch sử', 'History')} hint={t('Mới nhất ở trên', 'Newest first')}>
        <div className="px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              aria-label={t('Lọc theo người', 'Filter by person')}
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              className={select}
            >
              <option value="">{t('Mọi người', 'Everyone')}</option>
              {people.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label={t('Lọc theo thao tác', 'Filter by action')}
              value={type}
              onChange={(e) => setType(e.target.value as TestActivityType | '')}
              className={select}
            >
              <option value="">{t('Mọi thao tác', 'All actions')}</option>
              {TEST_ACTIVITY_TYPES.map((k) => (
                <option key={k} value={k}>
                  {activityLabel(k, t)}
                </option>
              ))}
            </select>
            <select
              aria-label={t('Lọc theo module', 'Filter by module')}
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className={select}
            >
              <option value="">{t('Mọi module', 'All modules')}</option>
              {plan.modules.map((m) => (
                <option key={m.moduleId} value={m.moduleId}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className="text-[13px] text-gray-500">
              {list ? t(`${list.length} dòng`, `${list.length} rows`) : ''}
            </span>
          </div>
          {error ? (
            <ErrorState message={error} onRetry={() => setTick((n) => n + 1)} />
          ) : !list ? (
            <LoadingBlock />
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={clsx(thCls, 'w-24')}>{t('Thời gian', 'Time')}</th>
                    <th className={clsx(thCls, 'w-40')}>{t('Người', 'Person')}</th>
                    <th className={clsx(thCls, 'w-28')}>{t('Thao tác', 'Action')}</th>
                    <th className={thCls}>Testcase</th>
                    <th className={thCls}>{t('Chi tiết', 'Details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const tc = caseOf(a.testCaseId)
                    const m = tc ? modOf(tc.moduleId) : undefined
                    return (
                      <tr key={a.activityId}>
                        <td className={clsx(tdCls, 'whitespace-nowrap text-gray-500')}>{shortDateTime(a.at)}</td>
                        <td className={tdCls}>
                          <span className="inline-flex items-center gap-1.5">
                            <PersonDot user={a.actor} size={22} />
                            {a.actor.fullName}
                          </span>
                        </td>
                        <td className={tdCls}>
                          <ActivityType type={a.type} />
                        </td>
                        <td className={tdCls}>
                          {tc ? (
                            <button type="button" onClick={() => onGoto(tc)} className="text-left hover:underline">
                              <span className="mr-1.5 rounded-[5px] bg-gray-100 px-1.5 font-mono text-[11.5px] text-gray-600">
                                {m?.shortCode}·{tc.code}
                              </span>
                              {tc.title}
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className={tdCls}>
                          <ActivityDetail a={a} plan={plan} />
                        </td>
                      </tr>
                    )
                  })}
                  {!list.length && (
                    <tr>
                      <td colSpan={5} className={clsx(tdCls, 'text-gray-500')}>
                        {t('Không có dòng nào.', 'Nothing here.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

/** Lịch sử một testcase: các lần test (mọi môi trường) + mọi thao tác. */
export function CaseHistoryDrawer({ plan, tc, onClose }: { plan: TestPlanDto; tc: TestCaseDto; onClose: () => void }) {
  const { t } = useI18n()
  const [list, setList] = useState<TestActivityDto[] | null>(null)
  const m = plan.modules.find((x) => x.moduleId === tc.moduleId)
  useEffect(() => {
    let alive = true
    testApi
      .activity(plan.planId, { testCaseId: tc.testCaseId })
      .then((x) => alive && setList(x))
      .catch(() => alive && setList([]))
    return () => {
      alive = false
    }
  }, [plan.planId, tc.testCaseId, tc.updatedAt])
  const envName = (id: number) => plan.environments.find((e) => e.envId === id)?.name ?? '?'
  const owner = (envId: number) =>
    plan.assignments.find((a) => a.moduleId === tc.moduleId && a.envId === envId)?.assignee
  return (
    <Drawer icon={HistoryIcon} title={`${m?.shortCode}·${tc.code} · ${tc.title}`} onClose={onClose}>
      <p className="mb-1.5">
        <b className="font-semibold">{t('Các lần test', 'Test runs')}</b>{' '}
        <span className="text-gray-500">({t('mọi môi trường', 'all environments')})</span>
      </p>
      <p className="mb-2 text-[12.5px] text-gray-500">
        {m?.name}:{' '}
        {plan.environments
          .map((e) => `${e.name} ${owner(e.envId)?.fullName ?? t('chưa giao', 'unassigned')}`)
          .join(' · ')}
      </p>
      <table className={clsx(tableCls, 'mb-4')}>
        <thead>
          <tr>
            <th className={clsx(thCls, 'pl-0')}>{t('Môi trường · build', 'Environment · build')}</th>
            <th className={thCls}>{t('Kết quả', 'Result')}</th>
            <th className={thCls}>{t('Người · giờ', 'Who · when')}</th>
          </tr>
        </thead>
        <tbody>
          {[...tc.results].reverse().map((r) => (
            <tr key={r.resultId}>
              <td className={clsx(tdCls, 'pl-0')}>
                <BuildTag>
                  {envName(r.envId)} {r.build ?? ''}
                </BuildTag>
              </td>
              <td className={tdCls}>
                <StatusPill status={r.result} />
              </td>
              <td className={tdCls}>
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <PersonDot user={r.by} size={20} />
                  {shortDateTime(r.at)}
                  {r.behalfOf && (
                    <span className="text-[11.5px] text-amber-800">
                      {t(`ghi thay ${r.behalfOf.fullName}`, `for ${r.behalfOf.fullName}`)}
                    </span>
                  )}
                </span>
              </td>
            </tr>
          ))}
          {!tc.results.length && (
            <tr>
              <td colSpan={3} className={clsx(tdCls, 'pl-0 text-gray-500')}>
                {t('Chưa test lần nào.', 'Never tested.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="mb-1.5 font-semibold">{t('Mọi thao tác', 'All actions')}</p>
      {!list ? (
        <LoadingBlock />
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((a) => (
            <li key={a.activityId} className="flex items-start gap-2 py-2">
              <span className="w-[88px] shrink-0 text-gray-500">{shortDateTime(a.at)}</span>
              <PersonDot user={a.actor} size={20} />
              <span className="min-w-0 flex-1">
                <ActivityDetail a={a} plan={plan} />
              </span>
            </li>
          ))}
          {!list.length && <li className="py-2 text-gray-500">{t('Chưa có thao tác.', 'No actions yet.')}</li>}
        </ul>
      )}
    </Drawer>
  )
}
