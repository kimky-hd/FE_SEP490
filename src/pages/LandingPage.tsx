import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { buttonClasses } from '@/components/ui/Button'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { useI18n } from '@/i18n'

type T = (vi: string, en: string) => string

/* ------------------------------------------------------------------------------------------------
 * Trang giới thiệu theo bản mẫu đã duyệt (doc/mockups/mockups.html): SaaS sáng, gọn, xanh thương hiệu.
 * Ảnh sản phẩm là giao diện SSAM dựng bằng JSX (nội dung minh hoạ tĩnh), không dùng ảnh chụp.
 * Id #tinh-nang được DashboardHomePage trỏ tới: giữ nguyên.
 * ---------------------------------------------------------------------------------------------- */

const WRAP = 'mx-auto w-full max-w-[1160px] px-4 sm:px-6'
const H2 = 'mt-2.5 text-[clamp(1.75rem,3.4vw,2.625rem)] font-bold leading-[1.15] tracking-[-0.02em] text-balance'

function getNavLinks(t: T) {
  return [
    { href: '#tinh-nang', label: t('Tính năng', 'Features') },
    { href: '#theo-vai-tro', label: t('Theo vai trò', 'By role') },
    { href: '#cau-hoi', label: t('Câu hỏi', 'FAQ') },
  ]
}

/* ------------------------------------------- Mảnh nhỏ dùng chung ------------------------------------------- */

type PillTone = 'ok' | 'warn' | 'mute' | 'blue'

function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        tone === 'ok' && 'border-success-200 bg-success-50 text-success-700',
        tone === 'warn' && 'border-[#fedf89] bg-[#fffaeb] text-[#b54708]',
        tone === 'mute' && 'border-gray-200 bg-white text-gray-600',
        tone === 'blue' && 'border-brand-200 bg-brand-50 text-brand-800',
      )}
    >
      {children}
    </span>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 text-xs font-medium text-gray-500">
      {children}
    </span>
  )
}

function SectionHead({ eyebrow, title, sub, id }: { eyebrow: string; title: string; sub?: string; id: string }) {
  return (
    <div className="mx-auto max-w-[680px] text-center">
      <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
      <h2 id={id} className={H2}>
        {title}
      </h2>
      {sub && <p className="mt-3.5 text-[17px] leading-relaxed text-gray-600 sm:text-lg">{sub}</p>}
    </div>
  )
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx('h-[17px] w-[17px] flex-none', className)}
    >
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  task: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12l3 3 5-6',
  project: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 9h18M9 9v11',
  doc: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7',
  updown: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  check: 'M6 12l4 4 8-8',
  x: 'M7 7l10 10M17 7L7 17',
}

/* ---------------------------------------------- Ảnh sản phẩm ---------------------------------------------- */

function AppMock() {
  const { t } = useI18n()
  const rows: { name: string; code: string; screen: string; tc: string; tone: PillTone; status: string }[] = [
    {
      name: t('Thanh toán một chạm', 'One-tap checkout'),
      code: 'REQ-012',
      screen: 'Checkout',
      tc: 'TC-031',
      tone: 'ok',
      status: t('Đã liên kết', 'Linked'),
    },
    {
      name: t('Màn xác nhận đơn', 'Order confirmation screen'),
      code: 'REQ-013',
      screen: 'Confirm v4',
      tc: 'TC-032',
      tone: 'warn',
      status: t('Thiết kế đã đổi', 'Design changed'),
    },
    {
      name: t('Lưu địa chỉ giao hàng', 'Save shipping address'),
      code: 'REQ-014',
      screen: 'Address',
      tc: 'TC-033',
      tone: 'ok',
      status: t('Đã liên kết', 'Linked'),
    },
    {
      name: t('Áp mã giảm giá', 'Apply a discount code'),
      code: 'REQ-015',
      screen: '—',
      tc: '—',
      tone: 'mute',
      status: t('Chưa có thiết kế', 'No design yet'),
    },
  ]
  const project = t('Checkout một chạm', 'One-tap checkout')

  return (
    <div className="grid min-h-[560px] bg-gray-100 p-2 text-sm md:grid-cols-[232px_1fr] md:pl-0">
      {/* Sidebar nằm trên nền xám */}
      <div className="hidden flex-col gap-px py-1.5 pl-3.5 pr-2.5 md:flex">
        <div className="mb-2 flex items-center gap-2.5 rounded-control p-2">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-[7px] bg-brand-600 text-xs font-bold text-white">
            FC
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-gray-900">Fintech Corp</span>
            <span className="block truncate text-xs text-gray-500">Mobile Banking Revamp</span>
          </span>
          <Icon d={ICONS.updown} className="ml-auto !h-4 !w-4 text-gray-500" />
        </div>
        {[
          { icon: ICONS.home, label: t('Tổng quan', 'Overview') },
          {
            icon: ICONS.task,
            label: t('Việc của tôi', 'My work'),
            extra: <span className="ml-auto text-xs text-gray-500">4</span>,
          },
          { icon: ICONS.project, label: t('Dự án', 'Projects'), on: true },
          {
            icon: ICONS.doc,
            label: t('Tài liệu', 'Documents'),
            extra: (
              <span className="ml-auto rounded border border-gray-300 px-1 text-[11px] text-gray-500">
                {t('Sắp có', 'Soon')}
              </span>
            ),
          },
        ].map((it) => (
          <div
            key={it.label}
            className={clsx(
              'flex items-center gap-2.5 rounded-control px-2.5 py-[7px]',
              it.on ? 'bg-white font-medium text-gray-900 shadow-xs ring-1 ring-gray-200' : 'text-gray-600',
            )}
          >
            <Icon d={it.icon} className={it.on ? 'text-brand-600' : undefined} />
            {it.label}
            {it.extra}
          </div>
        ))}
        <p className="mx-2.5 mb-1.5 mt-[18px] text-xs font-medium text-gray-500">
          {t('Dự án gần đây', 'Recent projects')}
        </p>
        {[
          { label: project, color: 'bg-brand-600' },
          { label: t('Ví điện tử v2', 'E-wallet v2'), color: 'bg-[#f79009]' },
          { label: 'eKYC', color: 'bg-success-500' },
        ].map((p) => (
          <div key={p.label} className="flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-gray-600">
            <span className={clsx('mx-1 h-2 w-2 rounded-[3px]', p.color)} />
            {p.label}
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2.5 p-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dbe4ff] text-[11px] font-bold text-brand-800">
            LN
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-medium text-gray-900">Lương Nguyễn</span>
            <span className="block text-xs text-gray-500">Business Analyst</span>
          </span>
        </div>
      </div>

      {/* Tấm nội dung trắng */}
      <div className="min-w-0 overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs">
        <div className="flex h-12 items-center justify-between gap-4 border-b border-gray-200 px-4 text-[13.5px] text-gray-500 sm:px-6">
          <span className="truncate">
            {t('Dự án', 'Projects')} / <span className="font-medium text-gray-900">{project}</span>
          </span>
          <span className="hidden min-w-[200px] items-center gap-2 rounded-control border border-gray-200 px-2.5 py-1 sm:flex">
            {t('Tìm kiếm…', 'Search…')}
            <span className="ml-auto rounded border border-gray-200 px-1.5 text-[11px] font-medium">Ctrl K</span>
          </span>
        </div>
        <div className="px-4 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex flex-wrap items-center gap-2.5 text-xl font-bold tracking-[-0.02em] text-gray-900 sm:text-[22px]">
                {project} <Pill tone="ok">{t('Đang chạy', 'Active')}</Pill>
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {t('Scrum · 6 thành viên · Cập nhật 2 phút trước', 'Scrum · 6 members · Updated 2 minutes ago')}
              </p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <span className="inline-flex h-9 items-center rounded-control border border-gray-300 bg-white px-3.5 font-medium text-gray-800 shadow-xs">
                {t('Mời thành viên', 'Invite members')}
              </span>
              <span className="inline-flex h-9 items-center rounded-control bg-brand-600 px-3.5 font-medium text-white shadow-xs">
                {t('Tạo yêu cầu', 'New requirement')}
              </span>
            </div>
          </div>

          <div className="mt-[18px] flex gap-6 overflow-hidden border-b border-gray-200 text-gray-500">
            {[
              t('Truy xuất', 'Traceability'),
              t('Tài liệu', 'Documents'),
              t('Quy trình', 'Workflow'),
              t('Thành viên', 'Members'),
              t('Cài đặt', 'Settings'),
            ].map((tab, i) => (
              <span
                key={tab}
                className={clsx(
                  'whitespace-nowrap py-2.5',
                  i === 0 && 'font-medium text-gray-900 shadow-[inset_0_-2px_0_#2f5bea]',
                  i >= 3 && 'hidden sm:inline',
                )}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              {
                k: t('Yêu cầu', 'Requirements'),
                v: '24',
                note: t('18 đã liên kết đủ', '18 fully linked'),
                c: 'text-success-700',
              },
              { k: 'Testcase', v: '61', note: t('3 cần cập nhật', '3 need updating'), c: 'text-[#b54708]' },
              {
                k: t('Màn hình Figma', 'Figma screens'),
                v: '12',
                note: t('Đồng bộ 2 phút trước', 'Synced 2 minutes ago'),
                c: 'text-gray-500',
              },
            ].map((s) => (
              <div key={s.k} className="min-w-0 rounded-[10px] border border-gray-200 px-3 py-3 sm:px-4 sm:py-3.5">
                <p className="truncate text-[13px] text-gray-500">{s.k}</p>
                <p className="mt-0.5 text-2xl font-semibold tracking-[-0.02em] text-gray-900">{s.v}</p>
                <p className={clsx('text-xs sm:text-[12.5px]', s.c)}>{s.note}</p>
              </div>
            ))}
          </div>

          <table className="mt-5 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 text-[12.5px] text-gray-500">
                <th className="px-2 py-2 font-medium sm:px-3">{t('Yêu cầu', 'Requirement')}</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">{t('Màn hình', 'Screen')}</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Testcase</th>
                <th className="px-2 py-2 font-medium sm:px-3">{t('Trạng thái', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-600">
              {rows.map((r) => (
                <tr key={r.code}>
                  <td className="px-2 py-3 sm:px-3">
                    <span className="mr-2 font-medium text-gray-900">{r.name}</span>
                    <Code>{r.code}</Code>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">{r.screen}</td>
                  <td className="hidden px-3 py-3 sm:table-cell">{r.tc}</td>
                  <td className="px-2 py-3 sm:px-3">
                    <Pill tone={r.tone}>{r.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------- Nav -------------------------------------------------- */

function Nav() {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/85 backdrop-blur-md">
      <div className={clsx(WRAP, 'flex h-16 items-center gap-4 md:gap-10')}>
        <Link
          to="/"
          aria-label="SSAM"
          className="rounded-control focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
        >
          <Logo />
        </Link>
        <nav
          aria-label={t('Mục trên trang', 'On this page')}
          className="hidden gap-7 text-[15px] text-gray-600 md:flex"
        >
          {getNavLinks(t).map((l) => (
            <a key={l.href} href={l.href} className="rounded transition-colors hover:text-gray-900">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageSwitch className="mr-2 hidden md:inline-flex" />
          <Link to="/login" className={clsx(buttonClasses({ variant: 'ghost', inline: true }), 'px-3')}>
            {t('Đăng nhập', 'Log in')}
          </Link>
          <Link to="/register" className={clsx(buttonClasses({ variant: 'primary', inline: true }), 'px-3 sm:px-3.5')}>
            {t('Dùng thử miễn phí', 'Try it free')}
          </Link>
        </div>
      </div>
    </header>
  )
}

/* -------------------------------------------------- Hero -------------------------------------------------- */

function Hero() {
  const { t } = useI18n()
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-[radial-gradient(60%_50%_at_50%_0%,#e8eeff_0%,rgba(255,255,255,0)_100%)] pt-16 text-center sm:pt-[88px]"
    >
      <div className={WRAP}>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white py-1 pl-1 pr-3 text-[13.5px] text-gray-600">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12.5px] font-medium text-brand-800">
            {t('Mới', 'New')}
          </span>
          {t('Theo dõi thay đổi trên Figma', 'Track changes in Figma')}
        </span>
        <h1
          id="hero-title"
          className="mx-auto mt-[22px] max-w-[820px] text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance text-gray-900"
        >
          {t('Từ ghi chú họp đến testcase, ', 'From meeting notes to test cases, ')}
          <span className="text-brand-600">{t('không đứt một mắt xích', 'without a broken link')}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-relaxed text-gray-600 sm:text-[19px]">
          {t(
            'SSAM dùng AI viết tài liệu yêu cầu từ ghi chú thô, theo dõi thiết kế trên Figma và giữ mọi testcase bám đúng yêu cầu mới nhất.',
            'SSAM uses AI to turn rough notes into requirement documents, watches your Figma designs, and keeps every test case tied to the latest requirement.',
          )}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/login" className={clsx(buttonClasses({ size: 'lg', inline: true }), 'rounded-[10px]')}>
            {t('Vào SSAM', 'Go to SSAM')}
          </Link>
          <Link
            to="/register"
            className={clsx(buttonClasses({ variant: 'secondary', size: 'lg', inline: true }), 'rounded-[10px]')}
          >
            {t('Bắt đầu miễn phí', 'Start for free')}
          </Link>
          <a
            href="#tinh-nang"
            className={clsx(buttonClasses({ variant: 'ghost', size: 'lg', inline: true }), 'rounded-[10px]')}
          >
            {t('Xem cách hoạt động', 'See how it works')}
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          {t('Miễn phí cho đội nhỏ · Không cần thẻ', 'Free for small teams · No card needed')}
        </p>

        <div className="mt-12 rounded-[18px] border border-gray-200 bg-white/60 p-1.5 text-left shadow-float sm:mt-16 sm:p-2.5">
          <div
            role="img"
            aria-label={t(
              'Giao diện SSAM: bảng truy xuất của dự án nối yêu cầu với màn hình Figma và testcase, kèm trạng thái liên kết.',
              'SSAM interface: a project traceability table linking requirements to Figma screens and test cases, with link status.',
            )}
            className="overflow-hidden rounded-card border border-gray-200"
          >
            <AppMock />
          </div>
        </div>
        <div className="h-16 sm:h-24" />
      </div>
    </section>
  )
}

/* ------------------------------------------------- Vấn đề ------------------------------------------------- */

function Problem() {
  const { t } = useI18n()
  const before = [
    {
      title: t('Ghi chú nằm trong chat', 'Notes live in chat'),
      body: t(
        'BA chép tay sang tài liệu, làm lại mỗi lần yêu cầu đổi.',
        'The BA copies them into a document by hand, again every time a requirement changes.',
      ),
    },
    {
      title: t('Thiết kế đổi lặng lẽ trên Figma', 'Designs change quietly in Figma'),
      body: t(
        'Tài liệu không hay biết, QA phát hiện khi sát deadline.',
        'The spec never hears about it, and QA finds out right before the deadline.',
      ),
    },
    {
      title: t('Testcase ở file Excel riêng', 'Test cases sit in a separate spreadsheet'),
      body: t(
        'Chạy theo bản cũ, pass hết mà vẫn sai yêu cầu.',
        'They follow the old version: everything passes and still misses the requirement.',
      ),
    },
  ]
  const after = [
    {
      title: t('AI viết bản nháp yêu cầu', 'AI drafts the requirements'),
      body: t(
        'Dán ghi chú họp, nhận yêu cầu có mã và tiêu chí chấp nhận.',
        'Paste your meeting notes, get requirements with IDs and acceptance criteria.',
      ),
    },
    {
      title: t('Thiết kế đổi là được báo', 'Design changes get flagged'),
      body: t(
        'Biết ngay yêu cầu nào bị ảnh hưởng bởi màn hình mới.',
        'See right away which requirements a new screen affects.',
      ),
    },
    {
      title: t('Testcase nối với yêu cầu gốc', 'Test cases stay linked to the source'),
      body: t(
        'Yêu cầu đổi, testcase liên quan được đánh dấu cần cập nhật.',
        'When a requirement changes, its test cases are marked for update.',
      ),
    },
  ]

  return (
    <section aria-labelledby="van-de-title" className="border-y border-gray-200 bg-gray-50 py-20 lg:py-28">
      <div className={WRAP}>
        <SectionHead
          id="van-de-title"
          eyebrow={t('Vấn đề', 'The problem')}
          title={t(
            'Yêu cầu, thiết kế và kiểm thử đang nằm ở ba nơi',
            'Requirements, designs and tests live in three different places',
          )}
          sub={t(
            'Yêu cầu đổi một chữ, và không ai biết testcase nào phải sửa theo.',
            'Change one word in a requirement, and nobody knows which test cases need to follow.',
          )}
        />
        <div className="mt-12 grid gap-6 md:mt-14 md:grid-cols-2">
          {[
            { key: 'before', heading: t('Cách làm hiện tại', 'The usual way'), items: before },
            { key: 'after', heading: t('Với SSAM', 'With SSAM'), items: after },
          ].map((col) => {
            const isAfter = col.key === 'after'
            return (
              <div
                key={col.key}
                className={clsx(
                  'rounded-2xl border bg-white p-5 sm:p-7',
                  isAfter ? 'border-brand-200 shadow-[0_0_0_4px_#eef2ff]' : 'border-gray-200',
                )}
              >
                <h3 className="flex items-center gap-2.5 text-lg font-bold tracking-[-0.02em] text-gray-900">
                  <span className={clsx('h-2.5 w-2.5 rounded-full', isAfter ? 'bg-brand-600' : 'bg-[#b42318]')} />
                  {col.heading}
                </h3>
                <ul className="mt-5 grid gap-3">
                  {col.items.map((it) => (
                    <li
                      key={it.title}
                      className={clsx(
                        'flex items-start gap-3.5 rounded-[10px] border border-gray-200 px-4 py-3.5',
                        isAfter ? 'bg-white' : 'bg-gray-50',
                      )}
                    >
                      <span
                        className={clsx(
                          'grid h-7 w-7 flex-none place-items-center rounded-control',
                          isAfter ? 'bg-brand-50 text-brand-600' : 'bg-[#fef3f2] text-[#b42318]',
                        )}
                      >
                        <Icon d={isAfter ? ICONS.check : ICONS.x} className="!h-4 !w-4 [stroke-width:2.6]" />
                      </span>
                      <span>
                        <span className="block text-[15px] font-medium text-gray-900">{it.title}</span>
                        <span className="text-[14.5px] text-gray-600">{it.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------ Tính năng ------------------------------------------------ */

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-card border border-gray-200 bg-white px-4 py-4 text-[14.5px] text-gray-900 shadow-xs sm:px-[18px]',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Lbl({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] font-medium text-gray-500">{children}</p>
}

function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  reverse,
  panel,
  panelLabel,
}: {
  eyebrow: string
  title: string
  body: string
  points: string[]
  reverse?: boolean
  panel: ReactNode
  panelLabel: string
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={clsx(reverse && 'lg:order-2')}>
        <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
        <h3 className="mt-2.5 text-2xl font-bold leading-tight tracking-[-0.02em] text-gray-900 sm:text-[28px]">
          {title}
        </h3>
        <p className="mt-3.5 text-base leading-relaxed text-gray-600 sm:text-[17px]">{body}</p>
        <ul className="mt-[22px] grid gap-2.5">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[15.5px] text-gray-600">
              <span className="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-brand-50 text-brand-600">
                <Icon d={ICONS.check} className="!h-3 !w-3 [stroke-width:3]" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div role="img" aria-label={panelLabel} className="rounded-2xl border border-gray-200 bg-gray-100 p-4 sm:p-8">
        {panel}
      </div>
    </div>
  )
}

function Features() {
  const { t } = useI18n()
  return (
    <section id="tinh-nang" aria-labelledby="tinh-nang-title" className="scroll-mt-16 py-20 lg:py-28">
      <div className={WRAP}>
        <SectionHead
          id="tinh-nang-title"
          eyebrow={t('Tính năng', 'Features')}
          title={t('Những việc lặp lại, SSAM làm thay bạn', 'SSAM handles the repetitive work for you')}
        />
        <div className="mt-14 grid gap-20 lg:mt-16 lg:gap-[88px]">
          <FeatureRow
            eyebrow={t('Viết yêu cầu', 'Writing requirements')}
            title={t('Từ ghi chú thô thành tài liệu yêu cầu', 'From rough notes to a requirements document')}
            body={t(
              'Dán nguyên ghi chú cuộc họp. AI tách thành từng yêu cầu, BA chỉ cần rà lại và sửa.',
              'Paste your meeting notes as they are. AI splits them into individual requirements; the BA just reviews and edits.',
            )}
            points={[
              t(
                'Mỗi yêu cầu có mã, mô tả và tiêu chí chấp nhận',
                'Every requirement gets an ID, a description and acceptance criteria',
              ),
              t('Lưu phiên bản, xem lại ai sửa gì', 'Version history shows who changed what'),
            ]}
            panelLabel={t(
              'Ví dụ: ghi chú họp được AI chuyển thành yêu cầu REQ-013',
              'Example: meeting notes turned into requirement REQ-013 by AI',
            )}
            panel={
              <>
                <Card>
                  <Lbl>{t('Ghi chú họp 14/10', 'Meeting notes, Oct 14')}</Lbl>
                  <p className="mt-1.5 text-gray-600">
                    {t('khách muốn thanh toán 1 chạm, ', 'client wants one-tap checkout, ')}
                    <mark className="rounded-[3px] bg-[#fff3c4] px-0.5 text-inherit">
                      {t('màn xác nhận phải hiện phí ship', 'confirm screen must show shipping fee')}
                    </mark>
                    {t(', nhớ lưu địa chỉ…', ', remember to save the address…')}
                  </p>
                </Card>
                <p className="my-3 text-center text-[13px] font-semibold text-brand-600">
                  ↓ {t('AI tạo 3 yêu cầu', 'AI creates 3 requirements')}
                </p>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <Lbl>REQ-013</Lbl>
                    <p className="font-medium">
                      {t('Màn xác nhận hiển thị phí giao hàng', 'Confirmation screen shows the shipping fee')}
                    </p>
                  </div>
                  <Pill tone="blue">{t('Bản nháp', 'Draft')}</Pill>
                </Card>
              </>
            }
          />
          <FeatureRow
            reverse
            eyebrow={t('Theo dõi thiết kế', 'Design tracking')}
            title={t('Figma đổi, bạn biết ngay', 'Figma changes, you know right away')}
            body={t(
              'SSAM so sánh từng phiên bản màn hình và chỉ ra yêu cầu, testcase nào bị ảnh hưởng.',
              'SSAM compares each version of a screen and points out which requirements and test cases are affected.',
            )}
            points={[
              t('So sánh phiên bản thiết kế', 'Compare design versions'),
              t('Báo đúng người phụ trách', 'Notify the right owner'),
            ]}
            panelLabel={t(
              'Ví dụ: màn Confirm đổi từ v3 sang v4, ảnh hưởng REQ-013 và TC-032',
              'Example: the Confirm screen changes from v3 to v4, affecting REQ-013 and TC-032',
            )}
            panel={
              <>
                <Card>
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">Confirm · v3 → v4</span>
                    <Lbl>{t('2 phút trước', '2 minutes ago')}</Lbl>
                  </div>
                  <div className="mt-2.5 grid gap-1.5 text-sm">
                    <p className="rounded-md bg-success-50 px-2 py-1 text-success-700">
                      + {t('Thêm dòng phí giao hàng', 'Added a shipping fee line')}
                    </p>
                    <p className="rounded-md bg-[#fef3f2] px-2 py-1 text-[#b42318]">
                      − {t('Bỏ ô nhập mã giảm giá', 'Removed the discount code field')}
                    </p>
                  </div>
                </Card>
                <Card className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {t('Ảnh hưởng', 'Affects')}: <span className="font-medium">REQ-013, TC-032</span>
                  </span>
                  <Pill tone="warn">{t('Cần xem lại', 'Needs review')}</Pill>
                </Card>
              </>
            }
          />
          <FeatureRow
            eyebrow={t('Quy trình & phân quyền', 'Workflow & permissions')}
            title={t('Làm theo cách đội bạn đã quen', 'Work the way your team already does')}
            body={t(
              'Chọn Scrum, Kanban hoặc tự đặt giai đoạn. Vai trò riêng ở cấp công ty, workspace và dự án.',
              'Pick Scrum, Kanban or define your own stages. Separate roles at the company, workspace and project level.',
            )}
            points={[
              t('Luồng chuyển trạng thái tuỳ chỉnh', 'Custom status transitions'),
              t('Quyền chi tiết theo từng cấp', 'Fine-grained permissions at every level'),
            ]}
            panelLabel={t(
              'Ví dụ: quy trình dự án bốn giai đoạn và hai vai trò',
              'Example: a four-stage project workflow and two roles',
            )}
            panel={
              <>
                <Card>
                  <Lbl>{t('Quy trình dự án', 'Project workflow')}</Lbl>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Pill tone="mute">Backlog</Pill>
                    <Pill tone="mute">{t('Đang làm', 'In progress')}</Pill>
                    <Pill tone="blue">Review</Pill>
                    <Pill tone="ok">{t('Hoàn thành', 'Done')}</Pill>
                  </div>
                </Card>
                <Card className="mt-3">
                  <Lbl>{t('Vai trò', 'Roles')}</Lbl>
                  <div className="mt-2.5 grid gap-2">
                    <div className="flex justify-between gap-3">
                      <span>Business Analyst</span>
                      <span className="text-right text-gray-500">
                        {t('Viết, duyệt yêu cầu', 'Writes, approves requirements')}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>QA</span>
                      <span className="text-right text-gray-500">{t('Quản lý testcase', 'Manages test cases')}</span>
                    </div>
                  </div>
                </Card>
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------ Vai trò ------------------------------------------------ */

function Roles() {
  const { t } = useI18n()
  const roles = [
    {
      av: 'BA',
      tone: 'bg-brand-50 text-brand-800',
      title: 'Business Analyst',
      body: t(
        'Không gõ lại ghi chú. Gửi duyệt theo quy trình, có phiên bản rõ ràng.',
        'No more retyping notes. Send for approval through your workflow, with clear versions.',
      ),
    },
    {
      av: 'DE',
      tone: 'bg-[#fef0c7] text-[#93370d]',
      title: 'Designer',
      body: t(
        'Cứ làm trong Figma. SSAM tự thấy thay đổi và báo đúng người.',
        'Keep working in Figma. SSAM spots the changes and tells the right people.',
      ),
    },
    {
      av: 'QA',
      tone: 'bg-success-100 text-success-800',
      title: 'QA',
      body: t(
        'Testcase bám yêu cầu mới nhất. Biết test gì và vì sao.',
        'Test cases follow the latest requirement. Know what to test and why.',
      ),
    },
    {
      av: 'DEV',
      tone: 'bg-[#f4ebff] text-[#6941c6]',
      title: 'Dev / Tech Lead',
      body: t(
        'Cập nhật tiến độ ngay trên yêu cầu, không cần họp sync.',
        'Update progress right on the requirement, no sync meeting needed.',
      ),
    },
  ]
  return (
    <section
      id="theo-vai-tro"
      aria-labelledby="theo-vai-tro-title"
      className="scroll-mt-16 border-y border-gray-200 bg-gray-50 py-20 lg:py-28"
    >
      <div className={WRAP}>
        <SectionHead
          id="theo-vai-tro-title"
          eyebrow={t('Theo vai trò', 'By role')}
          title={t('Mỗi người bớt một việc lặp', 'One less repetitive task for everyone')}
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
          {roles.map((r) => (
            <li key={r.av} className="rounded-[14px] border border-gray-200 bg-white p-6 shadow-xs">
              <span
                aria-hidden="true"
                className={clsx('grid h-10 w-10 place-items-center rounded-[10px] text-sm font-bold', r.tone)}
              >
                {r.av}
              </span>
              <h3 className="mt-4 text-[17px] font-bold tracking-[-0.02em] text-gray-900">{r.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-gray-600">{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------- Câu hỏi ------------------------------------------------- */

function Faq() {
  const { t } = useI18n()
  const items = [
    {
      q: t('SSAM có miễn phí không?', 'Is SSAM free?'),
      a: t(
        'Có, trong giai đoạn đồ án SSAM miễn phí cho đội nhỏ.',
        'Yes. While SSAM is a graduation project, it is free for small teams.',
      ),
    },
    {
      q: t('Dữ liệu công ty có bị lẫn với công ty khác không?', 'Can our company data mix with another company’s?'),
      a: t(
        'Không. Mỗi công ty là một không gian riêng, dữ liệu được cô lập.',
        'No. Each company gets its own space, and its data is isolated.',
      ),
    },
    {
      q: t('Không dùng Figma thì có dùng được không?', 'Can we use it without Figma?'),
      a: t(
        'Được. Viết yêu cầu và testcase vẫn hoạt động; theo dõi thiết kế là phần thêm.',
        'Yes. Requirements and test cases work on their own; design tracking is an add-on.',
      ),
    },
    {
      q: t('Đội tôi làm Kanban, không làm Scrum?', 'Our team uses Kanban, not Scrum?'),
      a: t(
        'Chọn mẫu Kanban hoặc tự định nghĩa giai đoạn khi tạo dự án.',
        'Pick the Kanban template or define your own stages when you create a project.',
      ),
    },
  ]
  return (
    <section id="cau-hoi" aria-labelledby="cau-hoi-title" className="scroll-mt-16 py-20 lg:py-28">
      <div className={WRAP}>
        <SectionHead
          id="cau-hoi-title"
          eyebrow={t('Câu hỏi', 'FAQ')}
          title={t('Câu hỏi thường gặp', 'Frequently asked questions')}
        />
        <div className="mx-auto mt-12 max-w-[760px]">
          {items.map((it, i) => (
            <details key={it.q} open={i === 0} className="group border-b border-gray-200 px-1 py-5">
              <summary className="flex cursor-pointer list-none justify-between gap-4 rounded text-[17px] font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 [&::-webkit-details-marker]:hidden">
                {it.q}
                <span aria-hidden="true" className="text-[22px] leading-none text-gray-500">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">–</span>
                </span>
              </summary>
              <p className="mt-2.5 text-[15.5px] leading-relaxed text-gray-600">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------- CTA -------------------------------------------------- */

function Cta() {
  const { t } = useI18n()
  return (
    <section aria-labelledby="cta-title" className="pb-20 lg:pb-28">
      <div className={WRAP}>
        <div className="relative overflow-hidden rounded-[20px] bg-brand-600 px-6 py-14 text-center text-white sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(255,255,255,.18),transparent)]"
          />
          <h2
            id="cta-title"
            className="relative text-[clamp(1.75rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.02em] text-balance"
          >
            {t('Mở workspace cho đội bạn', 'Open a workspace for your team')}
          </h2>
          <p className="relative mt-2.5 text-[17px] text-white/85 sm:text-lg">
            {t(
              'Hai phút để bắt đầu. Không cần thẻ, không cần cài đặt.',
              'Two minutes to get started. No card, nothing to install.',
            )}
          </p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className={clsx(buttonClasses({ variant: 'inverted', size: 'lg', inline: true }), 'rounded-[10px]')}
            >
              {t('Bắt đầu miễn phí', 'Start for free')}
            </Link>
            <Link
              to="/login"
              className={clsx(
                buttonClasses({ variant: 'invertedOutline', size: 'lg', inline: true }),
                'rounded-[10px]',
              )}
            >
              {t('Đăng nhập', 'Log in')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------- Footer ------------------------------------------------- */

function Footer() {
  const { t, lang, setLang } = useI18n()
  const link = 'rounded transition-colors hover:text-gray-900'
  return (
    <footer className="border-t border-gray-200 pb-8 pt-12 text-sm text-gray-500">
      <div className={WRAP}>
        <div className="grid gap-8 sm:grid-cols-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="sm:col-span-3 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-[300px]">
              {t(
                'Nền tảng đặc tả phần mềm cho đội nhỏ. Đồ án SEP490-G65, Đại học FPT.',
                'A software specification platform for small teams. Graduation project SEP490-G65, FPT University.',
              )}
            </p>
          </div>
          <nav aria-label={t('Sản phẩm', 'Product')}>
            <h2 className="mb-1 text-sm font-semibold text-gray-900">{t('Sản phẩm', 'Product')}</h2>
            <ul>
              {getNavLinks(t).map((l) => (
                <li key={l.href} className="mt-2.5">
                  <a href={l.href} className={link}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={t('Tài khoản', 'Account')}>
            <h2 className="mb-1 text-sm font-semibold text-gray-900">{t('Tài khoản', 'Account')}</h2>
            <ul>
              <li className="mt-2.5">
                <Link to="/login" className={link}>
                  {t('Đăng nhập', 'Log in')}
                </Link>
              </li>
              <li className="mt-2.5">
                <Link to="/register" className={link}>
                  {t('Tạo tài khoản', 'Create account')}
                </Link>
              </li>
              <li className="mt-2.5">
                <Link to="/forgot-password" className={link}>
                  {t('Quên mật khẩu', 'Forgot password')}
                </Link>
              </li>
            </ul>
          </nav>
          <div role="group" aria-label="Ngôn ngữ / Language">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">{t('Ngôn ngữ', 'Language')}</h2>
            <ul>
              {(
                [
                  ['vi', 'Tiếng Việt'],
                  ['en', 'English'],
                ] as const
              ).map(([code, name]) => (
                <li key={code} className="mt-2.5">
                  <button
                    type="button"
                    lang={code}
                    aria-pressed={lang === code}
                    onClick={() => setLang(code)}
                    className={clsx(link, lang === code && 'font-medium text-gray-900')}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-5">
          <span>© 2026 SSAM</span>
          <span>{t('Ảnh minh hoạ là giao diện SSAM', 'Illustrations show the SSAM interface')}</span>
        </div>
      </div>
    </footer>
  )
}

/* -------------------------------------------------- Trang -------------------------------------------------- */

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-white text-gray-900">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Features />
        <Roles />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
