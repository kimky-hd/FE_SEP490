import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/Button'
import { MenuIcon } from '@/components/ui/icons'
import type { DocumentNodeDto } from '@/types/document'
import {
  ArrowDown,
  ArrowUp,
  IconButton,
  MoreIcon,
  ShrinkIcon,
  SidebarIcon,
  menuItem,
  menuPanel,
  usePopover,
} from '../docUi'
import type { PanelTab } from '../SidePanel'
import type { SaveState } from './useDocumentAutosave'

export interface PrimaryAction {
  key: string
  label: string
  onClick: () => void
}

interface Props {
  node: DocumentNodeDto
  parentTitle: string | null
  fullscreen: boolean
  projectName?: string
  treeOpen: boolean
  onToggleTree: () => void
  onExitFullscreen?: () => void
  editable: boolean
  saveState: SaveState
  onRetrySave: () => void
  reqCount: number
  commentCount: number
  panel: PanelTab | null
  onPanel: (tab: PanelTab | null) => void
  primary: PrimaryAction | null
  busyKey: string | null
  canRequestChanges: boolean
  onRequestChanges: () => void
  onPrint: () => void
  canDelete: boolean
  onDelete: () => void
}

export function DocumentTopBar({
  node,
  parentTitle,
  fullscreen,
  projectName,
  treeOpen,
  onToggleTree,
  onExitFullscreen,
  editable,
  saveState,
  onRetrySave,
  reqCount,
  commentCount,
  panel,
  onPanel,
  primary,
  busyKey,
  canRequestChanges,
  onRequestChanges,
  onPrint,
  canDelete,
  onDelete,
}: Props) {
  const { t } = useI18n()
  const menu = usePopover()
  const reqLabel = t(`Yêu cầu (${reqCount})`, `Requirements (${reqCount})`)
  const commentLabel = t(`Bình luận (${commentCount})`, `Comments (${commentCount})`)
  const treeLabel = treeOpen ? t('Ẩn cây trang', 'Hide page tree') : t('Hiện cây trang', 'Show page tree')

  const saveText =
    !editable && saveState === 'saved'
      ? null
      : {
          saving: t('Đang lưu…', 'Saving…'),
          dirty: t('Chưa lưu', 'Unsaved'),
          error: t('Chưa lưu được', 'Not saved'),
          saved: t('Đã lưu', 'Saved'),
        }[saveState]

  const panelBtn = (tab: PanelTab, label: string) => (
    <button
      type="button"
      onClick={() => onPanel(panel === tab ? null : tab)}
      aria-pressed={panel === tab}
      className={clsx(
        'hidden h-9 items-center rounded-control px-2.5 text-sm transition-colors sm:inline-flex',
        panel === tab ? 'bg-gray-100 font-medium text-gray-950' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950',
      )}
    >
      {label}
    </button>
  )
  const menuAction = (fn: () => void) => () => {
    menu.setOpen(false)
    fn()
  }

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 sm:px-4',
        fullscreen ? 'h-[52px]' : 'h-12',
      )}
    >
      {fullscreen ? (
        <IconButton label={treeLabel} onClick={onToggleTree} active={treeOpen}>
          <MenuIcon className="h-4 w-4" />
        </IconButton>
      ) : (
        <>
          <IconButton label={treeLabel} onClick={onToggleTree} active={treeOpen} className="lg:hidden">
            <SidebarIcon />
          </IconButton>
          {!treeOpen && (
            <IconButton
              label={t('Hiện cây trang', 'Show page tree')}
              onClick={onToggleTree}
              className="hidden lg:inline-flex"
            >
              <SidebarIcon />
            </IconButton>
          )}
        </>
      )}
      <p className="min-w-0 flex-1 truncate text-sm text-gray-500">
        {fullscreen && projectName && <span className="font-semibold text-gray-950">{projectName} </span>}
        {fullscreen && projectName && <span>/ </span>}
        {parentTitle && <span className="hidden sm:inline">{parentTitle} / </span>}
        <span className="font-medium text-gray-900">
          {node.code} {node.title}
        </span>
      </p>
      {saveText && (
        <span
          aria-live="polite"
          className={clsx(
            'hidden shrink-0 text-xs sm:inline',
            saveState === 'error' ? 'text-red-700' : 'text-gray-500',
          )}
        >
          {saveText}
          {saveState === 'error' && (
            <button type="button" onClick={onRetrySave} className="ml-1 font-medium underline">
              {t('Thử lại', 'Retry')}
            </button>
          )}
        </span>
      )}
      {panelBtn('reqs', reqLabel)}
      {!fullscreen && panelBtn('comments', commentLabel)}
      {primary && (
        <Button inline isLoading={busyKey === primary.key} onClick={primary.onClick}>
          {primary.label}
        </Button>
      )}
      <div ref={menu.ref} className="relative">
        <IconButton
          label={t('Thêm thao tác', 'More actions')}
          onClick={() => menu.setOpen((v) => !v)}
          aria-expanded={menu.open}
          className="h-9 w-9 border border-gray-300 shadow-xs"
        >
          <MoreIcon />
        </IconButton>
        {menu.open && (
          <div className={clsx(menuPanel, 'right-0 top-full')} role="menu">
            <button
              type="button"
              role="menuitem"
              className={clsx(menuItem, 'sm:hidden')}
              onClick={menuAction(() => onPanel('reqs'))}
            >
              {reqLabel}
            </button>
            <button
              type="button"
              role="menuitem"
              className={clsx(menuItem, !fullscreen && 'sm:hidden')}
              onClick={menuAction(() => onPanel('comments'))}
            >
              {commentLabel}
            </button>
            {canRequestChanges && (
              <button type="button" role="menuitem" className={menuItem} onClick={menuAction(onRequestChanges)}>
                {t('Yêu cầu chỉnh sửa', 'Request changes')}
              </button>
            )}
            <button type="button" role="menuitem" className={menuItem} onClick={menuAction(() => onPanel('history'))}>
              {t('Lịch sử', 'History')}
            </button>
            <button type="button" role="menuitem" className={menuItem} onClick={menuAction(onPrint)}>
              {t('Xuất PDF / In', 'Export PDF / Print')}
            </button>
            {canDelete && (
              <button
                type="button"
                role="menuitem"
                className={clsx(menuItem, 'text-red-700 hover:bg-red-50 hover:text-red-800')}
                onClick={menuAction(onDelete)}
              >
                {t('Xoá trang', 'Delete page')}
              </button>
            )}
          </div>
        )}
      </div>
      {fullscreen && onExitFullscreen && (
        <IconButton
          label={t('Thoát toàn màn hình (Esc)', 'Exit full screen (Esc)')}
          onClick={onExitFullscreen}
          className="h-9 w-9 border border-gray-200 text-gray-600"
        >
          <ShrinkIcon />
        </IconButton>
      )}
    </div>
  )
}

export function CompareBar({
  currentLabel,
  baseLabel,
  changeIndex,
  changeCount,
  onJump,
  onExit,
}: {
  currentLabel: string
  baseLabel: string
  changeIndex: number
  changeCount: number
  onJump: (dir: 1 | -1) => void
  onExit: () => void
}) {
  const { t } = useI18n()
  const navBtn = 'border border-brand-200 bg-white text-brand-700 hover:bg-white'
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-brand-100 bg-brand-50 px-4 py-2 text-sm">
      <span className="font-medium text-brand-800">
        {t(`So sánh ${currentLabel} với ${baseLabel}`, `Comparing v${currentLabel} with v${baseLabel}`)}
      </span>
      <span className="ml-auto tabular-nums text-brand-800">
        {t('Thay đổi', 'Change')} {changeIndex >= 0 ? changeIndex + 1 : '–'}/{changeCount}
      </span>
      <span className="flex gap-1">
        <IconButton
          label={t('Thay đổi trước', 'Previous change')}
          onClick={() => onJump(-1)}
          disabled={!changeCount}
          className={navBtn}
        >
          <ArrowUp />
        </IconButton>
        <IconButton
          label={t('Thay đổi sau', 'Next change')}
          onClick={() => onJump(1)}
          disabled={!changeCount}
          className={navBtn}
        >
          <ArrowDown />
        </IconButton>
      </span>
      <button type="button" onClick={onExit} className="font-medium text-gray-700 hover:text-gray-950">
        {t('Tắt so sánh', 'Exit compare')}
      </button>
    </div>
  )
}
