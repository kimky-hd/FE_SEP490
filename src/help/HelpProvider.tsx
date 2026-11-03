import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// Một bộ nghe phím "?" duy nhất cho cả app. Mỗi nút "?" (HelpTips) đăng ký vào đây; phím "?" mở/đóng nút đăng ký
// sau cùng (nút của trang đang xem). Không có Provider (test, story) thì HelpTips tự giữ trạng thái mở riêng.

interface HelpState {
  openId: string | null
  setOpenId: (id: string | null) => void
  register: (id: string) => () => void
  /** Trang tự báo đang ở trạng thái có mẹo riêng (vd màn bắt đầu của Tài liệu) — ưu tiên hơn khớp theo URL. */
  topicOverride: string | null
  setTopicOverride: (id: string | null) => void
}

const HelpContext = createContext<HelpState | null>(null)

/** Đang gõ trong ô nhập / editor: không bắt phím "?". */
export const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || !!el.closest('input, textarea, select, [contenteditable="true"]'))

export function HelpProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [topicOverride, setTopicOverride] = useState<string | null>(null)
  const ids = useRef<string[]>([])

  const register = useCallback((id: string) => {
    ids.current.push(id)
    return () => {
      ids.current = ids.current.filter((x) => x !== id)
      setOpenId((cur) => (cur === id ? null : cur))
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (isTypingTarget(e.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      const last = ids.current[ids.current.length - 1]
      if (!last) return
      e.preventDefault()
      setOpenId((cur) => (cur ? null : last))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(
    () => ({ openId, setOpenId, register, topicOverride, setTopicOverride }),
    [openId, register, topicOverride],
  )
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>
}

/** Trạng thái mở của một nút "?" (qua Provider nếu có). */
export function useHelpOpen(id: string): [boolean, (open: boolean) => void] {
  const ctx = useContext(HelpContext)
  const [local, setLocal] = useState(false)
  const register = ctx?.register
  useEffect(() => register?.(id), [register, id])
  const setOpenId = ctx?.setOpenId
  const set = useCallback(
    (open: boolean) => (setOpenId ? setOpenId(open ? id : null) : setLocal(open)),
    [setOpenId, id],
  )
  return [ctx ? ctx.openId === id : local, set]
}

/** Gọi trong một màn có mẹo riêng (không phân biệt được bằng URL): nút "?" của trang sẽ hiện mẹo `topicId`. */
export function useHelpTopic(topicId: string) {
  const set = useContext(HelpContext)?.setTopicOverride
  useEffect(() => {
    if (!set) return
    set(topicId)
    return () => set(null)
  }, [set, topicId])
}

export function useHelpTopicOverride(): string | null {
  return useContext(HelpContext)?.topicOverride ?? null
}
