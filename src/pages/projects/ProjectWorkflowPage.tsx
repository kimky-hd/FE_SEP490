import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Card, ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { PencilIcon, PlusIcon } from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { ApiError } from '@/lib/apiClient'
import { apiErrorMessage } from '@/lib/apiErrors'
import { draftToPhaseBody, phaseToDraft, validateDraftPhase, type DraftPhase } from '@/lib/workflowDraft'
import { PERMISSIONS, type RoleDto } from '@/types/rbac'
import type { PhaseDto, WorkflowDto, WorkflowIssue } from '@/types/project'
import { PhaseWorkflowEditor } from './PhaseWorkflowEditor'
import { useProjectContext } from './ProjectLayout'

// Tab Workflow — mockup "Cấu hình Workflow" (card "Phase & trạng thái" + bảng "Luật chuyển trạng thái" Từ → Đến · Role
// được phép · Điều kiện) · UC §II.5.8–5.13 · FR §III.6.1 (dạng bảng, không BPMN kéo-thả — LI-05).
export function ProjectWorkflowPage() {
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
    for (const t of selected?.transitions ?? []) {
      for (const r of t.allowedRoles) if (!list.some((x) => x.roleId === r.roleId)) list.push({ ...r, description: null, isSystem: false, isLocked: false, isActive: false, permissionKeys: [], memberCount: 0, createdAt: '', updatedAt: '' })
    }
    return list
  }, [companyRoles.data, selected])

  if (workflow.isLoading && !workflow.data) return <LoadingBlock />
  if (workflow.error || !workflow.data) return <ErrorState message={apiErrorMessage(workflow.error)} onRetry={workflow.reload} />

  const wf = workflow.data
  const statusName = (phase: PhaseDto, id: number) => phase.statuses.find((s) => s.statusId === id)?.name ?? `#${id}`

  const afterChange = async (next?: WorkflowDto) => {
    if (next) workflow.setData(() => next)
    else await workflow.reload()
    await reloadProject()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Bảng trạng thái & luật chuyển (data table) — không dùng BPMN kéo-thả. Workflow 2 tầng: <b>phase</b> theo thứ tự SDLC, mỗi phase
        có <b>trạng thái</b> và <b>luật chuyển</b> riêng.
      </p>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {/* Phase & trạng thái */}
      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Phase & trạng thái</h2>
          
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {phases.map((phase, index) => (
            <button
              key={phase.phaseId}
              type="button"
              onClick={() => setSelectedPhaseId(phase.phaseId)}
              className={clsx(
                'min-w-[14rem] flex-1 rounded-md border bg-white p-3 text-left transition-colors sm:flex-none',
                selected?.phaseId === phase.phaseId ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200 hover:border-gray-300',
                !phase.isActive && 'opacity-60',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">
                  Phase {index + 1}
                  {!phase.isActive && ' · đã tắt'}
                </span>
                {canManage && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Sửa phase ${phase.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingPhase(phase)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        setEditingPhase(phase)
                      }
                    }}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-gray-900">{phase.name}</span>
              <span className="mt-2 flex flex-wrap gap-1">
                {phase.statuses
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <span key={s.statusId} className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-700">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color ?? '#a8a29e' }} />
                      {s.name}
                      {s.isInitial && <span className="text-[9px] text-gray-400">(initial)</span>}
                    </span>
                  ))}
              </span>
            </button>
          ))}
          {canManage && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex min-w-[10rem] items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-white/60 px-4 py-3 text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-700"
            >
              <PlusIcon className="h-4 w-4" /> Thêm Phase
            </button>
          )}
        </div>
      </section>

      {/* Luật chuyển của phase đang chọn */}
      {selected && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Luật chuyển trạng thái <span className="font-normal text-gray-500">· {selected.name}</span>
            </h2>
            {canManage && (
              <Button inline variant="secondary" className="!h-9" onClick={() => setEditing(phaseToDraft(selected))}>
                <PencilIcon className="h-4 w-4" /> Sửa trạng thái & luồng chuyển
              </Button>
            )}
          </div>
          <Card className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="px-4 py-3 font-medium">Từ</th>
                  <th className="w-8 px-1 py-3" />
                  <th className="px-4 py-3 font-medium">Đến</th>
                  <th className="px-4 py-3 font-medium">Role được phép</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selected.transitions.map((t) => (
                  <tr key={t.transitionId}>
                    <td className="px-4 py-3 text-gray-800">{statusName(selected, t.fromStatusId)}</td>
                    <td className="px-1 py-3 text-center text-brand-600">→</td>
                    <td className="px-4 py-3 text-gray-800">{statusName(selected, t.toStatusId)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.allowedRoles.map((r) => (
                          <Badge key={r.roleId}>{r.name}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {selected.transitions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                      Phase chưa có luật chuyển.
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
            setNotice({ tone: 'success', text: `Đã lưu workflow của phase “${saved.name}”.` })
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
    </div>
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
      setError(apiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={`Trạng thái & luồng chuyển — ${phase.name}`}
      description="Chọn đúng 1 trạng thái khởi tạo, khai báo luật chuyển và role được phép (UC §II.5.13)."
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            Huỷ
          </Button>
          <Button inline isLoading={isSaving} disabled={issues.length > 0} onClick={() => void save()}>
            Lưu workflow
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
        const created = await projectApi.addPhase(projectId, { name: name.trim(), description: description.trim() || undefined })
        await onDone(`Đã thêm phase “${created.name}” (kèm 3 trạng thái mặc định — sửa tiếp ở “Sửa trạng thái & luồng chuyển”).`)
      } else if (phase) {
        const body: { name?: string; description?: string; position?: number; isActive?: boolean } = { description: description.trim() }
        if (editable) Object.assign(body, { name: name.trim(), position, isActive })
        const next = await projectApi.updatePhase(projectId, phase.phaseId, body)
        await onDone(`Đã cập nhật phase “${name.trim() || phase.name}”.`, next)
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
      title={mode === 'create' ? 'Thêm phase mới' : `Sửa phase — ${phase?.name ?? ''}`}
      description={mode === 'create' ? 'UC §II.5.9 — phase mới được thêm vào cuối pipeline.' : 'UC §II.5.11 — tên, mô tả, vị trí, trạng thái.'}
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            Huỷ
          </Button>
          <Button inline isLoading={isSaving} disabled={!name.trim() || !changed} onClick={() => void submit()}>
            {mode === 'create' ? 'Tạo phase' : 'Cập nhật'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField label="Tên phase *" value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <TextField label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} />
        {mode === 'edit' && editable && (
          <>
            <SelectField label="Vị trí trong pipeline" value={position} onChange={(e) => setPosition(Number(e.target.value))}>
              {Array.from({ length: phaseCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Phase {n}
                </option>
              ))}
            </SelectField>
            <label className="flex items-center gap-2.5 text-sm text-gray-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Phase đang hoạt động
            </label>
          </>
        )}
        {!editable && <p className="text-xs text-gray-400">Dự án dùng mẫu cố định — chỉ sửa được mô tả phase.</p>}
      </div>
    </Modal>
  )
}
