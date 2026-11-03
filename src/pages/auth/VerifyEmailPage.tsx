import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthCard } from '@/components/layout/AuthCard'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { CheckIcon, MailIcon } from '@/components/ui/icons'
import { authApi } from '@/api/authApi'
import { ApiError } from '@/lib/apiClient'
import { useUrlToken } from '@/lib/useUrlToken'
import { useI18n, tr } from '@/i18n'

type Status = 'idle' | 'verifying' | 'success' | 'error'

export function VerifyEmailPage() {
  // Token đọc một lần rồi gỡ khỏi URL (xem useUrlToken).
  const token = useUrlToken()
  const [status, setStatus] = useState<Status>(token ? 'idle' : 'error')
  const { t } = useI18n()
  const [errorMessage, setErrorMessage] = useState(() =>
    tr('Link xác thực không hợp lệ.', 'Invalid verification link.'),
  )

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
          ? t('Link xác thực đã hết hạn.', 'This verification link has expired.')
          : t(
              'Link không hợp lệ hoặc đã được dùng. Có thể bạn đã xác thực rồi, hãy thử đăng nhập.',
              'This link is invalid or was already used. You may already be verified, so try signing in.',
            ),
      )
    }
  }

  if (status === 'success') {
    return (
      <AuthCard
        icon={<CheckIcon className="h-5 w-5" />}
        title={t('Xác thực email thành công', 'Email verified')}
        description={t('Bạn có thể đăng nhập ngay bây giờ.', 'You can sign in now.')}
      >
        <Link to="/login" className={buttonClasses()}>
          {t('Đăng nhập', 'Sign in')}
        </Link>
      </AuthCard>
    )
  }

  if (status === 'error') {
    return (
      <AuthCard title={t('Không xác thực được', 'Verification failed')}>
        <Alert tone="error">{errorMessage}</Alert>
        <div className="mt-6 space-y-3">
          <Link to="/login" className={buttonClasses()}>
            {t('Thử đăng nhập luôn', 'Try signing in')}
          </Link>
          <Link to="/verify-email/pending" className={buttonClasses({ variant: 'secondary' })}>
            {t('Gửi lại email xác thực', 'Resend verification email')}
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      icon={<MailIcon className="h-5 w-5" />}
      title={t('Xác thực địa chỉ email', 'Verify your email address')}
      description={t('Bấm nút bên dưới để kích hoạt tài khoản.', 'Click the button below to activate your account.')}
    >
      <Button onClick={handleVerify} isLoading={status === 'verifying'}>
        {t('Xác thực email', 'Verify email')}
      </Button>
    </AuthCard>
  )
}
