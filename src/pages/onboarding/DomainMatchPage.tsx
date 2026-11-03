import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard, authLinkClass } from '@/components/layout/AuthCard'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { companyApi } from '@/api/companyApi'
import { ApiError } from '@/lib/apiClient'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n'

interface MatchedCompany {
  id: number
  name: string
  domain: string
  logoUrl: string | null
  autoJoinEnabled: boolean
}

export function DomainMatchPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshMe } = useAuth()
  const { t } = useI18n()
  const company = (location.state as { company?: MatchedCompany } | null)?.company
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!company) return <Navigate to="/onboarding/account-type" replace />

  const goToPendingApproval = async () => {
    const { requestId } = await companyApi.requestToJoin(company.id)
    navigate('/onboarding/pending-approval', {
      state: { companyId: company.id, requestId, companyName: company.name },
    })
  }

  const handleJoin = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      if (company.autoJoinEnabled) {
        await companyApi.joinDirectly(company.id)
        // Nạp lại companies để Dashboard hiển thị đúng công ty vừa tham gia (không thì vẫn thấy "cá nhân").
        await refreshMe()
        navigate('/')
      } else {
        await goToPendingApproval()
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AUTO_JOIN_NOT_ALLOWED') {
        // Trạng thái auto-join đổi giữa lúc match và lúc bấm join — thử lại bằng đường join-request.
        try {
          await goToPendingApproval()
          return
        } catch {
          // rơi xuống thông báo lỗi chung bên dưới
        }
      }
      setError(t('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard
      title={t('Đội của bạn đã có trên SSAM', 'Your team is already on SSAM')}
      description={
        <>
          {t('Email của bạn khớp tên miền', 'Your email matches')}{' '}
          <span className="font-medium text-gray-900">@{company.domain}</span>.
        </>
      }
      footer={
        <button type="button" onClick={() => navigate('/onboarding/company-setup')} className={authLinkClass}>
          {t('Không phải công ty của bạn? Tạo công ty mới', 'Not your company? Create a new one')}
        </button>
      }
    >
      <div className="flex items-center gap-3 rounded-card border border-gray-200 bg-gray-50 p-3">
        {company.logoUrl ? (
          <img src={company.logoUrl} alt="" className="h-10 w-10 rounded-control object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-600 text-sm font-bold text-white">
            {company.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{company.name}</p>
          <p className="truncate text-xs text-gray-500">{company.domain}</p>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="mt-6">
        <Button onClick={handleJoin} isLoading={isSubmitting}>
          {company.autoJoinEnabled
            ? t(`Tham gia ${company.name}`, `Join ${company.name}`)
            : t('Gửi yêu cầu tham gia', 'Request to join')}
        </Button>
      </div>
    </AuthCard>
  )
}
