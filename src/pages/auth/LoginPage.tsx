import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CredentialResponse } from '@react-oauth/google'
import { AuthCard, authLinkClass } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { GoogleAuthButton } from '@/components/ui/GoogleAuthButton'
import { authApi } from '@/api/authApi'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/apiClient'
import { safeReturnTo } from '@/lib/safeReturnTo'
import { LockIcon, MailIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

type Translate = (vi: string, en: string) => string

// Dựng schema theo ngôn ngữ hiện tại; bản export mặc định giữ thông báo tiếng Việt.
export const buildLoginSchema = (t: Translate) =>
  z.object({
    email: z
      .string()
      .min(1, t('Vui lòng nhập email', 'Please enter your email'))
      .email(t('Email không hợp lệ', 'Invalid email')),
    password: z.string().min(1, t('Vui lòng nhập mật khẩu', 'Please enter your password')),
    remember: z.boolean().optional(),
  })
export const loginSchema = buildLoginSchema((vi) => vi)
type FormValues = z.infer<typeof loginSchema>

const loginErrorMessage = (t: Translate): Record<string, string> => ({
  UNAUTHORIZED: t('Email hoặc mật khẩu không đúng.', 'Incorrect email or password.'),
  EMAIL_NOT_VERIFIED: t(
    'Email chưa được xác thực. Vui lòng kiểm tra hộp thư.',
    'Your email is not verified yet. Please check your inbox.',
  ),
  ACCOUNT_DISABLED: t(
    'Tài khoản của bạn đã bị vô hiệu hóa. Liên hệ quản trị viên.',
    'Your account has been disabled. Contact your administrator.',
  ),
})

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { applySession, refreshMe } = useAuth()
  const { t } = useI18n()
  const schema = useMemo(() => buildLoginSchema(t), [t])
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  // ResetPasswordPage điều hướng về đây kèm state này — trước đó không ai đọc nên người dùng không biết đã đổi xong.
  const locationState = location.state as { resetSuccess?: boolean; from?: string } | null
  const resetSuccess = locationState?.resetSuccess === true
  // `from` do ProtectedRoute đặt (đường dẫn nội bộ). safeReturnTo chặn open-redirect (`//host`, dấu `\`).
  const returnTo = safeReturnTo(locationState?.from)

  const isMock = import.meta.env.VITE_USE_MOCK !== 'false'

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const goAfterAuth = async () => {
    const me = await refreshMe()
    const hasOnboarded = me.companies.length > 0 || me.workspaces.length > 0
    // Chưa onboard thì luôn về onboarding, bất kể trước đó định vào đâu.
    navigate(hasOnboarded ? (returnTo ?? '/') : '/onboarding/account-type')
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const session = await authApi.login({
        email: values.email,
        password: values.password,
      })
      applySession(session)
      await goAfterAuth()
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(loginErrorMessage(t)[err.code] ?? err.message)
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          navigate('/verify-email/pending', { state: { email: values.email } })
        }
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
        navigate('/onboarding/account-type')
      } else {
        await goAfterAuth()
      }
    } catch {
      setServerError(t('Đăng nhập bằng Google thất bại, vui lòng thử lại.', 'Google sign-in failed. Please try again.'))
    }
  }

  return (
    <AuthCard
      title={t('Đăng nhập vào SSAM', 'Sign in to SSAM')}
      description={t('Chào mừng bạn trở lại.', 'Welcome back.')}
      footer={
        <>
          {t('Chưa có tài khoản?', "Don't have an account?")}{' '}
          <Link to="/register" className={authLinkClass}>
            {t('Đăng ký ngay', 'Sign up')}
          </Link>
        </>
      }
    >
      <GoogleAuthButton
        onSuccess={handleGoogleSuccess}
        onError={() => setServerError(t('Đăng nhập bằng Google thất bại.', 'Google sign-in failed.'))}
        text="continue_with"
      />

      <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        {t('hoặc', 'or')}
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {isMock && (
        <div className="mb-4 rounded-control border border-brand-200 bg-brand-50/70 p-3 text-xs text-brand-900">
          <div className="flex items-center justify-between font-medium">
            <span>{t('Tài khoản mẫu theo Vai trò & Phân quyền', 'Demo Accounts by Role & Permission')}</span>
            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
              Password@123
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-800/80">
            {t(
              'Chọn nhanh tài khoản để kiểm thử luồng dự án và phân quyền RBAC theo từng vị trí:',
              'Click an account below to test the project workflow and RBAC permissions per role:',
            )}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {[
              { email: 'sarah@fintechcorp.com', label: 'Sarah Lin', role: 'Tenant & WS Admin' },
              { email: 'ky@fintechcorp.com', label: 'Vũ Kim Kỳ', role: 'Project Manager' },
              { email: 'minh@fintechcorp.com', label: 'Phạm Công Minh', role: 'Business Analyst (BA)' },
              { email: 'trang@fintechcorp.com', label: 'Đặng Thu Trang', role: 'Tech Lead' },
              { email: 'luong@fintechcorp.com', label: 'Phạm Minh Lương', role: 'Developer' },
              { email: 'tam@fintechcorp.com', label: 'Trương Quang Tâm', role: 'QA / Tester' },
              { email: 'quan@fintechcorp.com', label: 'Hoàng Minh Quân', role: 'UI/UX Designer' },
              { email: 'tran.c@fintechcorp.com', label: 'Trần Thị C', role: 'Reviewer (Chỉ xem)' },
            ].map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setValue('email', acc.email, { shouldValidate: true })
                  setValue('password', 'Password@123', { shouldValidate: true })
                }}
                className="flex flex-col items-start rounded border border-brand-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/60"
              >
                <span className="font-semibold text-gray-900">{acc.label}</span>
                <span className="text-[10.5px] font-medium text-brand-700">{acc.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {resetSuccess && !serverError && (
        <div className="mb-4">
          <Alert tone="success">
            {t(
              'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.',
              'Your password has been reset. Sign in with your new password.',
            )}
          </Alert>
        </div>
      )}
      {serverError && (
        <div className="mb-4">
          <Alert tone="error">{serverError}</Alert>
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
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            {/* Cùng kiểu với label bên trong TextField (không dùng prop label vì cần chèn link "Quên mật khẩu?" cạnh nhãn) */}
            <label htmlFor="password" className="text-sm font-medium text-gray-900">
              {t('Mật khẩu', 'Password')}
            </label>
            <Link to="/forgot-password" className={`${authLinkClass} text-sm`}>
              {t('Quên mật khẩu?', 'Forgot password?')}
            </Link>
          </div>
          <TextField
            id="password"
            icon={<LockIcon className="h-4 w-4" />}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('Mật khẩu của bạn', 'Your password')}
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
        </div>

        {/* "Ghi nhớ đăng nhập" đã bỏ: phiên luôn được lưu (localStorage) nên ô này không đổi được gì. */}
        <Button type="submit" isLoading={isSubmitting}>
          {t('Đăng nhập', 'Sign in')}
        </Button>
      </form>
    </AuthCard>
  )
}
