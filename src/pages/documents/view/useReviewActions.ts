import { useState } from 'react'
import { documentApi } from '@/api/documentApi'
import { useI18n } from '@/i18n'
import type { DocumentDetailDto } from '@/types/document'
import { docErrorMessage } from '../docUi'
import type { ToastTone } from './Toast'
import type { PrimaryAction } from './DocumentTopBar'

interface Options {
  detail: DocumentDetailDto
  isLatest: boolean
  editableStatus: boolean
  flush: () => Promise<void>
  onChanged: (next: DocumentDetailDto) => void
  onBackToLatest: () => void
  notify: (text: string, tone?: ToastTone) => void
}

export function useReviewActions({
  detail,
  isLatest,
  editableStatus,
  flush,
  onChanged,
  onBackToLatest,
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
      return null
    } finally {
      setBusy(null)
    }
  }

  const submit = () =>
    run('submit', () => documentApi.submit(documentId, versionId), t('Đã gửi duyệt.', 'Submitted for review.'))
  const approve = async () => {
    const next = await run('approve', () => documentApi.approve(documentId, versionId), t('Đã phê duyệt.', 'Approved.'))
    if (next) onBackToLatest()
  }
  const revise = async () => {
    const next = await run(
      'revise',
      () => documentApi.createRevision(documentId),
      t('Đã tạo bản sửa đổi.', 'New revision created.'),
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
  else if (canReview) primary = { key: 'approve', label: t('Phê duyệt', 'Approve'), onClick: () => void approve() }
  else if (isLatest && current.status === 'APPROVED' && can.revise)
    primary = { key: 'revise', label: t('Tạo bản sửa đổi', 'New revision'), onClick: () => void revise() }

  return { busy, primary, canReview, requestChanges }
}
