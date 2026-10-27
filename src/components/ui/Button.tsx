import { type ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverted' | 'invertedOutline'
type Size = 'md' | 'lg'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/30 active:bg-brand-800 disabled:bg-brand-300 disabled:shadow-none',
  secondary:
    'border border-gray-300 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:border-gray-300',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400',
  // Dùng trên nền tối (section CTA cuối landing).
  inverted: 'bg-white text-gray-950 hover:bg-gray-100 disabled:bg-gray-300',
  invertedOutline: 'border border-white/25 bg-transparent text-white hover:bg-white/10 disabled:text-white/40',
}

const sizeClasses: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
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
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,box-shadow,border-color,color]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
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
