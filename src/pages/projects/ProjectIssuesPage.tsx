import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
import { DiagramViewer } from '@/components/documents/DiagramViewer'
import type {
  BugSeverity,
  IssuePriority,
  IssueType,
  ProjectIssue,
} from '@/types/issue'
import type { PhaseDto, ProjectDto, StatusCategory, WorkflowStatusDto } from '@/types/project'
import type { SpecificationDocument } from '@/types/document'

// --- ICONS CHUẨN ATLASSIAN JIRA ---

function JiraLogoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#2563EB" />
      <path
        d="M11.5 5.5a1 1 0 011 1v5.172a1 1 0 01-.293.707l-3.5 3.5a1 1 0 01-1.414-1.414l3.207-3.207V6.5a1 1 0 011-1z"
        fill="#FFFFFF"
      />
      <path
        d="M17.5 11.5a1 1 0 011 1v2.172a1 1 0 01-.293.707l-2 2a1 1 0 01-1.414-1.414l1.707-1.707V12.5a1 1 0 011-1z"
        fill="#93C5FD"
      />
    </svg>
  )
}

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

// ========================================================
// TRANG CHÍNH: JIRA WORKSPACE TOÀN MÀN HÌNH (100vw x 100vh)
// ========================================================

export function ProjectIssuesPage() {
  const { projectId: projectIdParam } = useParams<{ projectId?: string }>()
  const projectId = projectIdParam ? Number(projectIdParam) : 20
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tải thông tin dự án
  const projectAsync = useAsync(() => projectApi.get(projectId), [projectId])
  const project = projectAsync.data || ({
    projectId,
    key: 'CORE',
    name: 'SSAM Core Platform',
    status: 'ACTIVE',
    myRole: { code: 'PROJECT_MANAGER', name: 'Project Manager' },
    myPermissions: ['*'],
  } as ProjectDto)
  const isArchived = project.status === 'ARCHIVED'

  // Chế độ xem: Bảng Kanban | Danh sách Navigator | Split-View REQ
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'split'>('kanban')

  // Giai đoạn SDLC: 'ALL' hoặc id của Phase
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | 'ALL'>('ALL')

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TASK' | 'BUG'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IssuePriority>('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'ALL'>('ALL')
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyStale, setOnlyStale] = useState(false)

  // Dữ liệu API
  const issuesAsync = useAsync(() => issueApi.getIssues(projectId, project.key), [projectId, project.key])
  const workflowAsync = useAsync(() => projectApi.workflow(projectId), [projectId])
  const membersAsync = useAsync(() => projectApi.listMembers(projectId), [projectId])
  const docsAsync = useAsync(() => documentApi.list(projectId), [projectId])

  const allIssues = issuesAsync.data ?? []
  const phases = workflowAsync.data?.phases ?? []
  const members = membersAsync.data ?? []
  const documents = docsAsync.data ?? []

  // Issue đang được chọn xem chi tiết (Toàn màn hình)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(searchParams.get('issueId') || null)

  // Modal Tạo Issue
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [prefillReq, setPrefillReq] = useState<{
    docId?: number
    reqId?: string
    reqKey?: string
    reqTitle?: string
  } | null>(null)

  // Modal Bàn giao việc (Re-assign)
  const [reassignIssueData, setReassignIssueData] = useState<ProjectIssue | null>(null)
  const [reassignName, setReassignName] = useState('')
  const [reassignRole, setReassignRole] = useState('')
  const [reassignNote, setReassignNote] = useState('')

  // Modal Yêu cầu Ghi chú Chuyển trạng thái (requireComment)
  const [transitionPrompt, setTransitionPrompt] = useState<{
    issue: ProjectIssue
    targetStatus: WorkflowStatusDto
  } | null>(null)
  const [transitionComment, setTransitionComment] = useState('')

  // Modal Cảnh báo Đỏ Xóa Issue (MSG04 / GB-07)
  const [deleteWarningIssue, setDeleteWarningIssue] = useState<{
    issue: ProjectIssue
    message: string
  } | null>(null)

  // Thông báo lỗi chặn thao tác (MSG05)
  const [ruleErrorMsg, setRuleErrorMsg] = useState<string | null>(null)

  // Đồng bộ URL search param
  useEffect(() => {
    const qIssueId = searchParams.get('issueId')
    if (qIssueId && qIssueId !== selectedIssueId) {
      setSelectedIssueId(qIssueId)
    }
  }, [searchParams])

  const handleSelectIssue = (id: string | null) => {
    setSelectedIssueId(id)
    if (id) {
      setSearchParams({ issueId: id }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  // Cột Kanban
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
      return [
        { id: 101, name: 'To Do', category: 'TODO', color: '#64748b' },
        { id: 201, name: 'In Progress', category: 'IN_PROGRESS', color: '#0284c7' },
        { id: 301, name: 'In Review / QA', category: 'IN_PROGRESS', color: '#7c3aed' },
        { id: 401, name: 'Done', category: 'DONE', color: '#16a34a' },
      ]
    }, [activePhase])

  // Lọc Issues
  const filteredIssues = useMemo(() => {
    return allIssues.filter((iss) => {
      if (selectedPhaseId !== 'ALL' && iss.phaseId !== selectedPhaseId) return false
      if (typeFilter !== 'ALL' && iss.type !== typeFilter) return false
      if (priorityFilter !== 'ALL' && iss.priority !== priorityFilter) return false
      if (assigneeFilter !== 'ALL' && iss.assigneeName !== assigneeFilter) return false
      if (onlyMine) {
        const myName = user?.fullName || 'Sarah Lin'
        if (!iss.assigneeName.toLowerCase().includes(myName.toLowerCase()) && !iss.assigneeName.includes('Sarah')) {
          return false
        }
      }
      if (onlyStale && iss.traceabilityStatus === 'FRESH') return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchKey = iss.key.toLowerCase().includes(q)
        const matchSummary = iss.summary.toLowerCase().includes(q)
        const matchDesc = iss.description.toLowerCase().includes(q)
        const matchReq = (iss.linkedRequirementKeyCode || '').toLowerCase().includes(q)
        if (!matchKey && !matchSummary && !matchDesc && !matchReq) return false
      }
      return true
    })
  }, [allIssues, selectedPhaseId, typeFilter, priorityFilter, assigneeFilter, onlyMine, onlyStale, searchQuery, user])

  // Lấy Issue đang chọn
  const currentSelectedIssue = useMemo(() => {
    return allIssues.find((i) => i.id === selectedIssueId) || null
  }, [allIssues, selectedIssueId])

  // Kiểm tra quy tắc chuyển trạng thái
  const validateAndTransition = async (
    issue: ProjectIssue,
    targetStatus: { id: number; name: string; category: StatusCategory },
  ) => {
    if (isArchived) {
      setRuleErrorMsg('Dự án đã lưu trữ — không thể thay đổi trạng thái.')
      return
    }
    if (issue.statusId === targetStatus.id || issue.statusName === targetStatus.name) return

    const issuePhase = phases.find((p) => p.phaseId === issue.phaseId)
    if (issuePhase && issuePhase.transitions.length > 0) {
      const trans = issuePhase.transitions.find(
        (t) => t.fromStatusId === issue.statusId && t.toStatusId === targetStatus.id,
      )
      if (trans) {
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
        if (trans.requireComment) {
          const fullStatus = issuePhase.statuses.find((s) => s.statusId === targetStatus.id)
          if (fullStatus) {
            setTransitionPrompt({ issue, targetStatus: fullStatus })
            return
          }
        }
      }
    }

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
    if (issue) validateAndTransition(issue, col)
  }

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

  const clearAllFilters = () => {
    setTypeFilter('ALL')
    setPriorityFilter('ALL')
    setAssigneeFilter('ALL')
    setOnlyMine(false)
    setOnlyStale(false)
    setSearchQuery('')
  }

  const staleIssuesCount = allIssues.filter((i) => i.traceabilityStatus !== 'FRESH').length

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col overflow-hidden text-slate-800 font-sans">
      {/* Cảnh báo lỗi quy tắc chuyển đổi (MSG05) */}
      {ruleErrorMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800 shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>⚠️ {ruleErrorMsg}</span>
          <button
            type="button"
            onClick={() => setRuleErrorMsg(null)}
            className="font-bold text-red-600 hover:text-red-900 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. THANH TOP NAVIGATION BAR CHUẨN JIRA (CAO 56PX)       */}
      {/* ======================================================== */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-2xs z-30">
        {/* BÊN TRÁI: ĐIỀU HƯỚNG DỰ ÁN + TÊN KHÔNG GIAN + BỘ 3 VIEW MODES */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/projects/${project.projectId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
            title="Quay lại Trang Tổng quan dự án"
          >
            <span>← Dự án [{project.key}]</span>
          </Link>

          <span className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Biểu tượng Jira + Tên Space */}
          <div className="flex items-center gap-2 shrink-0">
            <JiraLogoIcon className="h-6 w-6" />
            <span className="font-extrabold text-sm text-slate-900 tracking-tight hidden sm:inline">
              Jira Workspace · {project.name}
            </span>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-700 border border-blue-200">
              [{project.key}]
            </span>
          </div>

          <span className="h-4 w-px bg-slate-200 shrink-0 hidden md:block" />

          {/* Bộ 3 Chế độ Xem: Kanban | Navigator | Split-View */}
          <div className="hidden md:flex items-center rounded-lg border border-slate-200 bg-slate-100/70 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all',
                viewMode === 'kanban'
                  ? 'bg-white text-blue-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span>📋 Bảng Kéo Thả (Kanban)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all',
                viewMode === 'list'
                  ? 'bg-white text-blue-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span>📑 Danh sách (Navigator)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all',
                viewMode === 'split'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span>📖 Split-View REQ</span>
            </button>
          </div>
        </div>

        {/* BÊN PHẢI: TÌM KIẾM + LỌC MEMBER + LIÊN KẾT CONFLUENCE + NÚT TẠO ISSUE */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Ô tìm kiếm nhanh */}
          <div className="relative w-48 sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã TEST-101, tóm tắt..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
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

          {/* Dãy Avatar thành viên lọc nhanh */}
          <div className="hidden lg:flex items-center -space-x-1 pl-1">
            {members.slice(0, 4).map((m) => (
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

          {/* Nút Việc của tôi */}
          <button
            type="button"
            onClick={() => setOnlyMine(!onlyMine)}
            className={clsx(
              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors hidden sm:flex items-center gap-1',
              onlyMine
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span>👤 Việc của tôi</span>
          </button>

          {/* Nút Mở Tài liệu Confluence */}
          <Link
            to={`/projects/${project.projectId}/documents`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
            title="Mở Không gian Soạn thảo Đặc tả Confluence Toàn màn hình"
          >
            <span>📄 Confluence</span>
          </Link>

          {/* Nút Tạo Issue chính */}
          <button
            type="button"
            disabled={isArchived}
            onClick={() => {
              setPrefillReq(null)
              setShowCreateModal(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            <span>+ Tạo Issue</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. THANH SUB-BAR: GIAI ĐOẠN SDLC & BỘ LỌC PHỤ            */}
      {/* ======================================================== */}
      <div className="bg-slate-100/90 border-b border-slate-200/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 z-20">
        {/* Nhánh chọn Phase SDLC */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="font-mono text-[10px] font-bold uppercase text-slate-400 shrink-0 mr-1">
            SDLC Phase:
          </span>
          <button
            type="button"
            onClick={() => setSelectedPhaseId('ALL')}
            className={clsx(
              'rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 text-xs',
              selectedPhaseId === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/60',
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
                  'rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 flex items-center gap-1.5 text-xs',
                  selectedPhaseId === p.phaseId
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200/60',
                )}
              >
                <span>
                  P{idx + 1}: {p.name.replace(/^Phase \d+:\s*/, '')}
                </span>
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.2 text-[10px]',
                    selectedPhaseId === p.phaseId ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {phaseCount}
                </span>
              </button>
            )
          })}
        </div>

        {/* Các bộ lọc phụ: Loại + Priority + Cảnh báo Stale */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Lọc loại */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={clsx(
                'rounded px-2 py-0.5 text-xs transition-colors',
                typeFilter === 'ALL' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600',
              )}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('TASK')}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
                typeFilter === 'TASK' ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-600',
              )}
            >
              <JiraTaskIcon className="h-3 w-3" />
              <span>Task</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('BUG')}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
                typeFilter === 'BUG' ? 'bg-rose-50 font-bold text-rose-700' : 'text-slate-600',
              )}
            >
              <JiraBugIcon className="h-3 w-3" />
              <span>Bug</span>
            </button>
          </div>

          {/* Lọc Priority */}
          <select
            aria-label="Lọc theo độ ưu tiên"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | IssuePriority)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
          >
            <option value="ALL">Độ ưu tiên: Tất cả</option>
            <option value="HIGHEST">🔴 Highest</option>
            <option value="HIGH">🟠 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🔵 Low</option>
          </select>

          {/* Lọc cờ Stale */}
          <button
            type="button"
            onClick={() => setOnlyStale(!onlyStale)}
            className={clsx(
              'rounded-lg border px-2 py-1 font-semibold transition-colors flex items-center gap-1 text-xs',
              onlyStale
                ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span>⚠️ REQ Stale</span>
            {staleIssuesCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                {staleIssuesCount}
              </span>
            )}
          </button>

          {(typeFilter !== 'ALL' || priorityFilter !== 'ALL' || assigneeFilter !== 'ALL' || onlyMine || onlyStale || searchQuery) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-rose-600 hover:underline pl-1"
            >
              ✕ Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. VÙNG KHÔNG GIAN LÀM VIỆC CHÍNH (FULL VIEWPORT)         */}
      {/* ======================================================== */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {/* CHẾ ĐỘ 1: KANBAN BOARD */}
        {viewMode === 'kanban' && (
          <div className="flex gap-4 h-full items-start min-w-max pb-2">
            {kanbanColumns.map((col) => {
              const colIssues = filteredIssues.filter((iss) => {
                if (activePhase) return iss.statusId === col.id || iss.statusName === col.name
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
                  className="flex flex-col w-[320px] max-h-full rounded-2xl bg-slate-200/60 border border-slate-300/70 p-3 transition-colors shadow-2xs"
                >
                  {/* Header Cột */}
                  <div className="flex items-center justify-between pb-2.5 px-1 border-b border-slate-300/60 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                        {col.name}
                      </span>
                      <span className="rounded-full bg-slate-300/80 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                        {colIssues.length}
                      </span>
                    </div>
                    {totalPoints > 0 && (
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        {totalPoints} pts
                      </span>
                    )}
                  </div>

                  {/* Danh sách Thẻ Issue */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {colIssues.map((issue) => {
                      const isStale = issue.traceabilityStatus !== 'FRESH'
                      return (
                        <div
                          key={issue.id}
                          draggable={!isArchived}
                          onDragStart={(e) => handleDragStart(e, issue.id)}
                          onClick={() => handleSelectIssue(issue.id)}
                          className={clsx(
                            'group relative rounded-xl border bg-white p-3.5 shadow-2xs transition-all hover:shadow-md hover:border-blue-400 cursor-pointer',
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

                            {/* Dropdown chuyển trạng thái nhanh */}
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

                          {/* Hàng 2: Summary */}
                          <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 mb-2">
                            {issue.summary}
                          </p>

                          {/* Hàng 3: Chip Confluence REQ */}
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

                          {/* Hàng 4: Priority + Points + Comments + Assignee */}
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
                      <div className="flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300/80 text-xs text-slate-400">
                        Kéo thả issue vào đây
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CHẾ ĐỘ 2: LIST VIEW */}
        {viewMode === 'list' && (
          <div className="h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
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
                        'hover:bg-blue-50/40 cursor-pointer transition-colors',
                        selectedIssueId === issue.id && 'bg-blue-50/70',
                      )}
                    >
                      <td className="py-3 px-4 text-center">
                        {issue.type === 'TASK' ? <JiraTaskIcon /> : <JiraBugIcon />}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-600 hover:underline">
                        {issue.key}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-lg">{issue.summary}</span>
                          {issue.severity && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-800 shrink-0">
                              {issue.severity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {issue.phaseName.replace(/^Phase \d+:\s*/, '')}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
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
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <JiraPriorityIcon priority={issue.priority} />
                          <span className="font-medium text-slate-600">{issue.priority}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center font-mono text-[9px] font-bold text-blue-800">
                            {issue.assigneeAvatar || 'SL'}
                          </div>
                          <span className="font-medium text-slate-800">{issue.assigneeName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-600">
                        {issue.storyPoints ?? '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap">
                        {formatDate(issue.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ 3: SPLIT-VIEW CONFLUENCE */}
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
      </main>

      {/* ======================================================== */}
      {/* 4. MÀN HÌNH CHI TIẾT ISSUE TOÀN MÀN HÌNH CHUẨN JIRA     */}
      {/*    (LOẠI BỎ HOÀN TOÀN RIGHT DRAWER HẸP)                  */}
      {/* ======================================================== */}
      {currentSelectedIssue && viewMode !== 'split' && (
        <FullScreenIssueView
          issue={currentSelectedIssue}
          filteredIssues={filteredIssues}
          phases={phases}
          members={members}
          onSelectIssue={handleSelectIssue}
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
      {/* MODAL TẠO MỚI TASK / BUG                                */}
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

      {/* MODAL BÀN GIAO VIỆC (RE-ASSIGN) */}
      {reassignIssueData && (
        <Modal
          title={`⇄ Bàn giao công việc ${reassignIssueData.key}`}
          open={true}
          onClose={() => setReassignIssueData(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Chọn thành viên mới để chuyển quyền phụ trách. Hệ thống sẽ ghi nhận nhật ký bất biến.
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
              placeholder="VD: @Minh Luong nhờ bạn tiếp quản luồng Webhook này nhé..."
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

      {/* MODAL GHI CHÚ CHUYỂN TRẠNG THÁI */}
      {transitionPrompt && (
        <Modal
          title={`Chuyển trạng thái sang "${transitionPrompt.targetStatus.name}"`}
          open={true}
          onClose={() => setTransitionPrompt(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Quy tắc chuyển đổi workflow của Phase yêu cầu nhập ghi chú trước khi hoàn tất bước chuyển này.
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

      {/* MODAL CẢNH BÁO ĐỎ XÓA ISSUE (MSG04 / GB-07) */}
      {deleteWarningIssue && (
        <Modal
          title="⚠️ Cảnh báo Đứt gãy Ma trận RTM (MSG04)"
          open={true}
          onClose={() => setDeleteWarningIssue(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 leading-relaxed font-medium">
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
// MÀN HÌNH CHI TIẾT ISSUE TOÀN MÀN HÌNH CHUẨN JIRA
// (FULL-SCREEN DEDICATED ISSUE VIEW - BỐ CỤC 3 CỘT RỘNG RÃI)
// ========================================================

function FullScreenIssueView({
  issue,
  filteredIssues,
  phases,
  members,
  onSelectIssue,
  onClose,
  onReload,
  onDeleteClick,
  onReassignClick,
  isArchived,
}: {
  issue: ProjectIssue
  filteredIssues: ProjectIssue[]
  phases: PhaseDto[]
  members: { userId: number; fullName: string; role: { name: string; code?: string | null } }[]
  onSelectIssue: (id: string | null) => void
  onClose: () => void
  onReload: () => void
  onDeleteClick: () => void
  onReassignClick: () => void
  isArchived: boolean
}) {
  const { user } = useAuth()

  // Chế độ: Toàn màn hình 100% vs Cửa sổ Modal 94%
  const [isCenteredModal, setIsCenteredModal] = useState(false)

  // Cột 1 (Sidebar danh sách Issue bên trái): Đóng / Mở
  const [isLeftNavCollapsed, setIsLeftNavCollapsed] = useState(false)

  // Sửa tiêu đề và mô tả
  const [summary, setSummary] = useState(issue.summary)
  const [description, setDescription] = useState(issue.description)
  const [isEditing, setIsEditing] = useState(false)

  // Tab dưới: Bình luận | Nhật ký | Lịch sử REQ
  const [activeTab, setActiveTab] = useState<'comments' | 'activity' | 'req_history'>('comments')
  const [commentInput, setCommentInput] = useState('')

  // Bung xem toàn bộ nội dung & sơ đồ của REQ
  const [isReqExpanded, setIsReqExpanded] = useState(false)

  // Tải chi tiết RequirementItem gốc & Lịch sử Diff từ documentApi nếu có linkedDocumentId
  const reqDetailsAsync = useAsync(async () => {
    if (!issue.linkedDocumentId) return null
    try {
      const docData = await documentApi.get(issue.linkedDocumentId)
      const matchedItem = docData.items.find(
        (i) => i.keyCode === issue.linkedRequirementKeyCode || i.id === issue.linkedRequirementItemId,
      )
      const matchedHistory = docData.history.filter(
        (h) => h.requirementKeyCode === issue.linkedRequirementKeyCode,
      )
      return { item: matchedItem || null, history: matchedHistory, document: docData.document }
    } catch {
      return null
    }
  }, [issue.linkedDocumentId, issue.linkedRequirementKeyCode])

  // Cập nhật khi issue đổi
  useEffect(() => {
    setSummary(issue.summary)
    setDescription(issue.description)
    setIsEditing(false)
    setIsReqExpanded(false)
  }, [issue.id])

  // Phím Esc để thoát
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Điều hướng nhanh Previous / Next Issue
  const currentIndex = useMemo(() => {
    return filteredIssues.findIndex((i) => i.id === issue.id)
  }, [filteredIssues, issue.id])

  const prevIssue = currentIndex > 0 ? filteredIssues[currentIndex - 1] : null
  const nextIssue = currentIndex < filteredIssues.length - 1 ? filteredIssues[currentIndex + 1] : null

  const handleSaveText = async () => {
    await issueApi.updateIssue(
      issue.id,
      { summary, description },
      user?.fullName || 'Người dùng',
      'Chỉnh sửa tiêu đề và mô tả chi tiết',
    )
    setIsEditing(false)
    onReload()
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim()) return
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

  const linkedItem = reqDetailsAsync.data?.item
  const linkedHistory = reqDetailsAsync.data?.history ?? []

  // Khung ngoài (Full 100vw x 100vh hoặc Centered 94vw x 92vh)
  const outerWrapperClass = isCenteredModal
    ? 'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4'
    : 'fixed inset-0 z-50 bg-white flex flex-col overflow-hidden'

  const containerClass = isCenteredModal
    ? 'w-[94vw] h-[92vh] max-w-7xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200'
    : 'flex-1 flex flex-col overflow-hidden'

  return (
    <div className={outerWrapperClass}>
      <div className={containerClass}>
        {/* ======================================================== */}
        {/* HEADER ĐỈNH CỦA MÀN HÌNH CHI TIẾT ISSUE                  */}
        {/* ======================================================== */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs z-10">
          {/* NÚT QUAY LẠI + BREADCRUMBS + BADGES */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors shrink-0"
              title="Quay lại Bảng Kanban (Esc)"
            >
              <span>← Quay lại Bảng Kanban</span>
            </button>

            <span className="h-4 w-px bg-slate-200 shrink-0" />

            <div className="flex items-center gap-1.5 text-xs truncate">
              <span className="text-slate-500">{issue.phaseName}</span>
              <span className="text-slate-300">/</span>
              <span className="font-mono font-extrabold text-blue-600 text-sm">{issue.key}</span>
            </div>

            {/* Badge Loại */}
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold shadow-2xs shrink-0',
                issue.type === 'TASK' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800',
              )}
            >
              {issue.type === 'TASK' ? <JiraTaskIcon className="h-3 w-3" /> : <JiraBugIcon className="h-3 w-3" />}
              <span>{issue.type === 'TASK' ? 'Task' : 'Bug'}</span>
            </span>

            {/* Badge Trạng thái Truy xuất */}
            {issue.linkedRequirementKeyCode && (
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0',
                  issue.traceabilityStatus === 'FRESH'
                    ? 'bg-emerald-100 text-emerald-800'
                    : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                      ? 'bg-amber-100 text-amber-900 animate-pulse'
                      : 'bg-rose-100 text-rose-900',
                )}
              >
                {issue.traceabilityStatus === 'FRESH'
                  ? '✓ Fresh (Đồng bộ)'
                  : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                    ? '⚠️ Unconfirmed Stale'
                    : '🔴 Confirmed Stale'}
              </span>
            )}
          </div>

          {/* ĐIỀU HƯỚNG PREV / NEXT ISSUE + SIZE TOGGLE + CLOSE */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Chuyển Issue Trước / Sau */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                disabled={!prevIssue}
                onClick={() => prevIssue && onSelectIssue(prevIssue.id)}
                className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-medium"
                title={prevIssue ? `Chuyển sang ${prevIssue.key}` : 'Đã ở Issue đầu tiên'}
              >
                ↑ Trước
              </button>
              <span className="px-2 font-mono text-[11px] text-slate-500 font-bold border-x border-slate-200">
                {currentIndex >= 0 ? `${currentIndex + 1} / ${filteredIssues.length}` : '—'}
              </span>
              <button
                type="button"
                disabled={!nextIssue}
                onClick={() => nextIssue && onSelectIssue(nextIssue.id)}
                className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-medium"
                title={nextIssue ? `Chuyển sang ${nextIssue.key}` : 'Đã ở Issue cuối cùng'}
              >
                ↓ Sau
              </button>
            </div>

            {/* Nút Toggle Toàn màn hình 100% vs Cửa sổ 94% */}
            <button
              type="button"
              onClick={() => setIsCenteredModal(!isCenteredModal)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
              title="Chuyển đổi kích thước hiển thị"
            >
              <span>{isCenteredModal ? '⤢ 100%' : '⤡ 94%'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              title="Đóng (Esc)"
            >
              ✕
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* BỐ CỤC 3 CỘT RỘNG RÃI (FULL-HEIGHT SCROLLABLE COLUMNS)    */}
        {/* ======================================================== */}
        <div className="flex-1 flex overflow-hidden">
          {/* ------------------------------------------------------ */}
          {/* CỘT 1 (BÊN TRÁI): THANH NHẢY NHANH ISSUE TRONG PHASE (260PX) */}
          {/* ------------------------------------------------------ */}
          <div
            className={clsx(
              'border-r border-slate-200 bg-slate-50/70 flex flex-col transition-all duration-200 shrink-0',
              isLeftNavCollapsed ? 'w-10' : 'w-64',
            )}
          >
            {/* Header cột 1 */}
            <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-100/60">
              {!isLeftNavCollapsed && (
                <span className="truncate">Issues ({filteredIssues.length})</span>
              )}
              <button
                type="button"
                onClick={() => setIsLeftNavCollapsed(!isLeftNavCollapsed)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 text-xs"
                title={isLeftNavCollapsed ? 'Mở rộng danh sách' : 'Thu gọn'}
              >
                {isLeftNavCollapsed ? '▶' : '◀'}
              </button>
            </div>

            {/* Danh sách Issue click chọn nhanh */}
            {!isLeftNavCollapsed && (
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {filteredIssues.map((iss) => (
                  <button
                    key={iss.id}
                    type="button"
                    onClick={() => onSelectIssue(iss.id)}
                    className={clsx(
                      'w-full text-left rounded-xl p-2.5 transition-all border text-xs',
                      iss.id === issue.id
                        ? 'bg-blue-50 border-blue-400 shadow-2xs font-bold text-blue-900 ring-1 ring-blue-300'
                        : 'bg-white border-slate-200/80 hover:bg-slate-100/70 text-slate-700',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-mono font-bold">
                        {iss.type === 'TASK' ? <JiraTaskIcon className="h-3.5 w-3.5" /> : <JiraBugIcon className="h-3.5 w-3.5" />}
                        <span>{iss.key}</span>
                      </div>
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.2 text-[9px] font-bold',
                          iss.statusCategory === 'DONE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : iss.statusCategory === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {iss.statusName}
                      </span>
                    </div>
                    <p className="line-clamp-1 font-medium text-slate-800 text-[11px]">{iss.summary}</p>
                    {iss.linkedRequirementKeyCode && (
                      <span className="inline-block mt-1 text-[10px] font-mono text-emerald-700 font-semibold">
                        📄 {iss.linkedRequirementKeyCode}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------ */}
          {/* CỘT 2 (Ở GIỮA): NỘI DUNG CHI TIẾT TRỌNG TÂM (RỘNG RÃI) */}
          {/* ------------------------------------------------------ */}
          <div className="flex-1 overflow-y-auto px-8 lg:px-12 py-8 bg-white space-y-6">
            {/* TIÊU ĐỀ LỚN & NÚT CHUYỂN TASK ↔ BUG */}
            <div>
              <div className="flex items-center gap-3 mb-2">
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
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition-all shadow-2xs',
                    issue.type === 'TASK'
                      ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                      : 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
                  )}
                  title="Nhấp để chuyển đổi giữa Task và Bug"
                >
                  {issue.type === 'TASK' ? <JiraTaskIcon /> : <JiraBugIcon />}
                  <span>{issue.type === 'TASK' ? 'Task (Công việc)' : 'Bug (Lỗi phần mềm)'}</span>
                  <span className="text-[10px] text-slate-400">⇄ Đổi loại</span>
                </button>
              </div>

              {/* Tiêu đề tóm tắt có thể chỉnh sửa trực tiếp */}
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full rounded-xl border border-blue-500 p-3 text-xl font-extrabold text-slate-900 outline-none ring-2 ring-blue-100"
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 outline-none focus:border-blue-500 leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" inline onClick={handleSaveText}>
                      Lưu thay đổi
                    </Button>
                    <Button variant="secondary" inline onClick={() => setIsEditing(false)}>
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <h1
                    onClick={() => !isArchived && setIsEditing(true)}
                    className="text-2xl font-extrabold text-slate-900 leading-snug cursor-pointer hover:bg-slate-50 p-2 rounded-xl -m-2 transition-colors border border-transparent hover:border-slate-200"
                    title="Nhấp để sửa tiêu đề"
                  >
                    {issue.summary}
                  </h1>
                  <div
                    onClick={() => !isArchived && setIsEditing(true)}
                    className="mt-4 text-xs text-slate-700 whitespace-pre-line leading-relaxed cursor-pointer hover:bg-slate-50 p-3 rounded-xl border border-transparent hover:border-slate-200 transition-colors bg-slate-50/50"
                    title="Nhấp để sửa mô tả chi tiết"
                  >
                    {issue.description || 'Chưa có mô tả chi tiết. Nhấp vào đây để thêm mô tả.'}
                  </div>
                </div>
              )}
            </div>

            {/* KHUNG THÔNG TIN TÁI HIỆN LỖI (DÀNH CHO BUG) */}
            {issue.type === 'BUG' && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-rose-200/80 pb-2.5">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-rose-950 flex items-center gap-2">
                    <span>🐞</span>
                    <span>Thông tin Tái hiện Lỗi & Đối chiếu Kỳ vọng</span>
                  </span>
                  {issue.linkedTestCaseCode && (
                    <span className="rounded-lg bg-rose-200 px-2.5 py-1 font-mono text-[11px] font-extrabold text-rose-950 border border-rose-300">
                      Test Case: {issue.linkedTestCaseCode}
                    </span>
                  )}
                </div>

                {issue.stepsToReproduce && (
                  <div className="space-y-1.5 text-xs text-rose-950 bg-white/90 rounded-xl p-3.5 border border-rose-200/80">
                    <p className="font-bold text-[11px] uppercase tracking-wider text-rose-900">
                      Các bước tái hiện (Steps to Reproduce):
                    </p>
                    <p className="whitespace-pre-line leading-relaxed font-mono text-[11px] bg-rose-50/40 p-2.5 rounded border border-rose-100">
                      {issue.stepsToReproduce}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* KHUNG TRUY XUẤT YÊU CẦU ĐẶC TẢ CONFLUENCE (REQUIREMENT TRACEABILITY PANEL) */}
            <div
              className={clsx(
                'rounded-2xl border p-5 space-y-4 shadow-2xs transition-all',
                issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                  ? 'border-amber-300 bg-amber-50/70'
                  : issue.traceabilityStatus === 'CONFIRMED_STALE'
                    ? 'border-rose-300 bg-rose-50/70'
                    : 'border-emerald-200 bg-emerald-50/60',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">📄</span>
                  <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                    Liên kết Đặc tả Yêu cầu Confluence
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-bold shadow-2xs',
                      issue.traceabilityStatus === 'FRESH'
                        ? 'bg-emerald-200 text-emerald-950'
                        : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                          ? 'bg-amber-300 text-amber-950 animate-pulse'
                          : 'bg-rose-300 text-rose-950',
                    )}
                  >
                    {issue.traceabilityStatus === 'FRESH'
                      ? '✓ Fresh (Đồng bộ)'
                      : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                        ? '⚠️ Unconfirmed Stale (Sửa nháp)'
                        : '🔴 Confirmed Stale (Đã duyệt bản mới)'}
                  </span>
                </div>
              </div>

              {issue.linkedRequirementKeyCode ? (
                <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-extrabold text-emerald-700">
                      [{issue.linkedRequirementKeyCode}]
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Nút Bung xem toàn bộ nội dung & sơ đồ ngay tại đây */}
                      <button
                        type="button"
                        onClick={() => setIsReqExpanded(!isReqExpanded)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <span>{isReqExpanded ? '▲ Thu gọn đặc tả' : '📖 Bung xem toàn bộ nội dung & Sơ đồ'}</span>
                      </button>

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={async () => {
                            await issueApi.unlinkRequirement(issue.id, user?.fullName || 'Người dùng')
                            onReload()
                          }}
                          className="text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Gỡ liên kết
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-bold text-slate-900">
                    {issue.linkedRequirementTitle || 'Yêu cầu Confluence'}
                  </p>

                  {/* Nút xác nhận đồng bộ Stale -> Fresh */}
                  {issue.traceabilityStatus !== 'FRESH' && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                      <span className="text-xs text-amber-950 font-medium">
                        ⚠️ Yêu cầu [<b>{issue.linkedRequirementKeyCode}</b>] đã sửa đổi bên Confluence. Hãy kiểm tra bản Diff và cập nhật code tương ứng.
                      </span>
                      <Button
                        variant="primary"
                        inline
                        className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1"
                        onClick={async () => {
                          await issueApi.resetStaleStatus(issue.id, user?.fullName || 'Người dùng')
                          onReload()
                        }}
                      >
                        ✓ Xác nhận đã cập nhật theo REQ mới
                      </Button>
                    </div>
                  )}

                  {/* VÙNG BUNG XEM TOÀN BỘ NỘI DUNG & SƠ ĐỒ REQ */}
                  {isReqExpanded && linkedItem && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in duration-200 bg-slate-50/50 p-4 rounded-xl">
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">
                          Nội dung Đặc tả Kỹ thuật:
                        </p>
                        <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                          {linkedItem.content}
                        </p>
                      </div>

                      {linkedItem.acceptanceCriteria && (
                        <div>
                          <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">
                            Tiêu chí Nghiệm thu (Acceptance Criteria):
                          </p>
                          <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                            {linkedItem.acceptanceCriteria}
                          </p>
                        </div>
                      )}

                      {/* Sơ đồ Mermaid nếu có */}
                      {linkedItem.diagramSourceCode && (
                        <div>
                          <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">
                            Sơ đồ Luồng Nghiệp vụ (Mermaid Diagram):
                          </p>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-hidden">
                            <DiagramViewer
                              code={linkedItem.diagramSourceCode}
                              title={linkedItem.diagramTitle || 'Sơ đồ luồng'}
                              diagramType={linkedItem.diagramType}
                              readOnly
                            />
                          </div>
                        </div>
                      )}

                      {/* Nếu có bản Diff Lịch sử thay đổi gần nhất */}
                      {linkedHistory.length > 0 && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2">
                          <p className="font-bold text-xs text-blue-900">
                            🔍 Bản đối chiếu thay đổi gần nhất của [{issue.linkedRequirementKeyCode}]:
                          </p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded bg-rose-50 border border-rose-200 p-2">
                              <span className="font-bold text-rose-800 text-[10px] block mb-1">Trước khi sửa:</span>
                              <p className="line-clamp-4 text-slate-600">{linkedHistory[0].previousContent || '—'}</p>
                            </div>
                            <div className="rounded bg-emerald-50 border border-emerald-200 p-2">
                              <span className="font-bold text-emerald-800 text-[10px] block mb-1">Sau khi sửa:</span>
                              <p className="line-clamp-4 text-slate-800">{linkedHistory[0].newContent || '—'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-white p-4 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  Issue này chưa có liên kết với mục yêu cầu nào bên Confluence.
                </div>
              )}
            </div>

            {/* TAB HOẠT ĐỘNG, BÌNH LUẬN & LỊCH SỬ THAY ĐỔI */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex border-b border-slate-200 text-xs font-bold gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={clsx(
                    'pb-3 px-4 border-b-2 transition-colors',
                    activeTab === 'comments'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900',
                  )}
                >
                  💬 Bình luận & Phối hợp ({issue.comments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={clsx(
                    'pb-3 px-4 border-b-2 transition-colors',
                    activeTab === 'activity'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900',
                  )}
                >
                  🕒 Nhật ký hoạt động ({issue.activityLog.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('req_history')}
                  className={clsx(
                    'pb-3 px-4 border-b-2 transition-colors',
                    activeTab === 'req_history'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900',
                  )}
                >
                  🔍 Lịch sử Thay đổi Yêu cầu ({linkedHistory.length})
                </button>
              </div>

              {/* TAB 1: BÌNH LUẬN */}
              {activeTab === 'comments' && (
                <div className="mt-5 space-y-4">
                  <form onSubmit={handleAddComment} className="space-y-2.5">
                    <textarea
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Viết bình luận, gắn thẻ @ để nhắc tên đồng nghiệp..."
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>Nhắc tên nhanh:</span>
                        {(members.length > 0
                          ? members.map((m) => m.fullName)
                          : ['Sarah Lin', 'Phạm Minh Lương', 'Vũ Kim Kỳ', 'Vũ Thị Mai']
                        )
                          .slice(0, 5)
                          .map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => setCommentInput((prev) => `${prev} @${name} `)}
                              className="rounded-lg bg-slate-100 px-2 py-0.5 hover:bg-slate-200 text-slate-700 font-semibold"
                            >
                              @{name}
                            </button>
                          ))}
                      </div>
                      <Button variant="primary" inline type="submit" disabled={!commentInput.trim()}>
                        Gửi bình luận
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-3 pt-2">
                    {issue.comments.map((cmt) => (
                      <div key={cmt.id} className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900">{cmt.authorName}</span>
                          <span className="text-[11px] text-slate-400">{formatDate(cmt.createdAt)}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-line leading-relaxed">{cmt.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: NHẬT KÝ HOẠT ĐỘNG */}
              {activeTab === 'activity' && (
                <div className="mt-5 space-y-3.5">
                  {issue.activityLog.map((act) => (
                    <div key={act.id} className="flex items-start gap-3 text-xs border-l-2 border-blue-500 pl-3 py-0.5">
                      <div>
                        <p className="text-slate-800 font-semibold">
                          <b>{act.authorName}</b>: {act.action}
                        </p>
                        {act.details && <p className="text-slate-500 text-[11px] mt-0.5">{act.details}</p>}
                        <p className="text-[10px] text-slate-400 mt-1">{formatDate(act.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: LỊCH SỬ THAY ĐỔI REQ */}
              {activeTab === 'req_history' && (
                <div className="mt-5 space-y-3">
                  {linkedHistory.length > 0 ? (
                    linkedHistory.map((h) => (
                      <div key={h.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {h.changedBy} đã sửa đổi [{h.requirementKeyCode}]
                          </span>
                          <span className="text-[11px] text-slate-400">{formatDate(h.changedAt)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                          <div className="bg-rose-50 border border-rose-200 rounded p-2 text-slate-700">
                            <span className="font-bold text-[10px] text-rose-800 block mb-1">Nội dung cũ:</span>
                            <p className="line-clamp-3">{h.previousContent || '—'}</p>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-slate-800">
                            <span className="font-bold text-[10px] text-emerald-800 block mb-1">Nội dung mới:</span>
                            <p className="line-clamp-3">{h.newContent || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Mục yêu cầu này chưa có bản ghi lịch sử thay đổi nào.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------ */}
          {/* CỘT 3 (BÊN PHẢI): BẢNG ĐIỀU KHIỂN THUỘC TÍNH (360PX)   */}
          {/* ------------------------------------------------------ */}
          <div className="w-80 lg:w-90 bg-slate-50/80 border-l border-slate-200 p-6 overflow-y-auto space-y-6 shrink-0">
            {/* TRẠNG THÁI WORKFLOW NỔI BẬT */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Trạng thái Quy trình (Workflow Status)
              </label>
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
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900 outline-none ring-1 ring-slate-100"
              >
                {(phases.find((p) => p.phaseId === issue.phaseId)?.statuses || []).map((s) => (
                  <option key={s.statusId} value={s.statusId}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            {/* DETAILS CARD */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs space-y-4 text-xs">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                Chi tiết Quản trị (Details)
              </h3>

              {/* Người phụ trách (Assignee) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-500 font-semibold">Người phụ trách:</span>
                  {!isArchived && (
                    <button
                      type="button"
                      onClick={onReassignClick}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      ⇄ Bàn giao
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                  <div className="h-7 w-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {issue.assigneeAvatar || 'SL'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">{issue.assigneeName}</p>
                    <p className="text-[10px] text-slate-500">{issue.assigneeRole}</p>
                  </div>
                </div>
              </div>

              {/* Giai đoạn Phase */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Giai đoạn (Phase):</span>
                <span className="font-bold text-slate-800">{issue.phaseName}</span>
              </div>

              {/* Độ ưu tiên Priority */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Độ ưu tiên:</span>
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
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="HIGHEST">🔴 Highest (Cao nhất)</option>
                  <option value="HIGH">🟠 High (Cao)</option>
                  <option value="MEDIUM">🟡 Medium (Trung bình)</option>
                  <option value="LOW">🔵 Low (Thấp)</option>
                </select>
              </div>

              {/* Story Points */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Điểm ước lượng (Story Points):</span>
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
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              {/* Severity (nếu là Bug) */}
              {issue.type === 'BUG' && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Mức độ lỗi (Severity):</span>
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
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="BLOCKER">💥 BLOCKER (Chặn release)</option>
                    <option value="CRITICAL">🔴 CRITICAL (Nghiêm trọng)</option>
                    <option value="MAJOR">🟠 MAJOR (Lớn)</option>
                    <option value="MINOR">🟡 MINOR (Nhỏ)</option>
                  </select>
                </div>
              )}

              {/* Linked Test Case */}
              {issue.type === 'BUG' && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Test Case liên kết:</span>
                  <input
                    type="text"
                    value={issue.linkedTestCaseCode || ''}
                    placeholder="VD: TC-01-01"
                    disabled={isArchived}
                    onChange={async (e) => {
                      await issueApi.updateIssue(
                        issue.id,
                        { linkedTestCaseCode: e.target.value.trim() },
                        user?.fullName || 'Người dùng',
                      )
                      onReload()
                    }}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              )}

              {/* Reporter */}
              <div className="border-t border-slate-100 pt-3">
                <span className="text-slate-400 text-[11px] block">Người tạo (Reporter):</span>
                <span className="font-semibold text-slate-800">{issue.reporterName}</span>
              </div>

              {/* Ngày tạo & Cập nhật */}
              <div className="text-[11px] text-slate-400 space-y-0.5">
                <p>Tạo: {formatDate(issue.createdAt)}</p>
                <p>Cập nhật: {formatDate(issue.updatedAt)}</p>
              </div>
            </div>

            {/* HÀNH ĐỘNG NGUY HIỂM: XÓA ISSUE */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isArchived}
                onClick={onDeleteClick}
                className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-rose-200 bg-rose-50/70 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
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

  const [activeDocId, setActiveDocId] = useState<number | null>(
    selectedIssue?.linkedDocumentId || documents[0]?.id || 101,
  )

  const docDetailAsync = useAsync(
    () => (activeDocId ? documentApi.get(activeDocId) : Promise.resolve(null)),
    [activeDocId],
  )

  const currentDoc = docDetailAsync.data?.document || null

  useEffect(() => {
    if (selectedIssue?.linkedDocumentId) {
      setActiveDocId(selectedIssue.linkedDocumentId)
    }
  }, [selectedIssue])

  const highlightedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedIssue?.linkedRequirementKeyCode, activeDocId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-hidden">
      {/* NỬA TRÁI (50%): DANH SÁCH & CHI TIẾT CỦA TASK / BUG ĐANG CHỌN */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="font-bold text-xs text-slate-800">
            Công việc & Lỗi ({issues.length})
          </span>
          <span className="text-[11px] font-mono text-slate-400">Jira Split-View</span>
        </div>

        {selectedIssue ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
            <p className="text-xs text-slate-600 whitespace-pre-line bg-slate-50 rounded-xl p-3 border border-slate-100">
              {selectedIssue.description}
            </p>

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
                      ? '⚠️ Unconfirmed Stale'
                      : '🔴 Confirmed Stale'}
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

                  {selectedIssue.traceabilityStatus !== 'FRESH' && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-800 font-medium">
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
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
          {currentDoc ? (
            <div>
              <div className="mb-4 pb-3 border-b border-slate-200">
                <span className="font-mono text-[10px] font-bold text-slate-400 uppercase">
                  {currentDoc.code} · {currentDoc.version}
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">{currentDoc.title}</h2>
              </div>

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
              placeholder="1. Mở màn hình đăng nhập...&#10;2. Nhập email sai 5 lần..."
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              rows={2}
            />
          </div>
        )}

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
