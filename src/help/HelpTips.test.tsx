import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HelpProvider } from './HelpProvider'
import { HelpTips } from './HelpTips'

function renderAt(path: string, role?: 'BA' | 'QA') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HelpProvider>
        <HelpTips role={role} />
        <input aria-label="other" />
      </HelpProvider>
    </MemoryRouter>,
  )
}

describe('HelpTips', () => {
  it('opens on click with role tips for the page, Esc closes', async () => {
    const user = userEvent.setup()
    renderAt('/projects/1/documents/5', 'BA')
    await user.click(screen.getByRole('button', { name: /Mẹo cho trang này/ }))
    const card = screen.getByRole('dialog', { name: 'Mẹo cho trang Tài liệu' })
    expect(card).toHaveTextContent('Bôi đen để vẽ sơ đồ')
    expect(card).toHaveTextContent('BA')
    expect(card).toHaveTextContent('Ctrl')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens with "?" but not while typing', async () => {
    const user = userEvent.setup()
    renderAt('/projects/1/my-work', 'QA')
    await user.click(screen.getByLabelText('other'))
    await user.keyboard('?')
    expect(screen.queryByRole('dialog')).toBeNull()
    ;(document.activeElement as HTMLElement).blur()
    fireEvent.keyDown(window, { key: '?' })
    expect(await screen.findByRole('dialog', { name: 'Mẹo cho trang Việc của tôi' })).toHaveTextContent(
      'Testcase chờ bạn',
    )
  })

  it('switches to the shortcuts list', async () => {
    const user = userEvent.setup()
    renderAt('/projects/1/kanban')
    await user.click(screen.getByRole('button', { name: /Mẹo cho trang này/ }))
    await user.click(screen.getByRole('button', { name: 'Phím tắt' }))
    expect(screen.getByRole('dialog', { name: 'Phím tắt' })).toHaveTextContent('Mở mẹo của trang')
  })

  it('outside a project offers an inline question box', async () => {
    const user = userEvent.setup()
    renderAt('/admin/users')
    await user.click(screen.getByRole('button', { name: /Mẹo cho trang này/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Hỏi nhanh' }), 'lam sao moi thanh vien')
    expect(screen.getByRole('dialog')).toHaveTextContent('Mời thành viên:')
    expect(screen.getByRole('button', { name: /Mời vào công ty/ })).toBeInTheDocument()
  })

  it('renders nothing on pages without help', () => {
    renderAt('/login')
    expect(screen.queryByRole('button', { name: /Mẹo/ })).toBeNull()
  })
})
