/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  /** 'true' = bật mock trong app (src/mocks) cho Workspace/RBAC khi BE chưa có. */
  readonly VITE_USE_MOCK?: string
  /** Cờ cũ: 'true' = mọi module mới (Tài liệu, Kanban, Test, Việc của tôi) chạy mock khi cờ riêng không đặt. */
  readonly VITE_DOCUMENTS_MOCK?: string
  /** Cờ mock theo module (src/api/mockFlags.ts, doc/BE-Changes-2026-10-28_30-API.md §0.4, §H): 'true' = mock, 'false' = BE thật. */
  readonly VITE_MOCK_DOCUMENTS?: string
  readonly VITE_MOCK_KANBAN?: string
  readonly VITE_MOCK_TESTS?: string
  readonly VITE_MOCK_WORK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
