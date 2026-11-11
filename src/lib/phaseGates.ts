import { tr } from '@/i18n'

// Điều kiện hoàn thành giai đoạn (Exit Criteria / Gate Rules): mỗi phase chọn các điều kiện phải đạt trước khi
// chuyển sang phase sau. Danh mục cố định; BE chưa có trường này (đề xuất ở doc/Workspace-RBAC-API-Contract.md §9.2).

export type GateCriterion =
  'DOC_APPROVED' | 'REQ_SEGMENTED' | 'REQ_LINKED_ISSUES' | 'ISSUES_DONE' | 'TESTS_PASSED' | 'RTM_ZERO_STALE'

interface GateInfo {
  label: () => string
  short: () => string
  description: () => string
}

export const GATE_CRITERIA: Record<GateCriterion, GateInfo> = {
  DOC_APPROVED: {
    label: () => tr('Tài liệu đặc tả đã được duyệt', 'Spec document approved'),
    short: () => tr('Đặc tả đã duyệt', 'Spec approved'),
    description: () =>
      tr(
        'Dự án có ít nhất 1 tài liệu đặc tả (URD/BRD/SRS) đã được duyệt.',
        'The project has at least one approved spec document (URD/BRD/SRS).',
      ),
  },
  REQ_SEGMENTED: {
    label: () => tr('Đặc tả đã tách thành REQ', 'Spec split into REQs'),
    short: () => tr('Đã tách REQ', 'REQs marked'),
    description: () =>
      tr(
        'Tài liệu đặc tả đã được đánh dấu thành các mục yêu cầu (REQ-01, REQ-02…).',
        'Spec documents are marked up into requirement items (REQ-01, REQ-02…).',
      ),
  },
  REQ_LINKED_ISSUES: {
    label: () => tr('Mọi REQ đã gắn issue', 'Every REQ linked to an issue'),
    short: () => tr('REQ đã gắn issue', 'REQs linked'),
    description: () =>
      tr('Mỗi REQ có ít nhất 1 issue trên Kanban để làm.', 'Each REQ has at least one issue on the board.'),
  },
  ISSUES_DONE: {
    label: () => tr('Issue của giai đoạn đã xong hết', 'All phase issues done'),
    short: () => tr('Issue đã xong', 'Issues done'),
    description: () =>
      tr(
        'Mọi issue thuộc giai đoạn này đang ở trạng thái nhóm Hoàn thành.',
        'Every issue in this phase is in a Done-category status.',
      ),
  },
  TESTS_PASSED: {
    label: () => tr('Testcase đã chạy đạt', 'Test cases passed'),
    short: () => tr('Test đã đạt', 'Tests passed'),
    description: () =>
      tr(
        'Testcase gắn với REQ của dự án có lần chạy gần nhất là Đạt, không còn testcase cần xem lại.',
        'Test cases linked to project REQs passed on their latest run, none left needing review.',
      ),
  },
  RTM_ZERO_STALE: {
    label: () => tr('Không còn REQ lệch phiên bản', 'No stale REQs'),
    short: () => tr('Không REQ lệch', 'No stale REQs'),
    description: () =>
      tr(
        'Không còn REQ đã đổi mà issue / testcase liên quan chưa xác nhận (Stale).',
        'No changed REQ is still waiting for its issues / test cases to confirm (Stale).',
      ),
  },
}

export const GATE_ORDER = Object.keys(GATE_CRITERIA) as GateCriterion[]

export const isGateCriterion = (value: unknown): value is GateCriterion =>
  typeof value === 'string' && value in GATE_CRITERIA

/** Bỏ mã lạ / trùng, giữ đúng thứ tự danh mục. */
export function normalizeGates(values: readonly unknown[] | null | undefined): GateCriterion[] {
  const set = new Set((values ?? []).filter(isGateCriterion))
  return GATE_ORDER.filter((c) => set.has(c))
}

/**
 * Mặc định khi mẫu SDLC chưa khai báo: giai đoạn đầu chốt đặc tả, giai đoạn cuối chốt truy vết, giữa chốt issue.
 * Cùng cách chia với các mẫu SDLC bản đề xuất của BA (deploy fe-sep490-mockup).
 */
export function defaultGates(index: number, total: number): GateCriterion[] {
  if (total > 1 && index === 0) return ['DOC_APPROVED', 'REQ_SEGMENTED']
  if (total > 1 && index === total - 1) return ['ISSUES_DONE', 'RTM_ZERO_STALE']
  if (index === 1) return ['REQ_LINKED_ISSUES', 'ISSUES_DONE']
  return ['ISSUES_DONE']
}
