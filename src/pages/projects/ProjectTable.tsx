import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { formatRelative } from '@/lib/format'
import { tr, useI18n } from '@/i18n'
import type { ProjectDto, SdlcMethod } from '@/types/project'
import { CodeChip, tableWrap, th, theadRow } from '@/components/ui/listControls'

// Nhãn tiếng Việt cố định — giữ cho chỗ cũ còn import; code mới dùng `sdlcLabel()` (đổi theo ngôn ngữ).
export const SDLC_LABEL: Record<SdlcMethod, string> = {
  SCRUM: 'Agile Scrum',
  KANBAN: 'Kanban',
  WATERFALL: 'Thác nước (Waterfall)',
  ITERATIVE: 'Lặp & Tăng dần (Iterative)',
  V_MODEL: 'Mô hình chữ V (V-Model)',
  SPIRAL: 'Mô hình Xoắn ốc (Spiral)',
  RAD: 'Phát triển nhanh (RAD)',
  CUSTOM: 'SDLC tuỳ chỉnh',
}

export function sdlcLabel(method: SdlcMethod): string {
  if (method === 'CUSTOM') return tr('SDLC tuỳ chỉnh', 'Custom SDLC')
  return SDLC_LABEL[method]
}

// Bảng dự án: tối đa 5 cột. Tên + mã nằm chung một ô (mã là chip xám), phương pháp là dòng phụ.
// Không có cột Trạng thái: danh sách luôn được lọc theo một trạng thái ở trên (bộ lọc đã nói rõ).
// Cột Issue / Tài liệu được bỏ cho tới khi các module đó có thật.
export function ProjectTable({
  projects,
  emptyText,
  showWorkspace,
}: {
  projects: ProjectDto[]
  emptyText: string
  showWorkspace?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className={tableWrap}>
      <table className="w-full text-sm">
        <thead className="hidden sm:table-header-group">
          <tr className={theadRow}>
            <th className={th}>{t('Dự án', 'Project')}</th>
            {showWorkspace && <th className={clsx(th, 'hidden md:table-cell')}>Workspace</th>}
            <th className={clsx(th, 'hidden lg:table-cell')}>{t('Phụ trách', 'Lead')}</th>
            <th className={th}>{t('Role của bạn', 'Your role')}</th>
            <th className={clsx(th, 'text-right')}>{t('Cập nhật', 'Updated')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {projects.map((p) => (
            <tr
              key={p.projectId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-gray-50 sm:table-row sm:p-0"
            >
              <td className="block w-full sm:table-cell sm:w-auto sm:px-4 sm:py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    to={`/projects/${p.projectId}`}
                    className="truncate font-medium text-gray-950 hover:text-brand-700 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <CodeChip>{p.key}</CodeChip>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {sdlcLabel(p.sdlcMethod)} · {p.phaseCount} {t('giai đoạn', p.phaseCount === 1 ? 'phase' : 'phases')}
                  {/* Màn hẹp: workspace không có cột riêng nên nối vào dòng phụ. */}
                  {showWorkspace && <span className="md:hidden"> · {p.workspaceName}</span>}
                </p>
              </td>
              {showWorkspace && <td className="hidden px-4 py-3 text-gray-700 md:table-cell">{p.workspaceName}</td>}
              <td className="hidden px-4 py-3 text-gray-700 lg:table-cell">
                {p.lead?.fullName ?? <span className="text-gray-500">—</span>}
              </td>
              <td className="block sm:table-cell sm:px-4 sm:py-3">
                {p.myRole ? (
                  <Badge>{p.myRole.name}</Badge>
                ) : (
                  <span className="text-xs text-gray-500">{t('Chỉ xem', 'View only')}</span>
                )}
              </td>
              <td className="ml-auto block text-right text-xs text-gray-500 sm:table-cell sm:px-4 sm:py-3">
                {formatRelative(p.updatedAt)}
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={showWorkspace ? 5 : 4} className="px-4 py-10 text-center text-sm text-gray-500">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
