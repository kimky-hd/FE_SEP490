import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// globals:false trong vite.config.ts nên RTL không tự đăng ký afterEach cleanup được -> làm thủ công ở đây,
// nếu không DOM giữa các test trong cùng file sẽ chồng lên nhau (vd 2 checkbox "agree" cùng tồn tại).
afterEach(() => cleanup())

// jsdom không implement ResizeObserver -> polyfill giả để test các component dùng nó
// (vd GoogleAuthButton tự đo chiều rộng container) không bị crash khi mount.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// jsdom không cài window.scrollTo (wizard tạo dự án cuộn lên đầu khi đổi bước).
window.scrollTo = () => {}
