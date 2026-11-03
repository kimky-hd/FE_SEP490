import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { useI18n } from '@/i18n'
import type { IssuePriority, IssueSummaryDto, SprintDto, UserRef } from '@/types/issue'
import type { TestCaseSummaryDto, TestCycleDto, TestRunDto, TestTreeNodeDto } from '@/types/testing'
import { CodeChip, FilterChip, PersonDot, ReqChip, ResultPill, shortDate, StackBar, writePref } from '../kanban/workUi'
import type { RunChip } from '../kanban/roleDefaults'

// Đợt chạy (mockup khung 2b): chọn đợt · thanh tiến độ · chip lọc · bảng lượt chạy. "▶ Chạy" mở chế độ chạy từng test
// (mock-role-modules.html khung 2b): bước + mong đợi, phím P / F / B, ghi chú, Lỗi → tạo bug gắn sẵn REQ + test.

const pending = (r: TestRunDto) => r.result === 'NOT_RUN' || r.needsRerun

export function CyclesView({
  projectId,
  cycleId,
  cycles,
  me,
  canManage,
  canExecute,
  assignees,
  issues,
  chips,
  defaultChips,
  setChips,
  notify,
  runnerRequest,
}: {
  projectId: number
  cycleId: number | null
  cycles: TestCycleDto[]
  me: UserRef | null
  canManage: boolean
  canExecute: boolean
  assignees: UserRef[]
  issues: IssueSummaryDto[]
  chips: RunChip[]
  defaultChips: RunChip[]
  setChips: (c: RunChip[]) => void
  notify: (text: string, tone?: 'ok' | 'error') => void
  runnerRequest: { open: number } | null
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const cycle = cycles.find((c) => c.cycleId === cycleId) ?? null
  const runsQ = useAsync(
    () => (cycle ? testApi.runs(cycle.cycleId) : Promise.resolve([] as TestRunDto[])),
    [cycle?.cycleId],
  )
  const runs = useMemo(() => runsQ.data ?? [], [runsQ.data])
  const [runner, setRunner] = useState<number[] | null>(null)

  const mine = runs.filter((r) => r.assignee?.userId === me?.userId)
  const myPending = mine.filter(pending)
  const open = cycle?.status === 'OPEN'

  // ?run=mine | ?run=<id> (từ "Việc của tôi") → mở chế độ chạy.
  const runParam = params.get('run')
  useEffect(() => {
    if (!runParam || !runsQ.data || !cycle) return
    const ids =
      runParam === 'mine'
        ? myPending.map((r) => r.runId)
        : runs.some((r) => r.runId === Number(runParam))
          ? [Number(runParam), ...myPending.map((r) => r.runId).filter((id) => id !== Number(runParam))]
          : []
    if (ids.length && open && canExecute) setRunner(ids)
    const next = new URLSearchParams(params)
    next.delete('run')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runParam, runsQ.data])

  // Nút "▶ Chạy của tôi" ở đầu trang.
  const lastRequest = useRef<number>(0)
  useEffect(() => {
    if (!runnerRequest || runnerRequest.open === lastRequest.current) return
    lastRequest.current = runnerRequest.open
    if (myPending.length) setRunner(myPending.map((r) => r.runId))
    else notify(t('Bạn không còn lượt nào cần chạy.', 'You have no runs left.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runnerRequest])

  if (cycles.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-gray-300 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-gray-950">{t('Chưa có đợt chạy', 'No test cycles yet')}</p>
        <p className="mt-1 text-sm text-gray-600">
          {t(
            'Tạo một đợt chạy từ các testcase trong kho để giao cho tester.',
            'Create a cycle from repository test cases and assign testers.',
          )}
        </p>
      </div>
    )
  }
  if (!cycle) return <LoadingBlock />

  const toggle = (c: RunChip) => setChips(chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c])
  const shown = runs.filter(
    (r) =>
      (!chips.includes('mine') || r.assignee?.userId === me?.userId) &&
      (!chips.includes('rerun') || r.needsRerun) &&
      (!chips.includes('fail') || r.result === 'FAIL'),
  )
  const c = cycle.counts

  return (
    <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-gray-200 px-4 py-3 sm:px-5">
        {cycles.length > 1 ? (
          <select
            aria-label={t('Đợt chạy', 'Test cycle')}
            value={cycle.cycleId}
            onChange={(e) => navigate(`/projects/${projectId}/tests/cycles/${e.target.value}`)}
            className="h-9 max-w-[18rem] rounded-control border border-gray-300 bg-white px-2 text-sm font-semibold text-gray-950 shadow-xs focus:outline-none focus:ring-4 focus:ring-brand-100 lg:h-8"
          >
            {cycles.map((x) => (
              <option key={x.cycleId} value={x.cycleId}>
                {x.name}
                {x.status === 'CLOSED' ? t(' (đã đóng)', ' (closed)') : ''}
              </option>
            ))}
          </select>
        ) : (
          <b className="font-semibold text-gray-950">{cycle.name}</b>
        )}
        <StackBar
          className="min-w-[160px] max-w-[360px] flex-1"
          parts={[
            { value: c.pass, className: 'bg-success-600' },
            { value: c.fail, className: 'bg-red-600' },
            { value: c.blocked, className: 'bg-amber-500' },
            { value: c.notRun, className: 'bg-gray-200' },
          ]}
        />
        <span className="flex flex-wrap gap-3 text-[12.5px] text-gray-500">
          <Legend className="bg-success-600">{t(`Đạt ${c.pass}`, `Pass ${c.pass}`)}</Legend>
          <Legend className="bg-red-600">{t(`Lỗi ${c.fail}`, `Fail ${c.fail}`)}</Legend>
          <Legend className="bg-amber-500">{t(`Chặn ${c.blocked}`, `Blocked ${c.blocked}`)}</Legend>
          <Legend className="bg-gray-300">{t(`Chưa chạy ${c.notRun}`, `Not run ${c.notRun}`)}</Legend>
        </span>
        <span className="flex-1" />
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={chips.includes('mine')}
            roleDefault={defaultChips.includes('mine')}
            count={mine.length}
            onClick={() => toggle('mine')}
          >
            {t('Của tôi', 'Mine')}
          </FilterChip>
          <FilterChip
            active={chips.includes('rerun')}
            count={runs.filter((r) => r.needsRerun).length}
            onClick={() => toggle('rerun')}
          >
            {t('Cần chạy lại', 'Rerun')}
          </FilterChip>
          <FilterChip active={chips.includes('fail')} onClick={() => toggle('fail')}>
            {t('Lỗi', 'Failed')}
          </FilterChip>
          {canManage && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await testApi.updateCycle(cycle.cycleId, { status: open ? 'CLOSED' : 'OPEN' })
                  notify(open ? t('Đã đóng đợt chạy', 'Cycle closed') : t('Đã mở lại đợt chạy', 'Cycle reopened'))
                } catch (err) {
                  notify(apiErrorMessage(err), 'error')
                }
              }}
              className="ml-1 text-[12.5px] font-medium text-gray-500 hover:text-gray-900 hover:underline"
            >
              {open ? t('Đóng đợt', 'Close cycle') : t('Mở lại', 'Reopen')}
            </button>
          )}
        </div>
      </div>

      {runsQ.error ? (
        <div className="p-5">
          <ErrorState message={apiErrorMessage(runsQ.error)} onRetry={() => void runsQ.reload()} />
        </div>
      ) : !runsQ.data ? (
        <LoadingBlock />
      ) : (
        <div className="relative overflow-x-auto px-0 sm:px-5 sm:py-3">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-[13.5px]">
            <thead>
              <tr className="text-left text-[12.5px] text-gray-500">
                {[t('Lượt chạy', 'Run'), 'REQ', t('Người chạy', 'Tester'), t('Kết quả', 'Result'), ''].map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium first:rounded-tl-[8px] last:rounded-tr-[8px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const defect = r.defects[0]
                return (
                  <tr key={r.runId} className="hover:bg-gray-50">
                    <td className="border-b border-gray-200 px-3 py-2.5">
                      <p className="font-medium text-gray-950">{r.testCase.title}</p>
                      <p className="text-xs text-gray-500">
                        {r.testCase.key}
                        {defect
                          ? t(` · lỗi lần trước → bug ${defect.key}`, ` · failed last time → bug ${defect.key}`)
                          : ''}
                      </p>
                    </td>
                    <td className="border-b border-gray-200 px-3 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        {r.testCase.requirements.map((q) => (
                          <ReqChip key={q.reqUid} req={q} />
                        ))}
                      </span>
                    </td>
                    <td className="border-b border-gray-200 px-3 py-2.5">
                      {canManage && open ? (
                        <label className="inline-flex items-center gap-1.5">
                          <PersonDot user={r.assignee} />
                          <select
                            aria-label={t(`Người chạy ${r.testCase.key}`, `Tester for ${r.testCase.key}`)}
                            value={r.assignee?.userId ?? ''}
                            onChange={async (e) => {
                              try {
                                await testApi.updateRun(r.runId, {
                                  assigneeId: e.target.value ? Number(e.target.value) : null,
                                })
                              } catch (err) {
                                notify(apiErrorMessage(err), 'error')
                              }
                            }}
                            className="h-8 w-[7.5rem] rounded-[7px] border border-transparent bg-transparent px-1 text-[12.5px] text-gray-700 hover:border-gray-300 focus:border-brand-400 focus:outline-none"
                          >
                            <option value="">{t('Chưa giao', 'Unassigned')}</option>
                            {assignees.map((u) => (
                              <option key={u.userId} value={u.userId}>
                                {u.fullName}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <PersonDot user={r.assignee} />
                      )}
                    </td>
                    <td className="border-b border-gray-200 px-3 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <ResultPill result={r.result} />
                        {r.needsRerun && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[11.5px] font-medium text-amber-800">
                            {t('Cần chạy lại', 'Rerun')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="border-b border-gray-200 px-3 py-2.5 text-right">
                      {open && canExecute && pending(r) ? (
                        <Button
                          inline
                          variant="secondary"
                          className="lg:h-8"
                          onClick={() =>
                            setRunner([r.runId, ...myPending.map((x) => x.runId).filter((id) => id !== r.runId)])
                          }
                        >
                          ▶ {t('Chạy', 'Run')}
                        </Button>
                      ) : (
                        <button
                          type="button"
                          disabled={!open || !canExecute}
                          onClick={() => setRunner([r.runId])}
                          title={open && canExecute ? t('Chạy lại', 'Run again') : undefined}
                          className="max-w-[12rem] truncate text-[13px] text-gray-500 enabled:hover:text-gray-900"
                        >
                          {r.note ?? shortDate(r.executedAt)}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                    {t('Không có lượt chạy khớp bộ lọc.', 'No runs match the filters.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {runner && (
        <Runner
          runs={runs}
          queue={runner}
          cycleName={cycle.name}
          assignees={assignees}
          issues={issues}
          onClose={() => setRunner(null)}
          notify={notify}
        />
      )}
    </div>
  )
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <i aria-hidden="true" className={clsx('inline-block h-2 w-2 rounded-[2px]', className)} />
      {children}
    </span>
  )
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest('input, textarea, select, [contenteditable="true"]')

/** Chạy từng test: P = Đạt, F = Lỗi, B = Bị chặn; tự sang test kế tiếp. */
function Runner({
  runs,
  queue,
  cycleName,
  assignees,
  issues,
  onClose,
  notify,
}: {
  runs: TestRunDto[]
  queue: number[]
  cycleName: string
  assignees: UserRef[]
  issues: IssueSummaryDto[]
  onClose: () => void
  notify: (text: string, tone?: 'ok' | 'error') => void
}) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [note, setNote] = useState('')
  const [bug, setBug] = useState(true)
  const [bugTitle, setBugTitle] = useState('')
  const [bugAssignee, setBugAssignee] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Giữ bản chụp lượt chạy lúc mở (danh sách tải lại sau mỗi lần ghi kết quả).
  const [snapshot] = useState(() =>
    queue.map((id) => runs.find((r) => r.runId === id)).filter((r): r is TestRunDto => !!r),
  )
  const run = snapshot[index] ?? null
  const [detail, setDetail] = useState<{
    id: number
    steps: { action: string; expected: string }[]
    pre: string | null
  } | null>(null)

  // Phím P / F / B chỉ chạy khi không gõ chữ: đặt focus vào nút "Đạt" (Modal tự focus ô nhập đầu tiên).
  useEffect(() => {
    const id = requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-keyshortcuts="P"]')?.focus())
    return () => cancelAnimationFrame(id)
  }, [run?.runId])

  useEffect(() => {
    if (!run) return
    setNote('')
    setError(null)
    setBug(run.defects.length === 0)
    setBugTitle(t(`Lỗi: ${run.testCase.title}`, `Bug: ${run.testCase.title}`))
    const linked = issues.find((i) => run.testCase.issues.some((x) => x.issueId === i.issueId) && i.type !== 'BUG')
    setBugAssignee(linked?.assignee ? String(linked.assignee.userId) : '')
    let alive = true
    testApi.get(run.testCase.testCaseId).then(
      (d) => alive && setDetail({ id: run.runId, steps: d.steps, pre: d.preconditions }),
      () => alive && setDetail({ id: run.runId, steps: [], pre: null }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.runId])

  const record = async (result: 'PASS' | 'FAIL' | 'BLOCKED') => {
    if (!run || busy) return
    setBusy(true)
    setError(null)
    try {
      await testApi.recordResult(run.runId, {
        result,
        note: note.trim() || null,
        createDefect:
          result === 'FAIL' && bug && bugTitle.trim()
            ? {
                title: bugTitle.trim(),
                priority: 'HIGH' as IssuePriority,
                assigneeId: bugAssignee ? Number(bugAssignee) : null,
              }
            : null,
      })
      setDone((n) => n + 1)
      setIndex((i) => i + 1)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || !run) return
      const k = e.key.toLowerCase()
      if (k === 'p') void record('PASS')
      else if (k === 'f') void record('FAIL')
      else if (k === 'b') void record('BLOCKED')
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const finished = !run
  useEffect(() => {
    if (finished && done > 0)
      notify(t(`Đã ghi ${done} kết quả`, `Recorded ${done} ${done === 1 ? 'result' : 'results'}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  const changed = run?.testCase.requirements.find((r) => r.changedNote)
  const title = run?.needsRerun ? t('Chạy lại sau khi REQ đổi', 'Rerun after REQ change') : t('Chạy test', 'Run tests')
  const steps = detail && run && detail.id === run.runId ? detail.steps : null

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={finished ? t('Xong lượt chạy', 'Runs finished') : `${title} · ${index + 1} / ${snapshot.length}`}
      description={finished ? undefined : `${cycleName} · ${t('Esc để dừng', 'Esc to stop')}`}
      footer={
        finished ? (
          <Button inline onClick={onClose}>
            {t('Đóng', 'Close')}
          </Button>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2">
            <RunButton
              tone="pass"
              disabled={busy}
              onClick={() => void record('PASS')}
              label={t('Đạt', 'Pass')}
              kbd="P"
            />
            <RunButton
              tone="fail"
              disabled={busy}
              onClick={() => void record('FAIL')}
              label={t('Lỗi', 'Fail')}
              kbd="F"
            />
            <RunButton
              tone="blocked"
              disabled={busy}
              onClick={() => void record('BLOCKED')}
              label={t('Bị chặn', 'Blocked')}
              kbd="B"
            />
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="text-[13px] font-medium text-gray-500 hover:text-gray-900"
            >
              {t('Bỏ qua', 'Skip')}
            </button>
          </div>
        )
      }
    >
      <div className="-mx-6 -mt-4 mb-4 h-1 bg-gray-100">
        <i
          className="block h-full bg-brand-600 transition-[width]"
          style={{ width: `${(Math.min(index, snapshot.length) / snapshot.length) * 100}%` }}
        />
      </div>
      {finished ? (
        <p className="text-sm text-gray-700">
          {t(`Đã ghi ${done} / ${snapshot.length} kết quả.`, `Recorded ${done} / ${snapshot.length} results.`)}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <CodeChip>{run.testCase.key}</CodeChip>
            {run.testCase.requirements.map((r) => (
              <ReqChip key={r.reqUid} req={r} />
            ))}
            {run.testCase.issues.map((i) => (
              <CodeChip key={i.issueId}>{i.key}</CodeChip>
            ))}
          </div>
          <h3 className="text-[17px] font-semibold text-gray-950">{run.testCase.title}</h3>
          {changed && (
            <p className="text-[13px] text-amber-800">
              {changed.reqKey} · {changed.changedNote}
            </p>
          )}
          {detail?.pre && (
            <p className="text-[13px] text-gray-600">
              {t('Điều kiện trước: ', 'Preconditions: ')}
              {detail.pre}
            </p>
          )}
          {steps === null ? (
            <p className="text-sm text-gray-500">{t('Đang tải bước…', 'Loading steps…')}</p>
          ) : (
            <>
              <ol className="ml-5 list-decimal space-y-1 text-sm leading-relaxed text-gray-700">
                {steps.map((s, i) => (
                  <li key={i}>{s.action}</li>
                ))}
              </ol>
              {steps.some((s) => s.expected) && (
                <div className="rounded-card border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13.5px] text-gray-700">
                  <b className="font-medium text-gray-950">{t('Mong đợi: ', 'Expected: ')}</b>
                  {steps
                    .map((s) => s.expected)
                    .filter(Boolean)
                    .join('; ')}
                </div>
              )}
            </>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            aria-label={t('Ghi chú', 'Note')}
            placeholder={t('Ghi chú (tuỳ chọn)…', 'Note (optional)…')}
            className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
          <div className="rounded-card border border-gray-200 px-3 py-2.5 text-[13px]">
            <label className="flex items-center gap-2 text-gray-700">
              <input
                type="checkbox"
                checked={bug}
                onChange={(e) => setBug(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              {t(
                'Khi ghi Lỗi: tạo bug gắn sẵn REQ và testcase này',
                'On Fail: create a bug linked to this REQ and test case',
              )}
            </label>
            {bug && (
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <input
                  value={bugTitle}
                  onChange={(e) => setBugTitle(e.target.value)}
                  aria-label={t('Tiêu đề bug', 'Bug title')}
                  className="h-9 rounded-control border border-gray-300 px-2.5 text-[13px] focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
                <select
                  value={bugAssignee}
                  onChange={(e) => setBugAssignee(e.target.value)}
                  aria-label={t('Giao bug cho', 'Assign bug to')}
                  className="h-9 rounded-control border border-gray-300 bg-white px-2 text-[13px]"
                >
                  <option value="">{t('Chưa giao', 'Unassigned')}</option>
                  {assignees.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      )}
    </Modal>
  )
}

const RUN_TONE = {
  pass: 'border-success-200 bg-success-50 text-success-700 hover:bg-success-100',
  fail: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  blocked: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
}

function RunButton({
  tone,
  label,
  kbd,
  disabled,
  onClick,
}: {
  tone: keyof typeof RUN_TONE
  label: string
  kbd: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-keyshortcuts={kbd}
      className={clsx(
        'inline-flex h-10 items-center gap-2 rounded-control border px-4 text-sm font-medium disabled:opacity-60',
        RUN_TONE[tone],
      )}
    >
      {label}
      <kbd className="rounded-[5px] border border-b-2 border-current/30 bg-white px-1.5 font-sans text-[11.5px] text-gray-600">
        {kbd}
      </kbd>
    </button>
  )
}

/** Tạo đợt chạy: tên, sprint, người chạy mặc định, chọn testcase theo REQ / thư mục. */
export function CreateCycleModal({
  open,
  projectId,
  tree,
  testcases,
  sprints,
  assignees,
  me,
  onClose,
  onCreated,
}: {
  open: boolean
  projectId: number
  tree: TestTreeNodeDto[]
  testcases: TestCaseSummaryDto[]
  sprints: SprintDto[]
  assignees: UserRef[]
  me: UserRef | null
  onClose: () => void
  onCreated: (c: TestCycleDto) => void
}) {
  const { t } = useI18n()
  const active = sprints.find((s) => s.status === 'ACTIVE')
  const [name, setName] = useState('')
  const [sprintId, setSprintId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(active ? t(`${active.name} · hồi quy`, `${active.name} · regression`) : t('Đợt chạy mới', 'New test cycle'))
    setSprintId(active ? String(active.sprintId) : '')
    setAssignee(me ? String(me.userId) : '')
    setPicked([])
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Nhóm: REQ (theo cây), thư mục, chưa gắn REQ.
  const groups = useMemo(() => {
    const out: { id: string; label: string; items: TestCaseSummaryDto[] }[] = []
    for (const n of tree) {
      let items: TestCaseSummaryDto[] = []
      if (n.kind === 'REQUIREMENT' && n.requirement) {
        const ref = n.requirement
        items = testcases.filter((tc) =>
          tc.requirements.some((r) => r.documentId === ref.documentId && r.reqUid === ref.reqUid),
        )
      } else if (n.kind === 'FOLDER')
        items = testcases.filter((tc) => `folder-${tc.folderId}` === n.id && tc.requirements.length === 0)
      else if (n.kind === 'UNLINKED')
        items = testcases.filter((tc) => tc.requirements.length === 0 && tc.folderId === null)
      if (items.length)
        out.push({
          id: n.id,
          label: n.kind === 'REQUIREMENT' ? `${n.requirement?.documentCode} · ${n.label}` : n.label,
          items,
        })
    }
    return out
  }, [tree, testcases])

  const toggleAll = (ids: number[]) => {
    const all = ids.every((id) => picked.includes(id))
    setPicked((p) => (all ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]))
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const c = await testApi.createCycle(projectId, {
        name,
        sprintId: sprintId ? Number(sprintId) : null,
        testCaseIds: picked,
        defaultAssigneeId: assignee ? Number(assignee) : null,
      })
      onCreated(c)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('Tạo đợt chạy', 'Create test cycle')}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void submit()} isLoading={busy} disabled={!name.trim() || picked.length === 0}>
            {t(`Tạo đợt (${picked.length} testcase)`, `Create cycle (${picked.length})`)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField
          label={t('Tên đợt', 'Cycle name')}
          name="cycle-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Sprint"
            name="cycle-sprint"
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
          >
            <option value="">{t('Không gắn sprint', 'No sprint')}</option>
            {sprints
              .filter((s) => s.status !== 'COMPLETED')
              .map((s) => (
                <option key={s.sprintId} value={s.sprintId}>
                  {s.name}
                </option>
              ))}
          </SelectField>
          <SelectField
            label={t('Người chạy mặc định', 'Default tester')}
            name="cycle-assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">{t('Chưa giao', 'Unassigned')}</option>
            {assignees.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.fullName}
              </option>
            ))}
          </SelectField>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{t('Testcase', 'Test cases')}</p>
            <button
              type="button"
              onClick={() => toggleAll(testcases.map((x) => x.testCaseId))}
              className="text-[13px] font-medium text-brand-700 hover:underline"
            >
              {t('Chọn / bỏ tất cả', 'Toggle all')}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-card border border-gray-200">
            {groups.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500">
                {t('Kho chưa có testcase.', 'The repository has no test cases.')}
              </p>
            )}
            {groups.map((g) => {
              const ids = g.items.map((x) => x.testCaseId)
              const all = ids.every((id) => picked.includes(id))
              return (
                <div key={g.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={all}
                      onChange={() => toggleAll(ids)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    {g.label}
                    <span className="font-normal text-gray-400">{g.items.length}</span>
                  </label>
                  {g.items.map((tc) => (
                    <label
                      key={`${g.id}-${tc.testCaseId}`}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 pl-9 text-sm hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={picked.includes(tc.testCaseId)}
                        onChange={() => toggleAll([tc.testCaseId])}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                      <span className="truncate">{tc.title}</span>
                      <CodeChip className="ml-auto">{tc.key}</CodeChip>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  )
}

export const persistRunChips = (projectId: number, chips: RunChip[]) => writePref(projectId, 'runChips', chips)
