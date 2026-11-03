import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n'

interface MemberLike {
  userId: number
  fullName: string
  role: { roleId: number; name: string }
}

const UNDO_MS = 10_000
const DEBOUNCE_MS = 700

/**
 * Đổi role an toàn hơn cho các bảng thành viên (công ty / workspace / dự án):
 * - Đổi role của CHÍNH MÌNH luôn hỏi xác nhận trước (có thể tự mất quyền quản trị).
 * - Đổi role người khác áp dụng ngay, kèm nút "Hoàn tác" trong 10 giây.
 * `apply` trả về true nếu lưu thành công (trang tự hiện thông báo lỗi khi thất bại).
 */
export function useRoleChangeGuard<M extends MemberLike>({
  selfId,
  scopeLabel,
  apply,
}: {
  selfId?: number
  /** "công ty", "workspace này", "dự án này" (đã dịch theo ngôn ngữ hiện tại): dùng trong câu xác nhận. */
  scopeLabel: string
  apply: (member: M, roleId: number) => Promise<boolean>
}) {
  const { t } = useI18n()
  const [pending, setPending] = useState<{ member: M; roleId: number; roleName: string } | null>(null)
  const [undo, setUndo] = useState<{ member: M; prevRoleId: number; prevName: string; nextName: string } | null>(null)
  const [busy, setBusy] = useState(false)
  // Lựa chọn đang chờ lưu, theo userId. Bấm phím mũi tên trên <select> đang đóng bắn một sự kiện change cho mỗi
  // lần bấm: chỉ lưu lựa chọn cuối cùng sau một nhịp nghỉ ngắn, và select hiện ngay giá trị đang chờ.
  const [drafts, setDrafts] = useState<Record<number, number>>({})
  const draftTimers = useRef<Record<number, number>>({})
  const timer = useRef<number>()

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      Object.values(draftTimers.current).forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  const clearDraft = (userId: number) =>
    setDrafts((d) => {
      const next = { ...d }
      delete next[userId]
      return next
    })

  const run = async (member: M, roleId: number, roleName: string) => {
    const ok = await apply(member, roleId)
    window.clearTimeout(timer.current)
    if (ok && member.userId !== selfId) {
      setUndo({ member, prevRoleId: member.role.roleId, prevName: member.role.name, nextName: roleName })
      timer.current = window.setTimeout(() => setUndo(null), UNDO_MS)
    } else setUndo(null)
  }

  const request = (member: M, roleId: number, roleName: string) => {
    const id = member.userId
    window.clearTimeout(draftTimers.current[id])
    if (roleId === member.role.roleId) {
      clearDraft(id)
      return
    }
    setDrafts((d) => ({ ...d, [id]: roleId }))
    draftTimers.current[id] = window.setTimeout(() => {
      if (id === selfId) {
        setPending({ member, roleId, roleName })
      } else {
        void run(member, roleId, roleName).finally(() => clearDraft(id))
      }
    }, DEBOUNCE_MS)
  }

  /** Giá trị select nên hiện: lựa chọn đang chờ (nếu có), không thì role hiện tại. */
  const valueFor = (member: M) => drafts[member.userId] ?? member.role.roleId

  // Huỷ xác nhận: ô chọn quay về role hiện tại.
  const cancelPending = () => {
    if (pending) clearDraft(pending.member.userId)
    setPending(null)
  }

  const confirm = (
    <Modal
      open={pending !== null}
      tone="danger"
      onClose={cancelPending}
      title={t('Đổi role của chính bạn?', 'Change your own role?')}
      footer={
        <>
          <Button variant="secondary" inline onClick={cancelPending}>
            {t('Giữ role hiện tại', 'Keep current role')}
          </Button>
          <Button
            inline
            isLoading={busy}
            className="!bg-red-700 hover:!bg-red-800"
            onClick={async () => {
              if (!pending) return
              setBusy(true)
              await run(pending.member, pending.roleId, pending.roleName)
              setBusy(false)
              clearDraft(pending.member.userId)
              setPending(null)
            }}
          >
            {t('Đổi thành', 'Change to')} {pending?.roleName}
          </Button>
        </>
      }
    >
      {pending && (
        <p className="text-sm text-gray-700">
          {t('Bạn đang đổi role của mình trong', 'You are changing your own role in')} {scopeLabel} {t('từ', 'from')}{' '}
          <b className="font-semibold text-gray-950">{pending.member.role.name}</b> {t('sang', 'to')}{' '}
          <b className="font-semibold text-gray-950">{pending.roleName}</b>.{' '}
          {t(
            'Nếu role mới ít quyền hơn, bạn có thể không tự đổi lại được và phải nhờ một quản trị viên khác.',
            'If the new role has fewer permissions, you may not be able to change it back and will need another admin.',
          )}
        </p>
      )}
    </Modal>
  )

  const undoBar = undo && (
    <div
      role="status"
      className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-card bg-gray-950 px-4 py-2.5 text-sm text-white"
    >
      <span>
        {undo.member.fullName}: {undo.prevName} → {undo.nextName}
      </span>
      <button
        type="button"
        className="rounded-control px-2 py-1 font-semibold underline underline-offset-2 hover:bg-white/10"
        onClick={() => {
          window.clearTimeout(timer.current)
          setUndo(null)
          void apply(undo.member, undo.prevRoleId)
        }}
      >
        {t('Hoàn tác', 'Undo')}
      </button>
    </div>
  )

  return { request, valueFor, confirm, undoBar }
}
