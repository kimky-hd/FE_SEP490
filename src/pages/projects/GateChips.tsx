import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon } from '@/components/ui/icons'
import { GATE_CRITERIA, GATE_ORDER, normalizeGates, type GateCriterion } from '@/lib/phaseGates'
import { useI18n } from '@/i18n'

// Chip "Điều kiện hoàn thành giai đoạn" dùng chung: wizard tạo dự án (bước 1) và tab Workflow của dự án.

// Bảng giai đoạn cuộn ngang (overflow) nên ô nổi ra body (portal) và bám theo phần tử neo khi cuộn / đổi cỡ.
// Đóng khi bấm ra ngoài hoặc Esc.
export function useAnchoredPopover(anchorRef: React.RefObject<HTMLElement>, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect()
      const w = ref.current?.offsetWidth ?? 288
      const h = ref.current?.offsetHeight ?? 0
      if (!a) return
      const below = a.bottom + 6
      const top = below + h > window.innerHeight - 8 && a.top - h - 6 > 8 ? a.top - h - 6 : below
      setPos({ top, left: Math.max(8, Math.min(a.left, window.innerWidth - w - 8)) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchorRef])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchorRef.current?.contains(target)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchorRef])

  return { ref, pos }
}

// Cột "Điều kiện hoàn thành giai đoạn": chip điều kiện (× để bỏ) + nút thêm mở danh sách điều kiện còn lại kèm mô tả.
export function GateChips({
  criteria,
  editable,
  onChange,
}: {
  criteria: GateCriterion[]
  editable: boolean
  onChange: (next: GateCriterion[]) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const remaining = GATE_ORDER.filter((c) => !criteria.includes(c))
  const close = useCallback(() => setOpen(false), [])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {criteria.length === 0 && <span className="text-xs text-gray-500">{t('Không có điều kiện', 'No criteria')}</span>}
      {criteria.map((c) => (
        <span
          key={c}
          title={GATE_CRITERIA[c].description()}
          className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-800"
        >
          <CheckIcon className="h-3 w-3" aria-hidden="true" />
          {GATE_CRITERIA[c].short()}
          {editable && (
            <button
              type="button"
              aria-label={t(`Bỏ điều kiện ${GATE_CRITERIA[c].label()}`, `Remove criterion ${GATE_CRITERIA[c].label()}`)}
              onClick={() => onChange(criteria.filter((x) => x !== c))}
              className="-mr-0.5 rounded-full px-0.5 text-brand-600 hover:bg-brand-100 hover:text-red-700"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {editable && remaining.length > 0 && (
        <span ref={anchorRef}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-brand-400 hover:text-brand-700"
          >
            {t('+ Thêm điều kiện', '+ Add criterion')}
          </button>
          {open && (
            <GatePickerPopover
              anchorRef={anchorRef}
              options={remaining}
              onPick={(c) => {
                onChange(normalizeGates([...criteria, c]))
                setOpen(false)
              }}
              onClose={close}
            />
          )}
        </span>
      )}
    </div>
  )
}

export function GatePickerPopover({
  anchorRef,
  options,
  onPick,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLSpanElement>
  options: GateCriterion[]
  onPick: (c: GateCriterion) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const { ref, pos } = useAnchoredPopover(anchorRef, onClose)

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={t('Thêm điều kiện hoàn thành', 'Add exit criterion')}
      style={pos ?? { visibility: 'hidden' }}
      className="fixed z-50 w-[min(20rem,calc(100vw-1rem))] rounded-card border border-gray-200 bg-white p-1.5 text-left shadow-pop"
    >
      {options.map((c, i) => (
        <button
          key={c}
          type="button"
          autoFocus={i === 0}
          onClick={() => onPick(c)}
          className="block w-full rounded-control px-2.5 py-2 text-left hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
        >
          <span className="block text-sm font-medium text-gray-900">{GATE_CRITERIA[c].label()}</span>
          <span className="mt-0.5 block text-xs leading-snug text-gray-500">{GATE_CRITERIA[c].description()}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
