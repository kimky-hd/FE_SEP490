import type { RetestFlagDto, RetestReason, TestCaseDto, TestResult } from '@/types/testing'
import { lastResultIn } from './status'

// Luật "cần test lại" theo môi trường (mockup testcases-combined.html, bước 3–4). Hàm thuần: trả về cờ cần đặt / việc
// cần làm; nơi gọi (mock / BE) lưu lại. Ba lý do:
//   BUG_FIXED   — deploy build mới lên môi trường, build có fix bug của case, và lần ghi gần nhất ở đó là FAIL.
//   REQ_CHANGED — REQ gắn với case đổi sau baseline: mọi môi trường case đã từng có kết quả.
//   REGRESSION  — người lập kế hoạch bấm "Regression" trên build hiện tại của một môi trường.
// Ghi kết quả ở môi trường nào thì xoá cờ của môi trường đó.

type CaseLike = Pick<TestCaseDto, 'testCaseId' | 'status' | 'results' | 'retest'> & {
  bug: { issueId: number; key: string } | null
}

const flag = (envId: number, reason: RetestReason, at: string, extra: Partial<RetestFlagDto> = {}): RetestFlagDto => ({
  envId,
  reason,
  bug: null,
  build: null,
  reqKey: null,
  at,
  ...extra,
})

/** Đặt (thay) cờ của một môi trường. Cờ cũ cùng môi trường bị thay — mỗi môi trường tối đa một lý do. */
export function withFlag(list: RetestFlagDto[], f: RetestFlagDto): RetestFlagDto[] {
  return [...list.filter((x) => x.envId !== f.envId), f]
}

export const withoutFlag = (list: RetestFlagDto[], envId: number) => list.filter((x) => x.envId !== envId)

/** Deploy build lên môi trường: case nào chuyển Retest (BUG_FIXED). */
export function bugFixedFlags(
  cases: CaseLike[],
  envId: number,
  build: string,
  fixedIssueIds: readonly number[],
  at: string,
): { testCaseId: number; flag: RetestFlagDto }[] {
  const fixed = new Set(fixedIssueIds)
  const out: { testCaseId: number; flag: RetestFlagDto }[] = []
  for (const tc of cases) {
    if (tc.status !== 'ACTIVE' || !tc.bug || !fixed.has(tc.bug.issueId)) continue
    if (lastResultIn(tc, envId)?.result !== 'FAIL') continue
    out.push({
      testCaseId: tc.testCaseId,
      flag: flag(envId, 'BUG_FIXED', at, { bug: { issueId: tc.bug.issueId, key: tc.bug.key }, build }),
    })
  }
  return out
}

/** REQ của case đổi: cờ cho mọi môi trường case đã có ít nhất một lần ghi (khác UNTEST). */
export function reqChangedFlags(tc: CaseLike, envIds: readonly number[], reqKey: string, at: string): RetestFlagDto[] {
  if (tc.status !== 'ACTIVE') return []
  return envIds
    .filter((e) => tc.results.some((r) => r.envId === e && r.result !== 'UNTEST'))
    .map((e) => flag(e, 'REQ_CHANGED', at, { reqKey }))
}

/** Regression trên build hiện tại: mọi case đang dùng (tuỳ chọn chỉ một số module). */
export function regressionFlags(
  cases: (CaseLike & { moduleId: number })[],
  envId: number,
  build: string | null,
  at: string,
  moduleIds?: readonly number[],
): { testCaseId: number; flag: RetestFlagDto }[] {
  return cases
    .filter((tc) => tc.status === 'ACTIVE' && (!moduleIds?.length || moduleIds.includes(tc.moduleId)))
    .map((tc) => ({ testCaseId: tc.testCaseId, flag: flag(envId, 'REGRESSION', at, { build }) }))
}

export interface RecordOutcome {
  /** FAIL mà case chưa gắn bug → mở hộp tạo / gắn bug trên Kanban. */
  needBug: boolean
  /** FAIL lại trên bug đã Done → mở lại bug. */
  reopenBug: boolean
  /** PASS trên bug đã Done → ghi nhận bug đã fix. */
  confirmFix: boolean
}

/** Hệ quả của một lần ghi kết quả (bug của case theo trạng thái Kanban). */
export function recordOutcome(
  result: TestResult,
  bug: { statusCategory: 'TODO' | 'IN_PROGRESS' | 'DONE' } | null,
): RecordOutcome {
  return {
    needBug: result === 'FAIL' && !bug,
    reopenBug: result === 'FAIL' && bug?.statusCategory === 'DONE',
    confirmFix: result === 'PASS' && bug?.statusCategory === 'DONE',
  }
}

/** Câu ngắn giải thích vì sao cần test lại (dưới chữ "Retest" trong ô Kết quả). */
export function retestWhy(f: RetestFlagDto, t: (vi: string, en: string) => string): string {
  if (f.reason === 'BUG_FIXED')
    return t(`${f.bug?.key ?? 'Bug'} đã fix ở ${f.build ?? '?'}`, `${f.bug?.key ?? 'Bug'} fixed in ${f.build ?? '?'}`)
  if (f.reason === 'REQ_CHANGED') return t(`${f.reqKey ?? 'REQ'} đổi`, `${f.reqKey ?? 'REQ'} changed`)
  return t('Regression', 'Regression')
}
