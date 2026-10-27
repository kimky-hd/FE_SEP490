import { Link } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-paper px-4 text-center">
      <Logo />
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500">Lỗi 404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-gray-950">Không tìm thấy trang bạn yêu cầu.</h1>
      <p className="max-w-sm text-gray-500">Đường dẫn có thể đã đổi hoặc chưa từng tồn tại. Quay về trang chủ để tiếp tục.</p>
      <Link to="/" className={buttonClasses({ inline: true })}>
        Về trang chủ
      </Link>
    </div>
  )
}
