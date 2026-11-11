import { hasWorkPermission } from '@/lib/workPermissions'
import { PERMISSIONS } from '@/types/rbac'

// Quyền của module Test cases theo role động (role do Tenant Admin tạo, tự chọn bộ quyền). Mỗi nút trong module hỏi
// đúng một cờ ở đây; không có quyền → ẩn nút (như phần còn lại của app). Đợt test đã bàn giao hoặc dự án lưu trữ →
// mọi thao tác ghi tắt, trừ "Mở lại đợt test" (cần testcase.plan).

export interface TestAbilities {
  /** testcase.view — thấy module. */
  view: boolean
  /** testcase.manage — thêm / sửa / xoá case, mục, nhóm, bố cục cột, gắn REQ. (Nhập Excel: chưa làm, chờ quyết định.) */
  manage: boolean
  /** testcase.execute — ghi kết quả, gắn bug có sẵn. */
  execute: boolean
  /** issue.create (+ execute) — tạo bug mới trên Kanban từ case Fail. */
  createBug: boolean
  /** issue.view (+ execute) — xem danh sách bug đang mở để gắn. */
  linkBug: boolean
  /** ai.use + testcase.manage + dự án bật AI — sinh testcase bằng AI. */
  ai: boolean
  /** document.view — mã REQ là link mở tài liệu; không có thì chữ thường. */
  docView: boolean
  /** testcase.plan — thiết lập đợt test, phân công, build, regression, bàn giao (đợt đang mở). */
  plan: boolean
  /** testcase.plan khi đợt đã bàn giao — chỉ "Mở lại". */
  reopen: boolean
}

export interface AbilityInput {
  permissions: readonly string[]
  archived: boolean
  handedOver: boolean
  aiEnabled: boolean
}

export function testAbilities({ permissions, archived, handedOver, aiEnabled }: AbilityInput): TestAbilities {
  const has = (key: string) => hasWorkPermission(permissions, key)
  const view = has(PERMISSIONS.testCaseView)
  const writable = view && !archived && !handedOver
  const manage = writable && has(PERMISSIONS.testCaseManage)
  const execute = writable && has(PERMISSIONS.testCaseExecute)
  const planKey = view && !archived && has(PERMISSIONS.testCasePlan)
  return {
    view,
    manage,
    execute,
    createBug: execute && has(PERMISSIONS.issueCreate),
    linkBug: execute && has(PERMISSIONS.issueView),
    ai: manage && aiEnabled && has(PERMISSIONS.aiUse),
    docView: has(PERMISSIONS.documentView),
    plan: planKey && !handedOver,
    reopen: planKey && handedOver,
  }
}

/** Cột / ô sửa được không: Kết quả & Bug theo quyền ghi kết quả, các cột còn lại theo quyền quản lý. */
export function canEditCell(
  ab: Pick<TestAbilities, 'manage' | 'execute'>,
  kind: 'result' | 'bug' | 'content',
  deleted: boolean,
): boolean {
  if (deleted) return false
  return kind === 'content' ? ab.manage : ab.execute
}
