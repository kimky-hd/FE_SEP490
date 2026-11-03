import { describe, expect, it } from 'vitest'
import type { PageInfo } from '@/api/documentWork'
import type {
  DocumentCommentDto,
  DocumentVersionSummaryDto,
  RequirementItemDto,
  UserRef,
  VersionStatus,
} from '@/types/document'
import { buildDocumentWorkItems, type ProjectWorkInput } from '@/api/mock/docWorkRules'
import {
  actionableCount,
  documentsSignal,
  previousApproved,
  toWorkItem,
  workSummary,
  type WorkItem,
} from './myWorkRules'
import type { ProjectRoleKind } from './projectRole'

const t = (vi: string) => vi
// Luật chọn việc (mock của GET /me/work-items) + trình bày phía FE.
const buildWorkItems = (input: ProjectWorkInput, tr: typeof t): WorkItem[] =>
  buildDocumentWorkItems(input).map((d) => toWorkItem(d, tr))
const ME: UserRef = { userId: 7, fullName: 'Lương Nguyễn' }
const KHOA: UserRef = { userId: 2, fullName: 'Phạm Khoa' }
const HUY: UserRef = { userId: 3, fullName: 'Trần Quốc Huy' }
const ALL = ['document.view', 'document.edit', 'document.approve']
const READ = ['document.view']

let seq = 0
const version = (
  versionId: number,
  label: string,
  status: VersionStatus,
  createdAt: string,
): DocumentVersionSummaryDto => ({
  versionId,
  label,
  status,
  author: ME,
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt,
  updatedAt: createdAt,
})

const req = (requirementId: number, reqKey: string, extra: Partial<RequirementItemDto> = {}): RequirementItemDto => ({
  requirementId,
  reqUid: `u${requirementId}`,
  reqKey,
  title: `Yêu cầu ${reqKey}`,
  anchorId: `a${requirementId}`,
  priority: 'HIGH',
  freshness: 'FRESH',
  bodyPreview: '',
  bodyLength: 0,
  acceptanceCriteria: [],
  hasTable: false,
  hasDiagram: false,
  hasFigma: false,
  changedSinceBaseline: false,
  ...extra,
})

const comment = (
  commentId: number,
  author: UserRef,
  body: string,
  resolved = false,
  extra: Partial<DocumentCommentDto> = {},
): DocumentCommentDto => ({
  commentId,
  versionId: 1,
  anchorId: null,
  quote: null,
  body,
  parentId: null,
  mentions: [],
  ...extra,
  author,
  createdAt: '2026-10-28T09:00:00Z',
  resolvedBy: resolved ? ME : null,
  resolvedAt: resolved ? '2026-10-28T10:00:00Z' : null,
})

function page(
  documentId: number,
  status: VersionStatus,
  opts: Partial<Omit<PageInfo, 'node'>> & {
    code?: string
    baseline?: number | null
    versionId?: number
    label?: string
  } = {},
): PageInfo {
  seq += 1
  const versionId = opts.versionId ?? documentId * 10 + 2
  const label = opts.label ?? '1.2'
  const reqs = opts.reqs ?? []
  return {
    node: {
      documentId,
      projectId: 1,
      parentId: null,
      kind: 'PAGE',
      title: `Trang ${documentId}`,
      docType: 'SRS',
      code: opts.code ?? `SRS-0${documentId}`,
      sortOrder: seq,
      currentVersion: { versionId, label, status },
      isBaselined: !!opts.baseline,
      baselineVersionId: opts.baseline ?? null,
      reqCount: reqs.length,
      updatedAt: `2026-10-2${documentId % 10}T08:00:00Z`,
    },
    parent: null,
    author: opts.author === undefined ? ME : opts.author,
    submittedBy: opts.submittedBy ?? null,
    submittedAt: opts.submittedAt ?? null,
    changeSummary: opts.changeSummary ?? null,
    stale: reqs.filter((r) => r.freshness === 'STALE'),
    reqs,
    versions: opts.versions ?? [],
    baselineVersionId: opts.baseline ?? null,
    activity: opts.activity ?? [],
    comments: opts.comments ?? [],
  }
}

const input = (role: ProjectRoleKind, pages: PageInfo[], permissions = ALL): ProjectWorkInput => ({
  project: { projectId: 1, name: 'Checkout', key: 'CORE', permissions },
  role,
  me: ME,
  pages,
  now: new Date('2026-10-29T12:00:00Z').getTime(),
})

// Bộ dữ liệu giống mockup: SRS-02 bị yêu cầu sửa, SRS-03 đã duyệt có REQ stale + bình luận chờ trả lời,
// SRS-04 đang chờ duyệt (REQ-09 đổi so với bản gốc), SRS-05 bản nháp của tôi, SRS-06 nháp của người khác.
function fixture(): PageInfo[] {
  return [
    page(2, 'CHANGES_REQUESTED', {
      activity: [
        {
          activityId: 1,
          versionLabel: '1.2',
          action: 'CHANGES_REQUESTED',
          actor: KHOA,
          note: 'Bổ sung chống trùng webhook',
          createdAt: '2026-10-29T08:00:00Z',
        },
      ],
    }),
    page(3, 'APPROVED', {
      versionId: 33,
      baseline: 33,
      label: '1.1',
      versions: [
        version(31, '1.0', 'SUPERSEDED', '2026-10-01T00:00:00Z'),
        version(33, '1.1', 'APPROVED', '2026-10-20T00:00:00Z'),
      ],
      reqs: [req(301, 'REQ-01'), req(302, 'REQ-02', { freshness: 'STALE' })],
      activity: [
        {
          activityId: 2,
          versionLabel: '1.1',
          action: 'APPROVED',
          actor: KHOA,
          note: null,
          createdAt: '2026-10-28T08:00:00Z',
        },
      ],
      comments: [
        comment(1, HUY, 'Đồng hồ dùng giờ máy chủ hay thiết bị?'),
        comment(2, ME, 'Ghi chú của tôi'),
        comment(3, HUY, 'Đã xử lý', true),
      ],
    }),
    page(4, 'IN_REVIEW', {
      author: HUY,
      baseline: 41,
      submittedBy: HUY,
      submittedAt: '2026-10-29T06:00:00Z',
      changeSummary: 'Sửa REQ-09',
      reqs: [req(409, 'REQ-09', { changedSinceBaseline: true }), req(410, 'REQ-10')],
    }),
    page(5, 'DRAFT'),
    page(6, 'DRAFT', { author: HUY }),
  ]
}

const ids = (role: ProjectRoleKind, permissions = ALL) =>
  buildWorkItems(input(role, fixture(), permissions), t).map((x) => x.id)

describe('buildWorkItems', () => {
  it('BA: bị yêu cầu sửa → duyệt (nếu có quyền) → bình luận chờ trả lời → REQ cũ → bản nháp, sắp theo mức gấp', () => {
    expect(ids('BA')).toEqual(['changes-2', 'review-4', 'comment-1', 'stale-302', 'draft-5'])
    expect(ids('BA', ['document.view', 'document.edit'])).toEqual(['changes-2', 'comment-1', 'stale-302', 'draft-5'])
  })

  it('BA: nội dung dòng (lý do, nút, link) đúng khung 1b', () => {
    const [changes, , c, stale, draft] = buildWorkItems(input('BA', fixture()), t)
    expect(changes).toMatchObject({
      letter: 'D',
      tone: 'bad',
      reason: 'Bị yêu cầu sửa',
      action: { kind: 'link', label: 'Sửa', href: '/projects/1/documents/2' },
    })
    expect(changes.sub).toContain('Phạm Khoa yêu cầu sửa')
    expect(c).toMatchObject({
      letter: 'C',
      tone: 'warn',
      reason: 'Chờ bạn trả lời',
      sub: 'Bình luận của Trần Quốc Huy',
      code: 'SRS-03',
    })
    expect(stale).toMatchObject({ letter: 'R', title: 'REQ-02 · Yêu cầu REQ-02', reason: 'REQ cũ' })
    expect(stale.action).toEqual({
      kind: 'confirmFresh',
      label: 'Xác nhận',
      requirementId: 302,
      href: '/projects/1/documents/3?cmp=31',
    })
    expect(draft).toMatchObject({ letter: 'D', tone: 'blue', action: { label: 'Tiếp tục' } })
  })

  it('D01: bình luận gốc tôi đã trả lời (parentId) không còn là việc; trả lời không tạo dòng COMMENT_REPLY', () => {
    const pages = fixture()
    pages[1].comments = [
      ...pages[1].comments,
      comment(20, ME, 'Giờ máy chủ.', false, { parentId: 1 }),
      comment(21, HUY, 'Ok cảm ơn', false, { parentId: 1 }),
    ]
    const items = buildDocumentWorkItems(input('BA', pages))
    expect(items.filter((x) => x.kind === 'COMMENT_REPLY')).toEqual([])
  })

  it('BA: REQ cũ trong tài liệu người khác viết thì không phải việc của tôi', () => {
    const pages = fixture()
    pages[1].author = HUY
    expect(buildWorkItems(input('BA', pages), t).map((x) => x.id)).not.toContain('stale-302')
  })

  it('PM: chờ duyệt (link so sánh với bản gốc) + tóm tắt REQ cũ theo tài liệu', () => {
    const items = buildWorkItems(input('PM', fixture()), t)
    expect(items.map((x) => x.id)).toEqual(['changes-2', 'review-4', 'comment-1', 'stale-sum-3', 'draft-5'])
    const review = items.find((x) => x.id === 'review-4')!
    expect(review).toMatchObject({
      reason: 'Chờ duyệt',
      action: { label: 'Xem & duyệt', href: '/projects/1/documents/4?cmp=41' },
    })
    expect(review.sub).toBe('Trần Quốc Huy gửi duyệt · Sửa REQ-09')
    expect(items.find((x) => x.id === 'stale-sum-3')).toMatchObject({ count: 1, title: '1 REQ chưa được xác nhận' })
  })

  it('QA: REQ vừa đổi → "Cần cập nhật test" + REQ sắp đổi trong bản chờ duyệt; không có bình luận của tài liệu người khác', () => {
    const items = buildWorkItems(input('QA', fixture(), READ), t)
    expect(items.map((x) => x.id)).toEqual(['changes-2', 'changed-302', 'upcoming-4', 'draft-5'])
    expect(items[1]).toMatchObject({
      reason: 'Cần cập nhật test',
      action: { label: 'Xem thay đổi', href: '/projects/1/documents/3?cmp=31' },
    })
    expect(items[2]).toMatchObject({
      tone: 'blue',
      reason: 'Sắp thay đổi',
      action: { href: '/projects/1/documents/4?cmp=41' },
    })
  })

  it('Dev / Designer: cùng nguồn REQ, nhãn "REQ vừa đổi"; bình luận nhắc tên thì hiện', () => {
    const pages = fixture()
    pages[2].comments = [
      comment(9, HUY, '@Lương Nguyễn xem giúp màn này', false, { mentions: [ME] }),
      // Chỉ có chữ @tên mà không có trong `mentions` thì không tính (D01: theo `mentions`).
      comment(10, HUY, '@Lương Nguyễn không gắn id'),
    ]
    pages[0].author = HUY
    pages[3].author = HUY
    const dev = buildWorkItems(input('DEV', pages, READ), t)
    expect(dev.map((x) => x.id)).toEqual(['mention-9', 'changed-302', 'upcoming-4'])
    expect(dev[1].reason).toBe('REQ vừa đổi')
    expect(buildWorkItems(input('DESIGNER', pages, READ), t).map((x) => x.id)).toEqual([
      'mention-9',
      'changed-302',
      'upcoming-4',
    ])
  })

  it('OTHER: duyệt nếu có quyền + hoạt động 7 ngày gần đây (không tính là việc)', () => {
    const items = buildWorkItems(input('OTHER', fixture(), READ), t)
    expect(items.map((x) => x.id)).toEqual(['changes-2', 'draft-5', 'activity-2'])
    expect(actionableCount(items)).toBe(2)
    expect(buildWorkItems(input('OTHER', fixture()), t).map((x) => x.id)).toContain('review-4')
  })

  it('bỏ qua trang chưa có phiên bản', () => {
    const p = page(9, 'DRAFT')
    p.node.currentVersion = null
    expect(buildWorkItems(input('BA', [p]), t)).toEqual([])
  })
})

describe('previousApproved', () => {
  it('bản đã duyệt / bị thay thế gần nhất trước bản đang xét', () => {
    const vs = [
      version(1, '1.0', 'SUPERSEDED', '2026-10-01T00:00:00Z'),
      version(2, '1.1', 'SUPERSEDED', '2026-10-10T00:00:00Z'),
      version(3, '1.2', 'APPROVED', '2026-10-20T00:00:00Z'),
      version(4, '1.3', 'DRAFT', '2026-10-25T00:00:00Z'),
    ]
    expect(previousApproved(vs, 3)).toBe(2)
    expect(previousApproved(vs, 1)).toBeNull()
  })
})

describe('workSummary / documentsSignal', () => {
  it('tóm tắt việc gấp nhất bằng một câu', () => {
    const items = buildWorkItems(input('BA', fixture()), t)
    expect(workSummary(items, t)).toBe('SRS-02: Phạm Khoa yêu cầu sửa: “Bổ sung chống trùng webhook”.')
    expect(
      workSummary(
        items.filter((x) => x.category === 'req'),
        t,
      ),
    ).toBe('1 REQ thay đổi sau lần duyệt gần nhất.')
    expect(workSummary([], t)).toBe('Không có việc nào cần bạn lúc này.')
    // QA có cả bản chờ duyệt lẫn REQ đổi: nói REQ trước.
    const qa = buildWorkItems(input('QA', fixture()), t).filter((x) => x.category !== 'changes')
    expect(workSummary(qa, t, 'QA')).toBe('1 REQ thay đổi sau lần duyệt gần nhất.')
    expect(workSummary(qa, t, 'PM')).toBe('1 bản đang chờ bạn duyệt.')
  })

  it('chấm đỏ khi bị yêu cầu sửa, cam khi có thứ cần xem, không chấm khi chỉ có nháp', () => {
    const items = buildWorkItems(input('BA', fixture()), t)
    expect(documentsSignal(items)).toBe('red')
    expect(documentsSignal(items.filter((x) => x.tone !== 'bad'))).toBe('orange')
    expect(documentsSignal(items.filter((x) => x.category === 'draft'))).toBeNull()
  })
})
