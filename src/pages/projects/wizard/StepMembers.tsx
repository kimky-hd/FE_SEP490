import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CheckIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon, AlertTriangleIcon } from '@/components/ui/icons'
import type { RoleDto, WorkspaceMemberDto } from '@/types/rbac'
import type { UserDto } from '@/types/auth'
import type { SdlcTemplateDto } from '@/types/project'
import type { WizardMember, WizardState } from './wizardState'

// Bước 3 — Figma hàng 2 frame 04 "Assign Team & Commit Project": thêm thành viên từ workspace (UC §II.5.5),
// roster có Workspace role + Assigned project role, panel "Project Verification Dossier" + "Role Allocation Balance".

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

const ROLE_COLORS = ['bg-brand-600', 'bg-blue-600', 'bg-violet-600', 'bg-amber-500', 'bg-gray-500', 'bg-rose-500', 'bg-teal-600']

export function StepMembers({ state, update, me, workspaceName, workspaceMembers, projectRoles, template, keyAvailable, workflowValid }: Props) {
  const [search, setSearch] = useState('')
  const [pickedUserId, setPickedUserId] = useState<number | ''>('')
  const defaultRoleId = projectRoles.find((r) => r.code === 'DEVELOPER')?.roleId ?? projectRoles.find((r) => r.code !== 'PROJECT_MANAGER')?.roleId
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
  const allocation = projectRoles
    .map((r) => ({ role: r, count: roster.filter((m) => m.roleId === r.roleId).length }))
    .filter((x) => x.count > 0)
  const statusCount = state.phases.reduce((n, p) => n + p.statuses.filter((s) => s.isActive).length, 0)
  const ruleCount = state.phases.reduce((n, p) => n + p.transitions.length, 0)
  const allInWorkspace = state.members.every((m) => memberOf(m.userId))

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <section className="rounded-md border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-800">
              <UsersIcon className="h-4 w-4" /> Add project members from {workspaceName}
            </p>
            <span className="font-mono text-[10px] text-gray-400">Nguồn: thành viên workspace</span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[1fr_14rem_auto] md:items-end">
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500" htmlFor="member-search">
                Member email / full name
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="member-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Lọc theo tên hoặc email…"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                />
              </div>
              <select
                aria-label="Chọn thành viên"
                value={pickedUserId}
                onChange={(e) => setPickedUserId(e.target.value ? Number(e.target.value) : '')}
                className="mt-2 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-600 focus:outline-none"
              >
                <option value="">{candidates.length ? `Chọn trong ${candidates.length} người…` : 'Không còn ai để thêm'}</option>
                {candidates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName} — {m.email} ({m.role.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500" htmlFor="member-role">
                Project role & permission
              </label>
              <select
                id="member-role"
                value={pickedRoleId}
                onChange={(e) => setPickedRoleId(e.target.value ? Number(e.target.value) : '')}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-600 focus:outline-none"
              >
                {projectRoles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" inline onClick={addPicked} disabled={pickedUserId === '' || pickedRoleId === ''}>
              <PlusIcon className="h-4 w-4" /> Add to list
            </Button>
          </div>
          <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-500">
            ⓘ Người được thêm vào dự án sẽ nhận thông báo trong ứng dụng ngay khi dự án được tạo. Chỉ chọn được người đã là thành viên
            workspace — người ngoài hãy mời vào công ty / workspace trước.
          </p>
        </section>

        <section className="rounded-md border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-800">
              Project members roster <Badge>{roster.length} thành viên</Badge>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="w-12 px-5 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 font-medium">Full name</th>
                  <th className="px-3 py-2 font-medium">Corporate email</th>
                  <th className="px-3 py-2 font-medium">Workspace role</th>
                  <th className="px-3 py-2 font-medium">Assigned project role</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roster.map((m, index) => {
                  const wm = memberOf(m.userId)
                  const name = m.isMe ? me.fullName : wm?.fullName ?? `#${m.userId}`
                  return (
                    <tr key={m.userId}>
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-400">{String(index + 1).padStart(2, '0')}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={name} size="sm" />
                          <span className="font-medium text-gray-900">
                            {name}
                            {m.isMe && <span className="ml-1 text-xs font-normal text-gray-400">(Bạn)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{m.isMe ? me.email : wm?.email}</td>
                      <td className="px-3 py-2.5">
                        <Badge>{(m.isMe ? memberOf(me.id)?.role.name : wm?.role.name) ?? '—'}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {m.isMe ? (
                          <Badge tone="brand">{pmRole?.name ?? 'Project Manager'} · người khởi tạo</Badge>
                        ) : (
                          <select
                            aria-label={`Project role của ${name}`}
                            value={m.roleId}
                            onChange={(e) =>
                              setMembers(state.members.map((x) => (x.userId === m.userId ? { ...x, roleId: Number(e.target.value) } : x)))
                            }
                            className="h-8 rounded border border-gray-300 bg-white px-2 text-xs focus:border-brand-600 focus:outline-none"
                          >
                            {projectRoles.map((r) => (
                              <option key={r.roleId} value={r.roleId}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {!m.isMe && (
                          <button
                            type="button"
                            aria-label={`Bỏ ${name}`}
                            onClick={() => setMembers(state.members.filter((x) => x.userId !== m.userId))}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-800">Role allocation balance (staged team)</p>
            <span className="font-mono text-[10px] text-gray-400">Khuyến nghị: 4–8 thành viên</span>
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
            {allocation.map((x, i) => (
              <div key={x.role.roleId} className={ROLE_COLORS[i % ROLE_COLORS.length]} style={{ width: `${(x.count / roster.length) * 100}%` }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-gray-600">
            {allocation.map((x, i) => (
              <span key={x.role.roleId} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${ROLE_COLORS[i % ROLE_COLORS.length]}`} />
                {x.count} {x.role.name} ({Math.round((x.count / roster.length) * 100)}%)
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Project Verification Dossier */}
      <aside className="h-fit rounded-md border border-gray-200 bg-white xl:sticky xl:top-4">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-800">Project verification dossier</p>
          <Badge tone={keyAvailable && workflowValid && allInWorkspace ? 'brand' : 'amber'}>
            {keyAvailable && workflowValid && allInWorkspace ? 'Ready' : 'Cần kiểm tra'}
          </Badge>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-md bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">Target project</span>
              <span className="rounded-sm bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">KEY: {state.key || '—'}</span>
            </div>
            <p className="mt-1 text-base font-semibold text-gray-950">{state.name || 'Chưa đặt tên'}</p>
            {state.description && <p className="mt-1 line-clamp-3 text-xs text-gray-500">{state.description}</p>}
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">Configuration review</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <ReviewRow
                label="SDLC Methodology"
                value={`${template?.name ?? state.sdlcMethod}${state.baseTemplateName ? ` (tùy biến từ ${state.baseTemplateName})` : ''} (${state.phases.length} phase)`}
              />
              <ReviewRow label="Issue Workflow" value={`${statusCount} trạng thái · ${ruleCount} luật`} />
              <ReviewRow label="Assigned Team Roster" value={`${roster.length} thành viên`} />
              <ReviewRow label="Module AI (BA/QA)" value={state.aiEnabled ? 'Bật' : 'Tắt'} />
            </dl>
          </div>

          <div className="rounded-md border border-gray-200 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">Automated system checks</p>
            <ul className="mt-2 space-y-1.5 text-xs">
              <Check ok={keyAvailable} label={keyAvailable ? `Project Key ${state.key} chưa bị dùng trong workspace` : 'Project Key chưa được xác nhận'} />
              <Check ok={workflowValid} label={workflowValid ? 'Workflow mọi phase hợp lệ (không ngõ cụt)' : 'Workflow còn lỗi — quay lại bước 2'} />
              <Check ok={allInWorkspace} label="Mọi thành viên thuộc workspace" />
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? 'flex items-start gap-1.5 text-brand-700' : 'flex items-start gap-1.5 text-amber-700'}>
      {ok ? <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      {label}
    </li>
  )
}
