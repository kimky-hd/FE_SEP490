import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LanguageProvider } from './i18n'
import { tokenStorage } from './lib/storage'
import { enableMocks } from './mocks'
import { seedAllDemo } from './api/mockSeed'
import './index.css'

if (import.meta.env.VITE_USE_MOCK !== 'false') {
  try {
    const isUpgraded = localStorage.getItem('ssam.mockdb.v5.seeded') === 'true'
    if (!isUpgraded) {
      localStorage.removeItem('ssam.mockdb.v1')
      localStorage.removeItem('ssam.mockdb.v2')
      localStorage.removeItem('ssam.mockdb.v3')
      localStorage.removeItem('ssam.mockdb.v4')
      localStorage.removeItem('ssam.mock.docs.v1')
      localStorage.removeItem('ssam.mock.documents.v1')
      localStorage.removeItem('ssam.mock.issues.v1')
      localStorage.removeItem('ssam.mock.tests.v1')
      localStorage.removeItem('ssam.mock.tests.v2')
      localStorage.setItem('ssam.mockdb.v5.seeded', 'true')
    }
  } catch {
    // ignore storage errors
  }
  enableMocks()
  void Promise.all([20, 21, 22, 24, 25].map((pid) => seedAllDemo(pid).catch(() => false)))
} else {
  // Dọn sạch dữ liệu/token mock cũ trong trình duyệt (nếu từng chạy chế độ mock trước đây)
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
