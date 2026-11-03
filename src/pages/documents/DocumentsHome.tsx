import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { documentApi } from '@/api/documentApi'
import { loadPageInfos, type PageInfo } from '@/api/documentWork'
import { useAsync } from '@/lib/useAsync'
import { formatRelative } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import type { DocType, DocumentNodeDto, VersionStatus } from '@/types/document'
import { Chip, IconButton, SidebarIcon, StatusPill, statusLabel } from './docUi'
import { NewDocButton } from './NewDocButton'

type Filter = Exclude<VersionStatus, 'SUPERSEDED'> | 'STALE'
type Sort = 'recent' | 'status'

const STATUS_ORDER: VersionStatus[] = ['IN_REVIEW', 'CHANGES_REQUESTED', 'DRAFT', 'APPROVED']

// "Trang chủ tài liệu" của dự án (chưa chọn trang): số theo trạng thái (bấm để lọc) · bảng trang · "Cần chú ý".
// Dữ liệu tác giả / REQ stale ghép từ chi tiết từng trang (documentWork.loadPageInfos); bảng hiện ngay từ cây,
// phần phụ điền vào khi tải xong.
export function DocumentsHome({
  projectId,
  nodes,
  canEdit,
  canApprove,
  onToggleTree,
  onBlank,
  onNotes,
  onFolder,
}: {
  projectId: number
  nodes: DocumentNodeDto[]
  canEdit: boolean
  canApprove: boolean
  onToggleTree: () => void
  onBlank: () => void
  onNotes: () => void
  onFolder: () => void
}) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<Filter | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const infoQ = useAsync(() => loadPageInfos(documentApi, projectId, { nodes }), [projectId, nodes])
  const infoById = useMemo(() => new Map((infoQ.data?.pages ?? []).map((p) => [p.node.documentId, p])), [infoQ.data])

  const pages = useMemo(() => nodes.filter((n) => n.kind === 'PAGE' && n.currentVersion), [nodes])
  const byId = useMemo(() => new Map(nodes.map((n) => [n.documentId, n])), [nodes])
  const reqTotal = pages.reduce((sum, n) => sum + n.reqCount, 0)
  const staleOf = (n: DocumentNodeDto) => infoById.get(n.documentId)?.stale.length ?? 0
  const count = (s: VersionStatus) => pages.filter((n) => n.currentVersion!.status === s).length
  const staleTotal = pages.reduce((sum, n) => sum + staleOf(n), 0)

  const cells: { key: Filter; label: string; value: number; dot: string; warn?: boolean }[] = [
    { key: 'DRAFT', label: t('Nháp', 'Draft'), value: count('DRAFT'), dot: 'bg-gray-400' },
    { key: 'IN_REVIEW', label: t('Chờ duyệt', 'In review'), value: count('IN_REVIEW'), dot: 'bg-brand-600' },
    {
      key: 'CHANGES_REQUESTED',
      label: t('Cần sửa', 'Changes requested'),
      value: count('CHANGES_REQUESTED'),
      dot: 'bg-red-600',
    },
    { key: 'APPROVED', label: t('Đã duyệt', 'Approved'), value: count('APPROVED'), dot: 'bg-success-600' },
    {
      key: 'STALE',
      label: t('REQ cần cập nhật', 'REQs to update'),
      value: staleTotal,
      dot: 'bg-amber-600',
      warn: true,
    },
  ]

  const visible = pages.filter(
    (n) => !filter || (filter === 'STALE' ? staleOf(n) > 0 : n.currentVersion!.status === filter),
  )
  const recent = [...visible].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const groups: { status: VersionStatus; rows: DocumentNodeDto[] }[] =
    sort === 'status'
      ? STATUS_ORDER.map((status) => ({
          status,
          rows: recent.filter((n) => n.currentVersion!.status === status),
        })).filter((g) => g.rows.length > 0)
      : [{ status: 'DRAFT', rows: recent }]

  const href = (n: { documentId: number }) => `/projects/${projectId}/documents/${n.documentId}`
  const parentTitle = (n: DocumentNodeDto) => (n.parentId !== null ? (byId.get(n.parentId)?.title ?? null) : null)

  const attention: ReactNode[] = []
  for (const n of [...pages]
    .filter((x) => x.currentVersion!.status === 'IN_REVIEW')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const info = infoById.get(n.documentId)
    attention.push(
      <AttentionRow
        key={`r-${n.documentId}`}
        pill={<StatusPill status="IN_REVIEW" />}
        title={`${n.code ?? n.title} ${t(`bản ${n.currentVersion!.label}`, `v${n.currentVersion!.label}`)}`}
        detail={[
          info?.submittedBy ? t(`${info.submittedBy.fullName} gửi`, `sent by ${info.submittedBy.fullName}`) : null,
          formatRelative(info?.submittedAt ?? n.updatedAt),
        ]
          .filter(Boolean)
          .join(' · ')}
        to={href(n)}
        action={canApprove ? t('Duyệt', 'Review') : t('Xem', 'View')}
      />,
    )
  }
  for (const info of (infoQ.data?.pages ?? []).filter((p) => p.stale.length > 0)) {
    for (const r of info.stale) {
      attention.push(
        <AttentionRow
          key={`s-${r.requirementId}`}
          pill={
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Stale
            </span>
          }
          title={`${r.reqKey} · ${r.title}`}
          detail={`${info.node.code ?? info.node.title} · ${t(`bản ${info.node.currentVersion!.label}`, `v${info.node.currentVersion!.label}`)}`}
          to={href(info.node)}
          action={t('Xem', 'View')}
        />,
      )
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <IconButton label={t('Hiện cây trang', 'Show page tree')} onClick={onToggleTree} className="lg:hidden">
            <SidebarIcon />
          </IconButton>
          <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
            <h2 className="truncate text-lg font-bold tracking-tight text-gray-950">
              {t('Tài liệu dự án', 'Project documents')}
            </h2>
            <span className="shrink-0 text-[13px] text-gray-500">
              {t(
                `${pages.length} trang · ${reqTotal} REQ`,
                `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} · ${reqTotal} REQ`,
              )}
            </span>
          </div>
          {canEdit && <NewDocButton onBlank={onBlank} onNotes={onNotes} onFolder={onFolder} />}
        </div>

        <div
          className="mt-4 grid grid-cols-5 overflow-hidden rounded-card border border-gray-200"
          role="group"
          aria-label={t('Lọc theo trạng thái', 'Filter by status')}
        >
          {cells.map((c, i) => {
            const on = filter === c.key
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(on ? null : c.key)}
                className={clsx(
                  'min-w-0 px-2.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-100 sm:px-4',
                  i > 0 && 'border-l border-gray-200',
                  on ? 'bg-brand-50/60 shadow-[inset_0_-2px_0_theme(colors.brand.600)]' : 'hover:bg-gray-50',
                )}
              >
                <span
                  className={clsx(
                    'block text-[22px] font-semibold leading-tight tabular-nums',
                    c.warn && c.value > 0 ? 'text-amber-700' : 'text-gray-950',
                  )}
                >
                  {c.value}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 sm:text-[13px]">
                  <i aria-hidden="true" className={clsx('h-2 w-2 shrink-0 rounded-[2px]', c.dot)} />
                  <span className="truncate">{c.label}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-6 grid items-start gap-6 min-[1600px]:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0">
            <div className="flex min-h-9 items-center gap-3">
              <h3 className="text-[15px] font-semibold text-gray-950">{t('Trang', 'Pages')}</h3>
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  className="text-[13px] font-medium text-brand-700 hover:underline"
                >
                  {t('Bỏ lọc', 'Clear filter')}
                </button>
              )}
              <span className="flex-1" />
              <div
                className="inline-flex rounded-[9px] bg-gray-100 p-[3px]"
                role="group"
                aria-label={t('Sắp xếp', 'Sort')}
              >
                {(
                  [
                    ['recent', t('Gần đây', 'Recent')],
                    ['status', t('Theo trạng thái', 'By status')],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                    className={clsx(
                      'rounded-[7px] px-2.5 py-1 text-[13px] font-medium transition-colors',
                      sort === key ? 'bg-white text-gray-950 shadow-xs' : 'text-gray-500 hover:text-gray-900',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5 overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs">
              {visible.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  {t('Không có trang nào khớp bộ lọc.', 'No pages match this filter.')}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="max-md:hidden">
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                      <th className="px-4 py-2.5 font-medium">{t('Trang', 'Page')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('Trạng thái', 'Status')}</th>
                      <th className="px-4 py-2.5 font-medium">REQ</th>
                      <th className="px-4 py-2.5 font-medium">{t('Cập nhật', 'Updated')}</th>
                    </tr>
                  </thead>
                  {groups.map((g) => (
                    <tbody key={g.status} className="divide-y divide-gray-200 border-b border-gray-200 last:border-b-0">
                      {sort === 'status' && (
                        <tr>
                          <th
                            colSpan={4}
                            scope="colgroup"
                            className="bg-white px-4 py-2 text-left text-[13px] font-medium text-gray-500"
                          >
                            {statusLabel(g.status)}{' '}
                            <span className="tabular-nums text-gray-400">· {g.rows.length}</span>
                          </th>
                        </tr>
                      )}
                      {g.rows.map((n) => (
                        <PageRow
                          key={n.documentId}
                          node={n}
                          info={infoById.get(n.documentId)}
                          folder={parentTitle(n)}
                          to={href(n)}
                        />
                      ))}
                    </tbody>
                  ))}
                </table>
              )}
            </div>
          </section>

          <section className="min-w-0">
            <div className="flex min-h-9 items-center">
              <h3 className="text-[15px] font-semibold text-gray-950">{t('Cần chú ý', 'Needs attention')}</h3>
            </div>
            <div className="mt-2.5 overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs">
              {attention.length > 0 ? (
                <ul className="divide-y divide-gray-200">{attention.slice(0, 6)}</ul>
              ) : (
                <p className="px-4 py-5 text-[13px] text-gray-500">
                  {infoQ.isLoading && !infoQ.data
                    ? t('Đang tải…', 'Loading…')
                    : t('Không có gì cần chú ý.', 'Nothing needs attention.')}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

const TYPE_BADGE: Record<DocType, string> = {
  SRS: 'bg-brand-50 text-brand-800',
  URD: 'bg-amber-100 text-amber-900',
  BRD: 'bg-violet-100 text-violet-700',
  OTHER: 'bg-gray-100 text-gray-600',
}

export function DocTypeBadge({ docType }: { docType: DocType | null }) {
  const d = docType ?? 'OTHER'
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-[10.5px] font-bold',
        TYPE_BADGE[d],
      )}
    >
      {d === 'OTHER' ? 'DOC' : d}
    </span>
  )
}

function PageRow({
  node,
  info,
  folder,
  to,
}: {
  node: DocumentNodeDto
  info: PageInfo | undefined
  folder: string | null
  to: string
}) {
  const { t } = useI18n()
  const v = node.currentVersion!
  const stale = info?.stale.length ?? 0
  return (
    <tr className="relative hover:bg-gray-50 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 max-md:px-4 max-md:py-3">
      <td className="px-4 py-3 max-md:w-full max-md:p-0">
        <div className="flex min-w-0 items-center gap-3">
          <DocTypeBadge docType={node.docType} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {/* Cả hàng bấm được: link phủ toàn hàng qua after:inset-0. */}
              <Link
                to={to}
                className="truncate font-medium text-gray-950 after:absolute after:inset-0 hover:text-brand-700 focus-visible:outline-none focus-visible:after:ring-4 focus-visible:after:ring-inset focus-visible:after:ring-brand-100"
              >
                {node.title}
              </Link>
              {node.code && <Chip>{node.code}</Chip>}
            </div>
            {folder && <p className="truncate text-[12.5px] text-gray-500">{folder}</p>}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 max-md:p-0">
        <StatusPill status={v.status} />
        <span className="ml-1.5 text-[12.5px] text-gray-500">{t(`bản ${v.label}`, `v${v.label}`)}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-gray-700 max-md:p-0">
        <span className="md:hidden">REQ </span>
        {node.reqCount}
        {stale > 0 && <span className="ml-1 text-xs text-amber-700">· {t(`${stale} cũ`, `${stale} stale`)}</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-3 max-md:p-0">
        <span className="flex items-center gap-2 text-[13px] text-gray-600">
          {info?.author && <Avatar name={info.author.fullName} size="sm" />}
          {formatRelative(node.updatedAt)}
        </span>
      </td>
    </tr>
  )
}

function AttentionRow({
  pill,
  title,
  detail,
  to,
  action,
}: {
  pill: ReactNode
  title: string
  detail: string
  to: string
  action: string
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-3 text-[13px]">
      {pill}
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-950">{title}</p>
        <p className="truncate text-xs text-gray-500">{detail}</p>
      </div>
      <Link to={to} className="font-medium text-brand-700 hover:underline">
        {action}
      </Link>
    </li>
  )
}
