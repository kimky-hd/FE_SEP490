import { useRef } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { CheckIcon, PlusIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import type { WorkspaceSummaryDto } from '@/types/auth'
import { UpDownIcon, initialsOf, menuItemClass, useSidebarPopover } from './shared'

/** Bộ chuyển workspace ở đầu sidebar: chỉ để đổi phạm vi làm việc. */
export function WorkspaceSwitcher({
  companyName,
  workspaces,
  activeWorkspace,
}: {
  companyName: string
  workspaces: WorkspaceSummaryDto[]
  activeWorkspace: WorkspaceSummaryDto | undefined
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useSidebarPopover(ref, buttonRef)

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="workspace-switcher-list"
        aria-label={`${t('Chuyển workspace. Đang ở', 'Switch workspace. Current')}: ${activeWorkspace ? activeWorkspace.workspaceName : t('chưa chọn', 'none selected')}`}
        className={clsx(
          'flex min-h-11 w-full items-center gap-2.5 rounded-control border px-2 py-1.5 text-left transition-colors',
          open ? 'border-gray-200 bg-white shadow-xs' : 'border-transparent hover:bg-gray-200/60',
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-brand-600 text-xs font-bold text-white">
          {initialsOf(companyName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight text-gray-950">{companyName}</span>
          <span className="block truncate text-xs text-gray-500">
            {activeWorkspace ? activeWorkspace.workspaceName : t('Chọn workspace', 'Choose workspace')}
          </span>
        </span>
        <UpDownIcon />
      </button>
      {open && (
        <div
          id="workspace-switcher-list"
          className="absolute left-0 top-full z-30 mt-1 w-full min-w-[15rem] rounded-card border border-gray-200 bg-white p-1.5 shadow-pop"
        >
          <p className="px-2.5 pb-1 pt-1 text-xs text-gray-500">Workspace</p>
          {workspaces.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-gray-600">
              {t('Bạn chưa tham gia workspace nào.', 'You have not joined any workspace yet.')}
            </p>
          )}
          {workspaces.map((w) => {
            const current = w.workspaceId === activeWorkspace?.workspaceId
            return (
              <Link
                key={w.workspaceId}
                to={`/workspaces/${w.workspaceId}`}
                className={clsx(menuItemClass, current && 'bg-gray-100 text-gray-950')}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-gray-200 text-[10px] font-bold text-gray-700">
                  {initialsOf(w.workspaceName)}
                </span>
                <span className="min-w-0 flex-1 truncate">{w.workspaceName}</span>
                {current && <CheckIcon className="h-4 w-4 shrink-0 text-brand-600" />}
              </Link>
            )
          })}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <Link to="/workspaces" className={menuItemClass}>
              <PlusIcon className="h-4 w-4 text-gray-500" />
              {t('Tất cả workspace', 'All workspaces')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
