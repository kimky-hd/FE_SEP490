import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { allColumns, emptyLayout } from '@/lib/testplan/columns'
import type { TestCaseDto, TestPlanDto } from '@/types/testing'
import { CellEditor } from './cells'

// Ô sửa của bảng testcase: không được ghi đè mất giá trị khi chỉ bấm vào rồi rời ô (A1), và ô Kết quả của case cần
// test lại phải ghi được đúng kết quả cũ (A2).

const t = (vi: string) => vi
const layout = {
  ...emptyLayout(),
  customColumns: [
    {
      columnId: 'c1',
      label: 'Thiết bị',
      kind: 'SELECT' as const,
      options: [
        { optionId: 'o1', label: 'iOS', color: 0 },
        { optionId: 'o2', label: 'Android', color: 1 },
      ],
    },
  ],
}
const cols = allColumns(layout, t)
const col = (id: string) => cols.find((c) => c.id === id)!
const plan = { people: [{ userId: 1, fullName: 'Lan', qa: true }] } as unknown as TestPlanDto
const tc = (patch: Partial<TestCaseDto> = {}) =>
  ({
    testCaseId: 1,
    code: 'TC_1',
    title: 'A',
    category: 'Bảo mật',
    customFields: { c1: 'o2' },
    results: [
      {
        resultId: 1,
        envId: 1,
        build: 'v1',
        result: 'FAIL',
        by: { userId: 1, fullName: 'Lan' },
        at: '',
        behalfOf: null,
      },
    ],
    retest: [],
    steps: [],
    ...patch,
  }) as unknown as TestCaseDto

function setup(c: TestCaseDto, columnId: string) {
  const onCommit = vi.fn()
  const onCancel = vi.fn()
  const onTab = vi.fn()
  render(
    <CellEditor
      tc={c}
      col={col(columnId)}
      envId={1}
      plan={plan}
      onCommit={onCommit}
      onCancel={onCancel}
      onTab={onTab}
    />,
  )
  return { onCommit, onCancel, onTab, select: screen.getByRole('combobox') as HTMLSelectElement }
}

describe('CellEditor — ô danh sách chọn', () => {
  it('giá trị ngoài danh sách (phân loại gõ tự do) vẫn là lựa chọn đang chọn; rời ô = huỷ, không ghi ""', () => {
    const { select, onCommit, onCancel } = setup(tc(), 'category')
    expect(select.value).toBe('Bảo mật')
    fireEvent.blur(select)
    expect(onCommit).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cột chọn riêng lưu optionId; chọn giá trị khác thì ghi', () => {
    const { select, onCommit } = setup(tc(), 'c1')
    expect(select.value).toBe('o2')
    fireEvent.change(select, { target: { value: 'o1' } })
    expect(onCommit).toHaveBeenCalledWith('o1', 'down')
  })

  it('Tab không đổi gì → chỉ di chuyển (undefined)', () => {
    const { select, onTab } = setup(tc(), 'category')
    fireEvent.keyDown(select, { key: 'Tab' })
    expect(onTab).toHaveBeenCalledWith(undefined, false)
  })
})

describe('CellEditor — ô Kết quả', () => {
  it('case cần test lại bắt đầu ở "— Retest —": chọn lại Fail vẫn ghi', () => {
    const retest = tc({
      retest: [{ envId: 1, reason: 'BUG_FIXED', bug: null, build: 'v2', reqKey: null, at: '' }],
    })
    const { select, onCommit, onCancel } = setup(retest, 'result')
    expect(select.value).toBe('')
    expect(screen.getByRole('option', { name: '— Retest —' })).toBeDisabled()
    fireEvent.change(select, { target: { value: 'FAIL' } })
    expect(onCommit).toHaveBeenCalledWith('FAIL', 'down')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Enter khi còn "— Retest —" (chưa chọn) → không ghi', () => {
    const retest = tc({ retest: [{ envId: 1, reason: 'REGRESSION', bug: null, build: null, reqKey: null, at: '' }] })
    const { select, onCommit, onCancel } = setup(retest, 'result')
    fireEvent.keyDown(select, { key: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('case không cần test lại: bắt đầu ở kết quả mới nhất, Enter ghi lại cùng kết quả (test lại thủ công)', () => {
    const { select, onCommit } = setup(tc(), 'result')
    expect(select.value).toBe('FAIL')
    fireEvent.keyDown(select, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith('FAIL', 'down')
  })
})
