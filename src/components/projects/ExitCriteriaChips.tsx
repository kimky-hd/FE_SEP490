import { useState, useRef, useEffect } from 'react'
import type { PhaseExitCriterionKey } from '@/types/project'
import { ALL_CRITERIA_KEYS, CRITERIA_METADATA } from '@/lib/phaseGateEngine'
import { CloseIcon, PlusIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import clsx from 'clsx'

interface Props {
  criteria?: PhaseExitCriterionKey[]
  editable?: boolean
  onChange?: (next: PhaseExitCriterionKey[]) => void
  className?: string
  showDescriptionTooltip?: boolean
}

export function ExitCriteriaChips({
  criteria = ['ISSUES_DONE'],
  editable = false,
  onChange,
  className,
}: Props) {
  const { lang, t } = useI18n()
  const isVi = lang === 'vi'
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const activeCriteria = criteria.length > 0 ? criteria : (['ISSUES_DONE'] as PhaseExitCriterionKey[])
  const remaining = ALL_CRITERIA_KEYS.filter((k) => !activeCriteria.includes(k))

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const removeCriterion = (key: PhaseExitCriterionKey) => {
    if (!editable || !onChange) return
    const next = activeCriteria.filter((c) => c !== key)
    onChange(next.length > 0 ? next : ['ISSUES_DONE'])
  }

  const addCriterion = (key: PhaseExitCriterionKey) => {
    if (!editable || !onChange) return
    onChange([...activeCriteria, key])
    setOpen(false)
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-1.5', className)}>
      {activeCriteria.map((key) => {
        const meta = CRITERIA_METADATA[key]
        if (!meta) return null
        const Icon = meta.Icon
        return (
          <span
            key={key}
            title={meta.description(isVi)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/90 py-0.5 pl-2 pr-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-100"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate max-w-[150px]">{meta.shortLabel(isVi)}</span>
            {editable && activeCriteria.length > 1 && (
              <button
                type="button"
                aria-label={t(`Gỡ tiêu chí ${meta.shortLabel(isVi)}`, `Remove ${meta.shortLabel(isVi)}`)}
                onClick={() => removeCriterion(key)}
                className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            )}
          </span>
        )
      })}

      {editable && remaining.length > 0 && (
        <div className="relative inline-block" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-brand-700 hover:border-brand-400 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <PlusIcon className="h-3 w-3" />
            <span>{t('Thêm cổng', 'Add Gate')}</span>
          </button>

          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-card border border-gray-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95">
              <div className="border-b border-gray-100 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {t('Thêm điều kiện nghiệm thu', 'Add Gate Rule')}
              </div>
              <div className="mt-1 space-y-0.5 max-h-60 overflow-y-auto">
                {remaining.map((remKey) => {
                  const remMeta = CRITERIA_METADATA[remKey]
                  const RemIcon = remMeta.Icon
                  return (
                    <button
                      key={remKey}
                      type="button"
                      onClick={() => addCriterion(remKey)}
                      className="flex w-full items-start gap-2.5 rounded-control p-2 text-left text-xs transition-colors hover:bg-brand-50 hover:text-brand-900 focus:bg-brand-50 focus:outline-none"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                        <RemIcon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900">{remMeta.label(isVi)}</div>
                        <div className="mt-0.5 text-[11px] leading-tight text-gray-500">
                          {remMeta.description(isVi)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
