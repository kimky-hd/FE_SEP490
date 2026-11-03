import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { CheckIcon } from '@/components/ui/icons'
import { documentApi } from '@/api/documentApi'
import { SAMPLE_NOTES } from '@/api/mock/documentGenerator'
import type {
  DocType,
  DocumentDetailDto,
  DocumentNodeDto,
  ExtractedRequirement,
  NormalizedFields,
  Priority,
} from '@/types/document'
import { ChevronRight, DOC_TYPES, docErrorMessage, docTypeLabel, errorCode, priorityLabel } from './docUi'

const MAX = 20_000
const NEXT_PRIORITY: Record<Priority, Priority> = { HIGH: 'MEDIUM', MEDIUM: 'LOW', LOW: 'HIGH' }

interface Props {
  open: boolean
  onClose: () => void
  projectId: number
  aiEnabled: boolean
  /** D09: người dùng có `ai.use` (thiếu thì BE trả 403 cho #19–#21). */
  canUseAi?: boolean
  folders: DocumentNodeDto[]
  defaultParentId: number | null
  onCreated: (detail: DocumentDetailDto) => void
}

export function GenerateWizard({
  open,
  onClose,
  projectId,
  aiEnabled,
  canUseAi = true,
  folders,
  defaultParentId,
  onCreated,
}: Props) {
  const { t } = useI18n()
  const [step, setStep] = useState<1 | 2>(1)
  const [notes, setNotes] = useState('')
  const [parentId, setParentId] = useState<number | null>(defaultParentId)
  const [docType, setDocType] = useState<DocType>('SRS')
  const [fields, setFields] = useState<NormalizedFields | null>(null)
  const [fieldsDirty, setFieldsDirty] = useState(false)
  const [items, setItems] = useState<(ExtractedRequirement & { include: boolean })[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState<null | 'draft' | 'extract' | 'create'>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiOff, setAiOff] = useState(!aiEnabled || !canUseAi)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setFields(null)
    setItems([])
    setError(null)
    setParentId(defaultParentId)
    setAiOff(!aiEnabled || !canUseAi)
  }, [open, defaultParentId, aiEnabled, canUseAi])

  const fail = (err: unknown) => {
    if (errorCode(err) === 'AI_DISABLED') setAiOff(true)
    else setError(docErrorMessage(err))
  }

  const extract = async (f: NormalizedFields) => {
    const list = await documentApi.extract(projectId, f, notes)
    setItems(list.map((i) => ({ ...i, include: true })))
    setFieldsDirty(false)
  }

  const makeDraft = async () => {
    setBusy('draft')
    setError(null)
    try {
      const f = await documentApi.normalize(projectId, notes)
      setFields(f)
      await extract(f)
      if (!title.trim()) setTitle(f.scope.split(/[,.;]/)[0].slice(0, 80))
      setStep(2)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const reExtract = async () => {
    if (!fields) return
    setBusy('extract')
    setError(null)
    try {
      await extract(fields)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const create = async () => {
    if (!fields) return
    setBusy('create')
    setError(null)
    try {
      const detail = await documentApi.createFromNotes(projectId, {
        title: title.trim(),
        docType,
        parentId,
        rawNotes: notes,
        fields,
        items: items.filter((i) => i.include).map(({ include: _include, ...rest }) => rest),
      })
      onCreated(detail)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const chosen = items.filter((i) => i.include).length
  const tooShort = notes.trim().length < 20

  const stepper = (
    <ol className="mb-5 flex items-center gap-3 text-sm" aria-label={t('Các bước', 'Steps')}>
      {[t('Ghi chú', 'Notes'), t('Xem lại', 'Review')].map((label, i) => {
        const n = (i + 1) as 1 | 2
        const done = step > n
        const active = step === n
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            {i > 0 && <span className="h-px w-10 bg-gray-300" aria-hidden="true" />}
            <span
              className={clsx(
                'flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
                done
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : active
                    ? 'border-brand-600 text-brand-700'
                    : 'border-gray-300 text-gray-500',
              )}
            >
              {done ? <CheckIcon className="h-3 w-3" /> : n}
            </span>
            <span className={active ? 'font-medium text-gray-950' : 'text-gray-500'}>{label}</span>
          </li>
        )
      })}
    </ol>
  )

  const footer =
    step === 1 ? (
      <>
        <span className="mr-auto self-center text-sm text-gray-500">
          {t('Ghi chú gốc được lưu kèm tài liệu.', 'The original notes are kept with the document.')}
        </span>
        <Button inline variant="secondary" onClick={onClose}>
          {t('Huỷ', 'Cancel')}
        </Button>
        <Button inline onClick={() => void makeDraft()} isLoading={busy === 'draft'} disabled={tooShort || aiOff}>
          {t('Tạo bản nháp', 'Create draft')}
          <ChevronRight />
        </Button>
      </>
    ) : (
      <>
        <Button inline variant="ghost" className="mr-auto" onClick={() => setStep(1)}>
          {t('← Sửa ghi chú', '← Edit notes')}
        </Button>
        <span className="self-center text-sm tabular-nums text-gray-500">
          {t(`${chosen}/${items.length} yêu cầu`, `${chosen}/${items.length} requirements`)}
        </span>
        <Button
          inline
          onClick={() => void create()}
          isLoading={busy === 'create'}
          disabled={!title.trim() || chosen === 0 || aiOff}
        >
          {t('Tạo tài liệu', 'Create document')}
        </Button>
      </>
    )

  return (
    <Modal
      open={open}
      size="lg"
      onClose={onClose}
      title={t('Tạo tài liệu từ ghi chú họp', 'Create a document from meeting notes')}
      description={
        step === 1
          ? t('Dán ghi chú thô, SSAM tách thành các yêu cầu.', 'Paste raw notes; SSAM splits them into requirements.')
          : t('Kiểm tra lại các yêu cầu trước khi tạo.', 'Review the requirements before creating.')
      }
      footer={footer}
    >
      {stepper}
      {aiOff && !canUseAi && aiEnabled && (
        <div className="mb-4">
          <Alert tone="warning">
            {t(
              'Vai trò của bạn chưa được cấp quyền dùng AI (ai.use). Nhờ quản trị cấp quyền để tạo tài liệu từ ghi chú.',
              'Your role lacks the AI permission (ai.use). Ask an admin to grant it to turn notes into a document.',
            )}
          </Alert>
        </div>
      )}
      {aiOff && (canUseAi || !aiEnabled) && (
        <div className="mb-4">
          <Alert tone="warning">
            {t(
              'Dự án đang tắt module AI nên chưa tạo được tài liệu từ ghi chú. ',
              'The AI module is off for this project, so notes can’t be turned into a document. ',
            )}
            <Link to={`/projects/${projectId}/settings`} className="font-medium underline underline-offset-2">
              {t('Mở cài đặt dự án', 'Open project settings')}
            </Link>
          </Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="gen-notes" className="text-sm font-medium text-gray-900">
                {t('Ghi chú họp', 'Meeting notes')}
              </label>
              <button
                type="button"
                onClick={() => setNotes(SAMPLE_NOTES)}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                {t('Dùng ví dụ', 'Use an example')}
              </button>
            </div>
            <textarea
              id="gen-notes"
              data-autofocus
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, MAX))}
              rows={11}
              placeholder={t(
                '- khách muốn thanh toán bằng QR động…\n- mã QR chỉ hiệu lực 15 phút…',
                '- customers want to pay with a dynamic QR…\n- the QR code expires after 15 minutes…',
              )}
              className="w-full resize-y rounded-control border border-gray-300 bg-white px-3 py-2.5 text-sm leading-6 text-gray-900 shadow-xs placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
            <div className="mt-1.5 flex justify-between text-xs text-gray-500">
              <span>{t('Mỗi ý một dòng sẽ tách chính xác hơn.', 'One idea per line splits more accurately.')}</span>
              <span className="tabular-nums">
                {notes.length.toLocaleString('vi-VN')} / {MAX.toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('Lưu vào', 'Save to')}
              id="gen-parent"
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t('Gốc', 'Top level')}</option>
              {folders.map((f) => (
                <option key={f.documentId} value={f.documentId}>
                  {f.title}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t('Loại tài liệu', 'Document type')}
              id="gen-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
            >
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>
                  {docTypeLabel(d)}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      )}

      {step === 2 && fields && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <TextField
              id="gen-title"
              label={t('Tên tài liệu', 'Document title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <SelectField
              label={t('Loại', 'Type')}
              id="gen-type-2"
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
            >
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>
                  {docTypeLabel(d)}
                </option>
              ))}
            </SelectField>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-900">
              {t(`${items.length} yêu cầu được tách ra`, `${items.length} requirements found`)}
            </p>
            {items.length === 0 ? (
              <p className="rounded-card border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                {t(
                  'Không tách được yêu cầu nào. Sửa ghi chú hoặc ô "Luồng chính" rồi tách lại.',
                  'No requirements found. Edit the notes or the "Main flows" field and try again.',
                )}
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded-card border border-gray-200">
                {items.map((item, i) => {
                  const update = (patch: Partial<(typeof items)[number]>) =>
                    setItems((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
                  return (
                    <li
                      key={item.tempId}
                      className={clsx('flex items-start gap-3 px-3.5 py-3', !item.include && 'bg-gray-50/60')}
                    >
                      <input
                        type="checkbox"
                        checked={item.include}
                        onChange={(e) => update({ include: e.target.checked })}
                        aria-label={t(`Đưa "${item.title}" vào tài liệu`, `Include "${item.title}"`)}
                        className="mt-1.5 h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <div className="min-w-0 flex-1">
                        <input
                          value={item.title}
                          onChange={(e) => update({ title: e.target.value })}
                          aria-label={t('Tên yêu cầu', 'Requirement title')}
                          disabled={!item.include}
                          className="w-full rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 -ml-1 text-sm font-medium text-gray-950 hover:border-gray-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:text-gray-400"
                        />
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {item.include
                            ? [
                                item.acceptanceCriteria.length
                                  ? t(
                                      `${item.acceptanceCriteria.length} tiêu chí`,
                                      `${item.acceptanceCriteria.length} criteria`,
                                    )
                                  : t('Chưa có tiêu chí', 'No criteria'),
                                item.acceptanceCriteria[0],
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : t('Bỏ chọn: không đưa vào tài liệu', 'Excluded from the document')}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!item.include}
                        onClick={() => update({ priority: NEXT_PRIORITY[item.priority] })}
                        title={t('Bấm để đổi độ ưu tiên', 'Click to change priority')}
                        aria-label={t(
                          `Độ ưu tiên: ${priorityLabel(item.priority)}`,
                          `Priority: ${priorityLabel(item.priority)}`,
                        )}
                        className={clsx(
                          'mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium disabled:opacity-50',
                          item.priority === 'HIGH'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-gray-50 text-gray-600',
                        )}
                      >
                        {priorityLabel(item.priority)}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-gray-700">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
              <span className="font-medium">{t('Chi tiết chuẩn hoá', 'Normalized details')}</span>
              <span className="text-gray-500">
                {t('(phạm vi, tác nhân, luồng, quy tắc)', '(scope, actors, flows, rules)')}
              </span>
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['scope', t('Phạm vi', 'Scope'), 2],
                  ['actors', t('Tác nhân', 'Actors'), 2],
                  ['mainFlows', t('Luồng nghiệp vụ chính', 'Main flows'), 5],
                  ['businessRules', t('Quy tắc & ràng buộc', 'Rules & constraints'), 5],
                ] as const
              ).map(([key, label, rows]) => (
                <div key={key}>
                  <label htmlFor={`gen-${key}`} className="mb-1.5 block text-sm font-medium text-gray-900">
                    {label}
                  </label>
                  <textarea
                    id={`gen-${key}`}
                    rows={rows}
                    value={fields[key]}
                    onChange={(e) => {
                      setFields({ ...fields, [key]: e.target.value })
                      setFieldsDirty(true)
                    }}
                    className="w-full resize-y rounded-control border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              ))}
            </div>
            {fieldsDirty && (
              <div className="mt-3 flex justify-end">
                <Button inline variant="secondary" onClick={() => void reExtract()} isLoading={busy === 'extract'}>
                  {t('Tách lại', 'Split again')}
                </Button>
              </div>
            )}
          </details>
        </div>
      )}
    </Modal>
  )
}
