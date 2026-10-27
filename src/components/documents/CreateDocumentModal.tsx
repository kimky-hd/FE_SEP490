import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { SelectField } from '@/components/ui/SelectField'
import { Button } from '@/components/ui/Button'
import type { DocumentType, SpecificationDocument } from '@/types/document'

interface CreateDocumentModalProps {
  open: boolean
  onClose: () => void
  projectId: number
  onCreate: (doc: Omit<SpecificationDocument, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  existingCount?: number
}

export function CreateDocumentModal({
  open,
  onClose,
  projectId,
  onCreate,
  existingCount = 0,
}: CreateDocumentModalProps) {
  const [docType, setDocType] = useState<DocumentType>('SRS')
  const [code, setCode] = useState(`SRS-0${existingCount + 1}`)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('v1.0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Vui lòng nhập tên tài liệu đặc tả')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await onCreate({
        projectId,
        code: code.trim().toUpperCase() || 'SRS-01',
        title: title.trim(),
        docType,
        version: version.trim() || 'v1.0',
        status: 'DRAFT',
        description: description.trim() || null,
        createdBy: 'Sarah Lin (Tenant Admin)',
      })
      onClose()
    } catch {
      setError('Có lỗi xảy ra khi tạo tài liệu. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Khởi tạo Bộ Tài liệu Đặc tả mới"
      description="Tạo một bộ tài liệu đặc tả yêu cầu (SRS, URD hoặc BRD) để quản lý các mục yêu cầu và ma trận truy xuất."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" inline onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button inline onClick={handleSubmit} isLoading={isSubmitting}>
            Khởi tạo Tài liệu →
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Loại tài liệu đặc tả"
            value={docType}
            onChange={(e) => {
              const nextType = e.target.value as DocumentType
              setDocType(nextType)
              setCode(`${nextType}-0${existingCount + 1}`)
            }}
          >
            <option value="SRS">SRS - System / Software Requirement</option>
            <option value="URD">URD - User Requirement Document</option>
            <option value="BRD">BRD - Business Requirement Document</option>
          </SelectField>

          <TextField
            label="Mã bộ tài liệu"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SRS-01"
          />
        </div>

        <TextField
          label="Tên bộ tài liệu đặc tả"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: SRS - Phân hệ Quản lý Tài khoản & Giao dịch"
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Phiên bản khởi tạo"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="v1.0"
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái ban đầu</label>
            <div className="h-10 px-3 flex items-center rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-700 font-medium">
              Bản nháp (DRAFT - Có thể chỉnh sửa)
            </div>
          </div>
        </div>

        <TextAreaField
          label="Mô tả phạm vi tóm tắt"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả ngắn gọn về phạm vi chức năng, đối tượng phục vụ và mục tiêu nghiệm thu…"
        />
      </form>
    </Modal>
  )
}
