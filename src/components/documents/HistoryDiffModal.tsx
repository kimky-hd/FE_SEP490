import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import type { RequirementHistoryLog } from '@/types/document'

interface HistoryDiffModalProps {
  open: boolean
  onClose: () => void
  log: RequirementHistoryLog | null
}

export function HistoryDiffModal({ open, onClose, log }: HistoryDiffModalProps) {
  if (!log) return null

  const isConfirmed = log.confirmationState === 'CONFIRMED_APPROVED'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Đối chiếu Lịch sử Thay đổi: [${log.requirementKeyCode}] - Phiên bản ${log.version}`}
      description={`Thay đổi được thực hiện bởi ${log.changedBy} lúc ${formatDate(log.changedAt)}`}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Trạng thái xác nhận:</span>
            {isConfirmed ? (
              <Badge tone="brand" dot>
                Đã duyệt chính thức (Confirmed)
              </Badge>
            ) : (
              <Badge tone="amber" dot>
                Bản sửa nháp chưa duyệt (Unconfirmed Stale Triggered)
              </Badge>
            )}
          </div>
          <Button variant="secondary" inline onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
        {/* Banner tóm tắt thay đổi */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Mã yêu cầu:</span>
              <span className="font-mono font-bold text-slate-900">{log.requirementKeyCode}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Phân loại sửa đổi:</span>
              <span className="font-semibold text-slate-900">
                {log.changeType === 'CONTENT'
                  ? 'Sửa nội dung văn bản'
                  : log.changeType === 'DIAGRAM'
                    ? 'Cập nhật sơ đồ quy trình'
                    : log.changeType === 'FIGMA_UI'
                      ? 'Cập nhật thiết kế Figma'
                      : 'Tạo mới mục yêu cầu'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Người thực hiện:</span>
              <span className="font-medium text-slate-900">{log.changedBy}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Thời gian:</span>
              <span className="font-medium text-slate-700">{formatDate(log.changedAt)}</span>
            </div>
          </div>
        </div>

        {/* Khung so sánh Side-by-Side: Content */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            1. Mô tả chi tiết Yêu cầu (Requirement Content)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-red-200 text-xs text-red-800 font-semibold">
                <span>Trước khi sửa (Previous)</span>
                <span className="font-mono text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Gốc</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                {log.previousContent || <i className="text-slate-400">Không có dữ liệu trước đó (Mục mới tạo)</i>}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200 text-xs text-emerald-800 font-semibold">
                <span>Sau khi sửa (New Revision)</span>
                <span className="font-mono text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Mới</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-medium">
                {log.newContent || <i className="text-slate-400">Đã bị xóa hoặc không thay đổi</i>}
              </p>
            </div>
          </div>
        </div>

        {/* Khung so sánh: Tiêu chí nghiệm thu (Acceptance Criteria) */}
        {(log.previousAcceptanceCriteria || log.newAcceptanceCriteria) && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              2. Tiêu chí nghiệm thu & Quy tắc (Acceptance Criteria)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5">
                <span className="text-[11px] font-semibold text-red-700 block mb-1">Tiêu chí cũ:</span>
                <p className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {log.previousAcceptanceCriteria || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
                <span className="text-[11px] font-semibold text-emerald-700 block mb-1">Tiêu chí mới:</span>
                <p className="text-xs text-slate-800 whitespace-pre-wrap font-mono font-medium">
                  {log.newAcceptanceCriteria || '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Khung so sánh: Sơ đồ Mermaid nếu có */}
        {(log.previousDiagram || log.newDiagram) && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              3. Mã nguồn Sơ đồ quy trình (Diagram Source Diff)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <pre className="rounded-xl border border-red-200 bg-slate-900 text-red-300 p-3 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {log.previousDiagram || '// Chưa có sơ đồ cũ'}
              </pre>
              <pre className="rounded-xl border border-emerald-200 bg-slate-900 text-emerald-300 p-3 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {log.newDiagram || '// Chưa có sơ đồ mới'}
              </pre>
            </div>
          </div>
        )}

        {/* Khung so sánh: Figma UI URL nếu có */}
        {(log.previousFigmaUrl || log.newFigmaUrl) && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              4. Liên kết Thiết kế Figma
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-2.5 truncate text-slate-600">
                {log.previousFigmaUrl || '—'}
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-2.5 truncate text-emerald-800 font-semibold">
                {log.newFigmaUrl || '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
