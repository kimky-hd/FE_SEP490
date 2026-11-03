import { api } from '@/lib/apiClient'
import { withInvalidation } from '@/lib/dataEvents'
import { browserStorage, currentActor, mockMembers, mockProjectAccess } from './mockSupport'
import { DocumentMockStore, type ProjectAccess } from './mock/documentMockStore'
import { MOCK } from './mockFlags'
import type { ItemsDto } from '@/types/rbac'
import type {
  AddCommentBody,
  CreateFromNotesBody,
  CreateNodeBody,
  DiagramProposalDto,
  DocumentActivityDto,
  DocumentCommentDto,
  DocumentDetailDto,
  DocumentGenerationDto,
  DocumentNodeDto,
  ExtractedRequirement,
  GenerateDiagramBody,
  NormalizedFields,
  Priority,
  RequirementItemDto,
  SaveContentBody,
  SaveContentResult,
  UpdateNodeBody,
} from '@/types/document'

// doc/BE-Changes-2026-10-28_30-API.md §A (#1–#22) — một hàm cho mỗi endpoint, path / body đúng tài liệu.
// Mock trong trình duyệt khi VITE_MOCK_DOCUMENTS=true (src/api/mockFlags.ts); 'false' thì gọi BE thật.

export interface DocumentApi {
  // 7.1 Cây tài liệu
  listTree: (projectId: number, search?: string) => Promise<DocumentNodeDto[]>
  createNode: (projectId: number, body: CreateNodeBody) => Promise<DocumentNodeDto>
  updateNode: (documentId: number, body: UpdateNodeBody) => Promise<DocumentNodeDto>
  deleteNode: (documentId: number) => Promise<void>
  // 7.2 Trang & phiên bản
  get: (documentId: number, versionId?: number) => Promise<DocumentDetailDto>
  saveContent: (documentId: number, versionId: number, body: SaveContentBody) => Promise<SaveContentResult>
  submit: (documentId: number, versionId: number, note?: string) => Promise<DocumentDetailDto>
  approve: (documentId: number, versionId: number, note?: string) => Promise<DocumentDetailDto>
  requestChanges: (documentId: number, versionId: number, note: string) => Promise<DocumentDetailDto>
  createRevision: (documentId: number) => Promise<DocumentDetailDto>
  // 7.3 RTM, bình luận, lịch sử
  listRequirements: (documentId: number, versionId?: number) => Promise<RequirementItemDto[]>
  updateRequirement: (requirementId: number, body: { priority: Priority }) => Promise<RequirementItemDto>
  confirmFresh: (requirementId: number) => Promise<RequirementItemDto>
  listComments: (
    documentId: number,
    params?: { versionId?: number; includeResolved?: boolean },
  ) => Promise<DocumentCommentDto[]>
  addComment: (documentId: number, body: AddCommentBody) => Promise<DocumentCommentDto>
  resolveComment: (commentId: number) => Promise<DocumentCommentDto>
  activity: (documentId: number) => Promise<DocumentActivityDto[]>
  // 6. Sinh tài liệu từ ghi chú
  normalize: (projectId: number, rawNotes: string) => Promise<NormalizedFields>
  extract: (projectId: number, fields: NormalizedFields, rawNotes: string) => Promise<ExtractedRequirement[]>
  createFromNotes: (projectId: number, body: CreateFromNotesBody) => Promise<DocumentDetailDto>
  /** 404 GENERATION_NOT_FOUND nếu trang không tạo từ ghi chú. */
  getGeneration: (documentId: number) => Promise<DocumentGenerationDto>
  // 6b. AI sinh sơ đồ (đề xuất, không tự sửa tài liệu)
  generateDiagram: (projectId: number, body: GenerateDiagramBody) => Promise<DiagramProposalDto>
  /** Chỉ có khi chạy mock (không thuộc hợp đồng BE). */
  mock?: {
    /** Tạo bộ tài liệu demo cho dự án đang rỗng; false nếu dự án đã có tài liệu. */
    seedDemo: (projectId: number) => Promise<boolean>
  }
}

export const httpDocumentApi: DocumentApi = {
  listTree: (projectId, search) =>
    api
      .get<ItemsDto<DocumentNodeDto>>(`/projects/${projectId}/documents`, { params: { search: search || undefined } })
      .then((r) => r.data.items),
  createNode: (projectId, body) =>
    api.post<DocumentNodeDto>(`/projects/${projectId}/documents`, body).then((r) => r.data),
  updateNode: (documentId, body) => api.patch<DocumentNodeDto>(`/documents/${documentId}`, body).then((r) => r.data),
  deleteNode: (documentId) => api.delete(`/documents/${documentId}`).then(() => undefined),

  get: (documentId, versionId) =>
    api.get<DocumentDetailDto>(`/documents/${documentId}`, { params: { versionId } }).then((r) => r.data),
  saveContent: (documentId, versionId, body) =>
    api.put<SaveContentResult>(`/documents/${documentId}/versions/${versionId}/content`, body).then((r) => r.data),
  submit: (documentId, versionId, note) =>
    api.post<DocumentDetailDto>(`/documents/${documentId}/versions/${versionId}/submit`, { note }).then((r) => r.data),
  approve: (documentId, versionId, note) =>
    api.post<DocumentDetailDto>(`/documents/${documentId}/versions/${versionId}/approve`, { note }).then((r) => r.data),
  requestChanges: (documentId, versionId, note) =>
    api
      .post<DocumentDetailDto>(`/documents/${documentId}/versions/${versionId}/request-changes`, { note })
      .then((r) => r.data),
  createRevision: (documentId) =>
    api.post<DocumentDetailDto>(`/documents/${documentId}/revisions`, {}).then((r) => r.data),

  listRequirements: (documentId, versionId) =>
    api
      .get<ItemsDto<RequirementItemDto>>(`/documents/${documentId}/requirements`, { params: { versionId } })
      .then((r) => r.data.items),
  updateRequirement: (requirementId, body) =>
    api.patch<RequirementItemDto>(`/requirements/${requirementId}`, body).then((r) => r.data),
  confirmFresh: (requirementId) =>
    api.post<RequirementItemDto>(`/requirements/${requirementId}/confirm-fresh`, {}).then((r) => r.data),
  listComments: (documentId, params = {}) =>
    api.get<ItemsDto<DocumentCommentDto>>(`/documents/${documentId}/comments`, { params }).then((r) => r.data.items),
  addComment: (documentId, body) =>
    api.post<DocumentCommentDto>(`/documents/${documentId}/comments`, body).then((r) => r.data),
  resolveComment: (commentId) => api.post<DocumentCommentDto>(`/comments/${commentId}/resolve`, {}).then((r) => r.data),
  activity: (documentId) =>
    api.get<ItemsDto<DocumentActivityDto>>(`/documents/${documentId}/activity`).then((r) => r.data.items),

  normalize: (projectId, rawNotes) =>
    api
      .post<NormalizedFields>(`/projects/${projectId}/document-generation/normalize`, { rawNotes })
      .then((r) => r.data),
  extract: (projectId, fields, rawNotes) =>
    api
      .post<ItemsDto<ExtractedRequirement>>(`/projects/${projectId}/document-generation/extract`, { fields, rawNotes })
      .then((r) => r.data.items),
  createFromNotes: (projectId, body) =>
    api.post<DocumentDetailDto>(`/projects/${projectId}/document-generation/create`, body).then((r) => r.data),
  getGeneration: (documentId) =>
    api.get<DocumentGenerationDto>(`/documents/${documentId}/generation`).then((r) => r.data),
  generateDiagram: (projectId, body) =>
    api.post<DiagramProposalDto>(`/projects/${projectId}/document-ai/diagram`, body).then((r) => r.data),
}

// ---------- Mock: quyền & người dùng lấy từ API thật đã có (xem mockSupport.ts) ----------

const projectAccess = (projectId: number): Promise<ProjectAccess> => mockProjectAccess(projectId)

function createMockDocumentApi(store: DocumentMockStore): DocumentApi {
  const mockApi: DocumentApi = {
    listTree: (projectId, search) => store.listTree(projectId, search).then((r) => r.items),
    createNode: (projectId, body) => store.createNode(projectId, body),
    updateNode: (documentId, body) => store.updateNode(documentId, body),
    deleteNode: (documentId) => store.deleteNode(documentId),
    get: (documentId, versionId) => store.getDocument(documentId, versionId),
    saveContent: (documentId, versionId, body) => store.saveContent(documentId, versionId, body),
    submit: (documentId, versionId, note) => store.submit(documentId, versionId, note),
    approve: (documentId, versionId, note) => store.approve(documentId, versionId, note),
    requestChanges: (documentId, versionId, note) => store.requestChanges(documentId, versionId, note),
    createRevision: (documentId) => store.createRevision(documentId),
    listRequirements: (documentId, versionId) => store.listRequirements(documentId, versionId).then((r) => r.items),
    updateRequirement: (requirementId, body) => store.updateRequirement(requirementId, body),
    confirmFresh: (requirementId) => store.confirmFresh(requirementId),
    listComments: (documentId, params) => store.listComments(documentId, params).then((r) => r.items),
    addComment: (documentId, body) => store.addComment(documentId, body),
    resolveComment: (commentId) => store.resolveComment(commentId),
    activity: (documentId) => store.listActivity(documentId).then((r) => r.items),
    normalize: (projectId, rawNotes) => store.normalize(projectId, rawNotes),
    extract: (projectId, fields, rawNotes) => store.extract(projectId, fields, rawNotes).then((r) => r.items),
    getGeneration: (documentId) => store.getGeneration(documentId),
    createFromNotes: (projectId, body) => store.createFromNotes(projectId, body),
    generateDiagram: (projectId, body) => store.generateDiagram(projectId, body),
    mock: {
      seedDemo: (projectId) => store.seedDemo(projectId),
    },
  }
  return mockApi
}

// Mock phải bật chủ động (VITE_MOCK_DOCUMENTS=true hoặc cờ cũ VITE_DOCUMENTS_MOCK=true) — production gọi BE thật.
export const isDocumentsMock = MOCK.documents

// Thao tác ghi của mock không đi qua apiClient nên tự báo "dữ liệu đổi" (bản HTTP đã có interceptor lo).
const MOCK_MUTATIONS = [
  'createNode',
  'updateNode',
  'deleteNode',
  'submit',
  'approve',
  'requestChanges',
  'createRevision',
  'updateRequirement',
  'confirmFresh',
  'addComment',
  'resolveComment',
  'createFromNotes',
] as const satisfies readonly (keyof DocumentApi)[]
const MOCK_QUIET_MUTATIONS = ['saveContent'] as const satisfies readonly (keyof DocumentApi)[]

/** Kho mock dùng chung (issue / testcase tra REQ trong đây); null khi gọi BE thật. */
export const documentMockStore: DocumentMockStore | null = isDocumentsMock
  ? new DocumentMockStore({ actor: currentActor, projectAccess, members: mockMembers, storage: browserStorage() })
  : null

export const documentApi: DocumentApi = documentMockStore
  ? withInvalidation(createMockDocumentApi(documentMockStore), MOCK_MUTATIONS, MOCK_QUIET_MUTATIONS)
  : httpDocumentApi

// Cho script kiểm thử / dev: `window.__ssamDocsMock.seedDemo(projectId)` (chỉ khi chạy mock).
if (isDocumentsMock && typeof window !== 'undefined' && documentApi.mock) {
  ;(window as unknown as { __ssamDocsMock?: DocumentApi['mock'] }).__ssamDocsMock = documentApi.mock
}
