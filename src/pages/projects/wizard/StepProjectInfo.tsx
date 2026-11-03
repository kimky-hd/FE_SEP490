import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { CloseIcon, PlusIcon, TrashIcon, WorkflowIcon, BoltIcon } from '@/components/ui/icons'
import { Card } from '@/components/layout/PageParts'
import { blankPhase, newStatus, newTransition, type DraftPhase } from '@/lib/workflowDraft'
import type { SdlcMethod, SdlcTemplateDto } from '@/types/project'
import type { RoleDto } from '@/types/rbac'
import { useI18n } from '@/i18n'
import { templateDescription, templateName } from '@/i18n/sdlc'
import { DESCRIPTION_MAX, MAX_PHASES, NAME_MAX, type WizardState } from './wizardState'

// Bước 1: thông tin dự án + cách đội làm việc (SDLC) + các giai đoạn. Mã dự án (tiền tố issue) không đổi được sau khi tạo.

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

const fieldLabel = 'text-sm font-medium text-gray-900'
const inputBase =
  'w-full rounded-control border bg-white px-3 text-sm text-gray-900 shadow-xs placeholder:text-gray-500 transition-shadow focus:outline-none focus:ring-4 focus:ring-brand-100'
const inputOk = 'border-gray-300 focus:border-brand-400'
const inputBad = 'border-red-400 focus:border-red-500'

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
  const { t } = useI18n()
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

  return (
    <Card className="divide-y divide-gray-200">
      <SectionCard title={t('Thông tin dự án', 'Project details')}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label htmlFor="project-name" className={fieldLabel}>
                {t('Tên dự án', 'Project name')}{' '}
                <span className="text-red-700" aria-hidden="true">
                  *
                </span>
              </label>
            </div>
            <input
              id="project-name"
              value={state.name}
              maxLength={NAME_MAX + 20}
              placeholder={t('VD: Checkout một chạm', 'e.g. One-tap checkout')}
              aria-required="true"
              aria-describedby="project-name-meta"
              onChange={(e) => update({ name: e.target.value })}
              className={clsx(inputBase, 'h-11 lg:h-10', errors.name ? inputBad : inputOk)}
            />
            <div id="project-name-meta" className="mt-1.5 flex justify-between gap-3 text-xs">
              <span className="text-red-700">{errors.name}</span>
              <span className={clsx('tabular-nums', state.name.length > NAME_MAX ? 'text-red-700' : 'text-gray-500')}>
                {state.name.length}/{NAME_MAX}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label htmlFor="project-key" className={fieldLabel}>
                {t('Mã dự án', 'Project key')}{' '}
                <span className="text-red-700" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="text-xs text-gray-500">
                {t('2–10 chữ in hoa hoặc số', '2–10 uppercase letters or digits')}
              </span>
            </div>
            <div className="relative">
              <input
                id="project-key"
                value={state.key}
                maxLength={10}
                placeholder={t('VD: CORE', 'e.g. CORE')}
                aria-required="true"
                aria-describedby="project-key-meta"
                onChange={(e) =>
                  update({ key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''), keyTouched: true })
                }
                onBlur={onKeyBlur}
                className={clsx(
                  inputBase,
                  'h-11 pr-16 tabular-nums lg:h-10',
                  errors.key || keyCheck.state === 'taken' ? inputBad : inputOk,
                )}
              />
              {!state.keyTouched && state.key && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                  {t('Tự sinh', 'Auto')}
                </span>
              )}
            </div>
            <div id="project-key-meta" className="mt-1.5 space-y-0.5 text-xs" aria-live="polite">
              <p className="text-gray-500">
                {t('Mã issue:', 'Issue key:')}{' '}
                <code className="rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 font-sans tabular-nums text-gray-700">
                  {state.key || 'CORE'}-101
                </code>
                {' · '}
                {t('không đổi được sau khi tạo', "can't be changed later")}
              </p>
              {errors.key && <p className="text-red-700">{errors.key}</p>}
              {!errors.key && keyCheck.state === 'checking' && (
                <p className="text-gray-500">{t('Đang kiểm tra…', 'Checking…')}</p>
              )}
              {!errors.key && keyCheck.state === 'available' && (
                <p className="text-success-700">{t('Mã này dùng được', 'This key is available')}</p>
              )}
              {!errors.key && keyCheck.state === 'taken' && (
                <p className="text-red-700">
                  {t('Mã này đã có trong workspace.', 'This key is already used in the workspace.')}{' '}
                  {keyCheck.suggestion && (
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => update({ key: keyCheck.suggestion!, keyTouched: true })}
                    >
                      {t('Dùng', 'Use')} {keyCheck.suggestion}
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label htmlFor="project-description" className={fieldLabel}>
                {t('Mô tả', 'Description')}
              </label>
              <span className="text-xs text-gray-500">{t('Không bắt buộc', 'Optional')}</span>
            </div>
            <textarea
              id="project-description"
              rows={3}
              value={state.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder={t(
                'Mục tiêu, phạm vi và tiêu chuẩn bàn giao của dự án…',
                'Project goals, scope and delivery standards…',
              )}
              className={clsx(inputBase, 'resize-y py-2', errors.description ? inputBad : inputOk)}
            />
            <div className="mt-1.5 flex justify-between gap-3 text-xs">
              <span className="text-red-700">{errors.description}</span>
              <span
                className={clsx(
                  'tabular-nums',
                  state.description.length > DESCRIPTION_MAX ? 'text-red-700' : 'text-gray-500',
                )}
              >
                {state.description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t('Cách đội làm việc', 'How your team works')}
        subtitle={t(
          'Chọn một mẫu; các giai đoạn bên dưới vẫn sửa được.',
          'Pick a template; you can still edit the phases below.',
        )}
      >
        <div
          role="radiogroup"
          aria-label={t('Phương pháp SDLC', 'SDLC method')}
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          {templates.map((tpl) => {
            const selected = tpl.method === state.sdlcMethod
            return (
              <button
                key={tpl.method}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChooseMethod(tpl.method)}
                className={clsx(
                  'flex flex-col rounded-card border bg-white p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
                  selected ? 'border-brand-500 ring-4 ring-brand-100' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'h-4 w-4 shrink-0 rounded-full border',
                      selected ? 'border-[5px] border-brand-600 bg-white' : 'border-gray-300 bg-white',
                    )}
                  />
                  {templateName(tpl.method, tpl.name)}
                </span>
                <span className="mt-2 flex-1 text-sm text-gray-600">
                  {templateDescription(tpl.method, tpl.description)}
                </span>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500">
                  {tpl.phasesEditable ? <WorkflowIcon className="h-3.5 w-3.5" /> : <BoltIcon className="h-3.5 w-3.5" />}
                  {t(
                    `${tpl.phases.length} giai đoạn có sẵn${tpl.phasesEditable ? ', sửa được' : ''}`,
                    `${tpl.phases.length} built-in ${tpl.phases.length === 1 ? 'phase' : 'phases'}${tpl.phasesEditable ? ', editable' : ''}`,
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </SectionCard>

      {/* Các giai đoạn của dự án */}
      <SectionCard
        flush
        title={t('Các giai đoạn', 'Phases')}
        subtitle={t(
          'Issue đi qua các giai đoạn từ trên xuống. Trạng thái và luật chuyển chỉnh ở bước 2.',
          'Issues move through phases top to bottom. Statuses and transitions are set in step 2.',
        )}
      >
        <div className="md:overflow-x-auto">
          <table className="w-full text-sm md:min-w-[760px]">
            <thead className="hidden md:table-header-group">
              <tr className="border-y border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="w-32 py-2.5 pl-6 pr-3 font-medium">{t('Thứ tự', 'Order')}</th>
                <th className="w-56 px-3 py-2.5 font-medium">{t('Tên giai đoạn', 'Phase name')}</th>
                <th className="px-3 py-2.5 font-medium">{t('Mô tả', 'Description')}</th>
                <th className="px-3 py-2.5 font-medium">{t('Trạng thái', 'Statuses')}</th>
                {editable && <th className="w-14 px-3 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-t border-gray-200 md:border-t-0">
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
                      'flex flex-wrap items-center gap-x-2 gap-y-2 px-5 py-3 transition-colors md:table-row md:p-0 md:align-top',
                      isDragging && 'bg-gray-50 opacity-40',
                      isDragOver && !isDragging && 'bg-brand-50/60 shadow-[inset_0_2px_0_0_#2f5bea]',
                    )}
                  >
                    <td className="md:py-3 md:pl-6 md:pr-3">
                      <div className="flex items-center gap-1.5">
                        {editable && (
                          <span
                            title={t('Kéo thả để đổi thứ tự giai đoạn', 'Drag to reorder phases')}
                            aria-hidden="true"
                            className="cursor-grab select-none px-0.5 text-xs text-gray-400 hover:text-gray-700 active:cursor-grabbing"
                          >
                            ⋮⋮
                          </span>
                        )}
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold tabular-nums text-gray-600">
                          {index + 1}
                        </span>
                        {editable && (
                          <span className="flex text-[10px] leading-none text-gray-500">
                            <button
                              type="button"
                              aria-label={t(`Đưa giai đoạn ${index + 1} lên`, `Move phase ${index + 1} up`)}
                              className="flex h-7 w-6 items-center justify-center rounded-control hover:bg-gray-100 hover:text-gray-950"
                              onClick={() => movePhase(index, -1)}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              aria-label={t(`Đưa giai đoạn ${index + 1} xuống`, `Move phase ${index + 1} down`)}
                              className="flex h-7 w-6 items-center justify-center rounded-control hover:bg-gray-100 hover:text-gray-950"
                              onClick={() => movePhase(index, 1)}
                            >
                              ▼
                            </button>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="min-w-0 flex-1 md:px-3 md:py-3">
                      {editable ? (
                        <input
                          aria-label={t(`Tên giai đoạn ${index + 1}`, `Phase ${index + 1} name`)}
                          value={phase.name}
                          onChange={(e) => updatePhase(phase.key, { name: e.target.value })}
                          className={clsx(inputBase, 'h-9', inputOk)}
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{phase.name}</span>
                      )}
                    </td>
                    <td className="w-full md:w-auto md:px-3 md:py-3">
                      {editable ? (
                        <input
                          aria-label={t(`Mô tả giai đoạn ${index + 1}`, `Phase ${index + 1} description`)}
                          value={phase.description ?? ''}
                          placeholder={t('Không bắt buộc', 'Optional')}
                          onChange={(e) => updatePhase(phase.key, { description: e.target.value || null })}
                          className={clsx(inputBase, 'h-9', inputOk)}
                        />
                      ) : (
                        <span className="text-gray-500">{phase.description}</span>
                      )}
                    </td>
                    <td className="min-w-0 flex-1 md:w-auto md:px-3 md:py-3.5">
                      <StatusChips
                        phase={phase}
                        editable={false}
                        projectRoles={projectRoles}
                        onChange={(next) => updatePhase(phase.key, next)}
                      />
                    </td>
                    {editable && (
                      <td className="ml-auto md:ml-0 md:px-3 md:py-3 md:text-right">
                        <button
                          type="button"
                          aria-label={t(`Xoá giai đoạn ${phase.name}`, `Delete phase ${phase.name}`)}
                          disabled={state.phases.length <= 1}
                          onClick={() => setPhases(state.phases.filter((p) => p.key !== phase.key))}
                          className="rounded-control p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3 sm:px-6">
          <Button
            type="button"
            variant="secondary"
            inline
            className="lg:!h-8"
            disabled={state.phases.length >= MAX_PHASES}
            onClick={() =>
              setPhases([
                ...state.phases,
                blankPhase(t(`Giai đoạn ${state.phases.length + 1}`, `Phase ${state.phases.length + 1}`), projectRoles),
              ])
            }
          >
            <PlusIcon className="h-4 w-4" /> {t('Thêm giai đoạn', 'Add phase')}
          </Button>
          <span aria-live="polite" className={clsx('text-sm', errors.phases ? 'text-red-700' : 'text-gray-500')}>
            {errors.phases ??
              t(
                `${state.phases.length} giai đoạn`,
                `${state.phases.length} ${state.phases.length === 1 ? 'phase' : 'phases'}`,
              )}
          </span>
        </div>
      </SectionCard>
    </Card>
  )
}

// Cột "Trạng thái trong giai đoạn": chip trạng thái + ô thêm trạng thái. Chi tiết (nhóm, trạng thái đầu, luật
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
  const { t } = useI18n()
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
      ? [
          ...phase.transitions,
          newTransition(
            last.key,
            status.key,
            projectRoles.map((r) => r.roleId),
          ),
        ]
      : phase.transitions
    onChange({ statuses: [...phase.statuses, status], transitions })
    setValue('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map((s) => (
        <span
          key={s.key}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
          {s.name || t('(chưa đặt tên)', '(unnamed)')}
          {editable && active.length > 1 && (
            <button
              type="button"
              aria-label={t(`Bỏ trạng thái ${s.name}`, `Remove status ${s.name}`)}
              className="text-gray-500 hover:text-red-700"
              onClick={() => {
                const statuses = phase.statuses.filter((x) => x.key !== s.key)
                if (s.isInitial && statuses.length > 0) statuses[0] = { ...statuses[0], isInitial: true }
                onChange({ statuses, transitions: phase.transitions.filter((x) => x.from !== s.key && x.to !== s.key) })
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
            aria-label={t('Tên trạng thái mới', 'New status name')}
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
            className="h-7 w-32 rounded-control border border-brand-400 px-2 text-xs ring-4 ring-brand-100 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand-400 hover:text-brand-700"
          >
            {t('+ Thêm trạng thái', '+ Add status')}
          </button>
        ))}
    </div>
  )
}

// Một phần trong thẻ của bước (các phần ngăn bằng đường kẻ, không lồng thẻ trong thẻ).
export function SectionCard({
  title,
  subtitle,
  flush,
  children,
}: {
  title: string
  subtitle?: string
  /** Thân không có lề (bảng tràn hết chiều ngang thẻ). */
  flush?: boolean
  children: ReactNode
}) {
  return (
    <section>
      <div className={clsx('px-5 pt-5 sm:px-6', flush ? 'pb-4' : 'pb-0')}>
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className={flush ? undefined : 'px-5 pb-6 pt-4 sm:px-6'}>{children}</div>
    </section>
  )
}
