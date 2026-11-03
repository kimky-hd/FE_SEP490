// Khớp 1-1 với doc/Documents-API-Contract.md §2 (DTO) và §6 (sinh tài liệu từ ghi chú). Sửa API thì sửa cả 2 chỗ.

export const DOCUMENT_KINDS = ['FOLDER', 'PAGE'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]
// Enum dạng mảng hằng để src/api/contract.test.ts so được với khối JSON hợp đồng trong tài liệu BE.
export const DOC_TYPES = ['URD', 'BRD', 'SRS', 'OTHER'] as const
export type DocType = (typeof DOC_TYPES)[number]
export const VERSION_STATUSES = ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED'] as const
export type VersionStatus = (typeof VERSION_STATUSES)[number]
export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type Priority = (typeof PRIORITIES)[number]
export const FRESHNESS = ['FRESH', 'STALE'] as const
export type Freshness = (typeof FRESHNESS)[number]
export type CalloutTone = 'info' | 'warning' | 'rule' | 'success'

export interface UserRef {
  userId: number
  fullName: string
}

/** Node JSON ProseMirror/TipTap (§3). Giữ lỏng vì BE chỉ lưu nguyên văn. */
export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export interface TipTapDoc extends TipTapNode {
  type: 'doc'
  content: TipTapNode[]
}

export interface DocumentVersionRef {
  versionId: number
  label: string
  status: VersionStatus
}

// Một nút trên cây (trả phẳng, FE tự dựng cây theo parentId + sortOrder)
export interface DocumentNodeDto {
  documentId: number
  projectId: number
  parentId: number | null
  kind: DocumentKind
  title: string
  docType: DocType | null
  code: string | null
  sortOrder: number
  currentVersion: DocumentVersionRef | null
  isBaselined: boolean
  baselineVersionId: number | null
  reqCount: number
  updatedAt: string
}

export interface DocumentVersionSummaryDto {
  versionId: number
  label: string
  status: VersionStatus
  author: UserRef
  reviewedBy: UserRef | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

export interface DocumentVersionDto extends DocumentVersionSummaryDto {
  documentId: number
  subtitle: string | null
  content: TipTapDoc
  rowVersion: number
  baseVersionId: number | null
}

export interface DocumentPermissions {
  edit: boolean
  approve: boolean
  revise: boolean
  delete: boolean
}

export interface DocumentDetailDto {
  node: DocumentNodeDto
  versions: DocumentVersionSummaryDto[]
  current: DocumentVersionDto
  can: DocumentPermissions
}

export interface AcceptanceCriterion {
  text: string
  checked: boolean
}

export interface RequirementItemDto {
  requirementId: number
  reqUid: string
  reqKey: string
  title: string
  anchorId: string
  priority: Priority
  freshness: Freshness
  bodyPreview: string
  bodyLength: number
  acceptanceCriteria: AcceptanceCriterion[]
  hasTable: boolean
  hasDiagram: boolean
  hasFigma: boolean
  changedSinceBaseline: boolean
}

export interface DocumentCommentDto {
  commentId: number
  versionId: number
  anchorId: string | null
  quote: string | null
  body: string
  /** D01: bình luận gốc mà bình luận này trả lời (1 cấp); null = bình luận gốc. */
  parentId: number | null
  /** D01: người được @nhắc (từ `mentionUserIds`, đã lọc theo thành viên dự án). */
  mentions: UserRef[]
  author: UserRef
  createdAt: string
  resolvedBy: UserRef | null
  resolvedAt: string | null
}

export const DOCUMENT_ACTIVITY_ACTIONS = [
  'CREATED',
  'DELETED',
  'GENERATED_FROM_NOTES',
  'CONTENT_SAVED',
  'SUBMITTED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REVISION_CREATED',
  'RENAMED',
  'MOVED',
  'REQ_CONFIRMED_FRESH',
  'COMMENTED',
] as const
export type DocumentActivityAction = (typeof DOCUMENT_ACTIVITY_ACTIONS)[number]

export interface DocumentActivityDto {
  activityId: number
  versionLabel: string | null
  action: DocumentActivityAction | string
  actor: UserRef
  note: string | null
  createdAt: string
}

export interface SaveContentResult {
  version: DocumentVersionDto
  requirements: RequirementItemDto[]
}

// --- Request bodies (§7) ---

export interface CreateNodeBody {
  kind: DocumentKind
  title: string
  parentId?: number | null
  docType?: DocType
}

export interface UpdateNodeBody {
  title?: string
  parentId?: number | null
  sortOrder?: number
}

export interface SaveContentBody {
  content: TipTapDoc
  subtitle?: string | null
  rowVersion: number
}

// --- Sinh tài liệu từ ghi chú (§6) ---

export interface NormalizedFields {
  scope: string
  actors: string
  mainFlows: string
  businessRules: string
}

export interface ExtractedRequirement {
  tempId: string
  title: string
  description: string
  priority: Priority
  acceptanceCriteria: string[]
  /** Chỉ số dòng (0-based) trong rawNotes sinh ra REQ này. */
  sourceLines: number[]
}

export interface GeneratedItem extends ExtractedRequirement {
  /** reqUid đã gán cho heading REQ trong trang được tạo. */
  reqUid: string | null
}

export interface DocumentGenerationDto {
  rawNotes: string
  fields: NormalizedFields
  items: GeneratedItem[]
  createdBy: UserRef
  createdAt: string
}

export interface CreateFromNotesBody {
  title: string
  docType: DocType
  parentId: number | null
  subtitle?: string
  rawNotes: string
  fields: NormalizedFields
  items: ExtractedRequirement[]
}

export interface AddCommentBody {
  versionId: number
  anchorId?: string | null
  quote?: string | null
  body: string
  /** D01: trả lời bình luận gốc (1 cấp). */
  parentId?: number | null
  /** D01: id người được @nhắc (thành viên dự án). */
  mentionUserIds?: number[]
}

// --- Việc của tôi (đề xuất GET /me/document-work, contract §7.5) ---

/** Một trang ở trạng thái cần ai đó làm gì (chờ duyệt / đang viết / bị yêu cầu sửa). */
export interface DocumentWorkItem {
  documentId: number
  projectId: number
  projectName: string
  projectKey: string
  code: string | null
  title: string
  docType: DocType | null
  versionId: number
  versionLabel: string
  status: VersionStatus
  author: UserRef
  /** Người gửi duyệt bản hiện tại (null nếu chưa gửi). */
  submittedBy: UserRef | null
  /** Tóm tắt REQ thay đổi (note của activity SUBMITTED gần nhất), vd "Sửa REQ-01; thêm REQ-03". */
  changeSummary: string | null
  reqCount: number
  updatedAt: string
}

export interface StaleRequirementItem {
  requirementId: number
  reqKey: string
  title: string
  documentId: number
  code: string | null
  documentTitle: string
  projectId: number
  projectName: string
  versionLabel: string
  updatedAt: string
}

export type DocumentWorkEventKind = 'APPROVED' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'STALE'

export interface DocumentWorkEvent {
  /** Khoá ổn định cho danh sách: `${kind}-${id}`. */
  id: string
  kind: DocumentWorkEventKind
  actor: UserRef | null
  documentId: number
  projectId: number
  projectName: string
  code: string | null
  title: string
  versionLabel: string | null
  /** Ghi chú duyệt / tóm tắt REQ / nội dung bình luận. */
  note: string | null
  /** Với STALE: số REQ cần cập nhật. */
  count: number | null
  createdAt: string
}

export interface ProjectDocumentStats {
  projectId: number
  pages: number
  reqs: number
  approved: number
  inReview: number
  /** DRAFT + CHANGES_REQUESTED. */
  draft: number
  staleReqs: number
}

export interface MyDocumentWorkDto {
  reviews: DocumentWorkItem[]
  drafts: DocumentWorkItem[]
  changesRequested: DocumentWorkItem[]
  staleReqs: StaleRequirementItem[]
  activity: DocumentWorkEvent[]
  projectStats: ProjectDocumentStats[]
}

// §6b AI sinh sơ đồ
export type DiagramKind = 'flowchart' | 'sequence' | 'state'

export interface GenerateDiagramBody {
  /** ≤ 8 000 ký tự. */
  text: string
  kind?: DiagramKind
  documentId?: number
  anchorId?: string
}

export interface DiagramProposalDto {
  mermaid: string
  kind: DiagramKind
  notes: string[]
}
