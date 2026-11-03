import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/layout/PageParts'
import { CheckIcon, PlusIcon, SearchIcon, TrashIcon, AlertTriangleIcon } from '@/components/ui/icons'
import type { RoleDto, WorkspaceMemberDto } from '@/types/rbac'
import type { UserDto } from '@/types/auth'
import type { SdlcTemplateDto } from '@/types/project'
import { useI18n } from '@/i18n'
import { templateName } from '@/i18n/sdlc'
import type { WizardMember, WizardState } from './wizardState'

// Bước 3 — Figma hàng 2 frame 04 "Assign Team & Commit Project": thêm thành viên từ workspace (UC §II.5.5),
// danh sách thành viên + role dự án, cột tóm tắt "Kiểm tra trước khi tạo".

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  me: UserDto
  workspaceName: string
  workspaceMembers: WorkspaceMemberDto[]
  projectRoles: RoleDto[]
  template?: SdlcTemplateDto
  keyAvailable: boolean
  workflowValid: boolean
}

const controlClass =
  'h-11 w-full rounded-control border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs transition-shadow placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 lg:h-10'

export function StepMembers({
  state,
  update,
  me,
  workspaceName,
  workspaceMembers,
  projectRoles,
  template,
  keyAvailable,
  workflowValid,
}: Props) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [pickedUserId, setPickedUserId] = useState<number | ''>('')
  const defaultRoleId =
    projectRoles.find((r) => r.code === 'DEVELOPER')?.roleId ??
    projectRoles.find((r) => r.code !== 'PROJECT_MANAGER')?.roleId
  const [pickedRoleId, setPickedRoleId] = useState<number | ''>(defaultRoleId ?? '')
  const pmRole = projectRoles.find((r) => r.code === 'PROJECT_MANAGER')

  const memberOf = (userId: number) => workspaceMembers.find((m) => m.userId === userId)
  const candidates = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return workspaceMembers
      .filter((m) => m.userId !== me.id && !state.members.some((x) => x.userId === m.userId))
      .filter((m) => !keyword || m.fullName.toLowerCase().includes(keyword) || m.email.toLowerCase().includes(keyword))
  }, [workspaceMembers, me.id, state.members, search])

  const setMembers = (members: WizardMember[]) => update({ members })

  const addPicked = () => {
    if (pickedUserId === '' || pickedRoleId === '') return
    setMembers([...state.members, { userId: pickedUserId, roleId: pickedRoleId }])
    setPickedUserId('')
    setSearch('')
  }

  // Roster = người tạo (Project Manager, khoá) + người được thêm.
  const roster = [
    { userId: me.id, roleId: pmRole?.roleId ?? 0, isMe: true },
    ...state.members.map((m) => ({ ...m, isMe: false })),
  ]
  const statusCount = state.phases.reduce((n, p) => n + p.statuses.filter((s) => s.isActive).length, 0)
  const ruleCount = state.phases.reduce((n, p) => n + p.transitions.length, 0)
  const allInWorkspace = state.members.every((m) => memberOf(m.userId))
  const ready = keyAvailable && workflowValid && allInWorkspace

  return (
    <Card className="grid grid-cols-1 overflow-hidden xl:grid-cols-3">
      <div className="min-w-0 xl:col-span-2">
        {/* Thêm thành viên */}
        <section className="px-5 pb-5 pt-5 sm:px-6">
          <h2 className="text-base font-semibold text-gray-950">{t('Thành viên dự án', 'Project members')}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t(`Chọn trong thành viên của ${workspaceName}.`, `Pick from members of ${workspaceName}.`)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_12rem_auto] md:items-end">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-900" htmlFor="member-search">
                {t('Thành viên', 'Member')}
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="member-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('Lọc theo tên hoặc email…', 'Filter by name or email…')}
                  className={clsx(controlClass, 'pl-9')}
                />
              </div>
              <select
                aria-label={t('Chọn thành viên', 'Select member')}
                value={pickedUserId}
                onChange={(e) => setPickedUserId(e.target.value ? Number(e.target.value) : '')}
                className={controlClass}
              >
                <option value="">
                  {candidates.length
                    ? t(
                        `Chọn trong ${candidates.length} người…`,
                        `Choose from ${candidates.length} ${candidates.length === 1 ? 'person' : 'people'}…`,
                      )
                    : t('Không còn ai để thêm', 'No one left to add')}
                </option>
                {candidates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName} — {m.email} ({m.role.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900" htmlFor="member-role">
                {t('Role trong dự án', 'Project role')}
              </label>
              <select
                id="member-role"
                value={pickedRoleId}
                onChange={(e) => setPickedRoleId(e.target.value ? Number(e.target.value) : '')}
                className={controlClass}
              >
                {projectRoles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              inline
              className="lg:!h-10"
              onClick={addPicked}
              disabled={pickedUserId === '' || pickedRoleId === ''}
            >
              <PlusIcon className="h-4 w-4" /> {t('Thêm', 'Add')}
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {t(
              'Người được thêm nhận thông báo khi dự án được tạo. Người ngoài workspace cần được mời vào workspace trước.',
              'Added people are notified when the project is created. People outside the workspace must be invited to it first.',
            )}
          </p>
        </section>

        {/* Danh sách thành viên: dưới md mỗi người là một khối, không cuộn ngang. */}
        <table className="w-full border-t border-gray-200 text-sm">
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
              <th className="py-2.5 pl-6 pr-3 font-medium">
                {t('Người', 'Person')} <span className="font-normal tabular-nums">· {roster.length}</span>
              </th>
              <th className="px-3 py-2.5 font-medium">{t('Role workspace', 'Workspace role')}</th>
              <th className="px-3 py-2.5 font-medium">{t('Role dự án', 'Project role')}</th>
              <th className="w-14 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {roster.map((m) => {
              const wm = memberOf(m.userId)
              const name = m.isMe ? me.fullName : (wm?.fullName ?? `#${m.userId}`)
              return (
                <tr
                  key={m.userId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 md:table-row md:p-0"
                >
                  <td className="block w-full md:table-cell md:w-auto md:py-3 md:pl-6 md:pr-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {name}
                          {m.isMe && (
                            <span className="ml-1.5 text-xs font-normal text-gray-500">{t('(bạn)', '(you)')}</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-gray-500">{m.isMe ? me.email : wm?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="block text-gray-600 md:table-cell md:px-3 md:py-3">
                    {(m.isMe ? memberOf(me.id)?.role.name : wm?.role.name) ?? '—'}
                  </td>
                  <td className="block md:table-cell md:px-3 md:py-3">
                    {m.isMe ? (
                      <span className="text-gray-900">
                        {pmRole?.name ?? 'Project Manager'}{' '}
                        <span className="text-xs text-gray-500">· {t('người tạo', 'creator')}</span>
                      </span>
                    ) : (
                      <select
                        aria-label={t(`Project role của ${name}`, `Project role for ${name}`)}
                        value={m.roleId}
                        onChange={(e) =>
                          setMembers(
                            state.members.map((x) =>
                              x.userId === m.userId ? { ...x, roleId: Number(e.target.value) } : x,
                            ),
                          )
                        }
                        className="h-9 rounded-control border border-gray-300 bg-white px-2.5 text-sm shadow-xs focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                      >
                        {projectRoles.map((r) => (
                          <option key={r.roleId} value={r.roleId}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="ml-auto block md:table-cell md:px-3 md:py-3 md:text-right">
                    {!m.isMe && (
                      <button
                        type="button"
                        aria-label={t(`Bỏ ${name}`, `Remove ${name}`)}
                        onClick={() => setMembers(state.members.filter((x) => x.userId !== m.userId))}
                        className="rounded-control p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tóm tắt + kiểm tra trước khi tạo */}
      <aside className="border-t border-gray-200 bg-gray-50 px-5 py-5 sm:px-6 xl:border-l xl:border-t-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-950">{t('Kiểm tra trước khi tạo', 'Pre-creation checks')}</h3>
          <Badge tone={ready ? 'success' : 'amber'}>
            {ready ? t('Sẵn sàng', 'Ready') : t('Cần kiểm tra', 'Needs review')}
          </Badge>
        </div>

        <div className="mt-4">
          <p className="flex items-center gap-2 text-base font-semibold text-gray-950">
            <span className="truncate">{state.name || t('Chưa đặt tên', 'Untitled')}</span>
            <code className="rounded-[5px] border border-gray-200 bg-white px-1.5 font-sans text-xs font-medium tabular-nums text-gray-600">
              {state.key || '—'}
            </code>
          </p>
          {state.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{state.description}</p>}
        </div>

        <dl className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
          <ReviewRow
            label={t('Phương pháp', 'Method')}
            value={`${template ? templateName(template.method, template.name) : state.sdlcMethod} · ${state.phases.length} ${t('giai đoạn', state.phases.length === 1 ? 'phase' : 'phases')}`}
          />
          <ReviewRow
            label={t('Luồng issue', 'Issue workflow')}
            value={t(
              `${statusCount} trạng thái · ${ruleCount} luật`,
              `${statusCount} ${statusCount === 1 ? 'status' : 'statuses'} · ${ruleCount} ${ruleCount === 1 ? 'transition' : 'transitions'}`,
            )}
          />
          <ReviewRow label={t('Thành viên', 'Members')} value={String(roster.length)} />
          <ReviewRow
            label={t('Module AI (BA/QA)', 'AI module (BA/QA)')}
            value={state.aiEnabled ? t('Bật', 'On') : t('Tắt', 'Off')}
          />
        </dl>

        <ul className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
          <Check
            ok={keyAvailable}
            label={
              keyAvailable
                ? t(`Mã ${state.key} dùng được`, `Key ${state.key} is available`)
                : t('Mã dự án chưa được xác nhận', 'Project key not yet confirmed')
            }
          />
          <Check
            ok={workflowValid}
            label={
              workflowValid
                ? t('Luồng issue hợp lệ', 'Issue workflow is valid')
                : t('Luồng issue còn lỗi, quay lại bước 2', 'Workflow has errors, go back to step 2')
            }
          />
          <Check
            ok={allInWorkspace}
            label={t('Mọi thành viên thuộc workspace', 'All members belong to the workspace')}
          />
        </ul>
      </aside>
    </Card>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={clsx('flex items-start gap-2', ok ? 'text-gray-700' : 'text-amber-800')}>
      {ok ? (
        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
      ) : (
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      )}
      {label}
    </li>
  )
}
