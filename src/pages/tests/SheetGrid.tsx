import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { canEditCell, type TestAbilities } from '@/lib/testplan/abilities'
import { clampWidth, type ColumnDef } from '@/lib/testplan/columns'
import { groupsOf, topSections } from '@/lib/testplan/placement'
import { retestIn, statsIn, statusIn } from '@/lib/testplan/status'
import { ChevronDownIcon, HistoryIcon, TrashIcon, UndoIcon } from '@/components/ui/icons'
import type { TestCaseDto, TestModuleDto, TestPlanDto, TestSectionDto } from '@/types/testing'
import { CellDisplay, CellEditor, resultTooltip, type CellValue, type DisplayCtx } from './cells'
import { iconBtn } from './testUi'

// Bảng testcase kiểu Excel của một module ở một môi trường: dòng mục / nhóm thu gọn được, "+ Testcase" ở dòng nhóm,
// "+ Thêm nhóm" cuối mỗi mục. Phím: ↑↓←→ di chuyển, Enter / F2 sửa, Esc huỷ, Tab sang ô bên, Ctrl+Enter trong ô nhiều
// dòng. Bấm 1 lần vào ô danh sách (Kết quả, chọn, người) là mở luôn. Tiêu đề cột: kéo đổi chỗ, kéo mép đổi rộng, bấm
// đúp đổi tên.

export type SheetFilter = 'all' | 'untest' | 'retest'

export interface SheetGridProps {
  plan: TestPlanDto
  module: TestModuleDto
  envId: number
  cases: TestCaseDto[]
  columns: ColumnDef[]
  abilities: TestAbilities
  filter: SheetFilter
  wrap: boolean
  collapsed: Set<number>
  onToggleCollapse: (sectionId: number) => void
  selected: Set<number>
  onSelect: (ids: number[], on: boolean) => void
  focusCaseId: number | null
  /** Yêu cầu sửa tên một case (vừa thêm) — đổi `n` để kích hoạt lại. */
  editRequest: { id: number; n: number } | null
  display: Omit<DisplayCtx, 'onReqEdit' | 'onBug'>
  /** Lưu giá trị ô (SheetTab tự áp cho các dòng đã chọn). */
  onCommit: (tc: TestCaseDto, col: ColumnDef, value: CellValue) => void
  onOpenReqPicker: (tc: TestCaseDto) => void
  onOpenBug: (tc: TestCaseDto) => void
  onHistory: (tc: TestCaseDto) => void
  onToggleDelete: (tc: TestCaseDto) => void
  onAddCase: (group: TestSectionDto) => void
  onAddGroup: (top: TestSectionDto) => void
  onMoveColumn: (from: string, to: string) => void
  onResizeColumn: (id: string, width: number) => void
  onRenameColumn: (id: string, label: string) => void
}

type Row =
  | { kind: 'section'; section: TestSectionDto; level: 1 | 2; under: TestCaseDto[] }
  | { kind: 'case'; tc: TestCaseDto }
  | { kind: 'addGroup'; top: TestSectionDto }

interface Pos {
  id: number
  col: string
}

const cellKind = (c: ColumnDef): 'result' | 'bug' | 'content' | null =>
  c.kind === 'result' ? 'result' : c.kind === 'bug' ? 'bug' : c.kind === 'key' || c.kind === 'ro' ? null : 'content'

/** Ô bấm 1 lần là mở (danh sách chọn) hoặc mở hộp thoại (REQ, bug). */
const OPENS_ON_CLICK = new Set(['result', 'select', 'person', 'req', 'bug'])

export function SheetGrid(p: SheetGridProps) {
  const { t } = useI18n()
  const { plan, module, envId, cases, columns, abilities, filter, wrap, collapsed, selected, focusCaseId } = p
  const [active, setActive] = useState<Pos | null>(null)
  const [editing, setEditing] = useState<Pos | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragCol, setDragCol] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [widths, setWidths] = useState<Record<string, number>>({})
  const wrapRef = useRef<HTMLDivElement>(null)

  const visible = (tc: TestCaseDto) => {
    if (filter === 'all') return true
    if (tc.status === 'DELETED') return false
    const s = statusIn(tc, envId)
    return filter === 'untest' ? s === 'UNTEST' : s === 'RETEST'
  }

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    const mine = cases.filter((c) => c.moduleId === module.moduleId)
    const inSection = (id: number) => mine.filter((c) => c.sectionId === id).sort((a, b) => a.position - b.position)
    for (const top of topSections(module)) {
      const groups = groupsOf(module, top.sectionId)
      const under = [...inSection(top.sectionId), ...groups.flatMap((g) => inSection(g.sectionId))]
      out.push({ kind: 'section', section: top, level: 1, under })
      if (collapsed.has(top.sectionId)) continue
      for (const tc of inSection(top.sectionId)) if (visible(tc)) out.push({ kind: 'case', tc })
      for (const g of groups) {
        const gu = inSection(g.sectionId)
        out.push({ kind: 'section', section: g, level: 2, under: gu })
        if (collapsed.has(g.sectionId)) continue
        for (const tc of gu) if (visible(tc)) out.push({ kind: 'case', tc })
      }
      if (abilities.manage) out.push({ kind: 'addGroup', top })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, module, collapsed, filter, envId, abilities.manage])

  const navRows = rows.filter((r): r is { kind: 'case'; tc: TestCaseDto } => r.kind === 'case')
  const caseById = (id: number) => cases.find((c) => c.testCaseId === id)
  const colById = (id: string) => columns.find((c) => c.id === id)

  const editable = (c: ColumnDef, tc: TestCaseDto) => {
    const k = cellKind(c)
    if (!k) return false
    if (k === 'bug')
      return canEditCell(abilities, 'bug', tc.status === 'DELETED') && (!!tc.bug || statusIn(tc, envId) === 'FAIL')
    return canEditCell(abilities, k, tc.status === 'DELETED')
  }
  /** Ô điều hướng được (kể cả chỉ đọc) — để di chuyển bằng phím mà không nhảy cóc. */
  const focusable = (c: ColumnDef) => c.kind !== 'key'

  // Trỏ tới case từ link (?tc=) hoặc sau khi thêm case mới.
  useEffect(() => {
    if (!focusCaseId) return
    const tc = caseById(focusCaseId)
    if (!tc || tc.moduleId !== module.moduleId) return
    const title = columns.find((c) => c.id === 'title') ?? columns[0]
    setActive({ id: focusCaseId, col: title.id })
    const el = wrapRef.current?.querySelector(`[data-row="${focusCaseId}"]`)
    el?.scrollIntoView?.({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCaseId, module.moduleId])

  // Case vừa thêm: sửa ngay tên.
  useEffect(() => {
    if (!p.editRequest) return
    const pos = { id: p.editRequest.id, col: 'title' }
    setActive(pos)
    setEditing(pos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.editRequest])

  // Focus vào ô đang chọn (không đang sửa) để phím mũi tên hoạt động và trình đọc màn hình đọc ô. Không giật focus khi
  // đang có hộp thoại / ngăn mở hoặc người dùng đang gõ ở ô khác ngoài bảng.
  useEffect(() => {
    if (!active || editing) return
    const el = wrapRef.current?.querySelector<HTMLElement>(`[data-cell="${active.id}|${active.col}"]`)
    if (!el || document.activeElement === el || document.querySelector('[role="dialog"]')) return
    const cur = document.activeElement
    if (cur && cur !== document.body && !wrapRef.current?.contains(cur)) return
    el.focus()
  }, [active, editing])

  const startEdit = (pos: Pos) => {
    const tc = caseById(pos.id)
    const col = colById(pos.col)
    if (!tc || !col || !editable(col, tc)) return
    setActive(pos)
    if (col.kind === 'req') return p.onOpenReqPicker(tc)
    if (col.kind === 'bug') {
      if (!tc.bug) p.onOpenBug(tc)
      return
    }
    setEditing(pos)
  }

  const move = (dr: number, dc: number, from: Pos | null = active) => {
    if (!navRows.length) return
    if (!from) {
      setActive({ id: navRows[0].tc.testCaseId, col: 'title' })
      return
    }
    let ri = navRows.findIndex((r) => r.tc.testCaseId === from.id)
    let ci = columns.findIndex((c) => c.id === from.col)
    if (ri < 0) ri = 0
    if (ci < 0) ci = 0
    for (let k = 0; k < 60; k++) {
      ri = Math.max(0, Math.min(navRows.length - 1, ri + dr))
      ci = Math.max(0, Math.min(columns.length - 1, ci + dc))
      const col = columns[ci]
      if (focusable(col)) {
        setActive({ id: navRows[ri].tc.testCaseId, col: col.id })
        return
      }
      if ((dr && (ri === 0 || ri === navRows.length - 1)) || (dc && (ci === 0 || ci === columns.length - 1))) return
    }
  }

  const commit = (pos: Pos, value: CellValue | undefined, then?: 'down' | 'right' | 'left') => {
    const tc = caseById(pos.id)
    const col = colById(pos.col)
    // Nhớ dòng kế tiếp TRƯỚC khi lưu: đang lọc "Chưa test" thì dòng vừa ghi biến mất khỏi danh sách.
    const ri = navRows.findIndex((r) => r.tc.testCaseId === pos.id)
    const next = navRows[ri + 1] ?? navRows[ri]
    setEditing(null)
    if (tc && col && value !== undefined) p.onCommit(tc, col, value)
    if (then === 'down') {
      if (next) setActive({ id: next.tc.testCaseId, col: pos.col })
    } else if (then === 'right') move(0, 1, pos)
    else if (then === 'left') move(0, -1, pos)
  }

  /** Ô đang chọn là ô điều hướng đầu / cuối của bảng (để Tab rời bảng thay vì bị giữ lại). */
  const atEdge = (back: boolean) => {
    if (!active) return true
    const ri = navRows.findIndex((r) => r.tc.testCaseId === active.id)
    const navCols = columns.filter(focusable)
    const ci = navCols.findIndex((c) => c.id === active.col)
    return back ? ri <= 0 && ci <= 0 : ri === navRows.length - 1 && ci === navCols.length - 1
  }

  const onGridKey = (e: ReactKeyboardEvent) => {
    if (editing || renaming) return
    const target = e.target as HTMLElement
    if (!target.closest('[data-cell]')) return
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    if (map[e.key]) {
      e.preventDefault()
      move(...map[e.key])
    } else if ((e.key === 'Enter' || e.key === 'F2') && active) {
      e.preventDefault()
      startEdit(active)
    } else if (e.key === 'Tab' && active && !atEdge(e.shiftKey)) {
      // Tab sang ô bên như Excel; ở ô đầu / cuối bảng thì để Tab rời bảng (không bẫy bàn phím).
      e.preventDefault()
      move(0, e.shiftKey ? -1 : 1)
    }
  }

  const onCellClick = (pos: Pos, detail: number) => {
    const col = colById(pos.col)
    const same = active?.id === pos.id && active.col === pos.col
    setActive(pos)
    if (!col) return
    if (same || detail >= 2 || OPENS_ON_CLICK.has(col.kind)) startEdit(pos)
  }

  // ---------- Tiêu đề cột ----------

  const widthOf = (c: ColumnDef) => widths[c.id] ?? c.width
  const startResize = (e: ReactMouseEvent, c: ColumnDef) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    const w0 = widthOf(c)
    let last = w0
    const onMove = (ev: MouseEvent) => {
      last = clampWidth(w0 + ev.clientX - x0)
      setWidths((m) => ({ ...m, [c.id]: last }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (last !== w0) p.onResizeColumn(c.id, last)
      setWidths((m) => {
        const n = { ...m }
        delete n[c.id]
        return n
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const tableWidth = columns.reduce((n, c) => n + widthOf(c), 36 + 72)
  const totalCols = columns.length + 2
  const canPick = abilities.manage || abilities.execute

  const sectionRow = (row: Extract<Row, { kind: 'section' }>) => {
    const s = row.section
    const open = !collapsed.has(s.sectionId)
    const live = row.under.filter((c) => c.status === 'ACTIVE')
    const st = statsIn(live, envId)
    const allPicked = live.length > 0 && live.every((c) => selected.has(c.testCaseId))
    const somePicked = !allPicked && live.some((c) => selected.has(c.testCaseId))
    return (
      <tr
        key={`s${s.sectionId}`}
        data-section={s.sectionId}
        className={clsx('scroll-mt-10', row.level === 1 ? 'bg-[#eef1f6]' : 'bg-gray-50')}
      >
        <td
          colSpan={totalCols}
          className="sticky left-0 border-b border-gray-200 py-1.5 pr-3"
          style={{ paddingLeft: row.level === 1 ? 10 : 28 }}
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <input
              type="checkbox"
              aria-label={t(`Chọn cả nhóm ${s.code} ${s.title}`, `Select all of ${s.code} ${s.title}`)}
              checked={allPicked}
              ref={(el) => {
                if (el) el.indeterminate = somePicked
              }}
              disabled={!canPick || !live.length}
              onChange={(e) =>
                p.onSelect(
                  live.map((c) => c.testCaseId),
                  e.target.checked,
                )
              }
            />
            <button
              type="button"
              aria-expanded={open}
              onClick={() => p.onToggleCollapse(s.sectionId)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded text-left text-gray-800 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                row.level === 1 ? 'font-semibold' : 'font-medium',
              )}
            >
              <ChevronDownIcon
                width={14}
                height={14}
                aria-hidden="true"
                className={clsx('shrink-0 text-gray-500 transition-transform', !open && '-rotate-90')}
              />
              {s.code} {s.title}
            </button>
            {row.level === 1 && s.anchorId && (
              <span
                className={clsx(
                  'rounded-[5px] px-1.5 text-[11.5px] font-medium',
                  s.reqChanged ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700',
                )}
                title={t('Mục này kiểm cho một mục của tài liệu', 'This section covers a document heading')}
              >
                {module.documentCode}
                {s.reqChanged ? t(' · REQ đổi', ' · REQ changed') : ''}
              </span>
            )}
            <span className="text-[12.5px] font-normal text-gray-500">
              {t(`${st.total} TC · ${st.PASS} Pass`, `${st.total} TC · ${st.PASS} pass`)}
              {st.FAIL > 0 && <span className="text-red-700"> · {st.FAIL} Fail</span>}
              {st.RETEST > 0 && <span className="text-amber-800"> · {st.RETEST} Retest</span>}
            </span>
            {row.level === 2 && abilities.manage && (
              <button
                type="button"
                onClick={() => p.onAddCase(s)}
                className="rounded-[6px] border border-dashed border-gray-300 bg-white px-2 text-[12px] font-medium text-gray-600 hover:border-brand-500 hover:text-brand-700"
              >
                {t('+ Testcase', '+ Test case')}
              </button>
            )}
          </span>
        </td>
      </tr>
    )
  }

  const caseRow = (tc: TestCaseDto) => {
    const deleted = tc.status === 'DELETED'
    const picked = selected.has(tc.testCaseId)
    const retest = !!retestIn(tc, envId)
    return (
      <tr
        key={tc.testCaseId}
        data-row={tc.testCaseId}
        className={clsx(picked && '[&>td]:bg-brand-50', deleted && '[&>td]:bg-gray-25 [&>td]:text-gray-400')}
      >
        <td
          className={clsx(
            'border-b border-r border-gray-100 border-b-gray-200 bg-white px-2 py-1.5 text-center align-top',
            retest && 'shadow-[inset_3px_0_0_#f79009]',
          )}
        >
          <input
            type="checkbox"
            aria-label={t(`Chọn ${tc.code}`, `Select ${tc.code}`)}
            checked={picked}
            disabled={deleted || !canPick}
            onChange={(e) => p.onSelect([tc.testCaseId], e.target.checked)}
          />
        </td>
        {columns.map((c) => {
          const pos = { id: tc.testCaseId, col: c.id }
          const isActive = active?.id === tc.testCaseId && active.col === c.id
          const isEditing = editing?.id === tc.testCaseId && editing.col === c.id
          const canEdit = editable(c, tc)
          const nav = focusable(c)
          return (
            <td
              key={c.id}
              data-cell={nav ? `${tc.testCaseId}|${c.id}` : undefined}
              tabIndex={nav ? (isActive ? 0 : -1) : undefined}
              aria-readonly={nav && !canEdit ? true : undefined}
              title={c.kind === 'result' ? resultTooltip(tc, plan, envId, t) : undefined}
              onClick={nav && !isEditing ? (e) => onCellClick(pos, e.detail) : undefined}
              className={clsx(
                'border-b border-r border-gray-100 border-b-gray-200 px-2 py-1.5 align-top',
                !picked && !deleted && (canEdit ? 'cursor-cell bg-white hover:bg-gray-25' : 'bg-gray-25 text-gray-600'),
                deleted && c.kind !== 'key' && 'line-through',
                (isActive || isEditing) && 'relative z-[1] outline outline-2 -outline-offset-2 outline-brand-500',
                'focus:outline-none',
              )}
            >
              {isEditing ? (
                <CellEditor
                  tc={tc}
                  col={c}
                  envId={envId}
                  plan={plan}
                  onCancel={() => setEditing(null)}
                  onCommit={(v, mv) => commit(pos, v, mv)}
                  onTab={(v, back) => commit(pos, v, back ? 'left' : 'right')}
                />
              ) : (
                <div className={clsx('whitespace-pre-line leading-[1.45]', !wrap && 'line-clamp-1')}>
                  <CellDisplay
                    tc={tc}
                    col={c}
                    ctx={{
                      ...p.display,
                      canEditReq: abilities.manage && !deleted,
                      canBug: abilities.execute && !deleted,
                      onReqEdit: () => p.onOpenReqPicker(tc),
                      onBug: () => p.onOpenBug(tc),
                    }}
                  />
                </div>
              )}
            </td>
          )
        })}
        <td className="whitespace-nowrap border-b border-gray-200 bg-white px-1 py-1 text-center align-top">
          <button
            type="button"
            className={iconBtn}
            aria-label={t(`Lịch sử ${tc.code}`, `History of ${tc.code}`)}
            title={t('Lịch sử', 'History')}
            onClick={() => p.onHistory(tc)}
          >
            <HistoryIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          {abilities.manage && (
            <button
              type="button"
              className={iconBtn}
              aria-label={
                deleted ? t(`Khôi phục ${tc.code}`, `Restore ${tc.code}`) : t(`Delete ${tc.code}`, `Delete ${tc.code}`)
              }
              title={deleted ? t('Khôi phục', 'Restore') : t('Delete (không dùng nữa)', 'Delete (no longer used)')}
              onClick={() => p.onToggleDelete(tc)}
            >
              {deleted ? (
                <UndoIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <TrashIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto" onKeyDown={onGridKey}>
      <table
        role="grid"
        aria-label={t(`Bảng testcase · ${module.name}`, `Test cases · ${module.name}`)}
        aria-rowcount={navRows.length}
        className="table-fixed border-separate border-spacing-0 text-[13px]"
        style={{ width: tableWidth }}
      >
        <colgroup>
          <col style={{ width: 36 }} />
          {columns.map((c) => (
            <col key={c.id} style={{ width: widthOf(c) }} />
          ))}
          <col style={{ width: 72 }} />
        </colgroup>
        <thead>
          <tr>
            <th
              className="sticky top-0 z-[2] border-b border-r border-gray-200 bg-gray-50"
              aria-label={t('Chọn', 'Select')}
            />
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                draggable={abilities.manage && renaming !== c.id}
                onDragStart={(e) => {
                  setDragCol(c.id)
                  try {
                    e.dataTransfer.setData('text/plain', c.id)
                  } catch {
                    // jsdom
                  }
                }}
                onDragOver={(e) => {
                  if (!dragCol) return
                  e.preventDefault()
                  setOverCol(c.id)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragCol && dragCol !== c.id) p.onMoveColumn(dragCol, c.id)
                  setDragCol(null)
                  setOverCol(null)
                }}
                onDragEnd={() => {
                  setDragCol(null)
                  setOverCol(null)
                }}
                onDoubleClick={(e) => {
                  if (!abilities.manage || (e.target as HTMLElement).dataset.resize) return
                  setRenaming(c.id)
                }}
                title={
                  abilities.manage
                    ? t('Kéo để đổi vị trí · bấm đúp để đổi tên', 'Drag to move · double-click to rename') +
                      (c.label !== c.defaultLabel
                        ? t(` (gốc: ${c.defaultLabel})`, ` (original: ${c.defaultLabel})`)
                        : '')
                    : undefined
                }
                className={clsx(
                  'sticky top-0 z-[2] select-none overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-gray-200 px-2 py-2 text-left text-[12px] font-medium',
                  c.kind === 'result' ? 'bg-brand-50 text-brand-800' : 'bg-gray-50 text-gray-600',
                  abilities.manage && 'cursor-grab',
                  dragCol === c.id && 'opacity-40',
                  overCol === c.id && dragCol !== c.id && 'shadow-[inset_3px_0_0_#2f5bea]',
                )}
              >
                {renaming === c.id ? (
                  <input
                    autoFocus
                    defaultValue={c.label}
                    aria-label={t('Tên cột', 'Column name')}
                    maxLength={60}
                    className="h-6 w-full rounded-[5px] border border-brand-300 px-1 text-[12px] font-medium focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setRenaming(null)
                      }
                    }}
                    onBlur={(e) => {
                      if (renaming === c.id) p.onRenameColumn(c.id, e.target.value)
                      setRenaming(null)
                    }}
                  />
                ) : (
                  <>
                    {c.label}
                    {c.custom && (
                      <span className="ml-1 rounded-[4px] bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">
                        {t('cột riêng', 'custom')}
                      </span>
                    )}
                  </>
                )}
                {abilities.manage && (
                  <span
                    data-resize="1"
                    aria-hidden="true"
                    onMouseDown={(e) => startResize(e, c)}
                    onDragStart={(e) => e.preventDefault()}
                    draggable={false}
                    className="absolute right-[-3px] top-0 z-[3] h-full w-[7px] cursor-col-resize hover:bg-brand-300"
                  />
                )}
              </th>
            ))}
            <th
              className="sticky top-0 z-[2] border-b border-gray-200 bg-gray-50"
              aria-label={t('Thao tác', 'Actions')}
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment
              key={
                row.kind === 'case'
                  ? `c${row.tc.testCaseId}`
                  : row.kind === 'section'
                    ? `s${row.section.sectionId}`
                    : `a${row.top.sectionId}`
              }
            >
              {row.kind === 'section' ? (
                sectionRow(row)
              ) : row.kind === 'case' ? (
                caseRow(row.tc)
              ) : (
                <tr>
                  <td colSpan={totalCols} className="border-b border-gray-200 bg-white py-1.5 pl-7">
                    <button
                      type="button"
                      onClick={() => p.onAddGroup(row.top)}
                      title={t(
                        `Thêm nhóm vào mục ${row.top.code} ${row.top.title}`,
                        `Add a group to ${row.top.code} ${row.top.title}`,
                      )}
                      className="rounded-[6px] border border-dashed border-gray-300 bg-white px-2.5 py-0.5 text-[12.5px] text-gray-600 hover:border-brand-500 hover:text-brand-700"
                    >
                      {t('+ Thêm nhóm', '+ Add group')}
                    </button>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={totalCols} className="px-4 py-8 text-center text-[13px] text-gray-500">
                {t('Chưa có mục nào', 'No sections yet')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
