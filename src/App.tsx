import { Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { GuestRoute } from '@/components/layout/GuestRoute'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { lazyPage } from '@/lib/lazyPage'
// Không lazy: màn đầu tiên của khách.
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const RegisterPage = lazyPage(() => import('@/pages/auth/RegisterPage'), 'RegisterPage')
const VerifyEmailPendingPage = lazyPage(() => import('@/pages/auth/VerifyEmailPendingPage'), 'VerifyEmailPendingPage')
const VerifyEmailPage = lazyPage(() => import('@/pages/auth/VerifyEmailPage'), 'VerifyEmailPage')
const ForgotPasswordPage = lazyPage(() => import('@/pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage')
const ForgotPasswordSentPage = lazyPage(() => import('@/pages/auth/ForgotPasswordSentPage'), 'ForgotPasswordSentPage')
const ResetPasswordPage = lazyPage(() => import('@/pages/auth/ResetPasswordPage'), 'ResetPasswordPage')
const OnboardingStartPage = lazyPage(() => import('@/pages/onboarding/OnboardingStartPage'), 'OnboardingStartPage')
const CompanySetupPage = lazyPage(() => import('@/pages/onboarding/CompanySetupPage'), 'CompanySetupPage')
const CreateWorkspacePage = lazyPage(() => import('@/pages/onboarding/CreateWorkspacePage'), 'CreateWorkspacePage')
const DomainMatchPage = lazyPage(() => import('@/pages/onboarding/DomainMatchPage'), 'DomainMatchPage')
const PendingApprovalPage = lazyPage(() => import('@/pages/onboarding/PendingApprovalPage'), 'PendingApprovalPage')
const DashboardHomePage = lazyPage(() => import('@/pages/dashboard/DashboardHomePage'), 'DashboardHomePage')
const InviteMemberPage = lazyPage(() => import('@/pages/dashboard/InviteMemberPage'), 'InviteMemberPage')
const WorkspaceListPage = lazyPage(() => import('@/pages/workspaces/WorkspaceListPage'), 'WorkspaceListPage')
const WorkspaceLayout = lazyPage(() => import('@/pages/workspaces/WorkspaceLayout'), 'WorkspaceLayout')
const WorkspaceOverviewPage = lazyPage(
  () => import('@/pages/workspaces/WorkspaceOverviewPage'),
  'WorkspaceOverviewPage',
)
const WorkspaceMembersPage = lazyPage(() => import('@/pages/workspaces/WorkspaceMembersPage'), 'WorkspaceMembersPage')
const WorkspaceSettingsPage = lazyPage(
  () => import('@/pages/workspaces/WorkspaceSettingsPage'),
  'WorkspaceSettingsPage',
)
const WorkspaceProjectsPage = lazyPage(
  () => import('@/pages/workspaces/WorkspaceProjectsPage'),
  'WorkspaceProjectsPage',
)
const CreateProjectWizardPage = lazyPage(
  () => import('@/pages/projects/wizard/CreateProjectWizardPage'),
  'CreateProjectWizardPage',
)
const ProjectsPage = lazyPage(() => import('@/pages/projects/ProjectsPage'), 'ProjectsPage')
const ProjectLayout = lazyPage(() => import('@/pages/projects/ProjectLayout'), 'ProjectLayout')
const ProjectOverviewPage = lazyPage(() => import('@/pages/projects/ProjectOverviewPage'), 'ProjectOverviewPage')
const ProjectMyWorkPage = lazyPage(() => import('@/pages/projects/ProjectMyWorkPage'), 'ProjectMyWorkPage')
const ProjectWorkflowPage = lazyPage(() => import('@/pages/projects/ProjectWorkflowPage'), 'ProjectWorkflowPage')
const ProjectMembersPage = lazyPage(() => import('@/pages/projects/ProjectMembersPage'), 'ProjectMembersPage')
const ProjectSettingsPage = lazyPage(() => import('@/pages/projects/ProjectSettingsPage'), 'ProjectSettingsPage')
const ProjectDocumentsPage = lazyPage(() => import('@/pages/documents/ProjectDocumentsPage'), 'ProjectDocumentsPage')
const KanbanPage = lazyPage(() => import('@/pages/kanban/KanbanPage'), 'KanbanPage')
const IssuePage = lazyPage(() => import('@/pages/kanban/IssuePage'), 'IssuePage')
const TestsPage = lazyPage(() => import('@/pages/tests/TestsPage'), 'TestsPage')
const TestSetupPage = lazyPage(() => import('@/pages/tests/TestSetupPage'), 'TestSetupPage')
const RoleListPage = lazyPage(() => import('@/pages/admin/RoleListPage'), 'RoleListPage')
const RoleEditorPage = lazyPage(() => import('@/pages/admin/RoleEditorPage'), 'RoleEditorPage')
const CompanyUsersPage = lazyPage(() => import('@/pages/admin/CompanyUsersPage'), 'CompanyUsersPage')

function RootRoute() {
  const { isAuthenticated, isBootstrapping, hasOnboarded } = useAuth()
  if (isBootstrapping) return <FullPageSpinner />
  // Chưa thuộc công ty nào (tài khoản mới, hoặc tài khoản cá nhân cũ) thì đi onboarding trước.
  if (isAuthenticated && !hasOnboarded) return <Navigate to="/onboarding/start" replace />
  return isAuthenticated ? (
    <ProtectedRoute>
      <DashboardHomePage />
    </ProtectedRoute>
  ) : (
    <LandingPage />
  )
}

/** Mở dự án (/projects/:id) là vào "Việc của tôi"; giữ state (vd `created` sau khi tạo dự án). */
function ProjectIndexRedirect() {
  const location = useLocation()
  return <Navigate to="my-work" replace state={location.state} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />

      <Route
        path="/register"
        element={
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        }
      />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/verify-email/pending" element={<VerifyEmailPendingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/forgot-password/sent" element={<ForgotPasswordSentPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding/start" element={<OnboardingStartPage />} />
        {/* Đã bỏ bước chọn Cá nhân / Doanh nghiệp; giữ đường cũ cho link đã lưu. */}
        <Route path="/onboarding/account-type" element={<Navigate to="/onboarding/start" replace />} />
        <Route path="/onboarding/company-setup" element={<CompanySetupPage />} />
        <Route path="/onboarding/domain-match" element={<DomainMatchPage />} />
        <Route path="/onboarding/pending-approval" element={<PendingApprovalPage />} />
        <Route path="/onboarding/create-workspace" element={<CreateWorkspacePage />} />
        <Route path="/members/invite" element={<InviteMemberPage />} />

        {/* Workspace — doc/Workspace-RBAC-API-Contract.md §4, §5 */}
        <Route path="/workspaces" element={<WorkspaceListPage />} />
        <Route path="/workspaces/:workspaceId" element={<WorkspaceLayout />}>
          <Route index element={<WorkspaceOverviewPage />} />
          <Route path="projects" element={<WorkspaceProjectsPage />} />
          <Route path="members" element={<WorkspaceMembersPage />} />
          <Route path="settings" element={<WorkspaceSettingsPage />} />
        </Route>

        {/* Dự án & Workflow — §9–§12 */}
        <Route path="/workspaces/:workspaceId/projects/new" element={<CreateProjectWizardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectIndexRedirect />} />
          <Route path="my-work" element={<ProjectMyWorkPage />} />
          <Route path="overview" element={<ProjectOverviewPage />} />
          {/* Tài liệu — doc/Documents-API-Contract.md */}
          <Route path="documents" element={<ProjectDocumentsPage />} />
          <Route path="documents/:documentId" element={<ProjectDocumentsPage />} />
          {/* Kanban & Test cases — doc/Issues-Testcases-API-Contract.md */}
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="kanban/backlog" element={<KanbanPage />} />
          <Route path="kanban/issues/:issueKey" element={<IssuePage />} />
          <Route path="tests" element={<TestsPage />} />
          <Route path="tests/setup" element={<TestSetupPage />} />
          {/* Đợt chạy (v1) đã bỏ: link cũ về bảng testcase. */}
          <Route path="tests/cycles/*" element={<Navigate to="../tests?tab=sheet" replace />} />
          <Route path="testcases" element={<Navigate to="../tests" replace />} />
          <Route path="workflow" element={<ProjectWorkflowPage />} />
          <Route path="members" element={<ProjectMembersPage />} />
          <Route path="settings" element={<ProjectSettingsPage />} />
        </Route>

        {/* Quản trị công ty — §2, §3, §6 */}
        <Route path="/admin/roles" element={<RoleListPage />} />
        <Route path="/admin/roles/new" element={<RoleEditorPage />} />
        <Route path="/admin/roles/:roleId" element={<RoleEditorPage />} />
        <Route path="/admin/users" element={<CompanyUsersPage />} />
      </Route>

      {/* Mục "Tài liệu" trên sidebar đã bỏ: tài liệu chỉ nằm trong tab Tài liệu của từng dự án. */}
      <Route path="/documents" element={<Navigate to="/" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

export function App() {
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        {/* Giữ trang cũ trong lúc tải chunk trang mới, thay vì nháy về spinner toàn màn hình. */}
        <BrowserRouter future={{ v7_startTransition: true }}>
          <AuthProvider>
            <RouteErrorBoundary>
              <Suspense fallback={<FullPageSpinner />}>
                <AppRoutes />
              </Suspense>
            </RouteErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  )
}
