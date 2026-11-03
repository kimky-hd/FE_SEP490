import { Fragment, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { useI18n } from '@/i18n'

// Ô viết bình luận có @nhắc tên (bình luận tài liệu — D01, và bình luận issue #39): gõ @ hiện danh sách thành viên
// dự án, chọn để chèn "@Họ tên". Khi gửi, `mentionIdsIn` lấy id những người còn tên trong nội dung → `mentionUserIds`.

export interface MentionPerson {
  userId: number
  fullName: string
}

/** Id những người đã chọn mà "@Họ tên" vẫn còn trong nội dung. */
export function mentionIdsIn(text: string, picked: MentionPerson[]): number[] {
  return [...new Set(picked.filter((u) => text.includes(`@${u.fullName}`)).map((u) => u.userId))]
}

interface Props {
  value: string
  onChange: (value: string) => void
  people: MentionPerson[]
  onPick: (person: MentionPerson) => void
  /** Ctrl/⌘ + Enter. */
  onSubmit?: () => void
  ariaLabel: string
  placeholder?: string
  rows?: number
  maxLength?: number
  autoFocus?: boolean
  className?: string
}

export function MentionTextarea({
  value,
  onChange,
  people,
  onPick,
  onSubmit,
  ariaLabel,
  placeholder,
  rows = 2,
  maxLength,
  autoFocus,
  className,
}: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  const needle = query?.toLocaleLowerCase('vi') ?? ''
  const matches =
    query === null ? [] : people.filter((u) => u.fullName.toLocaleLowerCase('vi').includes(needle)).slice(0, 6)

  const change = (text: string, caret: number) => {
    onChange(text)
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret))
    setQuery(m ? m[2] : null)
    setActive(0)
  }

  const pick = (u: MentionPerson) => {
    const el = ref.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@([^\s@]{0,30})$/, `@${u.fullName} `)
    onChange(before + value.slice(caret))
    onPick(u)
    setQuery(null)
    requestAnimationFrame(() => el?.focus())
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => change(e.target.value, e.target.selectionStart)}
        onKeyDown={(e) => {
          if (matches.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(matches.length - 1, i + 1))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(0, i - 1))
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              pick(matches[active])
              return
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              setQuery(null)
              return
            }
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit?.()
        }}
        className={className}
      />
      {matches.length > 0 && (
        <ul
          role="listbox"
          aria-label={t('Nhắc tên', 'Mention')}
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-card border border-gray-200 bg-white p-1 shadow-pop"
        >
          {matches.map((u, i) => (
            <li
              key={u.userId}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(u)
              }}
              className={clsx(
                'flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] text-gray-900',
                i === active && 'bg-gray-100',
              )}
            >
              <Avatar name={u.fullName} size="sm" />
              <span className="truncate">{u.fullName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Nội dung bình luận, "@Họ tên" của người trong `mentions` được tô đậm. */
export function MentionText({ body, mentions }: { body: string; mentions?: MentionPerson[] | null }) {
  const names = [...new Set((mentions ?? []).map((m) => m.fullName).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )
  if (!names.length) return <>{body}</>
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(@(?:${names.map(escape).join('|')}))`, 'g')
  const parts: ReactNode[] = body.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-medium text-brand-700">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
  return <>{parts}</>
}
