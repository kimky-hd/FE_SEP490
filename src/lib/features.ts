// Cờ tính năng cho các mô-đun chưa xây xong. Bật cờ thì mục tương ứng hiện trên menu dự án (theo thứ tự vai trò).
export const FEATURES = {
  kanban: true,
  testcases: true,
  /**
   * Nút "Hoàn tất / Chuyển có lý do / Mở lại giai đoạn" ở tab Workflow. BE chưa có API §12.6 (đề xuất) nên tắt;
   * tắt thì vẫn hiện checklist điều kiện hoàn thành ở chế độ chỉ xem.
   */
  phaseLifecycle: import.meta.env.VITE_USE_MOCK === 'true',
} as const

export type FeatureFlags = { kanban: boolean; testcases: boolean }
