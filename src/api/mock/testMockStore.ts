// Backend giả trong trình duyệt cho Test cases (doc/BE-Changes-2026-10-28_30-API.md §D), lưu ở localStorage
// `ssam.mock.tests.v1`. Bật bằng VITE_MOCK_TESTS=true. Issue (bug từ lượt FAIL, key issue) qua IssueMockStore;
// REQ tra trong mock tài liệu hoặc API Tài liệu thật.

import { tr } from '@/i18n'
import { PERMISSIONS } from '@/types/rbac'
import { hasWorkPermission } from '@/lib/workPermissions'
import type { IssuePriority, RequirementRef, UserRef } from '@/types/issue'
import type {
  CreateCycleBody,
  CreateTestCaseBody,
  CycleStatus,
  RecordResultBody,
  RunQuery,
  RunResult,
  SuggestedTestCase,
  TestCaseDetailDto,
  TestCaseQuery,
  TestCaseSummaryDto,
  TestCycleDto,
  TestPriority,
  TestRunDto,
  TestStep,
  TestTreeNodeDto,
  TestType,
  UpdateTestCaseBody,
} from '@/types/testing'
import { TEST_PRIORITIES, TEST_TYPES } from '@/types/testing'
import type { DocReqIndex } from './documentMockStore'
import { AUTH_REQ, PAY_REQ } from './documentSeed'
import type { IssueMockStore, LinkedTest } from './issueMockStore'
import {
  clone,
  DEMO_PEOPLE,
  fail,
  findReq,
  has,
  loadJson,
  newLinks,
  reqRefDto,
  resolveEnv,
  saveJson,
  sleep,
  syncLink,
  validationError,
  type LinkRec,
  type ResolvedEnv,
  type WorkMockEnv,
} from './workMockBase'

export const TEST_STORAGE_KEY = 'ssam.mock.tests.v1'

interface FolderRec {
  folderId: number
  projectId: number
  parentId: number | null
  name: string
  sortOrder: number
}

interface TestCaseRec {
  testCaseId: number
  projectId: number
  key: string
  title: string
  type: TestType
  priority: TestPriority
  preconditions: string | null
  steps: TestStep[]
  folderId: number | null
  links: LinkRec[]
  issueIds: number[]
  needsReview: boolean
  lastResult: RunResult | null
  lastRunAt: string | null
  lastRunBy: UserRef | null
  createdBy: UserRef
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

interface CycleRec {
  cycleId: number
  projectId: number
  name: string
  sprintId: number | null
  status: CycleStatus
  createdBy: UserRef
  createdAt: string
}

interface RunRec {
  runId: number
  cycleId: number
  testCaseId: number
  assignee: UserRef | null
  result: RunResult
  note: string | null
  executedAt: string | null
  executedBy: UserRef | null
  defectIssueIds: number[]
  needsRerun: boolean
}

interface HistoryRec {
  id: number
  runId: number
  testCaseId: number
  result: RunResult
  note: string | null
  executedBy: UserRef
  executedAt: string
  defectIssueIds: number[]
}

interface TestDb {
  seq: number
  keySeq: Record<string, number>
  folders: FolderRec[]
  testcases: TestCaseRec[]
  cycles: CycleRec[]
  runs: RunRec[]
  history: HistoryRec[]
  seeded: number[]
}

const emptyDb = (): TestDb => ({
  seq: 8000,
  keySeq: {},
  folders: [],
  testcases: [],
  cycles: [],
  runs: [],
  history: [],
  seeded: [],
})

interface Ctx {
  projectId: number
  me: UserRef
  permissions: string[]
  archived: boolean
  aiEnabled: boolean
  index: DocReqIndex[]
}

const norm = (s: string) => s.toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim()

export class TestMockStore {
  private db: TestDb | null = null
  private readonly env: ResolvedEnv

  constructor(
    env: WorkMockEnv,
    private readonly issues: IssueMockStore,
  ) {
    this.env = resolveEnv(env)
    issues.attachTests((projectId) => this.linkedTests(projectId))
  }

  // ---------- Hạ tầng ----------

  private load(): TestDb {
    this.db ??= loadJson(this.env.storage, TEST_STORAGE_KEY, emptyDb)
    return this.db
  }

  private persist() {
    saveJson(this.env.storage, TEST_STORAGE_KEY, this.db)
  }

  private nextId() {
    return ++this.load().seq
  }

  private iso(offsetMs = 0) {
    return new Date(this.env.now().getTime() + offsetMs).toISOString()
  }

  private async ctx(projectId: number, permission: string, write = false): Promise<Ctx> {
    await sleep(this.env.latency())
    const acc = await this.env.projectAccess(projectId)
    if (!hasWorkPermission(acc.permissions, permission))
      fail(403, 'FORBIDDEN', tr('Bạn không có quyền thực hiện thao tác này.', "You don't have permission to do this."))
    if (write && acc.archived)
      fail(
        409,
        'PROJECT_ARCHIVED',
        tr('Dự án đã được lưu trữ, dữ liệu chỉ đọc.', 'The project is archived; data is read-only.'),
      )
    const me = await this.env.actor()
    const index = await this.env.reqs(projectId)
    if (this.syncReqChanges(projectId, index)) this.persist()
    return { projectId, me, permissions: acc.permissions, archived: acc.archived, aiEnabled: acc.aiEnabled, index }
  }

  /** §3: REQ liên kết đổi → testcase.needsReview; lượt đã chạy trong đợt OPEN → needsRerun (giữ kết quả cũ). */
  syncReqChanges(projectId: number, index: DocReqIndex[]): boolean {
    let changed = false
    const db = this.load()
    for (const tc of db.testcases.filter((x) => x.projectId === projectId && !x.isDeleted)) {
      let hit = false
      for (const link of tc.links) if (syncLink(index, link)) hit = true
      if (!hit) continue
      changed = true
      tc.needsReview = true
      this.markRerun(tc.testCaseId)
    }
    return changed
  }

  private markRerun(testCaseId: number) {
    const db = this.load()
    const open = new Set(db.cycles.filter((c) => c.status === 'OPEN').map((c) => c.cycleId))
    for (const r of db.runs.filter((x) => x.testCaseId === testCaseId && open.has(x.cycleId) && x.result !== 'NOT_RUN'))
      r.needsRerun = true
  }

  private testcase(testCaseId: number): TestCaseRec {
    const t = this.load().testcases.find((x) => x.testCaseId === testCaseId && !x.isDeleted)
    return t ?? fail(404, 'TESTCASE_NOT_FOUND', tr('Không tìm thấy testcase.', 'Test case not found.'))
  }

  private cycle(cycleId: number): CycleRec {
    const c = this.load().cycles.find((x) => x.cycleId === cycleId)
    return c ?? fail(404, 'CYCLE_NOT_FOUND', tr('Không tìm thấy đợt chạy.', 'Test cycle not found.'))
  }

  private run(runId: number): RunRec {
    const r = this.load().runs.find((x) => x.runId === runId)
    return r ?? fail(404, 'RUN_NOT_FOUND', tr('Không tìm thấy lượt chạy.', 'Test run not found.'))
  }

  private projectCases(projectId: number) {
    return this.load()
      .testcases.filter((t) => t.projectId === projectId && !t.isDeleted)
      .sort((a, b) => a.testCaseId - b.testCaseId)
  }

  /** Cho IssueMockStore: testcase gắn với từng issue (theo LastResult). */
  linkedTests(projectId: number): Map<number, LinkedTest[]> {
    const map = new Map<number, LinkedTest[]>()
    for (const t of this.projectCases(projectId)) {
      for (const id of t.issueIds) {
        const list = map.get(id) ?? []
        list.push({ testCaseId: t.testCaseId, key: t.key, title: t.title, lastResult: t.lastResult })
        map.set(id, list)
      }
    }
    return map
  }

  // ---------- DTO ----------

  private summary(ctx: Ctx, t: TestCaseRec): TestCaseSummaryDto {
    return {
      testCaseId: t.testCaseId,
      key: t.key,
      title: t.title,
      type: t.type,
      priority: t.priority,
      folderId: t.folderId,
      requirements: t.links.map((l) => reqRefDto(ctx.index, l, t.needsReview)),
      issues: this.issues.refs(ctx.projectId, t.issueIds).map(({ issueId, key }) => ({ issueId, key })),
      stepCount: t.steps.length,
      needsReview: t.needsReview,
      lastResult: t.lastResult,
      lastRunAt: t.lastRunAt,
      lastRunBy: t.lastRunBy ? { ...t.lastRunBy } : null,
      updatedAt: t.updatedAt,
    }
  }

  private detail(ctx: Ctx, t: TestCaseRec): TestCaseDetailDto {
    const db = this.load()
    const w = !ctx.archived
    const history = db.history
      .filter((h) => h.testCaseId === t.testCaseId)
      .sort((a, b) => b.executedAt.localeCompare(a.executedAt) || b.id - a.id)
      .map((h) => {
        const run = db.runs.find((r) => r.runId === h.runId)
        return {
          runId: h.runId,
          cycleName: run ? (db.cycles.find((c) => c.cycleId === run.cycleId)?.name ?? '') : '',
          result: h.result,
          note: h.note,
          executedBy: { ...h.executedBy },
          executedAt: h.executedAt,
          defects: this.issues.refs(ctx.projectId, h.defectIssueIds).map(({ issueId, key }) => ({ issueId, key })),
        }
      })
    return {
      ...this.summary(ctx, t),
      preconditions: t.preconditions,
      steps: clone(t.steps),
      history,
      can: {
        edit: w && has(ctx.permissions, PERMISSIONS.testCaseManage),
        delete: w && has(ctx.permissions, PERMISSIONS.testCaseManage),
        execute: w && hasWorkPermission(ctx.permissions, PERMISSIONS.testCaseExecute),
      },
    }
  }

  private cycleDto(c: CycleRec): TestCycleDto {
    const live = new Set(
      this.load()
        .testcases.filter((t) => !t.isDeleted)
        .map((t) => t.testCaseId),
    )
    const runs = this.load().runs.filter((r) => r.cycleId === c.cycleId && live.has(r.testCaseId))
    const count = (r: RunResult) => runs.filter((x) => x.result === r).length
    return {
      cycleId: c.cycleId,
      name: c.name,
      sprintId: c.sprintId,
      status: c.status,
      counts: { pass: count('PASS'), fail: count('FAIL'), blocked: count('BLOCKED'), notRun: count('NOT_RUN') },
      createdAt: c.createdAt,
    }
  }

  private runDto(ctx: Ctx, r: RunRec): TestRunDto {
    return {
      runId: r.runId,
      cycleId: r.cycleId,
      testCase: this.summary(
        ctx,
        this.load().testcases.find((t) => t.testCaseId === r.testCaseId)!,
      ),
      assignee: r.assignee ? { ...r.assignee } : null,
      result: r.result,
      note: r.note,
      executedAt: r.executedAt,
      executedBy: r.executedBy ? { ...r.executedBy } : null,
      defects: this.issues.refs(ctx.projectId, r.defectIssueIds),
      needsRerun: r.needsRerun,
    }
  }

  // ---------- 5.1 Cây ----------

  async tree(projectId: number): Promise<{ items: TestTreeNodeDto[] }> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseView)
    const cases = this.projectCases(projectId)
    const items: TestTreeNodeDto[] = []
    const linked = (documentId: number, reqUid: string) =>
      cases.filter((t) => t.links.some((l) => l.documentId === documentId && l.reqUid === reqUid))
    for (const doc of ctx.index) {
      // REQ của bản baseline, cộng REQ mới ở bản đang mở (chưa duyệt) để testcase gắn REQ mới vẫn có chỗ.
      const reqs = [...doc.baseline, ...doc.current.filter((r) => !doc.baseline.some((b) => b.reqUid === r.reqUid))]
      if (!reqs.length) continue
      const docCases = cases.filter((t) => t.links.some((l) => l.documentId === doc.documentId))
      const docId = `doc-${doc.documentId}`
      items.push({
        id: docId,
        kind: 'DOCUMENT',
        parentId: null,
        label: `${doc.code} · ${doc.title}`,
        requirement: null,
        testCount: docCases.length,
        needsReviewCount: docCases.filter((t) => t.needsReview).length,
      })
      for (const r of [...reqs].sort((a, b) => a.reqKey.localeCompare(b.reqKey, undefined, { numeric: true }))) {
        const list = linked(doc.documentId, r.reqUid)
        const flagged = list
          .find((t) => t.needsReview)
          ?.links.find((l) => l.documentId === doc.documentId && l.reqUid === r.reqUid)
        items.push({
          id: `req-${doc.documentId}-${r.reqUid}`,
          kind: 'REQUIREMENT',
          parentId: docId,
          label: `${r.reqKey} · ${r.title}`,
          requirement: reqRefDto(
            ctx.index,
            flagged ?? { documentId: doc.documentId, reqUid: r.reqUid, hash: null, changedLabel: null },
            !!flagged,
          ),
          testCount: list.length,
          needsReviewCount: list.filter((t) => t.needsReview).length,
        })
      }
    }
    for (const f of this.load()
      .folders.filter((x) => x.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.folderId - b.folderId)) {
      const list = cases.filter((t) => t.folderId === f.folderId)
      items.push({
        id: `folder-${f.folderId}`,
        kind: 'FOLDER',
        parentId: f.parentId ? `folder-${f.parentId}` : null,
        label: f.name,
        requirement: null,
        testCount: list.length,
        needsReviewCount: list.filter((t) => t.needsReview).length,
      })
    }
    const unlinked = cases.filter((t) => t.links.length === 0)
    items.push({
      id: 'unlinked',
      kind: 'UNLINKED',
      parentId: null,
      label: tr('Chưa gắn REQ', 'Not linked to a REQ'),
      requirement: null,
      testCount: unlinked.length,
      needsReviewCount: unlinked.filter((t) => t.needsReview).length,
    })
    return { items }
  }

  async createFolder(
    projectId: number,
    body: { name: string; parentId?: number | null },
  ): Promise<{ folderId: number; name: string; parentId: number | null }> {
    await this.ctx(projectId, PERMISSIONS.testCaseManage, true)
    const name = body.name?.trim()
    if (!name || name.length > 100)
      validationError({ name: [tr('Tên thư mục 1–100 ký tự.', 'Folder name must be 1–100 characters.')] })
    const parentId = body.parentId ?? null
    if (parentId !== null && !this.load().folders.some((f) => f.folderId === parentId && f.projectId === projectId))
      validationError({ parentId: [tr('Thư mục cha không hợp lệ.', 'Invalid parent folder.')] })
    const f: FolderRec = {
      folderId: this.nextId(),
      projectId,
      parentId,
      name: name!,
      sortOrder: this.load().folders.filter((x) => x.projectId === projectId).length,
    }
    this.load().folders.push(f)
    this.persist()
    return { folderId: f.folderId, name: f.name, parentId }
  }

  // ---------- 5.2 Testcase ----------

  async listTestCases(projectId: number, q: TestCaseQuery = {}): Promise<{ items: TestCaseSummaryDto[] }> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseView)
    let list = this.projectCases(projectId)
    if (q.reqUid)
      list = list.filter((t) =>
        t.links.some(
          (l) => l.reqUid === q.reqUid && (q.documentId === undefined || l.documentId === Number(q.documentId)),
        ),
      )
    else if (q.documentId !== undefined)
      list = list.filter((t) => t.links.some((l) => l.documentId === Number(q.documentId)))
    if (q.folderId !== undefined) list = list.filter((t) => t.folderId === Number(q.folderId))
    if (q.unlinked) list = list.filter((t) => t.links.length === 0)
    if (q.needsReview) list = list.filter((t) => t.needsReview)
    if (q.lastResult) list = list.filter((t) => (t.lastResult ?? 'NOT_RUN') === q.lastResult)
    if (q.issueId !== undefined) list = list.filter((t) => t.issueIds.includes(Number(q.issueId)))
    const needle = q.search?.trim().toLocaleLowerCase('vi')
    if (needle)
      list = list.filter(
        (t) => t.key.toLocaleLowerCase('vi').includes(needle) || t.title.toLocaleLowerCase('vi').includes(needle),
      )
    return { items: list.map((t) => this.summary(ctx, t)) }
  }

  async getTestCase(testCaseId: number): Promise<TestCaseDetailDto> {
    const ctx = await this.ctx(this.testcase(testCaseId).projectId, PERMISSIONS.testCaseView)
    return this.detail(ctx, this.testcase(testCaseId))
  }

  private cleanSteps(steps: TestStep[] | undefined): TestStep[] {
    return (steps ?? [])
      .map((s) => ({ action: String(s?.action ?? '').trim(), expected: String(s?.expected ?? '').trim() }))
      .filter((s) => s.action || s.expected)
  }

  private validate(ctx: Ctx, body: Partial<CreateTestCaseBody>, creating: boolean) {
    const errors: Record<string, string[]> = {}
    const title = body.title?.trim()
    if ((creating || body.title !== undefined) && (!title || title.length > 300))
      errors.title = [tr('Tiêu đề bắt buộc, tối đa 300 ký tự.', 'Title is required, max 300 characters.')]
    if ((creating || body.type !== undefined) && !TEST_TYPES.includes(body.type as TestType))
      errors.type = [tr('Loại test không hợp lệ.', 'Invalid test type.')]
    if ((creating || body.priority !== undefined) && !TEST_PRIORITIES.includes(body.priority as TestPriority))
      errors.priority = [tr('Độ ưu tiên không hợp lệ.', 'Invalid priority.')]
    if (creating || body.steps !== undefined) {
      const steps = this.cleanSteps(body.steps)
      if (!steps.length || steps.some((s) => !s.action))
        errors.steps = [tr('Cần ít nhất 1 bước, mỗi bước có hành động.', 'At least 1 step, each with an action.')]
    }
    if (
      body.folderId !== undefined &&
      body.folderId !== null &&
      !this.load().folders.some((f) => f.folderId === body.folderId && f.projectId === ctx.projectId)
    )
      errors.folderId = [tr('Thư mục không hợp lệ.', 'Invalid folder.')]
    if (body.issueIds && this.issues.refs(ctx.projectId, body.issueIds).length !== new Set(body.issueIds).size)
      errors.issueIds = [tr('Có issue không thuộc dự án.', 'Some issues are not in the project.')]
    if (Object.keys(errors).length) validationError(errors)
  }

  private nextKey(projectId: number) {
    const db = this.load()
    const n = (db.keySeq[projectId] ?? 0) + 1
    db.keySeq[projectId] = n
    return `TC-${n}`
  }

  private insert(ctx: Ctx, body: CreateTestCaseBody, at = this.iso()): TestCaseRec {
    this.validate(ctx, body, true)
    const t: TestCaseRec = {
      testCaseId: this.nextId(),
      projectId: ctx.projectId,
      key: this.nextKey(ctx.projectId),
      title: body.title.trim(),
      type: body.type,
      priority: body.priority,
      preconditions: body.preconditions?.trim() || null,
      steps: this.cleanSteps(body.steps),
      folderId: body.folderId ?? null,
      links: newLinks(ctx.index, body.requirementRefs),
      issueIds: [...new Set(body.issueIds ?? [])],
      needsReview: false,
      lastResult: null,
      lastRunAt: null,
      lastRunBy: null,
      createdBy: ctx.me,
      createdAt: at,
      updatedAt: at,
      isDeleted: false,
    }
    this.load().testcases.push(t)
    return t
  }

  async createTestCase(projectId: number, body: CreateTestCaseBody): Promise<TestCaseDetailDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseManage, true)
    const t = this.insert(ctx, body)
    this.persist()
    return this.detail(ctx, t)
  }

  async updateTestCase(testCaseId: number, body: UpdateTestCaseBody): Promise<TestCaseDetailDto> {
    const ctx = await this.ctx(this.testcase(testCaseId).projectId, PERMISSIONS.testCaseManage, true)
    const t = this.testcase(testCaseId)
    this.validate(ctx, body, false)
    let content = false
    if (body.title !== undefined) {
      content ||= body.title.trim() !== t.title
      t.title = body.title.trim()
    }
    if (body.type !== undefined) t.type = body.type
    if (body.priority !== undefined) t.priority = body.priority
    if (body.preconditions !== undefined) t.preconditions = body.preconditions?.trim() || null
    if (body.steps !== undefined) {
      const steps = this.cleanSteps(body.steps)
      content ||= JSON.stringify(steps) !== JSON.stringify(t.steps)
      t.steps = steps
    }
    if (body.folderId !== undefined) t.folderId = body.folderId ?? null
    if (body.requirementRefs !== undefined) t.links = newLinks(ctx.index, body.requirementRefs, t.links)
    if (body.issueIds !== undefined) t.issueIds = [...new Set(body.issueIds)]
    // §3: lưu lại testcase (hoặc needsReview:false) = đã xem lại theo REQ mới.
    const onlyFlag = Object.keys(body).every((k) => k === 'needsReview')
    if (!onlyFlag || body.needsReview === false) {
      t.needsReview = false
      for (const l of t.links) l.changedLabel = null
    }
    // Bước / tiêu đề đổi sau lần chạy → lượt chạy cần chạy lại.
    if (content) this.markRerun(t.testCaseId)
    t.updatedAt = this.iso()
    this.persist()
    return this.detail(ctx, t)
  }

  async deleteTestCase(testCaseId: number): Promise<void> {
    await this.ctx(this.testcase(testCaseId).projectId, PERMISSIONS.testCaseManage, true)
    this.testcase(testCaseId).isDeleted = true
    this.persist()
  }

  // ---------- 5.3 Gợi ý ----------

  async suggest(projectId: number, body: { refs: RequirementRef[] }): Promise<{ items: SuggestedTestCase[] }> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseManage, true)
    if (!hasWorkPermission(ctx.permissions, PERMISSIONS.aiUse))
      fail(403, 'FORBIDDEN', tr('Bạn không có quyền dùng AI.', "You don't have permission to use AI."))
    if (!ctx.aiEnabled) fail(409, 'AI_DISABLED', tr('Dự án đang tắt module AI.', 'AI is turned off for this project.'))
    if (!body.refs?.length) validationError({ refs: [tr('Chọn ít nhất 1 REQ.', 'Pick at least 1 REQ.')] })
    const items: SuggestedTestCase[] = []
    let n = 0
    for (const link of newLinks(ctx.index, body.refs)) {
      const { req } = findReq(ctx.index, link.documentId, link.reqUid)
      if (!req) continue
      const existing = this.projectCases(projectId).filter((t) =>
        t.links.some((l) => l.documentId === link.documentId && l.reqUid === link.reqUid),
      )
      const haystack = existing.map((t) =>
        norm([t.title, ...t.steps.flatMap((s) => [s.action, s.expected])].join(' \n ')),
      )
      const covered = (text: string) => haystack.some((h) => h.includes(norm(text)))
      const priority: TestPriority = req.priority
      const requirementRef = { documentId: link.documentId, reqUid: link.reqUid }
      for (const c of req.acceptanceCriteria) {
        const text = c.text.trim()
        if (!text || covered(text)) continue
        items.push({
          tempId: `s-${++n}`,
          title: text.slice(0, 300),
          type: 'FUNCTIONAL',
          priority,
          steps: [{ action: tr(`Thực hiện: ${text}`, `Do: ${text}`), expected: text }],
          requirementRef,
          fromCriterion: text,
        })
      }
      // REQ chưa có tiêu chí và chưa có test: một testcase chung theo tiêu đề REQ (ngoài quy tắc §5.3, xem báo cáo).
      if (req.acceptanceCriteria.length === 0 && existing.length === 0) {
        items.push({
          tempId: `s-${++n}`,
          title: tr(`Kiểm tra: ${req.title}`, `Verify: ${req.title}`).slice(0, 300),
          type: 'FUNCTIONAL',
          priority,
          steps: [
            {
              action: tr(`Thực hiện luồng chính của ${req.reqKey}`, `Run the main flow of ${req.reqKey}`),
              expected: req.title,
            },
          ],
          requirementRef,
          fromCriterion: null,
        })
      }
    }
    return { items }
  }

  // ---------- 5.4 Đợt chạy ----------

  async listCycles(projectId: number, status?: CycleStatus): Promise<{ items: TestCycleDto[] }> {
    await this.ctx(projectId, PERMISSIONS.testCaseView)
    const items = this.load()
      .cycles.filter((c) => c.projectId === projectId && (!status || c.status === status))
      .sort((a, b) => (a.status === b.status ? b.cycleId - a.cycleId : a.status === 'OPEN' ? -1 : 1))
      .map((c) => this.cycleDto(c))
    return { items }
  }

  async createCycle(projectId: number, body: CreateCycleBody): Promise<TestCycleDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseManage, true)
    const errors: Record<string, string[]> = {}
    const name = body.name?.trim()
    if (!name || name.length > 150)
      errors.name = [tr('Tên đợt chạy 1–150 ký tự.', 'Cycle name must be 1–150 characters.')]
    const ids = [...new Set(body.testCaseIds ?? [])]
    if (!ids.length) errors.testCaseIds = [tr('Chọn ít nhất 1 testcase.', 'Pick at least 1 test case.')]
    else if (ids.some((id) => !this.projectCases(projectId).some((t) => t.testCaseId === id)))
      errors.testCaseIds = [tr('Có testcase không thuộc dự án.', 'Some test cases are not in the project.')]
    if (Object.keys(errors).length) validationError(errors)
    let assignee: UserRef | null = null
    if (body.defaultAssigneeId !== undefined && body.defaultAssigneeId !== null) {
      assignee = (await this.issues.people(projectId)).find((p) => p.userId === body.defaultAssigneeId) ?? null
      if (!assignee)
        validationError({
          defaultAssigneeId: [tr('Người này không thuộc dự án.', 'This person is not in the project.')],
        })
    }
    const c: CycleRec = {
      cycleId: this.nextId(),
      projectId,
      name: name!,
      sprintId: body.sprintId ?? null,
      status: 'OPEN',
      createdBy: ctx.me,
      createdAt: this.iso(),
    }
    this.load().cycles.push(c)
    for (const id of ids) this.load().runs.push(this.newRun(c.cycleId, id, assignee))
    this.persist()
    return this.cycleDto(c)
  }

  private newRun(cycleId: number, testCaseId: number, assignee: UserRef | null): RunRec {
    return {
      runId: this.nextId(),
      cycleId,
      testCaseId,
      assignee,
      result: 'NOT_RUN',
      note: null,
      executedAt: null,
      executedBy: null,
      defectIssueIds: [],
      needsRerun: false,
    }
  }

  async updateCycle(cycleId: number, body: { name?: string; status?: CycleStatus }): Promise<TestCycleDto> {
    await this.ctx(this.cycle(cycleId).projectId, PERMISSIONS.testCaseManage, true)
    const c = this.cycle(cycleId)
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name || name.length > 150)
        validationError({ name: [tr('Tên đợt chạy 1–150 ký tự.', 'Cycle name must be 1–150 characters.')] })
      c.name = name
    }
    if (body.status !== undefined) {
      if (body.status !== 'OPEN' && body.status !== 'CLOSED')
        validationError({ status: [tr('Trạng thái không hợp lệ.', 'Invalid status.')] })
      c.status = body.status
    }
    this.persist()
    return this.cycleDto(c)
  }

  async listRuns(cycleId: number, q: RunQuery = {}): Promise<{ items: TestRunDto[] }> {
    const ctx = await this.ctx(this.cycle(cycleId).projectId, PERMISSIONS.testCaseView)
    const live = new Set(this.projectCases(ctx.projectId).map((t) => t.testCaseId))
    let list = this.load().runs.filter((r) => r.cycleId === cycleId && live.has(r.testCaseId))
    if (q.assigneeId === 'me') list = list.filter((r) => r.assignee?.userId === ctx.me.userId)
    else if (q.assigneeId !== undefined) list = list.filter((r) => r.assignee?.userId === Number(q.assigneeId))
    if (q.result) list = list.filter((r) => r.result === q.result)
    if (q.needsRerun) list = list.filter((r) => r.needsRerun)
    return { items: list.sort((a, b) => a.runId - b.runId).map((r) => this.runDto(ctx, r)) }
  }

  async updateRun(runId: number, body: { assigneeId: number | null }): Promise<TestRunDto> {
    const r = this.run(runId)
    const ctx = await this.ctx(this.cycle(r.cycleId).projectId, PERMISSIONS.testCaseManage, true)
    if (body.assigneeId === null) r.assignee = null
    else {
      const p = (await this.issues.people(ctx.projectId)).find((u) => u.userId === body.assigneeId)
      if (!p)
        validationError({ assigneeId: [tr('Người này không thuộc dự án.', 'This person is not in the project.')] })
      r.assignee = p!
    }
    this.persist()
    return this.runDto(ctx, r)
  }

  // ---------- 5.5 Ghi kết quả ----------

  async recordResult(runId: number, body: RecordResultBody): Promise<TestRunDto> {
    const r = this.run(runId)
    const c = this.cycle(r.cycleId)
    const ctx = await this.ctx(c.projectId, PERMISSIONS.testCaseExecute, true)
    if (c.status !== 'OPEN') fail(409, 'CYCLE_CLOSED', tr('Đợt chạy đã đóng.', 'The test cycle is closed.'))
    if (!['PASS', 'FAIL', 'BLOCKED'].includes(body.result))
      validationError({ result: [tr('Kết quả không hợp lệ.', 'Invalid result.')] })
    const note = body.note?.trim().slice(0, 2000) || null
    const tc = this.testcase(r.testCaseId)
    const defects: number[] = []
    if (body.createDefect && body.result === 'FAIL') {
      const title = body.createDefect.title?.trim()
      if (!title) validationError({ 'createDefect.title': [tr('Nhập tiêu đề bug.', 'Enter a bug title.')] })
      const bug = await this.issues.createDefect(c.projectId, {
        title: title!,
        priority: body.createDefect.priority as IssuePriority | undefined,
        assigneeId: body.createDefect.assigneeId ?? null,
        refs: tc.links.map((l) => ({ documentId: l.documentId, reqUid: l.reqUid })),
      })
      defects.push(bug.issueId)
      if (!tc.issueIds.includes(bug.issueId)) tc.issueIds.push(bug.issueId)
    }
    const at = this.iso()
    r.result = body.result
    r.note = note
    r.executedAt = at
    r.executedBy = ctx.me
    r.needsRerun = false
    r.defectIssueIds = [...new Set([...r.defectIssueIds, ...defects])]
    tc.lastResult = body.result
    tc.lastRunAt = at
    tc.lastRunBy = ctx.me
    this.load().history.push({
      id: this.nextId(),
      runId,
      testCaseId: tc.testCaseId,
      result: body.result,
      note,
      executedBy: ctx.me,
      executedAt: at,
      defectIssueIds: defects,
    })
    this.persist()
    return this.runDto(ctx, r)
  }

  // ---------- Dữ liệu mẫu ----------

  hasData(projectId: number) {
    const db = this.load()
    return db.seeded.includes(projectId) || db.testcases.some((t) => t.projectId === projectId && !t.isDeleted)
  }

  /** Testcase cho REQ-01..03 của SRS-02 + REQ-01 của SRS-01, một đợt chạy OPEN đúng câu chuyện trong mockup. */
  async seedDemo(projectId: number, issueIds: Record<string, number>): Promise<boolean> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseManage, true)
    if (this.hasData(projectId)) return false
    const db = this.load()
    db.seeded.push(projectId)
    const me = ctx.me
    const [ln, th] = DEMO_PEOPLE
    const day = 86_400_000
    const ref = (uid: string): RequirementRef[] => {
      const d = ctx.index.find((x) => [...x.baseline, ...x.current].some((r) => r.reqUid === uid))
      return d ? [{ documentId: d.documentId, reqUid: uid }] : []
    }
    const issue = (n: number) => (issueIds[String(n)] ? [issueIds[String(n)]] : [])
    const folder: FolderRec = {
      folderId: this.nextId(),
      projectId,
      parentId: null,
      name: tr('Hồi quy chung', 'General regression'),
      sortOrder: 0,
    }
    db.folders.push(folder)
    const tc = (
      title: string,
      type: TestType,
      priority: TestPriority,
      steps: [string, string][],
      refs: RequirementRef[],
      issues: number[],
      folderId: number | null = null,
    ) =>
      this.insert(
        ctx,
        {
          title,
          type,
          priority,
          steps: steps.map(([action, expected]) => ({ action, expected })),
          requirementRefs: refs,
          issueIds: issues,
          folderId,
        },
        this.iso(-6 * day),
      )

    const qr = ref(PAY_REQ.qr)
    const hook = ref(PAY_REQ.webhook)
    const rec = ref(PAY_REQ.reconcile)
    const login = ref(AUTH_REQ.login)
    const t1 = tc(
      'Mã QR chứa đúng số tiền',
      'FUNCTIONAL',
      'HIGH',
      [
        ['Tạo đơn 150.000đ, chọn VietQR', 'Mã QR hiển thị'],
        ['Quét mã bằng app ngân hàng', 'Số tiền = 150.000đ, đúng mã tham chiếu'],
      ],
      qr,
      issue(103),
    )
    const t2 = tc(
      'Mã QR hết hạn đúng hạn',
      'FUNCTIONAL',
      'MEDIUM',
      [['Tạo mã QR rồi chờ hết thời gian hiệu lực', 'Mã chuyển sang Hết hạn, đơn bị huỷ']],
      qr,
      issue(103),
    )
    const t3 = tc(
      'Mỗi đơn hàng chỉ có 1 mã QR còn hiệu lực',
      'FUNCTIONAL',
      'MEDIUM',
      [
        ['Tạo mã QR cho đơn', 'Mã 1 hiển thị'],
        ['Bấm tạo lại mã', 'Mã 1 bị vô hiệu, chỉ còn mã 2'],
      ],
      qr,
      issue(103),
    )
    const t4 = tc(
      'Từ chối webhook sai chữ ký HMAC',
      'SECURITY',
      'HIGH',
      [
        ['Gửi webhook có chữ ký sai', 'Trả 401, không ghi có'],
        ['Gửi webhook đúng chữ ký', 'Trả 200, đơn chuyển PAID'],
      ],
      hook,
      issue(104),
    )
    const t5 = tc(
      'Không ghi có trùng khi ngân hàng gửi lại webhook',
      'INTEGRATION',
      'HIGH',
      [
        ['Tạo đơn, quét QR, chuyển khoản đúng số tiền', 'Đơn chuyển PAID'],
        ['Giả lập ngân hàng gửi lại cùng mã giao dịch 2 lần', 'Lần 2 trả 200 "đã xử lý"'],
        ['Kiểm tra số dư ví và trạng thái đơn', 'Chỉ ghi có 1 lần'],
      ],
      hook,
      issue(104),
    )
    const t6 = tc(
      'Phản hồi ngân hàng trong tối đa 3 giây',
      'INTEGRATION',
      'MEDIUM',
      [['Gửi 50 webhook liên tiếp', 'Mỗi phản hồi ≤ 3 giây']],
      hook,
      issue(104),
    )
    const t7 = tc(
      'Hoàn tiền giao dịch đến sau khi mã hết hạn',
      'FUNCTIONAL',
      'MEDIUM',
      [['Chuyển khoản sau khi mã đã hết hạn', 'Giao dịch vào danh sách Cần đối soát']],
      rec,
      issue(105),
    )
    const t8 = tc(
      'Sai email hoặc mật khẩu hiện cùng một thông báo chung',
      'SECURITY',
      'HIGH',
      [
        ['Đăng nhập sai email', 'Thông báo chung'],
        ['Đăng nhập sai mật khẩu', 'Cùng thông báo'],
      ],
      login,
      issue(101),
    )
    const t9 = tc(
      'Token hết hạn thì tự làm mới bằng refresh token',
      'FUNCTIONAL',
      'MEDIUM',
      [['Chờ access token hết hạn rồi gọi API', 'Tự làm mới bằng refresh token, không đăng xuất']],
      login,
      issue(101),
    )
    const t10 = tc(
      'Thanh toán thẻ nội địa end-to-end',
      'E2E',
      'LOW',
      [['Đặt hàng và thanh toán bằng thẻ ATM', 'Đơn PAID, nhận email xác nhận']],
      [],
      [],
      folder.folderId,
    )

    const cycle: CycleRec = {
      cycleId: this.nextId(),
      projectId,
      name: 'Sprint 4 · hồi quy thanh toán',
      sprintId: null,
      status: 'OPEN',
      createdBy: th,
      createdAt: this.iso(-3 * day),
    }
    db.cycles.push(cycle)
    const run = (
      t: TestCaseRec,
      who: UserRef,
      result: RunResult,
      daysAgo = 1,
      note: string | null = null,
      defects: number[] = [],
    ) => {
      const r = this.newRun(cycle.cycleId, t.testCaseId, who)
      db.runs.push(r)
      if (result === 'NOT_RUN') return r
      const at = this.iso(-daysAgo * day)
      Object.assign(r, { result, note, executedAt: at, executedBy: who, defectIssueIds: defects })
      Object.assign(t, { lastResult: result, lastRunAt: at, lastRunBy: who })
      db.history.push({
        id: this.nextId(),
        runId: r.runId,
        testCaseId: t.testCaseId,
        result,
        note,
        executedBy: who,
        executedAt: at,
        defectIssueIds: defects,
      })
      return r
    }
    run(t1, ln, 'PASS')
    run(t2, ln, 'PASS', 2)
    run(t3, ln, 'PASS', 2)
    const r4 = run(t4, me, 'PASS', 2)
    const r5 = run(
      t5,
      me,
      'FAIL',
      2,
      tr('Ghi có 2 lần khi gửi lại sau 10 giây', 'Credited twice when resent after 10 seconds'),
      issue(104),
    )
    run(t6, me, 'NOT_RUN')
    run(t7, th, 'BLOCKED', 1, tr('Sandbox ngân hàng lỗi', 'Bank sandbox is down'))
    run(t8, th, 'PASS', 3)
    run(t9, th, 'PASS', 3)
    run(t10, th, 'NOT_RUN')
    // REQ-02 (webhook) đổi ở bản đã duyệt gần nhất: testcase cần xem lại, lượt đã chạy cần chạy lại.
    for (const t of [t4, t5, t6]) {
      t.needsReview = true
      for (const l of t.links)
        l.changedLabel = ctx.index.find((d) => d.documentId === l.documentId)?.baselineLabel ?? '1.1'
    }
    r4.needsRerun = true
    r5.needsRerun = true
    this.persist()
    return true
  }
}
