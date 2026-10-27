// 3 mẫu SDLC — doc/Workspace-RBAC-API-Contract.md §9.1. BE copy y nguyên vào `SdlcTemplateCatalog`.
// Nguồn: Figma hàng 2 frame 02 (Agile Scrum / Kanban / Custom SDLC Template + 4 phase mẫu) và frame 03
// (Standard Kanban Workflow + bảng 4 transition rule có role & bắt buộc comment).

import type { SdlcTemplateDto, TemplatePhase, TemplateStatus, TemplateTransition } from '@/types/project'

const COLOR = { gray: '#78716c', blue: '#2563eb', violet: '#7c3aed', green: '#079455', amber: '#d97706' }

const st = (key: string, name: string, category: TemplateStatus['category'], color: string, description: string | null, isInitial = false): TemplateStatus => ({
  key,
  name,
  category,
  color,
  description,
  isInitial,
})

const tr = (from: string, to: string, allowedRoleCodes: string[], commentHint: string | null = null): TemplateTransition => ({
  from,
  to,
  allowedRoleCodes,
  requireComment: commentHint !== null,
  commentHint,
  condition: null,
})

// Bảng trạng thái + luật của Figma frame 03 ("Custom Status Board & Transition Matrix").
function codingPhase(name: string, description: string): TemplatePhase {
  return {
    name,
    description,
    statuses: [
      st('todo', 'Open / To Do', 'TODO', COLOR.gray, 'Issue mới tạo, đang xếp hàng chờ phân công', true),
      st('dev', 'In Development', 'IN_PROGRESS', COLOR.blue, 'Lập trình viên đang xử lý code, commit lên feature branch'),
      st('review', 'Code Review & QA', 'IN_PROGRESS', COLOR.violet, 'Kiểm thử chức năng QA, test tự động CI và review code'),
      st('done', 'Completed / Closed', 'DONE', COLOR.green, 'Tính năng đã hoàn thành, build merge lên main'),
    ],
    transitions: [
      tr('todo', 'dev', ['DEVELOPER', 'TECH_LEAD', 'PROJECT_MANAGER']),
      tr('dev', 'review', ['DEVELOPER'], 'Link PR / Git commit'),
      tr('review', 'done', ['QA', 'TECH_LEAD']),
      tr('review', 'dev', ['QA', 'TECH_LEAD'], 'Bug details & logs'),
    ],
  }
}

export const SDLC_TEMPLATES: SdlcTemplateDto[] = [
  {
    method: 'SCRUM',
    name: 'Agile Scrum',
    description: 'Sprints cố định 2 tuần, quản trị Product Backlog, Sprint Planning, Daily Standup & Retrospective.',
    phasesEditable: false,
    phases: [
      {
        name: 'Product Backlog',
        description: 'Thu thập, làm rõ và ưu tiên user story',
        statuses: [
          st('backlog', 'Backlog', 'TODO', COLOR.gray, 'User story mới, chưa làm rõ', true),
          st('refining', 'Refining', 'IN_PROGRESS', COLOR.blue, 'Đang làm rõ tiêu chí nghiệm thu'),
          st('ready', 'Ready for Sprint', 'DONE', COLOR.green, 'Đủ điều kiện đưa vào sprint'),
        ],
        transitions: [tr('backlog', 'refining', ['BA', 'PROJECT_MANAGER']), tr('refining', 'ready', ['PROJECT_MANAGER', 'TECH_LEAD'])],
      },
      codingPhase('Sprint Execution', 'Thực thi sprint 2 tuần'),
      {
        name: 'Sprint Review',
        description: 'Demo và nghiệm thu cuối sprint',
        statuses: [
          st('demo', 'In Review', 'IN_PROGRESS', COLOR.violet, 'Đang demo cho Product Owner', true),
          st('accepted', 'Accepted', 'DONE', COLOR.green, 'Đạt Definition of Done'),
        ],
        transitions: [tr('demo', 'accepted', ['PROJECT_MANAGER', 'QA'])],
      },
      {
        name: 'Release',
        description: 'Đóng gói và phát hành',
        statuses: [
          st('to_release', 'Ready to Release', 'TODO', COLOR.amber, null, true),
          st('released', 'Released', 'DONE', COLOR.green, null),
        ],
        transitions: [tr('to_release', 'released', ['TECH_LEAD', 'PROJECT_MANAGER'])],
      },
    ],
  },
  {
    method: 'KANBAN',
    name: 'Kanban',
    description: 'Continuous flow, giới hạn công việc đang làm (WIP limits), tối ưu hoá Lead & Cycle Time.',
    phasesEditable: false,
    phases: [
      {
        name: 'Kanban Board',
        description: 'Luồng liên tục — Standard Kanban Workflow',
        statuses: [
          st('todo', 'To Do', 'TODO', COLOR.gray, 'Issue mới tạo, chờ phân công', true),
          st('doing', 'In Progress', 'IN_PROGRESS', COLOR.blue, 'Đang thực hiện'),
          st('review', 'Code Review', 'IN_PROGRESS', COLOR.violet, 'Chờ review / kiểm thử'),
          st('done', 'Done', 'DONE', COLOR.green, 'Hoàn thành'),
        ],
        transitions: [
          tr('todo', 'doing', ['DEVELOPER', 'TECH_LEAD', 'PROJECT_MANAGER']),
          tr('doing', 'review', ['DEVELOPER'], 'Link PR / Git commit'),
          tr('review', 'done', ['QA', 'TECH_LEAD']),
          tr('review', 'doing', ['QA', 'TECH_LEAD'], 'Bug details & logs'),
        ],
      },
    ],
  },
  {
    method: 'CUSTOM',
    name: 'Custom SDLC Template',
    description: 'Tuỳ chỉnh linh hoạt thứ tự, tên gọi và điều kiện bắt buộc của từng giai đoạn bàn giao kỹ thuật.',
    phasesEditable: true,
    phases: [
      {
        name: 'Requirement & Analysis',
        description: 'Thu thập và phân tích yêu cầu',
        statuses: [
          st('open', 'Open', 'TODO', COLOR.gray, 'Yêu cầu mới ghi nhận', true),
          st('drafting', 'Drafting', 'IN_PROGRESS', COLOR.blue, 'BA đang soạn đặc tả'),
          st('approved', 'Approved', 'DONE', COLOR.green, 'Đặc tả đã được phê duyệt'),
        ],
        transitions: [
          tr('open', 'drafting', ['BA', 'PROJECT_MANAGER']),
          tr('drafting', 'approved', ['PROJECT_MANAGER']),
          tr('approved', 'drafting', ['PROJECT_MANAGER'], 'Lý do mở lại đặc tả'),
        ],
      },
      {
        name: 'UI/UX Design & Architecture',
        description: 'Thiết kế wireframe, prototype và kiến trúc',
        statuses: [
          st('wireframing', 'Wireframing', 'IN_PROGRESS', COLOR.blue, 'Đang thiết kế', true),
          st('reviewed', 'Reviewed', 'DONE', COLOR.green, 'Thiết kế đã được duyệt'),
        ],
        transitions: [tr('wireframing', 'reviewed', ['TECH_LEAD', 'PROJECT_MANAGER'])],
      },
      codingPhase('Sprint Execution & Coding', 'Lập trình tính năng theo các sprint'),
      {
        name: 'UAT & Deployment',
        description: 'Kiểm thử chấp nhận người dùng và triển khai',
        statuses: [
          st('uat', 'UAT Testing', 'IN_PROGRESS', COLOR.violet, 'Người dùng đang kiểm thử chấp nhận', true),
          st('deployed', 'Deployed', 'DONE', COLOR.green, 'Đã triển khai production'),
        ],
        transitions: [tr('uat', 'deployed', ['QA', 'PROJECT_MANAGER'])],
      },
    ],
  },
]
