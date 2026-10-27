import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { FolderIcon } from '@/components/ui/icons'
import { workspaceApi } from '@/api/workspaceApi'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/apiErrors'
import { slugify, WORKSPACE_CODE_PATTERN } from '@/lib/slug'
import type { WorkspaceDto } from '@/types/rbac'

// FR §III.4.2 "Create Workspace (modal)" + wireframe "Tạo Workspace (modal trong app)".
export const workspaceFormSchema = z.object({
  name: z.string().trim().min(2, 'Tên workspace tối thiểu 2 ký tự').max(255, 'Tối đa 255 ký tự'),
  code: z
    .string()
    .trim()
    .min(2, 'Mã tối thiểu 2 ký tự')
    .max(50, 'Tối đa 50 ký tự')
    .regex(WORKSPACE_CODE_PATTERN, 'Chỉ gồm chữ thường, số và dấu "-"'),
  description: z.string().max(1000, 'Tối đa 1000 ký tự').optional(),
})

const createSchema = workspaceFormSchema.extend({ inviteNow: z.boolean().optional() })
type CreateValues = z.infer<typeof createSchema>

interface Props {
  open: boolean
  companyId: number
  companyName: string
  onClose: () => void
  onCreated: (workspace: WorkspaceDto, options: { inviteNow: boolean }) => void
}

export function CreateWorkspaceModal({ open, companyId, companyName, onClose, onCreated }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [codeTouched, setCodeTouched] = useState(false)
  const [codeSuggestion, setCodeSuggestion] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', code: '', description: '', inviteNow: false },
  })

  const name = watch('name')

  // Mã tự sinh theo tên cho tới khi người dùng tự sửa ô Mã.
  useEffect(() => {
    if (!codeTouched) setValue('code', slugify(name ?? ''), { shouldValidate: false })
  }, [name, codeTouched, setValue])

  useEffect(() => {
    if (!open) {
      reset()
      setCodeTouched(false)
      setServerError(null)
      setCodeSuggestion(null)
    }
  }, [open, reset])

  const checkCode = async (code: string) => {
    setCodeSuggestion(null)
    if (!WORKSPACE_CODE_PATTERN.test(code)) return
    try {
      const result = await workspaceApi.checkCode(companyId, code)
      if (!result.available) {
        setError('code', { message: 'Mã này đã được dùng trong công ty.' })
        setCodeSuggestion(result.suggestion)
      }
    } catch {
      // Kiểm tra trước chỉ để tiện — lỗi mạng thì để BE chặn lúc submit.
    }
  }

  const onSubmit = async (values: CreateValues) => {
    setServerError(null)
    try {
      const workspace = await workspaceApi.create({
        name: values.name.trim(),
        code: values.code.trim(),
        description: values.description?.trim() || undefined,
        companyId,
      })
      onCreated(workspace, { inviteNow: values.inviteNow === true })
    } catch (err) {
      if (!applyApiFieldErrors(err, setError, ['name', 'code', 'description'])) {
        setServerError(apiErrorMessage(err))
      }
    }
  }

  const codeField = register('code')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tạo Workspace mới"
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            Huỷ
          </Button>
          <Button inline form="create-workspace-form" type="submit" isLoading={isSubmitting}>
            Tạo Workspace
          </Button>
        </>
      }
    >
      <form id="create-workspace-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Trong: <span className="font-semibold text-gray-800">{companyName}</span>
        </div>

        {serverError && <Alert tone="error">{serverError}</Alert>}

        <TextField
          label="Tên workspace *"
          icon={<FolderIcon className="h-4 w-4" />}
          placeholder="Vd: Internal Portal v2"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />

        <div>
          <TextField
            label="Mã (code)"
            hint="Slug nội bộ, duy nhất trong công ty"
            placeholder="internal-portal-v2"
            className="font-mono"
            error={errors.code?.message}
            {...codeField}
            onChange={(e) => {
              setCodeTouched(true)
              void codeField.onChange(e)
            }}
            onBlur={(e) => {
              void codeField.onBlur(e)
              void checkCode(e.target.value.trim())
            }}
          />
          {codeSuggestion && (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-brand-700 underline underline-offset-2"
              onClick={() => {
                setCodeTouched(true)
                setValue('code', codeSuggestion, { shouldValidate: true })
                setCodeSuggestion(null)
              }}
            >
              Dùng mã gợi ý: {codeSuggestion}
            </button>
          )}
        </div>

        <TextAreaField
          label="Mô tả"
          placeholder="Vd: Cổng thông tin nội bộ cho nhân viên"
          error={errors.description?.message}
          {...register('description')}
        />


      </form>
    </Modal>
  )
}
