import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { ArrowLeftIcon, ChevronDownIcon, LockIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { permissionApi, roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, applyApiFieldErrors, isForbidden } from '@/lib/apiErrors'
import { ROLE_CODE_PATTERN, toRoleCode } from '@/lib/slug'
import { SCOPE_LABEL } from '@/lib/format'
import { PERMISSIONS, type PermissionDto, type RoleDto, type RoleScope } from '@/types/rbac'

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Tên role tối thiểu 2 ký tự').max(100, 'Tối đa 100 ký tự'),
  code: z
    .string()
    .trim()
    .refine((v) => v === '' || ROLE_CODE_PATTERN.test(v), 'Viết HOA, bắt đầu bằng chữ, chỉ gồm A-Z 0-9 _ (2–50 ký tự)'),
  description: z.string().max(500, 'Tối đa 500 ký tự').optional(),
  scope: z.enum(['TENANT', 'WORKSPACE', 'PROJECT']),
})
type FormValues = z.infer<typeof roleSchema>

type PermissionFilter = 'ALL' | 'SELECTED' | 'SENSITIVE'

const SCOPE_HELP: Record<RoleScope, string> = {
  TENANT: 'Gán cho người dùng ở cấp công ty (mỗi người 1 role). Quyết định quản trị user, role, tạo workspace…',
  WORKSPACE: 'Gán riêng trong từng workspace — cùng 1 người có thể mang role khác ở workspace khác.',
  PROJECT: 'Gán cho thành viên từng dự án (PM, BA, Dev, QA…). Dùng để chọn ai được kéo issue qua từng luồng chuyển trạng thái.',
}

// Figma D "Role Builder & Ma trận quyền" (bản gọn) · UC-11/13 · FR §III.3.2.1.
export function RoleEditorPage() {
  const params = useParams()
  const isNew = params.roleId === undefined
  const roleId = isNew ? null : Number(params.roleId)
  const navigate = useNavigate()
  const location = useLocation()
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
      ? { tone: 'success', text: `Đã tạo role “${(location.state as { created: string }).created}”.` }
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
    defaultValues: { name: '', code: '', description: '', scope: 'WORKSPACE' },
  })

  const scope = watch('scope')
  const name = watch('name')

  // Nạp role vào form khi mở trang sửa.
  useEffect(() => {
    if (!role.data) return
    reset({ name: role.data.name, code: role.data.code ?? '', description: role.data.description ?? '', scope: role.data.scope })
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
        <ForbiddenState message="Cần quyền “Xem danh mục role” (role.view)." />
      </DashboardLayout>
    )
  }
  if (isNew && !canManage) {
    return (
      <DashboardLayout>
        <ForbiddenState message="Cần quyền “Tạo / sửa / bật-tắt role” (role.manage)." />
      </DashboardLayout>
    )
  }
  if (role.error || catalog.error) {
    return (
      <DashboardLayout>
        {isForbidden(role.error) ? (
          <ForbiddenState message="Role không tồn tại hoặc không thuộc công ty của bạn." />
        ) : (
          <ErrorState message={apiErrorMessage(role.error ?? catalog.error)} onRetry={() => void (role.reload(), catalog.reload())} />
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
    (!keyword || p.name.toLowerCase().includes(keyword) || p.key.includes(keyword))
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
    setNotice({ tone: 'success', text: `Đã nạp ${template.permissionKeys.length} quyền từ role “${template.name}” — bấm Lưu để áp dụng.` })
  }

  const revert = () => {
    if (current) {
      reset({ name: current.name, code: current.code ?? '', description: current.description ?? '', scope: current.scope })
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
        })
        navigate(`/admin/roles/${created.roleId}`, { replace: true, state: { created: created.name } })
      } else {
        const updated = await roleApi.update(companyId!, roleId!, {
          name: values.name.trim(),
          description: values.description?.trim() ?? '',
          permissionKeys: [...selected],
        })
        role.setData(() => updated)
        setNotice({ tone: 'success', text: 'Đã lưu cấu hình role. Thay đổi có hiệu lực ngay với mọi người đang giữ role.' })
      }
      // Người đang thao tác có thể giữ chính role này → nạp lại quyền hiệu lực.
      await refreshMe()
    } catch (err) {
      if (!applyApiFieldErrors(err, setError, ['name', 'code', 'description', 'scope'])) {
        setNotice({ tone: 'error', text: apiErrorMessage(err) })
      }
    }
  }

  const sensitiveCount = permissionsOfScope.filter((p) => p.isSensitive).length

  return (
    <DashboardLayout>
      <Link to="/admin/roles" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
        <ArrowLeftIcon className="h-4 w-4" />
        Danh mục role
      </Link>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mt-3">
          <PageHeader
            eyebrow="// Quản trị công ty · Role"
            title={isNew ? 'Tạo role mới' : current?.name}
            meta={
              current && (
                <>
                  <Badge tone={current.isSystem ? 'neutral' : 'blue'}>{current.isSystem ? 'Hệ thống' : 'Tuỳ chỉnh'}</Badge>
                  <Badge tone={current.scope === 'TENANT' ? 'brand' : 'neutral'}>{SCOPE_LABEL[current.scope]}</Badge>
                  {!current.isActive && <Badge>Đang tắt</Badge>}
                </>
              )
            }
            description={
              hasChanges && !readOnly ? (
                <span className="font-medium text-amber-700">
                  Có thay đổi chưa lưu
                  {(added.length > 0 || removed.length > 0) && ` (+${added.length} / −${removed.length} quyền)`}
                </span>
              ) : undefined
            }
            actions={
              !readOnly && (
                <>
                  <Button type="button" variant="secondary" inline onClick={revert} disabled={!isNew && !hasChanges}>
                    {isNew ? 'Huỷ' : 'Hoàn tác'}
                  </Button>
                  <Button type="submit" inline isLoading={isSubmitting} disabled={!isNew && !hasChanges}>
                    {isNew ? 'Tạo role' : 'Lưu cấu hình role'}
                  </Button>
                </>
              )
            }
          />
        </div>

        <div className="mt-4 space-y-3">
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          {current?.isLocked && (
            <Alert tone="info">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <LockIcon className="h-4 w-4" /> Role hệ thống được khoá.
              </span>{' '}
              {current.code === 'TENANT_ADMIN'
                ? 'Tenant Admin luôn có toàn quyền trong công ty để tránh tình trạng không ai quản trị được.'
                : 'Workspace Admin luôn đủ quyền quản trị workspace để workspace không bị “mồ côi”.'}
            </Alert>
          )}
          {!readOnly && current && current.memberCount > 0 && (
            <Alert tone="warning">
              Role đang được gán cho {current.memberCount} {current.scope === 'WORKSPACE' ? 'lượt (trên các workspace)' : 'người dùng'}.
              Mọi thay đổi sau khi lưu có hiệu lực ngay với họ.
            </Alert>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="h-fit p-5 xl:col-span-1">
            <SectionTitle>Thông tin role</SectionTitle>
            <div className="mt-4 space-y-4">
              <TextField label="Tên role *" placeholder="Vd: Business Analyst" disabled={readOnly} error={errors.name?.message} {...register('name')} />
              <TextField
                label="Mã định danh (role key)"
                hint={isNew ? 'Bỏ trống để tự sinh' : 'Cố định sau khi tạo'}
                placeholder="BUSINESS_ANALYST"
                className="font-mono uppercase"
                disabled={!isNew}
                error={errors.code?.message}
                {...register('code', {
                  onChange: () => setCodeTouched(true),
                  setValueAs: (v: string) => v.toUpperCase(),
                })}
              />

              <fieldset>
                <legend className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">
                  Phạm vi áp dụng {!isNew && <span className="normal-case tracking-normal text-gray-400">· cố định</span>}
                </legend>
                <div className="space-y-2">
                  {(['TENANT', 'WORKSPACE', 'PROJECT'] as const).map((value) => (
                    <label
                      key={value}
                      className={clsx(
                        'flex gap-3 rounded-md border p-3 text-sm transition-colors',
                        scope === value ? 'border-brand-500 bg-brand-50/50' : 'border-gray-200',
                        isNew ? 'cursor-pointer hover:border-brand-300' : 'cursor-not-allowed opacity-70',
                      )}
                    >
                      <input type="radio" value={value} disabled={!isNew} className="mt-0.5 accent-brand-600" {...register('scope')} />
                      <span>
                        <span className="block font-medium text-gray-900">{SCOPE_LABEL[value]}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{SCOPE_HELP[value]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <TextAreaField
                label="Mô tả chức năng"
                placeholder="Vai trò này làm gì trong tổ chức?"
                disabled={readOnly}
                error={errors.description?.message}
                {...register('description')}
              />

              {!readOnly && templateOptions.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-700">Sao chép quyền từ role có sẵn</p>
                  <div className="mt-2 flex gap-2">
                    <SelectField
                      compact
                      aria-label="Chọn role mẫu"
                      value={templateRoleId}
                      onChange={(e) => setTemplateRoleId(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1"
                    >
                      <option value="">Chọn role mẫu…</option>
                      {templateOptions.map((r) => (
                        <option key={r.roleId} value={r.roleId}>
                          {r.name} ({r.permissionKeys.length} quyền)
                        </option>
                      ))}
                    </SelectField>
                    <Button type="button" variant="secondary" inline className="!h-8 !px-3 text-xs" disabled={templateRoleId === ''} onClick={loadTemplate}>
                      Nạp quyền
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">Ghi đè các quyền đang chọn bên phải.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="xl:col-span-2">
            <div className="border-b border-gray-100 p-5">
              <SectionTitle description={`Chỉ hiện quyền thuộc phạm vi ${SCOPE_LABEL[scope].toLowerCase()}.`}>
                Ma trận quyền · {selected.size}/{permissionsOfScope.length} quyền được chọn
              </SectionTitle>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="relative block lg:w-72">
                  <span className="sr-only">Tìm quyền</span>
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm tên quyền hoặc key (vd workspace.update)"
                    className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  />
                </label>
                <div className="inline-flex flex-wrap rounded-md border border-gray-200 bg-white p-0.5 text-xs">
                  {(
                    [
                      ['ALL', `Tất cả (${permissionsOfScope.length})`],
                      ['SELECTED', `Đã chọn (${selected.size})`],
                      ['SENSITIVE', `Nhạy cảm (${sensitiveCount})`],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={clsx(
                        'rounded px-2.5 py-1.5 font-medium transition-colors',
                        filter === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {groups.map(([group, perms]) => {
                const visible = perms.filter(matchesFilter)
                if (visible.length === 0) return null
                const activeCount = perms.filter((p) => selected.has(p.key)).length
                const isCollapsed = collapsed.has(group)
                return (
                  <section key={group}>
                    <div className="flex items-center justify-between gap-3 bg-gray-50/70 px-5 py-2.5">
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
                        className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                        aria-expanded={!isCollapsed}
                      >
                        <ChevronDownIcon className={clsx('h-4 w-4 text-gray-400 transition-transform', isCollapsed && '-rotate-90')} />
                        {group}
                        <span className="text-xs font-normal text-gray-400">
                          {activeCount}/{perms.length}
                        </span>
                      </button>
                      {!readOnly && (
                        <label className="flex items-center gap-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                            checked={activeCount === perms.length}
                            ref={(el) => {
                              if (el) el.indeterminate = activeCount > 0 && activeCount < perms.length
                            }}
                            onChange={(e) => toggleGroup(perms, e.target.checked)}
                          />
                          Chọn tất cả
                        </label>
                      )}
                    </div>
                    {!isCollapsed && (
                      <ul>
                        {visible.map((p) => {
                          const checked = selected.has(p.key)
                          const changed = checked !== original.has(p.key) && !isNew
                          return (
                            <li key={p.key}>
                              <label
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
                                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                                    <span className="font-mono text-[11px] text-gray-400">{p.key}</span>
                                    {changed && <Badge tone={checked ? 'brand' : 'red'}>{checked ? '+ Vừa thêm' : '− Vừa bỏ'}</Badge>}
                                  </span>
                                  {p.description && <span className="mt-0.5 block text-xs text-gray-500">{p.description}</span>}
                                </span>
                                <span className="shrink-0">
                                  {p.isSensitive ? <Badge tone="amber">Nhạy cảm</Badge> : <Badge>Nghiệp vụ</Badge>}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )
              })}
              {groups.every(([, perms]) => perms.filter(matchesFilter).length === 0) && (
                <p className="px-5 py-10 text-center text-sm text-gray-400">Không có quyền phù hợp bộ lọc.</p>
              )}
            </div>
          </Card>
        </div>
      </form>
    </DashboardLayout>
  )
}
