import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, ErrorState, ForbiddenState, LoadingBlock, PageHeader, SectionTitle } from '@/components/layout/PageParts'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { SelectField } from '@/components/ui/SelectField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { ChevronDownIcon, LockIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { permissionApi, roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, applyApiFieldErrors, isForbidden } from '@/lib/apiErrors'
import { ROLE_CODE_PATTERN, toRoleCode } from '@/lib/slug'
import { useI18n } from '@/i18n'
import { permissionGroupLabel, permissionLabel, scopeLabel } from '@/i18n/permissions'
import { PERMISSIONS, ROLE_KINDS, type PermissionDto, type RoleDto, type RoleKind, type RoleScope } from '@/types/rbac'
import { SearchInput } from '@/components/ui/listControls'

// Schema dựng theo `t` để thông báo lỗi đổi theo ngôn ngữ.
const makeRoleSchema = (t: (vi: string, en: string) => string) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(2, t('Tên role tối thiểu 2 ký tự', 'Role name must be at least 2 characters'))
      .max(100, t('Tối đa 100 ký tự', 'Up to 100 characters')),
    code: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || ROLE_CODE_PATTERN.test(v),
        t(
          'Viết HOA, bắt đầu bằng chữ, chỉ gồm A-Z 0-9 _ (2–50 ký tự)',
          'UPPERCASE, starts with a letter, only A-Z 0-9 _ (2–50 characters)',
        ),
      ),
    description: z.string().max(500, t('Tối đa 500 ký tự', 'Up to 500 characters')).optional(),
    scope: z.enum(['TENANT', 'WORKSPACE', 'PROJECT']),
    kind: z.enum(['BA', 'DESIGNER', 'QA', 'DEV', 'PM', 'OTHER']),
  })
type FormValues = z.infer<ReturnType<typeof makeRoleSchema>>

type PermissionFilter = 'ALL' | 'SELECTED' | 'SENSITIVE'

/** D05: nhãn "Loại vai trò" (quyết định menu dự án và "Việc của tôi"). */
const roleKindLabel = (kind: RoleKind, t: (vi: string, en: string) => string): string =>
  ({
    BA: 'BA',
    DESIGNER: 'Designer',
    QA: 'QA',
    DEV: 'Dev',
    PM: 'PM',
    OTHER: t('Khác', 'Other'),
  })[kind]

const scopeHelp = (scope: RoleScope, t: (vi: string, en: string) => string): string => {
  switch (scope) {
    case 'TENANT':
      return t(
        'Mỗi người trong công ty giữ đúng một role cấp công ty.',
        'Everyone in the company holds exactly one company role.',
      )
    case 'WORKSPACE':
      return t('Gán riêng trong từng workspace.', 'Assigned separately in each workspace.')
    case 'PROJECT':
      return t(
        'Gán trong từng dự án (PM, BA, Dev, QA…), quyết định ai được chuyển trạng thái issue.',
        'Assigned per project (PM, BA, Dev, QA…); decides who can move issues between statuses.',
      )
  }
}

// Figma D "Role Builder & Ma trận quyền" (bản gọn) · UC-11/13 · FR §III.3.2.1.
export function RoleEditorPage() {
  const params = useParams()
  const isNew = params.roleId === undefined
  const roleId = isNew ? null : Number(params.roleId)
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const roleSchema = useMemo(() => makeRoleSchema(t), [t])
  const { currentCompany, can, refreshMe } = useAuth()
  const companyId = currentCompany?.companyId
  const canView = companyId !== undefined && can(PERMISSIONS.roleView)
  const canManage = canView && can(PERMISSIONS.roleManage)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [original, setOriginal] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<PermissionFilter>('ALL')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [templateRoleId, setTemplateRoleId] = useState<number | ''>('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    (location.state as { created?: string } | null)?.created
      ? {
          tone: 'success',
          text: t(
            `Đã tạo role “${(location.state as { created: string }).created}”.`,
            `Role “${(location.state as { created: string }).created}” created.`,
          ),
        }
      : null,
  )

  const catalog = useAsync(() => (canView ? permissionApi.list() : Promise.resolve([])), [canView])
  const role = useAsync<RoleDto | null>(
    () => (canView && roleId !== null ? roleApi.get(companyId!, roleId) : Promise.resolve(null)),
    [canView, companyId, roleId],
  )
  const allRoles = useAsync(() => (canManage ? roleApi.list(companyId!) : Promise.resolve([])), [canManage, companyId])

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', code: '', description: '', scope: 'WORKSPACE', kind: 'OTHER' },
  })

  const scope = watch('scope')
  const name = watch('name')

  // Nạp role vào form khi mở trang sửa.
  useEffect(() => {
    if (!role.data) return
    reset({
      name: role.data.name,
      code: role.data.code ?? '',
      description: role.data.description ?? '',
      scope: role.data.scope,
      kind: role.data.kind ?? 'OTHER',
    })
    const keys = new Set(role.data.permissionKeys)
    setSelected(keys)
    setOriginal(new Set(keys))
  }, [role.data, reset])

  // Trang tạo: mã tự sinh từ tên cho tới khi người dùng tự sửa.
  useEffect(() => {
    if (isNew && !codeTouched) setValue('code', toRoleCode(name ?? ''))
  }, [isNew, name, codeTouched, setValue])

  // Đổi phạm vi (chỉ khi tạo mới) → bỏ các quyền không thuộc phạm vi mới.
  useEffect(() => {
    if (!isNew || !catalog.data) return
    const inScope = new Set(catalog.data.filter((p) => p.scope === scope).map((p) => p.key))
    setSelected((prev) => new Set([...prev].filter((k) => inScope.has(k))))
    setTemplateRoleId('')
  }, [isNew, scope, catalog.data])

  const permissionsOfScope = useMemo(() => (catalog.data ?? []).filter((p) => p.scope === scope), [catalog.data, scope])
  const groups = useMemo(() => {
    const map = new Map<string, PermissionDto[]>()
    for (const p of permissionsOfScope) map.set(p.group, [...(map.get(p.group) ?? []), p])
    return [...map.entries()]
  }, [permissionsOfScope])

  if (!canView) {
    return (
      <DashboardLayout>
        <ForbiddenState
          message={t('Cần quyền “Xem danh mục role” (role.view).', 'Requires the “View roles” permission (role.view).')}
        />
      </DashboardLayout>
    )
  }
  if (isNew && !canManage) {
    return (
      <DashboardLayout>
        <ForbiddenState
          message={t(
            'Cần quyền “Tạo / sửa / bật-tắt role” (role.manage).',
            'Requires the “Create / edit / enable-disable roles” permission (role.manage).',
          )}
        />
      </DashboardLayout>
    )
  }
  if (role.error || catalog.error) {
    return (
      <DashboardLayout>
        {isForbidden(role.error) ? (
          <ForbiddenState
            message={t(
              'Role không tồn tại hoặc không thuộc công ty của bạn.',
              'This role does not exist or does not belong to your company.',
            )}
          />
        ) : (
          <ErrorState
            message={apiErrorMessage(role.error ?? catalog.error)}
            onRetry={() => void (role.reload(), catalog.reload())}
          />
        )}
      </DashboardLayout>
    )
  }
  // Danh mục quyền rỗng = chưa tải xong (luôn có ít nhất 1 quyền mỗi phạm vi).
  if ((!isNew && !role.data) || !catalog.data?.length) {
    return (
      <DashboardLayout>
        <LoadingBlock />
      </DashboardLayout>
    )
  }

  const current = role.data ?? null
  const readOnly = !canManage || current?.isLocked === true
  const added = [...selected].filter((k) => !original.has(k))
  const removed = [...original].filter((k) => !selected.has(k))
  const hasChanges = isDirty || added.length > 0 || removed.length > 0
  const keyword = search.trim().toLowerCase()
  const matchesFilter = (p: PermissionDto) =>
    (filter === 'ALL' || (filter === 'SELECTED' && selected.has(p.key)) || (filter === 'SENSITIVE' && p.isSensitive)) &&
    (!keyword ||
      permissionLabel(p.key, p.name).toLowerCase().includes(keyword) ||
      p.name.toLowerCase().includes(keyword) ||
      p.key.includes(keyword))
  const templateOptions = (allRoles.data ?? []).filter((r) => r.scope === scope && r.roleId !== roleId)

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleGroup = (perms: PermissionDto[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of perms) {
        if (checked) next.add(p.key)
        else next.delete(p.key)
      }
      return next
    })

  const loadTemplate = () => {
    const template = templateOptions.find((r) => r.roleId === templateRoleId)
    if (!template) return
    setSelected(new Set(template.permissionKeys))
    setNotice({
      tone: 'success',
      text: t(
        `Đã nạp ${template.permissionKeys.length} quyền từ role “${template.name}” — bấm Lưu để áp dụng.`,
        `Loaded ${template.permissionKeys.length} permissions from “${template.name}” — click Save to apply.`,
      ),
    })
  }

  const revert = () => {
    if (current) {
      reset({
        name: current.name,
        code: current.code ?? '',
        description: current.description ?? '',
        scope: current.scope,
        kind: current.kind ?? 'OTHER',
      })
      setSelected(new Set(original))
    } else {
      navigate('/admin/roles')
    }
  }

  const onSubmit = async (values: FormValues) => {
    setNotice(null)
    try {
      if (isNew) {
        const created = await roleApi.create(companyId!, {
          name: values.name.trim(),
          code: values.code.trim() || undefined,
          description: values.description?.trim() || undefined,
          scope: values.scope,
          permissionKeys: [...selected],
          ...(values.scope === 'PROJECT' ? { kind: values.kind } : {}),
        })
        navigate(`/admin/roles/${created.roleId}`, { replace: true, state: { created: created.name } })
      } else {
        const updated = await roleApi.update(companyId!, roleId!, {
          name: values.name.trim(),
          description: values.description?.trim() ?? '',
          permissionKeys: [...selected],
          ...(values.scope === 'PROJECT' ? { kind: values.kind } : {}),
        })
        role.setData(() => updated)
        setNotice({
          tone: 'success',
          text: t(
            'Đã lưu cấu hình role. Thay đổi có hiệu lực ngay với mọi người đang giữ role.',
            'Role saved. Changes take effect immediately for everyone holding this role.',
          ),
        })
      }
      // Người đang thao tác có thể giữ chính role này → nạp lại quyền hiệu lực.
      await refreshMe()
    } catch (err) {
      if (!applyApiFieldErrors(err, setError, ['name', 'code', 'description', 'scope', 'kind'])) {
        setNotice({ tone: 'error', text: apiErrorMessage(err) })
      }
    }
  }

  const SCOPE_SHORT: Record<RoleScope, string> = {
    TENANT: t('Công ty', 'Company'),
    WORKSPACE: 'Workspace',
    PROJECT: t('Dự án', 'Project'),
  }
  const sensitiveCount = permissionsOfScope.filter((p) => p.isSensitive).length
  const visibleGroups = groups.map(([group, perms]) => [group, perms, perms.filter(matchesFilter)] as const)

  return (
    <DashboardLayout>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <PageHeader
          crumbs={[
            { label: t('Vai trò & quyền', 'Roles & permissions'), to: '/admin/roles' },
            { label: isNew ? t('Tạo mới', 'New') : (current?.name ?? '') },
          ]}
          title={isNew ? t('Tạo role mới', 'New role') : current?.name}
          meta={
            current && (
              <>
                <Badge>{scopeLabel(current.scope)}</Badge>
                {!current.isSystem && <Badge tone="blue">{t('Tự tạo', 'Custom')}</Badge>}
                {!current.isActive && <Badge tone="amber">{t('Đang tắt', 'Disabled')}</Badge>}
                {current.isLocked && (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                    <LockIcon className="h-4 w-4" /> {t('Đã khoá', 'Locked')}
                  </span>
                )}
              </>
            )
          }
          description={current?.description || undefined}
        />

        {(notice || current?.isLocked || (!readOnly && current && current.memberCount > 0)) && (
          <div className="mt-6 space-y-3">
            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
            {current?.isLocked && (
              <Alert tone="info">
                {current.code === 'TENANT_ADMIN'
                  ? t(
                      'Role hệ thống. Tenant Admin luôn có toàn quyền để công ty không bao giờ thiếu người quản trị.',
                      'System role. Tenant Admin always has full access so the company is never left without an admin.',
                    )
                  : t(
                      'Role hệ thống. Workspace Admin luôn đủ quyền quản trị để workspace không bị “mồ côi”.',
                      'System role. Workspace Admin always has full admin rights so the workspace is never “orphaned”.',
                    )}
              </Alert>
            )}
            {!readOnly && current && current.memberCount > 0 && (
              <Alert tone="warning">
                {t('Role đang được gán cho', 'This role is assigned to')} {current.memberCount}{' '}
                {current.scope === 'WORKSPACE'
                  ? t('lượt (trên các workspace)', 'times (across workspaces)')
                  : t('người dùng', 'users')}
                . {t('Thay đổi có hiệu lực ngay khi lưu.', 'Changes take effect as soon as you save.')}
              </Alert>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          {/* Thông tin role */}
          <Card className="p-5 xl:sticky xl:top-6">
            <SectionTitle>{t('Thông tin', 'Details')}</SectionTitle>
            <div className="mt-5 space-y-5">
              <TextField
                label={t('Tên role *', 'Role name *')}
                placeholder={t('VD: Business Analyst', 'e.g. Business Analyst')}
                disabled={readOnly}
                error={errors.name?.message}
                {...register('name')}
              />
              <TextField
                label={t('Mã định danh (role key)', 'Role key')}
                hint={
                  isNew
                    ? t('Bỏ trống để tự sinh', 'Leave blank to generate')
                    : t('Cố định sau khi tạo', 'Fixed after creation')
                }
                placeholder="BUSINESS_ANALYST"
                className="tabular-nums"
                disabled={!isNew}
                error={errors.code?.message}
                {...register('code', {
                  onChange: () => setCodeTouched(true),
                  setValueAs: (v: string) => v.toUpperCase(),
                })}
              />

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-gray-900">
                  {t('Phạm vi áp dụng', 'Scope')}
                  {!isNew && <span className="font-normal text-gray-500"> · {t('cố định', 'fixed')}</span>}
                </legend>
                <div className="grid grid-cols-3 gap-1 rounded-control border border-gray-200 bg-gray-50 p-1">
                  {(['TENANT', 'WORKSPACE', 'PROJECT'] as const).map((value) => (
                    <label
                      key={value}
                      className={clsx(
                        'flex min-h-10 items-center justify-center rounded-[6px] px-2 text-center text-sm font-medium transition-colors lg:min-h-8',
                        'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-100',
                        scope === value ? 'bg-white text-brand-700 shadow-xs ring-1 ring-gray-200' : 'text-gray-600',
                        isNew ? 'cursor-pointer hover:text-gray-950' : 'cursor-not-allowed',
                        !isNew && scope !== value && 'opacity-50',
                      )}
                    >
                      <input type="radio" value={value} disabled={!isNew} className="sr-only" {...register('scope')} />
                      {SCOPE_SHORT[value]}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">{scopeHelp(scope, t)}</p>
              </fieldset>

              {scope === 'PROJECT' && (
                <SelectField
                  id="role-kind"
                  label={t('Loại vai trò', 'Role type')}
                  hint={t('Quyết định menu dự án và “Việc của tôi”', 'Drives the project menu and “My work”')}
                  disabled={readOnly}
                  error={errors.kind?.message}
                  {...register('kind')}
                >
                  {ROLE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {roleKindLabel(k, t)}
                    </option>
                  ))}
                </SelectField>
              )}

              <TextAreaField
                label={t('Mô tả', 'Description')}
                placeholder={t('Vai trò này làm gì trong tổ chức?', 'What does this role do in the organization?')}
                disabled={readOnly}
                error={errors.description?.message}
                {...register('description')}
              />

              {!readOnly && templateOptions.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-900">
                    {t('Sao chép quyền từ role khác', 'Copy permissions from a role')}
                  </p>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <SelectField
                        compact
                        aria-label={t('Chọn role mẫu', 'Choose a template role')}
                        value={templateRoleId}
                        onChange={(e) => setTemplateRoleId(e.target.value ? Number(e.target.value) : '')}
                        className="lg:!h-9 lg:!text-sm"
                      >
                        <option value="">{t('Chọn role mẫu…', 'Choose a template role…')}</option>
                        {templateOptions.map((r) => (
                          <option key={r.roleId} value={r.roleId}>
                            {r.name} ({r.permissionKeys.length} {t('quyền', 'permissions')})
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      inline
                      className="lg:!h-9"
                      disabled={templateRoleId === ''}
                      onClick={loadTemplate}
                    >
                      {t('Nạp quyền', 'Load')}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {t('Ghi đè các quyền đang chọn.', 'Replaces the current selection.')}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Danh sách quyền theo nhóm */}
          <div className="space-y-4 xl:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-gray-950">
                {t('Quyền', 'Permissions')}
                <span className="ml-2 text-sm font-normal tabular-nums text-gray-500">
                  {selected.size}/{permissionsOfScope.length} {t('đã chọn', 'selected')}
                </span>
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  label={t('Tìm quyền', 'Search permissions')}
                  placeholder={t('Tìm quyền…', 'Search permissions…')}
                  className="sm:w-56"
                />
                <div
                  role="group"
                  aria-label={t('Lọc quyền', 'Filter permissions')}
                  className="inline-flex self-start rounded-control border border-gray-200 bg-gray-50 p-0.5 text-sm"
                >
                  {(
                    [
                      ['ALL', t('Tất cả', 'All'), permissionsOfScope.length],
                      ['SELECTED', t('Đã chọn', 'Selected'), selected.size],
                      ['SENSITIVE', t('Nhạy cảm', 'Sensitive'), sensitiveCount],
                    ] as const
                  ).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={clsx(
                        'flex min-h-10 items-center whitespace-nowrap rounded-[6px] px-2.5 font-medium transition-colors lg:min-h-8',
                        filter === value
                          ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-200'
                          : 'text-gray-600 hover:text-gray-950',
                      )}
                    >
                      {label}
                      <span className="ml-1 tabular-nums text-xs text-gray-500">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visibleGroups.map(([group, perms, visible]) => {
              if (visible.length === 0) return null
              const activeCount = perms.filter((p) => selected.has(p.key)).length
              const isCollapsed = collapsed.has(group)
              return (
                <Card key={group} className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev)
                          if (next.has(group)) next.delete(group)
                          else next.add(group)
                          return next
                        })
                      }
                      className="flex min-h-8 min-w-0 items-center gap-2 rounded-control text-left text-sm font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronDownIcon
                        className={clsx(
                          'h-4 w-4 shrink-0 text-gray-500 transition-transform',
                          isCollapsed && '-rotate-90',
                        )}
                      />
                      {/* Tên nhóm từ backend có số thứ tự "1. ": permissionGroupLabel bỏ số và dịch. */}
                      {permissionGroupLabel(group)}
                      <span className="text-xs font-normal tabular-nums text-gray-500">
                        {activeCount}/{perms.length}
                      </span>
                    </button>
                    {!readOnly && (
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-gray-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                          checked={activeCount === perms.length}
                          ref={(el) => {
                            if (el) el.indeterminate = activeCount > 0 && activeCount < perms.length
                          }}
                          onChange={(e) => toggleGroup(perms, e.target.checked)}
                        />
                        {t('Chọn tất cả', 'Select all')}
                      </label>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ul className="divide-y divide-gray-100 border-t border-gray-200">
                      {visible.map((p) => {
                        const checked = selected.has(p.key)
                        const changed = checked !== original.has(p.key) && !isNew
                        return (
                          <li key={p.key}>
                            <label
                              title={p.key}
                              className={clsx(
                                'flex gap-3 px-5 py-3 transition-colors',
                                readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={readOnly}
                                onChange={() => toggle(p.key)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-brand-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    {permissionLabel(p.key, p.name)}
                                  </span>
                                  {changed && (
                                    <span
                                      className={clsx(
                                        'text-xs font-medium',
                                        checked ? 'text-brand-700' : 'text-red-700',
                                      )}
                                    >
                                      {checked ? t('· vừa thêm', '· added') : t('· vừa bỏ', '· removed')}
                                    </span>
                                  )}
                                </span>
                                {p.description && (
                                  <span className="mt-0.5 block text-sm text-gray-500">{p.description}</span>
                                )}
                              </span>
                              {p.isSensitive && (
                                <span className="shrink-0">
                                  <Badge tone="amber">{t('Nhạy cảm', 'Sensitive')}</Badge>
                                </span>
                              )}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Card>
              )
            })}
            {visibleGroups.every(([, , visible]) => visible.length === 0) && (
              <Card className="px-5 py-12 text-center text-sm text-gray-500">
                {t('Không có quyền phù hợp bộ lọc.', 'No permissions match the filter.')}
              </Card>
            )}
          </div>
        </div>

        {/* Thanh lưu dính đáy: luôn thấy được trạng thái thay đổi và nút lưu khi cuộn danh sách quyền dài. */}
        {!readOnly && (
          <div className="sticky bottom-0 z-10 -mx-4 -mb-6 mt-8 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:-mb-8 lg:rounded-b-card lg:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm" aria-live="polite">
                {!isNew && hasChanges && (
                  <span className="font-medium text-amber-700">
                    {t('Có thay đổi chưa lưu', 'Unsaved changes')}
                    {(added.length > 0 || removed.length > 0) && (
                      <span className="tabular-nums">
                        {' '}
                        (+{added.length} / −{removed.length} {t('quyền', 'permissions')})
                      </span>
                    )}
                  </span>
                )}
              </p>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  inline
                  className="flex-1 sm:flex-none"
                  onClick={revert}
                  disabled={!isNew && !hasChanges}
                >
                  {isNew ? t('Huỷ', 'Cancel') : t('Hoàn tác', 'Revert')}
                </Button>
                <Button
                  type="submit"
                  inline
                  className="flex-1 sm:flex-none"
                  isLoading={isSubmitting}
                  disabled={!isNew && !hasChanges}
                >
                  {isNew ? t('Tạo role', 'Create role') : t('Lưu thay đổi', 'Save changes')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </DashboardLayout>
  )
}
