import { useState, useId } from 'react'
import clsx from 'clsx'
import {
  AiSparkleIcon,
  CloseIcon,
  CheckIcon,
  LockIcon,
  FigmaIcon,
} from '@/components/ui/icons'
import { useI18n } from '@/i18n'

export interface GeneratedTestCaseOutput {
  code: string
  title: string
  type: 'Happy Path' | 'Boundary / UI' | 'UI Gap' | 'Negative'
  steps: string[]
  expected: string
  badgeTone: 'emerald' | 'blue' | 'amber' | 'purple'
}

export interface AiSmartTestGeneratorModalProps {
  open: boolean
  onClose: () => void
  reqCode?: string
  reqTitle?: string
  onSaveTestCases?: (cases: GeneratedTestCaseOutput[]) => void
}

export function AiSmartTestGeneratorModal({
  open,
  onClose,
  reqCode = 'REQ-014.3',
  reqTitle = 'Xác thực OTP cho giao dịch thanh toán trên 5.000.000 VNĐ',
  onSaveTestCases,
}: AiSmartTestGeneratorModalProps) {
  const { t } = useI18n()
  const titleId = useId()

  // State options
  const [useAiLayout, setUseAiLayout] = useState(true)
  const [useFigma, setUseFigma] = useState(true)
  const [selectedFrame, setSelectedFrame] = useState('Checkout / Confirm Payment Frame (v3)')
  const [step, setStep] = useState<'configure' | 'preview'>('configure')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTierTab, setActiveTierTab] = useState<'tier1' | 'tier2' | 'tier3'>('tier3')

  // Calculate active sources count
  const activeSourcesCount = 1 + (useAiLayout ? 1 : 0) + (useFigma ? 1 : 0)

  if (!open) return null

  // Generated outputs according to the 3 options
  const tier3Cases: GeneratedTestCaseOutput[] = [
    {
      code: 'TC-01',
      title: 'Xác thực thanh toán giao dịch 6.000.000 đ thành công với OTP 6 số (Figma & Layout)',
      type: 'Happy Path',
      steps: [
        '1. Xác thực số tiền 6.000.000 đ hiển thị tại nhãn amount_display trên frame Checkout.',
        '2. Nhập 6 chữ số hợp lệ vào ô otp_code_field.',
        '3. Bấm nút "Xác nhận thanh toán" (btn_confirm_payment).',
      ],
      expected: 'Hệ thống chấp nhận giao dịch, chuyển trạng thái đơn hàng thành công.',
      badgeTone: 'emerald',
    },
    {
      code: 'TC-02',
      title: 'Kiểm tra ràng buộc giá trị biên trên ô otp_code_field',
      type: 'Boundary / UI',
      steps: [
        '1. Thử nhập ký tự chữ cái hoặc ký tự đặc biệt vào ô otp_code_field.',
        '2. Thử nhập thiếu (5 chữ số) và bấm "Xác nhận thanh toán".',
      ],
      expected: 'Chỉ cho phép nhập ký tự số (numeric), cảnh báo khi chưa đủ 6 chữ số.',
      badgeTone: 'blue',
    },
    {
      code: 'TC-GAP-01',
      title: 'Bắt lỗi giao diện: Bản vẽ Figma thiếu nút "Gửi lại mã OTP" so với Khung giao diện mẫu',
      type: 'UI Gap',
      steps: [
        '1. Kiểm tra sự xuất hiện của nút "Gửi lại mã OTP" (btn_resend_otp) sau khi đếm ngược 60 giây.',
        '2. Đối chiếu với bản vẽ Figma node_id 142:506.',
      ],
      expected: 'Ghi nhận lỗi giao diện (UI Gap): Bản vẽ Figma chưa thiết kế thành phần nút gửi lại mã OTP.',
      badgeTone: 'amber',
    },
    {
      code: 'TC-03',
      title: 'Khóa chức năng thanh toán 15 phút khi nhập sai OTP quá 3 lần liên tiếp',
      type: 'Negative',
      steps: [
        '1. Nhập sai OTP 3 lần liên tiếp qua ô otp_code_field.',
        '2. Nhấn "Xác nhận thanh toán" ở lần thứ 3.',
      ],
      expected: 'Hệ thống tự động hủy giao dịch và khóa chức năng thanh toán trong 15 phút theo quy định AC-03.',
      badgeTone: 'purple',
    },
  ]

  const tier2Cases: GeneratedTestCaseOutput[] = [
    {
      code: 'TC-01',
      title: 'Xác thực giao dịch OTP thành công với mã 6 chữ số theo Layout mẫu',
      type: 'Happy Path',
      steps: [
        '1. Kiểm tra màn hình hiện số tiền giao dịch (txt_amount_display).',
        '2. Nhập 6 chữ số hợp lệ vào ô input_otp_code.',
        '3. Bấm nút Xác nhận (btn_submit_otp).',
      ],
      expected: 'Xử lý giao dịch thành công theo tiêu chuẩn AC-01.',
      badgeTone: 'emerald',
    },
    {
      code: 'TC-02',
      title: 'Kiểm tra biên & Đồng hồ đếm ngược 60s trên nút Gửi lại mã OTP',
      type: 'Boundary / UI',
      steps: [
        '1. Thử nhập chữ cái hoặc nhập 5 chữ số vào ô OTP.',
        '2. Chờ hết 60s đếm ngược xem nút "Gửi lại mã OTP" có sáng lên cho phép click không.',
      ],
      expected: 'Ô OTP chặn ký tự chữ; nút Gửi lại mã chỉ kích hoạt sau 60 giây.',
      badgeTone: 'blue',
    },
    {
      code: 'TC-03',
      title: 'Hủy giao dịch và khóa tạm thời khi nhập sai OTP 3 lần',
      type: 'Negative',
      steps: [
        '1. Nhập sai mã OTP 3 lần liên tiếp.',
        '2. Đếm số lần hiển thị cảnh báo lỗi và kiểm tra khóa giao dịch.',
      ],
      expected: 'Giao dịch bị hủy, hiển thị cảnh báo khóa tài khoản 15 phút.',
      badgeTone: 'purple',
    },
  ]

  const tier1Cases: GeneratedTestCaseOutput[] = [
    {
      code: 'TC-01',
      title: 'Kiểm tra luồng xác thực OTP thành công (Dựa trên REQ thuần túy)',
      type: 'Happy Path',
      steps: [
        '1. Khởi tạo giao dịch thanh toán > 5.000.000 VNĐ.',
        '2. Nhập mã OTP chính xác.',
        '3. Bấm xác nhận.',
      ],
      expected: 'Giao dịch thanh toán được xử lý thành công.',
      badgeTone: 'emerald',
    },
    {
      code: 'TC-03',
      title: 'Kiểm tra xử lý khi nhập sai mã OTP quá 3 lần',
      type: 'Negative',
      steps: [
        '1. Nhập sai mã OTP 3 lần liên tiếp.',
        '2. Bấm xác nhận.',
      ],
      expected: 'Giao dịch bị hủy và chức năng thanh toán bị tạm khóa.',
      badgeTone: 'purple',
    },
  ]

  const activeCases =
    activeTierTab === 'tier3'
      ? tier3Cases
      : activeTierTab === 'tier2'
        ? tier2Cases
        : tier1Cases

  const handleStartGeneration = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setActiveTierTab(activeSourcesCount === 3 ? 'tier3' : activeSourcesCount === 2 ? 'tier2' : 'tier1')
      setStep('preview')
    }, 700)
  }

  const handleSaveToTestPlan = () => {
    onSaveTestCases?.(activeCases)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-950/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-[680px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl focus:outline-none overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <AiSparkleIcon width={14} height={14} />
              </span>
              <h2 id={titleId} className="text-base font-semibold text-gray-950">
                {step === 'configure'
                  ? t('Tùy chọn Ngữ cảnh Sinh Kịch bản Kiểm thử', 'AI Test Generator Context Options')
                  : t('Kịch bản Kiểm thử Đã Sinh (Đối chiếu 3 Nguồn)', 'Generated Test Cases (Multi-source Insight)')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {step === 'configure'
                ? t(
                    'Lựa chọn các nguồn thông tin để AI sinh testcase chính xác nhất',
                    'Select context sources for AI to generate highly accurate test cases',
                  )
                : t(
                    'So sánh độ chi tiết và chất lượng kịch bản theo từng mức độ ngữ cảnh',
                    'Compare quality and precision across different context levels',
                  )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none"
            title={t('Đóng', 'Close')}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {step === 'configure' ? (
            <div className="space-y-4">
              {/* Block 1: Mandatory Requirement Summary */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('1. Yêu cầu đặc tả đã chọn (Bắt buộc)', '1. Selected Specification (Mandatory)')}
                </label>
                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <LockIcon className="h-3 w-3 text-emerald-600" />
                      {reqCode}: {reqTitle}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Đã phê duyệt
                    </span>
                  </div>

                  {/* Acceptance criteria preview */}
                  <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                    <div className="flex items-start gap-1.5">
                      <span className="font-mono font-medium text-gray-700">AC-01:</span>
                      <span>Bắt buộc nhập OTP qua tin nhắn SMS đối với giao dịch &gt; 5.000.000 VNĐ.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-mono font-medium text-gray-700">AC-02:</span>
                      <span>Mã OTP gồm 6 chữ số, có hiệu lực trong vòng 60 giây.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-mono font-medium text-gray-700">AC-03:</span>
                      <span>Nhập sai OTP quá 3 lần liên tiếp: tự động hủy và khóa chức năng 15 phút.</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[11px] text-gray-500 pt-0.5">
                      <span className="font-mono font-medium text-gray-600">BR-LIMIT-01:</span>
                      <span>Hạn mức tối đa 20.000.000 VNĐ / ngày.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Block 2: Optional UI Context (Dashed Border) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('2. Ngữ cảnh Giao diện (Tùy chọn linh hoạt)', '2. Optional UI Context')}
                </label>
                <div className="mt-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/40 p-4 space-y-4">
                  {/* Option 1: AI Layout Spec */}
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200/90 bg-white p-3.5 shadow-2xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          id="opt-layout"
                          type="checkbox"
                          checked={useAiLayout}
                          onChange={(e) => setUseAiLayout(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-gray-950"
                        />
                        <label htmlFor="opt-layout" className="text-xs font-semibold text-gray-900 cursor-pointer">
                          {t(
                            'Sử dụng Khung giao diện mẫu (AI Layout) từ Đặc tả',
                            'Use AI Layout Proposal from Specification',
                          )}
                        </label>
                        {useAiLayout && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                            ✓ {t('Đã có sẵn 1 layout', '1 layout available')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 pl-6">
                        {t(
                          'Bổ sung danh sách trường dữ liệu, nhãn hiển thị và điều kiện biên do BA phác thảo.',
                          'Supplements field list, labels, and boundary conditions sketched by BA.',
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Figma Design Integration */}
                  <div className="flex flex-col gap-2.5 rounded-lg border border-gray-200/90 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            id="opt-figma"
                            type="checkbox"
                            checked={useFigma}
                            onChange={(e) => setUseFigma(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-gray-950"
                          />
                          <label htmlFor="opt-figma" className="text-xs font-semibold text-gray-900 cursor-pointer flex items-center gap-1.5">
                            <FigmaIcon className="h-3.5 w-3.5 text-purple-600" />
                            {t('Kết hợp dữ liệu Thiết kế Figma thực tế', 'Combine with Actual Figma Design Data')}
                          </label>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 pl-6">
                          {t(
                            'Lấy chính xác tên nút bấm, đường dẫn tương tác thực tế từ bản vẽ Figma.',
                            'Extracts exact button labels and interaction paths from Figma artboards.',
                          )}
                        </p>
                      </div>
                    </div>

                    {useFigma && (
                      <div className="pl-6 pt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                          {t('Khung bản vẽ (Frame):', 'Artboard Frame:')}
                        </span>
                        <select
                          value={selectedFrame}
                          onChange={(e) => setSelectedFrame(e.target.value)}
                          className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-2.5 text-xs text-gray-800 shadow-2xs focus:border-gray-950 focus:outline-none"
                        >
                          <option value="Checkout / Confirm Payment Frame (v3)">
                            Checkout / Confirm Payment Frame (v3) — node 142:506
                          </option>
                          <option value="Modal OTP Overlay v2">Modal OTP Overlay v2 — node 142:512</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Block 3: Reconciliation Insight (Yellow Alert Box) */}
              {useAiLayout && useFigma && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 text-[11px] font-bold">
                      💡
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-amber-900">
                        {t('Phát hiện đối chiếu ngữ cảnh nhanh (Reconciliation Insight):', 'Reconciliation Insight:')}
                      </div>
                      <p className="mt-1 text-amber-800 leading-relaxed">
                        {t(
                          'Bản vẽ Figma thực tế đang thiếu nút "Gửi lại OTP" so với Khung giao diện mẫu của BA. AI sẽ tự động sinh thêm 1 kịch bản kiểm thử bắt lỗi giao diện (UI Gap).',
                          'Actual Figma artboard is missing the "Resend OTP" button compared to BA Layout. AI will auto-generate an extra UI Gap test case.',
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Preview & Comparison of Generated Testcases */
            <div className="space-y-4">
              {/* Segmented Tier Tabs */}
              <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTierTab('tier3')}
                  className={clsx(
                    'flex-1 rounded-md py-1.5 text-xs font-semibold transition',
                    activeTierTab === 'tier3'
                      ? 'bg-white text-gray-950 shadow-xs'
                      : 'text-gray-600 hover:text-gray-950',
                  )}
                >
                  {t('Lựa chọn 3: REQ + Khung mẫu + Figma (Khuyên dùng)', 'Tier 3: REQ + Layout + Figma')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTierTab('tier2')}
                  className={clsx(
                    'flex-1 rounded-md py-1.5 text-xs font-medium transition',
                    activeTierTab === 'tier2'
                      ? 'bg-white text-gray-950 shadow-xs'
                      : 'text-gray-600 hover:text-gray-950',
                  )}
                >
                  {t('Lựa chọn 2: REQ + Khung mẫu', 'Tier 2: REQ + Layout')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTierTab('tier1')}
                  className={clsx(
                    'flex-1 rounded-md py-1.5 text-xs font-medium transition',
                    activeTierTab === 'tier1'
                      ? 'bg-white text-gray-950 shadow-xs'
                      : 'text-gray-600 hover:text-gray-950',
                  )}
                >
                  {t('Lựa chọn 1: Chỉ REQ thuần túy', 'Tier 1: REQ only')}
                </button>
              </div>

              {/* Quality summary bar */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200/90 bg-gray-50/70 px-3.5 py-2 text-xs">
                <span className="text-gray-600">
                  {t('Độ bám sát giao diện:', 'Interface Precision:')}{' '}
                  <b className={clsx(activeTierTab === 'tier3' ? 'text-emerald-700' : activeTierTab === 'tier2' ? 'text-blue-700' : 'text-gray-700')}>
                    {activeTierTab === 'tier3'
                      ? t('Chính xác tuyệt đối (Khớp tên nút thật & Bắt lỗi thiếu)', 'Absolute Precision')
                      : activeTierTab === 'tier2'
                        ? t('Cao (Bám đúng tên trường, ràng buộc 6 số)', 'High Precision')
                        : t('Rất thấp (Các bước mang tính giả định chung chung)', 'Low (Generic assumptions)')}
                  </b>
                </span>
                <span className="font-mono text-gray-500 font-semibold">{activeCases.length} Testcases</span>
              </div>

              {/* List of generated test cases */}
              <div className="space-y-3">
                {activeCases.map((tc) => (
                  <div
                    key={tc.code}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs hover:border-gray-300 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-950 bg-gray-100 px-2 py-0.5 rounded">
                          {tc.code}
                        </span>
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            tc.badgeTone === 'emerald' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                            tc.badgeTone === 'blue' && 'bg-blue-50 text-blue-700 border border-blue-200',
                            tc.badgeTone === 'amber' && 'bg-amber-50 text-amber-800 border border-amber-200',
                            tc.badgeTone === 'purple' && 'bg-purple-50 text-purple-700 border border-purple-200',
                          )}
                        >
                          {tc.type}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs font-semibold text-gray-900 leading-snug">
                      {tc.title}
                    </div>
                    <div className="mt-2.5 space-y-1 text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-lg border border-gray-100 font-mono">
                      {tc.steps.map((st, i) => (
                        <div key={i} className="leading-relaxed">
                          {st}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <b className="font-semibold text-gray-700">{t('Kết quả mong đợi:', 'Expected:')}</b> {tc.expected}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50/80 px-6 py-4">
          {step === 'configure' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus-visible:outline-none"
              >
                {t('Hủy bỏ', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleStartGeneration}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gray-950 px-4 text-xs font-medium text-white shadow-xs hover:bg-gray-800 focus-visible:outline-none active:scale-[0.99] transition disabled:opacity-75"
              >
                <AiSparkleIcon className={clsx('h-3.5 w-3.5', isGenerating && 'animate-spin')} />
                {isGenerating
                  ? t('Đang phân tích & đối chiếu...', 'Analyzing & Reconciling...')
                  : t(
                      `Bắt đầu sinh Testcase (${activeSourcesCount} nguồn)`,
                      `Start Generating (${activeSourcesCount} Sources)`,
                    )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus-visible:outline-none"
              >
                ← {t('Quay lại tùy chọn', 'Back to options')}
              </button>
              <button
                type="button"
                onClick={handleSaveToTestPlan}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gray-950 px-4 text-xs font-medium text-white shadow-xs hover:bg-gray-800 focus-visible:outline-none active:scale-[0.99] transition"
              >
                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                {t(`Lưu ${activeCases.length} Kịch bản vào Test Plan`, `Save ${activeCases.length} Cases to Test Plan`)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
