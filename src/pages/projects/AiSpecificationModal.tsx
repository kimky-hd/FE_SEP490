import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SparklesIcon, CheckIcon, CloseIcon, NotesIcon } from '@/components/ui/icons'
import type { RequirementItem } from '@/types/document'

interface AiSpecificationModalProps {
  open: boolean
  onClose: () => void
  onImportItems: (items: Partial<RequirementItem>[]) => void
  documentTitle?: string
}

const SAMPLE_MEETING_NOTES = `Ghi chú cuộc họp phân tích kỹ thuật ngày 26/10:
- Khách hàng muốn nâng cấp cổng thanh toán QR động.
- Người dùng mở app ngân hàng hoặc ví điện tử quét mã VietQR sinh tức thời theo từng đơn hàng.
- Hệ thống gửi request sang Napas / Ngân hàng thụ hưởng để sinh mã QR kèm giá trị tiền và mã đơn hàng duy nhất.
- Khi khách chuyển khoản thành công, hệ thống ngân hàng bắn Webhook về SSAM trong vòng tối đa 3 giây.
- Ràng buộc: Mã QR chỉ có hiệu lực trong 15 phút. Nếu sau 15 phút chưa thanh toán thì tự động hủy đơn và hoàn trả tồn kho.
- Nếu Webhook báo lỗi hoặc số tiền chuyển thừa/thiếu, hệ thống không tự động duyệt đơn mà chuyển sang trạng thái "Cần đối soát thủ công" và báo cho nhân viên kế toán.
- Thiết kế giao diện: Cần màn hình hiển thị mã QR kèm đồng hồ đếm ngược 15 phút (Frame: Checkout/DynamicQR).`

export function AiSpecificationModal({
  open,
  onClose,
  onImportItems,
  documentTitle = 'Bộ tài liệu',
}: AiSpecificationModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [rawNotes, setRawNotes] = useState(SAMPLE_MEETING_NOTES)
  const [isNormalizing, setIsNormalizing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // 4 trường chuẩn hóa từ Raw Notes
  const [scope, setScope] = useState('Thanh toán bằng mã VietQR động theo từng đơn hàng, đối soát và xử lý webhook.')
  const [actors, setActors] = useState('Khách hàng mua hàng, Cổng thanh toán Napas/Ngân hàng, Kế toán đối soát, Hệ thống SSAM.')
  const [mainFlows, setMainFlows] = useState('1. Sinh mã QR động 15 phút\n2. Khách hàng quét mã chuyển khoản\n3. Ngân hàng bắn Webhook ghi nhận giao dịch\n4. Cập nhật đơn hàng thành công.')
  const [businessRules, setBusinessRules] = useState('- QR hết hạn sau 15 phút.\n- Webhook phản hồi trong 3 giây.\n- Số tiền không khớp chuyển sang đối soát thủ công.')

  // Danh sách các mục dự thảo do AI sinh ra
  const [draftItems, setDraftItems] = useState<Array<Partial<RequirementItem> & { accepted: boolean }>>([])

  const handleFillSample = () => {
    setRawNotes(SAMPLE_MEETING_NOTES)
  }

  const handleNormalize = () => {
    setIsNormalizing(true)
    setTimeout(() => {
      setScope('Thanh toán đơn hàng qua mã VietQR động, xử lý Webhook ngân hàng và cơ chế đối soát tự động.')
      setActors('Khách hàng (User), Cổng thanh toán (Bank/Napas), Kế toán (Auditor), Hệ thống SSAM Backend.')
      setMainFlows(
        '1. Khách chọn thanh toán QR -> Hệ thống sinh mã động kèm mã đơn và số tiền.\n2. Khách quét mã chuyển tiền qua App ngân hàng.\n3. Ngân hàng gửi Webhook xác nhận giao dịch thành công.\n4. Hệ thống cập nhật trạng thái đơn và thông báo cho khách.',
      )
      setBusinessRules(
        '- Mã QR hết hạn sau đúng 15 phút.\n- Webhook phải xử lý idempotency (không trừ tiền 2 lần nếu nhận trùng webhook).\n- Sai lệch số tiền phải kích hoạt luồng cảnh báo đối soát.',
      )
      setIsNormalizing(false)
    }, 700)
  }

  const handleProceedToStep2 = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const generated: Array<Partial<RequirementItem> & { accepted: boolean }> = [
        {
          keyCode: 'REQ-QR-01',
          headingNumber: '1.1',
          headingTitle: 'Sinh mã VietQR Động theo Đơn hàng (Dynamic QR Generation)',
          itemType: 'REQUIREMENT',
          priority: 'HIGH',
          content:
            'Khi người dùng chọn hình thức thanh toán VietQR, hệ thống lập tức gọi API Napas/Ngân hàng để khởi tạo mã QR động chứa đầy đủ thông tin: Mã đơn hàng (Order ID), Số tiền cần thanh toán và Hạn hiệu lực đúng 15 phút.',
          acceptanceCriteria:
            '- Thời gian sinh mã QR không quá 1.5 giây.\n- Mã QR hiển thị kèm đồng hồ đếm ngược thời gian thực trên màn hình thanh toán.\n- Mỗi đơn hàng chỉ có duy nhất 1 mã QR hợp lệ tại một thời điểm.',
          clarificationNeeded: null,
          isAiGenerated: true,
          confidenceScore: 96,
          diagramType: 'MERMAID_PLANTUML',
          diagramTitle: 'Sơ đồ khởi tạo VietQR Động',
          diagramSourceCode:
            'flowchart TD\n  A[Khách chọn thanh toán QR] --> B[SSAM gọi API Bank Gateway]\n  B --> C[Sinh mã VietQR động]\n  C --> D[Hiển thị kèm đếm ngược 15 phút]\n  D --> E{Kiểm tra timeout 15p?}\n  E -->|Hết giờ| F[Hủy mã QR & Hoàn trả tồn kho]\n  E -->|Còn giờ| G[Chờ webhook thanh toán]',
          requiresUi: true,
          figmaFrameName: 'Checkout / 02-Dynamic QR Code',
          figmaUrl: 'https://www.figma.com/file/ssam/checkout-qr-frame',
          linkedTestCases: ['TC-QR-01', 'TC-QR-02'],
          linkedIssues: [],
          accepted: true,
        },
        {
          keyCode: 'REQ-QR-02',
          headingNumber: '1.2',
          headingTitle: 'Tiếp nhận & Xác thực Webhook Giao dịch từ Ngân hàng',
          itemType: 'REQUIREMENT',
          priority: 'HIGH',
          content:
            'Hệ thống cung cấp endpoint Webhook bảo mật bằng HMAC-SHA256 để ngân hàng gửi thông báo kết quả giao dịch. Hệ thống kiểm tra số tiền thực nhận với giá trị đơn hàng trước khi chuyển trạng thái Đã thanh toán.',
          acceptanceCriteria:
            '- Kiểm tra chữ ký số HMAC của webhook hợp lệ 100% trước khi xử lý.\n- Đảm bảo tính Idempotency: nếu ngân hàng gửi lại cùng một giao dịch, hệ thống chỉ xử lý duy nhất 1 lần.\n- Nếu số tiền thực nhận khác với giá trị đơn hàng, chuyển trạng thái "Cần đối soát" và gửi tin nhắn cảnh báo.',
          clarificationNeeded: 'Cần xác nhận ngân hàng có hỗ trợ tự động hoàn tiền (Auto-refund) khi chuyển thừa tiền không.',
          isAiGenerated: true,
          confidenceScore: 94,
          diagramType: 'MERMAID_PLANTUML',
          diagramTitle: 'Luồng xử lý Webhook Ngân hàng',
          diagramSourceCode:
            'flowchart TD\n  A[Ngân hàng bắn Webhook] --> B{Xác thực chữ ký HMAC}\n  B -->|Không hợp lệ| C[Từ chối 401 & Ghi log bảo mật]\n  B -->|Hợp lệ| D{Kiểm tra số tiền khớp?}\n  D -->|Khớp 100%| E[Đổi trạng thái: ĐÃ THANH TOÁN]\n  D -->|Thừa/Thiếu| F[Đổi trạng thái: CẦN ĐỐI SOÁT]\n  E --> G[Bắn thông báo Push & Email]',
          requiresUi: false,
          linkedTestCases: ['TC-QR-03'],
          linkedIssues: [],
          accepted: true,
        },
        {
          keyCode: 'REQ-QR-03',
          headingNumber: '2.1',
          headingTitle: 'Tự động Hủy Giao dịch Quá hạn (Timeout Auto-cancellation)',
          itemType: 'REQUIREMENT',
          priority: 'MEDIUM',
          content:
            'Sau 15 phút kể từ thời điểm khởi tạo, nếu chưa nhận được webhook thành công, hệ thống kích hoạt cronjob chuyển đơn hàng sang trạng thái Hết hạn thanh toán và mở lại số lượng tồn kho sản phẩm.',
          acceptanceCriteria:
            '- Cronjob quét các giao dịch quá hạn mỗi 60 giây.\n- Màn hình thanh toán của khách hàng tự động cập nhật sang trạng thái "Mã QR đã hết hạn, vui lòng tạo đơn mới".',
          clarificationNeeded: null,
          isAiGenerated: true,
          confidenceScore: 92,
          diagramType: 'NONE',
          requiresUi: true,
          figmaFrameName: 'Checkout / 03-QR Expired Notice',
          figmaUrl: 'https://www.figma.com/file/ssam/checkout-expired',
          linkedTestCases: ['TC-QR-04'],
          linkedIssues: [],
          accepted: true,
        },
      ]
      setDraftItems(generated)
      setIsGenerating(false)
      setStep(2)
    }, 900)
  }

  const handleToggleAccept = (index: number) => {
    setDraftItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, accepted: !it.accepted } : it)),
    )
  }

  const handleCommit = () => {
    const accepted = draftItems.filter((i) => i.accepted)
    if (accepted.length === 0) return
    onImportItems(accepted)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        step === 1
          ? '✨ Sinh Tài liệu Yêu cầu bằng AI (Từ Raw Notes - BF-03)'
          : `✨ Kiểm duyệt Phân rã Yêu cầu AI (Human-in-the-loop - GB-05) - ${documentTitle}`
      }
      description={
        step === 1
          ? 'Chuẩn hóa ghi chú thô, biên bản họp không cấu trúc thành 4 nhóm dữ liệu đặc tả trước khi bóc tách.'
          : 'Rà soát, tùy chỉnh và phê duyệt từng Requirement Item do AI sinh ra trước khi đưa vào Bộ tài liệu chính.'
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            <span className="text-xs font-semibold text-slate-500">
              Bước {step} / 2: {step === 1 ? 'Nhập & Chuẩn hóa Raw Notes' : 'Kiểm duyệt Requirement Items'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" inline onClick={onClose}>
              Hủy
            </Button>

            {step === 1 ? (
              <Button inline onClick={handleProceedToStep2} isLoading={isGenerating}>
                Tiếp tục: AI Bóc tách Requirement Items →
              </Button>
            ) : (
              <>
                <Button variant="secondary" inline onClick={() => setStep(1)}>
                  ← Quay lại bước 1
                </Button>
                <Button
                  inline
                  onClick={handleCommit}
                  disabled={draftItems.filter((i) => i.accepted).length === 0}
                >
                  Đưa {draftItems.filter((i) => i.accepted).length} mục đã chấp nhận vào Tài liệu →
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {step === 1 ? (
        <div className="space-y-4 max-h-[66vh] overflow-y-auto pr-1">
          {/* Nhập ghi chú thô */}
          <div>
            <div className="flex items-center justify-between pb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <NotesIcon className="h-4 w-4 text-emerald-600" />
                Ghi chú cuộc họp thô (Raw Meeting Notes)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFillSample}
                  className="text-xs text-emerald-700 font-semibold hover:underline"
                >
                  Nạp dữ liệu mẫu VietQR
                </button>
                <button
                  type="button"
                  onClick={handleNormalize}
                  disabled={isNormalizing || !rawNotes.trim()}
                  className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  {isNormalizing ? 'Đang chuẩn hóa…' : 'Chuẩn hóa cấu trúc đầu vào'}
                </button>
              </div>
            </div>
            <textarea
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              rows={6}
              placeholder="Dán ghi chú trao đổi họp, biên bản phỏng vấn hoặc yêu cầu từ khách hàng vào đây…"
              className="w-full rounded-xl border border-slate-300 p-3 text-xs leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
            />
          </div>

          {/* 4 trường cấu trúc chuẩn hóa */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                // 4 Trường Cấu trúc Chuẩn hóa (Convert Raw Note to Template)
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Bạn có thể sửa trực tiếp các ô trước khi cho AI bóc tách
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Phạm vi chức năng (Target Scope)
                </label>
                <input
                  type="text"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Tác nhân tham gia (Actors)
                </label>
                <input
                  type="text"
                  value={actors}
                  onChange={(e) => setActors(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Luồng xử lý nghiệp vụ chính (Main Business Flows)
                </label>
                <textarea
                  rows={3}
                  value={mainFlows}
                  onChange={(e) => setMainFlows(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  4. Quy tắc & Ràng buộc (Business Rules)
                </label>
                <textarea
                  rows={3}
                  value={businessRules}
                  onChange={(e) => setBusinessRules(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Bước 2: Kiểm duyệt Requirement Items */
        <div className="space-y-4 max-h-[66vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">
                ✓
              </span>
              <p className="text-xs text-emerald-900 font-medium">
                AI đã phân rã thành <b>{draftItems.length} Requirement Items</b> đạt chuẩn đặc tả. Hãy kiểm tra, chỉnh sửa nếu cần và đánh dấu chấp nhận từng mục.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDraftItems((prev) => prev.map((i) => ({ ...i, accepted: true })))}
                className="text-xs font-semibold text-emerald-700 hover:underline px-2 py-1"
              >
                Chấp nhận tất cả
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {draftItems.map((item, index) => (
              <div
                key={item.keyCode || index}
                className={`rounded-xl border p-4 transition-colors ${
                  item.accepted
                    ? 'border-emerald-300 bg-white shadow-sm ring-1 ring-emerald-200'
                    : 'border-slate-200 bg-slate-50/70 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {item.keyCode}
                    </span>
                    <span className="text-xs font-mono text-slate-500">{item.headingNumber}</span>
                    <h4 className="text-sm font-semibold text-slate-900">{item.headingTitle}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone="brand">✨ AI: {item.confidenceScore}%</Badge>
                    {item.requiresUi && <Badge tone="blue">UI-bound</Badge>}
                    <button
                      type="button"
                      onClick={() => handleToggleAccept(index)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        item.accepted
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {item.accepted ? (
                        <>
                          <CheckIcon className="h-3.5 w-3.5" />
                          Đã chấp nhận
                        </>
                      ) : (
                        <>
                          <CloseIcon className="h-3.5 w-3.5" />
                          Đã loại bỏ
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mô tả Yêu cầu:</label>
                    <textarea
                      rows={3}
                      value={item.content || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setDraftItems((prev) =>
                          prev.map((it, i) => (i === index ? { ...it, content: val } : it)),
                        )
                      }}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tiêu chí nghiệm thu (Acceptance Criteria):
                    </label>
                    <textarea
                      rows={3}
                      value={item.acceptanceCriteria || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setDraftItems((prev) =>
                          prev.map((it, i) => (i === index ? { ...it, acceptanceCriteria: val } : it)),
                        )
                      }}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {item.clarificationNeeded && (
                  <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-900 flex items-center justify-between gap-2">
                    <span>
                      <b>Điểm cần làm rõ:</b> {item.clarificationNeeded}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftItems((prev) =>
                          prev.map((it, i) => (i === index ? { ...it, clarificationNeeded: null } : it)),
                        )
                      }}
                      className="text-[11px] font-semibold text-amber-700 hover:underline shrink-0"
                    >
                      Bỏ cảnh báo
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
