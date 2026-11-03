import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, ForbiddenState, PageHeader } from '@/components/layout/PageParts'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { MailIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { PERMISSIONS } from '@/types/rbac'
import { useI18n } from '@/i18n'
import { InviteSuccess, makeInviteEmailSchema } from './inviteParts'

// Schema dựng theo `t` để thông báo lỗi đổi theo ngôn ngữ.
const makeInviteSchema = (t: (vi: string, en: string) => string) =>
  z.object({
    email: makeInviteEmailSchema(t),
    roleId: z.string(),
    workspaceId: z.string(),
    workspaceRoleId: z.string(),
  })
type FormValues = z.infer<ReturnType<typeof makeInviteSchema>>

const toId = (value: string) => (value ? Number(value) : undefined)

// UC-09 · doc/Workspace-RBAC-API-Contract.md §7.1 — chọn role từ danh mục (thay cho ô nhập tự do) và tuỳ chọn
// thêm luôn vào 1 workspace mà mình có quyền quản lý thành viên.
export function InviteMemberPage() {
  const { currentCompany, workspaces, can } = useAuth()
  const { t } = useI18n()
  const inviteSchema = useMemo(() => makeInviteSchema(t), [t])
  const companyId = currentCompany?.companyId
  const canInvite = companyId !== undefined && can(PERMISSIONS.userInvite)
  const [serverError, setServerError] = useState<string | null>(null)
  const [invited, setInvited] = useState<{ email: string; inviteUrl: string } | null>(null)

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
  const selectedRoleId = watch('roleId')
  // Role mặc định (để trống) là Member của công ty → lấy mô tả từ role Member nếu danh mục có.
  const selectedRole = selectedRoleId
    ? tenantRoles.find((r) => String(r.roleId) === String(selectedRoleId))
    : tenantRoles.find((r) => r.name.trim().toLowerCase() === 'member' || /(^|_)member$/i.test(r.code ?? ''))

  const onSubmit = async (values: FormValues) => {
    if (!companyId) return
    setServerError(null)
    setInvited(null)
    try {
      const workspaceId = toId(values.workspaceId)
      const result = await companyApi.invite(companyId, {
        email: values.email,
        roleId: toId(values.roleId),
        workspaceId,
        workspaceRoleId: workspaceId ? toId(values.workspaceRoleId) : undefined,
      })
      setInvited({ email: values.email, inviteUrl: result.inviteUrl })
      reset()
    } catch (err) {
      if (!applyApiFieldErrors(err, setError, ['email'])) setServerError(apiErrorMessage(err))
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        crumbs={[
          { label: t('Người dùng', 'Users'), to: '/admin/users' },
          { label: t('Mời thành viên', 'Invite members') },
        ]}
        title={t('Mời thành viên', 'Invite members')}
        description={t(
          'Mời qua email, kèm sẵn role và workspace.',
          'Invite by email with their role and workspace ready.',
        )}
      />

      {!companyId ? (
        <div className="mt-6 max-w-md">
          <Alert tone="warning">
            {t(
              'Workspace cá nhân không thuộc công ty nào nên không có tính năng mời thành viên. Tạo/tham gia 1 công ty trước.',
              'Personal workspaces don’t belong to a company, so you can’t invite members. Create or join a company first.',
            )}
          </Alert>
        </div>
      ) : !canInvite ? (
        <div className="mt-6">
          <ForbiddenState
            message={t(
              'Bạn cần quyền mời người dùng vào công ty. Liên hệ Tenant Admin.',
              'You need permission to invite users to the company. Contact your Tenant Admin.',
            )}
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-8">
          <div className="flex flex-col">
            {serverError && (
              <div className="mb-4">
                <Alert tone="error">{serverError}</Alert>
              </div>
            )}

            {invited && (
              <div className="mb-4">
                <InviteSuccess email={invited.email} inviteUrl={invited.inviteUrl} />
                <p className="mt-1.5 text-xs text-gray-500">
                  {t(
                    'Bản demo: chưa gửi email thật, dán link này vào tab khác để test màn chấp nhận lời mời.',
                    'Demo: no real email is sent. Paste this link into another tab to test the accept screen.',
                  )}
                </p>
              </div>
            )}

            <Card className="flex-1 p-5">
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex h-full flex-col gap-5">
                <TextField
                  label={t('Email người được mời', 'Invitee email')}
                  icon={<MailIcon className="h-4 w-4" />}
                  type="email"
                  placeholder="teammate@company.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <div>
                  <SelectField label={t('Role trong công ty', 'Company role')} {...register('roleId')}>
                    <option value="">{t('Member (mặc định)', 'Member (default)')}</option>
                    {tenantRoles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>
                        {r.name}
                      </option>
                    ))}
                  </SelectField>
                  {selectedRole?.description && (
                    <p className="mt-1.5 text-xs text-gray-500">{selectedRole.description}</p>
                  )}
                </div>

                {manageableWorkspaces.length > 0 && (
                  <div className="space-y-5">
                    <SelectField
                      label={t('Thêm vào workspace', 'Add to workspace')}
                      hint={t('Không bắt buộc', 'Optional')}
                      {...register('workspaceId')}
                    >
                      <option value="">{t('Không thêm', 'Don’t add')}</option>
                      {manageableWorkspaces.map((w) => (
                        <option key={w.workspaceId} value={w.workspaceId}>
                          {w.workspaceName}
                        </option>
                      ))}
                    </SelectField>
                    {selectedWorkspaceId && (
                      <SelectField label={t('Role trong workspace', 'Workspace role')} {...register('workspaceRoleId')}>
                        <option value="">{t('Workspace Member (mặc định)', 'Workspace Member (default)')}</option>
                        {workspaceRoles.map((r) => (
                          <option key={r.roleId} value={r.roleId}>
                            {r.name}
                          </option>
                        ))}
                      </SelectField>
                    )}
                  </div>
                )}

                <div className="mt-auto flex justify-end border-t border-gray-200 pt-4">
                  <Button type="submit" isLoading={isSubmitting} inline>
                    {t('Gửi lời mời', 'Send invitation')}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Xem trước đúng những gì người nhận thấy, cập nhật theo lựa chọn bên trái. */}
          <aside
            aria-label={t('Xem trước lời mời', 'Invitation preview')}
            className="rounded-card border border-gray-200 bg-gray-50 p-5"
          >
            <p className="text-sm font-medium text-gray-600">{t('Người nhận sẽ thấy', 'The recipient will see')}</p>
            <div className="mt-3 rounded-card border border-gray-200 bg-white p-5 shadow-xs">
              <p className="text-xs text-gray-600">
                {t('Tới:', 'To:')} {watch('email') || t('email người được mời', 'invitee email')}
              </p>
              <p className="mt-3 text-base font-semibold text-gray-950">
                {currentCompany?.companyName} {t('mời bạn vào SSAM', 'invited you to SSAM')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-800">
                {t('Bạn được mời tham gia công ty với role', 'You’re invited to join the company with the role')}{' '}
                <b className="font-semibold">{selectedRoleId ? (selectedRole?.name ?? 'Member') : 'Member'}</b>
                {selectedWorkspaceId && (
                  <>
                    {' '}
                    {t('và vào workspace', 'and the workspace')}{' '}
                    <b className="font-semibold">
                      {
                        manageableWorkspaces.find((w) => String(w.workspaceId) === String(selectedWorkspaceId))
                          ?.workspaceName
                      }
                    </b>
                  </>
                )}
                . {t('Bấm nút dưới để tạo tài khoản hoặc đăng nhập.', 'Click the button below to sign up or sign in.')}
              </p>
              <span
                aria-hidden="true"
                className={buttonClasses({ inline: true, variant: 'primary' }) + ' mt-4 pointer-events-none'}
              >
                {t('Chấp nhận lời mời', 'Accept invitation')}
              </span>
            </div>
          </aside>
        </div>
      )}
    </DashboardLayout>
  )
}
