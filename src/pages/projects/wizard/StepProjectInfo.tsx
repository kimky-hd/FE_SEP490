import { useState } from 'react'
import clsx from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CloseIcon, PlusIcon, TrashIcon, WorkflowIcon, BoltIcon } from '@/components/ui/icons'
import { blankPhase, newStatus, newTransition, type DraftPhase } from '@/lib/workflowDraft'
import type { SdlcMethod, SdlcTemplateDto } from '@/types/project'
import type { RoleDto } from '@/types/rbac'
import { DESCRIPTION_MAX, MAX_PHASES, NAME_MAX, type WizardState } from './wizardState'

// Bước 1 — Figma hàng 2 frame 02: khối "Enter Project Information" + "Choose SDLC Method" +
// bảng "Custom Phase Pipeline Definition". FR §III.5.2 (Issue Key prefix bất biến, bật module AI).

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

export function StepProjectInfo({ state, update, templates, projectRoles, errors, keyCheck, onKeyBlur, onChooseMethod }: Props) {
  const editable = true

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
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.phases.length || toIndex >= state.phases.length) return
    const next = [...state.phases]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setPhases(next)
  }

  return (
    <div className="space-y-6">
      {/* 1. Enter Project Information */}
      <SectionCard index={1} title="Enter Project Information" subtitle="Thông tin nhận diện cơ bản và mã định danh duy nhất của dự án trong workspace." >
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
              className={clsx(inputBase, 'h-10', errors.name ? 'border-red-400' : 'border-gray-300 focus:border-brand-600')}
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
                onChange={(e) => update({ key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''), keyTouched: true })}
                onBlur={onKeyBlur}
                className={clsx(
                  inputBase,
                  'h-10 pr-16 font-mono uppercase',
                  errors.key || keyCheck.state === 'taken' ? 'border-red-400' : 'border-gray-300 focus:border-brand-600',
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
                Prefix Issue: <span className="rounded-sm bg-gray-100 px-1 font-mono text-gray-700">{state.key || 'KEY'}-101</span> · không đổi được sau khi tạo
              </p>
              {errors.key && <p className="text-red-600">{errors.key}</p>}
              {!errors.key && keyCheck.state === 'checking' && <p className="text-gray-400">Đang kiểm tra…</p>}
              {!errors.key && keyCheck.state === 'available' && <p className="text-brand-700">✓ Key dùng được</p>}
              {!errors.key && keyCheck.state === 'taken' && (
                <p className="text-red-600">
                  Key đã có trong workspace.{' '}
                  {keyCheck.suggestion && (
                    <button type="button" className="font-semibold underline" onClick={() => update({ key: keyCheck.suggestion!, keyTouched: true })}>
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
              className={clsx(inputBase, 'resize-y py-2', errors.description ? 'border-red-400' : 'border-gray-300 focus:border-brand-600')}
            />
            <div className="mt-1 flex justify-between text-[11px]">
              <span className="text-red-600">{errors.description}</span>
              <span className={clsx('font-mono', state.description.length > DESCRIPTION_MAX ? 'text-red-600' : 'text-gray-400')}>
                {state.description.length}/{DESCRIPTION_MAX} chars
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 2. Choose SDLC Method */}
      <SectionCard
        index={2}
        title="Choose SDLC Method for Project"
        subtitle="Chọn phương thức quản lý vòng đời phát triển phần mềm chuẩn hoá hoặc tuỳ biến các giai đoạn (Custom Phases)."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {templates.map((t) => {
            const selected = t.method === state.sdlcMethod
            return (
              <button
                key={t.method}
                type="button"
                onClick={() => onChooseMethod(t.method)}
                className={clsx(
                  'flex flex-col rounded-md border p-4 text-left transition-colors',
                  selected ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 text-base font-semibold text-gray-950">
                    <span className={clsx('h-4 w-4 rounded-full border-2', selected ? 'border-brand-600 bg-brand-600 ring-2 ring-inset ring-white' : 'border-gray-300')} />
                    {t.name}
                  </span>
                  {selected ? <Badge tone="brand">Đang chọn</Badge> : null}
                </span>
                <span className="mt-2 flex-1 text-xs text-gray-500">{t.description}</span>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-gray-50 px-2 py-1 font-mono text-[10px] text-gray-500">
                  {t.phasesEditable ? <WorkflowIcon className="h-3 w-3" /> : <BoltIcon className="h-3 w-3" />}
                  `${t.phases.length} Standard Stages (Tuỳ chỉnh được)`
                </span>
              </button>
            )
          })}
        </div>

        {/* Custom Phase Pipeline Definition */}
        <div className="mt-5 rounded-md border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                'Phase Pipeline Definition (Trình thiết kế giai đoạn dự án)'
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                Thứ tự giai đoạn quyết định luồng chuyển dịch phát hành (Linear Release Gates).
              </p>
            </div>
            <Badge>{state.phases.length} phase</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="w-24 px-4 py-2 font-medium">Phase order</th>
                  <th className="w-56 px-3 py-2 font-medium">Phase name</th>
                  <th className="px-3 py-2 font-medium">Description / scope</th>
                  <th className="px-3 py-2 font-medium">Statuses in phase</th>
                  {editable && <th className="w-12 px-3 py-2" />}
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {editable && (
                            <span
                              title="Kéo thả để đổi thứ tự giai đoạn"
                              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 select-none text-xs"
                            >
                              ⋮⋮
                            </span>
                          )}
                          {editable && (
                            <span className="flex flex-col text-[10px] leading-none text-gray-400">
                              <button type="button" aria-label="Đưa phase lên" className="hover:text-gray-700" onClick={() => movePhase(index, -1)}>
                                ▲
                              </button>
                              <button type="button" aria-label="Đưa phase xuống" className="hover:text-gray-700" onClick={() => movePhase(index, 1)}>
                                ▼
                              </button>
                            </span>
                          )}
                          <span className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 font-mono text-xs text-gray-600">
                            {index + 1}
                          </span>
                        </div>
                      </td>
                    <td className="px-3 py-3">
                      {editable ? (
                        <input
                          aria-label={`Tên phase ${index + 1}`}
                          value={phase.name}
                          onChange={(e) => updatePhase(phase.key, { name: e.target.value })}
                          className={clsx(inputBase, 'h-8 border-gray-300 focus:border-brand-600')}
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{phase.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editable ? (
                        <input
                          aria-label={`Mô tả phase ${index + 1}`}
                          value={phase.description ?? ''}
                          placeholder="Không bắt buộc"
                          onChange={(e) => updatePhase(phase.key, { description: e.target.value || null })}
                          className={clsx(inputBase, 'h-8 border-gray-300 focus:border-brand-600')}
                        />
                      ) : (
                        <span className="text-gray-500">{phase.description}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusChips
                        phase={phase}
                        editable={editable}
                        projectRoles={projectRoles}
                        onChange={(next) => updatePhase(phase.key, next)}
                      />
                    </td>
                    {editable && (
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          aria-label={`Xoá phase ${phase.name}`}
                          disabled={state.phases.length <= 1}
                          onClick={() => setPhases(state.phases.filter((p) => p.key !== phase.key))}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-2.5">
            <Button
                type="button"
                variant="ghost"
                inline
                className="!h-8 !px-2 text-sm text-brand-700"
                disabled={state.phases.length >= MAX_PHASES}
                onClick={() => setPhases([...state.phases, blankPhase(`Phase ${state.phases.length + 1}`, projectRoles)])}
              >
                <PlusIcon className="h-4 w-4" /> Add Phase (Thêm giai đoạn mới)
              </Button>
            <span className={clsx('font-mono text-[11px]', errors.phases ? 'text-red-600' : 'text-brand-700')}>
              {errors.phases ?? `✓ All ${state.phases.length} phases are valid & sequential`}
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// Cột "Statuses in phase": chip trạng thái + ô "+ Add status" (Figma frame 02). Chi tiết (nhóm, initial, luật
// chuyển) chỉnh ở bước 2.
function StatusChips({
  phase,
  editable,
  projectRoles,
  onChange,
}: {
  phase: DraftPhase
  editable: boolean
  projectRoles: RoleDto[]
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
    // Nối tạm từ trạng thái cuối sang trạng thái mới để phase không bị "không tới được" — chỉnh lại ở bước 2.
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
      {active.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1 rounded-sm border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
          {s.name || '(chưa đặt tên)'}
          {editable && active.length > 1 && (
            <button
              type="button"
              aria-label={`Bỏ trạng thái ${s.name}`}
              className="text-gray-400 hover:text-red-600"
              onClick={() => {
                const statuses = phase.statuses.filter((x) => x.key !== s.key)
                if (s.isInitial && statuses.length > 0) statuses[0] = { ...statuses[0], isInitial: true }
                onChange({ statuses, transitions: phase.transitions.filter((t) => t.from !== s.key && t.to !== s.key) })
              }}
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {editable &&
        (adding ? (
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
            className="h-6 w-28 rounded border border-brand-400 px-1.5 text-[11px] focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-500 hover:border-brand-400 hover:text-brand-700"
          >
            + Add status
          </button>
        ))}
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
    <section className="rounded-md border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-brand-50/30 px-5 py-4">
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-gray-900 font-mono text-xs font-semibold text-white">
            {index}
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-950">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {tag && <span className="rounded-sm border border-gray-200 bg-white px-2 py-1 font-mono text-[10px] text-gray-500">{tag}</span>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
