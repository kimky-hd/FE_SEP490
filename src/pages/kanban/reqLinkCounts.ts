import { useEffect, useState } from 'react'
import { issueApi } from '@/api/issueApi'
import { testApi } from '@/api/testApi'
import { onDataChanged } from '@/lib/dataEvents'
import { FEATURES } from '@/lib/features'

export type ReqLinkCounts = Map<string, { issues: number; tests: number }>

/** Số issue / testcase gắn với từng REQ (theo reqUid) của một trang — cho bảng REQ bên phải trang tài liệu. */
export function useReqLinkCounts(
  projectId: number | undefined,
  documentId: number,
  enabled = true,
): ReqLinkCounts | null {
  const [counts, setCounts] = useState<ReqLinkCounts | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => onDataChanged(() => setTick((n) => n + 1)), [])
  useEffect(() => {
    if (!enabled || !projectId || (!FEATURES.kanban && !FEATURES.testcases)) return
    let alive = true
    Promise.all([
      FEATURES.kanban ? issueApi.list(projectId).catch(() => []) : [],
      FEATURES.testcases ? testApi.list(projectId, { documentId }).catch(() => []) : [],
    ]).then(([issues, tests]) => {
      if (!alive) return
      const map: ReqLinkCounts = new Map()
      const bump = (uid: string, k: 'issues' | 'tests') => {
        const cur = map.get(uid) ?? { issues: 0, tests: 0 }
        cur[k] += 1
        map.set(uid, cur)
      }
      for (const i of issues) for (const r of i.requirements) if (r.documentId === documentId) bump(r.reqUid, 'issues')
      // Testcase của đợt test hiện tại (Test cases v2, #47 mặc định lấy đợt đang mở).
      for (const tc of tests) for (const r of tc.requirements) if (r.documentId === documentId) bump(r.reqUid, 'tests')
      setCounts(map)
    })
    return () => {
      alive = false
    }
  }, [projectId, documentId, tick, enabled])
  return counts
}
