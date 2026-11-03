import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { tr } from '@/i18n'
import { ApiError } from './apiClient'

// Thông báo cho mã lỗi trong doc/Workspace-RBAC-API-Contract.md (bảng "Mã lỗi riêng"). Mã không có ở đây thì
// dùng `message` BE trả về.
const MESSAGES: Record<string, () => string> = {
  FORBIDDEN: () => tr('Bạn không có quyền thực hiện thao tác này.', "You don't have permission to do this."),
  NOT_FOUND: () =>
    tr(
      'Không tìm thấy dữ liệu hoặc bạn không có quyền xem.',
      "Data not found, or you don't have permission to view it.",
    ),
  NETWORK_ERROR: () => tr('Không thể kết nối tới máy chủ.', "Can't connect to the server."),
  NOT_COMPANY_MEMBER: () => tr('Bạn không thuộc công ty này.', "You're not a member of this company."),
  ROLE_NAME_TAKEN: () => tr('Tên role đã tồn tại trong công ty.', 'This role name already exists in the company.'),
  ROLE_CODE_TAKEN: () => tr('Mã role đã tồn tại trong công ty.', 'This role code already exists in the company.'),
  ROLE_LOCKED: () =>
    tr('Role hệ thống này được khoá, không chỉnh sửa được.', "This system role is locked and can't be edited."),
  ROLE_IN_USE: () =>
    tr(
      'Role đang được gán cho người dùng — chuyển họ sang role khác trước khi tắt.',
      'This role is assigned to users — move them to another role before disabling it.',
    ),
  ROLE_INACTIVE: () => tr('Role đang tắt, không gán được.', "This role is disabled and can't be assigned."),
  ROLE_SCOPE_MISMATCH: () => tr('Role không đúng phạm vi áp dụng.', 'The role has the wrong scope.'),
  PERMISSION_SCOPE_MISMATCH: () =>
    tr('Có quyền không thuộc phạm vi của role.', "Some permissions are outside the role's scope."),
  UNKNOWN_PERMISSION: () =>
    tr('Có quyền không tồn tại trong danh mục.', "Some permissions don't exist in the catalog."),
  LAST_TENANT_ADMIN: () =>
    tr('Công ty phải còn ít nhất 1 Tenant Admin.', 'The company must keep at least 1 Tenant Admin.'),
  LAST_WORKSPACE_ADMIN: () =>
    tr('Workspace phải còn ít nhất 1 Workspace Admin.', 'The workspace must keep at least 1 Workspace Admin.'),
  WORKSPACE_CODE_TAKEN: () =>
    tr('Mã workspace đã được dùng trong công ty.', 'This workspace code is already used in the company.'),
  WORKSPACE_ARCHIVED: () =>
    tr('Workspace đã được lưu trữ, dữ liệu chỉ đọc.', 'The workspace is archived; data is read-only.'),
  PERSONAL_WORKSPACE: () =>
    tr('Workspace cá nhân không có thành viên khác.', 'A personal workspace has no other members.'),
  ALREADY_MEMBER: () => tr('Người này đã là thành viên.', 'This person is already a member.'),
  NOT_WORKSPACE_MEMBER: () =>
    tr('Có người chưa là thành viên của workspace.', 'Someone is not yet a member of the workspace.'),
  PROJECT_KEY_TAKEN: () =>
    tr('Project Key đã được dùng trong workspace.', 'This project key is already used in the workspace.'),
  PROJECT_ARCHIVED: () => tr('Dự án đã được lưu trữ, dữ liệu chỉ đọc.', 'The project is archived; data is read-only.'),
  LAST_PROJECT_MANAGER: () =>
    tr('Dự án phải còn ít nhất 1 Project Manager.', 'The project must keep at least 1 Project Manager.'),
  WORKFLOW_INVALID: () => tr('Cấu hình workflow chưa hợp lệ.', 'The workflow configuration is invalid.'),
  PHASE_REQUIRED: () =>
    tr('Dự án phải còn ít nhất 1 phase đang hoạt động.', 'The project must keep at least 1 active phase.'),
  PHASE_IN_USE: () => tr('Phase đang có issue, không tắt được.', "This phase has issues and can't be disabled."),
  // doc/Issues-Testcases-API-Contract.md §7 (WIP_LIMIT_REACHED dùng message của BE vì kèm giới hạn).
  TRANSITION_NOT_ALLOWED: () =>
    tr(
      'Workflow không cho phép chuyển sang trạng thái này với vai trò của bạn.',
      "The workflow doesn't allow this move for your role.",
    ),
  ACTIVE_SPRINT_EXISTS: () =>
    tr(
      'Dự án đang có một sprint chạy — hoàn tất sprint đó trước.',
      'The project already has an active sprint — complete it first.',
    ),
  CYCLE_CLOSED: () =>
    tr('Đợt chạy đã đóng, không ghi kết quả được.', "The test cycle is closed; results can't be recorded."),
  INVALID_REQUIREMENT: () =>
    tr('REQ không thuộc dự án hoặc không còn tồn tại.', "The REQ isn't in this project or no longer exists."),
  STATUS_IN_USE: () =>
    tr(
      'Trạng thái đang có issue, không xoá được — hãy tắt thay vì xoá.',
      "This status has issues and can't be deleted — disable it instead.",
    ),
}

// Lỗi field-level gắn thẳng vào ô input tương ứng.
const FIELD_OF_CODE: Record<string, string> = {
  ROLE_NAME_TAKEN: 'name',
  ROLE_CODE_TAKEN: 'code',
  WORKSPACE_CODE_TAKEN: 'code',
  PROJECT_KEY_TAKEN: 'key',
}

/**
 * 409 STATUS_IN_USE (doc/BE-Changes-2026-10-28_30-API.md E4): `errors.statuses` = id trạng thái còn issue. Nêu tên
 * trạng thái để người sửa workflow biết phải tắt (isActive = false) thay vì xoá.
 */
export function statusInUseMessage(error: unknown, nameOf: (statusId: number) => string | undefined): string | null {
  if (!(error instanceof ApiError) || error.code !== 'STATUS_IN_USE') return null
  const names = (error.errors?.statuses ?? [])
    .map((id) => nameOf(Number(id)))
    .filter((n): n is string => !!n)
    .map((n) => `“${n}”`)
  if (!names.length) return MESSAGES.STATUS_IN_USE()
  return tr(
    `Trạng thái ${names.join(', ')} đang có issue nên không xoá được. Hãy tắt trạng thái thay vì xoá, hoặc chuyển issue sang trạng thái khác trước.`,
    `Status ${names.join(', ')} still has issues and can't be deleted. Disable it instead, or move its issues first.`,
  )
}

export function apiErrorMessage(
  error: unknown,
  fallback = tr('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong. Please try again.'),
) {
  if (error instanceof ApiError) return MESSAGES[error.code]?.() ?? (error.message || fallback)
  return fallback
}

/**
 * Đẩy lỗi 400 VALIDATION_ERROR / 409 trùng tên-mã vào form. Trả về `true` nếu đã gắn được vào ít nhất 1 field
 * (khi đó không cần hiện Alert chung).
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: string[],
) {
  if (!(error instanceof ApiError)) return false
  let applied = false
  for (const [field, messages] of Object.entries(error.errors ?? {})) {
    if (fields.includes(field) && messages[0]) {
      setError(field as Path<T>, { message: messages[0] })
      applied = true
    }
  }
  const field = FIELD_OF_CODE[error.code]
  if (field && fields.includes(field)) {
    setError(field as Path<T>, { message: MESSAGES[error.code]?.() })
    applied = true
  }
  return applied
}

export const isForbidden = (error: unknown) =>
  error instanceof ApiError && (error.status === 403 || error.status === 404)
