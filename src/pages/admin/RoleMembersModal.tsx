import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { useI18n } from '@/i18n'
import type { RoleDto, RoleMemberDto } from '@/types/rbac'

// Danh sách người đang giữ role (link "N người" ở Figma C) — UC §II.4.7 nhánh "click vào 1 role".
export function RoleMembersModal({
  companyId,
  role,
  onClose,
}: {
  companyId: number
  role: RoleDto | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const members = useAsync<RoleMemberDto[]>(
    () => (role ? roleApi.listMembers(companyId, role.roleId) : Promise.resolve([])),
    [companyId, role?.roleId],
  )

  return (
    <Modal
      open={role !== null}
      onClose={onClose}
      title={role ? t(`Người giữ role “${role.name}”`, `People with role “${role.name}”`) : ''}
      description={
        role?.scope === 'WORKSPACE'
          ? t(
              'Role cấp workspace — mỗi dòng là 1 lần gán trong 1 workspace.',
              'Workspace-level role — each row is one assignment in one workspace.',
            )
          : role?.scope === 'PROJECT'
            ? t(
                'Role cấp dự án — mỗi dòng là 1 lần gán trong 1 dự án.',
                'Project-level role — each row is one assignment in one project.',
              )
            : undefined
      }
    >
      {members.isLoading ? (
        <p className="py-6 text-center text-sm text-gray-500">{t('Đang tải…', 'Loading…')}</p>
      ) : members.error ? (
        <p className="py-6 text-center text-sm text-red-700">{apiErrorMessage(members.error)}</p>
      ) : (members.data ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          {t('Chưa có ai giữ role này.', 'No one has this role yet.')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {members.data!.map((m) => (
            <li
              key={`${m.userId}-${m.workspace?.workspaceId ?? 0}-${m.project?.projectId ?? 0}`}
              className="flex items-center gap-3 py-2.5"
            >
              <Avatar name={m.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{m.fullName}</p>
                <p className="truncate text-xs text-gray-500">{m.email}</p>
              </div>
              {m.project ? (
                <Link
                  to={`/projects/${m.project.projectId}/members`}
                  onClick={onClose}
                  className="shrink-0 truncate text-xs font-medium text-brand-700 hover:underline"
                >
                  {m.project.key} · {m.project.name}
                </Link>
              ) : (
                m.workspace && (
                  <Link
                    to={`/workspaces/${m.workspace.workspaceId}/members`}
                    onClick={onClose}
                    className="shrink-0 truncate text-xs font-medium text-brand-700 hover:underline"
                  >
                    {m.workspace.name}
                  </Link>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
