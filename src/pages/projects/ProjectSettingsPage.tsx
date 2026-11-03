import { useEffect, useState } from 'react'
import { Card, ForbiddenState } from '@/components/layout/PageParts'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { ArchiveIcon } from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { PERMISSIONS } from '@/types/rbac'
import { useI18n } from '@/i18n'
import { sdlcLabel } from './ProjectTable'
import { useProjectContext } from './ProjectLayout'
import { TabBody, TabSection } from '@/components/layout/tabParts'
import { DangerRow, dangerOutline } from '@/components/ui/listControls'

// Tab Cài đặt dự án — Screen #17 "Project General Settings" (metadata + công tắc module AI), UC-35/36 (sửa, lưu trữ).
// Key và phương pháp SDLC không đổi được sau khi tạo (FR §III.5.2).
export function ProjectSettingsPage() {
  const { t } = useI18n()
  const { project, can, isArchived, setProject } = useProjectContext()
  const canUpdate = can(PERMISSIONS.projectUpdate) && !isArchived
  const canToggleAi = can(PERMISSIONS.projectUpdate) && !isArchived
  const canArchive = can(PERMISSIONS.projectArchive)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTogglingAi, setIsTogglingAi] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  useEffect(() => {
    setName(project.name)
    setDescription(project.description ?? '')
  }, [project.name, project.description])

  if (!can(PERMISSIONS.projectUpdate) && !canArchive) return <ForbiddenState />

  const dirty = name.trim() !== project.name || (description.trim() || null) !== project.description
  const nameError =
    name.trim().length < 2
      ? t('Tên dự án tối thiểu 2 ký tự', 'Project name must be at least 2 characters')
      : name.trim().length > 100
        ? t('Tối đa 100 ký tự', 'Maximum 100 characters')
        : undefined

  const run = async (action: () => Promise<typeof project>, success: string, setBusy: (v: boolean) => void) => {
    setNotice(null)
    setBusy(true)
    try {
      setProject(await action())
      setNotice({ tone: 'success', text: success })
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <TabBody>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <TabSection className="xl:col-span-2" title={t('Thông tin chung', 'General')}>
          <Card className="p-5">
            <div className="space-y-5">
              <TextField
                label={t('Tên dự án', 'Project name')}
                value={name}
                disabled={!canUpdate}
                error={dirty ? nameError : undefined}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  label={t('Mã dự án', 'Project key')}
                  hint={t('Không đổi được', "Can't be changed")}
                  value={project.key}
                  disabled
                  className="tabular-nums"
                />
                <TextField
                  label={t('Phương pháp', 'Methodology')}
                  hint={t('Không đổi được', "Can't be changed")}
                  value={sdlcLabel(project.sdlcMethod)}
                  disabled
                />
              </div>
              <TextAreaField
                label={t('Mô tả', 'Description')}
                value={description}
                disabled={!canUpdate}
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
              />
              {canUpdate && (
                <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                  {dirty && (
                    <Button
                      type="button"
                      variant="secondary"
                      inline
                      onClick={() => {
                        setName(project.name)
                        setDescription(project.description ?? '')
                      }}
                    >
                      {t('Huỷ', 'Cancel')}
                    </Button>
                  )}
                  <Button
                    inline
                    isLoading={isSaving}
                    disabled={!dirty || !!nameError}
                    onClick={() =>
                      void run(
                        () =>
                          projectApi.update(project.projectId, { name: name.trim(), description: description.trim() }),
                        t('Đã lưu thay đổi.', 'Changes saved.'),
                        setIsSaving,
                      )
                    }
                  >
                    {t('Lưu thay đổi', 'Save changes')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </TabSection>

        <div className="space-y-6">
          <TabSection title={t('Module AI (BA/QA)', 'AI module (BA/QA)')}>
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-gray-600">
                  {t(
                    'BA và QA dùng AI viết tài liệu yêu cầu và testcase.',
                    'BAs and QAs use AI to write requirement documents and test cases.',
                  )}
                </p>
                <Switch
                  checked={project.aiEnabled}
                  disabled={!canToggleAi || isTogglingAi}
                  label={project.aiEnabled ? t('Đang bật', 'On') : t('Đang tắt', 'Off')}
                  className="shrink-0 pt-0.5"
                  onChange={(checked) =>
                    void run(
                      () => projectApi.update(project.projectId, { aiEnabled: checked }),
                      checked
                        ? t('Đã bật module AI.', 'AI module turned on.')
                        : t('Đã tắt module AI.', 'AI module turned off.'),
                      setIsTogglingAi,
                    )
                  }
                />
              </div>
              {!can(PERMISSIONS.projectUpdate) && (
                <p className="mt-2 text-xs text-gray-500">
                  {t('Cần quyền project.update để đổi.', 'Requires project.update to change.')}
                </p>
              )}
            </Card>
          </TabSection>

          {canArchive && (
            <TabSection title={<span className="text-red-700">{t('Vùng nguy hiểm', 'Danger zone')}</span>}>
              {/* Cột hẹp (xl): xếp mô tả trên, nút dưới. */}
              <div className="rounded-card border border-red-200 bg-white shadow-xs xl:[&>div]:flex-col xl:[&>div]:items-start">
                <DangerRow
                  title={isArchived ? t('Khôi phục dự án', 'Restore project') : t('Lưu trữ dự án', 'Archive project')}
                  description={
                    isArchived
                      ? t(
                          'Đang chỉ đọc. Khôi phục để thành viên làm việc trở lại.',
                          'Read-only now. Restore it so members can work again.',
                        )
                      : t(
                          'Mọi tài liệu, issue và cấu hình chuyển sang chỉ đọc. Khôi phục được sau.',
                          'All documents, issues and settings become read-only. You can restore it later.',
                        )
                  }
                  action={
                    <Button
                      variant="secondary"
                      inline
                      className={isArchived ? undefined : dangerOutline}
                      isLoading={isArchived && isArchiving}
                      onClick={() =>
                        isArchived
                          ? void run(
                              () => projectApi.restore(project.projectId),
                              t('Đã khôi phục dự án.', 'Project restored.'),
                              setIsArchiving,
                            )
                          : setConfirmArchive(true)
                      }
                    >
                      <ArchiveIcon className="h-4 w-4" />{' '}
                      {isArchived ? t('Khôi phục dự án', 'Restore project') : t('Lưu trữ dự án', 'Archive project')}
                    </Button>
                  }
                />
              </div>
            </TabSection>
          )}
        </div>
      </div>

      <Modal
        open={confirmArchive}
        tone="danger"
        onClose={() => setConfirmArchive(false)}
        title={t('Lưu trữ dự án?', 'Archive project?')}
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setConfirmArchive(false)}>
              {t('Huỷ', 'Cancel')}
            </Button>
            <Button
              inline
              isLoading={isArchiving}
              className="!bg-red-600 !shadow-none hover:!bg-red-700"
              onClick={() => {
                setConfirmArchive(false)
                void run(
                  () => projectApi.archive(project.projectId),
                  t('Đã lưu trữ dự án.', 'Project archived.'),
                  setIsArchiving,
                )
              }}
            >
              {t('Lưu trữ', 'Archive')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">
            {project.key} · {project.name}
          </span>{' '}
          {t(
            `sẽ chuyển sang chỉ đọc cho ${project.memberCount} thành viên.`,
            `will become read-only for ${project.memberCount} ${project.memberCount === 1 ? 'member' : 'members'}.`,
          )}
        </p>
      </Modal>
    </TabBody>
  )
}
