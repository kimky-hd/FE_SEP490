// doc/Documents-API-Contract.md §6b — sinh sơ đồ Mermaid từ đoạn mô tả luồng, theo quy tắc (chưa dùng AI thật).
// Hàm thuần: cùng đầu vào → cùng đầu ra. BE nên làm tương tự cho tới khi nối AI.

import type { DiagramKind, DiagramProposalDto } from '@/types/document'

export type { DiagramKind }
export type DiagramResult = DiagramProposalDto

export const DIAGRAM_KINDS: DiagramKind[] = ['flowchart', 'sequence', 'state']
export const DIAGRAM_TEXT_MAX = 8000
const LABEL_MAX = 40
const STEP_MAX = 30

// ---------- Tách câu ----------

const BULLET = /^\s*(?:[-*•+–]|\d{1,3}[.)]|[a-zA-Z][.)])\s+/

/** Mỗi dòng / gạch đầu dòng / câu là một bước. */
export function splitSteps(text: string): string[] {
  const out: string[] = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.replace(BULLET, '').trim()
    if (!line) continue
    // Tách câu ở . ! ? ; theo sau là khoảng trắng hoặc hết dòng (không cắt số thập phân "1.5").
    for (const s of line.split(/(?<=[.!?;])\s+|[.!?;]+$/)) {
      const v = s.replace(/[.!?;:,\s]+$/, '').trim()
      if (v) out.push(v)
    }
  }
  return out
}

// ---------- Nhãn ----------

/** Bỏ ký tự làm hỏng cú pháp Mermaid; cắt ≤ 40 ký tự ở ranh giới từ. */
export function cleanLabel(s: string, max = LABEL_MAX): string {
  let v = s
    .replace(/"/g, "'")
    .replace(/[[{(]/g, '(')
    .replace(/[\]})]/g, ')')
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/[|`]/g, '/')
    .replace(/;/g, ',')
    .replace(/#/g, 'số ')
    .replace(/%/g, ' phần trăm')
    .replace(/-{2,}/g, '–')
    .replace(/\s+/g, ' ')
    .trim()
  v = v.replace(/^[,.:\s]+|[,.:\s]+$/g, '')
  if (v.length > max) {
    const cut = v.slice(0, max - 1)
    const sp = cut.lastIndexOf(' ')
    v = (sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[,.:\s]+$/, '') + '…'
  }
  if (!v) v = '…'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

// ---------- Nhận dạng câu ----------

interface Cond {
  cond: string
  action: string
}

const COND_THI = /^(?:nếu|khi|trong trường hợp|trường hợp)\s+(.+?)\s*,?\s+thì\s+(.+)$/i
const COND_COMMA = /^(?:nếu|trong trường hợp)\s+([^,]+),\s*(.+)$/i
const ELSE = /^(?:ngược lại|nếu không|còn không|trường hợp khác|nếu sai)\s*,?\s*(?:thì\s+)?(.+)$/i

function parseCond(s: string): Cond | null {
  const m = COND_THI.exec(s) ?? COND_COMMA.exec(s)
  return m ? { cond: m[1].trim(), action: m[2].trim() } : null
}
const parseElse = (s: string): string | null => ELSE.exec(s)?.[1].trim() ?? null

const MSG_VERBS = [
  'trả về',
  'trả lại',
  'phản hồi',
  'gửi',
  'gọi',
  'nhận',
  'thông báo',
  'chuyển tiếp',
  'yêu cầu',
  'xác nhận',
]
const MSG_RE = new RegExp(`^(.{2,40}?)\\s+(${MSG_VERBS.join('|')})\\s+(.+)$`, 'i')
const TARGET_RE = /\s+(?:cho|tới|đến|tới cho|về cho|sang)\s+(.+)$/i
const STATE_HINT = /trạng thái|chuyển sang/i

const fold = (s: string) => s.toLowerCase().normalize('NFC').trim()

/** BE tự chọn loại khi `kind` bỏ trống (§6b). */
export function detectDiagramKind(text: string): DiagramKind {
  if (STATE_HINT.test(text)) return 'state'
  const steps = splitSteps(text)
  const actors = new Set<string>()
  let msgs = 0
  for (const s of steps) {
    const body = parseCond(s)?.action ?? s
    const m = MSG_RE.exec(body)
    if (!m || m[1].split(/\s+/).length > 4) continue
    msgs++
    actors.add(fold(m[1]))
    const tg = TARGET_RE.exec(m[3])
    if (tg) actors.add(fold(tg[1]))
  }
  return msgs >= 2 && actors.size >= 2 ? 'sequence' : 'flowchart'
}

// ---------- Flowchart ----------

interface Tail {
  id: string
  label?: string
}

function buildFlowchart(steps: string[], notes: string[]): string {
  const lines: string[] = ['flowchart TD', '  S(["Bắt đầu"])']
  const edges: string[] = []
  let tails: Tail[] = [{ id: 'S' }]
  let n = 0
  let d = 0
  // Quyết định vừa gặp (chưa có nhánh "Không"): câu điều kiện liền sau nối vào nhánh "Không" của nó.
  let open: { id: string; cond: string; yes: Tail[] } | null = null
  const edge = (from: Tail, to: string) => edges.push(`  ${from.id} -->${from.label ? `|${from.label}|` : ''} ${to}`)
  const step = (label: string) => {
    const id = `N${++n}`
    lines.push(`  ${id}["${cleanLabel(label)}"]`)
    return id
  }
  const closeOpen = (withElse: boolean) => {
    if (!open) return
    if (!withElse) tails = [...open.yes, { id: open.id, label: 'Không' }]
    open = null
  }

  for (const s of steps) {
    const otherwise = open ? parseElse(s) : null
    if (open && otherwise) {
      const id = step(otherwise)
      edge({ id: open.id, label: 'Không' }, id)
      tails = [...open.yes, { id }]
      open = null
      continue
    }
    const c = parseCond(s)
    if (c) {
      const id = `D${++d}`
      lines.push(`  ${id}{"${cleanLabel(c.cond.replace(/\?+$/, '') + '?')}"}`)
      let yes: Tail[] = []
      if (open) {
        // "Nếu A thì X. Nếu B thì Y." → B nằm ở nhánh "Không" của A.
        edge({ id: open.id, label: 'Không' }, id)
        yes = open.yes
      } else tails.forEach((t) => edge(t, id))
      const act = step(c.action)
      edge({ id, label: 'Có' }, act)
      open = { id, cond: c.cond, yes: [...yes, { id: act }] }
      continue
    }
    closeOpen(false)
    const id = step(s)
    tails.forEach((t) => edge(t, id))
    tails = [{ id }]
  }
  if (open) {
    const o: { id: string; cond: string; yes: Tail[] } = open
    notes.push(`Chưa rõ xử lý khi không thoả: "${cleanLabel(o.cond)}".`)
    closeOpen(false)
  }
  lines.push('  E(["Kết thúc"])')
  tails.forEach((t) => edge(t, 'E'))
  return [...lines, ...edges].join('\n')
}

// ---------- Sequence ----------

function buildSequence(steps: string[], notes: string[]): string | null {
  const parts: { key: string; name: string; id: string }[] = []
  const part = (name: string) => {
    const key = fold(name)
    let p = parts.find((x) => x.key === key)
    if (!p) {
      p = { key, name: cleanLabel(name, 24), id: `P${parts.length + 1}` }
      parts.push(p)
    }
    return p.id
  }
  const known = () => parts.map((p) => p.key)
  // Lượt 1: ghi nhận tác nhân theo thứ tự xuất hiện.
  for (const s of steps) {
    const m = MSG_RE.exec(parseCond(s)?.action ?? s)
    if (m && m[1].split(/\s+/).length <= 4) part(m[1])
  }
  if (parts.length < 2) {
    // Có thể bên nhận chỉ xuất hiện sau "cho/tới".
    for (const s of steps) {
      const m = MSG_RE.exec(parseCond(s)?.action ?? s)
      const tg = m && TARGET_RE.exec(m[3])
      if (tg) part(tg[1].split(/\s+/).slice(0, 4).join(' '))
    }
  }
  if (parts.length < 2) return null

  const body: string[] = []
  let last: { from: string; to: string } | null = null
  const message = (s: string, indent: string): boolean => {
    const m = MSG_RE.exec(s)
    if (!m || m[1].split(/\s+/).length > 4) return false
    const from = part(m[1])
    const verb = m[2].toLowerCase()
    let rest = m[3]
    let to: string | null = null
    const tg = TARGET_RE.exec(rest)
    if (tg) {
      const tail = fold(tg[1])
      const hit = known().find((k) => tail.startsWith(k))
      to = hit ? parts.find((p) => p.key === hit)!.id : part(tg[1].split(/\s+/).slice(0, 4).join(' '))
      rest = rest.slice(0, tg.index)
    } else {
      const lower = fold(rest)
      const hit = parts.find((p) => p.id !== from && lower.includes(p.key))
      if (hit) to = hit.id
      else if (/trả về|trả lại|phản hồi/.test(verb) && last) to = last.from === from ? last.to : last.from
    }
    if (!to) {
      notes.push(`Chưa rõ bên nhận của: "${cleanLabel(s)}".`)
      to = from
    }
    const arrow = /trả về|trả lại|phản hồi/.test(verb) ? '-->>' : '->>'
    body.push(`${indent}${from}${arrow}${to}: ${cleanLabel(`${verb} ${rest}`)}`)
    last = { from, to }
    return true
  }
  const note = (s: string, indent: string) =>
    body.push(`${indent}Note over ${last?.from ?? parts[0].id}: ${cleanLabel(s)}`)

  let open: string | null = null
  const closeAlt = (warn: boolean) => {
    if (open === null) return
    if (warn) notes.push(`Chưa rõ xử lý khi không thoả: "${cleanLabel(open)}".`)
    body.push('  end')
    open = null
  }
  for (const s of steps) {
    const otherwise = open !== null ? parseElse(s) : null
    if (otherwise) {
      body.push('  else Ngược lại')
      if (!message(otherwise, '    ')) note(otherwise, '    ')
      closeAlt(false)
      continue
    }
    const c = parseCond(s)
    if (c) {
      closeAlt(true)
      body.push(`  alt ${cleanLabel(c.cond)}`)
      if (!message(c.action, '    ')) note(c.action, '    ')
      open = c.cond
      continue
    }
    closeAlt(true)
    if (!message(s, '  ')) note(s, '  ')
  }
  closeAlt(true)
  return ['sequenceDiagram', ...parts.map((p) => `  participant ${p.id} as ${p.name}`), ...body].join('\n')
}

// ---------- State ----------

const STATE_RE =
  /(?:chuyển sang|sang trạng thái|về trạng thái|trạng thái|thành)\s+(?:trạng thái\s+)?(["'“]?)([^,."'”]+?)\1(?=$|[,.]|\s+(?:khi|nếu|sau|và)\b)/i
const CODE_RE = /\b([A-Z][A-Z0-9_]{2,})\b/

function findState(s: string): string | null {
  const m = STATE_RE.exec(s)
  if (m) {
    const name = m[2].trim()
    const code = CODE_RE.exec(name)
    return code ? code[1] : name.split(/\s+/).slice(0, 4).join(' ')
  }
  return CODE_RE.exec(s)?.[1] ?? null
}

function buildState(steps: string[], notes: string[]): string | null {
  const states: { key: string; id: string; name: string }[] = []
  const st = (name: string) => {
    const key = fold(name)
    let x = states.find((v) => v.key === key)
    if (!x) {
      x = { key, id: `S${states.length + 1}`, name: cleanLabel(name, 30) }
      states.push(x)
    }
    return x.id
  }
  const trans: string[] = []
  const outgoing = new Set<string>()
  let current: string | null = null
  let lastTarget: string | null = null
  let prevCond = false
  let pending: string | null = null
  let branches: string[] = []

  for (const s of steps) {
    const c = parseCond(s)
    const target = findState(c ? c.action : s)
    if (!target) {
      if (c) notes.push(`Không thấy trạng thái đích trong: "${cleanLabel(s)}".`)
      else pending = s
      prevCond = false
      continue
    }
    const to = st(target)
    if (current === null && !c && !/chuyển|sang/i.test(s)) {
      // "Đơn ở trạng thái PENDING" → trạng thái đầu.
      current = to
      lastTarget = to
      continue
    }
    const from: string | null = c ? current : prevCond ? lastTarget : current
    const label = c ? c.cond : (pending ?? s.replace(STATE_RE, '').replace(CODE_RE, '').trim())
    if (from === null) {
      current = to
    } else if (from !== to) {
      trans.push(`  ${from} --> ${to}${label ? ` : ${cleanLabel(label)}` : ''}`)
      outgoing.add(from)
      if (c) branches.push(c.cond)
    }
    if (!c) {
      current = to
      branches = []
    }
    lastTarget = to
    prevCond = !!c
    pending = null
  }
  if (states.length < 2 || trans.length === 0) return null
  if (branches.length === 1) notes.push(`Chưa rõ trạng thái khi không thoả: "${cleanLabel(branches[0])}".`)
  const out = [
    'stateDiagram-v2',
    ...states.map((x) => `  state "${x.name}" as ${x.id}`),
    `  [*] --> ${states[0].id}`,
    ...trans,
  ]
  for (const x of states) if (!outgoing.has(x.id) && x.id !== states[0].id) out.push(`  ${x.id} --> [*]`)
  return out.join('\n')
}

// ---------- API ----------

export function generateDiagram(text: string, kind?: DiagramKind): DiagramResult {
  const notes: string[] = []
  let steps = splitSteps(text ?? '')
  if (steps.length > STEP_MAX) {
    notes.push(`Đoạn mô tả dài, chỉ vẽ ${STEP_MAX} bước đầu.`)
    steps = steps.slice(0, STEP_MAX)
  }
  if (steps.length === 0) notes.push('Chưa có nội dung để vẽ sơ đồ.')
  const want = kind ?? detectDiagramKind(text ?? '')
  // Ghi chú của lần thử sequence/state chỉ giữ khi lần thử đó thành công.
  const tryNotes: string[] = []
  if (want === 'sequence') {
    const m = buildSequence(steps, tryNotes)
    if (m) return { mermaid: m, kind: 'sequence', notes: [...notes, ...tryNotes] }
    notes.push('Không tìm thấy hai tác nhân trao đổi với nhau, đã vẽ lưu đồ.')
  } else if (want === 'state') {
    const m = buildState(steps, tryNotes)
    if (m) return { mermaid: m, kind: 'state', notes: [...notes, ...tryNotes] }
    notes.push('Không tìm thấy các trạng thái chuyển đổi, đã vẽ lưu đồ.')
  }
  return { mermaid: buildFlowchart(steps, notes), kind: 'flowchart', notes }
}
