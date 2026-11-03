import { afterEach, describe, expect, it } from 'vitest'
import { DEV_ROLE_OVERRIDE_KEY, detectProjectRole, projectMenu, resolveProjectRole } from './projectRole'

const role = (name: string, code: string | null = null) => ({ name, code })
const NONE = { kanban: false, testcases: false }
const ALL_ON = { kanban: true, testcases: true }
const PM_PERMS = [
  'project.view',
  'project.update',
  'project.member.manage',
  'document.view',
  'document.edit',
  'document.approve',
  'issue.view',
  'testcase.view',
]

describe('detectProjectRole', () => {
  it.each([
    ['Business Analyst', 'BA'],
    ['BA', 'BA'],
    ['Phân tích nghiệp vụ', 'BA'],
    ['UI/UX Designer', 'DESIGNER'],
    ['Design Lead', 'DESIGNER'],
    ['QA Engineer', 'QA'],
    ['Tester', 'QA'],
    ['QA Lead', 'QA'],
    ['Quality Control', 'QA'],
    ['Developer', 'DEV'],
    ['Tech Lead', 'DEV'],
    ['Software Engineer', 'DEV'],
    ['Project Manager', 'PM'],
    ['PM', 'PM'],
    ['Product Owner', 'PM'],
    ['Team Lead', 'PM'],
    ['Quản lý dự án', 'PM'],
  ])('%s → %s', (name, expected) => {
    expect(detectProjectRole(role(name), [])).toBe(expected)
  })

  it('đọc cả mã role khi tên không khớp', () => {
    expect(detectProjectRole(role('Thành viên chính', 'PROJECT_MANAGER'), [])).toBe('PM')
    expect(detectProjectRole(role('Người viết', 'BUSINESS_ANALYST'), [])).toBe('BA')
  })

  it('không đoán được từ tên → theo quyền', () => {
    expect(detectProjectRole(role('Thành viên'), PM_PERMS)).toBe('PM')
    expect(detectProjectRole(role('Thành viên'), ['document.view', 'document.edit'])).toBe('BA')
    expect(detectProjectRole(role('Viewer'), ['document.view'])).toBe('OTHER')
    expect(detectProjectRole(null, ['*'])).toBe('PM')
    expect(detectProjectRole(null, [])).toBe('OTHER')
  })

  it('D05: `kind` do BE trả được ưu tiên hơn tên role; kind lạ thì đoán theo tên', () => {
    expect(detectProjectRole({ name: 'Kiểm thử viên cấp 2', code: null, kind: 'QA' }, [])).toBe('QA')
    expect(detectProjectRole({ name: 'QA Lead', code: null, kind: 'PM' }, [])).toBe('PM')
    expect(detectProjectRole({ name: 'QA Lead', code: null, kind: 'XX' as never }, [])).toBe('QA')
  })

  it('không nhầm từ chứa chữ "ba" / "ui"', () => {
    expect(detectProjectRole(role('Banking Expert'), [])).toBe('OTHER')
    expect(detectProjectRole(role('Builder'), [])).toBe('OTHER')
  })
})

describe('projectMenu', () => {
  it('thứ tự theo vai trò khi đã bật Kanban và Test cases (đúng bảng mockup)', () => {
    const perms = PM_PERMS
    expect(projectMenu('QA', perms, ALL_ON).main).toEqual(['myWork', 'testcases', 'documents', 'kanban', 'workflow'])
    expect(projectMenu('BA', perms, ALL_ON).main).toEqual(['myWork', 'documents', 'kanban', 'testcases', 'workflow'])
    expect(projectMenu('DESIGNER', perms, ALL_ON).main).toEqual(['myWork', 'documents', 'kanban'])
    expect(projectMenu('DEV', perms, ALL_ON).main).toEqual(['myWork', 'kanban', 'documents', 'testcases'])
    expect(projectMenu('PM', perms, ALL_ON).main).toEqual([
      'myWork',
      'overview',
      'documents',
      'kanban',
      'testcases',
      'workflow',
    ])
    expect(projectMenu('OTHER', perms, ALL_ON).main).toEqual(['myWork', 'overview', 'documents', 'workflow'])
  })

  it('Kanban / Test cases cần quyền xem issue / testcase', () => {
    expect(projectMenu('DEV', ['document.view', 'issue.view'], ALL_ON).main).toEqual(['myWork', 'kanban', 'documents'])
    expect(projectMenu('QA', ['document.view', 'testcase.view'], ALL_ON).main).toEqual([
      'myWork',
      'testcases',
      'documents',
      'workflow',
    ])
  })

  it('ẩn Kanban / Test cases khi cờ tắt', () => {
    expect(projectMenu('QA', PM_PERMS, NONE).main).toEqual(['myWork', 'documents', 'workflow'])
    expect(projectMenu('DEV', PM_PERMS, NONE).main).toEqual(['myWork', 'documents'])
  })

  it('Thành viên / Cài đặt và Tài liệu theo quyền', () => {
    expect(projectMenu('PM', PM_PERMS, NONE).tail).toEqual(['members', 'settings'])
    expect(projectMenu('DEV', ['project.view', 'document.view'], NONE).tail).toEqual(['members'])
    expect(projectMenu('OTHER', [], NONE)).toEqual({ main: ['myWork', 'overview', 'workflow'], tail: [] })
  })
})

describe('resolveProjectRole', () => {
  afterEach(() => window.localStorage.removeItem(DEV_ROLE_OVERRIDE_KEY))

  it('khoá dev ghi đè vai trò (chỉ khi chạy dev), giá trị lạ bị bỏ qua', () => {
    const project = { myRole: role('Business Analyst'), myPermissions: [] }
    expect(resolveProjectRole(project)).toBe('BA')
    window.localStorage.setItem(DEV_ROLE_OVERRIDE_KEY, 'QA')
    expect(resolveProjectRole(project)).toBe(import.meta.env.DEV ? 'QA' : 'BA')
    window.localStorage.setItem(DEV_ROLE_OVERRIDE_KEY, 'boss')
    expect(resolveProjectRole(project)).toBe('BA')
  })
})
