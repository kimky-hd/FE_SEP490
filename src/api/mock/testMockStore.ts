// Backend giả trong trình duyệt cho Test cases v2 (doc/Issues-Testcases-API-Contract.md, mục "v2"), lưu ở localStorage
// `ssam.mock.tests.v2`. Bật bằng VITE_MOCK_TESTS=true. Bug (issue BUG) qua IssueMockStore; REQ tra trong mock tài liệu
// hoặc API Tài liệu thật; mục tài liệu (heading) qua env.sections. Luật retest / trạng thái theo môi trường dùng chung
// với UI (src/lib/testplan/*). Mọi thao tác ghi kiểm quyền như BE và ghi lịch sử (activity).

import { tr } from '@/i18n'
import { PERMISSIONS } from '@/types/rbac'
import { hasWorkPermission } from '@/lib/workPermissions'
import { nextCaseCode, nextGroupCode, nextTopCode, findPlacement } from '@/lib/testplan/placement'
import {
  bugFixedFlags,
  recordOutcome,
  regressionFlags,
  reqChangedFlags,
  withFlag,
  withoutFlag,
} from '@/lib/testplan/retest'
import { sectionOfReq, stripHeadingNumber, defaultModuleSections } from '@/lib/testplan/sections'
import { isTestResult, statusIn, traceStatusOf } from '@/lib/testplan/status'
import { stepsToText } from '@/lib/testplan/steps'
import { defaultCustomFields, emptyLayout, validateColumn } from '@/lib/testplan/columns'
import type { IssuePriority, RequirementRef, UserRef } from '@/types/issue'
import {
  BUG_SEVERITIES,
  TEST_ACTIVITY_TYPES,
  TEST_PRIORITIES,
  type ActivityQuery,
  type AiApplyItem,
  type AssignmentBody,
  type BulkUpdateBody,
  type CreateBugBody,
  type CreateModuleBody,
  type CreateTestCaseBody,
  type CreateTestPlanBody,
  type CustomValue,
  type DeployBuildBody,
  type DocSectionDto,
  type EnvironmentBody,
  type RecordResultsBody,
  type RecordResultsResult,
  type RetestFlagDto,
  type SectionBody,
  type SheetLayoutDto,
  type SuggestedTestCaseDto,
  type TestActivityDto,
  type TestAssignmentDto,
  type TestBugRefDto,
  type TestBuildDto,
  type TestCaseDto,
  type TestCaseQuery,
  type TestCaseStatus,
  type TestEnvironmentDto,
  type TestHandoverDto,
  type TestModuleDto,
  type TestPlanDto,
  type TestPlanStatus,
  type TestPlanSummaryDto,
  type TestPriority,
  type TestResult,
  type TestResultDto,
  type TestSectionDto,
  type TestStep,
  type TraceRowDto,
  type UpdateTestCaseBody,
  type UpdateTestPlanBody,
} from '@/types/testing'
import type { TestApi } from '@/api/testApi'
import type { DocReqIndex, ReqLite } from './documentMockStore'
import type { IssueMockStore, LinkedTest } from './issueMockStore'
import { FEE_REQ, QR_REQ, RPT_REQ, SPEC_ANCHORS } from './testSpecSeed'
import {
  clone,
  DEMO_PEOPLE,
  fail,
  findReq,
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

export const TEST_STORAGE_KEY = 'ssam.mock.tests.v2'

// ---------- Bản ghi ----------

interface PlanRec {
  planId: number
  projectId: number
  name: string
  startDate: string | null
  endDate: string | null
  status: TestPlanStatus
  handover: TestHandoverDto | null
  layout: SheetLayoutDto
  createdAt: string
}

interface EnvRec {
  envId: number
  planId: number
  name: string
  url: string | null
  note: string | null
  position: number
}

interface BuildRec {
  buildId: number
  envId: number
  version: string
  deployedAt: string
  deployedBy: UserRef | null
  fixedIssueIds: number[]
}

interface ModuleRec {
  moduleId: number
  planId: number
  documentId: number
  name: string
  shortCode: string
  position: number
  /** Số TC lớn nhất đã cấp trong module (mã không tái sử dụng). */
  caseSeq?: number
}

interface SectionRec {
  sectionId: number
  moduleId: number
  parentId: number | null
  code: string
  title: string
  anchorId: string | null
  position: number
  reqChanged: boolean
}

interface AssignRec {
  moduleId: number
  envId: number
  assignee: UserRef
}

interface CaseRec {
  testCaseId: number
  planId: number
  moduleId: number
  sectionId: number
  code: string
  title: string
  preconditions: string | null
  steps: TestStep[]
  actual: string | null
  links: LinkRec[]
  aiSuggestedReqs: boolean
  priority: TestPriority
  category: string | null
  browser: string | null
  customFields: Record<string, CustomValue>
  status: TestCaseStatus
  position: number
  bugId: number | null
  results: TestResultDto[]
  retest: RetestFlagDto[]
  createdAt: string
  updatedAt: string
}

interface TestDb {
  seq: number
  plans: PlanRec[]
  envs: EnvRec[]
  builds: BuildRec[]
  modules: ModuleRec[]
  sections: SectionRec[]
  assigns: AssignRec[]
  cases: CaseRec[]
  activity: TestActivityDto[]
  seeded: number[]
}

const emptyDb = (): TestDb => ({
  seq: 9000,
  plans: [],
  envs: [],
  builds: [],
  modules: [],
  sections: [],
  assigns: [],
  cases: [],
  activity: [],
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

type BugInfo = TestBugRefDto & { type?: string }

const SYSTEM: UserRef = { userId: 0, fullName: 'SSAM' }
const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position
const trim = (v: string | null | undefined) => (typeof v === 'string' ? v.trim() : '')
const norm = (s: string) => s.toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim()

/** Mã ngắn của module theo chữ đầu các từ (bỏ dấu), tối đa 4 ký tự. */
function shortCodeOf(name: string): string {
  const plain = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D')
  const code = plain
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w[0]))
    .join('')
    .toUpperCase()
  return code.slice(0, 4) || 'MOD'
}

export class TestMockStore implements TestApi {
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
    if (
      !hasWorkPermission(acc.permissions, PERMISSIONS.testCaseView) ||
      !hasWorkPermission(acc.permissions, permission)
    )
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

  private need(ctx: Ctx, key: string) {
    if (!hasWorkPermission(ctx.permissions, key))
      fail(403, 'FORBIDDEN', tr('Bạn không có quyền thực hiện thao tác này.', "You don't have permission to do this."))
  }

  private open(plan: PlanRec) {
    if (plan.status === 'HANDED_OVER')
      fail(
        409,
        'PLAN_HANDED_OVER',
        tr(
          'Đợt test đã bàn giao, chỉ xem. Mở lại đợt test để sửa.',
          'The test plan was handed over; reopen it to edit.',
        ),
      )
  }

  private planRec(planId: number): PlanRec {
    const p = this.load().plans.find((x) => x.planId === Number(planId))
    return p ?? fail(404, 'TEST_PLAN_NOT_FOUND', tr('Không tìm thấy đợt test.', 'Test plan not found.'))
  }

  private envRec(envId: number): EnvRec {
    const e = this.load().envs.find((x) => x.envId === Number(envId))
    return e ?? fail(404, 'ENVIRONMENT_NOT_FOUND', tr('Không tìm thấy môi trường.', 'Environment not found.'))
  }

  private moduleRec(moduleId: number): ModuleRec {
    const m = this.load().modules.find((x) => x.moduleId === Number(moduleId))
    return m ?? fail(404, 'MODULE_NOT_FOUND', tr('Không tìm thấy module.', 'Module not found.'))
  }

  private sectionRec(sectionId: number): SectionRec {
    const s = this.load().sections.find((x) => x.sectionId === Number(sectionId))
    return s ?? fail(404, 'SECTION_NOT_FOUND', tr('Không tìm thấy mục / nhóm.', 'Section not found.'))
  }

  private caseRec(testCaseId: number): CaseRec {
    const c = this.load().cases.find((x) => x.testCaseId === Number(testCaseId))
    return c ?? fail(404, 'TESTCASE_NOT_FOUND', tr('Không tìm thấy testcase.', 'Test case not found.'))
  }

  private envsOf(planId: number) {
    return this.load()
      .envs.filter((e) => e.planId === planId)
      .sort(byPos)
  }

  private modulesOf(planId: number) {
    return this.load()
      .modules.filter((m) => m.planId === planId)
      .sort(byPos)
  }

  private casesOf(planId: number, includeDeleted = true) {
    return this.load().cases.filter((c) => c.planId === planId && (includeDeleted || c.status === 'ACTIVE'))
  }

  private currentBuild(envId: number): string | null {
    const list = this.load().builds.filter((b) => b.envId === envId)
    return list.length ? list[list.length - 1].version : null
  }

  private assignee(moduleId: number, envId: number): UserRef | null {
    return this.load().assigns.find((a) => a.moduleId === moduleId && a.envId === envId)?.assignee ?? null
  }

  private log(
    planId: number,
    actor: UserRef,
    e: Partial<Omit<TestActivityDto, 'activityId' | 'planId' | 'actor'>> & { type: TestActivityDto['type'] },
  ) {
    this.load().activity.push({
      activityId: this.nextId(),
      planId,
      at: e.at ?? this.iso(),
      actor,
      type: e.type,
      envId: e.envId ?? null,
      moduleId: e.moduleId ?? null,
      testCaseId: e.testCaseId ?? null,
      from: e.from ?? null,
      to: e.to ?? null,
      build: e.build ?? null,
      behalfOf: e.behalfOf ?? null,
      text: e.text ?? '',
    })
  }

  /** Đợt test "hiện tại" của dự án: đợt đang mở mới nhất, không có thì đợt mới nhất. */
  private currentPlan(projectId: number): PlanRec | null {
    const list = this.load()
      .plans.filter((p) => p.projectId === projectId)
      .sort((a, b) => b.planId - a.planId)
    return list.find((p) => p.status === 'OPEN') ?? list[0] ?? null
  }

  private reqLabel(index: DocReqIndex[], l: Pick<LinkRec, 'documentId' | 'reqUid'>) {
    return findReq(index, l.documentId, l.reqUid).req?.reqKey ?? l.reqUid.slice(0, 6)
  }

  /** REQ liên kết đổi sau baseline → cờ REQ_CHANGED ở các môi trường case đã có kết quả (lib/testplan/retest). */
  syncReqChanges(projectId: number, index: DocReqIndex[]): boolean {
    let changed = false
    const db = this.load()
    // Chỉ đợt đang mở: đợt đã bàn giao là hồ sơ chốt, không bị đánh dấu thêm (mở lại thì lần đọc sau mới đồng bộ).
    const plans = new Map(
      db.plans.filter((p) => p.projectId === projectId && p.status === 'OPEN').map((p) => [p.planId, p]),
    )
    for (const c of db.cases.filter((x) => plans.has(x.planId) && x.status === 'ACTIVE')) {
      for (const link of c.links) {
        const label = syncLink(index, link)
        if (!label) continue
        changed = true
        const reqKey = this.reqLabel(index, link)
        const at = this.iso()
        const envIds = this.envsOf(c.planId).map((e) => e.envId)
        for (const f of reqChangedFlags({ ...c, bug: null }, envIds, reqKey, at)) c.retest = withFlag(c.retest, f)
        this.log(c.planId, SYSTEM, {
          type: 'REQ',
          moduleId: c.moduleId,
          testCaseId: c.testCaseId,
          text: tr(`${reqKey} đổi ở bản ${label} → cần test lại`, `${reqKey} changed in v${label} → retest`),
        })
      }
    }
    return changed
  }

  /** Cho IssueMockStore: testcase gắn với từng bug (kết quả xấu nhất qua các môi trường; NA hiện như "Bị chặn"). */
  linkedTests(projectId: number): Map<number, LinkedTest[]> {
    const map = new Map<number, LinkedTest[]>()
    const db = this.load()
    const plans = new Set(db.plans.filter((p) => p.projectId === projectId).map((p) => p.planId))
    for (const c of db.cases.filter((x) => plans.has(x.planId) && x.status === 'ACTIVE' && x.bugId)) {
      // Kết quả xấu nhất trong các môi trường case đã test / đang cần test lại: FAIL > cần test lại > N/A > PASS.
      const st = db.envs
        .filter((e) => e.planId === c.planId)
        .filter(
          (e) =>
            c.retest.some((f) => f.envId === e.envId) ||
            c.results.some((r) => r.envId === e.envId && r.result !== 'UNTEST'),
        )
        .map((e) => ({ envId: e.envId, s: statusIn(c, e.envId) }))
      const worst =
        st.find((x) => x.s === 'FAIL') ??
        st.find((x) => x.s === 'RETEST' || x.s === 'UNTEST') ??
        st.find((x) => x.s === 'NA') ??
        st[0]
      const m = db.modules.find((x) => x.moduleId === c.moduleId)
      const list = map.get(c.bugId!) ?? []
      list.push({
        testCaseId: c.testCaseId,
        key: m ? `${m.shortCode}·${c.code}` : c.code,
        title: c.title,
        lastResult: !worst
          ? null
          : worst.s === 'PASS'
            ? 'PASS'
            : worst.s === 'FAIL'
              ? 'FAIL'
              : worst.s === 'NA'
                ? 'BLOCKED'
                : 'NOT_RUN',
        planId: c.planId,
        envId: worst?.envId ?? null,
      })
      map.set(c.bugId!, list)
    }
    return map
  }

  // ---------- DTO ----------

  private async people(projectId: number): Promise<(UserRef & { qa: boolean })[]> {
    const [list, kinds] = await Promise.all([
      this.issues.people(projectId),
      this.env.memberKinds(projectId).catch(() => ({}) as Record<number, string>),
    ])
    const all = [...list]
    if (projectId < 20) {
      for (const p of DEMO_PEOPLE) if (!all.some((x) => x.userId === p.userId) && this.usesDemo(projectId)) all.push(p)
    }
    return all.map((u) => ({ ...u, qa: u.userId < 0 || !kinds[u.userId] || kinds[u.userId] === 'QA' }))
  }

  private usesDemo(projectId: number) {
    return this.load().seeded.includes(projectId)
  }

  private buildDto(b: BuildRec, bugs: Map<number, BugInfo>): TestBuildDto {
    const resultCount = this.load().cases.reduce(
      (n, c) => n + c.results.filter((r) => r.envId === b.envId && r.build === b.version).length,
      0,
    )
    return {
      buildId: b.buildId,
      version: b.version,
      deployedAt: b.deployedAt,
      deployedBy: b.deployedBy,
      fixedBugs: b.fixedIssueIds.map((id) => ({ issueId: id, key: bugs.get(id)?.key ?? `#${id}` })),
      resultCount,
    }
  }

  private envDto(e: EnvRec, bugs: Map<number, BugInfo>): TestEnvironmentDto {
    const builds = this.load().builds.filter((b) => b.envId === e.envId)
    return {
      envId: e.envId,
      name: e.name,
      url: e.url,
      note: e.note,
      position: e.position,
      currentBuild: builds.length ? builds[builds.length - 1].version : null,
      builds: builds.map((b) => this.buildDto(b, bugs)),
    }
  }

  /** reqChanged của mục lớn = còn case (trong mục hoặc nhóm con) đang có cờ REQ_CHANGED ở môi trường nào đó. */
  private sectionDto(s: SectionRec): TestSectionDto {
    if (s.parentId !== null) return { ...s, reqChanged: false }
    const ids = new Set([
      s.sectionId,
      ...this.load()
        .sections.filter((x) => x.parentId === s.sectionId)
        .map((x) => x.sectionId),
    ])
    const reqChanged = this.load().cases.some(
      (c) => ids.has(c.sectionId) && c.status === 'ACTIVE' && c.retest.some((f) => f.reason === 'REQ_CHANGED'),
    )
    return { ...s, reqChanged }
  }

  private moduleDto(ctx: Ctx, m: ModuleRec): TestModuleDto {
    const doc = ctx.index.find((d) => d.documentId === m.documentId)
    return {
      moduleId: m.moduleId,
      documentId: m.documentId,
      documentCode: doc?.code ?? `DOC-${m.documentId}`,
      documentTitle: doc?.title ?? m.name,
      name: m.name,
      shortCode: m.shortCode,
      position: m.position,
      sections: this.load()
        .sections.filter((s) => s.moduleId === m.moduleId)
        .sort(byPos)
        .map((s) => this.sectionDto(s)),
    }
  }

  private async bugMap(projectId: number, ids: (number | null)[]): Promise<Map<number, BugInfo>> {
    const uniq = [...new Set(ids.filter((x): x is number => typeof x === 'number'))]
    const list = await this.issues.bugRefs(projectId, uniq)
    return new Map(list.map((b) => [b.issueId, b]))
  }

  private async planDto(ctx: Ctx, p: PlanRec): Promise<TestPlanDto> {
    const db = this.load()
    const envs = this.envsOf(p.planId)
    const bugIds = [...db.builds.filter((b) => envs.some((e) => e.envId === b.envId)).flatMap((b) => b.fixedIssueIds)]
    const bugs = await this.bugMap(ctx.projectId, bugIds)
    const modules = this.modulesOf(p.planId)
    return {
      planId: p.planId,
      projectId: p.projectId,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      createdAt: p.createdAt,
      handover: p.handover ? clone(p.handover) : null,
      environments: envs.map((e) => this.envDto(e, bugs)),
      modules: modules.map((m) => this.moduleDto(ctx, m)),
      assignments: this.assignmentsOf(p.planId),
      layout: clone(p.layout),
      people: await this.people(ctx.projectId),
    }
  }

  private assignmentsOf(planId: number): TestAssignmentDto[] {
    const mods = new Set(this.modulesOf(planId).map((m) => m.moduleId))
    return this.load()
      .assigns.filter((a) => mods.has(a.moduleId))
      .map((a) => ({ moduleId: a.moduleId, envId: a.envId, assignee: { ...a.assignee } }))
  }

  private caseDto(ctx: Ctx, c: CaseRec, bugs: Map<number, BugInfo>): TestCaseDto {
    const b = c.bugId ? bugs.get(c.bugId) : undefined
    return {
      testCaseId: c.testCaseId,
      planId: c.planId,
      moduleId: c.moduleId,
      sectionId: c.sectionId,
      code: c.code,
      moduleCode: this.load().modules.find((m) => m.moduleId === c.moduleId)?.shortCode ?? '',
      title: c.title,
      preconditions: c.preconditions,
      steps: clone(c.steps),
      actual: c.actual,
      requirements: c.links.map((l) => reqRefDto(ctx.index, l, !!l.changedLabel)),
      aiSuggestedReqs: c.aiSuggestedReqs,
      priority: c.priority,
      category: c.category,
      browser: c.browser,
      customFields: clone(c.customFields),
      status: c.status,
      position: c.position,
      bug: b
        ? {
            issueId: b.issueId,
            key: b.key,
            title: b.title,
            priority: b.priority,
            statusName: b.statusName,
            statusCategory: b.statusCategory,
          }
        : null,
      results: clone(c.results),
      retest: clone(c.retest),
      updatedAt: c.updatedAt,
    }
  }

  private async caseDtos(ctx: Ctx, list: CaseRec[]): Promise<TestCaseDto[]> {
    const bugs = await this.bugMap(
      ctx.projectId,
      list.map((c) => c.bugId),
    )
    return list.map((c) => this.caseDto(ctx, c, bugs))
  }

  // ---------- Đợt test ----------

  async plans(projectId: number): Promise<TestPlanSummaryDto[]> {
    await this.ctx(projectId, PERMISSIONS.testCaseView)
    return this.load()
      .plans.filter((p) => p.projectId === projectId)
      .sort((a, b) => (a.status === b.status ? b.planId - a.planId : a.status === 'OPEN' ? -1 : 1))
      .map((p) => ({
        planId: p.planId,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        createdAt: p.createdAt,
      }))
  }

  private validatePlan(body: UpdateTestPlanBody, creating: boolean) {
    const errors: Record<string, string[]> = {}
    if ((creating || body.name !== undefined) && (!trim(body.name) || trim(body.name).length > 150))
      errors.name = [tr('Tên đợt test 1–150 ký tự.', 'Plan name must be 1–150 characters.')]
    const date = (v: string | null | undefined) => v === undefined || v === null || /^\d{4}-\d{2}-\d{2}$/.test(v)
    if (!date(body.startDate)) errors.startDate = [tr('Ngày không hợp lệ.', 'Invalid date.')]
    if (!date(body.endDate)) errors.endDate = [tr('Ngày không hợp lệ.', 'Invalid date.')]
    if (body.startDate && body.endDate && body.startDate > body.endDate)
      errors.endDate = [tr('Ngày kết thúc phải sau ngày bắt đầu.', 'End date must be after the start date.')]
    if (Object.keys(errors).length) validationError(errors)
  }

  async createPlan(projectId: number, body: CreateTestPlanBody): Promise<TestPlanDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCasePlan, true)
    this.validatePlan(body, true)
    const p: PlanRec = {
      planId: this.nextId(),
      projectId,
      name: trim(body.name),
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      status: 'OPEN',
      handover: null,
      layout: emptyLayout(),
      createdAt: this.iso(),
    }
    this.load().plans.push(p)
    const names = (body.environments?.length ? body.environments : ['SIT']).map(trim).filter(Boolean)
    ;[...new Set(names)].forEach((name, i) =>
      this.load().envs.push({ envId: this.nextId(), planId: p.planId, name, url: null, note: null, position: i }),
    )
    this.log(p.planId, ctx.me, { type: 'SETUP', text: tr(`Tạo đợt test ${p.name}`, `Created test plan ${p.name}`) })
    this.persist()
    return this.planDto(ctx, p)
  }

  async plan(planId: number): Promise<TestPlanDto> {
    const p = this.planRec(planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCaseView)
    return this.planDto(ctx, p)
  }

  async updatePlan(planId: number, body: UpdateTestPlanBody): Promise<TestPlanDto> {
    const p = this.planRec(planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    this.validatePlan(body, false)
    if (body.name !== undefined) p.name = trim(body.name)
    if (body.startDate !== undefined) p.startDate = body.startDate
    if (body.endDate !== undefined) p.endDate = body.endDate
    this.log(p.planId, ctx.me, {
      type: 'SETUP',
      text: tr(`Sửa đợt test: ${p.name} (${p.startDate ?? '…'} – ${p.endDate ?? '…'})`, `Edited plan ${p.name}`),
    })
    this.persist()
    return this.planDto(ctx, p)
  }

  // ---------- Môi trường & build ----------

  private validateEnv(planId: number, body: EnvironmentBody, creating: boolean, selfId?: number) {
    const errors: Record<string, string[]> = {}
    if (creating || body.name !== undefined) {
      const name = trim(body.name)
      if (!name || name.length > 40) errors.name = [tr('Tên môi trường 1–40 ký tự.', 'Name must be 1–40 characters.')]
      else if (this.envsOf(planId).some((e) => e.envId !== selfId && norm(e.name) === norm(name)))
        errors.name = [tr('Đã có môi trường này.', 'This environment already exists.')]
    }
    if (body.url && body.url.length > 500) errors.url = [tr('Địa chỉ tối đa 500 ký tự.', 'URL max 500 characters.')]
    if (Object.keys(errors).length) validationError(errors)
  }

  async addEnvironment(planId: number, body: EnvironmentBody & { name: string }): Promise<TestEnvironmentDto> {
    const p = this.planRec(planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    this.validateEnv(planId, body, true)
    const e: EnvRec = {
      envId: this.nextId(),
      planId,
      name: trim(body.name),
      url: trim(body.url) || null,
      note: trim(body.note) || null,
      position: this.envsOf(planId).length,
    }
    this.load().envs.push(e)
    this.log(planId, ctx.me, {
      type: 'SETUP',
      envId: e.envId,
      text: tr(`Thêm môi trường ${e.name}`, `Added ${e.name}`),
    })
    this.persist()
    return this.envDto(e, new Map())
  }

  async updateEnvironment(envId: number, body: EnvironmentBody): Promise<TestEnvironmentDto> {
    const e = this.envRec(envId)
    const p = this.planRec(e.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    this.validateEnv(e.planId, body, false, e.envId)
    const before = e.name
    if (body.name !== undefined) e.name = trim(body.name)
    if (body.url !== undefined) e.url = trim(body.url) || null
    if (body.note !== undefined) e.note = trim(body.note) || null
    this.log(p.planId, ctx.me, {
      type: 'SETUP',
      envId: e.envId,
      text:
        before === e.name
          ? tr(`Sửa môi trường ${e.name}`, `Edited ${e.name}`)
          : tr(`Đổi tên môi trường ${before} → ${e.name}`, `Renamed ${before} → ${e.name}`),
    })
    this.persist()
    return this.envDto(e, new Map())
  }

  async removeEnvironment(envId: number): Promise<void> {
    const e = this.envRec(envId)
    const p = this.planRec(e.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    if (this.envsOf(p.planId).length <= 1)
      fail(
        409,
        'LAST_ENVIRONMENT',
        tr('Đợt test cần ít nhất một môi trường.', 'A test plan needs at least one environment.'),
      )
    const db = this.load()
    db.envs = db.envs.filter((x) => x.envId !== e.envId)
    db.assigns = db.assigns.filter((a) => a.envId !== e.envId)
    for (const c of this.casesOf(p.planId)) c.retest = withoutFlag(c.retest, e.envId)
    this.log(p.planId, ctx.me, { type: 'SETUP', text: tr(`Xoá môi trường ${e.name}`, `Removed ${e.name}`) })
    this.persist()
  }

  async deployBuild(envId: number, body: DeployBuildBody): Promise<{ build: TestBuildDto; retestCount: number }> {
    const e = this.envRec(envId)
    const p = this.planRec(e.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    const version = trim(body.version)
    if (!version || version.length > 40)
      validationError({ version: [tr('Nhập phiên bản build (1–40 ký tự).', 'Enter a build version (1–40 chars).')] })
    if (this.load().builds.some((b) => b.envId === envId && b.version === version))
      validationError({ version: [tr('Build này đã deploy lên môi trường.', 'This build is already deployed here.')] })
    const cases = this.casesOf(p.planId, false)
    const bugs = await this.bugMap(
      ctx.projectId,
      cases.map((c) => c.bugId),
    )
    const fixed =
      body.fixedIssueIds ?? [...bugs.values()].filter((b) => b.statusCategory === 'DONE').map((b) => b.issueId)
    const at = this.iso()
    const build: BuildRec = {
      buildId: this.nextId(),
      envId,
      version,
      deployedAt: at,
      deployedBy: ctx.me,
      fixedIssueIds: [...new Set(fixed.map(Number))],
    }
    this.load().builds.push(build)
    const flags = bugFixedFlags(
      cases.map((c) => ({ ...c, bug: c.bugId ? { issueId: c.bugId, key: bugs.get(c.bugId)?.key ?? '' } : null })),
      envId,
      version,
      build.fixedIssueIds,
      at,
    )
    for (const f of flags) {
      const c = this.caseRec(f.testCaseId)
      c.retest = withFlag(c.retest, f.flag)
    }
    const keys = build.fixedIssueIds.map((id) => bugs.get(id)?.key ?? `#${id}`)
    this.log(p.planId, ctx.me, {
      type: 'BUILD',
      envId,
      build: version,
      text:
        tr(`Deploy build ${version} lên ${e.name}`, `Deployed ${version} to ${e.name}`) +
        (keys.length ? tr(` — fix ${keys.join(', ')}`, ` — fixes ${keys.join(', ')}`) : '') +
        (flags.length ? tr(` · ${flags.length} case cần test lại`, ` · ${flags.length} to retest`) : ''),
    })
    this.persist()
    return { build: this.buildDto(build, bugs), retestCount: flags.length }
  }

  async regression(envId: number, body: { moduleIds?: number[] }): Promise<{ retestCount: number }> {
    const e = this.envRec(envId)
    const p = this.planRec(e.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    const build = this.currentBuild(envId)
    const flags = regressionFlags(
      this.casesOf(p.planId, false).map((c) => ({ ...c, bug: null })),
      envId,
      build,
      this.iso(),
      body.moduleIds,
    )
    for (const f of flags) {
      const c = this.caseRec(f.testCaseId)
      c.retest = withFlag(c.retest, f.flag)
    }
    this.log(p.planId, ctx.me, {
      type: 'BUILD',
      envId,
      build,
      text: tr(
        `Regression trên ${e.name} ${build ?? ''}: ${flags.length} case cần test lại`,
        `Regression on ${e.name} ${build ?? ''}: ${flags.length} cases to retest`,
      ),
    })
    this.persist()
    return { retestCount: flags.length }
  }

  // ---------- Module, mục, nhóm ----------

  async documentSections(documentId: number): Promise<DocSectionDto[]> {
    await sleep(this.env.latency())
    return this.env.sections(documentId)
  }

  async addModule(planId: number, body: CreateModuleBody): Promise<TestModuleDto> {
    const p = this.planRec(planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    const doc = ctx.index.find((d) => d.documentId === Number(body.documentId))
    if (!doc) validationError({ documentId: [tr('Tài liệu không thuộc dự án.', 'Document not in this project.')] })
    if (this.modulesOf(planId).some((m) => m.documentId === doc!.documentId))
      fail(409, 'MODULE_EXISTS', tr('Tài liệu này đã là một module.', 'This document is already a module.'))
    const sections = await this.env.sections(doc!.documentId).catch(() => [] as DocSectionDto[])
    const pick = body.anchorIds?.length
      ? sections.filter((s) => body.anchorIds!.includes(s.anchorId))
      : defaultModuleSections(sections)
    const m = this.insertModule(p, doc!, trim(body.name) || doc!.title)
    pick.forEach((s) => this.insertSection(m, null, stripHeadingNumber(s.title), s.anchorId))
    this.log(planId, ctx.me, {
      type: 'SETUP',
      moduleId: m.moduleId,
      text: tr(`Tạo module ${m.name} từ ${doc!.code}`, `Created module ${m.name} from ${doc!.code}`),
    })
    this.persist()
    return this.moduleDto(ctx, m)
  }

  private insertModule(p: PlanRec, doc: Pick<DocReqIndex, 'documentId'>, name: string, short?: string): ModuleRec {
    const used = new Set(this.modulesOf(p.planId).map((m) => m.shortCode))
    let code = short ?? shortCodeOf(name)
    for (let n = 2; used.has(code); n++) code = `${(short ?? shortCodeOf(name)).slice(0, 3)}${n}`
    const m: ModuleRec = {
      moduleId: this.nextId(),
      planId: p.planId,
      documentId: doc.documentId,
      name: name.slice(0, 150),
      shortCode: code,
      position: this.modulesOf(p.planId).length,
    }
    this.load().modules.push(m)
    return m
  }

  private insertSection(m: ModuleRec, parent: SectionRec | null, title: string, anchorId: string | null): SectionRec {
    const all = this.load().sections.filter((s) => s.moduleId === m.moduleId)
    const code = parent ? nextGroupCode({ sections: all }, parent) : nextTopCode({ sections: all })
    const s: SectionRec = {
      sectionId: this.nextId(),
      moduleId: m.moduleId,
      parentId: parent?.sectionId ?? null,
      code,
      title: title.slice(0, 200),
      anchorId: parent ? null : anchorId,
      position: all.length,
      reqChanged: false,
    }
    this.load().sections.push(s)
    return s
  }

  async updateModule(moduleId: number, body: { name?: string; position?: number }): Promise<TestModuleDto> {
    const m = this.moduleRec(moduleId)
    const p = this.planRec(m.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    if (body.name !== undefined) {
      if (!trim(body.name) || trim(body.name).length > 150)
        validationError({ name: [tr('Tên module 1–150 ký tự.', 'Module name must be 1–150 characters.')] })
      m.name = trim(body.name)
    }
    if (body.position !== undefined) {
      const list = this.modulesOf(p.planId).filter((x) => x.moduleId !== m.moduleId)
      list.splice(Math.max(0, Math.min(list.length, body.position)), 0, m)
      list.forEach((x, i) => (x.position = i))
    }
    this.log(p.planId, ctx.me, {
      type: 'SETUP',
      moduleId: m.moduleId,
      text: tr(`Sửa module ${m.name}`, `Edited module ${m.name}`),
    })
    this.persist()
    return this.moduleDto(ctx, m)
  }

  async removeModule(moduleId: number): Promise<void> {
    const m = this.moduleRec(moduleId)
    const p = this.planRec(m.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    if (this.casesOf(p.planId, false).some((c) => c.moduleId === m.moduleId))
      fail(409, 'MODULE_NOT_EMPTY', tr('Module còn testcase, không xoá được.', 'The module still has test cases.'))
    const db = this.load()
    db.modules = db.modules.filter((x) => x.moduleId !== m.moduleId)
    db.sections = db.sections.filter((s) => s.moduleId !== m.moduleId)
    db.assigns = db.assigns.filter((a) => a.moduleId !== m.moduleId)
    db.cases = db.cases.filter((c) => c.moduleId !== m.moduleId)
    this.modulesOf(p.planId).forEach((x, i) => (x.position = i))
    this.log(p.planId, ctx.me, { type: 'SETUP', text: tr(`Xoá module ${m.name}`, `Removed module ${m.name}`) })
    this.persist()
  }

  async addSection(moduleId: number, body: SectionBody): Promise<TestSectionDto> {
    const m = this.moduleRec(moduleId)
    const p = this.planRec(m.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCaseManage, true)
    this.open(p)
    const title = trim(body.title)
    if (!title || title.length > 200)
      validationError({ title: [tr('Tên mục / nhóm 1–200 ký tự.', 'Name must be 1–200 characters.')] })
    let parent: SectionRec | null = null
    if (body.parentId !== undefined && body.parentId !== null) {
      parent = this.sectionRec(body.parentId)
      if (parent.moduleId !== m.moduleId || parent.parentId !== null)
        validationError({ parentId: [tr('Nhóm chỉ nằm trong một mục lớn.', 'Groups belong to a top section.')] })
    }
    const anchor = parent ? null : trim(body.anchorId) || null
    if (
      anchor &&
      this.load().sections.some((s) => s.moduleId === m.moduleId && s.parentId === null && s.anchorId === anchor)
    )
      validationError({
        anchorId: [tr('Mục tài liệu này đã có trong module.', 'This document section is already used.')],
      })
    const s = this.insertSection(m, parent, title, anchor)
    this.log(p.planId, ctx.me, {
      type: 'SETUP',
      moduleId: m.moduleId,
      text: parent
        ? tr(`Thêm nhóm ${s.code} ${s.title} vào ${parent.code} ${parent.title}`, `Added group ${s.code} ${s.title}`)
        : tr(`Thêm mục ${s.code} ${s.title}`, `Added section ${s.code} ${s.title}`),
    })
    this.persist()
    return this.sectionDto(s)
  }

  async updateSection(sectionId: number, body: { title?: string; position?: number }): Promise<TestSectionDto> {
    const s = this.sectionRec(sectionId)
    const p = this.planRec(this.moduleRec(s.moduleId).planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCaseManage, true)
    this.open(p)
    if (body.title !== undefined) {
      if (!trim(body.title) || trim(body.title).length > 200)
        validationError({ title: [tr('Tên mục / nhóm 1–200 ký tự.', 'Name must be 1–200 characters.')] })
      s.title = trim(body.title)
    }
    if (body.position !== undefined) s.position = Number(body.position)
    this.log(p.planId, ctx.me, {
      type: 'SETUP',
      moduleId: s.moduleId,
      text: tr(`Sửa ${s.code} ${s.title}`, `Edited ${s.code} ${s.title}`),
    })
    this.persist()
    return this.sectionDto(s)
  }

  async removeSection(sectionId: number): Promise<void> {
    const s = this.sectionRec(sectionId)
    const m = this.moduleRec(s.moduleId)
    const p = this.planRec(m.planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCaseManage, true)
    this.open(p)
    const db = this.load()
    const ids = new Set([s.sectionId, ...db.sections.filter((x) => x.parentId === s.sectionId).map((x) => x.sectionId)])
    if (db.cases.some((c) => ids.has(c.sectionId) && c.status === 'ACTIVE'))
      fail(409, 'SECTION_NOT_EMPTY', tr('Mục / nhóm còn testcase.', 'The section still has test cases.'))
    db.sections = db.sections.filter((x) => !ids.has(x.sectionId))
    db.cases = db.cases.filter((c) => !ids.has(c.sectionId))
    this.log(p.planId, ctx.me, {
      type: 'SETUP',
      moduleId: m.moduleId,
      text: tr(`Xoá ${s.code} ${s.title}`, `Removed ${s.code} ${s.title}`),
    })
    this.persist()
  }

  // ---------- Phân công ----------

  async setAssignments(planId: number, body: AssignmentBody): Promise<TestAssignmentDto[]> {
    return this.atomic(() => this.setAssignmentsTx(planId, body))
  }

  private async setAssignmentsTx(planId: number, body: AssignmentBody): Promise<TestAssignmentDto[]> {
    const p = this.planRec(planId)
    const ctx = await this.ctx(p.projectId, PERMISSIONS.testCasePlan, true)
    this.open(p)
    const people = await this.people(p.projectId)
    const mods = this.modulesOf(planId)
    const envs = this.envsOf(planId)
    const db = this.load()
    for (const it of body.items ?? []) {
      const m = mods.find((x) => x.moduleId === Number(it.moduleId))
      const e = envs.find((x) => x.envId === Number(it.envId))
      if (!m || !e)
        validationError({ items: [tr('Module / môi trường không thuộc đợt test.', 'Unknown module or environment.')] })
      const who = it.assigneeId === null ? null : (people.find((u) => u.userId === Number(it.assigneeId)) ?? null)
      if (it.assigneeId !== null && !who)
        validationError({ assigneeId: [tr('Người này không thuộc dự án.', 'This person is not in the project.')] })
      const cur = this.assignee(m!.moduleId, e!.envId)
      if ((cur?.userId ?? null) === (who?.userId ?? null)) continue
      db.assigns = db.assigns.filter((a) => !(a.moduleId === m!.moduleId && a.envId === e!.envId))
      if (who)
        db.assigns.push({
          moduleId: m!.moduleId,
          envId: e!.envId,
          assignee: { userId: who.userId, fullName: who.fullName },
        })
      this.log(planId, ctx.me, {
        type: 'ASSIGN',
        moduleId: m!.moduleId,
        envId: e!.envId,
        text: who
          ? tr(
              `Module ${m!.name} (${e!.name}): giao cho ${who.fullName}`,
              `${m!.name} (${e!.name}): assigned to ${who.fullName}`,
            )
          : tr(`Module ${m!.name} (${e!.name}): bỏ giao`, `${m!.name} (${e!.name}): unassigned`),
      })
    }
    this.persist()
    return this.assignmentsOf(planId)
  }

  // ---------- Testcase ----------

  async list(projectId: number, q: TestCaseQuery = {}): Promise<TestCaseDto[]> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseView)
    const plan = q.planId !== undefined ? this.planRec(q.planId) : this.currentPlan(projectId)
    if (!plan || plan.projectId !== projectId) return []
    let list = this.casesOf(plan.planId, !!q.includeDeleted)
    if (q.moduleId !== undefined) list = list.filter((c) => c.moduleId === Number(q.moduleId))
    if (q.reqUid)
      list = list.filter((c) =>
        c.links.some(
          (l) => l.reqUid === q.reqUid && (q.documentId === undefined || l.documentId === Number(q.documentId)),
        ),
      )
    else if (q.documentId !== undefined)
      list = list.filter((c) => c.links.some((l) => l.documentId === Number(q.documentId)))
    const needle = q.search?.trim().toLocaleLowerCase('vi')
    if (needle)
      list = list.filter(
        (c) => c.code.toLocaleLowerCase('vi').includes(needle) || c.title.toLocaleLowerCase('vi').includes(needle),
      )
    list = [...list].sort((a, b) => a.moduleId - b.moduleId || a.position - b.position || a.testCaseId - b.testCaseId)
    return this.caseDtos(ctx, list)
  }

  private cleanSteps(steps: TestStep[] | undefined): TestStep[] {
    return (steps ?? [])
      .map((s) => ({ action: String(s?.action ?? '').trim(), expected: String(s?.expected ?? '').trim() }))
      .filter((s) => s.action || s.expected)
  }

  private validateCase(
    body: Pick<UpdateTestCaseBody, 'title' | 'priority' | 'preconditions' | 'status'>,
    creating: boolean,
  ) {
    const errors: Record<string, string[]> = {}
    if ((creating || body.title !== undefined) && (!trim(body.title) || trim(body.title).length > 300))
      errors.title = [tr('Tên testcase bắt buộc, tối đa 300 ký tự.', 'Title is required, max 300 characters.')]
    if (body.priority !== undefined && !TEST_PRIORITIES.includes(body.priority))
      errors.priority = [tr('Mức độ không hợp lệ.', 'Invalid priority.')]
    if (body.preconditions && body.preconditions.length > 2000)
      errors.preconditions = [tr('Điều kiện tối đa 2000 ký tự.', 'Preconditions max 2000 characters.')]
    if (body.status !== undefined && body.status !== 'ACTIVE' && body.status !== 'DELETED')
      errors.status = [tr('Trạng thái không hợp lệ.', 'Invalid status.')]
    if (Object.keys(errors).length) validationError(errors)
  }

  /** Mã TC_n theo bộ đếm của module (không dùng lại mã của case đã xoá hẳn khi xoá mục / nhóm). */
  private nextCode(m: ModuleRec, codes: string[]): string {
    const fromCodes = Number(nextCaseCode(codes).slice(3)) - 1
    const n = Math.max(m.caseSeq ?? 0, fromCodes) + 1
    m.caseSeq = n
    return `TC_${n}`
  }

  /**
   * Chạy một thao tác ghi nguyên khối như transaction của BE: lỗi giữa chừng thì trả DB về trạng thái trước
   * (bug đã tạo bên kho Kanban không hoàn tác — giống gọi một service ngoài).
   */
  private async atomic<T>(fn: () => Promise<T>): Promise<T> {
    const snapshot = clone(this.load())
    try {
      return await fn()
    } catch (err) {
      this.db = snapshot
      throw err
    }
  }

  private insertCase(
    ctx: Ctx,
    plan: PlanRec,
    section: SectionRec,
    body: Omit<CreateTestCaseBody, 'sectionId'>,
    at = this.iso(),
  ): CaseRec {
    this.validateCase(body, true)
    const m = this.moduleRec(section.moduleId)
    const codes = this.load()
      .cases.filter((c) => c.moduleId === m.moduleId)
      .map((c) => c.code)
    const inSection = this.load()
      .cases.filter((c) => c.sectionId === section.sectionId)
      .sort(byPos)
    let position = inSection.length ? inSection[inSection.length - 1].position + 1 : 0
    if (body.afterTestCaseId) {
      const after = inSection.find((c) => c.testCaseId === Number(body.afterTestCaseId))
      if (after) {
        position = after.position + 1
        for (const c of inSection) if (c.position >= position) c.position += 1
      }
    }
    const c: CaseRec = {
      testCaseId: this.nextId(),
      planId: plan.planId,
      moduleId: m.moduleId,
      sectionId: section.sectionId,
      code: this.nextCode(m, codes),
      title: trim(body.title),
      preconditions: trim(body.preconditions) || null,
      steps: this.cleanSteps(body.steps),
      actual: trim(body.actual) || null,
      links: newLinks(ctx.index, body.requirementRefs),
      aiSuggestedReqs: !!body.aiSuggestedReqs,
      priority: body.priority ?? 'MEDIUM',
      category: trim(body.category) || (section.parentId !== null ? section.title : null),
      browser: trim(body.browser) || null,
      customFields: {
        ...defaultCustomFields(plan.layout.customColumns, at.slice(0, 10)),
        ...(body.customFields ?? {}),
      },
      status: 'ACTIVE',
      position,
      bugId: null,
      results: [],
      retest: [],
      createdAt: at,
      updatedAt: at,
    }
    this.load().cases.push(c)
    return c
  }

  async create(projectId: number, body: CreateTestCaseBody): Promise<TestCaseDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseManage, true)
    const s = this.sectionRec(body.sectionId)
    const plan = this.planRec(this.moduleRec(s.moduleId).planId)
    if (plan.projectId !== projectId) validationError({ sectionId: [tr('Mục không thuộc dự án.', 'Unknown section.')] })
    this.open(plan)
    const c = this.insertCase(ctx, plan, s, body)
    this.log(plan.planId, ctx.me, {
      type: 'TESTCASE',
      moduleId: c.moduleId,
      testCaseId: c.testCaseId,
      text: tr(`Thêm testcase vào ${s.code} ${s.title}`, `Added a test case to ${s.code} ${s.title}`),
    })
    this.persist()
    return (await this.caseDtos(ctx, [c]))[0]
  }

  async get(testCaseId: number): Promise<TestCaseDto> {
    const c = this.caseRec(testCaseId)
    const ctx = await this.ctx(this.planRec(c.planId).projectId, PERMISSIONS.testCaseView)
    return (await this.caseDtos(ctx, [c]))[0]
  }

  /** Áp một thay đổi lên case (đã kiểm quyền + đợt đang mở). */
  private applyChanges(ctx: Ctx, c: CaseRec, body: UpdateTestCaseBody) {
    this.validateCase(body, false)
    const plan = c.planId
    if (body.title !== undefined) c.title = trim(body.title)
    if (body.preconditions !== undefined) c.preconditions = trim(body.preconditions) || null
    if (body.steps !== undefined) c.steps = this.cleanSteps(body.steps)
    if (body.actual !== undefined) c.actual = trim(body.actual) || null
    if (body.priority !== undefined) c.priority = body.priority
    if (body.category !== undefined) c.category = trim(body.category) || null
    if (body.browser !== undefined) c.browser = trim(body.browser) || null
    if (body.customFields !== undefined) {
      for (const [k, v] of Object.entries(body.customFields)) {
        if (v === null || v === '' || (Array.isArray(v) && !v.length)) delete c.customFields[k]
        else c.customFields[k] = v
      }
    }
    if (body.requirementRefs !== undefined) {
      const before = c.links.map((l) => this.reqLabel(ctx.index, l)).join(', ')
      c.links = newLinks(ctx.index, body.requirementRefs, c.links)
      const after = c.links.map((l) => this.reqLabel(ctx.index, l)).join(', ')
      if (before !== after || c.aiSuggestedReqs)
        this.log(plan, ctx.me, {
          type: 'REQ',
          moduleId: c.moduleId,
          testCaseId: c.testCaseId,
          text: `REQ: ${after || tr('(bỏ hết)', '(none)')}`,
        })
    }
    if (body.aiSuggestedReqs === false) c.aiSuggestedReqs = false
    if (body.sectionId !== undefined && Number(body.sectionId) !== c.sectionId) {
      const s = this.sectionRec(body.sectionId)
      if (s.moduleId !== c.moduleId)
        validationError({ sectionId: [tr('Chỉ chuyển trong module.', 'Same module only.')] })
      c.sectionId = s.sectionId
    }
    if (body.status !== undefined && body.status !== c.status) {
      c.status = body.status
      this.log(plan, ctx.me, {
        type: 'TESTCASE',
        moduleId: c.moduleId,
        testCaseId: c.testCaseId,
        text:
          body.status === 'DELETED'
            ? tr('Delete — không tính vào tổng', 'Deleted — not counted')
            : tr('Khôi phục testcase', 'Restored'),
      })
    }
    c.updatedAt = this.iso()
  }

  async update(testCaseId: number, body: UpdateTestCaseBody): Promise<TestCaseDto> {
    const c = this.caseRec(testCaseId)
    const plan = this.planRec(c.planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCaseManage, true)
    this.open(plan)
    this.applyChanges(ctx, c, body)
    this.persist()
    return (await this.caseDtos(ctx, [c]))[0]
  }

  async remove(testCaseId: number): Promise<void> {
    await this.update(testCaseId, { status: 'DELETED' })
  }

  async bulkUpdate(planId: number, body: BulkUpdateBody): Promise<TestCaseDto[]> {
    return this.atomic(() => this.bulkUpdateTx(planId, body))
  }

  private async bulkUpdateTx(planId: number, body: BulkUpdateBody): Promise<TestCaseDto[]> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCaseManage, true)
    this.open(plan)
    const list = (body.items ?? []).map((it) => {
      const c = this.caseRec(it.testCaseId)
      if (c.planId !== plan.planId)
        validationError({ items: [tr('Testcase không thuộc đợt test.', 'Unknown test case.')] })
      return { c, changes: it.changes }
    })
    for (const { c, changes } of list) this.applyChanges(ctx, c, changes)
    this.persist()
    return this.caseDtos(
      ctx,
      list.map((x) => x.c),
    )
  }

  // ---------- Kết quả & bug ----------

  async recordResult(testCaseId: number, body: { envId: number; result: TestResult }): Promise<RecordResultsResult> {
    const c = this.caseRec(testCaseId)
    return this.recordResults(c.planId, { envId: body.envId, testCaseIds: [testCaseId], result: body.result })
  }

  async recordResults(planId: number, body: RecordResultsBody): Promise<RecordResultsResult> {
    return this.atomic(() => this.recordResultsTx(planId, body))
  }

  private async recordResultsTx(planId: number, body: RecordResultsBody): Promise<RecordResultsResult> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCaseExecute, true)
    this.open(plan)
    const env = this.envRec(body.envId)
    if (env.planId !== plan.planId)
      validationError({ envId: [tr('Môi trường không thuộc đợt test.', 'Unknown environment.')] })
    if (!isTestResult(body.result)) validationError({ result: [tr('Kết quả không hợp lệ.', 'Invalid result.')] })
    const ids = [...new Set((body.testCaseIds ?? []).map(Number))]
    if (!ids.length) validationError({ testCaseIds: [tr('Chọn ít nhất 1 testcase.', 'Pick at least 1 test case.')] })
    const cases = ids.map((id) => this.caseRec(id))
    if (cases.some((c) => c.planId !== plan.planId || c.status !== 'ACTIVE'))
      validationError({ testCaseIds: [tr('Có testcase không dùng được.', 'Some test cases are not available.')] })
    const bugs = await this.bugMap(
      ctx.projectId,
      cases.map((c) => c.bugId),
    )
    const build = this.currentBuild(env.envId)
    const at = this.iso()
    const needBug: number[] = []
    const reopened: { issueId: number; key: string }[] = []
    for (const c of cases) {
      const prev = statusIn(c, env.envId)
      const owner = this.assignee(c.moduleId, env.envId)
      const behalfOf = owner && owner.userId !== ctx.me.userId ? { ...owner } : null
      c.results.push({
        resultId: this.nextId(),
        envId: env.envId,
        build,
        result: body.result,
        by: ctx.me,
        at,
        behalfOf,
      })
      c.retest = withoutFlag(c.retest, env.envId)
      c.updatedAt = at
      this.log(plan.planId, ctx.me, {
        type: 'RESULT',
        envId: env.envId,
        moduleId: c.moduleId,
        testCaseId: c.testCaseId,
        from: prev,
        to: body.result,
        build,
        behalfOf,
        at,
      })
      const bug = c.bugId ? (bugs.get(c.bugId) ?? null) : null
      const out = recordOutcome(body.result, bug)
      if (out.needBug) needBug.push(c.testCaseId)
      // Fail nhiều case cùng một bug: chỉ mở lại bug một lần (bug lúc đó không còn DONE nữa).
      if (out.reopenBug && bug && !reopened.some((r) => r.issueId === bug.issueId)) {
        const note = tr(
          `Vẫn lỗi trên ${env.name} ${build ?? ''} → mở lại`,
          `Still failing on ${env.name} ${build ?? ''}`,
        )
        if (await this.issues.reopenDefect(ctx.projectId, bug.issueId, ctx.me, note))
          reopened.push({ issueId: bug.issueId, key: bug.key })
        this.log(plan.planId, ctx.me, {
          type: 'BUG',
          envId: env.envId,
          moduleId: c.moduleId,
          testCaseId: c.testCaseId,
          text: tr(
            `${bug.key} vẫn lỗi trên ${build ?? env.name} → mở lại trên Kanban`,
            `${bug.key} reopened on Kanban`,
          ),
        })
      }
      if (out.confirmFix && bug)
        this.log(plan.planId, ctx.me, {
          type: 'BUG',
          envId: env.envId,
          moduleId: c.moduleId,
          testCaseId: c.testCaseId,
          text: tr(`${bug.key} xác nhận đã fix (Pass trên ${build ?? env.name})`, `${bug.key} confirmed fixed`),
        })
    }
    this.persist()
    return { items: await this.caseDtos(ctx, cases), needBug, reopened }
  }

  async createBug(
    planId: number,
    body: CreateBugBody,
  ): Promise<{ issue: { issueId: number; key: string }; items: TestCaseDto[] }> {
    return this.atomic(() => this.createBugTx(planId, body))
  }

  private async createBugTx(
    planId: number,
    body: CreateBugBody,
  ): Promise<{ issue: { issueId: number; key: string }; items: TestCaseDto[] }> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCaseExecute, true)
    this.need(ctx, PERMISSIONS.issueCreate)
    this.open(plan)
    const env = this.envRec(body.envId)
    const title = trim(body.title)
    const errors: Record<string, string[]> = {}
    if (!title || title.length > 300) errors.title = [tr('Nhập tiêu đề bug (≤ 300 ký tự).', 'Enter a bug title.')]
    if (!BUG_SEVERITIES.includes(body.priority)) errors.priority = [tr('Mức độ không hợp lệ.', 'Invalid severity.')]
    if (env.planId !== plan.planId) errors.envId = [tr('Môi trường không thuộc đợt test.', 'Unknown environment.')]
    const cases = [...new Set((body.testCaseIds ?? []).map(Number))].map((id) => this.caseRec(id))
    if (!cases.length || cases.some((c) => c.planId !== plan.planId || c.status !== 'ACTIVE'))
      errors.testCaseIds = [tr('Chọn testcase đang dùng của đợt test.', 'Pick active test cases of this plan.')]
    if (Object.keys(errors).length) validationError(errors)
    const refs: RequirementRef[] = []
    for (const c of cases)
      for (const l of c.links)
        if (!refs.some((r) => r.documentId === l.documentId && r.reqUid === l.reqUid))
          refs.push({ documentId: l.documentId, reqUid: l.reqUid })
    const build = this.currentBuild(env.envId)
    const description = trim(body.description) || this.bugDescription(cases, env.name, build)
    const issue = await this.issues.createDefect(ctx.projectId, {
      title,
      priority: body.priority as IssuePriority,
      refs,
      description: description.slice(0, 10_000),
    })
    for (const c of cases) {
      c.bugId = issue.issueId
      this.log(plan.planId, ctx.me, {
        type: 'BUG',
        envId: env.envId,
        moduleId: c.moduleId,
        testCaseId: c.testCaseId,
        text: tr(`Tạo ${issue.key} trên Kanban`, `Created ${issue.key} on Kanban`),
      })
    }
    this.persist()
    return { issue: { issueId: issue.issueId, key: issue.key }, items: await this.caseDtos(ctx, cases) }
  }

  /** Mô tả bug ghép từ testcase: bước, mong đợi, thực tế, môi trường + build. */
  private bugDescription(cases: CaseRec[], env: string, build: string | null): string {
    const c = cases[0]
    const m = this.moduleRec(c.moduleId)
    const text = stepsToText(c.steps)
    return [
      `${tr('Testcase', 'Test case')}: ${cases.map((x) => `${m.shortCode}·${x.code}`).join(', ')} — ${c.title}`,
      `${tr('Môi trường', 'Environment')}: ${env}${build ? ` · build ${build}` : ''}`,
      c.preconditions ? `${tr('Điều kiện', 'Preconditions')}:\n${c.preconditions}` : '',
      text.steps ? `${tr('Các bước', 'Steps')}:\n${text.steps}` : '',
      text.expected ? `${tr('Kết quả mong đợi', 'Expected')}:\n${text.expected}` : '',
      c.actual ? `${tr('Kết quả thực tế', 'Actual')}:\n${c.actual}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  async linkBug(planId: number, issueId: number, body: { testCaseIds: number[] }): Promise<TestCaseDto[]> {
    return this.atomic(() => this.linkBugTx(planId, issueId, body))
  }

  private async linkBugTx(planId: number, issueId: number, body: { testCaseIds: number[] }): Promise<TestCaseDto[]> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCaseExecute, true)
    // Gắn bug có sẵn: testcase.execute + issue.view (phải xem được bug để chọn) — cùng luật với FE (abilities.linkBug).
    this.need(ctx, PERMISSIONS.issueView)
    this.open(plan)
    const [bug] = await this.issues.bugRefs(ctx.projectId, [Number(issueId)])
    if (!bug || bug.type !== 'BUG') fail(404, 'ISSUE_NOT_FOUND', tr('Không tìm thấy bug.', 'Bug not found.'))
    const cases = [...new Set((body.testCaseIds ?? []).map(Number))].map((id) => this.caseRec(id))
    if (!cases.length || cases.some((c) => c.planId !== plan.planId || c.status !== 'ACTIVE'))
      validationError({ testCaseIds: [tr('Chọn testcase của đợt test.', 'Pick test cases of this plan.')] })
    for (const c of cases) {
      c.bugId = bug.issueId
      this.log(plan.planId, ctx.me, {
        type: 'BUG',
        moduleId: c.moduleId,
        testCaseId: c.testCaseId,
        text: tr(`Gắn vào ${bug.key} (Kanban)`, `Linked to ${bug.key} (Kanban)`),
      })
    }
    this.persist()
    return this.caseDtos(ctx, cases)
  }

  // ---------- Bàn giao ----------

  /** Cảnh báo trước khi bàn giao (không chặn): case chưa test / cần test lại, bug mở, module chưa giao. */
  private async handoverWarnings(ctx: Ctx, plan: PlanRec): Promise<number> {
    const envs = this.envsOf(plan.planId)
    const cases = this.casesOf(plan.planId, false)
    let n = 0
    if (cases.some((c) => envs.some((e) => ['UNTEST', 'RETEST'].includes(statusIn(c, e.envId))))) n++
    const bugs = await this.bugMap(
      ctx.projectId,
      cases.map((c) => c.bugId),
    )
    if ([...bugs.values()].some((b) => b.statusCategory !== 'DONE')) n++
    if (this.modulesOf(plan.planId).some((m) => envs.some((e) => !this.assignee(m.moduleId, e.envId)))) n++
    return n
  }

  async handover(planId: number, body: { note: string | null }): Promise<TestPlanDto> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCasePlan, true)
    this.open(plan)
    const note = trim(body?.note) || null
    if (!note && (await this.handoverWarnings(ctx, plan)) > 0)
      validationError({
        note: [tr('Còn cảnh báo — ghi chú lý do bàn giao.', 'There are warnings — add a handover note.')],
      })
    plan.status = 'HANDED_OVER'
    plan.handover = { by: ctx.me, at: this.iso(), note }
    this.log(plan.planId, ctx.me, {
      type: 'HANDOVER',
      text: tr(`Hoàn tất & bàn giao ${plan.name}`, `Handed over ${plan.name}`) + (note ? ` — ${note}` : ''),
    })
    this.persist()
    return this.planDto(ctx, plan)
  }

  async reopen(planId: number): Promise<TestPlanDto> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCasePlan, true)
    if (plan.status !== 'HANDED_OVER') return this.planDto(ctx, plan)
    plan.status = 'OPEN'
    plan.handover = null
    this.log(plan.planId, ctx.me, { type: 'HANDOVER', text: tr('Mở lại đợt test', 'Reopened the test plan') })
    this.persist()
    return this.planDto(ctx, plan)
  }

  // ---------- Bố cục bảng ----------

  async saveLayout(planId: number, body: SheetLayoutDto): Promise<SheetLayoutDto> {
    const plan = this.planRec(planId)
    await this.ctx(plan.projectId, PERMISSIONS.testCaseManage, true)
    this.open(plan)
    const cols = body.customColumns ?? []
    const ids = new Set<string>()
    for (const c of cols) {
      const err = validateColumn(c, tr) ?? (ids.has(c.columnId) ? tr('Trùng id cột.', 'Duplicate column id.') : null)
      if (err) validationError({ customColumns: [err] })
      ids.add(c.columnId)
    }
    const widths: Record<string, number> = {}
    for (const [k, v] of Object.entries(body.widths ?? {}))
      if (Number.isFinite(v)) widths[k] = Math.max(56, Math.min(600, Math.round(v)))
    plan.layout = {
      order: [...new Set((body.order ?? []).map(String))],
      labels: Object.fromEntries(
        Object.entries(body.labels ?? {})
          .map(([k, v]) => [k, trim(v).slice(0, 60)])
          .filter(([, v]) => v),
      ),
      widths,
      customColumns: clone(cols),
    }
    this.persist()
    return clone(plan.layout)
  }

  // ---------- Lịch sử & đối chiếu ----------

  async activity(planId: number, q: ActivityQuery = {}): Promise<TestActivityDto[]> {
    const plan = this.planRec(planId)
    await this.ctx(plan.projectId, PERMISSIONS.testCaseView)
    if (q.type !== undefined && !TEST_ACTIVITY_TYPES.includes(q.type))
      validationError({ type: [tr('Loại thao tác không hợp lệ.', 'Invalid type.')] })
    return this.load()
      .activity.filter(
        (a) =>
          a.planId === plan.planId &&
          (q.testCaseId === undefined || a.testCaseId === Number(q.testCaseId)) &&
          (q.actorId === undefined || a.actor.userId === Number(q.actorId)) &&
          (q.type === undefined || a.type === q.type) &&
          (q.moduleId === undefined || a.moduleId === Number(q.moduleId)),
      )
      .sort((a, b) => b.at.localeCompare(a.at) || b.activityId - a.activityId)
      .map((a) => clone(a))
  }

  async traceability(planId: number, envId: number): Promise<TraceRowDto[]> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCaseView)
    const env = this.envRec(envId)
    const cases = this.casesOf(plan.planId, false)
    const bugs = await this.bugMap(
      ctx.projectId,
      cases.map((c) => c.bugId),
    )
    const moduleDocs = new Set(this.modulesOf(plan.planId).map((m) => m.documentId))
    const linkedDocs = new Set(cases.flatMap((c) => c.links.map((l) => l.documentId)))
    const rows: TraceRowDto[] = []
    for (const doc of ctx.index.filter((d) => moduleDocs.has(d.documentId) || linkedDocs.has(d.documentId))) {
      const reqs: ReqLite[] = [
        ...doc.baseline,
        ...doc.current.filter((r) => !doc.baseline.some((b) => b.reqUid === r.reqUid)),
      ]
      for (const r of reqs.sort((a, b) => a.reqKey.localeCompare(b.reqKey, undefined, { numeric: true }))) {
        const list = cases.filter((c) => c.links.some((l) => l.documentId === doc.documentId && l.reqUid === r.reqUid))
        const statuses = list.map((c) => statusIn(c, env.envId))
        const bugIds = [...new Set(list.map((c) => c.bugId).filter((x): x is number => !!x))]
        rows.push({
          documentId: doc.documentId,
          documentCode: doc.code,
          documentTitle: doc.title,
          reqUid: r.reqUid,
          reqKey: r.reqKey,
          title: r.title,
          anchorId: r.anchorId ?? null,
          changed: list.some((c) =>
            c.links.some((l) => l.documentId === doc.documentId && l.reqUid === r.reqUid && !!l.changedLabel),
          ),
          status: traceStatusOf(statuses),
          cases: list.map((c, i) => ({
            testCaseId: c.testCaseId,
            moduleId: c.moduleId,
            code: c.code,
            title: c.title,
            status: statuses[i],
            ai: c.aiSuggestedReqs,
          })),
          bugs: bugIds.map((id) => ({ issueId: id, key: bugs.get(id)?.key ?? `#${id}` })),
        })
      }
    }
    return rows
  }

  // ---------- AI ----------

  private async reqSections(index: DocReqIndex[], documentIds: number[]) {
    const out = new Map<number, DocSectionDto[]>()
    for (const id of [...new Set(documentIds)])
      out.set(id, index.some((d) => d.documentId === id) ? await this.env.sections(id).catch(() => []) : [])
    return out
  }

  async suggest(projectId: number, body: { planId: number; refs: RequirementRef[] }): Promise<SuggestedTestCaseDto[]> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCaseManage, true)
    this.need(ctx, PERMISSIONS.aiUse)
    if (!ctx.aiEnabled) fail(409, 'AI_DISABLED', tr('Dự án đang tắt module AI.', 'AI is turned off for this project.'))
    if (!body?.refs?.length) validationError({ refs: [tr('Chọn ít nhất 1 REQ.', 'Pick at least 1 REQ.')] })
    const plan = this.planRec(body.planId)
    const links = newLinks(ctx.index, body.refs)
    const secs = await this.reqSections(
      ctx.index,
      links.map((l) => l.documentId),
    )
    const modules = this.modulesOf(plan.planId).map((m) => this.moduleDto(ctx, m))
    const existing = this.casesOf(plan.planId, false)
    const items: SuggestedTestCaseDto[] = []
    let n = 0
    for (const link of links) {
      const { doc, req } = findReq(ctx.index, link.documentId, link.reqUid)
      if (!doc || !req) continue
      const section = sectionOfReq(secs.get(doc.documentId) ?? [], req.reqUid)
      const where = {
        documentId: doc.documentId,
        anchorId: section?.anchorId ?? null,
        title: section ? stripHeadingNumber(section.title) : doc.title,
      }
      const covered = existing
        .filter((c) => c.links.some((l) => l.documentId === doc.documentId && l.reqUid === req.reqUid))
        .map((c) => norm([c.title, ...c.steps.flatMap((s) => [s.action, s.expected])].join(' ')))
      const priority: TestPriority = req.priority === 'HIGH' ? 'HIGH' : req.priority === 'LOW' ? 'LOW' : 'MEDIUM'
      const push = (title: string, category: string, steps: TestStep[], prio: TestPriority, from: string | null) => {
        if (covered.some((h) => h.includes(norm(title)))) return
        items.push({
          tempId: `s-${++n}`,
          title: title.slice(0, 300),
          preconditions: null,
          priority: prio,
          category,
          steps,
          requirementRef: { documentId: doc.documentId, reqUid: req.reqUid },
          fromCriterion: from,
          placement: findPlacement(modules, where, category),
        })
      }
      for (const cr of req.acceptanceCriteria) {
        const text = cr.text.trim()
        if (!text) continue
        push(text, 'Chức năng', [{ action: tr(`Thực hiện: ${text}`, `Do: ${text}`), expected: text }], priority, text)
      }
      if (!req.acceptanceCriteria.length)
        push(
          tr(`${req.title} — luồng chính`, `${req.title} — main flow`),
          'Chức năng',
          [
            { action: tr('Mở chức năng', 'Open the feature'), expected: '' },
            { action: tr('Nhập dữ liệu hợp lệ', 'Enter valid data'), expected: '' },
            { action: tr('Xác nhận', 'Confirm'), expected: tr(`${req.title} thành công`, `${req.title} succeeds`) },
          ],
          priority,
          null,
        )
      push(
        tr(`${req.title} — dữ liệu không hợp lệ`, `${req.title} — invalid data`),
        'Validate',
        [
          { action: tr('Mở chức năng', 'Open the feature'), expected: '' },
          { action: tr('Nhập dữ liệu sai / để trống', 'Enter invalid / empty data'), expected: '' },
          {
            action: tr('Xác nhận', 'Confirm'),
            expected: tr('Báo lỗi đúng thông điệp, không lưu', 'Shows the right error, nothing saved'),
          },
        ],
        'MEDIUM',
        null,
      )
    }
    return items
  }

  async aiApply(planId: number, body: { items: AiApplyItem[] }): Promise<TestCaseDto[]> {
    return this.atomic(() => this.aiApplyTx(planId, body))
  }

  private async aiApplyTx(planId: number, body: { items: AiApplyItem[] }): Promise<TestCaseDto[]> {
    const plan = this.planRec(planId)
    const ctx = await this.ctx(plan.projectId, PERMISSIONS.testCaseManage, true)
    this.need(ctx, PERMISSIONS.aiUse)
    if (!ctx.aiEnabled) fail(409, 'AI_DISABLED', tr('Dự án đang tắt module AI.', 'AI is turned off for this project.'))
    this.open(plan)
    if (!body?.items?.length) validationError({ items: [tr('Chọn ít nhất 1 testcase.', 'Pick at least 1 test case.')] })
    const secs = await this.reqSections(
      ctx.index,
      body.items.map((x) => Number(x.requirementRef?.documentId)),
    )
    const created: CaseRec[] = []
    for (const it of body.items) {
      const { doc, req } = findReq(ctx.index, Number(it.requirementRef?.documentId), String(it.requirementRef?.reqUid))
      if (!doc || !req)
        fail(
          400,
          'INVALID_REQUIREMENT',
          tr('REQ không thuộc dự án hoặc không tồn tại.', "The REQ doesn't exist in this project."),
        )
      const section = sectionOfReq(secs.get(doc!.documentId) ?? [], req!.reqUid)
      const category = trim(it.category) || 'Chức năng'
      let m = this.modulesOf(plan.planId).find((x) => x.documentId === doc!.documentId)
      if (!m) {
        m = this.insertModule(plan, doc!, doc!.title)
        this.log(plan.planId, ctx.me, {
          type: 'SETUP',
          moduleId: m.moduleId,
          text: tr(`Tạo module ${m.name} từ ${doc!.code} (AI)`, `Created module ${m.name} (AI)`),
        })
      }
      const tops = this.load().sections.filter((s) => s.moduleId === m!.moduleId && s.parentId === null)
      let top = section
        ? tops.find((s) => s.anchorId === section.anchorId)
        : tops.find((s) => s.anchorId === null && norm(s.title) === norm(doc!.title))
      top ??= this.insertSection(
        m,
        null,
        section ? stripHeadingNumber(section.title) : doc!.title,
        section?.anchorId ?? null,
      )
      let group = this.load().sections.find((s) => s.parentId === top!.sectionId && norm(s.title) === norm(category))
      group ??= this.insertSection(m, top, category, null)
      const c = this.insertCase(ctx, plan, group, {
        title: it.title,
        preconditions: it.preconditions ?? null,
        steps: it.steps,
        requirementRefs: [{ documentId: doc!.documentId, reqUid: req!.reqUid }],
        aiSuggestedReqs: true,
        priority: TEST_PRIORITIES.includes(it.priority) ? it.priority : 'MEDIUM',
        category,
      })
      created.push(c)
      this.log(plan.planId, ctx.me, {
        type: 'REQ',
        moduleId: m.moduleId,
        testCaseId: c.testCaseId,
        text: tr(
          `AI sinh testcase cho ${req!.reqKey} → ${m.name} › ${top.code} › ${group.code} ${category}`,
          `AI generated a test case for ${req!.reqKey} → ${m.name} › ${top.code} › ${group.code} ${category}`,
        ),
      })
    }
    this.persist()
    return this.caseDtos(ctx, created)
  }

  // ---------- Dữ liệu mẫu ----------

  hasData(projectId: number) {
    return this.load().plans.some((p) => p.projectId === projectId)
  }

  /**
   * Đợt test mẫu bám mockup testcases-combined.html: 3 môi trường (SIT / UAT / Staging), module từ SRS-014 / URD-014 /
   * SRS-020 (tài liệu mẫu testSpecSeed.ts; nếu dự án không có thì lấy tối đa 3 tài liệu có REQ), vài kết quả, 2 bug.
   */
  async seedDemo(projectId: number): Promise<boolean> {
    const ctx = await this.ctx(projectId, PERMISSIONS.testCasePlan, true)
    if (this.hasData(projectId)) return false
    const db = this.load()
    db.seeded.push(projectId)
    const isSec = projectId >= 20
    const me: UserRef = isSec ? { userId: 5, fullName: 'Trương Quang Tâm' } : ctx.me
    const tam: UserRef = isSec ? { userId: 11, fullName: 'Lê Thị Khánh Linh' } : DEMO_PEOPLE[1]
    const dev: UserRef = isSec ? { userId: 4, fullName: 'Phạm Minh Lương' } : DEMO_PEOPLE[3]
    const day = 86_400_000
    const iso = (days: number, hours = 0) => this.iso(days * day + hours * 3_600_000)
    const date = (days: number) => iso(days).slice(0, 10)
    const plan: PlanRec = {
      planId: this.nextId(),
      projectId,
      name: isSec ? 'SIT – Release 3.2 (KRX Go-Live)' : 'SIT – Release 3',
      startDate: date(-7),
      endDate: date(7),
      status: 'OPEN',
      handover: null,
      layout: emptyLayout(),
      createdAt: iso(-8),
    }
    db.plans.push(plan)
    const env = (name: string, url: string, note: string, version: string, daysAgo: number) => {
      const e: EnvRec = {
        envId: this.nextId(),
        planId: plan.planId,
        name,
        url,
        note,
        position: this.envsOf(plan.planId).length,
      }
      db.envs.push(e)
      db.builds.push({
        buildId: this.nextId(),
        envId: e.envId,
        version,
        deployedAt: iso(-daysAgo),
        deployedBy: dev,
        fixedIssueIds: [],
      })
      this.log(plan.planId, dev, {
        type: 'BUILD',
        envId: e.envId,
        build: version,
        at: iso(-daysAgo),
        text: tr(`Deploy build ${version} lên ${name}`, `Deployed ${version} to ${name}`),
      })
      return e
    }
    const sit = env(
      'SIT',
      isSec ? 'https://sit-krx.kibosecurities.vn' : 'https://sit.mbrpay.local',
      isSec ? 'Môi trường tích hợp nội bộ kết nối Simulator Sở GDCK (FIX 4.4)' : 'QA nội bộ test chính',
      'v1.0.1',
      7,
    )
    env(
      'UAT',
      isSec ? 'https://uat-krx.kibosecurities.vn' : 'https://uat.mbrpay.local',
      isSec ? 'Môi trường nghiệm thu cùng Khối Môi giới & Vận hành Lưu ký VSD' : 'Giống môi trường khách',
      'v1.0.0',
      10,
    )
    env(
      'Staging',
      isSec ? 'https://stg-krx.kibosecurities.vn' : 'https://stg.mbrpay.local',
      isSec ? 'Môi trường Pre-Production kiểm thử tải 50.000 lệnh/giây' : 'Trước khi lên production',
      'v1.0.1',
      7,
    )

    const byCode = (code: string) => ctx.index.find((d) => d.code === code)
    const fee = byCode('SRS-014')
    const qr = byCode('URD-014')
    const rpt = byCode('SRS-020')
    if (!fee || !qr || !rpt) {
      // Dự án không có tài liệu mẫu (vd Tài liệu chạy BE thật): module theo tối đa 3 tài liệu có REQ, mục theo heading.
      for (const d of ctx.index.filter((x) => x.baseline.length || x.current.length).slice(0, 3)) {
        const m = this.insertModule(plan, d, d.title)
        const sections = defaultModuleSections(await this.env.sections(d.documentId).catch(() => []))
        for (const s of sections) this.insertSection(m, null, stripHeadingNumber(s.title), s.anchorId)
        if (!sections.length) this.insertSection(m, null, d.title, null)
      }
      this.persist()
      return true
    }

    const ref = (d: DocReqIndex, uid: string): RequirementRef => ({ documentId: d.documentId, reqUid: uid })
    const bugLow = await this.issues.createDefect(projectId, {
      title: isSec ? 'Cho phép lưu tỷ lệ phí môi giới cổ phiếu âm (-0.15%)' : 'Cho lưu mức phí âm',
      priority: 'HIGH',
      assigneeId: isSec ? 10 : null,
      refs: [ref(fee, FEE_REQ.limit)],
      description: isSec
        ? 'TC_7 · Nhập tỷ lệ phí môi giới -0.15% trên màn hình Cấu hình phí KRX → hệ thống vẫn cho lưu vào DB.'
        : 'TC_7 · Nhập mức phí -1 → vẫn lưu được.',
    })
    const bugQr = await this.issues.createDefect(projectId, {
      title: isSec
        ? 'Mã VietQR định danh 9688 quá hạn 15 phút vẫn hạch toán cộng Sức mua T+0'
        : 'QR hết hạn vẫn thanh toán được',
      priority: 'HIGHEST',
      assigneeId: isSec ? 4 : null,
      refs: [ref(qr, QR_REQ.expired)],
      description: isSec
        ? 'TC_2 · Quét mã QR nộp tiền ký quỹ đã quá hạn 15 phút → Core Cash vẫn tự động cộng sức mua thay vì chuyển treo đối soát.'
        : 'TC_2 · Quét QR quá 15 phút → vẫn cho thanh toán.',
      inProgress: true,
    })

    type Seed = {
      title: string
      reqs?: string[]
      cond?: string
      steps?: string[]
      expected?: string[]
      actual?: string
      prio?: TestPriority
      ai?: boolean
      bug?: number
      res?: TestResult
      by?: UserRef
      hoursAgo?: number
      deleted?: boolean
    }
    const add = (d: DocReqIndex, group: SectionRec, s: Seed) => {
      const c = this.insertCase(
        ctx,
        plan,
        group,
        {
          title: s.title,
          preconditions: s.cond ?? null,
          steps: (s.steps ?? []).map((a, i) => ({ action: a, expected: s.expected?.[i] ?? '' })),
          actual: s.actual ?? null,
          requirementRefs: (s.reqs ?? []).map((u) => ref(d, u)),
          aiSuggestedReqs: !!s.ai,
          priority: s.prio ?? 'MEDIUM',
        },
        iso(-7),
      )
      if (s.deleted) c.status = 'DELETED'
      if (s.bug) c.bugId = s.bug
      if (s.res) {
        const at = iso(-6, -(s.hoursAgo ?? 0))
        const by = s.by ?? me
        const owner = this.assignee(c.moduleId, sit.envId)
        const behalfOf = owner && owner.userId !== by.userId ? owner : null
        c.results.push({ resultId: this.nextId(), envId: sit.envId, build: 'v1.0.1', result: s.res, by, at, behalfOf })
        this.log(plan.planId, by, {
          type: 'RESULT',
          envId: sit.envId,
          moduleId: c.moduleId,
          testCaseId: c.testCaseId,
          from: 'UNTEST',
          to: s.res,
          build: 'v1.0.1',
          behalfOf,
          at,
        })
        if (s.bug) {
          const key = s.bug === bugLow.issueId ? bugLow.key : bugQr.key
          this.log(plan.planId, by, {
            type: 'BUG',
            envId: sit.envId,
            moduleId: c.moduleId,
            testCaseId: c.testCaseId,
            at,
            text: tr(`Tạo ${key} trên Kanban`, `Created ${key} on Kanban`),
          })
        }
      }
      return c
    }

    // Module 1: SRS-014
    const mFee = this.insertModule(plan, fee, isSec ? 'Biểu phí & Lãi vay Margin' : 'Cấu hình phí', 'PHI')
    const mQr = this.insertModule(plan, qr, isSec ? 'Nộp tiền QR 9688 & Call Margin' : 'Thanh toán QR', 'QR')
    const mRpt = this.insertModule(plan, rpt, isSec ? 'Sao kê & Đối soát VSD T+2' : 'Báo cáo doanh số', 'BC')
    db.assigns.push({ moduleId: mFee.moduleId, envId: sit.envId, assignee: me })
    db.assigns.push({ moduleId: mQr.moduleId, envId: sit.envId, assignee: tam })
    db.assigns.push({ moduleId: mRpt.moduleId, envId: sit.envId, assignee: me })

    const s1 = this.insertSection(
      mFee,
      null,
      isSec ? 'Thiết lập biểu phí môi giới & gói lãi vay Margin' : 'Thêm mới cấu hình phí',
      SPEC_ANCHORS.feeCreate,
    )
    const g11 = this.insertSection(mFee, s1, 'Flow', null)
    add(fee, g11, {
      title: isSec ? 'Flow thiết lập gói biểu phí môi giới cổ phiếu & lãi suất Margin' : 'Flow thêm mới biểu phí',
      reqs: [FEE_REQ.create],
      cond: isSec ? 'Tài khoản quyền Quản trị nghiệp vụ Back-Office' : 'Tài khoản quyền Quản trị phí',
      steps: isSec
        ? ['Đăng nhập Back-Office KRX', 'Vào Tham số Giao dịch > Biểu phí & Margin > Thêm mới']
        : ['Đăng nhập hệ thống', 'Vào Cấu hình phí > Thêm mới'],
      expected: isSec
        ? ['Đăng nhập thành công', 'Hiển thị form Thiết lập gói biểu phí môi giới (HOSE/HNX/UPCOM) & lãi suất Margin']
        : ['Đăng nhập thành công', 'Hiện màn Thêm mới biểu phí'],
      prio: 'HIGH',
      res: 'PASS',
      hoursAgo: 3,
    })
    const g12 = this.insertSection(mFee, s1, 'Giao diện', null)
    add(fee, g12, {
      title: isSec ? 'Tổng thể giao diện màn hình Cấu hình phí & Lãi suất Margin' : 'Tổng thể giao diện',
      steps: ['Kiểm tra tổng thể giao diện'],
      expected: ['Bố cục, màu, chữ hài hoà theo thiết kế'],
      prio: 'LOW',
      res: 'PASS',
      hoursAgo: 2.8,
    })
    add(fee, g12, {
      title: isSec ? 'Kiểm tra thuật ngữ chứng khoán (Phí Sở 0.027%, Thuế TNCN 0.1%, Rtt)' : 'Chính tả',
      steps: ['Kiểm tra lỗi chính tả'],
      expected: ['Không sai chính tả'],
      prio: 'LOW',
      res: 'PASS',
      hoursAgo: 2.7,
    })
    add(fee, g12, {
      title: isSec ? 'Giá trị mặc định – Tên gói biểu phí & Trần phí Bộ Tài chính' : 'Giá trị mặc định – Tên biểu phí',
      reqs: [FEE_REQ.create],
      steps: ['Mở màn Thêm mới'],
      expected: ['Ô trống, placeholder "Nhập tên biểu phí"'],
    })
    const g13 = this.insertSection(mFee, s1, 'Chức năng', null)
    add(fee, g13, {
      title: isSec ? 'Lưu gói biểu phí VIP (0.15%) & Lãi vay Margin (11.5%/năm) hợp lệ' : 'Lưu biểu phí hợp lệ',
      reqs: [FEE_REQ.create, FEE_REQ.limit],
      ai: true,
      steps: isSec
        ? ['Nhập tên gói VIP-KRX, phí môi giới 0.15%, lãi Margin 11.5%/năm', 'Bấm Lưu']
        : ['Nhập tên, mức phí 0,5%', 'Bấm Lưu'],
      expected: ['Không báo lỗi', 'Báo "Lưu thành công", biểu phí hiện trong danh sách'],
      prio: 'HIGH',
    })
    add(fee, g13, {
      title: isSec ? 'Bỏ trống tên gói biểu phí môi giới' : 'Bỏ trống tên biểu phí',
      reqs: [FEE_REQ.create],
      ai: true,
      steps: ['Để trống tên', 'Bấm Lưu'],
      expected: ['', 'Báo "Vui lòng nhập tên biểu phí"'],
    })
    add(fee, g13, {
      title: isSec ? 'Nhập tỷ lệ phí môi giới âm (-0.15%)' : 'Mức phí âm',
      reqs: [FEE_REQ.limit],
      steps: isSec ? ['Nhập tỷ lệ phí môi giới -0.15%', 'Bấm Lưu'] : ['Nhập mức phí -1', 'Bấm Lưu'],
      expected: ['', 'Báo "Mức phí phải ≥ 0"'],
      actual: isSec ? 'Hệ thống vẫn cho lưu tỷ lệ phí môi giới -0.15%' : 'Cho lưu mức phí -1',
      prio: 'HIGH',
      bug: bugLow.issueId,
      res: 'FAIL',
      hoursAgo: 2,
    })
    const s2 = this.insertSection(
      mFee,
      null,
      isSec ? 'Điều chỉnh biểu phí & Lãi suất áp dụng từ phiên T+1' : 'Sửa cấu hình phí',
      SPEC_ANCHORS.feeEdit,
    )
    const g21 = this.insertSection(mFee, s2, 'Chức năng', null)
    add(fee, g21, {
      title: isSec ? 'Điều chỉnh tỷ lệ phí môi giới cổ phiếu' : 'Sửa mức phí',
      reqs: [FEE_REQ.edit],
      steps: ['Chọn biểu phí', 'Sửa mức phí, bấm Lưu'],
      expected: ['Mở màn sửa', 'Lưu thành công, ghi lịch sử'],
      res: 'PASS',
      by: tam,
      hoursAgo: 1.5,
    })
    add(fee, g21, {
      title: isSec ? 'Sửa gói phí đang gán cho tiểu khoản có lệnh chờ khớp trong phiên' : 'Sửa khi biểu phí đang áp dụng',
      reqs: [FEE_REQ.edit],
      steps: ['Chọn biểu phí đang áp dụng', 'Sửa mức phí'],
      expected: ['', 'Hỏi xác nhận, áp dụng từ ngày hôm sau'],
      actual: isSec
        ? 'Chưa mở phiên giả lập khớp lệnh liên tục từ Simulator KRX trên SIT'
        : 'Chưa có dữ liệu biểu phí đang áp dụng trên SIT',
      res: 'NA',
      by: tam,
      hoursAgo: 1.3,
    })
    add(fee, g21, { title: 'Xem lịch sử thay đổi (bỏ khỏi phạm vi)', deleted: true })

    // Module 2: URD-014
    const q1 = this.insertSection(
      mQr,
      null,
      isSec ? 'Quét QR nộp tiền ký quỹ & Xác thực rút tiền' : 'Quét QR thanh toán',
      SPEC_ANCHORS.qrPay,
    )
    const q11 = this.insertSection(mQr, q1, 'Chức năng', null)
    add(qr, q11, {
      title: isSec ? 'Quét mã VietQR định danh 9688 nộp tiền vào Tiểu khoản Ký quỹ (TK 6)' : 'Quét QR tĩnh',
      reqs: [QR_REQ.scan],
      steps: isSec
        ? ['Mở ứng dụng ngân hàng quét mã VietQR 9688', 'Xác nhận chuyển khoản vào Tiểu khoản 6']
        : ['Mở Quét QR', 'Quét mã của cửa hàng'],
      expected: isSec
        ? ['Nhận diện đúng tài khoản chứng khoán định danh 9688', 'Cộng sức mua T+0 trong 3 giây']
        : ['Mở camera', 'Hiện màn xác nhận số tiền'],
      prio: 'HIGH',
      res: 'PASS',
      by: tam,
      hoursAgo: -20,
    })
    add(qr, q11, {
      title: isSec ? 'Quét mã QR nộp tiền chứng khoán đã hết hạn (> 15 phút)' : 'QR đã hết hạn',
      reqs: [QR_REQ.expired],
      steps: ['Quét QR quá 15 phút'],
      expected: ['Báo "Mã QR đã hết hạn"'],
      actual: isSec ? 'Vẫn tự động hạch toán cộng Sức mua T+0' : 'Vẫn cho thanh toán',
      prio: 'HIGH',
      bug: bugQr.issueId,
      res: 'FAIL',
      by: tam,
      hoursAgo: -20.5,
    })
    add(qr, q11, {
      title: isSec ? 'Bắt buộc SmartOTP 6 số khi rút tiền / ứng trước trên 50 triệu' : 'OTP khi giao dịch trên 5 triệu',
      reqs: [QR_REQ.otp],
      steps: isSec ? ['Khởi tạo lệnh rút tiền / ứng trước 60.000.000đ'] : ['Thanh toán 6.000.000đ'],
      expected: isSec ? ['Yêu cầu nhập mã SmartOTP 6 số (TOTP)'] : ['Yêu cầu OTP SMS'],
      prio: 'HIGH',
      res: 'PASS',
      by: tam,
      hoursAgo: -21,
    })

    // Module 3: SRS-020
    const r1 = this.insertSection(
      mRpt,
      null,
      isSec ? 'Báo cáo Sao kê Danh mục & Đối soát VSD T+2' : 'Báo cáo tổng hợp',
      SPEC_ANCHORS.rptSummary,
    )
    const r11 = this.insertSection(mRpt, r1, 'Chức năng', null)
    add(rpt, r11, {
      title: isSec ? 'Lọc sao kê giao dịch cổ phiếu & đối soát lưu ký VSD T+2 theo kỳ' : 'Lọc theo khoảng ngày',
      reqs: [RPT_REQ.filter],
      steps: ['Chọn 01/10–31/10', 'Bấm Xem'],
      expected: ['', 'Chỉ hiện giao dịch trong khoảng'],
      res: 'PASS',
      hoursAgo: -26,
    })
    add(rpt, r11, {
      title: isSec ? 'Kết xuất báo cáo Sao kê Danh mục & Thuế TNCN 0.1% ra Excel (.xlsx)' : 'Xuất Excel',
      reqs: [RPT_REQ.excel],
      steps: ['Bấm Xuất Excel'],
      expected: ['Tải file .xlsx đúng cột'],
    })
    this.log(plan.planId, me, {
      type: 'ASSIGN',
      at: iso(-7),
      text: tr(
        isSec
          ? `Phân công SIT: Biểu phí & Lãi vay Margin, Sao kê & Đối soát VSD T+2 → ${me.fullName}; Nộp tiền QR 9688 & Call Margin → ${tam.fullName}`
          : 'Phân công SIT: Cấu hình phí, Báo cáo doanh số → bạn; Thanh toán QR → ' + tam.fullName,
        'SIT assignments set',
      ),
    })
    this.persist()
    return true
  }
}
