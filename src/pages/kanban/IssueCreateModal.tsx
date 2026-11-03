import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { issueApi } from '@/api/issueApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { ApiError } from '@/lib/apiClient'
import { useI18n } from '@/i18n'
import {
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  type IssueDetailDto,
  type IssuePriority,
  type IssueType,
  type RequirementRef,
  type SprintDto,
  type UserRef,
} from '@/types/issue'
import { ReqPicker } from './ReqPicker'
import { issueTypeLabel, priorityLabel } from './workUi'

export interface IssueDefaults {
  type?: IssueType
  statusId?: number
  sprintId?: number | null
  parentId?: number | null
  assigneeId?: number | null
  requirementRefs?: RequirementRef[]
}

/** Tạo issue: loại, tiêu đề, mô tả, ưu tiên, điểm, người làm, sprint, REQ. */
export function IssueCreateModal({
  open,
  onClose,
  projectId,
  sprints,
  assignees,
  canAssign,
  me,
  defaults,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  projectId: number
  sprints: SprintDto[]
  assignees: UserRef[]
  canAssign: boolean
  me: UserRef | null
  defaults?: IssueDefaults
  onCreated: (issue: IssueDetailDto) => void
}) {
  const { t } = useI18n()
  const [type, setType] = useState<IssueType>('TASK')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM')
  const [points, setPoints] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [sprintId, setSprintId] = useState('')
  const [refs, setRefs] = useState<RequirementRef[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!open) return
    setType(defaults?.type ?? 'TASK')
    setTitle('')
    setDescription('')
    setPriority('MEDIUM')
    setPoints('')
    setAssigneeId(defaults?.assigneeId != null ? String(defaults.assigneeId) : '')
    const active = sprints.find((s) => s.status === 'ACTIVE')
    setSprintId(
      defaults?.sprintId !== undefined
        ? defaults.sprintId === null
          ? ''
          : String(defaults.sprintId)
        : active
          ? String(active.sprintId)
          : '',
    )
    setRefs(defaults?.requirementRefs ?? [])
    setError(null)
    setFieldErrors({})
  }, [open, defaults, sprints])

  const submit = async () => {
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const created = await issueApi.create(projectId, {
        type,
        title,
        description: description || null,
        priority,
        points: points === '' ? null : Number(points),
        assigneeId: assigneeId ? Number(assigneeId) : null,
        sprintId: defaults?.parentId ? undefined : sprintId ? Number(sprintId) : null,
        parentId: defaults?.parentId ?? null,
        statusId: defaults?.statusId,
        requirementRefs: refs,
      })
      onCreated(created)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.errors) setFieldErrors(err.errors)
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const people = canAssign ? assignees : assignees.filter((u) => u.userId === me?.userId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={defaults?.parentId ? t('Thêm việc con', 'Add subtask') : t('Tạo issue', 'Create issue')}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void submit()} isLoading={busy} disabled={!title.trim()}>
            {t('Tạo issue', 'Create issue')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <SelectField
            label={t('Loại', 'Type')}
            name="issue-type"
            value={type}
            onChange={(e) => setType(e.target.value as IssueType)}
          >
            {ISSUE_TYPES.map((x) => (
              <option key={x} value={x}>
                {issueTypeLabel(x)}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t('Tiêu đề', 'Title')}
            name="issue-title"
            data-autofocus
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
            error={fieldErrors.title?.[0]}
          />
        </div>
        <TextAreaField
          label={t('Mô tả', 'Description')}
          name="issue-description"
          rows={3}
          maxLength={10_000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label={t('Ưu tiên', 'Priority')}
            name="issue-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
          >
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t('Điểm', 'Points')}
            name="issue-points"
            type="number"
            min={0}
            max={100}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            error={fieldErrors.points?.[0]}
          />
          <SelectField
            label={t('Người làm', 'Assignee')}
            name="issue-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            error={fieldErrors.assigneeId?.[0]}
          >
            <option value="">{t('Chưa giao', 'Unassigned')}</option>
            {people.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.fullName}
              </option>
            ))}
          </SelectField>
          {!defaults?.parentId && (
            <SelectField
              label="Sprint"
              name="issue-sprint"
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
            >
              <option value="">Backlog</option>
              {sprints
                .filter((s) => s.status !== 'COMPLETED')
                .map((s) => (
                  <option key={s.sprintId} value={s.sprintId}>
                    {s.name}
                    {s.status === 'ACTIVE' ? t(' · đang chạy', ' · active') : ''}
                  </option>
                ))}
            </SelectField>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-900">
            {t('Yêu cầu liên kết (REQ)', 'Linked requirements (REQ)')}
          </p>
          <ReqPicker projectId={projectId} value={refs} onChange={setRefs} maxHeight="max-h-48" />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
