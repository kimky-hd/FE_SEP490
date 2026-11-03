import { onDataChanged, registerCache } from '@/lib/dataEvents'
import { useEffect, useMemo, useState } from 'react'
import { documentApi } from '@/api/documentApi'
import { loadPageInfos, type PageInfo } from '@/api/documentWork'
import { workApi } from '@/api/workApi'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/i18n'
import type { ProjectDto } from '@/types/project'
import type { WorkItemDto } from '@/types/work'
import { sortWork, toWorkItem, type WorkItem } from './myWorkRules'

// "Việc của tôi", chấm tín hiệu menu: GET /me/work-items?projectId= (doc/BE-Changes-2026-10-28_30-API.md #24) — mỗi
// dự án một lần gọi, cache ngắn để sidebar, trang Việc của tôi và trang Tổng quan dùng chung. Giao diện chỉ đọc
// WorkItemDto (luật chọn việc ở BE; mock: src/api/mock/workItemsMock.ts).

const TTL_MS = 30_000
const EVENT = 'ssam:project-work'
const cache = new Map<number, { at: number; value: Promise<PageInfo[]> }>()
const workCache = new Map<number, { at: number; value: Promise<WorkItemDto[]> }>()
registerCache(() => {
  cache.clear()
  workCache.clear()
})
onDataChanged(() => window.dispatchEvent(new Event(EVENT)))

/** Cây + chi tiết trang + REQ của một dự án (Ctrl K tìm REQ, đếm liên kết REQ). Không dùng cho "Việc của tôi". */
export function loadProjectPages(projectId: number, force = false): Promise<PageInfo[]> {
  const hit = cache.get(projectId)
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = loadPageInfos(documentApi, projectId, { comments: true }).then((r) => r.pages)
  value.catch(() => cache.delete(projectId))
  cache.set(projectId, { at: Date.now(), value })
  return value
}

/** WorkItemDto của một dự án (cache 30s). */
export function loadProjectWorkItems(projectId: number, force = false): Promise<WorkItemDto[]> {
  const hit = workCache.get(projectId)
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = workApi.workItems({ projectId })
  value.catch(() => workCache.delete(projectId))
  workCache.set(projectId, { at: Date.now(), value })
  return value
}

/** Gọi sau khi dữ liệu đổi (duyệt, xác nhận REQ…): các nơi đang hiển thị tự tải lại. */
export function invalidateProjectWork(projectId?: number) {
  if (projectId === undefined) {
    cache.clear()
    workCache.clear()
  } else {
    cache.delete(projectId)
    workCache.delete(projectId)
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Tải lại nếu dữ liệu đã cũ hơn `ms` (vd khi quay lại trang Việc của tôi sau khi duyệt / sửa). */
export function refreshProjectWorkIfOlder(projectId: number, ms = 5_000) {
  const hit = workCache.get(projectId)
  if (hit && Date.now() - hit.at > ms) invalidateProjectWork(projectId)
}

interface WorkState {
  dtos: Map<number, WorkItemDto[]>
  loading: boolean
  error: unknown
}

/** Việc của tôi trên nhiều dự án; mỗi dự án BE dùng vai trò của người dùng TRONG dự án đó. */
export function useWorkItems(projects: ProjectDto[] | null | undefined) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [state, setState] = useState<WorkState>({ dtos: new Map(), loading: true, error: null })
  const [tick, setTick] = useState(0)
  const key = (projects ?? [])
    .map((p) => `${p.projectId}:${p.myRole?.roleId ?? ''}:${p.myPermissions.length}`)
    .join(',')

  useEffect(() => {
    const on = () => setTick((n) => n + 1)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])

  useEffect(() => {
    if (!user || !projects) return
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    Promise.allSettled(projects.map((p) => loadProjectWorkItems(p.projectId))).then((results) => {
      if (!alive) return
      const dtos = new Map<number, WorkItemDto[]>()
      let error: unknown = null
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') dtos.set(projects[i].projectId, r.value)
        else error ??= r.reason
      })
      setState({ dtos, loading: false, error: dtos.size === 0 && projects.length > 0 ? error : null })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, key, tick])

  // Dựng dòng hiển thị ở bước render để đổi ngôn ngữ không phải tải lại.
  const byProject = useMemo(() => {
    const map = new Map<number, WorkItem[]>()
    for (const [id, list] of state.dtos) map.set(id, sortWork(list.map((d) => toWorkItem(d, t))))
    return map
  }, [state.dtos, t])

  const all = useMemo(() => sortWork([...byProject.values()].flat()), [byProject])

  return {
    byProject,
    items: all,
    loading: state.loading,
    error: state.error,
    reload: () => invalidateProjectWork(),
  }
}
