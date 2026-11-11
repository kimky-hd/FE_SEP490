import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { testApi } from '@/api/testApi'
import { apiErrorMessage } from '@/lib/apiErrors'
import { testAbilities, type TestAbilities } from '@/lib/testplan/abilities'
import { loadReqOptions, type ReqOption } from '../kanban/reqLinks'
import type { ProjectDto } from '@/types/project'
import type { TestCaseDto, TestPlanDto, TestPlanSummaryDto } from '@/types/testing'

// Trạng thái của trang Test cases: đợt test đang xem + toàn bộ testcase của đợt (kể cả đã Delete để còn khôi phục).
// Các thao tác ghi trả về DTO mới → vá thẳng vào danh sách (không tải lại cả bảng để không mất ô đang sửa).

export interface TestPlanState {
  plans: TestPlanSummaryDto[] | null
  plan: TestPlanDto | null
  cases: TestCaseDto[]
  loading: boolean
  error: string | null
  abilities: TestAbilities
  /** Tải lại danh sách đợt + đợt đang xem + testcase. */
  reload: () => Promise<void>
  /** Chỉ tải lại thông tin đợt (môi trường, module, phân công, bố cục). */
  reloadPlan: () => Promise<void>
  setPlan: (fn: (p: TestPlanDto) => TestPlanDto) => void
  /** Thay / thêm các case (theo testCaseId). */
  patchCases: (list: TestCaseDto[]) => void
}

export function useTestPlan(project: ProjectDto, planIdParam: number | null): TestPlanState {
  const projectId = project.projectId
  const [plans, setPlans] = useState<TestPlanSummaryDto[] | null>(null)
  const [plan, setPlanState] = useState<TestPlanDto | null>(null)
  const [cases, setCases] = useState<TestCaseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const planSeq = useRef(0)

  const reload = useCallback(async () => {
    const n = ++seq.current
    planSeq.current++
    setLoading(true)
    try {
      const list = await testApi.plans(projectId)
      const pick =
        list.find((p) => p.planId === planIdParam) ?? list.find((p) => p.status === 'OPEN') ?? list[0] ?? null
      const [detail, items] = pick
        ? await Promise.all([
            testApi.plan(pick.planId),
            testApi.list(projectId, { planId: pick.planId, includeDeleted: true }),
          ])
        : [null, [] as TestCaseDto[]]
      if (n !== seq.current) return
      setPlans(list)
      setPlanState(detail)
      setCases(items)
      setError(null)
    } catch (err) {
      if (n === seq.current) setError(apiErrorMessage(err))
    } finally {
      if (n === seq.current) setLoading(false)
    }
  }, [projectId, planIdParam])

  useEffect(() => {
    void reload()
  }, [reload])

  const reloadPlan = useCallback(async () => {
    if (!plan) return
    // Bỏ kết quả cũ nếu trong lúc chờ đã có lần tải khác (reload / reloadPlan) bắt đầu.
    const n = ++planSeq.current
    const next = await testApi.plan(plan.planId)
    if (n === planSeq.current) setPlanState(next)
  }, [plan])

  const patchCases = useCallback((list: TestCaseDto[]) => {
    if (!list.length) return
    setCases((prev) => {
      const map = new Map(list.map((c) => [c.testCaseId, c]))
      const out = prev.map((c) => map.get(c.testCaseId) ?? c)
      for (const c of list) if (!prev.some((x) => x.testCaseId === c.testCaseId)) out.push(c)
      return out
    })
  }, [])

  const setPlan = useCallback((fn: (p: TestPlanDto) => TestPlanDto) => setPlanState((p) => (p ? fn(p) : p)), [])

  const abilities = useMemo(
    () =>
      testAbilities({
        permissions: project.myPermissions,
        archived: project.status === 'ARCHIVED',
        handedOver: plan?.status === 'HANDED_OVER',
        aiEnabled: project.aiEnabled,
      }),
    [project.myPermissions, project.status, project.aiEnabled, plan?.status],
  )

  return { plans, plan, cases, loading, error, abilities, reload, reloadPlan, setPlan, patchCases }
}

/** REQ của dự án (bản hiện tại) theo khoá "documentId:reqUid" — anchor để mở tài liệu, tiêu đề, tiêu chí. */
export function useReqIndex(projectId: number, enabled = true) {
  const [list, setList] = useState<ReqOption[]>([])
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadReqOptions(projectId)
      .then((x) => alive && setList(x))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [projectId, enabled])
  const map = useMemo(() => new Map(list.map((r) => [`${r.documentId}:${r.reqUid}`, r])), [list])
  return { list, map }
}

export const reqKeyOf = (r: { documentId: number; reqUid: string }) => `${r.documentId}:${r.reqUid}`
