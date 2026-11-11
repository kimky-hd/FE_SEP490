import { tr } from '@/i18n'
import type { RoleScope } from '@/types/rbac'

// Tên quyền từ backend trộn Việt-Anh ("Lưu trữ (Archive) Workspace"). Ở FE hiển thị tên gọn theo ngôn ngữ đang chọn,
// tra theo key quyền; key lạ (backend thêm quyền mới) thì dùng nguyên tên backend.
// Gọi lúc render để đổi ngôn ngữ là đổi theo.

const PERMISSION_LABELS: Record<string, () => string> = {
  // TENANT
  'company.view': () => tr('Xem thông tin chung của tổ chức', 'View organization details'),
  'company.update': () => tr('Cập nhật hồ sơ tổ chức', 'Update organization profile'),
  'user.view': () => tr('Xem danh sách người dùng trong tổ chức', 'View users in the organization'),
  'user.invite': () => tr('Mời, tạo mới và nhập người dùng hàng loạt', 'Invite, create and bulk import users'),
  'user.update': () => tr('Cập nhật thông tin người dùng', 'Update user details'),
  'user.deactivate': () => tr('Vô hiệu hoá / kích hoạt lại tài khoản', 'Deactivate / reactivate accounts'),
  'role.view': () => tr('Xem danh mục role và ma trận phân quyền', 'View roles and the permission matrix'),
  'role.manage': () => tr('Tạo, sửa, vô hiệu hoá và xoá role', 'Create, edit, disable and delete roles'),
  'user.assign_role': () =>
    tr('Gán role cấp tổ chức và cấp quyền bổ sung', 'Assign organization roles and extra permissions'),
  'workspace.create': () => tr('Tạo workspace mới trong tổ chức', 'Create workspaces in the organization'),
  'workspace.view_all': () =>
    tr('Xem toàn bộ workspace và chỉ định quản trị workspace', 'View all workspaces and appoint workspace admins'),
  'audit.view': () => tr('Xem và xuất nhật ký kiểm toán của công ty', 'View and export company audit logs'),
  // WORKSPACE
  'workspace.view': () => tr('Xem thông tin và báo cáo tổng quan workspace', 'View workspace details and overview'),
  'workspace.update': () => tr('Chỉnh sửa cấu hình workspace', 'Edit workspace settings'),
  'workspace.archive': () => tr('Lưu trữ workspace (chuyển sang chỉ đọc)', 'Archive workspace (make read-only)'),
  'workspace.member.view': () => tr('Xem danh sách thành viên workspace', 'View workspace members'),
  'workspace.member.manage': () => tr('Thêm / loại bỏ thành viên khỏi workspace', 'Add / remove workspace members'),
  'workspace.member.assign_role': () =>
    tr('Gán role và cấp quyền bổ sung trong workspace', 'Assign roles and extra permissions in the workspace'),
  'project.create': () => tr('Tạo dự án mới trong workspace', 'Create projects in the workspace'),
  'project.inherit_access': () =>
    tr('Kế thừa quyền truy cập mọi dự án trong workspace', 'Inherit access to every project in the workspace'),
  // PROJECT
  'project.view': () => tr('Xem thông tin chung và tiến độ dự án', 'View project details and progress'),
  'project.update': () =>
    tr('Chỉnh sửa cấu hình dự án và bật/tắt tiện ích AI', 'Edit project settings and toggle AI features'),
  'project.archive': () => tr('Lưu trữ dự án', 'Archive project'),
  'project.member.manage': () =>
    tr(
      'Quản lý thành viên, gán role và cấp quyền bổ sung trong dự án',
      'Manage project members, roles and extra permissions',
    ),
  'project.workflow.view': () =>
    tr('Xem cấu trúc giai đoạn và trạng thái quy trình', 'View phases and workflow statuses'),
  'project.workflow.manage': () =>
    tr('Tạo, sửa, sắp xếp giai đoạn và trạng thái quy trình', 'Create, edit and reorder phases and workflow statuses'),
  'project.workflow.transition.manage': () =>
    tr('Cấu hình quy tắc chuyển trạng thái', 'Configure status transition rules'),
  'issue.view': () => tr('Xem danh sách issue và bảng Kanban', 'View issues and the Kanban board'),
  'issue.create': () => tr('Tạo issue mới (task / bug)', 'Create issues (task / bug)'),
  'issue.update': () => tr('Chỉnh sửa issue và liên kết tài liệu', 'Edit issues and link documents'),
  'issue.assign': () => tr('Giao việc / chuyển giao công việc', 'Assign / reassign work'),
  'issue.change_status': () => tr('Thay đổi trạng thái issue', 'Change issue status'),
  'issue.delete': () => tr('Xoá issue', 'Delete issues'),
  'sprint.manage': () => tr('Tạo, bắt đầu và hoàn tất sprint', 'Create, start and complete sprints'),
  'document.view': () =>
    tr('Xem tài liệu đặc tả và lịch sử phiên bản', 'View specification documents and version history'),
  'document.edit': () => tr('Tạo và soạn thảo tài liệu yêu cầu', 'Create and write requirement documents'),
  'document.approve': () => tr('Phê duyệt / từ chối tài liệu', 'Approve / reject documents'),
  'document.revise': () =>
    tr('Tạo phiên bản sửa đổi từ bản gốc và xuất tài liệu', 'Create revisions from a baseline and export documents'),
  'document.delete': () => tr('Xoá tài liệu', 'Delete documents'),
  'figma.create': () => tr('Thêm link thiết kế Figma', 'Add Figma design links'),
  'figma.update': () => tr('Cập nhật link thiết kế Figma', 'Update Figma design links'),
  'figma.archive': () => tr('Xoá / lưu trữ link thiết kế Figma', 'Delete / archive Figma design links'),
  'testcase.view': () =>
    tr('Xem kịch bản kiểm thử và ma trận truy xuất', 'View test cases and the traceability matrix'),
  'testcase.manage': () =>
    tr(
      'Tạo, cập nhật, phê duyệt kịch bản kiểm thử và liên kết truy xuất',
      'Create, update and approve test cases and trace links',
    ),
  'testcase.execute': () =>
    tr('Chạy test và ghi kết quả, gắn bug có sẵn', 'Run tests, record results and link existing bugs'),
  // Mới, nhóm "Kiểm thử & Truy xuất", phạm vi PROJECT.
  'testcase.plan': () =>
    tr(
      'Thiết lập đợt test (môi trường, module), phân công, regression, bàn giao',
      'Set up test plans (environments, modules), assign testers, run regression, hand over',
    ),
  'comment.view': () =>
    tr('Xem bình luận trên issue, tài liệu và kịch bản kiểm thử', 'View comments on issues, documents and test cases'),
  'comment.write': () =>
    tr('Viết bình luận, nhắc tên và đánh dấu đã giải quyết', 'Write comments, mention people and resolve threads'),
  'activity.view': () =>
    tr('Xem lịch sử hoạt động và báo cáo tiến độ dự án', 'View project activity and progress reports'),
  'ai.use': () => tr('Dùng AI gợi ý bản nháp yêu cầu / kịch bản kiểm thử', 'Use AI to draft requirements / test cases'),
}

/** Tên quyền gọn theo ngôn ngữ hiện tại; key không biết thì trả về tên backend. */
export function permissionLabel(key: string, fallbackName: string): string {
  const label = PERMISSION_LABELS[key]
  return label ? label() : fallbackName
}

// Nhóm quyền từ backend có số thứ tự đầu ("1. Quản lý Workspace"): tra theo tên đã bỏ số.
const GROUP_LABELS: Record<string, () => string> = {
  'Quản lý Tổ chức': () => tr('Quản lý tổ chức', 'Organization'),
  'Quản lý Người dùng': () => tr('Quản lý người dùng', 'Users'),
  'Quản lý Role & Quyền': () => tr('Role và quyền', 'Roles & permissions'),
  'Quản trị Workspace': () => tr('Quản trị workspace', 'Workspace administration'),
  'Kiểm soát nhật kí hoạt động': () => tr('Nhật ký hoạt động', 'Audit logs'),
  'Quản lý Workspace': () => tr('Quản lý workspace', 'Workspace'),
  'Thành viên & Quyền Workspace': () => tr('Thành viên và quyền workspace', 'Workspace members & roles'),
  'Khởi tạo Project': () => tr('Tạo dự án', 'Projects'),
  'Quản lý Project': () => tr('Quản lý dự án', 'Project'),
  'Quản lý Phase & Quy trình': () => tr('Giai đoạn và quy trình', 'Phases & workflow'),
  'Quản lý Issue & Công việc': () => tr('Issue và công việc', 'Issues & tasks'),
  'Tài liệu Đặc tả': () => tr('Tài liệu đặc tả', 'Specification documents'),
  'UX/UI': () => tr('Thiết kế UX/UI', 'UX/UI design'),
  'Kiểm thử & Truy xuất': () => tr('Kiểm thử và truy xuất', 'Testing & traceability'),
  'Bình luận & Cộng tác': () => tr('Bình luận và cộng tác', 'Comments & collaboration'),
  'Lịch sử & Tiến độ': () => tr('Lịch sử và tiến độ', 'Activity & progress'),
  'Hỗ trợ AI (Tùy chọn)': () => tr('Hỗ trợ AI (tuỳ chọn)', 'AI assistance (optional)'),
}

/** Tên nhóm quyền (đã bỏ số thứ tự "1. ") theo ngôn ngữ hiện tại; nhóm lạ thì trả về tên backend đã bỏ số. */
export function permissionGroupLabel(group: string): string {
  const stripped = group.replace(/^\d+\.\s*/, '').trim()
  const label = GROUP_LABELS[stripped]
  return label ? label() : stripped
}

/** Nhãn phạm vi role theo ngôn ngữ hiện tại (bản song ngữ của SCOPE_LABEL trong lib/format). */
export function scopeLabel(scope: RoleScope): string {
  switch (scope) {
    case 'TENANT':
      return tr('Cấp công ty', 'Company level')
    case 'WORKSPACE':
      return tr('Cấp workspace', 'Workspace level')
    case 'PROJECT':
      return tr('Cấp dự án', 'Project level')
  }
}
