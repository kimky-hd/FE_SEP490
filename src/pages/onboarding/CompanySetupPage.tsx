import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthCard, AuthCardEyebrow } from "@/components/layout/AuthCard";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/context/AuthContext";
import { companyApi } from "@/api/companyApi";
import { ApiError } from "@/lib/apiClient";
import {
  BuildingIcon,
  MailIcon,
  PhoneIcon,
} from "@/components/ui/icons";

// Slug này thành `Companies.code` (subdomain) nên phải ổn định với tiếng Việt: bỏ dấu tổ hợp (U+0300–U+036F)
// và map riêng "đ" vì NFD không tách được chữ này (trước đây "Đại Việt" → "ai-viet", mất hẳn chữ đ).
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const companySetupSchema = z.object({
  adminPhone: z
    .string()
    .min(1, "Vui lòng nhập số điện thoại")
    .regex(/^(\+84|0)\d{9,10}$/, "Số điện thoại không hợp lệ"),
  name: z.string().min(1, "Vui lòng nhập tên công ty"),
  taxCode: z.string().min(1, "Vui lòng nhập mã số thuế / giấy phép kinh doanh"),
  address: z.string().min(1, "Vui lòng nhập địa chỉ"),
  emailDomain: z
    .string()
    .min(1, "Vui lòng nhập domain công ty")
    .regex(
      /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i,
      "Domain không hợp lệ, vd: fintechcorp.com",
    ),
  domainAutoJoinEnabled: z.boolean(),
});
type FormValues = z.infer<typeof companySetupSchema>;

export function CompanySetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      domainAutoJoinEnabled: false,
      emailDomain: user?.email.split("@")[1] ?? "",
    },
  });

  const emailDomain = watch("emailDomain");

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const company = await companyApi.create({
        name: values.name,
        taxCode: values.taxCode,
        address: values.address,
        adminPhone: values.adminPhone,
        emailDomain: values.emailDomain,
        // Địa chỉ workspace tự sinh ngầm từ tên công ty, không hỏi user nữa.
        workspaceSlug: slugify(values.name),
        domainAutoJoinEnabled: values.domainAutoJoinEnabled,
      });
      navigate("/onboarding/create-workspace", {
        state: { companyId: company.id, suggestedName: company.name },
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "WORKSPACE_SLUG_TAKEN") {
        setServerError(
          "Tên công ty này đã có người dùng, vui lòng đổi tên khác.",
        );
      } else {
        setServerError("Có lỗi xảy ra, vui lòng thử lại.");
      }
    }
  };

  return (
    <AuthCard maxWidth="max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <AuthCardEyebrow>// Bước 2/2 — thông tin tổ chức</AuthCardEyebrow>
        <div className="grid w-20 grid-cols-2 gap-1">
          <span className="h-1 rounded-full bg-brand-600" />
          <span className="h-1 rounded-full bg-brand-200" />
        </div>
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">
        Thiết lập Không gian Doanh nghiệp
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Vui lòng cung cấp thông tin để cấu hình hệ thống và thiết lập không gian
        làm việc.
      </p>

      {serverError && (
        <div className="mt-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 space-y-6"
      >
        <fieldset className="rounded-md border border-gray-200 p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-gray-900">
            <span className="font-mono text-xs text-brand-700">01</span>
            Thông tin người quản trị
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Email công việc"
              icon={<MailIcon className="h-4 w-4" />}
              value={user?.email ?? ""}
              disabled
              hint="Không thể đổi"
            />
            <TextField
              label="Số điện thoại liên hệ"
              icon={<PhoneIcon className="h-4 w-4" />}
              placeholder="+84 912 345 678"
              error={errors.adminPhone?.message}
              {...register("adminPhone")}
            />
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-gray-200 p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-gray-900">
            <span className="font-mono text-xs text-brand-700">02</span>
            Thông tin cơ bản về doanh nghiệp
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Tên công ty"
              icon={<BuildingIcon className="h-4 w-4" />}
              error={errors.name?.message}
              {...register("name")}
            />
            <TextField
              label="Mã số thuế / Giấy phép kinh doanh"
              error={errors.taxCode?.message}
              {...register("taxCode")}
            />
            <div className="sm:col-span-2">
              <TextField
                label="Địa chỉ đăng ký kinh doanh / Trụ sở"
                error={errors.address?.message}
                {...register("address")}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-gray-200 p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-gray-900">
            <span className="font-mono text-xs text-brand-700">03</span>
            Domain công ty &amp; quyền tham gia
          </legend>
          <div className="mt-2 space-y-4">
            <TextField
              label="Domain công ty"
              hint="Dùng để nhận diện email nhân viên"
              placeholder="fintechcorp.com"
              error={errors.emailDomain?.message}
              {...register("emailDomain")}
            />

            <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-paper p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
                {...register("domainAutoJoinEnabled")}
              />
              <span className="text-sm text-gray-600">
                Cho phép bất kỳ ai có email{" "}
                <span className="font-medium text-gray-800">
                  @{emailDomain || "domain-cong-ty.com"}
                </span>{" "}
                tự động tham gia công ty này mà không cần bạn duyệt từng người.
                Nếu tắt, mỗi yêu cầu tham gia sẽ cần bạn phê duyệt thủ công.
              </span>
            </label>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button
            type="submit"
            isLoading={isSubmitting}
            className="!w-auto px-6"
          >
            Hoàn tất Thiết lập Doanh nghiệp →
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
