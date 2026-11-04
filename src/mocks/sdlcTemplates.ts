import type {
  PhaseExitCriterionKey,
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
  // Cho phép trả về trạng thái trước đó để làm lại nếu cần
  if (statuses.length > 2) {
    transitions.push(tr(statuses[statuses.length - 1].key, statuses[statuses.length - 2].key, roles, 'Lý do yêu cầu làm lại'))
  }
  return transitions
}

function makePhase(
  name: string,
  description: string,
  statuses: TemplateStatus[],
  exitCriteria: PhaseExitCriterionKey[] = ['ISSUES_DONE'],
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
        'Thu thập, phân tích yêu cầu (SRS) và làm mịn Product Backlog',
        [
          st('scrum_p1_open', 'Open', 'TODO', COLOR.gray, 'Yêu cầu mới ghi nhận từ Product Backlog', true),
          st('scrum_p1_drafting', 'Drafting', 'IN_PROGRESS', COLOR.blue, 'BA đang làm rõ và phân tích đặc tả'),
          st('scrum_p1_approved', 'Approved', 'DONE', COLOR.green, 'Đặc tả đã được duyệt, sẵn sàng cho Sprint'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'UI/UX Design & Architecture',
        'Thiết kế Wireframe, đồng bộ Figma UI và chốt kiến trúc kỹ thuật',
        [
          st('scrum_p2_wireframing', 'Wireframing', 'TODO', COLOR.gray, 'Chờ thiết kế wireframe', true),
          st('scrum_p2_designing', 'Designing', 'IN_PROGRESS', COLOR.blue, 'Thiết kế UI/UX trên Figma và kiến trúc'),
          st('scrum_p2_reviewed', 'Reviewed', 'DONE', COLOR.green, 'Thiết kế giao diện và kiến trúc đã được duyệt'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Sprint Execution & Coding',
        'Lập trình tính năng trong Sprint, Code Review và kiểm thử tích hợp',
        [
          st('scrum_p3_todo', 'Open / To Do', 'TODO', COLOR.gray, 'Issue trong Sprint Backlog chờ phân công', true),
          st('scrum_p3_dev', 'In Development', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình tính năng'),
          st('scrum_p3_review', 'Code Review & QA', 'IN_PROGRESS', COLOR.violet, 'Review mã nguồn và kiểm thử tích hợp'),
          st('scrum_p3_done', 'Completed / Closed', 'DONE', COLOR.green, 'Đã hoàn thành theo Definition of Done'),
        ],
        ['ISSUES_DONE', 'TESTS_APPROVED'],
      ),
      makePhase(
        'UAT & Deployment',
        'Kiểm thử chấp nhận người dùng (UAT), Sprint Review và triển khai',
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
          st('kb_p2_selected', 'Selected', 'TODO', COLOR.gray, 'Đã chọn thực hiện', true),
          st('kb_p2_wip', 'In Progress (WIP)', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình (Giới hạn WIP)'),
          st('kb_p2_review', 'Peer Review & QA', 'IN_PROGRESS', COLOR.violet, 'Review chéo và kiểm thử'),
          st('kb_p2_merged', 'Merged', 'DONE', COLOR.green, 'Mã nguồn đã merge vào nhánh chính'),
        ],
        ['ISSUES_DONE', 'TESTS_APPROVED', 'REQ_LINKED_ISSUES'],
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

  // 3. Waterfall
  {
    method: 'WATERFALL',
    name: 'Waterfall',
    description: 'Tuần tự từng giai đoạn: Khảo sát & Đặc tả, Thiết kế hệ thống, Lập trình, Kiểm thử toàn diện và Bàn giao.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Requirements Analysis',
        'Thu thập, phân tích và nghiệm thu tài liệu đặc tả SRS/URD',
        [
          st('wf_p1_draft', 'Requirements Drafting', 'TODO', COLOR.gray, 'Đang soạn thảo yêu cầu', true),
          st('wf_p1_review', 'Requirements Review', 'IN_PROGRESS', COLOR.blue, 'Đang thẩm định yêu cầu với các bên'),
          st('wf_p1_signed', 'Baseline Signed Off', 'DONE', COLOR.green, 'Đặc tả đã chốt Baseline chính thức'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'System & Architectural Design',
        'Thiết kế kiến trúc hệ thống, cơ sở dữ liệu và giao diện',
        [
          st('wf_p2_hl_design', 'High-Level Design', 'TODO', COLOR.gray, 'Thiết kế mức cao', true),
          st('wf_p2_det_design', 'Detailed Design', 'IN_PROGRESS', COLOR.blue, 'Thiết kế mức chi tiết và dữ liệu'),
          st('wf_p2_approved', 'Design Approved', 'DONE', COLOR.green, 'Thiết kế đã được phê duyệt'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Implementation & Unit Testing',
        'Lập trình tính năng theo tài liệu thiết kế và kiểm thử đơn vị',
        [
          st('wf_p3_todo', 'Coding Backlog', 'TODO', COLOR.gray, 'Chờ lập trình', true),
          st('wf_p3_coding', 'Coding in Progress', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình mã nguồn'),
          st('wf_p3_coded', 'Module Completed', 'DONE', COLOR.green, 'Module hoàn thành và vượt qua Unit Test'),
        ],
        ['ISSUES_DONE'],
      ),
      makePhase(
        'Integration & System Testing',
        'Kiểm thử tích hợp, kiểm thử hệ thống và kiểm thử bảo mật',
        [
          st('wf_p4_test_prep', 'Test Prep', 'TODO', COLOR.gray, 'Chuẩn bị dữ liệu kiểm thử', true),
          st('wf_p4_testing', 'Test Execution', 'IN_PROGRESS', COLOR.violet, 'Đang chạy kịch bản kiểm thử'),
          st('wf_p4_passed', 'Quality Gate Passed', 'DONE', COLOR.green, 'Toàn bộ bài test đạt chuẩn chất lượng'),
        ],
        ['TESTS_APPROVED', 'RTM_ZERO_STALE'],
      ),
      makePhase(
        'Deployment & Maintenance',
        'Bàn giao nghiệm thu cho khách hàng và vận hành bảo trì',
        [
          st('wf_p5_staging', 'Staging Dry-run', 'TODO', COLOR.gray, 'Chạy thử nghiệm trên Staging', true),
          st('wf_p5_prod', 'Deploying to Prod', 'IN_PROGRESS', COLOR.blue, 'Đang phát hành lên Production'),
          st('wf_p5_closed', 'Accepted & Closed', 'DONE', COLOR.green, 'Nghiệm thu bàn giao hoàn tất'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },

  // 4. Iterative & Incremental
  {
    method: 'ITERATIVE',
    name: 'Iterative & Incremental',
    description: 'Phát triển qua các chu kỳ lặp tăng dần từ khung kiến trúc cốt lõi đến khi hoàn thiện toàn bộ sản phẩm.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Inception & Scoping',
        'Xác định phạm vi, mục tiêu kinh doanh và đặc tả sơ bộ',
        [
          st('it_p1_scope', 'Scope Definition', 'TODO', COLOR.gray, 'Đang xác định phạm vi', true),
          st('it_p1_feasibility', 'Feasibility Check', 'IN_PROGRESS', COLOR.blue, 'Đánh giá tính khả thi kỹ thuật'),
          st('it_p1_approved', 'Scope Baselined', 'DONE', COLOR.green, 'Phạm vi vòng lặp đã chốt'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'Architecture Elaboration',
        'Xây dựng khung kiến trúc nền tảng và giải quyết rủi ro cốt lõi',
        [
          st('it_p2_proto', 'Prototyping', 'TODO', COLOR.gray, 'Tạo mẫu kiến trúc thử nghiệm', true),
          st('it_p2_arch', 'Core Architecture', 'IN_PROGRESS', COLOR.blue, 'Lập trình khung kiến trúc'),
          st('it_p2_stable', 'Architecture Proven', 'DONE', COLOR.green, 'Kiến trúc ổn định và được kiểm chứng'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Construction Loops',
        'Các vòng lặp tăng dần bổ sung tính năng theo độ ưu tiên',
        [
          st('it_p3_todo', 'Iteration Backlog', 'TODO', COLOR.gray, 'Danh mục việc vòng lặp', true),
          st('it_p3_dev', 'Iterative Dev', 'IN_PROGRESS', COLOR.blue, 'Đang phát triển phiên bản tăng dần'),
          st('it_p3_done', 'Increment Ready', 'DONE', COLOR.green, 'Bản phát hành tăng dần đạt yêu cầu'),
        ],
        ['ISSUES_DONE', 'TESTS_APPROVED'],
      ),
      makePhase(
        'Transition & Release',
        'Kiểm thử nghiệm thu tổng thể, đóng gói và bàn giao người dùng',
        [
          st('it_p4_beta', 'Beta Testing', 'TODO', COLOR.gray, 'Thử nghiệm người dùng Beta', true),
          st('it_p4_cutover', 'System Cutover', 'IN_PROGRESS', COLOR.blue, 'Chuyển đổi hệ thống chính thức'),
          st('it_p4_live', 'General Availability', 'DONE', COLOR.green, 'Sản phẩm phát hành rộng rãi'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },

  // 5. V-Model
  {
    method: 'V_MODEL',
    name: 'V-Model',
    description: 'Mỗi giai đoạn phát triển đi đôi với giai đoạn kiểm thử tương ứng theo mô hình chữ V chuẩn hoá.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Requirements & Acceptance Test Prep',
        'Phân tích yêu cầu đặc tả gắn liền với lập kế hoạch kiểm thử nghiệm thu UAT',
        [
          st('vm_p1_req', 'Requirement Drafting', 'TODO', COLOR.gray, 'Soạn thảo đặc tả yêu cầu', true),
          st('vm_p1_uat_plan', 'UAT Test Planning', 'IN_PROGRESS', COLOR.blue, 'Thiết kế bộ kịch bản kiểm thử chấp nhận'),
          st('vm_p1_baselined', 'Req & UAT Baselined', 'DONE', COLOR.green, 'Yêu cầu và kế hoạch UAT đã chốt'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'System Design & System Test Design',
        'Thiết kế kiến trúc hệ thống gắn liền với thiết kế kiểm thử hệ thống',
        [
          st('vm_p2_sys_design', 'System Designing', 'TODO', COLOR.gray, 'Thiết kế cấu trúc hệ thống', true),
          st('vm_p2_sys_test', 'System Test Spec', 'IN_PROGRESS', COLOR.blue, 'Soạn bộ kịch bản kiểm thử hệ thống'),
          st('vm_p2_ready', 'System Design Ready', 'DONE', COLOR.green, 'Thiết kế hệ thống và bộ test sẵn sàng'),
        ],
        ['REQ_LINKED_ISSUES', 'TESTS_APPROVED'],
      ),
      makePhase(
        'Coding & Unit Testing',
        'Lập trình mã nguồn chi tiết và kiểm thử đơn vị',
        [
          st('vm_p3_todo', 'Task Open', 'TODO', COLOR.gray, 'Nhiệm vụ lập trình chờ thực hiện', true),
          st('vm_p3_coding', 'Coding & Unit Test', 'IN_PROGRESS', COLOR.blue, 'Lập trình và chạy Unit Test'),
          st('vm_p3_verified', 'Unit Verified', 'DONE', COLOR.green, 'Mã nguồn đã kiểm chứng đơn vị'),
        ],
        ['ISSUES_DONE'],
      ),
      makePhase(
        'Integration, System & Acceptance Test',
        'Thực thi kiểm thử tích hợp, kiểm thử hệ thống và nghiệm thu chấp nhận người dùng',
        [
          st('vm_p4_integ', 'Integration Testing', 'TODO', COLOR.gray, 'Đang chạy kiểm thử tích hợp', true),
          st('vm_p4_uat_run', 'UAT Running', 'IN_PROGRESS', COLOR.violet, 'Người dùng đang chạy nghiệm thu'),
          st('vm_p4_signed', 'V-Gate Verified', 'DONE', COLOR.green, 'Vượt qua mọi tầng kiểm thử đối xứng'),
        ],
        ['TESTS_APPROVED', 'RTM_ZERO_STALE'],
      ),
    ],
  },

  // 6. Spiral Model
  {
    method: 'SPIRAL',
    name: 'Spiral Model',
    description: 'Quy trình lặp tập trung đánh giá và kiểm soát rủi ro ở mỗi vòng xoắn trước khi phát triển.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Objective Determination',
        'Xác định mục tiêu, các phương án thay thế và ràng buộc dự án',
        [
          st('sp_p1_obj', 'Identifying Goals', 'TODO', COLOR.gray, 'Khảo sát mục tiêu', true),
          st('sp_p1_eval', 'Evaluating Options', 'IN_PROGRESS', COLOR.blue, 'Đánh giá các giải pháp công nghệ'),
          st('sp_p1_decided', 'Objective Set', 'DONE', COLOR.green, 'Mục tiêu vòng xoắn đã chốt'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'Risk Analysis & Prototyping',
        'Phân tích rủi ro tiềm ẩn và xây dựng prototype để thẩm định',
        [
          st('sp_p2_risk', 'Risk Assessment', 'TODO', COLOR.gray, 'Đánh giá danh mục rủi ro', true),
          st('sp_p2_proto', 'Prototyping', 'IN_PROGRESS', COLOR.blue, 'Làm mô hình thử nghiệm kiểm chứng rủi ro'),
          st('sp_p2_resolved', 'Risks Mitigated', 'DONE', COLOR.green, 'Rủi ro đã được hóa giải'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Engineering & Development',
        'Triển khai kỹ thuật, lập trình và kiểm thử sản phẩm chu kỳ',
        [
          st('sp_p3_todo', 'Dev Queue', 'TODO', COLOR.gray, 'Hàng đợi phát triển', true),
          st('sp_p3_dev', 'Development', 'IN_PROGRESS', COLOR.blue, 'Đang phát triển theo kiến trúc đã duyệt'),
          st('sp_p3_tested', 'Cycle Tested', 'DONE', COLOR.green, 'Bản thử nghiệm chu kỳ đạt chất lượng'),
        ],
        ['ISSUES_DONE', 'TESTS_APPROVED'],
      ),
      makePhase(
        'Review & Next Phase Planning',
        'Đánh giá kết quả chu kỳ với khách hàng và lập kế hoạch vòng xoắn kế tiếp',
        [
          st('sp_p4_review', 'Customer Review', 'TODO', COLOR.gray, 'Đánh giá phản hồi khách hàng', true),
          st('sp_p4_plan', 'Next Spiral Plan', 'IN_PROGRESS', COLOR.blue, 'Lập kế hoạch vòng xoắn tiếp theo'),
          st('sp_p4_approved', 'Spiral Advanced', 'DONE', COLOR.green, 'Hoàn thành chu kỳ xoắn ốc'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },

  // 7. RAD (Rapid Application Development)
  {
    method: 'RAD',
    name: 'Rapid Application Development',
    description: 'Tập trung tạo mẫu nhanh (Prototyping), phản hồi liên tục từ người dùng và bàn giao tốc độ cao.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Requirements Planning',
        'Lập kế hoạch yêu cầu nhanh gọn cùng các bên liên quan',
        [
          st('rad_p1_meet', 'Scoping Workshop', 'TODO', COLOR.gray, 'Hội thảo xác định nhu cầu', true),
          st('rad_p1_spec', 'Rapid Spec', 'IN_PROGRESS', COLOR.blue, 'Soạn nhanh tài liệu định hướng'),
          st('rad_p1_ok', 'Planning Complete', 'DONE', COLOR.green, 'Kế hoạch phát triển nhanh đã duyệt'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'User Design & Prototyping',
        'Tạo mẫu tương tác liên tục cùng người dùng để xác nhận luồng nghiệp vụ',
        [
          st('rad_p2_wire', 'UI Wireframing', 'TODO', COLOR.gray, 'Phác thảo giao diện', true),
          st('rad_p2_proto', 'Interactive Proto', 'IN_PROGRESS', COLOR.blue, 'Xây dựng bản mẫu thử nghiệm tương tác'),
          st('rad_p2_ok', 'User Approved Proto', 'DONE', COLOR.green, 'Người dùng chốt thiết kế nguyên mẫu'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Rapid Construction',
        'Lập trình tốc độ cao kết hợp cấu phần có sẵn và kiểm thử liên tục',
        [
          st('rad_p3_todo', 'Sprint Build', 'TODO', COLOR.gray, 'Công việc xây dựng', true),
          st('rad_p3_build', 'Rapid Coding', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình và ráp nối module'),
          st('rad_p3_ok', 'Build Verified', 'DONE', COLOR.green, 'Phiên bản xây dựng đã hoàn tất'),
        ],
        ['ISSUES_DONE', 'TESTS_APPROVED'],
      ),
      makePhase(
        'Cutover & Deployment',
        'Chuyển đổi dữ liệu, đào tạo người dùng và phát hành ứng dụng',
        [
          st('rad_p4_train', 'Training & Migration', 'TODO', COLOR.gray, 'Đào tạo người dùng và chuyển đổi dữ liệu', true),
          st('rad_p4_cutover', 'Live Cutover', 'IN_PROGRESS', COLOR.blue, 'Chuyển sang môi trường chạy thật'),
          st('rad_p4_live', 'Live in Production', 'DONE', COLOR.green, 'Hệ thống đã hoạt động chính thức'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },

  // 8. Custom SDLC Template
  {
    method: 'CUSTOM',
    name: 'Custom SDLC Template',
    description: 'Tự do thiết kế hoặc chỉnh sửa dựa trên mô hình có sẵn: thêm/xóa giai đoạn, thay đổi thứ tự, tên gọi và điều kiện nghiệm thu.',
    phasesEditable: true,
    phases: [
      makePhase(
        'Requirement & Analysis',
        'Thu thập và phân tích yêu cầu',
        [
          st('custom_p1_open', 'Open', 'TODO', COLOR.gray, 'Yêu cầu mới ghi nhận', true),
          st('custom_p1_drafting', 'Drafting', 'IN_PROGRESS', COLOR.blue, 'BA đang soạn đặc tả'),
          st('custom_p1_approved', 'Approved', 'DONE', COLOR.green, 'Đặc tả đã được phê duyệt'),
        ],
        ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ),
      makePhase(
        'UI/UX Design & Architecture',
        'Thiết kế wireframe, prototype và kiến trúc',
        [
          st('custom_p2_wireframing', 'Wireframing', 'TODO', COLOR.gray, 'Đang phác thảo', true),
          st('custom_p2_designing', 'Designing', 'IN_PROGRESS', COLOR.blue, 'Đang thiết kế UI/UX'),
          st('custom_p2_reviewed', 'Reviewed', 'DONE', COLOR.green, 'Thiết kế đã được duyệt'),
        ],
        ['REQ_LINKED_ISSUES', 'ISSUES_DONE'],
      ),
      makePhase(
        'Sprint Execution & Coding',
        'Lập trình tính năng theo các sprint',
        [
          st('custom_p3_todo', 'Open / To Do', 'TODO', COLOR.gray, 'Issue mới tạo', true),
          st('custom_p3_dev', 'In Development', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình'),
          st('custom_p3_review', 'Code Review & QA', 'IN_PROGRESS', COLOR.violet, 'Review và kiểm thử'),
          st('custom_p3_done', 'Completed / Closed', 'DONE', COLOR.green, 'Đã hoàn thành'),
        ],
        ['ISSUES_DONE', 'TESTS_APPROVED'],
      ),
      makePhase(
        'UAT & Deployment',
        'Kiểm thử chấp nhận người dùng và triển khai',
        [
          st('custom_p4_uat', 'UAT Testing', 'IN_PROGRESS', COLOR.violet, 'Người dùng đang nghiệm thu', true),
          st('custom_p4_deployed', 'Deployed', 'DONE', COLOR.green, 'Đã triển khai production'),
        ],
        ['ISSUES_DONE', 'RTM_ZERO_STALE'],
      ),
    ],
  },
]
