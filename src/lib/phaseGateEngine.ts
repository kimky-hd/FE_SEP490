import type { ComponentType, SVGProps } from 'react'
import type { PhaseDto, PhaseExitCriterionKey, PhaseLifecycleStatus, StatusCategory } from '@/types/project'
import type { DraftPhase } from '@/lib/workflowDraft'
import { SDLC_TEMPLATES } from '@/mocks/sdlcTemplates'
import { CheckIcon, DocumentIcon, LayersIcon, LinkIcon, BeakerIcon, ShieldIcon } from '@/components/ui/icons'
import { documentMockStore } from '@/api/documentApi'
import { MOCK_STORAGE_KEY as DOC_STORAGE_KEY } from '@/api/mock/documentMockStore'
import { ISSUE_STORAGE_KEY } from '@/api/mock/issueMockStore'
import { TEST_STORAGE_KEY } from '@/api/mock/testMockStore'
import { invalidateData } from '@/lib/dataEvents'
import { tr } from '@/i18n'

export interface CriterionMeta {
  key: PhaseExitCriterionKey
  label: (isVi: boolean) => string
  shortLabel: (isVi: boolean) => string
  description: (isVi: boolean) => string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  targetPath: (projectId: number) => string
}

export const ALL_CRITERIA_KEYS: PhaseExitCriterionKey[] = [
  'ISSUES_DONE',
  'DOC_APPROVED',
  'REQ_SEGMENTED',
  'REQ_LINKED_ISSUES',
  'TESTS_APPROVED',
  'RTM_ZERO_STALE',
]

export const CRITERIA_METADATA: Record<PhaseExitCriterionKey, CriterionMeta> = {
  ISSUES_DONE: {
    key: 'ISSUES_DONE',
    label: (vi) => (vi ? 'Toàn bộ Issue giai đoạn hoàn thành' : 'Phase Issues Completed'),
    shortLabel: (vi) => (vi ? 'Issue hoàn thành' : 'Issues Done'),
    description: (vi) =>
      vi
        ? 'Tất cả các thẻ công việc (Issues) thuộc giai đoạn này đã chuyển sang trạng thái nhóm Hoàn thành (Done).'
        : 'All work cards (Issues) in this phase have reached a Done category status.',
    Icon: CheckIcon,
    targetPath: (id) => `/projects/${id}/kanban`,
  },
  DOC_APPROVED: {
    key: 'DOC_APPROVED',
    label: (vi) => (vi ? 'Tài liệu Đặc tả được phê duyệt (Baseline)' : 'Spec Doc Baseline Approved'),
    shortLabel: (vi) => (vi ? 'Đặc tả Baseline duyệt' : 'Doc Baseline Approved'),
    description: (vi) =>
      vi
        ? 'Dự án có ít nhất 1 Tài liệu Đặc tả (URD/SRS) đã được phê duyệt chính thức (Approved / Baseline).'
        : 'Project has at least 1 specification document (URD/SRS) officially approved and baselined.',
    Icon: DocumentIcon,
    targetPath: (id) => `/projects/${id}/documents`,
  },
  REQ_SEGMENTED: {
    key: 'REQ_SEGMENTED',
    label: (vi) => (vi ? 'Đặc tả đã phân tách mục yêu cầu (REQ-xx)' : 'Requirements Segmented (REQ-xx)'),
    shortLabel: (vi) => (vi ? 'Phân tách REQ-xx' : 'REQ Segmented'),
    description: (vi) =>
      vi
        ? 'Các trang tài liệu đặc tả đã được phân rã thành các mã yêu cầu chi tiết (REQ-01, REQ-02...) để theo dõi.'
        : 'Spec pages have been extracted into granular requirement items (REQ-xx) for tracking.',
    Icon: LayersIcon,
    targetPath: (id) => `/projects/${id}/documents`,
  },
  REQ_LINKED_ISSUES: {
    key: 'REQ_LINKED_ISSUES',
    label: (vi) => (vi ? 'Yêu cầu (REQ) đã liên kết Thẻ thực thi' : 'Requirements Linked to Issues'),
    shortLabel: (vi) => (vi ? 'REQ liên kết Issue' : 'REQ Linked to Issues'),
    description: (vi) =>
      vi
        ? 'Các mục REQ-xx đã được liên kết với ít nhất một Issue trên bảng Kanban để tiến hành lập trình.'
        : 'Requirement items (REQ-xx) are linked to at least one Kanban execution issue.',
    Icon: LinkIcon,
    targetPath: (id) => `/projects/${id}/kanban`,
  },
  TESTS_APPROVED: {
    key: 'TESTS_APPROVED',
    label: (vi) => (vi ? 'Kịch bản kiểm thử (Test Cases) được duyệt' : 'Test Cases Approved / Verified'),
    shortLabel: (vi) => (vi ? 'Test Cases được duyệt' : 'Tests Approved'),
    description: (vi) =>
      vi
        ? 'Các kịch bản kiểm thử liên quan đã được khởi tạo, thẩm định và không còn ở trạng thái cần xem lại.'
        : 'Test cases have been created, reviewed and are not in a Needs Review state.',
    Icon: BeakerIcon,
    targetPath: (id) => `/projects/${id}/tests`,
  },
  RTM_ZERO_STALE: {
    key: 'RTM_ZERO_STALE',
    label: (vi) => (vi ? 'Ma trận truy xuất (RTM) không còn mục Stale' : 'Traceability Matrix (RTM) 0 Stale'),
    shortLabel: (vi) => (vi ? 'RTM 0 Stale' : 'RTM Fresh (0 Stale)'),
    description: (vi) =>
      vi
        ? 'Ma trận truy xuất RTM đồng bộ Fresh, không còn yêu cầu nào bị cảnh báo lệch phiên bản (Confirmed Stale).'
        : 'Traceability matrix is fresh with zero requirement items flagged as Confirmed Stale.',
    Icon: ShieldIcon,
    targetPath: (id) => `/projects/${id}/documents`,
  },
}

export interface CriterionEvaluation {
  key: PhaseExitCriterionKey
  label: string
  shortLabel: string
  description: string
  passed: boolean
  currentText: string
  actionUrl: string
}

export interface PhaseEvaluationResult {
  phaseKey: string
  phaseName: string
  position: number
  lifecycleStatus: PhaseLifecycleStatus
  completedAt?: string | null
  completionNote?: string | null
  exitCriteria: PhaseExitCriterionKey[]
  criteriaResults: CriterionEvaluation[]
  passedCount: number
  totalCount: number
  readinessPercent: number
  isReadyToComplete: boolean
}

interface StoredLifecycleRec {
  lifecycleStatus: PhaseLifecycleStatus
  completedAt?: string | null
  completionNote?: string | null
}

const lifecycleStorageKey = (projectId: number) => `ssam.project.${projectId}.phaseLifecycle`

export function getStoredPhaseLifecycleMap(projectId: number): Record<string, StoredLifecycleRec> {
  try {
    const raw = localStorage.getItem(lifecycleStorageKey(projectId))
    return raw ? (JSON.parse(raw) as Record<string, StoredLifecycleRec>) : {}
  } catch {
    return {}
  }
}

export function saveStoredPhaseLifecycleMap(projectId: number, map: Record<string, StoredLifecycleRec>) {
  try {
    localStorage.setItem(lifecycleStorageKey(projectId), JSON.stringify(map))
  } catch {
    // ignore
  }
}

export interface ProjectPhaseInfo {
  id: string | number
  phaseId: number
  order: number
  name: string
  description: string | null
  statuses: {
    id: number
    statusId: number
    name: string
    category: StatusCategory
    color: string
    isInitial: boolean
  }[]
  exitCriteria: PhaseExitCriterionKey[]
  lifecycleStatus: PhaseLifecycleStatus
  completedAt?: string | null
  completionNote?: string | null
}

/**
 * Đọc danh sách Phase của dự án từ mockdb hoặc fallback về mẫu SDLC Scrum mặc định.
 */
export function getProjectPhases(projectId: string | number): ProjectPhaseInfo[] {
  const pId = Number(projectId)
  const storedLifecycle = getStoredPhaseLifecycleMap(pId)

  // 1. Thử đọc từ ssam.mockdb.v4 hoặc ssam.mockdb.v3
  try {
    const rawDb = localStorage.getItem('ssam.mockdb.v4') ?? localStorage.getItem('ssam.mockdb.v3')
    if (rawDb) {
      const db = JSON.parse(rawDb)
      const phases = (db.phases || []).filter((p: any) => p.projectId === pId)
      if (phases.length > 0) {
        return phases
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((p: any, idx: number) => {
            const phaseStatuses = (db.statuses || [])
              .filter((s: any) => s.phaseId === p.id)
              .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
              .map((s: any) => ({
                id: s.id,
                statusId: s.id,
                name: s.name,
                category: s.category as StatusCategory,
                color: s.color || '#64748b',
                isInitial: Boolean(s.isInitial),
              }))
            const stored = storedLifecycle[String(p.id)] ?? storedLifecycle[String(p.position ?? idx + 1)]
            return {
              id: p.id,
              phaseId: p.id,
              order: p.position ?? idx + 1,
              name: p.name,
              description: p.description ?? null,
              statuses: phaseStatuses,
              exitCriteria: p.exitCriteria && p.exitCriteria.length ? p.exitCriteria : ['ISSUES_DONE'],
              lifecycleStatus: stored?.lifecycleStatus ?? (idx === 0 ? 'active' : 'upcoming'),
              completedAt: stored?.completedAt ?? p.completedAt ?? null,
              completionNote: stored?.completionNote ?? p.completionNote ?? null,
            }
          })
      }
    }
  } catch {
    // fallback
  }

  // 2. Fallback về mẫu SDLC Scrum mặc định
  const scrumTemplate = SDLC_TEMPLATES.find((t) => t.method === 'SCRUM') || SDLC_TEMPLATES[0]
  return (scrumTemplate?.phases || []).map((tp, idx) => {
    const phaseId = (idx + 1) * 10
    const stored = storedLifecycle[String(phaseId)] ?? storedLifecycle[String(idx + 1)]
    return {
      id: phaseId,
      phaseId,
      order: idx + 1,
      name: tp.name,
      description: tp.description ?? null,
      statuses: tp.statuses.map((s, sIdx) => ({
        id: phaseId + sIdx + 1,
        statusId: phaseId + sIdx + 1,
        name: s.name,
        category: s.category,
        color: s.color,
        isInitial: s.isInitial,
      })),
      exitCriteria: tp.exitCriteria && tp.exitCriteria.length ? tp.exitCriteria : ['ISSUES_DONE'],
      lifecycleStatus: stored?.lifecycleStatus ?? (idx === 0 ? 'active' : 'upcoming'),
      completedAt: stored?.completedAt ?? null,
      completionNote: stored?.completionNote ?? null,
    }
  })
}

/** Đọc trạng thái dữ liệu thời gian thực của dự án từ các mock store / localStorage */
function readProjectRealStats(projectId: number) {
  // 1. Documents stats
  let approvedDocCount = 0
  let totalDocCount = 0
  let totalReqCount = 0
  let staleReqCount = 0

  try {
    if (documentMockStore) {
      const idx = documentMockStore.reqIndex(projectId)
      totalDocCount = idx.length
      approvedDocCount = idx.filter((d: any) => d.baselineVersionId !== null).length
      for (const d of idx) {
        const reqs = d.baseline.length > 0 ? d.baseline : d.current
        totalReqCount += reqs.length
        staleReqCount += reqs.filter((r: any) => r.freshness === 'CONFIRMED_STALE').length
      }
    } else {
      const rawDoc = localStorage.getItem(DOC_STORAGE_KEY)
      if (rawDoc) {
        const db = JSON.parse(rawDoc)
        const nodes = (db.nodes || []).filter((n: any) => n.projectId === projectId && n.kind === 'PAGE' && !n.isDeleted)
        totalDocCount = nodes.length
        approvedDocCount = nodes.filter((n: any) => n.baselineVersionId !== null).length
        const reqs = (db.reqs || []).filter((r: any) => nodes.some((n: any) => n.documentId === r.documentId))
        totalReqCount = reqs.length
        staleReqCount = reqs.filter((r: any) => r.freshness === 'CONFIRMED_STALE').length
      }
    }
  } catch {
    // fallback default values
  }

  // 2. Issue stats
  let totalIssuesCount = 0
  let issuesByStatusId = new Map<number, { total: number; isDone: boolean }>()
  let linkedReqKeys = new Set<string>()
  let projectIssues: any[] = []

  try {
    const rawIssue = localStorage.getItem(ISSUE_STORAGE_KEY)
    if (rawIssue) {
      const db = JSON.parse(rawIssue)
      const issues = (db.issues || []).filter((i: any) => i.projectId === projectId && !i.isDeleted)
      totalIssuesCount = issues.length
      projectIssues = issues
      for (const i of issues) {
        const sid = i.statusId
        const existing = issuesByStatusId.get(sid) ?? { total: 0, isDone: false }
        existing.total += 1
        issuesByStatusId.set(sid, existing)

        for (const l of i.links || []) {
          if (l.reqKey) linkedReqKeys.add(l.reqKey)
        }
      }
    }
  } catch {
    // fallback
  }

  // 3. Test stats
  let totalTestsCount = 0
  let approvedTestsCount = 0

  try {
    const rawTest = localStorage.getItem(TEST_STORAGE_KEY)
    if (rawTest) {
      const db = JSON.parse(rawTest)
      const testCases = (db.testcases || db.testCases || []).filter((t: any) => t.projectId === projectId && !t.isDeleted)
      totalTestsCount = testCases.length
      approvedTestsCount = testCases.filter(
        (t: any) =>
          !t.needsReview &&
          (t.approvalStatus === 'APPROVED' || t.lastResult === 'PASS' || (!t.approvalStatus && t.lastResult === 'FAIL')),
      ).length
    }
  } catch {
    // fallback
  }

  return {
    approvedDocCount,
    totalDocCount,
    totalReqCount,
    staleReqCount,
    totalIssuesCount,
    issuesByStatusId,
    projectIssues,
    linkedReqKeysCount: linkedReqKeys.size,
    totalTestsCount,
    approvedTestsCount,
  }
}

/** Đánh giá toàn bộ các Phase trong một dự án dựa trên dữ liệu thật */
export function evaluateProjectPhases(
  projectId: number,
  phases: (PhaseDto | DraftPhase)[],
  isVi = true,
): PhaseEvaluationResult[] {
  const stats = readProjectRealStats(projectId)
  const storedLifecycle = getStoredPhaseLifecycleMap(projectId)

  return phases.map((phase, index) => {
    const phaseKey = 'phaseId' in phase ? String(phase.phaseId) : phase.key
    const position = 'position' in phase ? phase.position : index + 1
    const stored = storedLifecycle[phaseKey] ?? storedLifecycle[String(position)]

    let lifecycleStatus: PhaseLifecycleStatus =
      stored?.lifecycleStatus ??
      phase.lifecycleStatus ??
      (index === 0 ? 'active' : 'upcoming')
    const completedAt = stored?.completedAt ?? phase.completedAt ?? null
    const completionNote = stored?.completionNote ?? phase.completionNote ?? null

    const exitCriteria: PhaseExitCriterionKey[] =
      phase.exitCriteria && phase.exitCriteria.length > 0 ? phase.exitCriteria : ['ISSUES_DONE']

    // Lấy tập hợp status ID của Phase này
    const doneStatusIds = new Set<number>()
    const phaseStatusIds = new Set<number>()
    for (const st of phase.statuses || []) {
      const sid = 'statusId' in st && st.statusId !== undefined ? st.statusId : undefined
      if (sid !== undefined) {
        phaseStatusIds.add(sid)
        if (st.category === 'DONE') doneStatusIds.add(sid)
      }
    }

    const phaseIdNum = 'phaseId' in phase ? Number(phase.phaseId) : ('id' in phase ? Number((phase as any).id) : undefined)
    const phaseOrder = 'position' in phase ? phase.position : ('order' in phase ? (phase as any).order : index + 1)

    // Lọc các issue thuộc đúng Phase này (qua phaseId, phaseOrder, hoặc statusId thuộc phase)
    const issuesInPhase = stats.projectIssues.filter((i: any) => {
      if (phaseIdNum !== undefined && i.phaseId !== undefined && (Number(i.phaseId) === phaseIdNum || String(i.phaseId) === String(phaseIdNum))) return true
      if (i.phaseOrder !== undefined && Number(i.phaseOrder) === Number(phaseOrder)) return true
      if (i.statusId !== undefined && phaseStatusIds.has(i.statusId)) return true
      return false
    })

    const phaseIssuesTotal = issuesInPhase.length
    const phaseIssuesDone = issuesInPhase.filter((i: any) => {
      if (i.status === 'DONE') return true
      if (doneStatusIds.has(i.statusId)) return true
      return false
    }).length

    const criteriaResults: CriterionEvaluation[] = exitCriteria.map((critKey) => {
      const meta = CRITERIA_METADATA[critKey] ?? CRITERIA_METADATA.ISSUES_DONE
      let passed = false
      let currentText = ''

      switch (critKey) {
        case 'ISSUES_DONE': {
          if (phaseIssuesTotal === 0) {
            passed = true
            currentText = isVi ? `0 issue trong giai đoạn ${phaseOrder}` : `0 issues in phase ${phaseOrder}`
          } else {
            passed = phaseIssuesDone >= phaseIssuesTotal
            currentText = `${phaseIssuesDone}/${phaseIssuesTotal} Issues Done (Phase ${phaseOrder})`
          }
          break
        }
        case 'DOC_APPROVED': {
          passed = stats.approvedDocCount >= 1
          currentText = isVi
            ? `${stats.approvedDocCount} tài liệu Approved`
            : `${stats.approvedDocCount} Approved Baseline`
          break
        }
        case 'REQ_SEGMENTED': {
          passed = stats.totalReqCount >= 1
          currentText = isVi
            ? `${stats.totalReqCount} mục REQ-xx`
            : `${stats.totalReqCount} REQ items`
          break
        }
        case 'REQ_LINKED_ISSUES': {
          if (stats.totalReqCount === 0) {
            passed = false
            currentText = isVi ? '0/0 REQ đã liên kết' : '0/0 REQ linked'
          } else {
            passed = stats.linkedReqKeysCount >= Math.min(stats.totalReqCount, 1)
            currentText = `${stats.linkedReqKeysCount}/${stats.totalReqCount} ${isVi ? 'REQ liên kết thẻ' : 'REQ linked'}`
          }
          break
        }
        case 'TESTS_APPROVED': {
          if (stats.totalTestsCount === 0) {
            passed = false
            currentText = isVi ? 'Chưa tạo Test Case' : 'No test cases yet'
          } else {
            passed = stats.approvedTestsCount >= stats.totalTestsCount
            currentText = `${stats.approvedTestsCount}/${stats.totalTestsCount} ${isVi ? 'Tests đã duyệt' : 'Tests approved'}`
          }
          break
        }
        case 'RTM_ZERO_STALE': {
          passed = stats.staleReqCount === 0
          currentText = isVi
            ? `${stats.staleReqCount} mục Confirmed Stale`
            : `${stats.staleReqCount} Confirmed Stale`
          break
        }
      }

      return {
        key: critKey,
        label: meta.label(isVi),
        shortLabel: meta.shortLabel(isVi),
        description: meta.description(isVi),
        passed,
        currentText,
        actionUrl: meta.targetPath(projectId),
      }
    })

    const totalCount = criteriaResults.length
    const passedCount = criteriaResults.filter((c) => c.passed).length
    const readinessPercent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 100
    const isReadyToComplete = passedCount === totalCount

    return {
      phaseKey,
      phaseName: phase.name,
      position,
      lifecycleStatus,
      completedAt,
      completionNote,
      exitCriteria,
      criteriaResults,
      passedCount,
      totalCount,
      readinessPercent,
      isReadyToComplete,
    }
  })
}

/** Chuyển giao Phase hiện tại sang Completed và tự động kích hoạt Phase kế tiếp sang Active */
export function completeAndAdvancePhase(
  projectId: number,
  phaseKeyToComplete: string,
  allPhases: (PhaseDto | DraftPhase)[],
  note?: string,
) {
  const map = getStoredPhaseLifecycleMap(projectId)
  const currentIndex = allPhases.findIndex(
    (p, i) => ('phaseId' in p ? String(p.phaseId) === phaseKeyToComplete : p.key === phaseKeyToComplete) || String(i + 1) === phaseKeyToComplete,
  )

  const nowIso = new Date().toISOString()

  // Set current phase to completed
  map[phaseKeyToComplete] = {
    lifecycleStatus: 'completed',
    completedAt: nowIso,
    completionNote: note?.trim() || null,
  }

  // Set next phase to active if exists
  if (currentIndex >= 0 && currentIndex + 1 < allPhases.length) {
    const nextPhase = allPhases[currentIndex + 1]
    const nextKey = 'phaseId' in nextPhase ? String(nextPhase.phaseId) : nextPhase.key
    map[nextKey] = {
      lifecycleStatus: 'active',
      completedAt: null,
      completionNote: null,
    }
  }

  saveStoredPhaseLifecycleMap(projectId, map)
  invalidateData()
}

/** Override Cổng nghiệm thu (có ghi chú bắt buộc) và chuyển tiếp Phase */
export function overrideGateAndAdvancePhase(
  projectId: number,
  phaseKeyToComplete: string,
  allPhases: (PhaseDto | DraftPhase)[],
  reason: string,
) {
  const formattedNote = tr(`[Ghi đè cổng] ${reason.trim()}`, `[Gate Override] ${reason.trim()}`)
  completeAndAdvancePhase(projectId, phaseKeyToComplete, allPhases, formattedNote)
}

/** Mở lại (Reopen) một Phase đã đóng về trạng thái Active */
export function reopenPhase(
  projectId: number,
  phaseKeyToReopen: string,
  allPhases: (PhaseDto | DraftPhase)[],
) {
  const map = getStoredPhaseLifecycleMap(projectId)
  const reopenIndex = allPhases.findIndex(
    (p, i) => ('phaseId' in p ? String(p.phaseId) === phaseKeyToReopen : p.key === phaseKeyToReopen) || String(i + 1) === phaseKeyToReopen,
  )

  // Đưa phase được chọn về active
  map[phaseKeyToReopen] = {
    lifecycleStatus: 'active',
    completedAt: null,
    completionNote: null,
  }

  // Đưa tất cả các phase sau nó về upcoming
  if (reopenIndex >= 0) {
    for (let i = reopenIndex + 1; i < allPhases.length; i++) {
      const p = allPhases[i]
      const k = 'phaseId' in p ? String(p.phaseId) : p.key
      map[k] = {
        lifecycleStatus: 'upcoming',
        completedAt: null,
        completionNote: null,
      }
    }
  }

  saveStoredPhaseLifecycleMap(projectId, map)
  invalidateData()
}
