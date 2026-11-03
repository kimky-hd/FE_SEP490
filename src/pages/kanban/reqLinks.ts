import { documentApi } from '@/api/documentApi'
import { loadProjectPages } from '@/lib/useMyWork'
import { previousApproved } from '@/lib/myWorkRules'
import type { AcceptanceCriterion } from '@/types/document'

// REQ của dự án cho các ô chọn REQ (tạo issue, testcase…) và link "Xem đổi gì" sang trang tài liệu ở chế độ so sánh.

export interface ReqOption {
  documentId: number
  documentCode: string
  documentTitle: string
  reqUid: string
  reqKey: string
  title: string
  anchorId: string
  criteria: AcceptanceCriterion[]
}

/** Mọi REQ (bản hiện tại) của các trang trong dự án; dùng chung cache với "Việc của tôi". */
export async function loadReqOptions(projectId: number): Promise<ReqOption[]> {
  const pages = await loadProjectPages(projectId).catch(() => [])
  return pages
    .flatMap((p) =>
      p.reqs.map((r) => ({
        documentId: p.node.documentId,
        documentCode: p.node.code ?? p.node.title,
        documentTitle: p.node.title,
        reqUid: r.reqUid,
        reqKey: r.reqKey,
        title: r.title,
        anchorId: r.anchorId,
        criteria: r.acceptanceCriteria,
      })),
    )
    .sort(
      (a, b) =>
        a.documentCode.localeCompare(b.documentCode) || a.reqKey.localeCompare(b.reqKey, undefined, { numeric: true }),
    )
}

/**
 * "Xem đổi gì": mở bản baseline của tài liệu, so với bản đã duyệt trước đó, cuộn tới REQ.
 * Trang chưa có hai bản đã duyệt → mở trang (cuộn tới REQ) không so sánh.
 */
export async function reqCompareHref(projectId: number, documentId: number, reqUid: string): Promise<string> {
  const base = `/projects/${projectId}/documents/${documentId}`
  try {
    const detail = await documentApi.get(documentId)
    const baseline = detail.node.baselineVersionId
    if (!baseline) return base
    const reqs = await documentApi.listRequirements(documentId, baseline).catch(() => [])
    const anchor = reqs.find((r) => r.reqUid === reqUid)?.anchorId
    const prev = previousApproved(detail.versions, baseline)
    const viewingBase = detail.node.currentVersion?.versionId === baseline
    const q = [viewingBase ? null : `v=${baseline}`, prev ? `cmp=${prev}` : null].filter(Boolean).join('&')
    return `${base}${q ? `?${q}` : ''}${anchor ? `#${anchor}` : ''}`
  } catch {
    return base
  }
}
