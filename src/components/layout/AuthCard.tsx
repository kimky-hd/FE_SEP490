import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { LogoMark } from '@/components/ui/Logo'
import { Eyebrow, Tag } from '@/components/ui/Eyebrow'

// Khung chung cho mọi trang Auth/Onboarding/Invite.
// v3: bỏ sidebar marketing tối (lệ thuộc nội dung dài, gây cuộn). Thay bằng nền "aurora" xanh lá —
// đúng yêu cầu xanh lá là màu CHỦ ĐẠO, không phải viền 2px trang trí — để lấp khoảng trống bằng khí
// quyển màu sắc + độ sâu (glow, blur) thay vì bằng nội dung. Logo làm điểm neo trung tâm phía trên
// card, giống Stripe/Linear/GitHub — quen mắt với người dùng thật nhưng vẫn riêng nhờ LogoMark + glow.
export function AuthCard({
  children,
  headerRight,
  maxWidth = 'max-w-md',
}: {
  children: ReactNode
  headerRight?: ReactNode
  maxWidth?: string
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      {/* Aurora: 2 quầng sáng xanh lá mềm, cố định theo viewport — màu chủ đạo thật, không phải accent mỏng. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-brand-300/40 blur-[110px]" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-brand-500/20 blur-[110px]" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-brand-200/30 blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(28_25_23/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(28_25_23/0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span aria-hidden="true">←</span> Trang chủ
        </Link>
        {headerRight && <Tag tone="brand">{headerRight}</Tag>}
      </div>

      <main className="relative flex min-h-[calc(100vh-3.75rem)] flex-col items-center justify-center px-4 pb-10">
        <Link
          to="/"
          aria-label="SSAM — về trang chủ"
          className="group mb-6 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-brand-600/25 transition-transform group-hover:scale-105">
            <LogoMark size={56} className="drop-shadow-sm" />
          </span>
        </Link>

        <div
          className={clsx(
            'w-full rounded-md border border-white/60 bg-white/85 p-5 shadow-xl shadow-brand-950/[0.07] backdrop-blur-md sm:p-7',
            maxWidth,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

// Nhãn mở đầu mỗi form Auth/Onboarding — thay cho icon tròn căn giữa (motif quá quen của UI AI sinh).
// Cùng giọng mono-eyebrow với Landing page, giữ heading/thân bài căn trái nhất quán toàn app.
export function AuthCardEyebrow({ children }: { children: ReactNode }) {
  return <Eyebrow className="text-brand-700">{children}</Eyebrow>
}
