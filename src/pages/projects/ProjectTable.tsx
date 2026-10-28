import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { formatRelative } from '@/lib/format'
import type { ProjectDto, SdlcMethod } from '@/types/project'

export const SDLC_LABEL: Record<SdlcMethod, string> = { SCRUM: 'Agile Scrum', KANBAN: 'Kanban', CUSTOM: 'Custom SDLC' }

// Bảng dự án — mockup "Dự án" (cột Mã · Dự án · Trạng thái · Issue · Tài liệu · Phụ trách · Cập nhật), FR §III.5.1.
export function ProjectTable({ projects, emptyText, showWorkspace }: { projects: ProjectDto[]; emptyText: string; showWorkspace?: boolean }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
            <th className="px-4 py-3 font-medium">Key</th>
            <th className="px-4 py-3 font-medium">Project</th>
            {showWorkspace && <th className="px-4 py-3 font-medium">Workspace</th>}
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Issues</th>
            <th className="px-4 py-3 font-medium">Requirements</th>
            <th className="px-4 py-3 font-medium">Lead</th>
            <th className="px-4 py-3 font-medium">Your Role</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {projects.map((p) => (
            <tr key={p.projectId} className={clsx(p.status === 'ARCHIVED' && 'bg-gray-50/60 text-gray-500')}>
              <td className="px-4 py-3">
                <span className="rounded-sm border border-gray-300 px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-700">{p.key}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Link to={`/projects/${p.projectId}`} className="font-semibold text-gray-900 hover:text-brand-700 hover:underline">
                    {p.name}
                  </Link>
                  <a
                    href={`/projects/${p.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${p.name} Space in a new browser tab`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-gray-200 bg-gray-50 text-[10px] font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    ↗
                  </a>
                </div>
                <p className="text-xs text-gray-400">
                  {SDLC_LABEL[p.sdlcMethod]} · {p.phaseCount} phases
                </p>
              </td>
              {showWorkspace && <td className="px-4 py-3 text-gray-500">{p.workspaceName}</td>}
              <td className="px-4 py-3">
                {p.status === 'ACTIVE' ? (
                  <Badge tone="brand" dot>
                    Active
                  </Badge>
                ) : (
                  <Badge tone="amber" dot>
                    Archived
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">
                <Link to={`/projects/${p.projectId}/issues`} className="hover:text-blue-600 hover:underline font-medium">
                  📋 {p.openIssueCount} open / {p.doneIssueCount} done
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-600">
                <Link to={`/projects/${p.projectId}/documents`} className="hover:text-emerald-600 hover:underline font-medium">
                  📄 {p.documentCount} specs
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700">{p.lead?.fullName ?? '—'}</td>
              <td className="px-4 py-3">
                {p.myRole ? <Badge tone={p.myRole.code === 'PROJECT_MANAGER' ? 'brand' : 'neutral'}>{p.myRole.name}</Badge> : <span className="text-xs text-gray-400">Viewer</span>}
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">{formatRelative(p.updatedAt)}</td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={showWorkspace ? 9 : 8} className="px-4 py-10 text-center text-sm text-gray-400">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
