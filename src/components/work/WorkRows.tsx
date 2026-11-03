import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { buttonClasses } from '@/components/ui/Button'
import { documentApi } from '@/api/documentApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { projectColor, projectInitial } from '@/lib/recentProjects'
import { invalidateProjectWork } from '@/lib/useMyWork'
import type { WorkItem, WorkTone } from '@/lib/myWorkRules'
import { useI18n } from '@/i18n'

// Danh sách "Việc của tôi" (mock-sidebar-calm.html, khung 1b): ô chữ loại · tiêu đề + dòng phụ · nhãn lý do · MỘT nút.

const ICON_TONE: Record<WorkTone, string> = {
  bad: 'bg-red-50 text-red-700',
  warn: 'bg-amber-50 text-amber-700',
  blue: 'bg-brand-50 text-brand-600',
}

const PILL_TONE: Record<WorkTone, string> = {
  bad: 'border-red-200 bg-red-50 text-red-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  blue: 'border-brand-200 bg-brand-50 text-brand-700',
}

const actionClass = clsx(buttonClasses({ variant: 'secondary', inline: true }), 'lg:h-[30px] lg:px-2.5 lg:text-[13px]')

export function WorkRows({ items, showProject = false }: { items: WorkItem[]; showProject?: boolean }) {
  return (
    <ul className="divide-y divide-gray-200 overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs">
      {items.map((item) => (
        <WorkRow key={`${item.projectId}-${item.id}`} item={item} showProject={showProject} />
      ))}
    </ul>
  )
}

function WorkRow({ item, showProject }: { item: WorkItem; showProject: boolean }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const confirm = async (requirementId: number) => {
    setBusy(true)
    setError(null)
    try {
      await documentApi.confirmFresh(requirementId)
      setDone(true)
      invalidateProjectWork(item.projectId)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      className={clsx(
        'grid grid-cols-[26px_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[26px_minmax(0,1fr)_auto] sm:items-center',
        done && 'opacity-50',
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[11px] font-bold',
          ICON_TONE[item.tone],
        )}
      >
        {item.letter}
      </span>
      <div className="min-w-0">
        <Link
          to={item.action.href}
          className="block truncate text-sm font-medium text-gray-950 hover:text-brand-700 hover:underline"
        >
          {item.title}
        </Link>
        <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-gray-500">
          {showProject && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-[5px] border border-gray-200 bg-white px-1 text-xs text-gray-600">
              <span
                aria-hidden="true"
                style={{ backgroundColor: projectColor(item.projectId) }}
                className="flex h-3 w-3 items-center justify-center rounded-[3px] text-[8px] font-bold text-white"
              >
                {projectInitial(item.projectName)}
              </span>
              <span className="max-w-[9rem] truncate">{item.projectName}</span>
            </span>
          )}
          {item.code && (
            <span className="shrink-0 rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 text-xs font-medium text-gray-600">
              {item.code}
            </span>
          )}
          <span className="truncate">{item.sub}</span>
        </p>
        {error && <p className="mt-1 text-[12.5px] text-red-700">{error}</p>}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">
        <span
          className={clsx('whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium', PILL_TONE[item.tone])}
        >
          {item.reason}
        </span>
        {item.action.kind === 'confirmFresh' ? (
          done ? (
            <span className="text-[13px] text-success-700">{t('Đã xác nhận', 'Confirmed')}</span>
          ) : (
            <button
              type="button"
              disabled={busy}
              title={t(
                'Xác nhận REQ vẫn đúng sau lần duyệt mới',
                'Confirm the REQ is still valid after the new approval',
              )}
              onClick={() => void confirm((item.action as { requirementId: number }).requirementId)}
              className={actionClass}
            >
              {item.action.label}
            </button>
          )
        ) : (
          <Link to={item.action.href} className={actionClass}>
            {item.action.label}
          </Link>
        )}
      </div>
    </li>
  )
}
