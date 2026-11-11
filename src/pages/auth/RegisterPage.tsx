import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CredentialResponse } from '@react-oauth/google'
import { AuthCard, authLinkClass } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter'
import { GoogleAuthButton } from '@/components/ui/GoogleAuthButton'
import { LockIcon, MailIcon, UserIcon } from '@/components/ui/icons'
import { authApi } from '@/api/authApi'
import { useAuth } from '@/context/AuthContext'
import { isOnboarded } from '@/lib/onboarding'
import { ApiError } from '@/lib/apiClient'
import { isPasswordValid } from '@/lib/passwordStrength'
import { useI18n } from '@/i18n'

type Translate = (vi: string, en: string) => string

// Dựng schema theo ngôn ngữ hiện tại; bản export mặc định giữ thông báo tiếng Việt.
export const buildRegisterSchema = (t: Translate) =>
  z.object({
    fullName: z.string().min(1, t('Vui lòng nhập họ và tên', 'Please enter your full name')),
    email: z
      .string()
      .min(1, t('Vui lòng nhập email', 'Please enter your email'))
      .email(t('Email không hợp lệ', 'Invalid email')),
    password: z
      .string()
      .refine(
        isPasswordValid,
        t('Mật khẩu chưa đạt các yêu cầu bên dưới', 'Password does not meet the requirements below'),
      ),
    agree: z.boolean().refine((v) => v, {
      message: t('Bạn cần đồng ý điều khoản để tiếp tục', 'You need to accept the terms to continue'),
    }),
  })
export const registerSchema = buildRegisterSchema((vi) => vi)
type FormValues = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  // Trang chủ gửi sang `/register?email=…` từ câu mời cuối trang.
  const [searchParams] = useSearchParams()
  const { applySession, refreshMe } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useI18n()
  const schema = useMemo(() => buildRegisterSchema(t), [t])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { agree: true, email: searchParams.get('email') ?? '' },
  })

  const password = watch('password') ?? ''

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await authApi.register({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      })
      navigate('/verify-email/pending', { state: { email: values.email } })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_EXISTS') {
        setServerError(
          t(
            'Email này đã được sử dụng. Bạn thử đăng nhập thay vì đăng ký?',
            'This email is already in use. Try signing in instead?',
          ),
        )
      } else if (err instanceof ApiError) {
        setServerError(err.message)
      } else {
        setServerError(t('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong. Please try again.'))
      }
    }
  }

  const handleGoogleSuccess = async (credential: CredentialResponse) => {
    if (!credential.credential) return
    setServerError(null)
    try {
      const session = await authApi.loginWithGoogle(credential.credential)
      applySession(session)
      if (session.isNewAccount) {
        navigate('/onboarding/start')
      } else {
        // Tài khoản cũ đăng nhập lại qua nút Google ở trang Đăng ký: phải nạp companies/workspaces
        // trước khi vào "/" — applySession chỉ set user, không thì Dashboard hiện sai "không gian cá nhân".
        const me = await refreshMe()
        navigate(isOnboarded(me) ? '/' : '/onboarding/start')
      }
    } catch {
      setServerError(t('Đăng ký bằng Google thất bại, vui lòng thử lại.', 'Google sign-up failed. Please try again.'))
    }
  }

  return (
    <AuthCard
      align="start"
      title={t('Tạo tài khoản', 'Create your account')}
      description={t(
        'Dùng email công ty, SSAM sẽ tự tìm công ty của bạn.',
        'Use your company email and SSAM will find your company for you.',
      )}
      footer={
        <>
          {t('Đã có tài khoản?', 'Already have an account?')}{' '}
          <Link to="/login" className={authLinkClass}>
            {t('Đăng nhập', 'Sign in')}
          </Link>
        </>
      }
    >
      {serverError && (
        <div className="mb-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      {/* Theo mockup B: form email trước, Google xếp sau dải "hoặc". */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField
          label={t('Họ và tên', 'Full name')}
          icon={<UserIcon className="h-4 w-4" />}
          autoComplete="name"
          placeholder={t('VD: Nguyễn Minh Anh', 'e.g. Jane Smith')}
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label="Email"
          icon={<MailIcon className="h-4 w-4" />}
          type="email"
          autoComplete="email"
          placeholder={t('ten@congty.vn', 'name@company.com')}
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <TextField
            label={t('Mật khẩu', 'Password')}
            icon={<LockIcon className="h-4 w-4" />}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder={t('Ít nhất 8 ký tự', 'At least 8 characters')}
            error={errors.password?.message}
            trailing={
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={
                  showPassword
                    ? t('Ẩn các ký tự đã nhập', 'Hide password')
                    : t('Hiện các ký tự đã nhập', 'Show password')
                }
                className="-mr-2 inline-flex h-11 min-w-11 items-center justify-center rounded-control px-2 text-xs font-medium text-gray-500 hover:text-gray-900 lg:h-9"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? t('Ẩn', 'Hide') : t('Hiện', 'Show')}
              </button>
            }
            {...register('password')}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Ô "đồng ý điều khoản" đã bỏ khỏi UI; `agree` mặc định true để schema vẫn hợp lệ. */}
        <Button type="submit" isLoading={isSubmitting}>
          {t('Tạo tài khoản', 'Create account')}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        {t('hoặc', 'or')}
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <GoogleAuthButton
        onSuccess={handleGoogleSuccess}
        onError={() => setServerError(t('Đăng ký bằng Google thất bại.', 'Google sign-up failed.'))}
        text="signup_with"
      />
    </AuthCard>
  )
}
