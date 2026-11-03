import { useRef, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { FullPageSpinner } from '@/components/ui/Spinner'

// Dành cho /login, /register: ai đã đăng nhập sẵn thì đưa thẳng về Dashboard.
// Chỉ quyết định MỘT lần ở render đầu tiên sau khi bootstrap xong — nếu xét lại mỗi khi
// isAuthenticated đổi thì ngay lúc applySession() thành công, wrapper này sẽ redirect về "/"
// trước khi LoginPage kịp chạy goAfterAuth() (vốn quyết định vào Dashboard hay onboarding).
export function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const wasAuthenticatedOnEntry = useRef<boolean | null>(null)

  if (isBootstrapping) return <FullPageSpinner />
  if (wasAuthenticatedOnEntry.current === null) wasAuthenticatedOnEntry.current = isAuthenticated
  if (wasAuthenticatedOnEntry.current) return <Navigate to="/" replace />

  return <>{children}</>
}
