import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '@/components/layout/AuthCard'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ClockIcon } from '@/components/ui/icons'
import { companyApi } from '@/api/companyApi'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n'

interface LocationState {
  companyId?: number
  requestId?: number
  companyName?: string
}

export function PendingApprovalPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshMe } = useAuth()
  const { t } = useI18n()
  const { companyId, requestId, companyName } = (location.state as LocationState | null) ?? {}
  const [isChecking, setIsChecking] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  if (!companyId || !requestId) return <Navigate to="/onboarding/account-type" replace />

  const handleCheck = async () => {
    setIsChecking(true)
    setCheckError(null)
    try {
      const { status } = await companyApi.getJoinRequestStatus(companyId, requestId)
      if (status === 'approved') {
        // Nạp lại companies trước khi vào Dashboard để không hiển thị "không gian cá nhân" sai.
        await refreshMe()
        navigate('/')
      }
      if (status === 'rejected') setRejected(true)
    } catch {
      setCheckError(
        t('Không kiểm tra được trạng thái, vui lòng thử lại.', 'Could not check the status. Please try again.'),
      )
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <AuthCard
      icon={<ClockIcon className="h-5 w-5" />}
      title={t('Yêu cầu đang chờ duyệt', 'Your request is pending')}
      description={
        <>
          {t('Quản trị viên của', 'An admin of')}{' '}
          <span className="font-medium text-gray-900">{companyName ?? t('công ty', 'the company')}</span>{' '}
          {t(
            'sẽ duyệt yêu cầu. Bạn sẽ nhận email khi có kết quả.',
            "will review it. You'll get an email with the result.",
          )}
        </>
      }
    >
      {rejected && (
        <div className="mb-4">
          <Alert tone="warning">
            {t('Yêu cầu tham gia của bạn đã bị từ chối.', 'Your request to join was declined.')}
          </Alert>
        </div>
      )}
      {checkError && (
        <div className="mb-4">
          <Alert tone="error">{checkError}</Alert>
        </div>
      )}

      <Button variant="secondary" onClick={handleCheck} isLoading={isChecking}>
        {t('Kiểm tra lại', 'Check again')}
      </Button>
    </AuthCard>
  )
}
