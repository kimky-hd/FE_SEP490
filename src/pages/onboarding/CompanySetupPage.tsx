import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { ApiError } from '@/lib/apiClient'
import { BuildingIcon, PhoneIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

// Slug này thành `Companies.code` (subdomain) nên phải ổn định với tiếng Việt: bỏ dấu tổ hợp (U+0300–U+036F)
// và map riêng "đ" vì NFD không tách được chữ này (trước đây "Đại Việt" → "ai-viet", mất hẳn chữ đ).
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

// Dựng schema theo ngôn ngữ hiện tại; bản export mặc định giữ thông báo tiếng Việt.
export const buildCompanySetupSchema = (t: (vi: string, en: string) => string) =>
  z.object({
    adminPhone: z
      .string()
      .min(1, t('Vui lòng nhập số điện thoại', 'Please enter a phone number'))
      .regex(/^(\+84|0)\d{9,10}$/, t('Số điện thoại không hợp lệ', 'Invalid phone number')),
    name: z.string().min(1, t('Vui lòng nhập tên công ty', 'Please enter the company name')),
    taxCode: z
      .string()
      .min(
        1,
        t('Vui lòng nhập mã số thuế / giấy phép kinh doanh', 'Please enter the tax ID / business license number'),
      ),
    address: z.string().min(1, t('Vui lòng nhập địa chỉ', 'Please enter the address')),
    emailDomain: z
      .string()
      .min(1, t('Vui lòng nhập domain công ty', 'Please enter the company domain'))
      .regex(
        /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i,
        t('Domain không hợp lệ, vd: fintechcorp.com', 'Invalid domain, e.g. fintechcorp.com'),
      ),
    domainAutoJoinEnabled: z.boolean(),
  })
export const companySetupSchema = buildCompanySetupSchema((vi) => vi)
type FormValues = z.infer<typeof companySetupSchema>

export function CompanySetupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useI18n()
  const schema = useMemo(() => buildCompanySetupSchema(t), [t])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      domainAutoJoinEnabled: false,
      emailDomain: user?.email.split('@')[1] ?? '',
    },
  })

  const emailDomain = watch('emailDomain')

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
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
      })
      navigate('/onboarding/create-workspace', {
        state: { companyId: company.id, suggestedName: company.name },
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WORKSPACE_SLUG_TAKEN') {
        setServerError(
          t(
            'Tên công ty này đã có người dùng, vui lòng đổi tên khác.',
            'This company name is already taken. Please choose another.',
          ),
        )
      } else {
        setServerError(t('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong. Please try again.'))
      }
    }
  }

  return (
    <AuthCard
      maxWidth="max-w-xl"
      title={t('Thiết lập công ty', 'Set up your company')}
      description={t(
        'Thông tin này giúp đồng nghiệp tìm thấy công ty của bạn.',
        'This helps your colleagues find your company.',
      )}
    >
      {serverError && (
        <div className="mb-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <TextField
          label={t('Tên công ty', 'Company name')}
          icon={<BuildingIcon className="h-4 w-4" />}
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            label={t('Mã số thuế / GPKD', 'Tax ID / Business license')}
            error={errors.taxCode?.message}
            {...register('taxCode')}
          />
          <TextField
            label={t('Số điện thoại liên hệ', 'Contact phone number')}
            icon={<PhoneIcon className="h-4 w-4" />}
            type="tel"
            autoComplete="tel"
            placeholder="0912345678"
            error={errors.adminPhone?.message}
            {...register('adminPhone')}
          />
        </div>
        <TextField
          label={t('Địa chỉ trụ sở', 'Headquarters address')}
          autoComplete="street-address"
          error={errors.address?.message}
          {...register('address')}
        />
        <div>
          <TextField
            label={t('Domain công ty', 'Company domain')}
            placeholder="fintechcorp.com"
            error={errors.emailDomain?.message}
            {...register('emailDomain')}
          />
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-brand-600"
              {...register('domainAutoJoinEnabled')}
            />
            <span>
              {t('Cho email', 'Let anyone with an')}{' '}
              <span className="font-medium text-gray-900">
                @{emailDomain || t('domain-cong-ty.com', 'company-domain.com')}
              </span>{' '}
              {t('tự tham gia, không cần duyệt', 'email join without approval')}
            </span>
          </label>
        </div>

        <Button type="submit" isLoading={isSubmitting}>
          {t('Tạo công ty', 'Create company')}
        </Button>
      </form>
    </AuthCard>
  )
}
