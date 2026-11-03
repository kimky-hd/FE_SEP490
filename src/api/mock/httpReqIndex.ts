import type { DocumentDetailDto, DocumentNodeDto, RequirementItemDto } from '@/types/document'
import type { DocReqIndex, ReqLite } from './documentMockStore'

// Chỉ mục REQ cho mock Kanban / Test cases khi module Tài liệu đã chạy BE thật (VITE_MOCK_DOCUMENTS=false,
// VITE_MOCK_KANBAN / VITE_MOCK_TESTS vẫn true). Đọc qua các API Tài liệu (#1, #5, #12).
// RequirementItemDto không có content_hash (BE giữ riêng) nên mock tự băm từ các trường nhìn thấy được — chỉ dùng để
// phát hiện "REQ đổi sau lần duyệt" trong mock; BE thật dùng content_hash (§C.4).

export interface ReqIndexSource {
  listTree: (projectId: number) => Promise<DocumentNodeDto[]>
  listRequirements: (documentId: number, versionId?: number) => Promise<RequirementItemDto[]>
  get: (documentId: number) => Promise<DocumentDetailDto>
}

/** Băm FNV-1a 32 bit (đủ để so khác / giống trong mock). */
function fnv(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function pseudoHash(r: RequirementItemDto): string {
  return fnv(
    JSON.stringify([r.title, r.priority, r.bodyPreview, r.bodyLength, r.acceptanceCriteria, r.hasTable, r.hasDiagram]),
  )
}

const lite = (r: RequirementItemDto): ReqLite => ({
  reqUid: r.reqUid,
  reqKey: r.reqKey,
  title: r.title,
  contentHash: pseudoHash(r),
  freshness: r.freshness,
  priority: r.priority,
  acceptanceCriteria: r.acceptanceCriteria.map((c) => ({ ...c })),
})

export async function loadHttpReqIndex(api: ReqIndexSource, projectId: number): Promise<DocReqIndex[]> {
  const pages = (await api.listTree(projectId))
    .filter((n) => n.kind === 'PAGE')
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '') || a.documentId - b.documentId)
  return Promise.all(
    pages.map(async (n): Promise<DocReqIndex> => {
      const baseId = n.baselineVersionId
      const curId = n.currentVersion?.versionId ?? null
      const [baseline, current, detail] = await Promise.all([
        baseId ? api.listRequirements(n.documentId, baseId).catch(() => []) : Promise.resolve([]),
        curId && curId !== baseId ? api.listRequirements(n.documentId, curId).catch(() => []) : Promise.resolve([]),
        baseId && baseId !== curId ? api.get(n.documentId).catch(() => null) : Promise.resolve(null),
      ])
      return {
        documentId: n.documentId,
        code: n.code ?? `DOC-${n.documentId}`,
        title: n.title,
        baselineVersionId: baseId,
        baselineLabel:
          baseId === null
            ? null
            : baseId === curId
              ? (n.currentVersion?.label ?? null)
              : (detail?.versions.find((v) => v.versionId === baseId)?.label ?? null),
        baseline: baseline.map(lite),
        current: current.map(lite),
      }
    }),
  )
}
