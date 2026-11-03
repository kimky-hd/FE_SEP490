import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, ForbiddenState } from '@/components/layout/PageParts'
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
import { makeWorkspaceFormSchema } from './CreateWorkspaceModal'
import { useWorkspaceContext } from './WorkspaceLayout'
import { useI18n } from '@/i18n'
import { DangerRow, DangerZone, dangerOutline } from '@/components/ui/listControls'
import type { z } from 'zod'
import { TabSection } from '@/components/layout/tabParts'

type FormValues = z.infer<ReturnType<typeof makeWorkspaceFormSchema>>

// Tab Cài đặt (FR §III.4.6, UC-23/24, wireframe "Cài đặt Workspace").
export function WorkspaceSettingsPage() {
  const { workspace, can, isArchived, setWorkspace } = useWorkspaceContext()
  const { refreshMe } = useAuth()
  const { t } = useI18n()
  const workspaceFormSchema = useMemo(() => makeWorkspaceFormSchema(t), [t])
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
      setNotice({ tone: 'success', text: t('Đã lưu thay đổi.', 'Changes saved.') })
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
      setNotice({
        tone: 'success',
        text: isArchived
          ? t('Đã khôi phục workspace.', 'Workspace restored.')
          : t('Đã lưu trữ workspace.', 'Workspace archived.'),
      })
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

      <TabSection title={t('Thông tin chung', 'General')}>
        <Card className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <TextField
              label={t('Tên workspace', 'Workspace name')}
              disabled={!canUpdate}
              error={errors.name?.message}
              {...register('name')}
            />
            <TextField
              label={t('Mã workspace', 'Workspace code')}
              hint={t('Dùng trong đường dẫn', 'Used in URLs')}
              className="tabular-nums"
              disabled={!canUpdate}
              error={errors.code?.message}
              {...register('code')}
            />
            <TextAreaField
              label={t('Mô tả', 'Description')}
              disabled={!canUpdate}
              error={errors.description?.message}
              {...register('description')}
            />
            {canUpdate && (
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                {isDirty && (
                  <Button type="button" variant="secondary" inline onClick={() => reset()}>
                    {t('Huỷ', 'Cancel')}
                  </Button>
                )}
                <Button type="submit" inline isLoading={isSubmitting} disabled={!isDirty}>
                  {t('Lưu thay đổi', 'Save changes')}
                </Button>
              </div>
            )}
            {!can(PERMISSIONS.workspaceUpdate) && (
              <p className="text-xs text-gray-500">
                {t('Role của bạn không có quyền sửa thông tin workspace.', 'Your role can’t edit workspace details.')}
              </p>
            )}
          </form>
        </Card>
      </TabSection>

      {canArchive && (
        <DangerZone title={t('Vùng nguy hiểm', 'Danger zone')}>
          <DangerRow
            title={
              isArchived ? t('Khôi phục workspace', 'Restore workspace') : t('Lưu trữ workspace', 'Archive workspace')
            }
            description={
              isArchived
                ? t(
                    'Đang chỉ đọc. Khôi phục để thành viên làm việc trở lại.',
                    'Read-only now. Restore it so members can work again.',
                  )
                : t(
                    'Mọi dữ liệu chuyển sang chỉ đọc. Không có gì bị xoá, khôi phục được bất kỳ lúc nào.',
                    'Everything becomes read-only. Nothing is deleted; restore anytime.',
                  )
            }
            action={
              <Button
                variant="secondary"
                inline
                className={isArchived ? undefined : dangerOutline}
                onClick={() => (isArchived ? void toggleArchive() : setConfirmArchive(true))}
                isLoading={isArchived && isTogglingArchive}
              >
                <ArchiveIcon className="h-4 w-4" />
                {isArchived
                  ? t('Khôi phục workspace', 'Restore workspace')
                  : t('Lưu trữ workspace', 'Archive workspace')}
              </Button>
            }
          />
        </DangerZone>
      )}

      <Modal
        open={confirmArchive}
        tone="danger"
        onClose={() => setConfirmArchive(false)}
        title={t('Lưu trữ workspace?', 'Archive workspace?')}
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setConfirmArchive(false)}>
              {t('Huỷ', 'Cancel')}
            </Button>
            <Button
              inline
              isLoading={isTogglingArchive}
              onClick={() => void toggleArchive()}
              className="!bg-red-600 !shadow-none hover:!bg-red-700"
            >
              {t('Lưu trữ', 'Archive')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{workspace.name}</span>{' '}
          {t(
            `cùng ${workspace.projectCount} dự án và ${workspace.memberCount} thành viên sẽ chuyển sang chế độ chỉ đọc. Không ai thêm / sửa dữ liệu được cho tới khi khôi phục.`,
            `with its ${workspace.projectCount} projects and ${workspace.memberCount} members will become read-only. No one can add or edit data until it is restored.`,
          )}
        </p>
      </Modal>
    </div>
  )
}
