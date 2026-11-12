import { type ReactNode } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import type { TestCaseDto } from '@/types/testing'
import { CheckIcon, PlusIcon } from '@/components/ui/icons'

export const PASTEL_COLORS = [
  { id: 'default', label: 'Mặc định (Trắng)', swatch: 'bg-white border-2 border-dashed border-gray-300' },
  { id: 'rose', label: 'Hồng pastel', swatch: 'bg-rose-200' },
  { id: 'amber', label: 'Cam pastel', swatch: 'bg-amber-200' },
  { id: 'yellow', label: 'Vàng pastel', swatch: 'bg-yellow-200' },
  { id: 'emerald', label: 'Xanh ngọc pastel', swatch: 'bg-emerald-200' },
  { id: 'sky', label: 'Xanh lam pastel', swatch: 'bg-sky-200' },
  { id: 'purple', label: 'Tím pastel', swatch: 'bg-purple-200' },
  { id: 'gray', label: 'Xám pastel', swatch: 'bg-gray-200' },
] as const

export function getPastelClass(colorId?: string): string {
  switch (colorId) {
    case 'rose':
      return 'bg-rose-100/75 border-rose-200 text-rose-950'
    case 'amber':
      return 'bg-amber-100/75 border-amber-200 text-amber-950'
    case 'yellow':
      return 'bg-yellow-100/75 border-yellow-200 text-yellow-950'
    case 'emerald':
      return 'bg-emerald-100/75 border-emerald-200 text-emerald-950'
    case 'sky':
      return 'bg-sky-100/75 border-sky-200 text-sky-950'
    case 'purple':
      return 'bg-purple-100/75 border-purple-200 text-purple-950'
    case 'gray':
      return 'bg-gray-100/90 border-gray-200 text-gray-900'
    default:
      return ''
  }
}

export interface TestcaseDynamicIslandProps {
  activeCell: { id: number; col: string } | null
  activeCase?: TestCaseDto | null
  activeColumnLabel?: string
  selectedCount: number
  currentColor?: string
  onFormat: (format: 'bold' | 'italic' | 'underline' | 'strike') => void
  onColor: (colorId: string) => void
  onQuickResult?: (result: 'PASS' | 'FAIL' | 'UNTEST') => void
  onAddCase?: () => void
  onClearSelection?: () => void
  canManage: boolean
  canExecute: boolean
}

export function TestcaseDynamicIsland({
  activeCell,
  activeCase,
  activeColumnLabel,
  selectedCount,
  currentColor,
  onFormat,
  onColor,
  onQuickResult,
  onAddCase,
  onClearSelection,
  canManage,
  canExecute,
}: TestcaseDynamicIslandProps) {
  const { t } = useI18n()

  const hasTarget = activeCell !== null || selectedCount > 0

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 [&>*]:pointer-events-auto transition-all duration-300">
      <div
        role="toolbar"
        aria-label={t('Thanh thao tác nhanh bảng testcase', 'Quick test table toolbar')}
        className={clsx(
          'flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-gray-200/90 bg-white/95 px-3 py-1.5 shadow-float backdrop-blur-md transition-all duration-200 select-none',
        )}
      >
        {/* Ngữ cảnh đang chọn (Indicator chip) */}
        {selectedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700">
            <CheckIcon className="h-3.5 w-3.5" />
            <span>{t(`Đã chọn ${selectedCount} dòng`, `${selectedCount} rows selected`)}</span>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="ml-1 text-brand-400 hover:text-brand-900 text-xs font-bold leading-none"
                title={t('Bỏ chọn', 'Clear selection')}
              >
                ✕
              </button>
            )}
          </span>
        ) : activeCase ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-700">
            <span className="font-mono font-semibold text-gray-900">{activeCase.code}</span>
            <span className="text-gray-400">·</span>
            <span className="max-w-[130px] truncate font-medium">{activeColumnLabel || activeCell?.col}</span>
          </span>
        ) : (
          <span className="text-[12px] font-medium text-gray-400 px-2">
            {t('Chọn ô hoặc dòng để sửa nhanh', 'Select cell or rows to edit')}
          </span>
        )}

        <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />

        {/* Cụm Định dạng Văn bản: Đậm (Ctrl+B), Nghiêng (Ctrl+I), Gạch chân (Ctrl+U), Gạch ngang */}
        <div className="flex items-center gap-0.5">
          <ToolBtn
            label={t('In đậm (Ctrl+B)', 'Bold (Ctrl+B)')}
            disabled={!hasTarget || !canManage}
            onClick={() => onFormat('bold')}
          >
            <span className="font-bold text-[13px]">B</span>
          </ToolBtn>
          <ToolBtn
            label={t('In nghiêng (Ctrl+I)', 'Italic (Ctrl+I)')}
            disabled={!hasTarget || !canManage}
            onClick={() => onFormat('italic')}
          >
            <span className="italic font-serif text-[13px]">I</span>
          </ToolBtn>
          <ToolBtn
            label={t('Gạch chân (Ctrl+U)', 'Underline (Ctrl+U)')}
            disabled={!hasTarget || !canManage}
            onClick={() => onFormat('underline')}
          >
            <span className="underline text-[13px] underline-offset-2">U</span>
          </ToolBtn>
          <ToolBtn
            label={t('Gạch ngang', 'Strikethrough')}
            disabled={!hasTarget || !canManage}
            onClick={() => onFormat('strike')}
          >
            <span className="line-through text-[13px]">S</span>
          </ToolBtn>
        </div>

        <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />

        {/* Cụm Đổ màu Pastel (Pastel Color Swatches) */}
        <div className="relative flex items-center gap-1 pl-0.5">
          <span className="text-[11px] font-medium text-gray-400 mr-0.5 hidden sm:inline">
            {t('Màu:', 'Color:')}
          </span>
          <div className="flex items-center gap-1">
            {PASTEL_COLORS.map((c) => {
              const isSelected = currentColor === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!hasTarget}
                  onClick={() => onColor(c.id)}
                  title={c.label}
                  className={clsx(
                    'h-4 w-4 rounded-full border border-black/15 transition-all focus:outline-none',
                    c.swatch,
                    !hasTarget && 'opacity-40 cursor-not-allowed',
                    hasTarget && 'hover:scale-125',
                    isSelected && 'ring-2 ring-brand-600 ring-offset-1 scale-110 shadow-xs',
                  )}
                />
              )
            })}
          </div>
        </div>

        {/* Cụm Ghi nhanh kết quả Pass / Fail */}
        {canExecute && onQuickResult && (
          <>
            <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!hasTarget}
                onClick={() => onQuickResult('PASS')}
                title={t('Ghi kết quả Pass cho ô/dòng đang chọn', 'Set Pass result')}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-colors',
                  'bg-success-50 text-success-700 border-success-200 hover:bg-success-100',
                  !hasTarget && 'opacity-40 cursor-not-allowed',
                )}
              >
                Pass
              </button>
              <button
                type="button"
                disabled={!hasTarget}
                onClick={() => onQuickResult('FAIL')}
                title={t('Ghi kết quả Fail cho ô/dòng đang chọn', 'Set Fail result')}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-colors',
                  'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                  !hasTarget && 'opacity-40 cursor-not-allowed',
                )}
              >
                Fail
              </button>
            </div>
          </>
        )}

        {/* Nút Thêm testcase nhanh */}
        {canManage && onAddCase && (
          <>
            <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden="true" />
            <button
              type="button"
              onClick={onAddCase}
              className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-black shadow-xs transition-colors"
              title={t('Thêm kịch bản kiểm thử mới', 'Add test case')}
            >
              <PlusIcon className="h-3 w-3" />
              <span>{t('Thêm case', 'Add case')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ToolBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 hover:text-gray-950 transition-colors',
        disabled && 'pointer-events-none opacity-30',
      )}
    >
      {children}
    </button>
  )
}

