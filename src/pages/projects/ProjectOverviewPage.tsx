import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionTitle } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { projectApi } from '@/api/projectApi'
import { documentApi } from '@/api/documentApi'
import { useAsync } from '@/lib/useAsync'
import { formatDate } from '@/lib/format'
import { PERMISSIONS } from '@/types/rbac'
import type { ProjectMemberDto } from '@/types/project'
import { SDLC_LABEL } from './ProjectTable'
import { useProjectContext } from './ProjectLayout'

// Tab Tổng quan — mockup "Chi tiết Dự án": 4 ô số liệu, "Thông tin dự án" (Issue Key prefix, Workflow đang dùng, Module AI,
// Tạo lúc), "Thành viên dự án" (+ Thêm thành viên). "Hoạt động gần đây" cần module Issue/Tài liệu → thay bằng pipeline phase.
export function ProjectOverviewPage() {
  const { project, can } = useProjectContext()
  const canSeeMembers = can(PERMISSIONS.projectView)
  const members = useAsync<ProjectMemberDto[]>(
    () => (canSeeMembers ? projectApi.listMembers(project.projectId) : Promise.resolve([])),
    [project.projectId, canSeeMembers],
  )
  const workflow = useAsync(() => projectApi.workflow(project.projectId), [project.projectId])
  const docStats = useAsync(() => documentApi.getProjectStats(project.projectId), [project.projectId])
  const activePhases = (workflow.data?.phases ?? []).filter((p) => p.isActive)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Issue mở / đóng" value={`${project.openIssueCount} / ${project.doneIssueCount}`} hint="Module Issue sắp ra mắt" />
        <Link to="documents" className="block hover:opacity-90 transition-opacity">
          <Stat
            label="Tài liệu"
            value={docStats.data?.totalDocs ?? project.documentCount}
            hint={`${docStats.data?.approvedDocs ?? 0} đã duyệt · ${docStats.data?.totalItems ?? 0} mục yêu cầu`}
          />
        </Link>
        <Stat label="Testcase" value="—" hint="Module Testcase sắp ra mắt" />
        <Stat label="Thành viên" value={project.memberCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Thông tin dự án</SectionTitle>
          <dl className="mt-3 divide-y divide-gray-100 text-sm">
            <Row label="Issue Key prefix">
              <span className="font-mono">{project.key}-</span>
            </Row>
            <Row label="Workflow đang dùng">
              <Link to="workflow" className="text-brand-700 hover:underline">
                {SDLC_LABEL[project.sdlcMethod]} · {project.phaseCount} phase
              </Link>
            </Row>
            <Row label="Module AI (BA/QA)">{project.aiEnabled ? <Badge tone="brand">Bật</Badge> : <Badge>Tắt</Badge>}</Row>
            <Row label="Project Manager">{project.lead?.fullName ?? '—'}</Row>
            <Row label="Tạo bởi">{project.createdBy.fullName}</Row>
            <Row label="Tạo lúc">{formatDate(project.createdAt)}</Row>
          </dl>
        </Card>

        <Card className="p-4">
          <SectionTitle>Thành viên dự án</SectionTitle>
          {!canSeeMembers ? (
            <p className="mt-3 text-sm text-gray-400">Bạn không có quyền xem thành viên dự án.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {(members.data ?? []).slice(0, 6).map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-gray-800">{m.fullName}</span>
                  <span className="text-gray-500">{m.role.name}</span>
                </li>
              ))}
              {members.isLoading && !members.data && <li className="py-2 text-gray-400">Đang tải…</li>}
            </ul>
          )}
          {can(PERMISSIONS.projectMemberManage) && project.status === 'ACTIVE' ? (
            <Link to="members?add=1" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
              + Thêm thành viên vào dự án
            </Link>
          ) : (
            canSeeMembers &&
            project.memberCount > 6 && (
              <Link to="members" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
                Xem tất cả {project.memberCount} thành viên →
              </Link>
            )
          )}
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle description="Thứ tự giai đoạn SDLC và trạng thái issue trong từng giai đoạn.">Pipeline phase</SectionTitle>
        <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {activePhases.map((phase, index) => (
            <li key={phase.phaseId} className="rounded-md border border-gray-200 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">Phase {index + 1}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">{phase.name}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {phase.statuses
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <span key={s.statusId} className="inline-flex items-center gap-1 rounded-sm border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-700">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color ?? '#a8a29e' }} />
                      {s.name}
                    </span>
                  ))}
              </div>
            </li>
          ))}
          {workflow.isLoading && !workflow.data && <li className="text-sm text-gray-400">Đang tải…</li>}
        </ol>
      </Card>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{children}</dd>
    </div>
  )
}
