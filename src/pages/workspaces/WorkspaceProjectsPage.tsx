import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { PlusIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { PERMISSIONS } from '@/types/rbac'
import type { ProjectStatus } from '@/types/project'
import { ProjectTable } from '../projects/ProjectTable'
import { AccessDeniedModal } from '../projects/AccessDeniedModal'
import { useWorkspaceContext } from './WorkspaceLayout'

// Tab "Dự án" của workspace — mockup "Dự án" + Figma hàng 2 frame 01 (nút Create Project luôn hiện; thiếu quyền thì
// bấm vào nhận modal Access Denied thay vì ẩn nút).
export function WorkspaceProjectsPage() {
  const { workspace, can, isArchived, isPersonal } = useWorkspaceContext()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE')
  const [search, setSearch] = useState('')
  const [deniedOpen, setDeniedOpen] = useState(false)
  const projects = useAsync(() => projectApi.listByWorkspace(workspace.workspaceId), [workspace.workspaceId])

  const all = projects.data ?? []
  const keyword = search.trim().toLowerCase()
  const visible = all
    .filter((p) => p.status === status)
    .filter((p) => !keyword || p.name.toLowerCase().includes(keyword) || p.key.toLowerCase().includes(keyword))

  const onCreate = () => {
    if (can(PERMISSIONS.projectCreate)) navigate(`/workspaces/${workspace.workspaceId}/projects/new`)
    else setDeniedOpen(true)
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-sm">
            {(
              [
                ['ACTIVE', 'Active'],
                ['ARCHIVED', 'Archived'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={clsx(
                  'rounded px-3 py-1.5 font-medium transition-colors',
                  status === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                {label}
                <span className={clsx('ml-1.5 text-xs', status === value ? 'text-white/60' : 'text-gray-400')}>
                  {all.filter((p) => p.status === value).length}
                </span>
              </button>
            ))}
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search projects</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or key…"
              className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
          </label>
        </div>
        {!isArchived && !isPersonal && (
          <Button inline onClick={onCreate}>
            <PlusIcon className="h-4 w-4" /> Create Project
          </Button>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {all.filter((p) => p.status === 'ACTIVE').length} active projects in workspace {workspace.name}.
      </p>

      <div className="mt-4">
        {projects.isLoading && !projects.data ? (
          <LoadingBlock />
        ) : projects.error ? (
          <ErrorState message={apiErrorMessage(projects.error)} onRetry={projects.reload} />
        ) : (
          <ProjectTable
            projects={visible}
            emptyText={keyword ? 'No matching projects found.' : status === 'ACTIVE' ? 'No projects yet — click “Create Project” to get started.' : 'No archived projects.'}
          />
        )}
      </div>

      <AccessDeniedModal open={deniedOpen} onClose={() => setDeniedOpen(false)} workspace={workspace} email={user?.email ?? ''} />
    </div>
  )
}
