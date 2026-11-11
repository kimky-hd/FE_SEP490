import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'

// Nền trang Auth/Onboarding theo mockup phương án B ("Căn giữa"): lưới chấm như một bảng vẽ chung của đội.
// - Điện thoại / tablet: chỉ lưới chấm thường.
// - Desktop (xl+): lưới mờ dần về phía thẻ + lớp "Con trỏ cả đội" (ghi chú BA, testcase + ghim QA, issue + ghi chú Dev,
//   con trỏ "Bạn" chờ cạnh thẻ). Toàn bộ chỉ để trang trí: aria-hidden, không nhận chuột.
// Con trỏ trôi nhẹ; tắt hẳn khi máy bật giảm chuyển động.

const DOT_GRID = 'radial-gradient(#e4e7ec 1px, transparent 1px)' // gray-200
const DOT_GRID_STRONG = 'radial-gradient(#d0d5dd 1.2px, transparent 1.2px)' // gray-300
// Chấm rõ ở mép, nhạt dần (còn ~20%) khi vào gần thẻ: mắt tự dồn vào form.
const FADE_MASK = 'radial-gradient(ellipse 46% 52% at 50% 50%, rgba(0,0,0,.2) 40%, #000 100%)'

const MOTION_CSS = `
@keyframes auth-drift{from{transform:translate(0,0)}to{transform:translate(var(--dx,14px),var(--dy,8px))}}
@keyframes auth-blink{50%{opacity:.2}}
@media (prefers-reduced-motion:no-preference){
  .auth-cursor{animation:auth-drift var(--t,9s) ease-in-out infinite alternate}
  .auth-typing::after{animation:auth-blink 1s steps(2) infinite}
}`

type Vars = CSSProperties & Record<`--${string}`, string>

export function AuthBackdrop({ wide = false }: { wide?: boolean }) {
  const { t } = useI18n()
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{MOTION_CSS}</style>

      {/* Lưới chấm thường cho khổ nhỏ */}
      <div className="absolute inset-0 xl:hidden" style={{ backgroundImage: DOT_GRID, backgroundSize: '20px 20px' }} />
      {/* Lưới mờ dần cho desktop */}
      <div
        className="absolute inset-0 hidden xl:block"
        style={{
          backgroundImage: DOT_GRID_STRONG,
          backgroundSize: '20px 20px',
          WebkitMaskImage: FADE_MASK,
          maskImage: FADE_MASK,
        }}
      />

      <div className="absolute inset-0 hidden xl:block">
        {/* Góc trên trái: ghi chú của BA đang được chọn */}
        <StickyNote
          className="w-[168px] -rotate-[2.5deg] bg-[#fef7c3]"
          style={{ left: '6%', top: '15%' }}
          avatar="HN"
          color="#7a5af8"
          author="Hà · BA"
          selected
        >
          {t('REQ-12 · Đăng nhập Google chỉ cho email công ty.', 'REQ-12 · Google sign-in for company emails only.')}
        </StickyNote>
        <Cursor
          color="#7a5af8"
          label="Hà · BA"
          style={{ left: 'calc(6% + 172px)', top: 'calc(15% + 112px)', '--t': '8s', '--dx': '10px', '--dy': '-6px' }}
        />

        {/* Góc dưới trái: chip testcase + ghim bình luận của QA */}
        <Chip style={{ left: '4%', bottom: '24%' }}>
          <Tag className="bg-success-50 text-success-700">TC-31</Tag>
          {t('Đăng nhập Google', 'Google sign-in')}
          <Tag className="bg-success-50 text-success-700">{t('Đạt', 'Pass')}</Tag>
        </Chip>
        <div
          className="absolute flex items-start gap-2"
          style={{ left: 'calc(4% + 22px)', bottom: 'calc(24% - 78px)' }}
        >
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[50%_50%_50%_4px] border-2 border-white bg-[#079455] text-[10.5px] font-bold text-white shadow-[0_4px_10px_-4px_rgba(16,24,40,.4)]">
            LT
          </span>
          <div className="max-w-[190px] rounded-[10px] border border-gray-200 bg-white px-2.5 py-2 text-xs leading-snug text-gray-700 shadow-pop">
            <b className="mb-0.5 block text-[11.5px] font-medium text-gray-900">Lan · QA</b>
            {t('Chrome ổn, mai chạy nốt Safari.', 'Chrome is fine, Safari tomorrow.')}
          </div>
        </div>
        <Cursor
          color="#079455"
          label="Lan · QA"
          style={{ left: 'calc(4% + 40px)', bottom: 'calc(24% + 70px)', '--t': '10s', '--dx': '10px', '--dy': '6px' }}
        />

        {/* Góc trên phải: chip issue nối tới ghi chú của Dev */}
        <Chip style={{ right: '6%', top: '13%' }}>
          <Tag className="bg-brand-50 text-brand-700">CORE-104</Tag>
          {t('Làm nút Google', 'Build Google button')}
          <Tag className="bg-amber-50 text-amber-700">{t('REQ đổi', 'REQ changed')}</Tag>
        </Chip>
        <StickyNote
          className="w-[156px] rotate-2 bg-[#d1e9ff]"
          style={{ right: '9%', top: 'calc(13% + 64px)' }}
          avatar="MĐ"
          color="#2f5bea"
          author="Minh · Dev"
        >
          {t('Tách nút Google thành issue riêng nhé?', 'Split the Google button into its own issue?')}
        </StickyNote>
        <Cursor
          color="#2f5bea"
          label="Minh · Dev"
          typing
          style={{ right: 'calc(9% + 150px)', top: 'calc(13% + 150px)', '--t': '7s', '--dx': '8px', '--dy': '10px' }}
        />

        {/* Con trỏ "Bạn" chờ cách mép thẻ ~60px (thẻ 440px hoặc 520px) */}
        <Cursor
          color="#e04f16"
          label={t('Bạn', 'You')}
          style={{
            right: wide ? 'calc(50% - 345px)' : 'calc(50% - 300px)',
            bottom: wide ? '22%' : '30%',
            '--t': '6s',
            '--dx': '-8px',
            '--dy': '-6px',
          }}
        />
      </div>
    </div>
  )
}

function Cursor({ color, label, typing, style }: { color: string; label: string; typing?: boolean; style: Vars }) {
  return (
    <div className="auth-cursor absolute h-0 w-0" style={style}>
      <svg
        viewBox="0 0 20 20"
        className="absolute -left-0.5 -top-0.5 h-5 w-5 overflow-visible drop-shadow-[0_2px_3px_rgba(16,24,40,.25)]"
      >
        <path
          d="M2 2 L2 16.5 L6.3 12.6 L9.2 18.6 L11.7 17.4 L8.9 11.6 L14.6 11.4 Z"
          fill={color}
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={clsx(
          'absolute left-3.5 top-4 whitespace-nowrap rounded-full px-[9px] py-[5px] text-[11.5px] font-medium leading-none text-white shadow-[0_2px_6px_-2px_rgba(16,24,40,.3)]',
          typing &&
            "auth-typing after:ml-1.5 after:inline-block after:h-[5px] after:w-[5px] after:rounded-full after:bg-white after:align-middle after:content-['']",
        )}
        style={{ background: color }}
      >
        {label}
      </span>
    </div>
  )
}

function StickyNote({
  className,
  style,
  avatar,
  color,
  author,
  selected,
  children,
}: {
  className: string
  style: CSSProperties
  avatar: string
  color: string
  author: string
  selected?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={clsx(
        'absolute flex flex-col gap-2.5 rounded-[3px] px-[13px] pb-2.5 pt-3 text-[12.5px] leading-[1.45] text-[#3b2f00] shadow-[0_1px_1px_rgba(16,24,40,.06),0_10px_18px_-10px_rgba(16,24,40,.35)]',
        className,
      )}
      style={style}
    >
      <span>{children}</span>
      <small className="flex items-center gap-1.5 text-[11px] text-gray-900/55">
        <i
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8.5px] font-bold not-italic text-white"
          style={{ background: color }}
        >
          {avatar}
        </i>
        {author}
      </small>
      {/* Khung chọn kiểu Figma quanh ghi chú đang được chọn */}
      {selected && (
        <div className="absolute -inset-1.5 rounded border-[1.5px]" style={{ borderColor: color }}>
          {['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map((pos) => (
            <b
              key={pos}
              className={clsx('absolute h-[7px] w-[7px] rounded-[1px] border-[1.5px] bg-white', pos)}
              style={{ borderColor: color }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return (
    <div
      className="absolute flex items-center gap-2 whitespace-nowrap rounded-[10px] border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 shadow-pop"
      style={style}
    >
      {children}
    </div>
  )
}

function Tag({ className, children }: { className: string; children: ReactNode }) {
  return <span className={clsx('rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold', className)}>{children}</span>
}
