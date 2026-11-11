import { describe, expect, it } from 'vitest'
import { defaultGates, normalizeGates } from './phaseGates'
import { blankPhase, phaseToDraft, templateToDraft } from './workflowDraft'
import type { PhaseDto, TemplatePhase } from '@/types/project'

const tplPhase = (name: string, exitCriteria?: string[]): TemplatePhase => ({
  name,
  description: null,
  exitCriteria,
  statuses: [{ key: 'a', name: 'To Do', category: 'TODO', color: '#999', description: null, isInitial: true }],
  transitions: [],
})

describe('Điều kiện hoàn thành giai đoạn', () => {
  it('normalizeGates bỏ mã lạ, mã trùng và giữ thứ tự danh mục', () => {
    expect(normalizeGates(['ISSUES_DONE', 'XYZ', 'DOC_APPROVED', 'ISSUES_DONE', 42])).toEqual([
      'DOC_APPROVED',
      'ISSUES_DONE',
    ])
    expect(normalizeGates(undefined)).toEqual([])
  })

  it('mặc định theo vị trí: đầu chốt đặc tả, cuối chốt truy vết', () => {
    expect(defaultGates(0, 4)).toEqual(['DOC_APPROVED', 'REQ_SEGMENTED'])
    expect(defaultGates(1, 4)).toEqual(['REQ_LINKED_ISSUES', 'ISSUES_DONE'])
    expect(defaultGates(2, 4)).toEqual(['ISSUES_DONE'])
    expect(defaultGates(3, 4)).toEqual(['ISSUES_DONE', 'RTM_ZERO_STALE'])
    expect(defaultGates(0, 1)).toEqual(['ISSUES_DONE'])
  })

  it('templateToDraft: mẫu có khai báo thì dùng, chưa có thì theo vị trí', () => {
    const drafts = templateToDraft([tplPhase('A'), tplPhase('B', ['TESTS_PASSED']), tplPhase('C')], [])
    expect(drafts.map((d) => d.exitCriteria)).toEqual([
      ['DOC_APPROVED', 'REQ_SEGMENTED'],
      ['TESTS_PASSED'],
      ['ISSUES_DONE', 'RTM_ZERO_STALE'],
    ])
  })

  it('phase mới mặc định "Issue đã xong"; phase đã lưu chưa có trường thì rỗng', () => {
    expect(blankPhase('P', []).exitCriteria).toEqual(['ISSUES_DONE'])
    const saved = {
      phaseId: 1,
      name: 'P',
      description: null,
      position: 1,
      isActive: true,
      statuses: [],
      transitions: [],
    }
    expect(phaseToDraft(saved as PhaseDto).exitCriteria).toEqual([])
  })
})
