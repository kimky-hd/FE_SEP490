import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/layout/PageParts'
import { ErrorState, ForbiddenState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { SelectField } from '@/components/ui/SelectField'
import { Switch } from '@/components/ui/Switch'
import { PlusIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { workspaceApi } from '@/api/workspaceApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDate } from '@/lib/format'
import { PERMISSIONS, type RoleDto, type WorkspaceMemberDto } from '@/types/rbac'
import { useWorkspaceContext } from './WorkspaceLayout'
import { AddMembersModal } from './AddMembersModal'

// Tab Thành viên (FR §III.4.5, UC-25~27, wireframe "Thành viên Workspace"). Role ở đây chỉ áp dụng cho
// workspace này — cùng 1 người có thể mang role khác ở workspace khác (WorkspaceMembers.role_id).
export function WorkspaceMembersPage() {
  const { workspace, can, isArchived, isPersonal, reload: reloadWorkspace } = useWorkspaceContext()
  const { user, refreshMe } = useAuth()
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

  const changeRole = async (member: WorkspaceMemberDto, roleId: number) => {
    setNotice(null)
    setSavingUserId(member.userId)
    try {
      const updated = await workspaceApi.changeMemberRole(workspaceId, member.userId, roleId)
      members.setData((prev) => prev?.map((m) => (m.userId === updated.userId ? updated : m)))
      setNotice({ tone: 'success', text: `Đã đổi role của ${member.fullName} thành ${updated.role.name}.` })
      await afterSelfChange(member.userId)
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
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
      setNotice({ tone: 'success', text: `Đã vô hiệu hóa thành viên ${removing.fullName} trong workspace.` })
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-72">
          <span className="sr-only">Tìm thành viên</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </label>
        {canManage && (
          <Button inline onClick={() => setAddOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Thêm thành viên
          </Button>
        )}
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-4">
        {members.isLoading && !members.data ? (
          <LoadingBlock />
        ) : members.error ? (
          <ErrorState message={apiErrorMessage(members.error)} onRetry={members.reload} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="px-4 py-3 font-medium">Thành viên</th>
                  <th className="px-4 py-3 font-medium">Role (workspace này)</th>
                  <th className="px-4 py-3 font-medium">Role công ty</th>
                  <th className="px-4 py-3 font-medium">Tham gia</th>
                  <th className="px-4 py-3 text-right font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((m) => {
                  const isSelf = m.userId === user?.id
                  return (
                    <tr key={m.userId} className="align-middle">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.fullName} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {m.fullName}
                              {isSelf && <span className="ml-1.5 text-xs font-normal text-gray-400">(bạn)</span>}
                            </p>
                            <p className="truncate text-xs text-gray-500">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {canManage && roles.data && roles.data.length > 0 ? (
                          <SelectField
                            compact
                            aria-label={`Role của ${m.fullName}`}
                            value={m.role.roleId}
                            disabled={savingUserId === m.userId}
                            onChange={(e) => void changeRole(m, Number(e.target.value))}
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
                          <Badge tone={m.role.code === 'WORKSPACE_ADMIN' ? 'brand' : 'neutral'}>{m.role.name}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{m.companyRole.name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(m.joinedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <span className="text-xs font-medium text-emerald-700">Đang hoạt động</span>
                          <Switch
                            size="sm"
                            checked={true}
                            disabled={!(canManage || (isSelf && !isArchived))}
                            onChange={() => setRemoving(m)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                      {keyword ? 'Không có thành viên phù hợp.' : 'Workspace chưa có thành viên.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Role ở đây chỉ áp dụng riêng cho workspace này — cùng một người có thể mang role khác ở workspace khác. Role
          cấp công ty do Tenant Admin quản lý ở mục Người dùng.
        </p>
      </div>

      {canManage && workspace.companyId !== null && (
        <AddMembersModal
          open={addOpen}
          workspaceId={workspaceId}
          roles={roles.data ?? []}
          onClose={() => setAddOpen(false)}
          onAdded={async (added) => {
            setAddOpen(false)
            setNotice({ tone: 'success', text: `Đã thêm ${added.length} thành viên.` })
            await Promise.all([members.reload(), reloadWorkspace()])
          }}
        />
      )}

      <Modal
        open={removing !== null}
        tone="danger"
        onClose={() => setRemoving(null)}
        title="Vô hiệu hóa thành viên trong workspace?"
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setRemoving(null)}>
              Huỷ
            </Button>
            <Button inline isLoading={isRemoving} onClick={() => void confirmRemove()} className="!bg-red-600 hover:!bg-red-700 !shadow-none">
              'Xác nhận vô hiệu hóa'
            </Button>
          </>
        }
      >
        {removing && (
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <Avatar name={removing.fullName} size="sm" />
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{removing.fullName}</p>
                <p className="text-xs text-gray-500">
                  {removing.email} · {removing.role.name}
                </p>
              </div>
            </div>
            <p>
              {removing.userId === user?.id ? 'Bạn' : 'Người này'} sẽ mất quyền truy cập workspace{' '}
              <span className="font-semibold text-gray-900">{workspace.name}</span> và mọi dự án bên trong.
            </p>
            <p className="text-xs text-gray-500">
              Thành viên sẽ được cập nhật trạng thái vô hiệu hóa (is_active = false). Lịch sử công việc, bình luận và dữ liệu đã tạo vẫn được bảo lưu nguyên vẹn trong hệ thống, có thể kích hoạt lại sau.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
