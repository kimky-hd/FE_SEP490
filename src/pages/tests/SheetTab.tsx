import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import {
  allColumns,
  clampNumber,
  DEFAULT_HIDDEN,
  isBuiltin,
  moveColumn,
  visibleColumns,
  type ColumnDef,
} from '@/lib/testplan/columns'
import { groupsOf, topSections } from '@/lib/testplan/placement'
import { isTestResult, retestIn, statusIn } from '@/lib/testplan/status'
import { stepsToText, textToSteps } from '@/lib/testplan/steps'
import { AiSparkleIcon, CheckIcon, ColumnsIcon, LockIcon, MenuIcon, SlidersIcon } from '@/components/ui/icons'
import { IconTile } from '@/components/ui/IconTile'
import { PersonDot, readPref, writePref } from '../kanban/workUi'
import { IconButton, ShrinkIcon, SidebarIcon } from '../documents/docUi'
import { ModuleTree } from './ModuleTree'
import { AiSmartTestGeneratorModal, type GeneratedTestCaseOutput } from './AiSmartTestGeneratorModal'
import { AiLayoutProposalDrawer } from '@/components/document/AiLayoutProposalDrawer'
import type {
  CustomValue,
  DocSectionDto,
  SheetLayoutDto,
  TestCaseDto,
  TestEnvironmentDto,
  TestModuleDto,
  TestPlanDto,
  TestPriority,
  TestResult,
  TestSectionDto,
  UpdateTestCaseBody,
} from '@/types/testing'
import type { TestAbilities } from '@/lib/testplan/abilities'
import { cellValue, type CellValue } from './cells'
import { CaseHistoryDrawer } from './HistoryTab'
import { ColumnSettingsDrawer } from './ColumnSettingsDrawer'
import { DocPreviewDrawer } from './DocPreviewDrawer'
import { BugModal, ReqPickerModal, SectionModal } from './dialogs'
import { SheetGrid, type SheetFilter } from './SheetGrid'
import { Notice, smallBtn, statusLabel } from './testUi'
import type { ReqOption } from '../kanban/reqLinks'

// Tab "Bảng testcase": cây module bên trái (ModuleTree; màn hẹp: ô chọn module), thanh công cụ ("+ Thêm mục", lọc, Cột),
// thanh "đã chọn N", bảng, các hộp thoại của bảng. Sửa một ô của dòng đang chọn = áp dụng cho mọi dòng đã chọn.

export interface SheetTabProps {
  projectId: number
  plan: TestPlanDto
  cases: TestCaseDto[]
  env: TestEnvironmentDto
  abilities: TestAbilities
  meId: number | null
  reqs: { list: ReqOption[]; map: Map<string, ReqOption> }
  moduleId: number | null
  onModule: (id: number) => void
  filter: SheetFilter
  onFilter: (f: SheetFilter) => void
  focusCaseId: number | null
  /** Chọn sẵn các case (từ Đối chiếu REQ "Mở các case này trong bảng"). */
  preselect: number[] | null
  fullscreen: boolean
  onFullscreen: (v: boolean) => void
  projectName: string
  patchCases: (list: TestCaseDto[]) => void
  setPlan: (fn: (p: TestPlanDto) => TestPlanDto) => void
  notify: (text: string, tone?: 'ok' | 'error') => void
  onGoto: (tc: TestCaseDto) => void
  /** Ctrl K "Tạo testcase": thêm ngay một case vào nhóm đầu. */
  createRequest: number
  /** Đã xử lý createRequest / preselect — trang đặt lại để quay lại tab không lặp lại. */
  onCreateHandled: () => void
  onPreselectHandled: () => void
}

const hiddenKey = (planId: number) => `testHidden.${planId}`

export function SheetTab(p: SheetTabProps) {
  const { t } = useI18n()
  const { projectId, plan, cases, env, abilities, notify } = p
  const module: TestModuleDto | undefined = plan.modules.find((m) => m.moduleId === p.moduleId) ?? plan.modules[0]
  // Ô luôn hiện đủ nội dung (đã bỏ nút Thu gọn / Đầy đủ).
  const wrap = true
  const [hidden, setHiddenState] = useState<string[]>(
    () => readPref<string[]>(projectId, hiddenKey(plan.planId)) ?? DEFAULT_HIDDEN,
  )
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [colsOpen, setColsOpen] = useState(false)
  const [history, setHistory] = useState<TestCaseDto | null>(null)
  const [docRef, setDocRef] = useState<{ documentId: number; reqUid: string } | null>(null)
  const [reqFor, setReqFor] = useState<TestCaseDto[] | null>(null)
  /** `afterFail`: mở ngay sau khi ghi Fail (đóng hộp = "Fail chưa gắn bug"); false = mở từ nút "+ Bug". */
  const [bugFor, setBugForState] = useState<{ cases: TestCaseDto[]; afterFail: boolean } | null>(null)
  const setBugFor = (cases: TestCaseDto[] | null, afterFail = false) =>
    setBugForState(cases ? { cases, afterFail } : null)
  const [sectionFor, setSectionFor] = useState<{ parent: TestSectionDto | null } | null>(null)
  const [docSections, setDocSections] = useState<DocSectionDto[] | null>(null)
  const [editRequest, setEditRequest] = useState<{ id: number; n: number } | null>(null)
  const [treeOpen, setTreeOpenState] = useState<boolean>(() => readPref<boolean>(projectId, 'testTree') ?? true)
  /** Mục / nhóm chọn trên cây: tô sáng trên cây và cuộn bảng tới đó (n đổi mỗi lần bấm để bấm lại vẫn cuộn). */
  const [focusSection, setFocusSection] = useState<{ id: number; n: number } | null>(null)
  const [smartGenOpen, setSmartGenOpen] = useState(false)
  const [layoutDrawerOpen, setLayoutDrawerOpen] = useState(false)

  const handleSaveSmartCases = async (createdOutputs: GeneratedTestCaseOutput[]) => {
    try {
      const sec = module?.sections[0]
      if (!sec) {
        notify(t('Không tìm thấy mục test để thêm testcase.', 'No test section found.'), 'error')
        return
      }
      const createdList: TestCaseDto[] = []
      for (const item of createdOutputs) {
        const res = await testApi.create(projectId, {
          sectionId: sec.sectionId,
          title: item.title,
          steps: item.steps.map((st) => ({ action: st, expected: item.expected })),
          priority: item.type === 'Happy Path' ? 'HIGH' : 'MEDIUM',
          category: item.type === 'UI Gap' ? 'Giao diện' : 'Chức năng',
          requirementRefs: [{ documentId: module.documentId, reqUid: 'REQ-014.3' }],
        })
        createdList.push(res)
      }
      p.patchCases(createdList)
      notify(
        t(
          `Đã tạo và thêm ${createdList.length} testcase thông minh vào bảng tính!`,
          `Generated and added ${createdList.length} smart test cases to the sheet!`,
        ),
      )
      setSmartGenOpen(false)
      if (createdList[0]) p.onGoto(createdList[0])
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    }
  }
  const setTreeOpen = (v: boolean) => {
    setTreeOpenState(v)
    writePref(projectId, 'testTree', v)
  }

  const setHidden = (v: string[]) => {
    setHiddenState(v)
    writePref(projectId, hiddenKey(plan.planId), v)
  }

  // Đổi module / môi trường → bỏ chọn.
  useEffect(() => setSelected(new Set()), [module?.moduleId, env.envId])
  useEffect(() => {
    if (!focusSection) return
    const el = document.querySelector(`[data-section="${focusSection.id}"]`)
    el?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [focusSection])
  const openModule = (id: number) => {
    setFocusSection(null)
    p.onModule(id)
  }
  const openSection = (moduleId: number, sectionId: number) => {
    if (moduleId !== module?.moduleId) p.onModule(moduleId)
    const m = plan.modules.find((x) => x.moduleId === moduleId)
    const parent = m?.sections.find((x) => x.sectionId === sectionId)?.parentId ?? null
    // Mục đang thu gọn trên bảng thì mở ra để thấy được.
    setCollapsed((c) => {
      const n = new Set(c)
      n.delete(sectionId)
      if (parent !== null) n.delete(parent)
      return n
    })
    setFocusSection((f) => ({ id: sectionId, n: (f?.n ?? 0) + 1 }))
  }
  useEffect(() => {
    if (!p.preselect?.length) return
    setSelected(new Set(p.preselect))
    p.onPreselectHandled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.preselect])

  const all = useMemo(() => allColumns(plan.layout, t), [plan.layout, t])
  const columns = useMemo(() => visibleColumns(all, hidden), [all, hidden])

  const byId = (id: number) => cases.find((c) => c.testCaseId === id)
  /** Dòng đang thấy theo bộ lọc của module đang xem (sửa hàng loạt chỉ áp cho dòng đang thấy). */
  const shownByFilter = (c: TestCaseDto) =>
    c.moduleId === module?.moduleId &&
    c.status === 'ACTIVE' &&
    (p.filter === 'all' ||
      (p.filter === 'untest' ? statusIn(c, env.envId) === 'UNTEST' : statusIn(c, env.envId) === 'RETEST'))
  const targetsOf = (tc: TestCaseDto) =>
    selected.size > 1 && selected.has(tc.testCaseId)
      ? [...selected].map(byId).filter((c): c is TestCaseDto => !!c && shownByFilter(c))
      : [tc]

  const fail = (err: unknown) => notify(apiErrorMessage(err), 'error')

  // ---------- Bố cục cột (dùng chung cả đợt) ----------

  // Lưu bố cục tuần tự (lần lưu sau chờ lần trước), lần mới nhất thắng: lỗi thì chỉ quay về bố cục BE đã xác nhận
  // nếu không còn lần lưu nào mới hơn.
  const layoutQueue = useRef<Promise<unknown>>(Promise.resolve())
  const layoutSeq = useRef(0)
  const confirmedLayout = useRef(plan.layout)
  const saveLayout = (next: SheetLayoutDto): Promise<boolean> => {
    const n = ++layoutSeq.current
    p.setPlan((x) => ({ ...x, layout: next }))
    const run = layoutQueue.current.then(async () => {
      try {
        const saved = await testApi.saveLayout(plan.planId, next)
        confirmedLayout.current = saved
        if (n === layoutSeq.current) p.setPlan((x) => ({ ...x, layout: saved }))
        return true
      } catch (err) {
        if (n === layoutSeq.current) p.setPlan((x) => ({ ...x, layout: confirmedLayout.current }))
        fail(err)
        return false
      }
    })
    layoutQueue.current = run
    return run
  }
  const ids = all.map((c) => c.id)
  const onMoveColumn = async (from: string, to: string) => {
    const a = all.find((c) => c.id === from)
    const b = all.find((c) => c.id === to)
    if (await saveLayout({ ...plan.layout, order: moveColumn(ids, from, to) }))
      notify(t(`Đã chuyển cột "${a?.label}" lên trước "${b?.label}"`, `Moved "${a?.label}" before "${b?.label}"`))
  }
  const onResizeColumn = (id: string, w: number) =>
    void saveLayout({ ...plan.layout, widths: { ...plan.layout.widths, [id]: w } })
  const onRenameColumn = (id: string, v: string) => {
    const name = v.trim()
    const col = all.find((c) => c.id === id)
    if (!col || name === col.label) return
    if (isBuiltin(id)) {
      const labels = { ...plan.layout.labels }
      if (!name || name === col.defaultLabel) delete labels[id]
      else labels[id] = name
      void saveLayout({ ...plan.layout, labels })
    } else if (name)
      void saveLayout({
        ...plan.layout,
        customColumns: plan.layout.customColumns.map((c) => (c.columnId === id ? { ...c, label: name } : c)),
      })
  }

  // ---------- Ghi ô ----------

  const changesFor = (tc: TestCaseDto, col: ColumnDef, value: CellValue): UpdateTestCaseBody | null => {
    const text = typeof value === 'string' ? value : ''
    const cur = stepsToText(tc.steps)
    switch (col.id) {
      case 'title':
        if (!text.trim()) {
          notify(t('Tên testcase không được trống', 'Title is required'), 'error')
          return null
        }
        return { title: text }
      case 'preconditions':
        return { preconditions: text || null }
      case 'actual':
        return { actual: text || null }
      case 'steps':
        return { steps: textToSteps(text, cur.expected) }
      case 'expected':
        return { steps: textToSteps(cur.steps, text) }
      case 'priority':
        return text ? { priority: text as TestPriority } : null
      case 'category':
        return { category: text || null }
      case 'browser':
        return { browser: text || null }
    }
    if (!col.custom) return null
    let v: CustomValue = Array.isArray(value) ? value : value === null ? null : String(value)
    if (col.custom.kind === 'NUMBER' && typeof v === 'string') {
      const r = clampNumber(v, col.custom)
      if (r.clamped && r.value !== null)
        notify(
          t(
            `Giá trị phải trong khoảng ${col.custom.min ?? '…'}–${col.custom.max ?? '…'} → đã sửa thành ${r.value}`,
            `Value must be within ${col.custom.min ?? '…'}–${col.custom.max ?? '…'} → set to ${r.value}`,
          ),
        )
      v = r.value
    }
    return { customFields: { [col.id]: v === '' ? null : v } }
  }

  const recordResult = async (targets: TestCaseDto[], result: TestResult) => {
    try {
      const res =
        targets.length === 1
          ? await testApi.recordResult(targets[0].testCaseId, { envId: env.envId, result })
          : await testApi.recordResults(plan.planId, {
              envId: env.envId,
              testCaseIds: targets.map((c) => c.testCaseId),
              result,
            })
      p.patchCases(res.items)
      const behalf = res.items.filter((c) => {
        const last = c.results[c.results.length - 1]
        return last?.behalfOf
      }).length
      notify(
        `${targets.length > 1 ? t(`${targets.length} testcase`, `${targets.length} test cases`) : targets[0].code}: ${statusLabel(result)} ${t('trên', 'on')} ${env.name} ${env.currentBuild ?? ''}` +
          (behalf ? t(` · ghi thay ${behalf} case của người khác`, ` · ${behalf} on behalf of others`) : '') +
          (res.reopened.length
            ? t(
                ` · mở lại ${res.reopened.map((b) => b.key).join(', ')}`,
                ` · reopened ${res.reopened.map((b) => b.key).join(', ')}`,
              )
            : ''),
      )
      const need = res.needBug.map(byId).filter((c): c is TestCaseDto => !!c)
      if (need.length && (abilities.createBug || abilities.linkBug))
        setBugFor(
          need.map((c) => res.items.find((x) => x.testCaseId === c.testCaseId) ?? c),
          true,
        )
    } catch (err) {
      fail(err)
    }
  }

  const onCommit = async (tc: TestCaseDto, col: ColumnDef, value: CellValue) => {
    const targets = targetsOf(tc)
    if (col.kind === 'result') {
      if (isTestResult(value)) await recordResult(targets, value)
      return
    }
    // Một dòng, giá trị không đổi → không gọi API.
    if (targets.length === 1 && JSON.stringify(cellValue(tc, col, env.envId) ?? '') === JSON.stringify(value ?? ''))
      return
    const items = targets
      .map((c) => ({ testCaseId: c.testCaseId, changes: changesFor(c, col, value) }))
      .filter((x): x is { testCaseId: number; changes: UpdateTestCaseBody } => !!x.changes)
    if (!items.length) return
    try {
      const list =
        items.length === 1
          ? [await testApi.update(items[0].testCaseId, items[0].changes)]
          : await testApi.bulkUpdate(plan.planId, { items })
      p.patchCases(list)
      if (items.length > 1)
        notify(t(`Đã áp dụng cho ${items.length} testcase đã chọn`, `Applied to ${items.length} selected test cases`))
    } catch (err) {
      fail(err)
    }
  }

  const onToggleDelete = async (tc: TestCaseDto) => {
    const status = tc.status === 'DELETED' ? 'ACTIVE' : 'DELETED'
    try {
      p.patchCases([await testApi.update(tc.testCaseId, { status })])
      setSelected((s) => {
        const n = new Set(s)
        n.delete(tc.testCaseId)
        return n
      })
      notify(
        status === 'DELETED'
          ? t(`${tc.code}: Delete — không tính vào tổng`, `${tc.code}: deleted — not counted`)
          : t(`${tc.code}: đã khôi phục`, `${tc.code}: restored`),
      )
    } catch (err) {
      fail(err)
    }
  }

  const onAddCase = async (group: TestSectionDto) => {
    try {
      const tc = await testApi.create(projectId, {
        sectionId: group.sectionId,
        title: t('Testcase mới', 'New test case'),
        category: group.title,
      })
      p.patchCases([tc])
      setCollapsed((s) => {
        const n = new Set(s)
        n.delete(group.sectionId)
        if (group.parentId) n.delete(group.parentId)
        return n
      })
      setEditRequest({ id: tc.testCaseId, n: Date.now() })
    } catch (err) {
      fail(err)
    }
  }

  // Ctrl K "Tạo testcase" → thêm vào nhóm đầu của module đang xem.
  useEffect(() => {
    if (!p.createRequest) return
    p.onCreateHandled()
    if (!module || !abilities.manage) return
    const top = topSections(module)[0]
    const group = top ? (groupsOf(module, top.sectionId)[0] ?? top) : null
    if (group) void onAddCase(group)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.createRequest])

  const openSectionModal = (parent: TestSectionDto | null) => {
    if (!module) return
    setSectionFor({ parent })
    if (!parent) {
      setDocSections(null)
      testApi
        .documentSections(module.documentId)
        .then(setDocSections)
        .catch(() => setDocSections([]))
    }
  }

  const saveSection = async (body: { title: string; anchorId: string | null }) => {
    if (!module || !sectionFor) return
    try {
      const s = await testApi.addSection(module.moduleId, { ...body, parentId: sectionFor.parent?.sectionId ?? null })
      p.setPlan((x) => ({
        ...x,
        modules: x.modules.map((m) => (m.moduleId === module.moduleId ? { ...m, sections: [...m.sections, s] } : m)),
      }))
      setSectionFor(null)
      notify(t(`Đã thêm "${s.code} ${s.title}"`, `Added "${s.code} ${s.title}"`))
    } catch (err) {
      fail(err)
    }
  }

  if (!module)
    return (
      <div className="flex justify-center px-6 py-10">
        <Notice icon={SlidersIcon} tone="neutral" className="text-[13.5px] text-gray-500">
          {abilities.plan
            ? t('Chưa có module', 'No modules yet')
            : t('Đợt test chưa có module.', 'This plan has no modules yet.')}
        </Notice>
      </div>
    )

  const owner = plan.assignments.find((a) => a.moduleId === module.moduleId && a.envId === env.envId)?.assignee ?? null
  const handed = plan.status === 'HANDED_OVER'
  const caseIds = new Set(cases.filter((c) => c.moduleId === module.moduleId).map((c) => c.testCaseId))
  const selectedHere = [...selected].filter((id) => caseIds.has(id))
  const selectedHidden = selectedHere.filter((id) => {
    const c = byId(id)
    return !c || !shownByFilter(c)
  }).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toàn màn hình như Tài liệu: thanh mảnh 52px (ẩn / hiện cây, đường dẫn, thoát), cây module vẫn ở bên trái. */}
      {p.fullscreen && (
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-gray-200 px-3 text-sm sm:px-4">
          <IconButton
            label={treeOpen ? t('Ẩn cây module', 'Hide module tree') : t('Hiện cây module', 'Show module tree')}
            onClick={() => setTreeOpen(!treeOpen)}
            active={treeOpen}
            className="max-lg:hidden"
          >
            <MenuIcon className="h-4 w-4" />
          </IconButton>
          <p className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-gray-950">{p.projectName}</span>
            <span className="text-gray-500">
              {' '}
              / Test cases / {plan.name} · {env.name} · build{' '}
              <span className="font-mono text-[12px]">{env.currentBuild ?? '—'}</span>
            </span>
          </p>
          <IconButton
            label={t('Thoát toàn màn hình (Esc)', 'Exit full screen (Esc)')}
            onClick={() => p.onFullscreen(false)}
            className="border border-gray-200 text-gray-600"
          >
            <ShrinkIcon />
          </IconButton>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {treeOpen && (
          <ModuleTree
            projectId={projectId}
            plan={plan}
            cases={cases}
            envId={env.envId}
            moduleId={module.moduleId}
            sectionId={focusSection?.id ?? null}
            canPlan={abilities.plan}
            onModule={openModule}
            onSection={openSection}
            onHide={() => setTreeOpen(false)}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {handed && (
            <div className="mt-3 flex shrink-0 items-center gap-2 border-y border-success-200 bg-success-50 px-4 py-2 text-[13.5px] text-success-700 sm:px-6">
              <IconTile icon={CheckIcon} />
              {t('Đã bàn giao · chỉ xem', 'Handed over · read-only')}
            </div>
          )}

          {selectedHere.length > 0 && (
            <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2.5 border-y border-brand-200 bg-brand-50 px-4 py-2 text-[13px] text-brand-800 sm:px-6">
              <span>
                {t('Đã chọn', 'Selected')} <b>{selectedHere.length}</b>{' '}
                {t('testcase · sửa một ô là áp dụng cho tất cả.', 'test cases · editing one cell applies to all.')}
                {selectedHidden > 0 &&
                  t(
                    ` ${selectedHidden} dòng đang bị ẩn do bộ lọc sẽ không bị sửa.`,
                    ` ${selectedHidden} rows hidden by the filter are left unchanged.`,
                  )}
              </span>
              <span className="flex-1" />
              <button type="button" className={smallBtn} onClick={() => setSelected(new Set())}>
                {t('Bỏ chọn', 'Clear selection')}
              </button>
            </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2.5 sm:px-6">
            {!p.fullscreen && !treeOpen && (
              <button
                type="button"
                className={clsx(smallBtn, 'max-lg:hidden')}
                onClick={() => setTreeOpen(true)}
                title={t('Hiện cây module', 'Show module tree')}
              >
                <SidebarIcon width={16} height={16} aria-hidden="true" />
                Module
              </button>
            )}
            <select
              aria-label="Module"
              value={module.moduleId}
              onChange={(e) => openModule(Number(e.target.value))}
              className="h-8 max-w-[14rem] rounded-control border border-gray-300 bg-white px-2 text-[13px] font-medium shadow-xs lg:hidden"
            >
              {plan.modules.map((m) => (
                <option key={m.moduleId} value={m.moduleId}>
                  {m.documentCode} · {m.name}
                </option>
              ))}
            </select>
            <span className="mr-auto flex flex-wrap items-center gap-1.5 text-[13px] text-gray-600">
              {t('Tài liệu', 'Document')}
              <span className="rounded-[5px] bg-blue-50 px-1.5 text-[11.5px] font-medium text-blue-700">
                {module.documentCode}
              </span>
              · {t(`người test ${env.name}:`, `tester on ${env.name}:`)}
              {owner ? (
                <span className="inline-flex items-center gap-1">
                  <PersonDot user={owner} size={20} />
                  <b className="font-medium text-gray-800">{owner.fullName}</b>
                  {owner.userId === p.meId && <span>({t('bạn', 'you')})</span>}
                </span>
              ) : (
                <span className="font-medium text-amber-800">{t('chưa giao', 'unassigned')}</span>
              )}
              {!abilities.manage && !abilities.execute && !handed && (
                <span className="inline-flex items-center gap-1.5 text-gray-500">
                  <IconTile icon={LockIcon} tone="neutral" />
                  {t('Chỉ xem (vai trò không có quyền sửa / ghi kết quả)', 'Read-only (no edit / execute permission)')}
                </span>
              )}
            </span>
            {abilities.manage && (
              <button
                type="button"
                className={smallBtn}
                onClick={() => openSectionModal(null)}
                title={t(`Thêm mục vào ${module.name}`, `Add a section to ${module.name}`)}
              >
                {t('+ Thêm mục', '+ Add section')}
              </button>
            )}
            <select
              aria-label={t('Lọc testcase', 'Filter test cases')}
              value={p.filter}
              onChange={(e) => p.onFilter(e.target.value as SheetFilter)}
              className="h-8 rounded-control border border-gray-300 bg-white px-2 text-[13px] shadow-xs lg:h-[30px]"
            >
              <option value="all">{t('Tất cả case', 'All cases')}</option>
              <option value="untest">{t('Chưa test', 'Not tested')}</option>
              <option value="retest">{t('Cần test lại', 'To retest')}</option>
            </select>
            <button type="button" className={smallBtn} onClick={() => setColsOpen(true)}>
              <ColumnsIcon width={16} height={16} aria-hidden="true" />
              {t('Cột', 'Columns')}
              {hidden.length > 0 && (
                <span className="text-gray-500">· {t(`ẩn ${hidden.length}`, `${hidden.length} hidden`)}</span>
              )}
            </button>
            {abilities.ai && (
              <button
                type="button"
                className={clsx(smallBtn, 'text-blue-700 bg-blue-50/70 border-blue-200 hover:bg-blue-100')}
                onClick={() => setSmartGenOpen(true)}
                title={t('Sinh kịch bản kiểm thử thông minh (3 nguồn: REQ + Wireframe + Figma)', 'AI Smart Test Generator')}
              >
                <AiSparkleIcon width={16} height={16} aria-hidden="true" className="text-blue-600" />
                {t('Sinh testcase AI', 'AI Generate')}
              </button>
            )}
            <button
              type="button"
              className={clsx(smallBtn, 'text-gray-700 hover:bg-gray-50')}
              onClick={() => setLayoutDrawerOpen(true)}
              title={t('Xem đề xuất khung giao diện mẫu do AI phác thảo (Wireframe & Canonical JSON)', 'AI Layout Proposal')}
            >
              <AiSparkleIcon width={16} height={16} aria-hidden="true" className="text-gray-500" />
              {t('Giao diện mẫu', 'AI Layout')}
            </button>
          </div>

          <SheetGrid
            plan={plan}
            module={module}
            envId={env.envId}
            cases={cases}
            columns={columns}
            abilities={abilities}
            filter={p.filter}
            wrap={wrap}
            collapsed={collapsed}
            onToggleCollapse={(id) =>
              setCollapsed((s) => {
                const n = new Set(s)
                if (n.has(id)) n.delete(id)
                else n.add(id)
                return n
              })
            }
            selected={selected}
            onSelect={(list, on) =>
              setSelected((s) => {
                const n = new Set(s)
                for (const id of list) {
                  if (on) n.add(id)
                  else n.delete(id)
                }
                return n
              })
            }
            focusCaseId={p.focusCaseId}
            editRequest={editRequest}
            display={{
              plan,
              envId: env.envId,
              projectId,
              docView: abilities.docView,
              canEditReq: abilities.manage,
              canBug: abilities.execute,
              reqTitle: (d, u) => p.reqs.map.get(`${d}:${u}`)?.title ?? null,
              onReqClick: (r) => setDocRef(r),
            }}
            onCommit={(tc, col, v) => void onCommit(tc, col, v)}
            onOpenReqPicker={(tc) => setReqFor(targetsOf(tc))}
            onOpenBug={(tc) => {
              const list = targetsOf(tc).filter((c) => !c.bug && statusIn(c, env.envId) === 'FAIL')
              setBugFor(list.length ? list : [tc])
            }}
            onHistory={setHistory}
            onToggleDelete={(tc) => void onToggleDelete(tc)}
            onAddCase={(g) => void onAddCase(g)}
            onAddGroup={(top) => openSectionModal(top)}
            onMoveColumn={(a, b) => void onMoveColumn(a, b)}
            onResizeColumn={onResizeColumn}
            onRenameColumn={onRenameColumn}
          />
        </div>
      </div>
      {colsOpen && (
        <ColumnSettingsDrawer
          layout={plan.layout}
          columns={all}
          hidden={hidden}
          canManage={abilities.manage}
          onHidden={setHidden}
          onSave={saveLayout}
          onClose={() => setColsOpen(false)}
        />
      )}
      {history && (
        <CaseHistoryDrawer
          plan={plan}
          tc={cases.find((c) => c.testCaseId === history.testCaseId) ?? history}
          onClose={() => setHistory(null)}
        />
      )}
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
            p.onGoto(tc)
          }}
          notify={notify}
          onClose={() => setDocRef(null)}
        />
      )}
      {reqFor && (
        <ReqPickerModal
          label={
            reqFor.length > 1
              ? t(`${reqFor.length} testcase đã chọn`, `${reqFor.length} selected`)
              : `${reqFor[0].code} · ${reqFor[0].title}`
          }
          cases={reqFor}
          allCases={cases}
          reqs={p.reqs.list}
          onClose={() => setReqFor(null)}
          onSave={async (items) => {
            try {
              const list =
                items.length === 1
                  ? [await testApi.update(items[0].testCaseId, items[0].changes)]
                  : await testApi.bulkUpdate(plan.planId, { items })
              p.patchCases(list)
              const confirmed = reqFor.filter((c) => c.aiSuggestedReqs).length
              notify(
                (items.length > 1
                  ? t(`Đã cập nhật REQ cho ${items.length} testcase`, `Updated REQs of ${items.length} test cases`)
                  : t('Đã cập nhật REQ', 'REQs updated')) +
                  (confirmed ? t(` · xác nhận ${confirmed} REQ do AI gắn`, ` · confirmed ${confirmed} AI-linked`) : ''),
              )
              setReqFor(null)
            } catch (err) {
              fail(err)
            }
          }}
        />
      )}
      {bugFor && (
        <BugModal
          projectId={projectId}
          cases={bugFor.cases}
          env={env}
          abilities={abilities}
          onClose={() => {
            if (bugFor.afterFail) notify(t('Đã ghi Fail, chưa gắn bug', 'Recorded Fail without a bug'))
            setBugFor(null)
          }}
          onCreate={async (body) => {
            try {
              const res = await testApi.createBug(plan.planId, {
                envId: env.envId,
                testCaseIds: bugFor.cases.map((c) => c.testCaseId),
                ...body,
              })
              p.patchCases(res.items)
              setBugFor(null)
              notify(t(`Đã tạo ${res.issue.key} trên Kanban cho Dev`, `Created ${res.issue.key} on Kanban`))
            } catch (err) {
              fail(err)
            }
          }}
          onLink={async (issueId) => {
            try {
              const list = await testApi.linkBug(plan.planId, issueId, {
                testCaseIds: bugFor.cases.map((c) => c.testCaseId),
              })
              p.patchCases(list)
              setBugFor(null)
              notify(
                t(
                  `Đã gắn ${list.length} testcase vào ${list[0]?.bug?.key ?? 'bug'}`,
                  `Linked ${list.length} test cases to ${list[0]?.bug?.key ?? 'the bug'}`,
                ),
              )
            } catch (err) {
              fail(err)
            }
          }}
        />
      )}
      {sectionFor && (
        <SectionModal
          module={module}
          parent={sectionFor.parent}
          docSections={sectionFor.parent ? [] : docSections}
          onSave={saveSection}
          onClose={() => setSectionFor(null)}
        />
      )}
      {smartGenOpen && (
        <AiSmartTestGeneratorModal
          open={smartGenOpen}
          onClose={() => setSmartGenOpen(false)}
          reqCode="REQ-014.3"
          reqTitle="Xác thực OTP cho giao dịch thanh toán trên 5.000.000 VNĐ"
          onSaveTestCases={handleSaveSmartCases}
        />
      )}
      {layoutDrawerOpen && (
        <AiLayoutProposalDrawer
          open={layoutDrawerOpen}
          onClose={() => setLayoutDrawerOpen(false)}
          reqCode="REQ-014.3"
          reqTitle="Xác thực OTP cho giao dịch thanh toán trên 5.000.000 VNĐ"
          onAttachToReq={() => {
            notify(
              t(
                'Đã lưu và đính kèm Khung giao diện mẫu vào yêu cầu.',
                'Saved and attached AI layout to requirement.',
              ),
            )
            setLayoutDrawerOpen(false)
          }}
        />
      )}
    </div>
  )
}

/** Case cần làm của tôi ở môi trường đang xem: chưa test / cần test lại (module được giao cho tôi). */
export function myPending(
  plan: TestPlanDto,
  cases: TestCaseDto[],
  envId: number,
  meId: number | null,
): { untest: number; retest: number } {
  if (!meId) return { untest: 0, retest: 0 }
  const mine = new Set(
    plan.assignments.filter((a) => a.envId === envId && a.assignee?.userId === meId).map((a) => a.moduleId),
  )
  const list = cases.filter((c) => c.status === 'ACTIVE' && mine.has(c.moduleId))
  return {
    untest: list.filter((c) => statusIn(c, envId) === 'UNTEST').length,
    retest: list.filter((c) => !!retestIn(c, envId)).length,
  }
}
