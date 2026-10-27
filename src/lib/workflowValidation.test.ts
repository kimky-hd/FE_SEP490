import { describe, expect, it } from 'vitest'
import { validatePhaseWorkflow, type ValidatableStatus, type ValidatableTransition } from './workflowValidation'

// Bảng trạng thái + 4 luật của Figma hàng 2 frame 03 — phải hợp lệ.
const statuses: ValidatableStatus[] = [
  { key: 'todo', name: 'Open / To Do', category: 'TODO', isInitial: true },
  { key: 'dev', name: 'In Development', category: 'IN_PROGRESS', isInitial: false },
  { key: 'review', name: 'Code Review & QA', category: 'IN_PROGRESS', isInitial: false },
  { key: 'done', name: 'Completed / Closed', category: 'DONE', isInitial: false },
]
const transitions: ValidatableTransition[] = [
  { from: 'todo', to: 'dev', allowedRoleIds: [1] },
  { from: 'dev', to: 'review', allowedRoleIds: [1] },
  { from: 'review', to: 'done', allowedRoleIds: [2] },
  { from: 'review', to: 'dev', allowedRoleIds: [2] },
]
const codes = (s = statuses, t = transitions) => validatePhaseWorkflow(s, t).map((i) => i.code)

describe('validatePhaseWorkflow (§12.5)', () => {
  it('workflow mẫu Figma frame 03 hợp lệ', () => {
    expect(codes()).toEqual([])
  })

  it('bỏ luật In Development → Code Review: Code Review không tới được, In Development thành ngõ cụt', () => {
    const result = codes(statuses, transitions.filter((t) => !(t.from === 'dev' && t.to === 'review')))
    expect(result).toContain('UNREACHABLE_STATUS')
    expect(result).toContain('DEAD_END_STATUS')
  })

  it('thiếu / thừa trạng thái khởi tạo', () => {
    expect(codes(statuses.map((s) => ({ ...s, isInitial: false })))).toContain('NO_INITIAL_STATUS')
    expect(codes(statuses.map((s) => ({ ...s, isInitial: true })))).toContain('MULTIPLE_INITIAL_STATUS')
  })

  it('không có trạng thái Done', () => {
    expect(codes(statuses.map((s) => ({ ...s, category: s.category === 'DONE' ? 'IN_PROGRESS' : s.category })))).toContain(
      'NO_DONE_STATUS',
    )
  })

  it('transition không chọn role / trùng cặp / tự trỏ chính nó', () => {
    expect(codes(statuses, [...transitions, { from: 'todo', to: 'dev', allowedRoleIds: [3] }])).toContain('INVALID_TRANSITION')
    expect(codes(statuses, [...transitions.slice(1), { from: 'todo', to: 'dev', allowedRoleIds: [] }])).toContain('TRANSITION_NO_ROLE')
    expect(codes(statuses, [...transitions, { from: 'dev', to: 'dev', allowedRoleIds: [1] }])).toContain('INVALID_TRANSITION')
  })

  it('trùng tên trạng thái (không phân biệt hoa thường) và tên rỗng', () => {
    expect(codes([...statuses, { key: 'x', name: 'in development', category: 'IN_PROGRESS', isInitial: false }])).toContain(
      'DUPLICATE_STATUS_NAME',
    )
    expect(codes([...statuses, { key: 'y', name: '  ', category: 'TODO', isInitial: false }])).toContain('STATUS_NAME_REQUIRED')
  })

  it('trạng thái đã tắt (isActive=false) được bỏ qua', () => {
    expect(codes([...statuses, { key: 'old', name: 'Legacy', category: 'TODO', isInitial: false, isActive: false }])).toEqual([])
  })

  it('phase rỗng', () => {
    expect(codes([], [])).toEqual(['NO_STATUS'])
  })
})
