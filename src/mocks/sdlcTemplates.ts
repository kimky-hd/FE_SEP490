import type { GateCriterion } from '@/lib/phaseGates'
import type {
  SdlcTemplateDto,
  TemplatePhase,
  TemplateStatus,
  TemplateTransition,
} from '@/types/project'

const COLOR = {
  gray: '#64748b',   // slate/gray for TODO
  blue: '#2563eb',   // blue for IN_PROGRESS
  violet: '#7c3aed', // violet for IN_PROGRESS (review/testing)
  amber: '#d97706',  // amber for special review/retest
  green: '#059669',  // emerald/green for DONE
}

const st = (
  key: string,
  name: string,
  category: TemplateStatus['category'],
  color: string,
  description: string | null,
  isInitial = false,
): TemplateStatus => ({
  key,
  name,
  category,
  color,
  description,
  isInitial,
})

const tr = (
  from: string,
  to: string,
  allowedRoleCodes: string[],
  commentHint: string | null = null,
): TemplateTransition => ({
  from,
  to,
  allowedRoleCodes,
  requireComment: commentHint !== null,
  commentHint,
  condition: null,
})

const ALL_ROLES = ['PROJECT_MANAGER', 'TECH_LEAD', 'DEVELOPER', 'QA', 'BA']

/** Helper tạo transition tuyến tính liên hoàn giữa các status trong phase */
function linearTransitions(statuses: TemplateStatus[], roles = ALL_ROLES): TemplateTransition[] {
  const transitions: TemplateTransition[] = []
  for (let i = 0; i < statuses.length - 1; i++) {
    transitions.push(tr(statuses[i].key, statuses[i + 1].key, roles))
  }
  if (statuses.length > 2) {
    transitions.push(tr(statuses[statuses.length - 1].key, statuses[statuses.length - 2].key, roles, 'Lý do yêu cầu làm lại'))
  }
  return transitions
}

function makePhase(
  name: string,
  description: string,
  statuses: TemplateStatus[],
  exitCriteria: GateCriterion[] = ['ISSUES_DONE'],
): TemplatePhase {
  return {
    name,
    description,
    statuses,
    transitions: linearTransitions(statuses),
    exitCriteria,
  }
}

export const SDLC_TEMPLATES: SdlcTemplateDto[] = [
  // 1. Agile Scrum
  {
    method: 'SCRUM',
    name: 'Agile Scrum',
    description: 'Sprints cố định 2–4 tuần, quản trị Product Backlog, Sprint Planning, Daily Standup & Retrospective.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Requirement & Analysis',
        'Thu thập, phân tích yêu cầu nghiệp vụ chứng khoán (BRD/URD/SRS) và làm mịn Product Backlog',
        [
          st('scrum_p1_open', 'Open', 'TODO', COLOR.gray, 'Yêu cầu mới ghi nhận từ Product Backlog', true),
          st('scrum_p1_drafting', 'Drafting', 'IN_PROGRESS', COLOR.blue, 'BA đang làm rõ và phân tích đặc tả'),
          st('scrum_p1_approved', 'Approved', 'DONE', COLOR.green, 'Đặc tả đã được duyệt, sẵn sàng cho Sprint'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'UI/UX Design & Architecture',
        'Thiết kế Wireframe, đồng bộ Figma UI và chốt kiến trúc kỹ thuật giao dịch',
        [
          st('scrum_p2_wireframing', 'Wireframing', 'TODO', COLOR.gray, 'Chờ thiết kế wireframe', true),
          st('scrum_p2_designing', 'Designing', 'IN_PROGRESS', COLOR.blue, 'Thiết kế UI/UX trên Figma và kiến trúc'),
          st('scrum_p2_reviewed', 'Reviewed', 'DONE', COLOR.green, 'Thiết kế giao diện và kiến trúc đã được duyệt'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Sprint Execution & Coding',
        'Lập trình tính năng trong Sprint, Code Review và kiểm thử tích hợp SIT',
        [
          st('scrum_p3_todo', 'To Do', 'TODO', COLOR.gray, 'Issue trong Sprint Backlog chờ phân công', true),
          st('scrum_p3_dev', 'Doing', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình tính năng'),
          st('scrum_p3_review', 'Review / QA', 'IN_PROGRESS', COLOR.violet, 'Review mã nguồn và kiểm thử tích hợp SIT'),
          st('scrum_p3_done', 'Done', 'DONE', COLOR.green, 'Đã hoàn thành theo Definition of Done'),
        ],
        ['ISSUES_DONE', 'TESTS_PASSED'],
      ),
      makePhase(
        'UAT & Deployment',
        'Kiểm thử chấp nhận người dùng (UAT), đối chiếu tuân thủ UBCKNN/VSD và triển khai Golive',
        [
          st('scrum_p4_uat_pending', 'UAT Pending', 'TODO', COLOR.gray, 'Chờ nghiệm thu người dùng', true),
          st('scrum_p4_uat_testing', 'UAT Testing', 'IN_PROGRESS', COLOR.violet, 'Người dùng đang nghiệm thu tính năng'),
          st('scrum_p4_deployed', 'Deployed', 'DONE', COLOR.green, 'Đã đóng gói và phát hành thành công'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },

  // 2. Kanban
  {
    method: 'KANBAN',
    name: 'Kanban',
    description: 'Luồng kéo (Pull system) liên tục, giới hạn số công việc đang làm (WIP limits), tối ưu hóa Lead Time & Cycle Time.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Intake & Specification Triage',
        'Tiếp nhận yêu cầu mới, phân tích nhanh đặc tả và chuẩn bị đầu vào',
        [
          st('kb_p1_backlog', 'Backlog', 'TODO', COLOR.gray, 'Yêu cầu trong hàng đợi', true),
          st('kb_p1_triage', 'Spec Triage', 'IN_PROGRESS', COLOR.blue, 'Phân loại và phân tích nhanh'),
          st('kb_p1_ready', 'Ready for Pull', 'DONE', COLOR.green, 'Sẵn sàng kéo vào luồng thực thi'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'Continuous Dev & QA Flow',
        'Luồng thực thi liên tục có kiểm soát WIP từ lập trình sang kiểm thử QA',
        [
          st('kb_p2_selected', 'To Do', 'TODO', COLOR.gray, 'Đã chọn thực hiện', true),
          st('kb_p2_wip', 'Doing', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình (Giới hạn WIP)'),
          st('kb_p2_review', 'Review / QA', 'IN_PROGRESS', COLOR.violet, 'Review chéo và kiểm thử QA'),
          st('kb_p2_merged', 'Done', 'DONE', COLOR.green, 'Mã nguồn đã merge vào nhánh chính'),
        ],
        ['ISSUES_DONE', 'TESTS_PASSED', 'REQ_LINKED_ISSUES'],
      ),
      makePhase(
        'Continuous Delivery & Live',
        'Phát hành liên tục lên môi trường thực tế và giám sát ổn định',
        [
          st('kb_p3_ready', 'Ready to Deploy', 'TODO', COLOR.gray, 'Sẵn sàng triển khai', true),
          st('kb_p3_rolling', 'Rolling Out', 'IN_PROGRESS', COLOR.blue, 'Đang phát hành liên tục'),
          st('kb_p3_live', 'Live & Verified', 'DONE', COLOR.green, 'Đang chạy thực tế ổn định'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },

  // 3. Custom SDLC Template
  {
    method: 'CUSTOM',
    name: 'SDLC tuỳ chỉnh',
    description: 'Tự do thiết kế hoặc chỉnh sửa dựa trên mô hình có sẵn: thêm/xóa giai đoạn, thay đổi thứ tự, tên gọi và điều kiện nghiệm thu.',
    phasesEditable: true,
    phases: [
      makePhase(
        'Requirement & Analysis',
        'Thu thập và phân tích yêu cầu nghiệp vụ & tuân thủ pháp lý',
        [
          st('custom_p1_open', 'Open', 'TODO', COLOR.gray, 'Yêu cầu mới ghi nhận', true),
          st('custom_p1_drafting', 'Drafting', 'IN_PROGRESS', COLOR.blue, 'BA đang soạn đặc tả'),
          st('custom_p1_approved', 'Approved', 'DONE', COLOR.green, 'Đặc tả đã được phê duyệt'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'UI/UX Design & Architecture',
        'Thiết kế wireframe, prototype Figma và kiến trúc bảo mật',
        [
          st('custom_p2_wireframing', 'Wireframing', 'TODO', COLOR.gray, 'Đang phác thảo', true),
          st('custom_p2_designing', 'Designing', 'IN_PROGRESS', COLOR.blue, 'Đang thiết kế UI/UX'),
          st('custom_p2_reviewed', 'Reviewed', 'DONE', COLOR.green, 'Thiết kế đã được duyệt'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Sprint Execution & Coding',
        'Lập trình tính năng theo các sprint và kiểm thử tích hợp',
        [
          st('custom_p3_todo', 'To Do', 'TODO', COLOR.gray, 'Issue mới tạo', true),
          st('custom_p3_dev', 'Doing', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình'),
          st('custom_p3_review', 'Review / QA', 'IN_PROGRESS', COLOR.violet, 'Review và kiểm thử'),
          st('custom_p3_done', 'Done', 'DONE', COLOR.green, 'Đã hoàn thành'),
        ],
        ['ISSUES_DONE', 'TESTS_PASSED'],
      ),
      makePhase(
        'UAT & Deployment',
        'Kiểm thử chấp nhận người dùng và triển khai Golive',
        [
          st('custom_p4_uat_todo', 'UAT Pending', 'TODO', COLOR.gray, 'Chờ kiểm thử UAT', true),
          st('custom_p4_uat', 'UAT Testing', 'IN_PROGRESS', COLOR.violet, 'Người dùng đang nghiệm thu'),
          st('custom_p4_deployed', 'Deployed', 'DONE', COLOR.green, 'Đã triển khai production'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },
]
