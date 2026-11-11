import { useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { CloseIcon, ColumnsIcon, GripIcon, PencilIcon, TrashIcon } from '@/components/ui/icons'
import { ArrowDown, ArrowUp } from '../documents/docUi'
import { useI18n } from '@/i18n'
import {
  isBuiltin,
  KIND_HINT,
  KIND_LABEL,
  moveColumn,
  newColumnId,
  newOptionId,
  OPTION_COLORS,
  optionColor,
  validateColumn,
  type ColumnDef,
} from '@/lib/testplan/columns'
import {
  COLUMN_KINDS,
  type ColumnKind,
  type CustomColumnDto,
  type SelectOptionDto,
  type SheetLayoutDto,
} from '@/types/testing'
import { ConfirmModal } from './dialogs'
import { Drawer, iconBtn, inputCls } from './testUi'

// Cột của bảng: kéo tay nắm (hoặc nút lên / xuống) đổi thứ tự, tick hiện / ẩn (riêng mình, lưu trên máy), đổi tên mọi cột, thêm cột riêng
// (loại chọn bằng ô chọn, phần cấu hình đổi theo loại), xoá cột riêng, sửa giá trị của cột chọn. Thứ tự / tên / cột riêng
// dùng chung cả đợt test (API sheet-layout, cần testcase.manage).

const freshColumn = (): CustomColumnDto => ({
  columnId: '',
  label: '',
  kind: 'SELECT',
  options: [
    { optionId: 'o1', label: 'Android', color: 1 },
    { optionId: 'o2', label: 'iOS', color: 0 },
  ],
  multiple: false,
  min: null,
  max: null,
  unit: null,
  defaultValue: null,
  defaultToday: false,
  maxLength: null,
  personScope: 'QA',
})

/** Danh sách giá trị của cột chọn: kéo đổi thứ tự, bấm chấm màu để đổi màu, xoá. */
function OptionsEditor({
  options,
  onChange,
  idPrefix,
}: {
  options: SelectOptionDto[]
  onChange: (next: SelectOptionDto[]) => void
  idPrefix: string
}) {
  const { t } = useI18n()
  const [drag, setDrag] = useState<number | null>(null)
  const set = (i: number, patch: Partial<SelectOptionDto>) =>
    onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  return (
    <div>
      <ul className="space-y-1">
        {options.map((o, i) => (
          <li
            key={i}
            className="flex items-center gap-1.5"
            onDragOver={(e) => {
              if (drag === null) return
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (drag === null || drag === i) return
              const next = [...options]
              const [x] = next.splice(drag, 1)
              next.splice(i, 0, x)
              onChange(next)
              setDrag(null)
            }}
          >
            <span
              draggable
              onDragStart={() => setDrag(i)}
              onDragEnd={() => setDrag(null)}
              aria-hidden="true"
              title={t('Kéo để đổi thứ tự', 'Drag to reorder')}
              className="inline-flex cursor-grab select-none text-gray-400"
            >
              <GripIcon width={16} height={16} />
            </span>
            <button
              type="button"
              aria-label={t(`Đổi màu giá trị ${i + 1}`, `Change colour of value ${i + 1}`)}
              onClick={() => set(i, { color: (o.color + 1) % OPTION_COLORS.length })}
              className={clsx('h-5 w-5 shrink-0 rounded-full border-2 border-current', optionColor(o.color))}
            />
            <input
              id={`${idPrefix}-${i}`}
              value={o.label}
              onChange={(e) => set(i, { label: e.target.value })}
              placeholder={t(`Giá trị ${i + 1}`, `Value ${i + 1}`)}
              aria-label={t(`Giá trị ${i + 1}`, `Value ${i + 1}`)}
              maxLength={40}
              className={inputCls}
            />
            <button
              type="button"
              className={iconBtn}
              disabled={options.length <= 1}
              aria-label={t(`Xoá giá trị ${i + 1}`, `Remove value ${i + 1}`)}
              title={t('Xoá giá trị', 'Remove value')}
              onClick={() => onChange(options.filter((_, j) => j !== i))}
            >
              <CloseIcon width={16} height={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-1 text-[13px] font-medium text-brand-700 hover:underline"
        onClick={() =>
          onChange([
            ...options,
            { optionId: newOptionId(options), label: '', color: options.length % OPTION_COLORS.length },
          ])
        }
      >
        {t('+ Thêm giá trị', '+ Add value')}
      </button>
    </div>
  )
}

function KindConfig({ col, onChange }: { col: CustomColumnDto; onChange: (patch: Partial<CustomColumnDto>) => void }) {
  const { t } = useI18n()
  const num = (v: string) => (v.trim() === '' ? null : Number(v))
  const box = 'mt-2 space-y-2 rounded-control border border-gray-200 bg-white p-3'
  const lbl = 'block text-[13px] font-medium text-gray-700'
  switch (col.kind) {
    case 'SELECT':
      return (
        <div className={box}>
          <p className="text-[13px] font-medium text-gray-700">{t('Các giá trị để chọn', 'Values to choose from')}</p>
          <OptionsEditor idPrefix="nc-opt" options={col.options ?? []} onChange={(options) => onChange({ options })} />
          <label className="flex items-center gap-2 text-[13px] text-gray-700">
            <input
              type="checkbox"
              checked={!!col.multiple}
              onChange={(e) => onChange({ multiple: e.target.checked })}
            />
            {t('Cho chọn nhiều giá trị trong một ô', 'Allow several values per cell')}
          </label>
        </div>
      )
    case 'NUMBER':
      return (
        <div className={box}>
          <div className="grid grid-cols-2 gap-2">
            <label className={lbl}>
              {t('Nhỏ nhất', 'Min')}
              <input
                type="number"
                className={clsx(inputCls, 'mt-1')}
                value={col.min ?? ''}
                onChange={(e) => onChange({ min: num(e.target.value) })}
                placeholder={t('Không giới hạn', 'None')}
              />
            </label>
            <label className={lbl}>
              {t('Lớn nhất', 'Max')}
              <input
                type="number"
                className={clsx(inputCls, 'mt-1')}
                value={col.max ?? ''}
                onChange={(e) => onChange({ max: num(e.target.value) })}
                placeholder={t('Không giới hạn', 'None')}
              />
            </label>
          </div>
          <label className={lbl}>
            {t('Đơn vị hiển thị', 'Unit')}
            <input
              className={clsx(inputCls, 'mt-1')}
              value={col.unit ?? ''}
              maxLength={10}
              onChange={(e) => onChange({ unit: e.target.value || null })}
              placeholder={t('Vd: ms, %, lần, đ', 'e.g. ms, %, times')}
            />
          </label>
        </div>
      )
    case 'DATE':
      return (
        <div className={box}>
          <label className="flex items-center gap-2 text-[13px] text-gray-700">
            <input
              type="checkbox"
              checked={!!col.defaultToday}
              onChange={(e) => onChange({ defaultToday: e.target.checked })}
            />
            {t('Testcase mới tự điền ngày hôm nay', 'New test cases default to today')}
          </label>
          <p className="text-[12px] text-gray-500">
            {t('Hiển thị dạng dd/mm/yyyy, chọn trên lịch.', 'Shown as dd/mm/yyyy, picked on a calendar.')}
          </p>
        </div>
      )
    case 'PERSON':
      return (
        <fieldset className={box}>
          <legend className="sr-only">{t('Chọn trong', 'Pick from')}</legend>
          {(['QA', 'ALL'] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 text-[13px] text-gray-700">
              <input
                type="radio"
                name="nc-scope"
                checked={(col.personScope ?? 'QA') === v}
                onChange={() => onChange({ personScope: v })}
              />
              {v === 'QA'
                ? t('Chỉ QA của dự án', 'Project QA only')
                : t('Mọi thành viên dự án (vd "Dev phụ trách")', 'All project members (e.g. "Dev owner")')}
            </label>
          ))}
        </fieldset>
      )
    case 'MULTILINE':
      return (
        <div className={box}>
          <label className={lbl}>
            {t('Giá trị mặc định', 'Default value')}
            <input
              className={clsx(inputCls, 'mt-1')}
              value={col.defaultValue ?? ''}
              onChange={(e) => onChange({ defaultValue: e.target.value || null })}
              placeholder={t('Không bắt buộc', 'Optional')}
            />
          </label>
        </div>
      )
    default:
      return (
        <div className={clsx(box, 'grid grid-cols-2 gap-2 space-y-0')}>
          <label className={lbl}>
            {t('Giá trị mặc định', 'Default value')}
            <input
              className={clsx(inputCls, 'mt-1')}
              value={col.defaultValue ?? ''}
              onChange={(e) => onChange({ defaultValue: e.target.value || null })}
              placeholder={t('Không bắt buộc', 'Optional')}
            />
          </label>
          <label className={lbl}>
            {t('Tối đa ký tự', 'Max length')}
            <input
              type="number"
              min={1}
              className={clsx(inputCls, 'mt-1')}
              value={col.maxLength ?? ''}
              onChange={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : null })}
              placeholder={t('Không giới hạn', 'None')}
            />
          </label>
        </div>
      )
  }
}

export function ColumnSettingsDrawer({
  layout,
  columns,
  hidden,
  canManage,
  onHidden,
  onSave,
  onClose,
}: {
  layout: SheetLayoutDto
  columns: ColumnDef[]
  hidden: string[]
  canManage: boolean
  onHidden: (next: string[]) => void
  onSave: (next: SheetLayoutDto) => Promise<boolean>
  onClose: () => void
}) {
  const { t } = useI18n()
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [openOpts, setOpenOpts] = useState<string | null>(null)
  const [nc, setNc] = useState<CustomColumnDto>(freshColumn)
  const [error, setError] = useState<string | null>(null)
  const ids = columns.map((c) => c.id)

  const reorder = (from: string, to: string) => void onSave({ ...layout, order: moveColumn(ids, from, to) })
  const shift = (id: string, d: -1 | 1) => {
    const i = ids.indexOf(id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    const next = [...ids]
    ;[next[i], next[j]] = [next[j], next[i]]
    void onSave({ ...layout, order: next })
  }
  const rename = (c: ColumnDef, v: string) => {
    const name = v.trim()
    if (name === c.label) return
    if (isBuiltin(c.id)) {
      const labels = { ...layout.labels }
      if (!name || name === c.defaultLabel) delete labels[c.id]
      else labels[c.id] = name
      void onSave({ ...layout, labels })
    } else if (name) {
      void onSave({
        ...layout,
        customColumns: layout.customColumns.map((x) => (x.columnId === c.id ? { ...x, label: name } : x)),
      })
    }
  }
  const remove = (c: ColumnDef) => {
    setConfirmDelete(null)
    void onSave({
      ...layout,
      order: ids.filter((x) => x !== c.id),
      customColumns: layout.customColumns.filter((x) => x.columnId !== c.id),
    })
    onHidden(hidden.filter((x) => x !== c.id))
  }
  // Sửa giá trị của cột có sẵn: sửa trên bản nháp, bấm "Lưu giá trị" mới gửi (không lưu từng phím gõ).
  const [optDraft, setOptDraft] = useState<SelectOptionDto[]>([])
  const [optError, setOptError] = useState<string | null>(null)
  const openOptions = (c: ColumnDef) => {
    setOpenOpts(openOpts === c.id ? null : c.id)
    setOptDraft(c.custom?.options ?? [])
    setOptError(null)
  }
  const saveOptions = async (c: ColumnDef) => {
    const options = optDraft.filter((o) => o.label.trim()).map((o) => ({ ...o, label: o.label.trim() }))
    if (!options.length) return setOptError(t('Cần ít nhất 1 giá trị để chọn', 'Add at least one value'))
    const ok = await onSave({
      ...layout,
      customColumns: layout.customColumns.map((x) => (x.columnId === c.id ? { ...x, options } : x)),
    })
    if (ok) setOpenOpts(null)
  }
  const [confirmDelete, setConfirmDelete] = useState<ColumnDef | null>(null)

  const add = async () => {
    const col: CustomColumnDto = {
      ...nc,
      columnId: newColumnId(layout),
      label: nc.label.trim(),
      options:
        nc.kind === 'SELECT'
          ? (nc.options ?? []).filter((o) => o.label.trim()).map((o) => ({ ...o, label: o.label.trim() }))
          : undefined,
    }
    const err = validateColumn(col, t)
    setError(err)
    if (err) return
    const ok = await onSave({ ...layout, order: [...ids, col.columnId], customColumns: [...layout.customColumns, col] })
    if (ok) setNc(freshColumn())
  }

  const kindName = (c: ColumnDef) =>
    c.custom
      ? KIND_LABEL(c.custom.kind, t)
      : c.kind === 'key'
        ? t('Mã', 'ID')
        : c.kind === 'result'
          ? t('Kết quả', 'Result')
          : c.kind === 'bug'
            ? t('Bug (Kanban)', 'Bug (Kanban)')
            : c.kind === 'ro'
              ? t('Tự động', 'Automatic')
              : c.kind === 'req'
                ? 'REQ'
                : c.kind === 'multi'
                  ? t('Nhiều dòng', 'Multi-line')
                  : c.kind === 'select'
                    ? t('Danh sách chọn', 'Select')
                    : t('Chữ', 'Text')

  return (
    <Drawer icon={ColumnsIcon} title={t('Cột của bảng', 'Sheet columns')} onClose={onClose}>
      <p className="mb-2 text-[12.5px] text-gray-500">
        {canManage
          ? t('Kéo để sắp xếp · tick để ẩn / hiện', 'Drag to reorder · tick to show / hide')
          : t('Bạn chỉ ẩn / hiện được cột', 'You can only show / hide columns')}
      </p>
      <ul>
        {columns.map((c, i) => (
          <li
            key={c.id}
            onDragOver={(e) => {
              if (!drag) return
              e.preventDefault()
              setOver(c.id)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (drag && drag !== c.id) reorder(drag, c.id)
              setDrag(null)
              setOver(null)
            }}
            className={clsx(
              'border-t border-gray-100 py-1.5',
              over === c.id && drag !== c.id && 'shadow-[inset_0_2px_0_#2f5bea]',
              openOpts === c.id && 'bg-brand-50',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                draggable={canManage}
                onDragStart={() => setDrag(c.id)}
                onDragEnd={() => {
                  setDrag(null)
                  setOver(null)
                }}
                aria-hidden="true"
                title={t('Kéo để đổi vị trí cột', 'Drag to move the column')}
                className={clsx('inline-flex select-none text-gray-400', canManage ? 'cursor-grab' : 'invisible')}
              >
                <GripIcon width={16} height={16} />
              </span>
              <input
                type="checkbox"
                aria-label={t(`Hiện cột ${c.label}`, `Show column ${c.label}`)}
                checked={c.locked || !hidden.includes(c.id)}
                disabled={c.locked}
                title={c.locked ? t('Cột bắt buộc', 'Required column') : undefined}
                onChange={(e) => onHidden(e.target.checked ? hidden.filter((x) => x !== c.id) : [...hidden, c.id])}
              />
              <input
                key={c.label}
                defaultValue={c.label}
                disabled={!canManage}
                maxLength={60}
                aria-label={t(`Tên cột ${c.defaultLabel}`, `Name of column ${c.defaultLabel}`)}
                title={c.custom ? undefined : t(`Tên gốc: ${c.defaultLabel}`, `Original: ${c.defaultLabel}`)}
                onBlur={(e) => rename(c, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className={clsx(inputCls, 'min-w-0 flex-1')}
              />
              <span className="whitespace-nowrap rounded-[4px] bg-gray-100 px-1.5 text-[11px] text-gray-500">
                {kindName(c)}
              </span>
              {canManage && (
                <>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={i === 0}
                    aria-label={t(`Đưa cột ${c.label} lên`, `Move ${c.label} up`)}
                    title={t('Đưa lên', 'Move up')}
                    onClick={() => shift(c.id, -1)}
                  >
                    <ArrowUp width={16} height={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    disabled={i === columns.length - 1}
                    aria-label={t(`Đưa cột ${c.label} xuống`, `Move ${c.label} down`)}
                    title={t('Đưa xuống', 'Move down')}
                    onClick={() => shift(c.id, 1)}
                  >
                    <ArrowDown width={16} height={16} aria-hidden="true" />
                  </button>
                </>
              )}
              {canManage && c.custom?.kind === 'SELECT' && (
                <button
                  type="button"
                  className={iconBtn}
                  aria-expanded={openOpts === c.id}
                  aria-label={t(`Sửa giá trị của ${c.label}`, `Edit values of ${c.label}`)}
                  title={t('Sửa giá trị', 'Edit values')}
                  onClick={() => openOptions(c)}
                >
                  <PencilIcon width={16} height={16} aria-hidden="true" />
                </button>
              )}
              {canManage && c.custom && (
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={t(`Xoá cột ${c.label}`, `Delete column ${c.label}`)}
                  title={t('Xoá cột', 'Delete column')}
                  onClick={() => setConfirmDelete(c)}
                >
                  <TrashIcon width={16} height={16} aria-hidden="true" />
                </button>
              )}
            </div>
            {c.custom && openOpts === c.id && (
              <div className="pl-7 pt-2">
                <OptionsEditor idPrefix={`opt-${c.id}`} options={optDraft} onChange={setOptDraft} />
                {optError && (
                  <p role="alert" className="mt-1 text-[12.5px] text-red-700">
                    {optError}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button inline onClick={() => void saveOptions(c)}>
                    {t('Lưu giá trị', 'Save values')}
                  </Button>
                  <Button inline variant="secondary" onClick={() => setOpenOpts(null)}>
                    {t('Huỷ', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <section aria-labelledby="add-col-h" className="mt-4 rounded-card border border-gray-200 bg-gray-25 p-3">
          <h3 id="add-col-h" className="mb-2 text-[13.5px] font-semibold text-gray-900">
            {t('+ Thêm cột', '+ Add column')}
          </h3>
          <label className="block text-[13px] font-medium text-gray-700">
            {t('Tên cột', 'Column name')}
            <input
              className={clsx(inputCls, 'mt-1')}
              value={nc.label}
              maxLength={60}
              onChange={(e) => setNc({ ...nc, label: e.target.value })}
              placeholder={t('Vd: Thiết bị, Dữ liệu test, Thời gian phản hồi', 'e.g. Device, Test data, Response time')}
            />
          </label>
          <label className="mt-2 block text-[13px] font-medium text-gray-700">
            {t('Loại cột', 'Column type')}
            <select
              className={clsx(inputCls, 'mt-1')}
              value={nc.kind}
              onChange={(e) => setNc({ ...nc, kind: e.target.value as ColumnKind })}
            >
              {COLUMN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL(k, t)} — {KIND_HINT(k, t)}
                </option>
              ))}
            </select>
          </label>
          <KindConfig col={nc} onChange={(patch) => setNc({ ...nc, ...patch })} />
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-red-700">
              {error}
            </p>
          )}
          <Button inline className="mt-3" onClick={() => void add()}>
            {t(`Thêm cột "${nc.label.trim() || '…'}"`, `Add column "${nc.label.trim() || '…'}"`)}
          </Button>
        </section>
      )}
      {confirmDelete && (
        <ConfirmModal
          title={t(`Xoá cột "${confirmDelete.label}"?`, `Delete column "${confirmDelete.label}"?`)}
          description={t('Giá trị trong cột sẽ mất.', 'Its values are lost.')}
          confirmLabel={t('Xoá cột', 'Delete column')}
          danger
          onConfirm={() => remove(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </Drawer>
  )
}
