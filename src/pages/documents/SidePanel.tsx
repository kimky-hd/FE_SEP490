import { useState } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { CloseIcon } from '@/components/ui/icons'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { formatDate, formatRelative } from '@/lib/format'
import type {
  DocumentActivityDto,
  DocumentCommentDto,
  DocumentGenerationDto,
  DocumentVersionSummaryDto,
  Priority,
  RequirementItemDto,
} from '@/types/document'
import { Chip, DiagramIcon, FigmaIcon, IconButton, TableIcon, priorityLabel } from './docUi'
import { AiSparkleIcon } from '@/components/ui/icons'
import { MentionText, MentionTextarea, mentionIdsIn, type MentionPerson } from '@/components/work/MentionInput'
import type { CommentSummary } from './view/commentSummary'

export type PanelTab = 'reqs' | 'comments' | 'history'

type T = (vi: string, en: string) => string

export const activityLabel = (action: string, t: T) =>
  ({
    CREATED: t('Tạo trang', 'Created'),
    GENERATED_FROM_NOTES: t('Tạo từ ghi chú họp', 'Generated from meeting notes'),
    CONTENT_SAVED: t('Sửa nội dung', 'Edited'),
    SUBMITTED: t('Gửi duyệt', 'Submitted for review'),
    APPROVED: t('Phê duyệt', 'Approved'),
    CHANGES_REQUESTED: t('Yêu cầu chỉnh sửa', 'Changes requested'),
    REVISION_CREATED: t('Tạo bản sửa đổi', 'New revision'),
    RENAMED: t('Đổi tên', 'Renamed'),
    MOVED: t('Di chuyển', 'Moved'),
    REQ_CONFIRMED_FRESH: t('Xác nhận REQ đã cập nhật', 'Confirmed REQ is up to date'),
    COMMENTED: t('Bình luận', 'Commented'),
    DELETED: t('Xoá', 'Deleted'),
  })[action] ?? action

interface PanelProps {
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  onClose: () => void
  // Yêu cầu
  requirements: RequirementItemDto[]
  changedReqUids: Set<string> | null
  changedBlocksByReq: Map<string, number>
  canEditPriority: boolean
  canConfirm: boolean
  onPriority: (req: RequirementItemDto, p: Priority) => void
  onConfirmFresh: (req: RequirementItemDto) => void
  onSelectReq: (req: RequirementItemDto) => void
  onOpenAiLayout?: (req: RequirementItemDto) => void
  /** Số issue / testcase gắn với từng REQ (khi bật Kanban / Test cases). */
  linkCounts?: Map<string, { issues: number; tests: number }> | null
  // Bình luận
  /** Chỉ góp ý còn mở (đã xử lý không hiện). */
  comments: DocumentCommentDto[]
  /** "N đã xử lý · M còn mở" của bản đang xem; null = chưa biết. */
  commentSummary?: CommentSummary | null
  canComment: boolean
  pending: { anchorId: string; quote: string } | null
  activeCommentId: number | null
  onCancelPending: () => void
  /** D01: `parentId` = trả lời bình luận gốc; `mentionUserIds` = người được @nhắc. */
  onAddComment: (body: string, opts: { parentId: number | null; mentionUserIds: number[] }) => Promise<boolean>
  /** Thành viên dự án để @nhắc (trừ chính mình). */
  mentionPeople: MentionPerson[]
  onResolve: (c: DocumentCommentDto) => void
  onSelectComment: (c: DocumentCommentDto) => void
  // Lịch sử
  activity: DocumentActivityDto[]
  versions: DocumentVersionSummaryDto[]
  generation: DocumentGenerationDto | null
  reqKeyByUid: Map<string, string>
  onOpenActivity: (a: DocumentActivityDto) => void
  onHoverGeneratedReq: (reqUid: string | null) => void
  onSelectGeneratedReq: (reqUid: string) => void
}

export function SidePanel(props: PanelProps) {
  const { t } = useI18n()
  const { tab, onTab, onClose, requirements, comments } = props
  const tabs: { id: PanelTab; label: string; count?: number }[] = [
    { id: 'reqs', label: t('Yêu cầu', 'Requirements'), count: requirements.length },
    { id: 'comments', label: t('Bình luận', 'Comments'), count: comments.filter((c) => !c.parentId).length },
    { id: 'history', label: t('Lịch sử', 'History') },
  ]
  return (
    <aside aria-label={t('Bảng bên', 'Side panel')} className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-gray-200 px-3">
        <div role="tablist" className="flex flex-1 items-center gap-0.5">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => onTab(x.id)}
              className={clsx(
                'h-8 rounded-[6px] px-2.5 text-sm transition-colors',
                tab === x.id ? 'bg-gray-100 font-medium text-gray-950' : 'text-gray-600 hover:text-gray-950',
              )}
            >
              {x.label}
              {x.count !== undefined && <span className="ml-1 tabular-nums text-gray-500">{x.count}</span>}
            </button>
          ))}
        </div>
        <IconButton label={t('Đóng (Esc)', 'Close (Esc)')} onClick={onClose}>
          <CloseIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'reqs' && <RequirementsTab {...props} />}
        {tab === 'comments' && <CommentsTab {...props} />}
        {tab === 'history' && <HistoryTab {...props} />}
      </div>
    </aside>
  )
}

// ---------- Yêu cầu ----------

function RequirementsTab({
  requirements,
  changedReqUids,
  changedBlocksByReq,
  canEditPriority,
  canConfirm,
  onPriority,
  onConfirmFresh,
  onSelectReq,
  onOpenAiLayout,
  linkCounts,
}: PanelProps) {
  const { t } = useI18n()
  const [onlyChanged, setOnlyChanged] = useState(false)
  const isChanged = (r: RequirementItemDto) => (changedReqUids ? changedReqUids.has(r.reqUid) : r.changedSinceBaseline)
  const list = onlyChanged ? requirements.filter(isChanged) : requirements
  if (requirements.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-gray-500">
        {t(
          'Chưa có REQ. Bôi đen một tiêu đề và chọn "Đánh dấu REQ".',
          'No REQs yet. Select a heading and choose "Mark as REQ".',
        )}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {changedReqUids && (
        <Switch
          size="sm"
          checked={onlyChanged}
          onChange={setOnlyChanged}
          label={t('Chỉ REQ đã thay đổi', 'Only changed REQs')}
          className="w-full flex-row-reverse justify-between px-1 pb-1 [&>span]:font-normal [&>span]:text-gray-700"
        />
      )}
      {list.length === 0 && (
        <p className="px-1 py-4 text-sm text-gray-500">{t('Không có REQ nào thay đổi.', 'No changed REQs.')}</p>
      )}
      {list.map((r) => {
        const changed = isChanged(r)
        const stale = r.freshness === 'STALE'
        const blocks = changedBlocksByReq.get(r.reqUid) ?? 0
        const facts = [
          changed && blocks > 0
            ? t(`Đã sửa ${blocks} đoạn`, `${blocks} ${blocks === 1 ? 'block' : 'blocks'} edited`)
            : null,
          r.acceptanceCriteria.length
            ? t(`${r.acceptanceCriteria.length} tiêu chí`, `${r.acceptanceCriteria.length} criteria`)
            : null,
          linkCounts
            ? t(`${linkCounts.get(r.reqUid)?.issues ?? 0} issue`, `${linkCounts.get(r.reqUid)?.issues ?? 0} issues`)
            : null,
          linkCounts
            ? t(`${linkCounts.get(r.reqUid)?.tests ?? 0} test`, `${linkCounts.get(r.reqUid)?.tests ?? 0} tests`)
            : null,
        ].filter(Boolean)
        return (
          <div
            key={r.requirementId}
            className={clsx(
              'rounded-card border bg-white p-3 transition-colors',
              changed ? 'border-brand-200' : 'border-gray-200',
              stale && !changed && 'bg-gray-50/60',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip className={clsx(changed && 'border-brand-300 bg-white text-brand-700')}>{r.reqKey}</Chip>
              {stale ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 text-[11px] font-medium leading-[18px] text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Stale
                </span>
              ) : (
                <span className="rounded-full border border-success-200 bg-success-50 px-1.5 text-[11px] font-medium leading-[18px] text-success-700">
                  Fresh
                </span>
              )}
              <PrioritySegment value={r.priority} disabled={!canEditPriority} onChange={(p) => onPriority(r, p)} />
            </div>
            <button type="button" onClick={() => onSelectReq(r)} className="mt-2 block w-full text-left">
              <span className="block text-sm font-medium text-gray-950 hover:text-brand-700">{r.title || '—'}</span>
              {r.bodyPreview && (
                <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-gray-500">{r.bodyPreview}</span>
              )}
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
              {facts.map((f, i) => (
                <span key={i}>{f}</span>
              ))}
              {r.hasTable && <TableIcon className="h-3.5 w-3.5" aria-label={t('Có bảng', 'Has a table')} />}
              {r.hasDiagram && <DiagramIcon className="h-3.5 w-3.5" aria-label={t('Có sơ đồ', 'Has a diagram')} />}
              {r.hasFigma && (
                <FigmaIcon className="h-3.5 w-3.5" aria-label={t('Có khung Figma', 'Has a Figma frame')} />
              )}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => onOpenAiLayout?.(r)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60 shadow-2xs transition"
                title={t('Mở đề xuất khung giao diện mẫu do AI phác thảo', 'Open AI Layout Proposal')}
              >
                <AiSparkleIcon className="h-3 w-3 text-blue-600" />
                <span>{t('Đề xuất Giao diện mẫu', 'Layout Proposal')}</span>
              </button>
              {stale && canConfirm && (
                <button
                  type="button"
                  onClick={() => onConfirmFresh(r)}
                  className="font-medium text-brand-700 hover:underline text-xs"
                >
                  {t('Xác nhận đã cập nhật', 'Mark up to date')}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PrioritySegment({
  value,
  onChange,
  disabled,
}: {
  value: Priority
  onChange: (p: Priority) => void
  disabled: boolean
}) {
  const { t } = useI18n()
  const options: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
  if (disabled) {
    return (
      <span className={clsx('ml-auto text-[11px] font-medium', value === 'HIGH' ? 'text-red-700' : 'text-gray-500')}>
        {priorityLabel(value)}
      </span>
    )
  }
  return (
    <div
      role="group"
      aria-label={t('Độ ưu tiên', 'Priority')}
      className="ml-auto inline-flex rounded-[6px] border border-gray-200 bg-gray-50 p-px"
    >
      {options.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={p === value}
          onClick={() => onChange(p)}
          className={clsx(
            'rounded-[5px] px-1.5 text-[11px] font-medium leading-5',
            p === value
              ? p === 'HIGH'
                ? 'bg-white text-red-700 shadow-xs ring-1 ring-gray-200'
                : 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200'
              : 'text-gray-500 hover:text-gray-900',
          )}
        >
          {priorityLabel(p)}
        </button>
      ))}
    </div>
  )
}

// ---------- Bình luận ----------

const composerClass =
  'w-full resize-none border-0 p-1 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none'

/** Ô viết bình luận / trả lời có @nhắc tên (D01). */
function CommentComposer({
  people,
  placeholder,
  autoFocus,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  people: MentionPerson[]
  placeholder: string
  autoFocus?: boolean
  submitLabel: string
  onSubmit: (body: string, mentionUserIds: number[]) => Promise<boolean>
  onCancel?: () => void
}) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [picked, setPicked] = useState<MentionPerson[]>([])
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!body.trim() || busy) return
    setBusy(true)
    const ok = await onSubmit(body.trim(), mentionIdsIn(body, picked))
    setBusy(false)
    if (ok) {
      setBody('')
      setPicked([])
    }
  }
  return (
    <>
      <MentionTextarea
        value={body}
        onChange={setBody}
        people={people}
        onPick={(u) => setPicked((m) => (m.some((x) => x.userId === u.userId) ? m : [...m, u]))}
        onSubmit={() => void submit()}
        rows={2}
        maxLength={2000}
        autoFocus={autoFocus}
        ariaLabel={onCancel ? t('Viết trả lời', 'Write a reply') : t('Viết bình luận', 'Write a comment')}
        placeholder={placeholder}
        className={composerClass}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button inline variant="ghost" onClick={onCancel} className="lg:h-8">
            {t('Huỷ', 'Cancel')}
          </Button>
        )}
        <Button
          inline
          variant="secondary"
          isLoading={busy}
          disabled={!body.trim()}
          onClick={() => void submit()}
          className="lg:h-8"
        >
          {submitLabel}
        </Button>
      </div>
    </>
  )
}

function CommentsTab({
  comments,
  commentSummary,
  canComment,
  pending,
  activeCommentId,
  onCancelPending,
  onAddComment,
  onResolve,
  onSelectComment,
  mentionPeople,
}: PanelProps) {
  const { t } = useI18n()
  const [replyTo, setReplyTo] = useState<number | null>(null)
  // Trả lời 1 cấp: bình luận gốc theo thứ tự cũ trước, trả lời nằm dưới gốc của nó.
  const roots = comments.filter((c) => !c.parentId || !comments.some((x) => x.commentId === c.parentId))
  const repliesOf = (id: number) => comments.filter((c) => c.parentId === id)
  const meta = (c: DocumentCommentDto) => (
    <span className="truncate">
      {c.author.fullName} · {formatRelative(c.createdAt)}
    </span>
  )
  return (
    <div className="space-y-3">
      {commentSummary && commentSummary.resolved + commentSummary.open > 0 && (
        <p className="flex items-center gap-2 px-1 text-xs text-gray-500">
          <span className="font-medium text-gray-700">{t('Góp ý', 'Comments')}</span>
          <span className="tabular-nums">
            {t(`${commentSummary.resolved} đã xử lý`, `${commentSummary.resolved} resolved`)} ·{' '}
            <span className={clsx(commentSummary.open > 0 && 'font-medium text-amber-700')}>
              {t(`${commentSummary.open} còn mở`, `${commentSummary.open} open`)}
            </span>
          </span>
        </p>
      )}
      {canComment && (
        <div className="rounded-card border border-gray-200 p-2.5">
          {pending && (
            <div className="mb-2 flex items-start gap-2">
              <p className="line-clamp-2 flex-1 border-l-2 border-amber-300 pl-2 text-xs italic text-gray-600">
                {pending.quote}
              </p>
              <button type="button" onClick={onCancelPending} className="text-xs text-gray-500 hover:text-gray-900">
                {t('Bỏ trích', 'Unquote')}
              </button>
            </div>
          )}
          <CommentComposer
            key={pending?.anchorId ?? 'free'}
            people={mentionPeople}
            autoFocus={!!pending}
            placeholder={
              pending
                ? t('Bình luận về đoạn này… gõ @ để nhắc tên', 'Comment on this text… type @ to mention')
                : t('Viết bình luận… gõ @ để nhắc tên', 'Write a comment… type @ to mention')
            }
            submitLabel={t('Gửi', 'Post')}
            onSubmit={(body, mentionUserIds) => onAddComment(body, { parentId: null, mentionUserIds })}
          />
        </div>
      )}
      {roots.length === 0 && (
        <p className="px-1 py-4 text-center text-sm text-gray-500">
          {commentSummary?.resolved
            ? t('Mọi góp ý đã được xử lý.', 'All comments are resolved.')
            : t('Chưa có bình luận.', 'No comments yet.')}
        </p>
      )}
      {roots.map((c) => {
        const replies = repliesOf(c.commentId)
        return (
          <div
            key={c.commentId}
            id={`comment-${c.commentId}`}
            className={clsx(
              'rounded-card border p-3',
              c.commentId === activeCommentId ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200',
            )}
          >
            {c.quote && (
              <button
                type="button"
                onClick={() => onSelectComment(c)}
                className="mb-1.5 block w-full border-l-2 border-amber-300 pl-2 text-left text-xs italic text-gray-600 hover:text-gray-900"
              >
                <span className="line-clamp-2">{c.quote}</span>
              </button>
            )}
            <p className="whitespace-pre-wrap text-sm text-gray-900">
              <MentionText body={c.body} mentions={c.mentions} />
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
              {meta(c)}
              {canComment && (
                <span className="ml-auto flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => setReplyTo(replyTo === c.commentId ? null : c.commentId)}
                    className="font-medium text-gray-600 hover:text-gray-900 hover:underline"
                  >
                    {t('Trả lời', 'Reply')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolve(c)}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {t('Đã xử lý', 'Resolve')}
                  </button>
                </span>
              )}
            </div>
            {(replies.length > 0 || replyTo === c.commentId) && (
              <ul className="mt-2.5 space-y-2.5 border-l-2 border-gray-200 pl-3">
                {replies.map((r) => (
                  <li key={r.commentId} id={`comment-${r.commentId}`}>
                    <p className="whitespace-pre-wrap text-sm text-gray-900">
                      <MentionText body={r.body} mentions={r.mentions} />
                    </p>
                    <p className="mt-0.5 flex text-xs text-gray-500">{meta(r)}</p>
                  </li>
                ))}
                {replyTo === c.commentId && (
                  <li className="rounded-control border border-gray-200 p-2">
                    <CommentComposer
                      people={mentionPeople}
                      autoFocus
                      placeholder={t(`Trả lời ${c.author.fullName}…`, `Reply to ${c.author.fullName}…`)}
                      submitLabel={t('Trả lời', 'Reply')}
                      onCancel={() => setReplyTo(null)}
                      onSubmit={async (body, mentionUserIds) => {
                        const ok = await onAddComment(body, { parentId: c.commentId, mentionUserIds })
                        if (ok) setReplyTo(null)
                        return ok
                      }}
                    />
                  </li>
                )}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Lịch sử ----------

function HistoryTab({
  activity,
  versions,
  generation,
  reqKeyByUid,
  onOpenActivity,
  onHoverGeneratedReq,
  onSelectGeneratedReq,
}: PanelProps) {
  const { t } = useI18n()
  const labels = new Set(versions.map((v) => v.label))
  const rows = activity.filter((a) => a.action !== 'GENERATED_FROM_NOTES')
  return (
    <div className="space-y-2">
      {generation && (
        <GenerationCard
          generation={generation}
          reqKeyByUid={reqKeyByUid}
          onHover={onHoverGeneratedReq}
          onSelect={onSelectGeneratedReq}
        />
      )}
      {rows.length === 0 && !generation && (
        <p className="px-1 py-4 text-center text-sm text-gray-500">{t('Chưa có hoạt động.', 'No activity yet.')}</p>
      )}
      <ol className="space-y-1">
        {rows.map((a) => {
          const clickable = !!a.versionLabel && labels.has(a.versionLabel)
          const inner = (
            <>
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 text-sm text-gray-900">
                  {a.versionLabel && (
                    <span className="text-gray-500">{t(`Bản ${a.versionLabel}`, `v${a.versionLabel}`)} · </span>
                  )}
                  {activityLabel(a.action, t)}
                </span>
                <span className="shrink-0 text-xs text-gray-500">{formatRelative(a.createdAt)}</span>
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {a.actor.fullName}
                {a.note && <span className="text-gray-600"> · {a.note}</span>}
              </span>
            </>
          )
          return (
            <li key={a.activityId}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onOpenActivity(a)}
                  title={t('Mở bản này ở chế độ so sánh', 'Open this version in compare mode')}
                  className="block w-full rounded-control px-2.5 py-2 text-left hover:bg-gray-50"
                >
                  {inner}
                </button>
              ) : (
                <div className="px-2.5 py-2">{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function GenerationCard({
  generation,
  reqKeyByUid,
  onHover,
  onSelect,
}: {
  generation: DocumentGenerationDto
  reqKeyByUid: Map<string, string>
  onHover: (reqUid: string | null) => void
  onSelect: (reqUid: string) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(true)
  const [showFields, setShowFields] = useState(false)
  const [copied, setCopied] = useState(false)
  const lines = generation.rawNotes.split(/\r?\n/)
  const reqsOfLine = new Map<number, string[]>()
  for (const item of generation.items) {
    if (!item.reqUid) continue
    for (const i of item.sourceLines ?? []) reqsOfLine.set(i, [...(reqsOfLine.get(i) ?? []), item.reqUid])
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(generation.rawNotes)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  const fields: [string, string][] = [
    [t('Phạm vi', 'Scope'), generation.fields.scope],
    [t('Tác nhân', 'Actors'), generation.fields.actors],
    [t('Luồng chính', 'Main flows'), generation.fields.mainFlows],
    [t('Quy tắc', 'Rules'), generation.fields.businessRules],
  ]
  return (
    <div className="rounded-card border border-brand-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex-1 text-sm font-medium text-gray-950">
          {t('Tạo từ ghi chú họp', 'Generated from meeting notes')}
        </span>
        <span className="shrink-0 text-xs text-gray-500">
          {formatDate(generation.createdAt)} · {generation.createdBy.fullName}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div
            className="rounded-control bg-gray-50 p-2.5 text-[13px] leading-6 text-gray-700"
            onMouseLeave={() => onHover(null)}
          >
            {lines.map((line, i) => {
              if (!line.trim()) return null
              const uids = reqsOfLine.get(i) ?? []
              if (!uids.length) {
                return (
                  <p key={i} className="text-gray-600">
                    {line} <span className="text-gray-400">{t('(bỏ qua)', '(skipped)')}</span>
                  </p>
                )
              }
              return (
                <p
                  key={i}
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => onHover(uids[0])}
                  onFocus={() => onHover(uids[0])}
                  onClick={() => onSelect(uids[0])}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(uids[0])}
                  className="-mx-1 cursor-pointer rounded-[4px] bg-amber-100/80 px-1 hover:bg-amber-200/70"
                >
                  {line}{' '}
                  {[...new Set(uids)].map((u) => (
                    <Chip key={u} className="ml-0.5 bg-white align-[1px] text-[11px]">
                      {reqKeyByUid.get(u) ?? 'REQ'}
                    </Chip>
                  ))}
                </p>
              )
            })}
          </div>
          {showFields && (
            <dl className="mt-2 space-y-2 rounded-control border border-gray-200 p-2.5 text-xs">
              {fields.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium text-gray-700">{k}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-600">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-2 flex gap-3 text-xs font-medium">
            <button type="button" onClick={() => setShowFields((v) => !v)} className="text-brand-700 hover:underline">
              {showFields
                ? t('Ẩn 4 ô chuẩn hoá', 'Hide normalized fields')
                : t('Xem 4 ô chuẩn hoá', 'View normalized fields')}
            </button>
            <button type="button" onClick={() => void copy()} className="text-brand-700 hover:underline">
              {copied ? t('Đã sao chép', 'Copied') : t('Sao chép ghi chú', 'Copy notes')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
