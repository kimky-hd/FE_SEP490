import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { canSeedDemo, seedAllDemo } from '@/api/mockSeed'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button, buttonClasses } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n'
import { pct, statsIn } from '@/lib/testplan/status'
import { TRACE_STATUSES, type TestCaseDto, type TraceStatus } from '@/types/testing'
import { Toast, useToast } from '../documents/view/Toast'
import { useProjectContext } from '../projects/ProjectLayout'
import { readPref, writePref } from '../kanban/workUi'
import { HistoryTab } from './HistoryTab'
import { OverviewTab } from './OverviewTab'
import { myPending, SheetTab } from './SheetTab'
import type { SheetFilter } from './SheetGrid'
import { BuildTag, Notice, smallBtn } from './testUi'
import { IconTile } from '@/components/ui/IconTile'
import { CalendarIcon, LockIcon, PlusIcon, ServerIcon, SlidersIcon } from '@/components/ui/icons'
import { TraceTab } from './TraceTab'
import { useReqIndex, useTestPlan } from './useTestPlan'

// /projects/:id/tests — Test cases v2 (doc/mockups/testcases-combined.html): đợt test, thanh chọn môi trường dưới tiêu
// đề (đổi môi trường = đổi mọi số liệu / kết quả), 4 tab Tổng quan · Bảng testcase · Đối chiếu REQ · Lịch sử. Thiết lập
// đợt test ở trang riêng /tests/setup. Trạng thái trên URL (?tab, env, module, filter, tc) để link từ Việc của tôi / Ctrl K.

type Tab = 'overview' | 'sheet' | 'trace' | 'history'
const TABS: Tab[] = ['overview', 'sheet', 'trace', 'history']

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || !!el.closest('input, textarea, select, [contenteditable="true"]'))

export function TestsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { project, fullscreen, setFullscreen } = useProjectContext()
  const projectId = project.projectId
  const [params, setParams] = useSearchParams()
  const planParam = params.get('plan')
  const st = useTestPlan(project, planParam ? Number(planParam) : null)
  const { plan, cases, abilities } = st
  const { toast, notify } = useToast()
  const reqs = useReqIndex(projectId, abilities.view)
  const [seeding, setSeeding] = useState(false)
  const [createRequest, setCreateRequest] = useState(0)
  const [preselect, setPreselect] = useState<number[] | null>(null)

  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'sheet'
  const filter: SheetFilter = (['all', 'untest', 'retest'] as const).find((f) => f === params.get('filter')) ?? 'all'
  const envParam = Number(params.get('env')) || readPref<number>(projectId, 'testEnv') || null
  const env = plan?.environments.find((e) => e.envId === envParam) ?? plan?.environments[0] ?? null
  const focusCaseId = Number(params.get('tc')) || null
  // Link chỉ có ?tc= (Kanban, Ctrl K): mở đúng module của case.
  const moduleId = Number(params.get('module')) || cases.find((c) => c.testCaseId === focusCaseId)?.moduleId || null
  const traceParam = params.get('trace') as TraceStatus | null
  const traceFilter = traceParam && TRACE_STATUSES.includes(traceParam) ? traceParam : null

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }
  const setTab = (v: Tab) => update({ tab: v, tc: null })
  const setEnv = (id: number) => {
    writePref(projectId, 'testEnv', id)
    update({ env: String(id), tc: null })
  }
  const goto = (tc: TestCaseDto) =>
    update({ tab: 'sheet', module: String(tc.moduleId), filter: null, tc: String(tc.testCaseId) })

  // Ctrl K "Tạo testcase" (?new=1).
  useEffect(() => {
    if (params.get('new') !== '1' || !plan) return
    setCreateRequest(Date.now())
    update({ new: null, tab: 'sheet' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, plan?.planId])

  // Toàn màn hình là chế độ của Bảng testcase (như Tài liệu): bật từ nút ⤢ trên thanh dự án ở tab khác thì chuyển
  // sang Bảng testcase; F bật / tắt (không khi đang gõ), Esc thoát.
  useEffect(() => {
    if (fullscreen && tab !== 'sheet') setTab('sheet')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fullscreen])
  useEffect(() => {
    if (tab !== 'sheet' || !plan) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('[aria-modal="true"], [role="dialog"]')) return
      if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false)
        return
      }
      if ((e.key === 'f' || e.key === 'F') && !e.repeat && !isTyping(e.target)) {
        e.preventDefault()
        setFullscreen(!fullscreen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, plan, fullscreen, setFullscreen])

  const missingReqs = useMemo(() => {
    if (!plan) return 0
    const docs = new Set(plan.modules.map((m) => m.documentId))
    const linked = new Set(
      cases
        .filter((c) => c.status === 'ACTIVE')
        .flatMap((c) => c.requirements.map((r) => `${r.documentId}:${r.reqUid}`)),
    )
    return reqs.list.filter((r) => docs.has(r.documentId) && !linked.has(`${r.documentId}:${r.reqUid}`)).length
  }, [plan, cases, reqs.list])

  if (!abilities.view)
    return (
      <div className="flex justify-center px-6 py-16 text-[14px] text-gray-500">
        <Notice icon={LockIcon} tone="neutral">
          {t('Bạn không có quyền xem Test cases', "You don't have access to Test cases")}
        </Notice>
      </div>
    )
  if (st.error)
    return (
      <div className="px-6 py-6">
        <ErrorState message={st.error} onRetry={() => void st.reload()} />
      </div>
    )
  if (st.loading && !plan)
    return (
      <div className="px-6 py-6">
        <LoadingBlock />
      </div>
    )

  if (!plan || !env)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
        <IconTile icon={CalendarIcon} className="mb-3" />
        <h2 className="text-[17px] font-semibold text-gray-950">{t('Chưa có đợt test', 'No test plan yet')}</h2>
        <p className="mt-1.5 text-[14px] text-gray-600">
          {t(
            'Gồm môi trường, module theo tài liệu và người test.',
            'Environments, modules from documents and testers.',
          )}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {abilities.plan && (
            <Link to={`/projects/${projectId}/tests/setup`} className={buttonClasses({ inline: true })}>
              <SlidersIcon width={16} height={16} aria-hidden="true" />
              {t('Thiết lập đợt test', 'Set up a test plan')}
            </Link>
          )}
          {canSeedDemo && (
            <Button
              inline
              variant="secondary"
              isLoading={seeding}
              onClick={async () => {
                setSeeding(true)
                try {
                  await seedAllDemo(projectId)
                  await st.reload()
                } finally {
                  setSeeding(false)
                }
              }}
            >
              {t('Tạo dữ liệu mẫu', 'Create sample data')}
            </Button>
          )}
        </div>
        {!abilities.plan && (
          <p className="mt-3 text-[13px] text-gray-500">
            {t('Người có quyền testcase.plan sẽ tạo đợt test.', 'Someone with testcase.plan sets up the plan.')}
          </p>
        )}
      </div>
    )

  const meId = user?.id ?? null
  const all = statsIn(cases, env.envId)
  const pending = myPending(plan, cases, env.envId, meId)
  const handed = plan.status === 'HANDED_OVER'
  const tabLabel: Record<Tab, [string, string]> = {
    overview: [t('Tổng quan', 'Overview'), handed ? t('đã bàn giao', 'handed over') : `${pct(all.pass)} Pass`],
    sheet: [t('Bảng testcase', 'Test sheet'), String(all.total)],
    trace: [
      t('Đối chiếu REQ', 'REQ trace'),
      missingReqs ? t(`${missingReqs} REQ chưa có TC`, `${missingReqs} REQs untested`) : t('đủ', 'complete'),
    ],
    history: [t('Lịch sử', 'History'), ''],
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!fullscreen && (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold tracking-tight text-gray-950">
                {plan.name}
                {handed && (
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-[12px] font-medium text-success-700">
                    {t('Đã bàn giao', 'Handed over')}
                  </span>
                )}
              </h2>
              <p className="text-[13px] text-gray-500">
                {project.name}
                {(['untest', 'retest'] as const)
                  .filter((f) => pending[f] > 0)
                  .map((f) => (
                    <span key={f}>
                      {' · '}
                      <button
                        type="button"
                        className="font-medium text-brand-700 hover:underline"
                        onClick={() => update({ tab: 'sheet', filter: f, tc: null })}
                      >
                        {f === 'untest'
                          ? t(
                              `${pending.untest} case của bạn ở ${env.name} chưa test`,
                              `${pending.untest} of your cases untested on ${env.name}`,
                            )
                          : t(
                              `${pending.retest} case của bạn ở ${env.name} cần test lại`,
                              `${pending.retest} of your cases to retest on ${env.name}`,
                            )}
                      </button>
                    </span>
                  ))}
              </p>
            </div>
            <span className="flex-1" />
            {(st.plans?.length ?? 0) > 1 && (
              <select
                aria-label={t('Đợt test', 'Test plan')}
                value={plan.planId}
                onChange={(e) => update({ plan: e.target.value, module: null, env: null, tc: null })}
                className="h-8 rounded-control border border-gray-300 bg-white px-2 text-[13px] shadow-xs"
              >
                {st.plans!.map((x) => (
                  <option key={x.planId} value={x.planId}>
                    {x.name}
                    {x.status === 'HANDED_OVER' ? t(' (đã bàn giao)', ' (handed over)') : ''}
                  </option>
                ))}
              </select>
            )}
            {(abilities.plan || abilities.reopen) && (
              <Link to={`/projects/${projectId}/tests/setup?new=1`} className={smallBtn}>
                <PlusIcon width={16} height={16} aria-hidden="true" />
                {t('Đợt test mới', 'New test plan')}
              </Link>
            )}
            {abilities.plan && (
              <Link to={`/projects/${projectId}/tests/setup?plan=${plan.planId}`} className={smallBtn}>
                <SlidersIcon width={16} height={16} aria-hidden="true" />
                {t('Thiết lập đợt test', 'Test plan setup')}
              </Link>
            )}
          </div>

          <div
            role="group"
            aria-label={t('Môi trường test', 'Test environment')}
            className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3 sm:px-6"
          >
            <span className="mr-0.5 text-[12.5px] text-gray-500">{t('Môi trường test', 'Environment')}</span>
            {plan.environments.map((e) => {
              const s = statsIn(cases, e.envId)
              const done = s.PASS + s.FAIL + s.NA
              const on = e.envId === env.envId
              return (
                <button
                  key={e.envId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setEnv(e.envId)}
                  title={t(`${done}/${s.total} case đã có kết quả`, `${done}/${s.total} cases with a result`)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-control border bg-white px-2.5 py-1 text-[13px]',
                    on
                      ? 'border-brand-500 text-gray-950 ring-4 ring-brand-100'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <ServerIcon width={14} height={14} aria-hidden="true" className="text-gray-500" />
                  <b className="font-semibold">{e.name}</b>
                  <BuildTag>{e.currentBuild ?? '—'}</BuildTag>
                  <span
                    aria-hidden="true"
                    className="inline-block h-[5px] w-11 overflow-hidden rounded-full bg-gray-100"
                  >
                    <i
                      className="block h-full bg-success-600"
                      style={{ width: `${s.total ? (done / s.total) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="sr-only">
                    {t(`${done} trên ${s.total} đã có kết quả`, `${done} of ${s.total} with a result`)}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            role="tablist"
            aria-label="Test cases"
            className="mt-3 flex shrink-0 gap-x-5 overflow-x-auto border-b border-gray-200 px-4 sm:px-6"
          >
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tests-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`tests-panel-${id}`}
                onClick={() => setTab(id)}
                className={clsx(
                  '-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-[14px]',
                  tab === id
                    ? 'border-brand-600 font-medium text-gray-950'
                    : 'border-transparent text-gray-600 hover:text-gray-900',
                )}
              >
                {tabLabel[id][0]}
                {tabLabel[id][1] && (
                  <span
                    className={clsx(
                      'rounded-full px-1.5 text-[12px] font-medium leading-[18px]',
                      tab === id ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {tabLabel[id][1]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <div
        role="tabpanel"
        id={`tests-panel-${tab}`}
        aria-labelledby={`tests-tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === 'overview' && (
          <OverviewTab
            projectId={projectId}
            plan={plan}
            cases={cases}
            env={env}
            abilities={abilities}
            reload={st.reload}
            setPlan={st.setPlan}
            notify={notify}
          />
        )}
        {tab === 'sheet' && (
          <SheetTab
            key={plan.planId}
            projectId={projectId}
            plan={plan}
            cases={cases}
            env={env}
            abilities={abilities}
            meId={meId}
            reqs={reqs}
            moduleId={moduleId}
            onModule={(id) => update({ module: String(id), tc: null })}
            filter={filter}
            onFilter={(f) => update({ filter: f === 'all' ? null : f })}
            focusCaseId={focusCaseId}
            preselect={preselect}
            fullscreen={fullscreen}
            onFullscreen={setFullscreen}
            projectName={project.name}
            patchCases={st.patchCases}
            setPlan={st.setPlan}
            notify={notify}
            onGoto={goto}
            createRequest={createRequest}
            onCreateHandled={() => setCreateRequest(0)}
            onPreselectHandled={() => setPreselect(null)}
          />
        )}
        {tab === 'trace' && (
          <TraceTab
            projectId={projectId}
            plan={plan}
            env={env}
            cases={cases}
            abilities={abilities}
            reqs={reqs}
            initialFilter={traceFilter}
            initialDoc={Number(params.get('doc')) || null}
            patchCases={st.patchCases}
            reloadPlan={st.reloadPlan}
            notify={notify}
            onGoto={goto}
            onOpenInSheet={(mid, ids) => {
              setPreselect(ids)
              update({ tab: 'sheet', module: String(mid), filter: null, tc: ids[0] ? String(ids[0]) : null })
            }}
          />
        )}
        {tab === 'history' && <HistoryTab plan={plan} cases={cases} onGoto={goto} />}
      </div>
      <Toast toast={toast} />
    </div>
  )
}
