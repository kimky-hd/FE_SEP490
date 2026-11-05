import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { issueApi } from '@/api/issueApi'
import { testApi } from '@/api/testApi'
import { useAuth } from '@/context/AuthContext'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  CheckIcon,
  DocumentIcon,
  LayersIcon,
  ListChecksIcon,
  PlusIcon,
  SparklesIcon,
  SyncIcon,
} from '@/components/ui/icons'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { hasWorkPermission } from '@/lib/workPermissions'
import { FEATURES } from '@/lib/features'
import { useI18n } from '@/i18n'
import { PERMISSIONS } from '@/types/rbac'
import type { IssueSummaryDto, RequirementRef, UserRef } from '@/types/issue'
import {
  RUN_RESULTS,
  TEST_APPROVAL_STATUSES,
  TEST_PRIORITIES,
  TEST_TYPES,
  type CreateTestCaseBody,
  type RunResult,
  type TestApprovalStatus,
  type TestCaseDetailDto,
  type TestCaseSummaryDto,
  type TestPriority,
  type TestTreeNodeDto,
  type TestType,
  type UpdateTestCaseBody,
} from '@/types/testing'
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
  resultLabel,
  Segmented,
  shortDate,
  initials,
  testTypeLabel,
  writePref,
} from '../kanban/workUi'
import { CreateCycleModal, CyclesView, persistRunChips } from './CyclesView'
import {
  ENTERPRISE_MODULES,
  ExcelImportModal,
  SuggestDialog,
  TestCaseDrawer,
  TestCaseModal,
  testApprovalLabel,
  testPriorityLabel,
  type TestCaseDraft,
} from './TestCaseForms'

// /projects/:id/tests (Kho testcase, khung 2a + Spreadsheet Grid chuẩn Excel Doanh nghiệp)
// và /projects/:id/tests/cycles/:cycleId? (Đợt chạy, khung 2b).

const norm = (s: string) => s.toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim()

export type ExcelTemplatePreset = 'CMMI_FULL' | 'ISTQB_AGILE' | 'UAT_SIGNOFF'

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
  const [importOpen, setImportOpen] = useState(false)
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
            { value: 'repo', label: t('Kho testcase & Excel Grid', 'Repository & Excel Grid') },
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
        {view === 'repo' && canManage && (
          <Button inline variant="secondary" onClick={() => setImportOpen(true)}>
            <DocumentIcon className="h-4 w-4" />
            {t('Import Excel / Paste Grid', 'Import Excel / Paste Grid')}
          </Button>
        )}
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
          canExecute={canExecute}
          canAi={canAi}
          defaultsChips={defaults.repoChips}
          onCreate={(draft) => setEditing({ tc: null, draft })}
          onSuggest={(refs) => setSuggest(refs)}
          onEdit={(tc) => setEditing({ tc })}
          onOpenImport={() => setImportOpen(true)}
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
      <ExcelImportModal
        open={importOpen}
        projectId={projectId}
        onClose={() => setImportOpen(false)}
        onImported={(n) =>
          notify(t(`Đã import thành công ${n} kịch bản kiểm thử chuẩn Excel`, `Successfully imported ${n} enterprise test cases`))
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

// ---------- Kho testcase & Enterprise Excel Grid ----------

function RepositoryView({
  projectId,
  tree,
  cases,
  issues,
  me,
  canManage,
  canExecute,
  canAi,
  defaultsChips,
  onCreate,
  onSuggest,
  onEdit,
  onOpenImport,
  notify,
}: {
  projectId: number
  tree: TestTreeNodeDto[]
  cases: TestCaseSummaryDto[]
  issues: IssueSummaryDto[]
  me: UserRef | null
  canManage: boolean
  canExecute: boolean
  canAi: boolean
  defaultsChips: RepoChip[]
  onCreate: (draft: TestCaseDraft) => void
  onSuggest: (refs: RequirementRef[]) => void
  onEdit: (tc: TestCaseDetailDto) => void
  onOpenImport: () => void
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

  // Chế độ hiển thị: 'excel' (Spreadsheet chuẩn Doanh nghiệp) hoặc 'compact' (Danh sách rút gọn)
  const [gridMode, setGridModeState] = useState<'excel' | 'compact'>(
    () => readPref<'excel' | 'compact'>(projectId, 'testsGridMode') ?? 'excel',
  )
  const setGridMode = (m: 'excel' | 'compact') => {
    setGridModeState(m)
    writePref(projectId, 'testsGridMode', m)
  }

  // Template Excel chuẩn doanh nghiệp
  const [templatePreset, setTemplatePresetState] = useState<ExcelTemplatePreset>(
    () => readPref<ExcelTemplatePreset>(projectId, 'testsExcelPreset') ?? 'CMMI_FULL',
  )
  const setTemplatePreset = (p: ExcelTemplatePreset) => {
    setTemplatePresetState(p)
    writePref(projectId, 'testsExcelPreset', p)
  }

  // Sheet / Module Tab đang chọn ('ALL' = Tất cả phân hệ, hoặc tên moduleName)
  const [activeSheet, setActiveSheet] = useState<string>('ALL')
  // Chế độ ẩn/hiện cây thư mục bên trái để mở rộng toàn màn hình cho bảng Excel 14 cột
  const [showSidebar, setShowSidebar] = useState<boolean>(true)
  // Tìm kiếm nhanh trên thanh công cụ Excel
  const [searchQ, setSearchQ] = useState('')
  // Chọn nhiều dòng để Bulk Approve
  const [selectedTcIds, setSelectedTcIds] = useState<number[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [aiGenReqValue, setAiGenReqValue] = useState<string>('')
  const [aiGenBusy, setAiGenBusy] = useState(false)

  // State cho dòng "+ Quick Add Excel Row" ở cuối bảng
  const [quickModule, setQuickModule] = useState<string>('Payment & VietQR')
  const [quickReqVal, setQuickReqVal] = useState<string>('')
  const [quickType, setQuickType] = useState<TestType>('FUNCTIONAL')
  const [quickPriority, setQuickPriority] = useState<TestPriority>('HIGH')
  const [quickTitle, setQuickTitle] = useState<string>('')
  const [quickTestData, setQuickTestData] = useState<string>('')
  const [quickExpected, setQuickExpected] = useState<string>('')
  const [quickBusy, setQuickBusy] = useState<boolean>(false)

  // Inline cell editing state: { tcId, field, value }
  const [editingCell, setEditingCell] = useState<{
    tcId: number
    field: 'title' | 'moduleName' | 'testData' | 'expectedSummary' | 'actualResult'
    value: string
  } | null>(null)

  const [openTc, setOpenTc] = useState<number | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)
  const reqs = useReqOptions(projectId)

  // Gán mặc định REQ đầu tiên cho Quick Add Row và AI Generator khi danh sách REQ tải xong
  useEffect(() => {
    if (reqs && reqs.length > 0) {
      const firstVal = `${reqs[0].documentId}:${reqs[0].reqUid}`
      if (!quickReqVal) setQuickReqVal(firstVal)
      if (!aiGenReqValue) setAiGenReqValue(firstVal)
    }
  }, [reqs, quickReqVal, aiGenReqValue])

  const selectedId = params.get('node') ?? readPref<string>(projectId, 'repoNode') ?? 'ALL_NODES'
  const node = selectedId === 'ALL_NODES' ? null : (tree.find((n) => n.id === selectedId) ?? null)
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

  const nodeFilteredCases = useMemo(
    () =>
      cases.filter(
        (tc) =>
          inNode(tc) &&
          (!chips.includes('mine') || tc.issues.some((i) => myIssueIds.has(i.issueId))) &&
          (!chips.includes('review') || tc.needsReview),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases, node?.id, chips, myIssueIds],
  )

  // Danh sách các Sheet / Module động từ dữ liệu thật
  const moduleSheets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tc of nodeFilteredCases) {
      const mod = tc.moduleName || 'Core System'
      counts.set(mod, (counts.get(mod) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
  }, [nodeFilteredCases])

  const needle = searchQ.trim().toLocaleLowerCase('vi')
  const list = useMemo(
    () =>
      nodeFilteredCases.filter((tc) => {
        if (activeSheet !== 'ALL' && (tc.moduleName || 'Core System') !== activeSheet) return false
        if (!needle) return true
        const hay = [
          tc.key,
          tc.title,
          tc.moduleName,
          tc.testData,
          tc.expectedSummary,
          tc.actualResult,
          ...tc.requirements.map((r) => r.reqKey ?? ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('vi')
        return hay.includes(needle)
      }),
    [nodeFilteredCases, activeSheet, needle],
  )

  const reviewCount = cases.filter((tc) => inNode(tc) && tc.needsReview).length
  const approvedCount = list.filter((tc) => tc.approvalStatus === 'APPROVED' && !tc.needsReview).length
  const passCount = list.filter((tc) => tc.lastResult === 'PASS').length
  const failCount = list.filter((tc) => tc.lastResult === 'FAIL').length

  // REQ đang chọn: tiêu chí nghiệm thu chưa có testcase (so tiêu đề) → "+ Tạo" / "Để AI đề xuất".
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

  // Xuất file Excel (.csv UTF-8 BOM) theo đúng các cột của Template đang chọn
  const handleExportExcelCsv = () => {
    const headers =
      templatePreset === 'CMMI_FULL'
        ? [
            'No.',
            'TC ID',
            'Module / Sheet',
            'REQ ID (RTM)',
            'Sync Status',
            'Test Type',
            'Priority',
            'Environment',
            'Test Case Title',
            'Pre-conditions',
            'Test Steps',
            'Test Data',
            'Expected Result',
            'Actual Result',
            'Approval Status',
            'Run Result',
          ]
        : templatePreset === 'ISTQB_AGILE'
          ? [
              'No.',
              'TC ID',
              'Module / Sheet',
              'REQ ID (RTM)',
              'Test Type',
              'Priority',
              'Test Case Title',
              'Test Steps',
              'Test Data',
              'Expected Result',
              'Run Result',
            ]
          : [
              'No.',
              'TC ID',
              'REQ ID (RTM)',
              'Sync Status',
              'Test Case Title',
              'Expected Result',
              'Actual Result',
              'Approval Status',
              'Run Result',
            ]

    const rowsData = list.map((tc, idx) => {
      const reqKeys = tc.requirements.map((r) => r.reqKey ?? 'Removed').join(', ') || 'Unlinked'
      const syncStatus = tc.needsReview ? 'STALE (Needs Review)' : 'FRESH'
      const stepsFormatted = (tc.steps ?? [])
        .map((s, i) => `${i + 1}. ${s.action}${s.expected ? ` -> ${s.expected}` : ''}`)
        .join(' | ')
      if (templatePreset === 'CMMI_FULL') {
        return [
          idx + 1,
          tc.key,
          tc.moduleName ?? 'Core System',
          reqKeys,
          syncStatus,
          tc.testType ?? tc.type,
          tc.priority,
          tc.environment ?? 'SIT',
          tc.title,
          tc.preconditions ?? '',
          stepsFormatted,
          tc.testData ?? '',
          tc.expectedSummary ?? '',
          tc.actualResult ?? '',
          tc.approvalStatus ?? 'DRAFT',
          tc.lastResult ?? 'NOT_RUN',
        ]
      }
      if (templatePreset === 'ISTQB_AGILE') {
        return [
          idx + 1,
          tc.key,
          tc.moduleName ?? 'Core System',
          reqKeys,
          tc.testType ?? tc.type,
          tc.priority,
          tc.title,
          stepsFormatted,
          tc.testData ?? '',
          tc.expectedSummary ?? '',
          tc.lastResult ?? 'NOT_RUN',
        ]
      }
      return [
        idx + 1,
        tc.key,
        reqKeys,
        syncStatus,
        tc.title,
        tc.expectedSummary ?? '',
        tc.actualResult ?? '',
        tc.approvalStatus ?? 'DRAFT',
        tc.lastResult ?? 'NOT_RUN',
      ]
    })

    const csv =
      '\uFEFF' +
      [headers, ...rowsData]
        .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SSAM_${templatePreset}_TestCases_Project_${projectId}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify(t(`Đã xuất ${list.length} dòng ra file Excel (.csv)`, `Exported ${list.length} rows to Excel (.csv)`))
  }

  // Duyệt hàng loạt (Bulk Approve) để mở khoá cổng nghiệm thu TESTS_APPROVED
  const handleBulkApprove = async (targetIds?: number[]) => {
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedTcIds
    if (!ids.length) return
    setBulkBusy(true)
    try {
      const res = await testApi.bulkApprove(projectId, ids)
      setSelectedTcIds([])
      notify(
        t(
          `Đã phê duyệt ${res.updatedCount} kịch bản kiểm thử (Đồng bộ cổng nghiệm thu TESTS_APPROVED)`,
          `Approved ${res.updatedCount} test cases (Synced with TESTS_APPROVED gate)`,
        ),
      )
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  // AI Tạo nhanh 3 kịch bản (Functional, Boundary, Negative) theo REQ-xx
  const handleAiGenerateByReq = async () => {
    const targetReq =
      reqs?.find((o) => `${o.documentId}:${o.reqUid}` === aiGenReqValue) ??
      (req ? reqs?.find((o) => o.documentId === req.documentId && o.reqUid === req.reqUid) : reqs?.[0])
    if (!targetReq) {
      notify(t('Vui lòng chọn ít nhất 1 REQ để AI sinh kịch bản.', 'Please select a REQ to generate test cases.'), 'error')
      return
    }
    setAiGenBusy(true)
    try {
      const modName = activeSheet !== 'ALL' ? activeSheet : `${targetReq.documentCode} Module`
      const refLink: RequirementRef = { documentId: targetReq.documentId, reqUid: targetReq.reqUid }
      const batch: CreateTestCaseBody[] = [
        {
          title: `[${targetReq.reqKey}] Kiểm tra luồng chính (Happy Path): ${targetReq.title}`,
          type: 'FUNCTIONAL',
          testType: 'FUNCTIONAL',
          priority: 'HIGH',
          moduleName: modName,
          environment: 'SIT',
          approvalStatus: 'APPROVED',
          preconditions: `Người dùng đã xác thực; cấu hình ${targetReq.reqKey} sẵn sàng trên SIT`,
          testData: `reqKey: ${targetReq.reqKey}\nmode: STANDARD_VALID_PAYLOAD`,
          expectedSummary: `Hệ thống thực thi thành công ${targetReq.reqKey} và trả mã 200 OK`,
          steps: [
            {
              action: `Chuẩn bị dữ liệu hợp lệ và kích hoạt chức năng thuộc ${targetReq.reqKey}`,
              expected: `Hệ thống xử lý đúng theo đặc tả: ${targetReq.title}`,
            },
          ],
          requirementRefs: [refLink],
        },
        {
          title: `[${targetReq.reqKey}] Kiểm tra giá trị biên (Boundary Analysis): ${targetReq.title}`,
          type: 'BOUNDARY',
          testType: 'BOUNDARY',
          priority: 'MEDIUM',
          moduleName: modName,
          environment: 'SIT',
          approvalStatus: 'APPROVED',
          preconditions: `Dữ liệu đầu vào thiết lập tại ngưỡng Min / Max của ${targetReq.reqKey}`,
          testData: `reqKey: ${targetReq.reqKey}\nboundary: MIN_MAX_THRESHOLD`,
          expectedSummary: `Chấp nhận giá trị tại biên hợp lệ và từ chối chính xác khi vượt biên ±1`,
          steps: [
            {
              action: `Nhập giá trị tại ngưỡng tối thiểu và tối đa cho phép của ${targetReq.reqKey}`,
              expected: `Hệ thống kiểm tra biên chính xác, không tràn bộ nhớ hoặc làm tròn sai`,
            },
          ],
          requirementRefs: [refLink],
        },
        {
          title: `[${targetReq.reqKey}] Kiểm tra ngoại lệ & dữ liệu không hợp lệ (Negative): ${targetReq.title}`,
          type: 'NEGATIVE',
          testType: 'NEGATIVE',
          priority: 'HIGH',
          moduleName: modName,
          environment: 'SIT',
          approvalStatus: 'APPROVED',
          preconditions: `Hệ thống bật cơ chế bắt lỗi Validation cho ${targetReq.reqKey}`,
          testData: `reqKey: ${targetReq.reqKey}\npayload: NULL_OR_MALFORMED_DATA`,
          expectedSummary: `Từ chối yêu cầu với mã lỗi 400/422 rõ ràng, giữ nguyên tính toàn vẹn dữ liệu`,
          steps: [
            {
              action: `Gửi yêu cầu thiếu trường bắt buộc hoặc sai định dạng tới ${targetReq.reqKey}`,
              expected: `Hệ thống chặn thực thi, hiển thị thông báo lỗi tường minh và rollback an toàn`,
            },
          ],
          requirementRefs: [refLink],
        },
      ]
      await testApi.bulkCreate(projectId, batch)
      notify(
        t(
          `AI đã sinh 3 kịch bản chuẩn (Functional, Boundary, Negative) cho ${targetReq.reqKey}`,
          `AI generated 3 enterprise test cases (Functional, Boundary, Negative) for ${targetReq.reqKey}`,
        ),
      )
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    } finally {
      setAiGenBusy(false)
    }
  }

  // Lưu thay đổi Inline Edit trên ô
  const saveInlineField = async (tc: TestCaseSummaryDto, patch: UpdateTestCaseBody) => {
    try {
      await testApi.update(tc.testCaseId, patch)
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    }
  }

  const commitEditingCell = async () => {
    if (!editingCell) return
    const { tcId, field, value } = editingCell
    setEditingCell(null)
    const tc = cases.find((x) => x.testCaseId === tcId)
    if (!tc) return
    const trimmed = value.trim()
    if (field === 'title' && (!trimmed || trimmed === tc.title)) return
    if (field === 'moduleName' && trimmed === (tc.moduleName ?? '')) return
    if (field === 'testData' && trimmed === (tc.testData ?? '')) return
    if (field === 'expectedSummary' && trimmed === (tc.expectedSummary ?? '')) return
    if (field === 'actualResult' && trimmed === (tc.actualResult ?? '')) return
    await saveInlineField(tc, { [field]: trimmed })
  }

  // Tạo nhanh 1 dòng từ "+ Quick Add Excel Row" cuối bảng
  const handleQuickAddRow = async () => {
    if (!quickTitle.trim()) {
      notify(t('Vui lòng nhập tiêu đề kịch bản kiểm thử.', 'Please enter a test case title.'), 'error')
      return
    }
    const pickedReq = reqs?.find((o) => `${o.documentId}:${o.reqUid}` === quickReqVal)
    if (!pickedReq) {
      notify(
        t(
          'Quy tắc GB-02: Bắt buộc chọn 1 Requirement (REQ-xx) trước khi thêm dòng Test Case.',
          'Rule GB-02: You must select a Requirement (REQ-xx) before adding a test case row.',
        ),
        'error',
      )
      return
    }
    setQuickBusy(true)
    try {
      const mod = activeSheet !== 'ALL' ? activeSheet : quickModule.trim() || 'Payment & VietQR'
      const exp = quickExpected.trim() || t('Hệ thống xử lý đúng theo đặc tả', 'System behaves as specified')
      await testApi.create(projectId, {
        title: quickTitle.trim(),
        type: quickType,
        testType: quickType,
        priority: quickPriority,
        moduleName: mod,
        environment: 'SIT',
        approvalStatus: 'APPROVED',
        testData: quickTestData.trim() || `req: ${pickedReq.reqKey}\nenv: SIT`,
        expectedSummary: exp,
        steps: [{ action: quickTitle.trim(), expected: exp }],
        requirementRefs: [{ documentId: pickedReq.documentId, reqUid: pickedReq.reqUid }],
      })
      setQuickTitle('')
      setQuickTestData('')
      setQuickExpected('')
      notify(t(`Đã thêm nhanh kịch bản vào sheet ${mod}`, `Added test case row to ${mod}`))
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    } finally {
      setQuickBusy(false)
    }
  }

  // Log Bug nhanh từ dòng có kết quả FAIL sang bảng Kanban
  const handleQuickLogBug = async (tc: TestCaseSummaryDto) => {
    try {
      const reqRefs: RequirementRef[] = tc.requirements.map((r) => ({
        documentId: r.documentId,
        reqUid: r.reqUid,
      }))
      const createdBug = await issueApi.create(projectId, {
        type: 'BUG',
        priority: 'HIGH',
        title: `[Defect ${tc.key}] ${tc.title}`,
        description: `${t('Phát hiện lỗi từ kịch bản kiểm thử', 'Defect logged from test case')} ${tc.key} (${tc.moduleName ?? 'SIT'}).\n- Test Data: ${tc.testData ?? 'N/A'}\n- Expected: ${tc.expectedSummary ?? 'N/A'}\n- Actual: ${tc.actualResult || t('Không đạt kết quả mong đợi', 'Failed expected outcome')}`,
        requirementRefs: reqRefs,
      })
      await testApi.update(tc.testCaseId, {
        issueIds: [...tc.issues.map((i) => i.issueId), createdBug.issueId],
        linkedBugId: createdBug.key,
      })
      notify(t(`Đã tạo Bug ${createdBug.key} trên bảng Kanban và liên kết với ${tc.key}`, `Created Bug ${createdBug.key} on Kanban and linked to ${tc.key}`))
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    }
  }

  const allVisibleSelected = list.length > 0 && list.every((tc) => selectedTcIds.includes(tc.testCaseId))
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedTcIds([])
    } else {
      setSelectedTcIds(list.map((tc) => tc.testCaseId))
    }
  }

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
    <div
      className={clsx(
        'overflow-hidden rounded-card border border-gray-200 bg-white',
        showSidebar ? 'lg:grid lg:grid-cols-[250px_minmax(0,1fr)]' : 'block',
      )}
    >
      {showSidebar && (
        <nav
          aria-label={t('Cây testcase', 'Test tree')}
          className="hidden space-y-0.5 border-r border-gray-200 bg-gray-50 p-2 lg:block"
        >
          <button
            type="button"
            onClick={() => select('ALL_NODES')}
            className={clsx(
              'flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-left text-[13px]',
              !node
                ? 'bg-white font-semibold text-gray-950 shadow-xs ring-1 ring-gray-200'
                : 'font-medium text-gray-700 hover:bg-gray-200/50',
            )}
          >
            <span>{t('Tất cả kịch bản (All REQs)', 'All Test Cases')}</span>
            <span className="text-xs tabular-nums text-gray-400">{cases.length}</span>
          </button>
          {docs.map((d) => (
            <div key={d.id} className="pb-1">
              <button
                type="button"
                onClick={() => select(d.id)}
                className={clsx(
                  'block w-full truncate rounded-[7px] px-2 pb-1 pt-2.5 text-left text-xs',
                  node?.id === d.id ? 'font-semibold text-gray-950' : 'text-gray-500 hover:text-gray-800',
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
      )}

      <div className="min-w-0">
        {/* Thanh công cụ Enterprise Excel */}
        <div className="border-b border-gray-200 bg-gray-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSidebar((v) => !v)}
              className="hidden h-8 items-center gap-1.5 rounded-control border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 lg:inline-flex"
              title={t('Ẩn/hiện cây yêu cầu bên trái để mở rộng bảng Excel', 'Toggle requirement tree sidebar')}
            >
              <LayersIcon className="h-3.5 w-3.5 text-gray-500" />
              {showSidebar ? t('Mở rộng bảng', 'Expand Grid') : t('Hiện cây REQ', 'Show REQ Tree')}
            </button>

            <div className="inline-flex rounded-control border border-gray-300 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setGridMode('excel')}
                className={clsx(
                  ' rounded-[5px] px-2.5 py-1 font-medium transition-colors',
                  gridMode === 'excel' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                {t('Excel Spreadsheet', 'Excel Spreadsheet')}
              </button>
              <button
                type="button"
                onClick={() => setGridMode('compact')}
                className={clsx(
                  'rounded-[5px] px-2.5 py-1 font-medium transition-colors',
                  gridMode === 'compact' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-700 hover:bg-gray-100',
                )}
              >
                {t('Danh sách gọn', 'Compact List')}
              </button>
            </div>

            {gridMode === 'excel' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-500">{t('Mẫu cột:', 'Template:')}</span>
                <select
                  value={templatePreset}
                  onChange={(e) => setTemplatePreset(e.target.value as ExcelTemplatePreset)}
                  aria-label={t('Mẫu cột Excel', 'Excel column template')}
                  className="h-8 rounded-control border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-800 focus:border-brand-400 focus:outline-none"
                >
                  <option value="CMMI_FULL">{t('CMMI / Enterprise Full (14 cột)', 'CMMI / Enterprise Full (14 cols)')}</option>
                  <option value="ISTQB_AGILE">{t('ISTQB / Agile Functional (10 cột)', 'ISTQB / Agile Functional (10 cols)')}</option>
                  <option value="UAT_SIGNOFF">{t('UAT Sign-off & Traceability (9 cột)', 'UAT Sign-off & Traceability (9 cols)')}</option>
                </select>
              </div>
            )}

            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={t('Tìm theo mã TC, tiêu đề, REQ, Test Data…', 'Search by TC key, title, REQ, Test Data…')}
              className="h-8 w-48 rounded-control border border-gray-300 bg-white px-2.5 text-xs placeholder:text-gray-400 focus:border-brand-400 focus:outline-none sm:w-60"
            />

            <span className="flex-1" />

            <Button inline variant="secondary" className="lg:h-8" onClick={handleExportExcelCsv}>
              <ArrowUpRightIcon className="h-3.5 w-3.5" />
              {t('Export Excel (.csv)', 'Export Excel (.csv)')}
            </Button>

            {canManage && (
              <Button
                inline
                variant="secondary"
                className="lg:h-8"
                disabled={bulkBusy || list.length === 0}
                onClick={() =>
                  void handleBulkApprove(
                    selectedTcIds.length > 0 ? selectedTcIds : list.map((x) => x.testCaseId),
                  )
                }
              >
                <ListChecksIcon className="h-3.5 w-3.5 text-success-600" />
                {selectedTcIds.length > 0
                  ? t(`Duyệt ${selectedTcIds.length} dòng đã chọn`, `Approve ${selectedTcIds.length} selected`)
                  : t(`Duyệt tất cả (${list.length})`, `Approve all (${list.length})`)}
              </Button>
            )}
          </div>

          {/* Thanh AI Sinh tự động theo REQ + Thống kê nhanh Cổng nghiệm thu */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/80 pt-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-900">
                {node ? node.label : t('Toàn bộ Kho kịch bản kiểm thử', 'All Project Test Cases')}
              </span>
              <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {t(`Đã duyệt: ${approvedCount}/${list.length}`, `Approved: ${approvedCount}/${list.length}`)}
              </span>
              <span className="rounded border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700">
                PASS: {passCount}
              </span>
              {failCount > 0 && (
                <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                  FAIL: {failCount}
                </span>
              )}
              {reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <AlertTriangleIcon className="h-3 w-3" />
                  {t(`${reviewCount} Stale cần xem lại`, `${reviewCount} Stale to review`)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {canAi && reqs && reqs.length > 0 && (
                <div className="inline-flex items-center gap-1 rounded-control border border-brand-200 bg-white p-0.5 pl-2">
                  <SparklesIcon className="h-3.5 w-3.5 text-brand-600" />
                  <select
                    value={aiGenReqValue}
                    onChange={(e) => setAiGenReqValue(e.target.value)}
                    aria-label={t('Chọn REQ để AI sinh kịch bản', 'Select REQ for AI generation')}
                    className="h-7 max-w-[210px] truncate bg-transparent text-xs font-medium text-gray-800 focus:outline-none"
                  >
                    {reqs.map((o) => (
                      <option key={`${o.documentId}:${o.reqUid}`} value={`${o.documentId}:${o.reqUid}`}>
                        {o.reqKey} · {o.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={aiGenBusy}
                    onClick={() => void handleAiGenerateByReq()}
                    className="rounded-[5px] bg-brand-50 px-2 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                  >
                    {aiGenBusy ? t('Đang sinh…', 'Generating…') : t('AI Sinh 3 TC chuẩn', 'AI Generate 3 TCs')}
                  </button>
                </div>
              )}

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
                {t('Cần xem lại (Stale)', 'To review (Stale)')}
              </FilterChip>
            </div>
          </div>
        </div>

        {/* Thanh Sheet / Module Tabs giống Microsoft Excel */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-gray-100/80 px-3 pt-1.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveSheet('ALL')}
            className={clsx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-t-[7px] border border-b-0 px-3 py-1.5 font-medium transition-colors',
              activeSheet === 'ALL'
                ? 'border-gray-300 bg-white text-brand-700 shadow-2xs'
                : 'border-transparent text-gray-600 hover:bg-gray-200/60 hover:text-gray-900',
            )}
          >
            <span>{t('Tất cả Sheets', 'All Sheets')}</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10.5px] font-semibold text-gray-600">
              {nodeFilteredCases.length}
            </span>
          </button>
          {moduleSheets.map((sh) => (
            <button
              key={sh.name}
              type="button"
              onClick={() => setActiveSheet(sh.name)}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-t-[7px] border border-b-0 px-3 py-1.5 font-medium transition-colors',
                activeSheet === sh.name
                  ? 'border-gray-300 bg-white text-brand-700 shadow-2xs'
                  : 'border-transparent text-gray-600 hover:bg-gray-200/60 hover:text-gray-900',
              )}
            >
              <span>{sh.name}</span>
              <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10.5px] font-semibold text-gray-600">
                {sh.count}
              </span>
            </button>
          ))}
        </div>

        {/* Nội dung chính: Chế độ Excel Spreadsheet Grid hoặc Compact List */}
        {gridMode === 'excel' ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="bg-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                  <th className="w-9 border-b border-r border-gray-200 px-2.5 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label={t('Chọn tất cả kịch bản', 'Select all test cases')}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
                    />
                  </th>
                  <th className="w-10 border-b border-r border-gray-200 px-2 py-2 text-center">#</th>
                  <th className="w-24 border-b border-r border-gray-200 px-2.5 py-2">TC ID</th>
                  {templatePreset !== 'UAT_SIGNOFF' && (
                    <th className="w-40 border-b border-r border-gray-200 px-2.5 py-2">Module / Sheet</th>
                  )}
                  <th className="w-36 border-b border-r border-gray-200 px-2.5 py-2">REQ ID (RTM)</th>
                  {templatePreset !== 'ISTQB_AGILE' && (
                    <th className="w-36 border-b border-r border-gray-200 px-2.5 py-2">Sync / Stale</th>
                  )}
                  {templatePreset !== 'UAT_SIGNOFF' && (
                    <>
                      <th className="w-32 border-b border-r border-gray-200 px-2.5 py-2">{t('Loại test', 'Test Type')}</th>
                      <th className="w-24 border-b border-r border-gray-200 px-2.5 py-2">{t('Ưu tiên', 'Priority')}</th>
                    </>
                  )}
                  <th className="min-w-[220px] border-b border-r border-gray-200 px-2.5 py-2">
                    {t('Tên kịch bản (Test Case Title)', 'Test Case Title')}
                  </th>
                  {templatePreset === 'CMMI_FULL' && (
                    <th className="w-48 border-b border-r border-gray-200 px-2.5 py-2">Pre-conditions</th>
                  )}
                  {templatePreset !== 'UAT_SIGNOFF' && (
                    <>
                      <th className="w-60 border-b border-r border-gray-200 px-2.5 py-2">Test Steps</th>
                      <th className="w-48 border-b border-r border-gray-200 px-2.5 py-2">Test Data</th>
                    </>
                  )}
                  <th className="w-52 border-b border-r border-gray-200 px-2.5 py-2">Expected Result</th>
                  {templatePreset !== 'ISTQB_AGILE' && (
                    <>
                      <th className="w-48 border-b border-r border-gray-200 px-2.5 py-2">Actual Result</th>
                      <th className="w-32 border-b border-r border-gray-200 px-2.5 py-2">Approval</th>
                    </>
                  )}
                  <th className="w-36 border-b border-gray-200 px-2.5 py-2">Run Result</th>
                </tr>
              </thead>
              <tbody>
                {list.map((tc, rowIndex) => {
                  const isSelected = selectedTcIds.includes(tc.testCaseId)
                  return (
                    <tr
                      key={tc.testCaseId}
                      className={clsx(
                        'group transition-colors',
                        tc.needsReview
                          ? 'bg-amber-50/40 hover:bg-amber-50/80'
                          : isSelected
                            ? 'bg-brand-50/40'
                            : 'bg-white hover:bg-gray-50/90',
                      )}
                    >
                      {/* Checkbox */}
                      <td className="border-b border-r border-gray-200 px-2.5 py-2 text-center align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            setSelectedTcIds((prev) =>
                              prev.includes(tc.testCaseId)
                                ? prev.filter((id) => id !== tc.testCaseId)
                                : [...prev, tc.testCaseId],
                            )
                          }
                          aria-label={tc.key}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
                        />
                      </td>

                      {/* Row No. */}
                      <td className="border-b border-r border-gray-200 bg-gray-50/60 px-2 py-2 text-center align-top font-mono text-[11px] text-gray-400">
                        {rowIndex + 1}
                      </td>

                      {/* TC ID */}
                      <td className="border-b border-r border-gray-200 px-2.5 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => setOpenTc(tc.testCaseId)}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                        >
                          {tc.key}
                        </button>
                        {tc.environment && (
                          <span className="ml-1 rounded bg-gray-100 px-1 py-px text-[10px] font-medium text-gray-500">
                            {tc.environment}
                          </span>
                        )}
                      </td>

                      {/* Module / Sheet */}
                      {templatePreset !== 'UAT_SIGNOFF' && (
                        <td
                          className="border-b border-r border-gray-200 px-2 py-1.5 align-top"
                          onClick={() =>
                            canManage &&
                            setEditingCell({
                              tcId: tc.testCaseId,
                              field: 'moduleName',
                              value: tc.moduleName ?? '',
                            })
                          }
                        >
                          {editingCell?.tcId === tc.testCaseId && editingCell.field === 'moduleName' ? (
                            <input
                              autoFocus
                              list="tc-enterprise-modules"
                              value={editingCell.value}
                              onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                              onBlur={() => void commitEditingCell()}
                              onKeyDown={(e) => e.key === 'Enter' && void commitEditingCell()}
                              className="h-7 w-full rounded border border-brand-400 bg-white px-1.5 text-xs focus:outline-none"
                            />
                          ) : (
                            <span className="inline-block cursor-pointer rounded bg-gray-100 px-1.5 py-0.5 text-[11.5px] font-medium text-gray-700 hover:bg-gray-200">
                              {tc.moduleName ?? 'Core System'}
                            </span>
                          )}
                        </td>
                      )}

                      {/* REQ ID (RTM) */}
                      <td className="border-b border-r border-gray-200 px-2.5 py-2 align-top">
                        {tc.requirements.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tc.requirements.map((r) => (
                              <ReqChip key={r.reqUid} req={r} short />
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                            <AlertTriangleIcon className="h-3 w-3" />
                            {t('Thiếu REQ (GB-02)', 'Missing REQ')}
                          </span>
                        )}
                      </td>

                      {/* Sync / Stale */}
                      {templatePreset !== 'ISTQB_AGILE' && (
                        <td className="border-b border-r border-gray-200 px-2 py-2 align-top">
                          {tc.needsReview ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100/80 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                                <AlertTriangleIcon className="h-3 w-3" />
                                {t('Stale · REQ đổi', 'Stale · REQ changed')}
                              </span>
                              {canManage && (
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await testApi.aiRefreshStale(projectId, tc.testCaseId)
                                        notify(t(`Đã đồng bộ AI ${tc.key} theo REQ mới`, `AI-synced ${tc.key}`))
                                      } catch (err) {
                                        notify(apiErrorMessage(err), 'error')
                                      }
                                    }}
                                    className="inline-flex items-center gap-0.5 rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-700 hover:bg-brand-50"
                                  >
                                    <SyncIcon className="h-2.5 w-2.5" />
                                    AI Sync
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void saveInlineField(tc, { needsReview: false, approvalStatus: 'APPROVED' })
                                    }
                                    className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-gray-700 hover:bg-gray-100"
                                  >
                                    Fresh
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded border border-success-200 bg-success-50 px-1.5 py-0.5 text-[11px] font-medium text-success-700">
                              <CheckIcon className="h-3 w-3" />
                              Fresh
                            </span>
                          )}
                        </td>
                      )}

                      {/* Test Type & Priority */}
                      {templatePreset !== 'UAT_SIGNOFF' && (
                        <>
                          <td className="border-b border-r border-gray-200 px-2 py-1.5 align-top">
                            {canManage ? (
                              <select
                                value={tc.testType ?? tc.type}
                                onChange={(e) =>
                                  void saveInlineField(tc, {
                                    type: e.target.value as TestType,
                                    testType: e.target.value as TestType,
                                  })
                                }
                                aria-label={t('Loại test', 'Test type')}
                                className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-xs font-medium text-gray-800 hover:border-gray-300 focus:border-brand-400 focus:bg-white focus:outline-none"
                              >
                                {TEST_TYPES.map((tType) => (
                                  <option key={tType} value={tType}>
                                    {testTypeLabel(tType)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-700">{testTypeLabel(tc.testType ?? tc.type)}</span>
                            )}
                          </td>
                          <td className="border-b border-r border-gray-200 px-2 py-1.5 align-top">
                            {canManage ? (
                              <select
                                value={tc.priority}
                                onChange={(e) =>
                                  void saveInlineField(tc, { priority: e.target.value as TestPriority })
                                }
                                aria-label={t('Độ ưu tiên', 'Priority')}
                                className={clsx(
                                  'h-7 w-full rounded border border-transparent bg-transparent px-1 text-xs font-bold hover:border-gray-300 focus:border-brand-400 focus:bg-white focus:outline-none',
                                  tc.priority === 'HIGH'
                                    ? 'text-red-700'
                                    : tc.priority === 'MEDIUM'
                                      ? 'text-amber-700'
                                      : 'text-gray-500',
                                )}
                              >
                                {TEST_PRIORITIES.map((p) => (
                                  <option key={p} value={p}>
                                    {testPriorityLabel(p, t)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs font-bold">{testPriorityLabel(tc.priority, t)}</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Test Case Title */}
                      <td
                        className="border-b border-r border-gray-200 px-2.5 py-2 align-top"
                        onDoubleClick={() =>
                          canManage &&
                          setEditingCell({ tcId: tc.testCaseId, field: 'title', value: tc.title })
                        }
                      >
                        {editingCell?.tcId === tc.testCaseId && editingCell.field === 'title' ? (
                          <input
                            autoFocus
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={() => void commitEditingCell()}
                            onKeyDown={(e) => e.key === 'Enter' && void commitEditingCell()}
                            className="h-7 w-full rounded border border-brand-400 bg-white px-2 text-xs font-medium focus:outline-none"
                          />
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={() => setOpenTc(tc.testCaseId)}
                              className="text-left font-medium text-gray-950 hover:text-brand-700"
                            >
                              {tc.title}
                            </button>
                            {tc.issues.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {tc.issues.map((iss) => (
                                  <CodeChip key={iss.issueId}>{iss.key}</CodeChip>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Pre-conditions */}
                      {templatePreset === 'CMMI_FULL' && (
                        <td className="border-b border-r border-gray-200 px-2.5 py-2 align-top text-xs text-gray-600">
                          <p className="line-clamp-3 whitespace-pre-wrap">{tc.preconditions || '—'}</p>
                        </td>
                      )}

                      {/* Test Steps & Test Data */}
                      {templatePreset !== 'UAT_SIGNOFF' && (
                        <>
                          <td className="border-b border-r border-gray-200 px-2.5 py-2 align-top text-xs text-gray-700">
                            <ol className="space-y-0.5">
                              {(tc.steps ?? []).slice(0, 3).map((s, idx) => (
                                <li key={idx} className="line-clamp-2">
                                  <span className="font-mono text-[11px] text-gray-400">{idx + 1}.</span> {s.action}
                                </li>
                              ))}
                              {(tc.steps?.length ?? 0) > 3 && (
                                <li className="text-[11px] text-gray-400">
                                  +{(tc.steps?.length ?? 0) - 3} {t('bước nữa…', 'more steps…')}
                                </li>
                              )}
                            </ol>
                          </td>
                          <td
                            className="border-b border-r border-gray-200 px-2.5 py-2 align-top font-mono text-[11px] text-gray-700"
                            onClick={() =>
                              canManage &&
                              setEditingCell({
                                tcId: tc.testCaseId,
                                field: 'testData',
                                value: tc.testData ?? '',
                              })
                            }
                          >
                            {editingCell?.tcId === tc.testCaseId && editingCell.field === 'testData' ? (
                              <textarea
                                autoFocus
                                rows={2}
                                value={editingCell.value}
                                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                onBlur={() => void commitEditingCell()}
                                className="w-full rounded border border-brand-400 bg-white p-1 font-mono text-[11px] focus:outline-none"
                              />
                            ) : (
                              <pre className="line-clamp-3 cursor-pointer whitespace-pre-wrap font-mono text-[11px] text-gray-700 hover:text-gray-950">
                                {tc.testData || '—'}
                              </pre>
                            )}
                          </td>
                        </>
                      )}

                      {/* Expected Result */}
                      <td
                        className="border-b border-r border-gray-200 px-2.5 py-2 align-top text-xs text-gray-800"
                        onClick={() =>
                          canManage &&
                          setEditingCell({
                            tcId: tc.testCaseId,
                            field: 'expectedSummary',
                            value: tc.expectedSummary ?? '',
                          })
                        }
                      >
                        {editingCell?.tcId === tc.testCaseId && editingCell.field === 'expectedSummary' ? (
                          <textarea
                            autoFocus
                            rows={2}
                            value={editingCell.value}
                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                            onBlur={() => void commitEditingCell()}
                            className="w-full rounded border border-brand-400 bg-white p-1 text-xs focus:outline-none"
                          />
                        ) : (
                          <p className="line-clamp-3 cursor-pointer whitespace-pre-wrap hover:text-brand-700">
                            {tc.expectedSummary || '—'}
                          </p>
                        )}
                      </td>

                      {/* Actual Result & Approval Status */}
                      {templatePreset !== 'ISTQB_AGILE' && (
                        <>
                          <td
                            className="border-b border-r border-gray-200 px-2.5 py-2 align-top text-xs text-gray-700"
                            onClick={() =>
                              (canManage || canExecute) &&
                              setEditingCell({
                                tcId: tc.testCaseId,
                                field: 'actualResult',
                                value: tc.actualResult ?? '',
                              })
                            }
                          >
                            {editingCell?.tcId === tc.testCaseId && editingCell.field === 'actualResult' ? (
                              <textarea
                                autoFocus
                                rows={2}
                                value={editingCell.value}
                                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                onBlur={() => void commitEditingCell()}
                                className="w-full rounded border border-brand-400 bg-white p-1 text-xs focus:outline-none"
                              />
                            ) : (
                              <p className="line-clamp-3 cursor-pointer whitespace-pre-wrap text-gray-600 hover:text-gray-950">
                                {tc.actualResult || (
                                  <span className="italic text-gray-400">
                                    {t('Click để nhập KQ thực tế…', 'Click to enter actual…')}
                                  </span>
                                )}
                              </p>
                            )}
                          </td>
                          <td className="border-b border-r border-gray-200 px-2 py-1.5 align-top">
                            {canManage ? (
                              <select
                                value={tc.approvalStatus ?? 'DRAFT'}
                                onChange={(e) =>
                                  void saveInlineField(tc, {
                                    approvalStatus: e.target.value as TestApprovalStatus,
                                  })
                                }
                                aria-label={t('Trạng thái phê duyệt', 'Approval status')}
                                className={clsx(
                                  'h-7 w-full rounded border px-1.5 text-[11px] font-semibold focus:outline-none',
                                  tc.approvalStatus === 'APPROVED'
                                    ? 'border-success-200 bg-success-50 text-success-700'
                                    : tc.approvalStatus === 'IN_REVIEW'
                                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                                      : 'border-gray-200 bg-gray-100 text-gray-600',
                                )}
                              >
                                {TEST_APPROVAL_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {testApprovalLabel(st, t)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs font-medium">{testApprovalLabel(tc.approvalStatus, t)}</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Run Result + Quick Log Bug */}
                      <td className="border-b border-gray-200 px-2 py-1.5 align-top">
                        <div className="space-y-1">
                          {canManage || canExecute ? (
                            <select
                              value={tc.lastResult ?? 'NOT_RUN'}
                              onChange={(e) =>
                                void saveInlineField(tc, {
                                  lastResult: e.target.value as RunResult,
                                })
                              }
                              aria-label={t('Kết quả chạy', 'Run result')}
                              className={clsx(
                                'h-7 w-full rounded border px-1.5 text-[11.5px] font-semibold focus:outline-none',
                                tc.lastResult === 'PASS'
                                  ? 'border-success-200 bg-success-50 text-success-700'
                                  : tc.lastResult === 'FAIL'
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : tc.lastResult === 'BLOCKED'
                                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                                      : 'border-gray-300 bg-white text-gray-700',
                              )}
                            >
                              {RUN_RESULTS.map((r) => (
                                <option key={r} value={r}>
                                  {resultLabel(r)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <ResultPill result={tc.lastResult} />
                          )}
                          {tc.lastResult === 'FAIL' && canManage && (
                            <button
                              type="button"
                              onClick={() => void handleQuickLogBug(tc)}
                              className="inline-flex w-full items-center justify-center gap-1 rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-red-700 hover:bg-red-50"
                            >
                              + Log Bug Kanban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {/* Dòng thêm nhanh (+ Quick Add Excel Row) chuẩn Spreadsheet */}
                {canManage && (
                  <tr className="bg-brand-50/30">
                    <td className="border-b border-r border-gray-200 px-2 py-2 text-center text-xs font-bold text-brand-700">
                      +
                    </td>
                    <td className="border-b border-r border-gray-200 px-2 py-2 text-center font-mono text-[11px] text-gray-400">
                      New
                    </td>
                    <td className="border-b border-r border-gray-200 px-2.5 py-2 font-mono text-xs text-gray-400">
                      Auto TC
                    </td>
                    {templatePreset !== 'UAT_SIGNOFF' && (
                      <td className="border-b border-r border-gray-200 px-2 py-1.5">
                        <input
                          list="tc-enterprise-modules"
                          value={activeSheet !== 'ALL' ? activeSheet : quickModule}
                          onChange={(e) => setQuickModule(e.target.value)}
                          placeholder="Module / Sheet"
                          className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs focus:border-brand-400 focus:outline-none"
                        />
                        <datalist id="tc-enterprise-modules">
                          {ENTERPRISE_MODULES.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </td>
                    )}
                    <td className="border-b border-r border-gray-200 px-2 py-1.5">
                      <select
                        value={quickReqVal}
                        onChange={(e) => setQuickReqVal(e.target.value)}
                        aria-label={t('Chọn REQ bắt buộc GB-02', 'Select mandatory REQ GB-02')}
                        className="h-8 w-full rounded border border-brand-300 bg-white px-1.5 text-xs font-medium text-brand-800 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">{t('— Chọn REQ (GB-02) —', '— Select REQ (GB-02) —')}</option>
                        {(reqs ?? []).map((o) => (
                          <option key={`${o.documentId}:${o.reqUid}`} value={`${o.documentId}:${o.reqUid}`}>
                            {o.reqKey} · {o.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    {templatePreset !== 'ISTQB_AGILE' && (
                      <td className="border-b border-r border-gray-200 px-2.5 py-2 text-[11px] text-gray-500">
                        GB-02 Ready
                      </td>
                    )}
                    {templatePreset !== 'UAT_SIGNOFF' && (
                      <>
                        <td className="border-b border-r border-gray-200 px-2 py-1.5">
                          <select
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value as TestType)}
                            aria-label={t('Loại test dòng mới', 'New row test type')}
                            className="h-8 w-full rounded border border-gray-300 bg-white px-1.5 text-xs focus:border-brand-400 focus:outline-none"
                          >
                            {TEST_TYPES.map((tType) => (
                              <option key={tType} value={tType}>
                                {testTypeLabel(tType)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-r border-gray-200 px-2 py-1.5">
                          <select
                            value={quickPriority}
                            onChange={(e) => setQuickPriority(e.target.value as TestPriority)}
                            aria-label={t('Ưu tiên dòng mới', 'New row priority')}
                            className="h-8 w-full rounded border border-gray-300 bg-white px-1.5 text-xs focus:border-brand-400 focus:outline-none"
                          >
                            {TEST_PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {testPriorityLabel(p, t)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </>
                    )}
                    <td className="border-b border-r border-gray-200 px-2 py-1.5">
                      <input
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleQuickAddRow()}
                        placeholder={t('Nhập nhanh tiêu đề kịch bản (Enter để thêm)…', 'Quick add test case title (Enter to save)…')}
                        className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs focus:border-brand-400 focus:outline-none"
                      />
                    </td>
                    {templatePreset === 'CMMI_FULL' && (
                      <td className="border-b border-r border-gray-200 px-2 py-1.5 text-[11px] text-gray-400">
                        Auto SIT Precondition
                      </td>
                    )}
                    {templatePreset !== 'UAT_SIGNOFF' && (
                      <>
                        <td className="border-b border-r border-gray-200 px-2 py-1.5 text-[11px] text-gray-400">
                          Auto from title & expected
                        </td>
                        <td className="border-b border-r border-gray-200 px-2 py-1.5">
                          <input
                            value={quickTestData}
                            onChange={(e) => setQuickTestData(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void handleQuickAddRow()}
                            placeholder="Test Data (VD: amount: 150000)"
                            className="h-8 w-full rounded border border-gray-300 bg-white px-2 font-mono text-xs focus:border-brand-400 focus:outline-none"
                          />
                        </td>
                      </>
                    )}
                    <td className="border-b border-r border-gray-200 px-2 py-1.5">
                      <input
                        value={quickExpected}
                        onChange={(e) => setQuickExpected(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleQuickAddRow()}
                        placeholder={t('Kết quả mong đợi (Expected Result)…', 'Expected Result…')}
                        className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs focus:border-brand-400 focus:outline-none"
                      />
                    </td>
                    <td
                      colSpan={templatePreset === 'ISTQB_AGILE' ? 1 : 3}
                      className="border-b border-gray-200 px-2 py-1.5"
                    >
                      <Button
                        inline
                        className="w-full justify-center lg:h-8"
                        isLoading={quickBusy}
                        onClick={() => void handleQuickAddRow()}
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        {t('Thêm dòng Excel', 'Add Excel Row')}
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Chế độ Danh sách gọn truyền thống (Compact List) */
          <div className="p-4 sm:p-5">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13.5px]">
                <thead>
                  <tr className="text-left text-[12.5px] text-gray-500">
                    {[
                      'Testcase',
                      'Module / Sheet',
                      t('Loại', 'Type'),
                      t('Ưu tiên', 'Priority'),
                      t('Phê duyệt', 'Approval'),
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
                          {tc.requirements.length > 0 && (
                            <span> · {tc.requirements.map((r) => r.reqKey ?? '?').join(', ')}</span>
                          )}
                        </p>
                      </td>
                      <td className="border-b border-gray-200 px-3 py-2.5 text-xs text-gray-600">
                        {tc.moduleName ?? 'Core System'}
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
                        <span
                          className={clsx(
                            'rounded border px-2 py-0.5 text-[11px] font-semibold',
                            tc.approvalStatus === 'APPROVED'
                              ? 'border-success-200 bg-success-50 text-success-700'
                              : tc.approvalStatus === 'IN_REVIEW'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-gray-200 bg-gray-100 text-gray-600',
                          )}
                        >
                          {testApprovalLabel(tc.approvalStatus, t)}
                        </span>
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
                      <td colSpan={7} className="border-b border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
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
                            {' · '}
                            <button
                              type="button"
                              className="font-medium text-brand-700 hover:underline"
                              onClick={onOpenImport}
                            >
                              {t('Import từ Excel', 'Import from Excel')}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {missing.slice(0, 3).map((c) => (
                    <tr key={c}>
                      <td colSpan={7} className="border-b border-gray-200 px-3 py-2.5 text-[13px] text-gray-500">
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
                              {t('Để AI đề xuất', 'Let AI propose')}
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
        )}
      </div>

      {openTc !== null && (
        <TestCaseDrawer
          projectId={projectId}
          testCaseId={openTc}
          onClose={() => setOpenTc(null)}
          onEdit={onEdit}
          notify={notify}
        />
      )}
    </div>
  )
}
