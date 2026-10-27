import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { authApi } from '@/api/authApi'
import { ApiError } from '@/lib/apiClient'

type Status = 'idle' | 'verifying' | 'success' | 'error'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? 'demo-token'
  const [status, setStatus] = useState<Status>(token ? 'idle' : 'error')
  const [errorMessage, setErrorMessage] = useState('Link xác thực không hợp lệ.')

  // Cố ý KHÔNG tự gọi API lúc trang vừa mở: nhiều email client (Gmail, Outlook...) tự quét link
  // trong mail để chống phishing bằng cách tải trước trang đích — nếu xác thực tự chạy ngay khi
  // mount, con bot quét mail sẽ "dùng" token trước khi người dùng kịp bấm. Bắt người dùng bấm nút
  // thật thì bot quét (không click chuột) sẽ không bao giờ tiêu token.
  const handleVerify = async () => {
    if (!token) return
    setStatus('verifying')
    try {
      await authApi.verifyEmail(token)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(
        err instanceof ApiError && err.code === 'TOKEN_EXPIRED'
          ? 'Link xác thực đã hết hạn.'
          : 'Link này không hợp lệ hoặc đã được dùng trước đó — có thể do email client tự quét link, hoặc bạn đã xác thực rồi.',
      )
    }
  }

  return (
    <AuthCard>
      <AuthCardEyebrow>// Xác thực email</AuthCardEyebrow>

      {(status === 'idle' || status === 'verifying') && (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Xác thực địa chỉ email</h1>
          <p className="mt-2 text-sm text-gray-500">
            Bấm nút bên dưới để hoàn tất xác thực và kích hoạt tài khoản SSAM của bạn.
          </p>
          <div className="mt-6">
            <Button onClick={handleVerify} isLoading={status === 'verifying'}>
              Xác thực email →
            </Button>
          </div>
        </>
      )}

      {status === 'success' && (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Xác thực email thành công</h1>
          <p className="mt-2 text-sm text-gray-500">Bạn có thể đăng nhập ngay bây giờ.</p>
          <div className="mt-6">
            <Link to="/login" className={buttonClasses()}>
              Đăng nhập →
            </Link>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Không xác thực được</h1>
          <div className="mt-4">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link to="/login" className={buttonClasses({ inline: true })}>
              Thử đăng nhập luôn →
            </Link>
            <Link to="/verify-email/pending" className={buttonClasses({ variant: 'secondary', inline: true })}>
              Gửi lại email xác thực
            </Link>
          </div>
        </>
      )}
    </AuthCard>
  )
}
