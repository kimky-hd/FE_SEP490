import { describe, expect, it } from 'vitest'
import type { TipTapDoc } from '@/types/document'
import { DocumentMockStore, type ProjectAccess } from './mock/documentMockStore'
import { h, p, tasks } from './mock/documentSeed'
import { buildMyWork, loadPageInfos, MY_WORK_FEED_LIMIT, type DocumentWorkSource } from './documentWork'

const ALL = [
  'document.view',
  'document.edit',
  'document.approve',
  'document.revise',
  'document.delete',
  'comment.view',
  'comment.write',
]
const ME = { userId: 7, fullName: 'Người test' }

function setup(accessByProject: Record<number, Partial<ProjectAccess>> = {}) {
  const mem = new Map<string, string>()
  let clock = new Date('2026-10-29T08:00:00Z').getTime()
  let i = 0
  let actor = ME
  const store = new DocumentMockStore({
    actor: async () => actor,
    projectAccess: async (projectId) => ({
      permissions: ALL,
      aiEnabled: true,
      archived: false,
      ...accessByProject[projectId],
    }),
    storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) },
    now: () => new Date(clock),
    latency: () => 0,
    uid: () => `uid-${String(++i).padStart(4, '0')}-xxxx`,
  })
  const api: DocumentWorkSource = {
    listTree: (projectId) => store.listTree(projectId).then((r) => r.items),
    get: (documentId) => store.getDocument(documentId),
    listRequirements: (documentId, versionId) => store.listRequirements(documentId, versionId).then((r) => r.items),
    activity: (documentId) => store.listActivity(documentId).then((r) => r.items),
    listComments: (documentId, params) => store.listComments(documentId, params).then((r) => r.items),
  }
  return {
    store,
    api,
    tick: (ms: number) => (clock += ms),
    actAs: (u: typeof ME) => (actor = u),
  }
}

const reqDoc = (title = 'Yêu cầu A'): TipTapDoc => ({
  type: 'doc',
  content: [h('r1', 2, title, { uid: 'req-a' }), p('p1', 'Thân'), tasks('t1', [['Tiêu chí', false]])],
})

const project = (projectId: number, permissions = ALL) => ({
  projectId,
  name: `Dự án ${projectId}`,
  key: `P${projectId}`,
  permissions,
})

describe('buildMyWork', () => {
  it('dữ liệu mẫu: chờ duyệt, bản nháp của tôi, REQ stale, thống kê và hoạt động', async () => {
    const { store, api } = setup()
    await store.seedDemo(1)
    const work = await buildMyWork(api, [project(1)], ME)

    expect(work.reviews.map((x) => [x.code, x.versionLabel, x.submittedBy?.fullName])).toEqual([
      ['SRS-02', '1.2', 'Nguyễn Minh Anh'],
    ])
    expect(work.reviews[0].changeSummary).toBeTruthy()
    // URD-01 nháp do người tạo dữ liệu mẫu viết.
    expect(work.drafts.map((x) => x.code)).toEqual(['URD-01'])
    expect(work.changesRequested).toEqual([])
    expect(work.staleReqs.length).toBeGreaterThan(0)
    expect(work.staleReqs.every((r) => r.code === 'SRS-02')).toBe(true)

    expect(work.projectStats).toEqual([
      { projectId: 1, pages: 3, reqs: 5, approved: 1, inReview: 1, draft: 1, staleReqs: work.staleReqs.length },
    ])

    expect(work.activity.length).toBeLessThanOrEqual(MY_WORK_FEED_LIMIT)
    const times = work.activity.map((e) => e.createdAt)
    expect([...times].sort().reverse()).toEqual(times)
    const kinds = new Set(work.activity.map((e) => e.kind))
    expect(kinds.has('SUBMITTED')).toBe(true)
    expect(kinds.has('COMMENTED')).toBe(true)
    expect(kinds.has('STALE')).toBe(true)
  })

  it('chỉ đưa vào "Chờ tôi duyệt" khi có document.approve; bỏ qua dự án không xem được', async () => {
    const { store, api } = setup({ 2: { permissions: [] } })
    await store.seedDemo(1)
    const work = await buildMyWork(api, [project(1, ['document.view']), project(2, [])], ME)
    expect(work.reviews).toEqual([])
    expect(work.staleReqs.length).toBeGreaterThan(0)
    expect(work.projectStats.find((s) => s.projectId === 2)).toMatchObject({ pages: 0, reqs: 0 })
  })

  it('"Bị yêu cầu sửa" và "Tôi đang viết" chỉ tính bản do tôi viết', async () => {
    const { store, api, tick, actAs } = setup()
    const mine = await store.createNode(1, { kind: 'PAGE', title: 'Của tôi', docType: 'SRS' })
    const d = await store.getDocument(mine.documentId)
    await store.saveContent(mine.documentId, d.current.versionId, {
      content: reqDoc(),
      rowVersion: d.current.rowVersion,
    })
    await store.submit(mine.documentId, d.current.versionId)
    tick(60_000)
    actAs({ userId: 8, fullName: 'Trưởng nhóm' })
    await store.requestChanges(mine.documentId, d.current.versionId, 'Bổ sung tiêu chí nghiệm thu.')
    await store.createNode(1, { kind: 'PAGE', title: 'Của người khác', docType: 'URD' })
    actAs(ME)

    const work = await buildMyWork(api, [project(1)], ME)
    expect(work.changesRequested.map((x) => x.title)).toEqual(['Của tôi'])
    expect(work.drafts).toEqual([])
    expect(work.activity[0]).toMatchObject({ kind: 'CHANGES_REQUESTED', actor: { fullName: 'Trưởng nhóm' } })
  })

  it('dự án rỗng → mọi danh sách trống, thống kê 0', async () => {
    const { api } = setup()
    const work = await buildMyWork(api, [project(3)], ME)
    expect(work).toEqual({
      reviews: [],
      drafts: [],
      changesRequested: [],
      staleReqs: [],
      activity: [],
      projectStats: [{ projectId: 3, pages: 0, reqs: 0, approved: 0, inReview: 0, draft: 0, staleReqs: 0 }],
    })
  })
})

describe('loadPageInfos', () => {
  it('gắn thư mục cha, tác giả và REQ stale cho từng trang', async () => {
    const { store, api } = setup()
    await store.seedDemo(1)
    const { nodes, pages } = await loadPageInfos(api, 1)
    expect(nodes.filter((n) => n.kind === 'FOLDER')).toHaveLength(2)
    const pay = pages.find((x) => x.node.code === 'SRS-02')!
    expect(pay.parent?.title).toBe('02. Đặc tả yêu cầu (SRS)')
    expect(pay.author?.fullName).toBe('Nguyễn Minh Anh')
    expect(pay.submittedBy?.fullName).toBe('Nguyễn Minh Anh')
    expect(pay.stale.length).toBeGreaterThan(0)
    expect(pay.comments).toEqual([])
    const urd = pages.find((x) => x.node.code === 'URD-01')!
    expect(urd.submittedBy).toBeNull()
    expect(urd.author).toEqual(ME)
  })
})
