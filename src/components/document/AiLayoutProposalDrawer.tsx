import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { CloseIcon, AiSparkleIcon, CheckIcon, CopyIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

export interface AiLayoutProposalDrawerProps {
  open: boolean
  onClose: () => void
  reqCode?: string
  reqTitle?: string
  onAttachToReq?: (layoutData: typeof DEFAULT_LAYOUT_SPEC) => void
}

export const DEFAULT_LAYOUT_SPEC = {
  screen_code: 'SCR_OTP_VERIFY',
  screen_name: 'Xác thực giao dịch OTP',
  elements: [
    {
      element_id: 'txt_amount_display',
      type: 'Label',
      label: 'Số tiền giao dịch',
      data_source: 'REQ-014.3',
      rules: ['format_currency_vnd'],
    },
    {
      element_id: 'input_otp_code',
      type: 'TextInput',
      label: 'Mã xác thực OTP',
      max_length: 6,
      character_set: 'numeric',
      required: true,
    },
    {
      element_id: 'lbl_countdown',
      type: 'TimerLabel',
      label: 'Hiệu lực mã',
      default_value: '60s',
    },
    {
      element_id: 'btn_resend_otp',
      type: 'Button',
      label: 'Gửi lại mã OTP',
      enabled_after_seconds: 60,
    },
    {
      element_id: 'btn_submit_otp',
      type: 'Button',
      label: 'Xác nhận',
      action: 'TRIGGER_VERIFY',
    },
  ],
}

export function AiLayoutProposalDrawer({
  open,
  onClose,
  reqCode = 'REQ-014.3',
  reqTitle = 'Xác thực OTP cho giao dịch thanh toán trên 5.000.000 VNĐ',
  onAttachToReq,
}: AiLayoutProposalDrawerProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'wireframe' | 'json'>('wireframe')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [countdown, setCountdown] = useState(59)
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', ''])

  // Simulate countdown timer
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 59))
    }, 1000)
    return () => clearInterval(timer)
  }, [open])

  // Reset notification state when opened
  useEffect(() => {
    if (open) {
      setIsSaved(false)
      setIsCopied(false)
    }
  }, [open])

  if (!open) return null

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(DEFAULT_LAYOUT_SPEC, null, 2))
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleRegenerate = () => {
    setIsRegenerating(true)
    setTimeout(() => {
      setIsRegenerating(false)
      setOtpValues(['', '', '', '', '', ''])
      setCountdown(59)
    }, 600)
  }

  const handleSaveAndAttach = () => {
    setIsSaved(true)
    onAttachToReq?.(DEFAULT_LAYOUT_SPEC)
    setTimeout(() => {
      onClose()
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-950/20 backdrop-blur-[1px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside
          role="dialog"
          aria-modal="true"
          className="flex w-screen max-w-[520px] flex-col border-l border-gray-200 bg-white shadow-2xl focus:outline-none"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-gray-200 px-5 py-4">
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                  <AiSparkleIcon width={14} height={14} />
                </span>
                <h2 className="truncate text-base font-semibold text-gray-950">
                  {t('Khung giao diện mẫu', 'AI Layout Proposal')} —{' '}
                  <span className="font-mono text-sm text-brand-700">{reqCode}</span>
                </h2>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t(
                  'AI tự động phác thảo cấu trúc thành phần dựa trên mô tả yêu cầu',
                  'AI auto-sketched component structure based on requirement description',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              title={t('Đóng (Esc)', 'Close (Esc)')}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex shrink-0 border-b border-gray-200 bg-gray-50/60 px-5 pt-2">
            <div role="tablist" className="flex gap-2">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'wireframe'}
                onClick={() => setActiveTab('wireframe')}
                className={clsx(
                  'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                  activeTab === 'wireframe'
                    ? 'border-gray-950 text-gray-950 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                )}
              >
                {t('Khung phác thảo trực quan (Wireframe Preview)', 'Visual Wireframe Preview')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'json'}
                onClick={() => setActiveTab('json')}
                className={clsx(
                  'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                  activeTab === 'json'
                    ? 'border-gray-950 text-gray-950 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                )}
              >
                {t('Cấu trúc dữ liệu JSON (Canonical Spec)', 'JSON Canonical Spec')}
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {activeTab === 'wireframe' ? (
              <div className="space-y-4">
                {/* Context badge */}
                <div className="rounded-lg border border-gray-200/80 bg-gray-50/80 px-3 py-2 text-xs text-gray-600">
                  <div className="font-medium text-gray-800">{reqTitle}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    Mã màn hình: <code className="font-mono font-medium text-gray-700">SCR_OTP_VERIFY</code>
                  </div>
                </div>

                {/* Wireframe Card Mockup */}
                <div className="rounded-xl border border-gray-300/80 bg-[#F8FAFC] p-5 shadow-xs">
                  {/* Mockup Header */}
                  <div className="border-b border-gray-200/90 pb-3">
                    <h3 className="text-base font-bold text-gray-900">
                      {DEFAULT_LAYOUT_SPEC.screen_name}
                    </h3>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-800">
                      <span>{t('Giao dịch chuyển tiền:', 'Transfer amount:')}</span>
                      <span className="font-semibold text-blue-900">6.000.000 VNĐ</span>
                    </div>
                  </div>

                  {/* Mockup Form Fields */}
                  <div className="mt-4 space-y-4">
                    {/* Field 1: OTP Input */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-800">
                        {t('Mã xác thực OTP (*)', 'OTP Verification Code (*)')}
                      </label>
                      <div className="mt-2 flex items-center gap-2">
                        {[0, 1, 2, 3, 4, 5].map((idx) => (
                          <input
                            key={idx}
                            type="text"
                            maxLength={1}
                            value={otpValues[idx]}
                            onChange={(e) => {
                              const next = [...otpValues]
                              next[idx] = e.target.value
                              setOtpValues(next)
                            }}
                            placeholder="•"
                            className="h-10 w-10 rounded-md border border-gray-300 bg-white text-center font-mono text-base font-semibold text-gray-900 shadow-2xs transition focus:border-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-950/10"
                          />
                        ))}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          {t(`Gửi lại mã sau ${countdown}s`, `Resend code in ${countdown}s`)}
                        </span>
                        <span className="text-[11px] text-gray-400 font-mono">6 digits (numeric)</span>
                      </div>
                    </div>

                    {/* Field 2: Phone Input Readonly */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-800">
                        {t('Số điện thoại nhận mã', 'Recipient Phone Number')}
                      </label>
                      <input
                        type="text"
                        disabled
                        value="0987***321"
                        className="mt-1.5 h-9 w-full rounded-md border border-gray-200 bg-gray-100/90 px-3 font-mono text-xs text-gray-600 shadow-2xs cursor-not-allowed"
                      />
                      <span className="mt-1 block text-[11px] text-gray-400">
                        {t('Tự động liên kết theo số hồ sơ nhà đầu tư', 'Linked automatically to user profile')}
                      </span>
                    </div>

                    {/* Mockup Actions */}
                    <div className="pt-2 flex items-center gap-2.5">
                      <button
                        type="button"
                        className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-gray-950 px-4 text-xs font-medium text-white shadow-xs hover:bg-gray-800 transition active:scale-[0.99]"
                      >
                        {t('Xác nhận giao dịch', 'Confirm Transaction')}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 transition"
                      >
                        {t('Hủy bỏ', 'Cancel')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Annotation block */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    {t('Ghi chú phác thảo logic của BA', 'BA Logical Wireframe Note')}
                  </div>
                  <p className="mt-1 leading-relaxed text-blue-800/90 text-[11.5px]">
                    Khung giao diện gồm 5 phần tử lõi: Nhãn số tiền, 6 ô nhập OTP độc lập, đồng hồ đếm ngược 60s,
                    nút gửi lại mã và nút gửi lệnh. Phục vụ tự động đối chiếu với bản vẽ Figma thực tế.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Canonical JSON Format</span>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900 font-medium"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                    {isCopied ? t('Đã sao chép!', 'Copied!') : t('Sao chép JSON', 'Copy JSON')}
                  </button>
                </div>
                <pre className="max-h-[460px] overflow-auto rounded-lg border border-gray-200 bg-gray-900 p-3.5 font-mono text-[11.5px] leading-relaxed text-emerald-300 shadow-inner">
                  {JSON.stringify(DEFAULT_LAYOUT_SPEC, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Footer Drawer */}
          <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50/80 px-5 py-3">
            <button
              type="button"
              disabled={isRegenerating}
              onClick={handleRegenerate}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-800 shadow-2xs hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 disabled:opacity-60 transition"
            >
              <AiSparkleIcon
                className={clsx('h-3.5 w-3.5 text-gray-600', isRegenerating && 'animate-spin')}
              />
              {isRegenerating ? t('Đang tạo lại...', 'Regenerating...') : t('Tạo lại layout bằng AI', 'Regenerate layout')}
            </button>

            <button
              type="button"
              onClick={handleSaveAndAttach}
              disabled={isSaved}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gray-950 px-4 text-xs font-medium text-white shadow-xs hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 disabled:opacity-75 transition active:scale-[0.99]"
            >
              {isSaved ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  {t('Đã lưu & đính kèm!', 'Saved & Attached!')}
                </>
              ) : (
                t('Lưu & Đính kèm vào Yêu cầu', 'Save & Attach to Requirement')
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
