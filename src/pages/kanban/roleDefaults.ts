import type { ProjectRoleKind } from '@/lib/projectRole'

// Vai trò chỉ đổi mặc định (mock-kanban-testcases.html, bảng 3). Người dùng đổi được; lựa chọn cuối lưu theo dự án.

export type BoardChip = 'mine' | 'reqChanged' | 'bug' | 'qa' | 'blocked' | 'design'
export type GroupBy = 'none' | 'person' | 'req'

export interface BoardPrefs {
  chips: BoardChip[]
  groupBy: GroupBy
}

export function boardDefaults(role: ProjectRoleKind): BoardPrefs {
  switch (role) {
    case 'DEV':
      return { chips: ['mine'], groupBy: 'none' }
    case 'QA':
      return { chips: ['qa'], groupBy: 'none' }
    case 'BA':
      return { chips: [], groupBy: 'req' }
    case 'DESIGNER':
      return { chips: ['design'], groupBy: 'none' }
    default:
      return { chips: [], groupBy: 'none' }
  }
}

export const kanbanDefaultView = (role: ProjectRoleKind): 'board' | 'backlog' => (role === 'PM' ? 'backlog' : 'board')
