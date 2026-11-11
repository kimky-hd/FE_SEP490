import type { TipTapDoc, TipTapNode } from '@/types/document'
import type { DocSectionDto } from '@/types/testing'

// Mục (heading) của tài liệu cho module Test cases: module = một tài liệu đặc tả, mục lớn = một heading thường (không
// phải heading REQ) của tài liệu. Mỗi REQ thuộc đúng một mục: heading thường gần nhất phía trên nó. Đây là logic của
// endpoint mới GET /documents/{documentId}/sections (BE làm giống), mock dùng trực tiếp.

const text = (n: TipTapNode): string => (n.text ?? '') + (n.content ?? []).map(text).join('')

export function extractDocSections(doc: TipTapDoc | null | undefined): DocSectionDto[] {
  const out: DocSectionDto[] = []
  let current: DocSectionDto | null = null
  for (const node of doc?.content ?? []) {
    if (node.type !== 'heading') continue
    const attrs = node.attrs ?? {}
    if (attrs.req === true) {
      if (current && attrs.reqUid) current.reqUids.push(String(attrs.reqUid))
      continue
    }
    if (!attrs.id) continue
    current = { anchorId: String(attrs.id), title: text(node).trim(), level: Number(attrs.level ?? 1), reqUids: [] }
    out.push(current)
  }
  return out
}

/** Mục chứa REQ (null nếu REQ đứng trước mọi heading thường). */
export function sectionOfReq(sections: DocSectionDto[], reqUid: string): DocSectionDto | null {
  return sections.find((s) => s.reqUids.includes(reqUid)) ?? null
}

/** Mục lớn tạo mặc định khi tạo module từ tài liệu: mọi heading có REQ; tài liệu không có heading nào có REQ thì mọi heading cấp cao nhất. */
export function defaultModuleSections(sections: DocSectionDto[]): DocSectionDto[] {
  const withReqs = sections.filter((s) => s.reqUids.length > 0)
  if (withReqs.length) return withReqs
  const top = Math.min(...sections.map((s) => s.level))
  return sections.filter((s) => s.level === top)
}

/** Bỏ số thứ tự đầu tiêu đề heading ("3.1 Thêm mới" → "Thêm mới") để làm tên mục trong bảng. */
export const stripHeadingNumber = (title: string) => title.replace(/^\s*(§\s*)?\d+(\.\d+)*\.?\s+/, '').trim() || title
