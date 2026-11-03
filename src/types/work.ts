import type { UserRef } from './document'
import type { RoleKind } from './rbac'

// "Việc của tôi" — GET /me/work-items (doc/BE-Changes-2026-10-28_30-API.md §B.2, #24). DTO không chứa câu chữ hiển thị:
// FE tự dựng tiêu đề phụ / nhãn / nút theo `kind` (src/lib/myWorkRules.ts → toWorkItem).

export const WORK_KINDS = [
  'CHANGES_REQUESTED',
  'REVIEW',
  'TEST_FAILED_MINE',
  'ISSUE_REQ_CHANGED',
  'COMMENT_REPLY',
  'MENTION',
  'TEST_RERUN',
  'STALE_REQ',
  'ISSUE_READY_TO_CLOSE',
  'TEST_NOT_RUN',
  'REQ_WITHOUT_TEST',
  'ISSUE_ASSIGNED',
  'REQ_CHANGING',
  'DRAFT',
  'RECENT_ACTIVITY',
] as const

export type WorkKind = (typeof WORK_KINDS)[number]

/** Loại việc của module Tài liệu (để tô chấm menu Tài liệu). */
export const DOCUMENT_WORK_KINDS: readonly WorkKind[] = [
  'CHANGES_REQUESTED',
  'REVIEW',
  'COMMENT_REPLY',
  'MENTION',
  'STALE_REQ',
  'REQ_CHANGING',
  'DRAFT',
  'RECENT_ACTIVITY',
]

export interface WorkRequirementRef {
  /** null khi BE / mock không có id dòng RTM (vd REQ_WITHOUT_TEST dựng từ cây testcase). */
  requirementId: number | null
  reqUid: string
  reqKey: string
  title: string
  anchorId: string | null
}

export interface WorkIssueRef {
  issueId: number
  key: string
  title: string
  statusName: string
  points: number | null
  reqChanged: boolean
  /** Số testcase liên kết (ISSUE_READY_TO_CLOSE: tất cả đều PASS). */
  testTotal: number
}

export interface WorkTestRunRef {
  runId: number
  cycleId: number
  cycleName: string
  testCaseKey: string
  title: string
}

export interface WorkItemDto {
  /** Khoá ổn định trong một dự án, vd `review-12`, `issue-104`, `run-todo-5`. */
  id: string
  kind: WorkKind
  urgency: number
  projectId: number
  projectName: string
  projectKey: string
  roleKind: RoleKind
  /** Trang tài liệu liên quan (REQ_WITHOUT_TEST: tài liệu chứa REQ); null với việc issue / lượt chạy. */
  documentId: number | null
  /** Mã đối tượng chính của dòng: mã tài liệu (SRS-02), key issue (CORE-104), key testcase (TC-5). */
  code: string | null
  /** Tên đối tượng chính: tiêu đề trang / issue / testcase. */
  title: string
  /** Bản cần mở nếu khác bản hiện tại của trang (`?v=`); null = mở bản hiện tại. */
  versionId: number | null
  /** Nhãn bản liên quan: bản hiện tại (DRAFT, REVIEW, CHANGES_REQUESTED, REQ_CHANGING) hoặc bản gốc (STALE_REQ). */
  versionLabel: string | null
  /** Bản để so sánh (`?cmp=`), null = không so sánh. */
  compareToVersionId: number | null
  requirement: WorkRequirementRef | null
  comment: { commentId: number; body: string; author: UserRef } | null
  /** Người gây ra việc: người yêu cầu sửa / gửi duyệt / duyệt. */
  actor: UserRef | null
  /** Ghi chú máy chủ soạn sẵn: lý do yêu cầu sửa, tóm tắt REQ đổi, danh sách REQ-xx của dòng gộp, `changedNote`… */
  note: string | null
  /** Thời điểm sự kiện (ISO-8601 UTC); dùng để sắp sau `urgency`. */
  at: string
  /** Số mục gộp trong dòng (STALE_REQ của PM, REQ_CHANGING, TEST_NOT_RUN, REQ_WITHOUT_TEST); null = 1. */
  count: number | null
  issue: WorkIssueRef | null
  testRun: WorkTestRunRef | null
  /** Chỉ RECENT_ACTIVITY: hoạt động gì. */
  activity: 'APPROVED' | 'SUBMITTED' | null
}

export interface WorkItemsQuery {
  companyId?: number | null
  projectId?: number
}

/** Sắp như BE (§B.2): `urgency` giảm dần, rồi `at` mới nhất, rồi `id`. */
export function sortWorkItems<T extends { urgency: number; at: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.urgency - a.urgency || b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
}
