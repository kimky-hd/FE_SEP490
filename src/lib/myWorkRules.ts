import type { DocumentVersionSummaryDto } from '@/types/document'
import { sortWorkItems, DOCUMENT_WORK_KINDS, type WorkItemDto, type WorkKind } from '@/types/work'
import type { ProjectRoleKind } from './projectRole'

// "Việc của tôi" phía giao diện: dựng một dòng hiển thị (biểu tượng, tiêu đề, dòng phụ, nhãn lý do, MỘT nút) từ
// WorkItemDto của GET /me/work-items (doc/BE-Changes-2026-10-28_30-API.md §B.2). Luật CHỌN việc nằm ở BE
// (mock: src/api/mock/docWorkRules.ts, src/api/mock/issueWorkRules.ts); ở đây chỉ trình bày.

export type WorkTone = 'bad' | 'warn' | 'blue'
export type WorkLetter = 'D' | 'R' | 'C' | 'N' | 'M' | 'A' | 'I' | 'T'
/** Nhóm để đếm (thẻ số trên trang Tổng quan) và để tô chấm trên menu. */
export type WorkCategory = 'review' | 'changes' | 'comment' | 'req' | 'draft' | 'activity' | 'issue' | 'test'

export type { WorkKind }

export type WorkAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'confirmFresh'; label: string; requirementId: number; href: string }

export interface WorkItem {
  id: string
  kind: WorkKind
  category: WorkCategory
  letter: WorkLetter
  tone: WorkTone
  title: string
  /** Mã hiển thị dạng chip ở dòng phụ (SRS-02, REQ-01…). */
  code: string | null
  sub: string
  reason: string
  action: WorkAction
  /** Càng lớn càng gấp. */
  urgency: number
  at: string
  projectId: number
  projectName: string
  projectKey: string
  /** Trang tài liệu liên quan; 0 với việc issue / testcase. */
  documentId: number
  /** Issue của dòng này có REQ vừa đổi (để tô chấm Kanban kể cả khi dòng thuộc loại gấp hơn). */
  reqChanged?: boolean
  /** Số mục gộp trong dòng, mặc định 1. */
  count?: number
}

type T = (vi: string, en: string) => string

const docHref = (projectId: number, documentId: number, query = '') =>
  `/projects/${projectId}/documents/${documentId}${query}`

export const issueHref = (projectId: number, key: string) =>
  `/projects/${projectId}/kanban?issue=${encodeURIComponent(key)}`

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/** Bản đã duyệt ngay trước `versionId` (để so sánh "REQ vừa đổi" của lần duyệt gần nhất). */
export function previousApproved(versions: DocumentVersionSummaryDto[], versionId: number): number | null {
  const current = versions.find((v) => v.versionId === versionId)
  const older = versions
    .filter((v) => v.versionId !== versionId && (v.status === 'SUPERSEDED' || v.status === 'APPROVED'))
    .filter((v) => !current || v.createdAt <= current.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return older[0]?.versionId ?? null
}

/** Link tới trang tài liệu của dòng: `?v=` khi cần mở bản khác bản hiện tại, `?cmp=` khi so sánh. */
function workDocHref(d: WorkItemDto): string {
  const q = [d.versionId ? `v=${d.versionId}` : null, d.compareToVersionId ? `cmp=${d.compareToVersionId}` : null]
    .filter(Boolean)
    .join('&')
  return docHref(d.projectId, d.documentId ?? 0, q ? `?${q}` : '')
}

/** Link tới bảng testcase (Test cases v2) theo môi trường / module / case của dòng việc. */
export function testsHref(projectId: number, ref: WorkItemDto['testRun'], filter: 'untest' | 'retest'): string {
  const q = new URLSearchParams({ tab: 'sheet', filter })
  if (ref?.envId) q.set('env', String(ref.envId))
  if (ref?.moduleId) q.set('module', String(ref.moduleId))
  if (ref?.testCaseId && filter === 'retest') q.set('tc', String(ref.testCaseId))
  return `/projects/${projectId}/tests?${q.toString()}`
}

/** WorkItemDto → dòng hiển thị theo ngôn ngữ hiện tại. */
export function toWorkItem(d: WorkItemDto, t: T): WorkItem {
  const n = d.count ?? 1
  const label = d.versionLabel ?? ''
  const base = {
    id: d.id,
    kind: d.kind,
    urgency: d.urgency,
    at: d.at,
    projectId: d.projectId,
    projectName: d.projectName,
    projectKey: d.projectKey,
    documentId: d.documentId ?? 0,
    code: d.code,
    title: d.title,
    ...(d.count !== null && d.count !== undefined ? { count: d.count } : {}),
    ...(d.issue ? { reqChanged: d.issue.reqChanged } : {}),
  }
  const link = (text: string, href = workDocHref(d)): WorkAction => ({ kind: 'link', label: text, href })
  const reqTitle = d.requirement ? `${d.requirement.reqKey} · ${d.requirement.title}` : d.title
  const issueLink = (text: string) => link(text, issueHref(d.projectId, d.issue?.key ?? d.code ?? ''))
  // Test cases v2: mở bảng testcase đúng môi trường / module, lọc "Chưa test" hoặc "Cần test lại", trỏ tới case.
  const runHref = (filter: 'untest' | 'retest') => testsHref(d.projectId, d.testRun, filter)

  switch (d.kind) {
    case 'CHANGES_REQUESTED':
      return {
        ...base,
        category: 'changes',
        letter: 'D',
        tone: 'bad',
        sub: d.actor
          ? t(`${d.actor.fullName} yêu cầu sửa`, `${d.actor.fullName} requested changes`) +
            (d.note ? `: “${clip(d.note, 60)}”` : '')
          : t(`Tài liệu · bản ${label}`, `Document · v${label}`),
        reason: t('Bị yêu cầu sửa', 'Changes requested'),
        action: link(t('Sửa', 'Edit')),
      }
    case 'REVIEW':
      return {
        ...base,
        category: 'review',
        letter: 'D',
        tone: 'blue',
        title: t(`${d.title} · bản ${label}`, `${d.title} · v${label}`),
        sub: [
          d.actor ? t(`${d.actor.fullName} gửi duyệt`, `Sent by ${d.actor.fullName}`) : t('Chờ duyệt', 'In review'),
          d.note,
        ]
          .filter(Boolean)
          .join(' · '),
        reason: t('Chờ duyệt', 'To review'),
        action: link(t('Xem & duyệt', 'Review')),
      }
    case 'COMMENT_REPLY':
    case 'MENTION': {
      const who = d.comment?.author.fullName ?? ''
      const reply = d.kind === 'COMMENT_REPLY'
      return {
        ...base,
        category: 'comment',
        letter: 'C',
        tone: 'warn',
        title: `“${clip(d.comment?.body ?? '')}”`,
        sub: reply ? t(`Bình luận của ${who}`, `Comment by ${who}`) : t(`${who} nhắc bạn`, `${who} mentioned you`),
        reason: reply ? t('Chờ bạn trả lời', 'Awaiting your reply') : t('Nhắc tới bạn', 'Mentions you'),
        action: link(reply ? t('Trả lời', 'Reply') : t('Xem', 'View')),
      }
    }
    case 'STALE_REQ': {
      const common = { ...base, category: 'req' as const, letter: 'R' as const, tone: 'warn' as const }
      if (!d.requirement)
        return {
          ...common,
          title: t(`${n} REQ chưa được xác nhận`, `${n} ${n === 1 ? 'REQ' : 'REQs'} not confirmed`),
          sub: t(`${d.title} · sau lần duyệt ${label}`, `${d.title} · since v${label}`),
          reason: t('REQ cũ', 'Stale REQs'),
          action: link(t('Xem', 'View')),
        }
      if (d.roleKind === 'BA' && d.requirement.requirementId !== null)
        return {
          ...common,
          title: reqTitle,
          sub: t(`Stale sau lần duyệt ${label}`, `Stale since v${label} was approved`),
          reason: t('REQ cũ', 'Stale REQ'),
          action: {
            kind: 'confirmFresh',
            label: t('Xác nhận', 'Confirm'),
            requirementId: d.requirement.requirementId,
            href: workDocHref(d),
          },
        }
      return {
        ...common,
        title: reqTitle,
        sub: t(`Đổi trong bản ${label} vừa duyệt`, `Changed in v${label}, just approved`),
        reason: d.roleKind === 'QA' ? t('Cần cập nhật test', 'Update tests') : t('REQ vừa đổi', 'REQ changed'),
        action: link(t('Xem thay đổi', 'See changes')),
      }
    }
    case 'REQ_CHANGING':
      return {
        ...base,
        category: 'req',
        letter: 'R',
        tone: 'blue',
        title: n === 1 && d.requirement ? reqTitle : t(`${n} REQ sắp thay đổi`, `${n} REQs changing soon`),
        sub: [n === 1 ? null : d.note, t(`bản ${label} đang chờ duyệt`, `v${label} in review`)]
          .filter(Boolean)
          .join(' · '),
        reason: t('Sắp thay đổi', 'Changing soon'),
        action: link(t('Xem thay đổi', 'See changes')),
      }
    case 'DRAFT':
      return {
        ...base,
        category: 'draft',
        letter: 'D',
        tone: 'blue',
        sub: t(`Bản nháp ${label}`, `Draft v${label}`),
        reason: t('Đang viết', 'Writing'),
        action: link(t('Tiếp tục', 'Continue')),
      }
    case 'RECENT_ACTIVITY': {
      const who = d.actor?.fullName ?? ''
      const approved = d.activity === 'APPROVED'
      return {
        ...base,
        category: 'activity',
        letter: 'A',
        tone: 'blue',
        sub: approved
          ? t(`${who} đã duyệt bản ${label}`, `${who} approved v${label}`)
          : t(`${who} gửi duyệt bản ${label}`, `${who} submitted v${label}`),
        reason: approved ? t('Vừa duyệt', 'Just approved') : t('Vừa gửi duyệt', 'Just submitted'),
        action: link(t('Xem', 'View')),
      }
    }
    case 'TEST_FAILED_MINE':
      return {
        ...base,
        category: 'changes',
        letter: 'I',
        tone: 'bad',
        sub: d.testRun
          ? t(
              `Lỗi ở ${d.testRun.testCaseKey} · ${d.testRun.title}`,
              `Failed in ${d.testRun.testCaseKey} · ${d.testRun.title}`,
            )
          : t('Test lỗi', 'Test failed'),
        reason: t('Test lỗi', 'Test failed'),
        action: issueLink(t('Xem lỗi', 'View bug')),
      }
    case 'ISSUE_REQ_CHANGED':
      return {
        ...base,
        category: 'req',
        letter: 'I',
        tone: 'warn',
        sub: d.note || t('REQ liên kết vừa đổi', 'A linked REQ changed'),
        reason: t('REQ đổi', 'REQ changed'),
        action: issueLink(t('Xem thay đổi', 'See changes')),
      }
    case 'ISSUE_READY_TO_CLOSE': {
      const total = d.issue?.testTotal ?? 0
      const status = d.issue?.statusName ?? ''
      return {
        ...base,
        category: 'issue',
        letter: 'I',
        tone: 'blue',
        sub: t(`${status} · ${total} test đều đạt`, `${status} · all ${total} tests pass`),
        reason: t('Sẵn sàng đóng', 'Ready to close'),
        action: issueLink(t('Chuyển Xong', 'Move to done')),
      }
    }
    case 'ISSUE_ASSIGNED': {
      const points = d.issue?.points ?? null
      return {
        ...base,
        category: 'issue',
        letter: 'I',
        tone: 'blue',
        sub: [d.issue?.statusName, points !== null ? t(`${points} điểm`, `${points} pts`) : null]
          .filter(Boolean)
          .join(' · '),
        reason: t('Giao cho bạn', 'Assigned to you'),
        action: issueLink(t('Mở', 'Open')),
      }
    }
    case 'TEST_RERUN':
      return {
        ...base,
        category: 'test',
        letter: 'T',
        tone: 'warn',
        sub: [d.testRun?.cycleName ?? '', d.note || t('Testcase đã đổi', 'Test case changed')].join(' · '),
        reason: t('Cần test lại', 'Retest needed'),
        action: link(t('Test lại', 'Retest'), runHref('retest')),
      }
    case 'TEST_NOT_RUN':
      return {
        ...base,
        category: 'test',
        letter: 'T',
        tone: 'blue',
        title: n === 1 ? d.title : t(`${n} testcase chưa test`, `${n} test cases not tested yet`),
        code: n === 1 ? d.code : null,
        sub: d.testRun?.cycleName ?? '',
        reason: t('Chưa test', 'Not tested'),
        action: link(t('Test', 'Test'), runHref('untest')),
      }
    case 'REQ_WITHOUT_TEST': {
      return {
        ...base,
        category: 'test',
        letter: 'R',
        tone: 'warn',
        title: n === 1 && d.requirement ? reqTitle : t(`${n} REQ chưa có testcase`, `${n} REQs without test cases`),
        sub: n === 1 ? `${d.code ?? ''} · ${d.title}` : (d.note ?? ''),
        reason: t('Thiếu test', 'No tests'),
        // Sinh testcase chỉ mở từ tab Đối chiếu REQ (lọc REQ chưa có testcase của tài liệu này).
        action: link(
          t('+ Testcase', '+ Test case'),
          `/projects/${d.projectId}/tests?tab=trace&trace=NO_TESTS&doc=${d.documentId ?? 0}`,
        ),
      }
    }
  }
}

export function sortWork(items: WorkItem[]): WorkItem[] {
  return sortWorkItems(items)
}

/** Một dòng tóm tắt dưới lời chào: việc gấp nhất bằng lời. */
export function workSummary(items: WorkItem[], t: T, role?: ProjectRoleKind): string {
  const count = (c: WorkCategory) => items.filter((x) => x.category === c).length
  const changes = items.find((x) => x.category === 'changes')
  if (changes) return `${changes.code ? `${changes.code}: ` : ''}${changes.sub}.`
  const reviews = count('review')
  const reviewLine = t(
    `${reviews} bản đang chờ bạn duyệt.`,
    `${reviews} ${reviews === 1 ? 'version is' : 'versions are'} waiting for your review.`,
  )
  // QA / Dev / Designer quan tâm REQ đổi trước; người viết / PM quan tâm bản chờ duyệt trước.
  const reqFirst = role === 'QA' || role === 'DEV' || role === 'DESIGNER'
  if (reviews > 0 && !reqFirst) return reviewLine
  const changed = items.filter((x) => x.category === 'req' && x.tone !== 'blue').reduce((n, x) => n + (x.count ?? 1), 0)
  if (changed > 0)
    return t(
      `${changed} REQ thay đổi sau lần duyệt gần nhất.`,
      `${changed} ${changed === 1 ? 'REQ' : 'REQs'} changed since the last approval.`,
    )
  const upcoming = items.filter((x) => x.category === 'req').reduce((n, x) => n + (x.count ?? 1), 0)
  if (upcoming > 0)
    return t(
      `${upcoming} REQ sắp thay đổi trong bản đang chờ duyệt.`,
      `${upcoming} ${upcoming === 1 ? 'REQ is' : 'REQs are'} changing in a version under review.`,
    )
  if (reviews > 0) return reviewLine
  const comments = count('comment')
  if (comments > 0)
    return t(
      `${comments} bình luận chờ bạn.`,
      `${comments} ${comments === 1 ? 'comment' : 'comments'} waiting for you.`,
    )
  const drafts = count('draft')
  if (drafts > 0)
    return t(`${drafts} bản nháp bạn đang viết.`, `${drafts} ${drafts === 1 ? 'draft' : 'drafts'} in progress.`)
  const tests = items.filter((x) => x.category === 'test').reduce((n, x) => n + (x.count ?? 1), 0)
  if (tests > 0)
    return t(`${tests} lượt test chờ bạn chạy.`, `${tests} test ${tests === 1 ? 'run' : 'runs'} waiting for you.`)
  const issues = count('issue')
  if (issues > 0)
    return t(`${issues} issue đang giao cho bạn.`, `${issues} ${issues === 1 ? 'issue' : 'issues'} assigned to you.`)
  if (items.length > 0) return t('Hoạt động mới trong dự án.', 'Recent activity in the project.')
  return t('Không có việc nào cần bạn lúc này.', 'Nothing needs you right now.')
}

/** Chấm tín hiệu trên menu: đỏ = bị yêu cầu sửa, cam = có thay đổi / bản cần xem. */
export type SignalDot = 'red' | 'orange' | null

export function documentsSignal(items: WorkItem[]): SignalDot {
  const docs = items.filter((x) => DOCUMENT_WORK_KINDS.includes(x.kind))
  if (docs.some((x) => x.tone === 'bad')) return 'red'
  if (docs.some((x) => x.category === 'review' || x.category === 'req' || x.category === 'comment')) return 'orange'
  return null
}

/** Kanban: cam khi issue của tôi có REQ vừa đổi. */
export function kanbanSignal(items: WorkItem[]): SignalDot {
  return items.some((x) => x.kind === 'ISSUE_REQ_CHANGED' || x.reqChanged) ? 'orange' : null
}

/** Test cases: đỏ khi lượt chạy của tôi cần chạy lại, hoặc bug của tôi sinh từ lượt chạy lỗi. */
export function testsSignal(items: WorkItem[]): SignalDot {
  return items.some((x) => x.kind === 'TEST_RERUN' || x.kind === 'TEST_FAILED_MINE') ? 'red' : null
}

/** Số việc thật (không tính dòng hoạt động). */
export const actionableCount = (items: WorkItem[]) => items.filter((x) => x.category !== 'activity').length
