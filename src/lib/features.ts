// Cờ tính năng cho các mô-đun chưa xây xong. Bật cờ thì mục tương ứng hiện trên menu dự án (theo thứ tự vai trò).
export const FEATURES = {
  kanban: true,
  testcases: true,
} as const

export type FeatureFlags = { kanban: boolean; testcases: boolean }
