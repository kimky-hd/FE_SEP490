import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { authApi } from '@/api/authApi'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { CheckIcon, LogoutIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { invalidateData } from '@/lib/dataEvents'
import { ICON, UpDownIcon, menuItemClass, useSidebarPopover, type NavItem } from './shared'

const DEMO_ROLE_ACCOUNTS = [
  { email: 'sarah@fintechcorp.com', name: 'Sarah Lin', role: 'Tenant & WS Admin' },
  { email: 'ky@fintechcorp.com', name: 'Vũ Kim Kỳ', role: 'Project Manager' },
  { email: 'minh@fintechcorp.com', name: 'Phạm Công Minh', role: 'Business Analyst (BA)' },
  { email: 'trang@fintechcorp.com', name: 'Đặng Thu Trang', role: 'Tech Lead' },
  { email: 'luong@fintechcorp.com', name: 'Phạm Minh Lương', role: 'Developer' },
  { email: 'tam@fintechcorp.com', name: 'Trương Quang Tâm', role: 'QA / Tester' },
  { email: 'quan@fintechcorp.com', name: 'Hoàng Minh Quân', role: 'UI/UX Designer' },
  { email: 'tran.c@fintechcorp.com', name: 'Trần Thị C', role: 'Reviewer (Read-only)' },
]

export function AccountMenu({
  compact,
  adminItems,
  accountHint,
}: {
  compact: boolean
  adminItems: NavItem[]
  accountHint?: string
}) {
  const { user, logout, applySession, refreshMe } = useAuth()
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useSidebarPopover(ref, buttonRef)
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null)
  const isMock = import.meta.env.VITE_USE_MOCK !== 'false'

  const handleQuickSwitch = async (email: string) => {
    if (email === user?.email || switchingEmail) return
    setSwitchingEmail(email)
    try {
      const session = await authApi.login({ email, password: 'Password@123' })
      applySession(session)
      await refreshMe()
      invalidateData()
      setOpen(false)
    } finally {
      setSwitchingEmail(null)
    }
  }

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
          {isMock && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-gray-500">
                {t('Chuyển nhanh vai trò (Demo RBAC)', 'Quick Switch Role (Demo RBAC)')}
              </p>
              <div className="max-h-48 space-y-0.5 overflow-y-auto px-1">
                {DEMO_ROLE_ACCOUNTS.map((acc) => {
                  const active = user?.email === acc.email
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={switchingEmail !== null}
                      onClick={() => void handleQuickSwitch(acc.email)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-left text-xs transition-colors',
                        active
                          ? 'bg-brand-50 font-semibold text-brand-800'
                          : 'text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      <span className="min-w-0 truncate">
                        <span className="block truncate">{acc.name}</span>
                        <span className="block truncate text-[10.5px] font-normal text-gray-500">{acc.role}</span>
                      </span>
                      {active && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                    </button>
                  )
                })}
              </div>
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
