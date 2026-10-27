import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CredentialResponse } from "@react-oauth/google";
import { AuthCard, AuthCardEyebrow } from "@/components/layout/AuthCard";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";
import { authApi } from "@/api/authApi";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/apiClient";
import {
  LockIcon,
  MailIcon,
} from "@/components/ui/icons";

export const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  remember: z.boolean().optional(),
});
type FormValues = z.infer<typeof loginSchema>;

const LOGIN_ERROR_MESSAGE: Record<string, string> = {
  UNAUTHORIZED: "Email hoặc mật khẩu không đúng.",
  EMAIL_NOT_VERIFIED: "Email chưa được xác thực. Vui lòng kiểm tra hộp thư.",
  ACCOUNT_DISABLED:
    "Tài khoản của bạn đã bị vô hiệu hóa. Liên hệ quản trị viên.",
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applySession, refreshMe } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // ResetPasswordPage điều hướng về đây kèm state này — trước đó không ai đọc nên người dùng không biết đã đổi xong.
  const locationState = location.state as
    | { resetSuccess?: boolean; from?: string }
    | null;
  const resetSuccess = locationState?.resetSuccess === true;
  // `from` do ProtectedRoute đặt (đường dẫn nội bộ). Chỉ nhận path tuyệt đối cùng origin để không thành open-redirect.
  const returnTo =
    typeof locationState?.from === "string" &&
    locationState.from.startsWith("/") &&
    !locationState.from.startsWith("//")
      ? locationState.from
      : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(loginSchema) });

  const goAfterAuth = async () => {
    const me = await refreshMe();
    const hasOnboarded = me.companies.length > 0 || me.workspaces.length > 0;
    // Chưa onboard thì luôn về onboarding, bất kể trước đó định vào đâu.
    navigate(hasOnboarded ? (returnTo ?? "/") : "/onboarding/account-type");
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const session = await authApi.login({
        email: values.email,
        password: values.password,
      });
      applySession(session);
      await goAfterAuth();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(LOGIN_ERROR_MESSAGE[err.code] ?? err.message);
        if (err.code === "EMAIL_NOT_VERIFIED") {
          navigate("/verify-email/pending", { state: { email: values.email } });
        }
      } else {
        setServerError("Có lỗi xảy ra, vui lòng thử lại.");
      }
    }
  };

  const handleGoogleSuccess = async (credential: CredentialResponse) => {
    if (!credential.credential) return;
    setServerError(null);
    try {
      const session = await authApi.loginWithGoogle(credential.credential);
      applySession(session);
      if (session.isNewAccount) {
        navigate("/onboarding/account-type");
      } else {
        await goAfterAuth();
      }
    } catch {
      setServerError("Đăng nhập bằng Google thất bại, vui lòng thử lại.");
    }
  };

  return (
    <AuthCard headerRight="Cổng Doanh nghiệp">
      <AuthCardEyebrow>// Đăng nhập</AuthCardEyebrow>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">
        Đăng nhập vào SSAM
      </h1>
      <p className="mt-1.5 text-sm text-gray-500">
        Chào mừng bạn trở lại. Vui lòng nhập thông tin xác thực để truy cập dự
        án của bạn.
      </p>

      <div className="mt-5 space-y-2">
        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={() => setServerError("Đăng nhập bằng Google thất bại.")}
          text="continue_with"
        />
        {/* <button
          type="button"
          title="Sắp ra mắt"
          className="flex w-full items-center justify-center gap-2 h-10 rounded-md border border-gray-300 text-sm font-medium text-gray-400"
          disabled
        >
          <ShieldIcon className="h-4 w-4" />
          Tiếp tục với SAML SSO Doanh nghiệp
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">SẮP RA MẮT</span>
        </button> */}
      </div>

      <div className="my-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-400">
        <div className="h-px flex-1 bg-gray-200" />
        Hoặc đăng nhập bằng email
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {resetSuccess && !serverError && (
        <div className="mb-3">
          <Alert tone="success">
            Đã đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.
          </Alert>
        </div>
      )}
      {serverError && (
        <div className="mb-3">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <TextField
          label="Email công việc"
          icon={<MailIcon className="h-4 w-4" />}
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <div>
          <div className="mb-1 flex items-center justify-between">
            {/* Cùng kiểu với label bên trong TextField (không dùng prop label vì cần chèn link "Quên mật khẩu?" cạnh nhãn) */}
            <label
              htmlFor="password"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500"
            >
              Mật khẩu
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-brand-700"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <TextField
            id="password"
            icon={<LockIcon className="h-4 w-4" />}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            error={errors.password?.message}
            trailing={
              <button
                type="button"
                aria-pressed={showPassword}
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            }
            {...register("password")}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
            {...register("remember")}
          />
          Ghi nhớ đăng nhập
        </label>

        <Button type="submit" isLoading={isSubmitting}>
          Đăng nhập →
        </Button>
      </form>

      <p className="mt-5 text-sm text-gray-500">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="font-medium text-brand-700">
          Đăng ký ngay
        </Link>
      </p>
    </AuthCard>
  );
}
