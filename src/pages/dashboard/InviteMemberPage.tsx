import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ForbiddenState, PageHeader } from '@/components/layout/PageParts'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { MailIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { PERMISSIONS } from '@/types/rbac'

const inviteSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  roleId: z.string(),
  workspaceId: z.string(),
  workspaceRoleId: z.string(),
})
type FormValues = z.infer<typeof inviteSchema>

const toId = (value: string) => (value ? Number(value) : undefined)

// UC-09 · doc/Workspace-RBAC-API-Contract.md §7.1 — chọn role từ danh mục (thay cho ô nhập tự do) và tuỳ chọn
// thêm luôn vào 1 workspace mà mình có quyền quản lý thành viên.
export function InviteMemberPage() {
  const { currentCompany, workspaces, can } = useAuth()
  const companyId = currentCompany?.companyId
  const canInvite = companyId !== undefined && can(PERMISSIONS.userInvite)
  const [serverError, setServerError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Dọn timer "Đã copy" khi rời trang, tránh setState trên component đã unmount.
  useEffect(() => () => clearTimeout(copiedTimerRef.current), [])

  const roles = useAsync(
    () => (canInvite ? roleApi.list(companyId!, { includeInactive: false }) : Promise.resolve([])),
    [canInvite, companyId],
  )
  const tenantRoles = (roles.data ?? []).filter((r) => r.scope === 'TENANT')
  const workspaceRoles = (roles.data ?? []).filter((r) => r.scope === 'WORKSPACE')
  const manageableWorkspaces = workspaces.filter(
    (w) =>
      w.companyId === companyId &&
      w.status !== 'ARCHIVED' &&
      hasPermission(w.permissions ?? [], PERMISSIONS.workspaceMemberManage),
  )

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', roleId: '', workspaceId: '', workspaceRoleId: '' },
  })
  const selectedWorkspaceId = watch('workspaceId')

  const onSubmit = async (values: FormValues) => {
    if (!companyId) return
    setServerError(null)
    setInviteUrl(null)
    try {
      const workspaceId = toId(values.workspaceId)
      const result = await companyApi.invite(companyId, {
        email: values.email,
        roleId: toId(values.roleId),
        workspaceId,
        workspaceRoleId: workspaceId ? toId(values.workspaceRoleId) : undefined,
      })
      setInviteUrl(result.inviteUrl)
      reset()
    } catch (err) {
      if (!applyApiFieldErrors(err, setError, ['email'])) setServerError(apiErrorMessage(err))
    }
  }

  const handleCopy = async () => {
    if (!inviteUrl) return
    setCopyError(false)
    try {
      // Clipboard API có thể không tồn tại (HTTP không phải localhost) hoặc bị từ chối quyền → reject.
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader eyebrow="// Quản trị công ty" title="Mời thành viên" description="Gửi lời mời tham gia công ty qua email." />

      {!companyId ? (
        <div className="mt-6 max-w-md">
          <Alert tone="warning">
            Workspace cá nhân không thuộc công ty nào nên không có tính năng mời thành viên. Tạo/tham gia 1 công ty
            trước.
          </Alert>
        </div>
      ) : !canInvite ? (
        <div className="mt-6">
          <ForbiddenState message="Cần quyền “Mời người dùng vào công ty” (user.invite)." />
        </div>
      ) : (
        <div className="mt-6 max-w-md">
          {serverError && (
            <div className="mb-4">
              <Alert tone="error">{serverError}</Alert>
            </div>
          )}

          {inviteUrl && (
            <div className="mb-4 rounded-md border border-brand-200 bg-brand-50 p-3">
              <p className="text-xs font-semibold text-brand-700">Đã tạo lời mời — copy link gửi cho người nhận:</p>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="w-full truncate rounded border border-brand-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                />
                <Button variant="secondary" className="!w-auto shrink-0 px-3 text-xs" onClick={handleCopy}>
                  {copied ? 'Đã copy' : 'Copy'}
                </Button>
              </div>
              {copyError && (
                <p className="mt-2 text-[11px] text-red-600">Trình duyệt không cho phép copy tự động — hãy chọn và copy link thủ công.</p>
              )}
              <p className="mt-2 text-[11px] text-brand-600">
                Bản demo: chưa gửi email thật, dán link này vào tab khác để test màn chấp nhận lời mời.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <TextField
              label="Email người được mời"
              icon={<MailIcon className="h-4 w-4" />}
              type="email"
              placeholder="teammate@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <SelectField label="Role trong công ty" hint="Bỏ trống = Member" {...register('roleId')}>
              <option value="">Mặc định (Member)</option>
              {tenantRoles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.name}
                </option>
              ))}
            </SelectField>

            {manageableWorkspaces.length > 0 && (
              <div className="space-y-4 rounded-md border border-gray-200 bg-white p-4">
                <SelectField label="Thêm vào workspace" hint="Không bắt buộc" {...register('workspaceId')}>
                  <option value="">Không thêm</option>
                  {manageableWorkspaces.map((w) => (
                    <option key={w.workspaceId} value={w.workspaceId}>
                      {w.workspaceName}
                    </option>
                  ))}
                </SelectField>
                {selectedWorkspaceId && (
                  <SelectField label="Role trong workspace" hint="Bỏ trống = Workspace Member" {...register('workspaceRoleId')}>
                    <option value="">Mặc định (Workspace Member)</option>
                    {workspaceRoles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>
                        {r.name}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
            )}

            <Button type="submit" isLoading={isSubmitting} className="!w-auto px-6">
              Gửi lời mời →
            </Button>
          </form>
        </div>
      )}
    </DashboardLayout>
  )
}
