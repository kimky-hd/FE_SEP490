import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState } from '@/components/layout/PageParts'
import { HelpTips } from '@/help/HelpTips'
import { buttonClasses } from '@/components/ui/Button'
import { CheckIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { companyApi } from '@/api/companyApi'
import { workApi } from '@/api/workApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { formatRelative } from '@/lib/format'
import { PERMISSIONS } from '@/types/rbac'
import type { ProjectDto } from '@/types/project'
import type { DocumentWorkEvent, MyDocumentWorkDto, ProjectDocumentStats } from '@/types/document'
import { useWorkItems } from '@/lib/useMyWork'
import type { WorkCategory, WorkItem } from '@/lib/myWorkRules'
import { WorkRows } from '@/components/work/WorkRows'
import { useI18n } from '@/i18n'
import { Chip } from '@/pages/documents/docUi'
import { NewDocButton } from '@/pages/documents/NewDocButton'
import { InviteCard, KpiIcons, ProjectPickerModal, callName, greeting, todayLabel, type NewDocKind } from './homeParts'

/** Nhóm thẻ số: mỗi dòng việc tài liệu thuộc đúng một nhóm; việc issue / testcase chỉ có trong danh sách (trừ bug lỗi → "Cần sửa", REQ đổi → "REQ thay đổi"). */
type Tab = 'review' | 'fix' | 'draft' | 'req'

const tabOf = (c: WorkCategory): Tab | null =>
  c === 'review'
    ? 'review'
    : c === 'changes' || c === 'comment'
      ? 'fix'
      : c === 'draft'
        ? 'draft'
        : c === 'req'
          ? 'req'
          : null

// Trang Tổng quan: "hôm nay tôi cần làm gì" trên mọi dự án.
// Có dự án: lời chào · 4 số việc (bấm để chọn tab) · "Việc của tôi" · hoạt động gần đây · cột phải dự án + mời đội.
// Công ty mới (chưa có workspace / dự án): 3 bước theo thứ tự thay cho các số toàn 0.
export function DashboardHomePage() {
  const { user, workspaces, currentCompany, can } = useAuth()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const companyId = currentCompany?.companyId ?? null
  const projects = useAsync(() => projectApi.listMine(companyId, { status: 'ACTIVE' }), [companyId])
  const projectList = projects.data ?? []
  const work = useAsync(() => workApi.documentWork(companyId), [companyId])
  // "Việc của tôi" gộp mọi dự án, mỗi dự án theo vai trò của tôi TRONG dự án đó (bỏ dòng "hoạt động": đã có mục riêng).
  const myWork = useWorkItems(projects.data)
  // Việc issue / testcase không thuộc thẻ số nào nhưng vẫn nằm trong danh sách.
  const workItems = myWork.items.filter((x) => x.category !== 'activity')
  const activeWorkspaces = workspaces.filter((w) => w.status !== 'ARCHIVED')
  const firstWorkspace = activeWorkspaces[0]
  const newProjectHref = firstWorkspace ? `/workspaces/${firstWorkspace.workspaceId}/projects/new` : '/workspaces'
  // project.create có thể được cấp ở công ty hoặc ở workspace.
  const canCreateProject =
    can(PERMISSIONS.projectCreate) || !!firstWorkspace?.permissions?.includes(PERMISSIONS.projectCreate)
  const editable = projectList.filter((p) => hasPermission(p.myPermissions, PERMISSIONS.documentEdit))

  // "Mời đội" chỉ hiện khi biết chắc công ty mới có 1 thành viên (cần quyền xem người dùng để đếm).
  const canInvite = companyId !== null && can(PERMISSIONS.userInvite) && can(PERMISSIONS.userView)
  const members = useAsync(
    () => (canInvite ? companyApi.listUsers(companyId!, { pageSize: 2 }).then((r) => r.total) : Promise.resolve(null)),
    [canInvite, companyId],
  )
  const inviteKey = `ssam.home.inviteHidden.${companyId ?? 'personal'}`
  const [inviteHidden, setInviteHidden] = useState(() => {
    try {
      return window.localStorage.getItem(inviteKey) === '1'
    } catch {
      return false
    }
  })
  const hideInvite = () => {
    setInviteHidden(true)
    try {
      window.localStorage.setItem(inviteKey, '1')
    } catch {
      // Storage bị chặn: chỉ ẩn trong phiên này.
    }
  }
  const showInvite = canInvite && members.data === 1

  const [picker, setPicker] = useState<NewDocKind | null>(null)
  const startDoc = (kind: NewDocKind, project?: ProjectDto) => {
    const target = project ?? (editable.length === 1 ? editable[0] : null)
    if (target) navigate(`/projects/${target.projectId}/documents?new=${kind}`)
    else setPicker(kind)
  }

  const name = callName(user?.fullName)
  const isNew = activeWorkspaces.length === 0 || (!projects.isLoading && !projects.error && projectList.length === 0)

  if (isNew) {
    return (
      <DashboardLayout>
        <header className="relative pr-10">
          <HelpTips className="!absolute right-0 top-1" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            {t(`Chào mừng tới SSAM, ${name}`, `Welcome to SSAM, ${name}`)}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {currentCompany ? `${currentCompany.companyName} · ` : ''}
            {t('3 bước để đội bạn bắt đầu viết tài liệu', '3 steps to get your team writing documents')}
          </p>
        </header>
        <Steps
          workspaceName={firstWorkspace?.workspaceName ?? null}
          newProjectHref={newProjectHref}
          canCreateProject={canCreateProject}
        />
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-2">
          <div className="rounded-card border border-gray-200 bg-white px-5 py-7 text-center shadow-xs">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-gray-200 text-gray-500 shadow-xs">
              {KpiIcons.doc}
            </span>
            <p className="mt-2.5 text-sm font-medium text-gray-950">
              {t('Việc của tôi sẽ hiện ở đây', 'Your work will show up here')}
            </p>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {t(
                'Tài liệu bạn đang viết, chờ bạn duyệt hoặc bị yêu cầu sửa.',
                "Documents you're writing, waiting for your review, or sent back for changes.",
              )}
            </p>
          </div>
          {showInvite && (
            <InviteCard
              companyId={companyId!}
              description={t(
                'Mời BA, Designer, QA để cùng viết và duyệt tài liệu.',
                'Invite BAs, designers and QA to write and review documents together.',
              )}
              onInvited={() => void members.reload()}
            />
          )}
        </div>
      </DashboardLayout>
    )
  }

  const data = work.data

  return (
    <DashboardLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            {greeting(t)}
            {name && `, ${name}`}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {todayLabel(lang)}
            {currentCompany && ` · ${currentCompany.companyName}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateProject && (
            <Link to={newProjectHref} className={buttonClasses({ variant: 'secondary', inline: true })}>
              {t('Tạo dự án', 'Create project')}
            </Link>
          )}
          {editable.length > 0 && <NewDocButton onBlank={() => startDoc('blank')} onNotes={() => startDoc('notes')} />}
          <HelpTips />
        </div>
      </header>

      {projects.error ? (
        <div className="mt-6">
          <ErrorState message={apiErrorMessage(projects.error)} onRetry={projects.reload} />
        </div>
      ) : (
        <WorkArea
          work={data}
          workError={work.error}
          onRetry={() => void work.reload()}
          loading={work.isLoading && !data}
          items={workItems}
          itemsLoading={myWork.loading && workItems.length === 0}
          itemsError={myWork.error}
          onItemsRetry={myWork.reload}
          projects={projectList}
          projectsLoading={projects.isLoading && !projects.data}
          editable={editable}
          onStart={startDoc}
          aside={
            showInvite &&
            !inviteHidden && (
              <InviteCard
                companyId={companyId!}
                description={t('Công ty mới có 1 thành viên.', 'Your company has just 1 member.')}
                onInvited={() => void members.reload()}
                onDismiss={hideInvite}
              />
            )
          }
        />
      )}

      <ProjectPickerModal
        open={picker !== null}
        kind={picker ?? 'blank'}
        projects={editable}
        onClose={() => setPicker(null)}
        onPick={(p) => {
          const kind = picker ?? 'blank'
          setPicker(null)
          startDoc(kind, p)
        }}
      />
    </DashboardLayout>
  )
}

// --- Công ty mới: 3 bước ---

function Steps({
  workspaceName,
  newProjectHref,
  canCreateProject,
}: {
  workspaceName: string | null
  newProjectHref: string
  canCreateProject: boolean
}) {
  const { t } = useI18n()
  const current = workspaceName ? 2 : 1
  const steps: { n: number; title: string; detail: string; action?: ReactNode }[] = [
    {
      n: 1,
      title: t('Tạo workspace', 'Create a workspace'),
      detail:
        workspaceName ?? t('Mỗi workspace là một sản phẩm hoặc một đội.', 'Each workspace is a product or a team.'),
      action: (
        <Link to="/workspaces" className={buttonClasses({ inline: true })}>
          {t('Tạo workspace', 'Create workspace')}
        </Link>
      ),
    },
    {
      n: 2,
      title: t('Tạo dự án đầu tiên', 'Create your first project'),
      detail: canCreateProject
        ? t(
            'Chọn Scrum, Kanban hoặc tự định nghĩa. Sửa giai đoạn sau cũng được.',
            'Pick Scrum, Kanban or your own. You can edit phases later.',
          )
        : t('Nhờ quản trị viên thêm bạn vào một dự án.', 'Ask an admin to add you to a project.'),
      action: canCreateProject ? (
        <Link to={newProjectHref} className={buttonClasses({ inline: true })}>
          {t('Tạo dự án', 'Create project')}
        </Link>
      ) : undefined,
    },
    {
      n: 3,
      title: t('Viết tài liệu đầu tiên', 'Write your first document'),
      detail: t(
        'Dán ghi chú họp, SSAM tách thành yêu cầu.',
        'Paste meeting notes; SSAM splits them into requirements.',
      ),
    },
  ]
  return (
    <ol className="mt-6 grid gap-3 lg:grid-cols-[1fr_1.4fr_1fr]">
      {steps.map((s) => {
        const state = s.n < current ? 'done' : s.n === current ? 'current' : 'next'
        return (
          <li
            key={s.n}
            aria-current={state === 'current' ? 'step' : undefined}
            className={clsx(
              'flex items-start gap-3 rounded-card border p-4',
              state === 'done' && 'border-gray-200 bg-gray-50',
              state === 'current' && 'border-brand-200 bg-white shadow-[0_0_0_3px_theme(colors.brand.50)]',
              state === 'next' && 'border-gray-200 bg-white opacity-60',
            )}
          >
            <span
              className={clsx(
                'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                state === 'done' && 'border-success-200 bg-success-50 text-success-700',
                state === 'current' && 'border-brand-600 bg-brand-600 text-white',
                state === 'next' && 'border-gray-300 text-gray-500',
              )}
            >
              {state === 'done' ? <CheckIcon className="h-3.5 w-3.5" /> : s.n}
              {state === 'done' && <span className="sr-only">{t('Đã xong', 'Done')}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className={clsx('text-sm font-medium', state === 'done' ? 'text-gray-500' : 'text-gray-950')}>
                {s.title}
              </p>
              <p className="mt-0.5 text-[13px] text-gray-500">{s.detail}</p>
              {state === 'current' && s.action && <div className="mt-3">{s.action}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// --- Có dự án: số việc · Việc của tôi · hoạt động · dự án ---

function WorkArea({
  work,
  workError,
  onRetry,
  loading,
  items,
  itemsLoading,
  itemsError,
  onItemsRetry,
  projects,
  projectsLoading,
  editable,
  onStart,
  aside,
}: {
  work: MyDocumentWorkDto | undefined
  workError: unknown
  onRetry: () => void
  loading: boolean
  items: WorkItem[]
  itemsLoading: boolean
  itemsError: unknown
  onItemsRetry: () => void
  projects: ProjectDto[]
  projectsLoading: boolean
  editable: ProjectDto[]
  onStart: (kind: NewDocKind, project?: ProjectDto) => void
  aside: ReactNode
}) {
  const { t } = useI18n()
  const counts: Record<Tab, number> = { review: 0, fix: 0, draft: 0, req: 0 }
  for (const x of items) {
    const tab = tabOf(x.category)
    if (tab) counts[tab] += 1
  }
  const totalWork = items.length
  // Bấm thẻ số để lọc danh sách, bấm lại để bỏ lọc.
  const [picked, setPicked] = useState<Tab | null>(null)
  const tab = picked && counts[picked] > 0 ? picked : null
  const shown = tab ? items.filter((x) => tabOf(x.category) === tab) : items

  const kpis: { key: Tab; label: string; icon: ReactNode; tone: string }[] = [
    {
      key: 'review',
      label: t('Chờ tôi duyệt', 'Waiting for my review'),
      icon: KpiIcons.review,
      tone: 'bg-brand-50 text-brand-600',
    },
    {
      key: 'fix',
      label: t('Cần sửa / trả lời', 'To fix or reply'),
      icon: KpiIcons.changes,
      tone: 'bg-red-50 text-red-700',
    },
    { key: 'draft', label: t('Tôi đang viết', "I'm writing"), icon: KpiIcons.write, tone: 'bg-gray-100 text-gray-600' },
    { key: 'req', label: t('REQ thay đổi', 'Changed REQs'), icon: KpiIcons.stale, tone: 'bg-amber-50 text-amber-700' },
  ]
  const firstEditable = editable[0]

  return (
    <>
      <div
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        role="group"
        aria-label={t('Việc cần làm', 'Things to do')}
      >
        {kpis.map((k) => {
          const value = counts[k.key]
          const zero = value === 0
          const on = totalWork > 0 && tab === k.key
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={on}
              disabled={zero}
              onClick={() => setPicked(on ? null : k.key)}
              className={clsx(
                'flex min-w-0 items-center gap-3.5 rounded-card border bg-white px-4 py-3.5 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
                on
                  ? 'border-brand-200 shadow-[0_0_0_3px_theme(colors.brand.50)]'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <span
                className={clsx(
                  'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]',
                  zero ? 'bg-gray-100 text-gray-400' : k.tone,
                )}
              >
                {k.icon}
              </span>
              <span className="min-w-0">
                <span
                  className={clsx(
                    'block text-[22px] font-semibold leading-tight tabular-nums',
                    zero ? 'text-gray-400' : 'text-gray-950',
                  )}
                >
                  {itemsLoading ? '–' : value}
                </span>
                <span className="line-clamp-2 block text-[13px] leading-snug text-gray-500">{k.label}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <section aria-labelledby="my-work-title">
            <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
              <h2 id="my-work-title" className="flex-1 text-base font-semibold text-gray-950">
                {t('Việc của tôi', 'My work')}
              </h2>
              {tab && (
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="text-[13px] font-medium text-brand-700 hover:underline"
                >
                  {t(`Xem tất cả ${totalWork}`, `Show all ${totalWork}`)}
                </button>
              )}
              {!tab && totalWork > 0 && (
                <span className="text-[13px] text-gray-500">{t('Sắp theo mức gấp', 'Sorted by urgency')}</span>
              )}
            </div>
            <div className="mt-3">
              {itemsError ? (
                <ErrorState message={apiErrorMessage(itemsError)} onRetry={onItemsRetry} />
              ) : itemsLoading ? (
                <SkeletonCard rows={2} />
              ) : totalWork === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-xs">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-950">
                      {t('Chưa có việc nào cho bạn', 'Nothing for you yet')}
                    </p>
                    {firstEditable && (
                      <p className="mt-0.5 text-[13px] text-gray-500">
                        {t('Bắt đầu bằng tài liệu đầu tiên cho ', 'Start with a first document for ')}
                        <span className="font-medium text-gray-950">{firstEditable.name}</span>.
                      </p>
                    )}
                  </div>
                  {firstEditable && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onStart('blank', firstEditable)}
                        className={buttonClasses({ variant: 'secondary', inline: true })}
                      >
                        {t('Trang trống', 'Blank page')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onStart('notes', firstEditable)}
                        className={buttonClasses({ variant: 'secondary', inline: true })}
                      >
                        {t('Từ ghi chú họp', 'From meeting notes')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <WorkRows items={shown} showProject />
              )}
            </div>
          </section>

          <section aria-labelledby="activity-title" className="mt-7">
            <div className="flex min-h-9 items-center">
              <h2 id="activity-title" className="text-base font-semibold text-gray-950">
                {t('Hoạt động gần đây', 'Recent activity')}
              </h2>
            </div>
            <div className="mt-3">
              {workError ? (
                <ErrorState message={apiErrorMessage(workError)} onRetry={onRetry} />
              ) : loading ? (
                <SkeletonCard rows={3} />
              ) : work && work.activity.length > 0 ? (
                <ol className="rounded-card border border-gray-200 bg-white px-4 py-1 shadow-xs">
                  {work.activity.map((e) => (
                    <ActivityRow key={e.id} event={e} />
                  ))}
                </ol>
              ) : (
                <p className="rounded-card border border-gray-200 bg-white px-4 py-[18px] text-[13.5px] text-gray-500 shadow-xs">
                  {t(
                    'Chưa có hoạt động. Khi có người viết, gửi duyệt hay bình luận, bạn sẽ thấy ở đây.',
                    'No activity yet. When someone writes, submits or comments, it shows up here.',
                  )}
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <ProjectsCard projects={projects} loading={projectsLoading} stats={work?.projectStats} />
          {aside}
        </aside>
      </div>
    </>
  )
}

const docHref = (x: { projectId: number; documentId: number }) => `/projects/${x.projectId}/documents/${x.documentId}`

const DOT: Record<DocumentWorkEvent['kind'], string> = {
  APPROVED: 'bg-success-600',
  SUBMITTED: 'bg-brand-600',
  COMMENTED: 'bg-[#fac515]',
  CHANGES_REQUESTED: 'bg-red-600',
  STALE: 'bg-amber-600',
}

function ActivityRow({ event: e }: { event: DocumentWorkEvent }) {
  const { t } = useI18n()
  const actor = <b className="font-medium text-gray-950">{e.actor?.fullName ?? t('Ai đó', 'Someone')}</b>
  const doc = (
    <Link to={docHref(e)} className="font-medium text-gray-950 hover:text-brand-700 hover:underline">
      {e.code ? `${e.code} ${e.title}` : e.title}
    </Link>
  )
  const ver = e.versionLabel ? t(` bản ${e.versionLabel}`, ` v${e.versionLabel}`) : ''
  let body: ReactNode
  switch (e.kind) {
    case 'APPROVED':
      body = (
        <>
          {actor} {t('đã duyệt', 'approved')} {doc}
          {ver}
        </>
      )
      break
    case 'SUBMITTED':
      body = (
        <>
          {actor} {t('gửi duyệt', 'submitted')} {doc}
          {ver}
          {e.note && ` · ${e.note}`}
        </>
      )
      break
    case 'CHANGES_REQUESTED':
      body = (
        <>
          {actor} {t('yêu cầu sửa', 'requested changes on')} {doc}
          {ver}
          {e.note && `: “${e.note}”`}
        </>
      )
      break
    case 'COMMENTED':
      body = (
        <>
          {actor} {t('bình luận trong', 'commented on')} {doc}
          {e.note && `: “${e.note}”`}
        </>
      )
      break
    case 'STALE':
      body = (
        <>
          <b className="font-medium text-gray-950">{t(`${e.count ?? 0} REQ`, `${e.count ?? 0} REQs`)}</b>{' '}
          {t('chuyển sang Stale sau khi duyệt', 'became stale after approving')} {doc}
          {ver}
        </>
      )
      break
  }
  return (
    <li className="flex gap-3 border-b border-gray-200 py-[11px] text-[13.5px] text-gray-600 last:border-b-0">
      <span aria-hidden="true" className={clsx('mt-[7px] h-2 w-2 shrink-0 rounded-full', DOT[e.kind])} />
      <div className="min-w-0">
        <p className="line-clamp-2">{body}</p>
        <p className="text-xs text-gray-500">
          {e.projectName} · {formatRelative(e.createdAt)}
        </p>
      </div>
    </li>
  )
}

function ProjectsCard({
  projects,
  loading,
  stats,
}: {
  projects: ProjectDto[]
  loading: boolean
  stats: ProjectDocumentStats[] | undefined
}) {
  const { t } = useI18n()
  const byId = new Map((stats ?? []).map((s) => [s.projectId, s]))
  const shown = projects.slice(0, 5)
  const anyDocs = shown.some((p) => (byId.get(p.projectId)?.pages ?? 0) > 0)
  return (
    <section aria-labelledby="my-projects-title">
      <div className="flex min-h-9 items-center gap-2">
        <h2 id="my-projects-title" className="text-base font-semibold text-gray-950">
          {t('Dự án của tôi', 'My projects')}
        </h2>
        {projects.length > 0 && <span className="text-[13px] tabular-nums text-gray-500">{projects.length}</span>}
        <span className="flex-1" />
        {projects.length > 0 && (
          <Link to="/projects" className="text-[13px] font-medium text-brand-700 hover:underline">
            {t('Tất cả', 'All')}
          </Link>
        )}
      </div>
      <div className="mt-3 overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs">
        {loading ? (
          <SkeletonRows rows={2} />
        ) : (
          <>
            <ul className="divide-y divide-gray-200">
              {shown.map((p) => (
                <ProjectRow key={p.projectId} project={p} stats={byId.get(p.projectId)} statsLoaded={!!stats} />
              ))}
            </ul>
            {anyDocs && (
              <div className="flex flex-wrap gap-3 border-t border-gray-200 px-4 py-2.5 text-xs text-gray-500">
                <Legend className="bg-success-600" label={t('Đã duyệt', 'Approved')} />
                <Legend className="bg-brand-600" label={t('Chờ duyệt', 'In review')} />
                <Legend className="bg-gray-300" label={t('Nháp', 'Draft')} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden="true" className={clsx('h-2 w-2 rounded-[2px]', className)} />
      {label}
    </span>
  )
}

function ProjectRow({
  project: p,
  stats: s,
  statsLoaded,
}: {
  project: ProjectDto
  stats: ProjectDocumentStats | undefined
  statsLoaded: boolean
}) {
  const { t } = useI18n()
  const pages = s?.pages ?? 0
  const pct = (n: number) => `${pages > 0 ? (n / pages) * 100 : 0}%`
  const canWrite = hasPermission(p.myPermissions, PERMISSIONS.documentEdit)
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-2">
        <Link
          to={`/projects/${p.projectId}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-gray-950 hover:text-brand-700 hover:underline"
        >
          {p.name}
        </Link>
        <Chip>{p.key}</Chip>
      </div>
      <div
        className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={
          pages > 0
            ? t(
                `${s!.approved} đã duyệt, ${s!.inReview} chờ duyệt, ${s!.draft} nháp`,
                `${s!.approved} approved, ${s!.inReview} in review, ${s!.draft} draft`,
              )
            : t('Chưa có tài liệu', 'No documents yet')
        }
      >
        {pages > 0 && (
          <>
            <i className="block h-full bg-success-600" style={{ width: pct(s!.approved) }} />
            <i className="block h-full bg-brand-600" style={{ width: pct(s!.inReview) }} />
            <i className="block h-full bg-gray-300" style={{ width: pct(s!.draft) }} />
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[12.5px] text-gray-500">
        {!statsLoaded ? (
          <span>&nbsp;</span>
        ) : pages > 0 ? (
          <>
            <span>
              {t(
                `${pages} tài liệu · ${s!.reqs} REQ`,
                `${pages} ${pages === 1 ? 'document' : 'documents'} · ${s!.reqs} REQ`,
              )}
            </span>
            <span>{s!.inReview > 0 ? t(`${s!.inReview} chờ duyệt`, `${s!.inReview} in review`) : '—'}</span>
          </>
        ) : (
          <>
            <span>{t('Chưa có tài liệu', 'No documents yet')}</span>
            {canWrite && (
              <Link to={`/projects/${p.projectId}/documents`} className="font-medium text-brand-700 hover:underline">
                {t('Viết tài liệu', 'Write a document')}
              </Link>
            )}
          </>
        )}
      </div>
    </li>
  )
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs">
      <SkeletonRows rows={rows} />
    </div>
  )
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <ul aria-busy="true" className="divide-y divide-gray-200">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between px-4 py-4">
          <span className="h-4 w-48 rounded bg-gray-100" />
          <span className="h-4 w-16 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  )
}
