import { useEffect, useRef, useState, type ReactNode, type SVGProps } from 'react'
import clsx from 'clsx'
import { tr } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import { ApiError } from '@/lib/apiClient'
import type { DocType, Priority, VersionStatus } from '@/types/document'

// Mảnh ghép dùng chung cho module Tài liệu: nhãn trạng thái, popover menu, icon nhỏ.

export const statusLabel = (s: VersionStatus) =>
  ({
    DRAFT: tr('Nháp', 'Draft'),
    IN_REVIEW: tr('Chờ duyệt', 'In review'),
    CHANGES_REQUESTED: tr('Cần chỉnh sửa', 'Changes requested'),
    APPROVED: tr('Đã duyệt', 'Approved'),
    SUPERSEDED: tr('Đã thay thế', 'Superseded'),
  })[s]

const statusTone: Record<VersionStatus, string> = {
  DRAFT: 'border-gray-200 bg-gray-50 text-gray-700',
  IN_REVIEW: 'border-brand-200 bg-brand-50 text-brand-800',
  CHANGES_REQUESTED: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-success-200 bg-success-50 text-success-700',
  SUPERSEDED: 'border-gray-200 bg-white text-gray-500',
}

export const pillClass = (status: VersionStatus, muted = false) =>
  clsx(
    'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
    muted ? 'border-gray-200 bg-gray-50 text-gray-500' : statusTone[status],
  )

export function StatusPill({ status, children }: { status: VersionStatus; children?: ReactNode }) {
  return <span className={pillClass(status)}>{children ?? statusLabel(status)}</span>
}

export const priorityLabel = (p: Priority) =>
  ({ HIGH: tr('Cao', 'High'), MEDIUM: tr('TB', 'Med'), LOW: tr('Thấp', 'Low') })[p]

export const docTypeLabel = (d: DocType) => (d === 'OTHER' ? tr('Khác', 'Other') : d)
export const DOC_TYPES: DocType[] = ['SRS', 'URD', 'BRD', 'OTHER']

/** Chip mã nhỏ (SRS-02, REQ-01). */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 text-xs font-medium tabular-nums text-gray-600',
        className,
      )}
    >
      {children}
    </span>
  )
}

const ERRORS: Record<string, () => string> = {
  VERSION_LOCKED: () => tr('Phiên bản đã khoá, không sửa được.', 'This version is locked.'),
  VERSION_CONFLICT: () => tr('Người khác vừa lưu trang này.', 'Someone else just saved this page.'),
  INVALID_STATUS: () =>
    tr('Trạng thái phiên bản đã thay đổi, hãy tải lại trang.', 'The version status changed. Reload the page.'),
  NO_REQUIREMENTS: () =>
    tr('Cần ít nhất 1 yêu cầu (REQ) trước khi gửi duyệt.', 'Add at least 1 requirement (REQ) before submitting.'),
  OPEN_VERSION_EXISTS: () => tr('Trang đang có một bản chưa duyệt.', 'This page already has an open version.'),
  NO_BASELINE: () => tr('Trang chưa có bản đã duyệt.', 'This page has no approved version yet.'),
  SELF_APPROVAL_NOT_ALLOWED: () => tr('Bạn không thể tự duyệt bản mình gửi.', "You can't approve your own submission."),
  // Đề xuất BE (doc/Documents-API-Contract.md §7.2): chặn phê duyệt khi bản còn góp ý gốc chưa xử lý.
  OPEN_COMMENTS: () =>
    tr(
      'Bản này còn góp ý chưa xử lý — xử lý hết rồi mới phê duyệt được.',
      'This version still has open comments — resolve them before approving.',
    ),
  AI_DISABLED: () => tr('Dự án đang tắt module AI.', 'The AI module is off for this project.'),
  AI_UNAVAILABLE: () => tr('Dịch vụ AI đang lỗi, thử lại sau.', 'The AI service is unavailable. Try again later.'),
  INVALID_PARENT: () => tr('Không thể chuyển vào vị trí này.', "Can't move it there."),
  INVALID_CONTENT: () => tr('Nội dung không hợp lệ.', 'The content is invalid.'),
  DOCUMENT_NOT_FOUND: () => tr('Không tìm thấy tài liệu.', 'Document not found.'),
  VERSION_NOT_FOUND: () => tr('Không tìm thấy phiên bản.', 'Version not found.'),
}

export function docErrorMessage(error: unknown) {
  if (error instanceof ApiError && ERRORS[error.code]) return ERRORS[error.code]()
  return apiErrorMessage(error)
}

export const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : null)

/** Popover đóng khi click ra ngoài / Esc. */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  return { open, setOpen, ref }
}

export const menuPanel = 'absolute z-30 mt-1 min-w-[12rem] rounded-card border border-gray-200 bg-white p-1 shadow-pop'
export const menuItem =
  'flex min-h-10 w-full items-center gap-2 rounded-[6px] px-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-950 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent lg:min-h-8'

/** Nút icon vuông nhỏ có tooltip (title) và aria-label. */
export function IconButton({
  label,
  children,
  className,
  active,
  ...rest
}: { label: string; active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40',
        active && 'bg-gray-100 text-gray-900',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------- Icon bổ sung (line, 24 viewBox, currentColor) ----------

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export const ChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)
export const MoreIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
)
export const PageIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </svg>
)
export const ArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)
export const ArrowDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)
export const SidebarIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </svg>
)
export const TableIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 4v16" />
  </svg>
)
export const DiagramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="6" rx="1" />
    <rect x="14" y="15" width="7" height="6" rx="1" />
    <path d="M6.5 9v4a2 2 0 0 0 2 2H14" />
  </svg>
)
export const FigmaIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 3h3v6H9a3 3 0 0 1 0-6zM12 3h3a3 3 0 0 1 0 6h-3V3zM9 9h3v6H9a3 3 0 0 1 0-6zM12 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM9 15h3v3a3 3 0 1 1-3-3z" />
  </svg>
)
export const CommentIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
)
/** ⤢ Toàn màn hình. */
export const ExpandIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
)
/** ⤡ Thoát toàn màn hình. */
export const ShrinkIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
  </svg>
)
