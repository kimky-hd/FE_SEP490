import { Link, useLocation } from 'react-router-dom'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'

export function ForgotPasswordSentPage() {
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? 'email của bạn'

  return (
    <AuthCard>
      <AuthCardEyebrow>// Đã gửi email</AuthCardEyebrow>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Kiểm tra hộp thư của bạn</h1>
      <p className="mt-2 text-sm text-gray-500">
        Nếu <span className="font-medium text-gray-800">{email}</span> có trong hệ thống, bạn sẽ nhận được link đặt
        lại mật khẩu trong ít phút.
      </p>
      <p className="mt-6 text-sm text-gray-500">
        <Link to="/login" className="font-medium text-brand-700">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthCard>
  )
}
