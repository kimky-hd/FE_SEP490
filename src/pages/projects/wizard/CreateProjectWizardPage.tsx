import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CloseIcon, DocumentIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { workspaceApi } from '@/api/workspaceApi'
import { roleApi } from '@/api/roleApi'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { ApiError } from '@/lib/apiClient'
import { apiErrorMessage, isForbidden } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { toProjectKey } from '@/lib/slug'
import { draftToPhaseBody, templateToDraft, validateDraftPhases, type DraftPhase } from '@/lib/workflowDraft'
import { PERMISSIONS } from '@/types/rbac'
import type { SdlcMethod, WorkflowIssue } from '@/types/project'
import { PhaseWorkflowEditor } from '../PhaseWorkflowEditor'
import { StepProjectInfo, type KeyCheck } from './StepProjectInfo'
import { StepMembers } from './StepMembers'
import { clearDraft, loadDraft, saveDraft, validateStepOne, type WizardState, type WizardStep } from './wizardState'

// Wizard tạo dự án 3 bước — Figma hàng 2 frame 02 → 03 → 04 · Screen List #16 ("General Info → Workflow Template →
// Invite Members") · BF-02. Gửi 1 request duy nhất ở bước cuối (doc/Workspace-RBAC-API-Contract.md §10.4).

const STEPS: { step: WizardStep; title: string; description: string }[] = [
  { step: 1, title: 'Project & Phases', description: 'Định danh dự án & cấu hình các giai đoạn SDLC tuỳ biến.' },
  { step: 2, title: 'Issue Workflow', description: 'Trạng thái issue, luật chuyển dịch & Kanban lanes.' },
  { step: 3, title: 'Invite Users', description: 'Phân quyền thành viên: Product Owner, Tech Lead, Developers.' },
]

export function CreateProjectWizardPage() {
  const workspaceId = Number(useParams().workspaceId)
  const navigate = useNavigate()
  const { user } = useAuth()

  const workspace = useAsync(() => workspaceApi.get(workspaceId), [workspaceId])
  const companyId = workspace.data?.companyId ?? null
  const canCreate = workspace.data ? hasPermission(workspace.data.myPermissions, PERMISSIONS.projectCreate) : false
  const templates = useAsync(() => (canCreate ? projectApi.templates() : Promise.resolve([])), [canCreate])
  const projectRoles = useAsync(
    () => (canCreate && companyId !== null ? roleApi.list(companyId, { scope: 'PROJECT', includeInactive: false }) : Promise.resolve([])),
    [canCreate, companyId],
  )
  const members = useAsync(
    () => (canCreate && companyId !== null ? workspaceApi.listMembers(workspaceId) : Promise.resolve([])),
    [canCreate, companyId, workspaceId],
  )

  const [state, setState] = useState<WizardState | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  const [maxCompletedStep, setMaxCompletedStep] = useState<number>(0)
  const [stepOneErrors, setStepOneErrors] = useState<Record<string, string>>({})
  const [keyCheck, setKeyCheck] = useState<KeyCheck>({ state: 'idle' })
  const [activePhaseKey, setActivePhaseKey] = useState<string | null>(null)
  const [serverIssues, setServerIssues] = useState<WorkflowIssue[] | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingMethod, setPendingMethod] = useState<SdlcMethod | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
    const keyRequest = useRef(0)

  const ready = !!(templates.data?.length && projectRoles.data && members.data && user)

  // Khởi tạo: khôi phục nháp nếu có, không thì dùng mẫu Custom (Figma frame 02 chọn sẵn "Custom SDLC Template").
  useEffect(() => {
    if (!ready || state) return
    const draft = loadDraft(user!.id, workspaceId)
    if (draft) {
      const { savedAt: draftSavedAt, ...rest } = draft
      setState(rest)
      setRestoredAt(draftSavedAt)
      if (rest.step > 1) {
        setMaxCompletedStep(rest.step - 1)
      }
      return
    }
    const custom = templates.data!.find((t) => t.method === 'CUSTOM') ?? templates.data![0]
    setState({
      step: 1,
      name: '',
      key: '',
      keyTouched: false,
      description: '',
      aiEnabled: true,
      sdlcMethod: custom.method,
      phases: templateToDraft(custom.phases, projectRoles.data!),
      phasesTouched: false,
      members: [],
    })
  }, [ready, state, user, workspaceId, templates.data, projectRoles.data])



  const update = useCallback((patch: Partial<WizardState>) => setState((prev) => (prev ? { ...prev, ...patch } : prev)), [])

  // Key tự sinh theo tên cho tới khi người dùng tự sửa (badge "AUTO").
  useEffect(() => {
    if (state && !state.keyTouched) {
      const key = toProjectKey(state.name)
      if (key !== state.key) update({ key })
    }
  }, [state, update])

  const checkKey = useCallback(
    async (key: string) => {
      if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) return setKeyCheck({ state: 'idle' })
      const id = ++keyRequest.current
      setKeyCheck({ state: 'checking' })
      try {
        const result = await projectApi.checkKey(workspaceId, key)
        if (id === keyRequest.current) setKeyCheck({ state: result.available ? 'available' : 'taken', suggestion: result.suggestion })
        return result.available
      } catch {
        if (id === keyRequest.current) setKeyCheck({ state: 'idle' })
      }
    },
    [workspaceId],
  )

  // Kiểm tra key sau khi ngừng gõ.
  useEffect(() => {
    if (!state?.key) return
    const timer = setTimeout(() => void checkKey(state.key), 400)
    return () => clearTimeout(timer)
  }, [state?.key, checkKey])

  const clientIssues = useMemo(() => (state ? validateDraftPhases(state.phases) : []), [state])
  const issues = serverIssues ?? clientIssues
  const template = templates.data?.find((t) => t.method === state?.sdlcMethod)

  if (workspace.isLoading && !workspace.data) {
    return (
      <DashboardLayout>
        <LoadingBlock />
      </DashboardLayout>
    )
  }
  if (workspace.error || !workspace.data) {
    return (
      <DashboardLayout>
        {isForbidden(workspace.error) ? <ForbiddenState /> : <ErrorState message={apiErrorMessage(workspace.error)} onRetry={workspace.reload} />}
      </DashboardLayout>
    )
  }
  if (!canCreate) {
    return (
      <DashboardLayout>
        <ForbiddenState message={`Bạn cần role có quyền “Tạo dự án” (project.create) trong workspace “${workspace.data.name}”, ví dụ Project Initiator.`} />
      </DashboardLayout>
    )
  }
  if (companyId === null) {
    return (
      <DashboardLayout>
        <Alert tone="info">Dự án trong workspace cá nhân sẽ được hỗ trợ sau — role dự án được định nghĩa ở cấp công ty.</Alert>
      </DashboardLayout>
    )
  }
  if (workspace.data.status === 'ARCHIVED') {
    return (
      <DashboardLayout>
        <Alert tone="warning">Workspace đã được lưu trữ, không tạo được dự án mới.</Alert>
      </DashboardLayout>
    )
  }
  if (templates.error || projectRoles.error || members.error) {
    return (
      <DashboardLayout>
        <ErrorState
          message={apiErrorMessage(templates.error ?? projectRoles.error ?? members.error)}
          onRetry={() => void Promise.all([templates.reload(), projectRoles.reload(), members.reload()])}
        />
      </DashboardLayout>
    )
  }
  if (!state) {
    return (
      <DashboardLayout>
        <LoadingBlock />
      </DashboardLayout>
    )
  }

  const ws = workspace.data
  const roles = projectRoles.data ?? []
  const activePhase = state.phases.find((p) => p.key === activePhaseKey) ?? state.phases[0]
  const issuesOf = (phaseIndex: number) => issues.filter((i) => i.phaseIndex === phaseIndex)

  const applyMethod = (method: SdlcMethod) => {
    const t = templates.data!.find((x) => x.method === method)!
    setServerIssues(null)
    update({ sdlcMethod: method, phases: templateToDraft(t.phases, roles), phasesTouched: false })
    setActivePhaseKey(null)
  }

  const chooseMethod = (method: SdlcMethod) => {
    if (method === state.sdlcMethod) return
    if (state.phasesTouched) setPendingMethod(method)
    else applyMethod(method)
  }

  const goTo = async (step: WizardStep) => {
    if (step > state.step) {
      if (state.step === 1) {
        const errors = validateStepOne(state)
        setStepOneErrors(errors)
        if (Object.keys(errors).length) return
        const available = keyCheck.state === 'available' ? true : await checkKey(state.key)
        if (!available) {
          setStepOneErrors({ key: 'Project Key đã được dùng trong workspace' })
          return
        }
      }
      if (step >= 3 && clientIssues.length > 0) {
        update({ step: 2 })
        const first = state.phases[clientIssues[0].phaseIndex]
        if (first) setActivePhaseKey(first.key)
        return
      }
    }
    if (step > state.step) {
      setMaxCompletedStep((prev) => Math.max(prev, state.step))
    }
    update({ step })
    window.scrollTo?.({ top: 0 })
  }

  const updatePhase = (next: DraftPhase) => {
    setServerIssues(null)
    update({ phases: state.phases.map((p) => (p.key === next.key ? next : p)), phasesTouched: true })
  }

  const resetPhaseToTemplate = (phase: DraftPhase) => {
    const tp = template?.phases.find((p) => p.name === phase.name)
    if (!tp) return
    const [fresh] = templateToDraft([tp], roles)
    updatePhase({ ...fresh, key: phase.key, name: phase.name, description: phase.description })
  }

  const submit = async () => {
    setSubmitError(null)
    setServerIssues(null)
    setIsSubmitting(true)
    try {
      const project = await projectApi.create(ws.workspaceId, {
        name: state.name.trim(),
        key: state.key,
        description: state.description.trim() || undefined,
        sdlcMethod: state.sdlcMethod,
        aiEnabled: state.aiEnabled,
        phases: state.phases.map((p) => ({ name: p.name.trim(), description: p.description?.trim() || null, ...draftToPhaseBody(p) })),
        members: state.members,
      })
      clearDraft(user!.id, ws.workspaceId)
      navigate(`/projects/${project.projectId}`, { replace: true, state: { created: true } })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WORKFLOW_INVALID' && err.workflowIssues?.length) {
        setServerIssues(err.workflowIssues)
        const first = state.phases[err.workflowIssues[0].phaseIndex]
        if (first) setActivePhaseKey(first.key)
        update({ step: 2 })
      } else if (err instanceof ApiError && err.code === 'PROJECT_KEY_TAKEN') {
        setStepOneErrors({ key: apiErrorMessage(err) })
        setKeyCheck({ state: 'taken' })
        update({ step: 1 })
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.errors) {
        setStepOneErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
        update({ step: 1 })
      } else {
        setSubmitError(apiErrorMessage(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const discard = () => {
    clearDraft(user!.id, ws.workspaceId)
    navigate(`/workspaces/${ws.workspaceId}/projects`)
  }

  const savedLabel = savedAt ? new Date(savedAt).toLocaleTimeString('vi-VN') : null

  return (
    <DashboardLayout>
      {/* Thanh tiêu đề wizard (Figma frame 02) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link to={`/workspaces/${ws.workspaceId}/projects`} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800">
            <ArrowLeftIcon className="h-4 w-4" /> {ws.name}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-900">Tạo mới dự án</span>

        </div>
        {savedLabel && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-500">
            <CheckIcon className="h-3.5 w-3.5 text-brand-600" /> Đã lưu bản nháp: {savedLabel}
          </span>
        )}
      </div>

      {restoredAt && (
        <div className="mt-4">
          <Alert tone="info">
            Đã khôi phục bản nháp lưu lúc {new Date(restoredAt).toLocaleString('vi-VN')}.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                clearDraft(user!.id, ws.workspaceId)
                setRestoredAt(null)
                setMaxCompletedStep(0)
                                setStepOneErrors({})
                setKeyCheck({ state: 'idle' })
                setState(null) // effect khởi tạo lại từ mẫu Custom
              }}
            >
              Bỏ nháp, làm lại từ đầu
            </button>
          </Alert>
        </div>
      )}

      {/* Stepper */}
      <ol className="mt-4 grid grid-cols-1 gap-2 rounded-md border border-gray-200 bg-white p-3 md:grid-cols-3">
        {STEPS.map(({ step, title, description }) => {
          const isPassed = step <= maxCompletedStep
          const isActive = step === state.step
          return (
            <li key={step}>
              <button
                type="button"
                disabled={step > Math.max(state.step, maxCompletedStep + 1)}
                onClick={() => void goTo(step)}
                className={clsx(
                  'flex w-full gap-3 rounded-md border p-3 text-left transition-colors',
                  isActive ? 'border-brand-500 bg-brand-50/50' : 'border-transparent hover:bg-gray-50 disabled:hover:bg-transparent',
                )}
              >
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold',
                    isPassed ? 'bg-brand-600 text-white' : isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {isPassed ? <CheckIcon className="h-4 w-4" /> : String(step).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={clsx('text-sm font-semibold', isActive ? 'text-brand-700' : 'text-gray-800')}>
                      Bước {step}: {title}
                    </span>
                    <span
                      className={clsx(
                        'rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider',
                        isPassed ? 'bg-brand-100 text-brand-700 font-semibold' : isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {isPassed ? 'Done' : isActive ? 'In progress' : 'Pending'}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="mt-6">
        {state.step === 1 && (
          <StepProjectInfo
            state={state}
            update={(patch) => {
              setServerIssues(null)
              update(patch)
            }}
            templates={templates.data!}
            projectRoles={roles}
            errors={stepOneErrors}
            keyCheck={keyCheck}
            onKeyBlur={() => void checkKey(state.key)}
            onChooseMethod={chooseMethod}
          />
        )}

        {state.step === 2 && activePhase && (
          <section className="rounded-md border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">Pipeline engine / Transition governance</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-950">Configure Issue Status & Transitions</h2>
              <p className="mt-1 text-sm text-gray-500">
                Xác lập các trạng thái xử lý issue, trạng thái khởi tạo và ma trận phân quyền chuyển bước (State Machine) cho từng phase.
              </p>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-3 pt-2">
              {state.phases.map((phase, index) => {
                const count = issuesOf(index).length
                return (
                  <button
                    key={phase.key}
                    type="button"
                    onClick={() => setActivePhaseKey(phase.key)}
                    className={clsx(
                      '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-sm font-medium',
                      phase.key === activePhase.key ? 'border-brand-600 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-800',
                    )}
                  >
                    <span className="font-mono text-[10px] text-gray-400">P{index + 1}</span>
                    {phase.name}
                    {count > 0 ? (
                      <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">{count}</span>
                    ) : (
                      <CheckIcon className="h-3.5 w-3.5 text-brand-600" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                  Phase <span className="font-semibold text-gray-900">{activePhase.name}</span>
                  {activePhase.description && <span className="text-gray-400"> — {activePhase.description}</span>}
                </p>
                {template?.phases.some((p) => p.name === activePhase.name) && (
                  <Button type="button" variant="ghost" inline className="!h-8 !px-2 text-xs" onClick={() => resetPhaseToTemplate(activePhase)}>
                    Khôi phục theo mẫu {template.name}
                  </Button>
                )}
              </div>
              <PhaseWorkflowEditor
                phase={activePhase}
                onChange={updatePhase}
                roles={roles}
                issues={issuesOf(state.phases.indexOf(activePhase))}
              />

            </div>
          </section>
        )}

        {state.step === 3 && (
          <StepMembers
            state={state}
            update={update}
            me={user!}
            workspaceName={ws.name}
            workspaceMembers={members.data ?? []}
            projectRoles={roles}
            template={template}
            keyAvailable={keyCheck.state === 'available'}
            workflowValid={clientIssues.length === 0}
          />
        )}
      </div>

      {submitError && (
        <div className="mt-4">
          <Alert tone="error">{submitError}</Alert>
        </div>
      )}

      {/* Footer hành động (Figma frame 02–04) */}
      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          {state.step === 1 ? (
            <Button type="button" variant="ghost" inline onClick={() => setConfirmCancel(true)}>
              <CloseIcon className="h-4 w-4" /> Huỷ bỏ
            </Button>
          ) : (
            <Button type="button" variant="secondary" inline onClick={() => void goTo((state.step - 1) as WizardStep)}>
              <ArrowLeftIcon className="h-4 w-4" /> Back: {STEPS[state.step - 2].title}
            </Button>
          )}
          <span className="hidden font-mono text-[10px] text-gray-400 md:inline">Chỉ lưu nháp khi bấm 'Lưu bản nháp' (chưa gửi lên máy chủ).</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            inline
            onClick={() => {
              const at = saveDraft(user!.id, ws.workspaceId, state)
              setSavedAt(at)
              setRestoredAt(null)
                setMaxCompletedStep(0)
            }}
          >
            <DocumentIcon className="h-4 w-4" /> Lưu bản nháp
          </Button>
          {state.step < 3 ? (
            <Button type="button" inline onClick={() => void goTo((state.step + 1) as WizardStep)}>
              Next: {STEPS[state.step].title} <ArrowRightIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" inline isLoading={isSubmitting} onClick={() => void submit()}>
              Submit to Create Project
            </Button>
          )}
        </div>
      </div>
      {state.step === 2 && issues.length > 0 && (
        <p className="mt-2 text-right text-xs text-red-600">
          Còn {issues.length} lỗi workflow ở {new Set(issues.map((i) => i.phaseIndex)).size} phase — sửa xong mới sang bước 3.
        </p>
      )}

      <Modal
        open={pendingMethod !== null}
        onClose={() => setPendingMethod(null)}
        title="Đổi phương pháp SDLC?"
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setPendingMethod(null)}>
              Giữ cấu hình hiện tại
            </Button>
            <Button
              inline
              onClick={() => {
                applyMethod(pendingMethod!)
                setPendingMethod(null)
              }}
            >
              Áp dụng mẫu mới
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Phase, trạng thái và luật chuyển bạn đã chỉnh sẽ bị thay bằng mẫu{' '}
          <Badge>{templates.data?.find((t) => t.method === pendingMethod)?.name}</Badge>.
        </p>
      </Modal>

      <Modal
        open={confirmCancel}
        tone="danger"
        onClose={() => setConfirmCancel(false)}
        title="Huỷ tạo dự án?"
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setConfirmCancel(false)}>
              Tiếp tục soạn
            </Button>
            <Button inline onClick={discard} className="!bg-red-600 !shadow-none hover:!bg-red-700">
              Huỷ và xoá nháp
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Bản nháp của wizard sẽ bị xoá. Muốn giữ lại để làm tiếp sau, hãy bấm “Save as Draft” rồi rời trang.</p>
      </Modal>
    </DashboardLayout>
  )
}
