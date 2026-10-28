import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CloseIcon, PlusIcon, TrashIcon, WorkflowIcon, BoltIcon } from '@/components/ui/icons'
import { blankPhase, newStatus, newTransition, type DraftPhase } from '@/lib/workflowDraft'
import type { SdlcMethod, SdlcTemplateDto } from '@/types/project'
import type { RoleDto } from '@/types/rbac'
import { DESCRIPTION_MAX, MAX_PHASES, NAME_MAX, type WizardState } from './wizardState'

export type KeyCheck = { state: 'idle' | 'checking' | 'available' | 'taken'; suggestion?: string | null }

interface Props {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  templates: SdlcTemplateDto[]
  projectRoles: RoleDto[]
  errors: Record<string, string>
  keyCheck: KeyCheck
  onKeyBlur: () => void
  onChooseMethod: (method: SdlcMethod) => void
}

const fieldLabel = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500'
const inputBase =
  'w-full rounded-md border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25'

export function StepProjectInfo({
  state,
  update,
  templates,
  projectRoles,
  errors,
  keyCheck,
  onKeyBlur,
  onChooseMethod,
}: Props) {
  const pipelineRef = useRef<HTMLDivElement>(null)

  // Nếu đang ở Custom SDLC thì mở khóa toàn bộ quyền chỉnh sửa
  const isCustom = state.sdlcMethod === 'CUSTOM'
  const editable = isCustom

  const setPhases = (phases: DraftPhase[]) => update({ phases, phasesTouched: true })
  const updatePhase = (key: string, patch: Partial<DraftPhase>) =>
    setPhases(state.phases.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  const [draggedPhaseIndex, setDraggedPhaseIndex] = useState<number | null>(null)
  const [dragOverPhaseIndex, setDragOverPhaseIndex] = useState<number | null>(null)

  const movePhase = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= state.phases.length) return
    const next = [...state.phases]
    ;[next[index], next[target]] = [next[target], next[index]]
    setPhases(next)
  }

  const reorderPhase = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.phases.length ||
      toIndex >= state.phases.length
    )
      return
    const next = [...state.phases]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setPhases(next)
  }

  /**
   * Kích hoạt chế độ Edit:
   * Giữ nguyên 100% các phase & status hiện tại của mô hình đang chọn,
   * lưu baseTemplateName và chuyển sang Custom SDLC Template để mở khóa toàn bộ form.
   */
  const handleStartEdit = (templateName?: string) => {
    const currentTpl = templates.find((t) => t.method === state.sdlcMethod)
    const baseName = templateName || currentTpl?.name || 'Mô hình chuẩn'

    update({
      sdlcMethod: 'CUSTOM',
      baseTemplateName: baseName,
      phasesTouched: true,
    })

    setTimeout(() => {
      pipelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  return (
    <div className="space-y-6">
      {/* 1. Enter Project Information */}
      <SectionCard
        index={1}
        title="Enter Project Information"
        subtitle="Thông tin nhận diện cơ bản và mã định danh duy nhất của dự án trong workspace."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="project-name" className={fieldLabel}>
                Project Name *
              </label>
              <span className="font-mono text-[10px] text-gray-400">[Required] [Max: {NAME_MAX} chars]</span>
            </div>
            <input
              id="project-name"
              value={state.name}
              maxLength={NAME_MAX + 20}
              placeholder="Vd: Hệ thống Quản trị Dự án Doanh nghiệp SSAM"
              onChange={(e) => update({ name: e.target.value })}
              className={clsx(
                inputBase,
                'h-10',
                errors.name ? 'border-red-400' : 'border-gray-300 focus:border-brand-600',
              )}
            />
            <div className="mt-1 flex justify-between text-[11px]">
              <span className="text-red-600">{errors.name}</span>
              <span className={clsx('font-mono', state.name.length > NAME_MAX ? 'text-red-600' : 'text-gray-400')}>
                {state.name.length}/{NAME_MAX} chars
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="project-key" className={fieldLabel}>
                Project Key *
              </label>
              <span className="font-mono text-[10px] text-gray-400">[2-10 chars]</span>
            </div>
            <div className="relative">
              <input
                id="project-key"
                value={state.key}
                maxLength={10}
                onChange={(e) =>
                  update({ key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''), keyTouched: true })
                }
                onBlur={onKeyBlur}
                className={clsx(
                  inputBase,
                  'h-10 pr-16 font-mono uppercase',
                  errors.key || keyCheck.state === 'taken'
                    ? 'border-red-400'
                    : 'border-gray-300 focus:border-brand-600',
                )}
              />
              {!state.keyTouched && state.key && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-700">
                  ⚡ AUTO
                </span>
              )}
            </div>
            <div className="mt-1 space-y-0.5 text-[11px]">
              <p className="text-gray-500">
                Prefix Issue:{' '}
                <span className="rounded-sm bg-gray-100 px-1 font-mono text-gray-700">{state.key || 'KEY'}-101</span> ·
                không đổi được sau khi tạo
              </p>
              {errors.key && <p className="text-red-600">{errors.key}</p>}
              {!errors.key && keyCheck.state === 'checking' && <p className="text-gray-400">Đang kiểm tra…</p>}
              {!errors.key && keyCheck.state === 'available' && <p className="text-brand-700">✓ Key dùng được</p>}
              {!errors.key && keyCheck.state === 'taken' && (
                <p className="text-red-600">
                  Key đã có trong workspace.{' '}
                  {keyCheck.suggestion && (
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => update({ key: keyCheck.suggestion!, keyTouched: true })}
                    >
                      Dùng {keyCheck.suggestion}
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="project-description" className={fieldLabel}>
                Description (Mô tả dự án)
              </label>
              <span className="font-mono text-[10px] text-gray-400">[Optional] [Max: {DESCRIPTION_MAX} chars]</span>
            </div>
            <textarea
              id="project-description"
              rows={3}
              value={state.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Mục tiêu, phạm vi và tiêu chuẩn bàn giao của dự án…"
              className={clsx(
                inputBase,
                'resize-y py-2',
                errors.description ? 'border-red-400' : 'border-gray-300 focus:border-brand-600',
              )}
            />
            <div className="mt-1 flex justify-between text-[11px]">
              <span className="text-red-600">{errors.description}</span>
              <span
                className={clsx('font-mono', state.description.length > DESCRIPTION_MAX ? 'text-red-600' : 'text-gray-400')}
              >
                {state.description.length}/{DESCRIPTION_MAX} chars
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 2. Choose SDLC Method */}
      <SectionCard
        index={2}
        title="2. Choose SDLC Method for Project"
        subtitle="Chọn phương thức quản lý vòng đời phát triển phần mềm chuẩn hoá công nghiệp hoặc tự do tùy biến giai đoạn (Custom Phases)."
      >
        {/* Lưới 8 Thẻ Mô hình SDLC (7 Chuẩn + 1 Custom) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {templates.map((t) => {
            const selected = t.method === state.sdlcMethod
            const isCustomTemplate = t.method === 'CUSTOM'
            const totalStatuses = t.phases.reduce((sum, p) => sum + p.statuses.length, 0)

            return (
              <div
                key={t.method}
                onClick={() => {
                  if (!selected) {
                    onChooseMethod(t.method)
                  }
                }}
                className={clsx(
                  'group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer',
                  selected
                    ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-brand-300 hover:shadow-xs',
                )}
              >
                <div>
                  {/* Top: Radio Dot + Tên Mô Hình + Badge Thẻ */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                          selected
                            ? 'border-brand-600 bg-brand-600 ring-2 ring-inset ring-white'
                            : 'border-gray-300 bg-white group-hover:border-brand-400',
                        )}
                      />
                      <h4 className="text-sm font-bold text-gray-950 leading-tight">{t.name}</h4>
                    </div>
                    {t.tag && (
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold shrink-0',
                          selected
                            ? 'bg-brand-100 text-brand-800 border border-brand-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200',
                        )}
                      >
                        {t.tag}
                      </span>
                    )}
                  </div>

                  {/* Middle: Mô Tả */}
                  <p className="mt-2 text-xs text-gray-600 line-clamp-3 leading-relaxed">{t.description}</p>
                </div>

                {/* Bottom: Số lượng Giai đoạn, Trạng thái & Nút Edit */}
                <div className="mt-3.5 pt-2.5 border-t border-gray-100/90 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-500">
                    <span className="flex items-center gap-1.5">
                      {isCustomTemplate ? (
                        <WorkflowIcon className="h-3 w-3 text-brand-600 shrink-0" />
                      ) : (
                        <BoltIcon className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                      <span>
                        {isCustomTemplate && selected
                          ? `${state.phases.length} Giai đoạn tùy chỉnh`
                          : `${t.phases.length} Giai đoạn chuẩn · ${totalStatuses} Trạng thái`}
                      </span>
                    </span>
                    {selected && <Badge tone="brand">Đang chọn</Badge>}
                  </div>

                  {/* Nút Edit nổi bật khi chọn mô hình có sẵn */}
                  {selected && !isCustomTemplate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartEdit(t.name)
                      }}
                      className="w-full mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-300 bg-white hover:bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 shadow-2xs transition-all active:scale-95"
                      title="Giữ nguyên mô hình này và chuyển sang Custom để chỉnh sửa tự do"
                    >
                      <span>✏️</span>
                      <span>Edit (Tùy chỉnh trên mô hình này)</span>
                    </button>
                  )}

                  {/* Badge hiển thị template gốc khi đang ở Custom */}
                  {selected && isCustomTemplate && state.baseTemplateName && (
                    <div className="rounded-md bg-brand-100/80 border border-brand-200 px-2 py-1 text-[11px] font-medium text-brand-800 text-center truncate">
                      ⚡ Đang tùy chỉnh từ: <strong>{state.baseTemplateName}</strong>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Phase Pipeline Definition (Trình thiết kế giai đoạn dự án) */}
        <div ref={pipelineRef} className="mt-6 rounded-xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/90 px-5 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Phase Pipeline Definition (Trình thiết kế giai đoạn dự án)
                </h3>
                {isCustom ? (
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    {state.baseTemplateName ? `Tùy biến từ: ${state.baseTemplateName}` : 'Tùy chỉnh linh hoạt'}
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                    Mẫu: {templates.find((t) => t.method === state.sdlcMethod)?.name || state.sdlcMethod} (Xem trước)
                  </span>
                )}
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                Thứ tự giai đoạn quyết định luồng chuyển dịch phát hành (Linear Release Gates).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge>{state.phases.length} phase</Badge>
              {!isCustom && (
                <button
                  type="button"
                  onClick={() => handleStartEdit()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-all active:scale-95"
                  title="Chuyển sang Custom để sửa tên phase, thứ tự hoặc trạng thái"
                >
                  <span>✏️</span>
                  <span>Edit (Tùy chỉnh trên mô hình này)</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="w-24 px-4 py-2 font-medium">Phase order</th>
                  <th className="w-64 px-3 py-2 font-medium">Phase name</th>
                  <th className="px-3 py-2 font-medium">Description / scope</th>
                  <th className="px-3 py-2 font-medium">Statuses in phase</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {state.phases.map((phase, index) => {
                  const isDragging = draggedPhaseIndex === index
                  const isDragOver = dragOverPhaseIndex === index
                  return (
                    <tr
                      key={phase.key}
                      draggable={editable}
                      onDragStart={(e) => {
                        if (!editable) return
                        setDraggedPhaseIndex(index)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => {
                        if (!editable) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverPhaseIndex !== index) {
                          setDragOverPhaseIndex(index)
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverPhaseIndex === index) {
                          setDragOverPhaseIndex(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (draggedPhaseIndex !== null && draggedPhaseIndex !== index) {
                          reorderPhase(draggedPhaseIndex, index)
                        }
                        setDraggedPhaseIndex(null)
                        setDragOverPhaseIndex(null)
                      }}
                      onDragEnd={() => {
                        setDraggedPhaseIndex(null)
                        setDragOverPhaseIndex(null)
                      }}
                      className={clsx(
                        'align-top transition-colors',
                        isDragging && 'opacity-40 bg-brand-50 border-dashed border-2 border-brand-400',
                        isDragOver && !isDragging && 'border-t-2 border-brand-500 bg-brand-50/30',
                      )}
                    >
                      {/* Cột 1: Thứ tự Phase */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {editable ? (
                            <>
                              <span
                                title="Kéo thả để đổi thứ tự giai đoạn"
                                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 select-none text-xs"
                              >
                                ⋮⋮
                              </span>
                              <span className="flex flex-col text-[10px] leading-none text-gray-400">
                                <button
                                  type="button"
                                  aria-label="Đưa phase lên"
                                  className="hover:text-gray-700"
                                  onClick={() => movePhase(index, -1)}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  aria-label="Đưa phase xuống"
                                  className="hover:text-gray-700"
                                  onClick={() => movePhase(index, 1)}
                                >
                                  ▼
                                </button>
                              </span>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEdit()}
                              title="Bấm để tùy chỉnh thứ tự"
                              className="text-gray-300 hover:text-brand-600 text-xs"
                            >
                              🔒
                            </button>
                          )}
                          <span className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 font-mono text-xs text-gray-600 font-semibold bg-gray-50">
                            {index + 1}
                          </span>
                        </div>
                      </td>

                      {/* Cột 2: Tên Phase */}
                      <td className="px-3 py-3">
                        {editable ? (
                          <input
                            aria-label={`Tên phase ${index + 1}`}
                            value={phase.name}
                            onChange={(e) => updatePhase(phase.key, { name: e.target.value })}
                            className={clsx(inputBase, 'h-8 border-gray-300 focus:border-brand-600 font-semibold')}
                          />
                        ) : (
                          <div
                            onClick={() => handleStartEdit()}
                            className="group flex items-center justify-between gap-1 p-1 rounded hover:bg-gray-100/80 cursor-pointer"
                            title="Bấm để tùy chỉnh tên giai đoạn"
                          >
                            <span className="font-semibold text-gray-900">{phase.name}</span>
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 text-xs transition-opacity">
                              ✏️
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Cột 3: Mô tả / Phạm vi Phase */}
                      <td className="px-3 py-3">
                        {editable ? (
                          <input
                            aria-label={`Mô tả phase ${index + 1}`}
                            value={phase.description ?? ''}
                            placeholder="Mô tả phạm vi bàn giao..."
                            onChange={(e) => updatePhase(phase.key, { description: e.target.value || null })}
                            className={clsx(inputBase, 'h-8 border-gray-300 focus:border-brand-600 text-xs')}
                          />
                        ) : (
                          <div
                            onClick={() => handleStartEdit()}
                            className="group flex items-center justify-between gap-1 p-1 rounded hover:bg-gray-100/80 cursor-pointer text-xs"
                            title="Bấm để tùy chỉnh mô tả giai đoạn"
                          >
                            <span className="text-gray-600">{phase.description || '—'}</span>
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 text-xs transition-opacity">
                              ✏️
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Cột 4: Statuses trong Phase */}
                      <td className="px-3 py-3">
                        <StatusChips
                          phase={phase}
                          editable={editable}
                          projectRoles={projectRoles}
                          onRequireEdit={() => handleStartEdit()}
                          onChange={(next) => updatePhase(phase.key, next)}
                        />
                      </td>

                      {/* Cột 5: Xóa Phase */}
                      <td className="px-3 py-3 text-right">
                        {editable ? (
                          <button
                            type="button"
                            aria-label={`Xoá phase ${phase.name}`}
                            disabled={state.phases.length <= 1}
                            onClick={() => setPhases(state.phases.filter((p) => p.key !== phase.key))}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">🔒</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Chân Bảng: Nút Thêm Phase hoặc Nút Bật Chế độ Tùy biến */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 bg-gray-50/50">
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                inline
                className="!h-8 !px-3 text-sm text-brand-700 font-bold hover:bg-brand-50"
                disabled={state.phases.length >= MAX_PHASES}
                onClick={() => setPhases([...state.phases, blankPhase(`Phase ${state.phases.length + 1}`, projectRoles)])}
              >
                <PlusIcon className="h-4 w-4" /> Add Phase (Thêm giai đoạn mới)
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => handleStartEdit()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span>✏️</span>
                <span>Chuyển sang Custom để thêm/xóa giai đoạn (Edit Pipeline)</span>
              </button>
            )}

            <span className={clsx('font-mono text-[11px]', errors.phases ? 'text-red-600' : 'text-brand-700 font-medium')}>
              {errors.phases ?? `✓ Tất cả ${state.phases.length} giai đoạn hợp lệ & liên hoàn tuyến tính`}
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

/**
 * Cột "Statuses in phase":
 * Hiển thị chấm tròn màu sắc theo chuẩn category:
 * - TODO: chấm xám
 * - IN_PROGRESS: chấm xanh dương / tím / hổ phách
 * - DONE: chấm xanh lá emerald
 */
function StatusChips({
  phase,
  editable,
  projectRoles,
  onRequireEdit,
  onChange,
}: {
  phase: DraftPhase
  editable: boolean
  projectRoles: RoleDto[]
  onRequireEdit: () => void
  onChange: (patch: Partial<DraftPhase>) => void
}) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const active = phase.statuses.filter((s) => s.isActive)

  const add = () => {
    const name = value.trim()
    if (!name) return setAdding(false)
    const isFirst = active.length === 0
    const status = newStatus(name, isFirst ? 'TODO' : 'IN_PROGRESS', isFirst)
    const last = active[active.length - 1]
    const transitions = last
      ? [...phase.transitions, newTransition(last.key, status.key, projectRoles.map((r) => r.roleId))]
      : phase.transitions
    onChange({ statuses: [...phase.statuses, status], transitions })
    setValue('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map((s) => {
        // Màu sắc phân loại rõ ràng: TODO (xám), IN_PROGRESS (xanh/tím/amber), DONE (xanh lá)
        const dotColor =
          s.category === 'DONE'
            ? '#059669'
            : s.category === 'TODO'
              ? '#64748b'
              : s.color || '#2563eb'

        return (
          <span
            key={s.key}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 shadow-2xs"
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: dotColor }} />
            <span>{s.name || '(chưa đặt tên)'}</span>
            {editable && active.length > 1 && (
              <button
                type="button"
                aria-label={`Bỏ trạng thái ${s.name}`}
                className="text-gray-400 hover:text-red-600 transition-colors ml-0.5"
                onClick={() => {
                  const statuses = phase.statuses.filter((x) => x.key !== s.key)
                  if (s.isInitial && statuses.length > 0) statuses[0] = { ...statuses[0], isInitial: true }
                  onChange({
                    statuses,
                    transitions: phase.transitions.filter((t) => t.from !== s.key && t.to !== s.key),
                  })
                }}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            )}
          </span>
        )
      })}

      {editable ? (
        adding ? (
          <input
            autoFocus
            aria-label="Tên trạng thái mới"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
              if (e.key === 'Escape') setAdding(false)
            }}
            className="h-6 w-28 rounded-md border border-brand-400 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-2xs"
            placeholder="Tên status..."
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-xs font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/50 transition-colors"
          >
            + Add status
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={onRequireEdit}
          title="Bấm để chuyển sang Custom và thêm trạng thái"
          className="rounded-md border border-dashed border-gray-200 px-2 py-0.5 text-[11px] text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          + Add status 🔒
        </button>
      )}
    </div>
  )
}

export function SectionCard({
  index,
  title,
  subtitle,
  tag,
  children,
}: {
  index: number
  title: string
  subtitle: string
  tag?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-brand-50/30 px-5 py-4">
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 font-mono text-xs font-semibold text-white">
            {index}
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-950">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {tag && (
          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-[10px] text-gray-500">
            {tag}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
