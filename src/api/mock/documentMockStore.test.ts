import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/apiClient'
import type { TipTapDoc } from '@/types/document'
import { DocumentMockStore, MOCK_STORAGE_KEY, type ProjectAccess } from './documentMockStore'
import { h, p, tasks } from './documentSeed'

const ALL = [
  'document.view',
  'document.edit',
  'document.approve',
  'document.revise',
  'document.delete',
  'comment.view',
  'comment.write',
  'ai.use',
]

function setup(access: Partial<ProjectAccess> = {}, mem = new Map<string, string>()) {
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  let clock = new Date('2026-10-29T08:00:00Z').getTime()
  let i = 0
  const env = {
    actor: async () => ({ userId: 7, fullName: 'Người test' }),
    projectAccess: async () => ({ permissions: ALL, aiEnabled: true, archived: false, ...access }),
    storage,
    now: () => new Date(clock),
    latency: () => 0,
    uid: () => `uid-${String(++i).padStart(4, '0')}-xxxx`,
  }
  return { store: new DocumentMockStore(env), mem, tick: (ms: number) => (clock += ms), env }
}

async function expectCode(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ApiError)
  expect((err as ApiError).code).toBe(code)
  expect((err as ApiError).status).toBe(status)
  return err as ApiError
}

const reqDoc = (text = 'Thân'): TipTapDoc => ({
  type: 'doc',
  content: [h('r1', 2, 'Yêu cầu A', { uid: 'req-a' }), p('p1', text), tasks('t1', [['Tiêu chí', false]])],
})

describe('DocumentMockStore — seed & cây', () => {
  it('dự án mới rỗng; không tự seed', async () => {
    const { store } = setup()
    expect((await store.listTree(1)).items).toEqual([])
    const page = await store.createNode(1, { kind: 'PAGE', title: 'Trang đầu', docType: 'URD' })
    expect(page).toMatchObject({ parentId: null, code: 'URD-01' })
    expect((await store.listTree(1)).items).toHaveLength(1)
    // Dự án đã có tài liệu → seedDemo không làm gì.
    expect(await store.seedDemo(1)).toBe(false)
    expect((await store.listTree(1)).items).toHaveLength(1)
  })

  it('seedDemo: 2 thư mục + 3 trang, lưu vào storage; cần quyền sửa', async () => {
    const { store, mem } = setup()
    expect(await store.seedDemo(1)).toBe(true)
    const items = await store.listTree(1).then((r) => r.items)
    expect(items.filter((n) => n.kind === 'FOLDER').map((n) => n.title)).toEqual([
      '01. Tài liệu nghiệp vụ (BRD/URD)',
      '02. Đặc tả yêu cầu (SRS)',
    ])
    const pages = items.filter((n) => n.kind === 'PAGE')
    expect(pages.map((n) => [n.code, n.currentVersion?.status, n.reqCount])).toEqual(
      expect.arrayContaining([
        ['URD-01', 'DRAFT', 0],
        ['SRS-01', 'APPROVED', 2],
        ['SRS-02', 'IN_REVIEW', 3],
      ]),
    )
    const srs2 = pages.find((n) => n.code === 'SRS-02')!
    expect(srs2.baselineVersionId).not.toBeNull()
    expect(srs2.currentVersion?.label).toBe('1.2')
    expect(mem.get(MOCK_STORAGE_KEY)).toBeTruthy()
    await expectCode(setup({ permissions: ['document.view'] }).store.seedDemo(2), 403, 'FORBIDDEN')
  })

  it('dữ liệu đã seed tự động ở bản cũ được giữ nguyên', async () => {
    const first = setup()
    await first.store.seedDemo(1)
    const again = setup({}, first.mem)
    expect((await again.store.listTree(1)).items).toHaveLength(5)
  })

  it('tìm kiếm giữ cả nút cha', async () => {
    const { store } = setup()
    await store.seedDemo(1)
    const items = await store.listTree(1, 'srs-02').then((r) => r.items)
    expect(items.map((n) => n.title)).toEqual(['02. Đặc tả yêu cầu (SRS)', 'Thanh toán & VietQR động'])
  })

  it('sinh mã theo loại; di chuyển vào con cháu → INVALID_PARENT', async () => {
    const { store } = setup()
    await store.seedDemo(1)
    const folder = await store.createNode(1, { kind: 'FOLDER', title: 'Thư mục' })
    const page = await store.createNode(1, {
      kind: 'PAGE',
      title: 'Trang',
      docType: 'SRS',
      parentId: folder.documentId,
    })
    const other = await store.createNode(1, { kind: 'PAGE', title: 'Khác', docType: 'OTHER' })
    expect(page.code).toBe('SRS-03')
    expect(other.code).toBe('DOC-01')
    expect(page.currentVersion).toMatchObject({ label: '1.0', status: 'DRAFT' })
    await expectCode(store.updateNode(folder.documentId, { parentId: page.documentId }), 400, 'INVALID_PARENT')
    await expectCode(store.updateNode(folder.documentId, { parentId: folder.documentId }), 400, 'INVALID_PARENT')
    await store.deleteNode(folder.documentId)
    await expectCode(store.getDocument(page.documentId), 404, 'DOCUMENT_NOT_FOUND')
  })

  it('đổi thứ tự trong cùng cha', async () => {
    const { store } = setup()
    const a = await store.createNode(1, { kind: 'FOLDER', title: 'A' })
    await store.createNode(1, { kind: 'FOLDER', title: 'B' })
    await store.updateNode(a.documentId, { sortOrder: 0 })
    const roots = (await store.listTree(1)).items.filter((n) => n.parentId === null).map((n) => n.title)
    expect(roots[0]).toBe('A')
  })
})

describe('DocumentMockStore — vòng đời phiên bản', () => {
  let s: ReturnType<typeof setup>
  beforeEach(() => {
    s = setup()
  })

  async function newPage() {
    const node = await s.store.createNode(1, { kind: 'PAGE', title: 'Trang', docType: 'SRS' })
    const d = await s.store.getDocument(node.documentId)
    return { id: node.documentId, v: d.current }
  }

  it('lưu: trích REQ, tăng rowVersion; rowVersion cũ → VERSION_CONFLICT; content sai → INVALID_CONTENT', async () => {
    const { id, v } = await newPage()
    const res = await s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: v.rowVersion })
    expect(res.version.rowVersion).toBe(v.rowVersion + 1)
    expect(res.requirements).toHaveLength(1)
    expect(res.requirements[0]).toMatchObject({ reqKey: 'REQ-01', title: 'Yêu cầu A', changedSinceBaseline: false })
    await expectCode(
      s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: v.rowVersion }),
      409,
      'VERSION_CONFLICT',
    )
    await expectCode(
      s.store.saveContent(id, v.versionId, {
        content: { type: 'para' } as unknown as TipTapDoc,
        rowVersion: v.rowVersion + 1,
      }),
      400,
      'INVALID_CONTENT',
    )
  })

  it('gộp CONTENT_SAVED trong 15 phút', async () => {
    const { id, v } = await newPage()
    await s.store.saveContent(id, v.versionId, { content: reqDoc('1'), rowVersion: 1 })
    s.tick(60_000)
    await s.store.saveContent(id, v.versionId, { content: reqDoc('2'), rowVersion: 2 })
    let saved = (await s.store.listActivity(id)).items.filter((a) => a.action === 'CONTENT_SAVED')
    expect(saved).toHaveLength(1)
    s.tick(16 * 60_000)
    await s.store.saveContent(id, v.versionId, { content: reqDoc('3'), rowVersion: 3 })
    saved = (await s.store.listActivity(id)).items.filter((a) => a.action === 'CONTENT_SAVED')
    expect(saved).toHaveLength(2)
  })

  it('gửi duyệt cần REQ; duyệt; bản đã duyệt bị khoá; sửa đổi tạo 1.1 rồi chặn bản mở thứ 2', async () => {
    const { id, v } = await newPage()
    await expectCode(s.store.submit(id, v.versionId), 409, 'NO_REQUIREMENTS')
    await expectCode(s.store.approve(id, v.versionId), 409, 'INVALID_STATUS')
    await expectCode(s.store.createRevision(id), 409, 'NO_BASELINE')
    await s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: 1 })
    const submitted = await s.store.submit(id, v.versionId)
    expect(submitted.current.status).toBe('IN_REVIEW')
    await expectCode(s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: 2 }), 409, 'VERSION_LOCKED')
    await expectCode(s.store.submit(id, v.versionId), 409, 'INVALID_STATUS')

    const approved = await s.store.approve(id, v.versionId)
    expect(approved.current.status).toBe('APPROVED')
    expect(approved.node.baselineVersionId).toBe(v.versionId)
    expect(approved.node.isBaselined).toBe(true)
    // Lần duyệt đầu: mọi REQ là mới → STALE.
    expect((await s.store.listRequirements(id)).items[0].freshness).toBe('STALE')

    const rev = await s.store.createRevision(id)
    expect(rev.current).toMatchObject({ label: '1.1', status: 'DRAFT', baseVersionId: v.versionId })
    expect(rev.current.content).toEqual(approved.current.content) // copy nguyên → id khối giữ nguyên
    await expectCode(s.store.createRevision(id), 409, 'OPEN_VERSION_EXISTS')
  })

  it('yêu cầu chỉnh sửa cần ghi chú ≥ 5 ký tự, rồi sửa & gửi lại được', async () => {
    const { id, v } = await newPage()
    await s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: 1 })
    await s.store.submit(id, v.versionId)
    const err = await expectCode(s.store.requestChanges(id, v.versionId, 'abc'), 400, 'VALIDATION_ERROR')
    expect(err.errors?.note).toBeTruthy()
    const d = await s.store.requestChanges(id, v.versionId, 'Bổ sung tiêu chí')
    expect(d.current).toMatchObject({ status: 'CHANGES_REQUESTED', reviewNote: 'Bổ sung tiêu chí' })
    await s.store.saveContent(id, v.versionId, { content: reqDoc('mới'), rowVersion: 2 })
    expect((await s.store.submit(id, v.versionId)).current.status).toBe('IN_REVIEW')
  })

  it('freshness: REQ không đổi giữ trạng thái cũ, REQ đổi / mới → STALE; xác nhận → FRESH; summary', async () => {
    const { id, v } = await newPage()
    const two: TipTapDoc = {
      type: 'doc',
      content: [...reqDoc().content, h('r2', 2, 'Yêu cầu B', { uid: 'req-b' }), p('p2', 'B')],
    }
    await s.store.saveContent(id, v.versionId, { content: two, rowVersion: 1 })
    await s.store.submit(id, v.versionId)
    await s.store.approve(id, v.versionId)
    const base = (await s.store.listRequirements(id)).items
    await s.store.confirmFresh(base[0].requirementId)
    await s.store.confirmFresh(base[1].requirementId)

    const rev = await s.store.createRevision(id)
    const edited: TipTapDoc = {
      type: 'doc',
      content: [
        ...reqDoc().content, // REQ A giữ nguyên
        h('r2', 2, 'Yêu cầu B', { uid: 'req-b' }),
        p('p2', 'B đã sửa'),
        h('r3', 2, 'Yêu cầu C', { uid: 'req-c' }),
      ],
    }
    const saved = await s.store.saveContent(id, rev.current.versionId, { content: edited, rowVersion: 1 })
    expect(saved.requirements.map((r) => r.changedSinceBaseline)).toEqual([false, true, true])
    await s.store.submit(id, rev.current.versionId)
    const approved = await s.store.approve(id, rev.current.versionId)
    expect(approved.versions.find((x) => x.versionId === v.versionId)?.status).toBe('SUPERSEDED')
    const reqs = (await s.store.listRequirements(id)).items
    expect(reqs.map((r) => [r.reqKey, r.freshness])).toEqual([
      ['REQ-01', 'FRESH'],
      ['REQ-02', 'STALE'],
      ['REQ-03', 'STALE'],
    ])
    const activity = (await s.store.listActivity(id)).items
    expect(activity.find((a) => a.action === 'APPROVED')?.note).toBe('Sửa REQ-02; thêm REQ-03')
    expect(activity.find((a) => a.action === 'SUBMITTED')?.note).toBe('Sửa REQ-02; thêm REQ-03')
    const fresh = await s.store.confirmFresh(reqs[1].requirementId)
    expect(fresh.freshness).toBe('FRESH')
  })

  it('đổi priority sửa attrs trong content của bản đang mở', async () => {
    const { id, v } = await newPage()
    const saved = await s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: 1 })
    const r = await s.store.updateRequirement(saved.requirements[0].requirementId, { priority: 'HIGH' })
    expect(r.priority).toBe('HIGH')
    const d = await s.store.getDocument(id)
    expect(d.current.content.content[0].attrs?.priority).toBe('HIGH')
    expect(d.current.rowVersion).toBe(3)
  })

  it('bình luận theo đoạn chữ, resolve thì ẩn khỏi danh sách mặc định', async () => {
    const { id, v } = await newPage()
    const c = await s.store.addComment(id, { versionId: v.versionId, anchorId: 'p1', quote: 'Thân', body: 'Rõ hơn?' })
    expect(c).toMatchObject({ anchorId: 'p1', quote: 'Thân', resolvedAt: null })
    expect((await s.store.listComments(id, { versionId: v.versionId })).items).toHaveLength(1)
    await s.store.resolveComment(c.commentId)
    expect((await s.store.listComments(id, { versionId: v.versionId })).items).toHaveLength(0)
    expect((await s.store.listComments(id, { versionId: v.versionId, includeResolved: true })).items).toHaveLength(1)
  })

  it('D01: trả lời 1 cấp + @nhắc theo mentionUserIds; resolve gốc = resolve cả luồng; COMMENTED vào lịch sử', async () => {
    const { id, v } = await newPage()
    const root = await s.store.addComment(id, { versionId: v.versionId, body: 'Gốc', mentionUserIds: [5, 5, 9] })
    expect(root).toMatchObject({ parentId: null, mentions: [{ userId: 5 }, { userId: 9 }] })
    const reply = await s.store.addComment(id, { versionId: v.versionId, body: 'Trả lời', parentId: root.commentId })
    expect(reply.parentId).toBe(root.commentId)
    await expectCode(
      s.store.addComment(id, { versionId: v.versionId, body: 'Lồng', parentId: reply.commentId }),
      400,
      'VALIDATION_ERROR',
    )
    await expectCode(
      s.store.addComment(id, { versionId: v.versionId, body: 'x', parentId: 999 }),
      404,
      'COMMENT_NOT_FOUND',
    )
    await expectCode(s.store.resolveComment(999), 404, 'COMMENT_NOT_FOUND')
    await s.store.resolveComment(root.commentId)
    expect((await s.store.listComments(id, { versionId: v.versionId })).items).toEqual([])
    expect((await s.store.listActivity(id)).items.filter((a) => a.action === 'COMMENTED')).toHaveLength(2)
  })

  it('D08: bình luận dùng comment.view / comment.write (không phải document.*)', async () => {
    const { id, v } = await newPage()
    const noComment = setup({ permissions: ['document.view', 'document.edit'] }, s.mem)
    await expectCode(noComment.store.listComments(id), 403, 'FORBIDDEN')
    await expectCode(noComment.store.addComment(id, { versionId: v.versionId, body: 'x' }), 403, 'FORBIDDEN')
    const commenter = setup({ permissions: ['document.view', 'comment.view', 'comment.write'] }, s.mem)
    expect((await commenter.store.addComment(id, { versionId: v.versionId, body: 'ok' })).body).toBe('ok')
  })

  it('D19: 409 VERSION_CONFLICT kèm `current` (người / lúc lưu)', async () => {
    const { id, v } = await newPage()
    await s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: 1 })
    const err = await expectCode(
      s.store.saveContent(id, v.versionId, { content: reqDoc(), rowVersion: 1 }),
      409,
      'VERSION_CONFLICT',
    )
    expect(err.current).toMatchObject({ rowVersion: 2, updatedBy: { userId: expect.any(Number) } })
  })
})

describe('DocumentMockStore — quyền & AI', () => {
  it('thiếu quyền → FORBIDDEN; dự án lưu trữ → PROJECT_ARCHIVED; detail.can phản ánh quyền', async () => {
    const editor = setup()
    await editor.store.seedDemo(1)
    const viewer = setup({ permissions: ['document.view'] }, editor.mem)
    const tree = (await viewer.store.listTree(1)).items
    const page = tree.find((n) => n.code === 'SRS-02')!
    const d = await viewer.store.getDocument(page.documentId)
    expect(d.can).toEqual({ edit: false, approve: false, revise: false, delete: false })
    await expectCode(viewer.store.createNode(1, { kind: 'FOLDER', title: 'x' }), 403, 'FORBIDDEN')
    await expectCode(viewer.store.approve(page.documentId, d.current.versionId), 403, 'FORBIDDEN')

    const archived = setup({ archived: true })
    await archived.store.listTree(1)
    await expectCode(archived.store.createNode(1, { kind: 'FOLDER', title: 'x' }), 409, 'PROJECT_ARCHIVED')
  })

  it('AI sinh sơ đồ (§6b): quyền edit, AI tắt, text rỗng/quá dài, kết quả đề xuất', async () => {
    await expectCode(setup({ aiEnabled: false }).store.generateDiagram(1, { text: 'Bước một' }), 409, 'AI_DISABLED')
    await expectCode(
      setup({ permissions: ['document.view'] }).store.generateDiagram(1, { text: 'Bước một' }),
      403,
      'FORBIDDEN',
    )
    const { store } = setup()
    // D09: AI tài liệu cần thêm `ai.use`.
    await expectCode(
      setup({ permissions: ALL.filter((x) => x !== 'ai.use') }).store.generateDiagram(1, { text: 'Bước một' }),
      403,
      'FORBIDDEN',
    )
    await expectCode(store.generateDiagram(1, { text: '   ' }), 400, 'VALIDATION_ERROR')
    await expectCode(store.generateDiagram(1, { text: 'x'.repeat(8001) }), 400, 'VALIDATION_ERROR')
    const r = await store.generateDiagram(1, {
      text: 'Mở trang. Nếu đã đăng nhập thì vào trang chủ.',
      documentId: 3,
      anchorId: 'b1',
    })
    expect(r.kind).toBe('flowchart')
    expect(r.mermaid.startsWith('flowchart TD')).toBe(true)
    expect(r.notes).toHaveLength(1)
    expect((await store.generateDiagram(1, { text: 'Mở trang. Bấm nút.', kind: 'sequence' })).kind).toBe('flowchart')
  })

  it('AI tắt → AI_DISABLED; ghi chú quá ngắn → VALIDATION_ERROR; tạo trang từ ghi chú', async () => {
    const off = setup({ aiEnabled: false })
    await expectCode(off.store.normalize(1, 'x'.repeat(30)), 409, 'AI_DISABLED')
    const on = setup()
    await on.store.seedDemo(1)
    await expectCode(on.store.normalize(1, 'ngắn'), 400, 'VALIDATION_ERROR')
    const fields = await on.store.normalize(
      1,
      'Bán hàng online.\nKhách hàng đặt đơn hàng\nĐơn hàng phải thanh toán trong 30 phút',
    )
    const { items } = await on.store.extract(1, fields)
    expect(items).toHaveLength(1)
    const d = await on.store.createFromNotes(1, {
      title: 'SRS mới',
      docType: 'SRS',
      parentId: null,
      rawNotes: 'x',
      fields,
      items,
    })
    expect(d.node.code).toBe('SRS-03')
    expect(d.current).toMatchObject({ label: '1.0', status: 'DRAFT' })
    expect(d.node.reqCount).toBe(1)
    const act = (await on.store.listActivity(d.node.documentId)).items
    expect(act[0].action).toBe('GENERATED_FROM_NOTES')
  })
})
