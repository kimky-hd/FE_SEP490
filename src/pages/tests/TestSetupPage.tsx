import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { documentApi } from '@/api/documentApi'
import { testApi } from '@/api/testApi'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { IconTile } from '@/components/ui/IconTile'
import {
  CalendarIcon,
  CheckIcon,
  FileTextIcon,
  LockIcon,
  PlusIcon,
  ServerIcon,
  SlidersIcon,
  TrashIcon,
  UsersIcon,
} from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiErrors'
import { isSpecDoc } from '@/lib/phaseGateEval'
import { topSections } from '@/lib/testplan/placement'
import type { DocumentNodeDto } from '@/types/document'
import type { TestEnvironmentDto, TestPlanDto } from '@/types/testing'
import { Toast, useToast } from '../documents/view/Toast'
import { ConfirmModal } from './dialogs'
import { PersonDot } from '../kanban/workUi'
import { useProjectContext } from '../projects/ProjectLayout'
import { BuildTag, iconBtn, inputCls, Notice, Panel, smallBtn, tableCls, tdCls, thCls } from './testUi'
import { useTestPlan } from './useTestPlan'

// /projects/:id/tests/setup — "Thiết lập đợt test", làm một lần khi tạo đợt: (1) tên + thời gian, (2) môi trường
// (thêm / sửa / xoá), (3) module tạo từ tài liệu đặc tả (mục lớn lấy theo heading của tài liệu), (4) phân công
// module × môi trường (mỗi ô một người; "← Giống <môi trường đầu>" để chép). Thay đổi lưu ngay. Cần testcase.plan.

function CreatePlanForm({
  projectId,
  onCreated,
  onCancel,
}: {
  projectId: number
  onCreated: (plan: TestPlanDto) => void
  onCancel?: () => void
}) {
  const { t } = useI18n()
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('SIT – Release 1')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState('')
  const [envs, setEnvs] = useState('SIT, UAT')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      onCreated(
        await testApi.createPlan(projectId, {
          name: name.trim(),
          startDate: start || null,
          endDate: end || null,
          environments: envs
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        }),
      )
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const lbl = 'block text-[13px] font-medium text-gray-700'
  return (
    <Panel icon={CalendarIcon} title={t('Tạo đợt test', 'Create a test plan')}>
      <div className="grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr]">
        <label className={lbl}>
          {t('Tên đợt', 'Plan name')}
          <input
            className={clsx(inputCls, 'mt-1')}
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={lbl}>
          {t('Bắt đầu', 'Start')}
          <input
            type="date"
            className={clsx(inputCls, 'mt-1')}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className={lbl}>
          {t('Kết thúc', 'End')}
          <input type="date" className={clsx(inputCls, 'mt-1')} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label className={clsx(lbl, 'sm:col-span-3')}>
          {t('Môi trường (cách nhau bằng dấu phẩy)', 'Environments (comma separated)')}
          <input className={clsx(inputCls, 'mt-1')} value={envs} onChange={(e) => setEnvs(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-red-700 sm:col-span-3">
            {error}
          </p>
        )}
        <div className="sm:col-span-3">
          <Button inline onClick={() => void save()} disabled={!name.trim()} isLoading={busy}>
            {t('Tạo đợt test', 'Create plan')}
          </Button>
          {onCancel && (
            <Button inline variant="secondary" className="ml-2" onClick={onCancel}>
              {t('Huỷ', 'Cancel')}
            </Button>
          )}
        </div>
      </div>
    </Panel>
  )
}

export function TestSetupPage() {
  const { t } = useI18n()
  const { project } = useProjectContext()
  const projectId = project.projectId
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const planParam = Number(params.get('plan')) || null
  const st = useTestPlan(project, planParam)
  const { plan, cases, abilities } = st
  const { toast, notify } = useToast()
  const [docs, setDocs] = useState<DocumentNodeDto[] | null>(null)
  const [newEnv, setNewEnv] = useState('')
  const [newDoc, setNewDoc] = useState('')
  const [busy, setBusy] = useState(false)
  const [removeEnv, setRemoveEnv] = useState<TestEnvironmentDto | null>(null)

  useEffect(() => {
    if (!abilities.plan) return
    let alive = true
    documentApi
      .listTree(projectId)
      .then((list) => alive && setDocs(list.filter((n) => n.kind === 'PAGE')))
      .catch(() => alive && setDocs([]))
    return () => {
      alive = false
    }
  }, [projectId, abilities.plan])

  const unusedDocs = useMemo(() => {
    const used = new Set(plan?.modules.map((m) => m.documentId) ?? [])
    const list = (docs ?? []).filter((d) => !used.has(d.documentId))
    return [...list.filter(isSpecDoc), ...list.filter((d) => !isSpecDoc(d))]
  }, [docs, plan?.modules])
  useEffect(() => {
    if (unusedDocs.length && !unusedDocs.some((d) => String(d.documentId) === newDoc))
      setNewDoc(String(unusedDocs[0].documentId))
  }, [unusedDocs, newDoc])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) notify(ok)
    } catch (err) {
      notify(apiErrorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <Link to={`/projects/${projectId}/tests${plan ? `?plan=${plan.planId}` : ''}`} className={smallBtn}>
      ← {t('Quay lại', 'Back')}
    </Link>
  )

  if (!abilities.plan && !(abilities.reopen && plan))
    return (
      <div>
        {back}
        <p className="mt-6 text-center text-[14px] text-gray-500">
          <Notice icon={LockIcon} tone="neutral" className="justify-center">
            {t('Thiết lập đợt test cần quyền testcase.plan.', 'Test plan setup needs testcase.plan.')}
          </Notice>
        </p>
      </div>
    )
  if (st.error)
    return (
      <div>
        <ErrorState message={st.error} onRetry={() => void st.reload()} />
      </div>
    )
  if (st.loading && !plan)
    return (
      <div>
        <LoadingBlock />
      </div>
    )

  const creating = params.get('new') === '1'
  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      {back}
      <IconTile icon={SlidersIcon} />
      <h2 className="text-[17px] font-semibold text-gray-950">{t('Thiết lập đợt test', 'Test plan setup')}</h2>
      {plan && !creating && (abilities.plan || abilities.reopen) && (
        <button type="button" className={smallBtn} onClick={() => setParams({ new: '1' }, { replace: true })}>
          <PlusIcon width={16} height={16} aria-hidden="true" />
          {t('Đợt test mới', 'New test plan')}
        </button>
      )}
      <span className="text-[13px] text-gray-500">
        {t(
          'Chỉ cần tên đợt và môi trường là đủ để bắt đầu viết testcase; thay đổi lưu ngay.',
          'Usually done once per plan; changes save immediately.',
        )}
      </span>
    </div>
  )

  if (!plan || creating)
    return (
      <div>
        <div className="max-w-[980px]">
          {header}
          <CreatePlanForm
            projectId={projectId}
            onCancel={plan ? () => setParams({ plan: String(plan.planId) }, { replace: true }) : undefined}
            onCreated={(p) => {
              setParams({ plan: String(p.planId) }, { replace: true })
              void st.reload()
              notify(t(`Đã tạo đợt test ${p.name}`, `Created ${p.name}`))
            }}
          />
        </div>
        <Toast toast={toast} />
      </div>
    )

  if (plan.status === 'HANDED_OVER')
    return (
      <div>
        {header}
        <Notice
          icon={CheckIcon}
          className="rounded-card border border-success-200 bg-success-50 px-4 py-3 text-[13.5px] text-success-700"
        >
          {t('Đã bàn giao · chỉ xem', 'Handed over · read-only')}
        </Notice>
      </div>
    )

  const owner = (moduleId: number, envId: number) =>
    plan.assignments.find((a) => a.moduleId === moduleId && a.envId === envId)?.assignee ?? null
  const qa = plan.people.filter((p) => p.qa)
  const firstEnv = plan.environments[0]
  const load = new Map<number, string[]>()
  for (const p of plan.people) load.set(p.userId, [])
  for (const a of plan.assignments) {
    const m = plan.modules.find((x) => x.moduleId === a.moduleId)
    const e = plan.environments.find((x) => x.envId === a.envId)
    if (a.assignee && m && e)
      load.set(a.assignee.userId, [...(load.get(a.assignee.userId) ?? []), `${m.shortCode}·${e.name}`])
  }
  const lbl = 'block text-[13px] font-medium text-gray-700'

  const savePlan = (patch: { name?: string; startDate?: string | null; endDate?: string | null }) =>
    void run(async () => {
      const next = await testApi.updatePlan(plan.planId, patch)
      st.setPlan(() => next)
    })
  const saveEnv = (e: TestEnvironmentDto, patch: { name?: string; url?: string | null; note?: string | null }) =>
    void run(async () => {
      const next = await testApi.updateEnvironment(e.envId, patch)
      st.setPlan((p) => ({ ...p, environments: p.environments.map((x) => (x.envId === e.envId ? next : x)) }))
    })
  const assign = (moduleId: number, envId: number, assigneeId: number | null) =>
    void run(async () => {
      const list = await testApi.setAssignments(plan.planId, { items: [{ moduleId, envId, assigneeId }] })
      st.setPlan((p) => ({ ...p, assignments: list }))
    })

  return (
    <div>
      <div className="max-w-[980px] space-y-4">
        {header}

        <Panel icon={CalendarIcon} title={t('Đợt test', 'Test plan')} step={1}>
          <div className="grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr]">
            <label className={lbl}>
              {t('Tên đợt', 'Plan name')}
              <input
                key={plan.name}
                className={clsx(inputCls, 'mt-1')}
                defaultValue={plan.name}
                maxLength={150}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value.trim() !== plan.name &&
                  savePlan({ name: e.target.value.trim() })
                }
              />
            </label>
            <label className={lbl}>
              {t('Bắt đầu', 'Start')}
              <input
                type="date"
                className={clsx(inputCls, 'mt-1')}
                key={`s-${plan.startDate}`}
                defaultValue={plan.startDate ?? ''}
                onBlur={(e) =>
                  (e.target.value || null) !== plan.startDate && savePlan({ startDate: e.target.value || null })
                }
              />
            </label>
            <label className={lbl}>
              {t('Kết thúc', 'End')}
              <input
                type="date"
                className={clsx(inputCls, 'mt-1')}
                key={`e-${plan.endDate}`}
                defaultValue={plan.endDate ?? ''}
                onBlur={(e) =>
                  (e.target.value || null) !== plan.endDate && savePlan({ endDate: e.target.value || null })
                }
              />
            </label>
          </div>
        </Panel>

        <Panel
          icon={ServerIcon}
          title={t('Môi trường test', 'Test environments')}
          step={2}
          hint={t(
            'Mỗi môi trường có build, kết quả và người test riêng',
            'Each environment has its own builds, results and testers',
          )}
        >
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={clsx(thCls, 'w-36')}>{t('Tên', 'Name')}</th>
                  <th className={thCls}>{t('Địa chỉ', 'URL')}</th>
                  <th className={thCls}>{t('Ghi chú', 'Note')}</th>
                  <th className={clsx(thCls, 'w-28')}>{t('Build hiện tại', 'Current build')}</th>
                  <th className={clsx(thCls, 'w-12')} />
                </tr>
              </thead>
              <tbody>
                {plan.environments.map((e) => (
                  <tr key={e.envId}>
                    <td className={tdCls}>
                      <input
                        key={e.name}
                        className={inputCls}
                        defaultValue={e.name}
                        maxLength={40}
                        aria-label={t(`Tên môi trường ${e.name}`, `Name of ${e.name}`)}
                        onBlur={(ev) =>
                          ev.target.value.trim() &&
                          ev.target.value.trim() !== e.name &&
                          saveEnv(e, { name: ev.target.value.trim() })
                        }
                      />
                    </td>
                    <td className={tdCls}>
                      <input
                        className={inputCls}
                        defaultValue={e.url ?? ''}
                        placeholder="https://…"
                        aria-label={t(`Địa chỉ ${e.name}`, `URL of ${e.name}`)}
                        onBlur={(ev) =>
                          ev.target.value !== (e.url ?? '') && saveEnv(e, { url: ev.target.value || null })
                        }
                      />
                    </td>
                    <td className={tdCls}>
                      <input
                        className={inputCls}
                        defaultValue={e.note ?? ''}
                        aria-label={t(`Ghi chú ${e.name}`, `Note of ${e.name}`)}
                        onBlur={(ev) =>
                          ev.target.value !== (e.note ?? '') && saveEnv(e, { note: ev.target.value || null })
                        }
                      />
                    </td>
                    <td className={tdCls}>
                      <BuildTag>{e.currentBuild ?? '—'}</BuildTag>
                    </td>
                    <td className={tdCls}>
                      <button
                        type="button"
                        className={iconBtn}
                        disabled={plan.environments.length <= 1 || busy}
                        aria-label={t(`Xoá môi trường ${e.name}`, `Remove ${e.name}`)}
                        title={t('Xoá môi trường', 'Remove environment')}
                        onClick={() => setRemoveEnv(e)}
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className={tdCls}>
                    <input
                      className={inputCls}
                      value={newEnv}
                      maxLength={40}
                      onChange={(e) => setNewEnv(e.target.value)}
                      placeholder={t('Vd: PreProd', 'e.g. PreProd')}
                      aria-label={t('Tên môi trường mới', 'New environment name')}
                    />
                  </td>
                  <td className={tdCls} colSpan={4}>
                    <button
                      type="button"
                      className={smallBtn}
                      disabled={!newEnv.trim() || busy}
                      onClick={() =>
                        void run(
                          async () => {
                            await testApi.addEnvironment(plan.planId, { name: newEnv.trim() })
                            setNewEnv('')
                            await st.reloadPlan()
                          },
                          t(`Đã thêm môi trường ${newEnv.trim()}`, `Added ${newEnv.trim()}`),
                        )
                      }
                    >
                      <PlusIcon width={16} height={16} aria-hidden="true" />
                      {t('Thêm môi trường', 'Add environment')}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          icon={FileTextIcon}
          title={t('Liên kết tài liệu đặc tả (tuỳ chọn)', 'Link spec documents (optional)')}
                    hint={t('Chỉ cần nếu muốn truy vết REQ; bỏ trống vẫn viết testcase bình thường', 'Only for REQ traceability; leave empty to write tests freely')}
        >
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t('Nhóm test', 'Group')}</th>
                  <th className={thCls}>{t('Tài liệu nguồn', 'Source document')}</th>
                  <th className={thCls}>{t('Mục lớn (từ tài liệu)', 'Sections (from the document)')}</th>
                  <th className={clsx(thCls, 'w-16 text-right')}>Case</th>
                  <th className={clsx(thCls, 'w-12')} />
                </tr>
              </thead>
              <tbody>
                {plan.modules.map((m) => {
                  const n = cases.filter((c) => c.moduleId === m.moduleId && c.status === 'ACTIVE').length
                  return (
                    <tr key={m.moduleId}>
                      <td className={tdCls}>
                        <input
                          key={m.name}
                          className={inputCls}
                          defaultValue={m.name}
                          maxLength={150}
                          aria-label={t(`Tên module ${m.name}`, `Name of module ${m.name}`)}
                          onBlur={(e) =>
                            e.target.value.trim() &&
                            e.target.value.trim() !== m.name &&
                            void run(async () => {
                              const next = await testApi.updateModule(m.moduleId, { name: e.target.value.trim() })
                              st.setPlan((p) => ({
                                ...p,
                                modules: p.modules.map((x) => (x.moduleId === m.moduleId ? next : x)),
                              }))
                            })
                          }
                        />
                      </td>
                      <td className={tdCls}>
                        <span className="rounded-[5px] bg-blue-50 px-1.5 text-[11.5px] font-medium text-blue-700">
                          {m.documentCode}
                        </span>
                      </td>
                      <td className={clsx(tdCls, 'text-[13px] text-gray-500')}>
                        {topSections(m)
                          .map((s) => `${s.code} ${s.title}`)
                          .join(' · ') || '—'}
                      </td>
                      <td className={clsx(tdCls, 'text-right tabular-nums')}>{n}</td>
                      <td className={tdCls}>
                        <button
                          type="button"
                          className={iconBtn}
                          disabled={n > 0 || busy}
                          title={
                            n > 0
                              ? t('Module còn testcase', 'The module has test cases')
                              : t('Xoá module', 'Remove module')
                          }
                          aria-label={t(`Xoá module ${m.name}`, `Remove module ${m.name}`)}
                          onClick={() =>
                            void run(
                              async () => {
                                await testApi.removeModule(m.moduleId)
                                await st.reload()
                              },
                              t(`Đã xoá module ${m.name}`, `Removed ${m.name}`),
                            )
                          }
                        >
                          <TrashIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td className={tdCls} colSpan={5}>
                    {docs === null ? (
                      <span className="text-[13px] text-gray-500">{t('Đang tải tài liệu…', 'Loading documents…')}</span>
                    ) : unusedDocs.length ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <select
                          className={clsx(inputCls, 'w-auto max-w-[320px]')}
                          value={newDoc}
                          onChange={(e) => setNewDoc(e.target.value)}
                          aria-label={t('Tài liệu tạo module', 'Document for the new module')}
                        >
                          {unusedDocs.map((d) => (
                            <option key={d.documentId} value={d.documentId}>
                              {d.code ? `${d.code} · ` : ''}
                              {d.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={smallBtn}
                          disabled={!newDoc || busy}
                          onClick={() =>
                            void run(async () => {
                              const m = await testApi.addModule(plan.planId, { documentId: Number(newDoc) })
                              await st.reloadPlan()
                              notify(
                                t(
                                  `Đã tạo module ${m.name} — giao người ở phần Phân công`,
                                  `Created ${m.name} — assign testers in step 4`,
                                ),
                              )
                            })
                          }
                        >
                          <PlusIcon width={16} height={16} aria-hidden="true" />
                          {t('Liên kết tài liệu', 'Link document')}
                        </button>
                      </span>
                    ) : (
                      <span className="text-[13px] text-gray-500">
                        {t('Mọi tài liệu đã được liên kết.', 'Every document is already linked.')}
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel icon={UsersIcon} title={t('Phân công người test (tuỳ chọn)', 'Assign testers (optional)')}>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>{t('Nhóm test', 'Group')}</th>
                  {plan.environments.map((e) => (
                    <th key={e.envId} className={thCls}>
                      {e.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.modules.map((m) => (
                  <tr key={m.moduleId}>
                    <td className={tdCls}>{m.name}</td>
                    {plan.environments.map((e) => {
                      const who = owner(m.moduleId, e.envId)
                      const options =
                        who && !qa.some((p) => p.userId === who.userId) ? [...qa, { ...who, qa: false }] : qa
                      return (
                        <td key={e.envId} className={tdCls}>
                          <select
                            className={clsx(inputCls, 'min-w-[150px]')}
                            value={who?.userId ?? ''}
                            aria-label={t(`Người test ${m.name} ở ${e.name}`, `Tester of ${m.name} on ${e.name}`)}
                            onChange={(ev) =>
                              assign(m.moduleId, e.envId, ev.target.value ? Number(ev.target.value) : null)
                            }
                          >
                            {options.map((p) => (
                              <option key={p.userId} value={p.userId}>
                                {p.fullName}
                              </option>
                            ))}
                            <option value="">{t('— Chưa giao', '— Unassigned')}</option>
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {firstEnv && plan.environments.length > 1 && (
                  <tr>
                    <td className={tdCls} />
                    {plan.environments.map((e) => (
                      <td key={e.envId} className={tdCls}>
                        {e.envId !== firstEnv.envId && (
                          <button
                            type="button"
                            className="text-[13px] font-medium text-brand-700 hover:underline"
                            onClick={() =>
                              void run(
                                async () => {
                                  const list = await testApi.setAssignments(plan.planId, {
                                    items: plan.modules.map((m) => ({
                                      moduleId: m.moduleId,
                                      envId: e.envId,
                                      assigneeId: owner(m.moduleId, firstEnv.envId)?.userId ?? null,
                                    })),
                                  })
                                  st.setPlan((p) => ({ ...p, assignments: list }))
                                },
                                t(
                                  `Phân công ${e.name} giống ${firstEnv.name}`,
                                  `${e.name} now matches ${firstEnv.name}`,
                                ),
                              )
                            }
                          >
                            ← {t(`Giống ${firstEnv.name}`, `Same as ${firstEnv.name}`)}
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="mb-2 text-[13px] font-medium text-gray-700">
              {t(`Theo người (${qa.length} QA)`, `By person (${qa.length} QA)`)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plan.people
                .filter((p) => p.qa || (load.get(p.userId)?.length ?? 0) > 0)
                .map((p) => {
                  const list = load.get(p.userId) ?? []
                  return (
                    <span
                      key={p.userId}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12.5px]',
                        list.length ? 'border-gray-200' : 'border-dashed border-gray-200 text-gray-400',
                      )}
                    >
                      <PersonDot user={p} size={20} />
                      {p.fullName} · {list.length ? list.join(', ') : t('chưa nhận', 'nothing yet')}
                    </span>
                  )
                })}
            </div>
          </div>
        </Panel>

        <div className="pb-4">
          <Button inline onClick={() => navigate(`/projects/${projectId}/tests?plan=${plan.planId}`)}>
            {t('Xong — về bảng testcase', 'Done — back to the sheet')}
          </Button>
        </div>
      </div>
      {removeEnv && (
        <ConfirmModal
          title={t(`Xoá môi trường ${removeEnv.name}?`, `Remove ${removeEnv.name}?`)}
          description={t(
            'Phân công và cờ test lại ở môi trường này sẽ mất.',
            'Assignments and retest flags there are lost.',
          )}
          confirmLabel={t('Xoá môi trường', 'Remove')}
          danger
          onClose={() => setRemoveEnv(null)}
          onConfirm={() =>
            run(
              async () => {
                await testApi.removeEnvironment(removeEnv.envId)
                setRemoveEnv(null)
                await st.reloadPlan()
              },
              t(`Đã xoá môi trường ${removeEnv.name}`, `Removed ${removeEnv.name}`),
            )
          }
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}
