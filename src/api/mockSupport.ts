import { registerCache } from '@/lib/dataEvents'
import { authApi } from './authApi'
import { projectApi } from './projectApi'
import { getSystemProjectSeedContext } from '@/mocks'
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
let systemSeedDepth = 0

export async function withSystemSeedContext<T>(fn: () => Promise<T>): Promise<T> {
  systemSeedDepth++
  try {
    return await fn()
  } finally {
    systemSeedDepth--
  }
}

function ttlCache<T>(load: (projectId: number) => Promise<T>, systemFallback?: (projectId: number) => T | null) {
  const cache = new Map<number, { at: number; value: Promise<T> }>()
  registerCache(() => cache.clear())
  return (projectId: number): Promise<T> => {
    if (systemSeedDepth > 0 && systemFallback) {
      const sys = systemFallback(projectId)
      if (sys !== null) return Promise.resolve(sys)
    }
    const hit = cache.get(projectId)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value
    const value = load(projectId).catch((err) => {
      cache.delete(projectId)
      if (systemFallback) {
        const sys = systemFallback(projectId)
        if (sys !== null) return sys
      }
      throw err
    })
    cache.set(projectId, { at: Date.now(), value })
    return value
  }
}

export const mockProjectAccess = ttlCache<MockProjectAccess>(
  (projectId) =>
    projectApi.get(projectId).then((p) => ({
      permissions: p.myPermissions,
      aiEnabled: p.aiEnabled,
      archived: p.status === 'ARCHIVED',
      roleId: p.myRole?.roleId ?? null,
      projectKey: p.key,
    })),
  (projectId) => getSystemProjectSeedContext(projectId)?.access ?? null,
)

/** Workflow dự án, cache 30s (dùng cả ở trang Kanban để không gọi lặp). */
export const mockWorkflow = ttlCache<WorkflowDto>(
  (projectId) => projectApi.workflow(projectId),
  (projectId) => getSystemProjectSeedContext(projectId)?.workflow ?? null,
)
export const cachedWorkflow = mockWorkflow

export const mockMembers = ttlCache<UserRefLite[]>(
  (projectId) =>
    projectApi
      .listMembers(projectId)
      .then((items) => items.map((m) => ({ userId: m.userId, fullName: m.fullName })))
      .catch(() => getSystemProjectSeedContext(projectId)?.members ?? []),
  (projectId) => getSystemProjectSeedContext(projectId)?.members ?? null,
)

let actorPromise: Promise<UserRefLite> | null = null
registerCache(() => {
  actorPromise = null
})

export function currentActor(): Promise<UserRefLite> {
  if (systemSeedDepth > 0) {
    const sys = getSystemProjectSeedContext(20)?.actor
    if (sys) return Promise.resolve(sys)
  }
  actorPromise ??= authApi
    .me()
    .then((me) => ({ userId: me.user.id, fullName: me.user.fullName }))
    .catch((err) => {
      actorPromise = null
      const sys = getSystemProjectSeedContext(20)?.actor
      if (sys) return sys
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
