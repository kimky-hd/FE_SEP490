import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard, authLinkClass } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { authApi } from '@/api/authApi'
import { LockIcon, MailIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

const buildSchema = (t: (vi: string, en: string) => string) =>
  z.object({
    email: z
      .string()
      .min(1, t('Vui lòng nhập email', 'Please enter your email'))
      .email(t('Email không hợp lệ', 'Invalid email')),
  })
type FormValues = z.infer<ReturnType<typeof buildSchema>>

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { t } = useI18n()
  const schema = useMemo(() => buildSchema(t), [t])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)
    try {
      await authApi.forgotPassword(values.email)
      navigate('/forgot-password/sent', { state: { email: values.email } })
    } catch {
      // BE luôn trả 202 kể cả email không tồn tại; lỗi ở đây chỉ là lỗi mạng thật sự
      setSubmitError(t('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong. Please try again.'))
    }
  }

  return (
    <AuthCard
      icon={<LockIcon className="h-5 w-5" />}
      title={t('Quên mật khẩu?', 'Forgot your password?')}
      description={t('Nhập email, chúng tôi sẽ gửi link đặt lại.', "Enter your email and we'll send a reset link.")}
      footer={
        <Link to="/login" className={authLinkClass}>
          {t('Quay lại đăng nhập', 'Back to sign in')}
        </Link>
      }
    >
      {submitError && (
        <div className="mb-4">
          <Alert tone="error">{submitError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <TextField
          label={t('Email công việc', 'Work email')}
          icon={<MailIcon className="h-4 w-4" />}
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" isLoading={isSubmitting}>
          {t('Gửi link đặt lại mật khẩu', 'Send reset link')}
        </Button>
      </form>
    </AuthCard>
  )
}
