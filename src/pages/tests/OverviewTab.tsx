import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { Button } from '@/components/ui/Button'
import { IconTile } from '@/components/ui/IconTile'
import {
  AlertTriangleIcon,
  BugIcon,
  CalendarIcon,
  CheckIcon,
  PackageIcon,
  ServerIcon,
  SlidersIcon,
  SyncIcon,
  TableIcon,
  UsersIcon,
} from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import type { TestAbilities } from '@/lib/testplan/abilities'
import { pct, statsIn, type TestStats } from '@/lib/testplan/status'
import { PersonDot } from '../kanban/workUi'
import type { TestBugRefDto, TestCaseDto, TestEnvironmentDto, TestPlanDto } from '@/types/testing'
import { ConfirmModal, DeployBuildModal } from './dialogs'
import { BuildTag, inputCls, numCls, Panel, shortDateTime, shortDay, smallBtn, tableCls, tdCls, thCls } from './testUi'

// Tab "Tổng quan": số liệu chính, phân công (chỉ xem — sửa ở Thiết lập), build của môi trường đang xem + Regression,
// kết quả theo module (như sheet "Tổng hợp kết quả"), "Hoàn tất & bàn giao" với checklist chỉ nhắc (không chặn; còn
// cảnh báo thì bắt buộc ghi chú). Bàn giao xong: đợt test chỉ xem, có "Mở lại".

export function OverviewTab({
  projectId,
  plan,
  cases,
  env,
  abilities,
  reload,
  setPlan,
  notify,
}: {
  projectId: number
  plan: TestPlanDto
  cases: TestCaseDto[]
  env: TestEnvironmentDto
  abilities: TestAbilities
  reload: () => Promise<void>
  setPlan: (fn: (p: TestPlanDto) => TestPlanDto) => void
  notify: (text: string, tone?: 'ok' | 'error') => void
}) {
  const { t } = useI18n()
  const [deploying, setDeploying] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [noteError, setNoteError] = useState(false)
  const handed = plan.status === 'HANDED_OVER'
  const st = statsIn(cases, env.envId)
  const bugs = useMemo(() => {
    const m = new Map<number, TestBugRefDto>()
    for (const c of cases) if (c.status === 'ACTIVE' && c.bug) m.set(c.bug.issueId, c.bug)
    return [...m.values()]
  }, [cases])
  const openBugs = bugs.filter((b) => b.statusCategory !== 'DONE')
  const owner = (moduleId: number, envId: number) =>
    plan.assignments.find((a) => a.moduleId === moduleId && a.envId === envId)?.assignee ?? null

  // Checklist bàn giao: theo mọi môi trường.
  const pendingByEnv = plan.environments
    .map((e) => {
      const s = statsIn(cases, e.envId)
      return { env: e, untest: s.UNTEST, retest: s.RETEST }
    })
    .filter((x) => x.untest + x.retest > 0)
  const unassigned = plan.modules.flatMap((m) =>
    plan.environments.filter((e) => !owner(m.moduleId, e.envId)).map((e) => `${m.name} · ${e.name}`),
  )
  const checks: [boolean, string][] = [
    [
      pendingByEnv.length === 0,
      pendingByEnv.length === 0
        ? t('Mọi testcase đã có kết quả ở mọi môi trường', 'Every test case has a result in every environment')
        : pendingByEnv
            .map((x) =>
              t(
                `${x.env.name}: ${x.untest} chưa test, ${x.retest} cần test lại`,
                `${x.env.name}: ${x.untest} untested, ${x.retest} to retest`,
              ),
            )
            .join(' · '),
    ],
    [
      openBugs.length === 0,
      openBugs.length
        ? t(`Còn ${openBugs.length} bug mở: `, `${openBugs.length} open bugs: `) +
          openBugs.map((b) => `${b.key} (${b.statusName})`).join(', ')
        : t('Không còn bug mở', 'No open bugs'),
    ],
    [
      unassigned.length === 0,
      unassigned.length
        ? t(
            `${unassigned.length} ô module × môi trường chưa giao người test`,
            `${unassigned.length} module × environment cells unassigned`,
          )
        : t('Mọi module đã có người test', 'Every module has a tester'),
    ],
  ]
  const warn = checks.some((c) => !c[0])

  const handover = async () => {
    if (warn && !note.trim()) {
      setNoteError(true)
      document.getElementById('handover-note')?.focus()
      notify(t('Còn cảnh báo — ghi chú lý do bàn giao', 'There are warnings — add a handover note'), 'error')
      return
    }
    setBusy(true)
    try {
      const next = await testApi.handover(plan.planId, { note: note.trim() || null })
      setPlan(() => next)
      notify(t('Đã bàn giao — đợt test chuyển chỉ xem', 'Handed over — the plan is now read-only'))
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  const reopen = async () => {
    try {
      const next = await testApi.reopen(plan.planId)
      setPlan(() => next)
      notify(t('Đã mở lại đợt test', 'The test plan is open again'))
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
      await reload()
    }
  }
  const [confirmRegression, setConfirmRegression] = useState(false)
  const regression = async () => {
    setConfirmRegression(false)
    try {
      const r = await testApi.regression(env.envId, {})
      await reload()
      notify(
        t(
          `Regression: ${r.retestCount} case cần test lại trên ${env.currentBuild ?? env.name}`,
          `Regression: ${r.retestCount} cases to retest`,
        ),
      )
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    }
  }

  const row = (name: string, s: TestStats, total = false) => (
    <tr key={name} className={clsx(total && 'bg-gray-25 font-semibold')}>
      <td className={tdCls}>{name}</td>
      {[s.total, s.PASS, s.FAIL, s.NA, s.UNTEST, s.RETEST, s.DELETED].map((v, i) => (
        <td key={i} className={clsx(tdCls, numCls)}>
          {v}
        </td>
      ))}
      <td className={clsx(tdCls, numCls)}>{pct(s.cover)}</td>
      <td className={clsx(tdCls, numCls)}>{pct(s.pass)}</td>
    </tr>
  )

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4 sm:px-6">
      {handed && plan.handover && (
        <section className="flex flex-wrap items-center gap-2.5 rounded-card border border-success-200 bg-success-50 px-4 py-3 text-[13.5px] text-success-700">
          <IconTile icon={CheckIcon} />
          {t(
            `Đã bàn giao ${shortDateTime(plan.handover.at)} bởi ${plan.handover.by.fullName}`,
            `Handed over ${shortDateTime(plan.handover.at)} by ${plan.handover.by.fullName}`,
          )}
          {plan.handover.note && <span>— “{plan.handover.note}”</span>}
          <span className="flex-1" />
          {abilities.reopen && (
            <Button inline variant="secondary" onClick={() => void reopen()}>
              {t('Mở lại đợt test', 'Reopen plan')}
            </Button>
          )}
        </section>
      )}

      <Panel
        icon={CalendarIcon}
        title={plan.name}
        hint={
          <>
            {shortDay(plan.startDate)} – {shortDay(plan.endDate)} ·{' '}
            {t(`build đang test ở ${env.name}`, `build on ${env.name}`)} <BuildTag>{env.currentBuild ?? '—'}</BuildTag>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2.5 p-4 lg:grid-cols-4">
          {(
            [
              [String(st.total), t('testcase đang dùng', 'active test cases'), TableIcon, 'brand'],
              [
                `${st.PASS + st.FAIL + st.NA}/${st.total}`,
                t(`đã có kết quả ở ${env.name}`, `with a result on ${env.name}`),
                ServerIcon,
                'brand',
              ],
              [pct(st.pass), 'Pass', CheckIcon, 'brand'],
              [
                String(openBugs.length),
                t(`bug còn mở · ${st.RETEST} case cần test lại`, `open bugs · ${st.RETEST} to retest`),
                BugIcon,
                'danger',
              ],
            ] as const
          ).map(([v, l, icon, tone], i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-control border border-gray-200 px-3 py-2.5">
              <IconTile icon={icon} tone={tone} className="mt-1" />
              <div className="min-w-0">
                <b
                  className={clsx(
                    'block text-[22px] font-semibold tracking-tight',
                    i === 3 && openBugs.length && 'text-red-700',
                  )}
                >
                  {v}
                </b>
                <span className="text-[12.5px] text-gray-500">{l}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        icon={UsersIcon}
        title={t('Phân công', 'Assignments')}
        hint={t('Chỉ xem — sửa ở Thiết lập đợt test', 'Read-only — edit in Test plan setup')}
        actions={
          abilities.plan && (
            <Link to={`/projects/${projectId}/tests/setup`} className={smallBtn}>
              <SlidersIcon width={16} height={16} aria-hidden="true" />
              {t('Sửa', 'Edit')}
            </Link>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>{t('Module (tài liệu)', 'Module (document)')}</th>
                {plan.environments.map((e) => (
                  <th key={e.envId} className={thCls}>
                    {e.name}
                    {e.envId === env.envId && (
                      <span className="ml-1 rounded-[5px] bg-brand-50 px-1.5 text-[11px] font-medium text-brand-700">
                        {t('đang xem', 'viewing')}
                      </span>
                    )}
                  </th>
                ))}
                <th className={clsx(thCls, 'text-right')}>Case</th>
              </tr>
            </thead>
            <tbody>
              {plan.modules.map((m) => (
                <tr key={m.moduleId}>
                  <td className={tdCls}>
                    {m.name} <span className="text-[13px] text-gray-500">· {m.documentCode}</span>
                  </td>
                  {plan.environments.map((e) => {
                    const who = owner(m.moduleId, e.envId)
                    return (
                      <td key={e.envId} className={tdCls}>
                        {who ? (
                          <span className="inline-flex items-center gap-1.5">
                            <PersonDot user={who} size={22} />
                            {who.fullName}
                          </span>
                        ) : (
                          <span className="font-medium text-amber-800">{t('Chưa giao', 'Unassigned')}</span>
                        )}
                      </td>
                    )
                  })}
                  <td className={clsx(tdCls, numCls)}>
                    {cases.filter((c) => c.moduleId === m.moduleId && c.status === 'ACTIVE').length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        icon={PackageIcon}
        title={t(`Build trên ${env.name}`, `Builds on ${env.name}`)}
        actions={
          abilities.plan && (
            <>
              <button type="button" className={smallBtn} onClick={() => setDeploying(true)}>
                <PackageIcon width={16} height={16} aria-hidden="true" />
                {t('Build mới', 'New build')}
              </button>
              <button
                type="button"
                className={smallBtn}
                onClick={() => setConfirmRegression(true)}
                disabled={!env.currentBuild}
              >
                <SyncIcon width={16} height={16} aria-hidden="true" />
                {t(`Regression trên ${env.currentBuild ?? env.name}`, `Regression on ${env.currentBuild ?? env.name}`)}
              </button>
            </>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>Build</th>
                <th className={thCls}>{t('Ngày', 'Date')}</th>
                <th className={thCls}>{t('Bug đã fix', 'Bugs fixed')}</th>
                <th className={clsx(thCls, 'text-right')}>{t('Lượt test', 'Results')}</th>
              </tr>
            </thead>
            <tbody>
              {[...env.builds].reverse().map((b) => (
                <tr key={b.buildId}>
                  <td className={tdCls}>
                    <BuildTag>{b.version}</BuildTag>
                    {b.version === env.currentBuild && (
                      <span className="ml-1.5 rounded-[5px] bg-brand-50 px-1.5 text-[11px] font-medium text-brand-700">
                        {t('hiện tại', 'current')}
                      </span>
                    )}
                  </td>
                  <td className={tdCls}>
                    {shortDateTime(b.deployedAt)}
                    {b.deployedBy && <span className="text-gray-500"> · {b.deployedBy.fullName}</span>}
                  </td>
                  <td className={tdCls}>
                    {b.fixedBugs.length ? (
                      <span className="flex flex-wrap gap-1">
                        {b.fixedBugs.map((x) => (
                          <span
                            key={x.issueId}
                            className="rounded-[5px] bg-red-50 px-1.5 font-mono text-[11.5px] text-red-700"
                          >
                            {x.key}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={clsx(tdCls, numCls)}>{b.resultCount}</td>
                </tr>
              ))}
              {!env.builds.length && (
                <tr>
                  <td colSpan={4} className={clsx(tdCls, 'text-gray-500')}>
                    {t('Chưa deploy build nào lên môi trường này.', 'No build deployed yet.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        icon={TableIcon}
        title={t(`Kết quả theo module · ${env.name}`, `Results by module · ${env.name}`)}
        hint={t('Giống sheet "Tổng hợp kết quả"', 'Like the "Summary" sheet')}
      >
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>Module</th>
                {[t('Tổng TC', 'Total'), 'Pass', 'Fail', 'N/A', 'Untest', 'Retest', 'Delete', '%Cover', '%Pass'].map(
                  (h) => (
                    <th key={h} className={clsx(thCls, 'text-right')}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {plan.modules.map((m) =>
                row(
                  m.name,
                  statsIn(
                    cases.filter((c) => c.moduleId === m.moduleId),
                    env.envId,
                  ),
                ),
              )}
              {row(t('Tổng', 'Total'), st, true)}
            </tbody>
          </table>
        </div>
      </Panel>

      {!handed && abilities.plan && (
        <Panel
          icon={CheckIcon}
          title={t('Hoàn tất & bàn giao', 'Complete & hand over')}
          hint={t(
            'Test xong thì bàn giao. Checklist chỉ để nhắc, không chặn.',
            'Hand over when testing is done. The checklist only reminds, it never blocks.',
          )}
        >
          <div className="px-4 py-3">
            <ul>
              {checks.map(([ok, text], i) => (
                <li
                  key={i}
                  className="flex items-center gap-2.5 border-t border-gray-100 py-2 text-[14px] first:border-t-0"
                >
                  <IconTile icon={ok ? CheckIcon : AlertTriangleIcon} tone={ok ? 'brand' : 'warning'} />
                  <span className="sr-only">{ok ? t('Đạt:', 'OK:') : t('Cảnh báo:', 'Warning:')}</span>
                  {text}
                </li>
              ))}
            </ul>
            <label htmlFor="handover-note" className="mt-3 block text-[13px] font-medium text-gray-700">
              {t('Ghi chú bàn giao', 'Handover note')}{' '}
              {warn ? (
                <span className="font-medium text-amber-800">
                  {t('(bắt buộc vì còn cảnh báo)', '(required: there are warnings)')}
                </span>
              ) : (
                <span className="font-normal text-gray-500">{t('(tuỳ chọn)', '(optional)')}</span>
              )}
            </label>
            <textarea
              id="handover-note"
              value={note}
              aria-invalid={noteError && warn && !note.trim() ? true : undefined}
              onChange={(e) => {
                setNote(e.target.value)
                setNoteError(false)
              }}
              rows={3}
              maxLength={2000}
              placeholder={t('Vd: BUG-18 fix ở Release 4', 'e.g. BUG-18 fixed in Release 4')}
              className={clsx(inputCls, 'mt-1 h-auto py-2', noteError && 'border-red-400')}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button inline onClick={() => void handover()} isLoading={busy}>
                <CheckIcon width={16} height={16} aria-hidden="true" />
                {t('Hoàn tất & bàn giao', 'Complete & hand over')}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {confirmRegression && (
        <ConfirmModal
          title={t(
            `Regression trên ${env.name} ${env.currentBuild ?? ''}?`,
            `Regression on ${env.name} ${env.currentBuild ?? ''}?`,
          )}
          description={t(
            'Mọi testcase ở môi trường này chuyển "Retest".',
            'All test cases in this environment become "Retest".',
          )}
          confirmLabel={t('Bắt đầu regression', 'Start regression')}
          onConfirm={regression}
          onClose={() => setConfirmRegression(false)}
        />
      )}
      {deploying && (
        <DeployBuildModal
          env={env}
          bugs={bugs}
          onClose={() => setDeploying(false)}
          onSave={async (body) => {
            try {
              const r = await testApi.deployBuild(env.envId, body)
              setDeploying(false)
              await reload()
              notify(
                t(
                  `Build ${r.build.version} lên ${env.name}, fix ${body.fixedIssueIds.length} bug → ${r.retestCount} case chuyển Retest`,
                  `Build ${r.build.version} on ${env.name}, ${body.fixedIssueIds.length} bugs fixed → ${r.retestCount} to retest`,
                ),
              )
            } catch (err) {
              notify(apiErrorMessage(err), 'error')
            }
          }}
        />
      )}
      {!abilities.plan && !handed && (
        <p className="text-[12.5px] text-gray-500">
          {t('Bạn không có quyền thiết lập đợt test', 'You cannot manage the test plan')}
        </p>
      )}
    </div>
  )
}
