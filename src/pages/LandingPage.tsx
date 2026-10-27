import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { buttonClasses } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { Eyebrow, Tag } from '@/components/ui/Eyebrow'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BeakerIcon,
  BoltIcon,
  FrameIcon,
  LinkIcon,
  NotesIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  WorkflowIcon,
} from '@/components/ui/icons'

/* ------------------------------------------------------------------------------------------------
 * Ngôn ngữ thiết kế của trang này (để người sau sửa cho đúng "giọng"):
 * - Ẩn dụ: "bảng truy xuất" (traceability ledger). Trang được dàn như một tài liệu kỹ thuật: hairline,
 *   số thứ tự mono, cột lệch — không dùng blob gradient, không lưới 3 cột đối xứng, không card bo tròn đều.
 * - Màu: nền giấy ấm + trung tính stone; XANH chỉ dành cho "đã liên kết / kiểm chứng / hành động chính";
 *   HỔ PHÁCH (amber) chỉ dành cho "đã đổi / cần cập nhật". Hai màu này kể chuyện sản phẩm, không trang trí.
 * - Bo góc có thứ bậc: khối tài liệu rounded-sm/md (sắc), phần tử tương tác rounded-md, trạng thái rounded-full.
 * ---------------------------------------------------------------------------------------------- */

const PROBLEMS = [
  {
    title: 'Hàng chục giờ gõ tài liệu thủ công',
    description:
      'Business Analyst tự tay biến ghi chú họp rải rác và tin nhắn phi chính thức thành tài liệu URD có cấu trúc — rồi làm lại từ đầu khi yêu cầu đổi.',
    impact: 'Hệ quả · BA thành người chép bài thay vì người phân tích',
  },
  {
    title: 'UI đổi, tài liệu không hay biết',
    description:
      'Designer cập nhật thiết kế trên Figma, nhưng URD vẫn giữ nguyên. QA chỉ phát hiện ra khi đã bắt tay vào kiểm thử — thường là lúc sát deadline.',
    impact: 'Hệ quả · Tài liệu và sản phẩm là hai phiên bản khác nhau',
  },
  {
    title: 'Testcase mồ côi',
    description:
      'Requirement thay đổi nhưng không ai biết testcase nào cần cập nhật. Liên kết truy xuất đứt gãy, bug lọt ra production với một bộ test "xanh" hoàn hảo.',
    impact: 'Hệ quả · Pass 100% nhưng vẫn sai yêu cầu',
  },
]

const STEPS = [
  {
    tag: 'Nhập',
    title: 'Dán ghi chú thô vào workspace',
    description:
      'Ghi chú họp, tin nhắn trao đổi, email khách hàng — cứ dán nguyên. Không cần định dạng, không cần template.',
    Icon: NotesIcon,
  },
  {
    tag: 'AI → URD',
    title: 'AI cấu trúc hóa thành URD có phiên bản',
    description:
      'Mỗi yêu cầu nhận một mã REQ, mô tả, tiêu chí chấp nhận. BA sửa bản nháp, gửi vào quy trình phê duyệt của tổ chức.',
    Icon: SparklesIcon,
  },
  {
    tag: 'Đồng bộ',
    title: 'Theo dõi thay đổi từ Figma',
    description:
      'SSAM so sánh phiên bản thiết kế, gắn cờ đúng yêu cầu bị ảnh hưởng và báo cho người liên quan — không ai phải "nhớ".',
    Icon: FrameIcon,
  },
  {
    tag: 'AI → Test',
    title: 'Sinh testcase bám yêu cầu mới nhất',
    description:
      'Testcase liên kết hai chiều với REQ và màn hình. Yêu cầu đổi thì testcase liên quan được đánh dấu cần cập nhật, không bao giờ mồ côi.',
    Icon: BeakerIcon,
  },
]

const ROLES = [
  {
    tag: 'BA',
    title: 'Gõ ít hơn, nghĩ nhiều hơn',
    text: 'Dán ghi chú, sửa bản nháp AI sinh, gửi duyệt. Thời gian dành cho phân tích thay vì định dạng tài liệu.',
  },
  {
    tag: 'Designer',
    title: 'Cứ làm việc trong Figma',
    text: 'Không phải báo cáo thay đổi bằng tay. SSAM tự thấy bạn đổi gì và gắn cờ cho BA, QA.',
  },
  {
    tag: 'QA',
    title: 'Biết chính xác test gì, vì sao',
    text: 'Mỗi testcase chỉ ngược về REQ và màn hình đã sinh ra nó. Yêu cầu đổi là biết ngay TC nào cần xem lại.',
  },
  {
    tag: 'Dev / Lead',
    title: 'Cập nhật tiến độ ngay trên yêu cầu',
    text: 'Đánh dấu "xong" là QA được kích hoạt. Không cần họp sync để biết đội đang ở đâu.',
  },
]

/* ------------------------------------ Minh họa hero: bảng truy xuất ----------------------------------- */

type TraceState = 'linked' | 'drift'

interface TraceRowData {
  req: { id: string; title: string }
  ui: { id: string; title: string }
  tc: { id: string; title: string }
  state: TraceState
}

const TRACE_ROWS: TraceRowData[] = [
  {
    req: { id: 'REQ-012', title: 'Thanh toán một chạm' },
    ui: { id: 'UI-07', title: 'Checkout / Pay' },
    tc: { id: 'TC-031', title: 'Thanh toán thành công' },
    state: 'linked',
  },
  {
    req: { id: 'REQ-013', title: 'Màn xác nhận đơn hàng' },
    ui: { id: 'UI-08', title: 'Confirm order · v4' },
    tc: { id: 'TC-032', title: 'Hiển thị phí giao hàng' },
    state: 'drift',
  },
  {
    req: { id: 'REQ-014', title: 'Lưu địa chỉ giao hàng' },
    ui: { id: 'UI-09', title: 'Address book' },
    tc: { id: 'TC-033', title: 'Lưu & chọn lại địa chỉ' },
    state: 'linked',
  },
]

function TraceCell({
  id,
  title,
  badge,
  align = 'left',
}: {
  id: string
  title: string
  badge?: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <div className={clsx('min-w-0 py-3', align === 'right' && 'text-right')}>
      {/* flex-wrap + nowrap trên mã: cột hẹp (mobile) thì badge rơi xuống dòng dưới chứ mã "TC-032" không bị bẻ đôi */}
      <p
        className={clsx(
          'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[11px] font-semibold text-gray-900',
          align === 'right' && 'justify-end',
        )}
      >
        <span className="whitespace-nowrap">{id}</span>
        {badge}
      </p>
      <p className="mt-0.5 truncate text-[12px] text-gray-500">{title}</p>
    </div>
  )
}

function TraceConnector({ state, delay }: { state: TraceState; delay: number }) {
  return (
    <span className="flex w-5 items-center sm:w-8" aria-hidden="true">
      <span
        className={clsx(
          'block h-px w-full origin-left animate-draw-x motion-reduce:animate-none',
          state === 'linked' ? 'bg-brand-500' : 'border-t border-dashed border-amber-500 bg-transparent',
        )}
        style={{ animationDelay: `${delay}ms` }}
      />
    </span>
  )
}

function DriftBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px font-mono text-[9px] font-medium uppercase tracking-wider text-amber-800">
      <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse-ring motion-reduce:animate-none" />
      {children}
    </span>
  )
}

function LinkedDot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-label="đã liên kết" />
}

function TraceBoard() {
  return (
    <div className="relative mx-auto max-w-2xl lg:max-w-none">
      {/* Ghi chú thô: đầu vào của cả vòng — nổi trên góc bảng, hơi nghiêng như tờ giấy dán */}
      <div className="absolute -left-1 top-0 z-10 w-56 -rotate-2 rounded-sm border border-amber-200 bg-amber-50 p-3 shadow-md shadow-amber-900/10 sm:-left-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-700">Ghi chú họp · 14:02</p>
        <p className="mt-1.5 text-[12px] leading-snug text-gray-700">
          &ldquo;khách muốn thanh toán 1 chạm, màn xác nhận phải hiện phí ship, nhớ lưu địa chỉ&hellip;
          <span className="animate-blink motion-reduce:animate-none text-amber-600">▍</span>
        </p>
      </div>

      {/* Bảng truy xuất — mt đủ lớn để tờ ghi chú chỉ đè lên thanh tiêu đề (bên trái trống), không che nhãn cột */}
      <div className="mt-[4.75rem] rounded-md border border-gray-200 bg-white shadow-xl shadow-gray-900/[0.06]">
        <div className="flex h-11 items-center justify-end gap-3 border-b border-gray-200 px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-950 px-2.5 py-1 font-mono text-[10px] text-white">
            <SparklesIcon className="h-3 w-3 text-brand-300" />
            AI sinh 3 yêu cầu · 4s
          </span>
          <span className="hidden font-mono text-[11px] text-gray-400 sm:inline">checkout-v4 / truy-xuat</span>
        </div>

        <div className="px-4">
          <div className="grid grid-cols-[1fr_1.25rem_1fr_1.25rem_1fr] items-center pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 sm:grid-cols-[1fr_2rem_1fr_2rem_1fr]">
            <span>Yêu cầu</span>
            <span />
            <span>Thiết kế</span>
            <span />
            <span className="text-right">Testcase</span>
          </div>

          <ul className="divide-y divide-gray-100">
            {TRACE_ROWS.map((row, i) => {
              const drift = row.state === 'drift'
              return (
                <li
                  key={row.req.id}
                  className={clsx(
                    'grid grid-cols-[1fr_1.25rem_1fr_1.25rem_1fr] items-center sm:grid-cols-[1fr_2rem_1fr_2rem_1fr]',
                    drift && '-mx-4 bg-amber-50/60 px-4',
                  )}
                >
                  <TraceCell id={row.req.id} title={row.req.title} badge={!drift && <LinkedDot />} />
                  <TraceConnector state={row.state} delay={300 + i * 180} />
                  <TraceCell id={row.ui.id} title={row.ui.title} badge={drift ? <DriftBadge>UI đổi</DriftBadge> : undefined} />
                  <TraceConnector state={row.state} delay={420 + i * 180} />
                  <TraceCell
                    id={row.tc.id}
                    title={row.tc.title}
                    align="right"
                    badge={drift ? <DriftBadge>cần cập nhật</DriftBadge> : <LinkedDot />}
                  />
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <FrameIcon className="h-3.5 w-3.5" />
            Đồng bộ Figma · 2 phút trước
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <AlertTriangleIcon className="h-3.5 w-3.5" />1 cần cập nhật
          </span>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------- Các mảnh dùng lại ------------------------------------------ */

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-gray-950 sm:text-4xl">{children}</h2>
}

/* ------------------------------------------------ Nav ------------------------------------------------- */

const NAV_LINKS = [
  { href: '#van-de', label: 'Vấn đề' },
  { href: '#cach-hoat-dong', label: 'Cách hoạt động' },
  { href: '#tinh-nang', label: 'Tính năng' },
]

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          to="/"
          aria-label="SSAM — về đầu trang"
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Logo />
        </Link>

        <nav aria-label="Mục trên trang" className="hidden items-center gap-10 text-sm font-medium text-gray-600 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="group relative py-2 transition-colors hover:text-gray-950">
              {l.label}
              <span className="absolute inset-x-0 -bottom-[1px] h-px origin-left scale-x-0 bg-brand-600 transition-transform duration-200 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-5">
          <Link
            to="/login"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950"
          >
            Đăng nhập
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-gray-300 sm:block" />
          <Link to="/register" className={buttonClasses({ inline: true })}>
            <span className="sm:hidden">Dùng thử</span>
            <span className="hidden sm:inline">Dùng thử miễn phí</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------ Hero ------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Nền: lưới kỹ thuật mờ dần — thay cho blob gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(28_25_23/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(28_25_23/0.05)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_60%_0%,black_20%,transparent_75%)]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pb-28 lg:pt-24">
        <div className="lg:col-span-6 xl:col-span-5">
          <Reveal>
            <Eyebrow className="text-brand-700">// AI cho vòng đời đặc tả phần mềm</Eyebrow>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-gray-950 sm:text-5xl lg:text-[3.4rem]">
              Từ ghi chú họp đến testcase, <span className="text-brand-700">không đứt một mắt xích.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600">
              SSAM biến ghi chú thô của BA thành tài liệu URD có cấu trúc, theo dõi thay đổi từ Figma và giữ testcase luôn
              bám yêu cầu mới nhất. Một nguồn sự thật cho BA, Designer, QA và Dev.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className={buttonClasses({ size: 'lg', inline: true })}>
                Bắt đầu miễn phí
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a href="#cach-hoat-dong" className={buttonClasses({ variant: 'secondary', size: 'lg', inline: true })}>
                Xem cách hoạt động
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-500">
              <li>Không cần thẻ</li>
              <li>Thiết lập trong 5 phút</li>
              <li>Đa tổ chức · cô lập dữ liệu</li>
            </ul>
          </Reveal>
        </div>

        <div className="lg:col-span-6 xl:col-span-7">
          <Reveal delay={120}>
            <TraceBoard />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------- Vấn đề ----------------------------------------------- */

function Problems() {
  return (
    <section id="van-de" className="scroll-mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-28">
            <Eyebrow>01 — Vấn đề</Eyebrow>
            <SectionTitle>Ba chỗ đứt gãy quen thuộc trong mọi đội phát triển</SectionTitle>
            <p className="mt-4 leading-relaxed text-gray-600">
              Không phải vì thiếu người. Vì tài liệu, thiết kế và kiểm thử sống ở ba nơi khác nhau, và không ai được giao
              việc nối chúng lại.
            </p>
          </Reveal>
        </div>

        <ol className="border-t border-gray-300 lg:col-span-8">
          {PROBLEMS.map((p, i) => (
            <Reveal
              as="li"
              key={p.title}
              delay={i * 80}
              className="grid gap-3 border-b border-gray-200 py-8 sm:grid-cols-[4rem_1fr] sm:gap-6"
            >
              <span className="font-mono text-sm text-brand-700">0{i + 1}</span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-gray-950">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-gray-600">{p.description}</p>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-400">{p.impact}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------ Cách hoạt động ------------------------------------------- */

function HowItWorks() {
  return (
    <section id="cach-hoat-dong" className="scroll-mt-16 border-t border-gray-200">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <Reveal className="max-w-2xl">
          <Eyebrow>02 — Cách hoạt động</Eyebrow>
          <SectionTitle>Bốn bước, một dòng chảy không đứt</SectionTitle>
          <p className="mt-4 leading-relaxed text-gray-600">
            Mỗi bước tạo ra một liên kết truy xuất. Đến cuối, mọi testcase đều chỉ ngược được về đúng câu trong ghi chú họp
            đã sinh ra nó.
          </p>
        </Reveal>

        <ol className="mt-12 border-t border-gray-300">
          {STEPS.map((s, i) => (
            <Reveal
              as="li"
              key={s.title}
              delay={i * 80}
              className="group grid gap-4 border-b border-gray-200 py-8 md:grid-cols-12 md:items-start md:gap-8"
            >
              <div className="flex items-center gap-3 md:col-span-2">
                <span className="font-mono text-sm text-brand-700">0{i + 1}</span>
                <Tag tone={s.tag.startsWith('AI') ? 'brand' : 'neutral'}>{s.tag}</Tag>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-gray-950 md:col-span-4">{s.title}</h3>
              <p className="leading-relaxed text-gray-600 md:col-span-5">{s.description}</p>
              <div className="hidden justify-end text-gray-300 transition-colors group-hover:text-brand-600 md:col-span-1 md:flex">
                <s.Icon className="h-6 w-6" />
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------- Tính năng (bento) --------------------------------------- */

function FeatureHead({
  icon,
  title,
  description,
  tag,
}: {
  icon: ReactNode
  title: string
  description: string
  tag?: ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700">
          {icon}
        </span>
        {tag}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-gray-950">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{description}</p>
    </div>
  )
}

// Mock nhỏ: ghi chú thô → URD (dùng trong ô lớn của bento)
function NoteToUrdMock() {
  return (
    <div className="mt-6 grid flex-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div className="rounded-sm border border-dashed border-gray-300 bg-white p-3 font-mono text-[11px] leading-relaxed text-gray-500">
        <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400">ghi-chu-hop.txt</p>
        <p className="mt-1.5">
          - khách muốn thanh toán 1 chạm
          <br />- màn confirm phải hiện phí ship
          <br />- lưu địa chỉ cho lần sau
          <br />- (hỏi lại: có cần OTP?)
        </p>
      </div>
      <div className="flex items-center justify-center text-gray-400 sm:flex-col sm:gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-950 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white">
          <SparklesIcon className="h-3 w-3 text-brand-300" /> AI
        </span>
        <ArrowRightIcon className="hidden h-4 w-4 sm:block" />
      </div>
      <div className="rounded-sm border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 font-mono text-[10px] text-gray-400">
          <span>URD · v1.0</span>
          <Tag tone="brand">nháp</Tag>
        </div>
        <ul className="divide-y divide-gray-100 text-[11px]">
          {[
            ['REQ-012', 'Thanh toán một chạm'],
            ['REQ-013', 'Màn xác nhận đơn hàng'],
            ['REQ-014', 'Lưu địa chỉ giao hàng'],
          ].map(([id, title]) => (
            <li key={id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="font-mono font-semibold text-gray-900">{id}</span>
              <span className="truncate text-gray-600">{title}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 px-3 py-1.5 text-amber-800">
            <AlertTriangleIcon className="h-3 w-3" />
            <span>1 câu hỏi mở cần BA xác nhận</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

// Mock nhỏ: diff giữa 2 phiên bản thiết kế
function FigmaDiffMock() {
  return (
    <div className="mt-5 rounded-sm border border-gray-200 bg-white p-3 font-mono text-[11px]">
      <div className="flex items-center justify-between text-gray-500">
        <span>UI-08 · Confirm order</span>
        <span>
          v3 <span className="text-gray-300">→</span> <span className="font-semibold text-gray-900">v4</span>
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        <li className="flex items-center gap-2 text-brand-700">
          <span className="w-3 text-center">+</span>Phí giao hàng
        </li>
        <li className="flex items-center gap-2 text-red-600">
          <span className="w-3 text-center">−</span>Ô mã giảm giá
        </li>
        <li className="flex items-center gap-2 text-amber-800">
          <AlertTriangleIcon className="h-3 w-3" />
          Ảnh hưởng REQ-013 · TC-032
        </li>
      </ul>
    </div>
  )
}

// Mock nhỏ: chuỗi truy xuất 2 chiều
function TraceChainMock() {
  const nodes = ['REQ-013', 'UI-08', 'TC-032']
  return (
    <div className="mt-5 flex items-center font-mono text-[11px] font-semibold text-gray-900">
      {nodes.map((n, i) => (
        <div key={n} className="flex items-center">
          <span className="rounded-sm border border-gray-200 bg-white px-2 py-1">{n}</span>
          {i < nodes.length - 1 && (
            <span className="flex items-center text-brand-600" aria-hidden="true">
              <span className="h-px w-3 bg-brand-500 sm:w-5" />
              <span className="text-[10px]">↔</span>
              <span className="h-px w-3 bg-brand-500 sm:w-5" />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function Features() {
  const tile = 'rounded-md border border-gray-200 bg-paper p-6 sm:p-7'
  return (
    <section id="tinh-nang" className="scroll-mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <Reveal className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <Eyebrow>03 — Tính năng</Eyebrow>
            <SectionTitle>Mọi thứ đội ngũ cần, không thừa một màn hình</SectionTitle>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-gray-500">
            Xây cho SME và đội nhỏ: bật lên là dùng, phân quyền theo vai trò, không cần tích hợp phức tạp.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-12">
          <Reveal className={clsx(tile, 'flex flex-col md:col-span-7 md:row-span-2')}>
            <FeatureHead
              icon={<SparklesIcon className="h-5 w-5" />}
              tag={<Tag tone="brand">AI</Tag>}
              title="AI sinh URD từ ghi chú thô"
              description="Rút ngắn hàng giờ soạn thảo xuống vài phút. Mỗi yêu cầu có mã, mô tả, tiêu chí chấp nhận và phiên bản — BA chỉ cần rà và sửa."
            />
            <NoteToUrdMock />
          </Reveal>

          <Reveal delay={80} className={clsx(tile, 'md:col-span-5')}>
            <FeatureHead
              icon={<FrameIcon className="h-5 w-5" />}
              tag={<Tag tone="amber">theo dõi thay đổi</Tag>}
              title="Đồng bộ thiết kế Figma"
              description="Tự phát hiện UI đổi giữa hai phiên bản và gắn cờ đúng yêu cầu, testcase bị ảnh hưởng."
            />
            <FigmaDiffMock />
          </Reveal>

          <Reveal delay={160} className={clsx(tile, 'md:col-span-5')}>
            <FeatureHead
              icon={<LinkIcon className="h-5 w-5" />}
              title="Truy xuất nguồn gốc hai chiều"
              description="Requirement ↔ UI ↔ Testcase liên kết chặt. Đi từ bất kỳ đầu nào cũng tìm được hai đầu còn lại."
            />
            <TraceChainMock />
          </Reveal>

          <Reveal delay={200} className={clsx(tile, 'md:col-span-4')}>
            <FeatureHead
              icon={<UsersIcon className="h-5 w-5" />}
              title="Workspace đa tổ chức"
              description="Phân quyền động theo Role Tags, dữ liệu mỗi công ty cô lập hoàn toàn."
            />
          </Reveal>
          <Reveal delay={260} className={clsx(tile, 'md:col-span-4')}>
            <FeatureHead
              icon={<WorkflowIcon className="h-5 w-5" />}
              title="Quy trình phê duyệt tùy biến"
              description="Tự định nghĩa trạng thái và luồng chuyển cho tài liệu theo cách tổ chức bạn đang làm."
            />
          </Reveal>
          <Reveal delay={320} className={clsx(tile, 'md:col-span-4')}>
            <FeatureHead
              icon={<TrendingUpIcon className="h-5 w-5" />}
              title="Theo dõi tiến độ phát triển"
              description="Tech Lead và Dev cập nhật trạng thái ngay trên yêu cầu, tự động kích hoạt QA."
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------- Vai trò ---------------------------------------------- */

function Roles() {
  return (
    <section className="border-t border-gray-200">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <Reveal className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <Eyebrow>04 — Cho từng vai trò</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-950">Mỗi người bớt một việc lặp</h2>
          </div>
          <p className="max-w-xs text-sm text-gray-500">Cùng một bảng truy xuất, mỗi vai trò nhìn đúng phần việc của mình.</p>
        </Reveal>

        {/* Lưới hairline (gap-px trên nền viền) đọc như một bảng, không phải bốn card rời */}
        <Reveal delay={80} className="mt-8 grid gap-px overflow-hidden rounded-md border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.tag} className="bg-paper p-6">
              <Tag>{r.tag}</Tag>
              <h3 className="mt-4 font-semibold text-gray-950">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{r.text}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------- CTA ------------------------------------------------ */

const LEDGER_LINES = Array.from({ length: 12 }, (_, i) => {
  const n = String(12 + i).padStart(3, '0')
  const u = String(7 + i).padStart(2, '0')
  const t = String(31 + i).padStart(3, '0')
  return `REQ-${n} ── UI-${u} ── TC-${t} · ĐÃ LIÊN KẾT`
})

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-gray-950 text-white">
      {/* Kết cấu nền: những dòng "sổ cái" mono rất mờ, lệch nhau — gợi bảng truy xuất chạy dài */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgb(18_183_106/0.16),transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 space-y-3 whitespace-nowrap py-4 font-mono text-[11px] leading-none text-white/[0.06]">
          {LEDGER_LINES.map((line, i) => (
            <p key={line} style={{ transform: `translateX(${-(i * 53) % 400}px)` }}>
              {line} &nbsp;&nbsp; {line} &nbsp;&nbsp; {line} &nbsp;&nbsp; {line} &nbsp;&nbsp; {line}
            </p>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 lg:py-32">
        <Reveal>
          <Eyebrow className="text-brand-300">Bắt đầu</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Khép kín vòng truy xuất cho dự án tiếp theo.
          </h2>
          <p className="mt-5 text-lg text-gray-300">Tạo tài khoản trong vài phút. Không cần cài đặt, không cần thẻ.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className={buttonClasses({ variant: 'inverted', size: 'lg', inline: true })}>
              Tạo tài khoản miễn phí
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link to="/login" className={buttonClasses({ variant: 'invertedOutline', size: 'lg', inline: true })}>
              Tôi đã có tài khoản
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ----------------------------------------------- Footer ----------------------------------------------- */

function Footer() {
  const linkClass = 'text-sm text-gray-600 transition-colors hover:text-gray-950'
  return (
    <footer className="border-t border-gray-200 bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-6">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-500">
            Nền tảng AI hỗ trợ vòng đời đặc tả phần mềm cho đội ngũ nhỏ và SME — từ ghi chú thô đến testcase có truy xuất
            nguồn gốc.
          </p>
        </div>
        <div className="md:col-span-3">
          <Eyebrow>Sản phẩm</Eyebrow>
          <ul className="mt-4 space-y-2.5">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={linkClass}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-3">
          <Eyebrow>Tài khoản</Eyebrow>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/login" className={linkClass}>
                Đăng nhập
              </Link>
            </li>
            <li>
              <Link to="/register" className={linkClass}>
                Tạo tài khoản
              </Link>
            </li>
            <li>
              <Link to="/forgot-password" className={linkClass}>
                Quên mật khẩu
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 font-mono text-[11px] text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© 2026 SSAM · Đồ án tốt nghiệp SEP490-G65 · FPT University</span>
          <span className="inline-flex items-center gap-2">
            <BoltIcon className="h-3.5 w-3.5 text-brand-600" />
            Xây bằng React, TypeScript và Tailwind
          </span>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------ Trang ----------------------------------------------- */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-gray-900">
      <Nav />
      <main>
        <Hero />
        <Problems />
        <HowItWorks />
        <Features />
        <Roles />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
