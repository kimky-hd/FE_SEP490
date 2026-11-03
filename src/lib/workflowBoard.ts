import type { StatusCategory, WorkflowDto } from '@/types/project'
import { PERMISSIONS } from '@/types/rbac'

// Cột board từ workflow dự án (doc/Issues-Testcases-API-Contract.md §4.1) và luật chuyển trạng thái (§4.3, §8).
// Hàm thuần, dùng chung cho mock và FE.

export interface BoardStatus {
  statusId: number
  name: string
  category: StatusCategory
  color: string | null
  isInitial: boolean
  phaseId: number
  phaseName: string
  phaseIndex: number
  position: number
}

/** Trạng thái đang bật của các phase đang bật, theo thứ tự phase rồi `position`. */
export function boardStatuses(wf: WorkflowDto): BoardStatus[] {
  return [...wf.phases]
    .filter((p) => p.isActive)
    .sort((a, b) => a.position - b.position)
    .flatMap((p, phaseIndex) =>
      [...p.statuses]
        .filter((s) => s.isActive)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          statusId: s.statusId,
          name: s.name,
          category: s.category,
          color: s.color,
          isInitial: s.isInitial,
          phaseId: p.phaseId,
          phaseName: p.name,
          phaseIndex,
          position: s.position,
        })),
    )
}

/** D14: cột board (#26 `BoardColumnDto`, đã có `isInitial`) → trạng thái board, không cần gọi GET /workflow. */
export function columnStatuses(
  columns: {
    statusId: number
    name: string
    category: StatusCategory
    color: string | null
    phaseId: number
    phaseName: string
    position: number
    isInitial?: boolean
  }[],
): BoardStatus[] {
  const phases = [...new Set(columns.map((c) => c.phaseId))]
  return columns.map((c) => ({
    statusId: c.statusId,
    name: c.name,
    category: c.category,
    color: c.color,
    isInitial: c.isInitial ?? false,
    phaseId: c.phaseId,
    phaseName: c.phaseName,
    phaseIndex: phases.indexOf(c.phaseId),
    position: c.position,
  }))
}

export function initialStatusId(wf: WorkflowDto, wanted?: number): number | null {
  const all = boardStatuses(wf)
  if (wanted !== undefined && all.some((s) => s.statusId === wanted && s.isInitial)) return wanted
  return (all.find((s) => s.isInitial) ?? all[0])?.statusId ?? null
}

export interface TransitionCtx {
  roleId: number | null
  permissions: readonly string[]
}

/**
 * D13 (§C.3 T5): người có `project.workflow.manage` (PM, và Tenant Admin / Workspace Admin / chủ workspace cá nhân —
 * BE cấp `AllProjectKeys` gồm key này) bỏ qua kiểm tra role của transition; vẫn phải có luật from → to.
 */
export function bypassesTransitionRoles(permissions: readonly string[]): boolean {
  return permissions.includes('*') || permissions.includes(PERMISSIONS.projectWorkflowManage)
}

/**
 * Trạng thái được chuyển tới từ `fromStatusId` (§C.3 T1–T5): có WorkflowTransition(from → to) và role dự án của người
 * gọi nằm trong `allowedRoles` (transition không gắn role nào = ai cũng được; quản trị workflow = mọi transition, D13).
 * Luật nối giai đoạn (T4): từ một trạng thái DONE của phase, được chuyển sang trạng thái IsInitial của phase kế tiếp.
 */
export function allowedTargets(wf: WorkflowDto, fromStatusId: number, ctx: TransitionCtx): number[] {
  const all = boardStatuses(wf)
  const from = all.find((s) => s.statusId === fromStatusId)
  const superuser = bypassesTransitionRoles(ctx.permissions)
  const out: number[] = []
  for (const phase of wf.phases.filter((p) => p.isActive)) {
    for (const tr of phase.transitions) {
      if (tr.fromStatusId !== fromStatusId) continue
      if (!all.some((s) => s.statusId === tr.toStatusId)) continue
      const ok =
        superuser ||
        tr.allowedRoles.length === 0 ||
        (ctx.roleId !== null && tr.allowedRoles.some((r) => r.roleId === ctx.roleId))
      if (ok && !out.includes(tr.toStatusId)) out.push(tr.toStatusId)
    }
  }
  if (from && from.category === 'DONE') {
    const next = all.find((s) => s.phaseIndex === from.phaseIndex + 1 && s.isInitial)
    if (next && !out.includes(next.statusId)) out.push(next.statusId)
  }
  return out
}

/** Trạng thái "Review / QA": tên gợi ý review / QA / test; không có thì trạng thái chưa xong cuối cùng của phase. */
export function isReviewStatus(statuses: BoardStatus[], statusId: number): boolean {
  const s = statuses.find((x) => x.statusId === statusId)
  if (!s || s.category === 'DONE') return false
  if (/review|qa|test|kiểm thử|kiem thu|duyệt|verify/i.test(s.name)) return s.category === 'IN_PROGRESS'
  const phase = statuses.filter((x) => x.phaseId === s.phaseId && x.category !== 'DONE')
  const hasNamed = phase.some(
    (x) => x.category === 'IN_PROGRESS' && /review|qa|test|kiểm thử|kiem thu|duyệt|verify/i.test(x.name),
  )
  return !hasNamed && s.category === 'IN_PROGRESS' && phase[phase.length - 1]?.statusId === s.statusId
}

/** Các trạng thái mẫu cho dữ liệu demo: phase có đủ TODO / IN_PROGRESS / DONE (ưu tiên phase nhiều trạng thái nhất). */
export function demoStatuses(wf: WorkflowDto) {
  const all = boardStatuses(wf)
  const phases = [...new Set(all.map((s) => s.phaseId))].map((id) => all.filter((s) => s.phaseId === id))
  const full = phases.filter((p) => ['TODO', 'IN_PROGRESS', 'DONE'].every((c) => p.some((s) => s.category === c)))
  const pick = [...(full.length ? full : phases)].sort((a, b) => b.length - a.length)[0] ?? all
  const by = (c: StatusCategory) => pick.filter((s) => s.category === c)
  const todo = (pick.find((s) => s.isInitial && s.category === 'TODO') ?? by('TODO')[0] ?? pick[0])?.statusId
  const doing = by('IN_PROGRESS')[0]?.statusId ?? todo
  const review = by('IN_PROGRESS').slice(-1)[0]?.statusId ?? doing
  const done = by('DONE')[0]?.statusId ?? review
  return { todo, doing, review, done }
}
