import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { documentApi, type ProjectRequirementItem } from '@/api/documentApi'
import { testApi } from '@/api/testApi'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { SearchInput } from '@/components/ui/listControls'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { CloseIcon, FolderIcon, LockIcon, PlusIcon, SparklesIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import { hasWorkPermission } from '@/lib/workPermissions'
import { PERMISSIONS } from '@/types/rbac'
import type { DocumentNodeDto } from '@/types/document'
import type {
  CreateTestCaseBody,
  RunResult,
  TestCaseSummaryDto,
  TestTreeNodeDto,
  UpdateTestCaseBody,
} from '@/types/testing'
import {
  ChevronRight,
  Chip,
  DiagramIcon,
  IconButton,
  PageIcon,
  ShrinkIcon,
  SidebarIcon,
  StatusPill,
  menuItem,
  menuPanel,
  usePopover,
} from '../documents/docUi'
import { DiagramTabs, MermaidPreview, type DiagramTab } from '../documents/editor/nodeViews'
import { Toast, useToast } from '../documents/view/Toast'
import { useProjectContext } from '../projects/ProjectLayout'

export type ColumnKind = 'req' | 'code' | 'title' | 'steps' | 'expected' | 'result' | 'custom'
export type CellAlign = 'left' | 'center' | 'right'
export type RowDensity = 'compact' | 'normal' | 'comfortable'

export interface TestColumnConfig {
  id: string
  kind: ColumnKind
  label: string
  width?: number
  align?: CellAlign
  bold?: boolean
  mono?: boolean
}

export interface PastelSwatch {
  id: string
  labelVi: string
  labelEn: string
  hex: string
}

export const PASTEL_PALETTE: PastelSwatch[] = [
  { id: 'none', labelVi: 'Không màu', labelEn: 'No fill', hex: '' },
  { id: 'pink', labelVi: 'Hồng phấn (Pastel Pink)', labelEn: 'Pastel Pink', hex: '#FCE7F3' },
  { id: 'peach', labelVi: 'Cam đào (Pastel Peach)', labelEn: 'Pastel Peach', hex: '#FFEDD5' },
  { id: 'yellow', labelVi: 'Vàng kem (Pastel Yellow)', labelEn: 'Pastel Yellow', hex: '#FEF9C3' },
  { id: 'mint', labelVi: 'Xanh mint (Pastel Mint)', labelEn: 'Pastel Mint', hex: '#DCFCE7' },
  { id: 'blue', labelVi: 'Xanh băng (Pastel Blue)', labelEn: 'Pastel Blue', hex: '#DBEAFE' },
  { id: 'cyan', labelVi: 'Xanh ngọc (Pastel Cyan)', labelEn: 'Pastel Cyan', hex: '#CFFAFE' },
  { id: 'lavender', labelVi: 'Tím oải hương (Pastel Lavender)', labelEn: 'Pastel Lavender', hex: '#F3E8FF' },
  { id: 'gray', labelVi: 'Xám sương (Pastel Gray)', labelEn: 'Pastel Gray', hex: '#F3F4F6' },
]

const DEFAULT_COLUMNS: TestColumnConfig[] = [
  { id: 'req', kind: 'req', label: 'REQ', width: 160, align: 'left', mono: true },
  { id: 'code', kind: 'code', label: 'Mã TC', width: 105, align: 'left', mono: true },
  { id: 'title', kind: 'title', label: 'Tên kịch bản', width: 230, align: 'left' },
  { id: 'steps', kind: 'steps', label: 'Các bước thực hiện', width: 270, align: 'left' },
  { id: 'expected', kind: 'expected', label: 'Kết quả mong đợi', width: 250, align: 'left' },
  { id: 'result', kind: 'result', label: 'Kết quả', width: 135, align: 'left' },
]

function columnsStorageKey(projectId: number): string {
  return `ssam.test_columns.v2.${projectId}`
}

function rowOrderStorageKey(projectId: number): string {
  return `ssam.test_row_order.v1.${projectId}`
}

function sheetPrefsStorageKey(projectId: number): string {
  return `ssam.test_sheet_prefs.v1.${projectId}`
}

function cellColorsStorageKey(projectId: number): string {
  return `ssam.test_cell_colors.v1.${projectId}`
}

interface SheetPrefs {
  wrapText: boolean
  density: RowDensity
}

const DEFAULT_PREFS: SheetPrefs = {
  wrapText: true,
  density: 'normal',
}

function loadColumns(projectId: number): TestColumnConfig[] {
  try {
    const raw = localStorage.getItem(columnsStorageKey(projectId))
    if (!raw) return DEFAULT_COLUMNS
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((c: any) => ({
        id: String(c.id),
        kind:
          (c.kind as ColumnKind) ||
          (['req', 'code', 'title', 'steps', 'expected', 'result'].includes(c.id) ? c.id : 'custom'),
        label: String(c.label ?? c.id),
        width: typeof c.width === 'number' ? c.width : 200,
        align: c.align ?? 'left',
        bold: Boolean(c.bold),
        mono: Boolean(c.mono),
      }))
    }
  } catch {
    // ignore
  }
  return DEFAULT_COLUMNS
}

function saveColumns(projectId: number, cols: TestColumnConfig[]) {
  try {
    localStorage.setItem(columnsStorageKey(projectId), JSON.stringify(cols))
  } catch {
    // ignore
  }
}

function loadRowOrder(projectId: number): number[] {
  try {
    const raw = localStorage.getItem(rowOrderStorageKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite)
  } catch {
    // ignore
  }
  return []
}

function saveRowOrder(projectId: number, ids: number[]) {
  try {
    localStorage.setItem(rowOrderStorageKey(projectId), JSON.stringify(ids))
  } catch {
    // ignore
  }
}

function loadSheetPrefs(projectId: number): SheetPrefs {
  try {
    const raw = localStorage.getItem(sheetPrefsStorageKey(projectId))
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function saveSheetPrefs(projectId: number, prefs: SheetPrefs) {
  try {
    localStorage.setItem(sheetPrefsStorageKey(projectId), JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

function loadCellColors(projectId: number): Record<string, string> {
  try {
    const raw = localStorage.getItem(cellColorsStorageKey(projectId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>
  } catch {
    // ignore
  }
  return {}
}

function saveCellColors(projectId: number, colors: Record<string, string>) {
  try {
    localStorage.setItem(cellColorsStorageKey(projectId), JSON.stringify(colors))
  } catch {
    // ignore
  }
}

type RowStatus = 'UNTESTED' | 'PASS' | 'FAIL' | 'BLOCKED'

function normalizeRowStatus(lastResult: RunResult | null | undefined): RowStatus {
  if (lastResult === 'PASS' || lastResult === 'FAIL' || lastResult === 'BLOCKED') return lastResult
  return 'UNTESTED'
}

function colIndexToLetter(idx: number): string {
  let n = idx + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function sanitizeMermaidLabel(text: string, maxLen = 44): string {
  const clean = (text || '')
    .replace(/["[\]{}()<>|#&;`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return 'Chưa nhập'
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean
}

type DiagramMode = 'flowchart_lr' | 'flowchart_td' | 'sequence'

function buildCaseMermaidDiagram(
  projectName: string,
  requirements: ProjectRequirementItem[],
  rows: TestCaseSummaryDto[],
  mode: DiagramMode,
): string {
  if (rows.length === 0 && requirements.length === 0) {
    return `flowchart LR\n  P["${sanitizeMermaidLabel(projectName, 32)}"] --> E["Chưa có kịch bản kiểm thử"]`
  }

  if (mode === 'sequence') {
    const lines: string[] = [
      'sequenceDiagram',
      '  participant U as Tester / QA',
      '  participant R as Yêu cầu (REQ)',
      '  participant TC as Kịch bản (Test Case)',
      '  participant KQ as Kết quả',
    ]
    const sampleRows = rows.slice(0, 10)
    if (sampleRows.length === 0) {
      lines.push('  U->>R: Chọn REQ cần kiểm thử')
      lines.push('  R-->>TC: Tạo kịch bản kiểm thử trên bảng Excel')
    } else {
      sampleRows.forEach((tc, idx) => {
        const tcCode = tc.code || tc.key || `TC-${String(idx + 1).padStart(3, '0')}`
        const reqLabel = tc.requirements[0]?.reqKey || 'Chưa gắn REQ'
        const status = normalizeRowStatus(tc.lastResult)
        lines.push(`  R->>TC: ${sanitizeMermaidLabel(reqLabel, 20)} → ${sanitizeMermaidLabel(tcCode, 16)}`)
        lines.push(`  U->>TC: ${sanitizeMermaidLabel(tc.title || 'Thực thi kiểm thử', 36)}`)
        lines.push(`  TC-->>KQ: ${status}`)
      })
    }
    return lines.join('\n')
  }

  const dir = mode === 'flowchart_td' ? 'TD' : 'LR'
  const lines: string[] = [`flowchart ${dir}`]
  lines.push(`  ROOT["${sanitizeMermaidLabel(projectName, 28)}"]`)

  const reqNodeMap = new Map<string, string>()
  let reqCounter = 0

  requirements.forEach((r) => {
    reqCounter += 1
    const nodeId = `REQ_${reqCounter}`
    reqNodeMap.set(r.id, nodeId)
    reqNodeMap.set(`${r.documentId}:${r.reqUid}`, nodeId)
    lines.push(`  ${nodeId}["${sanitizeMermaidLabel(`${r.code}: ${r.title}`, 38)}"]`)
    lines.push(`  ROOT --> ${nodeId}`)
  })

  let hasUnlinkedNode = false
  rows.forEach((tc, idx) => {
    const tcNodeId = `TC_${tc.testCaseId}`
    const tcCode = tc.code || tc.key || `TC-${String(idx + 1).padStart(3, '0')}`
    const status = normalizeRowStatus(tc.lastResult)
    const statusTag =
      status === 'PASS' ? ' [ĐẠT]' : status === 'FAIL' ? ' [LỖI]' : status === 'BLOCKED' ? ' [CHẶN]' : ''
    const label = `${tcCode}: ${sanitizeMermaidLabel(tc.title || 'Kịch bản mới', 34)}${statusTag}`
    lines.push(`  ${tcNodeId}("${label}")`)

    const linkedReq = tc.requirements[0]
    const reqKey =
      (tc.requirementId ? String(tc.requirementId) : '') ||
      (linkedReq ? `${linkedReq.documentId}:${linkedReq.reqUid}` : '')
    const parentNode = reqKey ? reqNodeMap.get(reqKey) : undefined

    if (parentNode) {
      lines.push(`  ${parentNode} --> ${tcNodeId}`)
    } else if (linkedReq) {
      reqCounter += 1
      const fallbackReqNode = `REQ_${reqCounter}`
      reqNodeMap.set(`${linkedReq.documentId}:${linkedReq.reqUid}`, fallbackReqNode)
      lines.push(`  ${fallbackReqNode}["${sanitizeMermaidLabel(linkedReq.reqKey ?? 'REQ', 24)}"]`)
      lines.push(`  ROOT --> ${fallbackReqNode}`)
      lines.push(`  ${fallbackReqNode} --> ${tcNodeId}`)
    } else {
      if (!hasUnlinkedNode) {
        hasUnlinkedNode = true
        lines.push(`  UNLINKED["Chưa gắn REQ"]`)
        lines.push(`  ROOT --> UNLINKED`)
      }
      lines.push(`  UNLINKED --> ${tcNodeId}`)
    }
  })

  return lines.join('\n')
}

interface HistoryAction {
  type: 'cell_value' | 'cell_colors'
  rowId?: number
  colId?: string
  prevValue?: string
  nextValue?: string
  prevColors?: Record<string, string>
  nextColors?: Record<string, string>
}

export function TestsPage() {
  const { t } = useI18n()
  const { project, can, isArchived, fullscreen, setFullscreen } = useProjectContext()
  const projectId = project.projectId
  const { toast, notify } = useToast()

  const canManage = !isArchived && can(PERMISSIONS.testCaseManage)
  const canExecute = !isArchived && hasWorkPermission(project.myPermissions, PERMISSIONS.testCaseExecute)
  const canEdit = canManage || canExecute

  const [columns, setColumns] = useState<TestColumnConfig[]>(() => loadColumns(projectId))
  const [prefs, setPrefs] = useState<SheetPrefs>(() => loadSheetPrefs(projectId))
  const [cellColors, setCellColors] = useState<Record<string, string>>(() => loadCellColors(projectId))

  const [rows, setRows] = useState<TestCaseSummaryDto[]>([])
  const [docNodes, setDocNodes] = useState<DocumentNodeDto[]>([])
  const [requirements, setRequirements] = useState<ProjectRequirementItem[]>([])
  const [testTree, setTestTree] = useState<TestTreeNodeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  // Cây bên trái theo chuẩn Document
  const [treeOpen, setTreeOpen] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  )
  const [search, setSearch] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<{
    type: 'all' | 'doc' | 'req' | 'folder' | 'unlinked'
    id?: string | number
  }>({ type: 'all' })
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set(['unlinked']))

  const newMenu = usePopover()
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Sơ đồ Case trực quan (Mermaid Preview)
  const [diagramOpen, setDiagramOpen] = useState(false)
  const [diagramTab, setDiagramTab] = useState<DiagramTab>('diagram')
  const [diagramMode, setDiagramMode] = useState<DiagramMode>('flowchart_lr')
  const [customMermaid, setCustomMermaid] = useState<string | null>(null)

  const [activeCell, setActiveCell] = useState<{ rowId: number; colId: string } | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: number; colId: string } | null>(null)
  const [initialEditChar, setInitialEditChar] = useState<string | null>(null)
  const [selectedScope, setSelectedScope] = useState<'cell' | 'row' | 'col'>('cell')
  const [copiedCell, setCopiedCell] = useState<{ rowId: number; colId: string } | null>(null)
  const [formulaDraft, setFormulaDraft] = useState('')

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([])

  const cellDomRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())

  // Drag & Drop
  const [draggedColId, setDraggedColId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const [draggedRowId, setDraggedRowId] = useState<number | null>(null)
  const [dragOverRowId, setDragOverRowId] = useState<number | null>(null)

  // Modal Sinh tự động
  const [genOpen, setGenOpen] = useState(false)
  const [genReqId, setGenReqId] = useState('')
  const [genFigmaUrl, setGenFigmaUrl] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setColumns(loadColumns(projectId))
    setPrefs(loadSheetPrefs(projectId))
    setCellColors(loadCellColors(projectId))
  }, [projectId])

  const updateColumns = useCallback(
    (next: TestColumnConfig[]) => {
      setColumns(next)
      saveColumns(projectId, next)
    },
    [projectId],
  )

  const updatePrefs = useCallback(
    (patch: Partial<SheetPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch }
        saveSheetPrefs(projectId, next)
        return next
      })
    },
    [projectId],
  )

  const updateCellColors = useCallback(
    (next: Record<string, string>, recordUndo = true) => {
      setCellColors((prev) => {
        if (recordUndo) {
          setUndoStack((u) => [...u.slice(-29), { type: 'cell_colors', prevColors: prev, nextColors: next }])
          setRedoStack([])
        }
        saveCellColors(projectId, next)
        return next
      })
    },
    [projectId],
  )

  const applySavedOrder = useCallback(
    (list: TestCaseSummaryDto[]) => {
      const order = loadRowOrder(projectId)
      if (!order.length) return list
      const posMap = new Map(order.map((id, i) => [id, i]))
      return [...list].sort((a, b) => {
        const pa = posMap.get(a.testCaseId) ?? Number.MAX_SAFE_INTEGER
        const pb = posMap.get(b.testCaseId) ?? Number.MAX_SAFE_INTEGER
        return pa !== pb ? pa - pb : a.testCaseId - b.testCaseId
      })
    },
    [projectId],
  )

  const reloadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [caseList, docList, reqList, treeList] = await Promise.all([
        testApi.list(projectId),
        documentApi.listTree(projectId).catch(() => [] as DocumentNodeDto[]),
        documentApi.listProjectRequirements(projectId).catch(() => [] as ProjectRequirementItem[]),
        testApi.tree(projectId).catch(() => [] as TestTreeNodeDto[]),
      ])
      setRows(applySavedOrder(caseList))
      setDocNodes(docList)
      setRequirements(reqList)
      setTestTree(treeList)
      setExpandedNodes((prev) => {
        const next = new Set(prev)
        docList.forEach((d) => next.add(`doc-${d.documentId}`))
        treeList.forEach((t) => next.add(t.id))
        return next
      })
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [projectId, applySavedOrder])

  useEffect(() => {
    void reloadData()
  }, [reloadData])

  const getCellText = useCallback(
    (tc: TestCaseSummaryDto, col: TestColumnConfig, rowIndex: number): string => {
      if (col.kind === 'req') {
        const linkedReq = tc.requirements[0]
        const reqId =
          (tc.requirementId ? String(tc.requirementId) : '') ||
          (linkedReq ? `${linkedReq.documentId}:${linkedReq.reqUid}` : '')
        const found = requirements.find((r) => r.id === reqId)
        return found ? found.code : linkedReq?.reqKey ?? ''
      }
      if (col.kind === 'code') {
        return (
          tc.code ||
          tc.key.replace(/^TC-(\d+)$/, (_, d) => `TC-${String(d).padStart(3, '0')}`) ||
          `TC-${String(rowIndex + 1).padStart(3, '0')}`
        )
      }
      if (col.kind === 'title') return tc.title ?? ''
      if (col.kind === 'steps') {
        if (tc.stepsText !== undefined) return tc.stepsText
        return (tc.steps ?? []).map((s) => s.action).filter(Boolean).join('\n')
      }
      if (col.kind === 'expected') return tc.expectedSummary ?? ''
      if (col.kind === 'result') return normalizeRowStatus(tc.lastResult)
      return tc.customFields?.[col.id] ?? ''
    },
    [requirements],
  )

  // Đồng bộ thanh fx khi chọn ô
  useEffect(() => {
    if (!activeCell) {
      setFormulaDraft('')
      return
    }
    const rowIdx = rows.findIndex((r) => r.testCaseId === activeCell.rowId)
    const row = rows[rowIdx]
    const col = columns.find((c) => c.id === activeCell.colId)
    if (!row || !col) {
      setFormulaDraft('')
      return
    }
    setFormulaDraft(getCellText(row, col, rowIdx))
  }, [activeCell, rows, columns, getCellText])

  // Đổ màu Pastel
  const handleApplyPastelColor = (hex: string) => {
    if (!activeCell) {
      notify(t('Hãy chọn một ô, hàng hoặc cột trước khi đổ màu.', 'Select a cell, row, or column first.'))
      return
    }
    const next = { ...cellColors }
    if (selectedScope === 'row') {
      columns.forEach((c) => {
        const key = `${activeCell.rowId}:${c.id}`
        if (hex) next[key] = hex
        else delete next[key]
      })
    } else if (selectedScope === 'col') {
      rows.forEach((r) => {
        const key = `${r.testCaseId}:${activeCell.colId}`
        if (hex) next[key] = hex
        else delete next[key]
      })
    } else {
      const key = `${activeCell.rowId}:${activeCell.colId}`
      if (hex) next[key] = hex
      else delete next[key]
    }
    updateCellColors(next, true)
  }

  const activeCellColor = useMemo(() => {
    if (!activeCell) return ''
    return cellColors[`${activeCell.rowId}:${activeCell.colId}`] ?? ''
  }, [activeCell, cellColors])

  // Thao tác Cột
  const handleAddColumn = () => {
    if (!canManage) return
    const nextIdx = columns.length + 1
    const newCol: TestColumnConfig = {
      id: `col_${Date.now()}`,
      kind: 'custom',
      label: t(`Cột ${nextIdx}`, `Column ${nextIdx}`),
      width: 200,
      align: 'left',
    }
    updateColumns([...columns, newCol])
  }

  const handleRenameColumn = (colId: string, newLabel: string) => {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    updateColumns(columns.map((c) => (c.id === colId ? { ...c, label: trimmed } : c)))
  }

  const handleDeleteColumn = (colId: string) => {
    if (!canManage) return
    if (columns.length <= 1) {
      notify(t('Bảng cần giữ lại ít nhất 1 cột.', 'The table must keep at least 1 column.'))
      return
    }
    updateColumns(columns.filter((c) => c.id !== colId))
    if (activeCell?.colId === colId) setActiveCell(null)
  }

  const handleResizeColumn = (colId: string, width: number) => {
    updateColumns(columns.map((c) => (c.id === colId ? { ...c, width: Math.max(80, Math.min(600, width)) } : c)))
  }

  const handleColumnDrop = (targetColId: string) => {
    if (!draggedColId || draggedColId === targetColId) {
      setDraggedColId(null)
      setDragOverColId(null)
      return
    }
    const fromIdx = columns.findIndex((c) => c.id === draggedColId)
    const toIdx = columns.findIndex((c) => c.id === targetColId)
    if (fromIdx === -1 || toIdx === -1) return
    const next = [...columns]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    updateColumns(next)
    setDraggedColId(null)
    setDragOverColId(null)
  }

  const activeColumn = useMemo(
    () => (activeCell ? columns.find((c) => c.id === activeCell.colId) ?? null : null),
    [activeCell, columns],
  )

  const handleToggleColumnStyle = useCallback(
    (patch: Partial<TestColumnConfig>) => {
      if (!canManage || !activeColumn) return
      updateColumns(columns.map((c) => (c.id === activeColumn.id ? { ...c, ...patch } : c)))
    },
    [canManage, activeColumn, columns, updateColumns],
  )

  // Thao tác Hàng
  const handleAddRow = async (insertAtIndex?: number) => {
    if (!canManage) return
    try {
      let defaultReqRefs: { documentId: number; reqUid: string }[] | undefined
      let defaultReqId: string | undefined
      let defaultFolderId: number | null = null

      if (selectedFilter.type === 'req' && selectedFilter.id) {
        const foundReq = requirements.find((r) => r.id === selectedFilter.id)
        if (foundReq) {
          defaultReqRefs = [{ documentId: foundReq.documentId, reqUid: foundReq.reqUid }]
          defaultReqId = foundReq.id
        }
      } else if (selectedFilter.type === 'folder' && selectedFilter.id) {
        defaultFolderId = Number(selectedFilter.id) || null
      }

      const created = await testApi.create(projectId, {
        title: '',
        stepsText: '',
        expectedSummary: '',
        lastResult: 'UNTESTED',
        requirementRefs: defaultReqRefs,
        requirementId: defaultReqId,
        folderId: defaultFolderId,
        customFields: {},
      })
      setRows((prev) => {
        const next = [...prev]
        if (insertAtIndex !== undefined && insertAtIndex >= 0 && insertAtIndex <= next.length) {
          next.splice(insertAtIndex, 0, created)
        } else {
          next.push(created)
        }
        saveRowOrder(
          projectId,
          next.map((r) => r.testCaseId),
        )
        return next
      })
      if (columns[0]) {
        setActiveCell({ rowId: created.testCaseId, colId: columns[0].id })
        setSelectedScope('cell')
      }
    } catch (e) {
      notify(apiErrorMessage(e))
    }
  }

  const handleRowDrop = (targetRowId: number) => {
    if (draggedRowId === null || draggedRowId === targetRowId) {
      setDraggedRowId(null)
      setDragOverRowId(null)
      return
    }
    setRows((prev) => {
      const fromIdx = prev.findIndex((r) => r.testCaseId === draggedRowId)
      const toIdx = prev.findIndex((r) => r.testCaseId === targetRowId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      saveRowOrder(
        projectId,
        next.map((r) => r.testCaseId),
      )
      return next
    })
    setDraggedRowId(null)
    setDragOverRowId(null)
  }

  const handleUpdateRow = useCallback(
    async (testCaseId: number, patch: UpdateTestCaseBody) => {
      try {
        const updated = await testApi.update(testCaseId, patch)
        setRows((prev) => prev.map((r) => (r.testCaseId === testCaseId ? updated : r)))
      } catch (e) {
        notify(apiErrorMessage(e))
      }
    },
    [notify],
  )

  const handleCommitCell = useCallback(
    async (tc: TestCaseSummaryDto, col: TestColumnConfig, nextValue: string, recordUndo = true) => {
      const rowIdx = rows.findIndex((r) => r.testCaseId === tc.testCaseId)
      const prevValue = getCellText(tc, col, rowIdx >= 0 ? rowIdx : 0)

      if (recordUndo && prevValue !== nextValue) {
        setUndoStack((u) => [
          ...u.slice(-29),
          {
            type: 'cell_value',
            rowId: tc.testCaseId,
            colId: col.id,
            prevValue,
            nextValue,
          },
        ])
        setRedoStack([])
      }

      if (col.kind === 'req') {
        const found = requirements.find(
          (r) => r.id === nextValue || r.code.toLowerCase() === nextValue.trim().toLowerCase(),
        )
        if (!nextValue.trim()) {
          await handleUpdateRow(tc.testCaseId, { requirementRefs: [], requirementId: '' })
        } else if (found) {
          await handleUpdateRow(tc.testCaseId, {
            requirementRefs: [{ documentId: found.documentId, reqUid: found.reqUid }],
            requirementId: found.id,
          })
        }
        return
      }
      if (col.kind === 'code') {
        if (nextValue.trim() && nextValue.trim() !== tc.code) {
          await handleUpdateRow(tc.testCaseId, { code: nextValue.trim() })
        }
        return
      }
      if (col.kind === 'title') {
        if (nextValue !== (tc.title ?? '')) await handleUpdateRow(tc.testCaseId, { title: nextValue })
        return
      }
      if (col.kind === 'steps') {
        const prev = tc.stepsText ?? (tc.steps ?? []).map((s) => s.action).join('\n')
        if (nextValue !== prev) await handleUpdateRow(tc.testCaseId, { stepsText: nextValue })
        return
      }
      if (col.kind === 'expected') {
        if (nextValue !== (tc.expectedSummary ?? ''))
          await handleUpdateRow(tc.testCaseId, { expectedSummary: nextValue })
        return
      }
      if (col.kind === 'result') {
        const upper = nextValue.trim().toUpperCase()
        if (['UNTESTED', 'PASS', 'FAIL', 'BLOCKED'].includes(upper)) {
          await handleUpdateRow(tc.testCaseId, { lastResult: upper as RowStatus })
        }
        return
      }
      const prevCustom = tc.customFields?.[col.id] ?? ''
      if (nextValue !== prevCustom) {
        await handleUpdateRow(tc.testCaseId, {
          customFields: {
            ...(tc.customFields ?? {}),
            [col.id]: nextValue,
          },
        })
      }
    },
    [rows, getCellText, requirements, handleUpdateRow],
  )

  const handleMarkFresh = async (testCaseId: number) => {
    try {
      const updated = await testApi.markFresh(testCaseId)
      setRows((prev) => prev.map((r) => (r.testCaseId === testCaseId ? updated : r)))
    } catch (e) {
      notify(apiErrorMessage(e))
    }
  }

  // Undo / Redo
  const handleUndo = useCallback(async () => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    setUndoStack((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, last])

    if (last.type === 'cell_colors' && last.prevColors) {
      setCellColors(last.prevColors)
      saveCellColors(projectId, last.prevColors)
      return
    }
    if (last.type === 'cell_value' && last.rowId !== undefined && last.colId) {
      const tc = rows.find((r) => r.testCaseId === last.rowId)
      const col = columns.find((c) => c.id === last.colId)
      if (tc && col && last.prevValue !== undefined) {
        await handleCommitCell(tc, col, last.prevValue, false)
      }
    }
  }, [undoStack, projectId, rows, columns, handleCommitCell])

  const handleRedo = useCallback(async () => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    setRedoStack((prev) => prev.slice(0, -1))
    setUndoStack((prev) => [...prev, next])

    if (next.type === 'cell_colors' && next.nextColors) {
      setCellColors(next.nextColors)
      saveCellColors(projectId, next.nextColors)
      return
    }
    if (next.type === 'cell_value' && next.rowId !== undefined && next.colId) {
      const tc = rows.find((r) => r.testCaseId === next.rowId)
      const col = columns.find((c) => c.id === next.colId)
      if (tc && col && next.nextValue !== undefined) {
        await handleCommitCell(tc, col, next.nextValue, false)
      }
    }
  }, [redoStack, projectId, rows, columns, handleCommitCell])

  // Lọc danh sách dòng
  const filteredRows = useMemo(() => {
    let list = rows
    if (selectedFilter.type === 'unlinked') {
      list = list.filter((tc) => tc.requirements.length === 0 && !tc.requirementId)
    } else if (selectedFilter.type === 'doc' && selectedFilter.id) {
      const docId = Number(selectedFilter.id)
      list = list.filter((tc) => tc.requirements.some((r) => r.documentId === docId))
    } else if (selectedFilter.type === 'req' && selectedFilter.id) {
      const reqId = String(selectedFilter.id)
      list = list.filter((tc) => {
        if (String(tc.requirementId) === reqId) return true
        return tc.requirements.some((r) => `${r.documentId}:${r.reqUid}` === reqId)
      })
    } else if (selectedFilter.type === 'folder' && selectedFilter.id) {
      const fId = Number(selectedFilter.id)
      list = list.filter((tc) => tc.folderId === fId)
    }

    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((tc, idx) => columns.some((col) => getCellText(tc, col, idx).toLowerCase().includes(q)))
  }, [rows, selectedFilter, search, columns, getCellText])

  // Điều hướng phím
  const focusCellDom = useCallback((rowId: number, colId: string) => {
    const el = cellDomRefs.current.get(`${rowId}:${colId}`)
    if (el) {
      el.focus({ preventScroll: false })
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [])

  const moveSelection = useCallback(
    (deltaRow: number, deltaCol: number, wrapRow = false) => {
      if (filteredRows.length === 0 || columns.length === 0) return
      if (!activeCell) {
        const firstRow = filteredRows[0]
        const firstCol = columns[0]
        if (firstRow && firstCol) {
          setActiveCell({ rowId: firstRow.testCaseId, colId: firstCol.id })
          setSelectedScope('cell')
          focusCellDom(firstRow.testCaseId, firstCol.id)
        }
        return
      }

      const curRowIdx = filteredRows.findIndex((r) => r.testCaseId === activeCell.rowId)
      const curColIdx = columns.findIndex((c) => c.id === activeCell.colId)
      if (curRowIdx === -1 || curColIdx === -1) return

      let nextRowIdx = curRowIdx + deltaRow
      let nextColIdx = curColIdx + deltaCol

      if (wrapRow) {
        if (nextColIdx >= columns.length) {
          nextColIdx = 0
          nextRowIdx += 1
        } else if (nextColIdx < 0) {
          nextColIdx = columns.length - 1
          nextRowIdx -= 1
        }
      }

      nextRowIdx = Math.max(0, Math.min(filteredRows.length - 1, nextRowIdx))
      nextColIdx = Math.max(0, Math.min(columns.length - 1, nextColIdx))

      const targetRow = filteredRows[nextRowIdx]
      const targetCol = columns[nextColIdx]
      if (targetRow && targetCol) {
        setEditingCell(null)
        setInitialEditChar(null)
        setActiveCell({ rowId: targetRow.testCaseId, colId: targetCol.id })
        setSelectedScope('cell')
        setTimeout(() => focusCellDom(targetRow.testCaseId, targetCol.id), 0)
      }
    },
    [filteredRows, columns, activeCell, focusCellDom],
  )

  const handleGridKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (editingCell || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) await handleRedo()
        else await handleUndo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        await handleRedo()
        return
      }

      if (!activeCell) return
      const curRowIdx = filteredRows.findIndex((r) => r.testCaseId === activeCell.rowId)
      const curRow = filteredRows[curRowIdx]
      const curCol = columns.find((c) => c.id === activeCell.colId)
      if (!curRow || !curCol) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        handleToggleColumnStyle({ bold: !curCol.bold })
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        const text = getCellText(curRow, curCol, curRowIdx)
        setCopiedCell(activeCell)
        await navigator.clipboard?.writeText(text).catch(() => {})
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        if (!canEdit) return
        const text = getCellText(curRow, curCol, curRowIdx)
        setCopiedCell(activeCell)
        await navigator.clipboard?.writeText(text).catch(() => {})
        await handleCommitCell(curRow, curCol, '')
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        if (!canEdit) return
        try {
          const clipText = await navigator.clipboard.readText()
          if (!clipText) return
          const clipRows = clipText.replace(/\r\n/g, '\n').split('\n')
          const startRowIdx = curRowIdx
          const startColIdx = columns.findIndex((c) => c.id === curCol.id)

          if (clipRows.length === 1 && !clipRows[0].includes('\t')) {
            await handleCommitCell(curRow, curCol, clipRows[0])
          } else {
            for (let rOffset = 0; rOffset < clipRows.length; rOffset++) {
              const line = clipRows[rOffset]
              if (rOffset === clipRows.length - 1 && line === '') continue
              const targetRow = filteredRows[startRowIdx + rOffset]
              if (!targetRow) break
              const cells = line.split('\t')
              for (let cOffset = 0; cOffset < cells.length; cOffset++) {
                const targetCol = columns[startColIdx + cOffset]
                if (!targetCol) break
                await handleCommitCell(targetRow, targetCol, cells[cOffset])
              }
            }
          }
          setCopiedCell(null)
        } catch {
          // ignore
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveSelection(1, 0)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveSelection(-1, 0)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveSelection(0, 1)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveSelection(0, -1)
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        moveSelection(0, e.shiftKey ? -1 : 1, true)
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          moveSelection(-1, 0)
        } else if (canEdit) {
          setInitialEditChar(null)
          setEditingCell(activeCell)
        } else {
          moveSelection(1, 0)
        }
        return
      }

      if (e.key === 'F2') {
        e.preventDefault()
        if (canEdit) {
          setInitialEditChar(null)
          setEditingCell(activeCell)
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (!canEdit) return
        await handleCommitCell(curRow, curCol, '')
        return
      }

      if (e.key === 'Escape') {
        setCopiedCell(null)
        return
      }

      if (
        canEdit &&
        curCol.kind !== 'req' &&
        curCol.kind !== 'result' &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault()
        setInitialEditChar(e.key)
        setEditingCell(activeCell)
      }
    },
    [
      editingCell,
      activeCell,
      filteredRows,
      columns,
      canEdit,
      handleUndo,
      handleRedo,
      handleToggleColumnStyle,
      getCellText,
      handleCommitCell,
      moveSelection,
    ],
  )

  const handleExportCsv = () => {
    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`
    const headerLine = ['#', ...columns.map((c) => c.label)].map(escapeCsv).join(',')
    const dataLines = rows.map((tc, rIdx) => {
      const cells = [String(rIdx + 1), ...columns.map((col) => getCellText(tc, col, rIdx))]
      return cells.map(escapeCsv).join(',')
    })
    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.key}_test_cases.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    try {
      const created = await testApi.createFolder(projectId, { name })
      const treeList = await testApi.tree(projectId)
      setTestTree(treeList)
      setSelectedFilter({ type: 'folder', id: created.folderId })
      setFolderModalOpen(false)
      setNewFolderName('')
    } catch (e) {
      notify(apiErrorMessage(e))
    }
  }

  const handleGenerateFromReq = async () => {
    const selectedReq = requirements.find((r) => r.id === genReqId)
    if (!selectedReq) {
      notify(t('Vui lòng chọn yêu cầu (REQ) để sinh kịch bản.', 'Please select a requirement (REQ).'))
      return
    }
    setGenerating(true)
    try {
      const criteria = selectedReq.acceptanceCriteria.map((c) => c.text.trim()).filter(Boolean)
      const figmaNote = genFigmaUrl.trim()
      const templates: CreateTestCaseBody[] =
        criteria.length > 0
          ? criteria.map((criterion, idx) => {
              const customFields: Record<string, string> = {}
              for (const col of columns) {
                if (col.kind === 'custom') {
                  customFields[col.id] = figmaNote && idx === 0 ? figmaNote : ''
                }
              }
              return {
                title: criterion,
                stepsText: t(
                  `1. Mở màn hình chức năng thuộc ${selectedReq.code}\n2. Thực hiện kiểm tra: ${criterion}`,
                  `1. Open ${selectedReq.code} screen\n2. Verify: ${criterion}`,
                ),
                expectedSummary: criterion,
                requirementRefs: [{ documentId: selectedReq.documentId, reqUid: selectedReq.reqUid }],
                requirementId: selectedReq.id,
                figmaUrl: figmaNote || undefined,
                lastResult: 'UNTESTED',
                customFields,
              }
            })
          : [
              {
                title: t(`Kiểm tra luồng chính: ${selectedReq.title}`, `Verify main flow: ${selectedReq.title}`),
                stepsText: t(
                  `1. Truy cập chức năng ${selectedReq.code}\n2. Nhập dữ liệu hợp lệ và thực thi`,
                  `1. Access ${selectedReq.code}\n2. Enter valid data and submit`,
                ),
                expectedSummary: t(
                  `Hệ thống xử lý đúng theo đặc tả ${selectedReq.code}: ${selectedReq.title}`,
                  `System behaves according to ${selectedReq.code}: ${selectedReq.title}`,
                ),
                requirementRefs: [{ documentId: selectedReq.documentId, reqUid: selectedReq.reqUid }],
                requirementId: selectedReq.id,
                figmaUrl: figmaNote || undefined,
                lastResult: 'UNTESTED',
                customFields: {},
              },
              {
                title: t(
                  `Kiểm tra ngoại lệ & biên: ${selectedReq.title}`,
                  `Verify boundary & negative case: ${selectedReq.title}`,
                ),
                stepsText: t(
                  `1. Truy cập chức năng ${selectedReq.code}\n2. Nhập dữ liệu trống hoặc sai định dạng`,
                  `1. Access ${selectedReq.code}\n2. Submit empty or invalid input`,
                ),
                expectedSummary: t(
                  'Hiển thị thông báo lỗi hợp lệ và từ chối xử lý dữ liệu sai',
                  'Displays validation error and rejects invalid input',
                ),
                requirementRefs: [{ documentId: selectedReq.documentId, reqUid: selectedReq.reqUid }],
                requirementId: selectedReq.id,
                figmaUrl: figmaNote || undefined,
                lastResult: 'UNTESTED',
                customFields: {},
              },
            ]

      const createdList: TestCaseSummaryDto[] = []
      for (const item of templates) {
        const created = await testApi.create(projectId, item)
        createdList.push(created)
      }
      setRows((prev) => {
        const next = [...prev, ...createdList]
        saveRowOrder(
          projectId,
          next.map((r) => r.testCaseId),
        )
        return next
      })
      setGenOpen(false)
      setGenReqId('')
      setGenFigmaUrl('')
    } catch (e) {
      notify(apiErrorMessage(e))
    } finally {
      setGenerating(false)
    }
  }

  const activeCellCoordinate = useMemo(() => {
    if (!activeCell) return 'A1'
    const cIdx = columns.findIndex((c) => c.id === activeCell.colId)
    const rIdx = filteredRows.findIndex((r) => r.testCaseId === activeCell.rowId)
    if (cIdx === -1 || rIdx === -1) return 'A1'
    if (selectedScope === 'row') return `R${rIdx + 1}`
    if (selectedScope === 'col') return `C:${colIndexToLetter(cIdx)}`
    return `${colIndexToLetter(cIdx)}${rIdx + 1}`
  }, [activeCell, columns, filteredRows, selectedScope])

  const autoMermaidCode = useMemo(
    () => buildCaseMermaidDiagram(project.name, requirements, filteredRows, diagramMode),
    [project.name, requirements, filteredRows, diagramMode],
  )

  const effectiveMermaidCode = customMermaid ?? autoMermaidCode

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Active Context metadata (hiển thị ở đầu không gian soạn thảo giống hệt trang Document)
  const activeContextInfo = useMemo(() => {
    if (selectedFilter.type === 'req' && selectedFilter.id) {
      const r = requirements.find((item) => item.id === selectedFilter.id)
      if (r) {
        const doc = docNodes.find((d) => d.documentId === r.documentId)
        return {
          code: r.code,
          parentDoc: doc ? `${doc.code} ${doc.title}` : r.documentCode,
          title: r.title,
          subtitle: t(
            'Đặc tả kịch bản kiểm thử chi tiết và ma trận truy xuất cho yêu cầu chức năng này.',
            'Detailed test cases and traceability matrix for this functional requirement.',
          ),
          status: 'APPROVED' as const,
        }
      }
    }
    if (selectedFilter.type === 'doc' && selectedFilter.id) {
      const doc = docNodes.find((d) => d.documentId === Number(selectedFilter.id))
      if (doc) {
        return {
          code: doc.code,
          parentDoc: project.name,
          title: doc.title,
          subtitle: t(
            'Tổng hợp toàn bộ kịch bản kiểm thử thuộc tài liệu đặc tả này.',
            'All test cases specified under this document.',
          ),
          status: (doc.currentVersion?.status as any) ?? 'APPROVED',
        }
      }
    }
    if (selectedFilter.type === 'folder' && selectedFilter.id) {
      const f = testTree.find((t) => t.id === `folder-${selectedFilter.id}`)
      return {
        code: 'FOLDER',
        parentDoc: project.name,
        title: f?.label ?? t('Thư mục kiểm thử', 'Test Folder'),
        subtitle: t('Các kịch bản kiểm thử phân loại theo thư mục.', 'Test cases organized under this folder.'),
        status: null,
      }
    }
    if (selectedFilter.type === 'unlinked') {
      return {
        code: 'UNLINKED',
        parentDoc: project.name,
        title: t('Kịch bản chưa gắn REQ', 'Unlinked test cases'),
        subtitle: t(
          'Danh sách các kịch bản kiểm thử tự do, chưa được liên kết với mã yêu cầu (REQ).',
          'Free test cases not linked to any requirement specification.',
        ),
        status: null,
      }
    }
    return {
      code: project.key,
      parentDoc: project.name,
      title: t('Tất cả kịch bản kiểm thử', 'All test cases'),
      subtitle: t(
        'Ma trận kiểm thử tổng thể, quản lý trực tiếp bằng bảng tính chuẩn Excel doanh nghiệp.',
        'Overall project test matrix, managed in an enterprise spreadsheet interface.',
      ),
      status: null,
    }
  }, [selectedFilter, requirements, docNodes, testTree, project, t])

  const passCount = filteredRows.filter((r) => r.lastResult === 'PASS').length
  const failCount = filteredRows.filter((r) => r.lastResult === 'FAIL').length
  const untestedCount = filteredRows.filter((r) => !r.lastResult || r.lastResult === 'UNTESTED').length

  if (loading && rows.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-6">
        <LoadingBlock label={t('Đang tải kiểm thử…', 'Loading test cases…')} />
      </div>
    )
  }

  if (error && rows.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-6">
        <ErrorState message={apiErrorMessage(error)} onRetry={reloadData} />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
      {/* 1. THANH CÂY TÀI LIỆU & REQ BÊN TRÁI (GIỐNG Y ĐÚC TAB DOCUMENT) */}
      <aside
        aria-label={t('Cây kịch bản', 'Test case tree')}
        className={clsx(
          'flex w-[264px] shrink-0 flex-col border-r border-gray-200 bg-gray-50 transition-all',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-[min(18rem,85vw)] max-lg:shadow-float',
          !treeOpen && 'hidden',
        )}
      >
        {/* Header cây trang */}
        <div
          className={clsx(
            'flex shrink-0 items-center gap-1.5 p-2.5',
            fullscreen && 'h-[52px] border-b border-gray-200 lg:py-0',
          )}
        >
          <SearchInput
            className="min-w-0 flex-1"
            value={search}
            onChange={setSearch}
            label={t('Tìm kiếm…', 'Search…')}
            placeholder={t('Tìm kiếm…', 'Search…')}
          />
          {canEdit && (
            <div ref={newMenu.ref} className="relative">
              <Button
                inline
                variant="secondary"
                onClick={() => newMenu.setOpen((v) => !v)}
                aria-expanded={newMenu.open}
                className="px-2.5 lg:h-9"
              >
                <PlusIcon className="h-4 w-4" />
                {t('Mới', 'New')}
              </Button>
              {newMenu.open && (
                <div className={clsx(menuPanel, 'right-0 top-full w-56')} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    onClick={() => {
                      newMenu.setOpen(false)
                      void handleAddRow()
                    }}
                  >
                    <PageIcon className="text-gray-500" />
                    {t('Thêm kịch bản mới', 'New test case')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    onClick={() => {
                      newMenu.setOpen(false)
                      if (!genReqId && requirements[0]) setGenReqId(requirements[0].id)
                      setGenOpen(true)
                    }}
                  >
                    <SparklesIcon className="h-4 w-4 text-gray-500" />
                    {t('Sinh từ Yêu cầu', 'Generate from REQ')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={menuItem}
                    onClick={() => {
                      newMenu.setOpen(false)
                      setFolderModalOpen(true)
                    }}
                  >
                    <FolderIcon className="h-4 w-4 text-gray-500" />
                    {t('Thư mục mới', 'New folder')}
                  </button>
                </div>
              )}
            </div>
          )}
          <IconButton
            label={t('Ẩn cây trang', 'Hide page tree')}
            onClick={() => setTreeOpen(false)}
            className={clsx('hidden', !fullscreen && 'lg:inline-flex')}
          >
            <SidebarIcon />
          </IconButton>
        </div>

        {/* Nội dung danh sách cây */}
        <div className={clsx('min-h-0 flex-1 overflow-y-auto px-2 pb-4', fullscreen && 'pt-2')}>
          {/* Mục: Tất cả tài liệu / kịch bản */}
          <button
            type="button"
            onClick={() => setSelectedFilter({ type: 'all' })}
            className={clsx(
              'mb-1.5 mt-0.5 flex min-h-9 w-full items-center justify-between rounded-control px-2.5 text-sm font-medium transition-colors lg:min-h-8',
              selectedFilter.type === 'all'
                ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-200'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
            )}
          >
            <span className="truncate">{t('Tất cả kịch bản', 'All test cases')}</span>
            <span className="ml-2 font-mono text-xs text-gray-500">{rows.length}</span>
          </button>

          {/* Nhóm tài liệu & REQ */}
          <nav aria-label={t('Cây tài liệu & REQ', 'Document & REQ tree')}>
            <ul className="space-y-px">
              {docNodes.map((doc) => {
                const docKey = `doc-${doc.documentId}`
                const isDocOpen = expandedNodes.has(docKey)
                const docReqs = requirements.filter((r) => r.documentId === doc.documentId)
                const docCases = rows.filter((tc) => tc.requirements.some((r) => r.documentId === doc.documentId))
                const isDocActive = selectedFilter.type === 'doc' && selectedFilter.id === doc.documentId

                return (
                  <li key={doc.documentId}>
                    <div
                      className={clsx(
                        'group relative flex min-h-9 items-center gap-1.5 rounded-control pr-1 text-sm transition-colors lg:min-h-8',
                        isDocActive
                          ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200'
                          : 'text-gray-700 hover:bg-gray-100',
                      )}
                      style={{ paddingLeft: 6 }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(docKey)}
                        className="flex h-5 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700"
                      >
                        <ChevronRight className={clsx('h-3 w-3 transition-transform', isDocOpen && 'rotate-90')} />
                      </button>
                      <FolderIcon className="h-4 w-4 shrink-0 text-gray-500" />
                      <button
                        type="button"
                        onClick={() => setSelectedFilter({ type: 'doc', id: doc.documentId })}
                        className="flex min-w-0 flex-1 items-center py-1 text-left"
                      >
                        <span className="truncate font-medium">
                          {doc.code && <span className="mr-1.5 tabular-nums text-gray-500">{doc.code}</span>}
                          {doc.title}
                        </span>
                      </button>
                      {docCases.length > 0 && (
                        <span className="font-mono text-xs text-gray-400">{docCases.length}</span>
                      )}
                    </div>

                    {/* Danh sách REQ con của tài liệu */}
                    {isDocOpen && docReqs.length > 0 && (
                      <ul className="space-y-px">
                        {docReqs.map((req) => {
                          const reqCases = rows.filter(
                            (tc) =>
                              String(tc.requirementId) === req.id ||
                              tc.requirements.some((r) => `${r.documentId}:${r.reqUid}` === req.id),
                          )
                          const isReqActive = selectedFilter.type === 'req' && selectedFilter.id === req.id

                          return (
                            <li key={req.id}>
                              <div
                                className={clsx(
                                  'group relative flex min-h-9 items-center gap-1.5 rounded-control pr-1 text-sm transition-colors lg:min-h-8',
                                  isReqActive
                                    ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200'
                                    : 'text-gray-700 hover:bg-gray-100',
                                )}
                                style={{ paddingLeft: 24 }}
                              >
                                <PageIcon className="h-4 w-4 shrink-0 text-gray-500" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedFilter({ type: 'req', id: req.id })}
                                  className="flex min-w-0 flex-1 items-center py-1 text-left"
                                >
                                  <span className="truncate">
                                    <span className="mr-1.5 font-mono text-xs tabular-nums text-gray-500">
                                      {req.code}
                                    </span>
                                    {req.title}
                                  </span>
                                </button>
                                <LockIcon className="h-3.5 w-3.5 text-gray-400" />
                                <span className="font-mono text-xs text-gray-400">{reqCases.length}</span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}

              {/* Thư mục tùy chỉnh */}
              {testTree
                .filter((t) => t.kind === 'FOLDER')
                .map((f) => {
                  const fId = Number(f.id.replace('folder-', ''))
                  const isFolderActive = selectedFilter.type === 'folder' && selectedFilter.id === fId
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedFilter({ type: 'folder', id: fId })}
                        className={clsx(
                          'group relative flex min-h-9 w-full items-center gap-1.5 rounded-control px-2 text-sm transition-colors lg:min-h-8',
                          isFolderActive
                            ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200'
                            : 'text-gray-700 hover:bg-gray-100',
                        )}
                      >
                        <FolderIcon className="h-4 w-4 shrink-0 text-gray-500" />
                        <span className="min-w-0 flex-1 truncate text-left">{f.label}</span>
                        <span className="font-mono text-xs text-gray-400">{f.testCount}</span>
                      </button>
                    </li>
                  )
                })}

              {/* Mục Chưa gắn REQ */}
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedFilter({ type: 'unlinked' })}
                  className={clsx(
                    'group relative mt-2 flex min-h-9 w-full items-center gap-1.5 rounded-control px-2 text-sm transition-colors lg:min-h-8',
                    selectedFilter.type === 'unlinked'
                      ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{t('Chưa gắn REQ', 'Unlinked to REQ')}</span>
                  <span className="font-mono text-xs text-gray-400">
                    {rows.filter((tc) => tc.requirements.length === 0 && !tc.requirementId).length}
                  </span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* 2. KHÔNG GIAN SOẠN THẢO BÊN PHẢI (GIỐNG Y ĐÚC TAB DOCUMENT VÀ CÓ THỂ PHÓNG TO TOÀN MÀN HÌNH) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {/* Top bar chính của view */}
        <div
          className={clsx(
            'flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 sm:px-4',
            fullscreen ? 'h-[52px]' : 'h-12',
          )}
        >
          {/* Nút toggle Sidebar */}
          {!treeOpen ? (
            <IconButton label={t('Hiện cây trang', 'Show page tree')} onClick={() => setTreeOpen(true)}>
              <SidebarIcon />
            </IconButton>
          ) : (
            <IconButton
              label={t('Ẩn cây trang', 'Hide page tree')}
              onClick={() => setTreeOpen(false)}
              className="lg:hidden"
            >
              <SidebarIcon />
            </IconButton>
          )}

          {/* Đường dẫn Breadcrumb chuẩn Document */}
          <p className="min-w-0 flex-1 truncate text-sm text-gray-500">
            {fullscreen && <span className="font-semibold text-gray-950">{project.name} / </span>}
            {activeContextInfo.parentDoc && (
              <span className="hidden sm:inline">{activeContextInfo.parentDoc} / </span>
            )}
            <span className="font-medium text-gray-900">
              {activeContextInfo.code !== project.key && `${activeContextInfo.code} `}
              {activeContextInfo.title}
            </span>
          </p>

          {/* Thanh công cụ phải */}
          <div className="flex items-center gap-1.5">
            {/* Đổ màu ô Pastel */}
            <div
              className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1"
              title={t('Đổ màu nền Pastel cho ô / hàng / cột đang chọn', 'Fill with pastel color')}
            >
              <span className="mr-0.5 select-none text-[11px] font-medium text-gray-500">{t('Màu ô', 'Color')}:</span>
              {PASTEL_PALETTE.map((swatch) => {
                const isSelectedColor = activeCellColor === swatch.hex
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    disabled={!activeCell || !canEdit}
                    onClick={() => handleApplyPastelColor(swatch.hex)}
                    title={t(swatch.labelVi, swatch.labelEn)}
                    style={{ backgroundColor: swatch.hex || '#FFFFFF' }}
                    className={clsx(
                      'relative h-4 w-4 rounded-sm border transition-transform hover:scale-110 disabled:opacity-40',
                      isSelectedColor ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300',
                    )}
                  >
                    {!swatch.hex && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                        /
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Sơ đồ Case */}
            <Button
              inline
              variant="secondary"
              onClick={() => setDiagramOpen((v) => !v)}
              className={clsx('h-9 px-2.5', diagramOpen && 'border-brand-500 text-brand-700')}
            >
              <DiagramIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('Sơ đồ Case', 'Case Diagram')}</span>
            </Button>

            {/* Sinh tự động */}
            {canManage && (
              <Button
                inline
                variant="secondary"
                onClick={() => {
                  if (!genReqId && requirements[0]) setGenReqId(requirements[0].id)
                  setGenOpen(true)
                }}
                className="h-9 px-2.5"
              >
                <SparklesIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t('Sinh từ REQ', 'Generate')}</span>
              </Button>
            )}

            {/* Thêm kịch bản */}
            {canManage && (
              <Button inline variant="primary" onClick={() => void handleAddRow()} className="h-9 px-2.5">
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t('Thêm dòng', 'Add row')}</span>
              </Button>
            )}

            {/* Tùy chọn ngắt dòng */}
            <button
              type="button"
              onClick={() => updatePrefs({ wrapText: !prefs.wrapText })}
              className={clsx(
                'hidden h-9 items-center rounded-control border px-2.5 text-xs font-medium transition-colors sm:inline-flex',
                prefs.wrapText
                  ? 'border-gray-300 bg-gray-100 text-gray-900'
                  : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50',
              )}
            >
              {t('Ngắt dòng', 'Wrap')}
            </button>

            {/* Xuất CSV */}
            <Button inline variant="secondary" onClick={handleExportCsv} className="hidden h-9 px-2.5 sm:inline-flex">
              {t('Xuất CSV', 'Export CSV')}
            </Button>

            {/* Nút Thu nhỏ khi ở chế độ toàn màn hình (ở chế độ chuẩn đã có nút ở góc phải header dự án) */}
            {fullscreen && (
              <IconButton
                label={t('Thoát toàn màn hình (Esc)', 'Exit full screen (Esc)')}
                onClick={() => setFullscreen(false)}
                className="border border-gray-200 text-gray-600"
              >
                <ShrinkIcon />
              </IconButton>
            )}
          </div>
        </div>

        {/* Nội dung soạn thảo cuộn theo chiều dọc */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-6 py-6 sm:px-8">
            {/* Context Heading chuẩn giao diện Document trong ảnh người dùng */}
            <header className="mb-6 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Chip>{activeContextInfo.code}</Chip>
                {activeContextInfo.status && <StatusPill status={activeContextInfo.status} />}
                <span className="text-xs text-gray-500">
                  {t('Tổng cộng', 'Total')}: <strong>{filteredRows.length}</strong> ·{' '}
                  <span className="text-emerald-600 font-medium">{t('Đạt', 'Pass')}: {passCount}</span> ·{' '}
                  <span className="text-rose-600 font-medium">{t('Lỗi', 'Fail')}: {failCount}</span> ·{' '}
                  <span className="text-gray-500">{t('Chưa chạy', 'Untested')}: {untestedCount}</span>
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {activeContextInfo.title}
              </h1>
              <p className="text-sm text-gray-600">{activeContextInfo.subtitle}</p>
            </header>

            {/* Khối Sơ đồ Mermaid (nếu được mở) giống sơ đồ ở ảnh người dùng */}
            {diagramOpen && (
              <div className="mb-6 rounded-card border border-gray-200 bg-white p-4 shadow-xs">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <DiagramIcon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-900">
                      {t('Sơ đồ luồng kiểm thử (Mermaid Flowchart)', 'Test Flow Diagram')}
                    </span>
                    <select
                      value={diagramMode}
                      onChange={(e) => {
                        setDiagramMode(e.target.value as DiagramMode)
                        setCustomMermaid(null)
                      }}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-brand-600 focus:outline-none"
                    >
                      <option value="flowchart_lr">{t('Lưu đồ ngang (LR)', 'Horizontal Flowchart')}</option>
                      <option value="flowchart_td">{t('Sơ đồ phân cấp dọc (TD)', 'Vertical Hierarchy')}</option>
                      <option value="sequence">{t('Sơ đồ tuần tự', 'Sequence Diagram')}</option>
                    </select>
                    {customMermaid !== null && (
                      <button
                        type="button"
                        onClick={() => setCustomMermaid(null)}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        {t('Đồng bộ lại', 'Reset')}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <DiagramTabs value={diagramTab} onChange={setDiagramTab} />
                    <button
                      type="button"
                      onClick={() => setDiagramOpen(false)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {diagramTab === 'diagram' ? (
                  <div className="max-h-[340px] overflow-auto">
                    <MermaidPreview code={effectiveMermaidCode} />
                  </div>
                ) : (
                  <textarea
                    rows={8}
                    value={effectiveMermaidCode}
                    onChange={(e) => setCustomMermaid(e.target.value)}
                    className="w-full rounded-control border border-gray-300 p-2.5 font-mono text-xs text-gray-800 focus:border-brand-600 focus:outline-none"
                  />
                )}
              </div>
            )}

            {/* BẢNG EXCEL VÀ THANH FORMULA */}
            <div className="overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs">
              {/* Thanh công thức fx */}
              <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs">
                <span className="inline-flex min-w-[56px] items-center justify-center rounded border border-gray-300 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-gray-800 shadow-xs">
                  {activeCellCoordinate}
                </span>
                <span className="select-none font-mono text-xs italic text-gray-400">fx</span>
                <input
                  type="text"
                  value={formulaDraft}
                  disabled={!activeCell || !canEdit || activeColumn?.kind === 'req' || activeColumn?.kind === 'result'}
                  placeholder={
                    activeColumn
                      ? `${activeColumn.label}…`
                      : t('Chọn một ô để xem hoặc sửa nội dung…', 'Select a cell to view or edit…')
                  }
                  onChange={(e) => setFormulaDraft(e.target.value)}
                  onBlur={() => {
                    if (!activeCell || !activeColumn) return
                    const targetRow = rows.find((r) => r.testCaseId === activeCell.rowId)
                    if (targetRow) void handleCommitCell(targetRow, activeColumn, formulaDraft)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      ;(e.target as HTMLInputElement).blur()
                      moveSelection(1, 0)
                    }
                  }}
                  className="w-full bg-transparent py-0.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:text-gray-400"
                />
              </div>

              {/* Bảng tính */}
              <div
                onKeyDown={(e) => void handleGridKeyDown(e)}
                className="max-h-[60dvh] overflow-auto bg-white"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    {/* Hàng chữ cái cột A, B, C */}
                    <tr className="border-b border-gray-200 bg-gray-100 text-[11px] font-mono text-gray-500 select-none">
                      <th className="w-10 border-r border-gray-200 py-1 text-center">#</th>
                      {columns.map((col, idx) => {
                        const isColActive = activeCell?.colId === col.id
                        return (
                          <th
                            key={`letter-${col.id}`}
                            onClick={() => {
                              const firstRowId = filteredRows[0]?.testCaseId ?? rows[0]?.testCaseId
                              if (firstRowId) {
                                setActiveCell({ rowId: firstRowId, colId: col.id })
                                setSelectedScope('col')
                              }
                            }}
                            style={{ width: col.width ?? 200, minWidth: col.width ?? 140 }}
                            title={t('Nhấp để chọn toàn bộ cột này', 'Click to select column')}
                            className={clsx(
                              'cursor-pointer border-r border-gray-200 py-1 text-center transition-colors hover:bg-gray-200/60',
                              isColActive && 'bg-gray-200 font-semibold text-gray-950',
                            )}
                          >
                            {colIndexToLetter(idx)}
                          </th>
                        )
                      })}
                      {canManage && <th className="w-10 py-1 text-center">+</th>}
                    </tr>

                    {/* Hàng tên cột */}
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
                      <th
                        className="w-10 border-r border-gray-200 px-1.5 py-2 text-center font-mono text-[11px] text-gray-400 select-none"
                        title={t('Kéo thả STT để đổi vị trí dòng', 'Drag row number to reorder')}
                      >
                        STT
                      </th>
                      {columns.map((col) => {
                        const isDragOver = dragOverColId === col.id && draggedColId !== col.id
                        return (
                          <th
                            key={col.id}
                            draggable={canManage}
                            onDragStart={(e) => {
                              setDraggedColId(col.id)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              if (draggedColId && draggedColId !== col.id) setDragOverColId(col.id)
                            }}
                            onDragLeave={() => {
                              if (dragOverColId === col.id) setDragOverColId(null)
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              handleColumnDrop(col.id)
                            }}
                            onDragEnd={() => {
                              setDraggedColId(null)
                              setDragOverColId(null)
                            }}
                            style={{ width: col.width ?? 200, minWidth: col.width ?? 140 }}
                            className={clsx(
                              'group relative border-r border-gray-200 px-2 py-1.5 transition-colors',
                              draggedColId === col.id && 'opacity-50',
                              isDragOver && 'border-l-2 border-l-brand-600 bg-white',
                              activeCell?.colId === col.id && 'bg-white text-gray-950',
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              {canManage && (
                                <span
                                  title={t('Giữ và kéo để di chuyển cột', 'Drag to move column')}
                                  className="cursor-grab select-none px-0.5 text-gray-400 hover:text-gray-700 active:cursor-grabbing"
                                >
                                  ⋮⋮
                                </span>
                              )}
                              <ColumnHeaderInput
                                value={col.label}
                                disabled={!canManage}
                                onFocus={() => {
                                  if (rows[0]) {
                                    setActiveCell({ rowId: rows[0].testCaseId, colId: col.id })
                                    setSelectedScope('col')
                                  }
                                }}
                                onCommit={(val) => handleRenameColumn(col.id, val)}
                              />
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteColumn(col.id)}
                                  title={t('Xóa cột này', 'Delete column')}
                                  className="shrink-0 rounded px-1 text-xs text-gray-400 opacity-60 hover:bg-gray-100 hover:text-red-600 group-hover:opacity-100"
                                >
                                  <CloseIcon className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <ColumnResizer
                              initialWidth={col.width ?? 200}
                              onResize={(w) => handleResizeColumn(col.id, w)}
                            />
                          </th>
                        )
                      })}
                      {canManage && (
                        <th className="w-10 px-1 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={handleAddColumn}
                            title={t('Thêm cột mới', 'Add column')}
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.length + (canManage ? 2 : 1)}
                          className="px-6 py-12 text-center text-sm text-gray-500"
                        >
                          <p className="mb-3">{t('Chưa có kịch bản nào.', 'No test cases yet.')}</p>
                          {canManage && (
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <Button inline variant="primary" onClick={() => void handleAddRow()}>
                                <PlusIcon className="h-4 w-4" />
                                {t('Thêm dòng đầu tiên', 'Add first row')}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((tc, index) => (
                        <SpreadsheetRow
                          key={tc.testCaseId}
                          tc={tc}
                          index={index}
                          columns={columns}
                          prefs={prefs}
                          cellColors={cellColors}
                          requirements={requirements}
                          canManage={canManage}
                          canEdit={canEdit}
                          activeColId={activeCell?.rowId === tc.testCaseId ? activeCell.colId : null}
                          editingColId={editingCell?.rowId === tc.testCaseId ? editingCell.colId : null}
                          initialEditChar={editingCell?.rowId === tc.testCaseId ? initialEditChar : null}
                          selectedScope={activeCell?.rowId === tc.testCaseId ? selectedScope : 'cell'}
                          copiedColId={copiedCell?.rowId === tc.testCaseId ? copiedCell.colId : null}
                          isDragged={draggedRowId === tc.testCaseId}
                          isDragOver={dragOverRowId === tc.testCaseId && draggedRowId !== tc.testCaseId}
                          registerCellRef={(colId, el) => {
                            const key = `${tc.testCaseId}:${colId}`
                            if (el) cellDomRefs.current.set(key, el)
                            else cellDomRefs.current.delete(key)
                          }}
                          onSelectRow={() => {
                            const firstCol = columns[0]?.id ?? 'req'
                            setEditingCell(null)
                            setActiveCell({ rowId: tc.testCaseId, colId: firstCol })
                            setSelectedScope('row')
                            focusCellDom(tc.testCaseId, firstCol)
                          }}
                          onSelectCell={(colId) => {
                            if (editingCell?.rowId !== tc.testCaseId || editingCell?.colId !== colId) {
                              setEditingCell(null)
                              setInitialEditChar(null)
                            }
                            setActiveCell({ rowId: tc.testCaseId, colId })
                            setSelectedScope('cell')
                          }}
                          onStartEditCell={(colId, initialChar = null) => {
                            if (!canEdit) return
                            setActiveCell({ rowId: tc.testCaseId, colId })
                            setSelectedScope('cell')
                            setInitialEditChar(initialChar)
                            setEditingCell({ rowId: tc.testCaseId, colId })
                          }}
                          onExitEditCell={(moveDeltaRow, moveDeltaCol, wrap) => {
                            setEditingCell(null)
                            setInitialEditChar(null)
                            if (moveDeltaRow !== 0 || moveDeltaCol !== 0) {
                              moveSelection(moveDeltaRow, moveDeltaCol, wrap)
                            } else {
                              setTimeout(() => {
                                if (activeCell) focusCellDom(activeCell.rowId, activeCell.colId)
                              }, 0)
                            }
                          }}
                          onRowDragStart={() => setDraggedRowId(tc.testCaseId)}
                          onRowDragOver={() => {
                            if (draggedRowId !== null && draggedRowId !== tc.testCaseId) {
                              setDragOverRowId(tc.testCaseId)
                            }
                          }}
                          onRowDragLeave={() => {
                            if (dragOverRowId === tc.testCaseId) setDragOverRowId(null)
                          }}
                          onRowDrop={() => handleRowDrop(tc.testCaseId)}
                          onRowDragEnd={() => {
                            setDraggedRowId(null)
                            setDragOverRowId(null)
                          }}
                          onCommitCell={(col, val) => void handleCommitCell(tc, col, val)}
                          onMarkFresh={handleMarkFresh}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer của bảng */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>
                    {t('Dòng', 'Rows')}: <strong className="font-mono text-gray-900">{filteredRows.length}</strong>
                  </span>
                  <span>
                    {t('Cột', 'Cols')}: <strong className="font-mono text-gray-900">{columns.length}</strong>
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => void handleAddRow()}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      + {t('Thêm dòng mới', 'Add row')}
                    </button>
                  )}
                </div>
                <div className="font-mono text-[11px] text-gray-400">
                  {t('Phím tắt: ↑↓←→ Di chuyển · Enter/F2 Sửa · Alt+Enter Xuống dòng · Ctrl+Z/Y', 'Keys: Arrows · Enter/F2 · Alt+Enter · Ctrl+Z/Y')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Thư mục */}
      <Modal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        title={t('Tạo thư mục kịch bản mới', 'New test case folder')}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button inline variant="secondary" onClick={() => setFolderModalOpen(false)}>
              {t('Hủy', 'Cancel')}
            </Button>
            <Button inline variant="primary" onClick={() => void handleCreateFolder()} disabled={!newFolderName.trim()}>
              {t('Tạo thư mục', 'Create folder')}
            </Button>
          </div>
        }
      >
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-900">
            {t('Tên thư mục', 'Folder name')}
          </label>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t('VD: Kiểm thử Thanh toán, Regression Sprint 2…', 'e.g., Payment Tests…')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) void handleCreateFolder()
            }}
            className="w-full rounded-control border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-600 focus:outline-none"
          />
        </div>
      </Modal>

      {/* Modal Sinh kịch bản từ REQ */}
      <Modal
        open={genOpen}
        onClose={() => !generating && setGenOpen(false)}
        title={t('Sinh kịch bản kiểm thử (Tùy chọn)', 'Generate test cases')}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button inline variant="secondary" onClick={() => setGenOpen(false)} disabled={generating}>
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              inline
              variant="primary"
              onClick={handleGenerateFromReq}
              isLoading={generating}
              disabled={!genReqId}
            >
              {t('Tạo kịch bản', 'Create test cases')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-900">
              {t('Yêu cầu (REQ)', 'Requirement (REQ)')} <span className="text-red-500">*</span>
            </label>
            <select
              value={genReqId}
              onChange={(e) => setGenReqId(e.target.value)}
              className="w-full rounded-control border border-gray-300 px-3 py-2 font-mono text-xs text-gray-900 focus:border-brand-600 focus:outline-none"
            >
              <option value="">{t('-- Chọn mã REQ --', '-- Select REQ --')}</option>
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} ({r.documentCode}) — {r.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-900">
              {t('Đường dẫn Figma (Tùy chọn)', 'Figma URL (Optional)')}
            </label>
            <input
              type="url"
              value={genFigmaUrl}
              onChange={(e) => setGenFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/file/..."
              className="w-full rounded-control border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-600 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  )
}

function ColumnHeaderInput({
  value,
  disabled,
  onFocus,
  onCommit,
}: {
  value: string
  disabled: boolean
  onFocus?: () => void
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <input
      type="text"
      value={draft}
      disabled={disabled}
      onFocus={onFocus}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() && draft.trim() !== value) onCommit(draft.trim())
        else setDraft(value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setDraft(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-gray-800 hover:border-gray-300 focus:border-brand-600 focus:bg-white focus:outline-none"
    />
  )
}

function ColumnResizer({
  initialWidth,
  onResize,
}: {
  initialWidth: number
  onResize: (nextWidth: number) => void
}) {
  const startXRef = useRef(0)
  const startWidthRef = useRef(initialWidth)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = initialWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current
      onResize(startWidthRef.current + delta)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      title="Kéo để chỉnh độ rộng cột"
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-brand-600/40"
    />
  )
}

function SpreadsheetRow({
  tc,
  index,
  columns,
  prefs,
  cellColors,
  requirements,
  canManage,
  canEdit,
  activeColId,
  editingColId,
  initialEditChar,
  selectedScope,
  copiedColId,
  isDragged,
  isDragOver,
  registerCellRef,
  onSelectRow,
  onSelectCell,
  onStartEditCell,
  onExitEditCell,
  onRowDragStart,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
  onRowDragEnd,
  onCommitCell,
  onMarkFresh,
}: {
  tc: TestCaseSummaryDto
  index: number
  columns: TestColumnConfig[]
  prefs: SheetPrefs
  cellColors: Record<string, string>
  requirements: ProjectRequirementItem[]
  canManage: boolean
  canEdit: boolean
  activeColId: string | null
  editingColId: string | null
  initialEditChar: string | null
  selectedScope: 'cell' | 'row' | 'col'
  copiedColId: string | null
  isDragged: boolean
  isDragOver: boolean
  registerCellRef: (colId: string, el: HTMLTableCellElement | null) => void
  onSelectRow: () => void
  onSelectCell: (colId: string) => void
  onStartEditCell: (colId: string, initialChar?: string | null) => void
  onExitEditCell: (moveDeltaRow: number, moveDeltaCol: number, wrap?: boolean) => void
  onRowDragStart: () => void
  onRowDragOver: () => void
  onRowDragLeave: () => void
  onRowDrop: () => void
  onRowDragEnd: () => void
  onCommitCell: (col: TestColumnConfig, nextValue: string) => void
  onMarkFresh: (testCaseId: number) => Promise<void>
}) {
  const { t } = useI18n()

  const linkedReq = tc.requirements[0]
  const currentReqValue =
    (tc.requirementId ? String(tc.requirementId) : '') ||
    (linkedReq ? `${linkedReq.documentId}:${linkedReq.reqUid}` : '')

  const isStale = tc.needsReview || tc.requirements.some((r) => Boolean(r.changedNote))
  const tcCode =
    tc.code ||
    tc.key.replace(/^TC-(\d+)$/, (_, d) => `TC-${String(d).padStart(3, '0')}`) ||
    `TC-${String(index + 1).padStart(3, '0')}`
  const statusValue = normalizeRowStatus(tc.lastResult)

  const densityPadding =
    prefs.density === 'compact' ? 'py-0.5' : prefs.density === 'comfortable' ? 'py-2.5' : 'py-1'

  const getCellValue = (col: TestColumnConfig): string => {
    if (col.kind === 'code') return tcCode
    if (col.kind === 'title') return tc.title ?? ''
    if (col.kind === 'steps') {
      if (tc.stepsText !== undefined) return tc.stepsText
      return (tc.steps ?? []).map((s) => s.action).filter(Boolean).join('\n')
    }
    if (col.kind === 'expected') return tc.expectedSummary ?? ''
    return tc.customFields?.[col.id] ?? ''
  }

  return (
    <tr
      onDragOver={(e) => {
        e.preventDefault()
        onRowDragOver()
      }}
      onDragLeave={onRowDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        onRowDrop()
      }}
      className={clsx(
        'align-top transition-colors',
        isDragged && 'opacity-40',
        isDragOver && 'border-t-2 border-t-brand-600 bg-gray-50',
      )}
    >
      {/* Cột 0: STT */}
      <td
        draggable={canManage}
        onClick={onSelectRow}
        onDragStart={(e) => {
          onRowDragStart()
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={onRowDragEnd}
        title={t('Nhấp để chọn cả hàng · Giữ và kéo để di chuyển', 'Click row · Drag to move')}
        className={clsx(
          'w-10 select-none border-r border-gray-200 bg-gray-50 px-1.5 text-center font-mono text-xs text-gray-400',
          densityPadding,
          canManage && 'cursor-grab hover:bg-gray-100 hover:text-gray-900 active:cursor-grabbing',
          activeColId && 'bg-gray-100 font-semibold text-gray-900',
        )}
      >
        <div className="flex items-center justify-center gap-0.5">
          <span className="text-[10px] opacity-60">⋮</span>
          <span>{index + 1}</span>
        </div>
      </td>

      {/* Cột động */}
      {columns.map((col) => {
        const isCellActive = activeColId === col.id || (Boolean(activeColId) && selectedScope === 'row')
        const isPrimaryActive = activeColId === col.id
        const isCellEditing = editingColId === col.id
        const isCellCopied = copiedColId === col.id
        const bgColor = cellColors[`${tc.testCaseId}:${col.id}`] || undefined

        const alignClass =
          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'

        if (col.kind === 'req') {
          return (
            <td
              key={col.id}
              ref={(el) => registerCellRef(col.id, el)}
              tabIndex={0}
              style={{ backgroundColor: bgColor }}
              onClick={() => onSelectCell(col.id)}
              onDoubleClick={() => onStartEditCell(col.id)}
              className={clsx(
                'border-r border-gray-200 px-2 outline-none',
                densityPadding,
                isPrimaryActive && 'ring-2 ring-inset ring-brand-600',
                !isPrimaryActive && isCellActive && 'ring-1 ring-inset ring-brand-600/50',
                isCellCopied && 'outline-1 outline-dashed outline-brand-600',
              )}
            >
              <div className="flex items-center gap-1.5">
                {isStale && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    title={t('REQ đã thay đổi', 'REQ changed')}
                  />
                )}
                <select
                  value={currentReqValue}
                  disabled={!canEdit}
                  onFocus={() => onSelectCell(col.id)}
                  onChange={(e) => onCommitCell(col, e.target.value)}
                  className={clsx(
                    'w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-1 text-xs text-gray-900 hover:border-gray-300 focus:border-brand-600 focus:bg-white focus:outline-none',
                    col.mono !== false && 'font-mono',
                    col.bold && 'font-semibold',
                    alignClass,
                  )}
                >
                  <option value="">{t('-- Chọn REQ --', '-- REQ --')}</option>
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
                </select>
                {isStale && canEdit && (
                  <button
                    type="button"
                    onClick={() => void onMarkFresh(tc.testCaseId)}
                    className="shrink-0 text-[11px] text-brand-600 hover:underline"
                  >
                    {t('Xác nhận', 'Confirm')}
                  </button>
                )}
              </div>
            </td>
          )
        }

        if (col.kind === 'result') {
          return (
            <td
              key={col.id}
              ref={(el) => registerCellRef(col.id, el)}
              tabIndex={0}
              style={{ backgroundColor: bgColor }}
              onClick={() => onSelectCell(col.id)}
              onDoubleClick={() => onStartEditCell(col.id)}
              className={clsx(
                'border-r border-gray-200 px-2 outline-none',
                densityPadding,
                isPrimaryActive && 'ring-2 ring-inset ring-brand-600',
                !isPrimaryActive && isCellActive && 'ring-1 ring-inset ring-brand-600/50',
                isCellCopied && 'outline-1 outline-dashed outline-brand-600',
              )}
            >
              <select
                value={statusValue}
                disabled={!canEdit}
                onFocus={() => onSelectCell(col.id)}
                onChange={(e) => onCommitCell(col, e.target.value)}
                className={clsx(
                  'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium hover:border-gray-300 focus:border-brand-600 focus:bg-white focus:outline-none',
                  statusValue === 'PASS' && 'text-emerald-700',
                  statusValue === 'FAIL' && 'text-rose-700',
                  statusValue === 'BLOCKED' && 'text-amber-700',
                  statusValue === 'UNTESTED' && 'text-gray-500',
                  col.mono && 'font-mono',
                  col.bold && 'font-bold',
                  alignClass,
                )}
              >
                <option value="UNTESTED">{t('Chưa chạy', 'Untested')}</option>
                <option value="PASS">{t('Đạt', 'Pass')}</option>
                <option value="FAIL">{t('Lỗi', 'Fail')}</option>
                <option value="BLOCKED">{t('Chặn', 'Blocked')}</option>
              </select>
            </td>
          )
        }

        return (
          <td
            key={col.id}
            ref={(el) => registerCellRef(col.id, el)}
            tabIndex={0}
            style={{ backgroundColor: bgColor }}
            onClick={() => onSelectCell(col.id)}
            onDoubleClick={() => onStartEditCell(col.id)}
            className={clsx(
              'border-r border-gray-200 px-1.5 outline-none',
              densityPadding,
              isPrimaryActive && 'ring-2 ring-inset ring-brand-600',
              !isPrimaryActive && isCellActive && 'ring-1 ring-inset ring-brand-600/50',
              isCellCopied && 'outline-1 outline-dashed outline-brand-600',
            )}
          >
            <ExcelEditableCell
              value={getCellValue(col)}
              disabled={!canEdit}
              isSelected={isPrimaryActive}
              isEditing={isCellEditing}
              initialChar={isCellEditing ? initialEditChar : null}
              wrapText={prefs.wrapText}
              align={col.align ?? 'left'}
              bold={Boolean(col.bold)}
              mono={Boolean(col.mono)}
              placeholder="..."
              onStartEdit={() => onStartEditCell(col.id)}
              onCommit={(val) => onCommitCell(col, val)}
              onNavigateAfterEdit={onExitEditCell}
            />
          </td>
        )
      })}

      {canManage && <td className={clsx('px-1', densityPadding)} />}
    </tr>
  )
}

function ExcelEditableCell({
  value,
  disabled,
  isSelected,
  isEditing,
  initialChar,
  wrapText,
  align,
  bold,
  mono,
  placeholder,
  onStartEdit,
  onCommit,
  onNavigateAfterEdit,
}: {
  value: string
  disabled: boolean
  isSelected: boolean
  isEditing: boolean
  initialChar: string | null
  wrapText: boolean
  align: CellAlign
  bold: boolean
  mono: boolean
  placeholder?: string
  onStartEdit: () => void
  onCommit: (next: string) => void
  onNavigateAfterEdit: (moveDeltaRow: number, moveDeltaCol: number, wrap?: boolean) => void
}) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isEditing) {
      setDraft(value)
    }
  }, [value, isEditing])

  useEffect(() => {
    if (isEditing) {
      const nextText = initialChar !== null ? initialChar : value
      setDraft(nextText)
      setTimeout(() => {
        const el = ref.current
        if (el) {
          el.focus()
          const len = el.value.length
          el.setSelectionRange(len, len)
        }
      }, 0)
    }
  }, [isEditing, initialChar, value])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = wrapText ? `${Math.max(28, el.scrollHeight)}px` : '28px'
  }, [draft, wrapText, isEditing])

  if (!isEditing) {
    return (
      <div
        onClick={() => {
          if (isSelected && !disabled) {
            onStartEdit()
          }
        }}
        onDoubleClick={() => !disabled && onStartEdit()}
        className={clsx(
          'min-h-[26px] w-full cursor-cell rounded px-1.5 py-1 text-sm text-gray-900',
          !value && 'text-gray-400',
          wrapText ? 'whitespace-pre-wrap break-words' : 'truncate whitespace-nowrap',
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
          bold && 'font-semibold',
          mono && 'font-mono text-xs',
        )}
      >
        {value || placeholder}
      </div>
    )
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        onCommit(draft)
        onNavigateAfterEdit(0, 0)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.altKey) {
          e.preventDefault()
          e.stopPropagation()
          const el = e.currentTarget
          const start = el.selectionStart ?? draft.length
          const end = el.selectionEnd ?? draft.length
          const next = `${draft.slice(0, start)}\n${draft.slice(end)}`
          setDraft(next)
          setTimeout(() => {
            el.setSelectionRange(start + 1, start + 1)
          }, 0)
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          onCommit(draft)
          onNavigateAfterEdit(e.shiftKey ? -1 : 1, 0)
          return
        }
        if (e.key === 'Tab') {
          e.preventDefault()
          e.stopPropagation()
          onCommit(draft)
          onNavigateAfterEdit(0, e.shiftKey ? -1 : 1, true)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setDraft(value)
          onNavigateAfterEdit(0, 0)
        }
      }}
      className={clsx(
        'block w-full resize-none rounded border border-brand-600 bg-white px-1.5 py-1 text-sm text-gray-900 shadow-xs focus:outline-none',
        wrapText ? 'overflow-hidden whitespace-pre-wrap' : 'overflow-x-hidden whitespace-nowrap',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
        bold && 'font-semibold',
        mono && 'font-mono text-xs',
      )}
    />
  )
}
