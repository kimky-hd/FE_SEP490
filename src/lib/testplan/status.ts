import type { RetestFlagDto, TestCaseDto, TestResult, TestResultDto, TestStatus, TraceStatus } from '@/types/testing'

// Trạng thái testcase theo môi trường (mockup testcases-combined.html: "status(t)"): đang có cờ test lại → RETEST,
// không thì kết quả lần ghi mới nhất ở môi trường đó, chưa ghi → UNTEST. Hàm thuần — dùng chung cho UI và mock.

type CaseLike = Pick<TestCaseDto, 'results' | 'retest' | 'status'>

/** Lần ghi mới nhất của case ở một môi trường (results đã sắp cũ → mới). */
export function lastResultIn(tc: Pick<TestCaseDto, 'results'>, envId: number): TestResultDto | null {
  for (let i = tc.results.length - 1; i >= 0; i--) if (tc.results[i].envId === envId) return tc.results[i]
  return null
}

export function retestIn(tc: Pick<TestCaseDto, 'retest'>, envId: number): RetestFlagDto | null {
  return tc.retest.find((r) => r.envId === envId) ?? null
}

export function statusIn(tc: Pick<TestCaseDto, 'results' | 'retest'>, envId: number): TestStatus {
  if (retestIn(tc, envId)) return 'RETEST'
  return lastResultIn(tc, envId)?.result ?? 'UNTEST'
}

/** Case "đã có kết quả" ở môi trường: có lần ghi khác UNTEST và không cần test lại. */
export const hasResultIn = (tc: Pick<TestCaseDto, 'results' | 'retest'>, envId: number) => {
  const s = statusIn(tc, envId)
  return s === 'PASS' || s === 'FAIL' || s === 'NA'
}

export interface TestStats {
  /** Case đang dùng (không tính DELETED). */
  total: number
  PASS: number
  FAIL: number
  NA: number
  UNTEST: number
  RETEST: number
  DELETED: number
  /** (Pass + Fail + N/A) / tổng. */
  cover: number
  /** Pass / tổng. */
  pass: number
}

export function statsIn(list: CaseLike[], envId: number): TestStats {
  const s: TestStats = { total: 0, PASS: 0, FAIL: 0, NA: 0, UNTEST: 0, RETEST: 0, DELETED: 0, cover: 0, pass: 0 }
  for (const tc of list) {
    if (tc.status === 'DELETED') {
      s.DELETED++
      continue
    }
    s.total++
    s[statusIn(tc, envId)]++
  }
  s.cover = s.total ? (s.PASS + s.FAIL + s.NA) / s.total : 0
  s.pass = s.total ? s.PASS / s.total : 0
  return s
}

/** "62.5%" / "100%". */
export const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`

/** Tình trạng một REQ theo các case gắn REQ đó (một trạng thái duy nhất, ưu tiên lỗi). */
export function traceStatusOf(statuses: TestStatus[]): TraceStatus {
  if (!statuses.length) return 'NO_TESTS'
  if (statuses.includes('FAIL')) return 'FAILING'
  if (statuses.some((s) => s === 'UNTEST' || s === 'RETEST')) return 'IN_PROGRESS'
  return 'PASSED'
}

/** Kết quả hợp lệ để ghi. */
export const isTestResult = (v: unknown): v is TestResult =>
  v === 'PASS' || v === 'FAIL' || v === 'NA' || v === 'UNTEST'
