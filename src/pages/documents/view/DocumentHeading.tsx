import type { MutableRefObject } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { formatDate, formatRelative } from '@/lib/format'
import type { DocumentActivityDto, DocumentDetailDto, DocumentGenerationDto } from '@/types/document'
import { Chip } from '../docUi'
import { VersionPopover } from '../VersionPopover'
import type { CommentSummary } from './commentSummary'

interface Props {
  detail: DocumentDetailDto
  isLatest: boolean
  activity: DocumentActivityDto[]
  generation: DocumentGenerationDto | null
  baseLabel: string | null
  changeCount: number
  compare: boolean
  onToggleCompare: () => void
  onOpenVersion: (versionId: number) => void
  onCompareVersions: (a: number, b: number) => void
  onOpenHistory: () => void
  /** Tóm tắt góp ý của bản đang xem (null = chưa biết / không xem được bình luận). */
  commentSummary: CommentSummary | null
  onOpenComments: () => void
  onBackToLatest: () => void
  canRename: boolean
  editable: boolean
  titleRef: MutableRefObject<HTMLTextAreaElement | null>
  onRename: (title: string) => void
  onSubtitleChange: (subtitle: string) => void
  onTitleEnter: () => void
}

export function DocumentHeading({
  detail,
  isLatest,
  activity,
  generation,
  baseLabel,
  changeCount,
  compare,
  onToggleCompare,
  onOpenVersion,
  onCompareVersions,
  onOpenHistory,
  commentSummary,
  onOpenComments,
  onBackToLatest,
  canRename,
  editable,
  titleRef,
  onRename,
  onSubtitleChange,
  onTitleEnter,
}: Props) {
  const { t } = useI18n()
  const { node, current, versions } = detail
  const readOnlyText =
    isLatest && current.status === 'APPROVED'
      ? t('Đã duyệt · chỉ đọc', 'Approved · read-only')
      : !isLatest
        ? t('Bản cũ · chỉ đọc', 'Older version · read-only')
        : null

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-gray-500">
        {node.code && <Chip>{node.code}</Chip>}
        <VersionPopover
          code={node.code}
          versions={versions}
          viewing={current}
          isLatest={isLatest}
          baselineVersionId={node.baselineVersionId}
          activity={activity}
          onOpen={onOpenVersion}
          onCompare={onCompareVersions}
          onOpenHistory={onOpenHistory}
        />
        {!isLatest && (
          <button type="button" onClick={onBackToLatest} className="text-sm font-medium text-brand-700 hover:underline">
            {t('Về bản mới nhất', 'Back to latest')}
          </button>
        )}
        <span>
          {current.author.fullName} · {formatRelative(current.updatedAt)}
        </span>
        {baseLabel !== null && changeCount > 0 && (
          <button
            type="button"
            onClick={onToggleCompare}
            aria-pressed={compare}
            title={compare ? t('Tắt so sánh', 'Exit compare') : t('Bật chế độ so sánh', 'Turn on compare mode')}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
              compare
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-brand-200 bg-white text-brand-800 hover:bg-brand-50',
            )}
          >
            <span className={clsx('h-1.5 w-1.5 rounded-full', compare ? 'bg-white' : 'bg-brand-600')} />
            {t(
              `${changeCount} thay đổi so với ${baseLabel}`,
              `${changeCount} ${changeCount === 1 ? 'change' : 'changes'} vs v${baseLabel}`,
            )}
          </button>
        )}
        {generation && (
          <span>
            {t(
              `Tạo từ ghi chú họp ${formatDate(generation.createdAt).slice(0, 5)}`,
              `From meeting notes ${formatDate(generation.createdAt)}`,
            )}
          </span>
        )}
        {readOnlyText && <span className="text-gray-500">· {readOnlyText}</span>}
        {commentSummary && commentSummary.resolved + commentSummary.open > 0 && (
          <button
            type="button"
            onClick={onOpenComments}
            title={t('Mở bảng bình luận', 'Open comments')}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
              commentSummary.open > 0
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-success-200 bg-success-50 text-success-700 hover:bg-success-100',
            )}
          >
            {t('Góp ý:', 'Comments:')}{' '}
            {t(
              `${commentSummary.resolved} đã xử lý · ${commentSummary.open} còn mở`,
              `${commentSummary.resolved} resolved · ${commentSummary.open} open`,
            )}
          </button>
        )}
      </div>

      {canRename ? (
        <textarea
          key={node.title}
          rows={1}
          defaultValue={node.title}
          maxLength={200}
          aria-label={t('Tiêu đề trang', 'Page title')}
          ref={(el) => {
            titleRef.current = el
            watchAutoGrow(el)
          }}
          onInput={(e) => autoGrow(e.currentTarget)}
          onBlur={(e) => onRename(e.target.value.replace(/\s+/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onTitleEnter()
            }
          }}
          className="mt-3 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[34px] font-bold leading-tight tracking-tight text-gray-950 placeholder:text-gray-300 focus:outline-none focus:ring-0"
        />
      ) : (
        <h1 className="mt-3 text-[34px] font-bold leading-tight tracking-tight text-gray-950">{node.title}</h1>
      )}
      {editable ? (
        <input
          defaultValue={current.subtitle ?? ''}
          placeholder={t('Thêm mô tả ngắn…', 'Add a short description…')}
          aria-label={t('Mô tả ngắn', 'Short description')}
          onChange={(e) => onSubtitleChange(e.target.value)}
          className="mt-1.5 w-full border-0 bg-transparent p-0 text-[15px] text-gray-500 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        />
      ) : (
        current.subtitle && <p className="mt-1.5 text-[15px] text-gray-500">{current.subtitle}</p>
      )}

      {current.status === 'CHANGES_REQUESTED' && current.reviewNote && (
        <p className="mt-4 rounded-control bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">
            {t(
              `${current.reviewedBy?.fullName ?? ''} yêu cầu chỉnh sửa:`,
              `${current.reviewedBy?.fullName ?? ''} requested changes:`,
            )}
          </span>{' '}
          {current.reviewNote}
        </p>
      )}
    </>
  )
}

/** Ô tiêu đề nhiều dòng tự giãn theo nội dung. */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// Tính lại cả khi bề ngang đổi (mở/đóng bảng bên phải, đổi cỡ cửa sổ) và khi font tải xong,
// không thì tiêu đề dài bị cắt vì chiều cao chỉ đo một lần lúc mount.
// Chỉ có một ô tiêu đề trên màn hình: React gọi ref với null khi gỡ ô cũ → ngắt observer.
let titleObserver: ResizeObserver | null = null
function watchAutoGrow(el: HTMLTextAreaElement | null) {
  titleObserver?.disconnect()
  titleObserver = null
  if (!el) return
  autoGrow(el)
  let lastWidth = el.clientWidth
  titleObserver = new ResizeObserver(() => {
    if (el.clientWidth === lastWidth) return
    lastWidth = el.clientWidth
    autoGrow(el)
  })
  titleObserver.observe(el)
  void document.fonts?.ready.then(() => autoGrow(el))
}
