import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { CheckIcon, LinkIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

// Phần dùng chung giữa trang /members/invite và ô mời nhanh ở trang chủ.

/** Schema email lời mời; dựng theo `t` để thông báo lỗi đổi theo ngôn ngữ. */
export const makeInviteEmailSchema = (t: (vi: string, en: string) => string) =>
  z.string().min(1, t('Vui lòng nhập email', 'Please enter an email')).email(t('Email không hợp lệ', 'Invalid email'))

/** Copy link vào clipboard; báo "Đã copy" 2 giây hoặc lỗi nếu trình duyệt chặn. */
function useCopy() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  // Dọn timer khi rời trang, tránh setState trên component đã unmount.
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async (text: string) => {
    setCopyError(false)
    try {
      // Clipboard API có thể không tồn tại (HTTP không phải localhost) hoặc bị từ chối quyền → reject.
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
    }
  }
  return { copied, copyError, copy }
}

/** Xác nhận gọn sau khi mời: email đã mời + nút sao chép link mời (API trả `inviteUrl`). */
export function InviteSuccess({
  email,
  inviteUrl,
  onAgain,
}: {
  email: string
  inviteUrl: string
  onAgain?: () => void
}) {
  const { t } = useI18n()
  const { copied, copyError, copy } = useCopy()
  return (
    <div role="status" className="rounded-control border border-success-200 bg-success-50 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-600 text-white"
        >
          <CheckIcon className="h-3 w-3" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-success-800">
          {t('Đã mời', 'Invited')} <b className="break-all font-semibold">{email}</b>
        </p>
        <div className="flex shrink-0 gap-2">
          {onAgain && (
            <Button
              inline
              variant="ghost"
              className="h-8 px-2.5 text-success-800 hover:bg-success-100"
              onClick={onAgain}
            >
              {t('Mời thêm', 'Invite another')}
            </Button>
          )}
          <Button inline variant="secondary" className="h-8 px-2.5" onClick={() => void copy(inviteUrl)}>
            {copied ? (
              <CheckIcon className="h-4 w-4 text-success-600" />
            ) : (
              <LinkIcon className="h-4 w-4 text-gray-500" />
            )}
            {copied ? t('Đã sao chép', 'Copied') : t('Sao chép link mời', 'Copy invite link')}
          </Button>
        </div>
      </div>
      {copyError && (
        <div className="mt-2.5">
          <p className="text-xs text-red-700">
            {t(
              'Trình duyệt không cho phép copy tự động — hãy chọn và copy link thủ công.',
              'Your browser blocked automatic copying — select and copy the link manually.',
            )}
          </p>
          <input
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.target.select()}
            aria-label={t('Link lời mời', 'Invitation link')}
            className="mt-1.5 h-8 w-full rounded-control border border-success-200 bg-white px-2.5 text-xs text-gray-700"
          />
        </div>
      )}
    </div>
  )
}
