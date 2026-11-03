import { newUid } from '@/api/mock/documentContent'
import type { DocType, TipTapDoc, TipTapNode } from '@/types/document'
import { newBlockId } from './editor/extensions'

// Khung mục chuẩn khi tạo trang trống theo loại tài liệu (OTHER = trang trắng). Ngôn ngữ theo giao diện hiện tại.

type T = (vi: string, en: string) => string

const text = (s: string): TipTapNode => ({ type: 'text', text: s })
const h = (level: number, s: string): TipTapNode => ({
  type: 'heading',
  attrs: { id: newBlockId(), level },
  content: [text(s)],
})
const req = (s: string): TipTapNode => ({
  type: 'heading',
  attrs: { id: newBlockId(), level: 3, req: true, reqUid: newUid(), priority: 'MEDIUM' },
  content: [text(s)],
})
const p = (s = ''): TipTapNode =>
  s
    ? { type: 'paragraph', attrs: { id: newBlockId() }, content: [text(s)] }
    : { type: 'paragraph', attrs: { id: newBlockId() } }
const criteria = (items: string[]): TipTapNode => ({
  type: 'taskList',
  attrs: { id: newBlockId() },
  content: items.map((i) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [{ type: 'paragraph', content: [text(i)] }],
  })),
})
const bullets = (items: string[]): TipTapNode => ({
  type: 'bulletList',
  attrs: { id: newBlockId() },
  content: items.map((i) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [text(i)] }] })),
})

export function pageTemplate(docType: DocType, t: T): TipTapDoc {
  const doc = (...content: TipTapNode[]): TipTapDoc => ({ type: 'doc', content })
  if (docType === 'SRS') {
    return doc(
      h(1, t('1. Giới thiệu', '1. Introduction')),
      h(2, t('1.1 Mục đích', '1.1 Purpose')),
      p(),
      h(2, t('1.2 Phạm vi', '1.2 Scope')),
      p(),
      h(2, t('1.3 Thuật ngữ', '1.3 Glossary')),
      p(),
      h(1, t('2. Mô tả tổng quan', '2. Overall description')),
      h(2, t('2.1 Tác nhân', '2.1 Actors')),
      p(),
      h(2, t('2.2 Giả định & ràng buộc', '2.2 Assumptions & constraints')),
      p(),
      h(1, t('3. Yêu cầu chức năng', '3. Functional requirements')),
      req(t('Tên yêu cầu', 'Requirement name')),
      p(t('Mô tả hành vi mong đợi.', 'Describe the expected behaviour.')),
      criteria([t('Tiêu chí nghiệm thu', 'Acceptance criterion')]),
      h(1, t('4. Yêu cầu phi chức năng', '4. Non-functional requirements')),
      p(),
      h(1, t('5. Phụ lục', '5. Appendix')),
      p(),
    )
  }
  if (docType === 'URD') {
    return doc(
      h(1, t('1. Bối cảnh', '1. Background')),
      p(),
      h(1, t('2. Người dùng', '2. Users')),
      bullets([t('Nhóm người dùng', 'User group')]),
      h(1, t('3. Hành trình người dùng', '3. User journeys')),
      req(t('Người dùng có thể …', 'Users can …')),
      p(t('Bối cảnh và mục tiêu của người dùng.', "The user's context and goal.")),
      criteria([t('Tiêu chí chấp nhận', 'Acceptance criterion')]),
      h(1, t('4. Ngoài phạm vi', '4. Out of scope')),
      p(),
    )
  }
  if (docType === 'BRD') {
    return doc(
      h(1, t('1. Mục tiêu kinh doanh', '1. Business goals')),
      p(),
      h(1, t('2. Các bên liên quan', '2. Stakeholders')),
      bullets([t('Bộ phận / vai trò', 'Team / role')]),
      h(1, t('3. Yêu cầu nghiệp vụ', '3. Business requirements')),
      req(t('Yêu cầu nghiệp vụ', 'Business requirement')),
      p(t('Lý do và giá trị mang lại.', 'Rationale and value.')),
      criteria([t('Chỉ số đo thành công', 'Success measure')]),
      h(1, t('4. Quy tắc nghiệp vụ', '4. Business rules')),
      {
        type: 'callout',
        attrs: { id: newBlockId(), tone: 'rule' },
        content: [{ type: 'paragraph', content: [text(t('Quy tắc …', 'Rule …'))] }],
      },
      h(1, t('5. Rủi ro & giả định', '5. Risks & assumptions')),
      p(),
    )
  }
  return doc(p())
}

/** Khối "Thêm yêu cầu (REQ)" cho trang trống: tiêu đề REQ · đoạn mô tả · checklist tiêu chí nghiệm thu. */
export function reqStarter(t: T): TipTapDoc {
  return {
    type: 'doc',
    content: [
      {
        ...req(t('Tên yêu cầu', 'Requirement name')),
        attrs: { id: newBlockId(), level: 2, req: true, reqUid: newUid(), priority: 'MEDIUM' },
      },
      p(),
      criteria([t('Tiêu chí nghiệm thu', 'Acceptance criterion')]),
    ],
  }
}
