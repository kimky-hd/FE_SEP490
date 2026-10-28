import type { SdlcTemplateDto, TemplatePhase, TemplateStatus, TemplateTransition } from '@/types/project'

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

function makePhase(name: string, description: string, statuses: TemplateStatus[]): TemplatePhase {
  return {
    name,
    description,
    statuses,
    transitions: linearTransitions(statuses),
  }
}

export const SDLC_TEMPLATES: SdlcTemplateDto[] = [
  // 1. Agile Scrum
  {
    method: 'SCRUM',
    name: 'Agile Scrum',
    tag: 'Iterative',
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
      ),
      makePhase(
        'UI/UX Design & Architecture',
        'Thiết kế Wireframe, đồng bộ Figma UI và chốt kiến trúc kỹ thuật',
        [
          st('scrum_p2_wireframing', 'Wireframing', 'TODO', COLOR.gray, 'Chờ thiết kế wireframe', true),
          st('scrum_p2_designing', 'Designing', 'IN_PROGRESS', COLOR.blue, 'Thiết kế UI/UX trên Figma và kiến trúc'),
          st('scrum_p2_reviewed', 'Reviewed', 'DONE', COLOR.green, 'Thiết kế giao diện và kiến trúc đã được duyệt'),
        ],
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
      ),
      makePhase(
        'UAT & Deployment',
        'Kiểm thử chấp nhận người dùng (UAT), Sprint Review và triển khai',
        [
          st('scrum_p4_uat_pending', 'UAT Pending', 'TODO', COLOR.gray, 'Chờ nghiệm thu người dùng', true),
          st('scrum_p4_uat_testing', 'UAT Testing', 'IN_PROGRESS', COLOR.violet, 'Người dùng đang nghiệm thu tính năng'),
          st('scrum_p4_deployed', 'Deployed', 'DONE', COLOR.green, 'Đã đóng gói và phát hành thành công'),
        ],
      ),
    ],
  },

  // 2. Waterfall
  {
    method: 'WATERFALL',
    name: 'Waterfall',
    tag: 'Sequential',
    description: 'Quy trình tuyến tính chặt chẽ qua 6 cổng giai đoạn; mỗi giai đoạn phải được phê duyệt đóng băng (Sign-off) trước khi chuyển tiếp.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Business & System Requirements',
        'Khảo sát, biên soạn và phê duyệt đóng băng tài liệu BRD / URD / SRS',
        [
          st('wf_p1_open', 'Open', 'TODO', COLOR.gray, 'Tiếp nhận yêu cầu ban đầu', true),
          st('wf_p1_authoring', 'Authoring', 'IN_PROGRESS', COLOR.blue, 'Soạn thảo tài liệu đặc tả nghiệp vụ'),
          st('wf_p1_review', 'In Review', 'IN_PROGRESS', COLOR.violet, 'Hội đồng rà soát tài liệu'),
          st('wf_p1_signed_off', 'Baseline Signed-off', 'DONE', COLOR.green, 'Đóng băng đặc tả yêu cầu cơ sở'),
        ],
      ),
      makePhase(
        'System & Software Design',
        'Thiết kế kiến trúc tổng thể (HLD), chi tiết CSDL (LLD) và giao diện Figma',
        [
          st('wf_p2_pending', 'Pending Design', 'TODO', COLOR.gray, 'Chờ thiết kế kiến trúc', true),
          st('wf_p2_arch', 'Architecture & UI', 'IN_PROGRESS', COLOR.blue, 'Thiết kế tổng thể, CSDL và Figma'),
          st('wf_p2_review', 'Design Review', 'IN_PROGRESS', COLOR.violet, 'Rà soát thiết kế kỹ thuật'),
          st('wf_p2_approved', 'Design Approved', 'DONE', COLOR.green, 'Thiết kế đã được phê duyệt'),
        ],
      ),
      makePhase(
        'Implementation & Unit Coding',
        'Lập trình các phân hệ phần mềm và kiểm thử đơn vị theo thiết kế đã khóa',
        [
          st('wf_p3_todo', 'To Do', 'TODO', COLOR.gray, 'Đầu việc lập trình chờ thực hiện', true),
          st('wf_p3_coding', 'Coding', 'IN_PROGRESS', COLOR.blue, 'Đang lập trình tính năng'),
          st('wf_p3_unit_test', 'Unit Testing', 'IN_PROGRESS', COLOR.violet, 'Thực thi kiểm thử đơn vị'),
          st('wf_p3_freeze', 'Code Freeze', 'DONE', COLOR.green, 'Đóng băng mã nguồn phân hệ'),
        ],
      ),
      makePhase(
        'System & Integration Testing (SIT)',
        'Thực thi toàn bộ kịch bản kiểm thử hệ thống, đối chiếu RTM và xử lý Bug',
        [
          st('wf_p4_queued', 'Test Queued', 'TODO', COLOR.gray, 'Kịch bản kiểm thử chờ chạy', true),
          st('wf_p4_sit', 'SIT Execution', 'IN_PROGRESS', COLOR.blue, 'Thực thi kịch bản kiểm thử hệ thống'),
          st('wf_p4_fixing', 'Bug Fixing & Retest', 'IN_PROGRESS', COLOR.amber, 'Khắc phục lỗi và kiểm thử lại'),
          st('wf_p4_passed', 'SIT Passed', 'DONE', COLOR.green, 'Toàn bộ kịch bản SIT đạt chuẩn RTM'),
        ],
      ),
      makePhase(
        'User Acceptance Testing (UAT)',
        'Nghiệp vụ và khách hàng kiểm thử nghiệm thu trên môi trường UAT',
        [
          st('wf_p5_ready', 'UAT Ready', 'TODO', COLOR.gray, 'Sẵn sàng kiểm thử nghiệm thu', true),
          st('wf_p5_running', 'UAT In Progress', 'IN_PROGRESS', COLOR.violet, 'Khách hàng đang kiểm thử UAT'),
          st('wf_p5_signed_off', 'UAT Signed-off', 'DONE', COLOR.green, 'Biên bản nghiệm thu UAT đã ký'),
        ],
      ),
      makePhase(
        'Deployment & Maintenance',
        'Triển khai Go-Live lên môi trường Production và bàn giao vận hành',
        [
          st('wf_p6_pending', 'Release Pending', 'TODO', COLOR.gray, 'Chờ phát hành lên môi trường thật', true),
          st('wf_p6_deploying', 'Deploying', 'IN_PROGRESS', COLOR.blue, 'Đang triển khai Go-Live'),
          st('wf_p6_completed', 'Go-Live Completed', 'DONE', COLOR.green, 'Phần mềm chính thức vận hành'),
        ],
      ),
    ],
  },

  // 3. Iterative & Incremental
  {
    method: 'ITERATIVE',
    name: 'Iterative & Incremental',
    tag: 'Incremental',
    description: 'Xây dựng phần lõi (Core) trước, sau đó phát triển mở rộng dần theo từng vòng lặp tăng trưởng (Increments) và kiểm thử hồi quy.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Inception & Core Scope',
        'Xác định phạm vi tổng thể, kiến trúc nền tảng và lộ trình các bản tăng trưởng',
        [
          st('iter_p1_open', 'Open', 'TODO', COLOR.gray, 'Yêu cầu khởi tạo', true),
          st('iter_p1_scoping', 'Scoping', 'IN_PROGRESS', COLOR.blue, 'Định hình phạm vi và lộ trình lặp'),
          st('iter_p1_approved', 'Scope Approved', 'DONE', COLOR.green, 'Phạm vi bản tăng trưởng đã được duyệt'),
        ],
      ),
      makePhase(
        'Iteration Analysis & Spec',
        'Phân tích chi tiết yêu cầu (SRS) và Figma UI cho vòng lặp hiện tại',
        [
          st('iter_p2_queued', 'Queued', 'TODO', COLOR.gray, 'Chờ phân tích vòng lặp', true),
          st('iter_p2_drafting', 'Spec Drafting', 'IN_PROGRESS', COLOR.blue, 'Soạn thảo đặc tả vòng lặp'),
          st('iter_p2_review', 'Spec Review', 'IN_PROGRESS', COLOR.violet, 'Rà soát đặc tả và UI Figma'),
          st('iter_p2_baseline', 'Iteration Baseline', 'DONE', COLOR.green, 'Chốt cơ sở vòng lặp'),
        ],
      ),
      makePhase(
        'Incremental Design & Build',
        'Thiết kế chi tiết, lập trình và tích hợp mô-đun mới vào hệ thống lõi',
        [
          st('iter_p3_todo', 'To Do', 'TODO', COLOR.gray, 'Chờ lập trình', true),
          st('iter_p3_dev', 'In Development', 'IN_PROGRESS', COLOR.blue, 'Lập trình mô-đun tăng trưởng'),
          st('iter_p3_review', 'Integration Review', 'IN_PROGRESS', COLOR.violet, 'Tích hợp vào hệ thống lõi'),
          st('iter_p3_done', 'Build Integrated', 'DONE', COLOR.green, 'Tích hợp thành công'),
        ],
      ),
      makePhase(
        'Verification & Regression QA',
        'Kiểm thử tính năng mới và kiểm thử hồi quy (Regression) trên ma trận RTM',
        [
          st('iter_p4_ready', 'Ready for QA', 'TODO', COLOR.gray, 'Chờ kiểm thử QA', true),
          st('iter_p4_testing', 'Testing & Regression', 'IN_PROGRESS', COLOR.blue, 'Kiểm thử tính năng và hồi quy'),
          st('iter_p4_fixing', 'Fixing Defects', 'IN_PROGRESS', COLOR.amber, 'Xử lý lỗi phát sinh'),
          st('iter_p4_verified', 'Verified', 'DONE', COLOR.green, 'Kiểm thử đạt chuẩn'),
        ],
      ),
      makePhase(
        'Increment Release & Review',
        'Phát hành bản tăng trưởng và đánh giá phản hồi cho vòng lặp tiếp theo',
        [
          st('iter_p5_staging', 'Staging', 'TODO', COLOR.gray, 'Chuẩn bị phát hành', true),
          st('iter_p5_evaluating', 'Evaluating', 'IN_PROGRESS', COLOR.violet, 'Đánh giá phản hồi người dùng'),
          st('iter_p5_released', 'Increment Released', 'DONE', COLOR.green, 'Bản tăng trưởng đã phát hành'),
        ],
      ),
    ],
  },

  // 4. V-Model
  {
    method: 'V_MODEL',
    name: 'V-Model',
    tag: 'QA-Driven',
    description: 'Mỗi giai đoạn đặc tả và thiết kế đều đối xứng trực tiếp với một giai đoạn thiết kế kịch bản kiểm thử và truy xuất RTM nghiêm ngặt.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Requirement Spec & UAT Plan',
        'Đặc tả yêu cầu nghiệp vụ (BRD/SRS) đồng thời thiết kế khung kịch bản UAT',
        [
          st('vm_p1_open', 'Open', 'TODO', COLOR.gray, 'Tiếp nhận yêu cầu', true),
          st('vm_p1_drafting', 'Spec & Test Drafting', 'IN_PROGRESS', COLOR.blue, 'Soạn đặc tả & thiết kế kịch bản UAT'),
          st('vm_p1_review', 'Verification Review', 'IN_PROGRESS', COLOR.violet, 'Rà soát đối chứng yêu cầu'),
          st('vm_p1_locked', 'Baseline Locked', 'DONE', COLOR.green, 'Khóa cơ sở đặc tả và kế hoạch UAT'),
        ],
      ),
      makePhase(
        'Architecture & SIT Design',
        'Thiết kế kiến trúc hệ thống, đồng bộ Figma UI và thiết kế Test Case tích hợp',
        [
          st('vm_p2_todo', 'To Do', 'TODO', COLOR.gray, 'Chờ thiết kế hệ thống', true),
          st('vm_p2_design', 'Designing & Mapping', 'IN_PROGRESS', COLOR.blue, 'Thiết kế kiến trúc và gắn Test Case'),
          st('vm_p2_review', 'Reviewed', 'IN_PROGRESS', COLOR.violet, 'Rà soát thiết kế và kịch bản SIT'),
          st('vm_p2_approved', 'Approved', 'DONE', COLOR.green, 'Thiết kế và bộ SIT đã duyệt'),
        ],
      ),
      makePhase(
        'Module Coding & Unit Test',
        'Lập trình chi tiết từng phân hệ (Component) và thực thi Unit Test',
        [
          st('vm_p3_queued', 'Queued', 'TODO', COLOR.gray, 'Chờ lập trình', true),
          st('vm_p3_coding', 'Coding', 'IN_PROGRESS', COLOR.blue, 'Lập trình phân hệ'),
          st('vm_p3_unit_test', 'Unit Test & Review', 'IN_PROGRESS', COLOR.violet, 'Kiểm thử đơn vị và rà soát'),
          st('vm_p3_verified', 'Module Verified', 'DONE', COLOR.green, 'Phân hệ đạt chuẩn nghiệm thu kỹ thuật'),
        ],
      ),
      makePhase(
        'Integration & System Test (SIT)',
        'Thực thi bộ Test Case SIT, kiểm tra độ bao phủ trên RTM và xử lý lỗi',
        [
          st('vm_p4_ready', 'SIT Ready', 'TODO', COLOR.gray, 'Sẵn sàng kiểm thử SIT', true),
          st('vm_p4_running', 'SIT Running', 'IN_PROGRESS', COLOR.blue, 'Thực thi bộ SIT kiểm tra RTM'),
          st('vm_p4_resolving', 'Defect Resolution', 'IN_PROGRESS', COLOR.amber, 'Xử lý lỗi hệ thống'),
          st('vm_p4_certified', 'SIT Certified', 'DONE', COLOR.green, 'Chứng nhận SIT đạt chuẩn'),
        ],
      ),
      makePhase(
        'UAT Validation & Sign-off',
        'Kiểm thử xác nhận người dùng đối chiếu trực tiếp với các mục REQ gốc',
        [
          st('vm_p5_pending', 'UAT Pending', 'TODO', COLOR.gray, 'Chờ kiểm thử xác nhận', true),
          st('vm_p5_validation', 'UAT Validation', 'IN_PROGRESS', COLOR.violet, 'Người dùng kiểm thử xác nhận REQ'),
          st('vm_p5_released', 'Validated & Released', 'DONE', COLOR.green, 'Nghiệm thu toàn diện và phát hành'),
        ],
      ),
    ],
  },

  // 5. Kanban
  {
    method: 'KANBAN',
    name: 'Kanban',
    tag: 'Continuous Flow',
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
      ),
      makePhase(
        'Continuous Delivery & Live',
        'Phát hành liên tục lên môi trường thực tế và giám sát ổn định',
        [
          st('kb_p3_ready', 'Ready to Deploy', 'TODO', COLOR.gray, 'Sẵn sàng triển khai', true),
          st('kb_p3_rolling', 'Rolling Out', 'IN_PROGRESS', COLOR.blue, 'Đang phát hành liên tục'),
          st('kb_p3_live', 'Live & Verified', 'DONE', COLOR.green, 'Đang chạy thực tế ổn định'),
        ],
      ),
    ],
  },

  // 6. Spiral Model
  {
    method: 'SPIRAL',
    name: 'Spiral Model',
    tag: 'Risk-Driven',
    description: 'Phát triển theo chu kỳ xoắn ốc kết hợp phân tích rủi ro kỹ thuật/bảo mật và dựng Prototype kiểm chứng trước khi xây dựng.',
    phasesEditable: false,
    phases: [
      makePhase(
        'Objectives & Requirements',
        'Xác định mục tiêu chu kỳ xoắn ốc, các ràng buộc và đặc tả yêu cầu',
        [
          st('sp_p1_open', 'Open', 'TODO', COLOR.gray, 'Khởi tạo mục tiêu chu kỳ', true),
          st('sp_p1_defining', 'Defining', 'IN_PROGRESS', COLOR.blue, 'Đặc tả yêu cầu và ràng buộc'),
          st('sp_p1_locked', 'Objectives Locked', 'DONE', COLOR.green, 'Mục tiêu chu kỳ đã khóa'),
        ],
      ),
      makePhase(
        'Risk Analysis & Prototyping',
        'Phân tích rủi ro kỹ thuật/bảo mật, dựng Prototype Figma & PoC kiểm chứng',
        [
          st('sp_p2_identified', 'Risk Identified', 'TODO', COLOR.gray, 'Nhận diện rủi ro kỹ thuật', true),
          st('sp_p2_prototyping', 'Prototyping & PoC', 'IN_PROGRESS', COLOR.blue, 'Dựng Prototype Figma và PoC'),
          st('sp_p2_review', 'Risk Review', 'IN_PROGRESS', COLOR.violet, 'Rà soát đánh giá rủi ro'),
          st('sp_p2_mitigated', 'Risk Mitigated', 'DONE', COLOR.green, 'Rủi ro đã được hóa giải'),
        ],
      ),
      makePhase(
        'Engineering & RTM Testing',
        'Lập trình hoàn thiện tính năng và kiểm thử truy xuất toàn diện',
        [
          st('sp_p3_todo', 'To Do', 'TODO', COLOR.gray, 'Chờ phát triển', true),
          st('sp_p3_eng', 'Engineering', 'IN_PROGRESS', COLOR.blue, 'Lập trình hoàn thiện phân hệ'),
          st('sp_p3_qa_sec', 'QA & Security Test', 'IN_PROGRESS', COLOR.violet, 'Kiểm thử chất lượng và bảo mật'),
          st('sp_p3_built', 'Cycle Built', 'DONE', COLOR.green, 'Chu kỳ kỹ thuật hoàn thành'),
        ],
      ),
      makePhase(
        'Evaluation & Next Cycle Plan',
        'Đánh giá kết quả chu kỳ cùng khách hàng và lập kế hoạch vòng tiếp theo',
        [
          st('sp_p4_pending', 'Pending Evaluation', 'TODO', COLOR.gray, 'Chờ đánh giá chu kỳ', true),
          st('sp_p4_review', 'Stakeholder Review', 'IN_PROGRESS', COLOR.violet, 'Các bên liên quan rà soát kết quả'),
          st('sp_p4_approved', 'Cycle Approved', 'DONE', COLOR.green, 'Chu kỳ được nghiệm thu, sang vòng tiếp'),
        ],
      ),
    ],
  },

  // 7. RAD / Rapid Prototyping
  {
    method: 'RAD',
    name: 'RAD / Rapid Prototyping',
    tag: 'Rapid Prototype',
    description: 'Tăng tốc ra mắt sản phẩm bằng Workshop JAD, tạo mẫu nhanh trên Figma và dùng AI sinh đặc tả + kịch bản kiểm thử.',
    phasesEditable: false,
    phases: [
      makePhase(
        'JAD Requirement Workshop',
        'Thu thập nhanh ghi chú (Raw Notes) và dùng AI chuẩn hóa thành đặc tả',
        [
          st('rad_p1_notes', 'Raw Notes', 'TODO', COLOR.gray, 'Ghi chú cuộc họp JAD', true),
          st('rad_p1_ai', 'AI Structuring', 'IN_PROGRESS', COLOR.blue, 'AI bóc tách cấu trúc đặc tả'),
          st('rad_p1_approved', 'Workshop Approved', 'DONE', COLOR.green, 'Kết quả Workshop được chốt'),
        ],
      ),
      makePhase(
        'Rapid UI/UX Prototyping',
        'Thiết kế nhanh màn hình trên Figma và gắn trực tiếp vào mục yêu cầu REQ',
        [
          st('rad_p2_wireframing', 'Wireframing', 'TODO', COLOR.gray, 'Chờ phác thảo màn hình', true),
          st('rad_p2_proto', 'Figma Prototyping', 'IN_PROGRESS', COLOR.blue, 'Thiết kế tương tác Figma nhanh'),
          st('rad_p2_signed', 'Prototype Signed-off', 'DONE', COLOR.green, 'Prototype được người dùng ký duyệt'),
        ],
      ),
      makePhase(
        'Rapid Build & AI Testing',
        'Lập trình nhanh kết hợp sinh tự động Test Case từ SRS & Figma UI',
        [
          st('rad_p3_todo', 'To Do', 'TODO', COLOR.gray, 'Chờ lập trình nhanh', true),
          st('rad_p3_build', 'Rapid Build', 'IN_PROGRESS', COLOR.blue, 'Lập trình phân hệ tính năng'),
          st('rad_p3_ai_test', 'AI Test Verification', 'IN_PROGRESS', COLOR.violet, 'Kiểm thử tự động sinh từ AI'),
          st('rad_p3_cutover', 'Ready for Cutover', 'DONE', COLOR.green, 'Sẵn sàng chuyển đổi vận hành'),
        ],
      ),
      makePhase(
        'Cutover & Final Launch',
        'Nghiệm thu nhanh, chuyển đổi dữ liệu và đưa sản phẩm vào vận hành',
        [
          st('rad_p4_pre', 'Pre-launch', 'TODO', COLOR.gray, 'Chuẩn bị chuyển đổi dữ liệu', true),
          st('rad_p4_cutover', 'Cutover', 'IN_PROGRESS', COLOR.blue, 'Chuyển giao và triển khai thần tốc'),
          st('rad_p4_launched', 'Launched', 'DONE', COLOR.green, 'Chính thức ra mắt thị trường'),
        ],
      ),
    ],
  },

  // 8. Custom SDLC Template
  {
    method: 'CUSTOM',
    name: 'Custom SDLC Template',
    tag: 'Flexible',
    description: 'Tự do thiết kế hoặc chỉnh sửa dựa trên mô hình có sẵn: thêm/xóa giai đoạn, thay đổi thứ tự, tên gọi và trạng thái quy trình.',
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
      ),
      makePhase(
        'UI/UX Design & Architecture',
        'Thiết kế wireframe, prototype và kiến trúc',
        [
          st('custom_p2_wireframing', 'Wireframing', 'TODO', COLOR.gray, 'Đang phác thảo', true),
          st('custom_p2_designing', 'Designing', 'IN_PROGRESS', COLOR.blue, 'Đang thiết kế UI/UX'),
          st('custom_p2_reviewed', 'Reviewed', 'DONE', COLOR.green, 'Thiết kế đã được duyệt'),
        ],
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
      ),
      makePhase(
        'UAT & Deployment',
        'Kiểm thử chấp nhận người dùng và triển khai',
        [
          st('custom_p4_uat', 'UAT Testing', 'IN_PROGRESS', COLOR.violet, 'Người dùng đang nghiệm thu', true),
          st('custom_p4_deployed', 'Deployed', 'DONE', COLOR.green, 'Đã triển khai production'),
        ],
      ),
    ],
  },
]
