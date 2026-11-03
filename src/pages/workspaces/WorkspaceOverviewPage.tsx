import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { permissionApi } from '@/api/roleApi'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDate } from '@/lib/format'
import { PERMISSIONS } from '@/types/rbac'
import { useWorkspaceContext } from './WorkspaceLayout'
import { useI18n } from '@/i18n'
import { permissionLabel } from '@/i18n/permissions'
import { InfoRow, StatBox } from '@/components/ui/listControls'
import { ProjectTable } from '../projects/ProjectTable'
import { TabBody, TabSection } from '@/components/layout/tabParts'

const RECENT_PROJECTS = 5

// Tab Tổng quan workspace: 3 ô số liệu, rồi "Dự án trong workspace" (bảng như trang Dự án) + "Thông tin".
// Danh sách quyền không chiếm cả một thẻ: mở bằng "Xem n quyền" trong ô Role của bạn.
export function WorkspaceOverviewPage() {
  const { workspace, can, isPersonal } = useWorkspaceContext()
  const { t } = useI18n()
  const linkClass = 'font-medium text-brand-700 hover:underline'
  const projects = useAsync(
    () => (isPersonal ? Promise.resolve([]) : projectApi.listByWorkspace(workspace.workspaceId)),
    [workspace.workspaceId, isPersonal],
  )
  const recent = (projects.data ?? [])
    .filter((p) => p.status === 'ACTIVE')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_PROJECTS)

  const info = (
    <TabSection title={t('Thông tin', 'Details')}>
      <Card className="p-5">
        {workspace.description && <p className="mb-3 text-sm text-gray-700">{workspace.description}</p>}
        <dl className="-my-2.5 divide-y divide-gray-200 text-sm">
          <InfoRow label={t('Người tạo', 'Created by')}>{workspace.createdBy.fullName}</InfoRow>
          <InfoRow label={t('Ngày tạo', 'Created')}>{formatDate(workspace.createdAt)}</InfoRow>
          <InfoRow label={t('Cập nhật lần cuối', 'Last updated')}>{formatDate(workspace.updatedAt)}</InfoRow>
          {workspace.archivedAt && (
            <InfoRow label={t('Lưu trữ lúc', 'Archived on')}>{formatDate(workspace.archivedAt)}</InfoRow>
          )}
        </dl>
      </Card>
    </TabSection>
  )

  return (
    <TabBody>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox
          label={t('Dự án', 'Projects')}
          value={workspace.projectCount}
          sub={
            !isPersonal && (
              <Link to="projects" className={linkClass}>
                {t('Xem dự án', 'View projects')}
              </Link>
            )
          }
        />
        <StatBox
          label={t('Thành viên', 'Members')}
          value={workspace.memberCount}
          sub={
            !isPersonal &&
            can(PERMISSIONS.workspaceMemberView) && (
              <Link to="members" className={linkClass}>
                {t('Xem thành viên', 'View members')}
              </Link>
            )
          }
        />
        <RoleStat />
      </div>

      {isPersonal ? (
        info
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <TabSection
            className="xl:col-span-2"
            title={t('Dự án trong workspace', 'Projects in this workspace')}
            actions={
              <Link to="projects" className={`text-sm ${linkClass}`}>
                {t('Tất cả dự án', 'All projects')} →
              </Link>
            }
          >
            {projects.isLoading && !projects.data ? (
              <LoadingBlock />
            ) : projects.error ? (
              <ErrorState message={apiErrorMessage(projects.error)} onRetry={projects.reload} />
            ) : (
              <ProjectTable projects={recent} emptyText={t('Chưa có dự án nào.', 'No projects yet.')} />
            )}
          </TabSection>
          {info}
        </div>
      )}
    </TabBody>
  )
}

/** Ô "Role của bạn": số quyền mở một popover nhỏ liệt kê quyền (thay cho thẻ danh sách dài). */
function RoleStat() {
  const { workspace, isPersonal } = useWorkspaceContext()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const catalog = useAsync(() => permissionApi.list('WORKSPACE'), [])
  const myPermissions = (catalog.data ?? []).filter((p) => workspace.myPermissions.includes(p.key))
  const count = workspace.myPermissions.length

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <StatBox
        label={t('Role của bạn', 'Your role')}
        value={
          <span className="text-xl">
            {workspace.myRole?.name ?? (isPersonal ? t('Cá nhân', 'Personal') : t('Chỉ xem', 'View only'))}
          </span>
        }
        sub={
          count === 0 ? (
            t('Chỉ có quyền xem', 'View-only access')
          ) : (
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="my-permissions-popover"
              className="font-medium text-brand-700 hover:underline"
            >
              {t(`Xem ${count} quyền`, `View ${count} ${count === 1 ? 'permission' : 'permissions'}`)}
            </button>
          )
        }
      />
      {open && (
        <div
          id="my-permissions-popover"
          className="absolute right-0 top-full z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-card border border-gray-200 bg-white p-3 shadow-pop"
        >
          {catalog.isLoading && !catalog.data ? (
            <p className="text-sm text-gray-500">{t('Đang tải…', 'Loading…')}</p>
          ) : (
            <ul className="space-y-1.5">
              {myPermissions.map((p) => (
                <li key={p.key} className="text-sm text-gray-800" title={p.key}>
                  {permissionLabel(p.key, p.name)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
