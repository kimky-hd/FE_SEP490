import { PERMISSIONS } from '@/types/rbac'
import type {
  DocumentActivityDto,
  DocumentCommentDto,
  DocumentDetailDto,
  DocumentNodeDto,
  DocumentVersionSummaryDto,
  DocumentWorkEvent,
  DocumentWorkItem,
  MyDocumentWorkDto,
  ProjectDocumentStats,
  RequirementItemDto,
  UserRef,
} from '@/types/document'

// Ghép "Việc của tôi" (trang Tổng quan) và "trang chủ tài liệu" của dự án từ các endpoint từng dự án / từng trang
// đã có trong hợp đồng (§7.1–7.3). BE nên trả sẵn qua GET /me/document-work (§7.5) để tránh N+1;
// tới lúc đó mock dùng hàm này, HTTP gọi endpoint.

/** Phần DocumentApi mà bộ ghép cần (khai báo cấu trúc để không import vòng với documentApi.ts). */
export interface DocumentWorkSource {
  listTree: (projectId: number) => Promise<DocumentNodeDto[]>
  get: (documentId: number) => Promise<DocumentDetailDto>
  listRequirements: (documentId: number, versionId?: number) => Promise<RequirementItemDto[]>
  activity: (documentId: number) => Promise<DocumentActivityDto[]>
  listComments: (documentId: number, params?: { versionId?: number }) => Promise<DocumentCommentDto[]>
}

export interface WorkProject {
  projectId: number
  name: string
  key: string
  permissions: string[]
}

/** Một trang kèm thông tin phụ: tác giả bản hiện tại, người gửi duyệt, REQ stale, lịch sử. */
export interface PageInfo {
  node: DocumentNodeDto
  /** Nút cha gần nhất (thư mục hoặc trang cha), null nếu ở gốc. */
  parent: DocumentNodeDto | null
  author: UserRef | null
  submittedBy: UserRef | null
  submittedAt: string | null
  changeSummary: string | null
  stale: RequirementItemDto[]
  /** Mọi REQ của bản hiện tại (để tìm REQ đổi so với bản gốc, tìm theo mã REQ). */
  reqs: RequirementItemDto[]
  /** Các phiên bản của trang (để dựng link so sánh). */
  versions: DocumentVersionSummaryDto[]
  /** Bản gốc (đã duyệt gần nhất) của trang, null nếu chưa duyệt bản nào. */
  baselineVersionId: number | null
  activity: DocumentActivityDto[]
  comments: DocumentCommentDto[]
}

const can = (permissions: readonly string[], key: string) => permissions.includes('*') || permissions.includes(key)

/** Tải cây + chi tiết từng trang của một dự án (song song). Trang lỗi riêng lẻ vẫn trả về với thông tin tối thiểu. */
export async function loadPageInfos(
  api: DocumentWorkSource,
  projectId: number,
  opts: { comments?: boolean; nodes?: DocumentNodeDto[] } = {},
): Promise<{ nodes: DocumentNodeDto[]; pages: PageInfo[] }> {
  const nodes = opts.nodes ?? (await api.listTree(projectId))
  const byId = new Map(nodes.map((n) => [n.documentId, n]))
  const pages = await Promise.all(
    nodes
      .filter((n) => n.kind === 'PAGE' && n.currentVersion)
      .map(async (node): Promise<PageInfo> => {
        const versionId = node.currentVersion!.versionId
        const [detail, reqs, activity, comments] = await Promise.all([
          api.get(node.documentId).catch(() => null),
          node.reqCount > 0 ? api.listRequirements(node.documentId, versionId).catch(() => []) : Promise.resolve([]),
          api.activity(node.documentId).catch(() => [] as DocumentActivityDto[]),
          opts.comments
            ? api.listComments(node.documentId, { versionId }).catch(() => [] as DocumentCommentDto[])
            : Promise.resolve([]),
        ])
        const label = node.currentVersion!.label
        // activity: mới nhất trước → lần gửi duyệt gần nhất của bản hiện tại.
        const submitted = activity.find((a) => a.action === 'SUBMITTED' && a.versionLabel === label) ?? null
        return {
          node,
          parent: node.parentId !== null ? (byId.get(node.parentId) ?? null) : null,
          author: detail?.current.author ?? null,
          submittedBy: node.currentVersion!.status === 'DRAFT' ? null : (submitted?.actor ?? null),
          submittedAt: submitted?.createdAt ?? null,
          changeSummary: submitted?.note ?? null,
          stale: reqs.filter((r) => r.freshness === 'STALE'),
          reqs,
          versions: detail?.versions ?? [],
          baselineVersionId: node.baselineVersionId,
          activity,
          comments,
        }
      }),
  )
  return { nodes, pages }
}

const FEED_ACTIONS = new Set(['APPROVED', 'SUBMITTED', 'CHANGES_REQUESTED'])
export const MY_WORK_FEED_LIMIT = 8

/** Dựng MyDocumentWorkDto cho người dùng `me` từ các dự án họ là thành viên. */
export async function buildMyWork(
  api: DocumentWorkSource,
  projects: WorkProject[],
  me: UserRef,
): Promise<MyDocumentWorkDto> {
  const loaded = await Promise.all(
    projects.map(async (project) => {
      if (!can(project.permissions, PERMISSIONS.documentView)) return { project, pages: [] as PageInfo[] }
      try {
        return { project, pages: (await loadPageInfos(api, project.projectId, { comments: true })).pages }
      } catch {
        return { project, pages: [] as PageInfo[] }
      }
    }),
  )

  const result: MyDocumentWorkDto = {
    reviews: [],
    drafts: [],
    changesRequested: [],
    staleReqs: [],
    activity: [],
    projectStats: [],
  }

  for (const { project, pages } of loaded) {
    const canApprove = can(project.permissions, PERMISSIONS.documentApprove)
    const stats: ProjectDocumentStats = {
      projectId: project.projectId,
      pages: pages.length,
      reqs: 0,
      approved: 0,
      inReview: 0,
      draft: 0,
      staleReqs: 0,
    }

    for (const info of pages) {
      const { node } = info
      const version = node.currentVersion!
      stats.reqs += node.reqCount
      stats.staleReqs += info.stale.length
      if (version.status === 'APPROVED') stats.approved += 1
      else if (version.status === 'IN_REVIEW') stats.inReview += 1
      else if (version.status === 'DRAFT' || version.status === 'CHANGES_REQUESTED') stats.draft += 1

      const item: DocumentWorkItem = {
        documentId: node.documentId,
        projectId: project.projectId,
        projectName: project.name,
        projectKey: project.key,
        code: node.code,
        title: node.title,
        docType: node.docType,
        versionId: version.versionId,
        versionLabel: version.label,
        status: version.status,
        author: info.author ?? { userId: 0, fullName: '' },
        submittedBy: info.submittedBy,
        changeSummary: info.changeSummary,
        reqCount: node.reqCount,
        updatedAt: node.updatedAt,
      }
      const mine = info.author?.userId === me.userId
      if (version.status === 'IN_REVIEW' && canApprove) result.reviews.push(item)
      if (version.status === 'DRAFT' && mine) result.drafts.push(item)
      if (version.status === 'CHANGES_REQUESTED' && mine) result.changesRequested.push(item)

      for (const r of info.stale) {
        result.staleReqs.push({
          requirementId: r.requirementId,
          reqKey: r.reqKey,
          title: r.title,
          documentId: node.documentId,
          code: node.code,
          documentTitle: node.title,
          projectId: project.projectId,
          projectName: project.name,
          versionLabel: version.label,
          updatedAt: node.updatedAt,
        })
      }

      const base = {
        documentId: node.documentId,
        projectId: project.projectId,
        projectName: project.name,
        code: node.code,
        title: node.title,
      }
      for (const a of info.activity) {
        if (!FEED_ACTIONS.has(a.action)) continue
        result.activity.push({
          ...base,
          id: `${a.action}-${a.activityId}`,
          kind: a.action as DocumentWorkEvent['kind'],
          actor: a.actor,
          versionLabel: a.versionLabel,
          note: a.note,
          count: null,
          createdAt: a.createdAt,
        })
      }
      for (const c of info.comments) {
        result.activity.push({
          ...base,
          id: `COMMENTED-${c.commentId}`,
          kind: 'COMMENTED',
          actor: c.author,
          versionLabel: version.label,
          note: c.body,
          count: null,
          createdAt: c.createdAt,
        })
      }
      if (info.stale.length > 0) {
        // REQ chuyển Stale khi một bản được duyệt (§5) → gắn với lần duyệt gần nhất.
        const approved = info.activity.find((a) => a.action === 'APPROVED')
        result.activity.push({
          ...base,
          id: `STALE-${node.documentId}`,
          kind: 'STALE',
          actor: null,
          versionLabel: approved?.versionLabel ?? null,
          note: null,
          count: info.stale.length,
          createdAt: approved?.createdAt ?? node.updatedAt,
        })
      }
    }
    result.projectStats.push(stats)
  }

  const newest =
    <T>(key: (x: T) => string) =>
    (a: T, b: T) =>
      key(b).localeCompare(key(a))
  result.reviews.sort(newest((x) => x.updatedAt))
  result.drafts.sort(newest((x) => x.updatedAt))
  result.changesRequested.sort(newest((x) => x.updatedAt))
  result.staleReqs.sort(newest((x) => x.updatedAt))
  result.activity = result.activity.sort(newest((x) => x.createdAt)).slice(0, MY_WORK_FEED_LIMIT)
  return result
}
