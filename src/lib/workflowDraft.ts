// Mô hình "bản nháp" workflow dùng ở wizard tạo dự án (bước 1–2) và màn Cấu hình Workflow, cùng các hàm chuyển
// qua lại giữa mẫu SDLC (§9.1), dữ liệu đã lưu (§12.1) và body gửi BE (§10.4 / §12.4).

import type {
  PhaseDto,
  StatusCategory,
  StatusInput,
  TemplatePhase,
  TransitionInput,
} from '@/types/project'
import type { RoleDto } from '@/types/rbac'
import { DEFAULT_CATEGORY_COLOR, validatePhaseWorkflow } from './workflowValidation'
import type { WorkflowIssue } from '@/types/project'

export interface DraftStatus {
  key: string
  statusId?: number
  name: string
  category: StatusCategory
  color: string
  description: string | null
  isInitial: boolean
  isActive: boolean
  issueCount?: number
}

export interface DraftTransition {
  key: string
  from: string
  to: string
  allowedRoleIds: number[]
  requireComment: boolean
  commentHint: string | null
  condition: string | null
}

export interface DraftPhase {
  key: string
  name: string
  description: string | null
  statuses: DraftStatus[]
  transitions: DraftTransition[]
}

let counter = 0
/** Khoá tạm phía client — duy nhất trong phiên làm việc (kể cả sau khi khôi phục nháp nhờ hậu tố thời gian). */
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`

/** Phase mới ("+ Add Phase" — §12.2): To Do (initial) → In Progress → Done, cho phép mọi role dự án đang bật. */
export function blankPhase(name: string, projectRoles: RoleDto[]): DraftPhase {
  const roleIds = projectRoles.map((r) => r.roleId)
  const todo = newStatus('To Do', 'TODO', true)
  const doing = newStatus('In Progress', 'IN_PROGRESS')
  const done = newStatus('Done', 'DONE')
  return {
    key: uid('ph'),
    name,
    description: null,
    statuses: [todo, doing, done],
    transitions: [newTransition(todo.key, doing.key, roleIds), newTransition(doing.key, done.key, roleIds)],
  }
}

export function newStatus(name: string, category: StatusCategory, isInitial = false): DraftStatus {
  return {
    key: uid('st'),
    name,
    category,
    color: DEFAULT_CATEGORY_COLOR[category],
    description: null,
    isInitial,
    isActive: true,
  }
}

export function newTransition(from: string, to: string, allowedRoleIds: number[] = []): DraftTransition {
  return { key: uid('tr'), from, to, allowedRoleIds, requireComment: false, commentHint: null, condition: null }
}

/** Mẫu SDLC → nháp. Role trong mẫu tham chiếu theo `code` → đổi ra id role dự án của công ty (bỏ role không có). */
export function templateToDraft(phases: TemplatePhase[], projectRoles: RoleDto[]): DraftPhase[] {
  const idOfCode = new Map(projectRoles.filter((r) => r.code).map((r) => [r.code!, r.roleId]))
  return phases.map((phase) => {
    const keyMap = new Map<string, string>()
    const statuses = phase.statuses.map((s) => {
      const key = uid('st')
      keyMap.set(s.key, key)
      return { key, name: s.name, category: s.category, color: s.color, description: s.description, isInitial: s.isInitial, isActive: true }
    })
    const transitions = phase.transitions.map((t) => ({
      key: uid('tr'),
      from: keyMap.get(t.from)!,
      to: keyMap.get(t.to)!,
      allowedRoleIds: t.allowedRoleCodes.map((code) => idOfCode.get(code)).filter((id): id is number => id !== undefined),
      requireComment: t.requireComment,
      commentHint: t.commentHint,
      condition: t.condition,
    }))
    return { key: uid('ph'), name: phase.name, description: phase.description, statuses, transitions }
  })
}

/** Phase đã lưu (§12.1) → nháp để sửa trong editor. Khoá của trạng thái cũ = `statusId` dạng chuỗi. */
export function phaseToDraft(phase: PhaseDto): DraftPhase {
  return {
    key: String(phase.phaseId),
    name: phase.name,
    description: phase.description,
    statuses: phase.statuses.map((s) => ({
      key: String(s.statusId),
      statusId: s.statusId,
      name: s.name,
      category: s.category,
      color: s.color ?? DEFAULT_CATEGORY_COLOR[s.category],
      description: s.description,
      isInitial: s.isInitial,
      isActive: s.isActive,
      issueCount: s.issueCount,
    })),
    transitions: phase.transitions.map((t) => ({
      key: String(t.transitionId),
      from: String(t.fromStatusId),
      to: String(t.toStatusId),
      allowedRoleIds: t.allowedRoles.map((r) => r.roleId),
      requireComment: t.requireComment,
      commentHint: t.commentHint,
      condition: t.condition,
    })),
  }
}

/** Nháp → body phase (§10.4 / §12.4): trạng thái cũ gửi `statusId`, mới gửi `key`; transition tham chiếu tương ứng. */
export function draftToPhaseBody(phase: DraftPhase): { statuses: StatusInput[]; transitions: TransitionInput[] } {
  const ref = new Map<string, number | string>(phase.statuses.map((s) => [s.key, s.statusId ?? s.key]))
  return {
    statuses: phase.statuses.map((s) => ({
      ...(s.statusId !== undefined ? { statusId: s.statusId } : { key: s.key }),
      name: s.name.trim(),
      category: s.category,
      color: s.color,
      description: s.description?.trim() || null,
      isInitial: s.isInitial,
      isActive: s.isActive,
    })),
    transitions: phase.transitions.map((t) => ({
      from: ref.get(t.from) ?? t.from,
      to: ref.get(t.to) ?? t.to,
      allowedRoleIds: t.allowedRoleIds,
      requireComment: t.requireComment,
      commentHint: t.requireComment ? t.commentHint?.trim() || null : null,
      condition: t.condition?.trim() || null,
    })),
  }
}

export function validateDraftPhase(phase: DraftPhase, phaseIndex: number): WorkflowIssue[] {
  return validatePhaseWorkflow(phase.statuses, phase.transitions, phaseIndex)
}

export function validateDraftPhases(phases: DraftPhase[]): WorkflowIssue[] {
  return phases.flatMap((phase, index) => validateDraftPhase(phase, index))
}
