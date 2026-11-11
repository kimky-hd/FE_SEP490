import { Link } from 'react-router-dom'
import { Card } from '@/components/layout/PageParts'
import { Avatar } from '@/components/ui/Avatar'
import { buttonClasses } from '@/components/ui/Button'
import { projectApi } from '@/api/projectApi'
import { documentApi } from '@/api/documentApi'
import { useAsync } from '@/lib/useAsync'
import { formatDate, formatRelative } from '@/lib/format'
import { PERMISSIONS } from '@/types/rbac'
import type { ProjectMemberDto } from '@/types/project'
import type { DocumentNodeDto } from '@/types/document'
import { useI18n } from '@/i18n'
import { useProjectContext } from './ProjectLayout'
import { sdlcLabel } from './ProjectTable'
import { CodeChip, InfoRow, StatBox, tableWrap, th, theadRow } from '@/components/ui/listControls'
import { StatusPill } from '../documents/docUi'
import { TabBody, TabSection } from '@/components/layout/tabParts'

// Tab Tổng quan: 4 ô số liệu (Tài liệu · Yêu cầu · Chờ duyệt · Thành viên), rồi Tài liệu gần đây bên trái,
// Thông tin dự án + thành viên bên phải. Giai đoạn chi tiết nằm ở tab Workflow (không lặp lại ở đây).
export function ProjectOverviewPage() {
  const { t } = useI18n()
  const { project, can } = useProjectContext()
  const canSeeMembers = can(PERMISSIONS.projectView)
  const canSeeDocs = can(PERMISSIONS.documentView)
  const members = useAsync<ProjectMemberDto[]>(
    () => (canSeeMembers ? projectApi.listMembers(project.projectId) : Promise.resolve([])),
    [project.projectId, canSeeMembers],
  )
  const docs = useAsync<DocumentNodeDto[]>(
    () => (canSeeDocs ? documentApi.listTree(project.projectId) : Promise.resolve([])),
    [project.projectId, canSeeDocs],
  )
  const pages = (docs.data ?? []).filter((n) => n.kind === 'PAGE')
  const recent = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)
  const reqTotal = pages.reduce((sum, n) => sum + n.reqCount, 0)
  const inReview = pages.filter((n) => n.currentVersion?.status === 'IN_REVIEW').length
  const docsReady = canSeeDocs && docs.data !== undefined
  const num = (v: number) => (docsReady ? v : '—')
  const linkClass = 'font-medium text-brand-700 hover:underline'
  const canAddMembers = can(PERMISSIONS.projectMemberManage) && project.status === 'ACTIVE'
  const docsHref = `/projects/${project.projectId}/documents`

  return (
    <TabBody>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox
          label={t('Tài liệu', 'Documents')}
          value={num(pages.length)}
          sub={
            canSeeDocs && (
              <Link to={docsHref} className={linkClass}>
                {t('Mở tài liệu', 'Open documents')}
              </Link>
            )
          }
        />
        <StatBox
          label={t('Yêu cầu (REQ)', 'Requirements (REQ)')}
          value={num(reqTotal)}
          sub={canSeeDocs && <span>{t('trong các trang đặc tả', 'across spec pages')}</span>}
        />
        <StatBox
          label={t('Chờ duyệt', 'In review')}
          value={num(inReview)}
          sub={
            canSeeDocs &&
            (inReview > 0 ? (
              <Link
                to={`${docsHref}/${pages.find((n) => n.currentVersion?.status === 'IN_REVIEW')?.documentId}`}
                className={linkClass}
              >
                {t('Xem trang chờ duyệt', 'Open a page in review')}
              </Link>
            ) : (
              <span>{t('Không có trang nào', 'Nothing waiting')}</span>
            ))
          }
        />
        <StatBox
          label={t('Thành viên', 'Members')}
          value={project.memberCount}
          sub={
            canAddMembers ? (
              <Link to="members?add=1" className={linkClass}>
                {t('Thêm thành viên', 'Add members')}
              </Link>
            ) : (
              canSeeMembers && (
                <Link to="members" className={linkClass}>
                  {t('Xem thành viên', 'View members')}
                </Link>
              )
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <TabSection
          className="xl:col-span-2"
          title={t('Tài liệu gần đây', 'Recent documents')}
          caption={docsReady && pages.length > 0 ? String(pages.length) : undefined}
          actions={
            canSeeDocs &&
            pages.length > 0 && (
              <Link to={docsHref} className={buttonClasses({ variant: 'secondary', inline: true })}>
                {t('Xem tất cả', 'View all')}
              </Link>
            )
          }
        >
          <div className={tableWrap}>
            {!canSeeDocs ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">
                {t('Bạn chưa có quyền xem tài liệu của dự án này.', "You can't view this project's documents yet.")}
              </p>
            ) : docs.isLoading && !docs.data ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">{t('Đang tải…', 'Loading…')}</p>
            ) : recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">
                {t('Chưa có tài liệu.', 'No documents yet.')}{' '}
                <Link to={docsHref} className={linkClass}>
                  {t('Bắt đầu tài liệu', 'Start documenting')}
                </Link>
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="hidden sm:table-header-group">
                  <tr className={theadRow}>
                    <th className={th}>{t('Trang', 'Page')}</th>
                    <th className={th}>{t('Trạng thái', 'Status')}</th>
                    <th className={`${th} text-right`}>{t('Cập nhật', 'Updated')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recent.map((n) => (
                    <tr
                      key={n.documentId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-gray-50 sm:table-row sm:p-0"
                    >
                      <td className="w-full min-w-0 sm:w-auto sm:px-4 sm:py-3">
                        <Link
                          to={`${docsHref}/${n.documentId}`}
                          className="flex min-w-0 items-center gap-2 font-medium text-gray-950 hover:underline"
                        >
                          <span className="truncate">{n.title}</span>
                          {n.code && <CodeChip>{n.code}</CodeChip>}
                        </Link>
                      </td>
                      <td className="sm:px-4 sm:py-3">
                        {n.currentVersion && <StatusPill status={n.currentVersion.status} />}
                      </td>
                      <td className="text-xs text-gray-500 sm:px-4 sm:py-3 sm:text-right sm:text-sm">
                        {formatRelative(n.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabSection>

        <TabSection title={t('Thông tin dự án', 'Project details')}>
          <Card className="p-5">
            {project.description && <p className="mb-2 text-sm text-gray-700">{project.description}</p>}
            <dl className="divide-y divide-gray-200 text-sm">
              <InfoRow label="Project Manager">{project.lead?.fullName ?? '—'}</InfoRow>
              <InfoRow label={t('Phương pháp', 'Methodology')}>{sdlcLabel(project.sdlcMethod)}</InfoRow>
              <InfoRow label={t('Giai đoạn', 'Phases')}>
                {project.phaseCount} ·{' '}
                <Link to="workflow" className={linkClass}>
                  {t('Xem workflow', 'View workflow')}
                </Link>
              </InfoRow>
              <InfoRow label={t('Tạo bởi', 'Created by')}>
                {project.createdBy.fullName} ·{' '}
                <span className="font-normal text-gray-500">{formatDate(project.createdAt)}</span>
              </InfoRow>
            </dl>

            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-950">{t('Thành viên', 'Members')}</p>
                {canSeeMembers && project.memberCount > 5 && (
                  <Link to="members" className={`text-sm ${linkClass}`}>
                    {t(`Xem tất cả ${project.memberCount}`, `View all ${project.memberCount}`)}
                  </Link>
                )}
              </div>
              {!canSeeMembers ? (
                <p className="mt-2 text-sm text-gray-500">
                  {t('Bạn không có quyền xem thành viên dự án.', "You don't have permission to view project members.")}
                </p>
              ) : (
                <ul className="mt-1 text-sm">
                  {(members.data ?? []).slice(0, 5).map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={m.fullName} size="sm" />
                        <span className="truncate text-gray-900">{m.fullName}</span>
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">{m.role.name}</span>
                    </li>
                  ))}
                  {members.isLoading && !members.data && (
                    <li className="py-2 text-gray-500">{t('Đang tải…', 'Loading…')}</li>
                  )}
                </ul>
              )}
            </div>
          </Card>
        </TabSection>
      </div>
    </TabBody>
  )
}
