// Backend giả trong trình duyệt cho Kanban (doc/BE-Changes-2026-10-28_30-API.md §C), lưu ở localStorage
// `ssam.mock.issues.v1`. Bật bằng VITE_MOCK_KANBAN=true (src/api/mockFlags.ts). Quyền, role dự án, workflow và thành
// viên lấy từ API thật; REQ tra trong mock tài liệu hoặc API Tài liệu thật (src/api/workMockStores.ts).

import { tr } from '@/i18n'
import { PERMISSIONS } from '@/types/rbac'
import { hasWorkPermission } from '@/lib/workPermissions'
import { allowedTargets, boardStatuses, demoStatuses, initialStatusId, type BoardStatus } from '@/lib/workflowBoard'
import type {
  BoardDto,
  CreateIssueBody,
  CreateSprintBody,
  IssueActivityDto,
  IssueCommentDto,
  IssueDetailDto,
  IssueListQuery,
  IssuePriority,
  IssueSummaryDto,
  IssueTestCounts,
  IssueType,
  RequirementRef,
  RunResultLite,
  SprintDto,
  SprintStatus,
  UpdateIssueBody,
  UpdateSprintBody,
  UserRef,
} from '@/types/issue'
import { ISSUE_PRIORITIES, ISSUE_TYPES } from '@/types/issue'
import type { WorkflowDto } from '@/types/project'
import type { DocReqIndex } from './documentMockStore'
import { AUTH_REQ, PAY_REQ } from './documentSeed'
import {
  clone,
  DEMO_PEOPLE,
  fail,
  has,
  loadJson,
  mergePeople,
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

export const ISSUE_STORAGE_KEY = 'ssam.mock.issues.v1'

interface IssueRec {
  issueId: number
  projectId: number
  key: string
  type: IssueType
  title: string
  description: string | null
  statusId: number
  priority: IssuePriority
  points: number | null
  assignee: UserRef | null
  reporter: UserRef
  sprintId: number | null
  parentId: number | null
  rank: number
  labels: string[]
  dueDate: string | null
  reqChanged: boolean
  links: LinkRec[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  isDeleted: boolean
}

interface SprintRec {
  sprintId: number
  projectId: number
  name: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  status: SprintStatus
  capacityPoints: number | null
  completedAt: string | null
}

interface CommentRec extends IssueCommentDto {
  issueId: number
}

interface ActivityRec extends IssueActivityDto {
  issueId: number
}

interface IssueDb {
  seq: number
  keySeq: Record<string, number>
  issues: IssueRec[]
  sprints: SprintRec[]
  comments: CommentRec[]
  activities: ActivityRec[]
  wip: { projectId: number; statusId: number; limit: number }[]
  /** Người giả thêm vào dự án khi tạo dữ liệu mẫu. */
  people: Record<string, UserRef[]>
  seeded: number[]
}

const emptyDb = (): IssueDb => ({
  seq: 5000,
  keySeq: {},
  issues: [],
  sprints: [],
  comments: [],
  activities: [],
  wip: [],
  people: {},
  seeded: [],
})

export interface LinkedTest {
  testCaseId: number
  key: string
  title: string
  lastResult: RunResultLite | null
  /** Test cases v2: đợt test và môi trường của kết quả hiển thị (để mở đúng chỗ). */
  planId?: number
  envId?: number | null
}

/** Testcase liên kết theo issue (testMockStore cung cấp). */
export type LinkedTestsProvider = (projectId: number) => Map<number, LinkedTest[]>

interface Ctx {
  projectId: number
  me: UserRef
  permissions: string[]
  roleId: number | null
  archived: boolean
  projectKey: string
  wf: WorkflowDto
  statuses: BoardStatus[]
  index: DocReqIndex[]
  tests: Map<number, LinkedTest[]>
}

export const ISSUE_DESCRIPTION_MAX = 10_000
const RANK_STEP = 1000

export class IssueMockStore {
  private db: IssueDb | null = null
  private readonly env: ResolvedEnv
  private testsProvider: LinkedTestsProvider = () => new Map()

  constructor(env: WorkMockEnv) {
    this.env = resolveEnv(env)
  }

  attachTests(provider: LinkedTestsProvider) {
    this.testsProvider = provider
  }

  // ---------- Hạ tầng ----------

  private load(): IssueDb {
    this.db ??= loadJson(this.env.storage, ISSUE_STORAGE_KEY, emptyDb)
    return this.db
  }

  private persist() {
    saveJson(this.env.storage, ISSUE_STORAGE_KEY, this.db)
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
    const [me, wf] = await Promise.all([this.env.actor(), this.env.workflow(projectId)])
    const index = await this.env.reqs(projectId)
    const ctx: Ctx = {
      projectId,
      me,
      permissions: acc.permissions,
      roleId: acc.roleId,
      archived: acc.archived,
      projectKey: acc.projectKey,
      wf,
      statuses: boardStatuses(wf),
      index,
      tests: new Map(),
    }
    if (this.syncReqChanges(projectId, index)) this.persist()
    ctx.tests = this.testsProvider(projectId)
    return ctx
  }

  /** §3: REQ liên kết đổi trong bản vừa duyệt → issue.reqChanged = true + activity. Trả về true nếu có thay đổi. */
  syncReqChanges(projectId: number, index: DocReqIndex[]): boolean {
    let changed = false
    for (const issue of this.load().issues.filter((i) => i.projectId === projectId && !i.isDeleted)) {
      for (const link of issue.links) {
        const label = syncLink(index, link)
        if (!label) continue
        changed = true
        issue.reqChanged = true
        const ref = reqRefDto(index, link, true)
        this.log(
          issue.issueId,
          'REQ_CHANGED',
          { userId: 0, fullName: 'SSAM' },
          `${ref.documentCode} ${ref.reqKey ?? ''} · ${ref.changedNote ?? ''}`.trim(),
        )
      }
    }
    return changed
  }

  private log(issueId: number, action: IssueActivityDto['action'], actor: UserRef, note: string | null = null) {
    this.load().activities.push({ activityId: this.nextId(), issueId, action, actor, note, createdAt: this.iso() })
  }

  private issue(issueId: number): IssueRec {
    const i = this.load().issues.find((x) => x.issueId === issueId && !x.isDeleted)
    return i ?? fail(404, 'ISSUE_NOT_FOUND', tr('Không tìm thấy issue.', 'Issue not found.'))
  }

  private sprint(sprintId: number): SprintRec {
    const s = this.load().sprints.find((x) => x.sprintId === sprintId)
    return s ?? fail(404, 'SPRINT_NOT_FOUND', tr('Không tìm thấy sprint.', 'Sprint not found.'))
  }

  private projectIssues(projectId: number) {
    return this.load()
      .issues.filter((i) => i.projectId === projectId && !i.isDeleted)
      .sort((a, b) => a.rank - b.rank || a.issueId - b.issueId)
  }

  private activeSprint(projectId: number) {
    return this.load().sprints.find((s) => s.projectId === projectId && s.status === 'ACTIVE') ?? null
  }

  private category(ctx: Ctx, statusId: number) {
    return ctx.statuses.find((s) => s.statusId === statusId)?.category ?? 'TODO'
  }

  /** Người được giao việc: thành viên thật + người mẫu của dự án. */
  async people(projectId: number): Promise<UserRef[]> {
    const [members, me] = await Promise.all([
      this.env.members(projectId).catch(() => []),
      this.env.actor().catch(() => null),
    ])
    return mergePeople(me ? [me] : [], members, this.load().people[projectId] ?? [])
  }

  private async person(projectId: number, userId: number | null | undefined): Promise<UserRef | null> {
    if (userId === null || userId === undefined) return null
    const p = (await this.people(projectId)).find((u) => u.userId === Number(userId))
    return (
      p ?? validationError({ assigneeId: [tr('Người này không thuộc dự án.', 'This person is not in the project.')] })
    )
  }

  // ---------- DTO ----------

  private testCounts(ctx: Ctx, issueId: number): IssueTestCounts {
    const list = ctx.tests.get(issueId) ?? []
    const c = { total: list.length, pass: 0, fail: 0, blocked: 0, notRun: 0 }
    for (const t of list) {
      if (t.lastResult === 'PASS') c.pass += 1
      else if (t.lastResult === 'FAIL') c.fail += 1
      else if (t.lastResult === 'BLOCKED') c.blocked += 1
      else c.notRun += 1
    }
    return c
  }

  private summary(ctx: Ctx, i: IssueRec): IssueSummaryDto {
    const subs = this.load().issues.filter((x) => x.parentId === i.issueId && !x.isDeleted)
    return {
      issueId: i.issueId,
      key: i.key,
      type: i.type,
      title: i.title,
      statusId: i.statusId,
      priority: i.priority,
      points: i.points,
      assignee: i.assignee ? { ...i.assignee } : null,
      sprintId: i.sprintId,
      parentId: i.parentId,
      rank: String(i.rank).padStart(12, '0'),
      labels: [...i.labels],
      requirements: i.links.map((l) => reqRefDto(ctx.index, l, i.reqChanged)),
      reqChanged: i.reqChanged,
      tests: this.testCounts(ctx, i.issueId),
      subtaskCount: subs.length,
      subtaskDone: subs.filter((s) => this.category(ctx, s.statusId) === 'DONE').length,
      updatedAt: i.updatedAt,
    }
  }

  private detail(ctx: Ctx, i: IssueRec): IssueDetailDto {
    const w = !ctx.archived
    const canStatus = w && has(ctx.permissions, PERMISSIONS.issueChangeStatus)
    const targets = canStatus
      ? allowedTargets(ctx.wf, i.statusId, { roleId: ctx.roleId, permissions: ctx.permissions })
      : []
    return {
      ...this.summary(ctx, i),
      description: i.description,
      reporter: { ...i.reporter },
      dueDate: i.dueDate,
      subtasks: this.load()
        .issues.filter((x) => x.parentId === i.issueId && !x.isDeleted)
        .sort((a, b) => a.rank - b.rank)
        .map((x) => this.summary(ctx, x)),
      testCases: (ctx.tests.get(i.issueId) ?? []).map((t) => ({ ...t })),
      allowedTransitions: targets.map((id) => ({
        toStatusId: id,
        name: ctx.statuses.find((s) => s.statusId === id)?.name ?? String(id),
      })),
      can: {
        edit: w && has(ctx.permissions, PERMISSIONS.issueUpdate),
        assign: w && has(ctx.permissions, PERMISSIONS.issueAssign),
        changeStatus: canStatus,
        delete: w && has(ctx.permissions, PERMISSIONS.issueDelete),
      },
      createdAt: i.createdAt,
    }
  }

  private sprintDto(ctx: Pick<Ctx, 'statuses'>, s: SprintRec): SprintDto {
    const issues = this.load().issues.filter((i) => i.sprintId === s.sprintId && !i.isDeleted && i.parentId === null)
    const done = (i: IssueRec) => ctx.statuses.find((x) => x.statusId === i.statusId)?.category === 'DONE'
    return {
      sprintId: s.sprintId,
      name: s.name,
      goal: s.goal,
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
      capacityPoints: s.capacityPoints,
      committedPoints: issues.reduce((n, i) => n + (i.points ?? 0), 0),
      donePoints: issues.filter(done).reduce((n, i) => n + (i.points ?? 0), 0),
      issueCount: issues.length,
    }
  }

  /** Đặt issue ngay sau `afterId` trong thứ tự chung của dự án (null = đầu danh sách), đánh lại rank. */
  private placeAfter(projectId: number, issue: IssueRec, afterId: number | null) {
    const list = this.projectIssues(projectId).filter((x) => x.issueId !== issue.issueId)
    let at = 0
    if (afterId !== null) {
      const idx = list.findIndex((x) => x.issueId === afterId)
      if (idx < 0)
        fail(404, 'ISSUE_NOT_FOUND', tr('Không tìm thấy issue để xếp sau.', 'Issue to place after was not found.'))
      at = idx + 1
    }
    list.splice(at, 0, issue)
    list.forEach((x, i) => (x.rank = (i + 1) * RANK_STEP))
  }

  private validSprint(projectId: number, sprintId: number | null | undefined): number | null {
    if (sprintId === null || sprintId === undefined) return null
    const s = this.load().sprints.find((x) => x.sprintId === Number(sprintId) && x.projectId === projectId)
    if (!s) fail(404, 'SPRINT_NOT_FOUND', tr('Không tìm thấy sprint.', 'Sprint not found.'))
    if (s!.status === 'COMPLETED')
      validationError({ sprintId: [tr('Sprint đã hoàn tất.', 'The sprint is completed.')] })
    return s!.sprintId
  }

  // ---------- 4.1 Board ----------

  async getBoard(projectId: number): Promise<BoardDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.issueView)
    const limits = this.load().wip.filter((w) => w.projectId === projectId)
    const active = this.activeSprint(projectId)
    return {
      columns: ctx.statuses.map((s) => ({
        statusId: s.statusId,
        name: s.name,
        category: s.category,
        color: s.color,
        phaseId: s.phaseId,
        phaseName: s.phaseName,
        position: s.position,
        isInitial: s.isInitial,
        wipLimit: limits.find((l) => l.statusId === s.statusId)?.limit ?? null,
      })),
      activeSprint: active ? this.sprintDto(ctx, active) : null,
    }
  }

  async setWip(projectId: number, limits: { statusId: number; limit: number | null }[]): Promise<BoardDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.projectWorkflowManage, true)
    const db = this.load()
    for (const l of limits ?? []) {
      if (!ctx.statuses.some((s) => s.statusId === l.statusId))
        validationError({ limits: [tr('Trạng thái không thuộc workflow.', 'Status is not in the workflow.')] })
      if (l.limit !== null && (!Number.isInteger(l.limit) || l.limit < 1))
        validationError({ limits: [tr('Giới hạn là số nguyên ≥ 1.', 'Limit must be an integer ≥ 1.')] })
      db.wip = db.wip.filter((w) => !(w.projectId === projectId && w.statusId === l.statusId))
      if (l.limit !== null) db.wip.push({ projectId, statusId: l.statusId, limit: l.limit })
    }
    this.persist()
    return this.getBoard(projectId)
  }

  // ---------- 4.2 Issue ----------

  async listIssues(projectId: number, q: IssueListQuery = {}): Promise<{ items: IssueSummaryDto[] }> {
    const ctx = await this.ctx(projectId, PERMISSIONS.issueView)
    let list = this.projectIssues(projectId)
    if (q.sprintId === 'active') {
      const a = this.activeSprint(projectId)
      list = a ? list.filter((i) => i.sprintId === a.sprintId) : []
    } else if (q.sprintId === 'backlog') list = list.filter((i) => i.sprintId === null)
    else if (q.sprintId !== undefined) list = list.filter((i) => i.sprintId === Number(q.sprintId))
    if (q.assigneeId === 'me') list = list.filter((i) => i.assignee?.userId === ctx.me.userId)
    else if (q.assigneeId !== undefined) list = list.filter((i) => i.assignee?.userId === Number(q.assigneeId))
    if (q.type) list = list.filter((i) => i.type === q.type)
    if (q.statusId !== undefined) list = list.filter((i) => i.statusId === Number(q.statusId))
    if (q.reqUid) list = list.filter((i) => i.links.some((l) => l.reqUid === q.reqUid))
    if (q.reqChanged) list = list.filter((i) => i.reqChanged)
    if (q.parentId !== undefined) list = list.filter((i) => i.parentId === Number(q.parentId))
    const needle = q.search?.trim().toLocaleLowerCase('vi')
    if (needle)
      list = list.filter(
        (i) => i.key.toLocaleLowerCase('vi').includes(needle) || i.title.toLocaleLowerCase('vi').includes(needle),
      )
    return { items: list.map((i) => this.summary(ctx, i)) }
  }

  async getIssue(issueId: number): Promise<IssueDetailDto> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.issueView)
    return this.detail(ctx, this.issue(issueId))
  }

  /** Tìm issue theo key (vd `CORE-104`) — tiện cho URL `?issue=`; không thuộc hợp đồng. */
  findByKey(projectId: number, key: string): number | null {
    return (
      this.load().issues.find(
        (i) => i.projectId === projectId && !i.isDeleted && i.key.toUpperCase() === key.toUpperCase(),
      )?.issueId ?? null
    )
  }

  private validateFields(
    body: {
      title?: string
      type?: IssueType
      priority?: IssuePriority
      points?: number | null
      description?: string | null
    },
    creating: boolean,
  ) {
    const errors: Record<string, string[]> = {}
    const title = body.title?.trim()
    if ((creating || body.title !== undefined) && (!title || title.length > 300))
      errors.title = [tr('Tiêu đề bắt buộc, tối đa 300 ký tự.', 'Title is required, max 300 characters.')]
    if ((creating || body.type !== undefined) && !ISSUE_TYPES.includes(body.type as IssueType))
      errors.type = [tr('Loại issue không hợp lệ.', 'Invalid issue type.')]
    if (body.priority !== undefined && !ISSUE_PRIORITIES.includes(body.priority))
      errors.priority = [tr('Độ ưu tiên không hợp lệ.', 'Invalid priority.')]
    if (
      body.points !== undefined &&
      body.points !== null &&
      (!Number.isInteger(body.points) || body.points < 0 || body.points > 100)
    )
      errors.points = [tr('Điểm là số nguyên 0–100.', 'Points must be an integer 0–100.')]
    // D25: mô tả là text thuần, tối đa 10 000 ký tự.
    if (
      body.description !== undefined &&
      body.description !== null &&
      (typeof body.description !== 'string' || body.description.length > ISSUE_DESCRIPTION_MAX)
    )
      errors.description = [
        tr('Mô tả là văn bản, tối đa 10 000 ký tự.', 'Description is plain text, max 10,000 chars.'),
      ]
    if (Object.keys(errors).length) validationError(errors)
  }

  private nextKey(ctx: Ctx) {
    const db = this.load()
    const n = (db.keySeq[ctx.projectId] ?? 0) + 1
    db.keySeq[ctx.projectId] = n
    return `${ctx.projectKey}-${n}`
  }

  private async insertIssue(ctx: Ctx, body: CreateIssueBody, opts: { at?: string } = {}): Promise<IssueRec> {
    this.validateFields(body, true)
    const statusId = initialStatusId(ctx.wf, body.statusId)
    if (statusId === null)
      fail(409, 'WORKFLOW_INVALID', tr('Workflow dự án chưa có trạng thái.', 'The project workflow has no statuses.'))
    let parentId: number | null = null
    if (body.parentId !== undefined && body.parentId !== null) {
      const parent = this.issue(Number(body.parentId))
      if (parent.projectId !== ctx.projectId || parent.parentId !== null)
        validationError({
          parentId: [tr('Việc con chỉ một cấp, cùng dự án.', 'Subtasks are one level deep, same project.')],
        })
      parentId = parent.issueId
    }
    const assignee = await this.person(ctx.projectId, body.assigneeId)
    const at = opts.at ?? this.iso()
    const all = this.projectIssues(ctx.projectId)
    const rec: IssueRec = {
      issueId: this.nextId(),
      projectId: ctx.projectId,
      key: this.nextKey(ctx),
      type: body.type,
      title: body.title.trim(),
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      statusId: statusId!,
      priority: body.priority ?? 'MEDIUM',
      points: body.points ?? null,
      assignee,
      reporter: ctx.me,
      sprintId: parentId ? this.issue(parentId).sprintId : this.validSprint(ctx.projectId, body.sprintId),
      parentId,
      rank: (all.length ? all[all.length - 1].rank : 0) + RANK_STEP,
      labels: (body.labels ?? [])
        .map((l) => String(l).trim())
        .filter(Boolean)
        .slice(0, 20),
      dueDate: null,
      reqChanged: false,
      links: newLinks(ctx.index, body.requirementRefs),
      createdAt: at,
      updatedAt: at,
      resolvedAt: null,
      isDeleted: false,
    }
    this.load().issues.push(rec)
    this.log(rec.issueId, 'CREATED', ctx.me)
    return rec
  }

  async createIssue(projectId: number, body: CreateIssueBody): Promise<IssueDetailDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.issueCreate, true)
    if (
      body.assigneeId !== undefined &&
      body.assigneeId !== null &&
      body.assigneeId !== ctx.me.userId &&
      !has(ctx.permissions, PERMISSIONS.issueAssign)
    )
      fail(403, 'FORBIDDEN', tr('Bạn không có quyền giao việc.', "You don't have permission to assign work."))
    const rec = await this.insertIssue(ctx, body)
    this.persist()
    return this.detail(ctx, rec)
  }

  /**
   * Cho testMockStore: tạo bug từ testcase FAIL (Test cases v2, T26). Quyền `issue.create` đã kiểm ở phía test.
   * `inProgress`: chỉ cho dữ liệu mẫu (bug đang xử lý).
   */
  async createDefect(
    projectId: number,
    body: {
      title: string
      priority?: IssuePriority
      assigneeId?: number | null
      refs: RequirementRef[]
      description?: string | null
      inProgress?: boolean
    },
  ): Promise<{ issueId: number; key: string; statusId: number }> {
    const ctx = await this.ctx(projectId, PERMISSIONS.issueView, true)
    const active = this.activeSprint(projectId)
    const rec = await this.insertIssue(ctx, {
      type: 'BUG',
      title: body.title,
      description: body.description ?? undefined,
      priority: body.priority ?? 'HIGH',
      assigneeId: body.assigneeId ?? null,
      sprintId: active?.sprintId ?? null,
      requirementRefs: body.refs,
    })
    if (body.inProgress) {
      const doing = demoStatuses(ctx.wf).doing
      if (doing) rec.statusId = doing
    }
    this.persist()
    return { issueId: rec.issueId, key: rec.key, statusId: rec.statusId }
  }

  /** Cho testMockStore: thông tin bug (key, tiêu đề, trạng thái Kanban) — cột "Bug" / "Trạng thái bug" chỉ đọc. */
  async bugRefs(
    projectId: number,
    ids: number[],
  ): Promise<
    {
      issueId: number
      key: string
      title: string
      priority: IssuePriority
      statusName: string
      statusCategory: 'TODO' | 'IN_PROGRESS' | 'DONE'
      type: IssueType
    }[]
  > {
    if (!ids.length) return []
    const wf = await this.env.workflow(projectId).catch(() => null)
    const statuses = wf ? boardStatuses(wf) : []
    return ids
      .map((id) => this.load().issues.find((i) => i.issueId === id && i.projectId === projectId && !i.isDeleted))
      .filter((i): i is IssueRec => !!i)
      .map((i) => {
        const st = statuses.find((x) => x.statusId === i.statusId)
        return {
          issueId: i.issueId,
          key: i.key,
          title: i.title,
          priority: i.priority,
          statusName: st?.name ?? '',
          statusCategory: st?.category ?? 'TODO',
          type: i.type,
        }
      })
  }

  /** Cho testMockStore: bug đã Done nhưng test FAIL lại → về trạng thái khởi đầu, ghi lịch sử. */
  async reopenDefect(projectId: number, issueId: number, actor: UserRef, note: string): Promise<boolean> {
    const wf = await this.env.workflow(projectId)
    const i = this.issue(issueId)
    const to = initialStatusId(wf)
    // Chỉ mở lại bug thật sự đang ở category DONE.
    const category = boardStatuses(wf).find((s) => s.statusId === i.statusId)?.category
    if (to === null || i.projectId !== projectId || category !== 'DONE') return false
    i.statusId = to
    i.resolvedAt = null
    i.updatedAt = this.iso()
    this.log(i.issueId, 'TRANSITIONED', actor, note)
    this.persist()
    return true
  }

  /** Tra key + trạng thái issue (cho testcase / lượt chạy). */
  refs(projectId: number, ids: number[]): { issueId: number; key: string; statusId: number }[] {
    return ids
      .map((id) => this.load().issues.find((i) => i.issueId === id && i.projectId === projectId && !i.isDeleted))
      .filter((i): i is IssueRec => !!i)
      .map((i) => ({ issueId: i.issueId, key: i.key, statusId: i.statusId }))
  }

  async updateIssue(issueId: number, body: UpdateIssueBody): Promise<IssueDetailDto> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.issueUpdate, true)
    const i = this.issue(issueId)
    this.validateFields(body, false)
    const changes: string[] = []
    if (body.assigneeId !== undefined && (body.assigneeId ?? null) !== (i.assignee?.userId ?? null)) {
      if (!has(ctx.permissions, PERMISSIONS.issueAssign))
        fail(403, 'FORBIDDEN', tr('Bạn không có quyền giao việc.', "You don't have permission to assign work."))
      i.assignee = await this.person(projectId, body.assigneeId)
      this.log(i.issueId, 'ASSIGNED', ctx.me, i.assignee?.fullName ?? tr('Bỏ giao', 'Unassigned'))
    }
    if (body.sprintId !== undefined && (body.sprintId ?? null) !== i.sprintId) {
      i.sprintId = this.validSprint(projectId, body.sprintId)
      for (const s of this.load().issues.filter((x) => x.parentId === i.issueId)) s.sprintId = i.sprintId
      this.log(i.issueId, 'SPRINT_CHANGED', ctx.me, i.sprintId ? this.sprint(i.sprintId).name : 'Backlog')
    }
    if (body.title !== undefined && body.title.trim() !== i.title) {
      i.title = body.title.trim()
      changes.push('title')
    }
    if (body.description !== undefined) {
      i.description = typeof body.description === 'string' ? body.description.trim() || null : null
      changes.push('description')
    }
    if (body.type !== undefined && body.type !== i.type) {
      i.type = body.type
      changes.push('type')
    }
    if (body.priority !== undefined && body.priority !== i.priority) {
      i.priority = body.priority
      changes.push('priority')
    }
    if (body.points !== undefined && body.points !== i.points) {
      i.points = body.points
      changes.push('points')
    }
    if (body.labels !== undefined) {
      i.labels = body.labels
        .map((l) => String(l).trim())
        .filter(Boolean)
        .slice(0, 20)
      changes.push('labels')
    }
    if (body.dueDate !== undefined) {
      i.dueDate = body.dueDate
      changes.push('dueDate')
    }
    if (changes.length) this.log(i.issueId, 'UPDATED', ctx.me, changes.join(', '))
    i.updatedAt = this.iso()
    this.persist()
    return this.detail(ctx, i)
  }

  async deleteIssue(issueId: number): Promise<void> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.issueDelete, true)
    const i = this.issue(issueId)
    for (const x of [i, ...this.load().issues.filter((s) => s.parentId === issueId)]) {
      x.isDeleted = true
      this.log(x.issueId, 'DELETED', ctx.me)
    }
    this.persist()
  }

  // ---------- 4.3 Trạng thái & thứ tự ----------

  async transition(
    issueId: number,
    body: { toStatusId: number; rankAfterIssueId?: number | null },
  ): Promise<IssueDetailDto> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.issueChangeStatus, true)
    const i = this.issue(issueId)
    const to = Number(body.toStatusId)
    if (to !== i.statusId) {
      const targets = allowedTargets(ctx.wf, i.statusId, { roleId: ctx.roleId, permissions: ctx.permissions })
      if (!targets.includes(to))
        fail(
          409,
          'TRANSITION_NOT_ALLOWED',
          tr(
            'Workflow không cho phép chuyển sang trạng thái này với vai trò của bạn.',
            "The workflow doesn't allow this move for your role.",
          ),
        )
      const limit = this.load().wip.find((w) => w.projectId === projectId && w.statusId === to)?.limit
      if (limit) {
        const active = this.activeSprint(projectId)
        const inColumn = this.projectIssues(projectId).filter(
          (x) =>
            x.statusId === to &&
            x.parentId === null &&
            x.issueId !== i.issueId &&
            (!active || x.sprintId === active.sprintId),
        ).length
        if (inColumn >= limit)
          fail(
            409,
            'WIP_LIMIT_REACHED',
            tr(`Cột đích đã đủ giới hạn WIP (${limit}).`, `The target column is at its WIP limit (${limit}).`),
            { limit: [String(limit)] },
          )
      }
      const from = ctx.statuses.find((s) => s.statusId === i.statusId)?.name ?? '?'
      const toName = ctx.statuses.find((s) => s.statusId === to)?.name ?? '?'
      i.statusId = to
      i.resolvedAt = this.category(ctx, to) === 'DONE' ? this.iso() : null
      this.log(i.issueId, 'TRANSITIONED', ctx.me, `${from} → ${toName}`)
    }
    if (body.rankAfterIssueId !== undefined) this.placeAfter(projectId, i, body.rankAfterIssueId)
    i.updatedAt = this.iso()
    this.persist()
    return this.detail(ctx, i)
  }

  async rank(
    issueId: number,
    body: { afterIssueId: number | null; sprintId?: number | null },
  ): Promise<IssueSummaryDto> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.issueUpdate, true)
    const i = this.issue(issueId)
    if (body.sprintId !== undefined && (body.sprintId ?? null) !== i.sprintId) {
      i.sprintId = this.validSprint(projectId, body.sprintId)
      for (const s of this.load().issues.filter((x) => x.parentId === i.issueId)) s.sprintId = i.sprintId
      this.log(i.issueId, 'SPRINT_CHANGED', ctx.me, i.sprintId ? this.sprint(i.sprintId).name : 'Backlog')
    }
    this.placeAfter(projectId, i, body.afterIssueId ?? null)
    i.updatedAt = this.iso()
    this.persist()
    return this.summary(ctx, i)
  }

  // ---------- 4.4 Liên kết REQ ----------

  async fromRequirements(
    projectId: number,
    body: { refs: RequirementRef[]; type?: IssueType; sprintId?: number | null },
  ): Promise<{ items: IssueDetailDto[] }> {
    const ctx = await this.ctx(projectId, PERMISSIONS.issueCreate, true)
    if (!body.refs?.length) validationError({ refs: [tr('Chọn ít nhất 1 REQ.', 'Pick at least 1 REQ.')] })
    const links = newLinks(ctx.index, body.refs)
    const created: IssueRec[] = []
    for (const link of links) {
      const ref = reqRefDto(ctx.index, link, false)
      const rec = await this.insertIssue(ctx, {
        type: body.type ?? 'STORY',
        title: (ref.title || ref.reqKey || 'REQ').slice(0, 300),
        sprintId: body.sprintId ?? null,
        requirementRefs: [{ documentId: link.documentId, reqUid: link.reqUid }],
      })
      created.push(rec)
    }
    this.persist()
    return { items: created.map((r) => this.detail(ctx, r)) }
  }

  async setRequirements(issueId: number, refs: RequirementRef[]): Promise<IssueDetailDto> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.issueUpdate, true)
    const i = this.issue(issueId)
    i.links = newLinks(ctx.index, refs, i.links)
    if (!i.links.some((l) => l.changedLabel)) i.reqChanged = false
    this.log(
      i.issueId,
      'REQ_LINKED',
      ctx.me,
      i.links.map((l) => reqRefDto(ctx.index, l, false).reqKey ?? '?').join(', ') || null,
    )
    i.updatedAt = this.iso()
    this.persist()
    return this.detail(ctx, i)
  }

  async ack(issueId: number): Promise<IssueDetailDto> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.issueUpdate, true)
    const i = this.issue(issueId)
    i.reqChanged = false
    for (const l of i.links) l.changedLabel = null
    this.log(i.issueId, 'REQ_ACKED', ctx.me)
    i.updatedAt = this.iso()
    this.persist()
    return this.detail(ctx, i)
  }

  // ---------- 4.5 Bình luận & lịch sử ----------

  async listComments(issueId: number): Promise<{ items: IssueCommentDto[] }> {
    await this.ctx(this.issue(issueId).projectId, PERMISSIONS.commentView)
    const items = this.load()
      .comments.filter((c) => c.issueId === issueId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ issueId: _i, ...c }) => clone(c))
    return { items }
  }

  async addComment(
    issueId: number,
    body: { body: string; parentId?: number | null; mentionUserIds?: number[] },
  ): Promise<IssueCommentDto> {
    const projectId = this.issue(issueId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.commentWrite, true)
    const text = (body.body ?? '').trim()
    if (!text || text.length > 2000)
      validationError({ body: [tr('Nội dung 1–2000 ký tự.', 'Comment must be 1–2000 characters.')] })
    const people = await this.people(projectId)
    const c: CommentRec = {
      commentId: this.nextId(),
      issueId,
      parentId: body.parentId ?? null,
      body: text,
      mentions: people.filter((p) => (body.mentionUserIds ?? []).includes(p.userId)),
      author: ctx.me,
      createdAt: this.iso(),
    }
    this.load().comments.push(c)
    this.log(issueId, 'COMMENTED', ctx.me)
    this.persist()
    const { issueId: _i, ...dto } = c
    return clone(dto)
  }

  async listActivity(issueId: number): Promise<{ items: IssueActivityDto[] }> {
    await this.ctx(this.issue(issueId).projectId, PERMISSIONS.activityView)
    const items = this.load()
      .activities.filter((a) => a.issueId === issueId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.activityId - a.activityId)
      .slice(0, 100)
      .map(({ issueId: _i, ...a }) => clone(a))
    return { items }
  }

  // ---------- 4.6 Sprint ----------

  async listSprints(projectId: number, status?: SprintStatus): Promise<{ items: SprintDto[] }> {
    const ctx = await this.ctx(projectId, PERMISSIONS.issueView)
    const order: Record<SprintStatus, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2 }
    const items = this.load()
      .sprints.filter((s) => s.projectId === projectId && (!status || s.status === status))
      .sort((a, b) => order[a.status] - order[b.status] || a.sprintId - b.sprintId)
      .map((s) => this.sprintDto(ctx, s))
    return { items }
  }

  private validateSprint(body: Partial<CreateSprintBody>, creating: boolean) {
    const errors: Record<string, string[]> = {}
    const name = body.name?.trim()
    if ((creating || body.name !== undefined) && (!name || name.length > 100))
      errors.name = [tr('Tên sprint bắt buộc, tối đa 100 ký tự.', 'Sprint name is required, max 100 characters.')]
    if (
      body.capacityPoints !== undefined &&
      body.capacityPoints !== null &&
      (!Number.isInteger(body.capacityPoints) || body.capacityPoints < 0)
    )
      errors.capacityPoints = [tr('Sức chứa là số nguyên ≥ 0.', 'Capacity must be an integer ≥ 0.')]
    if (body.startDate && body.endDate && body.endDate < body.startDate)
      errors.endDate = [tr('Ngày kết thúc phải sau ngày bắt đầu.', 'End date must be after the start date.')]
    if (Object.keys(errors).length) validationError(errors)
  }

  async createSprint(projectId: number, body: CreateSprintBody): Promise<SprintDto> {
    const ctx = await this.ctx(projectId, PERMISSIONS.sprintManage, true)
    this.validateSprint(body, true)
    const s: SprintRec = {
      sprintId: this.nextId(),
      projectId,
      name: body.name.trim(),
      goal: body.goal?.trim() || null,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      status: 'PLANNED',
      capacityPoints: body.capacityPoints ?? null,
      completedAt: null,
    }
    this.load().sprints.push(s)
    this.persist()
    return this.sprintDto(ctx, s)
  }

  async updateSprint(sprintId: number, body: UpdateSprintBody): Promise<SprintDto> {
    const projectId = this.sprint(sprintId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.sprintManage, true)
    const s = this.sprint(sprintId)
    this.validateSprint(body, false)
    if (body.status === 'ACTIVE' && s.status !== 'ACTIVE') {
      if (s.status === 'COMPLETED') fail(409, 'INVALID_STATUS', tr('Sprint đã hoàn tất.', 'The sprint is completed.'))
      if (this.activeSprint(projectId))
        fail(
          409,
          'ACTIVE_SPRINT_EXISTS',
          tr('Dự án đang có một sprint chạy.', 'The project already has an active sprint.'),
        )
      s.status = 'ACTIVE'
      s.startDate ??= this.iso().slice(0, 10)
    }
    if (body.name !== undefined) s.name = body.name.trim()
    if (body.goal !== undefined) s.goal = body.goal?.trim() || null
    if (body.startDate !== undefined) s.startDate = body.startDate
    if (body.endDate !== undefined) s.endDate = body.endDate
    if (body.capacityPoints !== undefined) s.capacityPoints = body.capacityPoints
    this.persist()
    return this.sprintDto(ctx, s)
  }

  async completeSprint(sprintId: number, body: { moveOpenIssuesTo: 'BACKLOG' | number }): Promise<SprintDto> {
    const projectId = this.sprint(sprintId).projectId
    const ctx = await this.ctx(projectId, PERMISSIONS.sprintManage, true)
    const s = this.sprint(sprintId)
    if (s.status !== 'ACTIVE')
      fail(409, 'INVALID_STATUS', tr('Chỉ hoàn tất được sprint đang chạy.', 'Only the active sprint can be completed.'))
    let target: number | null = null
    if (body.moveOpenIssuesTo !== 'BACKLOG') {
      target = this.validSprint(projectId, Number(body.moveOpenIssuesTo))
      if (target === sprintId) validationError({ moveOpenIssuesTo: [tr('Chọn sprint khác.', 'Pick another sprint.')] })
    }
    for (const i of this.load().issues.filter((x) => x.sprintId === sprintId && !x.isDeleted)) {
      if (this.category(ctx, i.statusId) === 'DONE') continue
      i.sprintId = target
      this.log(i.issueId, 'SPRINT_CHANGED', ctx.me, target ? this.sprint(target).name : 'Backlog')
    }
    s.status = 'COMPLETED'
    s.completedAt = this.iso()
    this.persist()
    return this.sprintDto(ctx, s)
  }

  // ---------- Dữ liệu mẫu ----------

  hasData(projectId: number) {
    const db = this.load()
    return db.seeded.includes(projectId) || db.issues.some((i) => i.projectId === projectId && !i.isDeleted)
  }

  /**
   * Dữ liệu mẫu bám câu chuyện trong mock-kanban-testcases.html: sprint 4 đang chạy, ~10 issue ở các trạng thái,
   * REQ-02 của SRS-02 đổi ở bản đã duyệt gần nhất. Trả về map key → issueId để testMockStore gắn testcase.
   */
  async seedDemo(projectId: number): Promise<Record<string, number> | null> {
    const ctx = await this.ctx(projectId, PERMISSIONS.issueCreate, true)
    if (this.hasData(projectId)) return null
    const db = this.load()
    db.seeded.push(projectId)
    const isSec = projectId >= 20
    const secPeople: UserRef[] = [
      { userId: 3, fullName: 'Vũ Kim Kỳ' },
      { userId: 4, fullName: 'Phạm Minh Lương' },
      { userId: 5, fullName: 'Trương Quang Tâm' },
      { userId: 6, fullName: 'Phạm Công Minh' },
      { userId: 7, fullName: 'Đặng Thu Trang' },
      { userId: 8, fullName: 'Hoàng Minh Quân' },
      { userId: 10, fullName: 'Nguyễn Hoàng Nam' },
      { userId: 11, fullName: 'Lê Thị Khánh Linh' },
    ]
    db.people[projectId] = (isSec ? secPeople : DEMO_PEOPLE).map((p) => ({ ...p }))
    const [ln, th, nm] = DEMO_PEOPLE
    const me = ctx.me
    const uLuong: UserRef = { userId: 4, fullName: 'Phạm Minh Lương' }
    const uTam: UserRef = { userId: 5, fullName: 'Trương Quang Tâm' }
    const uMinh: UserRef = { userId: 6, fullName: 'Phạm Công Minh' }
    const uTrang: UserRef = { userId: 7, fullName: 'Đặng Thu Trang' }
    const uQuan: UserRef = { userId: 8, fullName: 'Hoàng Minh Quân' }
    const uNam: UserRef = { userId: 10, fullName: 'Nguyễn Hoàng Nam' }
    const uLinh: UserRef = { userId: 11, fullName: 'Lê Thị Khánh Linh' }
    const st = demoStatuses(ctx.wf)
    const day = 86_400_000
    const date = (d: number) => this.iso(d * day).slice(0, 10)
    const sprint = (
      name: string,
      status: SprintStatus,
      start: number,
      end: number,
      cap: number | null,
      goal: string | null = null,
    ): SprintRec => {
      const s: SprintRec = {
        sprintId: this.nextId(),
        projectId,
        name,
        goal,
        startDate: date(start),
        endDate: date(end),
        status,
        capacityPoints: cap,
        completedAt: status === 'COMPLETED' ? this.iso(start * day) : null,
      }
      db.sprints.push(s)
      return s
    }
    sprint(isSec ? 'Sprint 3 – Kết nối FIX 4.4 KRX & Tiểu khoản' : 'Sprint 3', 'COMPLETED', -14, -1, 28)
    const s4 = sprint(
      isSec ? 'Sprint 4 – Đặt lệnh KRX, Margin & Nộp tiền VietQR 9688' : 'Sprint 4',
      'ACTIVE',
      0,
      7,
      40,
      isSec
        ? 'Hoàn thiện đặt lệnh LO/MP/ATO/ATC qua cổng FIX 4.4 và nộp tiền VietQR định danh 9688 cộng sức mua T+0'
        : 'Thanh toán VietQR chạy ổn định trên production',
    )
    sprint(isSec ? 'Sprint 5 – Đối soát VSD T+2 & Bảng giá WebSocket' : 'Sprint 5', 'PLANNED', 7, 14, 40)
    if (st.doing) db.wip.push({ projectId, statusId: st.doing, limit: 4 })
    if (st.review && st.review !== st.doing) db.wip.push({ projectId, statusId: st.review, limit: 3 })

    const doc = (uid: string) => ctx.index.find((d) => [...d.baseline, ...d.current].some((r) => r.reqUid === uid))
    const ref = (uid: string): RequirementRef[] => {
      const d = doc(uid)
      return d ? [{ documentId: d.documentId, reqUid: uid }] : []
    }
    db.keySeq[projectId] = 100
    const keys: Record<string, number> = {}
    const add = async (
      body: CreateIssueBody & { status?: number; assignee?: UserRef | null; daysAgo?: number },
    ): Promise<IssueRec> => {
      const { status, assignee, daysAgo = 3, ...create } = body
      const rec = await this.insertIssue(ctx, { ...create, assigneeId: null }, { at: this.iso(-daysAgo * day) })
      rec.assignee = assignee ?? null
      if (status) rec.statusId = status
      if (status && status === st.done) rec.resolvedAt = this.iso(-day)
      keys[rec.key.split('-').pop()!] = rec.issueId
      return rec
    }
    const s = s4.sprintId
    await add({
      type: 'TASK',
      title: isSec
        ? 'Cấu hình cổng xác thực OAuth2/JWT & Ký số lệnh đặt bằng SmartOTP TOTP (RFC 6238)'
        : 'Cấu hình OAuth2 và JWT',
      description: isSec
        ? 'Xây dựng microservice xác thực phiên giao dịch chứng khoán, kiểm tra chữ ký TOTP 6 số khi gửi lệnh Mua/Bán cổ phiếu qua FIX 4.4.'
        : undefined,
      status: st.review,
      assignee: isSec ? uLuong : me,
      points: 5,
      sprintId: s,
      requirementRefs: ref(AUTH_REQ.login),
    })
    await add({
      type: 'STORY',
      title: isSec
        ? 'Màn hình đăng nhập Số lưu ký 058C & Mở khoá đặt lệnh SmartOTP 6 số trên bảng giá'
        : 'Màn hình đăng nhập bằng email',
      description: isSec
        ? 'Hỗ trợ đăng nhập bằng số tài khoản lưu ký (058Cxxxxxx), chọn Tiểu khoản Thường (1) / Margin (6) và popup nhập PIN SmartOTP.'
        : undefined,
      status: st.done,
      assignee: isSec ? uQuan : ln,
      points: 3,
      sprintId: s,
      requirementRefs: ref(AUTH_REQ.login),
      daysAgo: 6,
    })
    await add({
      type: 'TASK',
      title: isSec
        ? 'Tích hợp cổng Napas247 sinh mã VietQR định danh tiểu khoản chứng khoán (9688)'
        : 'Tích hợp SDK Napas247 sinh mã VietQR',
      description: isSec
        ? 'Sinh mã QR động chứa tài khoản ảo 9688 + số lưu ký 6 số + hậu tố tiểu khoản (1/6) và số tiền nộp ký quỹ.'
        : undefined,
      status: st.doing,
      assignee: isSec ? uNam : me,
      points: 8,
      sprintId: s,
      requirementRefs: ref(PAY_REQ.qr),
    })
    const webhook = await add({
      type: 'BUG',
      title: isSec
        ? 'Cộng trùng Sức mua T+0 khi ngân hàng lưu ký BIDV gửi lại webhook báo có'
        : 'Ghi có trùng khi ngân hàng gửi lại webhook',
      description: isSec
        ? 'Khi kết nối mạng giữa BIDV và API Gateway chập chờn (> 3s), ngân hàng retry webhook báo có dẫn tới cộng gấp đôi Purchasing Power trên tiểu khoản Margin.'
        : undefined,
      status: st.doing,
      assignee: isSec ? uLuong : me,
      points: 5,
      priority: 'HIGHEST',
      sprintId: s,
      requirementRefs: ref(PAY_REQ.webhook),
      daysAgo: 2,
    })
    await add({
      type: 'TASK',
      title: isSec
        ? 'Engine đối soát tự động giao dịch nộp tiền T+0 & Giải tỏa cảnh báo Call Margin'
        : 'Đối soát giao dịch VietQR',
      description: isSec
        ? 'Tự động tính lại tỷ lệ ký quỹ Rtt ngay sau khi hạch toán tiền nộp; nếu Rtt >= 85% thì gỡ cờ Force Sell trên OMS.'
        : undefined,
      status: st.review,
      assignee: isSec ? uNam : th,
      points: 5,
      sprintId: s,
      requirementRefs: ref(PAY_REQ.reconcile),
    })
    await add({
      type: 'DESIGN',
      title: isSec
        ? 'Thiết kế UI Modal Nộp tiền VietQR 9688 có đồng hồ đếm ngược & Cảnh báo tỷ lệ Rtt'
        : 'Thiết kế modal VietQR có đồng hồ đếm ngược',
      status: st.doing,
      assignee: isSec ? uTrang : nm,
      points: 3,
      sprintId: s,
      requirementRefs: ref(PAY_REQ.qr),
    })
    await add({
      type: 'TASK',
      title: isSec
        ? 'Ghi nhật ký kiểm toán (Audit Log) bất biến cho mọi lần đặt lệnh & khoá SmartOTP'
        : 'Ghi log kiểm toán cho mỗi lần đăng nhập',
      status: st.todo,
      assignee: isSec ? uNam : ln,
      points: 3,
      priority: 'HIGHEST',
      sprintId: s,
      labels: ['blocked'],
      requirementRefs: isSec ? ref(AUTH_REQ.lock) : undefined,
    })
    await add({
      type: 'TASK',
      title: isSec
        ? 'Hiển thị đồng hồ đếm ngược 10 phút & tự điền số tiền Top-up Call Margin trên màn Nộp tiền'
        : 'Hiện đồng hồ đếm ngược trên màn thanh toán',
      status: st.todo,
      assignee: isSec ? uQuan : me,
      points: 3,
      priority: 'HIGH',
      sprintId: s,
      requirementRefs: ref(PAY_REQ.qr),
      daysAgo: 1,
    })
    await add({
      type: 'STORY',
      title: isSec
        ? 'Luồng xử lý đối soát thủ công cho Kế toán Tiền khi khách nộp lệch tiền / sai tiểu khoản'
        : 'Đối soát thủ công khi sai số tiền',
      status: st.todo,
      assignee: isSec ? uMinh : null,
      points: 5,
      sprintId: null,
      daysAgo: 4,
    })
    await add({
      type: 'TASK',
      title: isSec
        ? 'Gửi cảnh báo SMS/Email cho Kế toán Giao dịch Tiền & Broker khi giao dịch nộp tiền bị treo'
        : 'Gửi email cho kế toán khi lệch tiền',
      status: st.todo,
      assignee: isSec ? uLinh : null,
      points: 2,
      priority: 'LOW',
      sprintId: null,
      daysAgo: 4,
    })
    const sub1 = await add({
      type: 'TASK',
      title: isSec
        ? 'Thêm bảng lưu khoá chống trùng bankTransId (Idempotency Key) trên Redis & PostgreSQL'
        : 'Thêm bảng lưu mã giao dịch',
      status: st.done,
      assignee: isSec ? uLuong : me,
      parentId: webhook.issueId,
      daysAgo: 1,
    })
    const sub2 = await add({
      type: 'TASK',
      title: isSec
        ? 'Viết Cronjob đối chiếu và dọn cache khoá giao dịch webhook sau 24 giờ (sau batch EOD)'
        : 'Viết job xoá mã giao dịch sau 24 giờ',
      status: st.todo,
      assignee: isSec ? uNam : me,
      parentId: webhook.issueId,
      daysAgo: 1,
    })
    for (const x of [sub1, sub2]) x.sprintId = s
    // REQ-02 (webhook) đổi ở bản đã duyệt gần nhất → CORE-104 cần xem lại.
    for (const l of webhook.links) {
      l.changedLabel = ctx.index.find((d) => d.documentId === l.documentId)?.baselineLabel ?? '1.1'
      webhook.reqChanged = true
    }
    const targetDev = isSec ? uLuong : me
    const commentAuthor = isSec ? uTam : th
    this.load().comments.push({
      commentId: this.nextId(),
      issueId: webhook.issueId,
      parentId: null,
      body: isSec
        ? `@${targetDev.fullName} lỗi cộng trùng sức mua T+0 vẫn tái hiện trên SIT khi giả lập BIDV gửi lại webhook sau 10 giây, mình đã log chi tiết trong kịch bản kiểm thử.`
        : `@${me.fullName} lỗi vẫn còn khi ngân hàng gửi lại sau 10 giây, mình đã ghi ở TC "Không ghi có trùng".`,
      mentions: [targetDev],
      author: commentAuthor,
      createdAt: this.iso(-3 * 3_600_000),
    })
    this.persist()
    return keys
  }
}
