import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { issueApi } from '@/api/issueApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { ApiError } from '@/lib/apiClient'
import { useI18n } from '@/i18n'
import { ISSUE_TYPES, type IssueSummaryDto, type IssueType, type RequirementRef, type SprintDto } from '@/types/issue'
import { ReqPicker } from './ReqPicker'
import { issueTypeLabel } from './workUi'

/** Hoàn tất sprint: issue chưa xong chuyển về backlog hoặc sprint kế tiếp. */
export function CompleteSprintModal({
  sprint,
  sprints,
  openCount,
  onClose,
  onDone,
}: {
  sprint: SprintDto | null
  sprints: SprintDto[]
  openCount: number
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const { t } = useI18n()
  const next = sprints.filter((s) => s.status === 'PLANNED')
  const [target, setTarget] = useState<string>('BACKLOG')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setTarget(next[0] ? String(next[0].sprintId) : 'BACKLOG')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint?.sprintId])
  if (!sprint) return null
  const submit = async () => {
    setBusy(true)
    try {
      await issueApi.completeSprint(sprint.sprintId, {
        moveOpenIssuesTo: target === 'BACKLOG' ? 'BACKLOG' : Number(target),
      })
      onDone(t(`Đã hoàn tất ${sprint.name}`, `${sprint.name} completed`))
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t(`Hoàn tất ${sprint.name}`, `Complete ${sprint.name}`)}
      description={t(
        `${sprint.donePoints} / ${sprint.committedPoints} điểm đã xong.`,
        `${sprint.donePoints} / ${sprint.committedPoints} points done.`,
      )}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void submit()} isLoading={busy}>
            {t('Hoàn tất sprint', 'Complete sprint')}
          </Button>
        </>
      }
    >
      {openCount === 0 ? (
        <p className="text-sm text-gray-700">
          {t('Mọi issue trong sprint đã xong.', 'Every issue in the sprint is done.')}
        </p>
      ) : (
        <SelectField
          label={t(
            `${openCount} issue chưa xong chuyển tới`,
            `Move ${openCount} open ${openCount === 1 ? 'issue' : 'issues'} to`,
          )}
          name="complete-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="BACKLOG">Backlog</option>
          {next.map((s) => (
            <option key={s.sprintId} value={s.sprintId}>
              {s.name}
            </option>
          ))}
        </SelectField>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}

/** Tạo sprint (PLANNED). */
export function CreateSprintModal({
  open,
  projectId,
  sprints,
  onClose,
  onDone,
}: {
  open: boolean
  projectId: number
  sprints: SprintDto[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [capacity, setCapacity] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    const nums = sprints.map((s) => Number(/(\d+)\s*$/.exec(s.name)?.[1] ?? 0))
    setName(`Sprint ${Math.max(0, ...nums) + 1}`)
    setGoal('')
    const last = [...sprints]
      .filter((s) => s.endDate)
      .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))[0]
    const from = last?.endDate ? new Date(`${last.endDate}T00:00:00`) : new Date()
    const to = new Date(from.getTime() + 7 * 86_400_000)
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setStart(ymd(from))
    setEnd(ymd(to))
    setCapacity(sprints.find((s) => s.capacityPoints)?.capacityPoints?.toString() ?? '')
    setErrors({})
    setError(null)
  }, [open, sprints])
  const submit = async () => {
    setBusy(true)
    setErrors({})
    try {
      await issueApi.createSprint(projectId, {
        name,
        goal: goal || null,
        startDate: start || null,
        endDate: end || null,
        capacityPoints: capacity === '' ? null : Number(capacity),
      })
      onDone(t(`Đã tạo ${name}`, `${name} created`))
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors)
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Tạo sprint', 'Create sprint')}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void submit()} isLoading={busy} disabled={!name.trim()}>
            {t('Tạo sprint', 'Create sprint')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField
          label={t('Tên', 'Name')}
          name="sprint-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name?.[0]}
        />
        <TextField
          label={t('Mục tiêu', 'Goal')}
          name="sprint-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            label={t('Bắt đầu', 'Start')}
            name="sprint-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            label={t('Kết thúc', 'End')}
            name="sprint-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            error={errors.endDate?.[0]}
          />
          <TextField
            label={t('Sức chứa (điểm)', 'Capacity (pts)')}
            name="sprint-capacity"
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            error={errors.capacityPoints?.[0]}
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  )
}

/** "Tạo issue từ REQ": chỉ liệt kê REQ chưa có issue nào. */
export function FromReqModal({
  open,
  projectId,
  issues,
  sprints,
  onClose,
  onDone,
}: {
  open: boolean
  projectId: number
  issues: IssueSummaryDto[]
  sprints: SprintDto[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const { t } = useI18n()
  const [refs, setRefs] = useState<RequirementRef[]>([])
  const [type, setType] = useState<IssueType>('STORY')
  const [sprintId, setSprintId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const linked = useMemo(
    () => new Set(issues.flatMap((i) => i.requirements.map((r) => `${r.documentId}:${r.reqUid}`))),
    [issues],
  )
  useEffect(() => {
    if (!open) return
    setRefs([])
    setError(null)
  }, [open])
  const submit = async () => {
    setBusy(true)
    try {
      const created = await issueApi.fromRequirements(projectId, {
        refs,
        type,
        sprintId: sprintId ? Number(sprintId) : null,
      })
      onDone(
        t(`Đã tạo ${created.length} issue`, `Created ${created.length} ${created.length === 1 ? 'issue' : 'issues'}`),
      )
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
      title={t('Tạo issue từ REQ', 'Create issues from REQs')}
      description={t(
        'REQ chưa có issue nào. Mỗi REQ một issue, tiêu đề lấy theo REQ.',
        'REQs without any issue. One issue per REQ, titled after it.',
      )}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void submit()} isLoading={busy} disabled={refs.length === 0}>
            {refs.length > 0 ? t(`Tạo ${refs.length} issue`, `Create ${refs.length}`) : t('Tạo issue', 'Create issues')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ReqPicker
          projectId={projectId}
          value={refs}
          onChange={setRefs}
          exclude={(o) => linked.has(`${o.documentId}:${o.reqUid}`)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label={t('Loại', 'Type')}
            name="fromreq-type"
            value={type}
            onChange={(e) => setType(e.target.value as IssueType)}
          >
            {ISSUE_TYPES.map((x) => (
              <option key={x} value={x}>
                {issueTypeLabel(x)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Sprint"
            name="fromreq-sprint"
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
          >
            <option value="">Backlog</option>
            {sprints
              .filter((s) => s.status !== 'COMPLETED')
              .map((s) => (
                <option key={s.sprintId} value={s.sprintId}>
                  {s.name}
                </option>
              ))}
          </SelectField>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  )
}
