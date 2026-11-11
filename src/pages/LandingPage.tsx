import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { buttonClasses } from '@/components/ui/Button'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { Badge } from '@/components/ui/Badge'
import { AiSparkleIcon, ArrowRightIcon, ChevronDownIcon, FrameIcon, LinkIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'

/* ------------------------------------------------------------------------------------------------
 * Trang giới thiệu theo bản mẫu đã duyệt (doc/mockups/landing-redesign.html): cùng chất màn đăng nhập,
 * hero trên lưới chấm, chuỗi truy vết REQ-12 → CORE-104 → TC-31 làm hình chính.
 * Chỉ hứa điều app làm được: không "miễn phí", không số liệu / logo / lời khen bịa.
 * ---------------------------------------------------------------------------------------------- */

const PAD = 'mx-auto w-full px-[18px] md:px-8'
const WRAP = `${PAD} max-w-[1160px]`
const SECTION = 'scroll-mt-16 border-t border-gray-100 py-14 md:py-[88px]'
// Lưới chấm: hero (chấm xám) và dải CTA (chấm xanh nhạt).
const DOTS_GRAY =
  'bg-[radial-gradient(#e4e7ec_1px,transparent_1px)] bg-[length:20px_20px] md:bg-[radial-gradient(#e4e7ec_1.2px,transparent_1.2px)] md:bg-[length:22px_22px]'
const DOTS_BRAND = 'bg-[radial-gradient(rgba(47,91,234,.14)_1.2px,transparent_1.2px)] bg-[length:22px_22px]'
const FOCUS = 'rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100'

/* ------------------------------------------- Mảnh nhỏ dùng chung ------------------------------------------- */

type Tone = 'brand' | 'amber' | 'ok' | 'red' | 'violet'

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-800',
  ok: 'bg-success-50 text-success-700',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
}

// Mã REQ / issue / testcase, chữ đơn cách.
function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={clsx('whitespace-nowrap rounded-[5px] px-1.5 py-0.5 font-mono text-xs font-medium', TONES[tone])}>
      {children}
    </span>
  )
}

function Arrow({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="text-gray-400">
      {children}
    </span>
  )
}

function SectionHead({ id, title, sub }: { id: string; title: string; sub?: string }) {
  return (
    <div className="mb-10 max-w-[640px]">
      <h2 id={id} className="text-[clamp(1.625rem,3vw,2.25rem)] font-bold leading-[1.15] tracking-tight text-gray-950">
        {title}
      </h2>
      {sub && <p className="mt-3 text-base leading-relaxed text-gray-600">{sub}</p>}
    </div>
  )
}

/* -------------------------------------------------- Nav -------------------------------------------------- */

function Nav() {
  const { t } = useI18n()
  const links = [
    { href: '#tinh-nang', label: t('Tính năng', 'Features') },
    { href: '#cach-hoat-dong', label: t('Cách hoạt động', 'How it works') },
    { href: '#vai-tro', label: t('Vai trò', 'Roles') },
    { href: '#hoi-dap', label: t('Hỏi đáp', 'FAQ') },
  ]
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className={clsx(WRAP, 'flex h-16 items-center gap-7')}>
        <Link to="/" aria-label="SSAM" className={clsx(FOCUS, 'rounded-control')}>
          <Logo />
        </Link>
        <nav aria-label={t('Mục trên trang', 'On this page')} className="hidden gap-6 text-sm text-gray-600 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={clsx(FOCUS, 'transition-colors hover:text-gray-950')}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <Link to="/login" className={clsx(FOCUS, 'hidden px-2 text-sm text-gray-700 hover:text-gray-950 md:inline')}>
            {t('Đăng nhập', 'Log in')}
          </Link>
          <Link to="/register" className={buttonClasses({ inline: true })}>
            {t('Bắt đầu', 'Get started')}
          </Link>
        </div>
      </div>
    </header>
  )
}

/* -------------------------------------------------- Hero -------------------------------------------------- */

// Con trỏ của đội trôi nhẹ trên lưới chấm (trang trí). Tắt chuyển động khi người dùng giảm chuyển động.
const CURSOR_CSS = `
@keyframes landing-drift{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}
.landing-cur{animation:landing-drift var(--t) ease-in-out infinite alternate}
@media (prefers-reduced-motion:reduce){.landing-cur{animation:none}}
`

const CURSOR_PATH = 'M2 2 L2 16.5 L6.3 12.6 L9.2 18.6 L11.7 17.4 L8.9 11.6 L14.6 11.4 Z'

function Cursor({ name, color, style }: { name: string; color: string; style: CSSProperties }) {
  return (
    <div aria-hidden="true" className="landing-cur absolute z-[3] hidden h-0 w-0 md:block" style={style}>
      <svg
        viewBox="0 0 20 20"
        className="absolute -left-0.5 -top-0.5 h-5 w-5 overflow-visible drop-shadow-[0_2px_3px_rgba(16,24,40,.25)]"
      >
        <path d={CURSOR_PATH} fill={color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute left-3.5 top-4 whitespace-nowrap rounded-full px-[9px] py-[5px] text-xs font-medium leading-none text-white"
        style={{ background: color }}
      >
        {name}
      </span>
    </div>
  )
}

function ChainCard({
  tag,
  tagTone,
  meta,
  title,
  status,
  changed,
}: {
  tag: string
  tagTone: Tone
  meta: string
  title: string
  status: string
  changed?: boolean
}) {
  return (
    <div
      className={clsx(
        'flex w-full flex-col gap-2 rounded-card border bg-white px-4 py-3.5 text-left md:w-[260px]',
        changed ? 'border-amber-200 shadow-pop ring-4 ring-amber-50' : 'border-gray-200 shadow-pop',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Tag tone={tagTone}>{tag}</Tag>
        {meta}
      </div>
      <p className="text-base font-medium text-gray-900">{title}</p>
      <span className="self-start">
        <Badge tone="amber">{status}</Badge>
      </span>
    </div>
  )
}

// Đoạn nối giữa hai thẻ: dọc trên điện thoại, ngang từ md.
function ChainLink() {
  return (
    <span aria-hidden="true" className="relative h-6 w-0.5 flex-none bg-amber-200 md:h-0.5 md:w-14">
      <span className="absolute -bottom-px left-1/2 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-amber-200 md:hidden" />
      <span className="absolute -right-px -top-1 hidden border-y-[5px] border-l-[5px] border-y-transparent border-l-amber-200 md:block" />
    </span>
  )
}

function Hero() {
  const { t } = useI18n()
  return (
    <section
      aria-labelledby="hero-title"
      className={clsx('relative overflow-hidden bg-white pb-14 pt-11 md:pb-[88px] md:pt-[72px]', DOTS_GRAY)}
    >
      <style>{CURSOR_CSS}</style>
      <div className={clsx(PAD, 'relative z-[2] max-w-[820px] text-center')}>
        <h1
          id="hero-title"
          className="text-[clamp(2.125rem,4.6vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-gray-950"
        >
          {t('Quản lý đặc tả & truy xuất nguồn gốc tài liệu, ', 'Specification management & document traceability, ')}
          <span className="text-brand-600">{t('hỗ trợ bởi AI', 'powered by AI')}</span>
        </h1>
        <p className="mx-auto mt-[18px] max-w-[620px] text-base leading-relaxed text-gray-600 md:text-lg">
          {t(
            'Từ ghi chú họp đến URD, khung Figma và bộ testcase — một luồng, không đứt truy vết. Sửa một yêu cầu, cả đội biết ngay việc nào bị ảnh hưởng.',
            'From meeting notes to the URD, Figma frames and test suites — one flow, no broken traces. Change a requirement and the whole team sees which work is affected.',
          )}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link to="/register" className={buttonClasses({ size: 'lg', inline: true })}>
            {t('Tạo tài khoản', 'Create an account')} <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
          </Link>
          <a href="#cach-hoat-dong" className={buttonClasses({ variant: 'secondary', size: 'lg', inline: true })}>
            {t('Xem cách hoạt động', 'See how it works')}
          </a>
        </div>
        <p className="mt-3 text-[13px] text-gray-500">
          {t('Dùng email công ty để đồng nghiệp tìm thấy bạn.', 'Use your work email so colleagues can find you.')}
        </p>
      </div>

      <div
        role="group"
        aria-label={t('Ví dụ truy vết', 'Traceability example')}
        className={clsx(
          PAD,
          'relative z-[2] mt-9 flex max-w-[980px] flex-col items-center justify-center md:mt-14 md:flex-row',
        )}
      >
        <ChainCard
          changed
          tag="REQ-12"
          tagTone="amber"
          meta={t('URD · bản 1.2', 'URD · v1.2')}
          title={t('Đăng nhập bằng Google', 'Sign in with Google')}
          status={t('Vừa đổi', 'Just changed')}
        />
        <ChainLink />
        <ChainCard
          tag="CORE-104"
          tagTone="brand"
          meta={t('Kanban · Đang làm', 'Kanban · In progress')}
          title={t('Làm nút đăng nhập Google', 'Build the Google sign-in button')}
          status={t('REQ đổi · cần xem', 'REQ changed · review')}
        />
        <ChainLink />
        <ChainCard
          tag="TC-31"
          tagTone="ok"
          meta="Test case"
          title={t('Đăng nhập Google thành công', 'Google sign-in succeeds')}
          status={t('Cần xem lại', 'Needs review')}
        />
      </div>

      <Cursor
        name="Hà · BA"
        color="#7a5af8"
        style={{ left: '9%', top: '58%', '--t': '8s', '--dx': '12px', '--dy': '-8px' } as CSSProperties}
      />
      <Cursor
        name="Minh · Dev"
        color="#2f5bea"
        style={{ left: '50%', top: '94%', '--t': '7s', '--dx': '-10px', '--dy': '-6px' } as CSSProperties}
      />
      <Cursor
        name="Lan · QA"
        color="#079455"
        style={{ right: '12%', top: '62%', '--t': '10s', '--dx': '-12px', '--dy': '8px' } as CSSProperties}
      />
    </section>
  )
}

/* ------------------------------------------------ Tính năng ------------------------------------------------ */

// Thẻ chiếm 4 hàng của lưới cha (subgrid): icon / tiêu đề / mô tả / ô ví dụ thẳng hàng giữa 3 thẻ,
// 3 ô ví dụ cao bằng nhau. Trên điện thoại lưới 1 cột nên thẻ xếp chồng.
const SUBGRID_CARD =
  'row-span-4 grid grid-rows-subgrid content-start border border-gray-200 bg-white rounded-card shadow-xs'
const EXAMPLE_BOX = 'flex flex-col justify-center gap-1.5 rounded-control border border-gray-200 bg-gray-50'

function Pillar({ icon, title, body, demo }: { icon: ReactNode; title: string; body: string; demo: ReactNode }) {
  return (
    <article className={clsx(SUBGRID_CARD, 'gap-y-3 p-6')}>
      {icon}
      <h3 className="text-lg font-bold text-gray-950">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{body}</p>
      <div className={clsx(EXAMPLE_BOX, 'p-3 text-[13px] text-gray-700')}>{demo}</div>
    </article>
  )
}

function PillarIcon({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={clsx('flex h-10 w-10 items-center justify-center rounded-control', TONES[tone])}
    >
      {children}
    </span>
  )
}

const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={clsx('flex items-center gap-2', className)}>{children}</div>
)

function Features() {
  const { t } = useI18n()
  return (
    <section id="tinh-nang" aria-labelledby="tinh-nang-title" className={SECTION}>
      <div className={WRAP}>
        <SectionHead
          id="tinh-nang-title"
          title={t(
            'Ba thứ đội phần mềm hay làm rơi, SSAM giữ lại.',
            'Three things software teams tend to drop. SSAM keeps them.',
          )}
        />
        <div className="grid gap-5 md:grid-cols-3">
          <Pillar
            icon={
              <PillarIcon tone="brand">
                <AiSparkleIcon className="h-[18px] w-[18px]" />
              </PillarIcon>
            }
            title={t('AI tạo tài liệu từ ghi chú họp', 'AI drafts documents from meeting notes')}
            body={t(
              'Dán ghi chú thô, AI tách thành các yêu cầu có cấu trúc. Bạn xem lại rồi mới tạo trang.',
              'Paste rough notes and AI splits them into structured requirements. You review before any page is created.',
            )}
            demo={
              <>
                <Row className="text-gray-500">
                  {t('“khách muốn quét QR, trên 5tr phải OTP…”', '“client wants QR scan, OTP above 5M…”')}
                </Row>
                <Row>
                  <Arrow>↓</Arrow>
                </Row>
                <Row>
                  <Tag tone="brand">REQ-1</Tag>
                  {t('Quét QR khởi tạo', 'Scan QR to start')}
                </Row>
                <Row>
                  <Tag tone="brand">REQ-2</Tag>
                  {t('Xác thực OTP > 5.000.000đ', 'OTP check above 5,000,000 VND')}
                </Row>
              </>
            }
          />
          <Pillar
            icon={
              <PillarIcon tone="violet">
                <FrameIcon className="h-[18px] w-[18px]" />
              </PillarIcon>
            }
            title={t('Thiết kế nằm ngay trong tài liệu', 'Designs live right in the document')}
            body={t(
              'Gắn khung Figma và sơ đồ cạnh đúng yêu cầu. Dev đọc REQ là thấy luôn màn hình cần làm.',
              'Attach Figma frames and diagrams next to the right requirement. Devs reading a REQ see the screen to build.',
            )}
            demo={
              <>
                <Row>
                  <Tag tone="brand">REQ-14.1</Tag>
                  {t('Quét QR khởi tạo', 'Scan QR to start')}
                </Row>
                <div className="flex h-16 items-center justify-center rounded-control bg-[repeating-linear-gradient(45deg,#fff,#fff_8px,#f2f4f7_8px,#f2f4f7_16px)] text-gray-400">
                  {t('Khung Figma · Payment / Confirm', 'Figma frame · Payment / Confirm')}
                </div>
              </>
            }
          />
          <Pillar
            icon={
              <PillarIcon tone="ok">
                <LinkIcon className="h-[18px] w-[18px]" />
              </PillarIcon>
            }
            title={t('Truy vết REQ ↔ issue ↔ testcase', 'Trace REQ ↔ issue ↔ test case')}
            body={t(
              'Mỗi issue và testcase gắn với REQ. Biết ngay REQ nào chưa có testcase, testcase nào lỗi thời.',
              'Every issue and test case links to a REQ. See at once which REQs lack test cases and which tests are outdated.',
            )}
            demo={
              <>
                <Row className="flex-wrap">
                  <Tag tone="brand">REQ-14.3</Tag>
                  <Arrow>→</Arrow>CORE-104<Arrow>→</Arrow>TC-41, TC-42
                </Row>
                <Row>
                  <Tag tone="red">REQ-14.4</Tag>
                  {t('Chưa có testcase', 'No test case yet')}
                </Row>
              </>
            }
          />
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------- Cách hoạt động --------------------------------------------- */

// Vai trò cạnh tiêu đề bước: dùng Badge chung của app.
function Who({ tone, children }: { tone: 'neutral' | 'blue' | 'success'; children: ReactNode }) {
  return (
    <span className="ml-2 inline-flex align-middle">
      <Badge tone={tone}>{children}</Badge>
    </span>
  )
}

function Step({ n, title, body, example }: { n: number; title: ReactNode; body: string; example: ReactNode }) {
  return (
    <li className={clsx(SUBGRID_CARD, 'gap-y-0 p-[22px]')}>
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-[13px] font-semibold text-brand-700"
      >
        {n}
      </span>
      <h3 className="mb-1.5 mt-3.5 text-base font-bold text-gray-950">{title}</h3>
      <p className="mb-3.5 text-sm leading-[1.55] text-gray-600">{body}</p>
      <div className={clsx(EXAMPLE_BOX, 'px-3 py-2.5 text-[13px] text-gray-900')}>{example}</div>
    </li>
  )
}

function HowItWorks() {
  const { t } = useI18n()
  return (
    <section id="cach-hoat-dong" aria-labelledby="cach-hoat-dong-title" className={clsx(SECTION, 'bg-gray-25')}>
      <div className={WRAP}>
        <SectionHead
          id="cach-hoat-dong-title"
          title={t('Một yêu cầu đổi, chuyện gì xảy ra?', 'A requirement changes. What happens next?')}
          sub={t(
            'Không cần họp lại để báo cho nhau. Thay đổi đi theo đường truy vết.',
            'No extra meeting to tell each other. The change travels along the trace.',
          )}
        />
        <ol className="grid gap-5 md:grid-cols-3">
          <Step
            n={1}
            title={
              <>
                {t('BA sửa REQ, gửi duyệt', 'The BA edits the REQ and sends it for review')}
                <Who tone="neutral">BA</Who>
              </>
            }
            body={t(
              'Bản mới chỉ đánh dấu phần đổi, người duyệt không phải đọc lại cả tài liệu.',
              'The new version highlights only what changed, so reviewers don’t reread the whole document.',
            )}
            example={
              <>
                <b className="text-xs font-bold text-gray-500">REQ-12 · {t('bản 1.2', 'v1.2')}</b>
                <span>
                  <del className="text-gray-400">{t('Đăng nhập bằng Google.', 'Sign in with Google.')}</del>
                </span>
                <span>
                  {t('Đăng nhập Google ', 'Google sign-in ')}
                  <ins className="rounded-[3px] bg-success-100 px-0.5 no-underline">
                    {t('chỉ cho email công ty', 'for work emails only')}
                  </ins>
                  .
                </span>
              </>
            }
          />
          <Step
            n={2}
            title={
              <>
                {t('Dev thấy cờ trên Kanban', 'The dev sees a flag on Kanban')}
                <Who tone="blue">Dev</Who>
              </>
            }
            body={t(
              'Issue gắn REQ đó hiện “REQ đổi”. Bấm vào xem đổi gì rồi xác nhận.',
              'Issues linked to that REQ show “REQ changed”. Click to see what changed, then confirm.',
            )}
            example={
              <>
                <Row>
                  <Tag tone="brand">CORE-104</Tag>
                  {t('Làm nút Google', 'Build Google button')}
                </Row>
                <Row>
                  <Tag tone="amber">{t('REQ đổi', 'REQ changed')}</Tag>
                  <span className="text-xs text-gray-500">{t('Xem đổi gì', 'See what changed')}</span>
                </Row>
              </>
            }
          />
          <Step
            n={3}
            title={
              <>
                {t('QA biết test nào cần xem lại', 'QA knows which tests to revisit')}
                <Who tone="success">QA</Who>
              </>
            }
            body={t(
              'Testcase gắn REQ đó được đánh dấu cần xem lại, QA sửa bước test rồi chạy lại.',
              'Test cases linked to that REQ are marked for review; QA updates the steps and reruns them.',
            )}
            example={
              <>
                <Row>
                  <Tag tone="ok">TC-31</Tag>
                  {t('Đăng nhập Google', 'Google sign-in')}
                </Row>
                <Row>
                  <Tag tone="amber">{t('Cần xem lại', 'Needs review')}</Tag>
                </Row>
              </>
            }
          />
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------ Vai trò ------------------------------------------------ */

function Roles() {
  const { t } = useI18n()
  const roles = [
    {
      name: 'BA',
      dot: 'bg-violet-500',
      body: t(
        'Viết URD/SRS, đánh dấu REQ, gửi duyệt theo phiên bản.',
        'Write the URD/SRS, tag REQs, send versions for review.',
      ),
    },
    {
      name: 'Dev',
      dot: 'bg-brand-600',
      body: t(
        'Nhận issue gắn REQ, biết ngay khi yêu cầu đổi.',
        'Pick up issues linked to REQs, know right away when one changes.',
      ),
    },
    {
      name: 'QA',
      dot: 'bg-success-600',
      body: t('Chạy test theo đợt, lượt lỗi tạo bug cho Dev.', 'Run tests in rounds; failed runs create bugs for Dev.'),
    },
    {
      name: 'PM',
      dot: 'bg-amber-500',
      body: t(
        'Xem tiến độ, REQ chưa có testcase, việc đang kẹt.',
        'See progress, REQs without test cases, and blocked work.',
      ),
    },
  ]
  return (
    <section id="vai-tro" aria-labelledby="vai-tro-title" className={SECTION}>
      <div className={WRAP}>
        <SectionHead
          id="vai-tro-title"
          title={t('Mỗi người mở SSAM là thấy đúng việc của mình.', 'Everyone opens SSAM and sees their own work.')}
        />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {roles.map((r) => (
            <li key={r.name} className="rounded-card border border-gray-200 bg-white p-[18px]">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-950">
                <span aria-hidden="true" className={clsx('h-2.5 w-2.5 rounded-full', r.dot)} />
                {r.name}
              </h3>
              <p className="mt-2 text-sm leading-[1.55] text-gray-600">{r.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------- Hỏi đáp ------------------------------------------------- */

function Faq() {
  const { t } = useI18n()
  const items = [
    {
      q: t('Đồng nghiệp tham gia công ty thế nào?', 'How do colleagues join our company?'),
      a: t(
        'Ai đăng ký bằng email cùng domain với công ty sẽ được gợi ý tham gia và gửi yêu cầu; quản trị viên duyệt từng người. Bạn cũng có thể mời trực tiếp qua email.',
        'Anyone who signs up with an email on your company’s domain is suggested to join and sends a request; an admin approves each one. You can also invite people directly by email.',
      ),
    },
    {
      q: t('AI có tự sửa tài liệu của tôi không?', 'Does the AI edit my documents on its own?'),
      a: t(
        'Không. AI chỉ đề xuất (tách yêu cầu từ ghi chú, vẽ sơ đồ); nội dung chỉ vào tài liệu khi bạn bấm Áp dụng.',
        'No. AI only suggests (splitting requirements from notes, drawing diagrams); content enters the document only when you click Apply.',
      ),
    },
    {
      q: t('Xuất tài liệu ra file được không?', 'Can I export documents to a file?'),
      a: t(
        'Được, mỗi trang tài liệu xuất được PDF / in.',
        'Yes, every document page can be exported to PDF or printed.',
      ),
    },
    {
      q: t('Ai được sửa, ai chỉ được xem?', 'Who can edit and who can only view?'),
      a: t(
        'Quản trị viên công ty tự định nghĩa vai trò và quyền; mỗi người chỉ thấy và làm được những gì vai trò cho phép.',
        'Company admins define their own roles and permissions; each person only sees and does what their role allows.',
      ),
    },
  ]
  return (
    <section id="hoi-dap" aria-labelledby="hoi-dap-title" className={SECTION}>
      <div className={clsx(WRAP, 'grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-12')}>
        <SectionHead id="hoi-dap-title" title={t('Câu hỏi thường gặp', 'Frequently asked questions')} />
        <div>
          {items.map((it, i) => (
            <details key={it.q} open={i === 0} className="group border-b border-gray-200 py-4">
              <summary
                className={clsx(
                  FOCUS,
                  'flex cursor-pointer list-none justify-between gap-4 text-base font-medium text-gray-900 [&::-webkit-details-marker]:hidden',
                )}
              >
                {it.q}
                <ChevronDownIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------- CTA -------------------------------------------------- */

// Dải CTA sáng (brand-50, viền brand-100, lưới chấm xanh nhạt), chữ tối, nút chính thường.
function Cta() {
  const { t } = useI18n()
  return (
    <section aria-labelledby="cta-title" className="px-3 pb-3 md:px-8 md:pb-8">
      <div
        className={clsx(
          'mx-auto flex max-w-[1376px] flex-wrap items-center gap-6 rounded-card border border-brand-100 bg-brand-50 px-[22px] py-8 text-gray-950 md:p-14',
          DOTS_BRAND,
        )}
      >
        <h2
          id="cta-title"
          className="flex-[1_1_360px] text-[clamp(1.5rem,3vw,2.125rem)] font-bold leading-tight tracking-tight"
        >
          {t(
            'Đưa tài liệu, việc và kiểm thử của đội về một chỗ.',
            'Bring your team’s docs, work and testing into one place.',
          )}
        </h2>
        <Link to="/register" className={buttonClasses({ size: 'lg', inline: true })}>
          {t('Tạo tài khoản', 'Create an account')} <ArrowRightIcon aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------- Footer ------------------------------------------------- */

function Footer() {
  const { t } = useI18n()
  const link = clsx(FOCUS, 'transition-colors hover:text-gray-900')
  return (
    <footer className="border-t border-gray-100 py-7 text-[13px] text-gray-500">
      <div className={clsx(WRAP, 'flex flex-wrap items-center gap-5')}>
        <span className="mr-auto">© SSAM</span>
        <Link to="/login" className={link}>
          {t('Đăng nhập', 'Log in')}
        </Link>
        <Link to="/register" className={link}>
          {t('Đăng ký', 'Sign up')}
        </Link>
        <LanguageSwitch />
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
        <Features />
        <HowItWorks />
        <Roles />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
