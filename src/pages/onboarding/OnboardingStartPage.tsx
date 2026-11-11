import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthCard } from '@/components/layout/AuthCard'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { useI18n } from '@/i18n'

// Bước đầu onboarding. SSAM chỉ còn tài khoản doanh nghiệp (đã bỏ luồng "Cá nhân"): không hỏi loại tài khoản nữa,
// kiểm tra domain email luôn — domain đã có công ty thì xin vào công ty đó, chưa có thì thiết lập công ty mới.
export function OnboardingStartPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const check = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      const match = await companyApi.matchByEmail(user.email)
      if (match.matched && match.company) {
        navigate('/onboarding/domain-match', { replace: true, state: { company: match.company } })
      } else {
        navigate('/onboarding/company-setup', { replace: true })
      }
    } catch {
      setError(
        t(
          'Không kiểm tra được domain công ty, vui lòng thử lại.',
          'Could not check your company domain. Please try again.',
        ),
      )
    }
  }, [user, navigate, t])

  useEffect(() => {
    if (started.current || !user) return
    started.current = true
    void check()
  }, [user, check])

  if (!error) return <FullPageSpinner />

  return (
    <AuthCard title={t('Thiết lập tài khoản', 'Set up your account')}>
      <div className="mb-4">
        <Alert tone="error">{error}</Alert>
      </div>
      <Button onClick={() => void check()}>{t('Thử lại', 'Try again')}</Button>
    </AuthCard>
  )
}
