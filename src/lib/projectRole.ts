import { PERMISSIONS, ROLE_KINDS, type RoleKind } from '@/types/rbac'
import type { FeatureFlags } from './features'

// Vai trò "làm việc" của người dùng TRONG một dự án: quyết định thứ tự menu dự án và nội dung "Việc của tôi".
// D05: dùng `myRole.kind` do BE trả (RoleRefDto.kind); BE cũ / role chưa có kind thì đoán từ tên / mã role,
// không khớp từ khoá nào thì đoán theo quyền.

export type ProjectRoleKind = RoleKind

export type ProjectModule =
  'myWork' | 'overview' | 'documents' | 'kanban' | 'testcases' | 'workflow' | 'members' | 'settings'

export const PROJECT_ROLE_KINDS: ProjectRoleKind[] = ROLE_KINDS

interface RoleLike {
  name?: string | null
  code?: string | null
  kind?: RoleKind | null
}

// Thứ tự kiểm tra quan trọng: "QA Lead" là QA, "Tech Lead" là Dev, "Design Lead" là Designer — chỉ "lead" trơn mới là PM.
const RULES: [ProjectRoleKind, RegExp][] = [
  ['QA', /\b(qa|qc|tester|test|testing|quality|kiem thu)\b/],
  ['DESIGNER', /\b(design|designer|ui|ux|thiet ke)\b/],
  ['BA', /\b(ba|business analyst|business analysis|analyst|phan tich|nghiep vu)\b/],
  ['DEV', /\b(dev|developer|devops|tech lead|engineer|engineering|programmer|lap trinh)\b/],
  ['PM', /\b(pm|po|project manager|product manager|manager|owner|lead|quan ly)\b/],
]

/** Bỏ dấu, thường hoá, đổi `_ - / .` thành khoảng trắng: "PROJECT_MANAGER" → "project manager". */
export function normalizeRoleText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[_\-/.&,()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function kindFromText(text: string | null | undefined): ProjectRoleKind | null {
  if (!text) return null
  const s = normalizeRoleText(text)
  for (const [kind, re] of RULES) if (re.test(s)) return kind
  return null
}

const has = (permissions: readonly string[], key: string) => permissions.includes('*') || permissions.includes(key)

export function detectProjectRole(role: RoleLike | null | undefined, permissions: readonly string[]): ProjectRoleKind {
  if (role?.kind && (ROLE_KINDS as string[]).includes(role.kind)) return role.kind
  const byName = kindFromText(role?.name) ?? kindFromText(role?.code)
  if (byName) return byName
  if (has(permissions, PERMISSIONS.documentApprove) && has(permissions, PERMISSIONS.projectMemberManage)) return 'PM'
  if (has(permissions, PERMISSIONS.documentEdit)) return 'BA'
  return 'OTHER'
}

/** Thứ tự các mục chính (sau "Việc của tôi") theo vai trò — đúng bảng trong mock-sidebar-calm.html. */
export const ROLE_MODULE_ORDER: Record<ProjectRoleKind, ProjectModule[]> = {
  QA: ['testcases', 'documents', 'kanban', 'workflow'],
  BA: ['documents', 'kanban', 'testcases', 'workflow'],
  DESIGNER: ['documents', 'kanban'],
  DEV: ['kanban', 'documents', 'testcases'],
  PM: ['overview', 'documents', 'kanban', 'testcases', 'workflow'],
  OTHER: ['overview', 'documents', 'workflow'],
}

export interface ProjectMenu {
  main: ProjectModule[]
  tail: ProjectModule[]
}

/** Menu dự án: "Việc của tôi" + các mục theo vai trò mà người dùng được xem, rồi Thành viên / Cài đặt nếu có quyền. */
export function projectMenu(
  kind: ProjectRoleKind,
  permissions: readonly string[],
  features: FeatureFlags,
): ProjectMenu {
  const visible = (m: ProjectModule) => moduleAllowed(m, permissions, features)
  return {
    main: ['myWork' as const, ...ROLE_MODULE_ORDER[kind]].filter(visible),
    tail: (['members', 'settings'] as const).filter(visible),
  }
}

/** Quyền xem từng mục (giữ đúng điều kiện của thanh tab cũ). Mục ẩn khỏi menu vẫn mở được bằng URL nếu có quyền. */
export function moduleAllowed(m: ProjectModule, permissions: readonly string[], features: FeatureFlags): boolean {
  switch (m) {
    case 'documents':
      return has(permissions, PERMISSIONS.documentView)
    case 'kanban':
      return features.kanban && has(permissions, PERMISSIONS.issueView)
    case 'testcases':
      return features.testcases && has(permissions, PERMISSIONS.testCaseView)
    case 'members':
      return has(permissions, PERMISSIONS.projectView)
    case 'settings':
      return has(permissions, PERMISSIONS.projectUpdate) || has(permissions, PERMISSIONS.projectArchive)
    default:
      return true
  }
}

// Chỉ để dev chụp/kiểm tra các vai trò: localStorage `ssam.devRoleOverride` = BA | QA | DEV | DESIGNER | PM | OTHER.
export const DEV_ROLE_OVERRIDE_KEY = 'ssam.devRoleOverride'

export function readDevRoleOverride(): ProjectRoleKind | null {
  if (!import.meta.env.DEV) return null
  try {
    const v = window.localStorage.getItem(DEV_ROLE_OVERRIDE_KEY)
    return v && (PROJECT_ROLE_KINDS as string[]).includes(v) ? (v as ProjectRoleKind) : null
  } catch {
    return null
  }
}

export function resolveProjectRole(project: {
  myRole: RoleLike | null
  myPermissions: readonly string[]
}): ProjectRoleKind {
  return readDevRoleOverride() ?? detectProjectRole(project.myRole, project.myPermissions)
}

/** Nhãn ngắn hiển thị dưới tên người dùng (vd "QA · Checkout"). */
export const ROLE_SHORT: Record<ProjectRoleKind, string> = {
  BA: 'BA',
  DESIGNER: 'Designer',
  QA: 'QA',
  DEV: 'Dev',
  PM: 'PM',
  OTHER: '',
}
