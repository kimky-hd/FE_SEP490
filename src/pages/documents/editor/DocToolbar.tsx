import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { ChevronDownIcon } from '@/components/ui/icons'
import { CommentIcon, MoreIcon, menuItem, usePopover } from '../docUi'

/** Một mục chèn khối — dùng chung với menu "/" của DocEditor. */
export interface BlockItem {
  id: string
  label: string
  hint: string
  keywords: string
  icon: ReactNode
  run: (editor: Editor) => void
}

// Thanh công cụ nổi ở giữa đáy vùng soạn (kiểu thanh công cụ dưới đáy của Figma) — luôn cùng một chỗ ở cả hai chế độ.
// `compact` (chế độ thường): các nút hay dùng + "…" chứa phần còn lại. `full` (toàn màn hình): đủ mọi nút, có nhãn.
// Menu "/" và thanh khi bôi đen vẫn giữ làm lối tắt.

const HEADINGS = ['p', 'h1', 'h2', 'h3'] as const
const LISTS = ['ul', 'ol', 'todo'] as const
// Khối hay dùng ở bản gọn (theo thứ tự nhóm); phần còn lại vào "…".
const COMPACT_INSERTS = ['table', 'figma', 'mermaid', 'ai-diagram'] as const
const FULL_INSERTS = ['table', 'callout', 'figma', 'mermaid', 'ai-diagram'] as const

export function DocToolbar({
  editor,
  items,
  variant,
  isReq,
  onToggleReq,
  canComment,
  onComment,
  slot,
}: {
  /** Khe ở đáy cột nội dung (DocumentView) — thanh nằm cố định ở đó dù tài liệu dài hay ngắn. */
  slot: HTMLElement | null
  editor: Editor
  items: BlockItem[]
  variant: 'compact' | 'full'
  isReq: boolean
  onToggleReq: () => void
  canComment: boolean
  /** Có vùng chọn: bình luận đoạn đó; không có: mở bảng bình luận. */
  onComment: () => void
}) {
  const { t } = useI18n()
  const full = variant === 'full'
  const byId = new Map(items.map((i) => [i.id, i]))
  const pick = (ids: readonly string[]) => ids.map((id) => byId.get(id)).filter((x): x is BlockItem => !!x)

  const headingLevel = ([1, 2, 3] as const).find((level) => editor.isActive('heading', { level }))
  const activeOf = (id: string) =>
    ({
      p: editor.isActive('paragraph'),
      h1: headingLevel === 1 && !isReq,
      h2: headingLevel === 2 && !isReq,
      h3: headingLevel === 3 && !isReq,
      ul: editor.isActive('bulletList'),
      ol: editor.isActive('orderedList'),
      todo: editor.isActive('taskList'),
    })[id] ?? false

  const run = (item: BlockItem) => item.run(editor)
  const inserts = pick(full ? FULL_INSERTS : COMPACT_INSERTS)
  const shown = new Set<string>([...LISTS, 'req', ...inserts.map((i) => i.id), ...(full ? HEADINGS : [])])
  const overflow = items.filter((i) => !shown.has(i.id) && !HEADINGS.includes(i.id as (typeof HEADINGS)[number]))

  if (!slot) return null
  return createPortal(
    <div
      role="toolbar"
      aria-label={t('Công cụ soạn thảo', 'Editing tools')}
      // Giữ con trỏ / vùng chọn trong editor khi bấm nút.
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault()
      }}
      className={clsx(
        // Màn hẹp thì xuống dòng (không cuộn ngang: cuộn sẽ cắt mất các menu bật lên phía trên).
        'flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-card border border-gray-200 bg-white/95 p-1 shadow-float backdrop-blur',
      )}
    >
      {full ? (
        pick(HEADINGS).map((item) => (
          <ToolButton key={item.id} label={item.label} active={activeOf(item.id)} onClick={() => run(item)}>
            {item.icon}
          </ToolButton>
        ))
      ) : (
        <HeadingMenu items={pick(HEADINGS)} activeOf={activeOf} onPick={run} />
      )}
      {pick(LISTS).map((item) => (
        <ToolButton key={item.id} label={item.label} active={activeOf(item.id)} onClick={() => run(item)}>
          {item.icon}
        </ToolButton>
      ))}
      {full && (
        <>
          <Sep />
          <ToolButton
            label={t('Đậm (Ctrl+B)', 'Bold (Ctrl+B)')}
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <span className="text-[13px] font-bold">B</span>
          </ToolButton>
          <ToolButton
            label={t('Nghiêng (Ctrl+I)', 'Italic (Ctrl+I)')}
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <span className="text-[13px] italic">I</span>
          </ToolButton>
          <ToolButton
            label={t('Gạch chân (Ctrl+U)', 'Underline (Ctrl+U)')}
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span className="text-[13px] underline">U</span>
          </ToolButton>
        </>
      )}
      <Sep />
      <ToolButton
        label={isReq ? t('Bỏ đánh dấu REQ', 'Unmark REQ') : t('Yêu cầu (REQ)', 'Requirement (REQ)')}
        active={isReq}
        onClick={onToggleReq}
        text="REQ"
      >
        {byId.get('req')?.icon}
      </ToolButton>
      {inserts.map((item) => (
        <ToolButton
          key={item.id}
          label={item.label}
          onClick={() => run(item)}
          text={full ? item.label : undefined}
          accent={item.id === 'ai-diagram'}
        >
          {item.icon}
        </ToolButton>
      ))}
      {canComment && (
        <>
          <Sep />
          <ToolButton
            label={t('Bình luận (bôi đen đoạn cần góp ý)', 'Comment (select the text first)')}
            onClick={onComment}
            text={full ? t('Bình luận', 'Comment') : undefined}
          >
            <CommentIcon className="h-4 w-4" />
          </ToolButton>
        </>
      )}
      {overflow.length > 0 && <MoreMenu items={overflow} onPick={run} />}
    </div>,
    slot,
  )
}

const Sep = () => <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-gray-200" />

function ToolButton({
  label,
  active,
  onClick,
  text,
  accent,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  /** Chữ hiện cạnh icon (bản đầy đủ). */
  text?: string
  accent?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? undefined}
      onClick={onClick}
      className={clsx(
        'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-control text-gray-600 transition-colors [&_svg]:h-4 [&_svg]:w-4',
        text ? 'px-2.5 text-[13px] font-medium' : 'w-9',
        active ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-100 hover:text-gray-950',
        accent && !active && 'text-brand-600',
      )}
    >
      {children}
      {text && <span aria-hidden="true">{text}</span>}
    </button>
  )
}

/** Bản gọn: một nút "Aa ▾" chọn Đoạn văn / Tiêu đề 1–3. */
function HeadingMenu({
  items,
  activeOf,
  onPick,
}: {
  items: BlockItem[]
  activeOf: (id: string) => boolean
  onPick: (item: BlockItem) => void
}) {
  const { t } = useI18n()
  const menu = usePopover()
  const current = items.find((i) => i.id !== 'p' && activeOf(i.id)) ?? items[0]
  return (
    <div ref={menu.ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={t('Kiểu chữ', 'Text style')}
        title={t('Kiểu chữ', 'Text style')}
        onClick={() => menu.setOpen((v) => !v)}
        className={clsx(
          'inline-flex h-9 items-center gap-1 rounded-control px-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100',
          menu.open && 'bg-gray-100',
        )}
      >
        <span className="w-6 text-center">{current?.id === 'p' ? 'Aa' : current?.id.toUpperCase()}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 text-gray-500" />
      </button>
      {menu.open && (
        <MenuUp>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={clsx(menuItem, activeOf(item.id) && 'font-medium text-gray-950')}
              onClick={() => {
                menu.setOpen(false)
                onPick(item)
              }}
            >
              <span className="flex w-6 justify-center text-gray-500">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </MenuUp>
      )}
    </div>
  )
}

function MoreMenu({ items, onPick }: { items: BlockItem[]; onPick: (item: BlockItem) => void }) {
  const { t } = useI18n()
  const menu = usePopover()
  const [query, setQuery] = useState('')
  return (
    <div ref={menu.ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={t('Khối khác', 'More blocks')}
        title={t('Khối khác', 'More blocks')}
        onClick={() => {
          setQuery('')
          menu.setOpen((v) => !v)
        }}
        className={clsx(
          'inline-flex h-9 w-9 items-center justify-center rounded-control text-gray-600 hover:bg-gray-100',
          menu.open && 'bg-gray-100',
        )}
      >
        <MoreIcon />
      </button>
      {menu.open && (
        <MenuUp align="right">
          {items.length > 6 && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Tìm khối…', 'Find a block…')}
              className="mb-1 h-8 w-full rounded-[6px] border border-gray-200 px-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          )}
          {items
            .filter((i) => !query || i.label.toLowerCase().includes(query.toLowerCase()) || i.keywords.includes(query))
            .map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={menuItem}
                onClick={() => {
                  menu.setOpen(false)
                  onPick(item)
                }}
              >
                <span className="flex w-6 justify-center text-gray-500">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="block truncate text-xs text-gray-500">{item.hint}</span>
                </span>
              </button>
            ))}
        </MenuUp>
      )}
    </div>
  )
}

/** Menu bật lên phía trên (thanh nằm ở đáy). */
function MenuUp({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <div
      role="menu"
      className={clsx(
        'absolute bottom-full z-30 mb-2 max-h-[50vh] w-60 overflow-y-auto rounded-card border border-gray-200 bg-white p-1 shadow-pop',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      {children}
    </div>
  )
}
