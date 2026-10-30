import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import clsx from 'clsx'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import type { ProjectDto } from '@/types/project'

export interface TestCaseItem {
  id: string
  code: string
  title: string
  reqCode: string
  reqTitle: string
  linkedIssueKey?: string
  type: 'INTEGRATION' | 'E2E' | 'SECURITY' | 'UNIT'
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'PASSED' | 'FAILED' | 'BLOCKED' | 'PENDING'
  testerName: string
  lastRun: string
}

const INITIAL_TEST_CASES: TestCaseItem[] = [
  {
    id: 'tc-1',
    code: 'TC-01-01',
    title: 'Verify OAuth2 JWT token signature & expiration rejection',
    reqCode: 'REQ-01',
    reqTitle: 'JWT Authentication & SSO Security',
    linkedIssueKey: 'CORE-101',
    type: 'SECURITY',
    priority: 'CRITICAL',
    status: 'PASSED',
    testerName: 'Phạm Minh Lương',
    lastRun: '2026-10-28 10:15',
  },
  {
    id: 'tc-2',
    code: 'TC-01-02',
    title: 'Brute force account lockout after 5 consecutive failed logins',
    reqCode: 'REQ-01',
    reqTitle: 'Account Lockout Policy',
    linkedIssueKey: 'CORE-101',
    type: 'SECURITY',
    priority: 'HIGH',
    status: 'PASSED',
    testerName: 'Phạm Minh Lương',
    lastRun: '2026-10-28 11:20',
  },
  {
    id: 'tc-3',
    code: 'TC-02-01',
    title: 'VietQR dynamic QR payload checksum verification',
    reqCode: 'REQ-02',
    reqTitle: 'Core Banking VietQR 247 Gateway',
    linkedIssueKey: 'CORE-103',
    type: 'INTEGRATION',
    priority: 'CRITICAL',
    status: 'PASSED',
    testerName: 'Vũ Kim Kỳ',
    lastRun: '2026-10-28 14:00',
  },
  {
    id: 'tc-4',
    code: 'TC-02-02',
    title: 'Idempotent webhook retry rejection on duplicate transaction ID',
    reqCode: 'REQ-02',
    reqTitle: 'Bank Webhook Idempotency Policy',
    linkedIssueKey: 'CORE-104',
    type: 'INTEGRATION',
    priority: 'CRITICAL',
    status: 'FAILED',
    testerName: 'Vũ Thị Mai',
    lastRun: '2026-10-28 14:45',
  },
  {
    id: 'tc-5',
    code: 'TC-03-01',
    title: 'Live parser extraction of REQ blocks from markdown headings',
    reqCode: 'REQ-03',
    reqTitle: 'Live Document Parser & Gutter Badges',
    linkedIssueKey: 'CORE-102',
    type: 'E2E',
    priority: 'HIGH',
    status: 'PASSED',
    testerName: 'Phạm Văn Khoa',
    lastRun: '2026-10-27 16:30',
  },
  {
    id: 'tc-6',
    code: 'TC-03-02',
    title: 'Safe Mode baseline lock prevents unapproved edits',
    reqCode: 'REQ-03',
    reqTitle: 'Document Safe Mode & Baseline Control',
    linkedIssueKey: 'CORE-102',
    type: 'E2E',
    priority: 'HIGH',
    status: 'PASSED',
    testerName: 'Phạm Văn Khoa',
    lastRun: '2026-10-27 17:15',
  },
  {
    id: 'tc-7',
    code: 'TC-04-01',
    title: 'RTM bidirectional link sync between Project Issues and REQ items',
    reqCode: 'REQ-04',
    reqTitle: 'Bidirectional RTM Traceability Sync',
    linkedIssueKey: 'CORE-105',
    type: 'INTEGRATION',
    priority: 'HIGH',
    status: 'PENDING',
    testerName: 'Sarah Lin',
    lastRun: '—',
  },
  {
    id: 'tc-8',
    code: 'TC-04-02',
    title: 'Unconfirmed stale badge trigger when document spec is edited',
    reqCode: 'REQ-04',
    reqTitle: 'Stale Audit Flag Notification',
    linkedIssueKey: 'CORE-104',
    type: 'INTEGRATION',
    priority: 'CRITICAL',
    status: 'BLOCKED',
    testerName: 'Sarah Lin',
    lastRun: '2026-10-28 09:30',
  },
]

export function ProjectTestCasesPage() {
  const params = useParams()
  const projectId = Number(params.projectId || 1)

  const projectAsync = useAsync(() => projectApi.get(projectId), [projectId])
  const project = projectAsync.data || ({
    projectId,
    key: 'CORE',
    name: 'SSAM Core Platform',
    status: 'ACTIVE',
  } as ProjectDto)

  const [testCases, setTestCases] = useState<TestCaseItem[]>(() => {
    const saved = localStorage.getItem(`ssam.testcases.${projectId}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return INITIAL_TEST_CASES
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | TestCaseItem['status']>('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | TestCaseItem['type']>('ALL')

  const saveCases = (updated: TestCaseItem[]) => {
    setTestCases(updated)
    localStorage.setItem(`ssam.testcases.${projectId}`, JSON.stringify(updated))
  }

  const toggleStatus = (id: string) => {
    const nextStatus: Record<TestCaseItem['status'], TestCaseItem['status']> = {
      PASSED: 'FAILED',
      FAILED: 'BLOCKED',
      BLOCKED: 'PENDING',
      PENDING: 'PASSED',
    }
    const updated = testCases.map((tc) =>
      tc.id === id
        ? {
            ...tc,
            status: nextStatus[tc.status],
            lastRun: new Date().toISOString().replace('T', ' ').slice(0, 16),
          }
        : tc,
    )
    saveCases(updated)
  }

  const filteredCases = useMemo(() => {
    return testCases.filter((tc) => {
      if (statusFilter !== 'ALL' && tc.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && tc.type !== typeFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchCode = tc.code.toLowerCase().includes(q)
        const matchTitle = tc.title.toLowerCase().includes(q)
        const matchReq = tc.reqCode.toLowerCase().includes(q)
        const matchIssue = (tc.linkedIssueKey || '').toLowerCase().includes(q)
        if (!matchCode && !matchTitle && !matchReq && !matchIssue) return false
      }
      return true
    })
  }, [testCases, statusFilter, typeFilter, search])

  const total = testCases.length
  const passed = testCases.filter((tc) => tc.status === 'PASSED').length
  const failed = testCases.filter((tc) => tc.status === 'FAILED').length
  const blocked = testCases.filter((tc) => tc.status === 'BLOCKED').length
  const pending = testCases.filter((tc) => tc.status === 'PENDING').length
  const mappedReqs = testCases.filter((tc) => tc.reqCode).length
  const coveragePercent = Math.round((mappedReqs / total) * 100)

  return (
    <div className="flex flex-1 min-h-0 w-full bg-slate-50 flex-col overflow-hidden text-slate-800">
      {/* ROW 2: TEST CASES & RTM CONTEXTUAL SUB-TOOLBAR (44PX) */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-800 shrink-0">
            🧪 RTM Matrix [{project.key}]
          </span>

          {/* Status selector */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold shrink-0">
            {(['ALL', 'PASSED', 'FAILED', 'BLOCKED', 'PENDING'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  'rounded-md px-2.5 py-0.5 transition-all whitespace-nowrap',
                  statusFilter === s
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Type selector */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="hidden sm:block rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="ALL">All Test Types</option>
            <option value="SECURITY">Security</option>
            <option value="INTEGRATION">Integration</option>
            <option value="E2E">End-to-End</option>
            <option value="UNIT">Unit</option>
          </select>
        </div>

        <div className="relative w-44 sm:w-64 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, title, REQ, Issue..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-blue-500"
          />
          <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
        </div>
      </div>

      {/* SCROLLABLE VIEWPORT: KPI SUMMARY + RTM TRACEABILITY TABLE */}
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Test Cases</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{total}</p>
            <p className="text-[11px] text-slate-500">{coveragePercent}% RTM requirement coverage</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Passed</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{passed}</p>
            <p className="text-[11px] text-emerald-600">{Math.round((passed / total) * 100)}% pass rate</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Failed / Blocked</p>
            <p className="mt-1 text-2xl font-black text-rose-700">{failed + blocked}</p>
            <p className="text-[11px] text-rose-600">{failed} Failed · {blocked} Blocked</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending Execution</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{pending}</p>
            <p className="text-[11px] text-amber-600">Awaiting test verification</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Test Code</th>
                <th className="py-3 px-4">Test Scenario & Verification</th>
                <th className="py-3 px-4">Traceability [REQ-xx]</th>
                <th className="py-3 px-4">Linked Issue</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status (Click to toggle)</th>
                <th className="py-3 px-4">Tester</th>
                <th className="py-3 px-4">Last Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCases.map((tc) => (
                <tr key={tc.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-extrabold text-blue-700">
                    {tc.code}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">{tc.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{tc.reqTitle}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <Link
                      to={`/projects/${projectId}/documents`}
                      className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      title="View in Document Workspace"
                    >
                      <span>📄</span>
                      <span>[{tc.reqCode}]</span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    {tc.linkedIssueKey ? (
                      <Link
                        to={`/projects/${projectId}/issues?issueId=${tc.linkedIssueKey}`}
                        className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-800 hover:bg-blue-100 transition-colors"
                        title="View in Issues Workspace"
                      >
                        <span>📋</span>
                        <span>{tc.linkedIssueKey}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {tc.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => toggleStatus(tc.id)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-2xs transition-all hover:scale-105 cursor-pointer',
                        tc.status === 'PASSED' && 'bg-emerald-100 text-emerald-900 border border-emerald-300',
                        tc.status === 'FAILED' && 'bg-rose-100 text-rose-900 border border-rose-300',
                        tc.status === 'BLOCKED' && 'bg-slate-200 text-slate-800 border border-slate-300',
                        tc.status === 'PENDING' && 'bg-amber-100 text-amber-900 border border-amber-300',
                      )}
                      title="Click to cycle status"
                    >
                      <span>
                        {tc.status === 'PASSED' && '✓'}
                        {tc.status === 'FAILED' && '✕'}
                        {tc.status === 'BLOCKED' && '⊘'}
                        {tc.status === 'PENDING' && '⏳'}
                      </span>
                      <span>{tc.status}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-semibold">{tc.testerName}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{tc.lastRun}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
