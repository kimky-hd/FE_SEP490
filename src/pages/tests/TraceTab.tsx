import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type SVGProps,
} from 'react'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { IconTile, type IconTileTone } from '@/components/ui/IconTile'
import {
  AiSparkleIcon,
  ChevronDownIcon,
  EyeIcon,
  FileTextIcon,
  LinkIcon,
  MoreIcon,
  TableIcon,
} from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import type { TestAbilities } from '@/lib/testplan/abilities'
import {
  TRACE_STATUSES,
  type TestCaseDto,
  type TestEnvironmentDto,
  type TestPlanDto,
  type TraceRowDto,
  type TraceStatus,
} from '@/types/testing'
import type { ReqOption } from '../kanban/reqLinks'
import { AiSmartTestGeneratorModal } from './AiSmartTestGeneratorModal'
import { AiLayoutProposalDrawer } from '@/components/document/AiLayoutProposalDrawer'
import { DocPreviewDrawer } from './DocPreviewDrawer'
import { ReqLinkModal } from './dialogs'
import { AiMark, Panel, StatusPill, TracePill, traceLabel } from './testUi'

// Tab "Đối chiếu REQ": mỗi REQ một dòng (gom theo tài liệu), một tình trạng duy nhất ở môi trường đang xem, chip lọc
// theo tình trạng, số testcase, menu Thao tác (Xem testcase · Mở trong tài liệu · Sửa testcase gắn với REQ · Sinh testcase
// bằng AI · Mở các case này trong bảng). Tick nhiều REQ → sinh AI hàng loạt. Đây là lối vào DUY NHẤT của AI sinh testcase.

type Action = 'view' | 'doc' | 'link' | 'ai' | 'grid' | 'layout'

interface MenuItem {
  key: Action
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: IconTileTone
}

const rowGrid =
  'grid grid-cols-[22px_22px_minmax(84px,110px)_minmax(0,1fr)_140px_minmax(120px,200px)_44px] items-center gap-2'

function RowMenu({ label, items, onPick }: { label: string; items: MenuItem[]; onPick: (a: Action) => void }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  const onKey = (e: ReactKeyboardEvent) => {
    const list = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      btn.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(i + 1) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(i - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Tab') setOpen(false)
  }
  if (!items.length) return <span className="text-gray-400">—</span>
  return (
    <span className="relative inline-block">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'inline-flex h-7 w-8 items-center justify-center rounded-[6px] border border-gray-300 bg-white text-gray-600 shadow-xs hover:bg-gray-100',
          open && 'bg-gray-100 text-gray-900',
        )}
      >
        <MoreIcon width={16} height={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={label}
          onKeyDown={onKey}
          className="absolute right-0 top-[calc(100%+4px)] z-30 flex min-w-[250px] flex-col rounded-control border border-gray-200 bg-white p-1 shadow-pop"
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                onPick(it.key)
              }}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-[6px] px-2 py-1.5 text-left text-[13px] text-gray-800 hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
            >
              <IconTile icon={it.icon} tone={it.tone} />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

export function TraceTab({
  projectId,
  plan,
  env,
  cases,
  abilities,
  reqs: _reqs,
  initialFilter,
  initialDoc,
  patchCases,
  reloadPlan,
  notify,
  onGoto,
  onOpenInSheet,
}: {
  projectId: number
  plan: TestPlanDto
  env: TestEnvironmentDto
  cases: TestCaseDto[]
  abilities: TestAbilities
  reqs: { list: ReqOption[]; map: Map<string, ReqOption> }
  initialFilter: TraceStatus | null
  initialDoc: number | null
  patchCases: (list: TestCaseDto[]) => void
  reloadPlan: () => Promise<void>
  notify: (text: string, tone?: 'ok' | 'error') => void
  onGoto: (tc: TestCaseDto) => void
  onOpenInSheet: (moduleId: number, ids: number[]) => void
}) {
  const { t } = useI18n()
  const [rows, setRows] = useState<TraceRowDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState<TraceStatus | ''>(initialFilter ?? '')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<string[]>([])
  const [docRef, setDocRef] = useState<{ documentId: number; reqUid: string } | null>(null)
  const [linkFor, setLinkFor] = useState<TraceRowDto | null>(null)
  const [aiFor, setAiFor] = useState<TraceRowDto[] | null>(null)
  const [layoutFor, setLayoutFor] = useState<TraceRowDto | null>(null)
  const docRefs = useRef(new Map<number, HTMLElement>())

  useEffect(() => {
    let alive = true
    setError(null)
    testApi
      .traceability(plan.planId, env.envId)
      .then((x) => alive && setRows(x))
      .catch((err) => alive && setError(apiErrorMessage(err)))
    return () => {
      alive = false
    }
    // Không tải lại theo từng ô sửa ở bảng (tab này mở lại là tải mới); thao tác trong tab tự tăng `tick`.
  }, [plan.planId, env.envId, tick])

  // Link từ "Việc của tôi" (?doc=…) → cuộn tới tài liệu đó.
  useEffect(() => {
    if (!rows || !initialDoc) return
    docRefs.current.get(initialDoc)?.scrollIntoView?.({ block: 'start' })
  }, [rows, initialDoc])

  const keyOf = (r: TraceRowDto) => `${r.documentId}:${r.reqUid}`
  const counts = useMemo(() => {
    const c: Record<TraceStatus, number> = { PASSED: 0, FAILING: 0, IN_PROGRESS: 0, NO_TESTS: 0 }
    for (const r of rows ?? []) c[r.status]++
    return c
  }, [rows])
  const shown = (rows ?? []).filter((r) => !filter || r.status === filter)
  const groups = useMemo(() => {
    const m = new Map<number, TraceRowDto[]>()
    for (const r of shown) m.set(r.documentId, [...(m.get(r.documentId) ?? []), r])
    return [...m.entries()]
  }, [shown])
  const caseOf = (id: number) => cases.find((c) => c.testCaseId === id)
  const modOf = (id: number) => plan.modules.find((m) => m.moduleId === id)

  const act = (a: Action, r: TraceRowDto) => {
    if (a === 'view') setOpen((s) => new Set(s).add(keyOf(r)))
    else if (a === 'doc') setDocRef({ documentId: r.documentId, reqUid: r.reqUid })
    else if (a === 'link') setLinkFor(r)
    else if (a === 'layout') setLayoutFor(r)
    else if (a === 'ai') setAiFor([r])
    else if (a === 'grid') {
      const first = r.cases[0]
      if (!first) return
      const ids = r.cases.filter((c) => c.moduleId === first.moduleId).map((c) => c.testCaseId)
      notify(
        t(`Đã chọn ${ids.length} testcase gắn ${r.reqKey}`, `Selected ${ids.length} test cases linked to ${r.reqKey}`),
      )
      onOpenInSheet(first.moduleId, ids)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
      <Panel
        icon={LinkIcon}
        title={t('Đối chiếu REQ', 'REQ trace')}
        hint={t(`Kết quả test theo REQ ở ${env.name}`, `Results per REQ on ${env.name}`)}
      >
        <div className="px-4 py-3">
          <div
            role="group"
            aria-label={t('Lọc theo tình trạng', 'Filter by status')}
            className="mb-3 flex flex-wrap gap-2"
          >
            <button
              type="button"
              aria-pressed={!filter}
              onClick={() => setFilter('')}
              className={clsx(
                'rounded-full border bg-white px-3 py-1 text-[13px]',
                !filter
                  ? 'border-brand-500 text-gray-950 ring-4 ring-brand-100'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50',
              )}
            >
              {t('Tất cả', 'All')} <b className="ml-1">{rows?.length ?? 0}</b>
            </button>
            {TRACE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
                className={clsx(
                  'rounded-full border bg-white px-3 py-1 text-[13px]',
                  filter === s
                    ? 'border-brand-500 text-gray-950 ring-4 ring-brand-100'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                )}
              >
                <b className="mr-1">{counts[s]}</b>
                {traceLabel(s, t)}
              </button>
            ))}
          </div>

          {picked.length > 0 && abilities.ai && (
            <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-control border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">
              {t('Đã chọn', 'Selected')} <b>{picked.length}</b> REQ
              <span className="flex-1" />
              <Button inline onClick={() => setAiFor((rows ?? []).filter((r) => picked.includes(keyOf(r))))}>
                <AiSparkleIcon width={16} height={16} aria-hidden="true" />
                {t(`Sinh testcase bằng AI cho ${picked.length} REQ`, `Generate with AI for ${picked.length} REQs`)}
              </Button>
              <Button inline variant="secondary" onClick={() => setPicked([])}>
                {t('Bỏ chọn', 'Clear')}
              </Button>
            </div>
          )}

          {error ? (
            <ErrorState message={error} onRetry={() => setTick((n) => n + 1)} />
          ) : !rows ? (
            <LoadingBlock />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div
                  className={clsx(
                    rowGrid,
                    'border-b border-gray-200 px-1 py-1.5 text-[12px] font-medium text-gray-500',
                  )}
                >
                  <span />
                  <span />
                  <span>REQ</span>
                  <span>{t('Nội dung', 'Requirement')}</span>
                  <span>{t('Tình trạng', 'Status')}</span>
                  <span>Testcase</span>
                  <span />
                </div>
                {groups.map(([documentId, list]) => (
                  <div
                    key={documentId}
                    ref={(el) => {
                      if (el) docRefs.current.set(documentId, el)
                    }}
                    className="mb-3"
                  >
                    <h4 className="mt-2.5 flex items-center gap-2 text-[13px] font-medium text-gray-500">
                      <IconTile icon={FileTextIcon} />
                      {list[0].documentCode} · {list[0].documentTitle}
                    </h4>
                    {list.map((r) => {
                      const k = keyOf(r)
                      const isOpen = open.has(k)
                      const n = (s: string) => r.cases.filter((c) => c.status === s).length
                      const items: MenuItem[] = [
                        {
                          key: 'view' as const,
                          icon: EyeIcon,
                          label: t(`Xem testcase (${r.cases.length})`, `View test cases (${r.cases.length})`),
                          on: r.cases.length > 0,
                        },
                        {
                          key: 'doc' as const,
                          icon: FileTextIcon,
                          label: t('Mở trong tài liệu', 'Open in document'),
                          on: abilities.docView,
                        },
                        {
                          key: 'link' as const,
                          icon: LinkIcon,
                          label: t('Sửa testcase gắn với REQ', 'Edit linked test cases'),
                          on: abilities.manage,
                        },
                        {
                          key: 'layout' as const,
                          icon: AiSparkleIcon,
                          tone: 'ai' as const,
                          label: t('Đề xuất Giao diện mẫu (AI Layout)', 'AI Layout Proposal'),
                          on: true,
                        },
                        {
                          key: 'ai' as const,
                          icon: AiSparkleIcon,
                          tone: 'ai' as const,
                          label: t('Sinh testcase bằng AI', 'Generate test cases with AI'),
                          on: abilities.ai,
                        },
                        {
                          key: 'grid' as const,
                          icon: TableIcon,
                          label: t('Mở các case này trong bảng', 'Open these cases in the sheet'),
                          on: r.cases.length > 0,
                        },
                      ].filter((x) => x.on)
                      return (
                        <div key={k} className="border-t border-gray-100">
                          <div className={clsx(rowGrid, 'px-1 py-2 text-[13.5px] hover:bg-gray-25')}>
                            {abilities.ai ? (
                              <input
                                type="checkbox"
                                aria-label={t(`Chọn ${r.reqKey}`, `Select ${r.reqKey}`)}
                                checked={picked.includes(k)}
                                onChange={(e) =>
                                  setPicked((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))
                                }
                              />
                            ) : (
                              <span />
                            )}
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-label={t(`Xem testcase của ${r.reqKey}`, `Show test cases of ${r.reqKey}`)}
                              disabled={!r.cases.length}
                              onClick={() =>
                                setOpen((s) => {
                                  const nx = new Set(s)
                                  if (nx.has(k)) nx.delete(k)
                                  else nx.add(k)
                                  return nx
                                })
                              }
                              className="inline-flex h-[22px] w-[22px] items-center justify-center text-gray-400 disabled:invisible"
                            >
                              <ChevronDownIcon
                                width={14}
                                height={14}
                                aria-hidden="true"
                                className={clsx('transition-transform', !isOpen && '-rotate-90')}
                              />
                            </button>
                            <span>
                              {abilities.docView ? (
                                <button
                                  type="button"
                                  onClick={() => setDocRef({ documentId: r.documentId, reqUid: r.reqUid })}
                                  title={t('Mở trong tài liệu', 'Open in the document')}
                                  className={clsx(
                                    'rounded-[5px] px-1.5 font-mono text-[11.5px] font-medium hover:underline',
                                    r.changed ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-700',
                                  )}
                                >
                                  {r.reqKey}
                                </button>
                              ) : (
                                <span className="rounded-[5px] bg-brand-50 px-1.5 font-mono text-[11.5px] font-medium text-brand-700">
                                  {r.reqKey}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0">
                              {r.title}
                              {r.changed && (
                                <span className="text-[12px] text-amber-800"> · {t('REQ vừa đổi', 'REQ changed')}</span>
                              )}
                            </span>
                            <span>
                              <TracePill status={r.status} />
                            </span>
                            <span className="text-[13px] text-gray-500">
                              {r.cases.length ? (
                                <>
                                  {t(
                                    `${r.cases.length} TC · ${n('PASS')} Pass`,
                                    `${r.cases.length} TC · ${n('PASS')} pass`,
                                  )}
                                  {n('FAIL') > 0 && <span className="text-red-700"> · {n('FAIL')} Fail</span>}
                                  {r.bugs.length > 0 && ` · ${r.bugs.map((b) => b.key).join(', ')}`}
                                </>
                              ) : (
                                '—'
                              )}
                            </span>
                            <span>
                              <RowMenu
                                label={t(`Thao tác cho ${r.reqKey}`, `Actions for ${r.reqKey}`)}
                                items={items}
                                onPick={(a) => act(a, r)}
                              />
                            </span>
                          </div>
                          {isOpen && r.cases.length > 0 && (
                            <div className="pb-2.5 pl-8 pr-1">
                              <table className="w-full border-collapse text-[13px]">
                                <tbody>
                                  {r.cases.map((c) => {
                                    const tc = caseOf(c.testCaseId)
                                    return (
                                      <tr key={c.testCaseId}>
                                        <td className="w-32 border-t border-gray-100 px-2 py-1.5">
                                          <button
                                            type="button"
                                            onClick={() => tc && onGoto(tc)}
                                            className="inline-flex items-center gap-1 rounded-[5px] bg-gray-100 px-1.5 font-mono text-[11.5px] text-gray-600 hover:underline"
                                          >
                                            {c.ai && <AiMark />}
                                            {modOf(c.moduleId)?.shortCode}·{c.code}
                                          </button>
                                        </td>
                                        <td className="border-t border-gray-100 px-2 py-1.5">{c.title}</td>
                                        <td className="w-36 border-t border-gray-100 px-2 py-1.5">
                                          <StatusPill status={c.status} />
                                        </td>
                                        <td className="w-40 border-t border-gray-100 px-2 py-1.5 text-gray-500">
                                          {modOf(c.moduleId)?.name}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {!groups.length && (
                  <p className="py-3 text-[13px] text-gray-500">
                    {t('Không có REQ nào ở tình trạng này.', 'No REQs in this state.')}
                  </p>
                )}
              </div>
            </div>
          )}
          <p className="mt-2.5 text-[12.5px] text-gray-500">
            <AiMark /> = {t('REQ do AI gắn, chưa kiểm tra', 'AI-linked REQ, not reviewed')}
          </p>
        </div>
      </Panel>

      {docRef && (
        <DocPreviewDrawer
          projectId={projectId}
          plan={plan}
          envId={env.envId}
          documentId={docRef.documentId}
          reqUid={docRef.reqUid}
          cases={cases}
          onGoto={(tc) => {
            setDocRef(null)
            onGoto(tc)
          }}
          notify={notify}
          onClose={() => setDocRef(null)}
        />
      )}
      {linkFor && (
        <ReqLinkModal
          req={linkFor}
          modules={plan.modules}
          cases={cases}
          onClose={() => setLinkFor(null)}
          onSave={async (items) => {
            try {
              if (items.length) patchCases(await testApi.bulkUpdate(plan.planId, { items }))
              setTick((n) => n + 1)
              const add = items.filter((i) =>
                i.changes.requirementRefs?.some((x) => x.reqUid === linkFor.reqUid),
              ).length
              notify(
                t(
                  `${linkFor.reqKey}: gắn thêm ${add}, gỡ ${items.length - add} testcase`,
                  `${linkFor.reqKey}: linked ${add}, unlinked ${items.length - add}`,
                ),
              )
              setLinkFor(null)
            } catch (err) {
              notify(apiErrorMessage(err), 'error')
            }
          }}
        />
      )}
      {aiFor && (
        <AiSmartTestGeneratorModal
          open={!!aiFor}
          onClose={() => setAiFor(null)}
          reqCode={aiFor[0]?.reqKey || 'REQ-014.3'}
          reqTitle={aiFor[0]?.title || 'Xác thực OTP cho giao dịch thanh toán trên 5.000.000 VNĐ'}
          onSaveTestCases={async (createdOutputs) => {
            const targetReq = aiFor[0]
            if (!targetReq) return
            try {
              const mod =
                plan.modules.find((m) => m.documentId === targetReq.documentId) ?? plan.modules[0]
              const sec = mod?.sections[0]
              if (!sec) {
                notify(t('Không tìm thấy mục test để thêm testcase.', 'No test section found.'), 'error')
                return
              }
              const createdCases: TestCaseDto[] = []
              for (const item of createdOutputs) {
                const res = await testApi.create(projectId, {
                  sectionId: sec.sectionId,
                  title: item.title,
                  steps: item.steps.map((st) => ({ action: st, expected: item.expected })),
                  priority: item.type === 'Happy Path' ? 'HIGH' : 'MEDIUM',
                  category: item.type === 'UI Gap' ? 'Giao diện' : 'Chức năng',
                  requirementRefs: [{ documentId: targetReq.documentId, reqUid: targetReq.reqUid }],
                })
                createdCases.push(res)
              }
              patchCases(createdCases)
              setTick((n) => n + 1)
              await reloadPlan().catch((err) => notify(apiErrorMessage(err), 'error'))
              notify(
                t(
                  `Đã thêm ${createdCases.length} testcase thông minh (đối chiếu REQ + Wireframe + Figma).`,
                  `Added ${createdCases.length} smart test cases with REQ, Wireframe, and Figma.`,
                ),
              )
              setAiFor(null)
              setPicked([])
              const first = createdCases[0]
              if (first) {
                onOpenInSheet(
                  first.moduleId,
                  createdCases.filter((c) => c.moduleId === first.moduleId).map((c) => c.testCaseId),
                )
              }
            } catch (err) {
              notify(apiErrorMessage(err), 'error')
            }
          }}
        />
      )}
      {layoutFor && (
        <AiLayoutProposalDrawer
          open={!!layoutFor}
          onClose={() => setLayoutFor(null)}
          reqCode={layoutFor.reqKey}
          reqTitle={layoutFor.title}
          onAttachToReq={() => {
            notify(
              t(
                'Đã lưu và đính kèm Khung giao diện mẫu vào yêu cầu.',
                'Saved and attached AI layout to requirement.',
              ),
            )
            setLayoutFor(null)
          }}
        />
      )}
    </div>
  )
}
