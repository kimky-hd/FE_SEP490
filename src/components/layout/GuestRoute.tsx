import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { FullPageSpinner } from '@/components/ui/Spinner'

// Cho phép truy cập trực tiếp /login và /register ngay cả khi đang có phiên mock đăng nhập,
// giúp thiết kế và kiểm tra trực quan giao diện các màn hình Auth bất kỳ lúc nào.
export function GuestRoute({ children }: { children: ReactNode }) {
  const { isBootstrapping } = useAuth()

  if (isBootstrapping) return <FullPageSpinner />

  return <>{children}</>
}
