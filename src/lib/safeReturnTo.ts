/**
 * Đường dẫn quay lại sau đăng nhập (`location.state.from`, do ProtectedRoute đặt). Chỉ nhận path tuyệt đối
 * cùng origin để không thành open-redirect: phải bắt đầu bằng `/`, không phải `//host`, và không chứa `\`
 * (trình duyệt coi `/\evil.com` như `//evil.com` — GHSA-wrjc-x8rr-h8h6, vá tạm tới khi lên react-router 7).
 */
export function safeReturnTo(from: unknown): string | null {
  if (typeof from !== 'string') return null
  if (!from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return null
  return from
}
