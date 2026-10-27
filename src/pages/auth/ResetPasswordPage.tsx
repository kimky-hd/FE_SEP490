import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter'
import { authApi } from '@/api/authApi'
import { ApiError } from '@/lib/apiClient'
import { isPasswordValid } from '@/lib/passwordStrength'
import { LockIcon } from '@/components/ui/icons'

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().refine(isPasswordValid, 'Mật khẩu chưa đạt các yêu cầu bên dưới'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof resetPasswordSchema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? 'demo-token'
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(resetPasswordSchema) })
  const newPassword = watch('newPassword') ?? ''

  const onSubmit = async (values: FormValues) => {
    if (!token) return
    setServerError(null)
    try {
      await authApi.resetPassword(token, values.newPassword)
      navigate('/login', { state: { resetSuccess: true } })
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.code === 'TOKEN_EXPIRED'
          ? 'Link đặt lại mật khẩu đã hết hạn, vui lòng yêu cầu link mới.'
          : 'Link không hợp lệ hoặc đã được sử dụng.',
      )
    }
  }

  if (!token) {
    return (
      <AuthCard>
        <Alert tone="error">Link đặt lại mật khẩu không hợp lệ.</Alert>
        <p className="mt-4 text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-700">
            Yêu cầu link mới
          </Link>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <AuthCardEyebrow>// Đặt mật khẩu mới</AuthCardEyebrow>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Đặt mật khẩu mới</h1>

      {serverError && (
        <div className="mt-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <div>
          <TextField
            label="Mật khẩu mới"
            icon={<LockIcon className="h-4 w-4" />}
            type="password"
            placeholder="••••••••"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <PasswordStrengthMeter password={newPassword} />
        </div>
        <TextField
          label="Xác nhận mật khẩu"
          icon={<LockIcon className="h-4 w-4" />}
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" isLoading={isSubmitting}>
          Đặt lại mật khẩu
        </Button>
      </form>
    </AuthCard>
  )
}
