import { describe, expect, it } from 'vitest'
import type { DocType, DocumentNodeDto, VersionStatus } from '@/types/document'
import { EMPTY_FILTER, filterPages, folderPath, isFiltered, isInFolder, tabCounts } from './docListFilters'

let nextId = 1
function node(p: {
  kind?: 'PAGE' | 'FOLDER'
  title: string
  parentId?: number | null
  status?: VersionStatus
  docType?: DocType | null
  code?: string | null
  id?: number
}): DocumentNodeDto {
  const id = p.id ?? nextId++
  return {
    documentId: id,
    projectId: 1,
    parentId: p.parentId ?? null,
    kind: p.kind ?? 'PAGE',
    title: p.title,
    docType: p.kind === 'FOLDER' ? null : (p.docType ?? 'URD'),
    code: p.code ?? null,
    sortOrder: 0,
    currentVersion: p.kind === 'FOLDER' ? null : { versionId: id * 10, label: '1.0', status: p.status ?? 'DRAFT' },
    isBaselined: false,
    baselineVersionId: null,
    reqCount: 0,
    updatedAt: '2026-11-01T00:00:00Z',
  }
}

const urd = node({ kind: 'FOLDER', title: 'Yêu cầu người dùng', id: 100 })
const pay = node({ kind: 'FOLDER', title: 'Thanh toán', parentId: 100, id: 101 })
const qr = node({ title: 'Thanh toán QR', code: 'URD-014', parentId: 101, status: 'IN_REVIEW' })
const kyc = node({ title: 'Đăng ký KYC', code: 'URD-012', parentId: 100, status: 'APPROVED' })
const recon = node({ title: 'Đối soát giao dịch', code: 'URD-009', parentId: 101, status: 'APPROVED' })
const api = node({ title: 'API cổng thanh toán', code: 'SRS-003', docType: 'SRS', status: 'CHANGES_REQUESTED' })
const refund = node({ title: 'Hoàn tiền', code: 'URD-015', parentId: 101, status: 'DRAFT' })
const pages = [qr, kyc, recon, api, refund]
const byId = new Map([urd, pay, ...pages].map((n) => [n.documentId, n]))
const stale = new Map([[recon.documentId, 2]])
const staleOf = (n: DocumentNodeDto) => stale.get(n.documentId) ?? 0

describe('docListFilters', () => {
  it('đếm theo tab: Tất cả = số trang, REQ cần cập nhật = tổng REQ stale', () => {
    expect(tabCounts(pages, EMPTY_FILTER, byId, staleOf)).toEqual({
      ALL: 5,
      IN_REVIEW: 1,
      CHANGES_REQUESTED: 1,
      APPROVED: 2,
      DRAFT: 1,
      STALE: 2,
    })
  })

  it('tab lọc theo trạng thái; tab STALE lấy trang có REQ stale', () => {
    expect(filterPages(pages, { ...EMPTY_FILTER, tab: 'APPROVED' }, byId, staleOf)).toEqual([kyc, recon])
    expect(filterPages(pages, { ...EMPTY_FILTER, tab: 'STALE' }, byId, staleOf)).toEqual([recon])
    expect(filterPages(pages, EMPTY_FILTER, byId, staleOf)).toHaveLength(5)
  })

  it('thư mục lấy cả cây con; số trên tab theo bộ lọc phụ', () => {
    const f = { ...EMPTY_FILTER, folderId: pay.documentId }
    expect(filterPages(pages, f, byId, staleOf)).toEqual([qr, recon, refund])
    expect(filterPages(pages, { ...EMPTY_FILTER, folderId: urd.documentId }, byId, staleOf)).toHaveLength(4)
    expect(tabCounts(pages, f, byId, staleOf)).toMatchObject({ ALL: 3, APPROVED: 1, STALE: 2, CHANGES_REQUESTED: 0 })
  })

  it('lọc loại và tìm theo mã / tên không dấu', () => {
    expect(filterPages(pages, { ...EMPTY_FILTER, docType: 'SRS' }, byId, staleOf)).toEqual([api])
    expect(filterPages(pages, { ...EMPTY_FILTER, search: 'urd-01' }, byId, staleOf)).toEqual([qr, kyc, refund])
    expect(filterPages(pages, { ...EMPTY_FILTER, search: 'doi soat' }, byId, staleOf)).toEqual([recon])
    expect(filterPages(pages, { ...EMPTY_FILTER, search: 'dang ky', tab: 'DRAFT' }, byId, staleOf)).toEqual([])
  })

  it('đường dẫn thư mục, isInFolder chặn vòng lặp, isFiltered', () => {
    expect(folderPath(qr, byId)).toBe('Yêu cầu người dùng / Thanh toán')
    expect(folderPath(api, byId)).toBe('')
    const a = node({ kind: 'FOLDER', title: 'A', id: 200, parentId: 201 })
    const b = node({ kind: 'FOLDER', title: 'B', id: 201, parentId: 200 })
    const loop = new Map([a, b].map((n) => [n.documentId, n]))
    expect(isInFolder(a, 999, loop)).toBe(false)
    expect(isFiltered(EMPTY_FILTER)).toBe(false)
    expect(isFiltered({ ...EMPTY_FILTER, search: '  ' })).toBe(false)
    expect(isFiltered({ ...EMPTY_FILTER, tab: 'DRAFT' })).toBe(true)
  })
})
