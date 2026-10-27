import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FolderIcon } from '@/components/ui/icons'
import { workspaceApi } from '@/api/workspaceApi'
import { useAuth } from '@/context/AuthContext'

interface LocationState {
  companyId?: number | null
  suggestedName?: string
}

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên workspace'),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof createWorkspaceSchema>

export function CreateWorkspacePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshMe } = useAuth()
  const { companyId = null, suggestedName } = (location.state as LocationState | null) ?? {}
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: suggestedName ?? '' },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await workspaceApi.create({ name: values.name, description: values.description, companyId })
      await refreshMe()
      navigate('/')
    } catch {
      setServerError('Có lỗi xảy ra, vui lòng thử lại.')
    }
  }

  return (
    <AuthCard>
      <AuthCardEyebrow>// Thiết lập workspace</AuthCardEyebrow>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">Tạo Workspace đầu tiên</h1>
      <p className="mt-2 text-sm text-gray-500">
        Đây là nơi Project, Tài liệu và Testcase của đội bạn sẽ sống. Bạn có thể tạo thêm workspace khác sau.
      </p>

      {serverError && (
        <div className="mt-4">
          <Alert tone="error">{serverError}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <TextField label="Tên workspace" icon={<FolderIcon className="h-4 w-4" />} error={errors.name?.message} {...register('name')} />
        <TextField label="Mô tả (không bắt buộc)" placeholder="Vd: Dự án SSAM nội bộ" {...register('description')} />
        <Button type="submit" isLoading={isSubmitting}>
          Tạo workspace →
        </Button>
      </form>
    </AuthCard>
  )
}
