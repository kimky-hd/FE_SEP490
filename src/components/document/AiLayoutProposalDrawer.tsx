import { useState } from 'react'
import clsx from 'clsx'
import { CloseIcon, AiSparkleIcon, CheckIcon, CopyIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

export interface AiLayoutProposalDrawerProps {
  open: boolean
  onClose: () => void
  reqCode?: string
  reqTitle?: string
  onAttachToReq?: (layoutData: typeof SECURITIES_FEE_LAYOUT_SPEC) => void
}

export const SECURITIES_FEE_LAYOUT_SPEC = {
  layout_id: 'LAYOUT-014-FORM',
  document_code: 'SRS-014',
  screen_name: 'Form Thiết lập gói biểu phí môi giới & Lãi suất Margin',
  screen_code: 'SCR_FEE_MARGIN_CONFIG',
  components: [
    {
      element_id: 'inp_fee_name',
      label: 'Tên gói biểu phí',
      type: 'TextInput',
      required: true,
      placeholder: 'Nhập tên biểu phí',
      max_length: 100,
      linked_req_uid: 'REQ-01',
    },
    {
      element_id: 'sel_market',
      label: 'Sàn giao dịch áp dụng',
      type: 'MultiSelect',
      options: ['HOSE', 'HNX', 'UPCOM'],
      required: true,
      linked_req_uid: 'REQ-01',
    },
    {
      element_id: 'inp_broker_fee',
      label: 'Tỷ lệ phí môi giới (%)',
      type: 'NumberInput',
      min: 0,
      max: 0.35,
      required: true,
      linked_req_uid: 'REQ-02',
    },
    {
      element_id: 'lbl_mof_cap',
      label: 'Trần phí Bộ Tài chính',
      type: 'ReadOnlyBadge',
      default_value: '0.027%',
      linked_req_uid: 'REQ-02',
    },
    {
      element_id: 'inp_margin_rate',
      label: 'Lãi suất vay Margin (%/năm)',
      type: 'NumberInput',
      min: 0,
      max: 25,
      default_value: 11.5,
      required: true,
      linked_req_uid: 'REQ-01',
    },
    {
      element_id: 'btn_cancel',
      label: 'Hủy bỏ',
      type: 'SecondaryButton',
    },
    {
      element_id: 'btn_save_fee',
      label: 'Lưu biểu phí',
      type: 'PrimaryButton',
      action: 'SUBMIT_FEE_PACKAGE',
    },
  ],
}

export const DEFAULT_LAYOUT_SPEC = SECURITIES_FEE_LAYOUT_SPEC

export function AiLayoutProposalDrawer({
  open,
  onClose,
  reqCode = 'SRS-014',
  reqTitle = 'Thiết lập biểu phí & Lãi vay Margin',
  onAttachToReq,
}: AiLayoutProposalDrawerProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'wireframe' | 'json'>('wireframe')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Wireframe form values
  const [feeName, setFeeName] = useState('Gói Phí Khách hàng VIP (KRX Active)')
  const [brokerFee, setBrokerFee] = useState('0.15')
  const [marginRate, setMarginRate] = useState('11.5')
  const [selectedMarkets, setSelectedMarkets] = useState<Record<string, boolean>>({
    HOSE: true,
    HNX: true,
    UPCOM: true,
  })

  if (!open) return null

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(SECURITIES_FEE_LAYOUT_SPEC, null, 2))
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleRegenerate = () => {
    setIsRegenerating(true)
    setTimeout(() => {
      setIsRegenerating(false)
      setFeeName('Gói Biểu phí Môi giới Chuyên nghiệp T+1')
      setBrokerFee('0.12')
      setMarginRate('11.0')
    }, 500)
  }

  const handleSaveAndAttach = () => {
    setIsSaved(true)
    onAttachToReq?.(SECURITIES_FEE_LAYOUT_SPEC)
    setTimeout(() => {
      onClose()
    }, 600)
  }

  const toggleMarket = (m: string) => {
    setSelectedMarkets((prev) => ({ ...prev, [m]: !prev[m] }))
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-950/20 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel - 540px wide */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside
          role="dialog"
          aria-modal="true"
          className="flex w-screen max-w-[540px] flex-col border-l border-gray-200 bg-white shadow-2xl focus:outline-none"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-gray-200 px-6 py-4">
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-gray-950">
                  {t('Khung giao diện mẫu (AI Layout)', 'AI Layout Proposal')} —{' '}
                  <span className="font-mono text-sm text-brand-700">{reqCode || 'SRS-014'}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {reqTitle || t('Thiết lập biểu phí & Lãi vay Margin', 'Fee & Margin Rate Setup')}
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

          {/* Navigation Tabs (2 Tabs) */}
          <div className="flex shrink-0 border-b border-gray-200 bg-gray-50 px-6 pt-2">
            <div role="tablist" className="flex gap-4">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'wireframe'}
                onClick={() => setActiveTab('wireframe')}
                className={clsx(
                  'border-b-2 py-2 text-xs font-medium transition-colors',
                  activeTab === 'wireframe'
                    ? 'border-brand-600 text-brand-700 font-semibold'
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
                  'border-b-2 py-2 text-xs font-medium transition-colors',
                  activeTab === 'json'
                    ? 'border-brand-600 text-brand-700 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                )}
              >
                {t('Cấu trúc JSON Chuẩn (Canonical UI JSON)', 'Canonical UI JSON')}
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeTab === 'wireframe' ? (
              <div className="space-y-4">
                {/* Notice banner */}
                <div className="rounded-md border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900">
                  <div className="font-semibold text-blue-950">
                    Bản phác thảo cấu trúc thành phần giao diện (UI Wireframe)
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-blue-800">
                    AI tự động tổng hợp từ đặc tả yêu cầu REQ-01 & REQ-02 để làm cơ sở đối chiếu với Figma.
                  </div>
                </div>

                {/* Wireframe Mockup Card */}
                <div className="rounded-xl border border-gray-300/80 bg-[#F8FAFC] p-5 shadow-xs space-y-4">
                  <div className="border-b border-gray-200 pb-3">
                    <h3 className="text-sm font-bold text-gray-900">
                      Màn hình Thiết lập Gói Biểu phí Môi giới & Lãi suất Margin
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">Mã màn hình: SCR_FEE_MARGIN_CONFIG</p>
                  </div>

                  {/* Input 1: Tên gói biểu phí */}
                  <div>
                    <label className="block text-xs font-medium text-gray-800 mb-1">
                      Tên gói biểu phí <span className="text-red-500">(*)</span>
                    </label>
                    <input
                      type="text"
                      value={feeName}
                      onChange={(e) => setFeeName(e.target.value)}
                      maxLength={100}
                      placeholder="Nhập tên biểu phí"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 shadow-2xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-gray-400">
                      <span>Ràng buộc: Bắt buộc, tối đa 100 ký tự</span>
                      <span>{feeName.length}/100</span>
                    </div>
                  </div>

                  {/* Input 2: Tỷ lệ phí & Trần BTC */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-800 mb-1">
                        Tỷ lệ phí môi giới cổ phiếu (%) <span className="text-red-500">(*)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="0.35"
                        value={brokerFee}
                        onChange={(e) => setBrokerFee(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 shadow-2xs focus:border-brand-500 focus:outline-none"
                      />
                      <span className="mt-1 inline-block text-[11px] text-gray-500">Ràng buộc: ≥ 0%</span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-800 mb-1">
                        Trần phí Bộ Tài chính
                      </label>
                      <div className="flex h-[31px] items-center rounded-md border border-gray-200 bg-gray-100 px-3 text-xs font-semibold text-gray-700">
                        0.027%
                      </div>
                      <span className="mt-1 inline-block text-[11px] text-gray-500">Tham chiếu cố định</span>
                    </div>
                  </div>

                  {/* Input 3: Lãi suất Margin */}
                  <div>
                    <label className="block text-xs font-medium text-gray-800 mb-1">
                      Lãi suất vay Margin (%/năm) <span className="text-red-500">(*)</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="25"
                      value={marginRate}
                      onChange={(e) => setMarginRate(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 shadow-2xs focus:border-brand-500 focus:outline-none"
                    />
                    <span className="mt-1 inline-block text-[11px] text-gray-500">
                      Khoảng hợp lệ: 0% – 25%/năm (Ví dụ: 11.5%/năm)
                    </span>
                  </div>

                  {/* Input 4: Sàn giao dịch áp dụng */}
                  <div>
                    <label className="block text-xs font-medium text-gray-800 mb-1">
                      Sàn giao dịch áp dụng <span className="text-red-500">(*)</span>
                    </label>
                    <div className="flex flex-wrap gap-4 pt-0.5">
                      {['HOSE', 'HNX', 'UPCOM'].map((m) => (
                        <label key={m} className="flex items-center gap-1.5 text-xs font-medium text-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedMarkets[m]}
                            onChange={() => toggleMarket(m)}
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span>☑ {m}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-3">
                    <button
                      type="button"
                      className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      className="rounded bg-gray-950 px-4 py-1 text-xs font-medium text-white hover:bg-gray-800 shadow-xs"
                    >
                      Lưu biểu phí
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab 2: Canonical UI JSON */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 font-medium">
                    Mã JSON định nghĩa danh sách các phần tử giao diện dùng đối chiếu với Figma:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                    <span>{isCopied ? t('Đã chép!', 'Copied!') : t('Sao chép JSON', 'Copy JSON')}</span>
                  </button>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-900 p-4 text-xs font-mono text-gray-100 overflow-auto max-h-[500px]">
                  <pre>{JSON.stringify(SECURITIES_FEE_LAYOUT_SPEC, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-6 py-3 bg-gray-50">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-2xs"
            >
              <AiSparkleIcon className="h-3.5 w-3.5 text-gray-500" />
              <span>{isRegenerating ? t('Đang tạo lại...', 'Regenerating...') : t('Tạo lại bằng AI', 'Regenerate')}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndAttach}
              className="flex items-center gap-1.5 rounded-md bg-gray-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 shadow-xs transition-colors"
            >
              {isSaved ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{t('Đã đính kèm vào Tài liệu', 'Attached to Spec')}</span>
                </>
              ) : (
                <span>{t('Lưu & Đính kèm vào Tài liệu', 'Save & Attach to Doc')}</span>
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
