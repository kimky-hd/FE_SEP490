import { useState } from 'react'
import clsx from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon, AlertTriangleIcon } from '@/components/ui/icons'
import { newStatus, newTransition, type DraftPhase, type DraftStatus, type DraftTransition } from '@/lib/workflowDraft'
import { DEFAULT_CATEGORY_COLOR, STATUS_CATEGORY_LABEL } from '@/lib/workflowValidation'
import type { StatusCategory, WorkflowIssue } from '@/types/project'
import type { RoleDto } from '@/types/rbac'
import { WorkflowBpmnViewer } from './WorkflowBpmnViewer'

// Figma hàng 2 frame 03 "Configure Issue Status & Transitions": khối 1 Status Definition, khối 2 Transition Rules
// (From → To · Allowed roles (RBAC) · Require comment), dòng "Matrix Validation" cuối bảng. UC §II.5.10/5.12/5.13.

interface Props {
  phase: DraftPhase
  onChange: (next: DraftPhase) => void
  /** Role cấp dự án đang bật — chọn "role được phép" cho từng transition. */
  roles: RoleDto[]
  issues: WorkflowIssue[]
  readOnly?: boolean
}

const inputClass =
  'h-8 w-full rounded border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-gray-50 disabled:text-gray-500'

export function PhaseWorkflowEditor({ phase, onChange, roles, issues, readOnly }: Props) {
  const active = phase.statuses.filter((s) => s.isActive)
  const statusIssue = (key: string) => issues.find((i) => i.statusKey === key)
  const transitionIssue = (index: number) => issues.find((i) => i.transitionIndex === index)
  const roleName = (id: number) => roles.find((r) => r.roleId === id)?.name ?? `#${id}`

  const setStatuses = (statuses: DraftStatus[]) => onChange({ ...phase, statuses })
  const setTransitions = (transitions: DraftTransition[]) => onChange({ ...phase, transitions })
  const updateStatus = (key: string, patch: Partial<DraftStatus>) =>
    setStatuses(phase.statuses.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  const updateTransition = (key: string, patch: Partial<DraftTransition>) =>
    setTransitions(phase.transitions.map((t) => (t.key === key ? { ...t, ...patch } : t)))

  const setInitial = (key: string) => setStatuses(phase.statuses.map((s) => ({ ...s, isInitial: s.key === key })))

  const [draggedStatusIndex, setDraggedStatusIndex] = useState<number | null>(null)
  const [dragOverStatusIndex, setDragOverStatusIndex] = useState<number | null>(null)

  const moveStatus = (index: number, delta: number) => {
    const next = [...phase.statuses]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setStatuses(next)
  }

  const reorderStatus = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= phase.statuses.length || toIndex >= phase.statuses.length) return
    const next = [...phase.statuses]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setStatuses(next)
  }

  const removeStatus = (status: DraftStatus) => {
    // Trạng thái đang có issue: chỉ tắt (STATUS_IN_USE — §12.4); còn lại xoá hẳn + bỏ luật liên quan.
    const remaining =
      (status.issueCount ?? 0) > 0
        ? phase.statuses.map((s) => (s.key === status.key ? { ...s, isActive: false, isInitial: false } : s))
        : phase.statuses.filter((s) => s.key !== status.key)
    const stillActive = remaining.filter((s) => s.isActive)
    const fixed =
      status.isInitial && stillActive.length > 0
        ? remaining.map((s) => (s.key === stillActive[0].key ? { ...s, isInitial: true } : s))
        : remaining
    onChange({
      ...phase,
      statuses: fixed,
      transitions: phase.transitions.filter((t) => t.from !== status.key && t.to !== status.key),
    })
  }

  const addStatus = () => {
    const category: StatusCategory = active.length === 0 ? 'TODO' : 'IN_PROGRESS'
    setStatuses([...phase.statuses, newStatus('', category, active.length === 0)])
  }

  const addTransition = () => {
    const [first, second] = active
    setTransitions([...phase.transitions, newTransition(first?.key ?? '', second?.key ?? first?.key ?? '')])
  }

  return (
    <div className="space-y-6">
      {/* 1. Status Definition */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Status Definition (Danh sách trạng thái Issue)</h3>
            <p className="mt-0.5 text-xs text-gray-500">Tên trạng thái, nhóm / màu thẻ và trạng thái khởi tạo mặc định cho issue mới.</p>
          </div>
          {!readOnly && (
            <Button type="button" inline variant="secondary" className="!h-8 !px-3 text-xs" onClick={addStatus}>
              <PlusIcon className="h-3.5 w-3.5" /> Thêm trạng thái
            </Button>
          )}
        </div>
        <div className="mt-3 overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                <th className="w-16 px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Tên trạng thái</th>
                <th className="w-56 px-3 py-2 font-medium">Nhóm / màu</th>
                <th className="w-20 px-3 py-2 text-center font-medium">Khởi tạo</th>
                <th className="px-3 py-2 font-medium">Mô tả</th>
                {!readOnly && <th className="w-12 px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {phase.statuses.map((s, index) => {
                const problem = statusIssue(s.key)
                const isDragging = draggedStatusIndex === index
                const isDragOver = dragOverStatusIndex === index
                return (
                  <tr
                    key={s.key}
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      if (readOnly) return
                      setDraggedStatusIndex(index)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      if (readOnly) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverStatusIndex !== index) {
                        setDragOverStatusIndex(index)
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverStatusIndex === index) {
                        setDragOverStatusIndex(null)
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedStatusIndex !== null && draggedStatusIndex !== index) {
                        reorderStatus(draggedStatusIndex, index)
                      }
                      setDraggedStatusIndex(null)
                      setDragOverStatusIndex(null)
                    }}
                    onDragEnd={() => {
                      setDraggedStatusIndex(null)
                      setDragOverStatusIndex(null)
                    }}
                    className={clsx(
                      'transition-colors',
                      !s.isActive && 'bg-gray-50 opacity-60',
                      problem && 'bg-red-50/60',
                      isDragging && 'opacity-40 bg-brand-50 border-dashed border-2 border-brand-400',
                      isDragOver && !isDragging && 'border-t-2 border-brand-500 bg-brand-50/30',
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-gray-400">
                        {!readOnly && (
                          <span
                            title="Kéo thả để đổi thứ tự"
                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 select-none px-1"
                          >
                            ⋮⋮
                          </span>
                        )}
                        {String(index + 1).padStart(2, '0')}
                        {!readOnly && (
                          <span className="flex flex-col leading-none">
                            <button type="button" aria-label="Lên" className="px-0.5 hover:text-gray-700" onClick={() => moveStatus(index, -1)}>
                              ▲
                            </button>
                            <button type="button" aria-label="Xuống" className="px-0.5 hover:text-gray-700" onClick={() => moveStatus(index, 1)}>
                              ▼
                            </button>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Tên trạng thái ${index + 1}`}
                        value={s.name}
                        disabled={readOnly || !s.isActive}
                        placeholder="Vd: In Development"
                        onChange={(e) => updateStatus(s.key, { name: e.target.value })}
                        className={clsx(inputClass, problem && 'border-red-400')}
                      />
                      {!s.isActive && <p className="mt-0.5 text-[11px] text-gray-400">Đã tắt (đang có issue)</p>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label="Màu thẻ"
                          value={s.color}
                          disabled={readOnly || !s.isActive}
                          onChange={(e) => updateStatus(s.key, { color: e.target.value })}
                          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5 disabled:cursor-not-allowed"
                        />
                        <select
                          aria-label="Nhóm trạng thái"
                          value={s.category}
                          disabled={readOnly || !s.isActive}
                          onChange={(e) => {
                            const category = e.target.value as StatusCategory
                            const usesDefault = Object.values(DEFAULT_CATEGORY_COLOR).includes(s.color)
                            updateStatus(s.key, { category, color: usesDefault ? DEFAULT_CATEGORY_COLOR[category] : s.color })
                          }}
                          className={inputClass}
                        >
                          {(Object.keys(STATUS_CATEGORY_LABEL) as StatusCategory[]).map((c) => (
                            <option key={c} value={c}>
                              {STATUS_CATEGORY_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="radio"
                        name={`initial-${phase.key}`}
                        aria-label={`Đặt ${s.name || 'trạng thái'} làm khởi tạo`}
                        checked={s.isInitial}
                        disabled={readOnly || !s.isActive}
                        onChange={() => setInitial(s.key)}
                        className="h-4 w-4 accent-brand-600"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label="Mô tả trạng thái"
                        value={s.description ?? ''}
                        disabled={readOnly || !s.isActive}
                        placeholder="Không bắt buộc"
                        onChange={(e) => updateStatus(s.key, { description: e.target.value || null })}
                        className={inputClass}
                      />
                    </td>
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        {s.isActive && (
                          <button
                            type="button"
                            aria-label={`Xoá trạng thái ${s.name}`}
                            onClick={() => removeStatus(s)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {phase.statuses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">
                    Phase chưa có trạng thái nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>



      {/* 2. Transition Rules */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Transition Rules (Quy tắc chuyển dịch trạng thái & Phân quyền)</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Mỗi dòng là 1 lối đi được phép: chỉ role được chọn mới kéo được issue qua (GB-04).
            </p>
          </div>
          {!readOnly && (
            <Button
              type="button"
              inline
              variant="secondary"
              className="!h-8 !px-3 text-xs"
              disabled={active.length < 2}
              onClick={addTransition}
            >
              <PlusIcon className="h-3.5 w-3.5" /> Thêm luật chuyển
            </Button>
          )}
        </div>
        <div className="mt-3 overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                <th className="px-3 py-2 font-medium">Từ trạng thái</th>
                <th className="w-8 px-1 py-2 text-center font-medium">→</th>
                <th className="px-3 py-2 font-medium">Đến trạng thái</th>
                <th className="px-3 py-2 font-medium">Role được phép (RBAC)</th>
                
                {!readOnly && <th className="w-12 px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {phase.transitions.map((t, index) => {
                const problem = transitionIssue(index)
                const available = roles.filter((r) => !t.allowedRoleIds.includes(r.roleId))
                const isBackward =
                  active.findIndex((s) => s.key === t.to) < active.findIndex((s) => s.key === t.from)
                return (
                  <tr key={t.key} className={clsx('align-top', problem && 'bg-red-50/60')}>
                    <td className="px-3 py-2">
                      <StatusSelect value={t.from} statuses={active} disabled={readOnly} onChange={(from) => updateTransition(t.key, { from })} />
                    </td>
                    <td className={clsx('px-1 py-3 text-center text-base', isBackward ? 'text-red-500' : 'text-brand-600')} title={isBackward ? 'Trả ngược' : undefined}>
                      {isBackward ? '↺' : '→'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusSelect value={t.to} statuses={active} disabled={readOnly} onChange={(to) => updateTransition(t.key, { to })} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.allowedRoleIds.map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                            {roleName(id)}
                            {!readOnly && (
                              <button
                                type="button"
                                aria-label={`Bỏ ${roleName(id)}`}
                                className="text-gray-400 hover:text-red-600"
                                onClick={() => updateTransition(t.key, { allowedRoleIds: t.allowedRoleIds.filter((x) => x !== id) })}
                              >
                                <CloseIcon className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                        {!readOnly && available.length > 0 && (
                          <select
                            aria-label="Thêm role được phép"
                            value=""
                            onChange={(e) =>
                              e.target.value &&
                              updateTransition(t.key, { allowedRoleIds: [...t.allowedRoleIds, Number(e.target.value)] })
                            }
                            className="h-6 rounded border border-dashed border-gray-300 bg-white px-1 text-[11px] text-gray-500"
                          >
                            <option value="">+ role</option>
                            {available.map((r) => (
                              <option key={r.roleId} value={r.roleId}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {t.allowedRoleIds.length === 0 && readOnly && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>

                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          aria-label="Xoá luật chuyển"
                          onClick={() => setTransitions(phase.transitions.filter((x) => x.key !== t.key))}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {phase.transitions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">
                    Chưa có luật chuyển nào — issue sẽ kẹt ở trạng thái khởi tạo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <ValidationBar issues={issues} />
        </div>
      </section>

      {/* 3. Sơ đồ BPMN trạng thái quy trình trực quan (dưới cùng) */}
      <section>
        <WorkflowBpmnViewer phase={phase} />
      </section>
    </div>
  )
}

function StatusSelect({
  value,
  statuses,
  disabled,
  onChange,
}: {
  value: string
  statuses: DraftStatus[]
  disabled?: boolean
  onChange: (key: string) => void
}) {
  const current = statuses.find((s) => s.key === value)
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: current?.color ?? '#d6d3d1' }} />
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputClass} aria-label="Trạng thái">
        {!current && <option value={value}>— chọn —</option>}
        {statuses.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name || '(chưa đặt tên)'}
          </option>
        ))}
      </select>
    </div>
  )
}

// Dòng "Matrix Validation" cuối bảng transition (Figma frame 03).
export function ValidationBar({ issues }: { issues: WorkflowIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-brand-50/50 px-3 py-2 font-mono text-[11px] text-brand-700">
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon className="h-3.5 w-3.5" /> Matrix Validation: không phát hiện ngõ cụt (Deadlock Check Passed).
        </span>
        <span className="text-brand-600/70">DETERMINISTIC STATE MAP: OK</span>
      </div>
    )
  }
  return (
    <div className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      <p className="inline-flex items-center gap-1.5 font-semibold">
        <AlertTriangleIcon className="h-3.5 w-3.5" /> Matrix Validation: {issues.length} lỗi cần sửa
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {issues.map((issue, i) => (
          <li key={i}>
            {issue.message} <Badge tone="red">{issue.code}</Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
