import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { issueApi } from '@/api/issueApi'
import { useAuth } from '@/context/AuthContext'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { columnStatuses } from '@/lib/workflowBoard'
import { useI18n } from '@/i18n'
import type { UserRef } from '@/types/issue'
import { Toast, useToast } from '../documents/view/Toast'
import { useProjectContext } from '../projects/ProjectLayout'
import { IssueDrawer } from './IssueDrawer'

// /projects/:id/kanban/issues/:issueKey — chi tiết issue thành trang riêng (mở từ nút ⤢ của bảng bên phải).
// Link chia sẻ / F5 được. Dữ liệu phụ (trạng thái, sprint, người làm) tự tải vì không có board phía sau.

export function IssuePage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { project } = useProjectContext()
  const projectId = project.projectId
  const issueKey = useParams().issueKey ?? ''
  const navigate = useNavigate()
  const { toast, notify } = useToast()
  const me: UserRef | null = user ? { userId: user.id, fullName: user.fullName } : null

  const board = useAsync(() => issueApi.board(projectId), [projectId])
  const sprintsQ = useAsync(() => issueApi.sprints(projectId), [projectId])
  const assigneesQ = useAsync(() => issueApi.assignees(projectId).catch(() => [] as UserRef[]), [projectId])
  const issueQ = useAsync(
    () =>
      issueApi
        .list(projectId, { search: issueKey })
        .then((list) => list.find((i) => i.key.toUpperCase() === issueKey.toUpperCase())?.issueId ?? null),
    [projectId, issueKey],
  )
  const statuses = useMemo(() => (board.data ? columnStatuses(board.data.columns) : []), [board.data])

  const toBoard = useCallback(() => navigate(`/projects/${projectId}/kanban`), [navigate, projectId])

  const error = board.error ?? sprintsQ.error ?? issueQ.error
  if (error)
    return (
      <ErrorState
        message={apiErrorMessage(error)}
        onRetry={() => void (board.reload(), sprintsQ.reload(), issueQ.reload())}
      />
    )
  if (!board.data || !sprintsQ.data || issueQ.data === undefined) return <LoadingBlock />
  if (issueQ.data === null)
    return (
      <ErrorState
        message={t(`Không tìm thấy issue ${issueKey}.`, `Issue ${issueKey} was not found.`)}
        onRetry={issueQ.reload}
      />
    )

  return (
    <>
      <IssueDrawer
        variant="page"
        projectId={projectId}
        issueId={issueQ.data}
        statuses={statuses}
        sprints={sprintsQ.data}
        assignees={assigneesQ.data ?? []}
        me={me}
        onClose={toBoard}
        notify={notify}
      />
      <Toast toast={toast} />
    </>
  )
}
