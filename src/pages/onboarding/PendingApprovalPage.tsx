import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { companyApi } from '@/api/companyApi'
import { useAuth } from '@/context/AuthContext'

interface LocationState {
  companyId?: number
  requestId?: number
  companyName?: string
}

export function PendingApprovalPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshMe } = useAuth()
  const {
    companyId = 1,
    requestId = 101,
    companyName = 'Acme Fintech Corp',
  } = (location.state as LocationState | null) ?? {}
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
      setCheckError('Không kiểm tra được trạng thái, vui lòng thử lại.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <AuthCard>
      <AuthCardEyebrow>// Đang chờ duyệt</AuthCardEyebrow>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Yêu cầu đang chờ duyệt</h1>
      <p className="mt-2 text-sm text-gray-500">
        Quản trị viên của <span className="font-medium text-gray-800">{companyName ?? 'công ty'}</span> cần phê duyệt
        yêu cầu tham gia của bạn. Bạn sẽ nhận được email khi có kết quả.
      </p>

      {rejected && (
        <div className="mt-4">
          <Alert tone="warning">Yêu cầu tham gia của bạn đã bị từ chối.</Alert>
        </div>
      )}
      {checkError && (
        <div className="mt-4">
          <Alert tone="error">{checkError}</Alert>
        </div>
      )}

      <div className="mt-6">
        <Button variant="secondary" onClick={handleCheck} isLoading={isChecking}>
          Kiểm tra lại
        </Button>
      </div>
    </AuthCard>
  )
}
