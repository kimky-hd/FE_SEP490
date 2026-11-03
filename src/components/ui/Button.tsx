import { type ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'inverted' | 'invertedOutline'
type Size = 'md' | 'lg'

const variantClasses: Record<Variant, string> = {
  // Hành động chính: xanh thương hiệu. Mỗi màn chỉ một nút primary.
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 disabled:shadow-none',
  brand:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 disabled:shadow-none',
  secondary:
    'border border-gray-300 bg-white text-gray-800 shadow-xs hover:bg-gray-50 hover:text-gray-950 disabled:text-gray-400 disabled:hover:bg-white',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-950 disabled:text-gray-400',
  // Dùng trên nền tối / nền màu.
  inverted: 'bg-white text-brand-800 hover:bg-brand-50 disabled:bg-gray-300',
  invertedOutline: 'border border-white/40 bg-transparent text-white hover:bg-white/10 disabled:text-white/50',
}

const sizeClasses: Record<Size, string> = {
  // 44px trên màn cảm ứng, 36px khi có chuột (lg+).
  md: 'h-11 px-4 text-sm lg:h-9 lg:px-3.5',
  lg: 'h-11 px-5 text-[15px]',
}

export interface ButtonStyleOptions {
  variant?: Variant
  size?: Size
  /** Mặc định nút giãn full chiều rộng (form auth). `inline` cho nút nằm trong dòng chữ / hàng CTA. */
  inline?: boolean
}

// Dùng cho <Link>/<a> muốn trông như nút: tránh lồng <button> trong <a> (HTML không hợp lệ, đọc màn hình đọc 2 lần).
export function buttonClasses({ variant = 'primary', size = 'md', inline = false }: ButtonStyleOptions = {}) {
  return clsx(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium',
    'transition-[background-color,border-color,color] duration-150',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
    'disabled:cursor-not-allowed',
    inline ? 'w-auto' : 'w-full',
    sizeClasses[size],
    variantClasses[variant],
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', inline = false, isLoading, disabled, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={clsx(buttonClasses({ variant, size, inline }), className)}
      {...rest}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
