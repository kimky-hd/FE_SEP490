import { Link } from 'react-router-dom'
import clsx from 'clsx'

export type ActiveModule = 'overview' | 'confluence' | 'jira' | 'testcases'

export function QuickModuleSwitcher({
  projectId,
  active,
  className,
}: {
  projectId: number | string
  active: ActiveModule
  className?: string
}) {
  const items = [
    { key: 'overview', icon: '📊', label: 'Overview', to: `/projects/${projectId}` },
    { key: 'confluence', icon: '📄', label: 'Confluence', to: `/projects/${projectId}/documents` },
    { key: 'jira', icon: '📋', label: 'Kanban', to: `/projects/${projectId}/issues` },
    { key: 'testcases', icon: '🧪', label: 'Test Cases', to: `/projects/${projectId}/testcases` },
  ] as const

  return (
    <nav
      aria-label="Quick module navigation"
      className={clsx(
        'hidden md:inline-flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-slate-100/90 p-0.5 text-xs font-semibold shadow-2xs shrink-0',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = active === item.key
        return (
          <Link
            key={item.key}
            to={item.to}
            title={`${item.label} (${item.key})`}
            className={clsx(
              'px-2 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap text-xs shrink-0',
              isActive
                ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60',
            )}
          >
            <span>{item.icon}</span>
            <span className="hidden 2xl:inline">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
