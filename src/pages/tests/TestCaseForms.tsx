import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import {
  AlertTriangleIcon,
  CheckIcon,
  CloseIcon,
  DocumentIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@/components/ui/icons'
import { apiErrorMessage } from '@/lib/apiErrors'
import { ApiError } from '@/lib/apiClient'
import { onDataChanged } from '@/lib/dataEvents'
import { useI18n } from '@/i18n'
import type { IssueSummaryDto, RequirementRef } from '@/types/issue'
import {
  TEST_APPROVAL_STATUSES,
  TEST_ENVIRONMENTS,
  TEST_PRIORITIES,
  TEST_TYPES,
  type CreateTestCaseBody,
  type SuggestedTestCase,
  type TestApprovalStatus,
  type TestCaseDetailDto,
  type TestEnvironment,
  type TestPriority,
  type TestStep,
  type TestType,
} from '@/types/testing'
import { ReqPicker, useReqOptions, type ReqOption } from '../kanban/ReqPicker'
import { CodeChip, PersonDot, ReqChip, ResultPill, shortDate, testTypeLabel } from '../kanban/workUi'

export const testPriorityLabel = (p: TestPriority, t: (vi: string, en: string) => string) =>
  ({ HIGH: t('Cao', 'High'), MEDIUM: t('TB', 'Medium'), LOW: t('Thấp', 'Low') })[p]

export const testApprovalLabel = (s: TestApprovalStatus | undefined, t: (vi: string, en: string) => string) =>
  ({
    DRAFT: t('Bản nháp', 'Draft'),
    IN_REVIEW: t('Chờ duyệt', 'In review'),
    APPROVED: t('Đã duyệt', 'Approved'),
  })[s ?? 'DRAFT']

export const ENTERPRISE_MODULES = [
  'Authentication & SSO',
  'Payment & VietQR',
  'Webhook & Banking Gateway',
  'Reconciliation & Audit',
  'Document & Baseline',
  'Kanban & Workflow',
  'General Regression',
]

export interface TestCaseDraft {
  title?: string
  type?: TestType
  priority?: TestPriority
  preconditions?: string
  steps?: TestStep[]
  folderId?: number | null
  requirementRefs?: RequirementRef[]
  issueIds?: number[]
  moduleName?: string
  testData?: string
  expectedSummary?: string
  actualResult?: string
  environment?: TestEnvironment
  approvalStatus?: TestApprovalStatus
}

/** Tạo / sửa testcase: bước (hành động / mong đợi), REQ, thư mục, issue liên kết. */
export function TestCaseModal({
  open,
  projectId,
  editing,
  draft,
  folders,
  issues,
  onClose,
  onSaved,
}: {
  open: boolean
  projectId: number
  editing: TestCaseDetailDto | null
  draft?: TestCaseDraft
  folders: { folderId: number; name: string }[]
  issues: IssueSummaryDto[]
  onClose: () => void
  onSaved: (tc: TestCaseDetailDto) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TestType>('FUNCTIONAL')
  const [priority, setPriority] = useState<TestPriority>('MEDIUM')
  const [moduleName, setModuleName] = useState('Payment & VietQR')
  const [environment, setEnvironment] = useState<TestEnvironment>('SIT')
  const [approvalStatus, setApprovalStatus] = useState<TestApprovalStatus>('DRAFT')
  const [testData, setTestData] = useState('')
  const [expectedSummary, setExpectedSummary] = useState('')
  const [actualResult, setActualResult] = useState('')
  const [pre, setPre] = useState('')
  const [steps, setSteps] = useState<TestStep[]>([{ action: '', expected: '' }])
  const [folderId, setFolderId] = useState('')
  const [refs, setRefs] = useState<RequirementRef[]>([])
  const [issueIds, setIssueIds] = useState<number[]>([])
  const [issueQ, setIssueQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!open) return
    const src = editing ?? draft ?? {}
    setTitle(src.title ?? '')
    setType(src.type ?? 'FUNCTIONAL')
    setPriority(src.priority ?? 'MEDIUM')
    setModuleName(src.moduleName ?? 'Payment & VietQR')
    setEnvironment(src.environment ?? 'SIT')
    setApprovalStatus(src.approvalStatus ?? (editing ? 'APPROVED' : 'DRAFT'))
    setTestData(src.testData ?? '')
    setExpectedSummary(src.expectedSummary ?? '')
    setActualResult(src.actualResult ?? '')
    setPre((editing ? editing.preconditions : draft?.preconditions) ?? '')
    setSteps(src.steps?.length ? src.steps.map((s) => ({ ...s })) : [{ action: '', expected: '' }])
    setFolderId(src.folderId ? String(src.folderId) : '')
    setRefs(
      editing
        ? editing.requirements.map((r) => ({ documentId: r.documentId, reqUid: r.reqUid }))
        : (draft?.requirementRefs ?? []),
    )
    setIssueIds(editing ? editing.issues.map((i) => i.issueId) : (draft?.issueIds ?? []))
    setIssueQ('')
    setError(null)
    setErrors({})
  }, [open, editing, draft])

  const setStep = (i: number, patch: Partial<TestStep>) =>
    setSteps((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const moveStep = (i: number, d: -1 | 1) =>
    setSteps((s) => {
      const j = i + d
      if (j < 0 || j >= s.length) return s
      const next = [...s]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const submit = async () => {
    setBusy(true)
    setError(null)
    setErrors({})
    const cleanedSteps = steps.filter((s) => s.action.trim() || s.expected.trim())
    const finalSteps =
      cleanedSteps.length > 0
        ? cleanedSteps
        : [{ action: title.trim(), expected: expectedSummary.trim() || t('Hệ thống xử lý đúng mong đợi', 'System behaves as expected') }]
    const body: CreateTestCaseBody = {
      title,
      type,
      testType: type,
      priority,
      moduleName: moduleName.trim() || 'Core System',
      environment,
      approvalStatus,
      testData: testData.trim() || undefined,
      expectedSummary:
        expectedSummary.trim() ||
        finalSteps
          .map((s) => s.expected.trim())
          .filter(Boolean)
          .join(' → ') ||
        undefined,
      actualResult: actualResult.trim() || undefined,
      preconditions: pre || null,
      steps: finalSteps,
      folderId: folderId ? Number(folderId) : null,
      requirementRefs: refs,
      issueIds,
    }
    try {
      const saved = editing ? await testApi.update(editing.testCaseId, body) : await testApi.create(projectId, body)
      onSaved(saved)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors)
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const needle = issueQ.trim().toLocaleLowerCase('vi')
  const issueList = issues
    .filter((i) => i.parentId === null && (!needle || `${i.key} ${i.title}`.toLocaleLowerCase('vi').includes(needle)))
    .slice(0, 40)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? t(`Sửa ${editing.key}`, `Edit ${editing.key}`) : t('Tạo testcase', 'Create test case')}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void submit()} isLoading={busy} disabled={!title.trim()}>
            {editing ? t('Lưu', 'Save') : t('Tạo testcase', 'Create test case')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField
          label={t('Tiêu đề', 'Title')}
          name="tc-title"
          value={title}
          maxLength={300}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title?.[0]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900">
              {t('Phân hệ / Sheet (Module)', 'Module / Sheet')}
            </label>
            <input
              list="tc-enterprise-modules"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="VD: Payment & VietQR"
              className="h-10 w-full rounded-control border border-gray-300 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
            <datalist id="tc-enterprise-modules">
              {ENTERPRISE_MODULES.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <SelectField
            label={t('Loại kịch bản (Test Type)', 'Test Type')}
            name="tc-type"
            value={type}
            onChange={(e) => setType(e.target.value as TestType)}
          >
            {TEST_TYPES.map((x) => (
              <option key={x} value={x}>
                {testTypeLabel(x)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('Ưu tiên', 'Priority')}
            name="tc-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TestPriority)}
          >
            {TEST_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {testPriorityLabel(p, t)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label={t('Môi trường (Environment)', 'Environment')}
            name="tc-env"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as TestEnvironment)}
          >
            {TEST_ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('Trạng thái phê duyệt', 'Approval status')}
            name="tc-approval"
            value={approvalStatus}
            onChange={(e) => setApprovalStatus(e.target.value as TestApprovalStatus)}
          >
            {TEST_APPROVAL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {testApprovalLabel(st, t)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('Thư mục', 'Folder')}
            name="tc-folder"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          >
            <option value="">{t('Không', 'None')}</option>
            {folders.map((f) => (
              <option key={f.folderId} value={f.folderId}>
                {f.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField
            label={t('Điều kiện tiên quyết (Pre-conditions)', 'Pre-conditions')}
            name="tc-pre"
            rows={2}
            value={pre}
            onChange={(e) => setPre(e.target.value)}
          />
          <TextAreaField
            label={t('Dữ liệu kiểm thử (Test Data chuẩn Excel)', 'Test Data (Excel column)')}
            name="tc-testdata"
            rows={2}
            placeholder={"orderId: ORD-2026-101\namount: 150,000 VND"}
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('Kết quả mong đợi tổng quát (Expected Result)', 'Expected Result summary')}
            name="tc-expected-summary"
            value={expectedSummary}
            placeholder={t('Tự động tổng hợp từ các bước nếu để trống', 'Auto-summarized from steps if left blank')}
            onChange={(e) => setExpectedSummary(e.target.value)}
          />
          <TextField
            label={t('Kết quả thực tế (Actual Result)', 'Actual Result')}
            name="tc-actual-result"
            value={actualResult}
            placeholder={t('Ghi nhận khi thực thi kiểm thử', 'Recorded during test execution')}
            onChange={(e) => setActualResult(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium text-gray-900">{t('Các bước', 'Steps')}</p>
            {errors.steps && <p className="text-sm text-red-700">{errors.steps[0]}</p>}
          </div>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li
                key={i}
                className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <span className="mt-2.5 text-center text-xs font-medium text-gray-500">{i + 1}</span>
                <input
                  value={s.action}
                  onChange={(e) => setStep(i, { action: e.target.value })}
                  placeholder={t('Hành động', 'Action')}
                  aria-label={t(`Bước ${i + 1}: hành động`, `Step ${i + 1}: action`)}
                  className="h-10 w-full rounded-control border border-gray-300 px-3 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
                <input
                  value={s.expected}
                  onChange={(e) => setStep(i, { expected: e.target.value })}
                  placeholder={t('Mong đợi', 'Expected')}
                  aria-label={t(`Bước ${i + 1}: mong đợi`, `Step ${i + 1}: expected`)}
                  className="col-start-2 h-10 w-full rounded-control border border-gray-300 px-3 text-sm placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:col-start-auto"
                />
                <span className="col-start-3 row-start-1 flex gap-0.5 sm:col-start-auto sm:row-start-auto">
                  <StepButton label={t('Lên', 'Up')} disabled={i === 0} onClick={() => moveStep(i, -1)}>
                    ↑
                  </StepButton>
                  <StepButton
                    label={t('Xuống', 'Down')}
                    disabled={i === steps.length - 1}
                    onClick={() => moveStep(i, 1)}
                  >
                    ↓
                  </StepButton>
                  <StepButton
                    label={t('Xoá bước', 'Remove step')}
                    disabled={steps.length === 1}
                    onClick={() => setSteps((x) => x.filter((_, k) => k !== i))}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </StepButton>
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setSteps((x) => [...x, { action: '', expected: '' }])}
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t('Thêm bước', 'Add step')}
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-900">{t('REQ liên kết', 'Linked REQs')}</p>
          <ReqPicker projectId={projectId} value={refs} onChange={setRefs} maxHeight="max-h-40" />
        </div>
        {issues.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">{t('Issue liên kết', 'Linked issues')}</p>
            <div className="overflow-hidden rounded-card border border-gray-200">
              <input
                value={issueQ}
                onChange={(e) => setIssueQ(e.target.value)}
                placeholder={t('Lọc issue…', 'Filter issues…')}
                aria-label={t('Lọc issue', 'Filter issues')}
                className="h-10 w-full border-b border-gray-200 px-3 text-sm focus:outline-none"
              />
              <div className="max-h-36 overflow-y-auto">
                {issueList.map((i) => (
                  <label
                    key={i.issueId}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={issueIds.includes(i.issueId)}
                      onChange={() =>
                        setIssueIds((x) =>
                          x.includes(i.issueId) ? x.filter((y) => y !== i.issueId) : [...x, i.issueId],
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    <CodeChip>{i.key}</CodeChip>
                    <span className="truncate">{i.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-8 items-center justify-center rounded-control text-gray-500 hover:bg-gray-100 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/** "✦ Gợi ý từ REQ": chọn REQ → đề xuất testcase theo tiêu chí nghiệm thu → chọn / sửa → tạo. Màu AI = xanh thương hiệu. */
export function SuggestDialog({
  open,
  projectId,
  initialRefs,
  onClose,
  onCreated,
}: {
  open: boolean
  projectId: number
  initialRefs: RequirementRef[]
  onClose: () => void
  onCreated: (n: number) => void
}) {
  const { t } = useI18n()
  const [refs, setRefs] = useState<RequirementRef[]>([])
  const [items, setItems] = useState<(SuggestedTestCase & { pick: boolean })[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqs = useReqOptions(projectId, open)

  useEffect(() => {
    if (!open) return
    setRefs(initialRefs)
    setItems(null)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const suggest = async () => {
    setBusy(true)
    setError(null)
    try {
      const list = await testApi.suggest(projectId, refs)
      setItems(list.map((x) => ({ ...x, pick: true })))
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const create = async () => {
    if (!items) return
    setBusy(true)
    setError(null)
    let n = 0
    try {
      for (const x of items.filter((i) => i.pick && i.title.trim())) {
        await testApi.create(projectId, {
          title: x.title,
          type: x.type,
          priority: x.priority,
          steps: x.steps,
          requirementRefs: [x.requirementRef],
        })
        n += 1
      }
      onCreated(n)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err))
      if (n) onCreated(n)
    } finally {
      setBusy(false)
    }
  }
  const reqOf = (r: RequirementRef) => reqs?.find((o) => o.documentId === r.documentId && o.reqUid === r.reqUid)
  const picked = items?.filter((i) => i.pick).length ?? 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('✦ Gợi ý testcase từ REQ', '✦ Suggest test cases from REQs')}
      description={t(
        'Mỗi tiêu chí nghiệm thu chưa có testcase thành một đề xuất. Bạn chọn và sửa trước khi tạo.',
        'Each acceptance criterion without a test becomes a proposal. Pick and edit before creating.',
      )}
      footer={
        items ? (
          <>
            <Button inline variant="secondary" onClick={() => setItems(null)}>
              {t('Chọn lại REQ', 'Pick REQs again')}
            </Button>
            <Button inline onClick={() => void create()} isLoading={busy} disabled={picked === 0}>
              {t(`Tạo ${picked} testcase`, `Create ${picked} test ${picked === 1 ? 'case' : 'cases'}`)}
            </Button>
          </>
        ) : (
          <>
            <Button inline variant="secondary" onClick={onClose}>
              {t('Huỷ', 'Cancel')}
            </Button>
            <Button inline onClick={() => void suggest()} isLoading={busy} disabled={refs.length === 0}>
              <SparklesIcon className="h-4 w-4" />
              {t('Gợi ý', 'Suggest')}
            </Button>
          </>
        )
      }
    >
      {!items ? (
        <ReqPicker projectId={projectId} value={refs} onChange={setRefs} />
      ) : items.length === 0 ? (
        <p className="rounded-card border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          {t(
            'Mọi tiêu chí của REQ đã chọn đều có testcase.',
            'Every criterion of the selected REQs already has a test case.',
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((x, i) => {
            const r = reqOf(x.requirementRef)
            return (
              <li
                key={x.tempId}
                className={clsx(
                  'overflow-hidden rounded-card border',
                  x.pick ? 'border-brand-200' : 'border-gray-200 opacity-60',
                )}
              >
                <div className="flex items-center gap-2 bg-brand-50 px-3 py-1.5 text-[12.5px] font-medium text-brand-800">
                  <SparklesIcon className="h-3.5 w-3.5" />
                  {t('Đề xuất', 'Proposal')}
                  {r && (
                    <span className="rounded-[5px] border border-brand-200 bg-white px-1.5 text-[11.5px]">
                      {r.reqKey}
                    </span>
                  )}
                  {x.fromCriterion && (
                    <span className="truncate font-normal text-brand-700">{t('từ tiêu chí', 'from criterion')}</span>
                  )}
                  <label className="ml-auto inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={x.pick}
                      onChange={() => setItems((all) => all!.map((y, k) => (k === i ? { ...y, pick: !y.pick } : y)))}
                      className="h-4 w-4 rounded border-brand-300 text-brand-600"
                    />
                    {t('Chọn', 'Pick')}
                  </label>
                </div>
                <div className="space-y-1.5 bg-white px-3 py-2">
                  <input
                    value={x.title}
                    aria-label={t('Tiêu đề testcase', 'Test case title')}
                    onChange={(e) =>
                      setItems((all) => all!.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)))
                    }
                    className="h-9 w-full rounded-control border border-gray-200 px-2.5 text-sm font-medium focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                  {x.steps.map((s, k) => (
                    <p key={k} className="text-[13px] text-gray-600">
                      {k + 1}. {s.action} → <span className="text-gray-900">{s.expected}</span>
                    </p>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}

/** Chi tiết testcase ở bảng phải: bước, REQ, issue, lịch sử chạy, thông tin chuẩn Excel. */
export function TestCaseDrawer({
  projectId,
  testCaseId,
  onClose,
  onEdit,
  notify,
}: {
  projectId?: number
  testCaseId: number
  onClose: () => void
  onEdit: (tc: TestCaseDetailDto) => void
  notify: (text: string, tone?: 'ok' | 'error') => void
}) {
  const { t } = useI18n()
  const [tc, setTc] = useState<TestCaseDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const load = useMemo(
    () => () =>
      testApi.get(testCaseId).then(
        (x) => (setTc(x), setError(null)),
        (err) => setError(apiErrorMessage(err)),
      ),
    [testCaseId],
  )
  useEffect(() => {
    setTc(null)
    void load()
  }, [load])
  useEffect(() => onDataChanged(() => void load()), [load])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-30 bg-gray-950/10" />
      <aside
        role="complementary"
        aria-label={tc ? `${tc.key} · ${tc.title}` : t('Chi tiết testcase', 'Test case details')}
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-200 bg-white shadow-[-16px_0_32px_-16px_rgba(16,24,40,0.25)] sm:w-[500px]"
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 px-4 text-[13px] text-gray-500">
          <span className="font-medium text-gray-700">{tc?.key ?? '…'}</span>
          {tc?.moduleName && (
            <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
              {tc.moduleName}
            </span>
          )}
          {tc?.environment && (
            <span className="rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
              {tc.environment}
            </span>
          )}
          <span className="flex-1" />
          {tc?.can.edit && (
            <button
              type="button"
              onClick={() => onEdit(tc)}
              aria-label={t('Sửa testcase', 'Edit test case')}
              className="flex h-9 w-9 items-center justify-center rounded-control text-gray-500 hover:bg-gray-100 hover:text-gray-950"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {tc?.can.delete && (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              aria-label={t('Xoá testcase', 'Delete test case')}
              className="flex h-9 w-9 items-center justify-center rounded-control text-gray-500 hover:bg-gray-100 hover:text-red-700"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Đóng', 'Close')}
            className="flex h-9 w-9 items-center justify-center rounded-control text-gray-500 hover:bg-gray-100 hover:text-gray-950"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        {error && !tc ? (
          <p className="p-5 text-sm text-red-700">{error}</p>
        ) : !tc ? (
          <div className="space-y-3 p-5">
            <span className="block h-6 w-3/4 rounded bg-gray-100" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-5 text-[13px]">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={clsx(
                    'inline-flex items-center rounded-[5px] border px-2 py-0.5 text-[11px] font-semibold',
                    tc.approvalStatus === 'APPROVED'
                      ? 'border-success-200 bg-success-50 text-success-700'
                      : tc.approvalStatus === 'IN_REVIEW'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-gray-200 bg-gray-100 text-gray-600',
                  )}
                >
                  {testApprovalLabel(tc.approvalStatus, t)}
                </span>
                <span className="text-xs text-gray-500">
                  {testTypeLabel(tc.type)} · {t('ưu tiên', 'priority')} {testPriorityLabel(tc.priority, t)}
                </span>
              </div>
              <h2 className="text-lg font-semibold leading-snug tracking-tight text-gray-950">{tc.title}</h2>
            </div>
            {tc.needsReview && (
              <div className="space-y-2 rounded-card border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <span className="flex-1 text-xs leading-relaxed">
                    {tc.requirements.find((r) => r.changedNote)?.changedNote ??
                      t('REQ liên kết đã đổi', 'A linked REQ changed')}{' '}
                    · {t('Cần đối chiếu và làm mới các bước kiểm thử theo Baseline mới.', 'Steps need to be refreshed against the new Baseline.')}
                  </span>
                </div>
                {tc.can.edit && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {projectId !== undefined && (
                      <Button
                        inline
                        variant="secondary"
                        className="border-brand-200 bg-white text-brand-700 hover:bg-brand-50 lg:h-8"
                        onClick={async () => {
                          try {
                            setTc(await testApi.aiRefreshStale(projectId, tc.testCaseId))
                            notify(t('Đã đồng bộ AI và duyệt kịch bản theo REQ mới', 'AI-refreshed and approved against new REQ'))
                          } catch (err) {
                            notify(apiErrorMessage(err), 'error')
                          }
                        }}
                      >
                        <SparklesIcon className="h-3.5 w-3.5" />
                        {t('AI Đồng bộ theo REQ mới', 'AI Sync with new REQ')}
                      </Button>
                    )}
                    <Button
                      inline
                      variant="secondary"
                      className="lg:h-8"
                      onClick={async () => {
                        try {
                          setTc(await testApi.update(tc.testCaseId, { needsReview: false, approvalStatus: 'APPROVED' }))
                          notify(t('Đã đánh dấu đã xem lại & phê duyệt', 'Marked as reviewed & approved'))
                        } catch (err) {
                          notify(apiErrorMessage(err), 'error')
                        }
                      }}
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                      {t('Xác nhận Fresh & Duyệt', 'Mark Fresh & Approve')}
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {tc.requirements.map((r) => (
                <ReqChip key={r.reqUid} req={r} />
              ))}
              {tc.issues.map((i) => (
                <CodeChip key={i.issueId}>{i.key}</CodeChip>
              ))}
              {tc.requirements.length === 0 && tc.issues.length === 0 && (
                <span className="text-gray-500">{t('Chưa gắn REQ / issue.', 'No REQ or issue linked.')}</span>
              )}
            </div>
            {tc.preconditions && (
              <section>
                <h3 className="mb-1 text-[12.5px] font-medium text-gray-500">
                  {t('Điều kiện tiên quyết (Pre-conditions)', 'Pre-conditions')}
                </h3>
                <p className="whitespace-pre-wrap rounded-control border border-gray-200 bg-gray-50/70 px-3 py-2 text-gray-800">
                  {tc.preconditions}
                </p>
              </section>
            )}
            {tc.testData && (
              <section>
                <h3 className="mb-1 text-[12.5px] font-medium text-gray-500">
                  {t('Dữ liệu kiểm thử (Test Data)', 'Test Data')}
                </h3>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-control border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800">
                  {tc.testData}
                </pre>
              </section>
            )}
            <section>
              <h3 className="mb-1.5 text-[12.5px] font-medium text-gray-500">{t('Các bước thực hiện (Test Steps)', 'Test Steps')}</h3>
              <ol className="divide-y divide-gray-200 rounded-card border border-gray-200">
                {tc.steps.map((s, i) => (
                  <li key={i} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 px-3 py-2">
                    <span className="text-gray-400">{i + 1}</span>
                    <span className="text-gray-900">{s.action}</span>
                    {s.expected && <span className="col-start-2 text-gray-500">→ {s.expected}</span>}
                  </li>
                ))}
              </ol>
            </section>
            {(tc.expectedSummary || tc.actualResult) && (
              <section className="grid gap-3 sm:grid-cols-2">
                {tc.expectedSummary && (
                  <div className="rounded-control border border-gray-200 bg-gray-50/50 p-2.5">
                    <p className="mb-1 text-[11.5px] font-medium text-gray-500">
                      {t('Kết quả mong đợi (Expected)', 'Expected Result')}
                    </p>
                    <p className="text-xs text-gray-800">{tc.expectedSummary}</p>
                  </div>
                )}
                {tc.actualResult && (
                  <div className="rounded-control border border-gray-200 bg-gray-50/50 p-2.5">
                    <p className="mb-1 text-[11.5px] font-medium text-gray-500">
                      {t('Kết quả thực tế (Actual)', 'Actual Result')}
                    </p>
                    <p className="text-xs text-gray-800">{tc.actualResult}</p>
                  </div>
                )}
              </section>
            )}
            <section>
              <h3 className="mb-1.5 text-[12.5px] font-medium text-gray-500">{t('Lịch sử chạy', 'Run history')}</h3>
              {tc.history.length === 0 ? (
                <p className="text-gray-500">{t('Chưa chạy lần nào.', 'Never run.')}</p>
              ) : (
                <ul className="space-y-2">
                  {tc.history.map((h, i) => (
                    <li key={`${h.runId}-${i}`} className="flex items-start gap-2">
                      <ResultPill result={h.result} />
                      <div className="min-w-0">
                        <p className="text-gray-800">
                          {h.cycleName} · <PersonDot user={h.executedBy} size={18} className="align-middle" />{' '}
                          {h.executedBy.fullName} · {shortDate(h.executedAt)}
                        </p>
                        {h.note && <p className="text-gray-500">{h.note}</p>}
                        {h.defects.length > 0 && (
                          <p className="text-gray-500">Bug: {h.defects.map((d) => d.key).join(', ')}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
      {tc && (
        <Modal
          open={confirm}
          tone="danger"
          onClose={() => setConfirm(false)}
          title={t(`Xoá ${tc.key}?`, `Delete ${tc.key}?`)}
          footer={
            <>
              <Button inline variant="secondary" onClick={() => setConfirm(false)}>
                {t('Huỷ', 'Cancel')}
              </Button>
              <Button
                inline
                className="bg-red-600 hover:bg-red-700"
                onClick={async () => {
                  try {
                    await testApi.remove(tc.testCaseId)
                    setConfirm(false)
                    notify(t(`Đã xoá ${tc.key}`, `${tc.key} deleted`))
                    onClose()
                  } catch (err) {
                    notify(apiErrorMessage(err), 'error')
                  }
                }}
              >
                {t('Xoá', 'Delete')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-700">{tc.title}</p>
        </Modal>
      )}
    </>
  )
}

export interface ParsedExcelRow {
  rowId: string
  moduleName: string
  reqKeyInput: string
  matchedReq: ReqOption | null
  testType: TestType
  priority: TestPriority
  environment: TestEnvironment
  title: string
  preconditions: string
  stepsText: string
  testData: string
  expectedSummary: string
  approvalStatus: TestApprovalStatus
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

/** Modal Import Excel / Paste Grid chuẩn doanh nghiệp kèm kiểm tra truy xuất GB-02. */
export function ExcelImportModal({
  open,
  projectId,
  onClose,
  onImported,
}: {
  open: boolean
  projectId: number
  onClose: () => void
  onImported: (count: number) => void
}) {
  const { t } = useI18n()
  const reqs = useReqOptions(projectId, open) ?? []
  const [pasteText, setPasteText] = useState('')
  const [rows, setRows] = useState<ParsedExcelRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPasteText('')
    setRows([])
    setError(null)
  }, [open])

  const matchReqByText = (raw: string): ReqOption | null => {
    const needle = raw.trim().toUpperCase()
    if (!needle) return null
    return (
      reqs.find(
        (r) =>
          r.reqKey.toUpperCase() === needle ||
          `${r.documentCode}:${r.reqKey}`.toUpperCase() === needle ||
          r.reqUid.toUpperCase() === needle,
      ) ?? null
    )
  }

  const parseRawGrid = (raw: string) => {
    setError(null)
    const lines = raw
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) {
      setRows([])
      return
    }
    const delimiter = lines[0].includes('\t') ? '\t' : ','
    const parsedLines = lines.map((l) => parseCsvLine(l, delimiter))
    const firstHeader = parsedLines[0].map((c) => c.toLowerCase())
    const hasHeader =
      firstHeader.some((h) => h.includes('title') || h.includes('tiêu đề') || h.includes('module') || h.includes('req'))
    const dataRows = hasHeader ? parsedLines.slice(1) : parsedLines

    const mapped: ParsedExcelRow[] = dataRows
      .map((cols, idx) => {
        // Hỗ trợ cả định dạng 8–10 cột chuẩn Template và định dạng ngắn 4–6 cột
        const moduleName = cols[0] || 'Payment & VietQR'
        const reqKeyInput = cols[1] || ''
        const rawType = (cols[2] || 'FUNCTIONAL').toUpperCase() as TestType
        const testType: TestType = TEST_TYPES.includes(rawType) ? rawType : 'FUNCTIONAL'
        const rawPrio = (cols[3] || 'HIGH').toUpperCase() as TestPriority
        const priority: TestPriority = TEST_PRIORITIES.includes(rawPrio) ? rawPrio : 'MEDIUM'
        const title = cols[4] || cols[0] || ''
        const preconditions = cols[5] || 'Tài khoản hợp lệ; môi trường SIT sẵn sàng'
        const stepsText = cols[6] || title
        const testData = cols[7] || 'env: SIT_SANDBOX'
        const expectedSummary = cols[8] || 'Hệ thống xử lý đúng theo đặc tả'
        const rawEnv = (cols[9] || 'SIT').toUpperCase() as TestEnvironment
        const environment: TestEnvironment = TEST_ENVIRONMENTS.includes(rawEnv) ? rawEnv : 'SIT'

        return {
          rowId: `import-row-${idx + 1}-${Date.now()}`,
          moduleName,
          reqKeyInput,
          matchedReq: matchReqByText(reqKeyInput),
          testType,
          priority,
          environment,
          title,
          preconditions,
          stepsText,
          testData,
          expectedSummary,
          approvalStatus: 'APPROVED' as TestApprovalStatus,
        }
      })
      .filter((r) => r.title.trim().length > 0)

    setRows(mapped)
  }

  const handleDownloadSampleCsv = () => {
    const req1 = reqs[0]?.reqKey ?? 'REQ-01'
    const req2 = reqs[1]?.reqKey ?? req1
    const header = [
      'Module_Sheet',
      'REQ_Key_GB02',
      'Test_Type',
      'Priority',
      'Test_Case_Title',
      'Preconditions',
      'Test_Steps',
      'Test_Data',
      'Expected_Result',
      'Environment',
    ]
    const sampleRows = [
      [
        'Payment & VietQR',
        req1,
        'FUNCTIONAL',
        'HIGH',
        'Kiểm tra sinh mã VietQR động đúng định dạng EMVCo chuẩn NAPAS247',
        'Đơn hàng ở trạng thái PENDING_PAYMENT',
        '1. Gọi API tạo mã QR 250.000đ | 2. Quét mã trên ứng dụng ngân hàng',
        'orderId: ORD-2026-801; amount: 250000 VND',
        'Hiển thị mã QR hợp lệ, tự động điền đúng 250.000đ và nội dung chuyển khoản',
        'SIT',
      ],
      [
        'Payment & VietQR',
        req1,
        'BOUNDARY',
        'MEDIUM',
        'Kiểm tra giới hạn số tiền tối thiểu 1.000đ và tối đa 499.999.999đ qua VietQR',
        'Tài khoản khách hàng đã xác thực eKYC bậc 2',
        '1. Tạo đơn 1.000đ | 2. Tạo đơn 500.000.000đ vượt ngưỡng NAPAS',
        'minAmount: 1000 VND; maxAmount: 500000000 VND',
        'Đơn 1.000đ sinh QR thành công; đơn 500.000.000đ báo lỗi vượt hạn mức chuyển nhanh 24/7',
        'SIT',
      ],
      [
        'Webhook & Banking Gateway',
        req2,
        'SECURITY',
        'HIGH',
        'Chặn gói tin Webhook giả mạo có Timestamp lệch quá 300 giây (Replay Attack)',
        'Cấu hình chống Replay Attack bật trên API Gateway',
        '1. Bắt gói tin webhook hợp lệ | 2. Phát lại gói tin sau 6 phút',
        'header: X-Timestamp=T-360s; signature: valid_hmac',
        'Từ chối HTTP 401 Unauthorized (Expired Timestamp), ghi cảnh báo bảo mật',
        'STAGING',
      ],
    ]
    const csvContent =
      '\uFEFF' +
      [header, ...sampleRows]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SSAM_Enterprise_TestCase_Template_Project_${projectId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadSampleData = () => {
    const r0 = reqs[0] ?? null
    const r1 = reqs[1] ?? r0
    const r2 = reqs[2] ?? r0
    const sampleText = [
      'Module_Sheet\tREQ_Key_GB02\tTest_Type\tPriority\tTest_Case_Title\tPreconditions\tTest_Steps\tTest_Data\tExpected_Result\tEnvironment',
      `Payment & VietQR\t${r0?.reqKey ?? 'REQ-01'}\tFUNCTIONAL\tHIGH\tKiểm tra sinh mã VietQR động đúng định dạng EMVCo chuẩn NAPAS247\tĐơn hàng ở trạng thái PENDING_PAYMENT\t1. Gọi API tạo mã QR 250.000đ -> 2. Quét mã bằng app ngân hàng\torderId: ORD-2026-801 | amount: 250,000 VND\tHiển thị mã QR hợp lệ, tự động điền đúng 250.000đ và mã tham chiếu\tSIT`,
      `Payment & VietQR\t${r0?.reqKey ?? 'REQ-01'}\tBOUNDARY\tMEDIUM\tKiểm tra giới hạn biên số tiền giao dịch VietQR (1.000đ - 499.999.999đ)\tTài khoản đã xác thực eKYC\t1. Tạo đơn 1.000đ -> 2. Tạo đơn 500.000.000đ\tmin: 1,000 VND | max: 500,000,000 VND\tĐơn 1.000đ thành công; đơn 500M trả mã lỗi 422 AMOUNT_LIMIT_EXCEEDED\tSIT`,
      `Webhook & Banking Gateway\t${r1?.reqKey ?? 'REQ-02'}\tSECURITY\tHIGH\tChặn gói tin Webhook phát lại quá hạn 300 giây (Anti-Replay Attack)\tAPI Gateway bật kiểm tra X-Timestamp\t1. Gửi gói tin webhook có X-Timestamp cũ hơn 5 phút\theader: X-Timestamp=T-360s | hmac: SHA256\tTrả về HTTP 401 Unauthorized, không cộng số dư, ghi log Audit\tSTAGING`,
      `Reconciliation & Audit\t${r2?.reqKey ?? ''}\tNEGATIVE\tHIGH\tTự động treo giao dịch đối soát khi số tiền thực nhận lệch so với đơn hàng\tĐơn hàng yêu cầu 150.000đ nhưng khách chuyển 100.000đ\t1. Nhận webhook 100.000đ cho đơn 150.000đ\texpected: 150,000 VND | actualWebhook: 100,000 VND\tĐơn chuyển trạng thái AMOUNT_MISMATCH, đẩy vào hàng đợi Cần đối soát\tUAT`,
    ].join('\n')
    setPasteText(sampleText)
    parseRawGrid(sampleText)
  }

  const assignDefaultReqToAllMissing = () => {
    const fallback = reqs[0]
    if (!fallback) return
    setRows((prev) =>
      prev.map((r) => (r.matchedReq ? r : { ...r, matchedReq: fallback, reqKeyInput: fallback.reqKey })),
    )
  }

  const missingCount = rows.filter((r) => !r.matchedReq).length
  const canImport = rows.length > 0 && missingCount === 0

  const handleConfirmImport = async () => {
    if (!canImport) return
    setBusy(true)
    setError(null)
    try {
      const payloads: CreateTestCaseBody[] = rows.map((r) => {
        const splitSteps = r.stepsText
          .split(/\||->|;|\n/)
          .map((s) => s.trim())
          .filter(Boolean)
        const steps: TestStep[] =
          splitSteps.length > 0
            ? splitSteps.map((act, i) => ({
                action: act.replace(/^\d+\.\s*/, ''),
                expected: i === splitSteps.length - 1 ? r.expectedSummary : t('Bước thực thi hợp lệ', 'Step executed'),
              }))
            : [{ action: r.title, expected: r.expectedSummary }]
        return {
          title: r.title,
          type: r.testType,
          testType: r.testType,
          priority: r.priority,
          moduleName: r.moduleName,
          environment: r.environment,
          approvalStatus: r.approvalStatus,
          preconditions: r.preconditions,
          testData: r.testData,
          expectedSummary: r.expectedSummary,
          steps,
          requirementRefs: r.matchedReq ? [{ documentId: r.matchedReq.documentId, reqUid: r.matchedReq.reqUid }] : [],
        }
      })
      const created = await testApi.bulkCreate(projectId, payloads)
      onImported(created.length)
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
      title={t('Import kịch bản kiểm thử chuẩn Doanh nghiệp (Excel / CSV / Paste Grid)', 'Import Enterprise Test Cases (Excel / CSV / Paste Grid)')}
      description={t(
        'Tải lên file .CSV/.TSV hoặc sao chép trực tiếp vùng dữ liệu từ Microsoft Excel / Google Sheets. Hệ thống tự động kiểm tra ràng buộc truy xuất GB-02 trước khi lưu.',
        'Upload a .CSV/.TSV file or copy-paste cells directly from Microsoft Excel / Google Sheets. Rule GB-02 traceability is validated automatically before import.',
      )}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void handleConfirmImport()} isLoading={busy} disabled={!canImport}>
            <CheckIcon className="h-4 w-4" />
            {t(`Import ${rows.length} Test Cases`, `Import ${rows.length} Test Cases`)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-600">
            <p className="font-semibold text-gray-900">
              {t('Bước 1: Chuẩn bị dữ liệu từ Template Excel chuẩn CMMI / ISTQB', 'Step 1: Prepare data from CMMI / ISTQB Excel Template')}
            </p>
            <p className="mt-0.5">
              {t(
                'Hỗ trợ các cột: Module, REQ Key (Bắt buộc GB-02), Test Type, Priority, Title, Preconditions, Steps, Test Data, Expected Result.',
                'Supports columns: Module, REQ Key (Mandatory GB-02), Test Type, Priority, Title, Preconditions, Steps, Test Data, Expected Result.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button inline variant="secondary" className="lg:h-8" onClick={handleDownloadSampleCsv}>
              <DocumentIcon className="h-3.5 w-3.5" />
              {t('Tải Template mẫu (.csv)', 'Download Sample (.csv)')}
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control border border-gray-300 bg-white px-3 text-xs font-medium text-gray-800 shadow-xs hover:bg-gray-50 lg:h-8">
              <PlusIcon className="h-3.5 w-3.5" />
              {t('Chọn file .CSV / .TSV', 'Upload .CSV / .TSV')}
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const text = String(reader.result ?? '')
                    setPasteText(text)
                    parseRawGrid(text)
                  }
                  reader.readAsText(file, 'utf-8')
                  e.target.value = ''
                }}
              />
            </label>
            <Button
              inline
              variant="secondary"
              className="border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 lg:h-8"
              onClick={handleLoadSampleData}
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              {t('Nạp dữ liệu mẫu Doanh nghiệp', 'Load Sample Enterprise Data')}
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-700">
            {t(
              'Bước 2: Dán vùng bảng từ Excel / Google Sheets (Tab-separated hoặc CSV)',
              'Step 2: Paste cells from Excel / Google Sheets (Tab-separated or CSV)',
            )}
          </label>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value)
              parseRawGrid(e.target.value)
            }}
            placeholder={t(
              'Copy các dòng từ file Excel (Ctrl+C) và dán vào đây (Ctrl+V)...',
              'Copy rows from Excel (Ctrl+C) and paste here (Ctrl+V)...',
            )}
            className="w-full rounded-control border border-gray-300 p-2.5 font-mono text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">
                  {t(
                    `Bước 3: Kiểm tra Truy xuất GB-02 (${rows.length - missingCount}/${rows.length} dòng hợp lệ)`,
                    `Step 3: GB-02 Traceability Validation (${rows.length - missingCount}/${rows.length} valid rows)`,
                  )}
                </span>
                {missingCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    <AlertTriangleIcon className="h-3 w-3" />
                    {t(`${missingCount} dòng thiếu REQ-xx (Quy tắc GB-02)`, `${missingCount} rows missing REQ-xx (Rule GB-02)`)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700">
                    <CheckIcon className="h-3 w-3" />
                    {t('Đạt chuẩn GB-02 (100% gắn REQ)', 'GB-02 Validated (100% Linked)')}
                  </span>
                )}
              </div>
              {missingCount > 0 && reqs.length > 0 && (
                <button
                  type="button"
                  onClick={assignDefaultReqToAllMissing}
                  className="rounded-control border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  {t(`Gán ${reqs[0].reqKey} cho tất cả dòng thiếu`, `Assign ${reqs[0].reqKey} to all missing rows`)}
                </button>
              )}
            </div>

            <div className="max-h-60 overflow-auto rounded-card border border-gray-200">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="border-b border-gray-200 px-2.5 py-2">#</th>
                    <th className="border-b border-gray-200 px-2.5 py-2">Module / Sheet</th>
                    <th className="border-b border-gray-200 px-2.5 py-2">{t('Kịch bản kiểm thử', 'Test Case Title')}</th>
                    <th className="border-b border-gray-200 px-2.5 py-2">{t('Loại', 'Type')}</th>
                    <th className="border-b border-gray-200 px-2.5 py-2">Test Data</th>
                    <th className="border-b border-gray-200 px-2.5 py-2">{t('Truy xuất REQ-xx (GB-02)', 'REQ-xx Link (GB-02)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr
                      key={r.rowId}
                      className={clsx(
                        'border-b border-gray-100',
                        !r.matchedReq ? 'bg-amber-50/60' : 'bg-white hover:bg-gray-50',
                      )}
                    >
                      <td className="border-b border-gray-200 px-2.5 py-2 font-mono text-gray-500">{idx + 1}</td>
                      <td className="border-b border-gray-200 px-2.5 py-2 font-medium text-gray-800">{r.moduleName}</td>
                      <td className="border-b border-gray-200 px-2.5 py-2">
                        <p className="font-medium text-gray-950">{r.title}</p>
                        <p className="truncate text-[11px] text-gray-500">{r.expectedSummary}</p>
                      </td>
                      <td className="border-b border-gray-200 px-2.5 py-2 text-gray-700">{testTypeLabel(r.testType)}</td>
                      <td className="border-b border-gray-200 px-2.5 py-2 font-mono text-[11px] text-gray-600">
                        {r.testData}
                      </td>
                      <td className="border-b border-gray-200 px-2.5 py-2">
                        <select
                          value={r.matchedReq ? `${r.matchedReq.documentId}:${r.matchedReq.reqUid}` : ''}
                          onChange={(e) => {
                            const val = e.target.value
                            const picked =
                              reqs.find((o) => `${o.documentId}:${o.reqUid}` === val) ?? null
                            setRows((prev) =>
                              prev.map((item, k) =>
                                k === idx
                                  ? { ...item, matchedReq: picked, reqKeyInput: picked?.reqKey ?? '' }
                                  : item,
                              ),
                            )
                          }}
                          className={clsx(
                            'h-8 w-full rounded border px-2 text-xs font-medium focus:outline-none',
                            r.matchedReq
                              ? 'border-success-300 bg-success-50/70 text-success-800'
                              : 'border-amber-400 bg-white text-amber-900',
                          )}
                        >
                          <option value="">{t('— Chọn REQ-xx (Bắt buộc GB-02) —', '— Select REQ-xx (Mandatory GB-02) —')}</option>
                          {reqs.map((o) => (
                            <option key={`${o.documentId}:${o.reqUid}`} value={`${o.documentId}:${o.reqUid}`}>
                              {o.documentCode} · {o.reqKey} — {o.title}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  )
}
