import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { issueApi } from '@/api/issueApi'
import { testApi } from '@/api/testApi'
import { useAuth } from '@/context/AuthContext'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { PlusIcon, SparklesIcon } from '@/components/ui/icons'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { hasWorkPermission } from '@/lib/workPermissions'
import { FEATURES } from '@/lib/features'
import { useI18n } from '@/i18n'
import { PERMISSIONS } from '@/types/rbac'
import type { IssueSummaryDto, RequirementRef, UserRef } from '@/types/issue'
import type { TestCaseDetailDto, TestCaseSummaryDto, TestTreeNodeDto } from '@/types/testing'
import { Toast, useToast } from '../documents/view/Toast'
import { useProjectContext } from '../projects/ProjectLayout'
import { useReqOptions } from '../kanban/ReqPicker'
import { testsDefaults, type RepoChip, type RunChip } from '../kanban/roleDefaults'
import {
  CodeChip,
  FilterChip,
  readPref,
  ReqChip,
  ResultPill,
  Segmented,
  shortDate,
  initials,
  testTypeLabel,
  writePref,
} from '../kanban/workUi'
import { CreateCycleModal, CyclesView, persistRunChips } from './CyclesView'
import { SuggestDialog, TestCaseDrawer, TestCaseModal, testPriorityLabel, type TestCaseDraft } from './TestCaseForms'

// /projects/:id/tests (Kho testcase, mockup khung 2a) và /projects/:id/tests/cycles/:cycleId? (Đợt chạy, khung 2b).
// Mở trang lần đầu theo vai trò (QA, PM → Đợt chạy; còn lại → Kho), sau đó nhớ lựa chọn cuối theo dự án.

const norm = (s: string) => s.toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim()

export function TestsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { project, role, can, isArchived } = useProjectContext()
  const projectId = project.projectId
  const location = useLocation()
  const navigate = useNavigate()
  const routeCycle = useParams().cycleId
  const [params, setParams] = useSearchParams()
  const view: 'repo' | 'cycles' = /\/tests\/cycles(\/|$)/.test(location.pathname) ? 'cycles' : 'repo'
  const me: UserRef | null = user ? { userId: user.id, fullName: user.fullName } : null
  const { toast, notify } = useToast()
  const defaults = testsDefaults(role)

  const canManage = !isArchived && can(PERMISSIONS.testCaseManage)
  const canExecute = !isArchived && hasWorkPermission(project.myPermissions, PERMISSIONS.testCaseExecute)
  const canAi = canManage && project.aiEnabled && can(PERMISSIONS.aiUse)
  const canIssues = FEATURES.kanban && can(PERMISSIONS.issueView)

  // Lần đầu vào /tests: theo vai trò hoặc lựa chọn lần trước.
  const redirected = useRef(false)
  useEffect(() => {
    if (redirected.current || view !== 'repo' || params.get('node') || params.get('new')) return
    redirected.current = true
    const pref = readPref<'repo' | 'cycles'>(projectId, 'testsView') ?? defaults.view
    if (pref === 'cycles') navigate(`/projects/${projectId}/tests/cycles`, { replace: true })
  }, [view, params, projectId, defaults.view, navigate])

  const tree = useAsync(() => testApi.tree(projectId), [projectId])
  const cases = useAsync(() => testApi.list(projectId), [projectId])
  const cycles = useAsync(() => testApi.cycles(projectId), [projectId])
  const issues = useAsync(
    () =>
      canIssues
        ? issueApi.list(projectId).catch(() => [] as IssueSummaryDto[])
        : Promise.resolve([] as IssueSummaryDto[]),
    [projectId, canIssues],
  )
  const sprints = useAsync(
    () => (canIssues ? issueApi.sprints(projectId).catch(() => []) : Promise.resolve([])),
    [projectId, canIssues],
  )
  const assignees = useAsync(() => issueApi.assignees(projectId).catch(() => [] as UserRef[]), [projectId])

  const [runChips, setRunChipsState] = useState<RunChip[]>(
    () => readPref<RunChip[]>(projectId, 'runChips') ?? defaults.runChips,
  )
  const setRunChips = (c: RunChip[]) => {
    setRunChipsState(c)
    persistRunChips(projectId, c)
  }
  const [editing, setEditing] = useState<{ tc: TestCaseDetailDto | null; draft?: TestCaseDraft } | null>(null)
  const [suggest, setSuggest] = useState<RequirementRef[] | null>(null)
  const [cycleOpen, setCycleOpen] = useState(false)
  const [runRequest, setRunRequest] = useState<{ open: number } | null>(null)

  const openCycles = (cycles.data ?? []).filter((c) => c.status === 'OPEN')
  const cycleId = routeCycle ? Number(routeCycle) : ((openCycles[0] ?? cycles.data?.[0])?.cycleId ?? null)
  const myPendingQ = useAsync(
    () => (view === 'cycles' && cycleId ? testApi.runs(cycleId, { assigneeId: 'me' }) : Promise.resolve([])),
    [view, cycleId],
  )
  const myPending = (myPendingQ.data ?? []).filter((r) => r.result === 'NOT_RUN' || r.needsRerun).length
  const selectedCycle = cycles.data?.find((c) => c.cycleId === cycleId)

  const switchView = (v: 'repo' | 'cycles') => {
    writePref(projectId, 'testsView', v)
    navigate(`/projects/${projectId}/tests${v === 'cycles' ? '/cycles' : ''}`)
  }

  // Ctrl K "Tạo testcase" (?new=1) và "+ Testcase" từ Việc của tôi (?node=…&new=1).
  useEffect(() => {
    if (params.get('new') !== '1' || !tree.data) return
    const node = tree.data.find((n) => n.id === params.get('node'))
    if (canManage)
      setEditing({
        tc: null,
        draft: node?.requirement
          ? { requirementRefs: [{ documentId: node.requirement.documentId, reqUid: node.requirement.reqUid }] }
          : {},
      })
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams, tree.data, canManage])

  const folders = (tree.data ?? [])
    .filter((n) => n.kind === 'FOLDER')
    .map((n) => ({ folderId: Number(n.id.slice(7)), name: n.label }))
  const error = tree.error ?? cases.error ?? cycles.error

  return (
    <div className="-mt-2 lg:-mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
        <Segmented
          label={t('Chế độ xem', 'View')}
          value={view}
          onChange={switchView}
          options={[
            { value: 'repo', label: t('Kho testcase', 'Repository') },
            {
              value: 'cycles',
              label: (
                <>
                  {t('Đợt chạy', 'Cycles')}
                  {openCycles.length > 0 && (
                    <span className="text-xs font-normal text-gray-400">{openCycles.length}</span>
                  )}
                </>
              ),
            },
          ]}
        />
        <span className="flex-1" />
        {view === 'repo' && canAi && (
          <Button inline variant="secondary" className="text-brand-700" onClick={() => setSuggest([])}>
            <SparklesIcon className="h-4 w-4" />
            {t('Gợi ý từ REQ', 'Suggest from REQs')}
          </Button>
        )}
        {view === 'repo' && canManage && (
          <Button inline onClick={() => setEditing({ tc: null, draft: {} })}>
            <PlusIcon className="h-4 w-4" />
            Testcase
          </Button>
        )}
        {view === 'cycles' && canManage && (
          <Button inline variant="secondary" onClick={() => setCycleOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            {t('Đợt chạy', 'Test cycle')}
          </Button>
        )}
        {view === 'cycles' && canExecute && selectedCycle?.status === 'OPEN' && (
          <Button inline disabled={myPending === 0} onClick={() => setRunRequest({ open: Date.now() })}>
            ▶ {t(`Chạy của tôi (${myPending})`, `Run mine (${myPending})`)}
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState
          message={apiErrorMessage(error)}
          onRetry={() => void (tree.reload(), cases.reload(), cycles.reload())}
        />
      ) : !tree.data || !cases.data || !cycles.data ? (
        <LoadingBlock />
      ) : view === 'repo' ? (
        <RepositoryView
          projectId={projectId}
          tree={tree.data}
          cases={cases.data}
          issues={issues.data ?? []}
          me={me}
          canManage={canManage}
          canAi={canAi}
          defaultsChips={defaults.repoChips}
          onCreate={(draft) => setEditing({ tc: null, draft })}
          onSuggest={(refs) => setSuggest(refs)}
          onEdit={(tc) => setEditing({ tc })}
          notify={notify}
        />
      ) : (
        <CyclesView
          projectId={projectId}
          cycleId={cycleId}
          cycles={cycles.data}
          me={me}
          canManage={canManage}
          canExecute={canExecute}
          assignees={assignees.data ?? []}
          issues={issues.data ?? []}
          chips={runChips}
          defaultChips={defaults.runChips}
          setChips={setRunChips}
          notify={notify}
          runnerRequest={runRequest}
        />
      )}

      <TestCaseModal
        open={editing !== null}
        projectId={projectId}
        editing={editing?.tc ?? null}
        draft={editing?.draft}
        folders={folders}
        issues={issues.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={(tc) =>
          notify(editing?.tc ? t(`Đã lưu ${tc.key}`, `${tc.key} saved`) : t(`Đã tạo ${tc.key}`, `${tc.key} created`))
        }
      />
      <SuggestDialog
        open={suggest !== null}
        projectId={projectId}
        initialRefs={suggest ?? []}
        onClose={() => setSuggest(null)}
        onCreated={(n) => notify(t(`Đã tạo ${n} testcase`, `Created ${n} test ${n === 1 ? 'case' : 'cases'}`))}
      />
      <CreateCycleModal
        open={cycleOpen}
        projectId={projectId}
        tree={tree.data ?? []}
        testcases={cases.data ?? []}
        sprints={sprints.data ?? []}
        assignees={assignees.data ?? []}
        me={me}
        onClose={() => setCycleOpen(false)}
        onCreated={(c) => {
          notify(t(`Đã tạo ${c.name}`, `${c.name} created`))
          navigate(`/projects/${projectId}/tests/cycles/${c.cycleId}`)
        }}
      />
      <Toast toast={toast} />
    </div>
  )
}

// ---------- Kho testcase ----------

function RepositoryView({
  projectId,
  tree,
  cases,
  issues,
  me,
  canManage,
  canAi,
  defaultsChips,
  onCreate,
  onSuggest,
  onEdit,
  notify,
}: {
  projectId: number
  tree: TestTreeNodeDto[]
  cases: TestCaseSummaryDto[]
  issues: IssueSummaryDto[]
  me: UserRef | null
  canManage: boolean
  canAi: boolean
  defaultsChips: RepoChip[]
  onCreate: (draft: TestCaseDraft) => void
  onSuggest: (refs: RequirementRef[]) => void
  onEdit: (tc: TestCaseDetailDto) => void
  notify: (text: string, tone?: 'ok' | 'error') => void
}) {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [chips, setChipsState] = useState<RepoChip[]>(
    () => readPref<RepoChip[]>(projectId, 'repoChips') ?? defaultsChips,
  )
  const setChips = (c: RepoChip[]) => {
    setChipsState(c)
    writePref(projectId, 'repoChips', c)
  }
  const [openTc, setOpenTc] = useState<number | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)
  const reqs = useReqOptions(projectId)

  const firstReq = tree.find((n) => n.kind === 'REQUIREMENT')?.id ?? tree[0]?.id ?? 'unlinked'
  const selectedId = params.get('node') ?? readPref<string>(projectId, 'repoNode') ?? firstReq
  const node = tree.find((n) => n.id === selectedId) ?? tree.find((n) => n.id === firstReq) ?? null
  const select = (id: string) => {
    writePref(projectId, 'repoNode', id)
    const next = new URLSearchParams(params)
    next.set('node', id)
    setParams(next, { replace: true })
  }

  const myIssueIds = useMemo(
    () => new Set(issues.filter((i) => i.assignee?.userId === me?.userId).map((i) => i.issueId)),
    [issues, me?.userId],
  )
  const inNode = (tc: TestCaseSummaryDto) => {
    if (!node) return true
    if (node.kind === 'DOCUMENT') return tc.requirements.some((r) => `doc-${r.documentId}` === node.id)
    if (node.kind === 'REQUIREMENT')
      return tc.requirements.some(
        (r) => r.documentId === node.requirement?.documentId && r.reqUid === node.requirement?.reqUid,
      )
    if (node.kind === 'FOLDER') return `folder-${tc.folderId}` === node.id
    return tc.requirements.length === 0
  }
  const list = cases.filter(
    (tc) =>
      inNode(tc) &&
      (!chips.includes('mine') || tc.issues.some((i) => myIssueIds.has(i.issueId))) &&
      (!chips.includes('review') || tc.needsReview),
  )
  const reviewCount = cases.filter((tc) => inNode(tc) && tc.needsReview).length

  // REQ đang chọn: tiêu chí nghiệm thu chưa có testcase (so tiêu đề) → "+ Tạo" / "✦ Để AI đề xuất".
  const req = node?.kind === 'REQUIREMENT' ? node.requirement : null
  const reqOption = req ? reqs?.find((o) => o.documentId === req.documentId && o.reqUid === req.reqUid) : undefined
  const missing = reqOption
    ? reqOption.criteria
        .map((c) => c.text.trim())
        .filter((c) => c && !cases.filter(inNode).some((tc) => norm(tc.title).includes(norm(c))))
    : []
  const ref = req ? [{ documentId: req.documentId, reqUid: req.reqUid }] : []

  const docs = tree.filter((n) => n.kind === 'DOCUMENT')
  const folders = tree.filter((n) => n.kind === 'FOLDER')
  const unlinked = tree.find((n) => n.kind === 'UNLINKED')

  const treeItem = (n: TestTreeNodeDto, content: React.ReactNode) => (
    <button
      key={n.id}
      type="button"
      onClick={() => select(n.id)}
      aria-current={node?.id === n.id ? 'true' : undefined}
      className={clsx(
        'flex w-full items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-left text-[13px]',
        node?.id === n.id
          ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200'
          : 'text-gray-700 hover:bg-gray-200/50',
      )}
    >
      {content}
      <span
        className={clsx(
          'ml-auto pl-2 text-xs tabular-nums',
          n.kind === 'REQUIREMENT' && n.testCount === 0 ? 'font-medium text-amber-700' : 'text-gray-400',
        )}
      >
        {n.testCount}
      </span>
    </button>
  )

  return (
    <div className="overflow-hidden rounded-card border border-gray-200 bg-white lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav
        aria-label={t('Cây testcase', 'Test tree')}
        className="hidden space-y-0.5 border-r border-gray-200 bg-gray-50 p-2 lg:block"
      >
        {docs.map((d) => (
          <div key={d.id} className="pb-1">
            <button
              type="button"
              onClick={() => select(d.id)}
              className={clsx(
                'block w-full truncate rounded-[7px] px-2 pb-1 pt-2.5 text-left text-xs',
                node?.id === d.id ? 'font-medium text-gray-950' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {d.label}
            </button>
            {tree
              .filter((n) => n.parentId === d.id)
              .map((n) =>
                treeItem(
                  n,
                  <>
                    {n.requirement && <ReqChip req={n.requirement} short />}
                    <span className="min-w-0 truncate">{n.label.split(' · ').slice(1).join(' · ') || n.label}</span>
                  </>,
                ),
              )}
          </div>
        ))}
        <p className="flex items-center px-2 pb-1 pt-2.5 text-xs text-gray-500">
          {t('Thư mục khác', 'Other folders')}
          {canManage && (
            <button
              type="button"
              onClick={() => setFolderName('')}
              className="ml-auto font-medium text-brand-700 hover:underline"
            >
              {t('+ Thư mục', '+ Folder')}
            </button>
          )}
        </p>
        {folderName !== null && (
          <form
            className="px-1 pb-1"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await testApi.createFolder(projectId, { name: folderName })
                setFolderName(null)
              } catch (err) {
                notify(apiErrorMessage(err), 'error')
              }
            }}
          >
            <input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onBlur={() => !folderName.trim() && setFolderName(null)}
              placeholder={t('Tên thư mục, Enter để tạo', 'Folder name, Enter to create')}
              aria-label={t('Tên thư mục', 'Folder name')}
              className="h-8 w-full rounded-[7px] border border-gray-300 px-2 text-[13px] focus:border-brand-400 focus:outline-none"
            />
          </form>
        )}
        {folders.map((f) => treeItem(f, <span className="min-w-0 truncate">▸ {f.label}</span>))}
        {unlinked && treeItem(unlinked, <span className="min-w-0 truncate">{unlinked.label}</span>)}
      </nav>

      <div className="min-w-0 p-4 sm:p-5">
        <label className="mb-3 block lg:hidden">
          <span className="sr-only">{t('Nhóm testcase', 'Test group')}</span>
          <select
            value={node?.id ?? ''}
            onChange={(e) => select(e.target.value)}
            className="h-11 w-full rounded-control border border-gray-300 bg-white px-3 text-sm"
          >
            {tree.map((n) => (
              <option key={n.id} value={n.id}>
                {n.kind === 'REQUIREMENT' ? `— ${n.label}` : n.label} ({n.testCount})
              </option>
            ))}
          </select>
        </label>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-gray-950">{node?.label ?? t('Tất cả', 'All')}</h2>
          {node && node.needsReviewCount > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-px text-xs font-medium text-amber-800">
              {[
                req?.changedNote,
                t(`${node.needsReviewCount} test cần xem lại`, `${node.needsReviewCount} tests to review`),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
          <span className="flex-1" />
          <FilterChip
            active={chips.includes('mine')}
            roleDefault={defaultsChips.includes('mine')}
            onClick={() => setChips(chips.includes('mine') ? chips.filter((c) => c !== 'mine') : [...chips, 'mine'])}
          >
            {t('Issue của tôi', 'My issues')}
          </FilterChip>
          <FilterChip
            active={chips.includes('review')}
            count={reviewCount}
            onClick={() =>
              setChips(chips.includes('review') ? chips.filter((c) => c !== 'review') : [...chips, 'review'])
            }
          >
            {t('Cần xem lại', 'To review')}
          </FilterChip>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13.5px]">
            <thead>
              <tr className="text-left text-[12.5px] text-gray-500">
                {[
                  'Testcase',
                  t('Loại', 'Type'),
                  t('Ưu tiên', 'Priority'),
                  t('Lần chạy gần nhất', 'Last run'),
                  'Issue',
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-gray-200 bg-gray-50 px-3 py-2 font-medium first:rounded-tl-[8px] last:rounded-tr-[8px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((tc) => (
                <tr
                  key={tc.testCaseId}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setOpenTc(tc.testCaseId)}
                >
                  <td className="border-b border-gray-200 px-3 py-2.5">
                    <button
                      type="button"
                      className="text-left font-medium text-gray-950 hover:text-brand-700"
                      onClick={(e) => (e.stopPropagation(), setOpenTc(tc.testCaseId))}
                    >
                      {tc.title}
                    </button>
                    <p className="text-xs text-gray-500">
                      {tc.key} · {t(`${tc.stepCount} bước`, `${tc.stepCount} ${tc.stepCount === 1 ? 'step' : 'steps'}`)}
                      {tc.needsReview && (
                        <span className="text-amber-700">
                          {' '}
                          · {t('cần xem lại theo REQ mới', 'review against the new REQ')}
                        </span>
                      )}
                      {node?.kind !== 'REQUIREMENT' && tc.requirements.length > 0 && (
                        <span> · {tc.requirements.map((r) => r.reqKey ?? '?').join(', ')}</span>
                      )}
                    </p>
                  </td>
                  <td className="border-b border-gray-200 px-3 py-2.5 text-gray-700">{testTypeLabel(tc.type)}</td>
                  <td
                    className={clsx(
                      'border-b border-gray-200 px-3 py-2.5 text-xs font-bold',
                      tc.priority === 'HIGH'
                        ? 'text-red-700'
                        : tc.priority === 'MEDIUM'
                          ? 'text-amber-700'
                          : 'text-gray-500',
                    )}
                  >
                    {testPriorityLabel(tc.priority, t)}
                  </td>
                  <td className="border-b border-gray-200 px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <ResultPill result={tc.lastResult} />
                      {tc.lastRunAt && (
                        <span className="text-[12.5px] text-gray-500">
                          {shortDate(tc.lastRunAt)}
                          {tc.lastRunBy ? ` · ${initials(tc.lastRunBy.fullName)}` : ''}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="border-b border-gray-200 px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {tc.issues.slice(0, 2).map((i) => (
                        <CodeChip key={i.issueId}>{i.key}</CodeChip>
                      ))}
                      {tc.issues.length > 2 && <span className="text-xs text-gray-500">+{tc.issues.length - 2}</span>}
                    </span>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="border-b border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                    {node?.kind === 'REQUIREMENT'
                      ? t('REQ này chưa có testcase.', 'This REQ has no test cases yet.')
                      : t('Không có testcase.', 'No test cases.')}
                    {canManage && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="font-medium text-brand-700 hover:underline"
                          onClick={() => onCreate({ requirementRefs: ref })}
                        >
                          {t('+ Tạo', '+ Create')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
              {missing.slice(0, 3).map((c) => (
                <tr key={c}>
                  <td colSpan={5} className="border-b border-gray-200 px-3 py-2.5 text-[13px] text-gray-500">
                    {t(`Tiêu chí “${c}” chưa có testcase`, `Criterion “${c}” has no test case`)}
                    {canManage && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="font-medium text-brand-700 hover:underline"
                          onClick={() =>
                            onCreate({ title: c, requirementRefs: ref, steps: [{ action: c, expected: c }] })
                          }
                        >
                          {t('+ Tạo', '+ Create')}
                        </button>
                      </>
                    )}
                    {canAi && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="font-medium text-brand-700 hover:underline"
                          onClick={() => onSuggest(ref)}
                        >
                          {t('✦ Để AI đề xuất', '✦ Let AI propose')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openTc !== null && (
        <TestCaseDrawer testCaseId={openTc} onClose={() => setOpenTc(null)} onEdit={onEdit} notify={notify} />
      )}
    </div>
  )
}
