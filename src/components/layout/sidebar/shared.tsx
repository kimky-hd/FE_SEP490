import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BuildingIcon,
  FolderIcon,
  HomeIcon,
  ListChecksIcon,
  MailIcon,
  ShieldIcon,
  UsersIcon,
} from '@/components/ui/icons'
import { PERMISSIONS } from '@/types/rbac'

export interface NavItem {
  label: string
  icon: ReactNode
  to?: string
  comingSoon?: boolean
  /** Mục active khi pathname bắt đầu bằng prefix này (mặc định so khớp tuyệt đối với `to`). */
  activePrefix?: string
  /** Chỉ hiện khi người dùng có quyền cấp công ty này. */
  permission?: string
}

type T = (vi: string, en: string) => string

export const ICON = 'h-[18px] w-[18px]'

/** Module Testcase chưa nằm trong phạm vi: đặt `true` để hiện lại mục "Testcase · Sắp có" trên sidebar. */
const SHOW_TESTCASE_NAV = false

export const getNavItems = (t: T): NavItem[] => [
  { label: t('Tổng quan', 'Overview'), icon: <HomeIcon className={ICON} />, to: '/' },
  {
    label: t('Workspace', 'Workspaces'),
    icon: <BuildingIcon className={ICON} />,
    to: '/workspaces',
    activePrefix: '/workspaces',
  },
  { label: t('Dự án', 'Projects'), icon: <FolderIcon className={ICON} />, to: '/projects', activePrefix: '/projects' },
  ...(SHOW_TESTCASE_NAV
    ? [{ label: t('Testcase', 'Test cases'), icon: <ListChecksIcon className={ICON} />, comingSoon: true }]
    : []),
]

// Nhóm "Quản trị công ty" trên sidebar chung, chia theo quyền cấp công ty (Tenant Admin / role tự định nghĩa có quyền
// quản trị mới thấy; thành viên thường không thấy nhóm này). Trong dự án / dải icon thì vẫn mở từ menu avatar.
export const getAdminNavItems = (t: T): NavItem[] => [
  {
    label: t('Người dùng', 'Users'),
    icon: <UsersIcon className={ICON} />,
    to: '/admin/users',
    activePrefix: '/admin/users',
    permission: PERMISSIONS.userView,
  },
  {
    label: t('Vai trò & quyền', 'Roles & permissions'),
    icon: <ShieldIcon className={ICON} />,
    to: '/admin/roles',
    activePrefix: '/admin/roles',
    permission: PERMISSIONS.roleView,
  },
  {
    label: t('Mời thành viên', 'Invite members'),
    icon: <MailIcon className={ICON} />,
    to: '/members/invite',
    activePrefix: '/members/invite',
    permission: PERMISSIONS.userInvite,
  },
]

export const menuItemClass =
  'flex min-h-11 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-950 lg:min-h-9'

/** Đóng popover khi click ra ngoài, bấm Esc (trả focus về nút mở) hoặc đổi trang. */
export function useSidebarPopover(ref: RefObject<HTMLElement>, buttonRef: RefObject<HTMLButtonElement>) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
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
  }, [open, ref, buttonRef])
  useEffect(() => setOpen(false), [location.pathname])
  return [open, setOpen] as const
}

export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0))
      .join('')
      .toUpperCase() || '?'
  )
}

export function UpDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-gray-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  )
}
