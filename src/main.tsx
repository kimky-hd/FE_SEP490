import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LanguageProvider } from './i18n'
import { tokenStorage } from './lib/storage'
import { enableMocks } from './mocks'
import { seedAllDemo } from './api/mockSeed'
import './index.css'

if (import.meta.env.VITE_USE_MOCK !== 'false') {
  enableMocks()
  // Tự động nạp dữ liệu mẫu phong phú cho các dự án khởi đầu (20: CORE, 21: PAY, 22: NOTIF, 24: PORTAL)
  setTimeout(() => {
    seedAllDemo(20).catch(() => {})
    seedAllDemo(21).catch(() => {})
    seedAllDemo(22).catch(() => {})
    seedAllDemo(24).catch(() => {})
  }, 100)
} else {
  // Dọn sạch dữ liệu/token mock cũ nếu chạy với BE thật
  try {
    localStorage.removeItem('ssam.mockdb.v1')
    localStorage.removeItem('ssam.mockdb.v2')
    const token = tokenStorage.getAccessToken()
    if (token && token.startsWith('mock-token-')) {
      tokenStorage.clear()
    }
  } catch {
    // ignore storage errors
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
