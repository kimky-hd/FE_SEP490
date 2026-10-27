import { useEffect, useRef, useState } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'

// GoogleLogin chỉ nhận width dạng số pixel cố định (không nhận "100%"), nên tự đo
// chiều rộng thật của container (w-full trong AuthCard) rồi truyền vào — tránh hardcode
// 1 con số cố định dễ bị lệch mỗi khi đổi maxWidth/padding của AuthCard.
export function GoogleAuthButton({
  onSuccess,
  onError,
  text,
}: {
  onSuccess: (credential: CredentialResponse) => void
  onError: () => void
  text: 'signup_with' | 'continue_with'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="min-h-[42px] w-full">
      {/* Dùng toán tử 3 ngôi thay vì `width &&` — khi container đang ẩn, width = 0 sẽ bị React render ra chữ "0". */}
      {width ? (
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          text={text}
          locale="vi"
          width={width}
          shape="rectangular"
          theme="outline"
          size="large"
        />
      ) : null}
    </div>
  )
}
