import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ErrorState } from '@/components/layout/PageParts'
import { WorkRows } from '@/components/work/WorkRows'
import { actionableCount, workSummary } from '@/lib/myWorkRules'
import { refreshProjectWorkIfOlder } from '@/lib/useMyWork'
import { apiErrorMessage } from '@/lib/apiErrors'
import { useI18n } from '@/i18n'
import { callName } from '../dashboard/homeParts'
import { useProjectContext } from './ProjectLayout'

// /projects/:id/my-work — trang mặc định khi mở dự án: MỘT danh sách việc theo vai trò, sắp theo mức gấp.
export function ProjectMyWorkPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { project, role, work } = useProjectContext()
  const { items, loading } = work
  const n = actionableCount(items)
  const name = callName(user?.fullName)

  // Quay lại trang sau khi duyệt / sửa ở tab Tài liệu → tải lại nếu dữ liệu đã cũ.
  useEffect(() => refreshProjectWorkIfOlder(project.projectId), [project.projectId])

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold tracking-tight text-gray-950">
        {loading
          ? t(`Chào ${name}`, `Hi ${name}`)
          : n > 0
            ? t(`Chào ${name}, ${n} việc cho bạn`, `Hi ${name}, ${n} ${n === 1 ? 'thing' : 'things'} for you`)
            : t(`Chào ${name}`, `Hi ${name}`)}
      </h2>
      <p className="mt-0.5 text-sm text-gray-500">{loading ? ' ' : workSummary(items, t, role)}</p>

      <div className="mt-4">
        {work.error ? (
          <ErrorState message={apiErrorMessage(work.error)} onRetry={work.reload} />
        ) : loading ? (
          <ul
            aria-busy="true"
            className="divide-y divide-gray-200 overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs"
          >
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-4">
                <span className="h-[26px] w-[26px] rounded-[7px] bg-gray-100" />
                <span className="h-4 w-56 rounded bg-gray-100" />
              </li>
            ))}
          </ul>
        ) : items.length > 0 ? (
          <WorkRows items={items} />
        ) : (
          <p className="rounded-card border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 shadow-xs">
            {t('Không có việc nào cần bạn lúc này.', 'Nothing needs you right now.')}
          </p>
        )}
      </div>
    </div>
  )
}
