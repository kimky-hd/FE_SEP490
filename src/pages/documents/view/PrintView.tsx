import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/i18n'
import { formatDate } from '@/lib/format'
import { sanitizeHtml } from '@/lib/sanitize'
import type { DocumentDetailDto, RequirementItemDto } from '@/types/document'
import { priorityLabel } from '../docUi'

export function usePrint() {
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    const id = setTimeout(() => window.print(), 80)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', done)
    }
  }, [printing])
  return { printing, print: () => setPrinting(true) }
}

export function PrintView({
  detail,
  html,
  requirements,
}: {
  detail: DocumentDetailDto
  html: string
  requirements: RequirementItemDto[]
}) {
  const { t } = useI18n()
  const { node, current } = detail
  return createPortal(
    <div className="doc-print-portal">
      <p className="text-xs text-gray-500">
        {node.code} · {t(`Bản ${current.label}`, `Version ${current.label}`)} · {current.status}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-950">{node.title}</h1>
      {current.subtitle && <p className="mt-1 text-sm text-gray-600">{current.subtitle}</p>}
      <p className="mt-2 text-xs text-gray-500">
        {t('Tác giả', 'Author')}: {current.author.fullName}
        {current.reviewedBy && current.status === 'APPROVED' && (
          <>
            {' '}
            · {t('Duyệt bởi', 'Approved by')} {current.reviewedBy.fullName} · {formatDate(current.reviewedAt)}
          </>
        )}{' '}
        · {t('In ngày', 'Printed')} {formatDate(new Date().toISOString())}
      </p>
      <hr className="my-4 border-gray-200" />
      {/* HTML lấy từ chính DOM editor đang hiển thị (nội dung do người dùng soạn qua schema TipTap), vẫn qua DOMPurify. */}
      <div className="doc-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
      {requirements.length > 0 && (
        <>
          <h2 className="mt-8 text-base font-bold text-gray-950">
            {t('Ma trận yêu cầu (RTM)', 'Requirements traceability (RTM)')}
          </h2>
          <table className="mt-2 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-1.5 pr-2">REQ</th>
                <th className="py-1.5 pr-2">{t('Tiêu đề', 'Title')}</th>
                <th className="py-1.5 pr-2">{t('Ưu tiên', 'Priority')}</th>
                <th className="py-1.5 pr-2">{t('Trạng thái', 'Freshness')}</th>
                <th className="py-1.5">{t('Tiêu chí', 'Criteria')}</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((r) => (
                <tr key={r.requirementId} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 tabular-nums">{r.reqKey}</td>
                  <td className="py-1.5 pr-2">{r.title}</td>
                  <td className="py-1.5 pr-2">{priorityLabel(r.priority)}</td>
                  <td className="py-1.5 pr-2">{r.freshness === 'STALE' ? 'Stale' : 'Fresh'}</td>
                  <td className="py-1.5 tabular-nums">{r.acceptanceCriteria.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>,
    document.body,
  )
}
