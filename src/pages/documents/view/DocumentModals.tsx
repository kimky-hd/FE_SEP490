import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextAreaField } from '@/components/ui/TextAreaField'
import type { TipTapNode } from '@/types/document'
import type { VersionConflictCurrent } from '@/types/auth'
import { formatDateTime } from '@/lib/format'
import { MermaidPreview } from '../editor/nodeViews'

const REQUEST_CHANGES_FORM = 'request-changes'
const NOTE_MIN = 5

export function RequestChangesModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  onSubmit: (note: string) => void | Promise<void>
}) {
  const { t } = useI18n()
  return (
    <Modal
      open={open}
      title={t('Yêu cầu chỉnh sửa', 'Request changes')}
      onClose={onClose}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline type="submit" form={REQUEST_CHANGES_FORM} isLoading={busy}>
            {t('Gửi yêu cầu', 'Send request')}
          </Button>
        </>
      }
    >
      <form
        id={REQUEST_CHANGES_FORM}
        onSubmit={(e) => {
          e.preventDefault()
          const note = String(new FormData(e.currentTarget).get('note') ?? '').trim()
          if (note.length >= NOTE_MIN) void onSubmit(note)
        }}
      >
        <TextAreaField
          name="note"
          label={t('Cần sửa gì?', 'What needs to change?')}
          rows={4}
          required
          minLength={NOTE_MIN}
          maxLength={1000}
        />
      </form>
    </Modal>
  )
}

export function ConflictModal({
  open,
  current,
  onClose,
  onReload,
}: {
  open: boolean
  /** D19: người / lúc lưu bản trên máy chủ (body lỗi `current`), null nếu BE không gửi. */
  current?: VersionConflictCurrent | null
  onClose: () => void
  onReload: () => void
}) {
  const { t } = useI18n()
  const who = current?.updatedBy?.fullName
  const at = current?.updatedAt ? formatDateTime(current.updatedAt) : null
  return (
    <Modal
      open={open}
      title={t('Trang vừa được người khác lưu', 'Someone else saved this page')}
      description={t(
        'Tải lại để xem bản mới nhất. Thay đổi chưa lưu của bạn sẽ mất.',
        'Reload to see the latest version. Your unsaved changes will be lost.',
      )}
      onClose={onClose}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Để sau', 'Later')}
          </Button>
          <Button inline onClick={onReload}>
            {t('Tải lại', 'Reload')}
          </Button>
        </>
      }
    >
      {who && (
        <p className="mb-2 text-sm font-medium text-gray-900">
          {at ? t(`${who} vừa lưu lúc ${at}.`, `${who} saved at ${at}.`) : t(`${who} vừa lưu.`, `${who} just saved.`)}
        </p>
      )}
      <p className="text-sm text-gray-600">
        {t('Tự lưu đã tạm dừng cho tới khi bạn tải lại.', 'Autosave is paused until you reload.')}
      </p>
    </Modal>
  )
}

export function BlockCompareModal({
  pair,
  baseLabel,
  currentLabel,
  onClose,
}: {
  pair: { before: TipTapNode | null; after: TipTapNode | null } | null
  baseLabel: string
  currentLabel: string
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <Modal open={!!pair} size="lg" title={t('Trước / sau', 'Before / after')} onClose={onClose}>
      {pair && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(['before', 'after'] as const).map((side) => (
            <div key={side} className="min-w-0 rounded-card border border-gray-200 p-3">
              <p className="mb-2 text-xs font-medium text-gray-500">
                {side === 'before'
                  ? t(`Bản ${baseLabel}`, `v${baseLabel}`)
                  : t(`Bản ${currentLabel}`, `v${currentLabel}`)}
              </p>
              <BlockPreview block={pair[side]} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function BlockPreview({ block }: { block: TipTapNode | null }) {
  const { t } = useI18n()
  if (!block) return <p className="text-sm text-gray-500">{t('(không có)', '(none)')}</p>
  if (block.type === 'codeBlock' && block.attrs?.language === 'mermaid') {
    const code = (block.content ?? []).map((c) => c.text ?? '').join('')
    return <MermaidPreview code={code} />
  }
  if (block.type === 'figmaFrame') {
    return (
      <div className="text-sm">
        <p className="font-medium text-gray-900">{String(block.attrs?.title || t('Khung Figma', 'Figma frame'))}</p>
        <p className="break-all text-xs text-gray-500">{String(block.attrs?.url ?? '')}</p>
      </div>
    )
  }
  return (
    <pre className="whitespace-pre-wrap text-xs text-gray-700">
      {(block.content ?? []).map((c) => c.text ?? '').join('')}
    </pre>
  )
}
