import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { issueApi } from '@/api/issueApi'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CloseIcon, TrashIcon } from '@/components/ui/icons'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatRelative } from '@/lib/format'
import { onDataChanged } from '@/lib/dataEvents'
import { useI18n } from '@/i18n'
import { MentionText, MentionTextarea, mentionIdsIn } from '@/components/work/MentionInput'
import type { BoardStatus } from '@/lib/workflowBoard'
import {
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  type IssueActivityDto,
  type IssueCommentDto,
  type IssueDetailDto,
  type IssuePriority,
  type IssueType,
  type RequirementRef,
  type SprintDto,
  type UserRef,
} from '@/types/issue'
import { IssueCreateModal } from './IssueCreateModal'
import { ReqPicker } from './ReqPicker'
import { reqCompareHref } from './reqLinks'
import {
  CodeChip,
  inlineSelect,
  issueTypeLabel,
  PersonDot,
  priorityLabel,
  ReqChip,
  ResultPill,
  TypeIcon,
} from './workUi'

// Chi tiết issue ở bảng bên phải (mockup khung 1b) — không rời board; URL `?issue=CORE-104`.
// Trường sửa được theo `can`; trạng thái chỉ hiện các bước workflow cho phép (cũng là cách đổi trạng thái bằng bàn phím).

export function IssueDrawer({
  projectId,
  issueId,
  statuses,
  sprints,
  assignees,
  me,
  onClose,
  notify,
}: {
  projectId: number
  issueId: number
  statuses: BoardStatus[]
  sprints: SprintDto[]
  assignees: UserRef[]
  me: UserRef | null
  onClose: () => void
  notify: (text: string, tone?: 'ok' | 'error') => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [issue, setIssue] = useState<IssueDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState<IssueCommentDto[]>([])
  const [activity, setActivity] = useState<IssueActivityDto[] | null>(null)
  const [reqOpen, setReqOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([issueApi.get(issueId), issueApi.comments(issueId).catch(() => [])])
      setIssue(d)
      setComments(c)
      setError(null)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }, [issueId])

  useEffect(() => {
    setIssue(null)
    setActivity(null)
    void load()
  }, [load])
  useEffect(() => onDataChanged(() => void load()), [load])

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, issueId])

  const run = async (fn: () => Promise<IssueDetailDto | void>, ok?: string) => {
    try {
      const next = await fn()
      if (next) setIssue(next)
      if (ok) notify(ok)
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
      void load()
    }
  }

  const statusName = (id: number) => statuses.find((s) => s.statusId === id)?.name ?? '—'
  const can = issue?.can

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-30 bg-gray-950/10 lg:bg-transparent" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="complementary"
        aria-label={issue ? `${issue.key} · ${issue.title}` : t('Chi tiết issue', 'Issue details')}
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-200 bg-white shadow-[-16px_0_32px_-16px_rgba(16,24,40,0.25)] focus:outline-none sm:w-[480px]"
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 px-4 text-[13px] text-gray-500">
          {issue && <TypeIcon type={issue.type} />}
          <span className="font-medium text-gray-700">{issue?.key ?? '…'}</span>
          <span className="flex-1" />
          {can?.delete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label={t('Xoá issue', 'Delete issue')}
              className="flex h-9 w-9 items-center justify-center rounded-control text-gray-500 hover:bg-gray-100 hover:text-red-700"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Đóng', 'Close')}
            className="flex h-9 w-9 items-center justify-center rounded-control text-gray-500 hover:bg-gray-100 hover:text-gray-950"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {error && !issue ? (
          <p className="p-5 text-sm text-red-700">{error}</p>
        ) : !issue ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <span className="block h-6 w-3/4 rounded bg-gray-100" />
            <span className="block h-4 w-1/2 rounded bg-gray-100" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
            <EditableTitle
              value={issue.title}
              disabled={!can?.edit}
              onSave={(title) => run(() => issueApi.update(issue.issueId, { title }))}
            />

            <dl className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-[13px]">
              <dt className="text-gray-500">{t('Trạng thái', 'Status')}</dt>
              <dd>
                <select
                  aria-label={t('Trạng thái', 'Status')}
                  value={issue.statusId}
                  disabled={!can?.changeStatus || issue.allowedTransitions.length === 0}
                  onChange={(e) => {
                    const to = Number(e.target.value)
                    void run(
                      () => issueApi.transition(issue.issueId, { toStatusId: to }),
                      t(`Đã chuyển sang ${statusName(to)}`, `Moved to ${statusName(to)}`),
                    )
                  }}
                  className={clsx(inlineSelect, 'border-brand-200 bg-brand-50 font-medium text-brand-800')}
                >
                  <option value={issue.statusId}>{statusName(issue.statusId)}</option>
                  {issue.allowedTransitions.map((x) => (
                    <option key={x.toStatusId} value={x.toStatusId}>
                      → {x.name}
                    </option>
                  ))}
                </select>
                {can?.changeStatus && issue.allowedTransitions.length === 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    {t('Vai trò của bạn không chuyển tiếp được', 'Your role has no next step here')}
                  </span>
                )}
              </dd>
              <dt className="text-gray-500">{t('Người làm', 'Assignee')}</dt>
              <dd className="flex items-center gap-2">
                <PersonDot user={issue.assignee} />
                <select
                  aria-label={t('Người làm', 'Assignee')}
                  value={issue.assignee?.userId ?? ''}
                  disabled={!can?.assign}
                  onChange={(e) =>
                    void run(() =>
                      issueApi.update(issue.issueId, { assigneeId: e.target.value ? Number(e.target.value) : null }),
                    )
                  }
                  className={clsx(inlineSelect, 'min-w-0 flex-1')}
                >
                  <option value="">{t('Chưa giao', 'Unassigned')}</option>
                  {assignees.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </dd>
              <dt className="text-gray-500">{t('Loại · Ưu tiên', 'Type · Priority')}</dt>
              <dd className="flex flex-wrap gap-2">
                <select
                  aria-label={t('Loại', 'Type')}
                  value={issue.type}
                  disabled={!can?.edit}
                  onChange={(e) =>
                    void run(() => issueApi.update(issue.issueId, { type: e.target.value as IssueType }))
                  }
                  className={inlineSelect}
                >
                  {ISSUE_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {issueTypeLabel(x)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t('Ưu tiên', 'Priority')}
                  value={issue.priority}
                  disabled={!can?.edit}
                  onChange={(e) =>
                    void run(() => issueApi.update(issue.issueId, { priority: e.target.value as IssuePriority }))
                  }
                  className={inlineSelect}
                >
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel(p)}
                    </option>
                  ))}
                </select>
              </dd>
              {issue.parentId === null && (
                <>
                  <dt className="text-gray-500">{t('Sprint · Điểm', 'Sprint · Points')}</dt>
                  <dd className="flex flex-wrap gap-2">
                    <select
                      aria-label="Sprint"
                      value={issue.sprintId ?? ''}
                      disabled={!can?.edit}
                      onChange={(e) =>
                        void run(() =>
                          issueApi.update(issue.issueId, { sprintId: e.target.value ? Number(e.target.value) : null }),
                        )
                      }
                      className={inlineSelect}
                    >
                      <option value="">Backlog</option>
                      {sprints
                        .filter((s) => s.status !== 'COMPLETED' || s.sprintId === issue.sprintId)
                        .map((s) => (
                          <option key={s.sprintId} value={s.sprintId}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <PointsInput
                      value={issue.points}
                      disabled={!can?.edit}
                      onSave={(points) => run(() => issueApi.update(issue.issueId, { points }))}
                    />
                  </dd>
                </>
              )}
            </dl>

            <Section
              title={t('Yêu cầu liên kết', 'Linked requirements')}
              action={
                can?.edit ? (
                  <SectionAction onClick={() => setReqOpen(true)}>{t('+ Gắn REQ', '+ Link REQ')}</SectionAction>
                ) : null
              }
            >
              {issue.requirements.length === 0 ? (
                <Empty>{t('Chưa gắn REQ nào.', 'No REQ linked yet.')}</Empty>
              ) : (
                <ul className="divide-y divide-gray-200 rounded-card border border-gray-200">
                  {issue.requirements.map((r) => (
                    <li key={`${r.documentId}-${r.reqUid}`} className="px-3 py-2 text-[13px]">
                      <div className="flex items-center gap-2">
                        <ReqChip req={r} />
                        <span className="min-w-0 flex-1 truncate text-gray-800">
                          {r.title ?? t('REQ đã bị xoá khỏi tài liệu', 'REQ was removed from the document')}
                        </span>
                        <button
                          type="button"
                          onClick={async () => navigate(await reqCompareHref(projectId, r.documentId, r.reqUid))}
                          className="shrink-0 font-medium text-brand-700 hover:underline"
                        >
                          {r.changedNote ? t('Xem đổi gì', 'See what changed') : t('Mở', 'Open')}
                        </button>
                      </div>
                      {r.changedNote && (
                        <p className="mt-1 text-xs text-amber-800">
                          {r.documentCode} · {r.changedNote}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {issue.reqChanged && can?.edit && (
                <div className="mt-2 flex items-center gap-2 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                  <span className="flex-1">
                    {t(
                      'REQ đã đổi sau khi bạn nhận việc. Xem rồi xác nhận.',
                      'The REQ changed after you took this on. Review, then confirm.',
                    )}
                  </span>
                  <Button
                    inline
                    variant="secondary"
                    className="lg:h-8"
                    onClick={() =>
                      void run(
                        () => issueApi.ackRequirements(issue.issueId),
                        t('Đã xác nhận REQ', 'REQ change acknowledged'),
                      )
                    }
                  >
                    {t('Đã xem', 'Got it')}
                  </Button>
                </div>
              )}
            </Section>

            <Section
              title="Testcase"
              action={
                <Link
                  to={`/projects/${projectId}/tests`}
                  className="text-[12.5px] font-medium text-brand-700 hover:underline"
                >
                  {t('Kho testcase', 'Test repository')}
                </Link>
              }
            >
              {issue.testCases.length === 0 ? (
                <Empty>{t('Chưa có testcase liên kết.', 'No linked test cases.')}</Empty>
              ) : (
                <ul className="divide-y divide-gray-200 rounded-card border border-gray-200">
                  {issue.testCases.map((tc) => (
                    <li key={tc.testCaseId} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                      <ResultPill result={tc.lastResult} />
                      <span className="min-w-0 flex-1 truncate text-gray-800">{tc.title}</span>
                      <CodeChip>{tc.key}</CodeChip>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {issue.parentId === null && (
              <Section
                title={t('Việc con', 'Subtasks')}
                action={
                  can?.edit ? (
                    <SectionAction onClick={() => setSubOpen(true)}>{t('+ Thêm', '+ Add')}</SectionAction>
                  ) : null
                }
              >
                {issue.subtasks.length === 0 ? (
                  <Empty>{t('Chưa có việc con.', 'No subtasks.')}</Empty>
                ) : (
                  <ul className="divide-y divide-gray-200 rounded-card border border-gray-200">
                    {issue.subtasks.map((s) => {
                      const done = statuses.find((x) => x.statusId === s.statusId)?.category === 'DONE'
                      return (
                        <li key={s.issueId} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                          <span
                            aria-hidden="true"
                            className={clsx(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px]',
                              done ? 'border-success-500 bg-success-500 text-white' : 'border-gray-300',
                            )}
                          >
                            {done ? '✓' : ''}
                          </span>
                          <span
                            className={clsx(
                              'min-w-0 flex-1 truncate',
                              done ? 'text-gray-500 line-through' : 'text-gray-800',
                            )}
                          >
                            {s.title}
                          </span>
                          <span className="sr-only">{statusName(s.statusId)}</span>
                          <PersonDot user={s.assignee} size={22} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
            )}

            <Section title={t('Mô tả', 'Description')}>
              <DescriptionField
                value={issue.description ?? ''}
                disabled={!can?.edit}
                onSave={(description) => run(() => issueApi.update(issue.issueId, { description }))}
              />
            </Section>

            <Section title={t('Bình luận', 'Comments')}>
              {comments.length > 0 && (
                <ul className="mb-3 space-y-3">
                  {comments.map((c) => (
                    <li key={c.commentId} className="flex gap-2.5 text-[13px]">
                      <PersonDot user={c.author} size={24} />
                      <div className="min-w-0">
                        <p className="text-gray-500">
                          <span className="font-medium text-gray-900">{c.author.fullName}</span> ·{' '}
                          {formatRelative(c.createdAt)}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-gray-800">
                          <MentionText body={c.body} mentions={c.mentions} />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <CommentBox
                people={assignees.filter((u) => u.userId !== me?.userId)}
                onSend={async (body, mentionUserIds) => {
                  try {
                    await issueApi.addComment(issue.issueId, { body, mentionUserIds })
                    setComments(await issueApi.comments(issue.issueId))
                    return true
                  } catch (err) {
                    notify(apiErrorMessage(err), 'error')
                    return false
                  }
                }}
              />
            </Section>

            <details
              className="text-[13px]"
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open && activity === null)
                  void issueApi.activity(issue.issueId).then(setActivity, () => setActivity([]))
              }}
            >
              <summary className="cursor-pointer text-gray-500 hover:text-gray-800">{t('Lịch sử', 'History')}</summary>
              <ul className="mt-2 space-y-1.5 text-gray-600">
                {(activity ?? []).map((a) => (
                  <li key={a.activityId}>
                    <span className="font-medium text-gray-800">{a.actor.fullName}</span> · {activityLabel(a.action, t)}
                    {a.note ? ` · ${a.note}` : ''}{' '}
                    <span className="text-gray-400">· {formatRelative(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </aside>

      {issue && (
        <Modal
          open={reqOpen}
          onClose={() => setReqOpen(false)}
          title={t('Gắn REQ', 'Link REQs')}
          footer={
            <Button inline onClick={() => setReqOpen(false)}>
              {t('Xong', 'Done')}
            </Button>
          }
        >
          <ReqPicker
            projectId={projectId}
            value={issue.requirements.map((r) => ({ documentId: r.documentId, reqUid: r.reqUid }))}
            onChange={(refs: RequirementRef[]) => void run(() => issueApi.setRequirements(issue.issueId, refs))}
          />
        </Modal>
      )}
      {issue && (
        <IssueCreateModal
          open={subOpen}
          onClose={() => setSubOpen(false)}
          projectId={projectId}
          sprints={sprints}
          assignees={assignees}
          canAssign={!!can?.assign}
          me={me}
          defaults={{ parentId: issue.issueId, assigneeId: me?.userId ?? null }}
          onCreated={() => void load()}
        />
      )}
      {issue && (
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          tone="danger"
          title={t(`Xoá ${issue.key}?`, `Delete ${issue.key}?`)}
          description={t('Việc con cũng bị xoá.', 'Subtasks are deleted too.')}
          footer={
            <>
              <Button inline variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t('Huỷ', 'Cancel')}
              </Button>
              <Button
                inline
                className="bg-red-600 hover:bg-red-700"
                onClick={async () => {
                  try {
                    await issueApi.remove(issue.issueId)
                    setConfirmDelete(false)
                    notify(t(`Đã xoá ${issue.key}`, `${issue.key} deleted`))
                    onClose()
                  } catch (err) {
                    notify(apiErrorMessage(err), 'error')
                  }
                }}
              >
                {t('Xoá', 'Delete')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-700">{issue.title}</p>
        </Modal>
      )}
    </>
  )
}

const activityLabel = (action: IssueActivityDto['action'], t: (vi: string, en: string) => string) =>
  ({
    CREATED: t('tạo issue', 'created the issue'),
    UPDATED: t('sửa', 'edited'),
    TRANSITIONED: t('đổi trạng thái', 'changed status'),
    ASSIGNED: t('giao việc', 'assigned'),
    SPRINT_CHANGED: t('đổi sprint', 'moved sprint'),
    REQ_LINKED: t('gắn REQ', 'linked REQs'),
    REQ_ACKED: t('xác nhận REQ đổi', 'acknowledged REQ change'),
    REQ_CHANGED: t('REQ liên kết đổi', 'linked REQ changed'),
    COMMENTED: t('bình luận', 'commented'),
    DELETED: t('xoá', 'deleted'),
  })[action] ?? action

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center">
        <h3 className="text-[12.5px] font-medium text-gray-500">{title}</h3>
        <span className="ml-auto">{action}</span>
      </div>
      {children}
    </section>
  )
}

function SectionAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-[12.5px] font-medium text-brand-700 hover:underline">
      {children}
    </button>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-[13px] text-gray-500">{children}</p>

function EditableTitle({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  if (disabled) return <h2 className="text-lg font-semibold tracking-tight text-gray-950">{value}</h2>
  return (
    <textarea
      aria-label={t('Tiêu đề issue', 'Issue title')}
      value={draft}
      rows={draft.length > 42 ? 2 : 1}
      maxLength={300}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft.trim() !== value && onSave(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
      className="-mx-1.5 w-[calc(100%+12px)] resize-none rounded-control border border-transparent px-1.5 py-1 text-lg font-semibold leading-snug tracking-tight text-gray-950 hover:border-gray-200 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
    />
  )
}

function PointsInput({
  value,
  disabled,
  onSave,
}: {
  value: number | null
  disabled: boolean
  onSave: (v: number | null) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  useEffect(() => setDraft(value === null ? '' : String(value)), [value])
  return (
    <label className="inline-flex items-center gap-1.5 text-gray-500">
      <input
        type="number"
        min={0}
        max={100}
        aria-label={t('Điểm', 'Points')}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft === '' ? null : Number(draft)
          if (next !== value) onSave(next)
        }}
        className={clsx(inlineSelect, 'w-16')}
      />
      {t('điểm', 'pts')}
    </label>
  )
}

function DescriptionField({
  value,
  disabled,
  onSave,
}: {
  value: string
  disabled: boolean
  onSave: (v: string | null) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  if (disabled) return <p className="whitespace-pre-wrap text-[13px] text-gray-700">{value || '—'}</p>
  return (
    <textarea
      aria-label={t('Mô tả', 'Description')}
      value={draft}
      rows={3}
      maxLength={10_000}
      placeholder={t('Thêm mô tả…', 'Add a description…')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft.trim() || null)}
      className="w-full rounded-card border border-gray-200 px-3 py-2 text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
    />
  )
}

/** Ô bình luận có chọn @tên: gõ @ hiện danh sách thành viên, chọn để chèn tên. */
function CommentBox({
  people,
  onSend,
}: {
  people: UserRef[]
  onSend: (body: string, mentionUserIds: number[]) => Promise<boolean>
}) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<UserRef[]>([])
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    if (await onSend(text.trim(), mentionIdsIn(text, picked))) {
      setText('')
      setPicked([])
    }
    setBusy(false)
  }

  return (
    <div>
      <MentionTextarea
        value={text}
        onChange={setText}
        people={people}
        onPick={(u) => setPicked((m) => (m.some((x) => x.userId === u.userId) ? m : [...m, u]))}
        onSubmit={() => void send()}
        maxLength={2000}
        ariaLabel={t('Viết bình luận', 'Write a comment')}
        placeholder={t('Viết bình luận… gõ @ để nhắc tên', 'Write a comment… type @ to mention')}
        className="w-full rounded-card border border-gray-300 px-3 py-2 text-[13px] placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
      {text.trim() && (
        <div className="mt-2 flex justify-end">
          <Button inline className="lg:h-8" onClick={() => void send()} isLoading={busy}>
            {t('Gửi', 'Send')}
          </Button>
        </div>
      )}
    </div>
  )
}
