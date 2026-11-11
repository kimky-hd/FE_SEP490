import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { SearchInput } from '@/components/ui/listControls'
import { groupsOf, topSections } from '@/lib/testplan/placement'
import { statsIn } from '@/lib/testplan/status'
import type { TestCaseDto, TestModuleDto, TestPlanDto } from '@/types/testing'
import { ChevronRight, IconButton, PageIcon, SidebarIcon } from '../documents/docUi'
import { PersonDot } from '../kanban/workUi'

// Cây module bên trái tab "Bảng testcase" (thay hàng chip module), cùng kiểu cây tài liệu: mọi module của đợt,
// mở ra mục lớn → nhóm, kèm thanh % Pass và số case ở môi trường đang xem. Bấm module = xem module đó; bấm mục /
// nhóm = xem module chứa nó và cuộn tới đúng mục (onSection).

export interface ModuleTreeProps {
  projectId: number
  plan: TestPlanDto
  cases: TestCaseDto[]
  envId: number
  moduleId: number
  /** Mục / nhóm vừa chọn trên cây (để tô sáng); null = đang xem cả module. */
  sectionId: number | null
  canPlan: boolean
  onModule: (moduleId: number) => void
  onSection: (moduleId: number, sectionId: number) => void
  onHide: () => void
}

export function ModuleTree(p: ModuleTreeProps) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set([`m${p.moduleId}`]))
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  const live = p.cases.filter((c) => c.status === 'ACTIVE')
  const of = (m: TestModuleDto, sectionIds?: Set<number>) =>
    live.filter((c) => c.moduleId === m.moduleId && (!sectionIds || sectionIds.has(c.sectionId)))

  const needle = q.trim().toLocaleLowerCase('vi')
  const modules = [...p.plan.modules]
    .sort((a, b) => a.position - b.position)
    .filter((m) => !needle || `${m.documentCode} ${m.name}`.toLocaleLowerCase('vi').includes(needle))

  return (
    <aside
      aria-label={t('Cây module', 'Module tree')}
      className="w-[clamp(13rem,17vw,18rem)] shrink-0 border-r border-gray-200 bg-gray-50 max-lg:hidden"
    >
      {/* Trang Test cuộn cả trang: giữ cây dính ở mép trên khi cuộn bảng. */}
      <div className="sticky top-0 flex max-h-[100dvh] flex-col">
        <div className="flex shrink-0 items-center gap-1.5 p-2.5">
          <SearchInput
            className="min-w-0 flex-1"
            value={q}
            onChange={setQ}
            label={t('Tìm module', 'Search modules')}
            placeholder={t('Tìm module', 'Search modules')}
          />
          <IconButton label={t('Ẩn cây module', 'Hide module tree')} onClick={p.onHide}>
            <SidebarIcon />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <p className="flex px-2.5 pb-1 pt-1 text-[11.5px] font-medium text-gray-500">
            Module <span className="ml-auto">{p.plan.modules.length}</span>
          </p>
          <ul role="tree" aria-label="Module">
            {modules.map((m) => {
              const mKey = `m${m.moduleId}`
              const tops = topSections(m)
              const mine = of(m)
              const isOpen = open.has(mKey) || !!needle
              const who = p.plan.assignments.find((a) => a.moduleId === m.moduleId && a.envId === p.envId)?.assignee
              return (
                <li key={m.moduleId} role="treeitem" aria-expanded={tops.length ? isOpen : undefined}>
                  <Row
                    level={0}
                    active={m.moduleId === p.moduleId && p.sectionId === null}
                    dim={!mine.length}
                    hasChildren={tops.length > 0}
                    open={isOpen}
                    onToggle={() => toggle(mKey)}
                    onClick={() => {
                      p.onModule(m.moduleId)
                      setOpen((s) => new Set(s).add(mKey))
                    }}
                    title={`${m.documentCode} · ${m.name}`}
                    icon={<PageIcon className="h-4 w-4 shrink-0 text-gray-500" />}
                    code={m.documentCode}
                    label={m.name}
                    after={who ? <PersonDot user={who} size={18} /> : null}
                    stats={mine}
                    envId={p.envId}
                    empty={t('chưa có', 'empty')}
                  />
                  {isOpen && tops.length > 0 && (
                    <ul role="group">
                      {tops.map((top) => {
                        const sKey = `s${top.sectionId}`
                        const groups = groupsOf(m, top.sectionId)
                        const ids = new Set([top.sectionId, ...groups.map((g) => g.sectionId)])
                        const sOpen = open.has(sKey)
                        return (
                          <li key={top.sectionId} role="treeitem" aria-expanded={groups.length ? sOpen : undefined}>
                            <Row
                              level={1}
                              active={p.sectionId === top.sectionId}
                              hasChildren={groups.length > 0}
                              open={sOpen}
                              onToggle={() => toggle(sKey)}
                              onClick={() => {
                                p.onSection(m.moduleId, top.sectionId)
                                setOpen((s) => new Set(s).add(sKey))
                              }}
                              title={`${top.code} ${top.title}`}
                              label={`${top.code} ${top.title}`}
                              stats={of(m, ids)}
                              envId={p.envId}
                            />
                            {sOpen && groups.length > 0 && (
                              <ul role="group">
                                {groups.map((g) => (
                                  <li key={g.sectionId} role="treeitem">
                                    <Row
                                      level={2}
                                      active={p.sectionId === g.sectionId}
                                      onClick={() => p.onSection(m.moduleId, g.sectionId)}
                                      title={`${g.code} ${g.title}`}
                                      code={g.code}
                                      label={g.title}
                                      stats={of(m, new Set([g.sectionId]))}
                                      envId={p.envId}
                                    />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          {!modules.length && (
            <p className="px-2.5 py-2 text-[13px] text-gray-500">
              {t('Không có module khớp.', 'No matching modules.')}
            </p>
          )}
          {p.canPlan && (
            <Link
              to={`/projects/${p.projectId}/tests/setup`}
              className="mt-1 flex min-h-8 items-center rounded-control px-2.5 text-[13px] font-medium text-brand-700 hover:bg-gray-100"
            >
              {t('+ Thêm module từ tài liệu', '+ Add a module from a document')}
            </Link>
          )}
        </div>
      </div>
    </aside>
  )
}

function Row({
  level,
  active,
  dim,
  hasChildren,
  open,
  onToggle,
  onClick,
  title,
  icon,
  code,
  label,
  after,
  stats,
  envId,
  empty,
}: {
  level: 0 | 1 | 2
  active: boolean
  dim?: boolean
  hasChildren?: boolean
  open?: boolean
  onToggle?: () => void
  onClick: () => void
  title: string
  icon?: React.ReactNode
  code?: string
  label: string
  after?: React.ReactNode
  stats: TestCaseDto[]
  envId: number
  empty?: string
}) {
  const { t } = useI18n()
  const st = statsIn(stats, envId)
  return (
    <div
      className={clsx(
        'group flex min-h-8 items-center gap-1 rounded-control pr-2 text-[13.5px] transition-colors',
        active ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-200' : 'text-gray-700 hover:bg-gray-100',
        dim && !active && 'text-gray-400',
      )}
      style={{ paddingLeft: 4 + level * 16 }}
    >
      {level < 2 ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? t('Thu gọn', 'Collapse') : t('Mở rộng', 'Expand')}
          className={clsx(
            'flex h-6 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-900',
            !hasChildren && 'invisible',
          )}
          tabIndex={hasChildren ? 0 : -1}
        >
          <ChevronRight className={clsx('h-3 w-3 transition-transform', open && 'rotate-90')} />
        </button>
      ) : (
        <span className="w-1 shrink-0" />
      )}
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-current={active ? 'true' : undefined}
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left',
          active && 'font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
        )}
      >
        {icon}
        {code && <span className="shrink-0 font-mono text-[11.5px] text-gray-500">{code}</span>}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {after}
      {st.total > 0 ? (
        <>
          <span
            className="h-1 w-7 shrink-0 overflow-hidden rounded-full bg-gray-200"
            title={t(`${st.PASS}/${st.total} Pass`, `${st.PASS}/${st.total} Pass`)}
            aria-hidden="true"
          >
            <span className="block h-full bg-success-600" style={{ width: `${st.pass * 100}%` }} />
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-gray-500">{st.total}</span>
        </>
      ) : (
        empty && <span className="shrink-0 text-[12px] text-gray-400">{empty}</span>
      )}
    </div>
  )
}
