import { Link, useLocation } from 'react-router-dom'
import { AuthCard, authLinkClass } from '@/components/layout/AuthCard'
import { buttonClasses } from '@/components/ui/Button'
import { EnvelopeOpenIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

export function ForgotPasswordSentPage() {
  const location = useLocation()
  const { t } = useI18n()
  const email = (location.state as { email?: string } | null)?.email ?? t('email của bạn', 'your email')

  return (
    <AuthCard
      icon={<EnvelopeOpenIcon className="h-5 w-5" />}
      title={t('Kiểm tra hộp thư của bạn', 'Check your inbox')}
      description={
        <>
          {t('Nếu', 'If')} <span className="font-medium text-gray-900">{email}</span>{' '}
          {t(
            'có tài khoản, link đặt lại sẽ đến trong ít phút.',
            'has an account, a reset link will arrive in a few minutes.',
          )}
        </>
      }
    >
      <Link to="/login" className={buttonClasses({ variant: 'secondary' })}>
        {t('Quay lại đăng nhập', 'Back to sign in')}
      </Link>
      <p className="mt-4 text-center text-sm text-gray-600">
        {t('Không thấy email?', "Didn't get it?")}{' '}
        <Link to="/forgot-password" className={authLinkClass}>
          {t('Gửi lại', 'Try again')}
        </Link>
      </p>
    </AuthCard>
  )
}
