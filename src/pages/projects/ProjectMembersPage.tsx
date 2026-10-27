import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { Card, ErrorState, ForbiddenState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { SelectField } from '@/components/ui/SelectField'
import { Switch } from '@/components/ui/Switch'
import { PlusIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDate } from '@/lib/format'
import { PERMISSIONS, type RoleDto } from '@/types/rbac'
import type { ProjectMemberCandidateDto, ProjectMemberDto } from '@/types/project'
import { useProjectContext } from './ProjectLayout'

// Tab Thành viên dự án — UC-41~43 (§II.5.4–5.6), Screen #18 "Project Members & Roles". Chỉ thêm được người đã là
// thành viên workspace (UC §II.5.5); role dự án quyết định ai được kéo issue qua từng luật chuyển (GB-04).
export function ProjectMembersPage() {
  const { project, can, isArchived, reload: reloadProject } = useProjectContext()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [savingUserId, setSavingUserId] = useState<number | null>(null)
  const [removing, setRemoving] = useState<ProjectMemberDto | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const canManage = can(PERMISSIONS.projectMemberManage) && !isArchived
  const addOpen = searchParams.get('add') === '1' && canManage

  const members = useAsync(() => projectApi.listMembers(project.projectId), [project.projectId])
  const roles = useAsync<RoleDto[]>(
    () =>
      canManage && project.companyId !== null
        ? roleApi.list(project.companyId, { scope: 'PROJECT', includeInactive: false })
        : Promise.resolve([]),
    [canManage, project.companyId],
  )

  if (!can(PERMISSIONS.projectView)) return <ForbiddenState />

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

  const changeRole = async (member: ProjectMemberDto, roleId: number) => {
    setNotice(null)
    setSavingUserId(member.userId)
    try {
      const updated = await projectApi.changeMemberRole(project.projectId, member.userId, roleId)
      members.setData((prev) => prev?.map((m) => (m.userId === updated.userId ? updated : m)))
      setNotice({ tone: 'success', text: `Đã đổi role dự án của ${member.fullName} thành ${updated.role.name}.` })
      if (member.userId === user?.id) await reloadProject()
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
      await projectApi.removeMember(project.projectId, removing.userId)
      const isSelf = removing.userId === user?.id
      setRemoving(null)
      if (isSelf) {
        navigate(`/workspaces/${project.workspaceId}/projects`)
        return
      }
      setNotice({ tone: 'success', text: `Đã gỡ ${removing.fullName} khỏi dự án.` })
      await Promise.all([members.reload(), reloadProject()])
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
            <PlusIcon className="h-4 w-4" /> Thêm thành viên vào dự án
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
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="px-4 py-3 font-medium">Thành viên</th>
                  <th className="px-4 py-3 font-medium">Role tại dự án</th>
                  <th className="px-4 py-3 font-medium">Kế thừa workspace</th>
                  <th className="px-4 py-3 font-medium">Tham gia</th>
                  <th className="px-4 py-3 text-right font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((m) => {
                  const isSelf = m.userId === user?.id
                  return (
                    <tr key={m.userId}>
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
                            aria-label={`Role dự án của ${m.fullName}`}
                            value={m.role.roleId}
                            disabled={savingUserId === m.userId}
                            onChange={(e) => void changeRole(m, Number(e.target.value))}
                            className="min-w-[11rem]"
                          >
                            {!roles.data.some((r) => r.roleId === m.role.roleId) && <option value={m.role.roleId}>{m.role.name}</option>}
                            {roles.data.map((r) => (
                              <option key={r.roleId} value={r.roleId}>
                                {r.name}
                              </option>
                            ))}
                          </SelectField>
                        ) : (
                          <Badge tone={m.role.code === 'PROJECT_MANAGER' ? 'brand' : 'neutral'}>{m.role.name}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'rounded-sm px-1.5 py-0.5 text-[11px]',
                            m.workspaceRole.code === 'WORKSPACE_ADMIN' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500',
                          )}
                        >
                          {m.workspaceRole.code === 'WORKSPACE_ADMIN' ? `Kế thừa: ${m.workspaceRole.name}` : m.workspaceRole.name}
                        </span>
                      </td>
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
                      {keyword ? 'Không có thành viên phù hợp.' : 'Dự án chưa có thành viên.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Role dự án chỉ áp dụng trong dự án này. Workspace Admin / Tenant Admin có toàn quyền quản trị dự án, nhưng việc kéo issue
          giữa các trạng thái vẫn theo luật chuyển ở tab Workflow.
        </p>
      </div>

      {canManage && (
        <AddProjectMembersModal
          open={addOpen}
          projectId={project.projectId}
          roles={roles.data ?? []}
          onClose={() => setAddOpen(false)}
          onAdded={async (count) => {
            setAddOpen(false)
            setNotice({ tone: 'success', text: `Đã thêm ${count} thành viên vào dự án.` })
            await Promise.all([members.reload(), reloadProject()])
          }}
        />
      )}

      <Modal
        open={removing !== null}
        tone="danger"
        onClose={() => setRemoving(null)}
        title="Vô hiệu hóa thành viên trong dự án?"
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setRemoving(null)}>
              Huỷ
            </Button>
            <Button inline isLoading={isRemoving} onClick={() => void confirmRemove()} className="!bg-red-600 !shadow-none hover:!bg-red-700">
              'Xác nhận vô hiệu hóa'
            </Button>
          </>
        }
      >
        {removing && (
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{removing.fullName}</span> ({removing.role.name}) sẽ mất quyền truy cập dự án{' '}
            <span className="font-semibold text-gray-900">{project.name}</span>. Thành viên sẽ được cập nhật trạng thái vô hiệu hóa (is_active = false). Lịch sử hoạt động, task và bình luận được bảo lưu nguyên vẹn.
          </p>
        )}
      </Modal>
    </div>
  )
}

function AddProjectMembersModal({
  open,
  projectId,
  roles,
  onClose,
  onAdded,
}: {
  open: boolean
  projectId: number
  roles: RoleDto[]
  onClose: () => void
  onAdded: (count: number) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<ProjectMemberCandidateDto[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [roleId, setRoleId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelected(new Set())
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    const timer = setTimeout(() => {
      projectApi
        .listMemberCandidates(projectId, search.trim() || undefined)
        .then((items) => !cancelled && setCandidates(items))
        .catch((err) => !cancelled && setError(apiErrorMessage(err)))
        .finally(() => !cancelled && setIsLoading(false))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, search, projectId])

  useEffect(() => {
    if (open && roleId === '' && roles.length > 0) {
      setRoleId(roles.find((r) => r.code === 'DEVELOPER')?.roleId ?? roles[0].roleId)
    }
  }, [open, roles, roleId])

  const submit = async () => {
    if (roleId === '') return
    setIsSubmitting(true)
    setError(null)
    try {
      await projectApi.addMembers(projectId, [...selected].map((userId) => ({ userId, roleId })))
      await onAdded(selected.size)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm thành viên vào dự án"
      description="Chọn trong thành viên của workspace (UC §II.5.5) và gán role dự án."
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            Huỷ
          </Button>
          <Button inline disabled={selected.size === 0 || roleId === ''} isLoading={isSubmitting} onClick={() => void submit()}>
            Thêm {selected.size > 0 ? `${selected.size} người` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <label className="relative block">
          <span className="sr-only">Tìm thành viên workspace</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </label>
        <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
          {isLoading && candidates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">Đang tải…</p>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              {search ? 'Không tìm thấy.' : 'Mọi thành viên workspace đều đã ở trong dự án.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {candidates.map((c) => {
                const checked = selected.has(c.userId)
                return (
                  <li key={c.userId}>
                    <label className={clsx('flex cursor-pointer items-center gap-3 px-3 py-2.5', checked ? 'bg-brand-50/60' : 'hover:bg-gray-50')}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(c.userId)) next.delete(c.userId)
                            else next.add(c.userId)
                            return next
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                      />
                      <Avatar name={c.fullName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{c.fullName}</span>
                        <span className="block truncate text-xs text-gray-500">{c.email}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">{c.workspaceRole.name}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <SelectField label="Role dự án *" hint="Áp dụng cho tất cả người được chọn" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
          {roles.map((r) => (
            <option key={r.roleId} value={r.roleId}>
              {r.name}
            </option>
          ))}
        </SelectField>
      </div>
    </Modal>
  )
}
