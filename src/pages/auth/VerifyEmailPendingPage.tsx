import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthCard, authLinkClass } from '@/components/layout/AuthCard'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EnvelopeOpenIcon } from '@/components/ui/icons'
import { authApi } from '@/api/authApi'
import { useI18n } from '@/i18n'

const RESEND_COOLDOWN_SECONDS = 30

export function VerifyEmailPendingPage() {
  const location = useLocation()
  const { t } = useI18n()
  const email = (location.state as { email?: string } | null)?.email ?? ''
  const [cooldown, setCooldown] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Đếm ngược bằng effect để timer được dọn khi unmount (tránh setState trên component đã gỡ).
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (!email || cooldown > 0 || isSending) return
    setIsSending(true)
    setSendError(null)
    try {
      await authApi.resendVerification(email)
      setSent(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch {
      setSendError(t('Không gửi lại được email, vui lòng thử lại.', 'Could not resend the email. Please try again.'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AuthCard
      icon={<EnvelopeOpenIcon className="h-5 w-5" />}
      title={t('Kiểm tra hộp thư của bạn', 'Check your inbox')}
      description={
        <>
          {t('Chúng tôi đã gửi link xác thực tới', 'We sent a verification link to')}{' '}
          <span className="font-medium text-gray-900">{email || t('email của bạn', 'your email')}</span>.
        </>
      }
      footer={
        <Link to="/login" className={authLinkClass}>
          {t('Quay lại đăng nhập', 'Back to sign in')}
        </Link>
      }
    >
      {sent && !sendError && (
        <div className="mb-4">
          <Alert tone="success">{t('Đã gửi lại email xác thực.', 'Verification email sent again.')}</Alert>
        </div>
      )}
      {sendError && (
        <div className="mb-4">
          <Alert tone="error">{sendError}</Alert>
        </div>
      )}

      <Button variant="secondary" onClick={handleResend} isLoading={isSending} disabled={!email || cooldown > 0}>
        {cooldown > 0
          ? t(`Gửi lại sau ${cooldown}s`, `Resend in ${cooldown}s`)
          : t('Không nhận được email? Gửi lại', "Didn't get the email? Resend")}
      </Button>
    </AuthCard>
  )
}
