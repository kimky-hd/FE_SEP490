import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorState, ForbiddenState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { SelectField } from '@/components/ui/SelectField'
import { useRoleChangeGuard } from '@/lib/useRoleChangeGuard'
import { PlusIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { workspaceApi } from '@/api/workspaceApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDate } from '@/lib/format'
import { PERMISSIONS, type RoleDto, type WorkspaceMemberDto } from '@/types/rbac'
import { useWorkspaceContext } from './WorkspaceLayout'
import { AddMembersModal } from './AddMembersModal'
import { SectionBar } from '@/components/layout/tabParts'
import { useI18n } from '@/i18n'
import { SearchInput, tableWrap, th, theadRow } from '@/components/ui/listControls'

// Tab Thành viên (FR §III.4.5, UC-25~27, wireframe "Thành viên Workspace"). Role ở đây chỉ áp dụng cho
// workspace này — cùng 1 người có thể mang role khác ở workspace khác (WorkspaceMembers.role_id).
export function WorkspaceMembersPage() {
  const { workspace, can, isArchived, isPersonal, reload: reloadWorkspace } = useWorkspaceContext()
  const { user, refreshMe } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [savingUserId, setSavingUserId] = useState<number | null>(null)
  const [removing, setRemoving] = useState<WorkspaceMemberDto | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const workspaceId = workspace.workspaceId
  const canManage = can(PERMISSIONS.workspaceMemberManage) && !isArchived
  const addOpen = searchParams.get('add') === '1' && canManage

  const members = useAsync(() => workspaceApi.listMembers(workspaceId), [workspaceId])
  const roles = useAsync<RoleDto[]>(
    () =>
      canManage && workspace.companyId !== null
        ? roleApi.list(workspace.companyId, { scope: 'WORKSPACE', includeInactive: false })
        : Promise.resolve([]),
    [canManage, workspace.companyId],
  )

  // Gọi trước mọi return sớm (luật hooks); `apply` bọc lại vì changeRole khai báo phía dưới.
  const roleGuard = useRoleChangeGuard<WorkspaceMemberDto>({
    selfId: user?.id,
    scopeLabel: t('workspace này', 'this workspace'),
    apply: (m, roleId) => changeRole(m, roleId),
  })

  if (isPersonal) return <Navigate to={`/workspaces/${workspaceId}`} replace />
  if (!can(PERMISSIONS.workspaceMemberView)) return <ForbiddenState />

  const keyword = search.trim().toLowerCase()
  const visible = (members.data ?? []).filter(
    (m) => !keyword || m.fullName.toLowerCase().includes(keyword) || m.email.toLowerCase().includes(keyword),
  )

  const setAddOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams)
    if (open) next.set('add', '1')
    else next.delete('add')
    setSearchParams(next, { replace: true })
  }

  // Đổi role / gỡ chính mình làm quyền của mình thay đổi → nạp lại /auth/me + workspace.
  const afterSelfChange = async (memberUserId: number) => {
    if (memberUserId === user?.id) await Promise.all([refreshMe(), reloadWorkspace()])
  }

  const changeRole = async (member: WorkspaceMemberDto, roleId: number): Promise<boolean> => {
    setNotice(null)
    setSavingUserId(member.userId)
    try {
      const updated = await workspaceApi.changeMemberRole(workspaceId, member.userId, roleId)
      members.setData((prev) => prev?.map((m) => (m.userId === updated.userId ? updated : m)))
      setNotice({
        tone: 'success',
        text: t(
          `Đã đổi role của ${member.fullName} thành ${updated.role.name}.`,
          `Changed ${member.fullName}’s role to ${updated.role.name}.`,
        ),
      })
      await afterSelfChange(member.userId)
      return true
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
      return false
    } finally {
      setSavingUserId(null)
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    setIsRemoving(true)
    try {
      await workspaceApi.removeMember(workspaceId, removing.userId)
      const isSelf = removing.userId === user?.id
      setRemoving(null)
      if (isSelf) {
        await refreshMe()
        navigate('/workspaces')
        return
      }
      setNotice({
        tone: 'success',
        text: t(`Đã gỡ ${removing.fullName} khỏi workspace.`, `Removed ${removing.fullName} from the workspace.`),
      })
      await Promise.all([members.reload(), reloadWorkspace()])
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
      setRemoving(null)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div>
      <SectionBar
        title={t('Thành viên', 'Members')}
        caption={members.data ? String(members.data.length) : undefined}
        actions={
          <>
            <SearchInput
              className="w-full sm:w-64"
              value={search}
              onChange={setSearch}
              label={t('Tìm thành viên', 'Search members')}
              placeholder={t('Tìm theo tên hoặc email…', 'Search by name or email…')}
            />
            {canManage && (
              <Button inline onClick={() => setAddOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                {t('Thêm thành viên', 'Add members')}
              </Button>
            )}
          </>
        }
      />

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
      {roleGuard.undoBar}

      <div className="mt-4">
        {members.isLoading && !members.data ? (
          <LoadingBlock />
        ) : members.error ? (
          <ErrorState message={apiErrorMessage(members.error)} onRetry={members.reload} />
        ) : (
          <div className={tableWrap}>
            <table className="w-full text-sm">
              <thead className="hidden sm:table-header-group">
                <tr className={theadRow}>
                  <th className={th}>{t('Thành viên', 'Member')}</th>
                  <th className={th}>{t('Role trong workspace', 'Workspace role')}</th>
                  <th className={`${th} hidden lg:table-cell`}>{t('Role công ty', 'Company role')}</th>
                  <th className={`${th} hidden md:table-cell`}>{t('Tham gia', 'Joined')}</th>
                  <th className={`${th} text-right`}>
                    <span className="sr-only">{t('Thao tác', 'Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visible.map((m) => {
                  const isSelf = m.userId === user?.id
                  return (
                    <tr
                      key={m.userId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 align-middle transition-colors hover:bg-gray-50 sm:table-row sm:p-0"
                    >
                      <td className="block w-full p-0 sm:table-cell sm:w-auto sm:px-4 sm:py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.fullName} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-950">
                              {m.fullName}
                              {isSelf && (
                                <span className="ml-1.5 text-xs font-normal text-gray-500">{t('(bạn)', '(you)')}</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-gray-500">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="block p-0 sm:table-cell sm:px-4 sm:py-3">
                        {canManage && roles.data && roles.data.length > 0 ? (
                          <SelectField
                            compact
                            aria-label={t(`Role của ${m.fullName}`, `Role of ${m.fullName}`)}
                            value={roleGuard.valueFor(m)}
                            disabled={savingUserId === m.userId}
                            onChange={(e) =>
                              roleGuard.request(m, Number(e.target.value), e.target.selectedOptions[0]?.text ?? '')
                            }
                            className="min-w-[11rem]"
                          >
                            {/* Role hiện tại có thể đã bị tắt → vẫn giữ trong danh sách để select không trống. */}
                            {!roles.data.some((r) => r.roleId === m.role.roleId) && (
                              <option value={m.role.roleId}>{m.role.name}</option>
                            )}
                            {roles.data.map((r) => (
                              <option key={r.roleId} value={r.roleId}>
                                {r.name}
                              </option>
                            ))}
                          </SelectField>
                        ) : (
                          <Badge tone={m.role.code === 'WORKSPACE_ADMIN' ? 'blue' : 'neutral'}>{m.role.name}</Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{m.companyRole.name}</td>
                      <td className="hidden px-4 py-3 text-gray-600 md:table-cell">{formatDate(m.joinedAt)}</td>
                      <td className="ml-auto block p-0 text-right sm:table-cell sm:px-4 sm:py-3">
                        {(canManage || (isSelf && !isArchived)) && (
                          <Button
                            variant="ghost"
                            inline
                            className="!px-2.5 text-red-700 hover:!bg-red-50 hover:!text-red-800"
                            aria-label={
                              isSelf
                                ? t('Rời workspace', 'Leave workspace')
                                : t(`Gỡ ${m.fullName} khỏi workspace`, `Remove ${m.fullName} from workspace`)
                            }
                            onClick={() => setRemoving(m)}
                          >
                            {isSelf ? t('Rời workspace', 'Leave workspace') : t('Gỡ', 'Remove')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      {keyword
                        ? t('Không có thành viên phù hợp.', 'No matching members.')
                        : t('Workspace chưa có thành viên.', 'This workspace has no members yet.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {canManage && (
          <p className="mt-3 text-xs text-gray-500">
            {t(
              'Role ở đây chỉ áp dụng cho workspace này. Role công ty được quản lý ở mục Người dùng.',
              'Roles here apply only to this workspace. Company roles are managed under Users.',
            )}
          </p>
        )}
      </div>

      {canManage && workspace.companyId !== null && (
        <AddMembersModal
          open={addOpen}
          workspaceId={workspaceId}
          roles={roles.data ?? []}
          onClose={() => setAddOpen(false)}
          onAdded={async (added) => {
            setAddOpen(false)
            setNotice({
              tone: 'success',
              text: t(
                `Đã thêm ${added.length} thành viên.`,
                `Added ${added.length} ${added.length === 1 ? 'member' : 'members'}.`,
              ),
            })
            await Promise.all([members.reload(), reloadWorkspace()])
          }}
        />
      )}

      <Modal
        open={removing !== null}
        tone="danger"
        onClose={() => setRemoving(null)}
        title={
          removing?.userId === user?.id
            ? t('Rời workspace này?', 'Leave this workspace?')
            : t('Gỡ thành viên khỏi workspace?', 'Remove member from workspace?')
        }
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setRemoving(null)}>
              {t('Huỷ', 'Cancel')}
            </Button>
            <Button
              inline
              isLoading={isRemoving}
              onClick={() => void confirmRemove()}
              className="!bg-red-700 hover:!bg-red-800"
            >
              {removing?.userId === user?.id
                ? t('Rời workspace', 'Leave workspace')
                : t('Gỡ khỏi workspace', 'Remove from workspace')}
            </Button>
          </>
        }
      >
        {removing && (
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-3 rounded-control border border-gray-200 bg-gray-50 px-3 py-2">
              <Avatar name={removing.fullName} size="sm" />
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{removing.fullName}</p>
                <p className="text-xs text-gray-500">
                  {removing.email} · {removing.role.name}
                </p>
              </div>
            </div>
            <p>
              {removing.userId === user?.id
                ? t('Bạn sẽ mất quyền truy cập workspace', 'You will lose access to the workspace')
                : t('Người này sẽ mất quyền truy cập workspace', 'This person will lose access to the workspace')}{' '}
              <span className="font-semibold text-gray-900">{workspace.name}</span>{' '}
              {t('và mọi dự án bên trong.', 'and every project in it.')}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                'Lịch sử công việc, bình luận và dữ liệu người này đã tạo vẫn được giữ nguyên. Có thể thêm lại vào workspace sau.',
                'Their work history, comments and data are kept. They can be added back to the workspace later.',
              )}
            </p>
          </div>
        )}
      </Modal>
      {roleGuard.confirm}
    </div>
  )
}
