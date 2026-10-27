import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ShieldIcon } from '@/components/ui/icons'
import { workspaceApi } from '@/api/workspaceApi'
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
      title="Access Denied: Bạn không có quyền khởi tạo dự án"
      description="ERROR 403 · AUTHORIZATION GATE"
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            Đóng (Dismiss)
          </Button>
          <Button inline onClick={() => void showAdmins()}>
            <ShieldIcon className="h-4 w-4" /> Liên hệ Admin (Request Permission)
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-600">
        <p>
          Bạn cần vai trò <span className="font-semibold text-brand-700">Project Initiator</span> (hoặc role có quyền tạo dự án) trong
          workspace <span className="font-semibold text-gray-900">“{workspace.name}”</span> để tạo dự án mới. Vui lòng liên hệ quản trị
          viên để được cấp quyền.
        </p>
        <dl className="space-y-1 rounded-md bg-gray-50 p-3 font-mono text-[11px]">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">REQUIRED_PERMISSION:</dt>
            <dd className="text-gray-800">project.create</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">CURRENT_IDENTITY:</dt>
            <dd className="truncate text-gray-800">{email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">RESOLVED_ROLE:</dt>
            <dd className="text-red-600">{(workspace.myRole?.name ?? 'Chỉ xem').toUpperCase()} (Lacks: PROJECT.CREATE)</dd>
          </div>
        </dl>
        {loadError && <p className="text-xs text-red-600">Không tải được danh sách quản trị viên.</p>}
        {admins && (
          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-700">Workspace Admin có thể cấp quyền cho bạn:</p>
            {admins.length === 0 ? (
              <p className="mt-1 text-xs text-gray-500">Workspace chưa có admin — liên hệ Tenant Admin của công ty.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {admins.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-800">{a.fullName}</span>
                    <a
                      className="font-medium text-brand-700 hover:underline"
                      href={`mailto:${a.email}?subject=${encodeURIComponent(`[SSAM] Xin quyền tạo dự án trong ${workspace.name}`)}`}
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
