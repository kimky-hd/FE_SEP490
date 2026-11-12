import { useState } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import type { TestCaseDto } from '@/types/testing'
import { isTestCaseStale } from './testUi'

export interface TestCaseInspectionDrawerProps {
  open: boolean
  onClose: () => void
  tc: TestCaseDto | null
  onAcknowledgeStale?: (tc: TestCaseDto) => void
  onAiUpdateSteps?: (tc: TestCaseDto) => void
}

export function TestCaseInspectionDrawer({
  open,
  onClose,
  tc,
  onAcknowledgeStale,
  onAiUpdateSteps,
}: TestCaseInspectionDrawerProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'details' | 'layout' | 'figma'>('details')
  const [staleResolved, setStaleResolved] = useState(false)
  const [aiUpdated, setAiUpdated] = useState(false)

  if (!open || !tc) return null

  const isStale = (!staleResolved && isTestCaseStale(tc)) || tc.code.endsWith('TC_5') || tc.code.endsWith('TC_6')

  const handleKeepOriginal = () => {
    setStaleResolved(true)
    onAcknowledgeStale?.(tc)
  }

  const handleAiUpdate = () => {
    setAiUpdated(true)
    setStaleResolved(true)
    onAiUpdateSteps?.(tc)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-950/20 backdrop-blur-[1px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside
          role="dialog"
          aria-modal="true"
          className="flex w-screen max-w-[560px] flex-col border-l border-gray-200 bg-white shadow-2xl focus:outline-none"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-gray-200 px-5 py-4">
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-brand-700">
                  {tc.moduleCode ? `${tc.moduleCode}·${tc.code}` : tc.code}
                </span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    tc.priority === 'HIGH'
                      ? 'bg-red-50 text-red-700'
                      : tc.priority === 'LOW'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-amber-50 text-amber-700',
                  )}
                >
                  {tc.priority}
                </span>
                {isStale && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-medium text-amber-800">
                    {t('⚠️ REQ thay đổi', '⚠️ Stale / REQ updated')}
                  </span>
                )}
              </div>
              <h2 className="mt-1.5 text-base font-semibold leading-snug text-gray-950">{tc.title}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {t(
                  'Thư mục: 1.3 Xử lý Chức năng & Ràng buộc · Đợt test: SIT Release 3.2',
                  'Suite: 1.3 Functional & Constraints · Plan: SIT Release 3.2',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              title={t('Đóng (Esc)', 'Close (Esc)')}
            >
              ✕
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50 px-5 text-[13px] font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={clsx(
                '-mb-px border-b-2 py-2.5 pr-4',
                activeTab === 'details'
                  ? 'border-brand-600 text-brand-700 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              )}
            >
              {t('Chi tiết kịch bản & Các bước', 'Test Details & Steps')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('layout')}
              className={clsx(
                '-mb-px border-b-2 px-4 py-2.5',
                activeTab === 'layout'
                  ? 'border-brand-600 text-brand-700 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              )}
            >
              {t('Giao diện mẫu (AI Layout)', 'AI Layout Spec')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('figma')}
              className={clsx(
                '-mb-px border-b-2 px-4 py-2.5',
                activeTab === 'figma'
                  ? 'border-brand-600 text-brand-700 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900',
              )}
            >
              {t('Bản vẽ Figma', 'Figma Frame')}
            </button>
          </div>

          {/* Drawer Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5 text-[13px]">
            {/* Khung đối chiếu thay đổi yêu cầu nếu kịch bản Stale */}
            {isStale && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 text-amber-900 font-semibold">
                  <span>⚠️</span>
                  <span>{t('Phát hiện Yêu cầu đặc tả đã thay đổi nội dung', 'Linked requirement was modified')}</span>
                </div>
                <p className="mt-1 text-xs text-amber-800">
                  {t(
                    'Yêu cầu đặc tả REQ-01 vừa được BA cập nhật phiên bản mới (v1.2). Các bước kiểm thử hiện tại có thể không còn khớp với ràng buộc mới.',
                    'Requirement REQ-01 was updated to v1.2. Existing test steps might need updates to match the new constraints.',
                  )}
                </p>

                {/* Diff Comparison Box */}
                <div className="mt-3 space-y-2 rounded border border-amber-200 bg-white p-3 text-xs">
                  <div>
                    <span className="font-semibold text-red-700">
                      {t('● Nội dung cũ (v1.0 - Đã thay thế):', '● Old requirement (v1.0):')}
                    </span>
                    <div className="mt-1 rounded bg-red-50 p-2 text-red-900 line-through">
                      "Tỷ lệ phí môi giới phải ≥ 0% và tối đa 0.5%. Trần phí Bộ Tài chính tham chiếu 0.03%. Lãi suất vay Margin tối đa 20%/năm."
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-emerald-800">
                      {t('● Nội dung mới (v1.2 - Vừa phê duyệt):', '● New requirement (v1.2 - Approved):')}
                    </span>
                    <div className="mt-1 rounded bg-emerald-50 p-2 font-medium text-emerald-950">
                      "Tỷ lệ phí môi giới phải ≥ 0% và tối đa 0.35% theo quy định mới của Bộ Tài chính; trần phí áp dụng cố định 0.027%. Lãi suất vay Margin tối đa 15%/năm."
                    </div>
                  </div>
                </div>

                {/* Stale Action Buttons */}
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleKeepOriginal}
                    className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t('Giữ nguyên kịch bản', 'Keep original case')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAiUpdate}
                    className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 shadow-xs"
                  >
                    {t('Cập nhật bước test theo yêu cầu mới', 'Update test steps with new requirement')}
                  </button>
                </div>
              </div>
            )}

            {aiUpdated && (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                ✓ {t('Đã cập nhật bước kiểm thử theo trần phí Bộ Tài chính 0.35% và lãi suất Margin 15%!', 'Updated test steps matching 0.35% fee and 15% margin rate!')}
              </div>
            )}

            {activeTab === 'details' && (
              <>
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs">
                  <div>
                    <span className="text-gray-500">{t('Yêu cầu liên kết:', 'Linked Requirements:')}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tc.requirements.map((r) => (
                        <span
                          key={`${r.documentId}:${r.reqUid}`}
                          className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-blue-700"
                        >
                          {r.reqKey || 'REQ-01'}
                        </span>
                      ))}
                      {!tc.requirements.length && <span className="text-gray-400">Chưa gắn</span>}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('Điều kiện tiên quyết:', 'Preconditions:')}</span>
                    <p className="mt-1 font-medium text-gray-800">
                      {tc.preconditions || t('Tài khoản có quyền Quản trị nghiệp vụ Back-Office', 'Back-Office Admin account')}
                    </p>
                  </div>
                </div>

                {/* Steps Table */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                    {t('Các bước kiểm thử chi tiết', 'Detailed Test Steps')}
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-gray-200 bg-gray-50 text-gray-600 font-medium">
                        <tr>
                          <th className="w-12 px-3 py-2 text-center">#</th>
                          <th className="px-3 py-2">{t('Thao tác (Action)', 'Action')}</th>
                          <th className="px-3 py-2">{t('Kết quả mong đợi (Expected)', 'Expected Result')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {(tc.steps.length > 0
                          ? tc.steps
                          : [
                              {
                                action: 'Nhập tên gói VIP-KRX, phí môi giới 0.15%, lãi Margin 11.5%/năm',
                                expected: 'Các trường chấp nhận giá trị, không báo lỗi.',
                              },
                              {
                                action: 'Nhấn nút "Lưu biểu phí"',
                                expected: 'Hệ thống lưu thành công, gói phí hiển thị trong danh sách tham số KRX.',
                              },
                            ]
                        ).map((st, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-3 py-2 text-center font-mono text-gray-400">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{st.action}</td>
                            <td className="px-3 py-2 text-gray-600">{st.expected || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actual result if any */}
                {tc.actual && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      {t('Ghi nhận thực tế (Actual Result)', 'Actual Result')}
                    </h3>
                    <div className="rounded border border-red-200 bg-red-50/50 p-2.5 text-xs text-red-900">
                      {tc.actual}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'layout' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800">
                      Khung giao diện mẫu: Form Thiết lập gói biểu phí & Lãi suất Margin
                    </span>
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
                      LAYOUT-014-FORM
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Bản phác thảo wireframe do BA đính kèm từ tài liệu đặc tả SRS-014.
                  </p>
                </div>

                {/* Wireframe Mockup */}
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Tên gói biểu phí (*)</label>
                    <input
                      type="text"
                      readOnly
                      value="Gói Phí VIP Khách hàng Tổ chức (KRX)"
                      className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Tỷ lệ phí môi giới (%)</label>
                      <input
                        type="text"
                        readOnly
                        value="0.15%"
                        className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                      />
                      <span className="mt-0.5 block text-[10.5px] text-gray-400">Trần BTC: 0.027%</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Lãi suất vay Margin (%/năm)</label>
                      <input
                        type="text"
                        readOnly
                        value="11.5%/năm"
                        className="mt-1 w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sàn giao dịch áp dụng</label>
                    <div className="flex gap-3 text-xs text-gray-700">
                      <span className="inline-flex items-center gap-1 font-mono">☑ HOSE</span>
                      <span className="inline-flex items-center gap-1 font-mono">☑ HNX</span>
                      <span className="inline-flex items-center gap-1 font-mono">☑ UPCOM</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'figma' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900">
                        Back-Office KRX / Thiết lập Biểu phí & Margin (v1.8.1)
                      </h4>
                      <p className="mt-0.5 text-xs text-gray-500">Frame ID: FIGMA-KRX-101 · 12 UI nodes</p>
                    </div>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Đã đồng bộ
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                    <span className="text-gray-500">Đã khớp 5 thành phần tương tác</span>
                    <a
                      href="https://www.figma.com"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Mở trên Figma ↗
                    </a>
                  </div>
                </div>

                <div className="rounded border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                  <span className="font-semibold">Lưu ý đối chiếu:</span> Thành phần{' '}
                  <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">lbl_mof_cap (Trần phí Bộ Tài chính)</code>{' '}
                  có trong Đặc tả REQ-02 nhưng chưa được thiết kế trên Frame Figma này.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {t('Đóng', 'Close')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

