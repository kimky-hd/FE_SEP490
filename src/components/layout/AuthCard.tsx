import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { useI18n } from '@/i18n'
import { AuthBackdrop } from './AuthBackdrop'

// Khung chung cho mọi trang Auth/Onboarding/Invite.
// v6: phương án B "Căn giữa" của mockup auth-onboarding-ideas — nền lưới chấm (AuthBackdrop), thanh trên cùng
// (logo + ngôn ngữ), một thẻ trắng bo 16px + shadow-pop ở giữa; liên kết phụ là một dòng nhỏ dưới thẻ.
// `width="wide"` (520px) cho form dài (Thiết lập công ty): đầu thẻ gọn hơn, nút chính nằm ở thanh `actions` cuối thẻ.
export function AuthCard({
  children,
  headerRight,
  title,
  description,
  icon,
  footer,
  actions,
  align = 'center',
  width = 'default',
}: {
  children?: ReactNode
  /** Nội dung phụ cạnh nút ngôn ngữ (vd. email đang đăng nhập). */
  headerRight?: ReactNode
  /** Tiêu đề h1 của thẻ. Bỏ trống nếu trang tự dựng tiêu đề trong `children`. */
  title?: ReactNode
  /** Một dòng mô tả dưới tiêu đề. */
  description?: ReactNode
  /** Biểu tượng nhỏ phía trên tiêu đề (trang trạng thái: hộp thư, chờ duyệt…). */
  icon?: ReactNode
  /** Liên kết phụ hiện dưới thẻ ("Chưa có tài khoản? Đăng ký"). */
  footer?: ReactNode
  /** Thanh hành động ở đáy thẻ (nền xám nhạt, viền trên). Nút submit dùng thuộc tính `form` để gắn với form trong thẻ. */
  actions?: ReactNode
  /** Căn tiêu đề: giữa (mặc định, trang trạng thái/đăng nhập) hoặc trái (đăng ký, thiết lập). */
  align?: 'center' | 'start'
  /** 440px (đủ cho nút Google tối đa 400px + padding) hoặc 520px cho form nhiều trường. */
  width?: 'default' | 'wide'
}) {
  const { t } = useI18n()
  const wide = width === 'wide'
  const pad = wide ? 'px-5 sm:px-7' : 'px-[22px] sm:px-8'
  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-white">
      <AuthBackdrop wide={wide} />

      <header className="relative flex h-16 items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-8">
        <Link to="/" aria-label={t('SSAM, về trang chủ', 'SSAM, back to home')} className="rounded-control">
          <Logo />
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          {headerRight && <span className="hidden truncate text-[13px] text-gray-500 sm:inline">{headerRight}</span>}
          <LanguageSwitch />
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 pb-10 pt-2 sm:justify-center">
        <div className={clsx('w-full', wide ? 'max-w-[32.5rem]' : 'max-w-[27.5rem]')}>
          <div className="rounded-[14px] border border-gray-200 bg-white shadow-pop sm:rounded-2xl">
            <div className={clsx(pad, wide ? 'pb-5 pt-5 sm:pb-[22px] sm:pt-6' : 'py-[22px] sm:py-8')}>
              {(icon || title || description) && (
                <div className={clsx(align === 'center' && 'text-center', wide ? 'mb-[18px]' : 'mb-6')}>
                  {icon && (
                    <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-brand-600">
                      {icon}
                    </span>
                  )}
                  {title && (
                    <h1 className={clsx('font-bold tracking-tight text-gray-950', wide ? 'text-xl' : 'text-2xl')}>
                      {title}
                    </h1>
                  )}
                  {description && (
                    <p className={clsx('mt-1.5 text-gray-600', wide ? 'text-[13px]' : 'text-sm')}>{description}</p>
                  )}
                </div>
              )}
              {children}
            </div>
            {actions && (
              <div
                className={clsx(
                  pad,
                  'flex items-center justify-end gap-3 rounded-b-[14px] border-t border-gray-200 bg-gray-25 py-3.5 sm:rounded-b-2xl',
                )}
              >
                {actions}
              </div>
            )}
          </div>
          {footer && <div className="mt-3 text-center text-[13px] text-gray-500">{footer}</div>}
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
