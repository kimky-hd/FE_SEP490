import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { FolderIcon, LockIcon, PlusIcon } from '@/components/ui/icons'
import type { DocumentNodeDto } from '@/types/document'
import { ChevronRight, IconButton, MoreIcon, PageIcon, menuItem, menuPanel, statusLabel, usePopover } from './docUi'

export interface TreeNode extends DocumentNodeDto {
  children: TreeNode[]
}

export function buildTree(nodes: DocumentNodeDto[]): TreeNode[] {
  const map = new Map<number, TreeNode>(nodes.map((n) => [n.documentId, { ...n, children: [] }]))
  const roots: TreeNode[] = []
  for (const n of map.values()) {
    const parent = n.parentId !== null ? map.get(n.parentId) : undefined
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  const sort = (list: TreeNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.documentId - b.documentId)
    list.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

/** Thứ tự duyệt cây (dùng để mở trang đầu tiên). */
export const flattenTree = (list: TreeNode[]): TreeNode[] => list.flatMap((n) => [n, ...flattenTree(n.children)])

const expandKey = (projectId: number) => `ssam.docs.expanded.${projectId}`

function readExpanded(projectId: number): Set<number> | null {
  try {
    const raw = localStorage.getItem(expandKey(projectId))
    return raw ? new Set(JSON.parse(raw) as number[]) : null
  } catch {
    return null
  }
}

interface TreeProps {
  projectId: number
  nodes: DocumentNodeDto[]
  activeId: number | null
  canEdit: boolean
  canDelete: boolean
  onAddChild: (parent: DocumentNodeDto) => void
  onRename: (node: DocumentNodeDto, title: string) => void
  onMove: (node: DocumentNodeDto, direction: -1 | 1) => void
  onDelete: (node: DocumentNodeDto) => void
}

export function DocumentTree({
  projectId,
  nodes,
  activeId,
  canEdit,
  canDelete,
  onAddChild,
  onRename,
  onMove,
  onDelete,
}: TreeProps) {
  const { t } = useI18n()
  const tree = useMemo(() => buildTree(nodes), [nodes])
  const [expanded, setExpanded] = useState<Set<number>>(
    () => readExpanded(projectId) ?? new Set(nodes.filter((n) => n.kind === 'FOLDER').map((n) => n.documentId)),
  )
  const [renaming, setRenaming] = useState<number | null>(null)

  // Mở sẵn nhánh chứa trang đang xem.
  useEffect(() => {
    if (activeId === null) return
    const byId = new Map(nodes.map((n) => [n.documentId, n]))
    let cur = byId.get(activeId)
    const add: number[] = []
    while (cur?.parentId) {
      add.push(cur.parentId)
      cur = byId.get(cur.parentId)
    }
    if (add.some((id) => !expanded.has(id))) setExpanded((prev) => new Set([...prev, ...add]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, nodes])

  useEffect(() => {
    try {
      localStorage.setItem(expandKey(projectId), JSON.stringify([...expanded]))
    } catch {
      // storage bị chặn: chỉ mất trạng thái mở/đóng khi tải lại
    }
  }, [expanded, projectId])

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const render = (list: TreeNode[], depth: number) =>
    list.map((n, i) => (
      <li key={n.documentId}>
        <TreeRow
          node={n}
          depth={depth}
          active={n.documentId === activeId}
          open={expanded.has(n.documentId)}
          isFirst={i === 0}
          isLast={i === list.length - 1}
          renaming={renaming === n.documentId}
          canEdit={canEdit}
          canDelete={canDelete}
          onToggle={() => toggle(n.documentId)}
          onStartRename={() => setRenaming(n.documentId)}
          onRename={(title) => {
            setRenaming(null)
            if (title.trim() && title.trim() !== n.title) onRename(n, title.trim())
          }}
          onAddChild={() => {
            setExpanded((prev) => new Set([...prev, n.documentId]))
            onAddChild(n)
          }}
          onMove={(d) => onMove(n, d)}
          onDelete={() => onDelete(n)}
        />
        {n.children.length > 0 && expanded.has(n.documentId) && <ul>{render(n.children, depth + 1)}</ul>}
      </li>
    ))

  if (tree.length === 0)
    return <p className="px-3 py-2 text-sm text-gray-500">{t('Không có trang nào.', 'No pages.')}</p>
  return (
    <nav aria-label={t('Cây tài liệu', 'Document tree')}>
      <ul className="space-y-px">{render(tree, 0)}</ul>
    </nav>
  )
}

function TreeRow({
  node,
  depth,
  active,
  open,
  isFirst,
  isLast,
  renaming,
  canEdit,
  canDelete,
  onToggle,
  onStartRename,
  onRename,
  onAddChild,
  onMove,
  onDelete,
}: {
  node: TreeNode
  depth: number
  active: boolean
  open: boolean
  isFirst: boolean
  isLast: boolean
  renaming: boolean
  canEdit: boolean
  canDelete: boolean
  onToggle: () => void
  onStartRename: () => void
  onRename: (title: string) => void
  onAddChild: () => void
  onMove: (d: -1 | 1) => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const menu = usePopover()
  const inputRef = useRef<HTMLInputElement>(null)
  const isFolder = node.kind === 'FOLDER'
  const status = node.currentVersion?.status
  const hasChildren = node.children.length > 0
  const pad = { paddingLeft: 6 + depth * 14 }

  useEffect(() => {
    if (renaming) inputRef.current?.select()
  }, [renaming])

  const label = (
    <span className="min-w-0 flex-1 truncate">
      {node.code && <span className="mr-1.5 tabular-nums text-gray-500">{node.code}</span>}
      {node.title}
    </span>
  )

  const marker =
    status === 'APPROVED' ? (
      <LockIcon className="h-3.5 w-3.5 text-gray-400" aria-label={statusLabel('APPROVED')} />
    ) : status === 'IN_REVIEW' || status === 'CHANGES_REQUESTED' || status === 'DRAFT' ? (
      <span
        title={statusLabel(status)}
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          status === 'IN_REVIEW' ? 'bg-brand-500' : status === 'CHANGES_REQUESTED' ? 'bg-amber-500' : 'bg-gray-300',
        )}
      />
    ) : null

  const rowClass = clsx(
    'group relative flex min-h-9 items-center gap-1.5 rounded-control pr-1 text-sm transition-colors lg:min-h-8',
    active ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200' : 'text-gray-700 hover:bg-gray-100',
  )

  return (
    <div className={rowClass} style={pad}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? t('Thu gọn', 'Collapse') : t('Mở rộng', 'Expand')}
        aria-expanded={hasChildren ? open : undefined}
        className={clsx(
          'flex h-5 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700',
          !hasChildren && 'invisible',
        )}
        tabIndex={hasChildren ? 0 : -1}
      >
        <ChevronRight className={clsx('h-3 w-3 transition-transform', open && 'rotate-90')} />
      </button>
      {isFolder ? (
        <FolderIcon className="h-4 w-4 shrink-0 text-gray-500" />
      ) : (
        <PageIcon className="h-4 w-4 shrink-0 text-gray-500" />
      )}
      {renaming ? (
        <input
          ref={inputRef}
          defaultValue={node.title}
          aria-label={t('Tên mới', 'New name')}
          className="h-7 min-w-0 flex-1 rounded-[6px] border border-brand-400 bg-white px-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename(e.currentTarget.value)
            if (e.key === 'Escape') onRename(node.title)
          }}
        />
      ) : isFolder ? (
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center py-1 text-left">
          {label}
        </button>
      ) : (
        <Link
          to={`/projects/${node.projectId}/documents/${node.documentId}`}
          aria-current={active ? 'page' : undefined}
          className="flex min-w-0 flex-1 items-center py-1"
        >
          {label}
        </Link>
      )}
      {!renaming && (
        <span
          className={clsx(
            'flex shrink-0 items-center',
            (canEdit || canDelete) && 'group-hover:hidden group-focus-within:hidden',
            menu.open && 'hidden',
          )}
        >
          {marker}
        </span>
      )}
      {(canEdit || canDelete) && !renaming && (
        <div
          ref={menu.ref}
          className={clsx(
            'relative shrink-0 items-center',
            menu.open ? 'flex' : 'hidden group-hover:flex group-focus-within:flex',
          )}
        >
          {canEdit && (
            <IconButton label={t('Thêm trang con', 'Add sub-page')} className="h-6 w-6" onClick={onAddChild}>
              <PlusIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
          <IconButton
            label={t('Thao tác', 'Actions')}
            className="h-6 w-6"
            onClick={() => menu.setOpen((v) => !v)}
            aria-expanded={menu.open}
          >
            <MoreIcon className="h-3.5 w-3.5" />
          </IconButton>
          {menu.open && (
            <div className={clsx(menuPanel, 'right-0 top-full')} role="menu">
              {canEdit && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    onClick={() => (menu.setOpen(false), onStartRename())}
                  >
                    {t('Đổi tên', 'Rename')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    disabled={isFirst}
                    onClick={() => (menu.setOpen(false), onMove(-1))}
                  >
                    {t('Lên trên', 'Move up')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    disabled={isLast}
                    onClick={() => (menu.setOpen(false), onMove(1))}
                  >
                    {t('Xuống dưới', 'Move down')}
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  type="button"
                  role="menuitem"
                  className={clsx(menuItem, 'text-red-700 hover:bg-red-50 hover:text-red-800')}
                  onClick={() => (menu.setOpen(false), onDelete())}
                >
                  {t('Xoá', 'Delete')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
