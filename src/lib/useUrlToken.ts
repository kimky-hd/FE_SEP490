import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Đọc token một lần dùng (xác thực email, đặt lại mật khẩu) từ query `?token=` rồi gỡ ngay khỏi thanh địa chỉ
 * và lịch sử trình duyệt, để token không nằm lại trong history, không lọt qua header Referer khi trang tải
 * Google Fonts / người dùng bấm link ngoài, và không bị chụp màn hình/chia sẻ nhầm.
 * Trong lúc trang mở còn đặt `<meta name="referrer" content="no-referrer">`.
 */
export function useUrlToken(param = 'token'): string | null {
  const [searchParams] = useSearchParams()
  // Chụp lại lần đầu: sau khi URL bị gỡ query, giá trị vẫn giữ trong state.
  const [token] = useState(() => searchParams.get(param))

  useEffect(() => {
    const { pathname, search, hash } = window.location
    if (search) {
      // Giữ history.state để react-router không mất key/idx của entry hiện tại.
      window.history.replaceState(window.history.state, '', pathname + hash)
    }
  }, [])

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return token
}
