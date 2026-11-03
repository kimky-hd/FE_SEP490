import { api } from '@/lib/apiClient'
import type { ItemsDto } from '@/types/rbac'
import type { MyDocumentWorkDto } from '@/types/document'
import type { WorkItemDto, WorkItemsQuery } from '@/types/work'
import { MOCK } from './mockFlags'
import { mockDocumentWork, mockWorkItems } from './mock/workItemsMock'

// doc/BE-Changes-2026-10-28_30-API.md §B — "Việc của tôi" & trang Tổng quan.
//   #23 GET /me/document-work  (số liệu + dòng hoạt động trên trang Tổng quan)
//   #24 GET /me/work-items     (Việc của tôi, chấm tín hiệu menu)
// Mock (VITE_MOCK_WORK=true): ghép từ API từng module (đang mock hay đã là BE thật) bằng đúng luật của BE.

export interface WorkApi {
  workItems: (query: WorkItemsQuery) => Promise<WorkItemDto[]>
  documentWork: (companyId: number | null) => Promise<MyDocumentWorkDto>
}

const params = (q: WorkItemsQuery) => ({ companyId: q.companyId ?? undefined, projectId: q.projectId })

export const httpWorkApi: WorkApi = {
  workItems: (query) =>
    api.get<ItemsDto<WorkItemDto>>('/me/work-items', { params: params(query) }).then((r) => r.data.items),
  documentWork: (companyId) =>
    api
      .get<MyDocumentWorkDto>('/me/document-work', { params: { companyId: companyId ?? undefined } })
      .then((r) => r.data),
}

const mockWorkApi: WorkApi = {
  workItems: mockWorkItems,
  documentWork: mockDocumentWork,
}

export const workApi: WorkApi = MOCK.work ? mockWorkApi : httpWorkApi
