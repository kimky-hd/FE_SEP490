import { PERMISSIONS } from '@/types/rbac'

// Quyền cho Kanban / Test cases (doc/Issues-Testcases-API-Contract.md §0).
// Hai key mới `sprint.manage`, `testcase.execute` BE chưa có trong PermissionKeys.cs: tới khi BE thêm, người có quyền
// "gần nhất" được coi là có key mới (sprint.manage ← project.workflow.manage, testcase.execute ← testcase.manage).
// BE thêm key xong thì bỏ FALLBACK.

const FALLBACK: Record<string, string> = {
  [PERMISSIONS.sprintManage]: PERMISSIONS.projectWorkflowManage,
  [PERMISSIONS.testCaseExecute]: PERMISSIONS.testCaseManage,
}

export function hasWorkPermission(permissions: readonly string[], key: string): boolean {
  if (permissions.includes('*') || permissions.includes(key)) return true
  const alt = FALLBACK[key]
  return !!alt && !permissions.includes(key) && (permissions.includes(alt) || permissions.includes('*'))
}
