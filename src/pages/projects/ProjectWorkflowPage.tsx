import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Card, ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { ArrowRightIcon, PencilIcon, PlusIcon } from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { ApiError } from '@/lib/apiClient'
import { apiErrorMessage, statusInUseMessage } from '@/lib/apiErrors'
import { draftToPhaseBody, phaseToDraft, validateDraftPhase, type DraftPhase } from '@/lib/workflowDraft'
import { PERMISSIONS, type RoleDto } from '@/types/rbac'
import type { PhaseDto, WorkflowDto, WorkflowIssue } from '@/types/project'
import { PhaseWorkflowEditor } from './PhaseWorkflowEditor'
import { useI18n } from '@/i18n'
import { useProjectContext } from './ProjectLayout'
import { SectionBar, TabBody } from '@/components/layout/tabParts'
import { PhasePipelineTracker } from '@/components/projects/PhasePipelineTracker'

// Tab Workflow — mockup "Cấu hình Workflow" (card "Phase & trạng thái" + bảng "Luật chuyển trạng thái" Từ → Đến · Role
// được phép · Điều kiện) · UC §II.5.8–5.13 · FR §III.6.1 (dạng bảng, không BPMN kéo-thả — LI-05).
export function ProjectWorkflowPage() {
  const { t } = useI18n()
  const { project, can, isArchived, reload: reloadProject } = useProjectContext()
  const canManage = can(PERMISSIONS.projectWorkflowManage) && !isArchived
  const companyRoles = useAsync<RoleDto[]>(
    () =>
      canManage && project.companyId !== null
        ? roleApi.list(project.companyId, { scope: 'PROJECT', includeInactive: false })
        : Promise.resolve([]),
    [canManage, project.companyId],
  )
  const workflow = useAsync(() => projectApi.workflow(project.projectId), [project.projectId])
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null)
  const [editing, setEditing] = useState<DraftPhase | null>(null)
  const [editingPhase, setEditingPhase] = useState<PhaseDto | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const phases = workflow.data?.phases ?? []
  const selected = phases.find((p) => p.phaseId === selectedPhaseId) ?? phases.find((p) => p.isActive) ?? phases[0]
  // Role cho editor = role dự án đang bật + role đang được dùng trong luật (kể cả đã tắt) để không mất dữ liệu.
  const editorRoles = useMemo(() => {
    const list = [...(companyRoles.data ?? [])]
    for (const transition of selected?.transitions ?? []) {
      for (const r of transition.allowedRoles)
        if (!list.some((x) => x.roleId === r.roleId))
          list.push({
            ...r,
            description: null,
            isSystem: false,
            isLocked: false,
            isActive: false,
            permissionKeys: [],
            memberCount: 0,
            createdAt: '',
            updatedAt: '',
          })
    }
    return list
  }, [companyRoles.data, selected])

  if (workflow.isLoading && !workflow.data) return <LoadingBlock />
  if (workflow.error || !workflow.data)
    return <ErrorState message={apiErrorMessage(workflow.error)} onRetry={workflow.reload} />

  const wf = workflow.data
  const statusName = (phase: PhaseDto, id: number) => phase.statuses.find((s) => s.statusId === id)?.name ?? `#${id}`

  const afterChange = async (next?: WorkflowDto) => {
    if (next) workflow.setData(() => next)
    else await workflow.reload()
    await reloadProject()
  }

  return (
    <TabBody>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <PhasePipelineTracker projectId={project.projectId} phases={phases} sdlcMethod={wf.sdlcMethod} />

      {/* Phase & trạng thái */}
      <section className="space-y-3">
        <SectionBar
          title={t('Giai đoạn', 'Phases')}
          caption={String(phases.length)}
          help={t(
            'Issue đi qua các giai đoạn theo thứ tự; trong mỗi giai đoạn chỉ chuyển trạng thái theo luật đã khai báo.',
            'Issues move through phases in order; within a phase they only change status along declared transitions.',
          )}
          actions={
            canManage && (
              <Button type="button" variant="secondary" inline onClick={() => setAddOpen(true)}>
                <PlusIcon className="h-4 w-4" /> {t('Thêm giai đoạn', 'Add phase')}
              </Button>
            )
          }
        />
        {/* Lưới đều cột: thẻ giai đoạn cùng bề rộng, không co giãn theo số chữ. Chọn thẻ để xem luật chuyển bên dưới.
            Nút sửa nằm cạnh (không lồng trong) nút chọn thẻ. */}
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {phases.map((phase, index) => {
            const isSelected = selected?.phaseId === phase.phaseId
            return (
              <li
                key={phase.phaseId}
                className={clsx(
                  'relative rounded-card border bg-white shadow-xs transition-colors',
                  isSelected ? 'border-brand-500 ring-4 ring-brand-100' : 'border-gray-200 hover:border-gray-300',
                  !phase.isActive && 'opacity-70',
                )}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedPhaseId(phase.phaseId)}
                  className="flex h-full w-full flex-col items-start justify-start rounded-card p-4 pr-12 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                >
                  <span className="flex items-center gap-2 text-xs text-gray-500">
                    <span
                      className={clsx(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                        isSelected ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {index + 1}
                    </span>
                    {!phase.isActive && t('Đã tắt', 'Disabled')}
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-gray-950">{phase.name}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {phase.statuses
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <span
                          key={s.statusId}
                          title={s.isInitial ? t('Trạng thái bắt đầu', 'Start status') : undefined}
                          className={clsx(
                            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
                            s.isInitial
                              ? 'border-gray-300 bg-white font-medium text-gray-900'
                              : 'border-gray-200 bg-gray-50 text-gray-700',
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color ?? '#98a2b3' }} />
                          {s.name}
                        </span>
                      ))}
                  </span>
                </button>
                {canManage && (
                  <button
                    type="button"
                    aria-label={t(`Sửa giai đoạn ${phase.name}`, `Edit phase ${phase.name}`)}
                    onClick={() => setEditingPhase(phase)}
                    className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-control text-gray-500 hover:bg-gray-100 hover:text-gray-950 lg:h-8 lg:w-8"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      {/* Luật chuyển của phase đang chọn */}
      {selected && (
        <section className="space-y-3">
          <SectionBar
            title={t('Luật chuyển', 'Transitions')}
            caption={selected.name}
            actions={
              canManage && (
                <Button inline variant="secondary" onClick={() => setEditing(phaseToDraft(selected))}>
                  <PencilIcon className="h-4 w-4" /> {t('Sửa trạng thái & luồng chuyển', 'Edit statuses & transitions')}
                </Button>
              )
            }
          />
          {/* Dưới sm: mỗi luật là một khối "Từ → Đến" kèm role ở dòng dưới, không mất cột nào. */}
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="hidden sm:table-header-group">
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3 font-medium">{t('Từ', 'From')}</th>
                  <th className="w-8 px-1 py-3">
                    <span className="sr-only">{t('sang', 'to')}</span>
                  </th>
                  <th className="px-4 py-3 font-medium">{t('Đến', 'To')}</th>
                  <th className="px-4 py-3 font-medium">{t('Role được phép', 'Allowed roles')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {selected.transitions.map((rule) => (
                  <tr
                    key={rule.transitionId}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-3 transition-colors hover:bg-gray-50 sm:table-row sm:p-0"
                  >
                    <td className="text-gray-950 sm:px-4 sm:py-3">{statusName(selected, rule.fromStatusId)}</td>
                    <td className="text-gray-500 sm:px-1 sm:py-3 sm:text-center" aria-hidden="true">
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </td>
                    <td className="text-gray-950 sm:px-4 sm:py-3">{statusName(selected, rule.toStatusId)}</td>
                    <td className="w-full sm:w-auto sm:px-4 sm:py-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.allowedRoles.map((r) => (
                          <Badge key={r.roleId}>{r.name}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {selected.transitions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                      {t('Giai đoạn này chưa có luật chuyển.', 'This phase has no transitions yet.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {editing && selected && (
        <EditPhaseWorkflowModal
          projectId={project.projectId}
          phase={selected}
          draft={editing}
          roles={editorRoles}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSaved={async (saved) => {
            setEditing(null)
            setNotice({
              tone: 'success',
              text: t(`Đã lưu luồng của giai đoạn “${saved.name}”.`, `Saved the workflow for phase “${saved.name}”.`),
            })
            await afterChange({ ...wf, phases: wf.phases.map((p) => (p.phaseId === saved.phaseId ? saved : p)) })
          }}
        />
      )}

      <PhaseFormModal
        mode="create"
        open={addOpen}
        projectId={project.projectId}
        onClose={() => setAddOpen(false)}
        onDone={async (message, next) => {
          setAddOpen(false)
          setNotice({ tone: 'success', text: message })
          await afterChange(next)
        }}
      />
      <PhaseFormModal
        mode="edit"
        open={editingPhase !== null}
        phase={editingPhase ?? undefined}
        phaseCount={phases.length}
        editable={true}
        projectId={project.projectId}
        onClose={() => setEditingPhase(null)}
        onDone={async (message, next) => {
          setEditingPhase(null)
          setNotice({ tone: 'success', text: message })
          await afterChange(next)
        }}
      />
    </TabBody>
  )
}

function EditPhaseWorkflowModal({
  projectId,
  phase,
  draft,
  roles,
  onChange,
  onClose,
  onSaved,
}: {
  projectId: number
  phase: PhaseDto
  draft: DraftPhase
  roles: RoleDto[]
  onChange: (next: DraftPhase) => void
  onClose: () => void
  onSaved: (phase: PhaseDto) => Promise<void>
}) {
  const { t } = useI18n()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverIssues, setServerIssues] = useState<WorkflowIssue[] | null>(null)
  const issues = serverIssues ?? validateDraftPhase(draft, 0)

  useEffect(() => setServerIssues(null), [draft])

  const save = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const saved = await projectApi.savePhaseWorkflow(projectId, phase.phaseId, draftToPhaseBody(draft))
      await onSaved(saved)
    } catch (err) {
      if (err instanceof ApiError && err.workflowIssues) setServerIssues(err.workflowIssues)
      setError(
        statusInUseMessage(err, (id) => phase.statuses.find((s) => s.statusId === id)?.name) ?? apiErrorMessage(err),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={t(`Trạng thái & luồng chuyển — ${phase.name}`, `Statuses & transitions — ${phase.name}`)}
      description={t(
        'Khai báo trạng thái, luật chuyển và role được phép.',
        'Define statuses, transitions and allowed roles.',
      )}
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline isLoading={isSaving} disabled={issues.length > 0} onClick={() => void save()}>
            {t('Lưu workflow', 'Save workflow')}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <PhaseWorkflowEditor phase={draft} onChange={onChange} roles={roles} issues={issues} />
    </Modal>
  )
}

function PhaseFormModal({
  mode,
  open,
  phase,
  phaseCount = 0,
  editable = true,
  projectId,
  onClose,
  onDone,
}: {
  mode: 'create' | 'edit'
  open: boolean
  phase?: PhaseDto
  phaseCount?: number
  editable?: boolean
  projectId: number
  onClose: () => void
  onDone: (message: string, next?: WorkflowDto) => Promise<void>
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState(1)
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(phase?.name ?? '')
    setDescription(phase?.description ?? '')
    setPosition(phase?.position ?? 1)
    setIsActive(phase?.isActive ?? true)
    setError(null)
  }, [open, phase])

  const changed =
    mode === 'create' ||
    name.trim() !== phase?.name ||
    (description.trim() || null) !== (phase?.description ?? null) ||
    position !== phase?.position ||
    isActive !== phase?.isActive

  const submit = async () => {
    setIsSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        const created = await projectApi.addPhase(projectId, {
          name: name.trim(),
          description: description.trim() || undefined,
        })
        await onDone(
          t(
            `Đã thêm giai đoạn “${created.name}” với 3 trạng thái mặc định. Sửa tiếp ở “Sửa trạng thái & luồng chuyển”.`,
            `Added phase “${created.name}” with 3 default statuses. Continue in “Edit statuses & transitions”.`,
          ),
        )
      } else if (phase) {
        const body: { name?: string; description?: string; position?: number; isActive?: boolean } = {
          description: description.trim(),
        }
        if (editable) Object.assign(body, { name: name.trim(), position, isActive })
        const next = await projectApi.updatePhase(projectId, phase.phaseId, body)
        await onDone(
          t(`Đã cập nhật giai đoạn “${name.trim() || phase.name}”.`, `Updated phase “${name.trim() || phase.name}”.`),
          next,
        )
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === 'create'
          ? t('Thêm giai đoạn mới', 'Add new phase')
          : t(`Sửa giai đoạn: ${phase?.name ?? ''}`, `Edit phase: ${phase?.name ?? ''}`)
      }
      description={
        mode === 'create'
          ? t('Giai đoạn mới được thêm vào cuối danh sách.', 'The new phase is added to the end of the list.')
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline isLoading={isSaving} disabled={!name.trim() || !changed} onClick={() => void submit()}>
            {mode === 'create' ? t('Tạo giai đoạn', 'Create phase') : t('Cập nhật', 'Update')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label={t('Tên giai đoạn *', 'Phase name *')}
          value={name}
          disabled={!editable}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <TextField
          label={t('Mô tả', 'Description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {mode === 'edit' && editable && (
          <>
            <SelectField
              label={t('Vị trí trong pipeline', 'Position in pipeline')}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
            >
              {Array.from({ length: phaseCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t('Giai đoạn', 'Phase')} {n}
                </option>
              ))}
            </SelectField>
            <label className="flex items-center gap-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              {t('Phase đang hoạt động', 'Phase is active')}
            </label>
          </>
        )}
        {!editable && (
          <p className="text-xs text-gray-500">
            {t(
              'Dự án dùng mẫu cố định — chỉ sửa được mô tả phase.',
              'This project uses a fixed template — only the phase description can be edited.',
            )}
          </p>
        )}
      </div>
    </Modal>
  )
}
