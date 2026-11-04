import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import {
  CheckIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  WorkflowIcon,
} from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { onDataChanged } from '@/lib/dataEvents'
import { useI18n } from '@/i18n'
import { templateName } from '@/i18n/sdlc'
import type { PhaseDto } from '@/types/project'
import {
  evaluateProjectPhases,
  completeAndAdvancePhase,
  overrideGateAndAdvancePhase,
  reopenPhase,
  type PhaseEvaluationResult,
} from '@/lib/phaseGateEngine'

interface Props {
  projectId: number
  phases?: PhaseDto[]
  sdlcMethod?: string
  className?: string
  compact?: boolean
}

export function PhasePipelineTracker({
  projectId,
  phases: propPhases,
  sdlcMethod,
  className,
}: Props) {
  const { t, lang } = useI18n()
  const isVi = lang === 'vi'
  const [dataVersion, setDataVersion] = useState(0)

  // Tự động lắng nghe dataEvents để cập nhật tức thì mọi thay đổi
  useEffect(() => {
    const unsub = onDataChanged(() => setDataVersion((v) => v + 1))
    return unsub
  }, [])

  // Nếu không truyền phases qua prop thì tự fetch workflow của dự án
  const workflowQ = useAsync(
    () => (!propPhases ? projectApi.workflow(projectId) : Promise.resolve(null)),
    [projectId, propPhases, dataVersion],
  )

  const phases = propPhases ?? workflowQ.data?.phases ?? []
  const currentSdlc = sdlcMethod ?? workflowQ.data?.sdlcMethod ?? 'SCRUM'

  // Đánh giá dữ liệu cổng nghiệm thu cho tất cả các Phase
  const evaluations: PhaseEvaluationResult[] = evaluateProjectPhases(projectId, phases, isVi)

  const activePhase =
    evaluations.find((e) => e.lifecycleStatus === 'active') ??
    evaluations[0] ??
    null

  const [inspectingPhaseKey, setInspectingPhaseKey] = useState<string | null>(null)
  const inspectedPhase = evaluations.find((e) => e.phaseKey === inspectingPhaseKey) ?? null

  if (evaluations.length === 0) return null

  return (
    <Card className={clsx('overflow-hidden border-brand-200 bg-white shadow-xs', className)}>
      {/* Thanh Header Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-brand-50/40 via-white to-gray-50/40 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-control bg-brand-600 text-white shadow-xs">
            <WorkflowIcon className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {t('Tiến độ quy trình & Cổng nghiệm thu (SDLC Gates)', 'SDLC Phase Pipeline & Gate Tracker')}
              </h2>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                {templateName(currentSdlc, currentSdlc)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {t(
                'Kiểm soát tự động các tiêu chí hoàn thành trước khi chuyển giao giữa các giai đoạn dự án.',
                'Automated phase gates verifying quality baseline before advancing delivery phases.',
              )}
            </p>
          </div>
        </div>

        {activePhase && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              inline
              className="!h-8 !px-3 text-xs shadow-xs"
              onClick={() => setInspectingPhaseKey(activePhase.phaseKey)}
            >
              <span>{t('Nghiệm thu cổng giai đoạn', 'Verify Gate & Advance')}</span>
              <ArrowRightIcon className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Stepper Pipeline */}
      <div className="overflow-x-auto p-4 md:p-5">
        <div className="flex items-stretch gap-3 min-w-[720px]">
          {evaluations.map((phaseEval) => {
            const isCompleted = phaseEval.lifecycleStatus === 'completed'
            const isActive = phaseEval.lifecycleStatus === 'active'
            const isUpcoming = phaseEval.lifecycleStatus === 'upcoming'

            return (
              <div
                key={phaseEval.phaseKey}
                onClick={() => setInspectingPhaseKey(phaseEval.phaseKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setInspectingPhaseKey(phaseEval.phaseKey)
                  }
                }}
                className={clsx(
                  'group relative flex flex-1 flex-col rounded-card border p-3.5 text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-400',
                  isActive &&
                    'border-brand-500 bg-brand-50/20 shadow-xs ring-2 ring-brand-100 hover:border-brand-600',
                  isCompleted &&
                    'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300 hover:bg-emerald-50/50',
                  isUpcoming && 'border-gray-200 bg-gray-50/50 opacity-80 hover:border-gray-300 hover:bg-white',
                )}
              >
                {/* Dòng trạng thái trên cùng */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Icon bước */}
                    <span
                      className={clsx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        isCompleted && 'bg-emerald-600 text-white',
                        isActive && 'bg-brand-600 text-white shadow-xs',
                        isUpcoming && 'bg-gray-200 text-gray-600',
                      )}
                    >
                      {isCompleted ? <CheckIcon className="h-3.5 w-3.5 stroke-[3]" /> : phaseEval.position}
                    </span>

                    {/* Badge trạng thái */}
                    {isCompleted && (
                      <Badge tone="success" dot>
                        {t('Hoàn tất', 'Completed')}
                      </Badge>
                    )}
                    {isActive && (
                      <Badge tone="blue" dot>
                        {t('Đang chạy', 'Active')}
                      </Badge>
                    )}
                    {isUpcoming && <span className="text-[11px] text-gray-500">{t('Sắp tới', 'Upcoming')}</span>}
                  </div>

                  {/* Phần trăm sẵn sàng */}
                  {isActive && (
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                        phaseEval.isReadyToComplete
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {phaseEval.readinessPercent}% Gate
                    </span>
                  )}
                </div>

                {/* Tên Phase */}
                <div className="mt-2.5 font-semibold text-gray-900 group-hover:text-brand-700 text-sm line-clamp-1">
                  {phaseEval.phaseName}
                </div>

                {/* Thanh tiến độ nhỏ cho Active Phase */}
                {isActive && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={clsx(
                        'h-full transition-all duration-300',
                        phaseEval.isReadyToComplete ? 'bg-emerald-500' : 'bg-brand-500',
                      )}
                      style={{ width: `${phaseEval.readinessPercent}%` }}
                    />
                  </div>
                )}

                {/* Các chip tiêu chuẩn rút gọn */}
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {phaseEval.criteriaResults.slice(0, 3).map((crit) => (
                    <span
                      key={crit.key}
                      title={`${crit.label}: ${crit.currentText}`}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border',
                        crit.passed
                          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                          : 'border-amber-200 bg-amber-50/80 text-amber-800',
                      )}
                    >
                      {crit.passed ? (
                        <CheckIcon className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <AlertTriangleIcon className="h-3 w-3 text-amber-600" />
                      )}
                      <span className="truncate max-w-[100px]">{crit.shortLabel}</span>
                    </span>
                  ))}
                  {phaseEval.criteriaResults.length > 3 && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                      +{phaseEval.criteriaResults.length - 3}
                    </span>
                  )}
                </div>

                {/* Ghi chú hoàn tất (nếu có) */}
                {isCompleted && phaseEval.completionNote && (
                  <div className="mt-2 text-[11px] italic text-gray-500 line-clamp-1">
                    {phaseEval.completionNote}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Verification Modal */}
      {inspectedPhase && (
        <PhaseGateVerificationModal
          projectId={projectId}
          phaseEval={inspectedPhase}
          allPhases={phases}
          onClose={() => setInspectingPhaseKey(null)}
          onSuccess={() => {
            setInspectingPhaseKey(null)
            setDataVersion((v) => v + 1)
          }}
        />
      )}
    </Card>
  )
}

/** Hộp thoại Kiểm tra Cổng Nghiệm thu Giai đoạn */
interface ModalProps {
  projectId: number
  phaseEval: PhaseEvaluationResult
  allPhases: (PhaseDto | any)[]
  onClose: () => void
  onSuccess: () => void
}

function PhaseGateVerificationModal({
  projectId,
  phaseEval,
  allPhases,
  onClose,
  onSuccess,
}: ModalProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [overrideReason, setOverrideReason] = useState('')
  const [showOverrideInput, setShowOverrideInput] = useState(false)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCompleted = phaseEval.lifecycleStatus === 'completed'
  const isActive = phaseEval.lifecycleStatus === 'active'

  const handleComplete = () => {
    setIsSubmitting(true)
    try {
      completeAndAdvancePhase(projectId, phaseEval.phaseKey, allPhases, note)
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOverride = () => {
    if (!overrideReason.trim()) return
    setIsSubmitting(true)
    try {
      overrideGateAndAdvancePhase(projectId, phaseEval.phaseKey, allPhases, overrideReason)
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReopen = () => {
    setIsSubmitting(true)
    try {
      reopenPhase(projectId, phaseEval.phaseKey, allPhases)
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t(
        `Cổng nghiệm thu giai đoạn: ${phaseEval.phaseName}`,
        `Phase Gate Verification: ${phaseEval.phaseName}`,
      )}
      description={t(
        `Giai đoạn ${phaseEval.position} / ${allPhases.length} · Trạng thái: ${
          isCompleted ? 'Đã hoàn tất' : isActive ? 'Đang thực hiện' : 'Sắp tới'
        }`,
        `Phase ${phaseEval.position} of ${allPhases.length} · Status: ${
          isCompleted ? 'Completed' : isActive ? 'Active' : 'Upcoming'
        }`,
      )}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div>
            {isCompleted && (
              <Button
                type="button"
                variant="secondary"
                inline
                onClick={handleReopen}
                isLoading={isSubmitting}
                className="text-amber-700 hover:bg-amber-50 border-amber-300"
              >
                {t('Mở lại giai đoạn này (Reopen)', 'Reopen This Phase')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" inline onClick={onClose}>
              {t('Đóng', 'Close')}
            </Button>

            {isActive && phaseEval.isReadyToComplete && (
              <Button
                type="button"
                variant="primary"
                inline
                isLoading={isSubmitting}
                onClick={handleComplete}
                className="!bg-emerald-600 hover:!bg-emerald-700"
              >
                <CheckIcon className="mr-1.5 h-4 w-4" />
                {t('Xác nhận hoàn tất & Chuyển Phase →', 'Confirm & Advance Phase →')}
              </Button>
            )}

            {isActive && !phaseEval.isReadyToComplete && (
              <Button
                type="button"
                variant="secondary"
                inline
                onClick={() => setShowOverrideInput(!showOverrideInput)}
                className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              >
                <AlertTriangleIcon className="mr-1.5 h-4 w-4 text-amber-700" />
                {t('Chuyển giai đoạn có ghi chú (Override)', 'Override Gate & Advance')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Thanh trạng thái tổng quan */}
        <div className="rounded-card border border-gray-200 bg-gray-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('Mức độ sẵn sàng cổng nghiệm thu', 'Gate Readiness')}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-gray-900">
                  {phaseEval.readinessPercent}%
                </span>
                <span className="text-xs text-gray-500">
                  ({phaseEval.passedCount}/{phaseEval.totalCount} {t('tiêu chí đạt chuẩn', 'criteria passed')})
                </span>
              </div>
            </div>

            <div>
              {phaseEval.isReadyToComplete ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
                  <CheckIcon className="h-4 w-4 text-emerald-600" />
                  {t('Sẵn sàng bàn giao', 'Ready to Advance')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-2xs">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                  {t('Còn tiêu chí chưa đạt', 'Pending Criteria')}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={clsx(
                'h-full transition-all duration-300',
                phaseEval.isReadyToComplete ? 'bg-emerald-500' : 'bg-brand-500',
              )}
              style={{ width: `${phaseEval.readinessPercent}%` }}
            />
          </div>
        </div>

        {/* Bảng checklist chi tiết */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2.5">
            {t('Checklist Tiêu chuẩn Cổng nghiệm thu (Exit Criteria)', 'Gate Exit Criteria Checklist')}
          </h4>

          <div className="divide-y divide-gray-200 rounded-card border border-gray-200 bg-white">
            {phaseEval.criteriaResults.map((crit) => (
              <div
                key={crit.key}
                className="flex flex-wrap items-start justify-between gap-3 p-3.5 transition-colors hover:bg-gray-50/80"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                      crit.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {crit.passed ? (
                      <CheckIcon className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                      <AlertTriangleIcon className="h-4 w-4 stroke-[2]" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{crit.label}</span>
                      <span
                        className={clsx(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium border tabular-nums',
                          crit.passed
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800',
                        )}
                      >
                        {crit.currentText}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{crit.description}</p>
                  </div>
                </div>

                {!crit.passed && (
                  <Button
                    type="button"
                    variant="secondary"
                    inline
                    className="!h-7 !px-2.5 !text-xs shrink-0"
                    onClick={() => {
                      onClose()
                      navigate(crit.actionUrl)
                    }}
                  >
                    <span>{t('Xử lý ngay →', 'Go to Fix →')}</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Khung ghi chú khi sẵn sàng hoàn tất */}
        {isActive && phaseEval.isReadyToComplete && (
          <div className="rounded-card border border-emerald-200 bg-emerald-50/50 p-3">
            <label className="block text-xs font-medium text-emerald-900 mb-1">
              {t('Ghi chú nghiệm thu hoàn thành (tuỳ chọn):', 'Completion note (optional):')}
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(
                'Ví dụ: Đã nghiệm thu đầy đủ các tiêu chí đầu ra của giai đoạn...',
                'e.g. All gate exit criteria met and approved...',
              )}
              className="h-8 w-full rounded-control border border-emerald-300 bg-white px-2.5 text-xs text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        )}

        {/* Khung nhập ghi chú ghi đè khi chưa đạt điều kiện */}
        {showOverrideInput && (
          <div className="rounded-card border border-amber-300 bg-amber-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
              <span>
                {t('Xác nhận Chuyển giai đoạn có ghi chú (Gate Override)', 'Confirm Phase Gate Override')}
              </span>
            </div>
            <p className="text-xs text-amber-800">
              {t(
                'Một số tiêu chuẩn cổng chưa đạt. Bạn có thể cho phép giai đoạn tiếp tục bằng cách nhập lý do phê chuẩn từ Project Manager / Product Owner.',
                'Some criteria are not met. You may proceed by providing a formal reason or approval note.',
              )}
            </p>
            <textarea
              rows={2}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder={t(
                'Nhập lý do chuyển tiếp giai đoạn (bắt buộc, ví dụ: Đã đồng thuận chuyển sang Sprint 2 và bổ sung tài liệu sau)...',
                'Enter override reason (required, e.g. Approved by PM to proceed into development while specs are refined)...',
              )}
              className="w-full rounded-control border border-amber-300 bg-white p-2.5 text-xs text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                inline
                className="!h-7 !text-xs"
                onClick={() => setShowOverrideInput(false)}
              >
                {t('Huỷ', 'Cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                inline
                disabled={!overrideReason.trim()}
                isLoading={isSubmitting}
                className="!h-7 !text-xs !bg-amber-600 hover:!bg-amber-700"
                onClick={handleOverride}
              >
                {t('Xác nhận chuyển Phase', 'Confirm Override & Advance')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
