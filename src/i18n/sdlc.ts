import type { SdlcMethod } from '@/types/project'
import { tr } from './index'

// Tên và mô tả mẫu SDLC do BE trả về (SdlcTemplateCatalog) lẫn tiếng Anh trong câu tiếng Việt. Ở đây viết lại
// cho gọn từng ngôn ngữ; mẫu lạ (BE thêm sau) thì dùng nguyên văn BE trả về.

const NAMES: Record<SdlcMethod, [vi: string, en: string]> = {
  SCRUM: ['Agile Scrum', 'Agile Scrum'],
  KANBAN: ['Kanban', 'Kanban'],
  WATERFALL: ['Thác nước (Waterfall)', 'Waterfall Model'],
  ITERATIVE: ['Lặp & Tăng dần (Iterative)', 'Iterative & Incremental'],
  V_MODEL: ['Mô hình chữ V (V-Model)', 'V-Model'],
  SPIRAL: ['Mô hình Xoắn ốc (Spiral)', 'Spiral Model'],
  RAD: ['Phát triển ứng dụng nhanh (RAD)', 'Rapid App Dev (RAD)'],
  CUSTOM: ['SDLC tuỳ chỉnh', 'Custom SDLC'],
}

const DESCRIPTIONS: Record<SdlcMethod, [vi: string, en: string]> = {
  SCRUM: [
    'Sprint cố định 2 tuần, quản lý backlog sản phẩm, họp lập kế hoạch sprint, họp hằng ngày và họp cải tiến.',
    'Fixed 2-week sprints with a product backlog, sprint planning, daily stand-ups and retrospectives.',
  ],
  KANBAN: [
    'Làm liên tục, giới hạn số việc đang làm cùng lúc, rút ngắn thời gian hoàn thành mỗi việc.',
    'Continuous flow with work-in-progress limits, optimizing lead and cycle time.',
  ],
  WATERFALL: [
    'Tuần tự tuần tự qua các giai đoạn: Đặc tả, Thiết kế, Lập trình, Kiểm thử và Bàn giao.',
    'Sequential linear flow: Requirement, Design, Implementation, Verification, Maintenance.',
  ],
  ITERATIVE: [
    'Phát triển theo các chu kỳ lặp tăng dần từ khung kiến trúc đến hoàn thiện sản phẩm.',
    'Repeated iterative cycles building increments of software with progressive refinement.',
  ],
  V_MODEL: [
    'Kiểm thử đối xứng với từng giai đoạn phân tích và phát triển theo cấu trúc chữ V.',
    'Verification and Validation model pairing each dev stage with a corresponding test tier.',
  ],
  SPIRAL: [
    'Lặp vòng xoắn ốc kết hợp phân tích rủi ro và tạo mẫu thử trước khi triển khai quy mô lớn.',
    'Risk-driven spiral model focusing on continuous prototyping and risk mitigation.',
  ],
  RAD: [
    'Tạo mẫu nhanh, tương tác liên tục với khách hàng để bàn giao sản phẩm trong thời gian ngắn.',
    'Fast-paced prototyping and active user feedback loops for rapid release cycles.',
  ],
  CUSTOM: [
    'Tuỳ chỉnh linh hoạt thứ tự, tên gọi và điều kiện bắt buộc của từng giai đoạn bàn giao kỹ thuật.',
    'Freely customize the order, names and required conditions of each delivery phase.',
  ],
}

const pick = (table: Record<string, [string, string]>, method: string, fallback: string) => {
  const entry = table[method]
  return entry ? tr(entry[0], entry[1]) : fallback
}

export function templateName(method: SdlcMethod | string, fallback: string): string {
  return pick(NAMES, method, fallback)
}

export function templateDescription(method: SdlcMethod | string, fallback: string): string {
  return pick(DESCRIPTIONS, method, fallback)
}
