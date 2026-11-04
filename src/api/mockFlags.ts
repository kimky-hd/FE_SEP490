// Cờ mock theo module (doc/BE-Changes-2026-10-28_30-API.md §0.4, §H). Mỗi module tắt mock riêng khi BE giao giai đoạn:
//   VITE_MOCK_DOCUMENTS  Tài liệu (#1–#22)
//   VITE_MOCK_KANBAN     Kanban (#26–#44)
//   VITE_MOCK_TESTS      Test cases (#45–#58)
//   VITE_MOCK_WORK       Việc của tôi & Tổng quan (#23, #24)
// 'true' = chạy mock trong trình duyệt, 'false' = gọi BE thật. Không đặt thì theo cờ cũ VITE_DOCUMENTS_MOCK
// ('true' = bật cả 4 module, giữ tương thích .env cũ). Build production không đặt cờ nào → gọi BE thật.

export type MockModule = 'documents' | 'kanban' | 'tests' | 'work'

type Env = Partial<
  Record<
    | 'VITE_DOCUMENTS_MOCK'
    | 'VITE_MOCK_DOCUMENTS'
    | 'VITE_MOCK_KANBAN'
    | 'VITE_MOCK_TESTS'
    | 'VITE_MOCK_WORK'
    | 'VITE_USE_MOCK',
    string
  >
>

export function resolveMockFlags(env: Env): Record<MockModule, boolean> {
  const legacy = env.VITE_DOCUMENTS_MOCK === 'true' || env.VITE_USE_MOCK === 'true'
  const pick = (v: string | undefined) => (v === undefined || v.trim() === '' ? legacy : v.trim() === 'true')
  return {
    documents: pick(env.VITE_MOCK_DOCUMENTS),
    kanban: pick(env.VITE_MOCK_KANBAN),
    tests: pick(env.VITE_MOCK_TESTS),
    work: pick(env.VITE_MOCK_WORK),
  }
}

export const MOCK: Readonly<Record<MockModule, boolean>> = Object.freeze(resolveMockFlags(import.meta.env))

/** Có ít nhất một module chạy mock (hiện nút "Tạo dữ liệu mẫu"…). */
export const anyMock = Object.values(MOCK).some(Boolean)
