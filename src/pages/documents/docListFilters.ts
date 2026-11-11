import type { DocType, DocumentNodeDto, VersionStatus } from '@/types/document'

// Bộ lọc màn "Danh sách tài liệu" (DocumentsHome): tab trạng thái + Thư mục + Loại + ô tìm. Tách khỏi component để
// test được. Chỉ xét trang (PAGE) đã có phiên bản hiện tại.

export type DocTab = 'ALL' | Exclude<VersionStatus, 'SUPERSEDED'> | 'STALE'
export const DOC_TABS: DocTab[] = ['ALL', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'DRAFT', 'STALE']

export interface DocListFilter {
  tab: DocTab
  /** Thư mục: lấy cả trang nằm sâu trong cây con của thư mục. null = tất cả. */
  folderId: number | null
  docType: DocType | null
  search: string
}

export const EMPTY_FILTER: DocListFilter = { tab: 'ALL', folderId: null, docType: null, search: '' }

export const isFiltered = (f: DocListFilter) =>
  f.tab !== 'ALL' || f.folderId !== null || !!f.docType || !!f.search.trim()

/** Trang có nằm trong cây con của `folderId` không (đi ngược theo parentId, chặn vòng lặp). */
export function isInFolder(node: DocumentNodeDto, folderId: number, byId: Map<number, DocumentNodeDto>) {
  const seen = new Set<number>()
  let parentId = node.parentId
  while (parentId !== null && !seen.has(parentId)) {
    if (parentId === folderId) return true
    seen.add(parentId)
    parentId = byId.get(parentId)?.parentId ?? null
  }
  return false
}

/** Đường dẫn thư mục "Cha / Con" của một nút (không gồm chính nó). */
export function folderPath(node: DocumentNodeDto, byId: Map<number, DocumentNodeDto>) {
  const parts: string[] = []
  const seen = new Set<number>()
  let parentId = node.parentId
  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId)
    const p = byId.get(parentId)
    if (!p) break
    parts.unshift(p.title)
    parentId = p.parentId
  }
  return parts.join(' / ')
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

/** Lọc phụ (thư mục, loại, tìm theo mã / tên) — áp cho cả số đếm trên tab. */
function matchesExtra(n: DocumentNodeDto, f: DocListFilter, byId: Map<number, DocumentNodeDto>) {
  if (f.folderId !== null && !isInFolder(n, f.folderId, byId)) return false
  if (f.docType && (n.docType ?? 'OTHER') !== f.docType) return false
  const q = norm(f.search.trim())
  if (q && !norm(`${n.code ?? ''} ${n.title}`).includes(q)) return false
  return true
}

function matchesTab(n: DocumentNodeDto, tab: DocTab, staleOf: (n: DocumentNodeDto) => number) {
  if (tab === 'ALL') return true
  if (tab === 'STALE') return staleOf(n) > 0
  return n.currentVersion?.status === tab
}

/**
 * Số trên từng tab, tính sau bộ lọc phụ. "REQ cần cập nhật" đếm số REQ stale (không phải số trang) như ô số cũ;
 * bấm vào thì hiện các trang có REQ stale.
 */
export function tabCounts(
  pages: DocumentNodeDto[],
  f: DocListFilter,
  byId: Map<number, DocumentNodeDto>,
  staleOf: (n: DocumentNodeDto) => number,
): Record<DocTab, number> {
  const counts: Record<DocTab, number> = {
    ALL: 0,
    IN_REVIEW: 0,
    CHANGES_REQUESTED: 0,
    APPROVED: 0,
    DRAFT: 0,
    STALE: 0,
  }
  for (const n of pages) {
    if (!n.currentVersion || !matchesExtra(n, f, byId)) continue
    counts.ALL++
    const s = n.currentVersion.status
    if (s !== 'SUPERSEDED') counts[s]++
    counts.STALE += staleOf(n)
  }
  return counts
}

export function filterPages(
  pages: DocumentNodeDto[],
  f: DocListFilter,
  byId: Map<number, DocumentNodeDto>,
  staleOf: (n: DocumentNodeDto) => number,
) {
  return pages.filter((n) => !!n.currentVersion && matchesTab(n, f.tab, staleOf) && matchesExtra(n, f, byId))
}
