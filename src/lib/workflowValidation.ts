import type { StatusCategory, WorkflowIssue } from '@/types/project'

// Luật hợp lệ của workflow 1 phase — doc/Workspace-RBAC-API-Contract.md §12.5. Dùng chung cho wizard (kiểm tra
// trước khi Next — Figma frame 03 "Matrix Validation") và mock (giả lập BE trả 400 WORKFLOW_INVALID).

export interface ValidatableStatus {
  key: string
  name: string
  category: StatusCategory
  isInitial: boolean
  isActive?: boolean
}

export interface ValidatableTransition {
  from: string
  to: string
  allowedRoleIds: number[]
}

export function validatePhaseWorkflow(
  statuses: ValidatableStatus[],
  transitions: ValidatableTransition[],
  phaseIndex = 0,
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = []
  const push = (issue: Omit<WorkflowIssue, 'phaseIndex'>) => issues.push({ phaseIndex, ...issue })
  const active = statuses.filter((s) => s.isActive !== false)
  const label = (key: string) => `"${active.find((s) => s.key === key)?.name || key}"`

  if (active.length === 0) {
    push({ code: 'NO_STATUS', message: 'Phase chưa có trạng thái nào.' })
    return issues
  }

  const seen = new Map<string, string>()
  for (const s of active) {
    const name = s.name.trim().toLowerCase()
    if (!name) {
      push({ code: 'STATUS_NAME_REQUIRED', statusKey: s.key, message: 'Có trạng thái chưa đặt tên.' })
      continue
    }
    if (seen.has(name)) {
      push({ code: 'DUPLICATE_STATUS_NAME', statusKey: s.key, message: `Tên trạng thái "${s.name.trim()}" bị trùng.` })
    }
    seen.set(name, s.key)
  }

  const initials = active.filter((s) => s.isInitial)
  if (initials.length === 0) push({ code: 'NO_INITIAL_STATUS', message: 'Chưa chọn trạng thái khởi tạo (Initial).' })
  if (initials.length > 1) push({ code: 'MULTIPLE_INITIAL_STATUS', message: 'Chỉ được có 1 trạng thái khởi tạo.' })

  const doneKeys = new Set(active.filter((s) => s.category === 'DONE').map((s) => s.key))
  if (doneKeys.size === 0) {
    push({ code: 'NO_DONE_STATUS', message: 'Cần ít nhất 1 trạng thái thuộc nhóm "Hoàn thành" (Done).' })
  }

  const activeKeys = new Set(active.map((s) => s.key))
  const pairs = new Set<string>()
  const edges: [string, string][] = []
  transitions.forEach((t, transitionIndex) => {
    const pair = `${t.from}→${t.to}`
    if (!activeKeys.has(t.from) || !activeKeys.has(t.to)) {
      push({ code: 'INVALID_TRANSITION', transitionIndex, message: `Luật chuyển #${transitionIndex + 1} trỏ tới trạng thái không tồn tại.` })
      return
    }
    if (t.from === t.to) {
      push({ code: 'INVALID_TRANSITION', transitionIndex, message: `Luật chuyển #${transitionIndex + 1} có trạng thái đầu và cuối giống nhau.` })
      return
    }
    if (pairs.has(pair)) {
      push({ code: 'INVALID_TRANSITION', transitionIndex, message: `Luật chuyển ${label(t.from)} → ${label(t.to)} bị khai báo 2 lần.` })
      return
    }
    pairs.add(pair)
    if (t.allowedRoleIds.length === 0) {
      push({ code: 'TRANSITION_NO_ROLE', transitionIndex, message: `Luật chuyển ${label(t.from)} → ${label(t.to)} chưa chọn role được phép.` })
    }
    edges.push([t.from, t.to])
  })

  // Đồ thị chỉ dựng từ transition hợp lệ: kiểm tra đi tới được từ initial và không có ngõ cụt.
  if (initials.length === 1) {
    const reached = walk(initials[0].key, edges, 'forward')
    for (const s of active) {
      if (!reached.has(s.key)) {
        push({ code: 'UNREACHABLE_STATUS', statusKey: s.key, message: `Trạng thái ${label(s.key)} không thể đi tới từ trạng thái khởi tạo.` })
      }
    }
  }
  if (doneKeys.size > 0) {
    const canFinish = new Set<string>()
    for (const done of doneKeys) for (const key of walk(done, edges, 'backward')) canFinish.add(key)
    for (const s of active) {
      if (s.category !== 'DONE' && !canFinish.has(s.key)) {
        push({ code: 'DEAD_END_STATUS', statusKey: s.key, message: `Trạng thái ${label(s.key)} là ngõ cụt — không có đường đi tới trạng thái hoàn thành.` })
      }
    }
  }

  return issues
}

function walk(start: string, edges: [string, string][], direction: 'forward' | 'backward') {
  const visited = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const [from, to] of edges) {
      const [a, b] = direction === 'forward' ? [from, to] : [to, from]
      if (a === current && !visited.has(b)) {
        visited.add(b)
        queue.push(b)
      }
    }
  }
  return visited
}

export const STATUS_CATEGORY_LABEL: Record<StatusCategory, string> = {
  TODO: 'Chờ xử lý (To Do)',
  IN_PROGRESS: 'Đang xử lý (In Progress)',
  DONE: 'Hoàn thành (Done)',
}

export const DEFAULT_CATEGORY_COLOR: Record<StatusCategory, string> = {
  TODO: '#78716c',
  IN_PROGRESS: '#2563eb',
  DONE: '#079455',
}
