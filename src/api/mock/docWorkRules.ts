import { PERMISSIONS } from '@/types/rbac'
import type { PageInfo } from '@/api/documentWork'
import type { UserRef } from '@/types/document'
import type { RoleKind } from '@/types/rbac'
import { sortWorkItems, type WorkItemDto } from '@/types/work'
import { previousApproved } from '@/lib/myWorkRules'

// Mock của GET /me/work-items — phần Tài liệu (doc/BE-Changes-2026-10-28_30-API.md §B.2, D03/D04). Hàm thuần trên dữ
// liệu một dự án; BE làm đúng bảng luật này. Không có câu chữ hiển thị: FE dựng từ DTO (src/lib/myWorkRules.ts).

export interface ProjectWorkInput {
  project: { projectId: number; name: string; key: string; permissions: readonly string[] }
  role: RoleKind
  me: UserRef
  pages: PageInfo[]
  /** Mốc "gần đây" cho dòng RECENT_ACTIVITY của vai trò OTHER. */
  now?: number
}

const has = (permissions: readonly string[], key: string) => permissions.includes('*') || permissions.includes(key)

const isWorker = (role: RoleKind) => role === 'QA' || role === 'DEV' || role === 'DESIGNER'

/** "Xem thay đổi" của REQ cũ: mở bản gốc (nếu không phải bản hiện tại), so với bản duyệt ngay trước nó. */
function staleLink(info: PageInfo): Pick<WorkItemDto, 'versionId' | 'compareToVersionId'> {
  const base = info.baselineVersionId
  if (!base) return { versionId: null, compareToVersionId: null }
  const viewingBase = info.node.currentVersion?.versionId === base
  return { versionId: viewingBase ? null : base, compareToVersionId: previousApproved(info.versions, base) }
}

export function buildDocumentWorkItems(input: ProjectWorkInput): WorkItemDto[] {
  const { project, role, me, pages } = input
  const canApprove = has(project.permissions, PERMISSIONS.documentApprove)
  const canEdit = has(project.permissions, PERMISSIONS.documentEdit)
  const items: WorkItemDto[] = []
  const empty = {
    projectId: project.projectId,
    projectName: project.name,
    projectKey: project.key,
    roleKind: role,
    versionId: null,
    versionLabel: null,
    compareToVersionId: null,
    requirement: null,
    comment: null,
    actor: null,
    note: null,
    count: null,
    issue: null,
    testRun: null,
    activity: null,
  } satisfies Partial<WorkItemDto>

  for (const info of pages) {
    const { node } = info
    const version = node.currentVersion
    if (!version) continue
    const mine = info.author?.userId === me.userId
    const base = { ...empty, documentId: node.documentId, code: node.code, title: node.title }

    // Mọi vai trò: bản hiện tại của tôi bị yêu cầu sửa.
    if (mine && version.status === 'CHANGES_REQUESTED') {
      const req = info.activity.find((a) => a.action === 'CHANGES_REQUESTED' && a.versionLabel === version.label)
      items.push({
        ...base,
        id: `changes-${node.documentId}`,
        kind: 'CHANGES_REQUESTED',
        urgency: 100,
        versionLabel: version.label,
        actor: req?.actor ?? null,
        note: req?.note ?? null,
        at: req?.createdAt ?? node.updatedAt,
      })
    }

    // Có quyền duyệt: bản đang chờ duyệt (so với bản gốc nếu có).
    if (canApprove && version.status === 'IN_REVIEW') {
      items.push({
        ...base,
        id: `review-${node.documentId}`,
        kind: 'REVIEW',
        urgency: 90,
        versionLabel: version.label,
        compareToVersionId: info.baselineVersionId,
        actor: info.submittedBy,
        note: info.changeSummary,
        at: info.submittedAt ?? node.updatedAt,
      })
    }

    // Bình luận gốc chưa giải quyết của người khác.
    const open = info.comments.filter((c) => !c.resolvedAt && !c.parentId && c.author.userId !== me.userId)
    const comment = (c: (typeof open)[number]) => ({ commentId: c.commentId, body: c.body, author: c.author })
    if (role === 'BA' || (mine && canEdit)) {
      // COMMENT_REPLY: trên trang tôi viết, chưa có trả lời của tôi.
      if (mine) {
        const replied = (id: number) => info.comments.some((r) => r.parentId === id && r.author.userId === me.userId)
        for (const c of open.filter((x) => !replied(x.commentId))) {
          items.push({
            ...base,
            id: `comment-${c.commentId}`,
            kind: 'COMMENT_REPLY',
            urgency: 80,
            comment: comment(c),
            at: c.createdAt,
          })
        }
      }
    } else if (isWorker(role)) {
      // MENTION: tôi nằm trong `mentions` của bình luận (gốc hoặc trả lời) chưa giải quyết của người khác.
      const mentioned = info.comments.filter(
        (c) => !c.resolvedAt && c.author.userId !== me.userId && c.mentions?.some((m) => m.userId === me.userId),
      )
      for (const c of mentioned) {
        items.push({
          ...base,
          id: `mention-${c.commentId}`,
          kind: 'MENTION',
          urgency: 75,
          comment: { commentId: c.commentId, body: c.body, author: c.author },
          at: c.createdAt,
        })
      }
    }

    // REQ cũ (Stale sau lần duyệt gần nhất).
    if (info.stale.length > 0) {
      const approved = info.activity.find((a) => a.action === 'APPROVED')
      const after = approved?.versionLabel ?? version.label
      const at = approved?.createdAt ?? node.updatedAt
      const link = staleLink(info)
      const req = (r: (typeof info.stale)[number]) => ({
        requirementId: r.requirementId,
        reqUid: r.reqUid,
        reqKey: r.reqKey,
        title: r.title,
        anchorId: r.anchorId,
      })
      if (role === 'BA') {
        if (mine)
          for (const r of info.stale)
            items.push({
              ...base,
              ...link,
              id: `stale-${r.requirementId}`,
              kind: 'STALE_REQ',
              urgency: 60,
              versionLabel: after,
              requirement: req(r),
              at,
            })
      } else if (isWorker(role)) {
        for (const r of info.stale)
          items.push({
            ...base,
            ...link,
            id: `changed-${r.requirementId}`,
            kind: 'STALE_REQ',
            urgency: 70,
            versionLabel: after,
            requirement: req(r),
            at,
          })
      } else if (role === 'PM') {
        items.push({
          ...base,
          ...link,
          id: `stale-sum-${node.documentId}`,
          kind: 'STALE_REQ',
          urgency: 50,
          versionLabel: after,
          note: info.stale.map((r) => r.reqKey).join(', '),
          count: info.stale.length,
          at,
        })
      }
    }

    // QA / Dev / Designer: REQ sắp đổi (bản đang chờ duyệt khác bản gốc) — gộp một dòng mỗi tài liệu.
    const upcoming = info.reqs.filter((x) => x.changedSinceBaseline)
    if (isWorker(role) && version.status === 'IN_REVIEW' && info.baselineVersionId && upcoming.length > 0) {
      const first = upcoming[0]
      items.push({
        ...base,
        id: `upcoming-${node.documentId}`,
        kind: 'REQ_CHANGING',
        urgency: 30,
        versionLabel: version.label,
        compareToVersionId: info.baselineVersionId,
        requirement:
          upcoming.length === 1
            ? {
                requirementId: first.requirementId,
                reqUid: first.reqUid,
                reqKey: first.reqKey,
                title: first.title,
                anchorId: first.anchorId,
              }
            : null,
        note: upcoming.map((r) => r.reqKey).join(', '),
        count: upcoming.length,
        at: info.submittedAt ?? node.updatedAt,
      })
    }

    // Bản nháp của tôi.
    if (mine && version.status === 'DRAFT') {
      items.push({
        ...base,
        id: `draft-${node.documentId}`,
        kind: 'DRAFT',
        urgency: 20,
        versionLabel: version.label,
        at: node.updatedAt,
      })
    }
  }

  // Vai trò khác: hoạt động gần đây (duyệt / gửi duyệt) trong 7 ngày, tối đa 3 dòng.
  if (role === 'OTHER') {
    const now = input.now ?? Date.now()
    const recent = pages
      .flatMap((info) =>
        info.activity
          .filter(
            (a) =>
              (a.action === 'APPROVED' || a.action === 'SUBMITTED') &&
              now - new Date(a.createdAt).getTime() < 7 * 86_400_000,
          )
          .map((a) => ({ info, a })),
      )
      .sort((x, y) => y.a.createdAt.localeCompare(x.a.createdAt))
      .slice(0, 3)
    for (const { info, a } of recent) {
      items.push({
        ...empty,
        documentId: info.node.documentId,
        code: info.node.code,
        title: info.node.title,
        id: `activity-${a.activityId}`,
        kind: 'RECENT_ACTIVITY',
        urgency: 10,
        versionLabel: a.versionLabel,
        actor: a.actor,
        activity: a.action === 'APPROVED' ? 'APPROVED' : 'SUBMITTED',
        at: a.createdAt,
      })
    }
  }

  return sortWorkItems(items)
}
