// Backend giả trong trình duyệt cho module Tài liệu, bám đúng doc/BE-Changes-2026-10-28_30-API.md §A (#1–#22).
// Lưu trong localStorage (`ssam.mock.documents.v1`). Dự án mới bắt đầu rỗng; dữ liệu demo chỉ tạo khi gọi `seedDemo`
// (nút "Tạo dữ liệu mẫu" ở màn hình trống). Dự án đã được seed tự động ở bản cũ giữ nguyên dữ liệu.
// Chỉ bật khi VITE_MOCK_DOCUMENTS=true (src/api/mockFlags.ts); BE xong giai đoạn 1 thì đặt 'false'.

import { ApiError } from '@/lib/apiClient'
import { PERMISSIONS } from '@/types/rbac'
import type {
  AddCommentBody,
  CreateFromNotesBody,
  CreateNodeBody,
  DiagramProposalDto,
  DocType,
  DocumentActivityDto,
  DocumentCommentDto,
  DocumentDetailDto,
  DocumentGenerationDto,
  DocumentKind,
  DocumentNodeDto,
  DocumentVersionDto,
  DocumentVersionSummaryDto,
  ExtractedRequirement,
  Freshness,
  GenerateDiagramBody,
  GeneratedItem,
  NormalizedFields,
  Priority,
  RequirementItemDto,
  SaveContentBody,
  SaveContentResult,
  TipTapDoc,
  UpdateNodeBody,
  UserRef,
  VersionStatus,
} from '@/types/document'
import { DIAGRAM_KINDS, DIAGRAM_TEXT_MAX, generateDiagram } from './diagramGenerator'
import {
  docText,
  extractRequirements,
  formatReqSummary,
  isValidContent,
  newUid,
  setHeadingPriority,
  summarizeReqChanges,
  type ExtractedReq,
} from './documentContent'
import { buildGeneratedContent, extractRequirementsFromFields, normalizeNotes } from './documentGenerator'
import { authSrsContent, PAY_REQ, paySrsV09, paySrsV10, paySrsV11, urdContent } from './documentSeed'

export const MOCK_STORAGE_KEY = 'ssam.mock.documents.v1'

// ---------- Bản ghi ----------

interface NodeRec {
  documentId: number
  projectId: number
  parentId: number | null
  kind: DocumentKind
  title: string
  docType: DocType | null
  code: string | null
  sortOrder: number
  currentVersionId: number | null
  baselineVersionId: number | null
  createdById: number
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

interface VersionRec {
  versionId: number
  documentId: number
  label: string
  status: VersionStatus
  subtitle: string | null
  content: TipTapDoc
  contentText: string
  baseVersionId: number | null
  rowVersion: number
  author: UserRef
  submittedBy: UserRef | null
  submittedAt: string | null
  reviewedBy: UserRef | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  updatedAt: string
  /** Người lưu gần nhất (cho `current` của 409 VERSION_CONFLICT — D19). */
  updatedBy?: UserRef
}

interface ReqRec extends ExtractedReq {
  requirementId: number
  documentId: number
  versionId: number
  freshness: Freshness
}

interface CommentRec extends DocumentCommentDto {
  documentId: number
}

interface ActivityRec {
  activityId: number
  documentId: number
  versionId: number | null
  action: string
  actor: UserRef
  note: string | null
  createdAt: string
}

interface GenerationRec {
  id: number
  projectId: number
  documentId: number | null
  rawNotes: string
  fields: NormalizedFields
  items: GeneratedItem[]
  createdBy: UserRef
  createdAt: string
}

export interface MockDb {
  seq: number
  seededProjects: number[]
  nodes: NodeRec[]
  versions: VersionRec[]
  requirements: ReqRec[]
  comments: CommentRec[]
  activities: ActivityRec[]
  generations: GenerationRec[]
}

export interface ReqLite {
  reqUid: string
  reqKey: string
  title: string
  contentHash: string
  freshness: Freshness
  priority: Priority
  acceptanceCriteria: { text: string; checked: boolean }[]
}

export interface DocReqIndex {
  documentId: number
  code: string
  title: string
  baselineVersionId: number | null
  baselineLabel: string | null
  /** REQ của bản đã duyệt gần nhất (rỗng nếu chưa duyệt bản nào). */
  baseline: ReqLite[]
  /** REQ của bản hiện tại nếu khác bản baseline (nháp / đang chờ duyệt). */
  current: ReqLite[]
}

const emptyDb = (): MockDb => ({
  seq: 1000,
  seededProjects: [],
  nodes: [],
  versions: [],
  requirements: [],
  comments: [],
  activities: [],
  generations: [],
})

// ---------- Môi trường (inject để test) ----------

export interface ProjectAccess {
  permissions: string[]
  aiEnabled: boolean
  archived: boolean
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface MockEnv {
  actor: () => Promise<UserRef>
  projectAccess: (projectId: number) => Promise<ProjectAccess>
  /** Thành viên dự án (lọc `mentionUserIds` của bình luận — D01). Không truyền = không lọc. */
  members?: (projectId: number) => Promise<UserRef[]>
  storage?: KeyValueStorage | null
  now?: () => Date
  /** Độ trễ giả (ms). Mặc định 150–300ms; test truyền 0. */
  latency?: () => number
  uid?: () => string
}

const OPEN: VersionStatus[] = ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED']
const EDITABLE: VersionStatus[] = ['DRAFT', 'CHANGES_REQUESTED']
const DOC_TYPES: DocType[] = ['URD', 'BRD', 'SRS', 'OTHER']
const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
const SAVE_MERGE_MS = 15 * 60_000

const fail = (status: number, code: string, message: string, errors?: Record<string, string[]>): never => {
  throw new ApiError(status, { code, message, errors })
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const SEED_USERS = {
  ba: { userId: 900001, fullName: 'Nguyễn Minh Anh' },
  lead: { userId: 900002, fullName: 'Trần Quốc Huy' },
}

export class DocumentMockStore {
  private db: MockDb | null = null
  private readonly env: Required<Omit<MockEnv, 'storage'>> & { storage: KeyValueStorage | null }
  private readonly filterMentions: boolean

  constructor(env: MockEnv) {
    this.filterMentions = !!env.members
    this.env = {
      storage: env.storage ?? null,
      now: env.now ?? (() => new Date()),
      latency: env.latency ?? (() => 150 + Math.round(Math.random() * 150)),
      uid: env.uid ?? newUid,
      actor: env.actor,
      projectAccess: env.projectAccess,
      members: env.members ?? (async () => []),
    }
  }

  // ---------- Hạ tầng ----------

  private load(): MockDb {
    if (this.db) return this.db
    let db: MockDb | null = null
    try {
      const raw = this.env.storage?.getItem(MOCK_STORAGE_KEY)
      if (raw) db = { ...emptyDb(), ...(JSON.parse(raw) as MockDb) }
    } catch {
      db = null
    }
    this.db = db ?? emptyDb()
    return this.db
  }

  private persist() {
    try {
      this.env.storage?.setItem(MOCK_STORAGE_KEY, JSON.stringify(this.db))
    } catch {
      // Hết quota / bị chặn storage: vẫn chạy trong bộ nhớ cho phiên này.
    }
  }

  private async delay() {
    const ms = this.env.latency()
    if (ms > 0) await new Promise((r) => setTimeout(r, ms))
  }

  private nextId() {
    const db = this.load()
    db.seq += 1
    return db.seq
  }

  private iso(offsetMs = 0) {
    return new Date(this.env.now().getTime() + offsetMs).toISOString()
  }

  private async access(projectId: number, permission: string, write: boolean) {
    const acc = await this.env.projectAccess(projectId)
    const has = (key: string) => acc.permissions.includes('*') || acc.permissions.includes(key)
    if (!has(permission)) fail(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.')
    if (write && acc.archived) fail(409, 'PROJECT_ARCHIVED', 'Dự án đã được lưu trữ, dữ liệu chỉ đọc.')
    return { acc, has }
  }

  private node(documentId: number): NodeRec {
    const n = this.load().nodes.find((x) => x.documentId === documentId && !x.isDeleted)
    return n ?? fail(404, 'DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu.')
  }

  private version(documentId: number, versionId: number): VersionRec {
    const v = this.load().versions.find((x) => x.versionId === versionId && x.documentId === documentId)
    return v ?? fail(404, 'VERSION_NOT_FOUND', 'Không tìm thấy phiên bản.')
  }

  private reqsOf(versionId: number) {
    return this.load().requirements.filter((r) => r.versionId === versionId)
  }

  private log(
    documentId: number,
    versionId: number | null,
    action: string,
    actor: UserRef,
    note: string | null = null,
  ) {
    this.load().activities.push({
      activityId: this.nextId(),
      documentId,
      versionId,
      action,
      actor,
      note,
      createdAt: this.iso(),
    })
  }

  // ---------- Ánh xạ DTO ----------

  private nodeDto(n: NodeRec): DocumentNodeDto {
    const cur = n.currentVersionId ? this.load().versions.find((v) => v.versionId === n.currentVersionId) : undefined
    return {
      documentId: n.documentId,
      projectId: n.projectId,
      parentId: n.parentId,
      kind: n.kind,
      title: n.title,
      docType: n.docType,
      code: n.code,
      sortOrder: n.sortOrder,
      currentVersion: cur ? { versionId: cur.versionId, label: cur.label, status: cur.status } : null,
      isBaselined: n.baselineVersionId !== null,
      baselineVersionId: n.baselineVersionId,
      reqCount: cur ? this.reqsOf(cur.versionId).length : 0,
      updatedAt: n.updatedAt,
    }
  }

  private summaryDto(v: VersionRec): DocumentVersionSummaryDto {
    return {
      versionId: v.versionId,
      label: v.label,
      status: v.status,
      author: v.author,
      reviewedBy: v.reviewedBy,
      reviewedAt: v.reviewedAt,
      reviewNote: v.reviewNote,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }
  }

  private versionDto(v: VersionRec): DocumentVersionDto {
    return {
      ...this.summaryDto(v),
      documentId: v.documentId,
      subtitle: v.subtitle,
      content: clone(v.content),
      rowVersion: v.rowVersion,
      baseVersionId: v.baseVersionId,
    }
  }

  private reqDto(r: ReqRec): RequirementItemDto {
    const v = this.load().versions.find((x) => x.versionId === r.versionId)
    const n = this.load().nodes.find((x) => x.documentId === r.documentId)
    let changed = false
    if (v && OPEN.includes(v.status) && n?.baselineVersionId) {
      const base = this.reqsOf(n.baselineVersionId).find((b) => b.reqUid === r.reqUid)
      changed = !base || base.contentHash !== r.contentHash
    }
    return {
      requirementId: r.requirementId,
      reqUid: r.reqUid,
      reqKey: r.reqKey,
      title: r.title,
      anchorId: r.anchorId,
      priority: r.priority,
      freshness: r.freshness,
      bodyPreview: r.bodyPreview,
      bodyLength: r.bodyLength,
      acceptanceCriteria: clone(r.acceptanceCriteria),
      hasTable: r.hasTable,
      hasDiagram: r.hasDiagram,
      hasFigma: r.hasFigma,
      changedSinceBaseline: changed,
    }
  }

  private async detail(n: NodeRec, versionId?: number): Promise<DocumentDetailDto> {
    const { has, acc } = await this.access(n.projectId, PERMISSIONS.documentView, false)
    const id = versionId ?? n.currentVersionId
    if (!id) fail(404, 'VERSION_NOT_FOUND', 'Trang chưa có phiên bản.')
    const current = this.version(n.documentId, id!)
    const versions = this.load()
      .versions.filter((v) => v.documentId === n.documentId)
      .sort((a, b) => b.versionId - a.versionId)
      .map((v) => this.summaryDto(v))
    const w = !acc.archived
    return {
      node: this.nodeDto(n),
      versions,
      current: this.versionDto(current),
      can: {
        edit: w && has(PERMISSIONS.documentEdit),
        approve: w && has(PERMISSIONS.documentApprove),
        revise: w && has(PERMISSIONS.documentRevise),
        delete: w && has(PERMISSIONS.documentDelete),
      },
    }
  }

  /** Thay toàn bộ REQ của version; giữ requirementId + freshness của REQ cùng reqUid (cùng version, rồi tới baseline). */
  private syncRequirements(n: NodeRec, v: VersionRec, extracted: ExtractedReq[]) {
    const db = this.load()
    const old = new Map(this.reqsOf(v.versionId).map((r) => [r.reqUid, r]))
    const base =
      n.baselineVersionId && n.baselineVersionId !== v.versionId
        ? new Map(this.reqsOf(n.baselineVersionId).map((r) => [r.reqUid, r]))
        : new Map<string, ReqRec>()
    db.requirements = db.requirements.filter((r) => r.versionId !== v.versionId)
    for (const e of extracted) {
      const prev = old.get(e.reqUid)
      db.requirements.push({
        ...e,
        requirementId: prev?.requirementId ?? this.nextId(),
        documentId: n.documentId,
        versionId: v.versionId,
        freshness: prev?.freshness ?? base.get(e.reqUid)?.freshness ?? 'FRESH',
      })
    }
  }

  private writeContent(n: NodeRec, v: VersionRec, content: TipTapDoc) {
    const result = extractRequirements(content, this.env.uid)
    v.content = result.content
    v.contentText = docText(result.content)
    this.syncRequirements(n, v, result.requirements)
    return result
  }

  private changeSummary(v: VersionRec, againstVersionId: number | null) {
    if (!againstVersionId || againstVersionId === v.versionId) return null
    return formatReqSummary(summarizeReqChanges(this.reqsOf(againstVersionId), this.reqsOf(v.versionId)))
  }

  private nextCode(projectId: number, docType: DocType) {
    const prefix = docType === 'OTHER' ? 'DOC' : docType
    const max = this.load()
      .nodes.filter((x) => x.projectId === projectId && x.code?.startsWith(prefix + '-'))
      .reduce((m, x) => Math.max(m, Number(x.code!.slice(prefix.length + 1)) || 0), 0)
    return `${prefix}-${String(max + 1).padStart(2, '0')}`
  }

  private siblings(projectId: number, parentId: number | null, exceptId?: number) {
    return this.load()
      .nodes.filter(
        (x) => x.projectId === projectId && x.parentId === parentId && !x.isDeleted && x.documentId !== exceptId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.documentId - b.documentId)
  }

  private descendants(documentId: number): NodeRec[] {
    const out: NodeRec[] = []
    const stack = [documentId]
    while (stack.length) {
      const id = stack.pop()!
      for (const c of this.load().nodes.filter((x) => x.parentId === id && !x.isDeleted)) {
        out.push(c)
        stack.push(c.documentId)
      }
    }
    return out
  }

  private validParent(projectId: number, parentId: number | null | undefined, selfId?: number) {
    if (parentId === null || parentId === undefined) return null
    const parent = this.load().nodes.find((x) => x.documentId === parentId && !x.isDeleted)
    const invalid =
      !parent ||
      parent.projectId !== projectId ||
      parentId === selfId ||
      (selfId !== undefined && this.descendants(selfId).some((d) => d.documentId === parentId))
    if (invalid) fail(400, 'INVALID_PARENT', 'Vị trí cha không hợp lệ.')
    return parentId
  }

  private newPage(
    projectId: number,
    parentId: number | null,
    title: string,
    docType: DocType,
    actor: UserRef,
    content: TipTapDoc,
    opts: { subtitle?: string | null; label?: string; status?: VersionStatus; at?: string; code?: string } = {},
  ) {
    const db = this.load()
    const at = opts.at ?? this.iso()
    const n: NodeRec = {
      documentId: this.nextId(),
      projectId,
      parentId,
      kind: 'PAGE',
      title,
      docType,
      code: opts.code ?? this.nextCode(projectId, docType),
      sortOrder: this.siblings(projectId, parentId).length,
      currentVersionId: null,
      baselineVersionId: null,
      createdById: actor.userId,
      createdAt: at,
      updatedAt: at,
      isDeleted: false,
    }
    db.nodes.push(n)
    const v = this.addVersion(n, actor, content, {
      label: opts.label ?? '1.0',
      status: opts.status ?? 'DRAFT',
      subtitle: opts.subtitle ?? null,
      at,
    })
    return { n, v }
  }

  private addVersion(
    n: NodeRec,
    author: UserRef,
    content: TipTapDoc,
    opts: { label: string; status: VersionStatus; subtitle: string | null; at?: string; baseVersionId?: number | null },
  ) {
    const at = opts.at ?? this.iso()
    const v: VersionRec = {
      versionId: this.nextId(),
      documentId: n.documentId,
      label: opts.label,
      status: opts.status,
      subtitle: opts.subtitle,
      content: { type: 'doc', content: [] },
      contentText: '',
      baseVersionId: opts.baseVersionId ?? null,
      rowVersion: 1,
      author,
      submittedBy: null,
      submittedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: at,
      updatedAt: at,
    }
    this.load().versions.push(v)
    n.currentVersionId = v.versionId
    this.writeContent(n, v, clone(content))
    return v
  }

  // ---------- Seed ----------

  /**
   * Chỉ có ở mock: tạo bộ tài liệu demo (2 thư mục, URD-01, SRS-01, SRS-02) cho một dự án đang rỗng.
   * Trả về false (không làm gì) nếu dự án đã có tài liệu.
   */
  async seedDemo(projectId: number): Promise<boolean> {
    await this.delay()
    await this.access(projectId, PERMISSIONS.documentEdit, true)
    const db = this.load()
    if (db.nodes.some((n) => n.projectId === projectId && !n.isDeleted)) return false
    // Bản nháp URD-01 thuộc người tạo dữ liệu mẫu → trang Tổng quan có sẵn mục "Tôi đang viết".
    this.writeDemo(projectId, await this.env.actor().catch(() => SEED_USERS.ba))
    return true
  }

  private writeDemo(projectId: number, writer: UserRef = SEED_USERS.ba) {
    const db = this.load()
    if (!db.seededProjects.includes(projectId)) db.seededProjects.push(projectId)
    const day = 86_400_000
    const at = (daysAgo: number, hours = 0) => this.iso(-daysAgo * day - hours * 3_600_000)
    const folder = (title: string, sortOrder: number): NodeRec => {
      const f: NodeRec = {
        documentId: this.nextId(),
        projectId,
        parentId: null,
        kind: 'FOLDER',
        title,
        docType: null,
        code: null,
        sortOrder,
        currentVersionId: null,
        baselineVersionId: null,
        createdById: SEED_USERS.ba.userId,
        createdAt: at(12),
        updatedAt: at(12),
        isDeleted: false,
      }
      db.nodes.push(f)
      return f
    }
    const brd = folder('01. Tài liệu nghiệp vụ (BRD/URD)', 0)
    const srs = folder('02. Đặc tả yêu cầu (SRS)', 1)
    const { ba, lead } = SEED_USERS

    // URD-01 nháp
    const urd = this.newPage(projectId, brd.documentId, 'Hành trình mở tài khoản eKYC', 'URD', writer, urdContent(), {
      at: at(2, 3),
      subtitle: 'Hành trình khách hàng từ tải app tới khi có tài khoản.',
    })
    this.log(urd.n.documentId, urd.v.versionId, 'CREATED', writer)

    // SRS-01 đã duyệt 1.0
    const auth = this.newPage(projectId, srs.documentId, 'Xác thực & phân quyền', 'SRS', ba, authSrsContent(), {
      at: at(9),
      subtitle: 'Đăng nhập, làm mới phiên và khoá tài khoản tạm thời.',
    })
    this.approveSeed(auth.n, auth.v, lead, at(7))
    for (const r of this.reqsOf(auth.v.versionId)) r.freshness = 'FRESH'
    this.log(auth.n.documentId, auth.v.versionId, 'CREATED', ba)
    this.log(auth.n.documentId, auth.v.versionId, 'APPROVED', lead, 'Thêm REQ-01, REQ-02')
    this.backdateActivities(auth.n.documentId, [at(9), at(7)])

    // SRS-02: 1.0 (đã thay thế) → 1.1 (baseline, từng bị yêu cầu sửa 1 lần) → 1.2 đang chờ duyệt
    const pay = this.newPage(projectId, srs.documentId, 'Thanh toán & VietQR động', 'SRS', ba, paySrsV09(), {
      at: at(14),
      subtitle: 'Sinh mã VietQR theo đơn hàng, xử lý webhook ngân hàng và đối soát.',
    })
    this.approveSeed(pay.n, pay.v, lead, at(13))
    const v11 = this.addVersion(pay.n, ba, paySrsV10(), {
      label: '1.1',
      status: 'IN_REVIEW',
      subtitle: pay.v.subtitle,
      at: at(8),
      baseVersionId: pay.v.versionId,
    })
    pay.v.status = 'SUPERSEDED'
    this.approveSeed(pay.n, v11, lead, at(5))
    v11.submittedAt = at(6)
    for (const r of this.reqsOf(v11.versionId)) r.freshness = r.reqUid === PAY_REQ.qr ? 'FRESH' : 'STALE'
    const v12 = this.addVersion(pay.n, ba, paySrsV11(), {
      label: '1.2',
      status: 'IN_REVIEW',
      subtitle: v11.subtitle,
      at: at(1, 5),
      baseVersionId: v11.versionId,
    })
    v12.submittedBy = ba
    v12.submittedAt = at(0, 2)
    v12.updatedAt = at(0, 2)
    pay.n.updatedAt = at(0, 2)
    const pid = pay.n.documentId
    this.log(pid, pay.v.versionId, 'CREATED', ba)
    this.log(pid, pay.v.versionId, 'APPROVED', lead, 'Thêm REQ-01')
    this.log(pid, v11.versionId, 'REVISION_CREATED', ba)
    this.log(pid, v11.versionId, 'SUBMITTED', ba, this.changeSummary(v11, pay.v.versionId))
    this.log(
      pid,
      v11.versionId,
      'CHANGES_REQUESTED',
      lead,
      'Bổ sung cách chống xử lý trùng khi ngân hàng gửi lại webhook.',
    )
    this.log(pid, v11.versionId, 'SUBMITTED', ba, this.changeSummary(v11, pay.v.versionId))
    this.log(pid, v11.versionId, 'APPROVED', lead, this.changeSummary(v11, pay.v.versionId))
    this.log(pid, v12.versionId, 'REVISION_CREATED', ba)
    this.log(pid, v12.versionId, 'SUBMITTED', ba, this.changeSummary(v12, v11.versionId))
    this.backdateActivities(pid, [at(14), at(13), at(8), at(7), at(6, 12), at(6), at(5), at(1, 5), at(0, 2)])
    db.comments.push({
      commentId: this.nextId(),
      documentId: pid,
      versionId: v12.versionId,
      anchorId: 'b-p3',
      quote: 'đồng hồ đếm ngược',
      body: 'Đồng hồ đếm ngược dùng giờ máy chủ hay giờ thiết bị?',
      parentId: null,
      mentions: [],
      author: lead,
      createdAt: at(0, 1),
      resolvedBy: null,
      resolvedAt: null,
    })
    this.persist()
  }

  private approveSeed(n: NodeRec, v: VersionRec, reviewer: UserRef, at: string) {
    v.status = 'APPROVED'
    v.submittedBy = v.author
    v.submittedAt = at
    v.reviewedBy = reviewer
    v.reviewedAt = at
    v.updatedAt = at
    n.baselineVersionId = v.versionId
    n.updatedAt = at
  }

  private backdateActivities(documentId: number, times: string[]) {
    const list = this.load().activities.filter((a) => a.documentId === documentId)
    list.forEach((a, i) => (a.createdAt = times[i] ?? a.createdAt))
  }

  // ---------- 7.1 Cây tài liệu ----------

  async listTree(projectId: number, search?: string): Promise<{ items: DocumentNodeDto[] }> {
    await this.delay()
    await this.access(projectId, PERMISSIONS.documentView, false)
    const all = this.load().nodes.filter((n) => n.projectId === projectId && !n.isDeleted)
    const q = search?.trim().toLocaleLowerCase('vi')
    let result = all
    if (q) {
      const keep = new Set<number>()
      const byId = new Map(all.map((n) => [n.documentId, n]))
      for (const n of all) {
        if (n.title.toLocaleLowerCase('vi').includes(q) || n.code?.toLocaleLowerCase('vi').includes(q)) {
          let cur: NodeRec | undefined = n
          while (cur && !keep.has(cur.documentId)) {
            keep.add(cur.documentId)
            cur = cur.parentId ? byId.get(cur.parentId) : undefined
          }
        }
      }
      result = all.filter((n) => keep.has(n.documentId))
    }
    return { items: result.sort((a, b) => a.sortOrder - b.sortOrder).map((n) => this.nodeDto(n)) }
  }

  async createNode(projectId: number, body: CreateNodeBody): Promise<DocumentNodeDto> {
    await this.delay()
    await this.access(projectId, PERMISSIONS.documentEdit, true)
    const title = body.title?.trim() ?? ''
    if (!title || title.length > 200)
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { title: ['Tiêu đề bắt buộc, tối đa 200 ký tự.'] })
    if (body.kind !== 'FOLDER' && body.kind !== 'PAGE')
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { kind: ['Loại nút không hợp lệ.'] })
    if (body.kind === 'PAGE' && !DOC_TYPES.includes(body.docType as DocType)) {
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { docType: ['Chọn loại tài liệu.'] })
    }
    const parentId = this.validParent(projectId, body.parentId)
    const actor = await this.env.actor()
    if (body.kind === 'PAGE') {
      const { n, v } = this.newPage(projectId, parentId, title, body.docType!, actor, { type: 'doc', content: [] })
      this.log(n.documentId, v.versionId, 'CREATED', actor)
      this.persist()
      return this.nodeDto(n)
    }
    const at = this.iso()
    const f: NodeRec = {
      documentId: this.nextId(),
      projectId,
      parentId,
      kind: 'FOLDER',
      title,
      docType: null,
      code: null,
      sortOrder: this.siblings(projectId, parentId).length,
      currentVersionId: null,
      baselineVersionId: null,
      createdById: actor.userId,
      createdAt: at,
      updatedAt: at,
      isDeleted: false,
    }
    this.load().nodes.push(f)
    this.log(f.documentId, null, 'CREATED', actor)
    this.persist()
    return this.nodeDto(f)
  }

  async updateNode(documentId: number, body: UpdateNodeBody): Promise<DocumentNodeDto> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentEdit, true)
    const actor = await this.env.actor()
    if (body.title !== undefined) {
      const title = body.title.trim()
      if (!title || title.length > 200)
        fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { title: ['Tiêu đề bắt buộc, tối đa 200 ký tự.'] })
      if (title !== n.title) {
        this.log(n.documentId, n.currentVersionId, 'RENAMED', actor, `${n.title} → ${title}`)
        n.title = title
      }
    }
    let moved = false
    if (body.parentId !== undefined && body.parentId !== n.parentId) {
      n.parentId = this.validParent(n.projectId, body.parentId, n.documentId)
      n.sortOrder = Number.MAX_SAFE_INTEGER
      moved = true
    }
    if (body.sortOrder !== undefined || moved) {
      const list = this.siblings(n.projectId, n.parentId, n.documentId)
      const at = Math.max(0, Math.min(body.sortOrder ?? list.length, list.length))
      list.splice(at, 0, n)
      list.forEach((x, i) => (x.sortOrder = i))
      if (moved || body.sortOrder !== undefined) this.log(n.documentId, n.currentVersionId, 'MOVED', actor)
    }
    n.updatedAt = this.iso()
    this.persist()
    return this.nodeDto(n)
  }

  async deleteNode(documentId: number): Promise<void> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentDelete, true)
    const actor = await this.env.actor()
    for (const x of [n, ...this.descendants(documentId)]) {
      x.isDeleted = true
      this.log(x.documentId, x.currentVersionId, 'DELETED', actor)
    }
    this.persist()
  }

  // ---------- 7.2 Trang & phiên bản ----------

  async getDocument(documentId: number, versionId?: number): Promise<DocumentDetailDto> {
    await this.delay()
    const n = this.node(documentId)
    if (n.kind !== 'PAGE') fail(404, 'DOCUMENT_NOT_FOUND', 'Không tìm thấy tài liệu.')
    return this.detail(n, versionId)
  }

  async saveContent(documentId: number, versionId: number, body: SaveContentBody): Promise<SaveContentResult> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentEdit, true)
    const v = this.version(documentId, versionId)
    if (!EDITABLE.includes(v.status)) fail(409, 'VERSION_LOCKED', 'Phiên bản đã khoá, không sửa được.')
    if (body.rowVersion !== v.rowVersion)
      throw new ApiError(409, {
        code: 'VERSION_CONFLICT',
        message: 'Người khác vừa lưu trang này.',
        current: { rowVersion: v.rowVersion, updatedAt: v.updatedAt, updatedBy: v.updatedBy ?? v.author },
      })
    if (!isValidContent(body.content)) fail(400, 'INVALID_CONTENT', 'Nội dung không hợp lệ.')
    const actor = await this.env.actor()
    this.writeContent(n, v, clone(body.content))
    if (body.subtitle !== undefined) v.subtitle = body.subtitle?.trim() || null
    v.rowVersion += 1
    v.updatedAt = this.iso()
    v.updatedBy = actor
    n.updatedAt = v.updatedAt
    // Gộp CONTENT_SAVED: 1 dòng / người / 15 phút.
    const last = this.load()
      .activities.filter(
        (a) => a.documentId === documentId && a.action === 'CONTENT_SAVED' && a.actor.userId === actor.userId,
      )
      .pop()
    if (
      last &&
      this.env.now().getTime() - new Date(last.createdAt).getTime() < SAVE_MERGE_MS &&
      last.versionId === v.versionId
    ) {
      last.createdAt = this.iso()
    } else {
      this.log(documentId, v.versionId, 'CONTENT_SAVED', actor)
    }
    this.persist()
    return { version: this.versionDto(v), requirements: this.reqsOf(v.versionId).map((r) => this.reqDto(r)) }
  }

  async submit(documentId: number, versionId: number, note?: string): Promise<DocumentDetailDto> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentEdit, true)
    const v = this.version(documentId, versionId)
    if (!EDITABLE.includes(v.status)) fail(409, 'INVALID_STATUS', 'Chỉ gửi duyệt được bản nháp hoặc bản cần chỉnh sửa.')
    if (this.reqsOf(v.versionId).length === 0)
      fail(409, 'NO_REQUIREMENTS', 'Trang cần ít nhất 1 yêu cầu (REQ) trước khi gửi duyệt.')
    const actor = await this.env.actor()
    v.status = 'IN_REVIEW'
    v.submittedBy = actor
    v.submittedAt = this.iso()
    v.reviewNote = null
    v.updatedAt = v.submittedAt
    n.updatedAt = v.updatedAt
    const summary = this.changeSummary(v, n.baselineVersionId) ?? (n.baselineVersionId ? null : this.allAdded(v))
    this.log(documentId, v.versionId, 'SUBMITTED', actor, [note?.trim(), summary].filter(Boolean).join(' · ') || null)
    this.persist()
    return this.detail(n)
  }

  private allAdded(v: VersionRec) {
    return formatReqSummary({ modified: [], added: this.reqsOf(v.versionId).map((r) => r.reqKey), removed: [] })
  }

  async approve(documentId: number, versionId: number, note?: string): Promise<DocumentDetailDto> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentApprove, true)
    const v = this.version(documentId, versionId)
    if (v.status !== 'IN_REVIEW') fail(409, 'INVALID_STATUS', 'Chỉ phê duyệt được bản đang chờ duyệt.')
    const actor = await this.env.actor()
    const prevBaseline = n.baselineVersionId
    const summary = this.changeSummary(v, prevBaseline) ?? (prevBaseline ? null : this.allAdded(v))
    // §5: REQ khác hash (hoặc mới) so với baseline trước → STALE; giống → giữ freshness cũ.
    const prev = new Map((prevBaseline ? this.reqsOf(prevBaseline) : []).map((r) => [r.reqUid, r]))
    for (const r of this.reqsOf(v.versionId)) {
      const old = prev.get(r.reqUid)
      r.freshness = !old || old.contentHash !== r.contentHash ? 'STALE' : old.freshness
    }
    if (prevBaseline) {
      const old = this.load().versions.find((x) => x.versionId === prevBaseline)
      if (old) old.status = 'SUPERSEDED'
    }
    v.status = 'APPROVED'
    v.reviewedBy = actor
    v.reviewedAt = this.iso()
    v.reviewNote = note?.trim() || null
    v.updatedAt = v.reviewedAt
    n.baselineVersionId = v.versionId
    n.updatedAt = v.updatedAt
    this.log(documentId, v.versionId, 'APPROVED', actor, [note?.trim(), summary].filter(Boolean).join(' · ') || null)
    this.persist()
    return this.detail(n)
  }

  async requestChanges(documentId: number, versionId: number, note: string): Promise<DocumentDetailDto> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentApprove, true)
    const v = this.version(documentId, versionId)
    if (v.status !== 'IN_REVIEW') fail(409, 'INVALID_STATUS', 'Chỉ yêu cầu chỉnh sửa được bản đang chờ duyệt.')
    const trimmed = (note ?? '').trim()
    if (trimmed.length < 5)
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { note: ['Ghi chú tối thiểu 5 ký tự.'] })
    const actor = await this.env.actor()
    v.status = 'CHANGES_REQUESTED'
    v.reviewedBy = actor
    v.reviewedAt = this.iso()
    v.reviewNote = trimmed.slice(0, 1000)
    v.updatedAt = v.reviewedAt
    n.updatedAt = v.updatedAt
    this.log(documentId, v.versionId, 'CHANGES_REQUESTED', actor, v.reviewNote)
    this.persist()
    return this.detail(n)
  }

  async createRevision(documentId: number): Promise<DocumentDetailDto> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentRevise, true)
    if (!n.baselineVersionId) fail(409, 'NO_BASELINE', 'Trang chưa có bản đã duyệt.')
    const versions = this.load().versions.filter((v) => v.documentId === documentId)
    if (versions.some((v) => OPEN.includes(v.status)))
      fail(409, 'OPEN_VERSION_EXISTS', 'Trang đang có một bản chưa duyệt.')
    const base = this.version(documentId, n.baselineVersionId!)
    const maxMinor = versions.reduce((m, v) => Math.max(m, Number(v.label.split('.')[1] ?? 0)), 0)
    const major = base.label.split('.')[0] ?? '1'
    const actor = await this.env.actor()
    const v = this.addVersion(n, actor, base.content, {
      label: `${major}.${maxMinor + 1}`,
      status: 'DRAFT',
      subtitle: base.subtitle,
      baseVersionId: base.versionId,
    })
    n.updatedAt = v.createdAt
    this.log(documentId, v.versionId, 'REVISION_CREATED', actor)
    this.persist()
    return this.detail(n)
  }

  // ---------- 7.3 RTM, bình luận, lịch sử ----------

  async listRequirements(documentId: number, versionId?: number): Promise<{ items: RequirementItemDto[] }> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentView, false)
    const id = versionId ?? n.currentVersionId
    if (!id) return { items: [] }
    this.version(documentId, id)
    return { items: this.reqsOf(id).map((r) => this.reqDto(r)) }
  }

  private req(requirementId: number) {
    const r = this.load().requirements.find((x) => x.requirementId === requirementId)
    return r ?? fail(404, 'REQUIREMENT_NOT_FOUND', 'Không tìm thấy yêu cầu.')
  }

  async updateRequirement(requirementId: number, body: { priority: Priority }): Promise<RequirementItemDto> {
    await this.delay()
    const r = this.req(requirementId)
    const n = this.node(r.documentId)
    await this.access(n.projectId, PERMISSIONS.documentEdit, true)
    if (!PRIORITIES.includes(body.priority))
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { priority: ['Độ ưu tiên không hợp lệ.'] })
    const v = this.version(r.documentId, r.versionId)
    if (!EDITABLE.includes(v.status)) fail(409, 'VERSION_LOCKED', 'Phiên bản đã khoá, không sửa được.')
    v.content = setHeadingPriority(v.content, r.reqUid, body.priority)
    r.priority = body.priority
    v.rowVersion += 1
    v.updatedAt = this.iso()
    this.persist()
    return this.reqDto(r)
  }

  async confirmFresh(requirementId: number): Promise<RequirementItemDto> {
    await this.delay()
    const r = this.req(requirementId)
    const n = this.node(r.documentId)
    await this.access(n.projectId, PERMISSIONS.documentEdit, true)
    const actor = await this.env.actor()
    for (const x of this.load().requirements.filter((x) => x.documentId === r.documentId && x.reqUid === r.reqUid))
      x.freshness = 'FRESH'
    this.log(r.documentId, r.versionId, 'REQ_CONFIRMED_FRESH', actor, r.reqKey)
    this.persist()
    return this.reqDto(r)
  }

  private commentDto(c: CommentRec): DocumentCommentDto {
    const { documentId: _d, ...dto } = c
    return { ...dto, parentId: dto.parentId ?? null, mentions: dto.mentions ?? [] }
  }

  /** D08: bình luận tài liệu dùng `comment.view`. */
  async listComments(documentId: number, opts: { versionId?: number; includeResolved?: boolean } = {}) {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.commentView, false)
    const items = this.load()
      .comments.filter((c) => c.documentId === documentId)
      .filter((c) => opts.versionId === undefined || c.versionId === opts.versionId)
      .filter((c) => opts.includeResolved || !c.resolvedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.commentId - b.commentId)
      .map((c) => this.commentDto(c))
    return { items }
  }

  /** D01 + D08: `comment.write`; trả lời 1 cấp (`parentId` = bình luận gốc cùng trang); @nhắc theo `mentionUserIds`. */
  async addComment(documentId: number, body: AddCommentBody): Promise<DocumentCommentDto> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.commentWrite, true)
    this.version(documentId, body.versionId)
    const text = (body.body ?? '').trim()
    if (!text || text.length > 2000)
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { body: ['Nội dung 1–2000 ký tự.'] })
    let parentId: number | null = null
    if (body.parentId !== undefined && body.parentId !== null) {
      const parent = this.load().comments.find((x) => x.commentId === Number(body.parentId))
      if (!parent || parent.documentId !== documentId) fail(404, 'COMMENT_NOT_FOUND', 'Không tìm thấy bình luận.')
      if (parent!.parentId)
        fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { parentId: ['Chỉ trả lời được bình luận gốc.'] })
      parentId = parent!.commentId
    }
    const ids = [...new Set((body.mentionUserIds ?? []).map(Number).filter(Number.isFinite))]
    let mentions: UserRef[] = []
    if (ids.length) {
      if (this.filterMentions) {
        const members = await this.env.members(n.projectId).catch(() => [] as UserRef[])
        mentions = ids
          .map((id) => members.find((m) => m.userId === id))
          .filter((m): m is UserRef => !!m)
          .map((m) => ({ userId: m.userId, fullName: m.fullName }))
      } else {
        mentions = ids.map((id) => ({ userId: id, fullName: String(id) }))
      }
    }
    const actor = await this.env.actor()
    const c: CommentRec = {
      commentId: this.nextId(),
      documentId,
      versionId: body.versionId,
      anchorId: body.anchorId ?? null,
      quote: body.quote?.trim().slice(0, 500) || null,
      body: text,
      parentId,
      mentions,
      author: actor,
      createdAt: this.iso(),
      resolvedBy: null,
      resolvedAt: null,
    }
    this.load().comments.push(c)
    this.log(documentId, body.versionId, 'COMMENTED', actor, text.slice(0, 200))
    this.persist()
    return this.commentDto(c)
  }

  /** Resolve bình luận gốc = resolve cả luồng trả lời. */
  async resolveComment(commentId: number): Promise<DocumentCommentDto> {
    await this.delay()
    const c = this.load().comments.find((x) => x.commentId === commentId)
    if (!c) return fail(404, 'COMMENT_NOT_FOUND', 'Không tìm thấy bình luận.')
    const n = this.node(c.documentId)
    await this.access(n.projectId, PERMISSIONS.commentWrite, true)
    const actor = await this.env.actor()
    const at = this.iso()
    for (const x of this.load().comments.filter((y) => y.commentId === commentId || y.parentId === commentId)) {
      if (x.resolvedAt) continue
      x.resolvedBy = actor
      x.resolvedAt = at
    }
    this.persist()
    return this.commentDto(c)
  }

  async listActivity(documentId: number): Promise<{ items: DocumentActivityDto[] }> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentView, false)
    const label = (id: number | null) =>
      id ? (this.load().versions.find((v) => v.versionId === id)?.label ?? null) : null
    const items = this.load()
      .activities.filter((a) => a.documentId === documentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.activityId - a.activityId)
      .slice(0, 100)
      .map((a) => ({
        activityId: a.activityId,
        versionLabel: label(a.versionId),
        action: a.action,
        actor: a.actor,
        note: a.note,
        createdAt: a.createdAt,
      }))
    return { items }
  }

  // ---------- 6. Sinh tài liệu từ ghi chú ----------

  /** D09: `document.edit` + `ai.use` (thiếu → 403) + dự án bật AI (tắt → 409 AI_DISABLED). */
  private async aiGate(projectId: number) {
    const { acc, has } = await this.access(projectId, PERMISSIONS.documentEdit, true)
    if (!has(PERMISSIONS.aiUse)) fail(403, 'FORBIDDEN', 'Bạn không có quyền dùng AI.')
    if (!acc.aiEnabled) fail(409, 'AI_DISABLED', 'Dự án đang tắt module AI.')
  }

  async normalize(projectId: number, rawNotes: string): Promise<NormalizedFields> {
    await this.delay()
    await this.aiGate(projectId)
    const len = (rawNotes ?? '').trim().length
    if (len < 20 || len > 20_000)
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { rawNotes: ['Ghi chú từ 20 đến 20.000 ký tự.'] })
    return normalizeNotes(rawNotes)
  }

  async extract(
    projectId: number,
    fields: NormalizedFields,
    rawNotes?: string,
  ): Promise<{ items: ExtractedRequirement[] }> {
    await this.delay()
    await this.aiGate(projectId)
    return { items: extractRequirementsFromFields(fields, this.env.uid, rawNotes) }
  }

  // ---------- 6b. AI sinh sơ đồ ----------

  async generateDiagram(projectId: number, body: GenerateDiagramBody): Promise<DiagramProposalDto> {
    await this.delay()
    await this.aiGate(projectId)
    const text = (body?.text ?? '').trim()
    if (!text || text.length > DIAGRAM_TEXT_MAX) {
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { text: ['Nội dung từ 1 đến 8.000 ký tự.'] })
    }
    if (body.kind && !DIAGRAM_KINDS.includes(body.kind))
      fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', { kind: ['Loại sơ đồ không hợp lệ.'] })
    return generateDiagram(text, body.kind)
  }

  async getGeneration(documentId: number): Promise<DocumentGenerationDto> {
    await this.delay()
    const n = this.node(documentId)
    await this.access(n.projectId, PERMISSIONS.documentView, false)
    const g = this.load().generations.find((x) => x.documentId === documentId)
    if (!g) return fail(404, 'GENERATION_NOT_FOUND', 'Trang không được tạo từ ghi chú.')
    return {
      rawNotes: g.rawNotes,
      fields: clone(g.fields),
      items: clone(g.items),
      createdBy: g.createdBy,
      createdAt: g.createdAt,
    }
  }

  async createFromNotes(projectId: number, body: CreateFromNotesBody): Promise<DocumentDetailDto> {
    await this.delay()
    await this.aiGate(projectId)
    const title = body.title?.trim() ?? ''
    const errors: Record<string, string[]> = {}
    if (!title || title.length > 200) errors.title = ['Tiêu đề bắt buộc, tối đa 200 ký tự.']
    if (!DOC_TYPES.includes(body.docType)) errors.docType = ['Chọn loại tài liệu.']
    if (!body.items?.length) errors.items = ['Chọn ít nhất 1 yêu cầu.']
    if (Object.keys(errors).length) fail(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', errors)
    const parentId = this.validParent(projectId, body.parentId)
    const actor = await this.env.actor()
    const built = buildGeneratedContent(body.fields, body.items, this.env.uid)
    const { n, v } = this.newPage(projectId, parentId, title, body.docType, actor, built.content, {
      subtitle: body.subtitle?.trim() || null,
    })
    this.load().generations.push({
      id: this.nextId(),
      projectId,
      documentId: n.documentId,
      rawNotes: body.rawNotes,
      fields: clone(body.fields),
      items: built.items.map((i) => ({ ...i, sourceLines: i.sourceLines ?? [] })),
      createdBy: actor,
      createdAt: this.iso(),
    })
    this.log(n.documentId, v.versionId, 'GENERATED_FROM_NOTES', actor, `${body.items.length} REQ`)
    this.persist()
    return this.detail(n)
  }

  // ---------- Cho mock issue / testcase (không thuộc hợp đồng) ----------

  /**
   * REQ của mọi trang trong dự án: bản baseline (đã duyệt gần nhất) và bản hiện tại. Đọc đồng bộ, không kiểm quyền —
   * chỉ để mock issue/testcase giải `ReqRefDto` và phát hiện REQ đổi sau mỗi lần duyệt (§3 hợp đồng Issues-Testcases).
   */
  reqIndex(projectId: number): DocReqIndex[] {
    const db = this.load()
    const lite = (r: ReqRec): ReqLite => ({
      reqUid: r.reqUid,
      reqKey: r.reqKey,
      title: r.title,
      contentHash: r.contentHash,
      freshness: r.freshness,
      priority: r.priority,
      acceptanceCriteria: clone(r.acceptanceCriteria),
    })
    return db.nodes
      .filter((n) => n.projectId === projectId && n.kind === 'PAGE' && !n.isDeleted)
      .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.documentId - b.documentId)
      .map((n) => {
        const base = n.baselineVersionId ? db.versions.find((v) => v.versionId === n.baselineVersionId) : undefined
        const cur = n.currentVersionId ? db.versions.find((v) => v.versionId === n.currentVersionId) : undefined
        return {
          documentId: n.documentId,
          code: n.code ?? `DOC-${n.documentId}`,
          title: n.title,
          baselineVersionId: base?.versionId ?? null,
          baselineLabel: base?.label ?? null,
          baseline: base ? this.reqsOf(base.versionId).map(lite) : [],
          current: cur && cur.versionId !== base?.versionId ? this.reqsOf(cur.versionId).map(lite) : [],
        }
      })
  }
}
