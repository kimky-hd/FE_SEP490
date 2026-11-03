import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AxiosAdapter } from 'axios'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api } from '@/lib/apiClient'
import { httpDocumentApi, type DocumentApi } from './documentApi'
import { httpIssueApi, type IssueApi } from './issueApi'
import { httpTestApi, type TestApi } from './testApi'
import { httpWorkApi, type WorkApi } from './workApi'
import { projectApi } from './projectApi'
import { permissionApi, roleApi } from './roleApi'
import { resolveMockFlags } from './mockFlags'
import { DIAGRAM_KINDS } from './mock/diagramGenerator'
import {
  DOC_TYPES,
  DOCUMENT_ACTIVITY_ACTIONS,
  DOCUMENT_KINDS,
  FRESHNESS,
  PRIORITIES,
  VERSION_STATUSES,
} from '@/types/document'
import { ISSUE_ACTIVITY_ACTIONS, ISSUE_PRIORITIES, ISSUE_TYPES, SPRINT_STATUSES } from '@/types/issue'
import { CYCLE_STATUSES, RUN_RESULTS, TEST_PRIORITIES, TEST_TYPES } from '@/types/testing'
import { WORK_KINDS } from '@/types/work'
import { ROLE_KINDS } from '@/types/rbac'

// Hợp đồng FE ↔ BE: doc/BE-Changes-2026-10-28_30-API.md là nguồn duy nhất. Test này đọc bảng §0.5 và khối JSON ở
// Phụ lục B rồi so với các API client HTTP của FE (gọi thật từng hàm qua một axios adapter ghi lại method + url).
// Sửa API client / tài liệu thì sửa cả bên kia, không thì test đỏ.

const docPath = resolve(process.cwd(), 'doc/BE-Changes-2026-10-28_30-API.md')
const hasDoc = existsSync(docPath)
const DOC = hasDoc ? readFileSync(docPath, 'utf-8') : ''

type Client = 'documentApi' | 'issueApi' | 'testApi' | 'workApi' | 'projectApi' | 'roleApi'
interface ContractEndpoint {
  id: string
  method: string
  path: string
  client: Client | null
}
interface Contract {
  version: string
  endpoints: ContractEndpoint[]
  enums: Record<string, string[]>
  errorCodes: string[]
}

function readContract(): Contract {
  if (!hasDoc) return { version: '', endpoints: [], enums: {}, errorCodes: [] }
  const m = /```json contract\r?\n([\s\S]*?)\r?\n```/.exec(DOC)
  if (!m) throw new Error('Thiếu khối ```json contract ở Phụ lục B của tài liệu API')
  return JSON.parse(m[1]) as Contract
}

/** Các dòng `| 12 | GET | \`/path\` | …` của bảng §0.5. */
function readSummaryTable(): { id: string; method: string; path: string }[] {
  const out: { id: string; method: string; path: string }[] = []
  for (const line of DOC.split(/\r?\n/)) {
    const m = /^\|\s*(\d+)\s*\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`/.exec(line)
    if (m) out.push({ id: m[1], method: m[2], path: m[3] })
  }
  return out
}

const contract = readContract()
const norm = (method: string, path: string) => `${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, '{}')}`
const normUrl = (method: string, url: string) =>
  `${method.toUpperCase()} ${url.split('?')[0].replace(/\/-?\d+(?=\/|$)/g, '/{}')}`
const docKeys = (pred: (e: ContractEndpoint) => boolean) =>
  new Set(contract.endpoints.filter(pred).map((e) => norm(e.method, e.path)))

// ---------- Ghi lại lời gọi HTTP ----------

let calls: string[] = []
const original = api.defaults.adapter
const recorder: AxiosAdapter = async (config) => {
  calls.push(normUrl(config.method ?? 'get', config.url ?? ''))
  return { data: { items: [] }, status: 200, statusText: 'OK', headers: {}, config }
}

beforeAll(() => {
  api.defaults.adapter = recorder
})
afterAll(() => {
  api.defaults.adapter = original
})

async function record(fns: Record<string, () => Promise<unknown>>): Promise<Map<string, string[]>> {
  const byFn = new Map<string, string[]>()
  for (const [name, fn] of Object.entries(fns)) {
    calls = []
    await fn()
    byFn.set(name, calls)
  }
  return byFn
}

// Mỗi hàm của client một lời gọi mẫu (TypeScript bắt buộc đủ hàm: thêm hàm mới vào client thì thêm vào đây).
type Calls<T> = { [K in keyof T]-?: () => Promise<unknown> }

const NOTES = { scope: '', actors: '', mainFlows: '', businessRules: '' }
const DOC_CALLS: Calls<Omit<DocumentApi, 'mock'>> = {
  listTree: () => httpDocumentApi.listTree(1),
  createNode: () => httpDocumentApi.createNode(1, { kind: 'FOLDER', title: 'x' }),
  updateNode: () => httpDocumentApi.updateNode(2, { title: 'y' }),
  deleteNode: () => httpDocumentApi.deleteNode(2),
  get: () => httpDocumentApi.get(2, 3),
  saveContent: () =>
    httpDocumentApi.saveContent(2, 3, { content: { type: 'doc', content: [] }, subtitle: null, rowVersion: 1 }),
  submit: () => httpDocumentApi.submit(2, 3),
  approve: () => httpDocumentApi.approve(2, 3),
  requestChanges: () => httpDocumentApi.requestChanges(2, 3, 'Sửa giúp'),
  createRevision: () => httpDocumentApi.createRevision(2),
  listRequirements: () => httpDocumentApi.listRequirements(2, 3),
  updateRequirement: () => httpDocumentApi.updateRequirement(4, { priority: 'HIGH' }),
  confirmFresh: () => httpDocumentApi.confirmFresh(4),
  listComments: () => httpDocumentApi.listComments(2, { versionId: 3 }),
  addComment: () => httpDocumentApi.addComment(2, { versionId: 3, body: 'x', parentId: 5, mentionUserIds: [7] }),
  resolveComment: () => httpDocumentApi.resolveComment(5),
  activity: () => httpDocumentApi.activity(2),
  normalize: () => httpDocumentApi.normalize(1, 'ghi chú'),
  extract: () => httpDocumentApi.extract(1, NOTES, 'ghi chú'),
  createFromNotes: () =>
    httpDocumentApi.createFromNotes(1, {
      title: 'x',
      docType: 'SRS',
      parentId: null,
      rawNotes: '',
      fields: NOTES,
      items: [],
    }),
  getGeneration: () => httpDocumentApi.getGeneration(2),
  generateDiagram: () => httpDocumentApi.generateDiagram(1, { text: 'a' }),
}

const ISSUE_CALLS: Calls<IssueApi> = {
  board: () => httpIssueApi.board(1),
  setWip: () => httpIssueApi.setWip(1, []),
  list: () => httpIssueApi.list(1, { sprintId: 'active' }),
  create: () => httpIssueApi.create(1, { type: 'TASK', title: 'x' }),
  get: () => httpIssueApi.get(9),
  update: () => httpIssueApi.update(9, { title: 'y' }),
  remove: () => httpIssueApi.remove(9),
  transition: () => httpIssueApi.transition(9, { toStatusId: 3 }),
  rank: () => httpIssueApi.rank(9, { afterIssueId: null }),
  fromRequirements: () => httpIssueApi.fromRequirements(1, { refs: [] }),
  setRequirements: () => httpIssueApi.setRequirements(9, []),
  ackRequirements: () => httpIssueApi.ackRequirements(9),
  comments: () => httpIssueApi.comments(9),
  addComment: () => httpIssueApi.addComment(9, { body: 'x', mentionUserIds: [] }),
  activity: () => httpIssueApi.activity(9),
  sprints: () => httpIssueApi.sprints(1),
  createSprint: () => httpIssueApi.createSprint(1, { name: 'S1' }),
  updateSprint: () => httpIssueApi.updateSprint(6, { status: 'ACTIVE' }),
  completeSprint: () => httpIssueApi.completeSprint(6, { moveOpenIssuesTo: 'BACKLOG' }),
  assignees: () => httpIssueApi.assignees(1),
}

const TEST_CALLS: Calls<TestApi> = {
  tree: () => httpTestApi.tree(1),
  createFolder: () => httpTestApi.createFolder(1, { name: 'x' }),
  list: () => httpTestApi.list(1, { needsReview: true }),
  create: () => httpTestApi.create(1, { title: 'x', type: 'FUNCTIONAL', priority: 'HIGH', steps: [] }),
  get: () => httpTestApi.get(8),
  update: () => httpTestApi.update(8, { needsReview: false }),
  remove: () => httpTestApi.remove(8),
  suggest: () => httpTestApi.suggest(1, []),
  cycles: () => httpTestApi.cycles(1, 'OPEN'),
  createCycle: () => httpTestApi.createCycle(1, { name: 'x', testCaseIds: [8] }),
  updateCycle: () => httpTestApi.updateCycle(5, { status: 'CLOSED' }),
  runs: () => httpTestApi.runs(5),
  updateRun: () => httpTestApi.updateRun(4, { assigneeId: null }),
  recordResult: () => httpTestApi.recordResult(4, { result: 'PASS' }),
}

const WORK_CALLS: Calls<WorkApi> = {
  workItems: () => httpWorkApi.workItems({ projectId: 1 }),
  documentWork: () => httpWorkApi.documentWork(null),
}

// API cũ (mục E) FE dùng cho các màn của đợt này.
const LEGACY_CALLS: Record<string, () => Promise<unknown>> = {
  'projectApi.listMine': () => projectApi.listMine(1),
  'projectApi.get': () => projectApi.get(1),
  'projectApi.listByWorkspace': () => projectApi.listByWorkspace(2),
  'projectApi.workflow': () => projectApi.workflow(1),
  'projectApi.savePhaseWorkflow': () =>
    projectApi.savePhaseWorkflow(1, 3, {} as Parameters<typeof projectApi.savePhaseWorkflow>[2]),
  'projectApi.listMembers': () => projectApi.listMembers(1),
  'roleApi.list': () => roleApi.list(1),
  'roleApi.get': () => roleApi.get(1, 2),
  'roleApi.create': () => roleApi.create(1, { name: 'x', scope: 'PROJECT', permissionKeys: [], kind: 'QA' }),
  'roleApi.update': () => roleApi.update(1, 2, { kind: 'QA' }),
  'permissionApi.list': () => permissionApi.list('PROJECT'),
}

const MODULE_CLIENTS: [Client, Record<string, () => Promise<unknown>>][] = [
  ['documentApi', DOC_CALLS],
  ['issueApi', ISSUE_CALLS],
  ['testApi', TEST_CALLS],
  ['workApi', WORK_CALLS],
]

describe.skipIf(!hasDoc)('Hợp đồng API (doc/BE-Changes-2026-10-28_30-API.md)', () => {
  it('tài liệu có header bản 1.1 và khối JSON cùng phiên bản', () => {
    expect(DOC).toMatch(/Bản 1\.1 – đã khớp FE/)
    expect(contract.version).toBe('1.1')
  })

  it('bảng §0.5 (#1–#58) khớp khối JSON Phụ lục B', () => {
    const table = readSummaryTable()
    expect(table.map((r) => r.id)).toEqual(Array.from({ length: 58 }, (_, i) => String(i + 1)))
    for (const row of table) {
      const e = contract.endpoints.find((x) => x.id === row.id)
      expect(e, `#${row.id} thiếu trong JSON`).toBeTruthy()
      expect(norm(e!.method, e!.path), `#${row.id}`).toBe(norm(row.method, row.path))
    }
  })

  it.each(MODULE_CLIENTS)(
    '%s: mọi lời gọi HTTP đều có trong tài liệu, mọi endpoint của module đều được gọi',
    async (client, fns) => {
      const byFn = await record(fns)
      const allowed = docKeys((e) => e.client === client || e.id.startsWith('E'))
      for (const [name, list] of byFn) {
        expect(list.length, `${client}.${name} không gọi HTTP`).toBeGreaterThan(0)
        for (const c of list) expect(allowed.has(c), `${client}.${name} gọi ${c} — không có trong tài liệu`).toBe(true)
      }
      const called = new Set([...byFn.values()].flat())
      for (const key of docKeys((e) => e.client === client))
        expect(called.has(key), `Tài liệu có ${key} (${client}) nhưng FE không gọi`).toBe(true)
    },
  )

  it('API cũ mục E: endpoint FE dùng có hàm gọi đúng method + path', async () => {
    const called = new Set([...(await record(LEGACY_CALLS)).values()].flat())
    const legacy = docKeys((e) => e.client === 'projectApi' || e.client === 'roleApi')
    expect(legacy.size).toBeGreaterThan(0)
    for (const key of legacy) expect(called.has(key), `${key} không có hàm FE`).toBe(true)
  })

  it('enum FE bằng đúng enum trong tài liệu', () => {
    const fe: Record<string, readonly string[]> = {
      DocumentKind: DOCUMENT_KINDS,
      DocType: DOC_TYPES,
      VersionStatus: VERSION_STATUSES,
      Priority: PRIORITIES,
      Freshness: FRESHNESS,
      DocumentActivityAction: DOCUMENT_ACTIVITY_ACTIONS,
      DiagramKind: DIAGRAM_KINDS,
      WorkKind: WORK_KINDS,
      RoleKind: ROLE_KINDS,
      IssueType: ISSUE_TYPES,
      IssuePriority: ISSUE_PRIORITIES,
      SprintStatus: SPRINT_STATUSES,
      IssueActivityAction: ISSUE_ACTIVITY_ACTIONS,
      TestType: TEST_TYPES,
      TestPriority: TEST_PRIORITIES,
      RunResult: RUN_RESULTS,
      CycleStatus: CYCLE_STATUSES,
    }
    expect(Object.keys(contract.enums).sort()).toEqual(Object.keys(fe).sort())
    for (const [name, values] of Object.entries(contract.enums))
      expect([...fe[name]].sort(), name).toEqual([...values].sort())
  })

  it('mọi mã lỗi mock FE dùng đều có trong §F / Phụ lục B', () => {
    const dir = resolve(process.cwd(), 'src/api/mock')
    const used = new Set<string>(['VALIDATION_ERROR'])
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
      const src = readFileSync(resolve(dir, f), 'utf-8')
      for (const m of src.matchAll(/fail\(\s*\d{3},\s*'([A-Z_]+)'/g)) used.add(m[1])
      for (const m of src.matchAll(/code:\s*'([A-Z_]+)'/g)) used.add(m[1])
    }
    expect(used.size).toBeGreaterThan(10)
    const missing = [...used].filter((c) => !contract.errorCodes.includes(c))
    expect(missing).toEqual([])
    // Mỗi mã trong Phụ lục B phải có trong tài liệu (bảng §F hoặc phần mã dùng lại).
    for (const code of contract.errorCodes) expect(DOC.split(`\`${code}\``).length, code).toBeGreaterThan(1)
  })
})

describe('Cờ mock theo module (src/api/mockFlags.ts)', () => {
  it('cờ riêng thắng cờ cũ; không đặt thì theo VITE_DOCUMENTS_MOCK', () => {
    expect(resolveMockFlags({})).toEqual({ documents: false, kanban: false, tests: false, work: false })
    expect(resolveMockFlags({ VITE_DOCUMENTS_MOCK: 'true' })).toEqual({
      documents: true,
      kanban: true,
      tests: true,
      work: true,
    })
    expect(
      resolveMockFlags({ VITE_DOCUMENTS_MOCK: 'true', VITE_MOCK_DOCUMENTS: 'false', VITE_MOCK_KANBAN: ' ' }),
    ).toEqual({ documents: false, kanban: true, tests: true, work: true })
    expect(resolveMockFlags({ VITE_MOCK_TESTS: 'true' })).toEqual({
      documents: false,
      kanban: false,
      tests: true,
      work: false,
    })
  })
})
