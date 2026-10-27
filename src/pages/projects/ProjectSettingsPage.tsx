import { useEffect, useState } from 'react'
import { Card, ForbiddenState, SectionTitle } from '@/components/layout/PageParts'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { ArchiveIcon } from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { PERMISSIONS } from '@/types/rbac'
import { SDLC_LABEL } from './ProjectTable'
import { useProjectContext } from './ProjectLayout'

// Tab Cài đặt dự án — Screen #17 "Project General Settings" (metadata + công tắc module AI), UC-35/36 (sửa, lưu trữ).
// Key và phương pháp SDLC không đổi được sau khi tạo (FR §III.5.2).
export function ProjectSettingsPage() {
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
  const nameError = name.trim().length < 2 ? 'Tên dự án tối thiểu 2 ký tự' : name.trim().length > 100 ? 'Tối đa 100 ký tự' : undefined

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
    <div className="max-w-3xl space-y-6">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <Card className="p-5">
        <SectionTitle description="Tên và mô tả hiển thị cho mọi thành viên.">Thông tin chung</SectionTitle>
        <div className="mt-4 space-y-4">
          <TextField label="Tên dự án" value={name} disabled={!canUpdate} error={dirty ? nameError : undefined} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Project Key" hint="Không đổi được" value={project.key} disabled className="font-mono" />
            <TextField label="Phương pháp SDLC" hint="Không đổi được" value={SDLC_LABEL[project.sdlcMethod]} disabled />
          </div>
          <TextAreaField
            label="Mô tả"
            value={description}
            disabled={!canUpdate}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
          />
          {canUpdate && (
            <Button
              inline
              isLoading={isSaving}
              disabled={!dirty || !!nameError}
              onClick={() =>
                void run(
                  () => projectApi.update(project.projectId, { name: name.trim(), description: description.trim() }),
                  'Đã lưu thay đổi.',
                  setIsSaving,
                )
              }
            >
              Lưu thay đổi
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle description="Bật để BA/QA dùng AI sinh tài liệu yêu cầu và testcase trong dự án (FR §III.5.2).">Module AI (BA/QA)</SectionTitle>
        <label className="mt-4 flex items-center gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            role="switch"
            checked={project.aiEnabled}
            disabled={!canToggleAi || isTogglingAi}
            onChange={(e) =>
              void run(
                () => projectApi.update(project.projectId, { aiEnabled: e.target.checked }),
                e.target.checked ? 'Đã bật module AI.' : 'Đã tắt module AI.',
                setIsTogglingAi,
              )
            }
            className="h-4 w-4 accent-brand-600"
          />
          {project.aiEnabled ? 'Đang bật' : 'Đang tắt'}
          {!can(PERMISSIONS.projectUpdate) && <span className="text-xs text-gray-400">— cần quyền project.update</span>}
        </label>
      </Card>

      {canArchive && (
        <div className="rounded-md border border-dashed border-red-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-red-700">Vùng nguy hiểm</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isArchived
              ? 'Dự án đang lưu trữ (chỉ đọc). Khôi phục để thành viên làm việc trở lại.'
              : 'Lưu trữ dự án sẽ đóng băng mọi tài liệu, issue và cấu hình sang chỉ đọc. Có thể khôi phục sau.'}
          </p>
          <Button
            variant="secondary"
            inline
            className="mt-4"
            isLoading={isArchived && isArchiving}
            onClick={() =>
              isArchived
                ? void run(() => projectApi.restore(project.projectId), 'Đã khôi phục dự án.', setIsArchiving)
                : setConfirmArchive(true)
            }
          >
            <ArchiveIcon className="h-4 w-4" /> {isArchived ? 'Khôi phục dự án' : 'Lưu trữ dự án'}
          </Button>
        </div>
      )}

      <Modal
        open={confirmArchive}
        tone="danger"
        onClose={() => setConfirmArchive(false)}
        title="Lưu trữ dự án?"
        footer={
          <>
            <Button variant="secondary" inline onClick={() => setConfirmArchive(false)}>
              Huỷ
            </Button>
            <Button
              inline
              isLoading={isArchiving}
              className="!bg-red-600 !shadow-none hover:!bg-red-700"
              onClick={() => {
                setConfirmArchive(false)
                void run(() => projectApi.archive(project.projectId), 'Đã lưu trữ dự án.', setIsArchiving)
              }}
            >
              Lưu trữ
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">
            {project.key} · {project.name}
          </span>{' '}
          sẽ chuyển sang chỉ đọc cho {project.memberCount} thành viên.
        </p>
      </Modal>
    </div>
  )
}
