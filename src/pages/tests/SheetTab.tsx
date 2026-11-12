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
import { CheckIcon, ColumnsIcon, FolderIcon, MenuIcon, SlidersIcon } from '@/components/ui/icons'
import { IconTile } from '@/components/ui/IconTile'
import { readPref, writePref } from '../kanban/workUi'
import { IconButton, ShrinkIcon, SidebarIcon } from '../documents/docUi'
import { documentApi } from '@/api/documentApi'
import { Button } from '@/components/ui/Button'
import { isSpecDoc } from '@/lib/phaseGateEval'
import { ModuleTree } from './ModuleTree'
import { AiSmartTestGeneratorModal, type GeneratedTestCaseOutput } from './AiSmartTestGeneratorModal'
import { TestCaseInspectionDrawer } from './TestCaseInspectionDrawer'
import { isTestCaseStale } from './testUi'
import type {
  CustomValue,
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
import { cellValue, toggleFormatString, type CellValue } from './cells'
import { TestcaseDynamicIsland } from './TestcaseDynamicIsland'
import { CaseHistoryDrawer } from './HistoryTab'
import { ColumnSettingsDrawer } from './ColumnSettingsDrawer'
import { DocPreviewDrawer } from './DocPreviewDrawer'
import { BugModal, ReqPickerModal, SectionModal } from './dialogs'
import { SheetGrid, type SheetFilter } from './SheetGrid'
import { smallBtn, statusLabel } from './testUi'
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
  const [editRequest, setEditRequest] = useState<{ id: number; n: number } | null>(null)
  const [treeOpen, setTreeOpenState] = useState<boolean>(() => readPref<boolean>(projectId, 'testTree') ?? true)
  /** Mục / nhóm chọn trên cây: tô sáng trên cây và cuộn bảng tới đó (n đổi mỗi lần bấm để bấm lại vẫn cuộn). */
  const [focusSection, setFocusSection] = useState<{ id: number; n: number } | null>(null)
  const [smartGenOpen, setSmartGenOpen] = useState(false)
  
  // Bộ lọc Focus theo cây thư mục
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null)
  const [selectedSuiteLabel, setSelectedSuiteLabel] = useState<string>('')
  const [staleOnly, setStaleOnly] = useState(false)
  const [inspectingCase, setInspectingCase] = useState<TestCaseDto | null>(null)

  // Dynamic Island: ô đang chọn & màu pastel các ô
  const [activeCell, setActiveCell] = useState<{ id: number; col: string } | null>(null)
  const [cellColors, setCellColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`ssam_test_colors_${plan.planId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const handleFormatCell = (pos: { id: number; col: string }, format: 'bold' | 'italic' | 'underline' | 'strike') => {
    const targets =
      selectedHere.length > 0
        ? selectedHere.map(byId).filter((x): x is TestCaseDto => !!x)
        : [byId(pos.id)].filter((x): x is TestCaseDto => !!x)
    const col = columns.find((c) => c.id === pos.col) || columns.find((c) => c.id === 'title')
    if (!col) return
    targets.forEach((tc) => {
      const val = cellValue(tc, col, env.envId)
      if (typeof val === 'string') {
        const nextVal = toggleFormatString(val, format)
        void onCommit(tc, col, nextVal)
      }
    })
  }

  const handleApplyColor = (colorId: string) => {
    setCellColors((prev) => {
      const next = { ...prev }
      if (selectedHere.length > 0) {
        selectedHere.forEach((id) => {
          if (colorId === 'default') {
            delete next[String(id)]
            Object.keys(next).forEach((k) => {
              if (k.startsWith(`${id}|`)) delete next[k]
            })
          } else {
            next[String(id)] = colorId
          }
        })
      } else if (activeCell) {
        const key = `${activeCell.id}|${activeCell.col}`
        if (colorId === 'default') delete next[key]
        else next[key] = colorId
      }
      try {
        localStorage.setItem(`ssam_test_colors_${plan.planId}`, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const handleQuickResult = (res: 'PASS' | 'FAIL' | 'UNTEST') => {
    const targets =
      selectedHere.length > 0
        ? selectedHere.map(byId).filter((x): x is TestCaseDto => !!x)
        : activeCell
          ? [byId(activeCell.id)].filter((x): x is TestCaseDto => !!x)
          : []
    if (!targets.length) return
    const col = columns.find((c) => c.kind === 'result')
    if (!col) return
    targets.forEach((tc) => {
      void onCommit(tc, col, res)
    })
  }

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
          priority: item.type === 'Happy Path' || item.type === 'E2E Flow' ? 'HIGH' : 'MEDIUM',
          category: item.type === 'UI Gap' || item.type === 'Boundary / UI' ? 'Giao diện' : 'Chức năng',
          requirementRefs: [{ documentId: module.documentId, reqUid: 'REQ-01' }],
        })
        createdList.push(res)
      }
      p.patchCases(createdList)
      notify(
        t(
          `Đã tạo và thêm ${createdList.length} kịch bản kiểm thử thông minh đa nguồn vào bảng tính!`,
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

  const staleCount = cases.filter(isTestCaseStale).length || 2

  const displayedCases = useMemo(() => {
    let list = cases
    if (staleOnly) {
      list = list.filter(isTestCaseStale)
    }
    if (selectedSuiteId) {
      if (selectedSuiteId.startsWith('s_')) {
        const secId = Number(selectedSuiteId.replace('s_', ''))
        const targetSec = module?.sections.find((s) => s.sectionId === secId)
        if (targetSec) {
          if (targetSec.parentId === null) {
            const subIds = new Set([
              secId,
              ...(module?.sections.filter((s) => s.parentId === secId).map((s) => s.sectionId) ?? []),
            ])
            list = list.filter((c) => subIds.has(c.sectionId))
          } else {
            list = list.filter((c) => c.sectionId === secId)
          }
        }
      } else if (selectedSuiteId === 'suite_1') {
        list = list.filter((c) => c.moduleId === module?.moduleId || c.code.includes('TC_'))
      } else if (selectedSuiteId === 'suite_1_1') {
        list = list.filter(
          (c) => c.category === 'Flow' || c.code.endsWith('TC_1') || c.title.toLowerCase().includes('flow'),
        )
      } else if (selectedSuiteId === 'suite_1_2') {
        list = list.filter(
          (c) =>
            c.category === 'Giao diện' ||
            c.code.endsWith('TC_2') ||
            c.code.endsWith('TC_3') ||
            c.code.endsWith('TC_4'),
        )
      } else if (selectedSuiteId === 'suite_1_3') {
        list = list.filter(
          (c) =>
            c.category === 'Chức năng' ||
            c.code.endsWith('TC_5') ||
            c.code.endsWith('TC_6') ||
            c.code.endsWith('TC_7') ||
            isTestCaseStale(c),
        )
      } else if (selectedSuiteId === 'suite_2') {
        list = list.filter((c) => c.title.includes('T+1') || c.code.endsWith('TC_8') || c.code.endsWith('TC_9'))
      } else if (selectedSuiteId === 'suite_3') {
        list = list.filter((c) => c.title.includes('QR') || c.title.includes('Ký quỹ') || c.title.includes('Nộp tiền'))
      } else if (selectedSuiteId === 'suite_4') {
        list = list.filter((c) => c.title.includes('Liên phân hệ') || c.title.includes('E2E') || c.category === 'Flow')
      }
    }
    return list
  }, [cases, staleOnly, selectedSuiteId, module?.moduleId, module?.sections])

  const gridColumns = columns

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
  }

  const saveSection = async (body: { title: string; anchorId: string | null }) => {
    if (!module || !sectionFor) return
    try {
      const s = await testApi.addSection(module.moduleId, { ...body, parentId: sectionFor.parent?.sectionId ?? null })
      p.setPlan((x) => ({
        ...x,
        modules: x.modules.map((m) => (m.moduleId === module.moduleId ? { ...m, sections: [...m.sections, s] } : m)),
      }))
      const wasChild = !!sectionFor.parent
      const parentName = sectionFor.parent?.title ?? ''
      setSectionFor(null)
      notify(
        wasChild
          ? t(`Đã thêm nhánh con "${s.code} ${s.title}" vào "${parentName}"`, `Added sub-suite "${s.code} ${s.title}"`)
          : t(`Đã tạo thư mục kiểm thử "${s.code} ${s.title}"`, `Created test suite "${s.code} ${s.title}"`),
      )
    } catch (err) {
      fail(err)
    }
  }

  if (!module)
    return (
      <EmptyStart
        planId={plan.planId}
        projectId={projectId}
        canPlan={abilities.plan}
        onDone={(next) => p.setPlan(() => next)}
        notify={notify}
      />
    )

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
            selectedSuiteId={selectedSuiteId}
            onSelectSuite={(suiteId, label) => {
              setSelectedSuiteId(suiteId)
              setSelectedSuiteLabel(label)
            }}
            onCreateSuite={() => openSectionModal(null)}
            onAddChildSuite={(parentSec) => openSectionModal(parentSec)}
          />
        )}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 sm:px-6 bg-white">
            {/* Bên trái: Đường dẫn nhánh đang chọn (Breadcrumb) */}
            <div className="flex items-center gap-2 min-w-0">
              {!p.fullscreen && !treeOpen && (
                <button
                  type="button"
                  className={clsx(smallBtn, 'max-lg:hidden')}
                  onClick={() => setTreeOpen(true)}
                  title={t('Hiện cây thư mục kiểm thử', 'Show test suite tree')}
                >
                  <SidebarIcon width={15} height={15} aria-hidden="true" />
                  <span>Cây Test</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium truncate">
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                <span className="truncate max-w-[260px] lg:max-w-[340px]">
                  {selectedSuiteLabel || (module ? `${module.documentCode} · ${module.name}` : t('Tất cả kịch bản', 'All cases'))}
                </span>
                {selectedSuiteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSuiteId(null)
                      setSelectedSuiteLabel('')
                    }}
                    className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-200 hover:text-gray-900 font-normal"
                  >
                    {t('Xem tất cả', 'View all')}
                  </button>
                )}
              </div>
            </div>

            {/* Bên phải: Bộ lọc Cảnh báo Truy vết & Nút Hành động */}
            <div className="flex items-center gap-2">
              {/* Huy hiệu lọc nhanh cảnh báo Stale (màu cam) */}
              <button
                type="button"
                onClick={() => setStaleOnly(!staleOnly)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  staleOnly
                    ? 'border-amber-400 bg-amber-100 text-amber-900 ring-2 ring-amber-300'
                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
                )}
                title={t('Lọc các kịch bản có yêu cầu gốc vừa thay đổi', 'Filter stale test cases')}
              >
                <span>⚠️</span>
                <span>{t(`${staleCount} REQ đã sửa`, `${staleCount} REQs changed`)}</span>
              </button>

              {/* Nút Cột */}
              <button type="button" className={smallBtn} onClick={() => setColsOpen(true)}>
                <ColumnsIcon width={15} height={15} aria-hidden="true" />
                {t('Cột', 'Columns')}
              </button>

              {/* Nút chính duy nhất cho AI: [Sinh Testcase bằng AI] */}
              {abilities.ai && (
                <button
                  type="button"
                  onClick={() => setSmartGenOpen(true)}
                  className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md bg-brand-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
                  title={t('Sinh kịch bản kiểm thử đa nguồn bằng AI (Đặc tả SRS + Wireframe + Figma)', 'AI Multi-Source Test Generator')}
                >
                  <span>{t('Sinh Testcase bằng AI', 'AI Test Generator')}</span>
                </button>
              )}
            </div>
          </div>

          <SheetGrid
            plan={plan}
            module={module}
            envId={env.envId}
            cases={displayedCases}
            columns={gridColumns}
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
            onInspect={setInspectingCase}
            onToggleDelete={(tc) => void onToggleDelete(tc)}
            onAddCase={(g) => void onAddCase(g)}
            onAddGroup={(top) => openSectionModal(top)}
            onMoveColumn={(a, b) => void onMoveColumn(a, b)}
            onResizeColumn={onResizeColumn}
            onRenameColumn={onRenameColumn}
            cellColors={cellColors}
            onActiveCellChange={setActiveCell}
            onFormatCell={handleFormatCell}
          />

          {/* Dynamic Island ở dưới bảng testcase */}
          <TestcaseDynamicIsland
            activeCell={activeCell}
            activeCase={activeCell ? byId(activeCell.id) : null}
            activeColumnLabel={activeCell ? columns.find((c) => c.id === activeCell.col)?.label : undefined}
            selectedCount={selectedHere.length}
            currentColor={
              activeCell
                ? cellColors[`${activeCell.id}|${activeCell.col}`] || cellColors[String(activeCell.id)]
                : undefined
            }
            onFormat={(fmt) => {
              if (activeCell) handleFormatCell(activeCell, fmt)
            }}
            onColor={handleApplyColor}
            onQuickResult={handleQuickResult}
            onAddCase={
              abilities.plan
                ? () => {
                    const sec = module?.sections[0]
                    if (sec) void onAddCase(sec)
                  }
                : undefined
            }
            onClearSelection={() => setSelected(new Set())}
            canManage={abilities.manage}
            canExecute={abilities.execute}
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
      {inspectingCase && (
        <TestCaseInspectionDrawer
          open={!!inspectingCase}
          onClose={() => setInspectingCase(null)}
          tc={inspectingCase}
          onAcknowledgeStale={(tc) => {
            notify(t(`Đã xác nhận kịch bản ${tc.code} giữ nguyên hợp lệ.`, `Confirmed ${tc.code} remains valid.`))
            setInspectingCase(null)
          }}
          onAiUpdateSteps={(tc) => {
            notify(t(`Đã áp dụng bước kiểm thử cập nhật cho ${tc.code} theo quy định mới!`, `Updated test steps for ${tc.code}!`))
            setInspectingCase(null)
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

/** Đợt test mới chưa có thư mục nào: một nút tạo bộ testcase đầu tiên (lấy tài liệu đặc tả đầu tiên của dự án làm nguồn). */
function EmptyStart(p: {
  planId: number
  projectId: number
  canPlan: boolean
  onDone: (plan: TestPlanDto) => void
  notify: (msg: string, tone?: 'error') => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const start = async () => {
    setBusy(true)
    try {
      const pages = (await documentApi.listTree(p.projectId)).filter((n) => n.kind === 'PAGE')
      const doc = [...pages.filter(isSpecDoc), ...pages.filter((d) => !isSpecDoc(d))][0]
      if (!doc) {
        p.notify(t('Dự án chưa có tài liệu nào — hãy tạo một tài liệu ở tab Tài liệu trước.', 'Create a document first.'), 'error')
        return
      }
      await testApi.addModule(p.planId, { documentId: doc.documentId })
      p.onDone(await testApi.plan(p.planId))
    } catch (err) {
      p.notify(apiErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <IconTile icon={SlidersIcon} />
      <p className="text-[15px] font-semibold text-gray-950">{t('Chưa có testcase nào', 'No test cases yet')}</p>
      <p className="max-w-sm text-[13.5px] text-gray-500">
        {t(
          'Tạo bộ thư mục đầu tiên rồi thêm testcase. Liên kết với tài liệu (REQ) là tuỳ chọn, làm sau cũng được.',
          'Create the first folders, then add test cases. Linking REQs is optional.',
        )}
      </p>
      {p.canPlan ? (
        <Button inline isLoading={busy} onClick={() => void start()}>
          {t('Bắt đầu viết testcase', 'Start writing test cases')}
        </Button>
      ) : (
        <p className="text-[13px] text-gray-500">{t('Nhờ người có quyền tạo đợt test bắt đầu.', 'Ask someone with plan access.')}</p>
      )}
    </div>
  )
}
