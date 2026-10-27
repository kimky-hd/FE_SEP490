import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from './apiClient'

// Thông báo cho mã lỗi trong doc/Workspace-RBAC-API-Contract.md (bảng "Mã lỗi riêng"). Mã không có ở đây thì
// dùng `message` BE trả về.
const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu hoặc bạn không có quyền xem.',
  NETWORK_ERROR: 'Không thể kết nối tới máy chủ.',
  NOT_COMPANY_MEMBER: 'Bạn không thuộc công ty này.',
  ROLE_NAME_TAKEN: 'Tên role đã tồn tại trong công ty.',
  ROLE_CODE_TAKEN: 'Mã role đã tồn tại trong công ty.',
  ROLE_LOCKED: 'Role hệ thống này được khoá, không chỉnh sửa được.',
  ROLE_IN_USE: 'Role đang được gán cho người dùng — chuyển họ sang role khác trước khi tắt.',
  ROLE_INACTIVE: 'Role đang tắt, không gán được.',
  ROLE_SCOPE_MISMATCH: 'Role không đúng phạm vi áp dụng.',
  PERMISSION_SCOPE_MISMATCH: 'Có quyền không thuộc phạm vi của role.',
  UNKNOWN_PERMISSION: 'Có quyền không tồn tại trong danh mục.',
  LAST_TENANT_ADMIN: 'Công ty phải còn ít nhất 1 Tenant Admin.',
  LAST_WORKSPACE_ADMIN: 'Workspace phải còn ít nhất 1 Workspace Admin.',
  WORKSPACE_CODE_TAKEN: 'Mã workspace đã được dùng trong công ty.',
  WORKSPACE_ARCHIVED: 'Workspace đã được lưu trữ, dữ liệu chỉ đọc.',
  PERSONAL_WORKSPACE: 'Workspace cá nhân không có thành viên khác.',
  ALREADY_MEMBER: 'Người này đã là thành viên.',
  NOT_WORKSPACE_MEMBER: 'Có người chưa là thành viên của workspace.',
  PROJECT_KEY_TAKEN: 'Project Key đã được dùng trong workspace.',
  PROJECT_ARCHIVED: 'Dự án đã được lưu trữ, dữ liệu chỉ đọc.',
  LAST_PROJECT_MANAGER: 'Dự án phải còn ít nhất 1 Project Manager.',
  WORKFLOW_INVALID: 'Cấu hình workflow chưa hợp lệ.',
  PHASE_REQUIRED: 'Dự án phải còn ít nhất 1 phase đang hoạt động.',
  PHASE_IN_USE: 'Phase đang có issue, không tắt được.',
  STATUS_IN_USE: 'Trạng thái đang có issue, không xoá được — hãy tắt thay vì xoá.',
}

// Lỗi field-level gắn thẳng vào ô input tương ứng.
const FIELD_OF_CODE: Record<string, string> = {
  ROLE_NAME_TAKEN: 'name',
  ROLE_CODE_TAKEN: 'code',
  WORKSPACE_CODE_TAKEN: 'code',
  PROJECT_KEY_TAKEN: 'key',
}

export function apiErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại.') {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? (error.message || fallback)
  return fallback
}

/**
 * Đẩy lỗi 400 VALIDATION_ERROR / 409 trùng tên-mã vào form. Trả về `true` nếu đã gắn được vào ít nhất 1 field
 * (khi đó không cần hiện Alert chung).
 */
export function applyApiFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: string[]) {
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
    setError(field as Path<T>, { message: MESSAGES[error.code] })
    applied = true
  }
  return applied
}

export const isForbidden = (error: unknown) =>
  error instanceof ApiError && (error.status === 403 || error.status === 404)
