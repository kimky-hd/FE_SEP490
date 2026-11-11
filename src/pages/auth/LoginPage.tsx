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
import { isOnboarded } from '@/lib/onboarding'
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

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const demoAccounts = [
    {
      name: 'Nguyễn Minh Khoa',
      email: 'sarah@fintechcorp.com',
      role: 'Tenant Admin · CTO Khối Chứng khoán Số',
      badge: 'Toàn quyền Công ty & Dự án',
    },
    {
      name: 'Vũ Kim Kỳ',
      email: 'ky@fintechcorp.com',
      role: 'Project Manager · Giám đốc Dự án OMS KRX',
      badge: 'Quản lý Dự án, Sprint, Workflow',
    },
    {
      name: 'Phạm Minh Lương',
      email: 'luong@fintechcorp.com',
      role: 'Tech Lead · Kiến trúc sư Core Trading FIX 4.4',
      badge: 'Duyệt SRS, Quản lý Sprint, Code Review',
    },
    {
      name: 'Phạm Công Minh',
      email: 'minh@fintechcorp.com',
      role: 'Lead BA · Phân tích Nghiệp vụ KRX & VSD T+2',
      badge: 'Soạn thảo & Sinh AI BRD/URD/SRS',
    },
    {
      name: 'Trương Quang Tâm',
      email: 'tam@fintechcorp.com',
      role: 'QA Lead · Trưởng nhóm Kiểm thử Chứng khoán',
      badge: 'Lập Đợt Test, Deploy Build, Duyệt SRS',
    },
    {
      name: 'Lê Thị Khánh Linh',
      email: 'linh@fintechcorp.com',
      role: 'QA / Tester · Chuyên viên Kiểm thử Tự động',
      badge: 'Chạy Test SIT/UAT & Báo lỗi Bug',
    },
    {
      name: 'Nguyễn Hoàng Nam',
      email: 'nam@fintechcorp.com',
      role: 'Senior Backend Dev · Core Cash & Margin Engine',
      badge: 'Xử lý Task/Bug Kanban & Code',
    },
    {
      name: 'Hoàng Minh Quân',
      email: 'quan@fintechcorp.com',
      role: 'Frontend Dev · Bảng giá WebSocket & Đặt lệnh',
      badge: 'Xử lý Story/Task Giao diện',
    },
    {
      name: 'Đặng Thu Trang',
      email: 'trang@fintechcorp.com',
      role: 'UI/UX Designer · Thiết kế Bảng giá & eKYC',
      badge: 'Thiết kế Figma & Đặc tả UI',
    },
    {
      name: 'Trần Văn Cường',
      email: 'tran.c@fintechcorp.com',
      role: 'Compliance Reviewer · Kiểm soát Tuân thủ UBCKNN',
      badge: 'Chỉ xem & Nhận xét Tài liệu (Read-only)',
    },
  ]

  const goAfterAuth = async () => {
    const me = await refreshMe()
    // Chưa onboard thì luôn về onboarding, bất kể trước đó định vào đâu.
    navigate(isOnboarded(me) ? (returnTo ?? '/') : '/onboarding/start')
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
        navigate('/onboarding/start')
      } else {
        await goAfterAuth()
      }
    } catch {
      setServerError(t('Đăng nhập bằng Google thất bại, vui lòng thử lại.', 'Google sign-in failed. Please try again.'))
    }
  }

  return (
    <AuthCard
      title={t('Đăng nhập SSAM', 'Sign in to SSAM')}
      description={t('Tiếp tục với tài khoản công việc của bạn.', 'Continue with your work account.')}
      footer={
        <>
          {t('Chưa có tài khoản?', "Don't have an account?")}{' '}
          <Link to="/register" className={authLinkClass}>
            {t('Đăng ký', 'Sign up')}
          </Link>
        </>
      }
    >
      <GoogleAuthButton
        onSuccess={handleGoogleSuccess}
        onError={() => setServerError(t('Đăng nhập bằng Google thất bại.', 'Google sign-in failed.'))}
        text="continue_with"
      />

      <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        {t('hoặc', 'or')}
        <div className="h-px flex-1 bg-gray-200" />
      </div>

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

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
            <Link to="/forgot-password" className={`${authLinkClass} text-[13px]`}>
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

      {import.meta.env.VITE_USE_MOCK !== 'false' && (
        <div className="mt-5 border-t border-gray-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">
              {t('Tài khoản mẫu (Chứng khoán KRX · RBAC)', 'Demo Accounts (Securities KRX · RBAC)')}
            </span>
            <span className="font-mono text-[11px] text-gray-500">Password@123</span>
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-1">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setValue('email', acc.email, { shouldValidate: true })
                  setValue('password', 'Password@123', { shouldValidate: true })
                }}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50/70 px-2.5 py-1.5 text-left transition hover:border-brand-500 hover:bg-brand-50/40"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-gray-900">{acc.name}</span>
                    <span className="truncate font-mono text-[11px] text-gray-500">({acc.email})</span>
                  </div>
                  <div className="truncate text-[11px] text-gray-600">{acc.role}</div>
                </div>
                <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 shadow-2xs ring-1 ring-gray-200">
                  {acc.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthCard>
  )
}
