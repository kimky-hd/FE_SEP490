import type { ComponentType, SVGProps } from 'react'
import clsx from 'clsx'

// Ô nền nhỏ cho icon làm NHÃN của một khối (mục menu ⋯, tiêu đề khung / ngăn, thông báo, số liệu) — kiểu "D · Kết hợp"
// (doc/mockups/icon-options.html). Trong nút, chip, ô bảng, hành động từng dòng thì dùng icon trơn, không dùng ô này.
// Màu mang nghĩa: brand thường · danger xoá / lỗi / bug · ai AI · warning test lại / REQ đổi / cảnh báo · neutral chỉ xem.

export type IconTileTone = 'brand' | 'danger' | 'ai' | 'warning' | 'neutral'

const TONE: Record<IconTileTone, string> = {
  brand: 'bg-brand-50 text-brand-700',
  danger: 'bg-red-50 text-red-700',
  ai: 'bg-[#f4f3ff] text-[#5925dc]',
  warning: 'bg-amber-50 text-amber-700',
  neutral: 'bg-gray-100 text-gray-600',
}

export function IconTile({
  icon: Icon,
  tone = 'brand',
  className,
  label,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: IconTileTone
  className?: string
  /** Có nhãn thì đọc được bằng trình đọc màn hình; mặc định chỉ trang trí (aria-hidden). */
  label?: string
}) {
  return (
    <span
      className={clsx('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]', TONE[tone], className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <Icon width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
    </span>
  )
}
