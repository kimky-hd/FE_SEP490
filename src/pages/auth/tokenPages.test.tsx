import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { VerifyEmailPage } from './VerifyEmailPage'
import { ResetPasswordPage } from './ResetPasswordPage'
import { authApi } from '@/api/authApi'

vi.mock('@/api/authApi', () => ({
  authApi: {
    verifyEmail: vi.fn(),
    resetPassword: vi.fn(),
  },
}))

const referrerMeta = () => document.head.querySelector('meta[name="referrer"]')

describe('Trang có token trong URL (F6)', () => {
  beforeEach(() => {
    vi.mocked(authApi.verifyEmail).mockReset()
    vi.mocked(authApi.resetPassword).mockReset()
  })
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('VerifyEmailPage gỡ token khỏi URL nhưng vẫn gửi đúng token, có meta no-referrer khi đang mở', async () => {
    window.history.pushState(null, '', '/verify-email?token=tok-verify-1')
    vi.mocked(authApi.verifyEmail).mockResolvedValue({} as never)
    const { unmount } = render(
      <BrowserRouter>
        <VerifyEmailPage />
      </BrowserRouter>,
    )

    await waitFor(() => expect(window.location.search).toBe(''))
    expect(window.location.pathname).toBe('/verify-email')
    expect(referrerMeta()?.getAttribute('content')).toBe('no-referrer')

    await userEvent.setup().click(screen.getByRole('button', { name: /xác thực email/i }))
    await waitFor(() => expect(authApi.verifyEmail).toHaveBeenCalledWith('tok-verify-1'))

    unmount()
    expect(referrerMeta()).toBeNull()
  })

  it('ResetPasswordPage gỡ token khỏi URL nhưng vẫn gửi đúng token khi đặt lại mật khẩu', async () => {
    window.history.pushState(null, '', '/reset-password?token=tok-reset-1')
    vi.mocked(authApi.resetPassword).mockResolvedValue({} as never)
    render(
      <BrowserRouter>
        <ResetPasswordPage />
      </BrowserRouter>,
    )

    await waitFor(() => expect(window.location.search).toBe(''))
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Str0ng!Passw0rd')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'Str0ng!Passw0rd')
    await user.click(screen.getByRole('button', { name: /đặt lại mật khẩu/i }))

    await waitFor(() => expect(authApi.resetPassword).toHaveBeenCalledWith('tok-reset-1', 'Str0ng!Passw0rd'))
  })
})
