import type { DocumentCommentDto } from '@/types/document'

// Tổng hợp góp ý của một phiên bản: "N đã xử lý · M còn mở" (mockup màn 4) và chặn "Phê duyệt" khi còn góp ý mở.
// Chỉ đếm bình luận gốc (parentId = null); trả lời không tính là một góp ý riêng.

export interface CommentSummary {
  resolved: number
  open: number
}

/** `comments` lấy với includeResolved=true (§7.3); `versionId` lọc thêm cho chắc khi danh sách lẫn nhiều bản. */
export function summarizeComments(comments: DocumentCommentDto[], versionId?: number): CommentSummary {
  let resolved = 0
  let open = 0
  for (const c of comments) {
    if (c.parentId !== null || (versionId !== undefined && c.versionId !== versionId)) continue
    if (c.resolvedAt) resolved++
    else open++
  }
  return { resolved, open }
}

/**
 * Chặn phê duyệt phía FE khi bản đang duyệt còn góp ý mở. `null` = chưa biết (đang tải / không có quyền xem bình
 * luận) → không chặn, để BE quyết (đề xuất `409 OPEN_COMMENTS`, doc/Documents-API-Contract.md §7.2).
 */
export function approveBlockedBy(summary: CommentSummary | null): number {
  return summary?.open ?? 0
}
