import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ShieldIcon } from '@/components/ui/icons'
import { workspaceApi } from '@/api/workspaceApi'
import { useI18n } from '@/i18n'
import type { WorkspaceDto, WorkspaceMemberDto } from '@/types/rbac'

// Figma hàng 2 frame 01 "Dashboard & Kiểm tra quyền tạo Dự án": ERROR 403 · AUTHORIZATION GATE —
// "Access Denied: Bạn không có quyền khởi tạo dự án", nút Đóng (Dismiss) + Liên hệ Admin (Request Permission).
export function AccessDeniedModal({
  open,
  onClose,
  workspace,
  email,
}: {
  open: boolean
  onClose: () => void
  workspace: WorkspaceDto
  email: string
}) {
  const { t } = useI18n()
  const [admins, setAdmins] = useState<WorkspaceMemberDto[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const showAdmins = async () => {
    setLoadError(false)
    try {
      const members = await workspaceApi.listMembers(workspace.workspaceId)
      setAdmins(members.filter((m) => m.role.code === 'WORKSPACE_ADMIN'))
    } catch {
      setLoadError(true)
    }
  }

  return (
    <Modal
      open={open}
      tone="danger"
      onClose={() => {
        setAdmins(null)
        onClose()
      }}
      title={t('Bạn chưa có quyền tạo dự án', "You can't create projects yet")}
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            {t('Đóng', 'Close')}
          </Button>
          <Button inline onClick={() => void showAdmins()}>
            <ShieldIcon className="h-4 w-4" /> {t('Xem ai cấp được quyền', 'See who can grant access')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-600">
        <p>
          {t('Bạn cần vai trò ', 'You need the ')}
          <span className="font-semibold text-gray-950">Project Initiator</span>
          {t(
            ' (hoặc role có quyền tạo dự án) trong workspace ',
            ' role (or a role that can create projects) in workspace ',
          )}
          <span className="font-semibold text-gray-900">“{workspace.name}”</span>
          {t(
            ' để tạo dự án mới. Vui lòng liên hệ quản trị viên để được cấp quyền.',
            ' to create a new project. Please contact an administrator to get access.',
          )}
        </p>
        {/* Tình trạng quyền nói bằng lời thường, không dùng mã kỹ thuật. */}
        <dl className="space-y-2 rounded-card border border-gray-200 bg-gray-50 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">{t('Tài khoản', 'Account')}</dt>
            <dd className="truncate text-gray-950">{email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">{t('Role hiện tại', 'Current role')}</dt>
            <dd className="text-gray-950">{workspace.myRole?.name ?? t('Chỉ xem', 'View only')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">{t('Quyền còn thiếu', 'Missing permission')}</dt>
            <dd className="text-gray-950">{t('Tạo dự án', 'Create projects')}</dd>
          </div>
        </dl>
        {loadError && (
          <p className="text-sm text-red-700">
            {t('Không tải được danh sách quản trị viên.', "Couldn't load the list of administrators.")}
          </p>
        )}
        {admins && (
          <div className="rounded-card border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-900">
              {t('Workspace Admin có thể cấp quyền cho bạn:', 'Workspace Admins who can grant you access:')}
            </p>
            {admins.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">
                {t(
                  'Workspace chưa có admin — liên hệ Tenant Admin của công ty.',
                  "The workspace has no admin — contact your company's Tenant Admin.",
                )}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {admins.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-800">{a.fullName}</span>
                    <a
                      className="font-medium text-brand-700 hover:underline"
                      href={`mailto:${a.email}?subject=${encodeURIComponent(t(`[SSAM] Xin quyền tạo dự án trong ${workspace.name}`, `[SSAM] Request to create projects in ${workspace.name}`))}`}
                    >
                      {a.email}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
