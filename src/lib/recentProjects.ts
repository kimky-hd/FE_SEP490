import { onDataChanged, registerCache } from '@/lib/dataEvents'
import { useEffect, useState } from 'react'
import { projectApi } from '@/api/projectApi'
import type { ProjectDto } from '@/types/project'

// "Dự án gần đây" trên sidebar: id các dự án người dùng mở gần nhất (localStorage, theo người dùng),
// bù bằng các dự án đang hoạt động của họ. Màu ô vuông lấy cố định theo id dự án.

const KEY = (userId: number) => `ssam.recentProjects.${userId}`
const EVENT = 'ssam:recent-projects'
const MAX_STORED = 10
export const RECENT_PROJECTS_SHOWN = 5

export function readRecentProjectIds(userId: number): number[] {
  try {
    const raw = window.localStorage.getItem(KEY(userId))
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is number => Number.isInteger(x)) : []
  } catch {
    return []
  }
}

export function rememberProject(userId: number, projectId: number) {
  const list = readRecentProjectIds(userId)
  if (list[0] === projectId) return
  const next = [projectId, ...list.filter((id) => id !== projectId)].slice(0, MAX_STORED)
  try {
    window.localStorage.setItem(KEY(userId), JSON.stringify(next))
  } catch {
    // Storage bị chặn: danh sách gần đây chỉ dựa vào dự án đang hoạt động.
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Sắp theo lần mở gần nhất, phần còn lại giữ thứ tự API trả về. */
export function orderRecent(projects: ProjectDto[], recentIds: number[], limit = RECENT_PROJECTS_SHOWN): ProjectDto[] {
  const byId = new Map(projects.map((p) => [p.projectId, p]))
  const picked = recentIds.map((id) => byId.get(id)).filter((p): p is ProjectDto => !!p)
  const rest = projects.filter((p) => !recentIds.includes(p.projectId))
  return [...picked, ...rest].slice(0, limit)
}

// Danh sách dự án cho sidebar: cache ngắn theo công ty để mỗi lần đổi trang không gọi lại API.
const TTL_MS = 60_000
const cache = new Map<string, { at: number; value: Promise<ProjectDto[]> }>()
registerCache(() => cache.clear())

function loadActiveProjects(companyId: number | null): Promise<ProjectDto[]> {
  const key = String(companyId ?? 'personal')
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = projectApi.listMine(companyId, { status: 'ACTIVE' })
  value.catch(() => cache.delete(key))
  cache.set(key, { at: Date.now(), value })
  return value
}

export function useRecentProjects(
  userId: number | null | undefined,
  companyId: number | null,
  limit = RECENT_PROJECTS_SHOWN,
): ProjectDto[] {
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [ids, setIds] = useState<number[]>(() => (userId ? readRecentProjectIds(userId) : []))
  // Tải lại khi dữ liệu đổi (vd vừa tạo / lưu trữ dự án).
  const [version, setVersion] = useState(0)
  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    loadActiveProjects(companyId)
      .then((list) => alive && setProjects(list))
      .catch(() => alive && setProjects([]))
    return () => {
      alive = false
    }
  }, [userId, companyId, version])

  useEffect(() => {
    if (!userId) return
    const sync = () => setIds(readRecentProjectIds(userId))
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [userId])

  return orderRecent(projects, ids, limit)
}

// Ô vuông màu của dự án: 6 sắc đủ tách nhau, chữ trắng đọc được trên mọi nền.
const PROJECT_COLORS = ['#2f5bea', '#f79009', '#12b76a', '#7a5af8', '#ee46bc', '#0e9384']

export function projectColor(projectId: number) {
  return PROJECT_COLORS[(((projectId - 1) % PROJECT_COLORS.length) + PROJECT_COLORS.length) % PROJECT_COLORS.length]
}

export const projectInitial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'
