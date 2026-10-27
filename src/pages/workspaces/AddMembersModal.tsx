import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { SelectField } from '@/components/ui/SelectField'
import { SearchIcon } from '@/components/ui/icons'
import { workspaceApi } from '@/api/workspaceApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import type { RoleDto, UserRefDto, WorkspaceMemberDto } from '@/types/rbac'

interface Props {
  open: boolean
  workspaceId: number
  /** Role scope WORKSPACE đang active (để chọn role cho người được thêm). */
  roles: RoleDto[]
  onClose: () => void
  onAdded: (members: WorkspaceMemberDto[]) => void | Promise<void>
}

const SEARCH_DEBOUNCE_MS = 250

// UC-26 / UC §II.5.5: chọn người từ danh sách nhân viên công ty chưa ở trong workspace, gán chung 1 role.
export function AddMembersModal({ open, workspaceId, roles, onClose, onAdded }: Props) {
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<UserRefDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<Map<number, UserRefDto>>(new Map())
  const [roleId, setRoleId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelected(new Map())
      setRoleId('')
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    const timer = setTimeout(() => {
      workspaceApi
        .listMemberCandidates(workspaceId, search.trim() || undefined)
        .then((items) => !cancelled && setCandidates(items))
        .catch((err) => !cancelled && setError(apiErrorMessage(err)))
        .finally(() => !cancelled && setIsLoading(false))
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, search, workspaceId])

  // Mặc định chọn role "Workspace Member" nếu có.
  useEffect(() => {
    if (open && roleId === '' && roles.length > 0) {
      setRoleId(roles.find((r) => r.code === 'WORKSPACE_MEMBER')?.roleId ?? roles[0].roleId)
    }
  }, [open, roles, roleId])

  const toggle = (candidate: UserRefDto) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(candidate.userId)) next.delete(candidate.userId)
      else next.set(candidate.userId, candidate)
      return next
    })

  const submit = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      const added = await workspaceApi.addMembers(
        workspaceId,
        [...selected.keys()].map((userId) => ({ userId, roleId: roleId === '' ? null : roleId })),
      )
      await onAdded(added)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm thành viên vào workspace"
      description="Chọn nhân viên trong công ty. Người chưa có tài khoản hãy mời ở mục Mời thành viên."
      footer={
        <>
          <Button variant="secondary" inline onClick={onClose}>
            Huỷ
          </Button>
          <Button inline disabled={selected.size === 0} isLoading={isSubmitting} onClick={() => void submit()}>
            Thêm {selected.size > 0 ? `${selected.size} người` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <label className="relative block">
          <span className="sr-only">Tìm nhân viên</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </label>

        <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
          {isLoading && candidates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">Đang tải…</p>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              {search ? 'Không tìm thấy nhân viên phù hợp.' : 'Mọi nhân viên đều đã ở trong workspace.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {candidates.map((c) => {
                const checked = selected.has(c.userId)
                return (
                  <li key={c.userId}>
                    <label
                      className={clsx(
                        'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                        checked ? 'bg-brand-50/60' : 'hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c)}
                        className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                      />
                      <Avatar name={c.fullName} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{c.fullName}</span>
                        <span className="block truncate text-xs text-gray-500">{c.email}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <SelectField
          label="Role trong workspace"
          hint="Áp dụng cho tất cả người được chọn"
          value={roleId}
          onChange={(e) => setRoleId(Number(e.target.value))}
        >
          {roles.map((r) => (
            <option key={r.roleId} value={r.roleId}>
              {r.name}
            </option>
          ))}
        </SelectField>
      </div>
    </Modal>
  )
}
