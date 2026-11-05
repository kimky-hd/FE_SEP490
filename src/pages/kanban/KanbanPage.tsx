import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { issueApi } from '@/api/issueApi'
import { cachedWorkflow } from '@/api/mockSupport'
import { useAuth } from '@/context/AuthContext'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { PlusIcon, SearchIcon } from '@/components/ui/icons'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { hasWorkPermission } from '@/lib/workPermissions'
import { allowedTargets, columnStatuses, isReviewStatus, type BoardStatus } from '@/lib/workflowBoard'
import { useI18n } from '@/i18n'
import { PERMISSIONS } from '@/types/rbac'
import type { BoardColumnDto, IssueSummaryDto, SprintDto, UserRef } from '@/types/issue'
import { Toast, useToast } from '../documents/view/Toast'
import { useProjectContext } from '../projects/ProjectLayout'
import { BacklogView } from './BacklogView'
import { IssueCreateModal, type IssueDefaults } from './IssueCreateModal'
import { IssueDrawer } from './IssueDrawer'
import { boardDefaults, kanbanDefaultView, type BoardChip, type BoardPrefs, type GroupBy } from './roleDefaults'
import { CompleteSprintModal, CreateSprintModal, FromReqModal } from './SprintDialogs'
import { PhasePipelineTracker } from '@/components/projects/PhasePipelineTracker'
import { getProjectPhases } from '@/lib/phaseGateEngine'
import {
  FilterChip,
  PersonDot,
  PriorityMark,
  readPref,
  ReqChip,
  Segmented,
  shortDate,
  TestBars,
  TypeIcon,
  writePref,
} from './workUi'

// /projects/:id/kanban (Board, mockup khung 1a) và /projects/:id/kanban/backlog (khung 1c). Chi tiết issue ở bảng phải
// (khung 1b, `?issue=KEY`). Kéo thả bằng HTML5 DnD; bàn phím đổi trạng thái qua ô "Trạng thái" trong bảng chi tiết.

export interface KanbanData {
  columns: BoardColumnDto[]
  statuses: BoardStatus[]
  activeSprint: SprintDto | null
  sprints: SprintDto[]
  issues: IssueSummaryDto[]
  assignees: UserRef[]
}

export function KanbanPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { project, role, can, isArchived } = useProjectContext()
  const projectId = project.projectId
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view: 'board' | 'backlog' = /\/kanban\/backlog\/?$/.test(location.pathname) ? 'backlog' : 'board'
  const me: UserRef | null = user ? { userId: user.id, fullName: user.fullName } : null
  const { toast, notify } = useToast()

  // Mở /kanban lần đầu: vai trò PM (hoặc lựa chọn lần trước) vào Backlog.
  const redirected = useRef(false)
  useEffect(() => {
    if (redirected.current || view !== 'board' || params.get('issue')) return
    redirected.current = true
    const pref = readPref<'board' | 'backlog'>(projectId, 'kanbanView') ?? kanbanDefaultView(role)
    if (pref === 'backlog') navigate(`/projects/${projectId}/kanban/backlog${location.search}`, { replace: true })
  }, [view, params, projectId, role, navigate, location.search])

  const board = useAsync(() => issueApi.board(projectId), [projectId])
  const issuesQ = useAsync(() => issueApi.list(projectId), [projectId])
  const sprintsQ = useAsync(() => issueApi.sprints(projectId), [projectId])
  const assigneesQ = useAsync(() => issueApi.assignees(projectId).catch(() => [] as UserRef[]), [projectId])

  const canCreate = !isArchived && can(PERMISSIONS.issueCreate)
  const canSprint = !isArchived && hasWorkPermission(project.myPermissions, PERMISSIONS.sprintManage)
  const [createOpen, setCreateOpen] = useState<IssueDefaults | null>(null)
  const [completing, setCompleting] = useState<SprintDto | null>(null)
  const [sprintOpen, setSprintOpen] = useState(false)
  const [phaseSlot, setPhaseSlot] = useState<HTMLElement | null>(null)
  const [fromReq, setFromReq] = useState(false)

  // Ctrl K → "Tạo issue" mở thẳng hộp tạo.
  useEffect(() => {
    if (params.get('new') !== 'issue') return
    if (canCreate) setCreateOpen({})
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams, canCreate])

  // D14: trạng thái lấy thẳng từ cột board (có `isInitial`); GET /workflow chỉ dùng cho luật kéo thả.
  const statuses = useMemo(() => (board.data ? columnStatuses(board.data.columns) : []), [board.data])
  const data: KanbanData | null =
    board.data && issuesQ.data && sprintsQ.data
      ? {
          columns: board.data.columns,
          statuses,
          activeSprint: board.data.activeSprint,
          sprints: sprintsQ.data,
          issues: issuesQ.data,
          assignees: assigneesQ.data ?? [],
        }
      : null

  const issueKey = params.get('issue')
  const openIssue = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(params)
      if (key) next.set('issue', key)
      else next.delete('issue')
      setParams(next)
    },
    [params, setParams],
  )
  const [drawerId, setDrawerId] = useState<number | null>(null)
  useEffect(() => {
    if (!issueKey) return setDrawerId(null)
    const hit = issuesQ.data?.find((i) => i.key.toUpperCase() === issueKey.toUpperCase())
    if (hit) return setDrawerId(hit.issueId)
    let alive = true
    issueApi
      .list(projectId, { search: issueKey })
      .then(
        (list) =>
          alive && setDrawerId(list.find((i) => i.key.toUpperCase() === issueKey.toUpperCase())?.issueId ?? null),
      )
      .catch(() => alive && setDrawerId(null))
    return () => {
      alive = false
    }
  }, [issueKey, issuesQ.data, projectId])

  const switchView = (v: 'board' | 'backlog') => {
    writePref(projectId, 'kanbanView', v)
    navigate(`/projects/${projectId}/kanban${v === 'backlog' ? '/backlog' : ''}`)
  }

  const error = board.error ?? issuesQ.error ?? sprintsQ.error
  const active = data?.activeSprint ?? null
  const daysLeft = active?.endDate
    ? Math.ceil((new Date(`${active.endDate}T23:59:59`).getTime() - Date.now()) / 86_400_000)
    : null
  const openInActive = active
    ? (data?.issues ?? []).filter(
        (i) =>
          i.sprintId === active.sprintId &&
          i.parentId === null &&
          statuses.find((s) => s.statusId === i.statusId)?.category !== 'DONE',
      ).length
    : 0

  return (
    <div className="-mt-2 lg:-mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
        <Segmented
          label={t('Chế độ xem', 'View')}
          value={view}
          onChange={switchView}
          options={[
            { value: 'board', label: 'Board' },
            { value: 'backlog', label: 'Backlog' },
          ]}
        />
        {view === 'board' && active && (
          <span className="text-[13px] text-gray-500">
            {active.name} · {shortDate(active.startDate)} – {shortDate(active.endDate)}
            {daysLeft !== null && daysLeft >= 0 ? t(` · còn ${daysLeft} ngày`, ` · ${daysLeft} days left`) : ''}
          </span>
        )}
        <span ref={setPhaseSlot} className="contents" />
        <span className="flex-1" />
        {view === 'board' && active && canSprint && (
          <Button inline variant="secondary" onClick={() => setCompleting(active)}>
            {t('Hoàn tất sprint', 'Complete sprint')}
          </Button>
        )}
        {view === 'backlog' && canCreate && (
          <Button inline variant="secondary" onClick={() => setFromReq(true)}>
            {t('Tạo issue từ REQ', 'Issues from REQs')}
          </Button>
        )}
        {view === 'backlog' && canSprint && (
          <Button inline onClick={() => setSprintOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            {t('Tạo sprint', 'Create sprint')}
          </Button>
        )}
        {canCreate && view === 'board' && (
          <Button inline onClick={() => setCreateOpen({})}>
            <PlusIcon className="h-4 w-4" />
            {t('Tạo issue', 'Create issue')}
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState
          message={apiErrorMessage(error)}
          onRetry={() => void (board.reload(), issuesQ.reload(), sprintsQ.reload())}
        />
      ) : !data ? (
        <LoadingBlock />
      ) : view === 'board' ? (
        <BoardView
          data={data}
          setIssues={(fn) => issuesQ.setData((prev) => (prev ? fn(prev) : prev))}
          me={me}
          selectedId={drawerId}
          onOpen={(i) => openIssue(i.key)}
          onCreate={canCreate ? (d) => setCreateOpen(d) : null}
          notify={notify}
          phaseSlot={phaseSlot}
        />
      ) : (
        <BacklogView
          data={data}
          setIssues={(fn) => issuesQ.setData((prev) => (prev ? fn(prev) : prev))}
          onOpen={(i) => openIssue(i.key)}
          notify={notify}
          canCreate={canCreate}
          canSprint={canSprint}
          onCreate={(d) => setCreateOpen(d)}
          onComplete={setCompleting}
        />
      )}

      {data && drawerId !== null && (
        <IssueDrawer
          projectId={projectId}
          issueId={drawerId}
          statuses={data.statuses}
          sprints={data.sprints}
          assignees={data.assignees}
          me={me}
          onClose={() => openIssue(null)}
          notify={notify}
        />
      )}
      {data && (
        <IssueCreateModal
          open={createOpen !== null}
          onClose={() => setCreateOpen(null)}
          projectId={projectId}
          sprints={data.sprints}
          assignees={data.assignees}
          canAssign={can(PERMISSIONS.issueAssign)}
          me={me}
          defaults={createOpen ?? undefined}
          onCreated={(i) => notify(t(`Đã tạo ${i.key}`, `${i.key} created`))}
        />
      )}
      {data && (
        <CompleteSprintModal
          sprint={completing}
          sprints={data.sprints}
          openCount={openInActive}
          onClose={() => setCompleting(null)}
          onDone={(m) => notify(m)}
        />
      )}
      {data && (
        <CreateSprintModal
          open={sprintOpen}
          projectId={projectId}
          sprints={data.sprints}
          onClose={() => setSprintOpen(false)}
          onDone={(m) => notify(m)}
        />
      )}
      {data && (
        <FromReqModal
          open={fromReq}
          projectId={projectId}
          issues={data.issues}
          sprints={data.sprints}
          onClose={() => setFromReq(false)}
          onDone={(m) => notify(m)}
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}

// ---------- Board ----------

const isBlocked = (i: IssueSummaryDto) =>
  i.labels.some((l) => l.toLowerCase() === 'blocked') || (i.priority === 'HIGHEST' && i.tests.fail > 0)

interface DragState {
  issueId: number
  fromStatusId: number
  allowed: Set<number>
}

function BoardView({
  data,
  setIssues,
  me,
  selectedId,
  onOpen,
  onCreate,
  notify,
  phaseSlot,
}: {
  data: KanbanData
  setIssues: (fn: (prev: IssueSummaryDto[]) => IssueSummaryDto[]) => void
  me: UserRef | null
  phaseSlot: HTMLElement | null
  selectedId: number | null
  onOpen: (i: IssueSummaryDto) => void
  onCreate: ((d: IssueDefaults) => void) | null
  notify: (text: string, tone?: 'ok' | 'error') => void
}) {
  const { t } = useI18n()
  const { project, role, isArchived } = useProjectContext()
  const projectId = project.projectId
  const canMove = !isArchived && hasWorkPermission(project.myPermissions, PERMISSIONS.issueChangeStatus)
  // Luật chuyển (WorkflowTransitions) chỉ có ở GET /workflow — chỉ tải khi được kéo thả đổi trạng thái.
  const workflow = useAsync(
    () => (canMove ? cachedWorkflow(projectId).catch(() => null) : Promise.resolve(null)),
    [projectId, canMove],
  )
  const defaults = boardDefaults(role)
  const [prefs, setPrefs] = useState<BoardPrefs>(() => readPref<BoardPrefs>(projectId, 'board') ?? defaults)
  const [people, setPeople] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState<number | 'all' | null>(() => readPref<number | 'all'>(projectId, 'phase'))
  const savePrefs = (next: BoardPrefs) => {
    setPrefs(next)
    writePref(projectId, 'board', next)
  }
  const toggleChip = (c: BoardChip) =>
    savePrefs({ ...prefs, chips: prefs.chips.includes(c) ? prefs.chips.filter((x) => x !== c) : [...prefs.chips, c] })

  const { statuses, columns, activeSprint } = data
  const canRank = !isArchived && hasWorkPermission(project.myPermissions, PERMISSIONS.issueUpdate)
  const projectPhases = useMemo(() => getProjectPhases(projectId), [projectId])

  // Board = sprint đang chạy (dự án không dùng sprint: mọi issue), chỉ issue cha.
  const sprintIssues = useMemo(
    () =>
      data.issues.filter((i) => i.parentId === null && (activeSprint ? i.sprintId === activeSprint.sprintId : true)),
    [data.issues, activeSprint],
  )
  const phases = useMemo(() => {
    if (projectPhases.length > 0) {
      return projectPhases.map((ph) => [ph.id, `P${ph.order}: ${ph.name}`] as [string | number, string])
    }
    return [...new Map(columns.map((c) => [c.phaseId, c.phaseName])).entries()]
  }, [projectPhases, columns])

  // Nhiều phase: mặc định 'all'
  const currentPhase = phase ?? 'all'
  const shownColumns = useMemo(() => {
    if (currentPhase === 'all') return columns
    const matchedPh = projectPhases.find((p) => String(p.id) === String(currentPhase) || Number(p.id) === Number(currentPhase))
    if (!matchedPh) return columns.filter((c) => String(c.phaseId) === String(currentPhase))
    const statusIds = new Set(matchedPh.statuses.map((s) => s.statusId))
    const filtered = columns.filter((c) => String(c.phaseId) === String(matchedPh.id) || statusIds.has(c.statusId))
    return filtered.length > 0 ? filtered : columns
  }, [columns, currentPhase, projectPhases])

  const counts = {
    mine: sprintIssues.filter((i) => i.assignee?.userId === me?.userId).length,
    reqChanged: sprintIssues.filter((i) => i.reqChanged).length,
    blocked: sprintIssues.filter(isBlocked).length,
  }
  const needle = search.trim().toLocaleLowerCase('vi')
  const visible = sprintIssues.filter((i) => {
    if (currentPhase !== 'all') {
      const matchedPh = projectPhases.find((p) => String(p.id) === String(currentPhase) || Number(p.id) === Number(currentPhase))
      if (matchedPh) {
        const inThisPhase =
          (i.phaseId !== undefined && (String(i.phaseId) === String(matchedPh.id) || Number(i.phaseId) === Number(matchedPh.id))) ||
          (i.phaseOrder !== undefined && Number(i.phaseOrder) === Number(matchedPh.order)) ||
          matchedPh.statuses.some((s) => s.statusId === i.statusId)
        if (!inThisPhase) return false
      }
    }
    if (prefs.chips.includes('mine') && i.assignee?.userId !== me?.userId) return false
    if (prefs.chips.includes('reqChanged') && !i.reqChanged) return false
    if (prefs.chips.includes('bug') && i.type !== 'BUG') return false
    if (prefs.chips.includes('design') && i.type !== 'DESIGN') return false
    if (prefs.chips.includes('qa') && !isReviewStatus(statuses, i.statusId)) return false
    if (prefs.chips.includes('blocked') && !isBlocked(i)) return false
    if (people.length && !people.includes(i.assignee?.userId ?? 0)) return false
    if (needle && !i.key.toLocaleLowerCase('vi').includes(needle) && !i.title.toLocaleLowerCase('vi').includes(needle))
      return false
    return true
  })

  // Làn (swimlane) theo người / REQ.
  const lanes = useMemo(() => {
    if (prefs.groupBy === 'none') return [{ key: 'all', header: null as null | JSX.Element, issues: visible }]
    const map = new Map<string, { key: string; order: string; header: JSX.Element; issues: IssueSummaryDto[] }>()
    for (const i of visible) {
      let key: string
      let order: string
      let header: JSX.Element
      if (prefs.groupBy === 'person') {
        key = i.assignee ? `u${i.assignee.userId}` : 'none'
        order = i.assignee?.userId === me?.userId ? '0' : i.assignee ? `1${i.assignee.fullName}` : '￿'
        header = (
          <>
            <PersonDot user={i.assignee} size={22} />
            {i.assignee?.fullName ?? t('Chưa giao', 'Unassigned')}
          </>
        )
      } else {
        const r = i.requirements[0]
        key = r ? `${r.documentId}:${r.reqUid}` : 'none'
        order = r ? `${r.documentCode}${(r.reqKey ?? '').padStart(8, '0')}` : '￿'
        header = r ? (
          <>
            <ReqChip req={r} />
            <span className="text-gray-500">{r.documentCode}</span>
            {r.title}
          </>
        ) : (
          <>{t('Chưa gắn REQ', 'No REQ')}</>
        )
      }
      const lane = map.get(key) ?? { key, order, header, issues: [] }
      lane.issues.push(i)
      map.set(key, lane)
    }
    return [...map.values()].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
  }, [visible, prefs.groupBy, me?.userId, t])

  // ---------- Kéo thả ----------
  const [drag, setDrag] = useState<DragState | null>(null)
  const [over, setOver] = useState<{ statusId: number; lane: string; index: number } | null>(null)

  const startDrag = (e: DragEvent, i: IssueSummaryDto) => {
    if (!canMove && !canRank) return e.preventDefault()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', i.key)
    const allowed =
      workflow.data && canMove
        ? allowedTargets(workflow.data, i.statusId, {
            roleId: project.myRole?.roleId ?? null,
            permissions: project.myPermissions,
          })
        : []
    setDrag({ issueId: i.issueId, fromStatusId: i.statusId, allowed: new Set(allowed) })
  }
  const canDropOn = (statusId: number) =>
    !!drag && (statusId === drag.fromStatusId ? canRank : drag.allowed.has(statusId))

  const dragOverCell = (e: DragEvent<HTMLDivElement>, statusId: number, lane: string) => {
    if (!canDropOn(statusId)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const cards = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-card]')].filter(
      (el) => Number(el.dataset.card) !== drag?.issueId,
    )
    let index = cards.length
    for (let k = 0; k < cards.length; k++) {
      const r = cards[k].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) {
        index = k
        break
      }
    }
    if (over?.statusId !== statusId || over.lane !== lane || over.index !== index) setOver({ statusId, lane, index })
  }

  const drop = async (statusId: number, laneIssues: IssueSummaryDto[]) => {
    const d = drag
    const target = over
    setDrag(null)
    setOver(null)
    if (!d || !target || !canDropOn(statusId)) return
    const cell = laneIssues.filter((i) => i.statusId === statusId && i.issueId !== d.issueId)
    const after = target.index > 0 ? (cell[target.index - 1]?.issueId ?? null) : null
    const before = data.issues
    const moved = before.find((i) => i.issueId === d.issueId)
    if (!moved) return
    if (statusId === d.fromStatusId) {
      const pos = laneIssues.filter((i) => i.statusId === statusId).findIndex((i) => i.issueId === d.issueId)
      if (pos === target.index) return
    }
    // Lạc quan: đổi ngay trên màn hình, lỗi thì trả lại và báo.
    setIssues((prev) => {
      const rest = prev.filter((i) => i.issueId !== d.issueId)
      const at = after === null ? 0 : rest.findIndex((i) => i.issueId === after) + 1
      rest.splice(at, 0, { ...moved, statusId })
      return rest
    })
    try {
      if (statusId === d.fromStatusId) await issueApi.rank(d.issueId, { afterIssueId: after })
      else await issueApi.transition(d.issueId, { toStatusId: statusId, rankAfterIssueId: after })
    } catch (err) {
      setIssues(() => before)
      notify(apiErrorMessage(err), 'error')
    }
  }

  // Lưới: các cột cùng một lưới để làn thẳng hàng; nhóm phase = nhãn mảnh phía trên.
  const gridStyle = { gridTemplateColumns: `repeat(${shownColumns.length}, minmax(264px, 1fr))` }
  const initialStatus =
    statuses.find((s) => s.isInitial && shownColumns.some((c) => c.statusId === s.statusId))?.statusId ??
    shownColumns[0]?.statusId
  const showPhaseLabels = currentPhase === 'all' && phases.length > 1

  return (
    <div className="space-y-3">
      <PhasePipelineTracker projectId={projectId} sdlcMethod={project.sdlcMethod} />

      {phaseSlot &&
        createPortal(
          phases.length > 1 && (
            <select
              aria-label={t('Giai đoạn', 'Phase')}
              value={String(currentPhase)}
              onChange={(e) => {
                const v = e.target.value === 'all' ? 'all' : Number(e.target.value)
                setPhase(v)
                writePref(projectId, 'phase', v)
              }}
              className="h-9 rounded-control border border-gray-300 bg-white px-2 text-[13px] text-gray-800 shadow-xs focus:outline-none focus:ring-4 focus:ring-brand-100 lg:h-8"
            >
              <option value="all">{t('Mọi giai đoạn', 'All phases')}</option>
              {phases.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          ),
          phaseSlot,
        )}
      <div className="flex flex-col gap-2 border-y border-gray-200 py-2.5">
        {/* Phase Filter Pills */}
        {projectPhases.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <span className="text-xs font-medium text-gray-500 mr-1">{t('Giai đoạn:', 'Phase:')}</span>
            <button
              type="button"
              onClick={() => {
                setPhase('all')
                writePref(projectId, 'phase', 'all')
              }}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                currentPhase === 'all'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              {t('Tất cả', 'All')} ({sprintIssues.length})
            </button>
            {projectPhases.map((ph) => {
              const count = sprintIssues.filter(
                (i) =>
                  (i.phaseId !== undefined && (String(i.phaseId) === String(ph.id) || Number(i.phaseId) === Number(ph.id))) ||
                  (i.phaseOrder !== undefined && Number(i.phaseOrder) === Number(ph.order)) ||
                  ph.statuses.some((s) => s.statusId === i.statusId),
              ).length
              const active =
                currentPhase !== 'all' &&
                (String(currentPhase) === String(ph.id) || Number(currentPhase) === Number(ph.id))
              return (
                <button
                  key={ph.id}
                  type="button"
                  onClick={() => {
                    const targetId = ph.id
                    setPhase(targetId as any)
                    writePref(projectId, 'phase', targetId)
                  }}
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                  )}
                  title={ph.name}
                >
                  <span>P{ph.order}: {ph.name}</span>
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.2 text-[10px]',
                      active ? 'bg-brand-700 text-white' : 'bg-gray-200 text-gray-700',
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative">
          <span className="sr-only">{t('Tìm issue', 'Search issues')}</span>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Tìm issue…', 'Search issues…')}
            className="h-9 w-44 rounded-control border border-gray-300 pl-8 pr-2 text-[13px] placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:w-52 lg:h-8"
          />
        </label>
        <div className="flex items-center" role="group" aria-label={t('Lọc theo người làm', 'Filter by assignee')}>
          {data.assignees.slice(0, 7).map((u, idx) => {
            const on = people.includes(u.userId)
            return (
              <button
                key={u.userId}
                type="button"
                aria-pressed={on}
                aria-label={u.fullName}
                title={u.fullName}
                onClick={() => setPeople((p) => (on ? p.filter((x) => x !== u.userId) : [...p, u.userId]))}
                className={clsx(
                  'relative rounded-full',
                  idx > 0 && '-ml-1.5',
                  on ? 'z-10 ring-2 ring-brand-600 ring-offset-2' : 'ring-2 ring-white',
                )}
              >
                <PersonDot user={u} size={26} />
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={prefs.chips.includes('mine')}
            roleDefault={defaults.chips.includes('mine')}
            count={counts.mine}
            onClick={() => toggleChip('mine')}
          >
            {t('Của tôi', 'Mine')}
          </FilterChip>
          <FilterChip
            active={prefs.chips.includes('reqChanged')}
            count={counts.reqChanged}
            onClick={() => toggleChip('reqChanged')}
          >
            {t('REQ vừa đổi', 'REQ changed')}
          </FilterChip>
          <FilterChip active={prefs.chips.includes('bug')} onClick={() => toggleChip('bug')}>
            Bug
          </FilterChip>
          {(role === 'DESIGNER' || prefs.chips.includes('design')) && (
            <FilterChip
              active={prefs.chips.includes('design')}
              roleDefault={defaults.chips.includes('design')}
              onClick={() => toggleChip('design')}
            >
              {t('Thiết kế', 'Design')}
            </FilterChip>
          )}
          <FilterChip
            active={prefs.chips.includes('qa')}
            roleDefault={defaults.chips.includes('qa')}
            onClick={() => toggleChip('qa')}
          >
            {t('Cần QA', 'Needs QA')}
          </FilterChip>
          <FilterChip
            active={prefs.chips.includes('blocked')}
            count={counts.blocked}
            onClick={() => toggleChip('blocked')}
          >
            {t('Đang bị chặn', 'Blocked')}
          </FilterChip>
        </div>
        <span className="flex-1" />
        <span className="hidden text-[13px] text-gray-500 sm:inline">{t('Nhóm theo:', 'Group by:')}</span>
        <Segmented<GroupBy>
          label={t('Nhóm theo', 'Group by')}
          value={prefs.groupBy}
          onChange={(groupBy) => savePrefs({ ...prefs, groupBy })}
          options={[
            { value: 'none', label: t('Không', 'None') },
            { value: 'person', label: t('Người', 'People') },
            { value: 'req', label: 'REQ' },
          ]}
        />
        </div>
      </div>

      <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-card lg:bg-gray-50 lg:p-3">
        <div className="grid gap-x-3" style={gridStyle}>
          {showPhaseLabels &&
            phases.map(([id, name]) => {
              const span = shownColumns.filter((c) => c.phaseId === id).length
              return span ? (
                <div
                  key={id}
                  style={{ gridColumn: `span ${span}` }}
                  className="flex items-center gap-2 pb-2 text-[11.5px] font-medium uppercase tracking-wide text-gray-500"
                >
                  {name}
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              ) : null
            })}
          {shownColumns.map((c) => {
            const n = visible.filter((i) => i.statusId === c.statusId).length
            const total = sprintIssues.filter((i) => i.statusId === c.statusId).length
            const full = c.wipLimit !== null && total >= c.wipLimit
            return (
              <div
                key={c.statusId}
                className={clsx(
                  'flex items-center gap-2 bg-gray-100 px-3.5 pt-2.5',
                  lanes[0]?.header ? 'mb-1 rounded-card pb-2.5' : 'rounded-t-card pb-1',
                  ' text-[12.5px] font-semibold uppercase tracking-[0.02em] text-gray-600',
                  drag && !canDropOn(c.statusId) && 'opacity-50',
                )}
              >
                <span className="truncate">{c.name}</span>
                <span className="font-medium text-gray-500">{n}</span>
                <span
                  className={clsx(
                    'ml-auto whitespace-nowrap text-[11.5px] font-medium normal-case',
                    full ? (total > (c.wipLimit ?? 0) ? 'text-red-700' : 'text-amber-700') : 'text-gray-400',
                  )}
                  title={t('Giới hạn WIP', 'WIP limit')}
                >
                  {c.wipLimit !== null
                    ? t(`giới hạn ${c.wipLimit}`, `limit ${c.wipLimit}`)
                    : c.category === 'DONE'
                      ? ''
                      : '∞'}
                </span>
              </div>
            )
          })}
          {lanes.map((lane) => (
            <LaneRow key={lane.key}>
              {lane.header && (
                <div className="col-span-full flex items-center gap-2 px-0.5 pb-1.5 pt-3 text-[13px] font-medium text-gray-700">
                  {lane.header}
                  <span className="font-normal text-gray-400">{lane.issues.length}</span>
                </div>
              )}
              {shownColumns.map((c) => {
                const cell = lane.issues.filter((i) => i.statusId === c.statusId)
                const dropping = over && over.statusId === c.statusId && over.lane === lane.key
                const blocked = drag && !canDropOn(c.statusId)
                return (
                  <div
                    key={c.statusId}
                    onDragOver={(e) => dragOverCell(e, c.statusId, lane.key)}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        setOver((o) => (o && o.statusId === c.statusId && o.lane === lane.key ? null : o))
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      void drop(c.statusId, lane.issues)
                    }}
                    aria-label={c.name}
                    className={clsx(
                      'min-h-[72px] space-y-2 bg-gray-100 p-2 transition-colors',
                      lane.header ? 'rounded-card' : 'rounded-b-card',
                      blocked && 'opacity-50',
                      drag && !blocked && 'ring-1 ring-inset ring-brand-200',
                      dropping && 'bg-brand-50',
                    )}
                  >
                    {cell.map((i, idx) => (
                      <div key={i.issueId}>
                        {dropping && over.index === idx && <DropLine />}
                        <IssueCard
                          issue={i}
                          mine={i.assignee?.userId === me?.userId}
                          selected={selectedId === i.issueId}
                          dragging={drag?.issueId === i.issueId}
                          draggable={canMove || canRank}
                          onDragStart={(e) => startDrag(e, i)}
                          onDragEnd={() => (setDrag(null), setOver(null))}
                          onOpen={() => onOpen(i)}
                        />
                      </div>
                    ))}
                    {dropping && over.index >= cell.filter((x) => x.issueId !== drag?.issueId).length && <DropLine />}
                    {cell.length === 0 && c.category === 'DONE' && lane.key === 'all' && !drag && (
                      <p className="px-1.5 py-1 text-[13px] text-gray-500">
                        {t('Issue xong trong sprint sẽ nằm đây.', 'Issues finished this sprint land here.')}
                      </p>
                    )}
                    {onCreate && c.statusId === initialStatus && lane.key === 'all' && (
                      <button
                        type="button"
                        onClick={() => onCreate({ statusId: c.statusId, defaultPhaseId: c.phaseId })}
                        className="flex w-full items-center gap-1 rounded-[6px] px-1.5 py-1 text-left text-[13px] text-gray-500 hover:bg-gray-200/60 hover:text-gray-800"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        {t('Tạo issue', 'Create issue')}
                      </button>
                    )}
                  </div>
                )
              })}
            </LaneRow>
          ))}
        </div>
        {visible.length === 0 && sprintIssues.length > 0 && (
          <p className="mt-3 text-center text-[13px] text-gray-500">
            {t('Không có issue khớp bộ lọc.', 'No issues match the filters.')}{' '}
            <button
              type="button"
              className="font-medium text-brand-700 hover:underline"
              onClick={() => (savePrefs({ ...prefs, chips: [] }), setPeople([]), setSearch(''))}
            >
              {t('Bỏ lọc', 'Clear filters')}
            </button>
          </p>
        )}
        {sprintIssues.length === 0 && (
          <p className="mt-3 text-center text-[13px] text-gray-500">
            {activeSprint
              ? t(
                  'Sprint đang chạy chưa có issue. Kéo issue vào sprint ở Backlog.',
                  'The active sprint has no issues yet. Plan it in the Backlog.',
                )
              : t('Chưa có issue nào.', 'No issues yet.')}
          </p>
        )}
      </div>
      <p className="sr-only">
        {t(
          'Kéo thẻ để đổi trạng thái; hoặc mở thẻ và đổi ở ô Trạng thái.',
          'Drag a card to change its status, or open it and use the Status field.',
        )}
      </p>
    </div>
  )
}

const LaneRow = ({ children }: { children: React.ReactNode }) => <>{children}</>

const DropLine = () => <div aria-hidden="true" className="mb-2 h-0.5 rounded-full bg-brand-500" />

function IssueCard({
  issue: i,
  mine,
  selected,
  dragging,
  draggable,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  issue: IssueSummaryDto
  mine: boolean
  selected: boolean
  dragging: boolean
  draggable: boolean
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onOpen: () => void
}) {
  const { t } = useI18n()
  return (
    <div
      data-card={i.issueId}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`${i.key} · ${i.title}`}
      className={clsx(
        'relative cursor-pointer rounded-[10px] border bg-white px-3 py-2.5 text-[13.5px] shadow-xs transition-shadow hover:border-gray-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
        selected ? 'border-brand-500 ring-[3px] ring-brand-100' : 'border-gray-200',
        mine && 'shadow-[inset_3px_0_0_#2f5bea,0_1px_2px_rgba(16,24,40,0.05)]',
        dragging && 'opacity-40',
      )}
    >
      <p className="font-medium leading-snug text-gray-950">{i.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs text-gray-500">
        <TypeIcon type={i.type} />
        <span className="mr-0.5">{i.key}</span>
        {(i.phaseOrder || i.phaseName) && (
          <span
            className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
            title={i.phaseName ?? undefined}
          >
            {i.phaseOrder ? `P${i.phaseOrder}` : ''}
            {i.phaseOrder && i.phaseName ? ' · ' : ''}
            {i.phaseName ? (i.phaseName.length > 18 ? `${i.phaseName.slice(0, 16)}…` : i.phaseName) : ''}
          </span>
        )}
        {i.requirements.slice(0, 2).map((r) => (
          <ReqChip key={`${r.documentId}-${r.reqUid}`} req={r} />
        ))}
        {i.requirements.length > 2 && <span>+{i.requirements.length - 2}</span>}
        <span className="flex-1" />
        <TestBars tests={i.tests} />
        {i.subtaskCount > 0 && (
          <span title={t('Việc con xong', 'Subtasks done')}>
            {i.subtaskDone}/{i.subtaskCount}
          </span>
        )}
        <PriorityMark priority={i.priority} />
        {i.points !== null && (
          <span className="tabular-nums" title={t('Điểm', 'Points')}>
            {i.points}
          </span>
        )}
        <PersonDot user={i.assignee} size={20} className="ml-0.5" />
      </div>
    </div>
  )
}
