import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { issueApi } from '@/api/issueApi'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { useI18n } from '@/i18n'
import { stripHeadingNumber } from '@/lib/testplan/sections'
import { DEFAULT_CATEGORIES } from '@/lib/testplan/columns'
import type { TestAbilities } from '@/lib/testplan/abilities'
import type { ReqOption } from '../kanban/reqLinks'
import type {
  BugSeverity,
  DocSectionDto,
  TestBugRefDto,
  TestCaseDto,
  TestEnvironmentDto,
  TestModuleDto,
  UpdateTestCaseBody,
} from '@/types/testing'
import { inputCls } from './testUi'
import { reqKeyOf } from './useTestPlan'

// Hộp thoại của module Test cases: Fail → bug trên Kanban, gắn REQ, gắn testcase với REQ, thêm mục / nhóm, deploy build.

const choiceCls = (on: boolean, disabled = false) =>
  clsx(
    'flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 text-sm',
    on ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50',
    disabled && 'cursor-not-allowed opacity-60',
  )

export const SEVERITY_LABEL: Record<BugSeverity, string> = {
  HIGHEST: 'Critical',
  HIGH: 'Major',
  MEDIUM: 'Minor',
  LOW: 'Trivial',
}

interface OpenBug {
  issueId: number
  key: string
  title: string
  statusName: string
}

/** Fail → bug chỉ trên Kanban: tạo bug mới (điền sẵn từ testcase) hoặc gắn bug Kanban đang mở. */
export function BugModal({
  projectId,
  cases,
  env,
  abilities,
  onCreate,
  onLink,
  onClose,
}: {
  projectId: number
  cases: TestCaseDto[]
  env: TestEnvironmentDto
  abilities: Pick<TestAbilities, 'createBug' | 'linkBug'>
  onCreate: (body: { title: string; priority: BugSeverity }) => Promise<void>
  onLink: (issueId: number) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const first = cases[0]
  const [mode, setMode] = useState<'new' | 'link'>(abilities.createBug ? 'new' : 'link')
  const [title, setTitle] = useState(
    `${first?.title ?? ''}: ${first?.actual || t('không đúng mong đợi', 'not as expected')}`,
  )
  const [severity, setSeverity] = useState<BugSeverity>('HIGH')
  const [bugs, setBugs] = useState<OpenBug[] | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!abilities.linkBug) {
      setBugs([])
      return
    }
    let alive = true
    Promise.all([issueApi.board(projectId), issueApi.list(projectId, { type: 'BUG' })])
      .then(([board, list]) => {
        if (!alive) return
        const cat = (id: number) => board.columns.find((c) => c.statusId === id)
        const open = list
          .filter((i) => cat(i.statusId)?.category !== 'DONE')
          .map((i) => ({ issueId: i.issueId, key: i.key, title: i.title, statusName: cat(i.statusId)?.name ?? '' }))
        setBugs(open)
        setPick(open[0]?.issueId ?? null)
        if (!abilities.createBug && !open.length) setMode('link')
      })
      .catch(() => alive && setBugs([]))
    return () => {
      alive = false
    }
  }, [projectId, abilities.linkBug, abilities.createBug])

  const canSave = mode === 'new' ? abilities.createBug && !!title.trim() : pick !== null
  const save = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      if (mode === 'new') await onCreate({ title: title.trim(), priority: severity })
      else await onLink(pick!)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        cases.length > 1
          ? t(
              `${cases.length} testcase Fail — ghi bug trên Kanban`,
              `${cases.length} failed test cases — log a bug on Kanban`,
            )
          : t(`${first?.code} Fail — ghi bug trên Kanban`, `${first?.code} failed — log a bug on Kanban`)
      }
      description={`${first?.title ?? ''} · ${env.name} ${env.currentBuild ?? ''}`}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Để sau', 'Later')}
          </Button>
          {(abilities.createBug || (bugs?.length ?? 0) > 0) && (
            <Button inline onClick={() => void save()} disabled={!canSave} isLoading={busy}>
              {t('Lưu', 'Save')}
            </Button>
          )}
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('Cách ghi bug', 'How to log the bug')}</legend>
        <label className={choiceCls(mode === 'new', !abilities.createBug)}>
          <input
            type="radio"
            name="bug-mode"
            className="mt-1"
            checked={mode === 'new'}
            disabled={!abilities.createBug}
            onChange={() => setMode('new')}
          />
          <span>
            {t('Tạo bug mới trên Kanban', 'Create a new bug on Kanban')}
            <small className="block text-[12.5px] text-gray-500">
              {abilities.createBug
                ? t(
                    'Tự điền bước, mong đợi, kết quả thực tế, môi trường, build.',
                    'Steps, expected, actual, environment and build are filled in.',
                  )
                : t('Cần quyền issue.create.', 'Requires issue.create.')}
            </small>
          </span>
        </label>
        <label className={choiceCls(mode === 'link', !bugs?.length)}>
          <input
            type="radio"
            name="bug-mode"
            className="mt-1"
            checked={mode === 'link'}
            disabled={!bugs?.length}
            onChange={() => setMode('link')}
          />
          <span>
            {t('Gắn vào bug đang mở', 'Link to an open bug')}
            <small className="block text-[12.5px] text-gray-500">
              {bugs === null
                ? t('Đang tải bug…', 'Loading bugs…')
                : bugs.length
                  ? t('Cùng một lỗi đã có bug trên Kanban.', 'The same defect already has a bug on Kanban.')
                  : t('Không có bug nào đang mở.', 'No open bugs.')}
            </small>
          </span>
        </label>
      </fieldset>
      <div className="mt-4 space-y-3">
        {mode === 'new' ? (
          <>
            <TextField
              id="bug-title"
              label={t('Tiêu đề bug', 'Bug title')}
              value={title}
              maxLength={300}
              onChange={(e) => setTitle(e.target.value)}
              data-autofocus
            />
            <SelectField
              id="bug-severity"
              label={t('Mức độ', 'Severity')}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as BugSeverity)}
            >
              {(Object.keys(SEVERITY_LABEL) as BugSeverity[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </SelectField>
          </>
        ) : (
          <SelectField id="bug-pick" label="Bug" value={pick ?? ''} onChange={(e) => setPick(Number(e.target.value))}>
            {(bugs ?? []).map((b) => (
              <option key={b.issueId} value={b.issueId}>
                {b.key} · {b.title} ({b.statusName})
              </option>
            ))}
          </SelectField>
        )}
      </div>
    </Modal>
  )
}

/** Ô tìm + danh sách checkbox dùng chung cho chọn REQ / chọn testcase. */
function PickList<T>({
  items,
  search,
  keyOf,
  state,
  onToggle,
  render,
  placeholder,
}: {
  items: T[]
  search: (x: T) => string
  keyOf: (x: T) => string
  state: (x: T) => boolean | 'mixed'
  onToggle: (x: T, checked: boolean) => void
  render: (x: T) => React.ReactNode
  placeholder: string
}) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLocaleLowerCase('vi')
  const shown = needle ? items.filter((x) => search(x).toLocaleLowerCase('vi').includes(needle)) : items
  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={clsx(inputCls, 'h-9')}
        data-autofocus
      />
      <ul className="mt-2 max-h-[320px] overflow-y-auto rounded-control border border-gray-200">
        {shown.map((x) => {
          const st = state(x)
          return (
            <li key={keyOf(x)} className="border-t border-gray-100 first:border-t-0">
              <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-[13.5px] hover:bg-gray-50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={st === true}
                  ref={(el) => {
                    if (el) el.indeterminate = st === 'mixed'
                  }}
                  onChange={(e) => onToggle(x, e.target.checked)}
                />
                <span className="min-w-0">{render(x)}</span>
              </label>
            </li>
          )
        })}
        {!shown.length && <li className="px-3 py-3 text-[13px] text-gray-500">—</li>}
      </ul>
    </div>
  )
}

/** Gắn REQ cho một / nhiều testcase. Lưu = xác nhận REQ do AI gắn (bỏ dấu AI). */
export function ReqPickerModal({
  label,
  cases,
  allCases,
  reqs,
  onSave,
  onClose,
}: {
  label: string
  cases: TestCaseDto[]
  allCases: TestCaseDto[]
  reqs: ReqOption[]
  onSave: (items: { testCaseId: number; changes: UpdateTestCaseBody }[]) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const initial = (r: ReqOption): boolean | 'mixed' => {
    const n = cases.filter((c) => c.requirements.some((x) => reqKeyOf(x) === reqKeyOf(r))).length
    return n === 0 ? false : n === cases.length ? true : 'mixed'
  }
  const [state, setState] = useState<Map<string, boolean | 'mixed'>>(
    () => new Map(reqs.map((r) => [reqKeyOf(r), initial(r)])),
  )
  const [busy, setBusy] = useState(false)
  const linkedCount = (r: ReqOption) =>
    allCases.filter((c) => c.status === 'ACTIVE' && c.requirements.some((x) => reqKeyOf(x) === reqKeyOf(r))).length
  const ai = cases.some((c) => c.aiSuggestedReqs)

  const save = async () => {
    setBusy(true)
    try {
      await onSave(
        cases.map((c) => {
          const keep = c.requirements.filter((x) => {
            const st = state.get(reqKeyOf(x))
            return st === undefined || st === 'mixed' || st === true
          })
          const add = reqs.filter(
            (r) => state.get(reqKeyOf(r)) === true && !keep.some((x) => reqKeyOf(x) === reqKeyOf(r)),
          )
          return {
            testCaseId: c.testCaseId,
            changes: {
              requirementRefs: [...keep, ...add].map((x) => ({ documentId: x.documentId, reqUid: x.reqUid })),
              aiSuggestedReqs: false,
            },
          }
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t(`Gắn REQ · ${label}`, `Link REQs · ${label}`)}
      description={
        (cases.length > 1
          ? t(`Áp dụng cho ${cases.length} testcase đã chọn. `, `Applies to ${cases.length} selected test cases. `)
          : '') +
        t('REQ lấy từ module Tài liệu.', 'REQs come from Documents.') +
        (ai
          ? t(
              ' Có REQ do AI gắn (dấu AI) — kiểm tra, sai thì sửa rồi Lưu.',
              ' Some REQs were linked by AI — review, fix, then Save.',
            )
          : '')
      }
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void save()} isLoading={busy}>
            {t('Lưu', 'Save')}
          </Button>
        </>
      }
    >
      <PickList
        items={reqs}
        placeholder={t('Tìm mã hoặc nội dung REQ…', 'Search REQ key or title…')}
        search={(r) => `${r.reqKey} ${r.title} ${r.documentCode} ${r.documentTitle}`}
        keyOf={reqKeyOf}
        state={(r) => state.get(reqKeyOf(r)) ?? false}
        onToggle={(r, checked) => setState((m) => new Map(m).set(reqKeyOf(r), checked))}
        render={(r) => (
          <>
            <span className="mr-1.5 rounded-[5px] bg-brand-50 px-1.5 font-mono text-[11.5px] font-medium text-brand-700">
              {r.reqKey}
            </span>
            {r.title}
            <small className="block text-[12px] text-gray-500">
              {r.documentCode} · {t(`${linkedCount(r)} testcase đang gắn`, `${linkedCount(r)} linked test cases`)}
            </small>
          </>
        )}
      />
    </Modal>
  )
}

/** Đối chiếu REQ → "Sửa testcase gắn với REQ": tick để gắn, bỏ tick để gỡ. Case của module cùng tài liệu xếp trên. */
export function ReqLinkModal({
  req,
  modules,
  cases,
  onSave,
  onClose,
}: {
  req: { documentId: number; reqUid: string; reqKey: string; title: string }
  modules: TestModuleDto[]
  cases: TestCaseDto[]
  onSave: (items: { testCaseId: number; changes: UpdateTestCaseBody }[]) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const key = reqKeyOf(req)
  const list = useMemo(() => {
    const mod = (c: TestCaseDto) => modules.find((m) => m.moduleId === c.moduleId)
    return cases
      .filter((c) => c.status === 'ACTIVE')
      .sort(
        (a, b) =>
          Number(mod(b)?.documentId === req.documentId) - Number(mod(a)?.documentId === req.documentId) ||
          (mod(a)?.position ?? 0) - (mod(b)?.position ?? 0) ||
          a.position - b.position,
      )
  }, [cases, modules, req.documentId])
  const [on, setOn] = useState<Set<number>>(
    () => new Set(list.filter((c) => c.requirements.some((x) => reqKeyOf(x) === key)).map((c) => c.testCaseId)),
  )
  const [busy, setBusy] = useState(false)
  const mod = (c: TestCaseDto) => modules.find((m) => m.moduleId === c.moduleId)

  const save = async () => {
    const items = list
      .filter((c) => on.has(c.testCaseId) !== c.requirements.some((x) => reqKeyOf(x) === key))
      .map((c) => ({
        testCaseId: c.testCaseId,
        changes: {
          requirementRefs: on.has(c.testCaseId)
            ? [
                ...c.requirements.map((x) => ({ documentId: x.documentId, reqUid: x.reqUid })),
                { documentId: req.documentId, reqUid: req.reqUid },
              ]
            : c.requirements
                .filter((x) => reqKeyOf(x) !== key)
                .map((x) => ({ documentId: x.documentId, reqUid: x.reqUid })),
        },
      }))
    setBusy(true)
    try {
      await onSave(items)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t(`Testcase gắn với ${req.reqKey}`, `Test cases linked to ${req.reqKey}`)}
      description={`${req.title} · ${t('tick để gắn, bỏ tick để gỡ', 'tick to link, untick to unlink')}`}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void save()} isLoading={busy}>
            {t('Lưu', 'Save')}
          </Button>
        </>
      }
    >
      <PickList
        items={list}
        placeholder={t('Tìm mã hoặc tên testcase…', 'Search test case…')}
        search={(c) => `${mod(c)?.shortCode ?? ''} ${c.code} ${c.title}`}
        keyOf={(c) => String(c.testCaseId)}
        state={(c) => on.has(c.testCaseId)}
        onToggle={(c, checked) =>
          setOn((s) => {
            const next = new Set(s)
            if (checked) next.add(c.testCaseId)
            else next.delete(c.testCaseId)
            return next
          })
        }
        render={(c) => (
          <>
            <span className="mr-1.5 rounded-[5px] bg-gray-100 px-1.5 font-mono text-[11.5px] font-medium text-gray-600">
              {mod(c)?.shortCode}·{c.code}
            </span>
            {c.title}
            <small className="block text-[12px] text-gray-500">
              {mod(c)?.name}
              {c.requirements.length
                ? ` · ${t('đang gắn', 'linked')} ${c.requirements.map((x) => x.reqKey ?? '?').join(', ')}`
                : ''}
            </small>
          </>
        )}
      />
    </Modal>
  )
}

/** "+ Thêm mục" (theo mục tài liệu chưa dùng) hoặc "+ Thêm nhóm" (loại test) vào một mục lớn. */
export function SectionModal({
  module,
  parent,
  docSections,
  onSave,
  onClose,
}: {
  module: TestModuleDto
  parent: { sectionId: number; code: string; title: string } | null
  docSections: DocSectionDto[] | null
  onSave: (body: { title: string; anchorId: string | null }) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const used = new Set(module.sections.filter((s) => s.parentId === null).map((s) => s.anchorId))
  const free = (docSections ?? []).filter((s) => !used.has(s.anchorId))
  const [anchor, setAnchor] = useState<string>('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const touched = useRef(false)
  useEffect(() => {
    if (parent || touched.current || !free.length) return
    setAnchor(free[0].anchorId)
    setTitle(stripHeadingNumber(free[0].title))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docSections])

  const save = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      await onSave({ title: title.trim(), anchorId: parent ? null : anchor || null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        parent
          ? t(`Thêm nhóm vào ${parent.code} ${parent.title}`, `Add a group to ${parent.code} ${parent.title}`)
          : t(`Thêm mục · ${module.name}`, `Add a section · ${module.name}`)
      }
      description={
        parent
          ? t('Vd: Flow, Giao diện, Chức năng, Validate', 'e.g. Flow, UI, Function, Validate')
          : t(`Theo mục trong tài liệu ${module.documentCode}`, `A heading of ${module.documentCode}`)
      }
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void save()} disabled={!title.trim()} isLoading={busy}>
            {parent ? t('Thêm nhóm', 'Add group') : t('Thêm mục', 'Add section')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {!parent && (
          <SelectField
            id="sec-anchor"
            label={t('Mục trong tài liệu', 'Document section')}
            value={anchor}
            onChange={(e) => {
              touched.current = true
              setAnchor(e.target.value)
              const s = free.find((x) => x.anchorId === e.target.value)
              if (s) setTitle(stripHeadingNumber(s.title))
            }}
          >
            {docSections === null && <option value="">{t('Đang tải mục tài liệu…', 'Loading sections…')}</option>}
            {free.map((s) => (
              <option key={s.anchorId} value={s.anchorId}>
                {s.title}
                {s.reqUids.length ? ` · ${s.reqUids.length} REQ` : ''}
              </option>
            ))}
            <option value="">{t('— Không theo mục nào', '— No document section')}</option>
          </SelectField>
        )}
        <TextField
          id="sec-title"
          label={parent ? t('Tên nhóm', 'Group name') : t('Tên mục', 'Section name')}
          value={title}
          maxLength={200}
          list={parent ? 'sec-cats' : undefined}
          placeholder={
            parent
              ? t('Vd: Validate, Phân quyền', 'e.g. Validate, Permissions')
              : t('Tên lấy theo mục tài liệu', 'Taken from the document heading')
          }
          onChange={(e) => {
            touched.current = true
            setTitle(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
          }}
          data-autofocus={parent ? true : undefined}
        />
        {parent && (
          <datalist id="sec-cats">
            {[...DEFAULT_CATEGORIES, 'Phân quyền'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </div>
    </Modal>
  )
}

/** Ghi nhận build mới deploy lên một môi trường (case Fail có bug đã fix → Retest). */
export function DeployBuildModal({
  env,
  bugs,
  onSave,
  onClose,
}: {
  env: TestEnvironmentDto
  bugs: TestBugRefDto[]
  onSave: (body: { version: string; fixedIssueIds: number[] }) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const suggest = (env.currentBuild ?? 'v1.0.0').replace(/(\d+)(?!.*\d)/, (n) => String(Number(n) + 1))
  const [version, setVersion] = useState(suggest)
  const [fixed, setFixed] = useState<Set<number>>(
    () => new Set(bugs.filter((b) => b.statusCategory === 'DONE').map((b) => b.issueId)),
  )
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!version.trim()) return
    setBusy(true)
    try {
      await onSave({ version: version.trim(), fixedIssueIds: [...fixed] })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t(`Deploy build mới lên ${env.name}`, `New build on ${env.name}`)}
      description={t('Case Fail có bug đã fix sẽ chuyển "Retest".', 'Failed cases with fixed bugs become "Retest".')}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline onClick={() => void save()} disabled={!version.trim()} isLoading={busy}>
            {t('Ghi build', 'Record build')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField
          id="build-version"
          label={t('Phiên bản', 'Version')}
          value={version}
          maxLength={40}
          onChange={(e) => setVersion(e.target.value)}
          data-autofocus
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-900">
            {t('Bug đã fix trong build', 'Bugs fixed in this build')}
          </legend>
          {bugs.length === 0 ? (
            <p className="text-[13px] text-gray-500">{t('Đợt test chưa có bug nào.', 'No bugs in this plan.')}</p>
          ) : (
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {bugs.map((b) => (
                <li key={b.issueId}>
                  <label className="flex items-center gap-2 text-[13.5px]">
                    <input
                      type="checkbox"
                      checked={fixed.has(b.issueId)}
                      onChange={(e) =>
                        setFixed((s) => {
                          const n = new Set(s)
                          if (e.target.checked) n.add(b.issueId)
                          else n.delete(b.issueId)
                          return n
                        })
                      }
                    />
                    <span className="rounded-[5px] bg-red-50 px-1.5 font-mono text-[11.5px] font-medium text-red-700">
                      {b.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{b.title}</span>
                    <span className="text-[12px] text-gray-500">{b.statusName}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
    </Modal>
  )
}

/** Hộp xác nhận (thay window.confirm) — focus, Esc, Tab vòng như mọi Modal của app. */
export function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string
  description?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      tone={danger ? 'danger' : 'default'}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button
            inline
            isLoading={busy}
            data-autofocus
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-[14px] text-gray-700">{description}</p>}
    </Modal>
  )
}
