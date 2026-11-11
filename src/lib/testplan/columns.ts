import type { ColumnKind, CustomColumnDto, CustomValue, SheetLayoutDto, TestPriority } from '@/types/testing'

// Cột của bảng testcase: cột có sẵn + cột riêng của đợt test. Thứ tự / tên / độ rộng / cột riêng dùng chung cả đợt
// (API sheet-layout); ẩn / hiện là của từng người (localStorage). Hàm thuần.

export type CellKind =
  'key' | 'text' | 'multi' | 'req' | 'result' | 'ro' | 'bug' | 'select' | 'number' | 'date' | 'person'

export type BuiltinColumnId =
  | 'code'
  | 'title'
  | 'req'
  | 'preconditions'
  | 'steps'
  | 'expected'
  | 'actual'
  | 'result'
  | 'build'
  | 'bug'
  | 'bugStatus'
  | 'priority'
  | 'category'
  | 'browser'

export interface ColumnDef {
  id: string
  label: string
  defaultLabel: string
  kind: CellKind
  width: number
  /** Cột bắt buộc: không ẩn được. */
  locked: boolean
  custom: CustomColumnDto | null
  /** Giá trị chọn của cột select (cột có sẵn: mức độ, phân loại, trình duyệt). */
  options: { value: string; label: string; color?: number }[]
  multiple: boolean
}

type T = (vi: string, en: string) => string

export const PRIORITY_VALUES: TestPriority[] = ['HIGH', 'MEDIUM', 'LOW']
export const priorityText = (p: TestPriority, t: T) =>
  ({ HIGH: t('Cao', 'High'), MEDIUM: t('Trung bình', 'Medium'), LOW: t('Thấp', 'Low') })[p]

export const DEFAULT_CATEGORIES = ['Flow', 'Giao diện', 'Chức năng', 'Validate']
export const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge']

interface BuiltinSpec {
  vi: string
  en: string
  kind: CellKind
  width: number
  locked?: boolean
}

export const BUILTIN: Record<BuiltinColumnId, BuiltinSpec> = {
  code: { vi: 'Mã TC', en: 'TC ID', kind: 'key', width: 72, locked: true },
  title: { vi: 'Tên TC', en: 'Title', kind: 'text', width: 200, locked: true },
  req: { vi: 'REQ', en: 'REQ', kind: 'req', width: 160 },
  preconditions: { vi: 'Điều kiện', en: 'Preconditions', kind: 'multi', width: 160 },
  steps: { vi: 'Các bước thực hiện', en: 'Steps', kind: 'multi', width: 230 },
  expected: { vi: 'Kết quả mong đợi', en: 'Expected', kind: 'multi', width: 230 },
  actual: { vi: 'Kết quả thực tế', en: 'Actual', kind: 'multi', width: 170 },
  result: { vi: 'Kết quả', en: 'Result', kind: 'result', width: 150, locked: true },
  build: { vi: 'Build', en: 'Build', kind: 'ro', width: 84 },
  bug: { vi: 'Bug', en: 'Bug', kind: 'bug', width: 96 },
  bugStatus: { vi: 'Trạng thái bug', en: 'Bug status', kind: 'ro', width: 130 },
  priority: { vi: 'Mức độ', en: 'Priority', kind: 'select', width: 104 },
  category: { vi: 'Phân loại', en: 'Category', kind: 'select', width: 116 },
  browser: { vi: 'Trình duyệt', en: 'Browser', kind: 'select', width: 104 },
}

export const BUILTIN_IDS = Object.keys(BUILTIN) as BuiltinColumnId[]
export const isBuiltin = (id: string): id is BuiltinColumnId => id in BUILTIN

export const DEFAULT_HIDDEN: string[] = ['browser']

export const emptyLayout = (): SheetLayoutDto => ({
  order: [...BUILTIN_IDS],
  labels: {},
  widths: {},
  customColumns: [],
})

const CUSTOM_KIND: Record<ColumnKind, CellKind> = {
  TEXT: 'text',
  MULTILINE: 'multi',
  SELECT: 'select',
  NUMBER: 'number',
  DATE: 'date',
  PERSON: 'person',
}

export const KIND_LABEL = (k: ColumnKind, t: T) =>
  ({
    TEXT: t('Chữ', 'Text'),
    MULTILINE: t('Nhiều dòng', 'Multi-line'),
    SELECT: t('Danh sách chọn', 'Select'),
    NUMBER: t('Số', 'Number'),
    DATE: t('Ngày', 'Date'),
    PERSON: t('Người', 'Person'),
  })[k]

export const KIND_HINT = (k: ColumnKind, t: T) =>
  ({
    TEXT: t('Một dòng chữ ngắn', 'One short line'),
    MULTILINE: t('Đoạn dài, xuống dòng được', 'Long text with line breaks'),
    SELECT: t('Chọn từ danh sách giá trị có màu', 'Pick from coloured values'),
    NUMBER: t('Số, có giới hạn và đơn vị', 'Number with limits and unit'),
    DATE: t('Chọn ngày trên lịch', 'Pick a date'),
    PERSON: t('Chọn một người trong dự án', 'Pick a project member'),
  })[k]

/** Bảng màu chip (nền, chữ) — theo token Tailwind của app. */
export const OPTION_COLORS = [
  'bg-blue-50 text-blue-700',
  'bg-green-50 text-green-700',
  'bg-amber-50 text-amber-800',
  'bg-red-50 text-red-700',
  'bg-violet-50 text-violet-700',
  'bg-pink-50 text-pink-700',
  'bg-gray-100 text-gray-700',
]
export const optionColor = (i: number | undefined) => OPTION_COLORS[(i ?? 6) % OPTION_COLORS.length]

/** Mọi cột theo thứ tự đợt test (cột có sẵn / cột riêng mới thiếu trong `order` được nối cuối). */
export function allColumns(layout: SheetLayoutDto, t: T): ColumnDef[] {
  const ids = [...layout.order]
  for (const id of BUILTIN_IDS) if (!ids.includes(id)) ids.push(id)
  for (const c of layout.customColumns) if (!ids.includes(c.columnId)) ids.push(c.columnId)
  const out: ColumnDef[] = []
  for (const id of ids) {
    if (isBuiltin(id)) {
      const b = BUILTIN[id]
      const defaultLabel = t(b.vi, b.en)
      out.push({
        id,
        label: layout.labels[id]?.trim() || defaultLabel,
        defaultLabel,
        kind: b.kind,
        width: layout.widths[id] ?? b.width,
        locked: !!b.locked,
        custom: null,
        options:
          id === 'priority'
            ? PRIORITY_VALUES.map((p) => ({ value: p, label: priorityText(p, t) }))
            : id === 'category'
              ? DEFAULT_CATEGORIES.map((c) => ({ value: c, label: c }))
              : id === 'browser'
                ? BROWSERS.map((c) => ({ value: c, label: c }))
                : [],
        multiple: false,
      })
      continue
    }
    const c = layout.customColumns.find((x) => x.columnId === id)
    if (!c) continue
    const kind = CUSTOM_KIND[c.kind]
    out.push({
      id,
      label: c.label,
      defaultLabel: c.label,
      kind,
      width: layout.widths[id] ?? (kind === 'multi' ? 200 : c.kind === 'SELECT' && c.multiple ? 170 : 130),
      locked: false,
      custom: c,
      // Giá trị lưu trong customFields là optionId (dữ liệu cũ lưu nhãn: ô hiển thị vẫn tra được theo nhãn).
      options: (c.options ?? []).map((o) => ({ value: o.optionId || o.label, label: o.label, color: o.color })),
      multiple: !!c.multiple,
    })
  }
  return out
}

export const visibleColumns = (cols: ColumnDef[], hidden: readonly string[]) =>
  cols.filter((c) => c.locked || !hidden.includes(c.id))

/** Đưa cột `from` lên trước cột `to`. */
export function moveColumn(order: string[], from: string, to: string): string[] {
  if (from === to) return order
  const next = order.filter((x) => x !== from)
  const i = next.indexOf(to)
  next.splice(i < 0 ? next.length : i, 0, from)
  return next
}

export const clampWidth = (w: number) => Math.max(56, Math.min(600, Math.round(w)))

/** Giá trị số theo min / max của cột; trả về số đã kẹp và có bị sửa không. */
export function clampNumber(
  raw: string,
  col: Pick<CustomColumnDto, 'min' | 'max'>,
): { value: number | null; clamped: boolean } {
  if (raw.trim() === '') return { value: null, clamped: false }
  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n)) return { value: null, clamped: true }
  let v = n
  if (col.min !== null && col.min !== undefined) v = Math.max(col.min, v)
  if (col.max !== null && col.max !== undefined) v = Math.min(col.max, v)
  return { value: v, clamped: v !== n }
}

/** Kiểm cột mới / sửa cột; trả về câu lỗi (null = hợp lệ). */
export function validateColumn(c: CustomColumnDto, t: T): string | null {
  if (!c.label.trim()) return t('Nhập tên cột', 'Enter a column name')
  if (c.kind === 'SELECT' && !(c.options ?? []).some((o) => o.label.trim()))
    return t('Cần ít nhất 1 giá trị để chọn', 'Add at least one value')
  if (c.kind === 'NUMBER' && c.min != null && c.max != null && c.min > c.max)
    return t('"Nhỏ nhất" phải ≤ "Lớn nhất"', '"Min" must be ≤ "Max"')
  return null
}

/** Giá trị mặc định của các cột riêng cho testcase mới. */
export function defaultCustomFields(cols: CustomColumnDto[], today: string): Record<string, CustomValue> {
  const out: Record<string, CustomValue> = {}
  for (const c of cols) {
    if (c.kind === 'DATE' && c.defaultToday) out[c.columnId] = today
    else if ((c.kind === 'TEXT' || c.kind === 'MULTILINE') && c.defaultValue) out[c.columnId] = c.defaultValue
  }
  return out
}

/** Id giá trị chọn mới (o1, o2…), duy nhất trong cột. */
export function newOptionId(options: { optionId?: string }[]): string {
  const max = options.reduce((n, o) => Math.max(n, Number(/^o(\d+)$/.exec(o.optionId ?? '')?.[1] ?? 0)), 0)
  return `o${max + 1}`
}

/** Tìm giá trị chọn theo id (hoặc theo nhãn với dữ liệu cũ). */
export function findOption<T extends { value: string; label: string }>(options: T[], v: string): T | undefined {
  return options.find((o) => o.value === v) ?? options.find((o) => o.label === v)
}

/** Id cột riêng mới (duy nhất trong bố cục). */
export function newColumnId(layout: SheetLayoutDto): string {
  let n = layout.customColumns.length + 1
  while (layout.customColumns.some((c) => c.columnId === `c${n}`)) n++
  return `c${n}`
}
