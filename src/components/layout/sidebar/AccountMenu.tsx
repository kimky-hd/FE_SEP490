import { useRef } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { LogoutIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { ICON, UpDownIcon, menuItemClass, useSidebarPopover, type NavItem } from './shared'

export function AccountMenu({
  compact,
  adminItems,
  accountHint,
}: {
  compact: boolean
  adminItems: NavItem[]
  accountHint?: string
}) {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useSidebarPopover(ref, buttonRef)

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div
          id="account-menu"
          className="absolute bottom-full left-0 z-30 mb-1 w-full min-w-[15rem] rounded-card border border-gray-200 bg-white p-1.5 shadow-pop"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar name={user?.fullName ?? '?'} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-950">{user?.fullName}</p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="my-1 border-t border-gray-100" />
          <div className="flex min-h-11 items-center justify-between gap-3 px-2.5 lg:min-h-9">
            <span className="text-sm text-gray-700">{t('Ngôn ngữ', 'Language')}</span>
            <LanguageSwitch />
          </div>
          {adminItems.length > 0 && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <p className="px-2.5 pb-1 pt-1.5 text-xs text-gray-500">{t('Quản trị', 'Admin')}</p>
              {adminItems.map(
                (item) =>
                  item.to && (
                    <Link key={item.label} to={item.to} className={menuItemClass}>
                      <span className="text-gray-500">{item.icon}</span>
                      {item.label}
                    </Link>
                  ),
              )}
            </>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={() => void logout()}
            className={clsx(menuItemClass, 'text-red-700 hover:bg-red-50 hover:text-red-800')}
          >
            <LogoutIcon className={ICON} />
            {t('Đăng xuất', 'Log out')}
          </button>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t('Tài khoản và cài đặt', 'Account and settings')}
        title={compact ? user?.fullName : undefined}
        className={clsx(
          'flex items-center rounded-control border text-left transition-colors',
          compact ? 'h-10 w-10 justify-center' : 'min-h-11 w-full gap-2.5 px-2 py-1.5',
          open ? 'border-gray-200 bg-white shadow-xs' : 'border-transparent hover:bg-gray-200/60',
        )}
      >
        <Avatar name={user?.fullName ?? '?'} size="sm" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight text-gray-950">{user?.fullName}</span>
              <span className="block truncate text-xs text-gray-500">{accountHint || user?.email}</span>
            </span>
            <UpDownIcon />
          </>
        )}
      </button>
    </div>
  )
}
