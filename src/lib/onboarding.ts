import type { MeResponseDto } from '@/types/auth'

/**
 * Đã onboard = đã thuộc một công ty. SSAM chỉ còn tài khoản doanh nghiệp: tài khoản cũ chỉ có workspace cá nhân
 * phải đi lại onboarding để tạo / tham gia công ty. Workspace thuộc công ty cũng tính (BE cũ có thể chưa trả `companies`).
 */
export const isOnboarded = (me: Pick<MeResponseDto, 'companies' | 'workspaces'>) =>
  me.companies.length > 0 || me.workspaces.some((w) => w.companyId !== null)
