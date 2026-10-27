import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { invitationApi } from '@/api/invitationApi'
import { useAuth } from '@/context/AuthContext'
import { isPasswordValid } from '@/lib/passwordStrength'
import type { InvitationPreviewDto } from '@/types/auth'
import { LockIcon, MailIcon, UserIcon } from '@/components/ui/icons'

const schema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập họ và tên'),
  password: z.string().refine(isPasswordValid, 'Mật khẩu chưa đạt các yêu cầu bên dưới'),
})
type FormValues = z.infer<typeof schema>

export function AcceptInvitePage() {
  const { token = 'demo-token' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, applySession, refreshMe } = useAuth()
  const [preview, setPreview] = useState<InvitationPreviewDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    invitationApi
      .preview(token)
      .then((data) => {
        if (!cancelled) setPreview(data)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const password = watch('password') ?? ''

  if (isLoading) return <FullPageSpinner />

  if (!token || !preview?.valid) {
    return (
      <AuthCard>
        <Alert tone="error">
          {preview?.reason === 'EXPIRED'
            ? 'Lời mời này đã hết hạn.'
            : preview?.reason === 'ALREADY_USED'
              ? 'Lời mời này đã được sử dụng.'
              : 'Lời mời không hợp lệ.'}
        </Alert>
      </AuthCard>
    )
  }

  const acceptAsExisting = async () => {
    setActionError(null)
    setIsSubmitting(true)
    try {
      await invitationApi.acceptAsExistingUser(token)
      await refreshMe()
      navigate('/')
    } catch {
      setActionError('Không thể chấp nhận lời mời — có thể email lời mời khác với tài khoản bạn đang đăng nhập.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const acceptAsNew = async (values: FormValues) => {
    setActionError(null)
    setIsSubmitting(true)
    try {
      const session = await invitationApi.acceptAsNewUser(token, values)
      applySession(session)
      await refreshMe()
      navigate('/')
    } catch {
      setActionError('Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard>
      <AuthCardEyebrow>// Lời mời tham gia</AuthCardEyebrow>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Lời mời tham gia</h1>
      <p className="mt-2 text-sm text-gray-500">
        Bạn được mời tham gia <span className="font-semibold text-gray-800">{preview.companyName}</span>
        {preview.workspaceName ? (
          <>
            {' '}
            — workspace <span className="font-semibold text-gray-800">{preview.workspaceName}</span>
          </>
        ) : null}{' '}
        với vai trò <span className="font-semibold text-gray-800">{preview.roleName}</span>.
      </p>

      {actionError && (
        <div className="mt-4">
          <Alert tone="error">{actionError}</Alert>
        </div>
      )}

      {isAuthenticated ? (
        <div className="mt-6">
          <Button onClick={acceptAsExisting} isLoading={isSubmitting}>
            Chấp nhận lời mời →
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(acceptAsNew)} noValidate className="mt-6 space-y-4">
          <TextField label="Email" icon={<MailIcon className="h-4 w-4" />} value={preview.email} disabled />
          <TextField
            label="Họ và tên"
            icon={<UserIcon className="h-4 w-4" />}
            autoComplete="name"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <div>
            <TextField
              label="Đặt mật khẩu"
              icon={<LockIcon className="h-4 w-4" />}
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <Button type="submit" isLoading={isSubmitting}>
            Tạo tài khoản &amp; tham gia →
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
