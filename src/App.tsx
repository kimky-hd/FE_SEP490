import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { GuestRoute } from '@/components/layout/GuestRoute'
import { DevScreenFloatingWidget, ScreenDirectoryPage } from '@/components/layout/DevScreenNavigator'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { LandingPage } from '@/pages/LandingPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { VerifyEmailPendingPage } from '@/pages/auth/VerifyEmailPendingPage'
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ForgotPasswordSentPage } from '@/pages/auth/ForgotPasswordSentPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { AcceptInvitePage } from '@/pages/invite/AcceptInvitePage'
import { ChooseAccountTypePage } from '@/pages/onboarding/ChooseAccountTypePage'
import { CompanySetupPage } from '@/pages/onboarding/CompanySetupPage'
import { CreateWorkspacePage } from '@/pages/onboarding/CreateWorkspacePage'
import { DomainMatchPage } from '@/pages/onboarding/DomainMatchPage'
import { PendingApprovalPage } from '@/pages/onboarding/PendingApprovalPage'
import { DashboardHomePage } from '@/pages/dashboard/DashboardHomePage'
import { InviteMemberPage } from '@/pages/dashboard/InviteMemberPage'
import { WorkspaceListPage } from '@/pages/workspaces/WorkspaceListPage'
import { WorkspaceLayout } from '@/pages/workspaces/WorkspaceLayout'
import { WorkspaceOverviewPage } from '@/pages/workspaces/WorkspaceOverviewPage'
import { WorkspaceMembersPage } from '@/pages/workspaces/WorkspaceMembersPage'
import { WorkspaceSettingsPage } from '@/pages/workspaces/WorkspaceSettingsPage'
import { WorkspaceProjectsPage } from '@/pages/workspaces/WorkspaceProjectsPage'
import { CreateProjectWizardPage } from '@/pages/projects/wizard/CreateProjectWizardPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectLayout } from '@/pages/projects/ProjectLayout'
import { ProjectOverviewPage } from '@/pages/projects/ProjectOverviewPage'
import { ProjectWorkflowPage } from '@/pages/projects/ProjectWorkflowPage'
import { ProjectMembersPage } from '@/pages/projects/ProjectMembersPage'
import { ProjectSettingsPage } from '@/pages/projects/ProjectSettingsPage'
import { ProjectIssuesPage } from '@/pages/projects/ProjectIssuesPage'
import { ConfluenceWorkspacePage } from '@/pages/projects/ConfluenceWorkspacePage'
import { RoleListPage } from '@/pages/admin/RoleListPage'
import { RoleEditorPage } from '@/pages/admin/RoleEditorPage'
import { CompanyUsersPage } from '@/pages/admin/CompanyUsersPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function RootRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  if (isBootstrapping) return <FullPageSpinner />
  return isAuthenticated ? (
    <ProtectedRoute>
      <DashboardHomePage />
    </ProtectedRoute>
  ) : (
    <LandingPage />
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/screens" element={<ScreenDirectoryPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardHomePage />
          </ProtectedRoute>
        }
      />

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
      <Route path="/invite" element={<AcceptInvitePage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />

      <Route
        path="/onboarding/account-type"
        element={
          <ProtectedRoute>
            <ChooseAccountTypePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/company-setup"
        element={
          <ProtectedRoute>
            <CompanySetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/domain-match"
        element={
          <ProtectedRoute>
            <DomainMatchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/pending-approval"
        element={
          <ProtectedRoute>
            <PendingApprovalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding/create-workspace"
        element={
          <ProtectedRoute>
            <CreateWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/members/invite"
        element={
          <ProtectedRoute>
            <InviteMemberPage />
          </ProtectedRoute>
        }
      />

      {/* Workspace — doc/Workspace-RBAC-API-Contract.md §4, §5 */}
      <Route
        path="/workspaces"
        element={
          <ProtectedRoute>
            <WorkspaceListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspaces/:workspaceId"
        element={
          <ProtectedRoute>
            <WorkspaceLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<WorkspaceOverviewPage />} />
        <Route path="projects" element={<WorkspaceProjectsPage />} />
        <Route path="members" element={<WorkspaceMembersPage />} />
        <Route path="settings" element={<WorkspaceSettingsPage />} />
      </Route>

      {/* Dự án & Workflow — §9–§12 */}
      <Route
        path="/workspaces/:workspaceId/projects/new"
        element={
          <ProtectedRoute>
            <CreateProjectWizardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />
      {/* Không gian làm việc Tài liệu Toàn màn hình Độc lập (Confluence Workspace 100vw x 100vh) */}
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <ConfluenceWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/documents"
        element={
          <ProtectedRoute>
            <ConfluenceWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/documents/:docId"
        element={
          <ProtectedRoute>
            <ConfluenceWorkspacePage />
          </ProtectedRoute>
        }
      />
      {/* Không gian làm việc Quản lý Công việc & Lỗi Toàn màn hình Độc lập (Jira Workspace 100vw x 100vh) */}
      <Route
        path="/projects/:projectId/issues"
        element={
          <ProtectedRoute>
            <ProjectIssuesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/kanban"
        element={
          <ProtectedRoute>
            <ProjectIssuesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProjectLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProjectOverviewPage />} />
        <Route path="workflow" element={<ProjectWorkflowPage />} />
        <Route path="members" element={<ProjectMembersPage />} />
        <Route path="settings" element={<ProjectSettingsPage />} />
      </Route>

      {/* Quản trị công ty — §2, §3, §6 */}
      <Route
        path="/admin/roles"
        element={
          <ProtectedRoute>
            <RoleListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roles/new"
        element={
          <ProtectedRoute>
            <RoleEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roles/:roleId"
        element={
          <ProtectedRoute>
            <RoleEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <CompanyUsersPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'mock-google-client-id'}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <DevScreenFloatingWidget />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  )
}
