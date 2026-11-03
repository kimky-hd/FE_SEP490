import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard, authLinkClass } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter'
import { authApi } from '@/api/authApi'
import { ApiError } from '@/lib/apiClient'
import { useUrlToken } from '@/lib/useUrlToken'
import { isPasswordValid } from '@/lib/passwordStrength'
import { LockIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

// Dựng schema theo ngôn ngữ hiện tại; bản export mặc định giữ thông báo tiếng Việt.
export const buildResetPasswordSchema = (t: (vi: string, en: string) => string) =>
  z
    .object({
      newPassword: z
        .string()
        .refine(
          isPasswordValid,
          t('Mật khẩu chưa đạt các yêu cầu bên dưới', 'Password does not meet the requirements below'),
        ),
      confirmPassword: z.string(),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t('Mật khẩu xác nhận không khớp', 'Passwords do not match'),
      path: ['confirmPassword'],
    })
export const resetPasswordSchema = buildResetPasswordSchema((vi) => vi)
type FormValues = z.infer<typeof resetPasswordSchema>

export function ResetPasswordPage() {
  // Token đọc một lần rồi gỡ khỏi URL (xem useUrlToken).
  const token = useUrlToken()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useI18n()
  const schema = useMemo(() => buildResetPasswordSchema(t), [t])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })
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
          ? t(
              'Link đặt lại mật khẩu đã hết hạn, vui lòng yêu cầu link mới.',
              'This reset link has expired. Please request a new one.',
            )
          : t('Link không hợp lệ hoặc đã được sử dụng.', 'This link is invalid or has already been used.'),
      )
    }
  }

  if (!token) {
    return (
      <AuthCard
        title={t('Link không hợp lệ', 'Invalid link')}
        description={t('Link đặt lại mật khẩu không hợp lệ.', 'Invalid password reset link.')}
      >
        <Link to="/forgot-password" className={buttonClasses()}>
          {t('Yêu cầu link mới', 'Request a new link')}
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      icon={<LockIcon className="h-5 w-5" />}
      title={t('Đặt mật khẩu mới', 'Set a new password')}
      footer={
        <Link to="/login" className={authLinkClass}>
          {t('Quay lại đăng nhập', 'Back to sign in')}
        </Link>
      }
    >
      {serverError && (
        <div className="mb-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <TextField
            label={t('Mật khẩu mới', 'New password')}
            icon={<LockIcon className="h-4 w-4" />}
            type="password"
            autoComplete="new-password"
            placeholder={t('Ít nhất 8 ký tự', 'At least 8 characters')}
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <PasswordStrengthMeter password={newPassword} />
        </div>
        <TextField
          label={t('Xác nhận mật khẩu', 'Confirm password')}
          icon={<LockIcon className="h-4 w-4" />}
          type="password"
          autoComplete="new-password"
          placeholder={t('Nhập lại mật khẩu mới', 'Re-enter new password')}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" isLoading={isSubmitting}>
          {t('Đặt lại mật khẩu', 'Reset password')}
        </Button>
      </form>
    </AuthCard>
  )
}
