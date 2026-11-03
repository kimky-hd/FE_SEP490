import clsx from 'clsx'
import { useI18n, type Lang } from '@/i18n'

const OPTIONS: { value: Lang; label: string; name: string }[] = [
  { value: 'vi', label: 'VI', name: 'Tiếng Việt' },
  { value: 'en', label: 'EN', name: 'English' },
]

// Nút chuyển ngôn ngữ dạng hai lựa chọn. `tone="dark"` cho nền tối (chân trang).
export function LanguageSwitch({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const { lang, setLang } = useI18n()
  return (
    <div
      role="group"
      aria-label="Ngôn ngữ / Language"
      className={clsx(
        'inline-flex shrink-0 rounded-control p-0.5 text-xs font-medium',
        tone === 'dark' ? 'bg-white/15' : 'border border-gray-200 bg-white',
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = lang === o.value
        return (
          <button
            key={o.value}
            type="button"
            lang={o.value}
            aria-pressed={active}
            aria-label={o.name}
            title={o.name}
            onClick={() => setLang(o.value)}
            className={clsx(
              'flex min-h-9 min-w-10 items-center justify-center rounded-[6px] px-2 transition-colors lg:min-h-6 lg:min-w-8',
              active
                ? tone === 'dark'
                  ? 'bg-white text-brand-900'
                  : 'bg-gray-100 text-gray-950'
                : tone === 'dark'
                  ? 'text-white/80 hover:text-white'
                  : 'text-gray-600 hover:text-gray-950',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
