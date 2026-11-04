import { useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon, AlertTriangleIcon } from '@/components/ui/icons'
import { newStatus, newTransition, type DraftPhase, type DraftStatus, type DraftTransition } from '@/lib/workflowDraft'
import { DEFAULT_CATEGORY_COLOR, STATUS_CATEGORY_LABEL } from '@/lib/workflowValidation'
import type { StatusCategory, WorkflowIssue } from '@/types/project'
import type { RoleDto } from '@/types/rbac'
import { useI18n } from '@/i18n'
import { WorkflowBpmnViewer } from './WorkflowBpmnViewer'
import { ExitCriteriaChips } from '@/components/projects/ExitCriteriaChips'

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
  'h-9 w-full rounded-control border border-gray-300 bg-white px-2.5 text-sm text-gray-900 shadow-xs placeholder:text-gray-500 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-500'

export function PhaseWorkflowEditor({ phase, onChange, roles, issues, readOnly }: Props) {
  const { t } = useI18n()
  const active = phase.statuses.filter((s) => s.isActive)
  const statusIssue = (key: string) => issues.find((i) => i.statusKey === key)
  const transitionIssue = (index: number) => issues.find((i) => i.transitionIndex === index)
  const roleName = (id: number) => roles.find((r) => r.roleId === id)?.name ?? `#${id}`

  const setStatuses = (statuses: DraftStatus[]) => onChange({ ...phase, statuses })
  const setTransitions = (transitions: DraftTransition[]) => onChange({ ...phase, transitions })
  const updateStatus = (key: string, patch: Partial<DraftStatus>) =>
    setStatuses(phase.statuses.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  const updateTransition = (key: string, patch: Partial<DraftTransition>) =>
    setTransitions(phase.transitions.map((x) => (x.key === key ? { ...x, ...patch } : x)))

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
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= phase.statuses.length ||
      toIndex >= phase.statuses.length
    )
      return
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
      transitions: phase.transitions.filter((x) => x.from !== status.key && x.to !== status.key),
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
    <div className="space-y-8">
      {/* 0. Exit Criteria / Gate Rules */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-950">
              {t('Điều kiện hoàn thành giai đoạn (Exit Criteria / Gate Rules)', 'Phase Exit Criteria / Gate Rules')}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {t(
                'Các tiêu chí bắt buộc cần đạt trước khi chuyển sang giai đoạn kế tiếp trong quy trình.',
                'Mandatory conditions that must be fulfilled before this phase can be completed and advanced.',
              )}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-card border border-gray-200 bg-white p-3.5 shadow-xs">
          <ExitCriteriaChips
            criteria={phase.exitCriteria}
            editable={!readOnly}
            onChange={(nextCriteria) => onChange({ ...phase, exitCriteria: nextCriteria })}
          />
        </div>
      </section>

      {/* 1. Status Definition */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-950">{t('Trạng thái của issue', 'Issue statuses')}</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {t('Chọn một trạng thái bắt đầu cho issue mới.', 'Pick one start status for new issues.')}
            </p>
          </div>
          {!readOnly && (
            <Button type="button" inline variant="secondary" className="lg:!h-8" onClick={addStatus}>
              <PlusIcon className="h-4 w-4" /> {t('Thêm trạng thái', 'Add status')}
            </Button>
          )}
        </div>
        <div className="mt-3 overflow-x-auto rounded-card border border-gray-200 bg-white shadow-xs">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="w-20 px-3 py-2.5 font-medium">
                  <span className="sr-only">{t('Thứ tự', 'Order')}</span>
                </th>
                <th className="px-3 py-2.5 font-medium">{t('Tên trạng thái', 'Status name')}</th>
                <th className="w-64 px-3 py-2.5 font-medium">{t('Nhóm / màu', 'Category / color')}</th>
                <th className="w-20 px-3 py-2.5 text-center font-medium">{t('Bắt đầu', 'Start')}</th>
                <th className="px-3 py-2.5 font-medium">{t('Mô tả', 'Description')}</th>
                {!readOnly && <th className="w-12 px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
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
                      isDragging && 'opacity-40 bg-brand-50',
                      isDragOver && !isDragging && 'border-t-2 border-brand-500 bg-brand-50/30',
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 tabular-nums text-xs text-gray-500">
                        {!readOnly && (
                          <span
                            title={t('Kéo thả để đổi thứ tự', 'Drag to reorder')}
                            className="cursor-grab select-none px-0.5 text-gray-400 hover:text-gray-700 active:cursor-grabbing"
                            aria-hidden="true"
                          >
                            ⋮⋮
                          </span>
                        )}
                        {index + 1}
                        {!readOnly && (
                          <span className="flex flex-col leading-none">
                            <button
                              type="button"
                              aria-label={t('Lên', 'Move up')}
                              className="px-0.5 text-[9px] hover:text-brand-700"
                              onClick={() => moveStatus(index, -1)}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              aria-label={t('Xuống', 'Move down')}
                              className="px-0.5 text-[9px] hover:text-brand-700"
                              onClick={() => moveStatus(index, 1)}
                            >
                              ▼
                            </button>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={t(`Tên trạng thái ${index + 1}`, `Status name ${index + 1}`)}
                        value={s.name}
                        disabled={readOnly || !s.isActive}
                        placeholder={t('Vd: In Development', 'e.g. In Development')}
                        onChange={(e) => updateStatus(s.key, { name: e.target.value })}
                        className={clsx(inputClass, problem && 'border-red-400')}
                      />
                      {!s.isActive && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {t('Đã tắt (đang có issue)', 'Disabled (has issues)')}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={t('Màu thẻ', 'Card color')}
                          value={s.color}
                          disabled={readOnly || !s.isActive}
                          onChange={(e) => updateStatus(s.key, { color: e.target.value })}
                          className="h-9 w-9 shrink-0 cursor-pointer rounded-control border border-gray-300 bg-white p-1 disabled:cursor-not-allowed"
                        />
                        <select
                          aria-label={t('Nhóm trạng thái', 'Status category')}
                          value={s.category}
                          disabled={readOnly || !s.isActive}
                          onChange={(e) => {
                            const category = e.target.value as StatusCategory
                            const usesDefault = Object.values(DEFAULT_CATEGORY_COLOR).includes(s.color)
                            updateStatus(s.key, {
                              category,
                              color: usesDefault ? DEFAULT_CATEGORY_COLOR[category] : s.color,
                            })
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
                        aria-label={t(
                          `Đặt ${s.name || 'trạng thái'} làm khởi tạo`,
                          `Set ${s.name || 'status'} as initial`,
                        )}
                        checked={s.isInitial}
                        disabled={readOnly || !s.isActive}
                        onChange={() => setInitial(s.key)}
                        className="h-4 w-4 accent-brand-600"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={t('Mô tả trạng thái', 'Status description')}
                        value={s.description ?? ''}
                        disabled={readOnly || !s.isActive}
                        placeholder={t('Không bắt buộc', 'Optional')}
                        onChange={(e) => updateStatus(s.key, { description: e.target.value || null })}
                        className={inputClass}
                      />
                    </td>
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        {s.isActive && (
                          <button
                            type="button"
                            aria-label={t(`Xoá trạng thái ${s.name}`, `Delete status ${s.name}`)}
                            onClick={() => removeStatus(s)}
                            className="rounded-control p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700"
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
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    {t('Phase chưa có trạng thái nào.', 'The phase has no statuses yet.')}
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
            <h3 className="text-sm font-semibold text-gray-950">{t('Luật chuyển trạng thái', 'Status transitions')}</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {t(
                'Chỉ role được chọn mới chuyển được issue theo từng luật.',
                'Only the selected roles can move issues along each rule.',
              )}
            </p>
          </div>
          {!readOnly && (
            <Button
              type="button"
              inline
              variant="secondary"
              className="lg:!h-8"
              disabled={active.length < 2}
              onClick={addTransition}
            >
              <PlusIcon className="h-4 w-4" /> {t('Thêm luật chuyển', 'Add transition')}
            </Button>
          )}
        </div>
        <div className="mt-3 overflow-x-auto rounded-card border border-gray-200 bg-white shadow-xs">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-3 py-2.5 font-medium">{t('Từ trạng thái', 'From status')}</th>
                <th className="w-8 px-1 py-2.5 text-center font-medium">
                  <span className="sr-only">{t('sang', 'to')}</span>
                </th>
                <th className="px-3 py-2.5 font-medium">{t('Đến trạng thái', 'To status')}</th>
                <th className="px-3 py-2.5 font-medium">{t('Role được phép', 'Allowed roles')}</th>

                {!readOnly && <th className="w-12 px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {phase.transitions.map((rule, index) => {
                const problem = transitionIssue(index)
                const available = roles.filter((r) => !rule.allowedRoleIds.includes(r.roleId))
                const isBackward =
                  active.findIndex((s) => s.key === rule.to) < active.findIndex((s) => s.key === rule.from)
                return (
                  <tr key={rule.key} className={clsx('align-top', problem && 'bg-red-50/60')}>
                    <td className="px-3 py-2">
                      <StatusSelect
                        value={rule.from}
                        statuses={active}
                        disabled={readOnly}
                        onChange={(from) => updateTransition(rule.key, { from })}
                      />
                    </td>
                    <td
                      className={clsx(
                        'px-1 py-3 text-center text-base',
                        isBackward ? 'text-red-600' : 'text-brand-600',
                      )}
                      title={isBackward ? t('Trả ngược', 'Backward') : undefined}
                    >
                      {isBackward ? '↺' : '→'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusSelect
                        value={rule.to}
                        statuses={active}
                        disabled={readOnly}
                        onChange={(to) => updateTransition(rule.key, { to })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rule.allowedRoleIds.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700"
                          >
                            {roleName(id)}
                            {!readOnly && (
                              <button
                                type="button"
                                aria-label={t(`Bỏ ${roleName(id)}`, `Remove ${roleName(id)}`)}
                                className="text-gray-500 hover:text-red-700"
                                onClick={() =>
                                  updateTransition(rule.key, {
                                    allowedRoleIds: rule.allowedRoleIds.filter((x) => x !== id),
                                  })
                                }
                              >
                                <CloseIcon className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                        {!readOnly && available.length > 0 && (
                          <select
                            aria-label={t('Thêm role được phép', 'Add allowed role')}
                            value=""
                            onChange={(e) =>
                              e.target.value &&
                              updateTransition(rule.key, {
                                allowedRoleIds: [...rule.allowedRoleIds, Number(e.target.value)],
                              })
                            }
                            className="h-6 cursor-pointer rounded-full border border-dashed border-gray-300 bg-white px-2 text-xs text-gray-600 hover:border-brand-400 hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100"
                          >
                            <option value="">+ role</option>
                            {available.map((r) => (
                              <option key={r.roleId} value={r.roleId}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {rule.allowedRoleIds.length === 0 && readOnly && (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </div>
                    </td>

                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          aria-label={t('Xoá luật chuyển', 'Delete transition')}
                          onClick={() => setTransitions(phase.transitions.filter((x) => x.key !== rule.key))}
                          className="rounded-control p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700"
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
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    {t(
                      'Chưa có luật chuyển nào — issue sẽ kẹt ở trạng thái khởi tạo.',
                      'No transitions yet — issues will be stuck in the initial status.',
                    )}
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
  const { t } = useI18n()
  const current = statuses.find((s) => s.key === value)
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: current?.color ?? '#d0d5dd' }} />
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        aria-label={t('Trạng thái', 'Status')}
      >
        {!current && <option value={value}>{t('— chọn —', '— select —')}</option>}
        {statuses.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name || t('(chưa đặt tên)', '(unnamed)')}
          </option>
        ))}
      </select>
    </div>
  )
}

// Dòng "Matrix Validation" cuối bảng transition (Figma frame 03).
export function ValidationBar({ issues }: { issues: WorkflowIssue[] }) {
  const { t } = useI18n()
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 border-t border-gray-200 bg-success-50 px-3 py-2.5 text-sm text-success-800">
        <CheckIcon className="h-4 w-4 shrink-0" />
        {t(
          'Luồng hợp lệ: mọi trạng thái đều tới được, không có ngõ cụt.',
          'Valid: every status is reachable, no dead ends.',
        )}
      </div>
    )
  }
  return (
    <div className="border-t border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
      <p className="inline-flex items-center gap-1.5 font-semibold">
        <AlertTriangleIcon className="h-4 w-4" />{' '}
        {t(`${issues.length} lỗi cần sửa`, `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} to fix`)}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {issues.map((issue, i) => (
          <li key={i}>
            <span title={issue.code}>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
