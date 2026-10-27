import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from '@/context/AuthContext'

// Helper dùng chung cho test các trang cần Router + GoogleOAuthProvider + AuthContext.
export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <GoogleOAuthProvider clientId="test-client-id">
        <AuthProvider>{ui}</AuthProvider>
      </GoogleOAuthProvider>
    </MemoryRouter>,
  )
}
