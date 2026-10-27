import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, ForbiddenState, SectionTitle } from '@/components/layout/PageParts'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { ArchiveIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { workspaceApi } from '@/api/workspaceApi'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/apiErrors'
import { PERMISSIONS } from '@/types/rbac'
import { workspaceFormSchema } from './CreateWorkspaceModal'
import { useWorkspaceContext } from './WorkspaceLayout'
import type { z } from 'zod'

type FormValues = z.infer<typeof workspaceFormSchema>

// Tab Cài đặt (FR §III.4.6, UC-23/24, wireframe "Cài đặt Workspace").
export function WorkspaceSettingsPage() {
  const { workspace, can, isArchived, setWorkspace } = useWorkspaceContext()
  const { refreshMe } = useAuth()
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [isTogglingArchive, setIsTogglingArchive] = useState(false)
  const canUpdate = can(PERMISSIONS.workspaceUpdate) && !isArchived
  const canArchive = can(PERMISSIONS.workspaceArchive)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(workspaceFormSchema),
    values: { name: workspace.name, code: workspace.code, description: workspace.description ?? '' },
  })

  if (!can(PERMISSIONS.workspaceUpdate) && !canArchive) return <ForbiddenState />

  const onSubmit = async (values: FormValues) => {
    setNotice(null)
    try {
      const updated = await workspaceApi.update(workspace.workspaceId, {
        name: values.name.trim(),
        code: values.code.trim(),
        description: values.description?.trim() ?? '',
      })
      setWorkspace(updated)
      reset({ name: updated.name, code: updated.code, description: updated.description ?? '' })
      setNotice({ tone: 'success', text: 'Đã lưu thay đổi.' })
      await refreshMe()
    } catch (err) {
      if (!applyApiFieldErrors(err, setError, ['name', 'code', 'description'])) {
        setNotice({ tone: 'error', text: apiErrorMessage(err) })
      }
    }
  }

  const toggleArchive = async () => {
    setNotice(null)
    setIsTogglingArchive(true)
    try {
      const updated = isArchived
        ? await workspaceApi.restore(workspace.workspaceId)
        : await workspaceApi.archive(workspace.workspaceId)
      setWorkspace(updated)
      setConfirmArchive(false)
      setNotice({ tone: 'success', text: isArchived ? 'Đã khôi phục workspace.' : 'Đã lưu trữ workspace.' })
      await refreshMe()
    } catch (err) {
      setConfirmArchive(false)
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
    } finally {
      setIsTogglingArchive(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <Card className="p-5">
        <SectionTitle description="Tên và mã hiển thị cho mọi thành viên. Mã dùng trong đường dẫn, duy nhất trong công ty.">
          Thông tin chung
        </SectionTitle>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
          <TextField label="Tên workspace" disabled={!canUpdate} error={errors.name?.message} {...register('name')} />
          <TextField
            label="Mã (code)"
            className="font-mono"
            disabled={!canUpdate}
            error={errors.code?.message}
            {...register('code')}
          />
          <TextAreaField label="Mô tả" disabled={!canUpdate} error={errors.description?.message} {...register('description')} />
          {canUpdate && (
            <div className="flex gap-2">
              <Button type="submit" inline isLoading={isSubmitting} disabled={!isDirty}>
                Lưu thay đổi
              </Button>
              {isDirty && (
                <Button type="button" variant="ghost" inline onClick={() => reset()}>
                  Huỷ
                </Button>
              )}
            </div>
          )}
          {!can(PERMISSIONS.workspaceUpdate) && (
            <p className="text-xs text-gray-400">Role của bạn không có quyền sửa thông tin workspace.</p>
          )}
        </form>
      </Card>

      {canArchive && (
        <div className="rounded-md border border-dashed border-red-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-red-700">Vùng nguy hiểm</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isArchived
              ? 'Workspace đang ở trạng thái lưu trữ (chỉ đọc). Khôi phục để thành viên làm việc trở lại.'
              : 'Lưu trữ workspace sẽ xoá mềm (soft-delete) — chuyển toàn bộ dữ liệu bên trong sang chỉ đọc. Có thể khôi phục sau.'}
          </p>
          <Button
            variant="secondary"
            inline
            className="mt-4"
            onClick={() => (isArchived ? void toggleArchive() : setConfirmArchive(true))}
            isLoading={isArchived && isTogglingArchive}
          >
            <ArchiveIcon className="h-4 w-4" />
            {isArchived ? 'Khôi phục workspace' : 'Lưu trữ workspace'}
          </Button>
        </div>
      )}

      <Modal
        open={confirmArchive}
        tone="danger"
        onClose={() => setConfirmArchive(false)}
        title="Lưu trữ workspace?"
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setConfirmArchive(false)}>
              Huỷ
            </Button>
            <Button
              inline
              isLoading={isTogglingArchive}
              onClick={() => void toggleArchive()}
              className="!bg-red-600 !shadow-none hover:!bg-red-700"
            >
              Lưu trữ
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{workspace.name}</span> cùng {workspace.projectCount} dự án và{' '}
          {workspace.memberCount} thành viên sẽ chuyển sang chế độ chỉ đọc. Không ai thêm / sửa dữ liệu được cho tới khi khôi
          phục.
        </p>
      </Modal>
    </div>
  )
}
