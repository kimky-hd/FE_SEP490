import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { buttonClasses } from '@/components/ui/Button'
import { ChevronDownIcon, FolderIcon, NotesIcon, PlusIcon } from '@/components/ui/icons'
import { PageIcon, menuItem, menuPanel, usePopover } from './docUi'

/**
 * Nút tách "+ Tài liệu mới": bấm phần chính = trang trống; mũi tên mở menu Trang trống / Từ ghi chú họp (/ Thư mục).
 * Dùng ở trang Tổng quan và trang chủ tài liệu của dự án (nút primary duy nhất của màn).
 */
export function NewDocButton({
  onBlank,
  onNotes,
  onFolder,
  className,
}: {
  onBlank: () => void
  onNotes: () => void
  onFolder?: () => void
  className?: string
}) {
  const { t } = useI18n()
  const menu = usePopover()
  const base = buttonClasses({ inline: true })
  return (
    <div ref={menu.ref} className={clsx('relative inline-flex shrink-0', className)}>
      <button type="button" onClick={onBlank} className={clsx(base, 'rounded-r-none')}>
        <PlusIcon className="h-4 w-4" />
        {t('Tài liệu mới', 'New document')}
      </button>
      <button
        type="button"
        onClick={() => menu.setOpen((v) => !v)}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        aria-label={t('Chọn cách tạo tài liệu', 'Choose how to create a document')}
        className={clsx(base, 'rounded-l-none border-l border-white/30 px-2.5 lg:px-2.5')}
      >
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {menu.open && (
        <div className={clsx(menuPanel, 'right-0 top-full w-56')} role="menu">
          <button type="button" role="menuitem" className={menuItem} onClick={() => (menu.setOpen(false), onBlank())}>
            <PageIcon className="text-gray-500" />
            {t('Trang trống', 'Blank page')}
          </button>
          <button type="button" role="menuitem" className={menuItem} onClick={() => (menu.setOpen(false), onNotes())}>
            <NotesIcon className="h-4 w-4 text-gray-500" />
            {t('Từ ghi chú họp', 'From meeting notes')}
          </button>
          {onFolder && (
            <button
              type="button"
              role="menuitem"
              className={menuItem}
              onClick={() => (menu.setOpen(false), onFolder())}
            >
              <FolderIcon className="h-4 w-4 text-gray-500" />
              {t('Thư mục', 'Folder')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
