// Sinh tài liệu từ ghi chú họp theo quy tắc (doc/Documents-API-Contract.md §6), chưa cần AI thật.
// normalize → 4 trường; extract → danh sách REQ; buildGeneratedContent → khung content TipTap.

import type {
  ExtractedRequirement,
  GeneratedItem,
  NormalizedFields,
  Priority,
  TipTapDoc,
  TipTapNode,
} from '@/types/document'
import { newUid } from './documentContent'

export const SAMPLE_NOTES = `Ghi chú họp phân tích ngày 26/10:
- Thanh toán đơn hàng bằng mã VietQR động, đối soát tự động qua webhook ngân hàng.
- Khách hàng chọn thanh toán VietQR ở bước checkout.
- Hệ thống sinh mã QR động kèm số tiền và mã đơn hàng duy nhất.
- Khách hàng quét mã QR bằng app ngân hàng để chuyển khoản.
- Ngân hàng gửi webhook về SSAM khi giao dịch thành công.
- Hệ thống cập nhật trạng thái đơn hàng và gửi thông báo cho khách hàng.
- Mã QR chỉ có hiệu lực trong 15 phút, sau 15 phút chưa thanh toán thì tự động huỷ đơn.
- Webhook phải được xác thực chữ ký HMAC và phản hồi tối đa 3 giây.
- Số tiền chuyển không khớp đơn hàng thì không được tự duyệt, chuyển kế toán đối soát thủ công.`

const ACTOR_TERMS = [
  'khách hàng',
  'người dùng',
  'người mua',
  'người bán',
  'hệ thống',
  'ngân hàng',
  'cổng thanh toán',
  'kế toán',
  'admin',
  'quản trị viên',
  'nhân viên',
  'quản lý',
  'giáo viên',
  'học viên',
  'sinh viên',
  'bác sĩ',
  'bệnh nhân',
  'tài xế',
  'đối tác',
  'nhà cung cấp',
]

// \b của JS chỉ hiểu chữ ASCII: "chỉ" kết thúc bằng ký tự có dấu nên tự viết ranh giới từ theo Unicode.
const word = (w: string) => new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, 'u')

const RULE_PATTERNS = [
  word('phải'),
  /không được/,
  word('chỉ'),
  /tối đa/,
  /tối thiểu/,
  /bắt buộc/,
  /hết hạn/,
  /trong vòng/,
  /sau\s+\d+\s*(phút|giờ|ngày|giây)/,
  /^(ràng buộc|quy tắc|lưu ý)(?!\p{L})/u,
]

const ACTION_VERBS = [
  'đăng nhập',
  'đăng ký',
  'đăng xuất',
  'tạo',
  'sinh',
  'gửi',
  'nhận',
  'quét',
  'mở',
  'chọn',
  'nhập',
  'xác nhận',
  'xác thực',
  'thanh toán',
  'chuyển khoản',
  'chuyển',
  'cập nhật',
  'kiểm tra',
  'duyệt',
  'phê duyệt',
  'huỷ',
  'hủy',
  'xoá',
  'xóa',
  'sửa',
  'tìm kiếm',
  'tra cứu',
  'xem',
  'tải',
  'hiển thị',
  'thông báo',
  'lưu',
  'đối soát',
  'hoàn tiền',
  'xuất',
  'in',
  'đặt',
  'thêm',
  'gán',
  'phân quyền',
  'báo cáo',
  'đồng bộ',
]

const HIGH_PRIORITY = new RegExp(`bắt buộc|${word('phải').source}|bảo mật|thanh toán`, 'u')

const STOPWORDS = new Set(
  'và của cho các có được khi thì là với trong sau theo từ một những này đó để bằng về ra vào lại đã sẽ đang không bị tại trên dưới hoặc nếu mà như hệ thống người dùng khách hàng phải chỉ tối đa thiểu phút giây giờ ngày'.split(
    ' ',
  ),
)

const clean = (line: string) =>
  line
    .replace(/^\s*(?:[-*•+]|\d+[.)]|[a-z][.)])\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

const stripEnd = (s: string) => s.replace(/[.;,:\s]+$/, '').trim()
const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('vi') + s.slice(1) : s)

function sentences(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=\p{Lu})/u))
    .map((s) => s.trim())
    .filter(Boolean)
}

const isHeaderLine = (s: string) => /:$/.test(s) || /^(ghi chú|biên bản|cuộc họp|họp|meeting|notes?)(?!\p{L})/iu.test(s)

export const isRuleSentence = (s: string) => {
  const lower = s.toLocaleLowerCase('vi')
  return RULE_PATTERNS.some((re) => re.test(lower))
}

/** Bắt đầu bằng động từ hành động, có thể đứng sau "Khi/Sau đó" hoặc một tác nhân ("Khách hàng quét…"). */
export const isFlowSentence = (s: string) => {
  let lower = s.toLocaleLowerCase('vi').replace(/^(khi|sau đó|tiếp theo|rồi|nếu)\s+/, '')
  const actor = ACTOR_TERMS.find((a) => lower.startsWith(a + ' '))
  if (actor) lower = lower.slice(actor.length + 1)
  lower = lower.replace(/^(sẽ|được|có thể|muốn)\s+/, '')
  return ACTION_VERBS.some((v) => lower === v || lower.startsWith(v + ' '))
}

function actorsIn(text: string): string[] {
  const lower = text.toLocaleLowerCase('vi')
  return ACTOR_TERMS.map((a) => ({ a, i: lower.indexOf(a) }))
    .filter((x) => x.i >= 0)
    .sort((x, y) => x.i - y.i)
    .map((x) => (x.a === 'admin' ? 'Admin' : capitalize(x.a)))
}

export function normalizeNotes(rawNotes: string): NormalizedFields {
  const all = sentences(rawNotes)
  const content = all.filter((s) => !isHeaderLine(s))
  // Câu đầu (bỏ dòng tiêu đề "Ghi chú họp…:") là phạm vi; phần còn lại chia thành quy tắc / luồng.
  const scopeSource = content[0] ?? ''
  const rest = content.length > 1 ? content.slice(1) : content
  const rules: string[] = []
  const flows: string[] = []
  for (const s of rest) {
    if (isRuleSentence(s)) rules.push(stripEnd(s.replace(/^(ràng buộc|quy tắc|lưu ý)\s*:\s*/iu, '')))
    else if (isFlowSentence(s)) flows.push(stripEnd(s))
  }
  const fallbackFlows = flows.length > 0 ? flows : rest.filter((s) => !isRuleSentence(s)).map(stripEnd)
  return {
    scope: capitalize(stripEnd(scopeSource)),
    actors: actorsIn(content.join(' ')).join(', '),
    mainFlows: fallbackFlows.map(capitalize).join('\n'),
    businessRules: rules.map(capitalize).join('\n'),
  }
}

const tokens = (s: string) =>
  new Set(
    s
      .toLocaleLowerCase('vi')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w)),
  )

export const linesOf = (s: string) => s.split(/\r?\n/).map(clean).map(stripEnd).filter(Boolean)

const norm = (s: string) => stripEnd(clean(s)).toLocaleLowerCase('vi')

/** Dòng ghi chú gốc (0-based) chứa tiêu đề hoặc một tiêu chí của REQ — để FE tô sáng ghi chú gốc. */
export function sourceLinesFor(rawNotes: string, texts: string[]): number[] {
  const wanted = texts.map(norm).filter((t) => t.length >= 4)
  const out: number[] = []
  rawNotes.split(/\r?\n/).forEach((line, i) => {
    const l = norm(line)
    if (l.length >= 4 && wanted.some((w) => l.includes(w) || w.includes(l))) out.push(i)
  })
  return out
}

/**
 * `rawNotes` là tuỳ chọn: hợp đồng §6 chỉ gửi `fields`, nhưng `sourceLines` là chỉ số dòng trong rawNotes nên FE gửi kèm.
 * Thiếu rawNotes → sourceLines rỗng.
 */
export function extractRequirementsFromFields(
  fields: NormalizedFields,
  uid: () => string = newUid,
  rawNotes?: string,
): ExtractedRequirement[] {
  const flows = linesOf(fields.mainFlows)
  const rules = linesOf(fields.businessRules)
  const criteria: string[][] = flows.map(() => [])
  const flowTokens = flows.map(tokens)
  // Mỗi quy tắc gắn vào luồng có nhiều từ khoá chung nhất (≥ 1), hoà thì luồng đứng trước.
  for (const rule of rules) {
    const rt = tokens(rule)
    let best = -1
    let bestScore = 0
    flowTokens.forEach((ft, i) => {
      let score = 0
      for (const w of rt) if (ft.has(w)) score++
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    })
    if (best >= 0) criteria[best].push(capitalize(rule))
  }
  return flows.map((flow, i) => {
    const title = capitalize(flow)
    const actors = actorsIn(flow)
    const description = actors.length
      ? `${actors.join(', ')}: ${flow.charAt(0).toLocaleLowerCase('vi') + flow.slice(1)}.`
      : `${title}.`
    const priority: Priority = HIGH_PRIORITY.test([title, ...criteria[i]].join(' ').toLocaleLowerCase('vi'))
      ? 'HIGH'
      : 'MEDIUM'
    return {
      tempId: `tmp-${uid().slice(0, 8)}`,
      title,
      description,
      priority,
      acceptanceCriteria: criteria[i],
      sourceLines: rawNotes ? sourceLinesFor(rawNotes, [flow, ...criteria[i]]) : [],
    }
  })
}

// --- Dựng content ---

const text = (t: string): TipTapNode => ({ type: 'text', text: t })
const paragraph = (t: string): TipTapNode => (t ? { type: 'paragraph', content: [text(t)] } : { type: 'paragraph' })
const bulletList = (items: string[]): TipTapNode => ({
  type: 'bulletList',
  content: items.map((i) => ({ type: 'listItem', content: [paragraph(i)] })),
})

/**
 * Khung §6: H1 "1. Tổng quan" (scope + actors dạng bullet) → H1 "2. Yêu cầu chức năng" → mỗi item là H2 `req: true`
 * + paragraph mô tả + taskList tiêu chí → H1 "3. Quy tắc nghiệp vụ" (callout `rule` liệt kê businessRules).
 */
export function buildGeneratedContent(
  fields: NormalizedFields,
  items: ExtractedRequirement[],
  uid: () => string = newUid,
): { content: TipTapDoc; items: GeneratedItem[] } {
  const h = (level: number, title: string, extra: Record<string, unknown> = {}): TipTapNode => ({
    type: 'heading',
    attrs: { level, id: `h-${uid().slice(0, 8)}`, ...extra },
    content: [text(title)],
  })
  const actors = fields.actors
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
  const rules = linesOf(fields.businessRules)

  const content: TipTapNode[] = [h(1, '1. Tổng quan'), paragraph(fields.scope.trim())]
  if (actors.length) content.push(bulletList(actors))
  content.push(h(1, '2. Yêu cầu chức năng'))
  const generated: GeneratedItem[] = []
  for (const item of items) {
    const reqUid = uid()
    generated.push({ ...item, reqUid })
    content.push(h(2, item.title.trim(), { req: true, reqUid, priority: item.priority }))
    if (item.description.trim()) content.push(paragraph(item.description.trim()))
    const criteria = item.acceptanceCriteria.map((c) => c.trim()).filter(Boolean)
    if (criteria.length) {
      content.push({
        type: 'taskList',
        content: criteria.map((c) => ({ type: 'taskItem', attrs: { checked: false }, content: [paragraph(c)] })),
      })
    }
  }
  content.push(h(1, '3. Quy tắc nghiệp vụ'))
  content.push({
    type: 'callout',
    attrs: { tone: 'rule' },
    content: rules.length ? [bulletList(rules)] : [paragraph('')],
  })
  return { content: { type: 'doc', content }, items: generated }
}
