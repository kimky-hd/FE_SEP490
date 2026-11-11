import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { addressApi, type AdminUnit } from '@/api/addressApi'
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
// Địa chỉ trụ sở tách 3 phần: Tỉnh/Thành phố → Phường/Xã (đơn vị hành chính 2 cấp) + số nhà, đường.
// BE vẫn nhận một chuỗi `address` nên FE ghép lại khi gửi (`composeAddress`).
export const buildCompanySetupSchema = (t: (vi: string, en: string) => string) =>
  z.object({
    adminPhone: z
      .string()
      .min(1, t('Vui lòng nhập số điện thoại', 'Please enter a phone number'))
      .regex(/^(\+84|0)\d{9,10}$/, t('Số điện thoại không hợp lệ', 'Invalid phone number')),
    name: z.string().trim().min(1, t('Vui lòng nhập tên công ty', 'Please enter the company name')),
    taxCode: z
      .string()
      .trim()
      .min(
        1,
        t('Vui lòng nhập mã số thuế / giấy phép kinh doanh', 'Please enter the tax ID / business license number'),
      ),
    province: z.string().trim().min(1, t('Vui lòng chọn tỉnh / thành phố', 'Please choose a province / city')),
    ward: z.string().trim().min(1, t('Vui lòng chọn phường / xã', 'Please choose a ward / commune')),
    street: z.string().trim().min(1, t('Vui lòng nhập số nhà, tên đường', 'Please enter the street address')),
    emailDomain: z
      .string()
      .min(1, t('Vui lòng nhập domain công ty', 'Please enter the company domain'))
      .regex(
        /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i,
        t('Domain không hợp lệ, vd: fintechcorp.com', 'Invalid domain, e.g. fintechcorp.com'),
      ),
  })
export const companySetupSchema = buildCompanySetupSchema((vi) => vi)
type FormValues = z.infer<typeof companySetupSchema>

export const composeAddress = (v: Pick<FormValues, 'street' | 'ward' | 'province'>) =>
  [v.street, v.ward, v.province].map((x) => x.trim()).join(', ')

const FORM_ID = 'company-setup-form'

const toOptions = (list: AdminUnit[] | null) => (list ?? []).map((u) => ({ value: u.code, label: u.name }))

export function CompanySetupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useI18n()
  const schema = useMemo(() => buildCompanySetupSchema(t), [t])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      province: '',
      ward: '',
      emailDomain: user?.email.split('@')[1] ?? '',
    },
  })

  // Danh sách địa giới. API công khai lỗi thì chuyển sang tự gõ tên tỉnh / xã để không chặn việc tạo công ty.
  const [provinces, setProvinces] = useState<AdminUnit[] | null>(null)
  const [wards, setWards] = useState<AdminUnit[] | null>(null)
  const [provinceCode, setProvinceCode] = useState<number | null>(null)
  const [wardCode, setWardCode] = useState<number | null>(null)
  const [manualAddress, setManualAddress] = useState(false)

  useEffect(() => {
    let alive = true
    addressApi.provinces().then(
      (list) => alive && setProvinces(list),
      () => alive && setManualAddress(true),
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setWards(null)
    if (provinceCode === null) return
    let alive = true
    addressApi.wards(provinceCode).then(
      (list) => alive && setWards(list),
      () => alive && setManualAddress(true),
    )
    return () => {
      alive = false
    }
  }, [provinceCode])

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const company = await companyApi.create({
        name: values.name,
        taxCode: values.taxCode,
        address: composeAddress(values),
        adminPhone: values.adminPhone,
        emailDomain: values.emailDomain,
        // Địa chỉ workspace tự sinh ngầm từ tên công ty, không hỏi user nữa.
        workspaceSlug: slugify(values.name),
        // Đã bỏ ô "tự tham gia theo domain": người cùng domain luôn gửi yêu cầu để admin duyệt.
        domainAutoJoinEnabled: false,
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

  // Domain đang gõ để câu gợi ý dưới ô cập nhật theo.
  const domain = watch('emailDomain')?.trim()

  return (
    <AuthCard
      width="wide"
      align="start"
      headerRight={user?.email}
      title={t('Thiết lập công ty', 'Set up your company')}
      description={t('Bạn sẽ là quản trị viên của công ty này.', "You'll be the admin of this company.")}
      actions={
        <Button type="submit" form={FORM_ID} isLoading={isSubmitting} inline className="px-[18px]">
          {t('Tạo công ty', 'Create company')}
          <span aria-hidden="true">→</span>
        </Button>
      }
    >
      {serverError && (
        <div className="mb-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      {/* Mockup B: thẻ 520px, các trường xếp hàng đơn / hàng đôi; nút submit nằm ở thanh cuối thẻ (thuộc tính form). */}
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3.5">
        <TextField
          label={t('Tên công ty', 'Company name')}
          icon={<BuildingIcon className="h-4 w-4" />}
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
          <TextField label={t('Mã số thuế', 'Tax ID')} error={errors.taxCode?.message} {...register('taxCode')} />
          <TextField
            label={t('Điện thoại', 'Phone')}
            icon={<PhoneIcon className="h-4 w-4" />}
            type="tel"
            autoComplete="tel"
            placeholder="0912345678"
            error={errors.adminPhone?.message}
            {...register('adminPhone')}
          />
        </div>
        <div>
          <TextField
            label={t('Domain email', 'Email domain')}
            placeholder="fintechcorp.com"
            error={errors.emailDomain?.message}
            aria-describedby={errors.emailDomain ? 'emailDomain-error emailDomain-hint' : 'emailDomain-hint'}
            {...register('emailDomain')}
          />
          <p id="emailDomain-hint" className="mt-1.5 text-xs text-gray-500">
            {domain
              ? t(
                  `Người dùng email @${domain} sẽ được gợi ý tham gia, bạn duyệt từng người.`,
                  `People with an @${domain} email will be suggested to join; you approve each one.`,
                )
              : t(
                  'Người dùng cùng domain email sẽ được gợi ý tham gia, bạn duyệt từng người.',
                  'People with this email domain will be suggested to join; you approve each one.',
                )}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
          {manualAddress ? (
            <>
              <TextField
                label={t('Tỉnh / Thành phố', 'Province / City')}
                autoComplete="address-level1"
                error={errors.province?.message}
                {...register('province')}
              />
              <TextField
                label={t('Phường / Xã', 'Ward / Commune')}
                autoComplete="address-level2"
                error={errors.ward?.message}
                {...register('ward')}
              />
            </>
          ) : (
            <>
              <SearchSelect
                id="province"
                label={t('Tỉnh / Thành phố', 'Province / City')}
                placeholder={t('Chọn tỉnh / thành phố', 'Choose a province / city')}
                options={toOptions(provinces)}
                loading={provinces === null}
                value={provinceCode}
                error={errors.province?.message}
                onChange={(o) => {
                  if (o.value === provinceCode) return
                  setProvinceCode(Number(o.value))
                  setWardCode(null)
                  setValue('province', o.label, { shouldValidate: true })
                  setValue('ward', '')
                }}
              />
              <SearchSelect
                id="ward"
                label={t('Phường / Xã', 'Ward / Commune')}
                placeholder={
                  provinceCode === null
                    ? t('Chọn tỉnh / thành phố trước', 'Choose a province first')
                    : t('Chọn phường / xã', 'Choose a ward / commune')
                }
                options={toOptions(wards)}
                disabled={provinceCode === null}
                loading={provinceCode !== null && wards === null}
                value={wardCode}
                error={errors.ward?.message}
                onChange={(o) => {
                  setWardCode(Number(o.value))
                  setValue('ward', o.label, { shouldValidate: true })
                }}
              />
            </>
          )}
        </div>
        <TextField
          label={t('Số nhà, tên đường', 'Street address')}
          placeholder={t('Vd: Tầng 12, 208 Nguyễn Hữu Cảnh', 'E.g. Floor 12, 208 Nguyen Huu Canh')}
          autoComplete="address-line1"
          error={errors.street?.message}
          {...register('street')}
        />
        {manualAddress && (
          <p className="text-xs text-gray-500">
            {t(
              'Không tải được danh sách tỉnh / xã, bạn nhập tay giúp nhé.',
              "Couldn't load the province / ward list, so please type them in.",
            )}
          </p>
        )}
      </form>
    </AuthCard>
  )
}
