import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { issueApi } from '@/api/issueApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { ApiError } from '@/lib/apiClient'
import { useI18n } from '@/i18n'
import { getProjectPhases } from '@/lib/phaseGateEngine'
import {
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  type IssueDetailDto,
  type IssuePriority,
  type IssueStatus,
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
  defaultPhaseId?: string | number
  phaseId?: string | number
}

/** Tạo issue: loại, tiêu đề, mô tả, ưu tiên, điểm, người làm, sprint, REQ, SDLC Phase. */
export function IssueCreateModal({
  open,
  onClose,
  projectId,
  sprints,
  assignees,
  canAssign,
  me,
  defaults,
  defaultPhaseId,
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
  defaultPhaseId?: string | number
  onCreated: (issue: IssueDetailDto) => void
}) {
  const { t } = useI18n()
  const phases = useMemo(() => getProjectPhases(projectId), [projectId, open])
  const [phaseId, setPhaseId] = useState<string | number>('')
  const [phaseStatusId, setPhaseStatusId] = useState<string | number>('')

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

    const prefPhase = defaults?.defaultPhaseId ?? defaultPhaseId ?? defaults?.phaseId
    const targetPhase =
      phases.find((p) => String(p.id) === String(prefPhase)) ||
      phases.find((p) => p.lifecycleStatus === 'active') ||
      phases[0]

    const initialPhaseId = targetPhase ? targetPhase.id : ''
    setPhaseId(initialPhaseId)

    const initialStatus =
      defaults?.statusId !== undefined
        ? targetPhase?.statuses.find((s) => s.statusId === defaults.statusId) ?? targetPhase?.statuses[0]
        : targetPhase?.statuses.find((s) => s.isInitial) ?? targetPhase?.statuses[0]

    setPhaseStatusId(initialStatus ? initialStatus.statusId : '')

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
  }, [open, defaults, defaultPhaseId, sprints, phases])

  const handlePhaseChange = (newPhaseId: string | number) => {
    setPhaseId(newPhaseId)
    const ph = phases.find((p) => String(p.id) === String(newPhaseId))
    const initialStatus = ph?.statuses.find((s) => s.isInitial) ?? ph?.statuses[0]
    setPhaseStatusId(initialStatus ? initialStatus.statusId : '')
  }

  const currentPhase = phases.find((p) => String(p.id) === String(phaseId))

  const submit = async () => {
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const currentStatusObj = currentPhase?.statuses.find((s) => String(s.statusId) === String(phaseStatusId))
      const cat = currentStatusObj?.category ?? 'TODO'
      const mappedStatus: IssueStatus = cat === 'DONE' ? 'DONE' : cat === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO'

      const created = await issueApi.create(projectId, {
        type,
        title,
        description: description || null,
        priority,
        points: points === '' ? null : Number(points),
        assigneeId: assigneeId ? Number(assigneeId) : null,
        sprintId: defaults?.parentId ? undefined : sprintId ? Number(sprintId) : null,
        parentId: defaults?.parentId ?? null,
        statusId: phaseStatusId ? Number(phaseStatusId) : defaults?.statusId,
        phaseId: currentPhase?.id,
        phaseName: currentPhase?.name,
        phaseOrder: currentPhase?.order,
        phaseStatusId: currentStatusObj ? currentStatusObj.statusId : undefined,
        phaseStatusName: currentStatusObj ? currentStatusObj.name : undefined,
        status: mappedStatus,
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
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label={t('Giai đoạn SDLC (Phase) *', 'SDLC Phase *')}
            name="issue-phase"
            value={phaseId}
            onChange={(e) => handlePhaseChange(e.target.value)}
          >
            {phases.map((ph) => (
              <option key={ph.id} value={ph.id}>
                P{ph.order}: {ph.name} {ph.lifecycleStatus === 'active' ? `(${t('Đang chạy', 'Active')})` : ''}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('Trạng thái khởi đầu trong Phase *', 'Initial Status in Phase *')}
            name="issue-phase-status"
            value={phaseStatusId}
            onChange={(e) => setPhaseStatusId(e.target.value)}
          >
            {(currentPhase?.statuses || []).map((st) => (
              <option key={st.statusId} value={st.statusId}>
                {st.name} ({st.category})
              </option>
            ))}
          </SelectField>
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
