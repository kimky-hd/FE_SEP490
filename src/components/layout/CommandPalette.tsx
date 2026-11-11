import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { documentApi } from '@/api/documentApi'
import { issueApi } from '@/api/issueApi'
import { testApi } from '@/api/testApi'
import { useAuth } from '@/context/AuthContext'
import { readRecentItems } from '@/lib/recentItems'
import { loadProjectPages } from '@/lib/useMyWork'
import { formatRelative } from '@/lib/format'
import { SearchIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { HelpPaletteSection, useHelpAnswer } from '@/help/HelpAnswer'

// Ctrl K trong dự án: chưa gõ → "Tiếp tục" (3 trang mở gần nhất) + lệnh nhanh; gõ → tìm tài liệu (tên / mã) và REQ của dự án.

interface Row {
  key: string
  label: string
  code: string | null
  hint: string | null
  href: string
}

interface Section {
  title: string
  rows: Row[]
}

export function CommandPalette({
  open,
  onClose,
  projectId,
  canCreate,
  canCreateIssue = false,
  canCreateTest = false,
  searchIssues = false,
  searchTests = false,
}: {
  open: boolean
  onClose: () => void
  projectId: number
  canCreate: boolean
  /** Lệnh "Tạo issue" / "Tạo testcase" và tìm issue / testcase (khi bật Kanban / Test cases và có quyền). */
  canCreateIssue?: boolean
  canCreateTest?: boolean
  searchIssues?: boolean
  searchTests?: boolean
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Row[] | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    setQ('')
    setQuery('')
    setResults(null)
    setActive(0)
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), 200)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    if (!open || !query) {
      setResults(null)
      return
    }
    let alive = true
    const needle = query.toLocaleLowerCase('vi')
    Promise.all([
      documentApi.listTree(projectId, query).catch(() => []),
      loadProjectPages(projectId).catch(() => []),
      searchIssues ? issueApi.list(projectId, { search: query }).catch(() => []) : Promise.resolve([]),
      searchTests ? testApi.list(projectId, { search: query }).catch(() => []) : Promise.resolve([]),
    ]).then(([nodes, pages, issues, tests]) => {
      if (!alive) return
      const docs: Row[] = nodes
        .filter(
          (n) =>
            n.kind === 'PAGE' &&
            (n.title.toLocaleLowerCase('vi').includes(needle) || !!n.code?.toLocaleLowerCase('vi').includes(needle)),
        )
        .slice(0, 8)
        .map((n) => ({
          key: `d${n.documentId}`,
          label: n.title,
          code: n.code,
          hint: null,
          href: `/projects/${projectId}/documents/${n.documentId}`,
        }))
      const reqs: Row[] = pages
        .flatMap((p) =>
          p.reqs
            .filter(
              (r) =>
                r.reqKey.toLocaleLowerCase('vi').includes(needle) || r.title.toLocaleLowerCase('vi').includes(needle),
            )
            .map((r) => ({
              key: `r${r.requirementId}`,
              label: r.title,
              code: r.reqKey,
              hint: p.node.code ?? p.node.title,
              href: `/projects/${projectId}/documents/${p.node.documentId}#${r.anchorId}`,
            })),
        )
        .slice(0, 8)
      const issueRows: Row[] = issues.slice(0, 6).map((i) => ({
        key: `i${i.issueId}`,
        label: i.title,
        code: i.key,
        hint: 'Issue',
        href: `/projects/${projectId}/kanban?issue=${encodeURIComponent(i.key)}`,
      }))
      const testRows: Row[] = tests.slice(0, 6).map((tc) => ({
        key: `t${tc.testCaseId}`,
        label: tc.title,
        code: tc.moduleCode ? `${tc.moduleCode}·${tc.code}` : tc.code,
        hint: 'Testcase',
        href: `/projects/${projectId}/tests?tab=sheet&module=${tc.moduleId}&tc=${tc.testCaseId}`,
      }))
      setResults([...issueRows, ...docs, ...reqs, ...testRows])
      setActive(0)
    })
    return () => {
      alive = false
    }
  }, [open, query, projectId, searchIssues, searchTests])

  const sections: Section[] = useMemo(() => {
    if (query) return results && results.length > 0 ? [{ title: t('Kết quả', 'Results'), rows: results }] : []
    const recent = user
      ? readRecentItems(user.id)
          .filter((r) => r.href !== window.location.pathname)
          .slice(0, 3)
      : []
    const out: Section[] = []
    if (recent.length > 0)
      out.push({
        title: t('Tiếp tục', 'Continue'),
        rows: recent.map((r) => ({
          key: `h${r.href}`,
          label: r.title,
          code: r.code,
          hint: formatRelative(r.at),
          href: r.href,
        })),
      })
    const quick: Row[] = [
      ...(canCreate
        ? [
            {
              key: 'new-blank',
              label: `＋ ${t('Tạo tài liệu', 'New document')}`,
              code: null,
              hint: null,
              href: `/projects/${projectId}/documents?new=blank`,
            },
            {
              key: 'new-notes',
              label: `＋ ${t('Từ ghi chú họp', 'From meeting notes')}`,
              code: null,
              hint: null,
              href: `/projects/${projectId}/documents?new=notes`,
            },
          ]
        : []),
      ...(canCreateIssue
        ? [
            {
              key: 'new-issue',
              label: `＋ ${t('Tạo issue', 'Create issue')}`,
              code: null,
              hint: null,
              href: `/projects/${projectId}/kanban?new=issue`,
            },
          ]
        : []),
      ...(canCreateTest
        ? [
            {
              key: 'new-test',
              label: `＋ ${t('Tạo testcase', 'Create test case')}`,
              code: null,
              hint: null,
              href: `/projects/${projectId}/tests?tab=sheet&new=1`,
            },
          ]
        : []),
    ]
    if (quick.length) out.push({ title: t('Lệnh nhanh', 'Quick actions'), rows: quick })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results, t, user?.id, canCreate, canCreateIssue, canCreateTest, projectId, open])

  const flat = sections.flatMap((s) => s.rows)
  // Câu gõ giống câu hỏi ("làm sao gửi duyệt") → thẻ Hướng dẫn ở trên cùng (mock-role-modules.html 4c).
  const help = useHelpAnswer(query)

  if (!open) return null

  const go = (row: Row | undefined) => {
    if (!row) return
    onClose()
    navigate(row.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(flat[active])
    }
  }

  let index = -1
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-gray-950/30 px-4 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Tìm kiếm và lệnh', 'Search and commands')}
        onKeyDown={onKeyDown}
        className="h-fit w-full max-w-[clamp(20rem,50vw,42rem)] overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-gray-200 px-4">
          <SearchIcon className="h-[18px] w-[18px] shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Tìm tài liệu, REQ hoặc đặt câu hỏi…', 'Search documents, REQs or ask a question…')}
            aria-label={t('Tìm', 'Search')}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={flat[active] ? `cmdk-${flat[active].key}` : undefined}
            className="h-[52px] min-w-0 flex-1 bg-transparent text-[15px] text-gray-950 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        {help && (
          <div className="max-h-[40vh] overflow-y-auto border-b border-gray-200 py-1">
            <HelpPaletteSection
              answer={help}
              ctx={{ projectId }}
              onNavigate={(href) => {
                onClose()
                navigate(href)
              }}
              onAsk={setQ}
            />
          </div>
        )}
        <div id="cmdk-list" role="listbox" className="max-h-[50vh] overflow-y-auto py-1.5">
          {sections.length === 0 && !help && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {query
                ? results === null
                  ? t('Đang tìm…', 'Searching…')
                  : t('Không thấy kết quả.', 'No results.')
                : t('Gõ để tìm.', 'Type to search.')}
            </p>
          )}
          {sections.map((s) => (
            <div key={s.title}>
              <p className="px-4 pb-1 pt-2.5 text-xs text-gray-500">{s.title}</p>
              {s.rows.map((r) => {
                index += 1
                const i = index
                return (
                  <div
                    key={r.key}
                    id={`cmdk-${r.key}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={clsx(
                      'flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm',
                      i === active ? 'bg-gray-100 text-gray-950' : 'text-gray-700',
                    )}
                  >
                    {r.code && (
                      <span className="shrink-0 rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 text-xs font-medium text-gray-600">
                        {r.code}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    {r.hint && <span className="shrink-0 text-xs text-gray-400">{r.hint}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="hidden gap-4 border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500 sm:flex">
          <span>{t('↑↓ chọn', '↑↓ select')}</span>
          <span>{t('↵ mở', '↵ open')}</span>
          <span>{t('Esc đóng', 'Esc close')}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
