import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionTitle } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { DocumentIcon, FolderIcon, ListChecksIcon, UsersIcon } from '@/components/ui/icons'
import { permissionApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { formatDate } from '@/lib/format'
import { PERMISSIONS } from '@/types/rbac'
import { useWorkspaceContext } from './WorkspaceLayout'

// Tab Tổng quan (FR §III.4.4 / UC-22). Số tài liệu & testcase thuộc module sau nên để "Sớm".
export function WorkspaceOverviewPage() {
  const { workspace, can, isPersonal } = useWorkspaceContext()
  const catalog = useAsync(() => permissionApi.list('WORKSPACE'), [])
  const myPermissions = (catalog.data ?? []).filter((p) => workspace.myPermissions.includes(p.key))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<FolderIcon className="h-4 w-4" />} label="Dự án" value={workspace.projectCount} to={isPersonal ? undefined : 'projects'} />
        <StatTile
          icon={<UsersIcon className="h-4 w-4" />}
          label="Thành viên"
          value={workspace.memberCount}
          to={!isPersonal && can(PERMISSIONS.workspaceMemberView) ? 'members' : undefined}
        />
        <StatTile icon={<DocumentIcon className="h-4 w-4" />} label="Tài liệu" value="—" soon />
        <StatTile icon={<ListChecksIcon className="h-4 w-4" />} label="Testcase" value="—" soon />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-3">
          <SectionTitle>Thông tin workspace</SectionTitle>
          <dl className="mt-3 divide-y divide-gray-100 text-sm">
            <InfoRow label="Mã (code)">
              <span className="font-mono text-gray-800">{workspace.code}</span>
            </InfoRow>
            <InfoRow label="Người tạo">{workspace.createdBy.fullName}</InfoRow>
            <InfoRow label="Ngày tạo">{formatDate(workspace.createdAt)}</InfoRow>
            <InfoRow label="Cập nhật lần cuối">{formatDate(workspace.updatedAt)}</InfoRow>
            <InfoRow label="Trạng thái">
              {workspace.status === 'ACTIVE' ? (
                <Badge tone="brand" dot>
                  Đang hoạt động
                </Badge>
              ) : (
                <Badge tone="amber" dot>
                  Đã lưu trữ {formatDate(workspace.archivedAt)}
                </Badge>
              )}
            </InfoRow>
          </dl>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <SectionTitle description="Quyền hiệu lực của bạn — do role trong workspace quyết định.">
            Quyền của bạn {workspace.myRole && <span className="font-normal text-gray-500">· {workspace.myRole.name}</span>}
          </SectionTitle>
          {myPermissions.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">{catalog.isLoading ? 'Đang tải…' : 'Bạn chỉ có quyền xem.'}</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {myPermissions.map((p) => (
                <li key={p.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-gray-700">{p.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-gray-400">{p.key}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  to,
  soon,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  to?: string
  soon?: boolean
}) {
  const content = (
    <>
      <div className="flex items-center justify-between text-gray-400">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      {soon && <p className="mt-0.5 text-[11px] text-gray-400">Module đang phát triển</p>}
    </>
  )
  const className = 'block rounded-md border border-gray-200 bg-white p-4'
  return to ? (
    <Link to={to} className={`${className} transition-colors hover:border-brand-300`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{children}</dd>
    </div>
  )
}
