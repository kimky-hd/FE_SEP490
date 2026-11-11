import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, ErrorState, ForbiddenState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DocumentIcon } from '@/components/ui/icons'
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
import { tr, useI18n } from '@/i18n'
import { templateName } from '@/i18n/sdlc'
import type { SdlcMethod, WorkflowIssue } from '@/types/project'
import { PhaseWorkflowEditor } from '../PhaseWorkflowEditor'
import { StepProjectInfo, type KeyCheck } from './StepProjectInfo'
import { StepMembers } from './StepMembers'
import { clearDraft, loadDraft, saveDraft, validateStepOne, type WizardState, type WizardStep } from './wizardState'

// Wizard tạo dự án 3 bước — Figma hàng 2 frame 02 → 03 → 04 · Screen List #16 ("General Info → Workflow Template →
// Invite Members") · BF-02. Gửi 1 request duy nhất ở bước cuối (doc/Workspace-RBAC-API-Contract.md §10.4).

// Tạo lúc render để đổi ngôn ngữ là cập nhật ngay.
const getSteps = (): { step: WizardStep; title: string; description: string }[] => [
  {
    step: 1,
    title: tr('Dự án và giai đoạn', 'Project and phases'),
    description: tr('Tên, mã dự án và các giai đoạn làm việc.', 'Name, project key and work phases.'),
  },
  {
    step: 2,
    title: tr('Luồng issue', 'Issue workflow'),
    description: tr('Trạng thái của issue và ai được chuyển bước.', 'Issue statuses and who can move them.'),
  },
  {
    step: 3,
    title: tr('Thành viên', 'Members'),
    description: tr('Ai tham gia dự án và với vai trò gì.', 'Who joins the project and in what role.'),
  },
]

export function CreateProjectWizardPage() {
  const { t, lang } = useI18n()
  const workspaceId = Number(useParams().workspaceId)
  const navigate = useNavigate()
  const { user } = useAuth()

  const workspace = useAsync(() => workspaceApi.get(workspaceId), [workspaceId])
  const companyId = workspace.data?.companyId ?? null
  const canCreate = workspace.data ? hasPermission(workspace.data.myPermissions, PERMISSIONS.projectCreate) : false
  const templates = useAsync(() => (canCreate ? projectApi.templates() : Promise.resolve([])), [canCreate])
  const projectRoles = useAsync(
    () =>
      canCreate && companyId !== null
        ? roleApi.list(companyId, { scope: 'PROJECT', includeInactive: false })
        : Promise.resolve([]),
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
    // Mặc định Custom (tự tuỳ chỉnh giai đoạn); mẫu lấy từ BE GET /sdlc-templates, thiếu Custom thì lấy mẫu đầu tiên.
    const custom = templates.data!.find((x) => x.method === 'CUSTOM') ?? templates.data![0]
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

  const update = useCallback(
    (patch: Partial<WizardState>) => setState((prev) => (prev ? { ...prev, ...patch } : prev)),
    [],
  )

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
        if (id === keyRequest.current)
          setKeyCheck({ state: result.available ? 'available' : 'taken', suggestion: result.suggestion })
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
  const template = templates.data?.find((x) => x.method === state?.sdlcMethod)

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
        {isForbidden(workspace.error) ? (
          <ForbiddenState />
        ) : (
          <ErrorState message={apiErrorMessage(workspace.error)} onRetry={workspace.reload} />
        )}
      </DashboardLayout>
    )
  }
  if (!canCreate) {
    return (
      <DashboardLayout>
        <ForbiddenState
          message={t(
            `Bạn cần role có quyền “Tạo dự án” (project.create) trong workspace “${workspace.data.name}”, ví dụ Project Initiator.`,
            `You need a role with the “Create project” permission (project.create) in workspace “${workspace.data.name}”, such as Project Initiator.`,
          )}
        />
      </DashboardLayout>
    )
  }
  if (companyId === null) {
    return (
      <DashboardLayout>
        <Alert tone="info">
          {t(
            'Workspace này không thuộc công ty nào nên không tạo được dự án — role dự án được định nghĩa ở cấp công ty.',
            "This workspace isn't part of a company, so it can't hold projects — project roles are defined at the company level.",
          )}
        </Alert>
      </DashboardLayout>
    )
  }
  if (workspace.data.status === 'ARCHIVED') {
    return (
      <DashboardLayout>
        <Alert tone="warning">
          {t(
            'Workspace đã được lưu trữ, không tạo được dự án mới.',
            "The workspace is archived; new projects can't be created.",
          )}
        </Alert>
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
  const STEPS = getSteps()
  const roles = projectRoles.data ?? []
  const activePhase = state.phases.find((p) => p.key === activePhaseKey) ?? state.phases[0]
  const issuesOf = (phaseIndex: number) => issues.filter((i) => i.phaseIndex === phaseIndex)

  const applyMethod = (method: SdlcMethod) => {
    const chosen = templates.data!.find((x) => x.method === method)!
    setServerIssues(null)
    update({ sdlcMethod: method, phases: templateToDraft(chosen.phases, roles), phasesTouched: false })
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
          setStepOneErrors({
            key: t('Project Key đã được dùng trong workspace', 'This project key is already used in the workspace'),
          })
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
    // Chỉ khôi phục trạng thái & luật chuyển; điều kiện hoàn thành chọn ở bước 1 giữ nguyên.
    updatePhase({
      ...fresh,
      key: phase.key,
      name: phase.name,
      description: phase.description,
      exitCriteria: phase.exitCriteria,
    })
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
        phases: state.phases.map((p) => ({
          name: p.name.trim(),
          description: p.description?.trim() || null,
          exitCriteria: p.exitCriteria,
          ...draftToPhaseBody(p),
        })),
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

  const locale = lang === 'en' ? 'en-GB' : 'vi-VN'
  const savedLabel = savedAt ? new Date(savedAt).toLocaleTimeString(locale) : null

  return (
    <DashboardLayout>
      <PageHeader
        crumbs={[
          { label: ws.name, to: `/workspaces/${ws.workspaceId}/projects` },
          { label: t('Tạo mới dự án', 'New project') },
        ]}
        title={t('Tạo dự án mới', 'Create a project')}
        actions={
          savedLabel && (
            <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-gray-500">
              <CheckIcon className="h-4 w-4 text-success-600" aria-hidden="true" />{' '}
              {t('Đã lưu nháp lúc', 'Draft saved at')} {savedLabel}
            </span>
          )
        }
      />

      {restoredAt && (
        <div className="mt-6">
          <Alert tone="info">
            {t('Đã khôi phục bản nháp lưu lúc', 'Restored the draft saved at')}{' '}
            {new Date(restoredAt).toLocaleString(locale)}.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                clearDraft(user!.id, ws.workspaceId)
                setRestoredAt(null)
                setMaxCompletedStep(0)
                setStepOneErrors({})
                setKeyCheck({ state: 'idle' })
                setState(null) // effect khởi tạo lại từ mẫu Scrum
              }}
            >
              {t('Bỏ nháp, làm lại từ đầu', 'Discard draft and start over')}
            </button>
          </Alert>
        </div>
      )}

      {/* Stepper: chấm số + nhãn, xanh cho bước đang làm / đã xong. */}
      <ol
        aria-label={t('Các bước tạo dự án', 'Project creation steps')}
        className="mt-6 flex items-center gap-2 sm:gap-3"
      >
        {STEPS.map(({ step, title, description }, i) => {
          const isPassed = step <= maxCompletedStep && step !== state.step
          const isActive = step === state.step
          return (
            <li
              key={step}
              className={clsx('flex min-w-0 items-center gap-2 sm:gap-3', i < STEPS.length - 1 && 'flex-1')}
            >
              <button
                type="button"
                title={description}
                disabled={step > Math.max(state.step, maxCompletedStep + 1)}
                onClick={() => void goTo(step)}
                aria-current={isActive ? 'step' : undefined}
                className="group flex min-h-11 shrink-0 items-center gap-2 rounded-control pr-1 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed"
              >
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors',
                    isActive
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                      : isPassed
                        ? 'bg-brand-600 text-white'
                        : 'border border-gray-300 bg-white text-gray-500',
                  )}
                >
                  {isPassed ? <CheckIcon className="h-3.5 w-3.5" /> : step}
                </span>
                <span
                  className={clsx(
                    'whitespace-nowrap text-sm',
                    isActive
                      ? 'font-semibold text-gray-950'
                      : isPassed
                        ? 'font-medium text-gray-700 group-hover:text-gray-950'
                        : 'text-gray-500',
                    !isActive && 'hidden sm:inline',
                  )}
                >
                  {title}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={clsx('h-px min-w-4 flex-1', step <= maxCompletedStep ? 'bg-brand-600' : 'bg-gray-200')}
                />
              )}
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
          <Card>
            <div className="px-5 pt-5 sm:px-6">
              <h2 className="text-base font-semibold text-gray-950">{t('Luồng issue', 'Issue workflow')}</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {t(
                  'Trạng thái của issue trong từng giai đoạn và ai được chuyển bước.',
                  'Issue statuses in each phase and who can move them.',
                )}
              </p>
            </div>
            <div className="mt-4 flex gap-5 overflow-x-auto border-b border-gray-200 px-5 sm:px-6">
              {state.phases.map((phase, index) => {
                const count = issuesOf(index).length
                const isCurrent = phase.key === activePhase.key
                return (
                  <button
                    key={phase.key}
                    type="button"
                    aria-pressed={isCurrent}
                    onClick={() => setActivePhaseKey(phase.key)}
                    className={clsx(
                      '-mb-px flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-sm transition-colors',
                      isCurrent
                        ? 'border-brand-600 font-medium text-gray-950'
                        : 'border-transparent text-gray-600 hover:text-gray-950',
                    )}
                  >
                    {phase.name}
                    {count > 0 ? (
                      <span
                        className="rounded-full border border-red-200 bg-red-50 px-1.5 text-xs font-medium tabular-nums text-red-700"
                        aria-label={t(`${count} lỗi`, `${count} ${count === 1 ? 'error' : 'errors'}`)}
                      >
                        {count}
                      </span>
                    ) : (
                      <CheckIcon className="h-3.5 w-3.5 text-success-600" aria-label={t('Hợp lệ', 'Valid')} />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="p-5 sm:p-6">
              {/* Mô tả giai đoạn đã có ở bảng bước 1 nên không lặp lại ở đây; chỉ giữ nút khôi phục theo mẫu. */}
              {template?.phases.some((p) => p.name === activePhase.name) && (
                <div className="mb-5 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    inline
                    className="!px-2 text-sm lg:!h-8"
                    onClick={() => resetPhaseToTemplate(activePhase)}
                  >
                    {t('Khôi phục theo mẫu', 'Reset to template')} {templateName(template.method, template.name)}
                  </Button>
                </div>
              )}
              <PhaseWorkflowEditor
                phase={activePhase}
                onChange={updatePhase}
                roles={roles}
                issues={issuesOf(state.phases.indexOf(activePhase))}
              />
            </div>
          </Card>
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

      {/* Thanh hành động dính đáy: Quay lại (phụ) bên trái, Tiếp (chính) bên phải. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-6 mt-8 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:-mb-8 lg:rounded-b-card lg:px-10">
        {state.step === 2 && issues.length > 0 && (
          <p className="mb-2 text-sm text-red-700 sm:text-right" role="alert">
            {(() => {
              const phaseCount = new Set(issues.map((i) => i.phaseIndex)).size
              return t(
                `Còn ${issues.length} lỗi ở ${phaseCount} giai đoạn. Sửa xong mới sang bước 3.`,
                `${issues.length} ${issues.length === 1 ? 'error' : 'errors'} left in ${phaseCount} ${phaseCount === 1 ? 'phase' : 'phases'}. Fix them to continue to step 3.`,
              )
            })()}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {state.step === 1 ? (
            <Button type="button" variant="ghost" inline onClick={() => setConfirmCancel(true)}>
              {t('Huỷ bỏ', 'Cancel')}
            </Button>
          ) : (
            <Button type="button" variant="secondary" inline onClick={() => void goTo((state.step - 1) as WizardStep)}>
              <ArrowLeftIcon className="h-4 w-4" /> {t('Quay lại', 'Back')}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              inline
              title={t('Bản nháp chỉ lưu trên trình duyệt này.', 'Drafts are saved in this browser only.')}
              onClick={() => {
                const at = saveDraft(user!.id, ws.workspaceId, state)
                setSavedAt(at)
                setRestoredAt(null)
                setMaxCompletedStep(0)
              }}
            >
              <DocumentIcon className="h-4 w-4 sm:hidden" />{' '}
              <span className="sr-only sm:not-sr-only">{t('Lưu bản nháp', 'Save draft')}</span>
            </Button>
            {state.step < 3 ? (
              <Button type="button" inline onClick={() => void goTo((state.step + 1) as WizardStep)}>
                {t('Tiếp tục', 'Continue')} <ArrowRightIcon className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" inline isLoading={isSubmitting} onClick={() => void submit()}>
                {t('Tạo dự án', 'Create project')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={pendingMethod !== null}
        onClose={() => setPendingMethod(null)}
        title={t('Đổi phương pháp SDLC?', 'Change SDLC method?')}
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setPendingMethod(null)}>
              {t('Giữ cấu hình hiện tại', 'Keep current setup')}
            </Button>
            <Button
              inline
              onClick={() => {
                applyMethod(pendingMethod!)
                setPendingMethod(null)
              }}
            >
              {t('Áp dụng mẫu mới', 'Apply new template')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t(
            'Phase, trạng thái và luật chuyển bạn đã chỉnh sẽ bị thay bằng mẫu',
            'The phases, statuses and transitions you edited will be replaced by the template',
          )}{' '}
          <Badge>
            {pendingMethod &&
              templateName(pendingMethod, templates.data?.find((x) => x.method === pendingMethod)?.name ?? '')}
          </Badge>
          .
        </p>
      </Modal>

      <Modal
        open={confirmCancel}
        tone="danger"
        onClose={() => setConfirmCancel(false)}
        title={t('Huỷ tạo dự án?', 'Cancel project creation?')}
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setConfirmCancel(false)}>
              {t('Tiếp tục soạn', 'Keep editing')}
            </Button>
            <Button inline onClick={discard} className="!bg-red-600 !shadow-none hover:!bg-red-700">
              {t('Huỷ và xoá nháp', 'Cancel and delete draft')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t(
            'Bản nháp của wizard sẽ bị xoá. Muốn giữ lại để làm tiếp sau, hãy bấm “Lưu bản nháp” rồi rời trang.',
            'The wizard draft will be deleted. To continue later, click “Save draft” and then leave the page.',
          )}
        </p>
      </Modal>
    </DashboardLayout>
  )
}
