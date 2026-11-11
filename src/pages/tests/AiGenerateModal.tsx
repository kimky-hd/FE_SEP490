import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { testApi } from '@/api/testApi'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/layout/PageParts'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import { findPlacement, groupsOf, placementKey, topSections } from '@/lib/testplan/placement'
import { sectionOfReq, stripHeadingNumber } from '@/lib/testplan/sections'
import { stepsToText } from '@/lib/testplan/steps'
import type { RequirementRef } from '@/types/issue'
import {
  TEST_CATEGORIES,
  type DocSectionDto,
  type TestCaseDto,
  type TestPlacementDto,
  type TestPlanDto,
  type TestPriority,
  type TestStep,
} from '@/types/testing'
import type { ReqOption } from '../kanban/reqLinks'
import { inputCls } from './testUi'
import { IconTile } from '@/components/ui/IconTile'
import { MapPinIcon } from '@/components/ui/icons'
import { reqKeyOf } from './useTestPlan'

// AI sinh testcase (chỉ mở từ Đối chiếu REQ): đề xuất cho từng REQ (#52 đổi), mỗi đề xuất có REQ + loại test, gom theo
// chỗ đặt "module › mục › loại test". Đổi REQ / loại → tính lại chỗ đặt (lib/testplan/placement). Chỗ chưa có hiện
// "sẽ tạo mới" (màu cam); Lưu tạo luôn module / mục / nhóm còn thiếu và các case có dấu AI (REQ chờ người kiểm tra).

interface Item {
  tempId: string
  on: boolean
  title: string
  req: string
  category: string
  priority: TestPriority
  steps: TestStep[]
  preconditions: string | null
}

export function AiGenerateModal({
  projectId,
  plan,
  reqs,
  refs,
  onClose,
  onDone,
}: {
  projectId: number
  plan: TestPlanDto
  reqs: { list: ReqOption[]; map: Map<string, ReqOption> }
  refs: RequirementRef[]
  onClose: () => void
  onDone: (created: TestCaseDto[]) => void | Promise<void>
}) {
  const { t } = useI18n()
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<Map<number, DocSectionDto[]>>(new Map())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    testApi
      .suggest(projectId, { planId: plan.planId, refs })
      .then((list) => {
        if (!alive) return
        setItems(
          list.map((s) => ({
            tempId: s.tempId,
            on: true,
            title: s.title,
            req: reqKeyOf(s.requirementRef),
            category: s.category,
            priority: s.priority,
            steps: s.steps,
            preconditions: s.preconditions,
          })),
        )
      })
      .catch((err) => alive && setError(apiErrorMessage(err)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mục tài liệu của mọi tài liệu đang có REQ trong danh sách (để tính chỗ đặt).
  const docIds = useMemo(
    () => [...new Set((items ?? []).map((i) => Number(i.req.split(':')[0])))].filter((d) => !sections.has(d)),
    [items, sections],
  )
  useEffect(() => {
    for (const d of docIds)
      testApi
        .documentSections(d)
        .then((s) => setSections((m) => new Map(m).set(d, s)))
        .catch(() => setSections((m) => new Map(m).set(d, [])))
  }, [docIds])

  const placeOf = (it: Item): TestPlacementDto => {
    const [d, uid] = it.req.split(':')
    const documentId = Number(d)
    const sec = sectionOfReq(sections.get(documentId) ?? [], uid)
    const doc = reqs.map.get(it.req)
    return findPlacement(
      plan.modules,
      {
        documentId,
        anchorId: sec?.anchorId ?? null,
        title: sec ? stripHeadingNumber(sec.title) : (doc?.documentTitle ?? ''),
      },
      it.category,
    )
  }

  const label = (p: TestPlacementDto) => {
    const m = plan.modules.find((x) => x.moduleId === p.moduleId)
    const top = m ? topSections(m).find((s) => s.sectionId === p.sectionId) : undefined
    const group = m && top ? groupsOf(m, top.sectionId).find((g) => g.sectionId === p.groupId) : undefined
    const doc = reqs.list.find((r) => r.documentId === p.documentId)
    const newCls = 'font-medium text-amber-800'
    return (
      <>
        {m ? (
          <b className="text-gray-900">{m.name}</b>
        ) : (
          <span className={newCls}>
            {t(`Module mới: ${doc?.documentTitle ?? ''}`, `New module: ${doc?.documentTitle ?? ''}`)}
          </span>
        )}
        <span aria-hidden="true"> › </span>
        {top ? (
          <b className="text-gray-900">
            {top.code} {top.title}
          </b>
        ) : (
          <span className={newCls}>{t(`mục mới: ${p.sectionTitle}`, `new section: ${p.sectionTitle}`)}</span>
        )}
        <span aria-hidden="true"> › </span>
        {group ? (
          <b className="text-gray-900">{p.category}</b>
        ) : (
          <span className={newCls}>{t(`nhóm mới: ${p.category}`, `new group: ${p.category}`)}</span>
        )}
      </>
    )
  }

  const groups = useMemo(() => {
    const m = new Map<string, { place: TestPlacementDto; idx: number[] }>()
    ;(items ?? []).forEach((it, i) => {
      const place = placeOf(it)
      const k = placementKey(place)
      const g = m.get(k) ?? { place, idx: [] }
      g.idx.push(i)
      m.set(k, g)
    })
    return [...m.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sections, plan.modules])

  const set = (i: number, patch: Partial<Item>) =>
    setItems((list) => list && list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const n = (items ?? []).filter((x) => x.on && x.title.trim()).length

  const save = async () => {
    if (!items) return
    setBusy(true)
    let created: TestCaseDto[]
    try {
      created = await testApi.aiApply(plan.planId, {
        items: items
          .filter((x) => x.on && x.title.trim())
          .map((x) => {
            const [d, uid] = x.req.split(':')
            return {
              title: x.title.trim(),
              preconditions: x.preconditions,
              steps: x.steps,
              priority: x.priority,
              category: x.category,
              requirementRef: { documentId: Number(d), reqUid: uid },
            }
          }),
      })
    } catch (err) {
      setError(apiErrorMessage(err))
      setBusy(false)
      return
    }
    // onDone đóng hộp; lỗi sau đó (tải lại…) không ghi vào hộp đã đóng.
    setBusy(false)
    await onDone(created)
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t(
        `AI sinh testcase · đề xuất cho ${refs.length} REQ`,
        `AI test cases · proposals for ${refs.length} REQs`,
      )}
      description={t(
        'Xem lại đề xuất, sửa nếu AI hiểu sai, rồi thêm vào bảng.',
        'Review the proposals, fix what AI got wrong, then add them.',
      )}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void save()} disabled={!n} isLoading={busy}>
            {t(`Thêm ${n} testcase`, `Add ${n} test cases`)}
          </Button>
        </>
      }
    >
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
        >
          {error}
        </p>
      )}
      {!items ? (
        !error && <LoadingBlock label={t('AI đang đề xuất…', 'AI is drafting…')} />
      ) : (
        <>
          <p className="mb-2 text-[13.5px] text-gray-700">
            {t(
              `AI đề xuất ${items.length} testcase, đã gắn REQ, xếp theo `,
              `AI proposes ${items.length} test cases, linked to REQs, placed by `,
            )}
            <b>{t('tài liệu › mục › loại test', 'document › section › category')}</b>
            {t(' — đổi REQ hoặc loại thì chỗ đặt đổi theo. ', ' — changing the REQ or category moves it. ')}
            <span className="font-medium text-amber-800">{t('Cam', 'Amber')}</span> ={' '}
            {t('sẽ tạo mới.', 'will be created.')}
          </p>
          {groups.map((g) => (
            <div key={placementKey(g.place)}>
              <p className="mb-1.5 mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px] text-gray-600">
                <IconTile icon={MapPinIcon} tone="ai" />
                {label(g.place)}
              </p>
              {g.idx.map((i) => {
                const it = items[i]
                const text = stepsToText(it.steps)
                const cats = TEST_CATEGORIES.includes(it.category as (typeof TEST_CATEGORIES)[number])
                  ? [...TEST_CATEGORIES]
                  : [...TEST_CATEGORIES, it.category]
                return (
                  <div
                    key={it.tempId}
                    className={clsx('mb-2 rounded-control border border-gray-200 px-2.5 py-2', !it.on && 'opacity-50')}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={it.on}
                        onChange={(e) => set(i, { on: e.target.checked })}
                        aria-label={t(`Lấy đề xuất ${i + 1}`, `Keep proposal ${i + 1}`)}
                      />
                      <input
                        value={it.title}
                        onChange={(e) => set(i, { title: e.target.value })}
                        aria-label={t(`Tên testcase ${i + 1}`, `Title of proposal ${i + 1}`)}
                        maxLength={300}
                        className={clsx(inputCls, 'min-w-[12rem] flex-1')}
                      />
                      <select
                        value={it.req}
                        onChange={(e) => set(i, { req: e.target.value })}
                        aria-label={t(`REQ của đề xuất ${i + 1}`, `REQ of proposal ${i + 1}`)}
                        className={clsx(inputCls, 'w-auto max-w-[11rem]')}
                      >
                        {reqs.list.map((r) => (
                          <option key={reqKeyOf(r)} value={reqKeyOf(r)}>
                            {r.documentCode} · {r.reqKey}
                          </option>
                        ))}
                        {!reqs.map.has(it.req) && <option value={it.req}>{it.req.split(':')[1].slice(0, 8)}</option>}
                      </select>
                      <select
                        value={it.category}
                        onChange={(e) => set(i, { category: e.target.value })}
                        aria-label={t(`Loại test của đề xuất ${i + 1}`, `Category of proposal ${i + 1}`)}
                        className={clsx(inputCls, 'w-auto max-w-[9rem]')}
                      >
                        {cats.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <details className="ml-6 mt-1.5 text-[12.5px] text-gray-600">
                      <summary className="cursor-pointer">{t('Các bước & mong đợi', 'Steps & expected')}</summary>
                      <pre className="mt-1 whitespace-pre-line font-sans">{text.steps}</pre>
                      <pre className="mt-1 whitespace-pre-line font-sans text-gray-800">{text.expected}</pre>
                    </details>
                  </div>
                )
              })}
            </div>
          ))}
          {!items.length && (
            <p className="text-[13px] text-gray-500">
              {t(
                'AI không có đề xuất mới (các tiêu chí đã có testcase).',
                'No new proposals (criteria already covered).',
              )}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}
