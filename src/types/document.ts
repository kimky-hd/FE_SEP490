// Định nghĩa dữ liệu cho phân hệ Quản lý Đặc tả Tài liệu Yêu cầu (Document Workspace & Auto-Extracted Requirement Items)

export type DocumentType = 'SRS' | 'URD' | 'BRD'
export type DocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED'
export type RequirementItemType = 'REQUIREMENT' | 'INFO_SECTION'
export type ItemPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type ItemType = RequirementItemType
export type PriorityType = ItemPriority
export type DiagramType = 'MERMAID_PLANTUML' | 'IMAGE_UPLOAD' | 'NONE'
export type TraceSyncStatus = 'FRESH' | 'UNCONFIRMED_STALE' | 'CONFIRMED_STALE'
export type HistoryChangeType = 'CONTENT' | 'DIAGRAM' | 'FIGMA_UI' | 'CREATED'
export type ConfirmationState = 'UNCONFIRMED_DRAFT' | 'CONFIRMED_APPROVED' | 'REVERTED'

/** Các loại khối nội dung tự do trong trình soạn thảo Tài liệu */
export type DocumentBlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'checklist'
  | 'table'
  | 'callout'
  | 'diagram'
  | 'figma'
  | 'divider'

export type ConfluenceBlockType = DocumentBlockType

export type CalloutTone = 'info' | 'warning' | 'rule' | 'success'

export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
}

/** Khối nội dung trong trang Tài liệu (Rich Free-Form Block) */
export interface DocumentBlock {
  id: string
  type: DocumentBlockType
  text?: string // Dùng cho h1, h2, h3, paragraph, callout

  // Định dạng văn bản cơ bản
  bold?: boolean
  italic?: boolean
  underline?: boolean

  // Khi block là Heading (h1, h2, h3) -> Có thể đánh dấu là Requirement Item (REQ-xx)
  isReq?: boolean
  reqId?: string // Định danh cố định bất biến (immutable itemId) trong CSDL
  reqKeyCode?: string // VD: 'REQ-01', 'REQ-02'
  reqPriority?: ItemPriority // 'HIGH' | 'MEDIUM' | 'LOW'
  clarificationNeeded?: string | null
  isAiGenerated?: boolean
  confidenceScore?: number

  // Khi block là bullet_list hoặc numbered_list
  listItems?: string[]

  // Khi block là checklist
  checklistItems?: ChecklistItem[]

  // Khi block là table (Bảng biểu tự do có thể thêm/xóa hàng cột)
  tableHeaders?: string[]
  tableRows?: string[][]

  // Khi block là callout (Info / Warning / Rule / Success panel)
  calloutTone?: CalloutTone
  calloutTitle?: string

  // Khi block là diagram (Mermaid / PlantUML)
  diagramTitle?: string
  diagramType?: DiagramType
  diagramSourceCode?: string

  // Khi block là figma (Figma Embed Block)
  figmaFrameName?: string
  figmaUrl?: string
}

export type ConfluenceBlock = DocumentBlock

/** 4 trường cấu trúc chuẩn hóa từ ghi chú thô (Raw Notes) */
export interface NormalizedRawNotes {
  scope: string
  actors: string
  mainFlows: string
  businessRules: string
}

/** Trang tài liệu đặc tả trong cây Tài liệu (Document Set) */
export interface SpecificationDocument {
  id: number
  projectId: number
  parentPageId?: number | null // ID trang/thư mục cha trên cây tài liệu đa cấp
  isFolder?: boolean // Nhánh thư mục nhóm hoặc trang chứa trang con
  icon?: string // Icon hiển thị trên cây (📂, 📄, 🔐, 💳...)
  orderIndex?: number
  code: string // VD: SRS-01, URD-01
  title: string
  docType: DocumentType
  version: string // VD: v1.0, v1.1
  status: DocumentStatus
  description: string | null
  normalizedRawNotes?: NormalizedRawNotes
  blocks?: DocumentBlock[] // Danh sách các khối nội dung tự do của trang tài liệu
  createdBy: string
  createdAt: string
  updatedAt: string
  approvedBy?: string | null
  approvedAt?: string | null
  parentDocId?: number | null // Tham chiếu phiên bản trước khi tạo bản sửa đổi (Revision)
}

/** Cấu phần yêu cầu được bóc tách tự động từ phân đoạn Heading (Section Slice) */
export interface RequirementItem {
  id: string // UUID hoặc chuỗi định danh bất biến (immutability)
  documentId: number
  keyCode: string // VD: REQ-01, REQ-02, SEC-01
  headingNumber: string // VD: '1.0', '2.1'
  headingTitle: string
  itemType: RequirementItemType
  priority: ItemPriority
  content: string
  acceptanceCriteria: string
  clarificationNeeded: string | null // Ghi chú điểm thiếu thông tin cần làm rõ
  isAiGenerated: boolean
  confidenceScore?: number // Điểm tin cậy (VD: 94)

  // Thành phần Diagram tự động lấy từ phân đoạn Heading
  diagramTitle?: string
  diagramType: DiagramType
  diagramSourceCode?: string
  diagramSvgPreview?: string

  // Thành phần Figma UI tự động lấy từ phân đoạn Heading
  requiresUi: boolean
  figmaFrameName?: string
  figmaUrl?: string
  figmaSyncedAt?: string

  // Chỉ báo có chứa bảng biểu trong phân đoạn
  hasTable?: boolean

  // Liên kết truy xuất RTM (BF-07)
  linkedTestCases: string[] // VD: ['TC-01', 'TC-02']
  linkedIssues: string[] // VD: ['CORE-101']
  syncStatus: TraceSyncStatus
}

/** Nhật ký lịch sử thay đổi của từng RequirementItem */
export interface RequirementHistoryLog {
  id: string
  documentId: number
  requirementItemId: string
  requirementKeyCode: string
  version: string
  changeType: HistoryChangeType
  previousContent?: string
  newContent?: string
  previousAcceptanceCriteria?: string
  newAcceptanceCriteria?: string
  previousDiagram?: string
  newDiagram?: string
  previousFigmaUrl?: string
  newFigmaUrl?: string
  changedBy: string
  changedAt: string
  confirmationState: ConfirmationState
}

/** Bình luận phản biện theo từng RequirementItem */
export interface DocumentComment {
  id: string
  documentId: number
  requirementItemId: string
  authorName: string
  authorRole: string
  body: string
  content?: string
  createdAt: string
  isResolved: boolean
  isStale: boolean // Tự động bật true nếu RequirementItem bị sửa sau khi bình luận tạo
}
