import { Link } from 'react-router-dom'
import { DashboardEmptyState, DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import { DocumentIcon, FolderIcon, ListChecksIcon } from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { issueApi } from '@/api/issueApi'
import { useAsync } from '@/lib/useAsync'
import clsx from 'clsx'

export function DashboardHomePage() {
  const { user, companies, workspaces, currentCompany } = useAuth()
  const companyId = currentCompany?.companyId ?? null
  const projects = useAsync(() => projectApi.listMine(companyId, { status: 'ACTIVE' }), [companyId])
  const myIssues = useAsync(() => issueApi.getMyIssues(user?.fullName), [user?.fullName])
  const projectList = projects.data ?? []
  const issueList = myIssues.data ?? []

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Welcome back, {user?.fullName}!</h1>
      <p className="mt-1 text-sm text-gray-500">
        {companies[0]
          ? `This is the workspace for ${companies[0].companyName}.`
          : 'This is your personal workspace.'}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projectList.length > 0 ? (
          <div className="flex flex-col justify-between rounded-md border border-gray-200 bg-white p-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <FolderIcon className="h-5 w-5" />
                </span>
                <Link to="/projects" className="text-xs font-medium text-brand-700 hover:underline">
                  View all ({projectList.length}) →
                </Link>
              </div>
              <h2 className="mt-3 text-sm font-semibold text-gray-900">Active Projects</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {projectList.slice(0, 3).map((p) => (
                  <li key={p.projectId} className="flex items-center justify-between gap-2 truncate">
                    <Link
                      to={`/projects/${p.projectId}`}
                      className="truncate font-medium text-gray-800 hover:text-brand-700 hover:underline"
                    >
                      <span className="mr-1.5 font-mono text-xs text-gray-500">[{p.key}]</span>
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-xs text-gray-400">{p.sdlcMethod}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <DashboardEmptyState
            icon={<FolderIcon className="h-5 w-5" />}
            title="No projects yet"
            description="Create your first project to start tracking work."
          />
        )}
        {issueList.length > 0 ? (
          <div className="flex flex-col justify-between rounded-md border border-gray-200 bg-white p-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <ListChecksIcon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-blue-700">
                  {issueList.filter((i) => i.statusCategory !== 'DONE').length} open
                </span>
              </div>
              <h2 className="mt-3 text-sm font-semibold text-gray-900">My Assigned Issues</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {issueList.slice(0, 3).map((iss) => (
                  <li key={iss.id} className="flex items-center justify-between gap-2 truncate">
                    <Link
                      to={`/projects/${iss.projectId}/issues?issueId=${iss.id}`}
                      className="truncate font-medium text-gray-800 hover:text-brand-700 hover:underline flex items-center gap-1.5"
                    >
                      <span
                        className={clsx(
                          'inline-block h-2 w-2 rounded-full shrink-0',
                          iss.type === 'BUG' ? 'bg-rose-500' : 'bg-blue-600',
                        )}
                        title={iss.type}
                      />
                      <span className="font-mono text-xs text-gray-400">[{iss.key}]</span>
                      <span className="truncate">{iss.summary}</span>
                    </Link>
                    <span
                      className={clsx(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        iss.statusCategory === 'DONE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : iss.statusCategory === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {iss.statusName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <DashboardEmptyState
            icon={<ListChecksIcon className="h-5 w-5" />}
            title="No assigned issues"
            description="Tasks or bugs assigned to you will show up here."
          />
        )}
        <DashboardEmptyState
          icon={<DocumentIcon className="h-5 w-5" />}
          title="Requirements & Confluence Workspace"
          description="Full-screen distraction-free authoring for URD, BRD, SRS with auto REQ tracking."
        />
      </div>

      {(companies.length > 0 || workspaces.length > 0) && (
        <div className="mt-6 rounded-md border border-gray-200 bg-white p-4 text-sm">
          <p className="font-semibold text-gray-700">Account Information</p>
          <dl className="mt-2 space-y-1 text-gray-500">
            {companies.map((c) => (
              <div key={c.companyId} className="flex justify-between">
                <dt>Company</dt>
                <dd className="font-medium text-gray-700">
                  {c.companyName} · {c.roleName}
                </dd>
              </div>
            ))}
            {workspaces.map((w) => (
              <div key={w.workspaceId} className="flex justify-between">
                <dt>Workspace</dt>
                <dd className="font-medium text-gray-700">
                  <Link to={`/workspaces/${w.workspaceId}`} className="hover:text-brand-700 hover:underline">
                    {w.workspaceName}
                  </Link>
                  {w.role && <span className="font-normal text-gray-400"> · {w.role.name}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </DashboardLayout>
  )
}
