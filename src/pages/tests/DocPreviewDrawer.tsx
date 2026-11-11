import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { documentApi } from '@/api/documentApi'
import { testApi } from '@/api/testApi'
import { LoadingBlock } from '@/components/layout/PageParts'
import { buttonClasses } from '@/components/ui/Button'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import { sectionOfReq } from '@/lib/testplan/sections'
import { statusIn } from '@/lib/testplan/status'
import { priorityLabel, StatusPill as VersionPill } from '../documents/docUi'
import type { DocumentDetailDto, RequirementItemDto } from '@/types/document'
import type { DocSectionDto, TestCaseDto, TestPlanDto } from '@/types/testing'
import { Drawer, Notice, smallBtn, StatusPill, tableCls, tdCls } from './testUi'
import { ArrowUpRightIcon, FileTextIcon, LinkIcon } from '@/components/ui/icons'

// Bấm mã REQ → xem đoạn REQ như trong module Tài liệu: tên + phiên bản tài liệu, đường dẫn mục, các REQ cùng mục (REQ
// đang xem tô sáng), testcase kiểm REQ này; "Mở trong Tài liệu" tới đúng chỗ (/projects/:id/documents/:docId#anchor,
// như link REQ ở Kanban), "Sao chép link".

interface Loaded {
  doc: DocumentDetailDto
  reqs: RequirementItemDto[]
  sections: DocSectionDto[]
}

export function DocPreviewDrawer({
  projectId,
  plan,
  envId,
  documentId,
  reqUid,
  cases,
  onGoto,
  notify,
  onClose,
}: {
  projectId: number
  plan: TestPlanDto
  envId: number
  documentId: number
  reqUid: string
  cases: TestCaseDto[]
  onGoto: (tc: TestCaseDto) => void
  notify: (text: string, tone?: 'ok' | 'error') => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    Promise.all([
      documentApi.get(documentId),
      documentApi.listRequirements(documentId),
      testApi.documentSections(documentId).catch(() => [] as DocSectionDto[]),
    ])
      .then(([doc, reqs, sections]) => alive && setData({ doc, reqs, sections }))
      .catch((err) => alive && setError(apiErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [documentId])

  const req = data?.reqs.find((r) => r.reqUid === reqUid) ?? null
  const section = data ? sectionOfReq(data.sections, reqUid) : null
  const same = data ? (section ? data.reqs.filter((r) => section.reqUids.includes(r.reqUid)) : req ? [req] : []) : []
  const linked = (uid: string) =>
    cases.filter(
      (c) => c.status === 'ACTIVE' && c.requirements.some((r) => r.documentId === documentId && r.reqUid === uid),
    )
  const list = linked(reqUid)
  const href = `/projects/${projectId}/documents/${documentId}${req ? `#${req.anchorId}` : ''}`
  const modOf = (id: number) => plan.modules.find((m) => m.moduleId === id)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`)
      notify(t('Đã sao chép link', 'Link copied'))
    } catch {
      notify(t('Không sao chép được — hãy copy từ thanh địa chỉ sau khi mở.', "Couldn't copy the link."), 'error')
    }
  }

  return (
    <Drawer
      wide
      icon={FileTextIcon}
      onClose={onClose}
      title={
        data ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            {data.doc.node.code ? `${data.doc.node.code} · ` : ''}
            {data.doc.node.title}
            <VersionPill status={data.doc.current.status}>
              {data.doc.current.label} · {t(...versionText(data.doc.current.status))}
            </VersionPill>
          </span>
        ) : (
          t('Tài liệu', 'Document')
        )
      }
    >
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : !data ? (
        <LoadingBlock />
      ) : (
        <>
          <p className="mb-2.5 text-[12.5px] text-gray-500">
            {t('Tài liệu', 'Documents')} › <b className="font-medium text-gray-700">{data.doc.node.title}</b>
            {section && (
              <>
                {' '}
                › <b className="font-medium text-gray-700">{section.title}</b>
              </>
            )}
          </p>
          <div className="rounded-card border border-gray-200 bg-white p-4">
            {section && <h4 className="mb-2.5 text-[15px] font-semibold text-gray-950">{section.title}</h4>}
            {same.map((r) => {
              const l = linked(r.reqUid)
              const st = l.map((c) => statusIn(c, envId))
              const pass = st.filter((s) => s === 'PASS').length
              const fail = st.filter((s) => s === 'FAIL').length
              const current = r.reqUid === reqUid
              return (
                <div
                  key={r.reqUid}
                  className={clsx(
                    'mb-2 rounded-[8px] border border-l-[3px] px-2.5 py-2',
                    current
                      ? 'border-amber-200 border-l-amber-500 bg-amber-50'
                      : 'border-gray-200 border-l-gray-300 opacity-75',
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[13.5px]">
                    <span className="rounded-[5px] bg-brand-50 px-1.5 font-mono text-[11.5px] font-medium text-brand-700">
                      {r.reqKey}
                    </span>
                    <b className="font-semibold">{r.title}</b>
                    {current && <span className="text-[12px] text-gray-500">← {t('đang xem', 'viewing')}</span>}
                    <span className="ml-auto rounded-full bg-brand-50 px-2 text-[11.5px] text-brand-700">
                      {priorityLabel(r.priority)}
                    </span>
                  </div>
                  {current && r.bodyPreview && (
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-800">{r.bodyPreview}</p>
                  )}
                  <div className="mt-1.5 text-[12px] text-gray-500">
                    {l.length ? (
                      <>
                        {t(`${l.length} testcase · ${pass} Pass`, `${l.length} test cases · ${pass} pass`)}
                        {fail > 0 && <span className="text-red-700"> · {fail} Fail</span>}
                      </>
                    ) : (
                      <span className="text-amber-800">{t('Chưa có testcase', 'No test cases')}</span>
                    )}
                  </div>
                </div>
              )
            })}
            {!same.length && (
              <p className="text-gray-500">
                {t('Không tìm thấy REQ trong bản hiện tại.', 'REQ not found in the current version.')}
              </p>
            )}
          </div>
          <p className="mb-1.5 mt-4 font-medium">
            {t(`Testcase kiểm ${req?.reqKey ?? 'REQ'}`, `Test cases for ${req?.reqKey ?? 'REQ'}`)}
          </p>
          {list.length ? (
            <table className={tableCls}>
              <tbody>
                {list.map((c) => (
                  <tr key={c.testCaseId}>
                    <td className={clsx(tdCls, 'w-28 pl-0')}>
                      <button
                        type="button"
                        onClick={() => onGoto(c)}
                        className="rounded-[5px] bg-gray-100 px-1.5 font-mono text-[11.5px] text-gray-600 hover:underline"
                      >
                        {modOf(c.moduleId)?.shortCode}·{c.code}
                      </button>
                    </td>
                    <td className={tdCls}>{c.title}</td>
                    <td className={clsx(tdCls, 'w-28')}>
                      <StatusPill status={statusIn(c, envId)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Notice icon={FileTextIcon} tone="warning" className="text-gray-500">
              {t('Chưa có testcase', 'No test cases yet')}
            </Notice>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <Link to={href} className={buttonClasses({ inline: true })}>
              <ArrowUpRightIcon width={16} height={16} aria-hidden="true" />
              {t('Mở trong Tài liệu', 'Open in Documents')}
            </Link>
            <button type="button" className={smallBtn} onClick={() => void copy()}>
              <LinkIcon width={16} height={16} aria-hidden="true" />
              {t('Sao chép link', 'Copy link')}
            </button>
            <span className="text-[12px] text-gray-500">
              {t(
                `Mở đúng ${req?.reqKey ?? 'REQ'}, cuộn tới và tô sáng`,
                `Opens ${req?.reqKey ?? 'the REQ'} and scrolls to it`,
              )}
            </span>
          </div>
        </>
      )}
    </Drawer>
  )
}

function versionText(s: DocumentDetailDto['current']['status']): [string, string] {
  switch (s) {
    case 'APPROVED':
      return ['Đã duyệt', 'Approved']
    case 'IN_REVIEW':
      return ['Chờ duyệt', 'In review']
    case 'CHANGES_REQUESTED':
      return ['Cần sửa', 'Changes requested']
    case 'SUPERSEDED':
      return ['Đã thay thế', 'Superseded']
    default:
      return ['Bản nháp', 'Draft']
  }
}
