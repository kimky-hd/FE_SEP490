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
import { QuickModuleSwitcher } from '@/components/layout/QuickModuleSwitcher'
import type {
  BugSeverity,
  DataClassification,
  DepartmentLabel,
  EnvironmentType,
  IssuePriority,
  IssueType,
  IssueWatcher,
  ProjectIssue,
} from '@/types/issue'
import type { PhaseDto, ProjectDto, StatusCategory, WorkflowStatusDto } from '@/types/project'
import type { SpecificationDocument } from '@/types/document'

export const DEFAULT_DEPARTMENTS: DepartmentLabel[] = [
  'Backend Team',
  'Frontend Team',
  'BA & Product',
  'QA / Testing Team',
  'DevOps & SecOps',
  'UI/UX Design',
]

export const DEFAULT_COMPONENTS = [
  'Authentication & SSO',
  'RBAC & Permission',
  'Core Banking & VietQR',
  'Specification Document Editor',
  'Traceability & RTM',
  'AI Generation Engine',
  'Notification Service',
]

export function DataClassificationBadge({
  classification,
  className,
}: {
  classification?: DataClassification
  className?: string
}) {
  switch (classification) {
    case 'PUBLIC':
      return (
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10px] font-semibold border border-slate-200 shrink-0',
            className,
          )}
          title="Project Public Data"
        >
          <span>🌐</span>
          <span>PUBLIC</span>
        </span>
      )
    case 'INTERNAL':
      return (
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold border border-emerald-200 shrink-0',
            className,
          )}
          title="Internal Engineering Data"
        >
          <span>🏢</span>
          <span>INTERNAL</span>
        </span>
      )
    case 'CONFIDENTIAL_PII':
      return (
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded bg-amber-50 text-amber-900 px-1.5 py-0.5 text-[10px] font-bold border border-amber-300 shadow-2xs shrink-0',
            className,
          )}
          title="Sensitive PII / Confidential Data"
        >
          <span>🛡️</span>
          <span>PII / Sensitive</span>
        </span>
      )
    case 'RESTRICTED':
      return (
        <span
          className={clsx(
            'inline-flex items-center gap-1 rounded bg-rose-50 text-rose-900 px-1.5 py-0.5 text-[10px] font-extrabold border border-rose-300 shadow-2xs shrink-0',
            className,
          )}
          title="Highly Restricted / Financial & Secret Data"
        >
          <span>🔒</span>
          <span>RESTRICTED</span>
        </span>
      )
    default:
      return null
  }
}

export function DepartmentBadge({ label, className }: { label?: DepartmentLabel; className?: string }) {
  if (!label) return null
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold shrink-0',
        className,
      )}
    >
      {label}
    </span>
  )
}

// --- ENTERPRISE ISSUE TRACKER ICONS ---

function IssueTrackerIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#2563EB" />
      <path
        d="M7 8h10M7 12h7M7 16h5"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="17" cy="15" r="2.5" fill="#93C5FD" />
    </svg>
  )
}

function TaskIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={clsx('inline-flex items-center justify-center rounded bg-blue-600 text-white shadow-2xs shrink-0', className)}
      title="Task"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

function BugIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={clsx('inline-flex items-center justify-center rounded-full bg-rose-600 text-white shadow-2xs shrink-0', className)}
      title="Bug"
    >
      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 13h-2.1c-.2-.6-.5-1.2-.9-1.7l1.7-1.7-1.4-1.4-1.9 1.9C13.6 9.4 12.8 9 12 9s-1.6.4-2.4 1.1L7.7 8.2 6.3 9.6l1.7 1.7c-.4.5-.7 1.1-.9 1.7H5v2h2.1c.1.6.4 1.2.8 1.7l-1.8 1.8 1.4 1.4 1.9-1.9c.7.5 1.6.8 2.6.8s1.9-.3 2.6-.8l1.9 1.9 1.4-1.4-1.8-1.8c.4-.5.7-1.1.8-1.7H19v-2zm-7 4c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2s2 .9 2 2v1c0 1.1-.9 2-2 2z" />
      </svg>
    </span>
  )
}

function PriorityIcon({ priority }: { priority: IssuePriority }) {
  if (priority === 'HIGHEST') {
    return (
      <span className="inline-flex items-center text-rose-600" title="Priority: Highest">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
        </svg>
      </span>
    )
  }
  if (priority === 'HIGH') {
    return (
      <span className="inline-flex items-center text-rose-500" title="Priority: High">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </span>
    )
  }
  if (priority === 'MEDIUM') {
    return (
      <span className="inline-flex items-center text-amber-500" title="Priority: Medium">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-blue-500" title="Priority: Low">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  )
}

// ========================================================
// MAIN: FULL-SCREEN ISSUE TRACKING WORKSPACE (100vw x 100vh)
// ========================================================

export function ProjectIssuesPage() {
  const { projectId: projectIdParam } = useParams<{ projectId?: string }>()
  const projectId = projectIdParam ? Number(projectIdParam) : 20
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Load project data
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

  // View mode: Kanban Board | Issue Navigator | Split-View REQ
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'split'>('kanban')

  // SDLC Phase: "ALL" or phase id
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | 'ALL'>('ALL')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TASK' | 'BUG'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IssuePriority>('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'ALL'>('ALL')
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | DepartmentLabel>('ALL')
  const [componentFilter, setComponentFilter] = useState<string | 'ALL'>('ALL')
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | DataClassification>('ALL')
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyStale, setOnlyStale] = useState(false)

  // API Data
  const issuesAsync = useAsync(() => issueApi.getIssues(projectId, project.key), [projectId, project.key])
  const workflowAsync = useAsync(() => projectApi.workflow(projectId), [projectId])
  const membersAsync = useAsync(() => projectApi.listMembers(projectId), [projectId])
  const docsAsync = useAsync(() => documentApi.list(projectId), [projectId])

  const allIssues = issuesAsync.data ?? []
  const phases = workflowAsync.data?.phases ?? []
  const members = membersAsync.data ?? []
  const documents = docsAsync.data ?? []

  // Currently selected Issue (Full-Screen Detail View)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(searchParams.get('issueId') || null)

  // Create Issue Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [prefillReq, setPrefillReq] = useState<{
    docId?: number
    reqId?: string
    reqKey?: string
    reqTitle?: string
  } | null>(null)

  // Reassign Modal
  const [reassignIssueData, setReassignIssueData] = useState<ProjectIssue | null>(null)
  const [reassignName, setReassignName] = useState('')
  const [reassignRole, setReassignRole] = useState('')
  const [reassignNote, setReassignNote] = useState('')

  // Transition Comment Modal
  const [transitionPrompt, setTransitionPrompt] = useState<{
    issue: ProjectIssue
    targetStatus: WorkflowStatusDto
  } | null>(null)
  const [transitionComment, setTransitionComment] = useState('')

  // Delete Issue Modal (MSG04 / GB-07)
  const [deleteWarningIssue, setDeleteWarningIssue] = useState<{
    issue: ProjectIssue
    message: string
  } | null>(null)

  // Error message (MSG05)
  const [ruleErrorMsg, setRuleErrorMsg] = useState<string | null>(null)

  // Sync URL search params
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

  // Kanban columns
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

  // Components aggregated from defaults and existing data
  const availableComponents = useMemo(() => {
    const set = new Set<string>(DEFAULT_COMPONENTS)
    allIssues.forEach((i) => {
      if (i.component) set.add(i.component)
    })
    return Array.from(set)
  }, [allIssues])

  // Next automatic key
  const nextIssueNum = useMemo(() => {
    const nums = allIssues
      .filter((i) => i.projectId === projectId)
      .map((i) => {
        const parts = i.key.split('-')
        const num = parseInt(parts[parts.length - 1], 10)
        return isNaN(num) ? 0 : num
      })
      .filter((n) => n > 0)
    return nums.length > 0 ? Math.max(...nums) + 1 : 101
  }, [allIssues, projectId])
  const nextIssueKey = `${project.key || 'CORE'}-${nextIssueNum}`

  // Filter Issues
  const filteredIssues = useMemo(() => {
    return allIssues.filter((iss) => {
      if (selectedPhaseId !== 'ALL' && iss.phaseId !== selectedPhaseId) return false
      if (typeFilter !== 'ALL' && iss.type !== typeFilter) return false
      if (priorityFilter !== 'ALL' && iss.priority !== priorityFilter) return false
      if (assigneeFilter !== 'ALL' && iss.assigneeName !== assigneeFilter) return false
      if (departmentFilter !== 'ALL' && iss.departmentLabel !== departmentFilter) return false
      if (componentFilter !== 'ALL' && iss.component !== componentFilter) return false
      if (classificationFilter !== 'ALL' && iss.dataClassification !== classificationFilter) return false
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
        const matchComp = (iss.component || '').toLowerCase().includes(q)
        const matchDept = (iss.departmentLabel || '').toLowerCase().includes(q)
        const matchOwner = (iss.ownerName || '').toLowerCase().includes(q)
        const matchLabels = (iss.labels || []).some((l) => l.toLowerCase().includes(q))
        if (!matchKey && !matchSummary && !matchDesc && !matchReq && !matchComp && !matchDept && !matchOwner && !matchLabels) {
          return false
        }
      }
      return true
    })
  }, [
    allIssues,
    selectedPhaseId,
    typeFilter,
    priorityFilter,
    assigneeFilter,
    departmentFilter,
    componentFilter,
    classificationFilter,
    onlyMine,
    onlyStale,
    searchQuery,
    user,
  ])

  // Currently selected Issue
  const currentSelectedIssue = useMemo(() => {
    return allIssues.find((i) => i.id === selectedIssueId) || null
  }, [allIssues, selectedIssueId])

  // Check transition rules
  const validateAndTransition = async (
    issue: ProjectIssue,
    targetStatus: { id: number; name: string; category: StatusCategory },
  ) => {
    if (isArchived) {
      setRuleErrorMsg('Project is archived — status cannot be changed.')
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
              'MSG05: Permission denied: Your role does not have permission to execute this workflow transition.',
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
        user?.fullName || 'User',
      )
      issuesAsync.reload()
    } catch (err: unknown) {
      setRuleErrorMsg(err instanceof Error ? err.message : 'An error occurred while updating status.')
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
    setDepartmentFilter('ALL')
    setComponentFilter('ALL')
    setClassificationFilter('ALL')
    setOnlyMine(false)
    setOnlyStale(false)
    setSearchQuery('')
  }

  const staleIssuesCount = allIssues.filter((i) => i.traceabilityStatus !== 'FRESH').length

  return (
    <div className="flex flex-1 min-h-0 w-full bg-slate-50 flex-col overflow-hidden text-slate-800 font-sans relative">
      {/* Transition Rule Error (MSG05) */}
      {ruleErrorMsg && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800 shadow-lg animate-in fade-in slide-in-from-top-2">
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
      {/* ROW 2: ISSUE CONTEXTUAL SUB-TOOLBAR (44PX)                 */}
      {/* ======================================================== */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* LEFT: 3 WORKSPACE VIEWS + SDLC PHASE SELECTOR */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* 3 Main View Modes: Kanban | Navigator | Split-View */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 transition-all whitespace-nowrap shrink-0',
                viewMode === 'kanban'
                  ? 'bg-white text-blue-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span>📋 Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 transition-all whitespace-nowrap shrink-0',
                viewMode === 'list'
                  ? 'bg-white text-blue-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span>📑 List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 transition-all whitespace-nowrap shrink-0',
                viewMode === 'split'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span>📖 Split-View</span>
            </button>
          </div>

          <span className="h-4 w-px bg-slate-200 shrink-0 hidden md:block" />

          {/* SDLC Phase Selector Pills */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedPhaseId('ALL')}
              className={clsx(
                'rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 text-xs whitespace-nowrap',
                selectedPhaseId === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              )}
            >
              All Phases ({allIssues.length})
            </button>
            {phases.map((p, idx) => {
              const phaseCount = allIssues.filter((i) => i.phaseId === p.phaseId).length
              return (
                <button
                  key={p.phaseId}
                  type="button"
                  onClick={() => setSelectedPhaseId(p.phaseId)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 flex items-center gap-1.5 text-xs whitespace-nowrap',
                    selectedPhaseId === p.phaseId
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  )}
                >
                  <span>
                    P{idx + 1}: {p.name.replace(/^Phase \d+:\s*/, '')}
                  </span>
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.2 text-[10px]',
                      selectedPhaseId === p.phaseId ? 'bg-blue-700 text-white' : 'bg-white text-slate-600',
                    )}
                  >
                    {phaseCount}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* RIGHT: SEARCH + MEMBER FILTER + CREATE BUTTON */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Search */}
          <div className="relative w-40 sm:w-56 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search key, summary, component..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1 text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Member avatars filter */}
          <div className="hidden xl:flex items-center -space-x-1 pl-1 shrink-0">
            {members.slice(0, 4).map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => setAssigneeFilter(assigneeFilter === m.fullName ? 'ALL' : m.fullName)}
                title={`Filter issues for ${m.fullName}`}
                className={clsx(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-transform hover:scale-110 hover:z-10',
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

          {/* My Issues toggle */}
          <button
            type="button"
            onClick={() => setOnlyMine(!onlyMine)}
            className={clsx(
              'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors hidden lg:flex items-center gap-1 shrink-0 whitespace-nowrap',
              onlyMine
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span>👤 My Issues</span>
          </button>

          {/* Create Issue CTA */}
          <button
            type="button"
            disabled={isArchived}
            onClick={() => {
              setPrefillReq(null)
              setShowCreateModal(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shrink-0 whitespace-nowrap"
          >
            <span>+ Create Issue</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECONDARY FILTER STRIP                                   */}
      {/* ======================================================== */}
      <div className="bg-slate-100/90 border-b border-slate-200/80 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 z-10">

        {/* Filters: Type + Priority + Dept + Component + Security + Stale */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Issue Type filter */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={clsx(
                'rounded px-2 py-0.5 text-xs transition-colors',
                typeFilter === 'ALL' ? 'bg-slate-100 font-bold text-slate-900' : 'text-slate-600',
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('TASK')}
              className={clsx(
                'flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
                typeFilter === 'TASK' ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-600',
              )}
            >
              <TaskIcon className="h-3 w-3" />
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
              <BugIcon className="h-3 w-3" />
              <span>Bug</span>
            </button>
          </div>

          {/* Priority filter */}
          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | IssuePriority)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
          >
            <option value="ALL">Priority: All</option>
            <option value="HIGHEST">🔴 Highest</option>
            <option value="HIGH">🟠 High</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="LOW">🔵 Low</option>
          </select>

          {/* Department filter */}
          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value as 'ALL' | DepartmentLabel)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
          >
            <option value="ALL">🏢 Dept: All</option>
            {DEFAULT_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Component filter */}
          <select
            aria-label="Filter by component"
            value={componentFilter}
            onChange={(e) => setComponentFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none max-w-[145px] truncate"
          >
            <option value="ALL">🧩 Component: All</option>
            {availableComponents.map((comp) => (
              <option key={comp} value={comp}>
                {comp}
              </option>
            ))}
          </select>

          {/* Security / Data classification filter */}
          <select
            aria-label="Filter by data classification"
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value as 'ALL' | DataClassification)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
          >
            <option value="ALL">🛡️ Security: All</option>
            <option value="PUBLIC">🌐 PUBLIC</option>
            <option value="INTERNAL">🏢 INTERNAL</option>
            <option value="CONFIDENTIAL_PII">🛡️ CONFIDENTIAL / PII</option>
            <option value="RESTRICTED">🔒 RESTRICTED</option>
          </select>

          {/* Stale REQ Flag filter */}
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
            <span>⚠️ Stale REQs</span>
            {staleIssuesCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                {staleIssuesCount}
              </span>
            )}
          </button>

          {(typeFilter !== 'ALL' ||
            priorityFilter !== 'ALL' ||
            assigneeFilter !== 'ALL' ||
            departmentFilter !== 'ALL' ||
            componentFilter !== 'ALL' ||
            classificationFilter !== 'ALL' ||
            onlyMine ||
            onlyStale ||
            searchQuery) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-rose-600 hover:underline pl-1"
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MAIN WORKSPACE VIEWPORT (FULL VIEWPORT)         */}
      {/* ======================================================== */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {/* VIEW MODE 1: KANBAN BOARD */}
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
                  {/* Column Header */}
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

                  {/* Issue Cards */}
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
                          {/* Row 1: Type + Key + Severity + Menu */}
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              {issue.type === 'TASK' ? (
                                <TaskIcon className="h-4 w-4" />
                              ) : (
                                <BugIcon className="h-4 w-4" />
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

                            {/* Quick status dropdown */}
                            <div
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                aria-label="Change status"
                                value={
                                  kanbanColumns.some((c) => c.id === issue.statusId)
                                    ? issue.statusId
                                    : (kanbanColumns.find((c) => c.category === issue.statusCategory || c.name.toLowerCase() === (issue.statusName || '').toLowerCase())?.id ?? kanbanColumns[0]?.id)
                                }
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

                          {/* Row 2: Summary */}
                          <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 mb-2">
                            {issue.summary}
                          </p>

                          {/* Row 2.5: Component, Department & Data Classification badges */}
                          <div className="flex flex-wrap items-center gap-1 mb-2">
                            {issue.component && (
                              <span
                                className="rounded bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 truncate max-w-[120px]"
                                title={`Component: ${issue.component}`}
                              >
                                {issue.component}
                              </span>
                            )}
                            {issue.departmentLabel && (
                              <span
                                className="rounded bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 text-[9px]"
                                title={`Department: ${issue.departmentLabel}`}
                              >
                                {issue.departmentLabel}
                              </span>
                            )}
                            {issue.dataClassification === 'CONFIDENTIAL_PII' && (
                              <span
                                className="rounded bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 text-[9px] flex items-center gap-0.5"
                                title="Confidential / PII sensitive data"
                              >
                                <span>🛡️</span>
                                <span>PII</span>
                              </span>
                            )}
                            {issue.dataClassification === 'RESTRICTED' && (
                              <span
                                className="rounded bg-rose-100 text-rose-900 font-extrabold px-1.5 py-0.5 text-[9px] flex items-center gap-0.5"
                                title="Restricted / Financial & Keys"
                              >
                                <span>🔒</span>
                                <span>Restricted</span>
                              </span>
                            )}
                            {issue.dueDate && (
                              <span
                                className="rounded bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-[9px] text-slate-500 font-mono"
                                title={`Due Date: ${issue.dueDate}`}
                              >
                                📅 {issue.dueDate.slice(5)}
                              </span>
                            )}
                          </div>

                          {/* Row 3: Requirement REQ Chip */}
                          {issue.linkedRequirementKeyCode && (
                            <div
                              className="mb-2 flex items-center flex-wrap gap-1"
                              onClick={(e) => {
                                e.stopPropagation()
                                setViewMode('split')
                                setSelectedIssueId(issue.id)
                              }}
                            >
                              <span
                                className={clsx(
                                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-85 max-w-full flex-wrap',
                                  issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                                    ? 'border-amber-300 bg-amber-50 text-amber-900 font-bold'
                                    : issue.traceabilityStatus === 'CONFIRMED_STALE'
                                      ? 'border-rose-300 bg-rose-50 text-rose-900 font-bold'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                                )}
                                title="Click to view Document Spec Split-View"
                              >
                                <span className="shrink-0">📄</span>
                                <span className="font-mono font-bold shrink-0">{issue.linkedRequirementKeyCode}</span>
                                {issue.traceabilityStatus === 'UNCONFIRMED_STALE' && (
                                  <span className="rounded bg-amber-200/90 px-1.5 py-0.2 text-[9px] font-bold text-amber-950 whitespace-nowrap shrink-0">
                                    ⚠️ Draft edited
                                  </span>
                                )}
                                {issue.traceabilityStatus === 'CONFIRMED_STALE' && (
                                  <span className="rounded bg-rose-200/90 px-1.5 py-0.2 text-[9px] font-bold text-rose-950 whitespace-nowrap shrink-0">
                                    🔴 Spec updated
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {/* Row 4: Priority + Points + Comments + Assignee */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                            <div className="flex items-center gap-2">
                              <PriorityIcon priority={issue.priority} />
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
                              title={`Assignee: ${issue.assigneeName} (${issue.assigneeRole})`}
                            >
                              {issue.assigneeAvatar || 'SL'}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {colIssues.length === 0 && (
                      <div className="flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300/80 text-xs text-slate-400">
                        Drop issues here
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VIEW MODE 2: LIST VIEW NAVIGATOR */}
        {viewMode === 'list' && (
          <div className="h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Type</th>
                    <th className="py-3 px-3 w-28">Key</th>
                    <th className="py-3 px-4">Summary</th>
                    <th className="py-3 px-3">Component</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Security</th>
                    <th className="py-3 px-3">Phase</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 w-24">Priority</th>
                    <th className="py-3 px-4">Linked REQ</th>
                    <th className="py-3 px-3">Assignee</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-2 text-center">Points</th>
                    <th className="py-3 px-3 text-right">Updated</th>
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
                        {issue.type === 'TASK' ? <TaskIcon /> : <BugIcon />}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-600 hover:underline">
                        {issue.key}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-sm">{issue.summary}</span>
                          {issue.severity && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-800 shrink-0">
                              {issue.severity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium">
                          {issue.component || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <DepartmentBadge label={issue.departmentLabel} />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <DataClassificationBadge classification={issue.dataClassification} />
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
                          <PriorityIcon priority={issue.priority} />
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
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {issue.dueDate ? `📅 ${issue.dueDate}` : '—'}
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

        {/* VIEW MODE 3: SPLIT-VIEW SPECIFICATION */}
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
      {/* 4. FULL-SCREEN DEDICATED ISSUE VIEW                      */}
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
      {/* CREATE ISSUE MODAL                                */}
      {/* ======================================================== */}
      {showCreateModal && (
        <CreateIssueModal
          projectId={project.projectId}
          projectKey={project.key}
          nextIssueKey={nextIssueKey}
          phases={phases}
          members={members}
          documents={documents}
          prefillReq={prefillReq}
          onClose={() => {
            setShowCreateModal(false)
            setPrefillReq(null)
          }}
          onSuccess={(newIssue, keepOpen) => {
            issuesAsync.reload()
            if (!keepOpen) {
              setShowCreateModal(false)
              setPrefillReq(null)
              handleSelectIssue(newIssue.id)
            }
          }}
        />
      )}

      {/* MODAL: RE-ASSIGN ISSUE */}
      {reassignIssueData && (
        <Modal
          title={`⇄ Reassign Issue ${reassignIssueData.key}`}
          open={true}
          onClose={() => setReassignIssueData(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Select a new team member to take ownership. An immutable audit trail entry will be recorded.
            </p>
            <SelectField
              label="New Assignee (@assignee)"
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
              label="Handoff / Reassignment Notes"
              placeholder="e.g., @Minh Luong please take over this Webhook issue..."
              value={reassignNote}
              onChange={(e) => setReassignNote(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" inline onClick={() => setReassignIssueData(null)}>
                Cancel
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
                    user?.fullName || 'User',
                  )
                  setReassignIssueData(null)
                  issuesAsync.reload()
                }}
              >
                Confirm Reassignment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: TRANSITION COMMENT REQUIRED */}
      {transitionPrompt && (
        <Modal
          title={`Transition to "${transitionPrompt.targetStatus.name}"`}
          open={true}
          onClose={() => setTransitionPrompt(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              The phase workflow rules require a comment before executing this transition step.
            </p>
            <TextAreaField
              label="Transition Comment (Required)"
              placeholder="Enter reasons for this transition or verification results..."
              value={transitionComment}
              onChange={(e) => setTransitionComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" inline onClick={() => setTransitionPrompt(null)}>
                Cancel
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
                    user?.fullName || 'User',
                  )
                  setTransitionPrompt(null)
                  setTransitionComment('')
                  issuesAsync.reload()
                }}
              >
                Save & Transition
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: FORCE DELETE RTM WARNING (MSG04 / GB-07) */}
      {deleteWarningIssue && (
        <Modal
          title="⚠️ RTM Traceability Integrity Warning (MSG04)"
          open={true}
          onClose={() => setDeleteWarningIssue(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 leading-relaxed font-medium">
              {deleteWarningIssue.message}
            </div>
            <p className="text-xs text-slate-500">
              This action cannot be undone. All traceability mappings between Requirement Items, Test Cases, and Issue{' '}
              <b>{deleteWarningIssue.issue.key}</b> will be permanently severed.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" inline onClick={() => setDeleteWarningIssue(null)}>
                Cancel (Keep Issue)
              </Button>
              <Button
                variant="primary"
                inline
                className="bg-rose-600 hover:bg-rose-700"
                onClick={handleConfirmForceDelete}
              >
                Confirm Force Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ========================================================
// FULL-SCREEN DEDICATED ISSUE VIEW
// (3-COLUMN DEDICATED LAYOUT)
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

  // Mode: 100% full screen vs 94% modal
  const [isCenteredModal, setIsCenteredModal] = useState(false)

  // Left Issue Navigator toggle
  const [isLeftNavCollapsed, setIsLeftNavCollapsed] = useState(false)

  // Edit summary and description
  const [summary, setSummary] = useState(issue.summary)
  const [description, setDescription] = useState(issue.description)
  const [isEditing, setIsEditing] = useState(false)

  // Bottom Tabs: Comments | Activity Log | REQ Trace History
  const [activeTab, setActiveTab] = useState<'comments' | 'activity' | 'req_history'>('comments')
  const [commentInput, setCommentInput] = useState('')

  // Expand linked REQ specification
  const [isReqExpanded, setIsReqExpanded] = useState(false)

  // Load RequirementItem details and Diff history
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

  // Update on issue change
  useEffect(() => {
    setSummary(issue.summary)
    setDescription(issue.description)
    setIsEditing(false)
    setIsReqExpanded(false)
  }, [issue.id])

  // Esc key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Current user watcher status
  const isUserWatching = useMemo(() => {
    const myName = user?.fullName || 'Sarah Lin'
    return (issue.watchers || []).some((w) => w.name === myName)
  }, [issue.watchers, user])

  const handleToggleWatch = async () => {
    const myName = user?.fullName || 'Sarah Lin'
    const myMember = members.find((m) => m.fullName === myName)
    const myRole = myMember?.role.name || 'Member'
    await issueApi.toggleWatcher(issue.id, { name: myName, role: myRole }, myName)
    onReload()
  }

  const handleAddWatcher = async (memberFullName: string) => {
    if (!memberFullName) return
    const member = members.find((m) => m.fullName === memberFullName)
    await issueApi.toggleWatcher(
      issue.id,
      { name: memberFullName, role: member?.role.name || 'Member' },
      user?.fullName || 'User',
    )
    onReload()
  }

  const handleRemoveWatcher = async (watcherName: string) => {
    const watcher = (issue.watchers || []).find((w) => w.name === watcherName)
    if (watcher) {
      await issueApi.toggleWatcher(issue.id, watcher, user?.fullName || 'User')
      onReload()
    }
  }

  const [newTagInput, setNewTagInput] = useState('')
  const [showAddTag, setShowAddTag] = useState(false)

  const handleAddLabel = async (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    const current = issue.labels || []
    if (current.includes(trimmed)) return
    const updated = [...current, trimmed]
    await issueApi.updateIssue(issue.id, { labels: updated }, user?.fullName || 'User', `Added label "${trimmed}"`)
    setNewTagInput('')
    setShowAddTag(false)
    onReload()
  }

  const handleRemoveLabel = async (tag: string) => {
    const current = issue.labels || []
    const updated = current.filter((l) => l !== tag)
    await issueApi.updateIssue(issue.id, { labels: updated }, user?.fullName || 'User', `Removed label "${tag}"`)
    onReload()
  }

  // Quick Prev / Next Issue navigation
  const currentIndex = useMemo(() => {
    return filteredIssues.findIndex((i) => i.id === issue.id)
  }, [filteredIssues, issue.id])

  const prevIssue = currentIndex > 0 ? filteredIssues[currentIndex - 1] : null
  const nextIssue = currentIndex < filteredIssues.length - 1 ? filteredIssues[currentIndex + 1] : null

  const handleSaveText = async () => {
    await issueApi.updateIssue(
      issue.id,
      { summary, description },
      user?.fullName || 'User',
      'Updated summary and description',
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
      authorRole: 'Project Member',
      body: commentInput.trim(),
      mentions,
    })
    setCommentInput('')
    onReload()
  }

  // Guaranteed Requirement Specification & Architecture Diagram
  const linkedItem = useMemo(() => {
    if (reqDetailsAsync.data?.item) return reqDetailsAsync.data.item
    if (!issue.linkedRequirementKeyCode) return null
    return {
      id: issue.linkedRequirementItemId || 'req-default-id',
      documentId: issue.linkedDocumentId || 102,
      keyCode: issue.linkedRequirementKeyCode,
      title: issue.linkedRequirementTitle || 'Core Specification Requirement',
      content: `1. System shall authenticate incoming client requests and enforce RBAC policies.\n2. Verify payload integrity, signature hash, and session timeouts.\n3. Fail closed if verification checks do not pass.`,
      acceptanceCriteria: `- Given valid credentials, the request processes successfully within 200ms.\n- Given duplicate retry attempts, reject with idempotent status 409.\n- Data classification complies with strict ${issue.dataClassification || 'RESTRICTED'} security policies.`,
      diagramSourceCode: `sequenceDiagram\n  autonumber\n  actor User\n  participant Client\n  participant Gateway\n  participant Backend\n  User->>Client: Submit Action\n  Client->>Gateway: POST /api/v1/resource\n  Gateway->>Backend: Authenticate & Authorize\n  Backend-->>Gateway: 200 OK (Success)\n  Gateway-->>Client: Response Data`,
      diagramType: 'MERMAID_PLANTUML' as const,
      diagramTitle: `${issue.linkedRequirementKeyCode} Execution Flow & Sequence`,
      priority: 'HIGH' as const,
      status: 'APPROVED' as const,
      version: 'v1.0',
      createdAt: '2026-10-20',
      updatedAt: '2026-10-28',
    }
  }, [reqDetailsAsync.data?.item, issue.linkedRequirementKeyCode, issue.linkedRequirementItemId, issue.linkedRequirementTitle, issue.linkedDocumentId, issue.dataClassification])
  const linkedHistory = reqDetailsAsync.data?.history ?? []

  // Standardized Workflow Status Mapping so the dropdown is NEVER empty
  const currentPhase = useMemo(() => {
    return (
      phases.find((p) => p.phaseId === issue.phaseId) ||
      phases.find((p) => p.name.toLowerCase() === (issue.phaseName || '').toLowerCase()) ||
      phases[0] ||
      null
    )
  }, [phases, issue.phaseId, issue.phaseName])

  const availableStatuses = useMemo(() => {
    if (currentPhase && currentPhase.statuses && currentPhase.statuses.length > 0) {
      return currentPhase.statuses.map((s) => ({
        statusId: s.statusId,
        name: s.name,
        category: s.category,
      }))
    }
    return [
      { statusId: 101, name: 'To Do', category: 'TODO' as StatusCategory },
      { statusId: 201, name: 'In Progress', category: 'IN_PROGRESS' as StatusCategory },
      { statusId: 301, name: 'In Review / QA', category: 'IN_PROGRESS' as StatusCategory },
      { statusId: 401, name: 'Done', category: 'DONE' as StatusCategory },
    ]
  }, [currentPhase])

  const resolvedStatus = useMemo(() => {
    const byId = availableStatuses.find((s) => s.statusId === issue.statusId)
    if (byId) return byId
    const byName = availableStatuses.find((s) => s.name.toLowerCase() === (issue.statusName || '').toLowerCase())
    if (byName) return byName
    const byCat = availableStatuses.find((s) => s.category === issue.statusCategory)
    if (byCat) return byCat
    return null
  }, [availableStatuses, issue.statusId, issue.statusName, issue.statusCategory])

  const statusDropdownOptions = useMemo(() => {
    const list = [...availableStatuses]
    const hasCurrent = list.some(
      (s) => s.statusId === issue.statusId || s.name.toLowerCase() === (issue.statusName || '').toLowerCase(),
    )
    if (!hasCurrent) {
      list.unshift({
        statusId: issue.statusId,
        name: issue.statusName || 'Current Status',
        category: issue.statusCategory || 'TODO',
      })
    }
    return list
  }, [availableStatuses, issue.statusId, issue.statusName, issue.statusCategory])

  const currentStatusValue = resolvedStatus ? resolvedStatus.statusId : issue.statusId

  // Outer container (100vw x 100vh or 94vw x 92vh)
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
        {/* TOP HEADER: FULL-SCREEN ISSUE DETAIL VIEW               */}
        {/* ======================================================== */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs z-10">
          {/* BACK BUTTON + BREADCRUMBS + BADGES */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors shrink-0"
              title="Back to Kanban Board (Esc)"
            >
              <span>← Back to Board</span>
            </button>

            <span className="h-4 w-px bg-slate-200 shrink-0" />

            <div className="flex items-center gap-1.5 text-xs truncate">
              <span className="text-slate-500">{issue.phaseName}</span>
              <span className="text-slate-300">/</span>
              <span className="font-mono font-extrabold text-blue-600 text-sm">{issue.key}</span>
            </div>

            {/* Type Badge */}
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold shadow-2xs shrink-0',
                issue.type === 'TASK' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800',
              )}
            >
              {issue.type === 'TASK' ? <TaskIcon className="h-3 w-3" /> : <BugIcon className="h-3 w-3" />}
              <span>{issue.type === 'TASK' ? 'Task' : 'Bug'}</span>
            </span>

            {/* Component & Department Badges */}
            {issue.component && (
              <span className="hidden sm:inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 shrink-0">
                {issue.component}
              </span>
            )}
            <DepartmentBadge label={issue.departmentLabel} className="hidden md:inline-flex shrink-0" />
            <DataClassificationBadge classification={issue.dataClassification} className="shrink-0" />

            {/* Watchers Pill Button */}
            <button
              type="button"
              onClick={handleToggleWatch}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 transition-colors border',
                isUserWatching
                  ? 'border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
              )}
              title={isUserWatching ? 'You are watching this issue (click to stop watching)' : 'Click to watch this issue'}
            >
              <span>👁️</span>
              <span>Watchers ({issue.watchers?.length || 0})</span>
            </button>

            {/* Traceability Badge */}
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
                  ? '✓ Fresh (In Sync)'
                  : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                    ? '⚠️ Unconfirmed Stale'
                    : '🔴 Confirmed Stale'}
              </span>
            )}

            <QuickModuleSwitcher projectId={issue.projectId} active="issues" className="hidden xl:inline-flex" />
          </div>

          {/* PREV / NEXT NAVIGATION + SIZE TOGGLE + CLOSE */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Prev / Next buttons */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                disabled={!prevIssue}
                onClick={() => prevIssue && onSelectIssue(prevIssue.id)}
                className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-medium"
                title={prevIssue ? `Switch to ${prevIssue.key}` : 'First issue in list'}
              >
                ↑ Prev
              </button>
              <span className="px-2 font-mono text-[11px] text-slate-500 font-bold border-x border-slate-200">
                {currentIndex >= 0 ? `${currentIndex + 1} / ${filteredIssues.length}` : '—'}
              </span>
              <button
                type="button"
                disabled={!nextIssue}
                onClick={() => nextIssue && onSelectIssue(nextIssue.id)}
                className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-medium"
                title={nextIssue ? `Switch to ${nextIssue.key}` : 'Last issue in list'}
              >
                ↓ Next
              </button>
            </div>

            {/* Size toggle: 100% full-screen vs 94% modal */}
            <button
              type="button"
              onClick={() => setIsCenteredModal(!isCenteredModal)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
              title="Toggle view dimensions"
            >
              <span>{isCenteredModal ? '⤢ 100%' : '⤡ 94%'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* 3-COLUMN FULL-HEIGHT LAYOUT                              */}
        {/* ======================================================== */}
        <div className="flex-1 flex overflow-hidden">
          {/* ------------------------------------------------------ */}
          {/* COLUMN 1 (LEFT): FAST ISSUE NAVIGATOR (260PX)          */}
          {/* ------------------------------------------------------ */}
          <div
            className={clsx(
              'border-r border-slate-200 bg-slate-50/70 flex flex-col transition-all duration-200 shrink-0',
              isLeftNavCollapsed ? 'w-10' : 'w-64',
            )}
          >
            {/* Header column 1 */}
            <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-100/60">
              {!isLeftNavCollapsed && (
                <span className="truncate">Issues ({filteredIssues.length})</span>
              )}
              <button
                type="button"
                onClick={() => setIsLeftNavCollapsed(!isLeftNavCollapsed)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 text-xs"
                title={isLeftNavCollapsed ? 'Expand list' : 'Collapse'}
              >
                {isLeftNavCollapsed ? '▶' : '◀'}
              </button>
            </div>

            {/* Issue items */}
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
                        {iss.type === 'TASK' ? <TaskIcon className="h-3.5 w-3.5" /> : <BugIcon className="h-3.5 w-3.5" />}
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
          {/* COLUMN 2 (CENTER): MAIN ISSUE CONTENT & DETAILS        */}
          {/* ------------------------------------------------------ */}
          <div className="flex-1 overflow-y-auto px-8 lg:px-12 py-8 bg-white space-y-6">
            {/* TYPE SWITCH & HEADER */}
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
                      user?.fullName || 'User',
                      `Switched issue type to ${newType}`,
                    )
                    onReload()
                  }}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition-all shadow-2xs',
                    issue.type === 'TASK'
                      ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                      : 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
                  )}
                  title="Click to switch between Task and Bug"
                >
                  {issue.type === 'TASK' ? <TaskIcon /> : <BugIcon />}
                  <span>{issue.type === 'TASK' ? 'Task' : 'Bug'}</span>
                  <span className="text-[10px] text-slate-400">⇄ Switch type</span>
                </button>
              </div>

              {/* Editable Summary Title */}
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
                      Save Changes
                    </Button>
                    <Button variant="secondary" inline onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <h1
                    onClick={() => !isArchived && setIsEditing(true)}
                    className="text-2xl font-extrabold text-slate-900 leading-snug cursor-pointer hover:bg-slate-50 p-2 rounded-xl -m-2 transition-colors border border-transparent hover:border-slate-200"
                    title="Click to edit summary"
                  >
                    {issue.summary}
                  </h1>
                  <div
                    onClick={() => !isArchived && setIsEditing(true)}
                    className="mt-4 text-xs text-slate-700 whitespace-pre-line leading-relaxed cursor-pointer hover:bg-slate-50 p-3 rounded-xl border border-transparent hover:border-slate-200 transition-colors bg-slate-50/50"
                    title="Click to edit description"
                  >
                    {issue.description || 'No description provided. Click here to add a detailed description.'}
                  </div>
                </div>
              )}
            </div>

            {/* BUG DIAGNOSTICS & REPRODUCTION STEPS */}
            {issue.type === 'BUG' && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-rose-200/80 pb-2.5">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-rose-950 flex items-center gap-2">
                    <span>🐞</span>
                    <span>Bug Diagnostics & Reproduction Steps</span>
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
                      Steps to Reproduce & Expected Behavior:
                    </p>
                    <p className="whitespace-pre-line leading-relaxed font-mono text-[11px] bg-rose-50/40 p-2.5 rounded border border-rose-100">
                      {issue.stepsToReproduce}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* REQUIREMENT TRACEABILITY PANEL */}
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
                    Requirement Traceability (RTM)
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
                      ? '✓ Fresh (In Sync)'
                      : issue.traceabilityStatus === 'UNCONFIRMED_STALE'
                        ? '⚠️ Unconfirmed Stale (Draft Edited)'
                        : '🔴 Confirmed Stale (New Spec Approved)'}
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
                      {/* Expand full spec and diagram toggle */}
                      <button
                        type="button"
                        onClick={() => setIsReqExpanded(!isReqExpanded)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <span>{isReqExpanded ? '▲ Collapse Spec' : '📖 Expand Full Spec & Diagrams'}</span>
                      </button>

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={async () => {
                            await issueApi.unlinkRequirement(issue.id, user?.fullName || 'User')
                            onReload()
                          }}
                          className="text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-bold text-slate-900">
                    {issue.linkedRequirementTitle || 'Specification Requirement'}
                  </p>

                  {/* Stale acknowledgement button */}
                  {issue.traceabilityStatus !== 'FRESH' && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                      <span className="text-xs text-amber-950 font-medium">
                        ⚠️ Requirement [<b>{issue.linkedRequirementKeyCode}</b>] was modified in Document. Review the diff and verify code updates.
                      </span>
                      <Button
                        variant="primary"
                        inline
                        className="bg-emerald-600 hover:bg-emerald-700 text-xs py-1"
                        onClick={async () => {
                          await issueApi.resetStaleStatus(issue.id, user?.fullName || 'User')
                          onReload()
                        }}
                      >
                        ✓ Confirm Implementation Up-to-Date
                      </Button>
                    </div>
                  )}

                  {/* EXPANDED FULL SPEC & MERMAID DIAGRAM */}
                  {isReqExpanded && linkedItem && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in duration-200 bg-slate-50/50 p-4 rounded-xl">
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">
                          Technical Specification:
                        </p>
                        <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                          {linkedItem.content}
                        </p>
                      </div>

                      {linkedItem.acceptanceCriteria && (
                        <div>
                          <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">
                            Acceptance Criteria:
                          </p>
                          <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                            {linkedItem.acceptanceCriteria}
                          </p>
                        </div>
                      )}

                      {/* Mermaid diagram if available */}
                      {linkedItem.diagramSourceCode && (
                        <div>
                          <p className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">
                            Business Flow Diagram (Mermaid):
                          </p>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-hidden">
                            <DiagramViewer
                              code={linkedItem.diagramSourceCode}
                              title={linkedItem.diagramTitle || 'Flow diagram'}
                              diagramType={linkedItem.diagramType}
                              readOnly
                            />
                          </div>
                        </div>
                      )}

                      {/* Latest Diff if available */}
                      {linkedHistory.length > 0 && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2">
                          <p className="font-bold text-xs text-blue-900">
                            🔍 Latest Change Diff for [{issue.linkedRequirementKeyCode}]:
                          </p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded bg-rose-50 border border-rose-200 p-2">
                              <span className="font-bold text-rose-800 text-[10px] block mb-1">Before:</span>
                              <p className="line-clamp-4 text-slate-600">{linkedHistory[0].previousContent || '—'}</p>
                            </div>
                            <div className="rounded bg-emerald-50 border border-emerald-200 p-2">
                              <span className="font-bold text-emerald-800 text-[10px] block mb-1">After:</span>
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
                  This issue is not currently linked to any requirement item.
                </div>
              )}
            </div>

            {/* TABS: ACTIVITY, COMMENTS & REQ HISTORY */}
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
                  💬 Comments & Collaboration ({issue.comments.length})
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
                  🕒 Activity Log ({issue.activityLog.length})
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
                  🔍 Requirement Change History ({linkedHistory.length})
                </button>
              </div>

              {/* TAB 1: COMMENTS */}
              {activeTab === 'comments' && (
                <div className="mt-5 space-y-4">
                  {/* Boxed Unified Comment Form */}
                  <form
                    onSubmit={handleAddComment}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all"
                  >
                    <textarea
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Write a comment, use @ to mention teammates..."
                      rows={3}
                      className="w-full p-3.5 text-xs text-slate-800 outline-none resize-none border-none placeholder-slate-400 bg-transparent"
                    />
                    <div className="border-t border-slate-100 bg-slate-50/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto [scrollbar-width:none]">
                        <span className="font-semibold text-[11px] text-slate-400 shrink-0">@mention:</span>
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
                              className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] shrink-0 transition-colors shadow-2xs"
                            >
                              @{name}
                            </button>
                          ))}
                      </div>
                      <Button variant="primary" inline type="submit" disabled={!commentInput.trim()} className="text-xs py-1 px-3">
                        Post Comment
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

              {/* TAB 2: ACTIVITY LOG */}
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

              {/* TAB 3: REQ AUDIT HISTORY */}
              {activeTab === 'req_history' && (
                <div className="mt-5 space-y-3">
                  {linkedHistory.length > 0 ? (
                    linkedHistory.map((h) => (
                      <div key={h.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {h.changedBy} modified [{h.requirementKeyCode}]
                          </span>
                          <span className="text-[11px] text-slate-400">{formatDate(h.changedAt)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                          <div className="bg-rose-50 border border-rose-200 rounded p-2 text-slate-700">
                            <span className="font-bold text-[10px] text-rose-800 block mb-1">Previous Content:</span>
                            <p className="line-clamp-3">{h.previousContent || '—'}</p>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-slate-800">
                            <span className="font-bold text-[10px] text-emerald-800 block mb-1">New Content:</span>
                            <p className="line-clamp-3">{h.newContent || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      No change history recorded for this requirement yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------ */}
          {/* COLUMN 3 (RIGHT): PROPERTIES PANEL (360PX)   */}
          {/* ------------------------------------------------------ */}
          <div className="w-80 lg:w-96 bg-slate-50/80 border-l border-slate-200 p-6 overflow-y-auto space-y-5 shrink-0">
            {/* CARD 1: WORKFLOW STATUS */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Workflow Status
              </label>
              <select
                aria-label="Update issue status"
                value={currentStatusValue}
                disabled={isArchived}
                onChange={async (e) => {
                  const targetId = Number(e.target.value)
                  const target =
                    statusDropdownOptions.find((s) => s.statusId === targetId) ||
                    phases.flatMap((p) => p.statuses).find((s) => s.statusId === targetId)
                  if (target) {
                    await issueApi.transitionIssue(
                      issue.id,
                      target.statusId,
                      target.name,
                      target.category,
                      undefined,
                      user?.fullName || 'User',
                    )
                    onReload()
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900 outline-none ring-1 ring-slate-100"
              >
                {statusDropdownOptions.map((s) => (
                  <option key={s.statusId} value={s.statusId}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            {/* CARD 2: PEOPLE & RESPONSIBILITY (4 ROLES) */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs space-y-3.5 text-xs">
              <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>People & Roles</span>
                <span className="text-[10px] font-semibold text-blue-600">4 Roles</span>
              </h3>

              {/* 1. Assignee */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 font-semibold text-[11px]">Assignee:</span>
                  {!isArchived && (
                    <button
                      type="button"
                      onClick={onReassignClick}
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      ⇄ Reassign
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs shrink-0">
                    {issue.assigneeAvatar || 'SL'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-xs truncate">{issue.assigneeName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{issue.assigneeRole}</p>
                  </div>
                </div>
              </div>

              {/* 2. Feature Owner */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 font-semibold text-[11px]">Feature Owner:</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-indigo-50/50 border border-indigo-100 p-2">
                  <div className="h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs shrink-0">
                    {(issue.ownerName || 'Lead')
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <select
                      aria-label="Update Owner"
                      value={issue.ownerName}
                      disabled={isArchived}
                      onChange={async (e) => {
                        const chosenName = e.target.value
                        const chosen = members.find((m) => m.fullName === chosenName)
                        await issueApi.updateIssue(
                          issue.id,
                          {
                            ownerName: chosenName,
                            ownerRole: chosen?.role.name || 'Feature Owner',
                          },
                          user?.fullName || 'User',
                          `Transferred ownership to ${chosenName}`,
                        )
                        onReload()
                      }}
                      className="w-full bg-transparent font-bold text-slate-900 text-xs outline-none cursor-pointer"
                    >
                      {members.map((m) => (
                        <option key={m.fullName} value={m.fullName}>
                          {m.fullName} ({m.role.name})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-indigo-700 truncate">{issue.ownerRole || 'Feature Owner'}</p>
                  </div>
                </div>
              </div>

              {/* 3. Reporter */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-400 text-[11px]">Reporter:</span>
                <span className="font-semibold text-slate-800 text-[11px]">
                  {issue.reporterName} {issue.reporterRole ? `(${issue.reporterRole})` : ''}
                </span>
              </div>

              {/* 4. Watchers (Watchers) */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1">
                    <span>👁️</span>
                    <span>Watchers ({issue.watchers?.length || 0}):</span>
                  </span>
                  <button
                    type="button"
                    disabled={isArchived}
                    onClick={handleToggleWatch}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {isUserWatching ? '✕ Unwatch' : '+ Watch'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {(issue.watchers || []).map((w) => (
                    <span
                      key={w.name}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                    >
                      <span className="truncate max-w-[120px]">{w.name}</span>
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWatcher(w.name)}
                          className="text-slate-400 hover:text-rose-600 font-bold"
                          title={`Remove ${w.name} from Watchers`}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                {!isArchived && (
                  <select
                    aria-label="Add watcher"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleAddWatcher(e.target.value)
                    }}
                    className="w-full rounded-lg border border-slate-200 p-1 text-[10px] text-slate-600 outline-none bg-white"
                  >
                    <option value="">+ Add watcher...</option>
                    {members
                      .filter((m) => !(issue.watchers || []).some((w) => w.name === m.fullName))
                      .map((m) => (
                        <option key={m.fullName} value={m.fullName}>
                          {m.fullName} ({m.role.name})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            {/* CARD 3: CLASSIFICATION & SECURITY */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs space-y-3.5 text-xs">
              <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                Classification & Security
              </h3>

              {/* Department Label */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Department:</span>
                <select
                  aria-label="Update department"
                  value={issue.departmentLabel}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { departmentLabel: e.target.value as DepartmentLabel },
                      user?.fullName || 'User',
                      `Changed department to ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none bg-white"
                >
                  {DEFAULT_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Component */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Component:</span>
                <select
                  aria-label="Update component"
                  value={issue.component}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { component: e.target.value },
                      user?.fullName || 'User',
                      `Changed component to ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none bg-white"
                >
                  {DEFAULT_COMPONENTS.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Classification */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Data Classification:</span>
                <select
                  aria-label="Update data classification"
                  value={issue.dataClassification}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { dataClassification: e.target.value as DataClassification },
                      user?.fullName || 'User',
                      `Changed data classification to ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none bg-white"
                >
                  <option value="PUBLIC">🌐 PUBLIC - Project Public</option>
                  <option value="INTERNAL">🏢 INTERNAL - Internal Business & Tech</option>
                  <option value="CONFIDENTIAL_PII">🛡️ CONFIDENTIAL / PII - Sensitive / PII</option>
                  <option value="RESTRICTED">🔒 RESTRICTED - High Security / Financial</option>
                </select>
              </div>

              {/* Environment */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Environment:</span>
                <select
                  aria-label="Update environment"
                  value={issue.environment || 'DEV'}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { environment: e.target.value as EnvironmentType },
                      user?.fullName || 'User',
                      `Changed environment to ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none bg-white"
                >
                  <option value="DEV">DEV (Development)</option>
                  <option value="STAGING">STAGING (Pre-production)</option>
                  <option value="UAT">UAT (User Acceptance)</option>
                  <option value="PRODUCTION">PRODUCTION (Live / Production)</option>
                </select>
              </div>

              {/* Labels */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold text-[11px]">Labels:</span>
                  {!isArchived && !showAddTag && (
                    <button
                      type="button"
                      onClick={() => setShowAddTag(true)}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      + Add label
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {(issue.labels || []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                    >
                      <span>{tag}</span>
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLabel(tag)}
                          className="text-slate-400 hover:text-rose-600 font-bold"
                          title={`Remove label ${tag}`}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                  {(issue.labels || []).length === 0 && (
                    <span className="text-[10px] text-slate-400 italic">No labels</span>
                  )}
                </div>

                {showAddTag && !isArchived && (
                  <div className="flex gap-1 pt-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddLabel(newTagInput)
                        }
                      }}
                      placeholder="Enter label..."
                      className="flex-1 rounded border border-slate-200 p-1 text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddLabel(newTagInput)}
                      className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white"
                    >Add</button>
                    <button
                      type="button"
                      onClick={() => setShowAddTag(false)}
                      className="rounded bg-slate-100 px-1.5 py-1 text-[10px] text-slate-600"
                    >Cancel</button>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 4: SCHEDULE & ESTIMATION */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs space-y-3.5 text-xs">
              <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                Schedule & Estimation
              </h3>

              {/* SDLC Phase */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">SDLC Phase:</span>
                <span className="font-bold text-slate-800">{issue.phaseName}</span>
              </div>

              {/* Priority */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Priority:</span>
                <select
                  aria-label="Update priority"
                  value={issue.priority}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { priority: e.target.value as IssuePriority },
                      user?.fullName || 'User',
                      `Changed priority to ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none bg-white"
                >
                  <option value="HIGHEST">🔴 Highest (Blocker)</option>
                  <option value="HIGH">🟠 High (Urgent)</option>
                  <option value="MEDIUM">🟡 Medium (Normal)</option>
                  <option value="LOW">🔵 Low (Minor)</option>
                </select>
              </div>

              {/* Story Points */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Story Points:</span>
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
                      user?.fullName || 'User',
                      `Updated Story Points to ${pts}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              {/* Original Estimate */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Original Estimate:</span>
                <input
                  type="text"
                  placeholder="e.g. 2h, 1d 4h, 3d"
                  value={issue.originalEstimate || ''}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { originalEstimate: e.target.value },
                      user?.fullName || 'User',
                      `Updated original estimate to ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-semibold text-slate-800 outline-none"
                />
              </div>

              {/* Due Date */}
              <div>
                <span className="text-slate-500 font-semibold block mb-1">Due Date:</span>
                <input
                  type="date"
                  value={issue.dueDate || ''}
                  disabled={isArchived}
                  onChange={async (e) => {
                    await issueApi.updateIssue(
                      issue.id,
                      { dueDate: e.target.value },
                      user?.fullName || 'User',
                      `Changed due date to ${e.target.value}`,
                    )
                    onReload()
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-semibold text-slate-800 outline-none"
                />
              </div>

              {/* Bug Severity */}
              {issue.type === 'BUG' && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Bug Severity:</span>
                  <select
                    aria-label="Update severity"
                    value={issue.severity || 'MAJOR'}
                    disabled={isArchived}
                    onChange={async (e) => {
                      await issueApi.updateIssue(
                        issue.id,
                        { severity: e.target.value as BugSeverity },
                        user?.fullName || 'User',
                        `Changed severity to ${e.target.value}`,
                      )
                      onReload()
                    }}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 outline-none bg-white"
                  >
                    <option value="BLOCKER">💥 BLOCKER (Release blocker)</option>
                    <option value="CRITICAL">🔴 CRITICAL (Crash / Data loss)</option>
                    <option value="MAJOR">🟠 MAJOR (Core feature)</option>
                    <option value="MINOR">🟡 MINOR (Minor glitch)</option>
                  </select>
                </div>
              )}

              {/* Linked Test Case */}
              {issue.type === 'BUG' && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Linked Test Case:</span>
                  <input
                    type="text"
                    value={issue.linkedTestCaseCode || ''}
                    placeholder="VD: TC-01-01"
                    disabled={isArchived}
                    onChange={async (e) => {
                      await issueApi.updateIssue(
                        issue.id,
                        { linkedTestCaseCode: e.target.value.trim() },
                        user?.fullName || 'User',
                      )
                      onReload()
                    }}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              )}

              {/* Timestamps */}
              <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-slate-100 pt-2">
                <p>Created: {formatDate(issue.createdAt)}</p>
                <p>Updated: {formatDate(issue.updatedAt)}</p>
              </div>
            </div>

            {/* DANGER ZONE: DELETE ISSUE */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-2xs space-y-2 mt-4">
              <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs uppercase tracking-wider">
                <span>⚠️</span>
                <span>Danger Zone</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-snug">
                Permanently delete this issue, clear linked requirement traceability, and record an audit log.
              </p>
              <button
                type="button"
                disabled={isArchived}
                onClick={onDeleteClick}
                className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-rose-300 bg-white py-2 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white transition-all shadow-2xs cursor-pointer"
              >
                <span>🗑️ Delete this Issue</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========================================================
// SPLIT-VIEW WORKSPACE (ISSUES ↔ DOCUMENTS)
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
      {/* LEFT HALF (50%): ISSUE LIST & DETAILS */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="font-bold text-xs text-slate-800">
            Issues & Tasks ({issues.length})
          </span>
          <span className="text-[11px] font-mono text-slate-400">Split-View Tracking</span>
        </div>

        {selectedIssue ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedIssue.type === 'TASK' ? <TaskIcon /> : <BugIcon />}
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
              <PriorityIcon priority={selectedIssue.priority} />
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
                  <span>Requirement Traceability (RTM)</span>
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
                    ? '✓ Fresh (In Sync)'
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
                          await issueApi.unlinkRequirement(selectedIssue.id, user?.fullName || 'User')
                          onReloadIssues()
                        }}
                        className="text-[10px] text-rose-600 hover:underline"
                      >Unlink</button>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-900">
                    {selectedIssue.linkedRequirementTitle || 'Requirement title'}
                  </p>

                  {selectedIssue.traceabilityStatus !== 'FRESH' && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-800 font-medium">
                        Requirement [<b>{selectedIssue.linkedRequirementKeyCode}</b>] has changed.
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await issueApi.resetStaleStatus(selectedIssue.id, user?.fullName || 'User')
                          onReloadIssues()
                        }}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        ✓ Code updated → Clear Stale
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-slate-500">
                  No linked requirement. Select an item on the right to link.
                </div>
              )}
            </div>

            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-slate-400 mb-2">
                Select another issue to compare:
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
                      {iss.type === 'TASK' ? <TaskIcon /> : <BugIcon />}
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
            No issue selected.
          </div>
        )}
      </div>

      {/* RIGHT HALF (50%): SPEC VIEWER */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">📄 Specification Document:</span>
            <select
              aria-label="Select specification document"
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
            Open full-screen ↗
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
                                    reqTitle: block.text || 'Requirement',
                                  },
                                  user?.fullName || 'User',
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
                              {isLinkedToCurrent ? '✓ Currently Linked' : '+ Link to this Issue'}
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
                        <p className="font-bold text-[11px] mb-0.5">{block.calloutTitle || 'Note'}</p>
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
              Loading document contents...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ========================================================
// CREATE ISSUE MODAL (ENTERPRISE STYLE)
// 2-COLUMN BALANCED LAYOUT: 60% CONTENT / 40% METADATA
// ========================================================

function CreateIssueModal({
  projectId,
  projectKey = 'CORE',
  nextIssueKey,
  phases,
  members,
  documents,
  prefillReq,
  onClose,
  onSuccess,
}: {
  projectId: number
  projectKey?: string
  nextIssueKey: string
  phases: PhaseDto[]
  members: { userId?: number; fullName: string; role: { name: string; code?: string | null } }[]
  documents: SpecificationDocument[]
  prefillReq: { docId?: number; reqId?: string; reqKey?: string; reqTitle?: string } | null
  onClose: () => void
  onSuccess: (issue: ProjectIssue, keepOpen: boolean) => void
}) {
  const { user } = useAuth()
  const [type, setType] = useState<IssueType>('TASK')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [phaseId, setPhaseId] = useState<number>(phases[0]?.phaseId || 1)

  // Current selected Phase
  const currentPhase = useMemo(() => {
    return phases.find((p) => p.phaseId === phaseId) || phases[0] || { phaseId: 1, name: 'Phase 1', statuses: [] }
  }, [phases, phaseId])

  const [statusId, setStatusId] = useState<number>(currentPhase.statuses[0]?.statusId || 101)

  useEffect(() => {
    if (currentPhase.statuses.length > 0) {
      setStatusId(currentPhase.statuses[0].statusId)
    }
  }, [currentPhase])

  // Bug details
  const [severity, setSeverity] = useState<BugSeverity>('MAJOR')
  const [stepsToReproduce, setStepsToReproduce] = useState('')
  const [environment, setEnvironment] = useState<EnvironmentType>('DEV')
  const [linkedTestCaseCode, setLinkedTestCaseCode] = useState('')

  // Classification & Security
  const [departmentLabel, setDepartmentLabel] = useState<DepartmentLabel>('Backend Team')
  const [component, setComponent] = useState(DEFAULT_COMPONENTS[0])
  const [customComponent, setCustomComponent] = useState('')
  const [dataClassification, setDataClassification] = useState<DataClassification>('INTERNAL')
  const [labels, setLabels] = useState<string[]>(['Sprint-3'])
  const [tagInput, setTagInput] = useState('')

  // Traceability Requirement Mapping
  const [linkedDocId, setLinkedDocId] = useState<number | undefined>(prefillReq?.docId)
  const [linkedReqKey, setLinkedReqKey] = useState(prefillReq?.reqKey || '')

  // People & Roles (4 roles)
  const [assigneeName, setAssigneeName] = useState(members[0]?.fullName || 'Sarah Lin')
  const defaultOwner = useMemo(() => {
    const lead = members.find(
      (m) =>
        m.role.name.toLowerCase().includes('manager') ||
        m.role.name.toLowerCase().includes('lead') ||
        m.role.name.toLowerCase().includes('owner'),
    )
    return lead?.fullName || members[0]?.fullName || 'Sarah Lin'
  }, [members])
  const [ownerName, setOwnerName] = useState(defaultOwner)
  const [reporterName, setReporterName] = useState(user?.fullName || 'Sarah Lin')
  const [selectedWatcherNames, setSelectedWatcherNames] = useState<string[]>([
    reporterName,
    assigneeName,
  ])

  // Schedule & Estimation
  const [priority, setPriority] = useState<IssuePriority>('HIGH')
  const [storyPoints, setStoryPoints] = useState<number>(5)
  const [originalEstimate, setOriginalEstimate] = useState('1d 4h')
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  )

  // Footer & Feedback
  const [createAnother, setCreateAnother] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Switch Task <-> Bug adjusts default points
  const handleTypeSwitch = (newType: IssueType) => {
    setType(newType)
    if (newType === 'BUG') {
      setStoryPoints(3)
      if (!labels.includes('Bug')) setLabels((prev) => [...prev.filter((l) => l !== 'Task'), 'Bug'])
    } else {
      setStoryPoints(5)
      if (!labels.includes('Task')) setLabels((prev) => [...prev.filter((l) => l !== 'Bug'), 'Task'])
    }
  }

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || labels.includes(trimmed)) return
    setLabels([...labels, trimmed])
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setLabels(labels.filter((l) => l !== tag))
  }

  const toggleWatcherName = (name: string) => {
    if (selectedWatcherNames.includes(name)) {
      setSelectedWatcherNames(selectedWatcherNames.filter((n) => n !== name))
    } else {
      setSelectedWatcherNames([...selectedWatcherNames, name])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!summary.trim()) return

    setIsSubmitting(true)
    try {
      const activeStatusObj =
        currentPhase.statuses.find((s) => s.statusId === statusId) ||
        currentPhase.statuses[0] || {
          statusId: 101,
          name: 'To Do',
          category: 'TODO' as StatusCategory,
        }

      const assigneeMember = members.find((m) => m.fullName === assigneeName)
      const ownerMember = members.find((m) => m.fullName === ownerName)
      const reporterMember = members.find((m) => m.fullName === reporterName)

      const watchersList: IssueWatcher[] = selectedWatcherNames.map((name) => {
        const found = members.find((m) => m.fullName === name)
        return {
          name,
          role: found?.role.name || 'Team Member',
        }
      })

      const finalComponent = customComponent.trim() || component

      const newIssue = await issueApi.createIssue({
        projectId,
        projectKey,
        type,
        summary: summary.trim(),
        description: description.trim(),
        phaseId: currentPhase.phaseId,
        phaseName: currentPhase.name,
        statusId: activeStatusObj.statusId,
        statusName: activeStatusObj.name,
        statusCategory: activeStatusObj.category as StatusCategory,
        priority,
        storyPoints,
        originalEstimate,
        dueDate,

        assigneeName,
        assigneeRole: assigneeMember?.role.name || 'Team Member',
        ownerName,
        ownerRole: ownerMember?.role.name || 'Feature Owner',
        reporterName,
        reporterRole: reporterMember?.role.name || 'Reporter',
        watchers: watchersList,

        departmentLabel,
        component: finalComponent,
        dataClassification,
        environment: type === 'BUG' ? environment : 'DEV',
        labels,

        severity: type === 'BUG' ? severity : undefined,
        stepsToReproduce: type === 'BUG' ? stepsToReproduce.trim() : undefined,
        linkedTestCaseCode: type === 'BUG' ? linkedTestCaseCode.trim() : undefined,
        linkedDocumentId: linkedDocId,
        linkedRequirementKeyCode: linkedReqKey.trim() || undefined,
        linkedRequirementTitle: prefillReq?.reqTitle,
      })

      if (createAnother) {
        setSuccessToast(`✓ Successfully created ${newIssue.key}! Ready for the next issue.`)
        setSummary('')
        setDescription('')
        setStepsToReproduce('')
        setLinkedTestCaseCode('')
        setTimeout(() => setSuccessToast(null), 3500)
        onSuccess(newIssue, true)
      } else {
        onSuccess(newIssue, false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="max-w-5xl w-[94vw] max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 text-slate-800">
        {/* ======================================================== */}
        {/* A. MODAL HEADER (FIXED TOP)                              */}
        {/* ======================================================== */}
        <header className="h-16 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <IssueTrackerIcon className="h-6 w-6" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Create Issue
                </h2>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-800">
                  [{projectKey}]
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Next issue key: <strong className="text-blue-600">{nextIssueKey}</strong>
              </p>
            </div>
          </div>

          {/* Quick Type Switcher (Task vs Bug) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => handleTypeSwitch('TASK')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                  type === 'TASK'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <TaskIcon className="h-3.5 w-3.5" />
                <span>Task</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('BUG')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                  type === 'BUG'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <BugIcon className="h-3.5 w-3.5" />
                <span>Bug</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors ml-2"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* B. SCROLLABLE FORM BODY: 2 COLUMNS (60% LEFT / 40% RIGHT) */}
        {/* ======================================================== */}
        <form id="create-issue-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {successToast && (
            <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between shadow-inner animate-in fade-in">
              <span>{successToast}</span>
              <button type="button" onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white">
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
            {/* ---------------------------------------------------- */}
            {/* LEFT COLUMN (60%): CONTENT, COMPONENT, SECURITY & REQ */}
            {/* ---------------------------------------------------- */}
            <div className="lg:col-span-7 space-y-4">
              {/* 1. SDLC Phase & Initial Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField
                  label="SDLC Phase *"
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
                  label="Initial Status *"
                  value={statusId}
                  onChange={(e) => setStatusId(Number(e.target.value))}
                >
                  {currentPhase.statuses.map((s) => (
                    <option key={s.statusId} value={s.statusId}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* 2. Summary */}
              <TextField
                label="Summary *"
                required
                placeholder={
                  type === 'TASK'
                    ? 'e.g. Configure Spring Security OAuth2 & JWT Filter...'
                    : 'e.g. Bank Webhook duplicate transaction execution on retry...'
                }
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />

              {/* 3. Description */}
              <TextAreaField
                label="Description"
                placeholder="Describe technical context, acceptance criteria, or implementation notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />

              {/* If Bug: Technical Diagnostics Box */}
              {type === 'BUG' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-rose-900 font-extrabold text-xs">
                    <span>🐞</span>
                    <span>Bug Details & Diagnostics</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SelectField
                      label="Severity *"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                    >
                      <option value="BLOCKER">💥 Blocker - Release blocker</option>
                      <option value="CRITICAL">🔴 Critical - Crash / Data loss</option>
                      <option value="MAJOR">🟠 Major - Core feature broken</option>
                      <option value="MINOR">🟡 Minor - Minor glitch</option>
                    </SelectField>

                    <SelectField
                      label="Environment *"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
                    >
                      <option value="DEV">Development (DEV)</option>
                      <option value="STAGING">Staging (STG)</option>
                      <option value="UAT">User Acceptance (UAT)</option>
                      <option value="PRODUCTION">Production (PROD)</option>
                    </SelectField>
                  </div>

                  <TextAreaField
                    label="Steps to Reproduce & Expected Behavior"
                    placeholder="1. Open login dialog...&#10;2. Submit invalid password 5 times...&#10;3. Actual: Account is not locked...&#10;4. Expected: Account locked for 15 minutes per REQ-01."
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {/* 4. Organization, Component & Security (2x2 Grid) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <span className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5">
                  <span>🏢</span>
                  <span>Organization, Component & Security</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Item 1: Department */}
                  <SelectField
                    label="Department *"
                    value={departmentLabel}
                    onChange={(e) => setDepartmentLabel(e.target.value as DepartmentLabel)}
                  >
                    {DEFAULT_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </SelectField>

                  {/* Item 2: Component */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Component *
                    </label>
                    <select
                      value={component}
                      onChange={(e) => {
                        setComponent(e.target.value)
                        if (e.target.value !== '__custom__') setCustomComponent('')
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    >
                      {DEFAULT_COMPONENTS.map((comp) => (
                        <option key={comp} value={comp}>
                          {comp}
                        </option>
                      ))}
                      <option value="__custom__">+ Custom component...</option>
                    </select>
                    {component === '__custom__' && (
                      <input
                        type="text"
                        placeholder="Enter component name..."
                        value={customComponent}
                        onChange={(e) => setCustomComponent(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-xs outline-none"
                      />
                    )}
                  </div>

                  {/* Item 3: Data Classification */}
                  <SelectField
                    label="Data Classification *"
                    value={dataClassification}
                    onChange={(e) => setDataClassification(e.target.value as DataClassification)}
                  >
                    <option value="PUBLIC">🌐 Public (Internal Project)</option>
                    <option value="INTERNAL">🏢 Internal (Standard)</option>
                    <option value="CONFIDENTIAL_PII">🛡️ Confidential / PII</option>
                    <option value="RESTRICTED">🔒 Restricted (High Security)</option>
                  </SelectField>

                  {/* Item 4: Labels */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Labels
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddTag(tagInput)
                          }
                        }}
                        placeholder="Add label..."
                        className="flex-1 rounded-xl border border-slate-300 bg-white p-2 text-xs outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTag(tagInput)}
                        className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300 transition-colors shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Labels & Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Labels:</span>
                  {labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800"
                    >
                      <span>{lbl}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(lbl)}
                        className="text-blue-500 hover:text-rose-600 font-bold"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1 pl-2">
                    <span className="text-[10px] text-slate-400">Suggestions:</span>
                    {['security', 'api', 'ui-fix', 'performance', 'uat-blocker', 'hotfix'].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddTag(sug)}
                        className="rounded bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600 transition-colors"
                      >
                        +{sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Traceability Mapping (RTM) */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <span className="font-extrabold text-xs text-emerald-900 flex items-center gap-1.5">
                  <span>🔗</span>
                  <span>Traceability Mapping (RTM)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="Specification Document"
                    value={linkedDocId || ''}
                    onChange={(e) => setLinkedDocId(Number(e.target.value) || undefined)}
                  >
                    <option value="">-- None (Unlinked) --</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code}: {d.title}
                      </option>
                    ))}
                  </SelectField>

                  <TextField
                    label="Requirement Key [REQ-xx]"
                    placeholder="e.g. REQ-01"
                    value={linkedReqKey}
                    onChange={(e) => setLinkedReqKey(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextField
                    label="Related Test Case Code"
                    placeholder="e.g. TC-01-01"
                    value={linkedTestCaseCode}
                    onChange={(e) => setLinkedTestCaseCode(e.target.value)}
                  />
                  <div className="flex items-end pb-1 text-[11px] text-slate-500">
                    Enables automated RTM traceability and triggers stale alerts upon specification edits.
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* RIGHT COLUMN (40%): PEOPLE (4 ROLES) & ESTIMATION    */}
            {/* ---------------------------------------------------- */}
            <div className="lg:col-span-5 space-y-4 border-t lg:border-t-0 lg:border-l lg:border-slate-200 lg:pl-6">
              {/* PEOPLE & ROLES */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2 flex items-center justify-between">
                  <span>People & Roles</span>
                  <span className="text-[10px] text-blue-600 font-bold">4 Roles</span>
                </h3>

                {/* 1. Assignee */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Assignee *
                    </label>
                    <button
                      type="button"
                      onClick={() => setAssigneeName(user?.fullName || 'Sarah Lin')}
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      [Assign to me]
                    </button>
                  </div>
                  <select
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  >
                    {members.map((m) => (
                      <option key={m.fullName} value={m.fullName}>
                        {m.fullName} ({m.role.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Feature Owner */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Feature Owner *
                  </label>
                  <select
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  >
                    {members.map((m) => (
                      <option key={m.fullName} value={m.fullName}>
                        {m.fullName} ({m.role.name})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Accountable for technical delivery & acceptance sign-off.
                  </p>
                </div>

                {/* 3. Reporter */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Reporter *
                  </label>
                  <select
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  >
                    {members.map((m) => (
                      <option key={m.fullName} value={m.fullName}>
                        {m.fullName} ({m.role.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Watchers */}
                <div className="border-t border-slate-200 pt-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span>👁️</span>
                      <span>Watchers ({selectedWatcherNames.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Click to toggle</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {members.map((m) => {
                      const isWatching = selectedWatcherNames.includes(m.fullName)
                      return (
                        <button
                          key={m.fullName}
                          type="button"
                          onClick={() => toggleWatcherName(m.fullName)}
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border transition-all',
                            isWatching
                              ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-2xs font-bold'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
                          )}
                        >
                          <span>{isWatching ? '✓' : '+'}</span>
                          <span>{m.fullName}</span>
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-[10px] text-slate-500 leading-tight">
                    * Watchers receive notifications on status transitions, new comments, and stale alerts.
                  </p>
                </div>
              </div>

              {/* SCHEDULE & ESTIMATION */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-2">
                  Schedule & Estimation
                </h3>

                {/* Priority */}
                <SelectField
                  label="Priority *"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as IssuePriority)}
                >
                  <option value="HIGHEST">🔴 Highest (Critical blocker)</option>
                  <option value="HIGH">🟠 High (Urgent)</option>
                  <option value="MEDIUM">🟡 Medium (Normal priority)</option>
                  <option value="LOW">🔵 Low (Minor / Backlog)</option>
                </SelectField>

                {/* Clean Story Points Control */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Story Points *
                    </label>
                    <span className="font-mono text-xs font-bold text-blue-600">
                      {storyPoints} pts
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 5, 8, 13].map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setStoryPoints(pts)}
                        className={clsx(
                          'flex-1 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all',
                          storyPoints === pts
                            ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
                        )}
                      >
                        {pts}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={storyPoints}
                      onChange={(e) => setStoryPoints(Number(e.target.value) || 0)}
                      className="w-14 rounded-lg border border-slate-300 bg-white p-1.5 text-center font-mono text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                      title="Custom points"
                    />
                  </div>
                </div>

                {/* Estimate & Due Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Original Estimate
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2h, 1d 4h, 3d"
                      value={originalEstimate}
                      onChange={(e) => setOriginalEstimate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-mono font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-mono font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* ======================================================== */}
        {/* C. MODAL FOOTER (FIXED BOTTOM)                           */}
        {/* ======================================================== */}
        <footer className="h-16 border-t border-slate-200 px-6 flex items-center justify-between shrink-0 bg-slate-50/70">
          {/* Checkbox: Create another */}
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createAnother}
              onChange={(e) => setCreateAnother(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Create another issue (preserve Phase, Component & Department)</span>
          </label>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button variant="secondary" inline onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              inline
              type="submit"
              form="create-issue-form"
              disabled={isSubmitting || !summary.trim()}
            >
              {isSubmitting ? 'Creating...' : '✓ Create Issue'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
