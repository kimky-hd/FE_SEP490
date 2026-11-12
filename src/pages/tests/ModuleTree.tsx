import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { FolderIcon, PlusIcon } from '@/components/ui/icons'
import { SearchInput } from '@/components/ui/listControls'
import { Button } from '@/components/ui/Button'
import { groupsOf, topSections } from '@/lib/testplan/placement'
import type { TestCaseDto, TestPlanDto, TestSectionDto } from '@/types/testing'
import { ChevronRight, IconButton, SidebarIcon } from '../documents/docUi'
import { isTestCaseStale } from './testUi'

export interface ModuleTreeProps {
  projectId: number
  plan: TestPlanDto
  cases: TestCaseDto[]
  envId: number
  moduleId: number
  sectionId: number | null
  canPlan: boolean
  onModule: (moduleId: number) => void
  onSection: (moduleId: number, sectionId: number) => void
  onHide: () => void
  selectedSuiteId?: string | null
  onSelectSuite?: (suiteId: string | null, label: string) => void
  onCreateSuite?: () => void
  onAddChildSuite?: (parentSection: TestSectionDto) => void
}

export function ModuleTree(p: ModuleTreeProps) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set(['s_all']))

  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const needle = q.trim().toLocaleLowerCase('vi')
  const currentModule = p.plan.modules.find((m) => m.moduleId === p.moduleId) ?? p.plan.modules[0]

  // Gom mọi thư mục của đợt test vào MỘT cây (không bắt người dùng chọn "phân hệ" trước).
  // Chỉ khi đợt test có nhiều nguồn mới có thêm một cấp nhóm cha để phân biệt.
  const groups = useMemo(
    () =>
      p.plan.modules.map((mod) => {
        const suites = topSections(mod).map((top) => {
          const subgroups = groupsOf(mod, top.sectionId)
          const allSubIds = new Set([top.sectionId, ...subgroups.map((g) => g.sectionId)])
          const suiteCases = p.cases.filter(
            (c) => c.status === 'ACTIVE' && c.moduleId === mod.moduleId && allSubIds.has(c.sectionId),
          )
          return {
            section: top,
            id: `s_${top.sectionId}`,
            code: top.code,
            title: top.title,
            total: suiteCases.length,
            subgroups: subgroups.map((g) => {
              const sgCases = p.cases.filter(
                (c) => c.status === 'ACTIVE' && c.moduleId === mod.moduleId && c.sectionId === g.sectionId,
              )
              return {
                section: g,
                id: `s_${g.sectionId}`,
                code: g.code,
                title: g.title,
                count: sgCases.length,
                isStale: sgCases.some(isTestCaseStale),
              }
            }),
          }
        })
        return { mod, suites }
      }),
    [p.plan.modules, p.cases],
  )

  const filteredGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          suites: needle
            ? g.suites.filter(
                (s) =>
                  `${s.code} ${s.title}`.toLocaleLowerCase('vi').includes(needle) ||
                  s.subgroups.some((sg) => `${sg.code} ${sg.title}`.toLocaleLowerCase('vi').includes(needle)),
              )
            : g.suites,
        }))
        .filter((g) => g.suites.length > 0),
    [groups, needle],
  )
  const multi = p.plan.modules.length > 1

  const totalCasesCount = p.cases.filter((c) => c.status === 'ACTIVE').length

  return (
    <aside
      aria-label={t('Cây thư mục kiểm thử', 'Test suite tree')}
      className="flex w-[clamp(14rem,18vw,20rem)] shrink-0 flex-col border-r border-gray-200 bg-gray-50 h-full min-h-0 max-lg:hidden"
    >
      {/* Header đồng bộ thiết kế với cây tab Tài liệu (Search + Nút Thư mục mới + Nút Ẩn cây) */}
      <div className="flex shrink-0 items-center gap-1.5 p-2.5 border-b border-gray-200/70 bg-gray-50">
        <SearchInput
          className="min-w-0 flex-1 text-xs"
          value={q}
          onChange={setQ}
          label={t('Tìm thư mục...', 'Search test suites...')}
          placeholder={t('Tìm thư mục...', 'Search test suites...')}
        />
        {p.canPlan && p.onCreateSuite && (
          <Button
            inline
            variant="secondary"
            onClick={p.onCreateSuite}
            className="px-2 h-8 text-xs shrink-0"
            title={t('Tạo thư mục kiểm thử mới', 'New test suite')}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{t('Thư mục', 'Suite')}</span>
          </Button>
        )}
        <IconButton
          label={t('Ẩn cây kiểm thử', 'Hide test tree')}
          onClick={p.onHide}
          className="h-8 w-8 text-gray-500 hover:text-gray-900 shrink-0"
        >
          <SidebarIcon />
        </IconButton>
      </div>

      {/* Danh sách cây thư mục kiểm thử (cuộn mượt, tràn toàn chiều cao) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-xs">
        {/* Mục gốc: Tất cả kịch bản kiểm thử (đồng bộ kiểu dáng 'Tất cả tài liệu') */}
        <div
          onClick={() => {
            p.onSelectSuite?.(null, 'Tất cả kịch bản kiểm thử')
            if (currentModule?.sections[0]) {
              p.onSection(currentModule.moduleId, currentModule.sections[0].sectionId)
            }
          }}
          className={clsx(
            'mb-1.5 flex min-h-8 items-center justify-between rounded-control px-2.5 text-xs font-medium transition-colors cursor-pointer',
            p.selectedSuiteId === null || !p.selectedSuiteId
              ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-200 font-semibold'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <FolderIcon className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">{t('Tất cả kịch bản kiểm thử', 'All test cases')}</span>
          </div>
          <span className="rounded-full bg-gray-200/70 px-1.5 py-0.5 font-mono text-[10.5px] text-gray-600">
            {totalCasesCount}
          </span>
        </div>

        {/* Các nhánh thư mục */}
        {filteredGroups.map(({ mod, suites }) => (
        <div key={mod.moduleId} className="mt-1">
        {multi && (
          <p className="mb-0.5 mt-2 truncate px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500" title={`${mod.documentCode} · ${mod.name}`}>
            {mod.name}
          </p>
        )}
        <ul role="tree" aria-label="Test Suites" className="space-y-0.5">
          {suites.map((s) => {
            const isOpen = open.has(s.id) || !needle
            const isSelected = p.selectedSuiteId === s.id || p.sectionId === s.section.sectionId
            return (
              <li key={s.id} role="treeitem" aria-expanded={s.subgroups.length ? isOpen : undefined}>
                <div
                  className={clsx(
                    'group flex min-h-8 items-center justify-between rounded-control px-2 py-1 text-xs transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-white text-gray-950 font-semibold shadow-xs ring-1 ring-gray-200'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950',
                  )}
                  onClick={() => {
                    p.onSection(mod.moduleId, s.section.sectionId)
                    p.onSelectSuite?.(s.id, `${s.code} ${s.title}`)
                    if (s.subgroups.length) toggle(s.id)
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {s.subgroups.length > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggle(s.id)
                        }}
                        className="h-4 w-4 shrink-0 text-gray-400 hover:text-gray-700 flex items-center justify-center"
                      >
                        <ChevronRight className={clsx('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')} />
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <FolderIcon className="h-4 w-4 shrink-0 text-gray-500" />
                    <span className="truncate">{s.code} {s.title}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pl-1">
                    {/* Nút Thêm nhánh con (+) xuất hiện khi hover */}
                    {p.canPlan && p.onAddChildSuite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          p.onAddChildSuite?.(s.section)
                        }}
                        title={t(`Thêm nhánh con vào "${s.code} ${s.title}"`, `Add sub-suite to "${s.code} ${s.title}"`)}
                        className="opacity-0 group-hover:opacity-100 inline-flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-900 text-xs font-bold transition-opacity"
                      >
                        +
                      </button>
                    )}
                    <span className="font-mono text-[11px] text-gray-400 w-3 text-right">{s.total}</span>
                  </div>
                </div>

                {/* Subgroups (Nhánh con) */}
                {isOpen && s.subgroups.length > 0 && (
                  <ul className="ml-5 border-l border-gray-200 pl-1.5 my-0.5 space-y-0.5">
                    {s.subgroups.map((sg) => {
                      const isSgSelected = p.selectedSuiteId === sg.id || p.sectionId === sg.section.sectionId
                      return (
                        <li
                          key={sg.id}
                          onClick={() => {
                            p.onSection(mod.moduleId, sg.section.sectionId)
                            p.onSelectSuite?.(sg.id, `${s.code} ${s.title} > ${sg.code} ${sg.title}`)
                          }}
                          className={clsx(
                            'flex min-h-7 items-center justify-between rounded px-2 py-1 text-[11.5px] cursor-pointer transition-colors',
                            isSgSelected
                              ? 'bg-white text-gray-950 font-semibold shadow-xs ring-1 ring-gray-200'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
                          )}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <span className="text-gray-400 text-[10px]">└</span>
                            <span className="truncate">{sg.code} {sg.title}</span>
                            {sg.isStale && (
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                                title={t('Có yêu cầu gốc vừa thay đổi', 'Linked requirement changed')}
                              />
                            )}
                          </span>
                          <span className="font-mono text-[10.5px] text-gray-400 shrink-0">{sg.count}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        </div>
        ))}
      </div>

      {/* Nút hành động đáy cây thư mục */}
      {p.canPlan && p.onCreateSuite && (
        <div className="p-2 border-t border-gray-200/80 shrink-0">
          <button
            type="button"
            onClick={p.onCreateSuite}
            className="w-full flex items-center justify-center gap-1.5 rounded-control border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:bg-white hover:text-gray-950 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5 text-gray-500" />
            <span>{t('Tạo thư mục kiểm thử', 'New test suite')}</span>
          </button>
        </div>
      )}
    </aside>
  )
}
