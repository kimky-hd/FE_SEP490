import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { useI18n } from '@/i18n'

// Khung chung cho mọi trang Auth/Onboarding/Invite.
// v5: bố cục căn giữa theo mockup — nền trắng với quầng xanh nhạt phía trên, thanh trên cùng (logo + ngôn ngữ),
// một thẻ trắng (viền mảnh + shadow-xs) chứa tiêu đề, một dòng mô tả và form; liên kết phụ nằm dưới thẻ.
export function AuthCard({
  children,
  headerRight,
  title,
  description,
  icon,
  footer,
  // 440px: đủ cho nút Google (tối đa 400px) + padding thẻ.
  maxWidth = 'max-w-[27.5rem]',
}: {
  children?: ReactNode
  /** Phạm vi của trang ("Cổng Doanh nghiệp"), hiện cạnh logo. */
  headerRight?: ReactNode
  /** Tiêu đề h1 của thẻ. Bỏ trống nếu trang tự dựng tiêu đề trong `children`. */
  title?: ReactNode
  /** Một dòng mô tả dưới tiêu đề. */
  description?: ReactNode
  /** Biểu tượng nhỏ phía trên tiêu đề (trang trạng thái: hộp thư, chờ duyệt…). */
  icon?: ReactNode
  /** Liên kết phụ hiện dưới thẻ ("Chưa có tài khoản? Đăng ký"). */
  footer?: ReactNode
  maxWidth?: string
}) {
  const { t } = useI18n()
  return (
    <div className="relative flex min-h-dvh flex-col bg-white">
      {/* Quầng sáng xanh giống hero của mockup; chỉ trang trí. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_0%,#e8eeff_0%,rgba(255,255,255,0)_100%)]"
      />

      <header className="relative flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
        <Link to="/" aria-label={t('SSAM, về trang chủ', 'SSAM, back to home')} className="rounded-control">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          {headerRight && <span className="text-sm text-gray-600">{headerRight}</span>}
          <LanguageSwitch />
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 pb-16 pt-6 sm:justify-center sm:pt-10">
        <div className={clsx('w-full', maxWidth)}>
          <div className="rounded-card border border-gray-200 bg-white p-6 shadow-xs sm:p-8">
            {(icon || title || description) && (
              <div className="mb-6 text-center">
                {icon && (
                  <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-brand-600">
                    {icon}
                  </span>
                )}
                {title && <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>}
                {description && <p className="mt-1.5 text-sm text-gray-600">{description}</p>}
              </div>
            )}
            {children}
          </div>
          {footer && <div className="mt-6 text-center text-sm text-gray-600">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

/** Kiểu chung cho liên kết chữ trong trang auth. */
export const authLinkClass =
  'rounded-control font-medium text-brand-600 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100'

// Không còn nhãn mở đầu phía trên tiêu đề. Giữ export để code cũ không vỡ.
export function AuthCardEyebrow(_props: { children: ReactNode }) {
  return null
}
