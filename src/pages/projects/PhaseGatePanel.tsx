import { useEffect, useId, useState } from 'react'
import clsx from 'clsx'
import { Card } from '@/components/layout/PageParts'
import { SectionBar } from '@/components/layout/tabParts'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { CheckIcon, CloseIcon, PencilIcon, SyncIcon } from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDateTime } from '@/lib/format'
import { GATE_CRITERIA, normalizeGates, type GateCriterion } from '@/lib/phaseGates'
import { allGatesMet, type GateResult, type GateState, type PhaseLifecycle } from '@/lib/phaseGateEval'
import type { PhaseDto, PhaseLifecycleStatus, WorkflowDto } from '@/types/project'
import { useI18n } from '@/i18n'
import { GateChips } from './GateChips'

// Khối "Điều kiện hoàn thành giai đoạn" của phase đang chọn ở tab Workflow: sửa điều kiện (PATCH §12.3), checklist
// đạt / chưa đạt / không kiểm được, và chốt giai đoạn (§12.6 — đề xuất, sau cờ FEATURES.phaseLifecycle).
// Khác bản đề xuất của BA: testcase FAIL không được tính là đạt (xem lib/phaseGateEval.ts).

export function lifecycleLabel(status: PhaseLifecycleStatus, t: (vi: string, en: string) => string) {
  return status === 'COMPLETED'
    ? t('Đã xong', 'Completed')
    : status === 'ACTIVE'
      ? t('Đang chạy', 'In progress')
      : t('Sắp tới', 'Upcoming')
}

export const lifecycleTone = (status: PhaseLifecycleStatus) =>
  status === 'COMPLETED' ? 'success' : status === 'ACTIVE' ? 'blue' : 'neutral'

const STATE_STYLE: Record<GateState, { box: string; text: string }> = {
  MET: { box: 'bg-success-50 text-success-700 border-success-200', text: 'text-gray-950' },
  UNMET: { box: 'bg-red-50 text-red-700 border-red-200', text: 'text-gray-950' },
  UNKNOWN: { box: 'bg-gray-50 text-gray-500 border-gray-200', text: 'text-gray-700' },
}

type ActionMode = 'complete' | 'override' | 'reopen'

export function PhaseGatePanel({
  projectId,
  phase,
  lifecycle,
  results,
  isEvaluating,
  canManage,
  lifecycleActions,
  canReopen,
  onReevaluate,
  onChanged,
}: {
  projectId: number
  phase: PhaseDto
  /** undefined = phase đã tắt (không nằm trong tiến độ). */
  lifecycle: PhaseLifecycle | undefined
  /** null = đang tải dữ liệu kiểm lần đầu. */
  results: GateResult[] | null
  isEvaluating: boolean
  canManage: boolean
  /** Cờ FEATURES.phaseLifecycle (BE đã có §12.6). */
  lifecycleActions: boolean
  canReopen: boolean
  onReevaluate: () => void
  onChanged: (next: WorkflowDto, message: string, tone?: 'success' | 'warning') => Promise<void>
}) {
  const { t } = useI18n()
  const criteria = normalizeGates(phase.exitCriteria)
  const [draft, setDraft] = useState<GateCriterion[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<ActionMode | null>(null)

  // Đổi phase đang chọn → bỏ bản nháp.
  useEffect(() => {
    setDraft(null)
    setError(null)
  }, [phase.phaseId])

  const saveCriteria = async () => {
    if (!draft) return
    setIsSaving(true)
    setError(null)
    try {
      const next = await projectApi.updatePhase(projectId, phase.phaseId, { exitCriteria: draft })
      const saved = next.phases.find((p) => p.phaseId === phase.phaseId)
      setDraft(null)
      // BE chưa hỗ trợ trường (§9.2 đề xuất) thì trả về không có exitCriteria — báo thật, không giả là đã lưu.
      if (saved && saved.exitCriteria === undefined)
        await onChanged(
          next,
          t(
            'Máy chủ chưa lưu điều kiện hoàn thành (API chưa hỗ trợ trường exitCriteria).',
            'The server did not store the exit criteria (the API does not support exitCriteria yet).',
          ),
          'warning',
        )
      else
        await onChanged(
          next,
          t(`Đã lưu điều kiện hoàn thành của “${phase.name}”.`, `Saved exit criteria for “${phase.name}”.`),
        )
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const status = lifecycle?.status
  const allMet = results !== null && allGatesMet(results)
  const metCount = results?.filter((r) => r.state === 'MET').length ?? 0

  return (
    <section className="space-y-3" aria-labelledby={`gate-${phase.phaseId}`}>
      <SectionBar
        title={<span id={`gate-${phase.phaseId}`}>{t('Điều kiện hoàn thành', 'Exit criteria')}</span>}
        caption={phase.name}
        help={t(
          'Các điều kiện phải đạt trước khi giai đoạn được coi là xong và chuyển sang giai đoạn sau. Chỉ “Issue đã xong” tính riêng theo giai đoạn; các điều kiện khác tính trên cả dự án.',
          'Conditions to meet before the phase counts as done and the next phase starts. Only “Issues done” is per phase; the others apply to the whole project.',
        )}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              inline
              disabled={isEvaluating}
              onClick={onReevaluate}
              aria-label={t('Kiểm lại điều kiện', 'Re-check criteria')}
            >
              <SyncIcon className={clsx('h-4 w-4', isEvaluating && 'animate-spin')} />
              <span className="hidden sm:inline">{t('Kiểm lại', 'Re-check')}</span>
            </Button>
            {canManage && draft === null && (
              <Button type="button" variant="secondary" inline onClick={() => setDraft(criteria)}>
                <PencilIcon className="h-4 w-4" /> {t('Sửa điều kiện', 'Edit criteria')}
              </Button>
            )}
          </>
        }
      />

      <Card className="divide-y divide-gray-200">
        {/* Trạng thái tiến độ + thông tin chốt */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
          {status ? (
            <Badge tone={lifecycleTone(status)} dot>
              {lifecycleLabel(status, t)}
            </Badge>
          ) : (
            <Badge>{t('Đã tắt', 'Disabled')}</Badge>
          )}
          {criteria.length > 0 && results && (
            <span className="text-gray-600">
              {t(`${metCount}/${criteria.length} điều kiện đạt`, `${metCount}/${criteria.length} criteria met`)}
            </span>
          )}
          {status === 'COMPLETED' && phase.completedAt && (
            <span className="text-gray-500">
              {t('Hoàn tất', 'Completed')} {formatDateTime(phase.completedAt)}
              {phase.completedBy && ` · ${phase.completedBy.fullName}`}
            </span>
          )}
        </div>
        {status === 'COMPLETED' && phase.overrideReason && (
          <div className="px-4 py-3 text-sm">
            <span className="font-medium text-amber-800">{t('Chuyển có lý do (Override): ', 'Override reason: ')}</span>
            <span className="text-gray-700">{phase.overrideReason}</span>
          </div>
        )}

        {draft !== null ? (
          <div className="space-y-3 px-4 py-4">
            {error && <Alert tone="error">{error}</Alert>}
            <GateChips criteria={draft} editable onChange={setDraft} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" inline onClick={() => setDraft(null)}>
                {t('Huỷ', 'Cancel')}
              </Button>
              <Button
                type="button"
                inline
                isLoading={isSaving}
                disabled={draft.join() === criteria.join()}
                onClick={() => void saveCriteria()}
              >
                {t('Lưu điều kiện', 'Save criteria')}
              </Button>
            </div>
          </div>
        ) : criteria.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            {t('Giai đoạn này không đặt điều kiện hoàn thành.', 'This phase has no exit criteria.')}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100" aria-busy={results === null}>
            {criteria.map((c) => {
              const r = results?.find((x) => x.criterion === c)
              return <GateRow key={c} criterion={c} result={r} />
            })}
          </ul>
        )}

        {/* Chốt giai đoạn: cần BE §12.6 — tắt cờ thì chỉ xem checklist. */}
        {canManage && status && draft === null && (
          <div className="flex flex-wrap items-center justify-end gap-2 bg-gray-50 px-4 py-3">
            {!lifecycleActions ? (
              <p className="mr-auto text-xs text-gray-500">
                {t(
                  'Chốt / mở lại giai đoạn sẽ bật khi máy chủ có API tiến độ giai đoạn.',
                  'Completing / reopening phases turns on once the server has the phase progress API.',
                )}
              </p>
            ) : status === 'ACTIVE' ? (
              <>
                {!allMet && results !== null && (
                  <Button type="button" variant="secondary" inline onClick={() => setAction('override')}>
                    {t('Chuyển giai đoạn có lý do', 'Advance with reason')}
                  </Button>
                )}
                <Button
                  type="button"
                  inline
                  disabled={!allMet}
                  title={
                    allMet
                      ? undefined
                      : t(
                          'Cần đạt mọi điều kiện (hoặc chuyển có lý do).',
                          'All criteria must be met (or advance with a reason).',
                        )
                  }
                  onClick={() => setAction('complete')}
                >
                  <CheckIcon className="h-4 w-4" /> {t('Hoàn tất giai đoạn', 'Complete phase')}
                </Button>
              </>
            ) : status === 'COMPLETED' && canReopen ? (
              <Button type="button" variant="secondary" inline onClick={() => setAction('reopen')}>
                {t('Mở lại giai đoạn', 'Reopen phase')}
              </Button>
            ) : (
              <p className="mr-auto text-xs text-gray-500">
                {status === 'UPCOMING'
                  ? t('Giai đoạn bắt đầu khi giai đoạn trước hoàn tất.', 'Starts once the previous phase is completed.')
                  : t(
                      'Chỉ mở lại được giai đoạn vừa xong gần nhất.',
                      'Only the most recently completed phase can be reopened.',
                    )}
              </p>
            )}
          </div>
        )}
      </Card>

      {action && (
        <PhaseActionModal
          mode={action}
          projectId={projectId}
          phase={phase}
          unmet={(results ?? []).filter((r) => r.state !== 'MET')}
          onClose={() => setAction(null)}
          onDone={async (next, message) => {
            setAction(null)
            await onChanged(next, message)
          }}
        />
      )}
    </section>
  )
}

function GateRow({ criterion, result }: { criterion: GateCriterion; result: GateResult | undefined }) {
  const { t } = useI18n()
  const info = GATE_CRITERIA[criterion]
  const state = result?.state
  const stateLabel =
    state === 'MET'
      ? t('Đạt', 'Met')
      : state === 'UNMET'
        ? t('Chưa đạt', 'Not met')
        : state === 'UNKNOWN'
          ? t('Không kiểm được', 'Cannot check')
          : t('Đang kiểm', 'Checking')
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={clsx(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
          state ? STATE_STYLE[state].box : 'border-gray-200 bg-white text-gray-400',
        )}
        role="img"
        aria-label={stateLabel}
        title={stateLabel}
      >
        {state === 'MET' ? (
          <CheckIcon className="h-3 w-3" />
        ) : state === 'UNMET' ? (
          <CloseIcon className="h-3 w-3" />
        ) : state === 'UNKNOWN' ? (
          '?'
        ) : (
          <span className="h-2.5 w-2.5 animate-spin rounded-full border border-gray-400 border-t-transparent" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx('text-sm font-medium', state ? STATE_STYLE[state].text : 'text-gray-700')}>{info.label()}</p>
        <p className="mt-0.5 text-xs text-gray-500">{result?.detail ?? info.description()}</p>
      </div>
    </li>
  )
}

function PhaseActionModal({
  mode,
  projectId,
  phase,
  unmet,
  onClose,
  onDone,
}: {
  mode: ActionMode
  projectId: number
  phase: PhaseDto
  unmet: GateResult[]
  onClose: () => void
  onDone: (next: WorkflowDto, message: string) => Promise<void>
}) {
  const { t } = useI18n()
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reasonRequired = mode === 'override'
  const reasonMissing = reasonRequired && reason.trim() === ''

  const submit = async () => {
    setTouched(true)
    if (reasonMissing) return
    setIsSaving(true)
    setError(null)
    try {
      if (mode === 'reopen') {
        const next = await projectApi.reopenPhase(projectId, phase.phaseId, { reason: reason.trim() || undefined })
        await onDone(next, t(`Đã mở lại giai đoạn “${phase.name}”.`, `Reopened phase “${phase.name}”.`))
      } else {
        const next = await projectApi.completePhase(
          projectId,
          phase.phaseId,
          mode === 'override' ? { overrideReason: reason.trim() } : {},
        )
        await onDone(next, t(`Đã hoàn tất giai đoạn “${phase.name}”.`, `Completed phase “${phase.name}”.`))
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const title =
    mode === 'complete'
      ? t(`Hoàn tất giai đoạn “${phase.name}”?`, `Complete phase “${phase.name}”?`)
      : mode === 'override'
        ? t(`Chuyển giai đoạn “${phase.name}” có lý do`, `Advance phase “${phase.name}” with a reason`)
        : t(`Mở lại giai đoạn “${phase.name}”?`, `Reopen phase “${phase.name}”?`)

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      tone={mode === 'override' ? 'danger' : 'default'}
      footer={
        <>
          <Button type="button" variant="secondary" inline onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button
            type="button"
            inline
            isLoading={isSaving}
            disabled={touched && reasonMissing}
            onClick={() => void submit()}
          >
            {mode === 'reopen'
              ? t('Mở lại', 'Reopen')
              : mode === 'override'
                ? t('Chuyển giai đoạn', 'Advance phase')
                : t('Hoàn tất', 'Complete')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-gray-700">
          {mode === 'reopen'
            ? t(
                'Giai đoạn này chạy lại; giai đoạn đang chạy sau nó trở về “Sắp tới”.',
                'This phase becomes active again; the phase after it goes back to “Upcoming”.',
              )
            : t(
                'Giai đoạn này chuyển sang “Đã xong” và giai đoạn kế tiếp bắt đầu.',
                'This phase moves to “Completed” and the next phase starts.',
              )}
        </p>
        {mode === 'override' && unmet.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-900">{t('Điều kiện chưa đạt', 'Criteria not met')}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {unmet.map((r) => (
                <li key={r.criterion}>
                  {GATE_CRITERIA[r.criterion].label()} — <span className="text-gray-500">{r.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {mode !== 'complete' && (
          <TextAreaField
            id={reasonId}
            label={mode === 'override' ? t('Lý do *', 'Reason *') : t('Ghi chú', 'Note')}
            value={reason}
            maxLength={1000}
            required={reasonRequired}
            aria-required={reasonRequired || undefined}
            placeholder={
              mode === 'override'
                ? t('Vì sao chuyển giai đoạn khi chưa đạt hết điều kiện?', 'Why advance before all criteria are met?')
                : t('Không bắt buộc', 'Optional')
            }
            error={
              touched && reasonMissing ? t('Nhập lý do để chuyển giai đoạn.', 'Enter a reason to advance.') : undefined
            }
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        )}
      </div>
    </Modal>
  )
}
