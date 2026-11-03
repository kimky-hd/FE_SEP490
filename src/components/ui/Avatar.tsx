import clsx from 'clsx'

// Mỗi người một sắc nhạt cố định (theo tên) — là danh tính, không phải dữ liệu, nên luôn nhạt.
// Các sắc cách nhau ≥ 60° để hai người cạnh nhau không lẫn.
const HUES = [150, 30, 210, 90, 0, 180, 330, 60]

function hueOf(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
  const hue = hueOf(name)
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: `hsl(${hue} 45% 90%)`, color: `hsl(${hue} 55% 22%)` }}
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-xs',
      )}
    >
      {initials || '?'}
    </span>
  )
}
