import type { DraftPhase } from '@/lib/workflowDraft'
import type { SdlcMethod } from '@/types/project'
import { tr } from '@/i18n'

// Trạng thái wizard tạo dự án (Figma hàng 2 frame 02–04). Lưu nháp ở localStorage — đúng ghi chú Figma
// "Dữ liệu bản nháp được lưu tại local state (Uncommitted)", chưa gửi BE cho tới khi Submit.

export type WizardStep = 1 | 2 | 3

export interface WizardMember {
  userId: number
  roleId: number
}

export interface WizardState {
  step: WizardStep
  name: string
  key: string
  /** Người dùng đã tự sửa key → thôi tự sinh từ tên. */
  keyTouched: boolean
  description: string
  aiEnabled: boolean
  sdlcMethod: SdlcMethod
  phases: DraftPhase[]
  /** Đã sửa phase/trạng thái → đổi phương pháp SDLC phải xác nhận vì sẽ mất chỉnh sửa. */
  phasesTouched: boolean
  members: WizardMember[]
}

export const NAME_MAX = 100
export const DESCRIPTION_MAX = 500
export const MAX_PHASES = 10

const draftKey = (userId: number, workspaceId: number) => `ssam.projectDraft.${userId}.${workspaceId}`

export function loadDraft(userId: number, workspaceId: number): (WizardState & { savedAt: string }) | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, workspaceId))
    return raw ? (JSON.parse(raw) as WizardState & { savedAt: string }) : null
  } catch {
    return null
  }
}

export function saveDraft(userId: number, workspaceId: number, state: WizardState) {
  const savedAt = new Date().toISOString()
  try {
    localStorage.setItem(draftKey(userId, workspaceId), JSON.stringify({ ...state, savedAt }))
  } catch {
    // storage đầy / bị chặn: wizard vẫn chạy, chỉ mất nháp khi tải lại trang
  }
  return savedAt
}

export function clearDraft(userId: number, workspaceId: number) {
  try {
    localStorage.removeItem(draftKey(userId, workspaceId))
  } catch {
    // bỏ qua
  }
}

/** Lỗi bước 1 (theo §10.4) — trả về map field → thông báo. */
export function validateStepOne(state: WizardState): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = state.name.trim()
  if (name.length < 2) errors.name = tr('Tên dự án tối thiểu 2 ký tự', 'Project name must be at least 2 characters')
  else if (name.length > NAME_MAX) errors.name = tr(`Tối đa ${NAME_MAX} ký tự`, `Maximum ${NAME_MAX} characters`)
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(state.key))
    errors.key = tr(
      'Key 2–10 ký tự, chữ HOA và số, bắt đầu bằng chữ',
      'Key must be 2–10 uppercase letters or digits, starting with a letter',
    )
  if (state.description.length > DESCRIPTION_MAX)
    errors.description = tr(`Tối đa ${DESCRIPTION_MAX} ký tự`, `Maximum ${DESCRIPTION_MAX} characters`)
  if (state.phases.length === 0) errors.phases = tr('Dự án cần ít nhất 1 phase', 'The project needs at least 1 phase')
  else if (state.phases.some((p) => !p.name.trim())) errors.phases = tr('Phase phải có tên', 'Every phase needs a name')
  else if (new Set(state.phases.map((p) => p.name.trim().toLowerCase())).size !== state.phases.length) {
    errors.phases = tr('Tên phase bị trùng', 'Phase names must be unique')
  } else if (state.phases.some((p) => p.statuses.filter((s) => s.isActive).length === 0)) {
    errors.phases = tr('Mỗi phase cần ít nhất 1 trạng thái', 'Each phase needs at least 1 status')
  }
  return errors
}
