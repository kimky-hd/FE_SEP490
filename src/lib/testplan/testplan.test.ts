import { describe, expect, it } from 'vitest'
import type { TipTapDoc } from '@/types/document'
import type { RetestFlagDto, TestCaseDto, TestModuleDto, TestResult } from '@/types/testing'
import { canEditCell, testAbilities } from './abilities'
import {
  allColumns,
  clampNumber,
  defaultCustomFields,
  emptyLayout,
  moveColumn,
  validateColumn,
  visibleColumns,
} from './columns'
import { findPlacement, nextCaseCode, nextGroupCode, nextTopCode, placementKey } from './placement'
import {
  bugFixedFlags,
  recordOutcome,
  regressionFlags,
  reqChangedFlags,
  retestWhy,
  withFlag,
  withoutFlag,
} from './retest'
import { defaultModuleSections, extractDocSections, sectionOfReq, stripHeadingNumber } from './sections'
import { pct, statsIn, statusIn, traceStatusOf } from './status'
import { joinNumbered, splitNumbered, stepsToText, textToSteps } from './steps'

const t = (vi: string) => vi
const SIT = 1
const UAT = 2

const result = (envId: number, r: TestResult, i = 1) => ({
  resultId: i,
  envId,
  build: 'v1',
  result: r,
  by: { userId: 1, fullName: 'Lan' },
  at: `2026-11-0${i}T08:00:00Z`,
  behalfOf: null,
})
const flag = (envId: number, reason: RetestFlagDto['reason'] = 'REGRESSION'): RetestFlagDto => ({
  envId,
  reason,
  bug: null,
  build: null,
  reqKey: null,
  at: '2026-11-05T08:00:00Z',
})
const tc = (
  id: number,
  results: ReturnType<typeof result>[] = [],
  extra: Partial<TestCaseDto> & { bugId?: number } = {},
) =>
  ({
    testCaseId: id,
    moduleId: 10,
    status: 'ACTIVE',
    results,
    retest: [],
    bug: extra.bugId ? { issueId: extra.bugId, key: `BUG-${extra.bugId}` } : null,
    ...extra,
  }) as unknown as TestCaseDto

describe('steps — ô chữ "1. …" ↔ bước API', () => {
  it('tách theo số thứ tự; dòng không số nối vào bước trước; chữ trước số đầu là bước 1', () => {
    expect(splitNumbered('1. Đăng nhập\n2. Vào Cấu hình phí\n   > Thêm mới')).toEqual([
      'Đăng nhập',
      'Vào Cấu hình phí\n> Thêm mới',
    ])
    expect(splitNumbered('Mở màn hình')).toEqual(['Mở màn hình'])
    expect(splitNumbered('')).toEqual([])
  })
  it('ghép hai cột theo chỉ số; "—" là ô trống; bước trống cả hai phía bị bỏ', () => {
    expect(textToSteps('1. Nhập -1\n2. Bấm Lưu', '1. —\n2. Báo lỗi')).toEqual([
      { action: 'Nhập -1', expected: '' },
      { action: 'Bấm Lưu', expected: 'Báo lỗi' },
    ])
    expect(textToSteps('1. A\n2. —', '1. X')).toEqual([{ action: 'A', expected: 'X' }])
  })
  it('đi về giữ nguyên nội dung', () => {
    const steps = [
      { action: 'Đăng nhập', expected: 'Thành công' },
      { action: 'Bấm Lưu', expected: '' },
    ]
    const text = stepsToText(steps)
    expect(text).toEqual({ steps: '1. Đăng nhập\n2. Bấm Lưu', expected: '1. Thành công\n2. —' })
    expect(textToSteps(text.steps, text.expected)).toEqual(steps)
    expect(joinNumbered(['a', ''])).toBe('1. a\n2. —')
    expect(stepsToText([])).toEqual({ steps: '', expected: '' })
  })
})

describe('status — trạng thái theo môi trường', () => {
  it('Retest khi có cờ; không thì lần ghi mới nhất ở đúng môi trường; chưa ghi = Untest', () => {
    const c = tc(1, [result(SIT, 'FAIL', 1), result(UAT, 'PASS', 2), result(SIT, 'PASS', 3)])
    expect(statusIn(c, SIT)).toBe('PASS')
    expect(statusIn(c, UAT)).toBe('PASS')
    expect(statusIn(c, 99)).toBe('UNTEST')
    expect(statusIn({ ...c, retest: [flag(SIT)] }, SIT)).toBe('RETEST')
    expect(statusIn({ ...c, retest: [flag(SIT)] }, UAT)).toBe('PASS')
  })
  it('thống kê: không tính case DELETED; %Cover, %Pass', () => {
    const list = [
      tc(1, [result(SIT, 'PASS')]),
      tc(2, [result(SIT, 'FAIL')]),
      tc(3, [result(SIT, 'NA')]),
      tc(4),
      { ...tc(5, [result(SIT, 'PASS')]), retest: [flag(SIT)] },
      { ...tc(6, [result(SIT, 'PASS')]), status: 'DELETED' as const },
    ]
    const s = statsIn(list, SIT)
    expect(s).toMatchObject({ total: 5, PASS: 1, FAIL: 1, NA: 1, UNTEST: 1, RETEST: 1, DELETED: 1 })
    expect(pct(s.cover)).toBe('60%')
    expect(pct(s.pass)).toBe('20%')
    expect(pct(1 / 3)).toBe('33.3%')
  })
  it('đối chiếu REQ: một tình trạng, ưu tiên lỗi', () => {
    expect(traceStatusOf([])).toBe('NO_TESTS')
    expect(traceStatusOf(['PASS', 'FAIL', 'UNTEST'])).toBe('FAILING')
    expect(traceStatusOf(['PASS', 'RETEST'])).toBe('IN_PROGRESS')
    expect(traceStatusOf(['PASS', 'NA'])).toBe('PASSED')
  })
})

describe('retest — luật cần test lại', () => {
  it('BUG_FIXED: chỉ case có bug được fix và lần ghi gần nhất ở môi trường đó là FAIL', () => {
    const cases = [
      tc(1, [result(SIT, 'FAIL')], { bugId: 21 }),
      tc(2, [result(SIT, 'FAIL'), result(SIT, 'PASS', 2)], { bugId: 21 }),
      tc(3, [result(UAT, 'FAIL')], { bugId: 21 }),
      tc(4, [result(SIT, 'FAIL')], { bugId: 18 }),
      { ...tc(5, [result(SIT, 'FAIL')], { bugId: 21 }), status: 'DELETED' as const },
    ]
    const out = bugFixedFlags(cases, SIT, 'v1.0.2', [21], 'now')
    expect(out.map((x) => x.testCaseId)).toEqual([1])
    expect(out[0].flag).toMatchObject({ envId: SIT, reason: 'BUG_FIXED', build: 'v1.0.2', bug: { key: 'BUG-21' } })
  })
  it('REQ_CHANGED: mọi môi trường đã có kết quả (khác UNTEST)', () => {
    const c = tc(1, [result(SIT, 'PASS'), result(UAT, 'UNTEST', 2)])
    expect(reqChangedFlags(c, [SIT, UAT], 'REQ-02', 'now').map((f) => [f.envId, f.reason, f.reqKey])).toEqual([
      [SIT, 'REQ_CHANGED', 'REQ-02'],
    ])
  })
  it('REGRESSION: mọi case đang dùng (lọc theo module nếu có)', () => {
    const cases = [tc(1), { ...tc(2), moduleId: 11 }, { ...tc(3), status: 'DELETED' as const }]
    expect(regressionFlags(cases, SIT, 'v2', 'now').map((x) => x.testCaseId)).toEqual([1, 2])
    expect(regressionFlags(cases, SIT, 'v2', 'now', [11]).map((x) => x.testCaseId)).toEqual([2])
  })
  it('mỗi môi trường tối đa một cờ; ghi kết quả xoá cờ môi trường đó', () => {
    const list = withFlag([flag(SIT), flag(UAT)], flag(SIT, 'BUG_FIXED'))
    expect(list.map((f) => [f.envId, f.reason])).toEqual([
      [UAT, 'REGRESSION'],
      [SIT, 'BUG_FIXED'],
    ])
    expect(withoutFlag(list, SIT).map((f) => f.envId)).toEqual([UAT])
  })
  it('hệ quả ghi kết quả: Fail chưa bug → cần bug; Fail trên bug Done → mở lại; Pass trên bug Done → xác nhận', () => {
    expect(recordOutcome('FAIL', null)).toEqual({ needBug: true, reopenBug: false, confirmFix: false })
    expect(recordOutcome('FAIL', { statusCategory: 'DONE' })).toEqual({
      needBug: false,
      reopenBug: true,
      confirmFix: false,
    })
    expect(recordOutcome('FAIL', { statusCategory: 'IN_PROGRESS' }).reopenBug).toBe(false)
    expect(recordOutcome('PASS', { statusCategory: 'DONE' }).confirmFix).toBe(true)
    expect(recordOutcome('NA', null)).toEqual({ needBug: false, reopenBug: false, confirmFix: false })
  })
  it('lý do hiển thị', () => {
    expect(retestWhy({ ...flag(SIT, 'BUG_FIXED'), bug: { issueId: 1, key: 'BUG-21' }, build: 'v1.0.2' }, t)).toBe(
      'BUG-21 đã fix ở v1.0.2',
    )
    expect(retestWhy({ ...flag(SIT, 'REQ_CHANGED'), reqKey: 'REQ-02' }, t)).toBe('REQ-02 đổi')
    expect(retestWhy(flag(SIT), t)).toBe('Regression')
  })
})

const DOC: TipTapDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { id: 'h1', level: 1 }, content: [{ type: 'text', text: '1. Tổng quan' }] },
    { type: 'heading', attrs: { id: 's31', level: 1 }, content: [{ type: 'text', text: '3.1 Thêm mới cấu hình phí' }] },
    {
      type: 'heading',
      attrs: { id: 'r1', level: 2, req: true, reqUid: 'fee-1' },
      content: [{ type: 'text', text: 'Thêm mới' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
    {
      type: 'heading',
      attrs: { id: 'r2', level: 2, req: true, reqUid: 'fee-2' },
      content: [{ type: 'text', text: 'Mức phí' }],
    },
    { type: 'heading', attrs: { id: 's32', level: 1 }, content: [{ type: 'text', text: '3.2 Sửa cấu hình phí' }] },
    {
      type: 'heading',
      attrs: { id: 'r3', level: 2, req: true, reqUid: 'fee-3' },
      content: [{ type: 'text', text: 'Sửa' }],
    },
  ],
}

describe('sections — mục tài liệu (T10)', () => {
  it('heading thường thành mục; REQ thuộc heading thường gần nhất phía trên', () => {
    const s = extractDocSections(DOC)
    expect(s.map((x) => [x.anchorId, x.title, x.reqUids])).toEqual([
      ['h1', '1. Tổng quan', []],
      ['s31', '3.1 Thêm mới cấu hình phí', ['fee-1', 'fee-2']],
      ['s32', '3.2 Sửa cấu hình phí', ['fee-3']],
    ])
    expect(sectionOfReq(s, 'fee-3')?.anchorId).toBe('s32')
    expect(sectionOfReq(s, 'nope')).toBeNull()
    expect(defaultModuleSections(s).map((x) => x.anchorId)).toEqual(['s31', 's32'])
    expect(defaultModuleSections(s.map((x) => ({ ...x, reqUids: [] }))).map((x) => x.anchorId)).toEqual([
      'h1',
      's31',
      's32',
    ])
  })
  it('bỏ số đầu tiêu đề', () => {
    expect(stripHeadingNumber('3.1 Thêm mới cấu hình phí')).toBe('Thêm mới cấu hình phí')
    expect(stripHeadingNumber('§2. Quét QR')).toBe('Quét QR')
    expect(stripHeadingNumber('Báo cáo')).toBe('Báo cáo')
  })
})

const MODULE = {
  moduleId: 10,
  documentId: 31,
  sections: [
    { sectionId: 1, parentId: null, code: '1.', title: 'Thêm mới', anchorId: 's31', position: 0 },
    { sectionId: 2, parentId: 1, code: '1.1', title: 'Flow', anchorId: null, position: 1 },
    { sectionId: 3, parentId: 1, code: '1.2', title: 'Chức năng', anchorId: null, position: 2 },
  ],
} as unknown as TestModuleDto

describe('placement — chỗ đặt testcase do AI sinh', () => {
  it('đủ module / mục / nhóm → id; thiếu thì null (sẽ tạo)', () => {
    expect(findPlacement([MODULE], { documentId: 31, anchorId: 's31', title: 'Thêm mới' }, 'chức năng')).toMatchObject({
      moduleId: 10,
      sectionId: 1,
      groupId: 3,
    })
    expect(findPlacement([MODULE], { documentId: 31, anchorId: 's31', title: 'Thêm mới' }, 'Validate')).toMatchObject({
      moduleId: 10,
      sectionId: 1,
      groupId: null,
    })
    expect(findPlacement([MODULE], { documentId: 31, anchorId: 's32', title: 'Sửa' }, 'Flow')).toMatchObject({
      moduleId: 10,
      sectionId: null,
      groupId: null,
      sectionTitle: 'Sửa',
    })
    expect(findPlacement([MODULE], { documentId: 40, anchorId: 'x', title: 'Báo cáo' }, 'Flow').moduleId).toBeNull()
  })
  it('khoá gom nhóm: cùng chỗ (kể cả chỗ sẽ tạo) → cùng khoá', () => {
    const a = findPlacement([MODULE], { documentId: 31, anchorId: 's32', title: 'Sửa' }, 'Flow')
    const b = findPlacement([MODULE], { documentId: 31, anchorId: 's32', title: 'Sửa' }, 'flow')
    const c = findPlacement([MODULE], { documentId: 31, anchorId: 's31', title: 'Thêm mới' }, 'Flow')
    expect(placementKey(a)).toBe(placementKey(b))
    expect(placementKey(a)).not.toBe(placementKey(c))
  })
  it('mã kế tiếp', () => {
    expect(nextTopCode(MODULE)).toBe('2.')
    expect(nextGroupCode(MODULE, MODULE.sections[0])).toBe('1.3')
    expect(nextCaseCode(['TC_1', 'TC_9', 'TC_3'])).toBe('TC_10')
    expect(nextCaseCode([])).toBe('TC_1')
    // Sau khi xoá mục / nhóm ở giữa: số lớn nhất + 1, không trùng mã còn lại.
    const gap = {
      sections: [
        { ...MODULE.sections[0], code: '3.' },
        { ...MODULE.sections[1], code: '3.3' },
      ],
    } as unknown as TestModuleDto
    expect(nextTopCode(gap)).toBe('4.')
    expect(nextGroupCode(gap, gap.sections[0])).toBe('3.4')
    // REQ không thuộc heading nào: khớp mục lớn không anchor có cùng tên tài liệu (giống ai-apply).
    const noAnchor = {
      ...MODULE,
      sections: [
        ...MODULE.sections,
        { sectionId: 9, parentId: null, code: '2.', title: 'Báo cáo', anchorId: null, position: 3 },
      ],
    } as unknown as TestModuleDto
    expect(findPlacement([noAnchor], { documentId: 31, anchorId: null, title: 'báo cáo' }, 'Flow').sectionId).toBe(9)
  })
})

describe('abilities — quyền theo role động', () => {
  const base = { archived: false, handedOver: false, aiEnabled: true }
  it('mỗi nút một quyền; thiếu testcase.view thì không thấy gì', () => {
    const qaLead = testAbilities({
      ...base,
      permissions: [
        'testcase.view',
        'testcase.manage',
        'testcase.execute',
        'issue.create',
        'issue.view',
        'ai.use',
        'document.view',
        'testcase.plan',
      ],
    })
    expect(qaLead).toEqual({
      view: true,
      manage: true,
      execute: true,
      createBug: true,
      linkBug: true,
      ai: true,
      docView: true,
      plan: true,
      reopen: false,
    })
    const dev = testAbilities({ ...base, permissions: ['testcase.view', 'document.view'] })
    expect(dev).toMatchObject({ view: true, manage: false, execute: false, createBug: false, ai: false, plan: false })
    expect(testAbilities({ ...base, permissions: ['document.view'] }).view).toBe(false)
    // execute không có issue.create → chỉ gắn bug có sẵn.
    expect(testAbilities({ ...base, permissions: ['testcase.view', 'testcase.execute', 'issue.view'] })).toMatchObject({
      execute: true,
      createBug: false,
      linkBug: true,
    })
  })
  it('key mới chưa có ở BE: testcase.plan ← project.workflow.manage, testcase.execute ← testcase.manage', () => {
    const pm = testAbilities({ ...base, permissions: ['testcase.view', 'testcase.manage', 'project.workflow.manage'] })
    expect(pm).toMatchObject({ plan: true, execute: true })
  })
  it('bàn giao / lưu trữ: tắt mọi thao tác ghi; bàn giao còn "Mở lại"; AI tắt ở dự án', () => {
    const all = ['testcase.view', 'testcase.manage', 'testcase.execute', 'testcase.plan', 'ai.use', 'issue.create']
    expect(testAbilities({ ...base, handedOver: true, permissions: all })).toMatchObject({
      manage: false,
      execute: false,
      plan: false,
      reopen: true,
    })
    expect(testAbilities({ ...base, archived: true, permissions: all })).toMatchObject({
      manage: false,
      plan: false,
      reopen: false,
    })
    expect(testAbilities({ ...base, aiEnabled: false, permissions: all }).ai).toBe(false)
  })
  it('ô: Kết quả / Bug theo quyền ghi kết quả; nội dung theo quyền quản lý; case Delete thì khoá', () => {
    expect(canEditCell({ manage: false, execute: true }, 'result', false)).toBe(true)
    expect(canEditCell({ manage: false, execute: true }, 'content', false)).toBe(false)
    expect(canEditCell({ manage: true, execute: true }, 'content', true)).toBe(false)
  })
})

describe('columns — cột của bảng', () => {
  it('thứ tự theo bố cục, cột thiếu nối cuối; đổi tên cột có sẵn; ẩn chỉ cột không bắt buộc', () => {
    const layout = {
      ...emptyLayout(),
      order: ['title', 'code', 'c1'],
      labels: { title: 'Tên' },
      customColumns: [
        {
          columnId: 'c1',
          label: 'Thiết bị',
          kind: 'SELECT' as const,
          options: [{ optionId: 'o1', label: 'iOS', color: 0 }],
        },
      ],
    }
    const cols = allColumns(layout, t)
    expect(cols.slice(0, 4).map((c) => c.id)).toEqual(['title', 'code', 'c1', 'req'])
    expect(cols[0]).toMatchObject({ label: 'Tên', defaultLabel: 'Tên TC', locked: true })
    expect(cols[2]).toMatchObject({ kind: 'select', options: [{ value: 'o1', label: 'iOS', color: 0 }] })
    expect(visibleColumns(cols, ['title', 'c1', 'browser']).map((c) => c.id)).toContain('title')
    expect(visibleColumns(cols, ['c1']).map((c) => c.id)).not.toContain('c1')
  })
  it('kéo cột: đưa lên trước cột đích', () => {
    expect(moveColumn(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveColumn(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
  })
  it('cột số kẹp min/max; kiểm cột mới; mặc định cho testcase mới', () => {
    expect(clampNumber('12', { min: 0, max: 10 })).toEqual({ value: 10, clamped: true })
    expect(clampNumber('', { min: 0 })).toEqual({ value: null, clamped: false })
    expect(validateColumn({ columnId: 'x', label: ' ', kind: 'TEXT' }, t)).toBe('Nhập tên cột')
    expect(
      validateColumn(
        { columnId: 'x', label: 'A', kind: 'SELECT', options: [{ optionId: 'o1', label: ' ', color: 0 }] },
        t,
      ),
    ).toBe('Cần ít nhất 1 giá trị để chọn')
    expect(validateColumn({ columnId: 'x', label: 'A', kind: 'NUMBER', min: 5, max: 1 }, t)).toBe(
      '"Nhỏ nhất" phải ≤ "Lớn nhất"',
    )
    expect(
      defaultCustomFields(
        [
          { columnId: 'd', label: 'Ngày', kind: 'DATE', defaultToday: true },
          { columnId: 'n', label: 'Ghi chú', kind: 'TEXT', defaultValue: 'OK' },
          { columnId: 'p', label: 'Người', kind: 'PERSON' },
        ],
        '2026-11-08',
      ),
    ).toEqual({ d: '2026-11-08', n: 'OK' })
  })
})
