import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { tokenStorage } from '@/lib/storage'

export interface ScreenItem {
  id: string
  title: string
  path: string
  file: string
  note?: string
}

export interface ScreenGroup {
  group: string
  items: ScreenItem[]
}

export const SCREEN_GROUPS: ScreenGroup[] = [
  {
    group: '1. Trang chủ & Chung (Public / General)',
    items: [
      { id: '01', title: 'Landing Page (Trang giới thiệu)', path: '/landing', file: 'src/pages/LandingPage.tsx', note: 'Hiển thị ở / khi chưa đăng nhập, hoặc vào thẳng /landing' },
      { id: '02', title: 'Dashboard (Tổng quan hệ thống)', path: '/dashboard', file: 'src/pages/dashboard/DashboardHomePage.tsx', note: 'Hiển thị ở / khi đã đăng nhập, hoặc vào thẳng /dashboard' },
      { id: '03', title: '404 Not Found (Trang báo lỗi 404)', path: '/404-demo', file: 'src/pages/NotFoundPage.tsx' },
    ],
  },
  {
    group: '2. Xác thực tài khoản (Auth)',
    items: [
      { id: '04', title: 'Đăng nhập (Login)', path: '/login', file: 'src/pages/auth/LoginPage.tsx' },
      { id: '05', title: 'Đăng ký tài khoản (Register)', path: '/register', file: 'src/pages/auth/RegisterPage.tsx' },
      { id: '06', title: 'Chờ xác thực Email (Verify Email Pending)', path: '/verify-email/pending', file: 'src/pages/auth/VerifyEmailPendingPage.tsx' },
      { id: '07', title: 'Xác thực Email qua Token (Verify Email)', path: '/verify-email?token=demo-token', file: 'src/pages/auth/VerifyEmailPage.tsx' },
      { id: '08', title: 'Quên mật khẩu (Forgot Password)', path: '/forgot-password', file: 'src/pages/auth/ForgotPasswordPage.tsx' },
      { id: '09', title: 'Đã gửi mail đặt lại mật khẩu (Forgot Password Sent)', path: '/forgot-password/sent', file: 'src/pages/auth/ForgotPasswordSentPage.tsx' },
      { id: '10', title: 'Đặt lại mật khẩu mới (Reset Password)', path: '/reset-password?token=demo-token', file: 'src/pages/auth/ResetPasswordPage.tsx' },
      { id: '11', title: 'Chấp nhận lời mời qua Email (Accept Invite)', path: '/invite/demo-token', file: 'src/pages/invite/AcceptInvitePage.tsx' },
    ],
  },
  {
    group: '3. Khởi tạo lần đầu (Onboarding)',
    items: [
      { id: '12', title: 'Chọn loại tài khoản: Cá nhân / Doanh nghiệp', path: '/onboarding/account-type', file: 'src/pages/onboarding/ChooseAccountTypePage.tsx' },
      { id: '13', title: 'Thiết lập công ty mới (Company Setup)', path: '/onboarding/company-setup', file: 'src/pages/onboarding/CompanySetupPage.tsx' },
      { id: '14', title: 'Phát hiện tên miền công ty (Domain Match)', path: '/onboarding/domain-match', file: 'src/pages/onboarding/DomainMatchPage.tsx' },
      { id: '15', title: 'Chờ quản trị viên phê duyệt (Pending Approval)', path: '/onboarding/pending-approval', file: 'src/pages/onboarding/PendingApprovalPage.tsx' },
      { id: '16', title: 'Tạo Workspace đầu tiên (Create First Workspace)', path: '/onboarding/create-workspace', file: 'src/pages/onboarding/CreateWorkspacePage.tsx' },
    ],
  },
  {
    group: '4. Không gian làm việc (Workspaces)',
    items: [
      { id: '17', title: 'Danh sách Workspace + Modal Tạo Workspace', path: '/workspaces', file: 'src/pages/workspaces/WorkspaceListPage.tsx' },
      { id: '18', title: 'Chi tiết Workspace — Tab Tổng quan', path: '/workspaces/10', file: 'src/pages/workspaces/WorkspaceOverviewPage.tsx', note: 'Workspace mẫu ID=10 (Mobile Banking Revamp)' },
      { id: '19', title: 'Chi tiết Workspace — Tab Dự án', path: '/workspaces/10/projects', file: 'src/pages/workspaces/WorkspaceProjectsPage.tsx' },
      { id: '20', title: 'Chi tiết Workspace — Tab Thành viên (+ Modal Thêm)', path: '/workspaces/10/members', file: 'src/pages/workspaces/WorkspaceMembersPage.tsx' },
      { id: '21', title: 'Chi tiết Workspace — Tab Cài đặt', path: '/workspaces/10/settings', file: 'src/pages/workspaces/WorkspaceSettingsPage.tsx' },
    ],
  },
  {
    group: '5. Dự án & Cấu hình Workflow (Projects & SDLC)',
    items: [
      { id: '22', title: 'Wizard Tạo Dự án mới (3 bước: Info/SDLC → Workflow → Members)', path: '/workspaces/10/projects/new', file: 'src/pages/projects/wizard/CreateProjectWizardPage.tsx' },
      { id: '23', title: 'Danh sách tất cả Dự án trong công ty', path: '/projects', file: 'src/pages/projects/ProjectsPage.tsx' },
      { id: '24', title: 'Chi tiết Dự án — Tab Tổng quan', path: '/projects/20', file: 'src/pages/projects/ProjectOverviewPage.tsx', note: 'Dự án mẫu ID=20 (CORE - Custom SDLC), 21 (PAY - Kanban), 22 (NOTIF - Scrum)' },
      { id: '25', title: 'Chi tiết Dự án — Tab Workflow & Sơ đồ BPMN', path: '/projects/20/workflow', file: 'src/pages/projects/ProjectWorkflowPage.tsx' },
      { id: '26', title: 'Chi tiết Dự án — Tab Thành viên dự án', path: '/projects/20/members', file: 'src/pages/projects/ProjectMembersPage.tsx' },
      { id: '27', title: 'Chi tiết Dự án — Tab Cài đặt & Bật/tắt AI', path: '/projects/20/settings', file: 'src/pages/projects/ProjectSettingsPage.tsx' },
    ],
  },
  {
    group: '6. Quản trị Tổ chức & Phân quyền (Tenant Admin / RBAC)',
    items: [
      { id: '28', title: 'Danh mục Role (Tenant / Workspace / Project)', path: '/admin/roles', file: 'src/pages/admin/RoleListPage.tsx' },
      { id: '29', title: 'Tạo Role mới + Ma trận Phân quyền', path: '/admin/roles/new', file: 'src/pages/admin/RoleEditorPage.tsx' },
      { id: '30', title: 'Chỉnh sửa Role + Ma trận Phân quyền (VD: Role #4)', path: '/admin/roles/4', file: 'src/pages/admin/RoleEditorPage.tsx', note: 'Role #1 (khoá), #4 (Project Initiator - sửa được)' },
      { id: '31', title: 'Quản lý Người dùng Công ty', path: '/admin/users', file: 'src/pages/admin/CompanyUsersPage.tsx' },
      { id: '32', title: 'Mời thành viên mới vào Công ty / Workspace', path: '/members/invite', file: 'src/pages/dashboard/InviteMemberPage.tsx' },
    ],
  },
  {
    group: '7. Không gian Tài liệu Đặc tả & Tự động Bóc tách REQ (Full-Screen Workspace)',
    items: [
      { id: '33', title: 'Document Workspace (Mở nhanh từ Sidebar)', path: '/documents', file: 'src/pages/projects/ConfluenceWorkspacePage.tsx', note: 'Không gian toàn màn hình 100vw x 100vh, cây thư mục đa cấp & tự động bóc tách REQ từ Heading' },
      { id: '34', title: 'Document Space Dự án CORE (Mặc định)', path: '/projects/20/documents', file: 'src/pages/projects/ConfluenceWorkspacePage.tsx', note: 'Cây thư mục 2 nhánh lớn (BRD/URD & SRS), Live Outline, Bảng biểu tự do & Slash Menu (/)' },
      { id: '35', title: 'Trang SRS-01: Phân hệ Xác thực & RBAC (Safe Mode 🔒)', path: '/projects/20/documents/101', file: 'src/pages/projects/ConfluenceWorkspacePage.tsx', note: 'Trang Baseline đã duyệt (Khóa Safe Mode GB-01) — Bấm [+ Tạo phiên bản sửa đổi mới]' },
      { id: '36', title: 'Trang SRS-02: Thanh toán VietQR & Cảnh báo Stale RTM', path: '/projects/20/documents/102', file: 'src/pages/projects/ConfluenceWorkspacePage.tsx', note: 'Đang rà soát — Có Bảng đặc tả, Sơ đồ Mermaid, Figma & Ngăn trượt Diff / Stale RTM' },
    ],
  },
]

const DEMO_USERS = [
  { id: 1, label: 'Sarah Lin (Tenant Admin - Full quyền)', email: 'sarah@fintechcorp.com' },
  { id: 2, label: 'Phạm Văn Khoa (Workspace Admin / PM)', email: 'khoa@fintechcorp.com' },
  { id: 3, label: 'Vũ Kim Kỳ (Project Initiator)', email: 'ky@fintechcorp.com' },
  { id: 4, label: 'Phạm Minh Lương (Workspace Member)', email: 'luong@fintechcorp.com' },
  { id: 5, label: 'Trương Quang Tâm (QA / Chỉ xem)', email: 'tam@fintechcorp.com' },
]

function switchDemoUser(userId: number | null) {
  if (userId === null) {
    tokenStorage.clear()
    sessionStorage.setItem('ssam.guest_mode', '1')
  } else {
    sessionStorage.removeItem('ssam.guest_mode')
    tokenStorage.setTokens(`mock-token-${userId}`, `mock-token-${userId}-refresh`)
  }
  window.location.reload()
}

export function ScreenDirectoryPage() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:1505'
  const currentToken = tokenStorage.getAccessToken()

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-700">
                // SSAM UI Design Mode (Mock Backend Active)
              </span>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Danh mục Toàn bộ Màn hình Giao diện ({SCREEN_GROUPS.reduce((acc, g) => acc + g.items.length, 0)} màn hình)
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Bấm vào bất kỳ đường dẫn nào bên dưới để mở trực tiếp màn hình đó và chỉnh sửa giao diện.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Đổi vai trò xem UI:</span>
              <select
                value={currentToken?.replace('mock-token-', '') ?? 'guest'}
                onChange={(e) => {
                  const val = e.target.value
                  switchDemoUser(val === 'guest' ? null : Number(val))
                }}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm"
              >
                {DEMO_USERS.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.label}
                  </option>
                ))}
                <option value="guest">Chưa đăng nhập (Guest)</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-8">
            {SCREEN_GROUPS.map((group) => (
              <div key={group.group}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">{group.group}</h2>
                <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                      <tr>
                        <th className="w-12 px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Màn hình</th>
                        <th className="px-3 py-2.5">URL</th>
                        <th className="hidden px-3 py-2.5 md:table-cell">File nguồn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {group.items.map((item) => (
                        <tr key={item.id} className="hover:bg-brand-50/40">
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{item.id}</td>
                          <td className="px-3 py-2.5">
                            <Link to={item.path} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">
                              {item.title}
                            </Link>
                            {item.note && <p className="text-xs text-gray-400">{item.note}</p>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">
                            <Link to={item.path} className="text-brand-700 hover:underline">
                              {origin}{item.path}
                            </Link>
                          </td>
                          <td className="hidden px-3 py-2.5 font-mono text-xs text-gray-500 md:table-cell">
                            {item.file}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DevScreenFloatingWidget() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const currentToken = tokenStorage.getAccessToken()

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans print:hidden">
      {open ? (
        <div className="w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-900 px-3.5 py-2.5 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">🎨 Chuyển nhanh Màn hình (UI Dev)</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/screens"
                onClick={() => setOpen(false)}
                className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/25"
              >
                Xem bảng đầy đủ
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white text-sm leading-none px-1"
                title="Thu gọn"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="border-b border-gray-100 bg-gray-50 px-3.5 py-2">
            <label className="block text-[11px] font-medium text-gray-500">Tài khoản thử nghiệm (Mock Role):</label>
            <select
              value={currentToken?.replace('mock-token-', '') ?? 'guest'}
              onChange={(e) => {
                const val = e.target.value
                switchDemoUser(val === 'guest' ? null : Number(val))
              }}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
            >
              {DEMO_USERS.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.label}
                </option>
              ))}
              <option value="guest">Chưa đăng nhập (Guest)</option>
            </select>
          </div>

          <div className="max-h-80 overflow-y-auto p-2 space-y-3">
            {SCREEN_GROUPS.map((group) => (
              <div key={group.group}>
                <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{group.group}</p>
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const active = location.pathname + location.search === item.path || location.pathname === item.path
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                          active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">
                          <span className="mr-1.5 font-mono text-[10px] text-gray-400">{item.id}.</span>
                          {item.title}
                        </span>
                        <span className="ml-2 shrink-0 font-mono text-[10px] text-gray-400">{item.path}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/10 transition hover:bg-gray-800"
          title="Mở danh sách toàn bộ màn hình"
        >
          <span>🎨</span>
          <span>Màn hình (36)</span>
        </button>
      )}
    </div>
  )
}
