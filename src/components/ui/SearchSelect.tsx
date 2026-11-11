import { useEffect, useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { stripVietnamese } from '@/lib/slug'
import { useI18n } from '@/i18n'
import { ChevronDownIcon } from './icons'

export interface SearchOption {
  value: number | string
  label: string
}

const fold = (s: string) => stripVietnamese(s).toLowerCase()

/**
 * Ô chọn có gõ để lọc (combobox ARIA 1.2): gõ không dấu vẫn khớp ("ha noi" → "Thành phố Hà Nội").
 * Dùng cho danh sách dài như Phường/Xã mà `<select>` thường khó tìm.
 */
export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  loading,
  error,
  id,
}: {
  label: string
  value: SearchOption['value'] | null
  options: SearchOption[]
  onChange: (option: SearchOption) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  error?: string
  id?: string
}) {
  const { t } = useI18n()
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`
  const errorId = `${inputId}-error`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value) ?? null
  const filtered = useMemo(() => {
    const q = fold(query.trim())
    return q ? options.filter((o) => fold(o.label).includes(q)) : options
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (o: SearchOption) => {
    onChange(o)
    setQuery('')
    setOpen(false)
  }

  const openList = () => {
    if (disabled) return
    setQuery('')
    setOpen(true)
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-gray-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${inputId}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : (selected?.label ?? '')}
          placeholder={loading ? t('Đang tải…', 'Loading…') : (selected?.label ?? placeholder)}
          onFocus={openList}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!open) return openList()
              setActive((i) => Math.min(i + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              if (!open) return
              e.preventDefault()
              const hit = filtered[active]
              if (hit) choose(hit)
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation()
              setOpen(false)
            } else if (e.key === 'Tab') {
              setOpen(false)
            }
          }}
          className={clsx(
            'h-11 w-full rounded-control border bg-white pl-3 pr-9 text-sm text-gray-900 shadow-xs lg:h-10',
            'transition-shadow placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-brand-100',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            !open && selected && 'placeholder:text-gray-900',
            error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-400',
          )}
        />
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      </div>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[min(40vh,18rem)] overflow-y-auto rounded-control border border-gray-200 bg-white py-1 shadow-pop"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-gray-500">{t('Đang tải…', 'Loading…')}</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{t('Không tìm thấy', 'No matches')}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${inputId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                className={clsx(
                  'cursor-pointer px-3 py-2 text-sm',
                  i === active ? 'bg-brand-50 text-brand-800' : 'text-gray-800',
                  o.value === value && 'font-medium',
                )}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
