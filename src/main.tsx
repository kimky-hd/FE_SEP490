import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { tokenStorage } from './lib/storage'
import './index.css'

async function bootstrap() {
  // Bật mặc định chế độ Mock khi chưa có Backend để chạy toàn bộ giao diện trực quan
  if (import.meta.env.VITE_USE_MOCK !== 'false') {
    const { enableMocks } = await import('./mocks')
    enableMocks()

    try {
      const hasToken = tokenStorage.getAccessToken()
      const isGuestMode = sessionStorage.getItem('ssam.guest_mode') === '1'
      if (!hasToken && !isGuestMode) {
        // Tự động đăng nhập tài khoản Tenant Admin (sarah@fintechcorp.com) để vào thẳng mọi màn hình
        tokenStorage.setTokens('mock-token-1', 'mock-token-1-refresh')
      }
    } catch {
      // ignore storage errors
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
