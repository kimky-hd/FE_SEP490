import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { CloseIcon, PencilIcon, PlusIcon, SparklesIcon, TrashIcon } from '@/components/ui/icons'
import { apiErrorMessage } from '@/lib/apiErrors'
import { ApiError } from '@/lib/apiClient'
import { onDataChanged } from '@/lib/dataEvents'
import { useI18n } from '@/i18n'
import type { IssueSummaryDto, RequirementRef } from '@/types/issue'
import {
  TEST_PRIORITIES,
  TEST_TYPES,
  type SuggestedTestCase,
  type TestCaseDetailDto,
  type TestPriority,
  type TestStep,
  type TestType,
} from '@/types/testing'
import { ReqPicker, useReqOptions } from '../kanban/ReqPicker'
import { CodeChip, PersonDot, ReqChip, ResultPill, shortDate, testTypeLabel } from '../kanban/workUi'

export const testPriorityLabel = (p: TestPriority, t: (vi: string, en: string) => string) =>
  ({ HIGH: t('Cao', 'High'), MEDIUM: t('TB', 'Medium'), LOW: t('Thấp', 'Low') })[p]

export interface TestCaseDraft {
  title?: string
  type?: TestType
  priority?: TestPriority
  preconditions?: string
  steps?: TestStep[]
  folderId?: number | null
  requirementRefs?: RequirementRef[]
  issueIds?: number[]
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
    const body = {
      title,
      type,
      priority,
      preconditions: pre || null,
      steps: steps.filter((s) => s.action.trim() || s.expected.trim()),
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
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            label={t('Loại', 'Type')}
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
        <TextAreaField
          label={t('Điều kiện trước', 'Preconditions')}
          name="tc-pre"
          rows={2}
          value={pre}
          onChange={(e) => setPre(e.target.value)}
        />

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

/** Chi tiết testcase ở bảng phải: bước, REQ, issue, lịch sử chạy. */
export function TestCaseDrawer({
  testCaseId,
  onClose,
  onEdit,
  notify,
}: {
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
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-200 bg-white shadow-[-16px_0_32px_-16px_rgba(16,24,40,0.25)] sm:w-[480px]"
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 px-4 text-[13px] text-gray-500">
          <span className="font-medium text-gray-700">{tc?.key ?? '…'}</span>
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
              <h2 className="text-lg font-semibold leading-snug tracking-tight text-gray-950">{tc.title}</h2>
              <p className="mt-1 text-gray-500">
                {testTypeLabel(tc.type)} · {t('ưu tiên', 'priority')} {testPriorityLabel(tc.priority, t)}
              </p>
            </div>
            {tc.needsReview && (
              <div className="flex items-center gap-2 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                <span className="flex-1">
                  {tc.requirements.find((r) => r.changedNote)?.changedNote ??
                    t('REQ liên kết đã đổi', 'A linked REQ changed')}{' '}
                  · {t('cần xem lại bước test.', 'review the steps.')}
                </span>
                {tc.can.edit && (
                  <Button
                    inline
                    variant="secondary"
                    className="lg:h-8"
                    onClick={async () => {
                      try {
                        setTc(await testApi.update(tc.testCaseId, { needsReview: false }))
                        notify(t('Đã đánh dấu đã xem lại', 'Marked as reviewed'))
                      } catch (err) {
                        notify(apiErrorMessage(err), 'error')
                      }
                    }}
                  >
                    {t('Đã xem lại', 'Reviewed')}
                  </Button>
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
                  {t('Điều kiện trước', 'Preconditions')}
                </h3>
                <p className="whitespace-pre-wrap text-gray-800">{tc.preconditions}</p>
              </section>
            )}
            <section>
              <h3 className="mb-1.5 text-[12.5px] font-medium text-gray-500">{t('Các bước', 'Steps')}</h3>
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
