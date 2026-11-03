import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FolderIcon, PlusIcon } from '@/components/ui/icons'
import { workspaceApi } from '@/api/workspaceApi'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n'

interface LocationState {
  companyId?: number | null
  suggestedName?: string
}

// Dựng schema theo ngôn ngữ hiện tại; bản export mặc định giữ thông báo tiếng Việt.
export const buildCreateWorkspaceSchema = (t: (vi: string, en: string) => string) =>
  z.object({
    name: z.string().min(1, t('Vui lòng nhập tên workspace', 'Please enter a workspace name')),
    description: z.string().optional(),
  })
export const createWorkspaceSchema = buildCreateWorkspaceSchema((vi) => vi)
type FormValues = z.infer<typeof createWorkspaceSchema>

export function CreateWorkspacePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshMe } = useAuth()
  const { companyId = null, suggestedName } = (location.state as LocationState | null) ?? {}
  const [serverError, setServerError] = useState<string | null>(null)
  const [showDescription, setShowDescription] = useState(false)
  const { t } = useI18n()
  const schema = useMemo(() => buildCreateWorkspaceSchema(t), [t])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: suggestedName ?? '' },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await workspaceApi.create({ name: values.name, description: values.description, companyId })
      await refreshMe()
      navigate('/')
    } catch {
      setServerError(t('Có lỗi xảy ra, vui lòng thử lại.', 'Something went wrong. Please try again.'))
    }
  }

  return (
    <AuthCard
      title={t('Đặt tên workspace', 'Name your workspace')}
      description={t('Bạn có thể đổi tên sau.', 'You can rename it later.')}
    >
      {serverError && (
        <div className="mb-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <TextField
          label={t('Tên workspace', 'Workspace name')}
          icon={<FolderIcon className="h-4 w-4" />}
          placeholder={t('Vd: Đội sản phẩm', 'e.g. Product team')}
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />
        {showDescription ? (
          <TextField
            label={t('Mô tả (không bắt buộc)', 'Description (optional)')}
            autoFocus
            {...register('description')}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDescription(true)}
            className="inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          >
            <PlusIcon className="h-4 w-4" />
            {t('Thêm mô tả', 'Add a description')}
          </button>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {t('Tạo workspace', 'Create workspace')}
        </Button>
      </form>
    </AuthCard>
  )
}
