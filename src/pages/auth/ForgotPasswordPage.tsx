import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { authApi } from '@/api/authApi'
import { MailIcon } from '@/components/ui/icons'

const schema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
})
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

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
      setSubmitError('Có lỗi xảy ra, vui lòng thử lại.')
    }
  }

  return (
    <AuthCard>
      <AuthCardEyebrow>// Quên mật khẩu</AuthCardEyebrow>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Quên mật khẩu?</h1>
      <p className="mt-2 text-sm text-gray-500">
        Nhập email đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
      </p>

      {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <TextField
          label="Email công việc"
          icon={<MailIcon className="h-4 w-4" />}
          type="email"
          placeholder="name@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" isLoading={isSubmitting}>
          Gửi link đặt lại mật khẩu
        </Button>
      </form>

      <p className="mt-6 text-sm text-gray-500">
        <Link to="/login" className="font-medium text-brand-700">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthCard>
  )
}
