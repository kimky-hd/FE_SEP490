import { registerCache } from '@/lib/dataEvents'
import { authApi } from './authApi'
import { projectApi } from './projectApi'
import type { WorkflowDto } from '@/types/project'

// Phần dùng chung của các backend giả trong trình duyệt (tài liệu, issue, testcase): quyền / vai trò / workflow /
// thành viên lấy từ API thật đã có (GET /projects/{id}, /workflow, /members, /auth/me), cache ngắn.

export interface UserRefLite {
  userId: number
  fullName: string
}

export interface MockProjectAccess {
  permissions: string[]
  aiEnabled: boolean
  archived: boolean
  /** Role dự án của người gọi (để kiểm tra WorkflowTransitionRole); null nếu chỉ có quyền kế thừa. */
  roleId: number | null
  projectKey: string
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const TTL_MS = 30_000

function ttlCache<T>(load: (projectId: number) => Promise<T>) {
  const cache = new Map<number, { at: number; value: Promise<T> }>()
  registerCache(() => cache.clear())
  return (projectId: number): Promise<T> => {
    const hit = cache.get(projectId)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value
    const value = load(projectId)
    value.catch(() => cache.delete(projectId))
    cache.set(projectId, { at: Date.now(), value })
    return value
  }
}

export const mockProjectAccess = ttlCache<MockProjectAccess>((projectId) =>
  projectApi.get(projectId).then((p) => ({
    permissions: p.myPermissions,
    aiEnabled: p.aiEnabled,
    archived: p.status === 'ARCHIVED',
    roleId: p.myRole?.roleId ?? null,
    projectKey: p.key,
  })),
)

/** Workflow dự án, cache 30s (dùng cả ở trang Kanban để không gọi lặp). */
export const mockWorkflow = ttlCache<WorkflowDto>((projectId) => projectApi.workflow(projectId))
export const cachedWorkflow = mockWorkflow

export const mockMembers = ttlCache<UserRefLite[]>((projectId) =>
  projectApi
    .listMembers(projectId)
    .then((items) => items.map((m) => ({ userId: m.userId, fullName: m.fullName })))
    .catch(() => []),
)

let actorPromise: Promise<UserRefLite> | null = null

export function currentActor(): Promise<UserRefLite> {
  actorPromise ??= authApi
    .me()
    .then((me) => ({ userId: me.user.id, fullName: me.user.fullName }))
    .catch((err) => {
      actorPromise = null
      throw err
    })
  return actorPromise
}

export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}
