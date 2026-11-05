import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import type { RequirementRef } from '@/types/issue'
import { loadReqOptions, type ReqOption } from './reqLinks'
export type { ReqOption }

/** REQ của dự án (một lần cho mỗi lần mở). */
export function useReqOptions(projectId: number, enabled = true) {
  const [options, setOptions] = useState<ReqOption[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadReqOptions(projectId).then((o) => alive && setOptions(o))
    return () => {
      alive = false
    }
  }, [projectId, enabled])
  return options
}

const same = (a: RequirementRef, b: { documentId: number; reqUid: string }) =>
  a.documentId === b.documentId && a.reqUid === b.reqUid

/** Danh sách REQ có ô chọn, nhóm theo tài liệu, có ô lọc. */
export function ReqPicker({
  projectId,
  value,
  onChange,
  exclude,
  maxHeight = 'max-h-64',
}: {
  projectId: number
  value: RequirementRef[]
  onChange: (refs: RequirementRef[]) => void
  /** Ẩn REQ (vd đã có issue). */
  exclude?: (o: ReqOption) => boolean
  maxHeight?: string
}) {
  const { t } = useI18n()
  const options = useReqOptions(projectId)
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('vi')
    return (options ?? [])
      .filter((o) => !exclude?.(o))
      .filter((o) => !needle || `${o.documentCode} ${o.reqKey} ${o.title}`.toLocaleLowerCase('vi').includes(needle))
  }, [options, q, exclude])
  const groups = useMemo(() => {
    const map = new Map<number, ReqOption[]>()
    for (const o of list) map.set(o.documentId, [...(map.get(o.documentId) ?? []), o])
    return [...map.values()]
  }, [list])

  const toggle = (o: ReqOption) =>
    onChange(
      value.some((v) => same(v, o))
        ? value.filter((v) => !same(v, o))
        : [...value, { documentId: o.documentId, reqUid: o.reqUid }],
    )

  return (
    <div className="overflow-hidden rounded-card border border-gray-200">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('Lọc REQ…', 'Filter REQs…')}
        aria-label={t('Lọc REQ', 'Filter REQs')}
        className="h-10 w-full border-b border-gray-200 px-3 text-sm placeholder:text-gray-400 focus:outline-none"
      />
      <div className={clsx('overflow-y-auto', maxHeight)}>
        {options === null ? (
          <p className="px-3 py-4 text-sm text-gray-500">{t('Đang tải REQ…', 'Loading REQs…')}</p>
        ) : groups.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">{t('Không có REQ phù hợp.', 'No matching REQs.')}</p>
        ) : (
          groups.map((g) => (
            <div key={g[0].documentId}>
              <p className="bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
                {g[0].documentCode} · {g[0].documentTitle}
              </p>
              {g.map((o) => {
                const checked = value.some((v) => same(v, o))
                return (
                  <label
                    key={o.reqUid}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-200"
                    />
                    <span className="shrink-0 rounded-[5px] border border-brand-200 bg-brand-50 px-1.5 text-[11.5px] font-medium leading-[18px] text-brand-800">
                      {o.reqKey}
                    </span>
                    <span className="min-w-0 truncate text-gray-800">{o.title}</span>
                  </label>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
