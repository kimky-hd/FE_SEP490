import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CredentialResponse } from "@react-oauth/google";
import { AuthCard, AuthCardEyebrow } from "@/components/layout/AuthCard";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";
import {
  LockIcon,
  MailIcon,
  UserIcon,
} from "@/components/ui/icons";
import { authApi } from "@/api/authApi";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { isPasswordValid } from "@/lib/passwordStrength";

export const registerSchema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ và tên"),
  email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
  password: z
    .string()
    .refine(isPasswordValid, "Mật khẩu chưa đạt các yêu cầu bên dưới"),
  agree: z
    .boolean()
    .refine((v) => v, { message: "Bạn cần đồng ý điều khoản để tiếp tục" }),
});
type FormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { applySession, refreshMe } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { agree: true },
  });

  const password = watch("password") ?? "";

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await authApi.register({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      navigate("/verify-email/pending", { state: { email: values.email } });
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_ALREADY_EXISTS") {
        setServerError(
          "Email này đã được sử dụng. Bạn thử đăng nhập thay vì đăng ký?",
        );
      } else if (err instanceof ApiError) {
        setServerError(err.message);
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
        // Tài khoản cũ đăng nhập lại qua nút Google ở trang Đăng ký: phải nạp companies/workspaces
        // trước khi vào "/" — applySession chỉ set user, không thì Dashboard hiện sai "không gian cá nhân".
        const me = await refreshMe();
        const hasOnboarded =
          me.companies.length > 0 || me.workspaces.length > 0;
        navigate(hasOnboarded ? "/" : "/onboarding/account-type");
      }
    } catch {
      setServerError("Đăng ký bằng Google thất bại, vui lòng thử lại.");
    }
  };

  return (
    <AuthCard headerRight="Cổng kết nối doanh nghiệp">
      <AuthCardEyebrow>// Đăng ký</AuthCardEyebrow>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950">
        Tạo tài khoản SSAM của bạn
      </h1>

      <div className="mt-5 space-y-2">
        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={() => setServerError("Đăng ký bằng Google thất bại.")}
          text="signup_with"
        />
        {/* <button
          type="button"
          title="Sắp ra mắt"
          className="flex w-full items-center justify-center gap-2 h-10 rounded-md border border-gray-300 text-sm font-medium text-gray-400"
          disabled
        >
          <GithubIcon className="h-4 w-4" />
          Tiếp tục với GitHub
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">SẮP RA MẮT</span>
        </button> */}
      </div>

      <div className="my-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-400">
        <div className="h-px flex-1 bg-gray-200" />
        Hoặc đăng ký bằng email
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {serverError && (
        <div className="mb-3">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <TextField
          label="Họ và tên"
          hint="Bắt buộc"
          icon={<UserIcon className="h-4 w-4" />}
          autoComplete="name"
          placeholder="Sarah Lin"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <TextField
          label="Email"
          // hint="Sẵn sàng cho SSO doanh nghiệp"
          icon={<MailIcon className="h-4 w-4" />}
          type="email"
          autoComplete="email"
          placeholder="sarah@fintechcorp.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <div>
          <TextField
            label="Mật khẩu"
            icon={<LockIcon className="h-4 w-4" />}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
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
          <PasswordStrengthMeter password={password} />
        </div>

        {/* <label className="flex items-start gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
            {...register("agree")}
          />
          <span>
            Bằng việc đăng ký, bạn đồng ý với{" "}
            <a href="#" className="font-medium text-brand-700">
              Điều khoản Dịch vụ
            </a>{" "}
            và{" "}
            <a href="#" className="font-medium text-brand-700">
              Chính sách Quyền riêng tư
            </a>{" "}
            của SSAM.
          </span>
        </label>
        {errors.agree && (
          <p className="text-xs text-red-600">{errors.agree.message}</p>
        )} */}

        <Button type="submit" isLoading={isSubmitting}>
          Tạo tài khoản →
        </Button>
      </form>

      <p className="mt-5 text-sm text-gray-500">
        Đã có tài khoản?{" "}
        <Link to="/login" className="font-medium text-brand-700">
          Đăng nhập
        </Link>
      </p>
    </AuthCard>
  );
}
