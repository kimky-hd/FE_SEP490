import { useState } from 'react'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { ChevronDownIcon } from '@/components/ui/icons'
import { formatDate, formatRelative } from '@/lib/format'
import type { DocumentActivityDto, DocumentVersionSummaryDto, VersionStatus } from '@/types/document'
import { pillClass, statusLabel, usePopover } from './docUi'

type T = (vi: string, en: string) => string

const lower = (s: string) => s.charAt(0).toLocaleLowerCase('vi') + s.slice(1)

/** Một dòng tóm tắt cho mỗi phiên bản: ai gửi / duyệt, khi nào, REQ đổi gì, ghi chú yêu cầu sửa. */
export function versionSummary(
  v: DocumentVersionSummaryDto,
  all: DocumentVersionSummaryDto[],
  activity: DocumentActivityDto[],
  t: T,
) {
  const acts = activity.filter((a) => a.versionLabel === v.label)
  const last = (action: string) => acts.find((a) => a.action === action)
  const rounds = acts.filter((a) => a.action === 'CHANGES_REQUESTED').length
  const roundsText = rounds
    ? t(`từng bị yêu cầu sửa ${rounds} lần`, `${rounds} change ${rounds === 1 ? 'request' : 'requests'}`)
    : null
  switch (v.status) {
    case 'IN_REVIEW': {
      const s = last('SUBMITTED')
      return [
        t(
          `${s?.actor.fullName ?? v.author.fullName} gửi duyệt`,
          `Submitted by ${s?.actor.fullName ?? v.author.fullName}`,
        ),
        formatRelative(s?.createdAt ?? v.updatedAt),
        s?.note ? lower(s.note) : null,
      ]
    }
    case 'CHANGES_REQUESTED':
      return [
        t(`${v.reviewedBy?.fullName ?? ''} yêu cầu sửa`, `Changes requested by ${v.reviewedBy?.fullName ?? ''}`),
        v.reviewNote ? `"${v.reviewNote}"` : null,
      ]
    case 'APPROVED':
    case 'SUPERSEDED': {
      const a = last('APPROVED')
      const next = all
        .filter((x) => x.versionId > v.versionId && (x.status === 'APPROVED' || x.status === 'SUPERSEDED'))
        .sort((x, y) => x.versionId - y.versionId)[0]
      return [
        t(
          `Duyệt bởi ${v.reviewedBy?.fullName ?? a?.actor.fullName ?? ''}`,
          `Approved by ${v.reviewedBy?.fullName ?? a?.actor.fullName ?? ''}`,
        ),
        formatDate(v.reviewedAt ?? a?.createdAt),
        a?.note ? lower(a.note) : null,
        roundsText,
        v.status === 'SUPERSEDED' && next ? t(`bị bản ${next.label} thay thế`, `superseded by v${next.label}`) : null,
      ]
    }
    default:
      return [v.author.fullName, t(`cập nhật ${formatRelative(v.updatedAt)}`, `updated ${formatRelative(v.updatedAt)}`)]
  }
}

export const versionStatusText = (status: VersionStatus, isBaseline: boolean, t: T) =>
  status === 'APPROVED' && isBaseline ? t('Đã duyệt · baseline', 'Approved · baseline') : statusLabel(status)

interface Props {
  code: string | null
  versions: DocumentVersionSummaryDto[]
  viewing: DocumentVersionSummaryDto
  isLatest: boolean
  baselineVersionId: number | null
  activity: DocumentActivityDto[]
  onOpen: (versionId: number) => void
  /** So sánh bản đang xem với `otherId` (bên gọi tự xếp cũ → mới). */
  onCompare: (aId: number, bId: number) => void
  onOpenHistory: () => void
}

export function VersionPopover({
  code,
  versions,
  viewing,
  isLatest,
  baselineVersionId,
  activity,
  onOpen,
  onCompare,
  onOpenHistory,
}: Props) {
  const { t } = useI18n()
  const pop = usePopover()
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<number[]>([])

  const close = () => {
    pop.setOpen(false)
    setPicking(false)
    setPicked([])
  }
  const togglePick = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2)))

  return (
    <div ref={pop.ref} className="relative">
      <button
        type="button"
        onClick={() => (pop.open ? close() : pop.setOpen(true))}
        aria-expanded={pop.open}
        aria-haspopup="dialog"
        title={t('Các phiên bản', 'Versions')}
        className={clsx(pillClass(viewing.status, !isLatest), 'cursor-pointer hover:brightness-[0.97]')}
      >
        {statusLabel(viewing.status)} · {t(`bản ${viewing.label}`, `v${viewing.label}`)}
        <ChevronDownIcon className="h-3 w-3" />
      </button>
      {pop.open && (
        <div
          role="dialog"
          aria-label={t('Các phiên bản', 'Versions')}
          className="absolute left-0 top-full z-40 mt-1.5 w-[min(25rem,calc(100vw-2rem))] rounded-card border border-gray-200 bg-white shadow-pop"
        >
          <p className="px-3.5 pb-1 pt-3 text-xs text-gray-500">
            {t(`Phiên bản của ${code ?? 'trang'}`, `Versions of ${code ?? 'this page'}`)}
          </p>
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {versions.map((v) => {
              const current = v.versionId === viewing.versionId
              const summary = versionSummary(v, versions, activity, t).filter(Boolean).join(' · ')
              return (
                <li
                  key={v.versionId}
                  className={clsx(
                    'flex items-start gap-2.5 rounded-control px-2 py-2',
                    current ? 'bg-gray-50' : 'hover:bg-gray-50',
                  )}
                >
                  {picking ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand-600"
                      checked={picked.includes(v.versionId)}
                      onChange={() => togglePick(v.versionId)}
                      aria-label={t(`Chọn bản ${v.label}`, `Select v${v.label}`)}
                    />
                  ) : (
                    <span
                      className={clsx(
                        'mt-0.5 flex h-6 min-w-[2rem] items-center justify-center rounded-[6px] border px-1 text-xs tabular-nums',
                        current ? 'border-brand-400 text-brand-700' : 'border-gray-200 text-gray-600',
                      )}
                    >
                      {v.label}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => (picking ? togglePick(v.versionId) : (onOpen(v.versionId), close()))}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-950">
                        {t(`Bản ${v.label}`, `Version ${v.label}`)}
                      </span>
                      <span className={pillClass(v.status)}>
                        {versionStatusText(v.status, v.versionId === baselineVersionId, t)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-gray-500">{summary}</span>
                  </button>
                  {!picking &&
                    (current ? (
                      <span className="shrink-0 pt-0.5 text-xs text-gray-500">{t('đang xem', 'viewing')}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onCompare(viewing.versionId, v.versionId)
                          close()
                        }}
                        className="shrink-0 pt-0.5 text-xs font-medium text-brand-700 hover:underline"
                      >
                        {t('So sánh', 'Compare')}
                      </button>
                    ))}
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-3.5 py-2.5 text-sm">
            {picking ? (
              <>
                <button
                  type="button"
                  onClick={() => (setPicking(false), setPicked([]))}
                  className="text-gray-600 hover:text-gray-950"
                >
                  {t('Huỷ', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={picked.length !== 2}
                  onClick={() => {
                    onCompare(picked[0], picked[1])
                    close()
                  }}
                  className="font-medium text-brand-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  {t(`So sánh ${picked.length}/2 bản`, `Compare ${picked.length}/2`)}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  disabled={versions.length < 2}
                  className="text-gray-600 hover:text-gray-950 disabled:text-gray-400"
                >
                  {t('Chọn 2 bản để so sánh bất kỳ', 'Pick any 2 to compare')}
                </button>
                <button
                  type="button"
                  onClick={() => (onOpenHistory(), close())}
                  className="font-medium text-gray-800 hover:text-gray-950"
                >
                  {t('Mở lịch sử đầy đủ', 'Full history')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
