import clsx from 'clsx'

// Dấu hiệu thương hiệu: chữ S vẽ bằng một nét "dây dẫn" nối 2 nút — đúng câu chuyện truy xuất nguồn gốc
// (yêu cầu ↔ thiết kế ↔ testcase) của SSAM. Cùng hình với public/favicon.svg — sửa 1 chỗ thì sửa cả 2.
export function LogoMark({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={clsx('h-7 w-7 shrink-0', className)}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" className="fill-brand-600" />
      <path
        d="M22 10.5H13.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H10"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="22" cy="10.5" r="2.1" fill="#fff" />
      <circle cx="10" cy="22.5" r="2.1" fill="#fff" />
    </svg>
  )
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={clsx(
          'font-mono text-[15px] font-semibold tracking-tight',
          inverted ? 'text-white' : 'text-gray-950',
        )}
      >
        SSAM
      </span>
    </span>
  )
}
