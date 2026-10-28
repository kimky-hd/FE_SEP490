import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { issueApi } from '@/api/issueApi'
import { documentApi } from '@/api/documentApi'
import { projectApi } from '@/api/projectApi'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/lib/useAsync'
import { formatDate } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { SelectField } from '@/components/ui/SelectField'
import { Button } from '@/components/ui/Button'
import { useProjectContext } from './ProjectLayout'
import type {
  BugSeverity,
  IssuePriority,
  IssueType,
  ProjectIssue,
} from '@/types/issue'
import type { PhaseDto, StatusCategory, WorkflowStatusDto } from '@/types/project'
import type { SpecificationDocument } from '@/types/document'

// --- ICONS CHUẨN JIRA ---

function JiraTaskIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={clsx('inline-flex items-center justify-center rounded bg-blue-600 text-white shadow-2xs shrink-0', className)}
      title="Task (Công việc)"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

function JiraBugIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={clsx('inline-flex items-center justify-center rounded-full bg-rose-600 text-white shadow-2xs shrink-0', className)}
      title="Bug (Lỗi phần mềm)"
    >
      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 13h-2.1c-.2-.6-.5-1.2-.9-1.7l1.7-1.7-1.4-1.4-1.9 1.9C13.6 9.4 12.8 9 12 9s-1.6.4-2.4 1.1L7.7 8.2 6.3 9.6l1.7 1.7c-.4.5-.7 1.1-.9 1.7H5v2h2.1c.1.6.4 1.2.8 1.7l-1.8 1.8 1.4 1.4 1.9-1.9c.7.5 1.6.8 2.6.8s1.9-.3 2.6-.8l1.9 1.9 1.4-1.4-1.8-1.8c.4-.5.7-1.1.8-1.7H19v-2zm-7 4c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2s2 .9 2 2v1c0 1.1-.9 2-2 2z" />
      </svg>
    </span>
  )
}

function JiraPriorityIcon({ priority }: { priority: IssuePriority }) {
  if (priority === 'HIGHEST') {
    return (
      <span className="inline-flex items-center text-rose-600" title="Độ ưu tiên: Cao nhất (Highest)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
        </svg>
      </span>
    )
  }
  if (priority === 'HIGH') {
    return (
      <span className="inline-flex items-center text-rose-500" title="Độ ưu tiên: Cao (High)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </span>
    )
  }
  if (priority === 'MEDIUM') {
    return (
      <span className="inline-flex items-center text-amber-500" title="Độ ưu tiên: Trung bình (Medium)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-blue-500" title="Độ ưu tiên: Thấp (Low)">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  )
}

// --- TRANG CHÍNH: QUẢN LÝ CÔNG VIỆC & LỖI KIỂU JIRA ---

export function ProjectIssuesPage() {
  const { project, isArchived } = useProjectContext()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Chế độ hiển thị: Kanban (Board) | Danh sách (List) | Chia đôi Đối chiếu Confluence (Split)
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'split'>('kanban')

  // Giai đoạn SDLC đang chọn: 'ALL' hoặc ID của Phase
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | 'ALL'>('ALL')

  // Bộ lọc nhanh (Quick Filters)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TASK' | 'BUG'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IssuePriority>('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'ALL'>('ALL')
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyStale, setOnlyStale] = useState(false)

  // Tải dữ liệu từ LocalStorage & APIs
  const issuesAsync = useAsync(
    () => issueApi.getIssues(project.projectId, project.key),
    [project.projectId, project.key],
  )
  const workflowAsync = useAsync(() => projectApi.workflow(project.projectId), [project.projectId])
  const membersAsync = useAsync(() => projectApi.listMembers(project.projectId), [project.projectId])
  const docsAsync = useAsync(() => documentApi.list(project.projectId), [project.projectId])

  const allIssues = issuesAsync.data ?? []
  const phases = workflowAsync.data?.phases ?? []
  const members = membersAsync.data ?? []
  const documents = docsAsync.data ?? []

  // Chi tiết Issue đang mở Slide-Over hoặc Modal
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(searchParams.get('issueId') || null)

  // Quản lý Modal Tạo Issue
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [prefillReq, setPrefillReq] = useState<{
    docId?: number
    reqId?: string
    reqKey?: string
    reqTitle?: string
  } | null>(null)

  // Quản lý Modal Bàn giao việc (Re-assign)
  const [reassignIssueData, setReassignIssueData] = useState<ProjectIssue | null>(null)
  const [reassignName, setReassignName] = useState('')
  const [reassignRole, setReassignRole] = useState('')
  const [reassignNote, setReassignNote] = useState('')

  // Quản lý Modal Yêu cầu Ghi chú Chuyển trạng thái (Transition Rules Require Comment)
  const [transitionPrompt, setTransitionPrompt] = useState<{
    issue: ProjectIssue
    targetStatus: WorkflowStatusDto
  } | null>(null)
  const [transitionComment, setTransitionComment] = useState('')

  // Quản lý Modal Cảnh báo Xóa Issue (Quy tắc GB-07 / MSG04)
  const [deleteWarningIssue, setDeleteWarningIssue] = useState<{
    issue: ProjectIssue
    message: string
  } | null>(null)

  // Thông báo lỗi chặn thao tác (MSG05)
  const [ruleErrorMsg, setRuleErrorMsg] = useState<string | null>(null)

  // Khi URL search param thay đổi
  useEffect(() => {
    const qIssueId = searchParams.get('issueId')
    if (qIssueId && qIssueId !== selectedIssueId) {
      setSelectedIssueId(qIssueId)
    }
  }, [searchParams])

  // Cập nhật URL khi chọn issue
  const handleSelectIssue = (id: string | null) => {
    setSelectedIssueId(id)
    if (id) {
      setSearchParams({ issueId: id }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  // Danh sách Statuses hiển thị trên cột Kanban theo Phase đang chọn
  const activePhase = useMemo(() => {
    if (selectedPhaseId === 'ALL') return null
    return phases.find((p) => p.phaseId === selectedPhaseId) || null
  }, [phases, selectedPhaseId])

  const kanbanColumns: { id: number; name: string; category: StatusCategory; color?: string }[] =
    useMemo(() => {
      if (activePhase && activePhase.statuses.length > 0) {
        return activePhase.statuses
          .filter((s) => s.isActive)
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            id: s.statusId,
            name: s.name,
            category: s.category,
            color: s.color || '#64748b',
          }))
      }
      // Khi chọn "Tất cả Phases": nhóm theo 4 cột kinh điển
      return [
        { id: 101, name: 'To Do', category: 'TODO', color: '#64748b' },
        { id: 201, name: 'In Progress', category: 'IN_PROGRESS', color: '#0284c7' },
        { id: 301, name: 'In Review / QA', category: 'IN_PROGRESS', color: '#7c3aed' },
        { id: 401, name: 'Done', category: 'DONE', color: '#16a34a' },
      ]
    }, [activePhase])

  // Lọc Issues theo tất cả điều kiện
  const filteredIssues = useMemo(() => {
    return allIssues.filter((iss) => {
      // Lọc theo Phase
      if (selectedPhaseId !== 'ALL' && iss.phaseId !== selectedPhaseId) {
        return false
      }
      // Lọc theo Loại (Task / Bug)
      if (typeFilter !== 'ALL' && iss.type !== typeFilter) {
        return false
      }
      // Lọc theo Độ ưu tiên
      if (priorityFilter !== 'ALL' && iss.priority !== priorityFilter) {
        return false
      }
      // Lọc theo Người phụ trách
      if (assigneeFilter !== 'ALL' && iss.assigneeName !== assigneeFilter) {
        return false
      }
      // Lọc Việc của tôi
      if (onlyMine) {
        const myName = user?.fullName || 'Sarah Lin'
        if (!iss.assigneeName.toLowerCase().includes(myName.toLowerCase()) && !iss.assigneeName.includes('Sarah')) {
          return false
        }
      }
      // Lọc Cảnh báo Stale
      if (onlyStale && iss.traceabilityStatus === 'FRESH') {
        return false
      }
      // Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchKey = iss.key.toLowerCase().includes(q)
        const matchSummary = iss.summary.toLowerCase().includes(q)
        const matchDesc = iss.description.toLowerCase().includes(q)
        const matchReq = (iss.linkedRequirementKeyCode || '').toLowerCase().includes(q)
        if (!matchKey && !matchSummary && !matchDesc && !matchReq) {
          return false
        }
      }
      return true
    })
  }, [allIssues, selectedPhaseId, typeFilter, priorityFilter, assigneeFilter, onlyMine, onlyStale, searchQuery, user])

  // Lấy Issue đang chọn chi tiết
  const currentSelectedIssue = useMemo(() => {
    return allIssues.find((i) => i.id === selectedIssueId) || null
  }, [allIssues, selectedIssueId])

  // Kiểm tra quy tắc chuyển trạng thái (Transition Rules Validation - GB-04)
  const validateAndTransition = async (
    issue: ProjectIssue,
    targetStatus: { id: number; name: string; category: StatusCategory },
  ) => {
    if (isArchived) {
      setRuleErrorMsg('Dự án đã lưu trữ — không thể thay đổi trạng thái.')
      return
    }

    // Nếu chuyển vào chính trạng thái hiện tại thì bỏ qua
    if (issue.statusId === targetStatus.id || issue.statusName === targetStatus.name) {
      return
    }

    // Tìm Phase của Issue để kiểm tra cấu hình Transitions
    const issuePhase = phases.find((p) => p.phaseId === issue.phaseId)
    if (issuePhase && issuePhase.transitions.length > 0) {
      // Tìm transition tương ứng
      const trans = issuePhase.transitions.find(
        (t) => t.fromStatusId === issue.statusId && t.toStatusId === targetStatus.id,
      )

      if (trans) {
        // Kiểm tra quyền hạn theo vai trò (allowedRoles)
        if (trans.allowedRoles && trans.allowedRoles.length > 0) {
          const userRoleCode = project.myRole?.code
          const isAllowed = trans.allowedRoles.some((r) => r.code === userRoleCode)
          if (!isAllowed) {
            setRuleErrorMsg(
              'MSG05: Từ chối thao tác: Vai trò của bạn không có quyền thực hiện bước chuyển trạng thái này.',
            )
            return
          }
        }

        // Kiểm tra nếu bước chuyển yêu cầu nhập bình luận bắt buộc (requireComment = true)
        if (trans.requireComment) {
          const fullStatus = issuePhase.statuses.find((s) => s.statusId === targetStatus.id)
          if (fullStatus) {
            setTransitionPrompt({ issue, targetStatus: fullStatus })
            return
          }
        }
      }
    }

    // Thực hiện chuyển trạng thái trực tiếp
    try {
      await issueApi.transitionIssue(
        issue.id,
        targetStatus.id,
        targetStatus.name,
        targetStatus.category,
        undefined,
        user?.fullName || 'Người dùng',
      )
      issuesAsync.reload()
    } catch (err: unknown) {
      setRuleErrorMsg(err instanceof Error ? err.message : 'Có lỗi khi chuyển trạng thái.')
    }
  }

  // Xử lý kéo thả HTML5 Kanban Drag & Drop
  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('text/plain', issueId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (
    e: React.DragEvent,
    col: { id: number; name: string; category: StatusCategory },
  ) => {
    e.preventDefault()
    const issueId = e.dataTransfer.getData('text/plain')
    const issue = allIssues.find((i) => i.id === issueId)
    if (issue) {
      validateAndTransition(issue, col)
    }
  }

  // Xử lý Xóa Issue (Quy tắc GB-07)
  const handleDeleteIssueClick = async (issue: ProjectIssue) => {
    const res = await issueApi.deleteIssue(issue.id, false)
    if (!res.success && res.error) {
      setDeleteWarningIssue({ issue, message: res.error })
    } else {
      handleSelectIssue(null)
      issuesAsync.reload()
    }
  }

  const handleConfirmForceDelete = async () => {
    if (!deleteWarningIssue) return
    await issueApi.deleteIssue(deleteWarningIssue.issue.id, true)
    setDeleteWarningIssue(null)
    handleSelectIssue(null)
    issuesAsync.reload()
  }

  // Đếm các bộ lọc đang kích hoạt để hiển thị pills
  const activeFiltersCount =
    (typeFilter !== 'ALL' ? 1 : 0) +
    (priorityFilter !== 'ALL' ? 1 : 0) +
    (assigneeFilter !== 'ALL' ? 1 : 0) +
    (onlyMine ? 1 : 0) +
    (onlyStale ? 1 : 0) +
    (searchQuery ? 1 : 0)

  const clearAllFilters = () => {
    setTypeFilter('ALL')
    setPriorityFilter('ALL')
    setAssigneeFilter('ALL')
    setOnlyMine(false)
    setOnlyStale(false)
    setSearchQuery('')
  }

  return (
    <div className="space-y-4">
      {/* Cảnh báo lỗi quy tắc chuyển đổi (MSG05) */}
      {ruleErrorMsg && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <span>{ruleErrorMsg}</span>
          <button
            type="button"
            onClick={() => setRuleErrorMsg(null)}
            className="font-bold text-red-500 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* THANH CÔNG CỤ ĐỈNH KIỂU JIRA (BOARD HEADER & FILTER BAR) */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        {/* HÀNG 1: CHUYỂN ĐỔI GIAI ĐOẠN (SDLC PHASES) & CHẾ ĐỘ HIỂN THỊ */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Pills chọn Phase */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="font-mono text-[11px] font-bold uppercase text-slate-400 shrink-0 mr-1">
              SDLC Phase:
            </span>
            <button
              type="button"
              onClick={() => setSelectedPhaseId('ALL')}
              className={clsx(
                'rounded-lg px-2.5 py-1.5 font-medium transition-colors shrink-0',
                selectedPhaseId === 'ALL'
                  ? 'bg-slate-900 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              )}
            >
              Tất cả Phases ({allIssues.length})
            </button>
            {phases.map((p, idx) => {
              const phaseCount = allIssues.filter((i) => i.phaseId === p.phaseId).length
              return (
                <button
                  key={p.phaseId}
                  type="button"
                  onClick={() => setSelectedPhaseId(p.phaseId)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1.5 font-medium transition-colors shrink-0 flex items-center gap-1.5',
                    selectedPhaseId === p.phaseId
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  )}
                >
                  <span>
                    P{idx + 1}: {p.name.replace(/^Phase \d+:\s*/, '')}
                  </span>
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.2 text-[10px]',
                      selectedPhaseId === p.phaseId ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {phaseCount}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Nhóm nút Chế độ xem & Tạo Issue */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Chuyển đổi 3 View Modes */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <span>📋 Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors',
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <span>📑 Danh sách</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors',
                  viewMode === 'split'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                <span>📖 Split-View REQ</span>
              </button>
            </div>

            {/* Nút Tạo Issue */}
            <button
              type="button"
              disabled={isArchived}
              onClick={() => {
                setPrefillReq(null)
                setShowCreateModal(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              <span>+ Tạo Issue</span>
            </button>
          </div>
        </div>

        {/* HÀNG 2: BỘ LỌC NHANH KIỂU JIRA (JIRA QUICK FILTERS) */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          {/* Ô tìm kiếm */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã TEST-101, tóm tắt..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute left-2.5 top-2 text-slate-400">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Nút lọc Việc của tôi */}
          <button
            type="button"
            onClick={() => setOnlyMine(!onlyMine)}
            className={clsx(
              'rounded-lg border px-2.5 py-1.5 font-medium transition-colors flex items-center gap-1.5',
              onlyMine
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span>👤 Việc của tôi</span>
          </button>

          {/* Bộ lọc Loại: Task / Bug */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={clsx(
                'rounded px-2 py-1 transition-colors',
                typeFilter === 'ALL' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600',
              )}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('TASK')}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-1 transition-colors',
                typeFilter === 'TASK' ? 'bg-white font-bold text-blue-700 shadow-2xs' : 'text-slate-600',
              )}
            >
              <JiraTaskIcon className="h-3 w-3" />
              <span>Chỉ Task</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('BUG')}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-1 transition-colors',
                typeFilter === 'BUG' ? 'bg-white font-bold text-rose-700 shadow-2xs' : 'text-slate-600',
              )}
            >
              <JiraBugIcon className="h-3 w-3" />
              <span>Chỉ Bug</span>
            </button>
          </div>

          {/* Bộ lọc Cảnh báo REQ Stale */}
          <button
            type="button"
            onClick={() => setOnlyStale(!onlyStale)}
            className={clsx(
              'rounded-lg border px-2.5 py-1.5 font-medium transition-colors flex items-center gap-1.5',
              onlyStale
                ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span>⚠️ Có cảnh báo REQ Stale</span>
            {allIssues.filter((i) => i.traceabilityStatus !== 'FRESH').length > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                {allIssues.filter((i) => i.traceabilityStatus !== 'FRESH').length}
              </span>
            )}
          </button>

          {/* Dãy Avatar thành viên lọc nhanh */}
          <div className="flex items-center -space-x-1 pl-1">
            {members.slice(0, 5).map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => setAssigneeFilter(assigneeFilter === m.fullName ? 'ALL' : m.fullName)}
                title={`Lọc công việc của ${m.fullName}`}
                className={clsx(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-transform hover:scale-110 hover:z-10',
                  assigneeFilter === m.fullName
                    ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-300'
                    : 'border-white bg-slate-200 text-slate-700',
                )}
              >
                {m.fullName
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </button>
            ))}
          </div>

          {/* Nút Xóa bộ lọc nếu đang áp dụng */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-rose-600 hover:underline ml-auto"
            >
              ✕ Xóa bộ lọc ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* CHẾ ĐỘ 1: BẢNG KÉO THẢ KANBAN (KANBAN BOARD VIEW) */}
      {/* ======================================================== */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
          {kanbanColumns.map((col) => {
            // Lọc các issues thuộc cột này
            const colIssues = filteredIssues.filter((iss) => {
              if (activePhase) {
                return iss.statusId === col.id || iss.statusName === col.name
              }
              // Chế độ "Tất cả Phases": nhóm theo statusCategory
              return iss.statusCategory === col.category
            })

            const totalPoints = colIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0)

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => handleDrop(e, col)}
                className="flex flex-col flex-1 min-w-[280px] max-w-[340px] rounded-xl bg-slate-100/80 border border-slate-200/80 p-2.5 transition-colors"
              >
                {/* Header Cột Kanban */}
                <div className="flex items-center justify-between pb-2.5 px-1 border-b border-slate-200/60 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                      {col.name}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                      {colIssues.length}
                    </span>
                  </div>
                  {totalPoints > 0 && (
                    <span className="text-[11px] font-mono font-semibold text-slate-400">
                      {totalPoints} pts
                    </span>
                  )}
                </div>

                {/* Danh sách Thẻ Issue trên Cột */}
                <div className="space-y-2.5 flex-1 min-h-[120px]">
                  {colIssues.map((issue) => {
                    const isStale = issue.traceabilityStatus !== 'FRESH'
                    return (
                      <div
                        key={issue.id}
                        draggable={!isArchived}
                        onDragStart={(e) => handleDragStart(e, issue.id)}
                        onClick={() => handleSelectIssue(issue.id)}
                        className={clsx(
                          'group relative rounded-xl border bg-white p-3.5 shadow-2xs transition-all hover:shadow-md hover:border-blue-300 cursor-pointer',
                          isStale ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200',
                          selectedIssueId === issue.id && 'ring-2 ring-blue-500 border-blue-500',
                        )}
                      >
                        {/* Hàng 1: Loại + Mã Key + Severity + Menu */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {issue.type === 'TASK' ? (
                              <JiraTaskIcon className="h-4 w-4" />
                            ) : (
                              <JiraBugIcon className="h-4 w-4" />
                            )}
                            <span className="font-mono text-xs font-bold text-slate-700 hover:text-blue-600 hover:underline">
                              {issue.key}
                            </span>
                            {issue.severity && (
                              <span
                                className={clsx(
                                  'rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase',
                                  issue.severity === 'BLOCKER'
                                    ? 'bg-rose-600 text-white'
                                    : issue.severity === 'CRITICAL'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700',
                                )}
                              >
                                {issue.severity}
                              </span>
                            )}
                          </div>

                          {/* Nút chuyển trạng thái nhanh (Quick Transition Pill) */}
                          <div
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              aria-label="Chuyển trạng thái"
                              value={issue.statusId}
                              disabled={isArchived}
                              onChange={(e) => {
                                const targetId = Number(e.target.value)
                                const target = kanbanColumns.find((c) => c.id === targetId)
                                if (target) validateAndTransition(issue, target)
                              }}
                              className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-700 outline-none"
                            >
                              {kanbanColumns.map((c) => (
                                <option key={c.id} value={c.id}>
                                  → {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Hàng 2: Tiêu đề Summary */}
                        <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 mb-2">
                          {issue.summary}
                        </p>

                        {/* Hàng 3: Chip Liên kết Confluence REQ (Cực kỳ quan trọng) */}
                        {issue.linkedRequirementKeyCode && (
                          <div
                            className="mb-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewMode('split')
                              setSelectedIssueId(issue.id)
                            }}
                          >
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-85',
                                issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                                  ? 'border-amber-300 bg-amber-50 text-amber-900 font-bold'
                                  : issue.traceabilityStatus === 'CONFIRMED_STALE'
                                    ? 'border-rose-300 bg-rose-50 text-rose-900 font-bold'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                              )}
                              title="Bấm để mở Chia đôi Đối chiếu Confluence Split-View"
                            >
                              <span>📄</span>
                              <span className="font-mono font-bold">{issue.linkedRequirementKeyCode}</span>
                              {issue.traceabilityStatus === 'UNCONFIRMED_STALE' && (
                                <span className="rounded bg-amber-200 px-1 text-[9px] text-amber-950">
                                  ⚠️ REQ sửa nháp
                                </span>
                              )}
                              {issue.traceabilityStatus === 'CONFIRMED_STALE' && (
                                <span className="rounded bg-rose-200 px-1 text-[9px] text-rose-950">
                                  🔴 REQ đã đổi
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Hàng 4: Priority + Story Points + Comments + Assignee Avatar */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <div className="flex items-center gap-2">
                            <JiraPriorityIcon priority={issue.priority} />
                            {issue.storyPoints !== undefined && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                {issue.storyPoints} pts
                              </span>
                            )}
                            {issue.comments.length > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                <span>💬</span>
                                <span>{issue.comments.length}</span>
                              </span>
                            )}
                          </div>

                          {/* Avatar người phụ trách */}
                          <div
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 font-mono text-[10px] font-bold text-blue-800"
                            title={`Người phụ trách: ${issue.assigneeName} (${issue.assigneeRole})`}
                          >
                            {issue.assigneeAvatar || 'SL'}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {colIssues.length === 0 && (
                    <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-400">
                      Kéo thả issue vào đây
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* CHẾ ĐỘ 2: DANH SÁCH & BỘ LỌC ĐA ĐIỀU KIỆN (LIST VIEW) */}
      {/* ======================================================== */}
      {viewMode === 'list' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Loại</th>
                  <th className="py-3 px-3 w-28">Mã Key</th>
                  <th className="py-3 px-4">Tiêu đề (Summary)</th>
                  <th className="py-3 px-3">Giai đoạn (Phase)</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-3 w-24">Độ ưu tiên</th>
                  <th className="py-3 px-4">Liên kết Yêu cầu (REQ)</th>
                  <th className="py-3 px-3">Người phụ trách</th>
                  <th className="py-3 px-2 text-center">Điểm</th>
                  <th className="py-3 px-3 text-right">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => handleSelectIssue(issue.id)}
                    className={clsx(
                      'hover:bg-slate-50 cursor-pointer transition-colors',
                      selectedIssueId === issue.id && 'bg-blue-50/60',
                    )}
                  >
                    <td className="py-2.5 px-4 text-center">
                      {issue.type === 'TASK' ? <JiraTaskIcon /> : <JiraBugIcon />}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 hover:underline">
                      {issue.key}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 max-w-md">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{issue.summary}</span>
                        {issue.severity && (
                          <span className="rounded bg-rose-100 px-1 py-0.2 text-[9px] font-bold text-rose-800 shrink-0">
                            {issue.severity}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {issue.phaseName.replace(/^Phase \d+:\s*/, '')}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={clsx(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold',
                          issue.statusCategory === 'DONE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : issue.statusCategory === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {issue.statusName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <JiraPriorityIcon priority={issue.priority} />
                        <span className="font-medium text-slate-600">{issue.priority}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      {issue.linkedRequirementKeyCode ? (
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                            issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                              ? 'border-amber-300 bg-amber-50 text-amber-900'
                              : issue.traceabilityStatus === 'CONFIRMED_STALE'
                                ? 'border-rose-300 bg-rose-50 text-rose-900'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                          )}
                        >
                          <span>📄 {issue.linkedRequirementKeyCode}</span>
                          {issue.traceabilityStatus !== 'FRESH' && <span>(Stale)</span>}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center font-mono text-[9px] font-bold text-blue-800">
                          {issue.assigneeAvatar || 'SL'}
                        </div>
                        <span className="font-medium text-slate-800">{issue.assigneeName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600">
                      {issue.storyPoints ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                      {formatDate(issue.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CHẾ ĐỘ 3: CHIA ĐÔI MÀN HÌNH "JIRA ISSUE ↔ CONFLUENCE REQ" */}
      {/* ======================================================== */}
      {viewMode === 'split' && (
        <SplitViewWorkspace
          projectId={project.projectId}
          issues={filteredIssues}
          selectedIssueId={selectedIssueId}
          onSelectIssue={handleSelectIssue}
          onReloadIssues={() => issuesAsync.reload()}
          isArchived={isArchived}
        />
      )}

      {/* ======================================================== */}
      {/* NGĂN CHI TIẾT CÔNG VIỆC KIỂU JIRA (JIRA SLIDE-OVER DRAWER)*/}
      {/* ======================================================== */}
      {currentSelectedIssue && viewMode !== 'split' && (
        <IssueDetailDrawer
          issue={currentSelectedIssue}
          phases={phases}
          onClose={() => handleSelectIssue(null)}
          onReload={() => issuesAsync.reload()}
          onDeleteClick={() => handleDeleteIssueClick(currentSelectedIssue)}
          onReassignClick={() => {
            setReassignIssueData(currentSelectedIssue)
            setReassignName(currentSelectedIssue.assigneeName)
            setReassignRole(currentSelectedIssue.assigneeRole)
            setReassignNote('')
          }}
          isArchived={isArchived}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL TẠO MỚI TASK HOẶC BUG CHUẨN JIRA */}
      {/* ======================================================== */}
      {showCreateModal && (
        <CreateIssueModal
          projectId={project.projectId}
          projectKey={project.key}
          phases={phases}
          members={members}
          documents={documents}
          prefillReq={prefillReq}
          onClose={() => {
            setShowCreateModal(false)
            setPrefillReq(null)
          }}
          onSuccess={(newIssue) => {
            setShowCreateModal(false)
            setPrefillReq(null)
            issuesAsync.reload()
            handleSelectIssue(newIssue.id)
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL BÀN GIAO VIỆC (RE-ASSIGN) */}
      {/* ======================================================== */}
      {reassignIssueData && (
        <Modal
          title={`⇄ Bàn giao công việc ${reassignIssueData.key}`}
          open={true}
          onClose={() => setReassignIssueData(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Chọn thành viên mới để chuyển quyền phụ trách công việc. Hệ thống sẽ gửi thông báo và ghi nhận lịch sử bất biến.
            </p>

            <SelectField
              label="Người nhận bàn giao mới (@assignee)"
              value={reassignName}
              onChange={(e) => {
                const name = e.target.value
                setReassignName(name)
                const found = members.find((m) => m.fullName === name)
                if (found) setReassignRole(found.role.name)
              }}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.fullName}>
                  {m.fullName} — {m.role.name}
                </option>
              ))}
            </SelectField>

            <TextAreaField
              label="Ghi chú bàn giao công việc"
              placeholder="VD: @Minh Luong nhờ bạn tiếp quản luồng Webhook này nhé, mình đã commit bản test dở..."
              value={reassignNote}
              onChange={(e) => setReassignNote(e.target.value)}
              rows={3}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" inline onClick={() => setReassignIssueData(null)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                inline
                onClick={async () => {
                  await issueApi.reassignIssue(
                    reassignIssueData.id,
                    reassignName,
                    reassignRole,
                    reassignNote,
                    user?.fullName || 'Người dùng',
                  )
                  setReassignIssueData(null)
                  issuesAsync.reload()
                }}
              >
                Xác nhận bàn giao
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL YÊU CẦU GHI CHÚ CHUYỂN TRẠNG THÁI (REQUIRE COMMENT) */}
      {/* ======================================================== */}
      {transitionPrompt && (
        <Modal
          title={`Chuyển trạng thái sang "${transitionPrompt.targetStatus.name}"`}
          open={true}
          onClose={() => setTransitionPrompt(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Quy tắc chuyển đổi workflow của Phase yêu cầu nhập ghi chú giải thích trước khi hoàn tất bước chuyển này.
            </p>
            <TextAreaField
              label="Ghi chú chuyển trạng thái (Bắt buộc)"
              placeholder="Nhập lý do chuyển trạng thái hoặc kết quả thực hiện..."
              value={transitionComment}
              onChange={(e) => setTransitionComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" inline onClick={() => setTransitionPrompt(null)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                inline
                disabled={!transitionComment.trim()}
                onClick={async () => {
                  await issueApi.transitionIssue(
                    transitionPrompt.issue.id,
                    transitionPrompt.targetStatus.statusId,
                    transitionPrompt.targetStatus.name,
                    transitionPrompt.targetStatus.category,
                    transitionComment.trim(),
                    user?.fullName || 'Người dùng',
                  )
                  setTransitionPrompt(null)
                  setTransitionComment('')
                  issuesAsync.reload()
                }}
              >
                Lưu & Chuyển trạng thái
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL CẢNH BÁO ĐỎ XÓA ISSUE CÓ TRUY XUẤT (GB-07 / MSG04) */}
      {/* ======================================================== */}
      {deleteWarningIssue && (
        <Modal
          title="⚠️ Cảnh báo Đứt gãy Ma trận RTM (MSG04)"
          open={true}
          onClose={() => setDeleteWarningIssue(null)}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 leading-relaxed">
              {deleteWarningIssue.message}
            </div>
            <p className="text-xs text-slate-500">
              Hành động này không thể hoàn tác. Mọi liên kết từ Requirement Item hoặc Test Case tới Issue{' '}
              <b>{deleteWarningIssue.issue.key}</b> sẽ bị xóa vĩnh viễn.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" inline onClick={() => setDeleteWarningIssue(null)}>
                Hủy bỏ (Giữ lại Issue)
              </Button>
              <Button
                variant="primary"
                inline
                className="bg-rose-600 hover:bg-rose-700"
                onClick={handleConfirmForceDelete}
              >
                Xác nhận Xóa vĩnh viễn
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ========================================================
// PHÂN HỆ CHIA ĐÔI MÀN HÌNH (SPLIT-VIEW WORKSPACE - UC-68)
// ========================================================

function SplitViewWorkspace({
  projectId,
  issues,
  selectedIssueId,
  onSelectIssue,
  onReloadIssues,
  isArchived,
}: {
  projectId: number
  issues: ProjectIssue[]
  selectedIssueId: string | null
  onSelectIssue: (id: string | null) => void
  onReloadIssues: () => void
  isArchived: boolean
}) {
  const { user } = useAuth()
  const docsAsync = useAsync(() => documentApi.list(projectId), [projectId])
  const documents = (docsAsync.data ?? []).filter((d) => !d.isFolder)

  const selectedIssue = useMemo(() => {
    return issues.find((i) => i.id === selectedIssueId) || issues[0] || null
  }, [issues, selectedIssueId])

  // Chọn tài liệu đang xem ở nửa phải
  const [activeDocId, setActiveDocId] = useState<number | null>(
    selectedIssue?.linkedDocumentId || documents[0]?.id || 101,
  )

  // Tải chi tiết tài liệu bên phải (gồm các blocks & requirement items)
  const docDetailAsync = useAsync(
    () => (activeDocId ? documentApi.get(activeDocId) : Promise.resolve(null)),
    [activeDocId],
  )

  const currentDoc = docDetailAsync.data?.document || null

  // Khi selectedIssue thay đổi, tự động chuyển docId nếu có
  useEffect(() => {
    if (selectedIssue?.linkedDocumentId) {
      setActiveDocId(selectedIssue.linkedDocumentId)
    }
  }, [selectedIssue])

  // Auto-scroll tới Heading tương ứng với linkedRequirementKeyCode
  const highlightedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedIssue?.linkedRequirementKeyCode, activeDocId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[750px] overflow-hidden">
      {/* NỬA TRÁI (50%): DANH SÁCH & CHI TIẾT CỦA TASK / BUG ĐANG CHỌN */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Header Nửa Trái */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-800">
              Công việc & Lỗi ({issues.length})
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Jira Split-View</span>
        </div>

        {/* Khung Chi tiết Issue đang chọn */}
        {selectedIssue ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Thanh tiêu đề Issue */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedIssue.type === 'TASK' ? <JiraTaskIcon /> : <JiraBugIcon />}
                <span className="font-mono text-base font-extrabold text-blue-600">
                  {selectedIssue.key}
                </span>
                <span
                  className={clsx(
                    'rounded-md px-2 py-0.5 text-[10px] font-bold',
                    selectedIssue.statusCategory === 'DONE'
                      ? 'bg-emerald-50 text-emerald-700'
                      : selectedIssue.statusCategory === 'IN_PROGRESS'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {selectedIssue.statusName}
                </span>
              </div>
              <JiraPriorityIcon priority={selectedIssue.priority} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 leading-snug">{selectedIssue.summary}</h3>
            <p className="text-xs text-slate-600 whitespace-pre-line bg-slate-50 rounded-lg p-3 border border-slate-100">
              {selectedIssue.description}
            </p>

            {/* KHUNG TRUY XUẤT LIÊN KẾT ĐẶC TẢ CONFLUENCE */}
            <div
              className={clsx(
                'rounded-xl border p-4 space-y-3',
                selectedIssue.traceabilityStatus === 'UNCONFIRMED_STALE'
                  ? 'border-amber-300 bg-amber-50/70'
                  : selectedIssue.traceabilityStatus === 'CONFIRMED_STALE'
                    ? 'border-rose-300 bg-rose-50/70'
                    : 'border-emerald-200 bg-emerald-50/60',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span>🔗</span>
                  <span>Liên kết Đặc tả Yêu cầu Confluence</span>
                </span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    selectedIssue.traceabilityStatus === 'FRESH'
                      ? 'bg-emerald-200 text-emerald-900'
                      : selectedIssue.traceabilityStatus === 'UNCONFIRMED_STALE'
                        ? 'bg-amber-200 text-amber-950 animate-pulse'
                        : 'bg-rose-200 text-rose-950',
                  )}
                >
                  {selectedIssue.traceabilityStatus === 'FRESH'
                    ? '✓ Fresh (Đồng bộ)'
                    : selectedIssue.traceabilityStatus === 'UNCONFIRMED_STALE'
                      ? '⚠️ Unconfirmed Stale (Sửa nháp)'
                      : '🔴 Confirmed Stale (Đã duyệt bản mới)'}
                </span>
              </div>

              {selectedIssue.linkedRequirementKeyCode ? (
                <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-emerald-700">
                      [{selectedIssue.linkedRequirementKeyCode}]
                    </span>
                    {!isArchived && (
                      <button
                        type="button"
                        onClick={async () => {
                          await issueApi.unlinkRequirement(selectedIssue.id, user?.fullName || 'Người dùng')
                          onReloadIssues()
                        }}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        Gỡ liên kết
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    {selectedIssue.linkedRequirementTitle || 'Tiêu đề yêu cầu'}
                  </p>

                  {/* Cảnh báo Stale & Nút xác nhận đồng bộ code */}
                  {selectedIssue.traceabilityStatus !== 'FRESH' && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-800">
                        Đặc tả [<b>{selectedIssue.linkedRequirementKeyCode}</b>] đã sửa đổi.
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await issueApi.resetStaleStatus(selectedIssue.id, user?.fullName || 'Người dùng')
                          onReloadIssues()
                        }}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        ✓ Đã cập nhật code → Reset Stale
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-slate-500">
                  Chưa có liên kết với mục yêu cầu nào. Chọn một mục bên phải để gắn kết nối.
                </div>
              )}
            </div>

            {/* Dãy nút chọn nhanh Issue khác */}
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-slate-400 mb-2">
                Chọn Issue khác để đối chiếu:
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {issues.map((iss) => (
                  <button
                    key={iss.id}
                    type="button"
                    onClick={() => onSelectIssue(iss.id)}
                    className={clsx(
                      'flex items-center justify-between w-full rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors border',
                      selectedIssue.id === iss.id
                        ? 'border-blue-500 bg-blue-50 font-bold text-blue-900'
                        : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700',
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {iss.type === 'TASK' ? <JiraTaskIcon /> : <JiraBugIcon />}
                      <span className="font-mono font-bold text-xs">{iss.key}</span>
                      <span className="truncate">{iss.summary}</span>
                    </div>
                    {iss.linkedRequirementKeyCode && (
                      <span className="font-mono text-[10px] text-emerald-700 shrink-0">
                        [{iss.linkedRequirementKeyCode}]
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            Không có Issue nào được chọn.
          </div>
        )}
      </div>

      {/* NỬA PHẢI (50%): TRÌNH XEM TÀI LIỆU CONFLUENCE ĐỐI CHIẾU */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Header Nửa Phải: Chọn Tài liệu */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">📄 Tài liệu Confluence:</span>
            <select
              aria-label="Chọn tài liệu Confluence"
              value={activeDocId || ''}
              onChange={(e) => setActiveDocId(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}: {d.title}
                </option>
              ))}
            </select>
          </div>
          <Link
            to={`/projects/${projectId}/documents/${activeDocId}`}
            className="text-xs font-semibold text-emerald-700 hover:underline"
            target="_blank"
          >
            Mở toàn màn hình ↗
          </Link>
        </div>

        {/* Nội dung Tài liệu Confluence bên phải */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
          {currentDoc ? (
            <div>
              <div className="mb-4 pb-3 border-b border-slate-200">
                <span className="font-mono text-[10px] font-bold text-slate-400 uppercase">
                  {currentDoc.code} · {currentDoc.version}
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">{currentDoc.title}</h2>
              </div>

              {/* Danh sách các Khối nội dung */}
              <div className="space-y-4">
                {(currentDoc.blocks || []).map((block) => {
                  const isLinkedToCurrent =
                    block.isReq &&
                    selectedIssue?.linkedRequirementKeyCode &&
                    (block.reqKeyCode === selectedIssue.linkedRequirementKeyCode ||
                      block.text?.includes(selectedIssue.linkedRequirementKeyCode))

                  const isHeading = block.type === 'h1' || block.type === 'h2' || block.type === 'h3'

                  if (isHeading) {
                    return (
                      <div
                        key={block.id}
                        ref={isLinkedToCurrent ? highlightedRef : undefined}
                        className={clsx(
                          'rounded-xl p-3 transition-all',
                          isLinkedToCurrent
                            ? 'bg-emerald-50/90 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-200'
                            : block.isReq
                              ? 'bg-white border border-slate-200 hover:border-slate-300'
                              : '',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={clsx(
                              'text-slate-900 font-bold',
                              block.type === 'h1' ? 'text-base font-extrabold' : 'text-sm',
                            )}
                          >
                            {block.text}
                          </h4>

                          {/* Nút 1-click Gắn / Chuyển Liên kết với Issue đang chọn */}
                          {block.isReq && selectedIssue && !isArchived && (
                            <button
                              type="button"
                              onClick={async () => {
                                const reqKey = block.reqKeyCode || 'REQ'
                                const reqId = block.reqId || `req-${currentDoc.id}-${block.id}`
                                await issueApi.linkRequirement(
                                  selectedIssue.id,
                                  {
                                    docId: currentDoc.id,
                                    reqId,
                                    reqKey,
                                    reqTitle: block.text || 'Yêu cầu',
                                  },
                                  user?.fullName || 'Người dùng',
                                )
                                onReloadIssues()
                              }}
                              className={clsx(
                                'rounded px-2 py-0.5 text-[10px] font-bold shrink-0 transition-colors',
                                isLinkedToCurrent
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-700 hover:bg-emerald-600 hover:text-white',
                              )}
                            >
                              {isLinkedToCurrent ? '✓ Đang liên kết' : '+ Gắn vào Issue này'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }

                  if (block.type === 'paragraph') {
                    return (
                      <p key={block.id} className="text-xs text-slate-700 leading-relaxed px-1">
                        {block.text}
                      </p>
                    )
                  }

                  if (block.type === 'callout') {
                    return (
                      <div
                        key={block.id}
                        className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-xs text-blue-900"
                      >
                        <p className="font-bold text-[11px] mb-0.5">{block.calloutTitle || 'Ghi chú'}</p>
                        <p>{block.text}</p>
                      </div>
                    )
                  }

                  if (block.type === 'table' && block.tableHeaders && block.tableRows) {
                    return (
                      <div key={block.id} className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-100 text-slate-700 font-bold">
                            <tr>
                              {block.tableHeaders.map((th, i) => (
                                <th key={i} className="p-2 border-b">
                                  {th}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {block.tableRows.map((row, rI) => (
                              <tr key={rI}>
                                {row.map((cell, cI) => (
                                  <td key={cI} className="p-2 text-slate-600">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }

                  return null
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              Đang tải nội dung tài liệu...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========================================================
// NGĂN CHI TIẾT ISSUE (JIRA ISSUE DETAIL SLIDE-OVER DRAWER)
// ========================================================

function IssueDetailDrawer({
  issue,
  phases,
  onClose,
  onReload,
  onDeleteClick,
  onReassignClick,
  isArchived,
}: {
  issue: ProjectIssue
  phases: PhaseDto[]
  onClose: () => void
  onReload: () => void
  onDeleteClick: () => void
  onReassignClick: () => void
  isArchived: boolean
}) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')
  const [commentInput, setCommentInput] = useState('')

  // Sửa tiêu đề và mô tả
  const [summary, setSummary] = useState(issue.summary)
  const [description, setDescription] = useState(issue.description)
  const [isEditing, setIsEditing] = useState(false)

  // Cập nhật khi issue thay đổi
  useEffect(() => {
    setSummary(issue.summary)
    setDescription(issue.description)
    setIsEditing(false)
  }, [issue.id])

  const handleSaveText = async () => {
    await issueApi.updateIssue(
      issue.id,
      { summary, description },
      user?.fullName || 'Người dùng',
      'Chỉnh sửa tóm tắt và mô tả chi tiết',
    )
    setIsEditing(false)
    onReload()
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim()) return

    // Bóc tách các thẻ @mention
    const mentions = Array.from(commentInput.matchAll(/@([A-Za-zÀ-ỹ\s]+)/g)).map((m) => m[1].trim())

    await issueApi.addComment(issue.id, {
      authorName: user?.fullName || 'Sarah Lin',
      authorRole: 'Thành viên dự án',
      body: commentInput.trim(),
      mentions,
    })
    setCommentInput('')
    onReload()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-4xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 border-l border-slate-200">
        {/* Header ngăn chi tiết */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Dự án</span>
            <span>/</span>
            <span>{issue.phaseName}</span>
            <span>/</span>
            <span className="font-mono font-bold text-slate-800">{issue.key}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Thân 2 Cột: Cột Trái (65%) & Cột Phải (35%) */}
        <div className="flex flex-1 overflow-hidden">
          {/* CỘT TRÁI (65% - NỘI DUNG CHÍNH) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-slate-200">
            {/* Loại Issue + Nút chuyển loại */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isArchived}
                onClick={async () => {
                  const newType: IssueType = issue.type === 'TASK' ? 'BUG' : 'TASK'
                  await issueApi.updateIssue(
                    issue.id,
                    { type: newType },
                    user?.fullName || 'Người dùng',
                    `Chuyển loại Issue sang ${newType}`,
                  )
                  onReload()
                }}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors border',
                  issue.type === 'TASK'
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800',
                )}
                title="Bấm để chuyển đổi giữa Task và Bug"
              >
                {issue.type === 'TASK' ? <JiraTaskIcon /> : <JiraBugIcon />}
                <span>{issue.type === 'TASK' ? 'Task (Công việc)' : 'Bug (Lỗi)'}</span>
                <span className="text-[10px] text-slate-400">⇄ Đổi</span>
              </button>
            </div>

            {/* Tiêu đề tóm tắt */}
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-lg border border-blue-500 p-2 text-base font-bold text-slate-900 outline-none"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveText}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Lưu thay đổi
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2
                  onClick={() => !isArchived && setIsEditing(true)}
                  className="text-lg font-bold text-slate-900 cursor-pointer hover:bg-slate-50 p-1 rounded -m-1"
                  title="Nhấp để sửa tiêu đề"
                >
                  {issue.summary}
                </h2>
                <div
                  onClick={() => !isArchived && setIsEditing(true)}
                  className="mt-3 text-xs text-slate-700 whitespace-pre-line leading-relaxed cursor-pointer hover:bg-slate-50 p-2 rounded border border-transparent hover:border-slate-200"
                  title="Nhấp để sửa mô tả"
                >
                  {issue.description || 'Chưa có mô tả chi tiết.'}
                </div>
              </div>
            )}

            {/* THÔNG TIN DÀNH RIÊNG CHO BUG */}
            {issue.type === 'BUG' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase text-rose-900 flex items-center gap-1.5">
                    <span>🐞</span>
                    <span>Thông tin Tái hiện Lỗi & Mức độ</span>
                  </span>
                  {issue.linkedTestCaseCode && (
                    <span className="rounded bg-rose-200 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-900">
                      Kiểm thử: {issue.linkedTestCaseCode}
                    </span>
                  )}
                </div>
                {issue.stepsToReproduce && (
                  <div className="text-xs text-rose-950 whitespace-pre-line bg-white/80 rounded p-2.5 border border-rose-100">
                    <p className="font-semibold text-[11px] mb-1">Các bước tái hiện (Steps to Reproduce):</p>
                    {issue.stepsToReproduce}
                  </div>
                )}
              </div>
            )}

            {/* KHUNG TRUY XUẤT ĐẶC TẢ CONFLUENCE */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                  <span>📄</span>
                  <span>Liên kết Yêu cầu Đặc tả (REQ)</span>
                </span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    issue.traceabilityStatus === 'FRESH'
                      ? 'bg-emerald-100 text-emerald-800'
                      : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                        ? 'bg-amber-100 text-amber-900 animate-pulse'
                        : 'bg-rose-100 text-rose-900',
                  )}
                >
                  {issue.traceabilityStatus === 'FRESH'
                    ? 'Fresh (Đồng bộ)'
                    : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                      ? '⚠️ Unconfirmed Stale'
                      : '🔴 Confirmed Stale'}
                </span>
              </div>

              {issue.linkedRequirementKeyCode ? (
                <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs space-y-2">
                  <span className="font-mono text-xs font-extrabold text-emerald-700">
                    [{issue.linkedRequirementKeyCode}]
                  </span>
                  <p className="text-xs font-semibold text-slate-900">
                    {issue.linkedRequirementTitle || 'Yêu cầu Confluence'}
                  </p>
                  {issue.traceabilityStatus !== 'FRESH' && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-amber-800">Cần xác nhận cập nhật code</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await issueApi.resetStaleStatus(issue.id, user?.fullName || 'Người dùng')
                          onReload()
                        }}
                        className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        ✓ Reset Stale
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Issue này chưa được gắn với mục yêu cầu nào.</p>
              )}
            </div>

            {/* TAB BÌNH LUẬN (@MENTION) VÀ NHẬT KÝ HOẠT ĐỘNG */}
            <div>
              <div className="flex border-b border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={clsx(
                    'pb-2 px-3 border-b-2 transition-colors',
                    activeTab === 'comments'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  Bình luận & Phối hợp ({issue.comments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={clsx(
                    'pb-2 px-3 border-b-2 transition-colors',
                    activeTab === 'activity'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  Nhật ký hoạt động ({issue.activityLog.length})
                </button>
              </div>

              {/* Nội dung Tab Bình luận */}
              {activeTab === 'comments' && (
                <div className="mt-4 space-y-4">
                  {/* Form gửi bình luận */}
                  <form onSubmit={handleAddComment} className="space-y-2">
                    <textarea
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Viết bình luận, gõ @ để nhắc tên đồng nghiệp..."
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />

                    {/* Dãy nút tag nhanh đồng nghiệp */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span>Gắn thẻ nhanh:</span>
                        {['Sarah Lin', 'Phạm Minh Lương', 'Vũ Kim Kỳ'].map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setCommentInput((prev) => `${prev} @${name} `)}
                            className="rounded bg-slate-100 px-1.5 py-0.5 hover:bg-slate-200 text-slate-700 font-medium"
                          >
                            @{name}
                          </button>
                        ))}
                      </div>
                      <button
                        type="submit"
                        disabled={!commentInput.trim()}
                        className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Gửi bình luận
                      </button>
                    </div>
                  </form>

                  {/* Danh sách bình luận */}
                  <div className="space-y-3 pt-2">
                    {issue.comments.map((cmt) => (
                      <div key={cmt.id} className="rounded-lg bg-slate-50 p-3 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">{cmt.authorName}</span>
                          <span className="text-[10px] text-slate-400">{formatDate(cmt.createdAt)}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-line leading-relaxed">{cmt.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nội dung Tab Nhật ký hoạt động */}
              {activeTab === 'activity' && (
                <div className="mt-4 space-y-3">
                  {issue.activityLog.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs">
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <div>
                        <p className="text-slate-800">
                          <b>{act.authorName}</b>: {act.action}
                        </p>
                        {act.details && <p className="text-slate-500 text-[11px]">{act.details}</p>}
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(act.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI (35% - THUỘC TÍNH JIRA PROPERTIES) */}
          <div className="w-72 bg-slate-50/50 p-5 space-y-5 overflow-y-auto">
            {/* Trạng thái Workflow */}
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Trạng thái</label>
              <select
                aria-label="Cập nhật trạng thái Issue"
                value={issue.statusId}
                disabled={isArchived}
                onChange={async (e) => {
                  const targetId = Number(e.target.value)
                  const phase = phases.find((p) => p.phaseId === issue.phaseId)
                  const target = phase?.statuses.find((s) => s.statusId === targetId)
                  if (target) {
                    await issueApi.transitionIssue(
                      issue.id,
                      target.statusId,
                      target.name,
                      target.category,
                      undefined,
                      user?.fullName || 'Người dùng',
                    )
                    onReload()
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 outline-none"
              >
                {(phases.find((p) => p.phaseId === issue.phaseId)?.statuses || []).map((s) => (
                  <option key={s.statusId} value={s.statusId}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Người phụ trách (Assignee) + Nút Bàn giao */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Người phụ trách</label>
                {!isArchived && (
                  <button
                    type="button"
                    onClick={onReassignClick}
                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    ⇄ Bàn giao
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 p-2">
                <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center justify-center">
                  {issue.assigneeAvatar || 'SL'}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{issue.assigneeName}</p>
                  <p className="text-[10px] text-slate-500">{issue.assigneeRole}</p>
                </div>
              </div>
            </div>

            {/* Độ ưu tiên Priority */}
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Độ ưu tiên</label>
              <select
                aria-label="Cập nhật độ ưu tiên"
                value={issue.priority}
                disabled={isArchived}
                onChange={async (e) => {
                  await issueApi.updateIssue(
                    issue.id,
                    { priority: e.target.value as IssuePriority },
                    user?.fullName || 'Người dùng',
                    `Đổi độ ưu tiên thành ${e.target.value}`,
                  )
                  onReload()
                }}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-slate-800 outline-none"
              >
                <option value="HIGHEST">🔴 Highest (Cao nhất)</option>
                <option value="HIGH">🟠 High (Cao)</option>
                <option value="MEDIUM">🟡 Medium (Trung bình)</option>
                <option value="LOW">🔵 Low (Thấp)</option>
              </select>
            </div>

            {/* Story Points */}
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Story Points</label>
              <input
                type="number"
                min={1}
                max={21}
                value={issue.storyPoints || ''}
                disabled={isArchived}
                onChange={async (e) => {
                  const pts = Number(e.target.value) || 0
                  await issueApi.updateIssue(
                    issue.id,
                    { storyPoints: pts },
                    user?.fullName || 'Người dùng',
                    `Cập nhật Story Points thành ${pts}`,
                  )
                  onReload()
                }}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-slate-800 outline-none"
              />
            </div>

            {/* Mức độ nghiêm trọng Severity (nếu là Bug) */}
            {issue.type === 'BUG' && (
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Mức độ lỗi (Severity)</label>
                <select
                  aria-label="Cập nhật mức độ lỗi"
                  value={issue.severity || 'MAJOR'}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { severity: e.target.value as BugSeverity },
                      user?.fullName || 'Người dùng',
                      `Đổi mức độ lỗi thành ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-slate-800 outline-none"
                >
                  <option value="BLOCKER">💥 BLOCKER (Chặn release)</option>
                  <option value="CRITICAL">🔴 CRITICAL (Nghiêm trọng)</option>
                  <option value="MAJOR">🟠 MAJOR (Lớn)</option>
                  <option value="MINOR">🟡 MINOR (Nhỏ)</option>
                </select>
              </div>
            )}

            {/* Nút Xóa Issue (Cảnh báo GB-07) */}
            <div className="pt-4 border-t border-slate-200">
              <button
                type="button"
                disabled={isArchived}
                onClick={onDeleteClick}
                className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-rose-200 bg-rose-50/50 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <span>🗑️ Xóa Issue này</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========================================================
// MODAL TẠO MỚI TASK HOẶC BUG
// ========================================================

function CreateIssueModal({
  projectId,
  projectKey,
  phases,
  members,
  documents,
  prefillReq,
  onClose,
  onSuccess,
}: {
  projectId: number
  projectKey?: string
  phases: PhaseDto[]
  members: { fullName: string; role: { name: string } }[]
  documents: SpecificationDocument[]
  prefillReq: { docId?: number; reqId?: string; reqKey?: string; reqTitle?: string } | null
  onClose: () => void
  onSuccess: (issue: ProjectIssue) => void
}) {
  const { user } = useAuth()
  const [type, setType] = useState<IssueType>('TASK')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [phaseId, setPhaseId] = useState<number>(phases[0]?.phaseId || 1)
  const [priority, setPriority] = useState<IssuePriority>('HIGH')
  const [storyPoints, setStoryPoints] = useState<number>(type === 'BUG' ? 3 : 5)
  const [assigneeName, setAssigneeName] = useState(members[0]?.fullName || 'Sarah Lin')
  const [severity, setSeverity] = useState<BugSeverity>('MAJOR')
  const [stepsToReproduce, setStepsToReproduce] = useState('')
  const [linkedTestCaseCode, setLinkedTestCaseCode] = useState('')

  // Liên kết Requirement
  const [linkedReqKey, setLinkedReqKey] = useState(prefillReq?.reqKey || '')
  const [linkedDocId, setLinkedDocId] = useState<number | undefined>(prefillReq?.docId)

  const currentPhase = phases.find((p) => p.phaseId === phaseId) || phases[0]
  const initialStatus = currentPhase?.statuses[0] || {
    statusId: 101,
    name: 'To Do',
    category: 'TODO' as StatusCategory,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!summary.trim()) return

    const assigneeMember = members.find((m) => m.fullName === assigneeName)
    const newIssue = await issueApi.createIssue({
      projectId,
      projectKey,
      type,
      summary,
      description,
      phaseId: currentPhase.phaseId,
      phaseName: currentPhase.name,
      statusId: initialStatus.statusId,
      statusName: initialStatus.name,
      statusCategory: initialStatus.category as StatusCategory,
      priority,
      storyPoints,
      assigneeName,
      assigneeRole: assigneeMember?.role.name || 'Thành viên',
      reporterName: user?.fullName || 'Phạm Văn Khoa (PM)',
      severity: type === 'BUG' ? severity : undefined,
      stepsToReproduce: type === 'BUG' ? stepsToReproduce : undefined,
      linkedTestCaseCode: type === 'BUG' ? linkedTestCaseCode : undefined,
      linkedDocumentId: linkedDocId,
      linkedRequirementKeyCode: linkedReqKey || undefined,
      linkedRequirementTitle: prefillReq?.reqTitle,
    })

    onSuccess(newIssue)
  }

  return (
    <Modal title={`Tạo mới ${type === 'TASK' ? 'Task (Công việc)' : 'Bug (Lỗi)'}`} open={true} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Chọn loại Task / Bug */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('TASK')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition-colors',
              type === 'TASK' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600',
            )}
          >
            <JiraTaskIcon />
            <span>Task (Công việc)</span>
          </button>
          <button
            type="button"
            onClick={() => setType('BUG')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition-colors',
              type === 'BUG' ? 'border-rose-600 bg-rose-50 text-rose-800' : 'border-slate-200 text-slate-600',
            )}
          >
            <JiraBugIcon />
            <span>Bug (Báo lỗi phần mềm)</span>
          </button>
        </div>

        <TextField
          label="Tiêu đề tóm tắt (Summary)"
          required
          placeholder="VD: Cấu hình Spring Security OAuth2 và JWT filter..."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />

        <TextAreaField
          label="Mô tả chi tiết (Description)"
          placeholder="Mô tả phạm vi thực hiện, kết quả kỳ vọng..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        {/* Các trường dành riêng cho Bug */}
        {type === 'BUG' && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Mức độ nghiêm trọng (Severity)"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BugSeverity)}
              >
                <option value="BLOCKER">💥 BLOCKER</option>
                <option value="CRITICAL">🔴 CRITICAL</option>
                <option value="MAJOR">🟠 MAJOR</option>
                <option value="MINOR">🟡 MINOR</option>
              </SelectField>

              <TextField
                label="Mã Test Case phát hiện (nếu có)"
                placeholder="VD: TC-01-01"
                value={linkedTestCaseCode}
                onChange={(e) => setLinkedTestCaseCode(e.target.value)}
              />
            </div>

            <TextAreaField
              label="Các bước tái hiện (Steps to Reproduce)"
              placeholder="1. Mở màn hình đăng nhập...&#10;2. Nhập email sai 5 lần...&#10;3. Quan sát hệ thống..."
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* Giai đoạn & Người phụ trách */}
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Giai đoạn (Phase)"
            value={phaseId}
            onChange={(e) => setPhaseId(Number(e.target.value))}
          >
            {phases.map((p) => (
              <option key={p.phaseId} value={p.phaseId}>
                {p.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Người phụ trách (Assignee)"
            value={assigneeName}
            onChange={(e) => setAssigneeName(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.fullName} value={m.fullName}>
                {m.fullName} ({m.role.name})
              </option>
            ))}
          </SelectField>
        </div>

        {/* Độ ưu tiên & Điểm */}
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Độ ưu tiên (Priority)"
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
          >
            <option value="HIGHEST">Highest</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </SelectField>

          <TextField
            label="Story Points (pts)"
            type="number"
            min={1}
            max={21}
            value={String(storyPoints)}
            onChange={(e) => setStoryPoints(Number(e.target.value))}
          />
        </div>

        {/* Liên kết Yêu cầu Confluence (Tùy chọn) */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
            <span>🔗</span>
            <span>Liên kết Yêu cầu Đặc tả Confluence (Tùy chọn)</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Tài liệu"
              value={linkedDocId || ''}
              onChange={(e) => setLinkedDocId(Number(e.target.value) || undefined)}
            >
              <option value="">-- Không liên kết --</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}: {d.title}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Mã REQ (VD: REQ-01)"
              placeholder="REQ-01"
              value={linkedReqKey}
              onChange={(e) => setLinkedReqKey(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="secondary" inline onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" inline type="submit">
            Tạo Issue
          </Button>
        </div>
      </form>
    </Modal>
  )
}
