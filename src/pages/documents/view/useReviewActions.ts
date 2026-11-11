import { useState } from 'react'
import { documentApi } from '@/api/documentApi'
import { useI18n } from '@/i18n'
import type { DocumentDetailDto } from '@/types/document'
import { docErrorMessage, errorCode } from '../docUi'
import type { ToastTone } from './Toast'
import type { PrimaryAction } from './DocumentTopBar'
import { approveBlockedBy, type CommentSummary } from './commentSummary'

interface Options {
  detail: DocumentDetailDto
  isLatest: boolean
  editableStatus: boolean
  /** Góp ý của bản đang xem; null = chưa biết (không chặn phê duyệt). */
  commentSummary: CommentSummary | null
  flush: () => Promise<void>
  onChanged: (next: DocumentDetailDto) => void
  onBackToLatest: () => void
  /** BE trả 409 OPEN_COMMENTS (đề xuất) → tải lại bình luận để nút Phê duyệt khoá đúng số. */
  onOpenCommentsConflict?: () => void
  notify: (text: string, tone?: ToastTone) => void
}

export function useReviewActions({
  detail,
  isLatest,
  editableStatus,
  commentSummary,
  flush,
  onChanged,
  onBackToLatest,
  onOpenCommentsConflict,
  notify,
}: Options) {
  const { t } = useI18n()
  const { node, current, can } = detail
  const documentId = node.documentId
  const versionId = current.versionId
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<DocumentDetailDto>, okText: string) => {
    setBusy(key)
    try {
      await flush()
      const next = await fn()
      onChanged(next)
      notify(okText)
      return next
    } catch (err) {
      notify(docErrorMessage(err), 'error')
      if (errorCode(err) === 'OPEN_COMMENTS') onOpenCommentsConflict?.()
      return null
    } finally {
      setBusy(null)
    }
  }

  const openComments = approveBlockedBy(commentSummary)
  const submit = () =>
    run('submit', () => documentApi.submit(documentId, versionId), t('Đã gửi duyệt.', 'Submitted for review.'))
  const approve = async () => {
    if (openComments > 0) return
    const next = await run('approve', () => documentApi.approve(documentId, versionId), t('Đã phê duyệt.', 'Approved.'))
    if (next) onBackToLatest()
  }
  const revise = async () => {
    const next = await run(
      'revise',
      () => documentApi.createRevision(documentId),
      t('Đã tạo bản nháp mới.', 'New draft created.'),
    )
    if (next) onBackToLatest()
  }
  const requestChanges = async (note: string) =>
    !!(await run(
      'changes',
      () => documentApi.requestChanges(documentId, versionId, note),
      t('Đã gửi yêu cầu chỉnh sửa.', 'Changes requested.'),
    ))

  const canReview = isLatest && current.status === 'IN_REVIEW' && can.approve
  let primary: PrimaryAction | null = null
  if (isLatest && editableStatus && can.edit)
    primary = { key: 'submit', label: t('Gửi duyệt', 'Submit for review'), onClick: () => void submit() }
  else if (canReview)
    // Còn góp ý mở → khoá nút, nhãn kèm số như mockup màn 4 ("Duyệt · còn 1 góp ý").
    primary =
      openComments > 0
        ? {
            key: 'approve',
            label: t(`Phê duyệt · còn ${openComments} góp ý`, `Approve · ${openComments} open`),
            onClick: () => void approve(),
            disabledReason: t(
              `Còn ${openComments} góp ý chưa xử lý — xử lý hết (đánh dấu "Đã xử lý") rồi mới phê duyệt được.`,
              `${openComments} open ${openComments === 1 ? 'comment' : 'comments'} — resolve them all before approving.`,
            ),
          }
        : { key: 'approve', label: t('Phê duyệt', 'Approve'), onClick: () => void approve() }
  else if (isLatest && current.status === 'APPROVED' && can.revise)
    primary = {
      key: 'revise',
      label: t('Chỉnh sửa (tạo bản nháp mới)', 'Edit (new draft)'),
      onClick: () => void revise(),
    }

  return { busy, primary, canReview, requestChanges }
}
