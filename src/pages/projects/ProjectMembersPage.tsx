import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ErrorState, ForbiddenState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { SelectField } from '@/components/ui/SelectField'
import { useRoleChangeGuard } from '@/lib/useRoleChangeGuard'
import { PlusIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDate } from '@/lib/format'
import { PERMISSIONS, type RoleDto } from '@/types/rbac'
import type { ProjectMemberCandidateDto, ProjectMemberDto } from '@/types/project'
import { useI18n } from '@/i18n'
import { useProjectContext } from './ProjectLayout'
import { SearchInput, tableWrap, th, theadRow } from '@/components/ui/listControls'
import { SectionBar, TabBody } from '@/components/layout/tabParts'

// Tab Thành viên dự án — UC-41~43 (§II.5.4–5.6), Screen #18 "Project Members & Roles". Chỉ thêm được người đã là
// thành viên workspace (UC §II.5.5); role dự án quyết định ai được kéo issue qua từng luật chuyển (GB-04).
export function ProjectMembersPage() {
  const { t } = useI18n()
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

  // Gọi trước return sớm (luật hooks); `apply` bọc lại vì changeRole khai báo phía dưới.
  const roleGuard = useRoleChangeGuard<ProjectMemberDto>({
    selfId: user?.id,
    scopeLabel: t('dự án này', 'this project'),
    apply: (m, roleId) => changeRole(m, roleId),
  })

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

  async function changeRole(member: ProjectMemberDto, roleId: number): Promise<boolean> {
    setNotice(null)
    setSavingUserId(member.userId)
    try {
      const updated = await projectApi.changeMemberRole(project.projectId, member.userId, roleId)
      members.setData((prev) => prev?.map((m) => (m.userId === updated.userId ? updated : m)))
      setNotice({
        tone: 'success',
        text: t(
          `Đã đổi role dự án của ${member.fullName} thành ${updated.role.name}.`,
          `Changed ${member.fullName}'s project role to ${updated.role.name}.`,
        ),
      })
      if (member.userId === user?.id) await reloadProject()
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
      await projectApi.removeMember(project.projectId, removing.userId)
      const isSelf = removing.userId === user?.id
      setRemoving(null)
      if (isSelf) {
        navigate(`/workspaces/${project.workspaceId}/projects`)
        return
      }
      setNotice({
        tone: 'success',
        text: t(`Đã gỡ ${removing.fullName} khỏi dự án.`, `Removed ${removing.fullName} from the project.`),
      })
      await Promise.all([members.reload(), reloadProject()])
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
      setRemoving(null)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <TabBody>
      <section className="space-y-3">
        <SectionBar
          title={t('Thành viên', 'Members')}
          caption={members.data ? String(members.data.length) : undefined}
          help={
            canManage
              ? t(
                  'Role dự án quyết định ai được chuyển issue qua từng bước ở tab Workflow, kể cả với Workspace Admin.',
                  'Project roles decide who can move issues through each step in the Workflow tab, Workspace Admins included.',
                )
              : undefined
          }
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
                  <PlusIcon className="h-4 w-4" /> {t('Thêm thành viên', 'Add members')}
                </Button>
              )}
            </>
          }
        />

        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {roleGuard.undoBar}

        <div>
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
                    <th className={th}>{t('Role tại dự án', 'Project role')}</th>
                    <th className={`${th} hidden lg:table-cell`}>{t('Role workspace', 'Workspace role')}</th>
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
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-gray-50 sm:table-row sm:p-0"
                      >
                        <td className="block w-full p-0 sm:table-cell sm:w-auto sm:px-4 sm:py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.fullName} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-950">
                                {m.fullName}
                                {isSelf && (
                                  <span className="ml-1.5 text-xs font-normal text-gray-500">
                                    {t('(bạn)', '(you)')}
                                  </span>
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
                              aria-label={t(`Role dự án của ${m.fullName}`, `Project role for ${m.fullName}`)}
                              value={roleGuard.valueFor(m)}
                              disabled={savingUserId === m.userId}
                              onChange={(e) =>
                                roleGuard.request(m, Number(e.target.value), e.target.selectedOptions[0]?.text ?? '')
                              }
                              className="min-w-[11rem]"
                            >
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
                            <Badge tone={m.role.code === 'PROJECT_MANAGER' ? 'blue' : 'neutral'}>{m.role.name}</Badge>
                          )}
                        </td>
                        {/* Workspace Admin kế thừa toàn quyền quản trị dự án: ghi rõ "kế thừa" để không nhầm với role dự án. */}
                        <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">
                          {m.workspaceRole.name}
                          {m.workspaceRole.code === 'WORKSPACE_ADMIN' && (
                            <span className="ml-1.5 text-xs text-gray-500">
                              {t('(kế thừa quyền quản trị)', '(inherits admin rights)')}
                            </span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-gray-600 md:table-cell">{formatDate(m.joinedAt)}</td>
                        <td className="ml-auto block p-0 text-right sm:table-cell sm:px-4 sm:py-3">
                          {(canManage || (isSelf && !isArchived)) && (
                            <Button
                              variant="ghost"
                              inline
                              className="!px-2.5 text-red-700 hover:!bg-red-50 hover:!text-red-800"
                              aria-label={
                                isSelf
                                  ? t('Rời dự án', 'Leave project')
                                  : t(`Gỡ ${m.fullName} khỏi dự án`, `Remove ${m.fullName} from project`)
                              }
                              onClick={() => setRemoving(m)}
                            >
                              {isSelf ? t('Rời dự án', 'Leave project') : t('Gỡ', 'Remove')}
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
                          : t('Dự án chưa có thành viên.', 'This project has no members yet.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {canManage && (
        <AddProjectMembersModal
          open={addOpen}
          projectId={project.projectId}
          roles={roles.data ?? []}
          onClose={() => setAddOpen(false)}
          onAdded={async (count) => {
            setAddOpen(false)
            setNotice({
              tone: 'success',
              text: t(
                `Đã thêm ${count} thành viên vào dự án.`,
                `Added ${count} ${count === 1 ? 'member' : 'members'} to the project.`,
              ),
            })
            await Promise.all([members.reload(), reloadProject()])
          }}
        />
      )}

      <Modal
        open={removing !== null}
        tone="danger"
        onClose={() => setRemoving(null)}
        title={
          removing?.userId === user?.id
            ? t('Rời dự án này?', 'Leave this project?')
            : t('Gỡ thành viên khỏi dự án?', 'Remove member from project?')
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
                ? t('Rời dự án', 'Leave project')
                : t('Gỡ khỏi dự án', 'Remove from project')}
            </Button>
          </>
        }
      >
        {removing && (
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-950">{removing.fullName}</span> ({removing.role.name})
            {t(' sẽ mất quyền truy cập dự án ', ' will lose access to project ')}
            <span className="font-semibold text-gray-950">{project.name}</span>
            {t(
              '. Lịch sử hoạt động, task và bình luận vẫn được giữ nguyên.',
              '. Their activity history, tasks and comments are kept.',
            )}
          </p>
        )}
      </Modal>
      {roleGuard.confirm}
    </TabBody>
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
  const { t } = useI18n()
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
      await projectApi.addMembers(
        projectId,
        [...selected].map((userId) => ({ userId, roleId })),
      )
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
      title={t('Thêm thành viên vào dự án', 'Add members to project')}
      description={t(
        'Chọn trong thành viên của workspace và gán role dự án.',
        'Pick from workspace members and assign a project role.',
      )}
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button
            inline
            disabled={selected.size === 0 || roleId === ''}
            isLoading={isSubmitting}
            onClick={() => void submit()}
          >
            {selected.size > 0
              ? t(`Thêm ${selected.size} người`, `Add ${selected.size} ${selected.size === 1 ? 'person' : 'people'}`)
              : t('Thêm', 'Add')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <label className="relative block">
          <span className="sr-only">{t('Tìm thành viên workspace', 'Search workspace members')}</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Tìm theo tên hoặc email…', 'Search by name or email…')}
            className="h-10 w-full rounded-control border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 shadow-xs placeholder:text-gray-500 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
        </label>
        <div className="max-h-64 overflow-y-auto rounded-control border border-gray-200">
          {isLoading && candidates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">{t('Đang tải…', 'Loading…')}</p>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              {search
                ? t('Không tìm thấy.', 'No results.')
                : t(
                    'Mọi thành viên workspace đều đã ở trong dự án.',
                    'All workspace members are already in the project.',
                  )}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {candidates.map((c) => {
                const checked = selected.has(c.userId)
                return (
                  <li key={c.userId}>
                    <label
                      className={clsx(
                        'flex cursor-pointer items-center gap-3 px-3 py-2.5',
                        checked ? 'bg-brand-50' : 'hover:bg-gray-50',
                      )}
                    >
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
                      <span className="shrink-0 text-xs text-gray-500">{c.workspaceRole.name}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <SelectField
          label={t('Role dự án *', 'Project role *')}
          hint={t('Áp dụng cho tất cả người được chọn', 'Applies to everyone selected')}
          value={roleId}
          onChange={(e) => setRoleId(Number(e.target.value))}
        >
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
