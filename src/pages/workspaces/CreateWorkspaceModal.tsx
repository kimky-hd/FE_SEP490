import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ChevronDownIcon, FolderIcon } from '@/components/ui/icons'
import { workspaceApi } from '@/api/workspaceApi'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/apiErrors'
import { slugify, WORKSPACE_CODE_PATTERN } from '@/lib/slug'
import type { WorkspaceDto } from '@/types/rbac'
import { useI18n } from '@/i18n'

type T = (vi: string, en: string) => string

// FR §III.4.2 "Create Workspace (modal)" + wireframe "Tạo Workspace (modal trong app)".
// Dựng theo `t` để thông báo lỗi đổi theo ngôn ngữ.
export const makeWorkspaceFormSchema = (t: T) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(2, t('Tên workspace tối thiểu 2 ký tự', 'Workspace name must be at least 2 characters'))
      .max(255, t('Tối đa 255 ký tự', 'Up to 255 characters')),
    code: z
      .string()
      .trim()
      .min(2, t('Mã tối thiểu 2 ký tự', 'Code must be at least 2 characters'))
      .max(50, t('Tối đa 50 ký tự', 'Up to 50 characters'))
      .regex(WORKSPACE_CODE_PATTERN, t('Chỉ gồm chữ thường, số và dấu "-"', 'Only lowercase letters, numbers and "-"')),
    description: z.string().max(1000, t('Tối đa 1000 ký tự', 'Up to 1000 characters')).optional(),
  })

/** Bản tiếng Việt cố định, giữ cho code cũ. Trong component nên dùng `makeWorkspaceFormSchema(t)`. */
export const workspaceFormSchema = makeWorkspaceFormSchema((vi) => vi)

const makeCreateSchema = (t: T) => makeWorkspaceFormSchema(t).extend({ inviteNow: z.boolean().optional() })
type CreateValues = z.infer<ReturnType<typeof makeCreateSchema>>

interface Props {
  open: boolean
  companyId: number
  companyName: string
  onClose: () => void
  onCreated: (workspace: WorkspaceDto, options: { inviteNow: boolean }) => void
}

export function CreateWorkspaceModal({ open, companyId, companyName, onClose, onCreated }: Props) {
  const { t } = useI18n()
  const createSchema = useMemo(() => makeCreateSchema(t), [t])
  const [serverError, setServerError] = useState<string | null>(null)
  const [codeTouched, setCodeTouched] = useState(false)
  const [codeSuggestion, setCodeSuggestion] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

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
  const nameField = register('name')

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
      setShowAdvanced(false)
    }
  }, [open, reset])

  const checkCode = async (code: string) => {
    setCodeSuggestion(null)
    if (!WORKSPACE_CODE_PATTERN.test(code)) return
    try {
      const result = await workspaceApi.checkCode(companyId, code)
      if (!result.available) {
        setError('code', {
          message: t('Mã này đã được dùng trong công ty.', 'This code is already used in the company.'),
        })
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
  const code = watch('code')
  // Mã và mô tả gom vào "Tuỳ chọn khác"; tự mở khi có lỗi ở đó để người dùng thấy ngay.
  const advancedOpen = showAdvanced || Boolean(errors.code || errors.description || codeSuggestion)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Tạo workspace', 'New workspace')}
      description={t(`Trong ${companyName}`, `In ${companyName}`)}
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline form="create-workspace-form" type="submit" isLoading={isSubmitting}>
            {t('Tạo workspace', 'Create workspace')}
          </Button>
        </>
      }
    >
      <form id="create-workspace-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <TextField
          label={t('Tên workspace', 'Workspace name')}
          icon={<FolderIcon className="h-4 w-4" />}
          placeholder={t('Vd: Đội sản phẩm', 'e.g. Product team')}
          autoFocus
          error={errors.name?.message}
          {...nameField}
          onBlur={(e) => {
            void nameField.onBlur(e)
            // Mã đang tự sinh theo tên (ẩn): kiểm tra trùng luôn để báo sớm.
            if (!codeTouched) void checkCode(slugify(e.target.value))
          }}
        />

        {!advancedOpen ? (
          <button
            type="button"
            onClick={() => setShowAdvanced(true)}
            className="inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          >
            <ChevronDownIcon className="h-4 w-4" />
            {t('Mã & mô tả', 'Code & description')}
            {code && (
              <span className="rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 text-xs font-normal text-gray-500">
                {code}
              </span>
            )}
          </button>
        ) : (
          <>
            <div>
              <TextField
                label={t('Mã workspace', 'Workspace code')}
                hint={t('Duy nhất trong công ty', 'Unique within the company')}
                placeholder="product-team"
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
                  className="mt-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                  onClick={() => {
                    setCodeTouched(true)
                    setValue('code', codeSuggestion, { shouldValidate: true })
                    setCodeSuggestion(null)
                  }}
                >
                  {t('Dùng mã gợi ý:', 'Use suggested code:')} {codeSuggestion}
                </button>
              )}
            </div>

            <TextAreaField
              label={t('Mô tả (không bắt buộc)', 'Description (optional)')}
              error={errors.description?.message}
              {...register('description')}
            />
          </>
        )}
      </form>
    </Modal>
  )
}
