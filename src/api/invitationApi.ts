import { api } from '@/lib/apiClient'
import type { AuthSessionDto, InvitationPreviewDto } from '@/types/auth'

// Token lấy từ URL do người dùng kiểm soát → encode trước khi nhúng vào path, tránh `../` hay `?` làm lệch endpoint.
const invitationPath = (token: string, suffix = '') => `/invitations/${encodeURIComponent(token)}${suffix}`

export const invitationApi = {
  preview: (token: string) =>
    api.get<InvitationPreviewDto>(invitationPath(token), { skipAuth: true }).then((r) => r.data),

  acceptAsNewUser: (token: string, body: { fullName: string; password: string }) =>
    api.post<AuthSessionDto & { companyId: number; workspaceId: number | null }>(
      invitationPath(token, '/accept'),
      body,
      { skipAuth: true },
    ).then((r) => r.data),

  acceptAsExistingUser: (token: string) =>
    api.post<{ companyId: number; workspaceId: number | null }>(
      invitationPath(token, '/accept'),
      {},
    ).then((r) => r.data),
}
