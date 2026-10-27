import clsx from 'clsx'

interface SwitchProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  size = 'md',
  className,
}: SwitchProps) {
  const isSm = size === 'sm'

  return (
    <label
      className={clsx(
        'inline-flex items-center gap-2 select-none',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault()
          if (!disabled && onChange) {
            onChange(!checked)
          }
        }}
        className={clsx(
          'relative inline-flex flex-shrink-0 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          isSm ? 'h-5 w-9 rounded-full' : 'h-6 w-11 rounded-full',
          checked ? 'bg-emerald-500' : 'bg-gray-200',
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none inline-block transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            isSm
              ? clsx('h-3.5 w-3.5 mt-[3px] ml-[3px]', checked ? 'translate-x-4' : 'translate-x-0')
              : clsx('h-5 w-5 mt-[2px] ml-[2px]', checked ? 'translate-x-5' : 'translate-x-0'),
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
    </label>
  )
}
