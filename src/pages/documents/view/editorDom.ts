import type { Editor } from '@tiptap/react'
import type { Priority } from '@/types/document'

export function flash(el: HTMLElement, durationMs?: number) {
  el.classList.remove('doc-flash')
  void el.offsetWidth // ép reflow để animation chạy lại khi nháy cùng khối 2 lần liền
  el.classList.add('doc-flash')
  if (durationMs) setTimeout(() => el.classList.remove('doc-flash'), durationMs)
}

export function scrollToAnchor(editor: Editor | null, anchorId: string) {
  const el = editor?.view.dom.querySelector<HTMLElement>(`[data-id="${CSS.escape(anchorId)}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flash(el, 1700)
}

export function anchorOfReq(editor: Editor | null, reqUid: string): string | null {
  let id: string | null = null
  editor?.state.doc.forEach((n) => {
    if (!id && n.attrs.reqUid === reqUid) id = n.attrs.id as string
  })
  return id
}

export function changeElements(editor: Editor | null): HTMLElement[] {
  return editor ? [...editor.view.dom.querySelectorAll<HTMLElement>('[data-chg]:not([data-chg="format"])')] : []
}

/**
 * Đổi độ ưu tiên ngay trên attr của heading REQ (editor tự lưu sau đó) — không gọi PATCH /requirements vì sẽ làm
 * lệch rowVersion của editor đang mở. Trả false nếu không tìm thấy heading.
 */
export function setHeadingPriority(editor: Editor, reqUid: string, priority: Priority): boolean {
  let pos: number | null = null
  editor.state.doc.forEach((n, offset) => {
    if (pos === null && n.type.name === 'heading' && n.attrs.reqUid === reqUid) pos = offset
  })
  if (pos === null) return false
  const target = editor.state.doc.nodeAt(pos)
  if (!target) return false
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...target.attrs, priority }))
  return true
}
