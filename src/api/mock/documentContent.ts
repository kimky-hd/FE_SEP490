// Logic thuần trên content TipTap (doc/Documents-API-Contract.md §3): trích REQ, vá reqUid, text thuần, hash.
// Dùng cho mock backend; BE phải làm y hệt các quy tắc này.

import type { AcceptanceCriterion, Priority, TipTapDoc, TipTapNode } from '@/types/document'

export const MAX_CONTENT_BYTES = 2 * 1024 * 1024

export interface ExtractedReq {
  reqUid: string
  reqKey: string
  title: string
  anchorId: string
  priority: Priority
  contentHash: string
  bodyPreview: string
  bodyLength: number
  acceptanceCriteria: AcceptanceCriterion[]
  hasTable: boolean
  hasDiagram: boolean
  hasFigma: boolean
}

export interface ExtractResult {
  /** Content đã vá: heading REQ thiếu reqUid / id được sinh mới. */
  content: TipTapDoc
  /** true nếu content bị vá (FE phải dùng bản trả về). */
  patched: boolean
  requirements: ExtractedReq[]
}

export function newUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export const newHeadingId = () => `h-${newUid().slice(0, 8)}`

/** Content hợp lệ: object `{type:'doc', content: []}` và không quá 2 MB. */
export function isValidContent(content: unknown): content is TipTapDoc {
  if (!content || typeof content !== 'object') return false
  const doc = content as TipTapNode
  if (doc.type !== 'doc') return false
  if (doc.content !== undefined && !Array.isArray(doc.content)) return false
  try {
    return new TextEncoder().encode(JSON.stringify(content)).length <= MAX_CONTENT_BYTES
  } catch {
    return false
  }
}

/** Text thuần của một node (gộp đệ quy, các khối cách nhau bằng xuống dòng). */
export function nodeText(node: TipTapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'figmaFrame') return String(node.attrs?.title ?? '')
  const children = node.content ?? []
  const inline = children.every((c) => c.type === 'text' || c.type === 'hardBreak')
  return children.map(nodeText).join(inline ? '' : '\n')
}

export function docText(doc: TipTapDoc): string {
  return (doc.content ?? []).map(nodeText).join('\n').trim()
}

function walk(node: TipTapNode, visit: (n: TipTapNode) => void) {
  visit(node)
  for (const child of node.content ?? []) walk(child, visit)
}

const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW']
const toPriority = (v: unknown): Priority => (PRIORITIES.includes(v as Priority) ? (v as Priority) : 'MEDIUM')

/**
 * Quy tắc §3:
 * 1. Mỗi `heading` cấp gốc có `attrs.req === true` là một REQ.
 * 2. Thân = các node sau heading tới heading kế tiếp có level <= level của nó (hoặc hết tài liệu).
 * 3. ReqKey = REQ-01, REQ-02… theo thứ tự xuất hiện.
 * 4. Thiếu reqUid → sinh mới và trả content đã vá. (FE cũng sinh `id` cho heading thiếu id để có anchor.)
 * 5. AcceptanceCriteria = mọi taskItem trong thân; HasTable/HasDiagram/HasFigma theo node trong thân.
 */
export function extractRequirements(input: TipTapDoc, uid: () => string = newUid): ExtractResult {
  let patched = false
  const seenUids = new Set<string>()
  const blocks = (input.content ?? []).map((node) => {
    if (node.type !== 'heading' || node.attrs?.req !== true) return node
    const attrs = { ...(node.attrs ?? {}) }
    let changed = false
    // Khối thường thiếu id thì để nguyên (§3, FE vá ở lần lưu sau). Riêng heading REQ cần id làm anchorId.
    if (!attrs.id) {
      attrs.id = `h-${uid().slice(0, 8)}`
      changed = true
    }
    // Trùng reqUid (copy-paste heading REQ) → REQ sau nhận uid mới để RTM không gộp nhầm.
    if (!attrs.reqUid || seenUids.has(String(attrs.reqUid))) {
      attrs.reqUid = uid()
      changed = true
    }
    seenUids.add(String(attrs.reqUid))
    if (!changed) return node
    patched = true
    return { ...node, attrs }
  })
  const content: TipTapDoc = { ...input, type: 'doc', content: blocks }

  const requirements: ExtractedReq[] = []
  blocks.forEach((node, index) => {
    if (node.type !== 'heading' || node.attrs?.req !== true) return
    const level = Number(node.attrs?.level ?? 1)
    const body: TipTapNode[] = []
    for (let j = index + 1; j < blocks.length; j++) {
      const next = blocks[j]
      if (next.type === 'heading' && Number(next.attrs?.level ?? 1) <= level) break
      body.push(next)
    }
    const criteria: AcceptanceCriterion[] = []
    let hasTable = false
    let hasDiagram = false
    let hasFigma = false
    for (const b of body) {
      walk(b, (n) => {
        if (n.type === 'taskItem') criteria.push({ text: nodeText(n).trim(), checked: n.attrs?.checked === true })
        if (n.type === 'table') hasTable = true
        if (n.type === 'codeBlock' && n.attrs?.language === 'mermaid') hasDiagram = true
        if (n.type === 'figmaFrame') hasFigma = true
      })
    }
    const title = nodeText(node).trim()
    const bodyText = body.map(nodeText).join('\n').trim()
    requirements.push({
      reqUid: String(node.attrs?.reqUid),
      reqKey: `REQ-${String(requirements.length + 1).padStart(2, '0')}`,
      title,
      anchorId: String(node.attrs?.id),
      priority: toPriority(node.attrs?.priority),
      contentHash: sha256(JSON.stringify([stripVolatile(node), body])),
      bodyPreview: bodyText.slice(0, 400),
      bodyLength: bodyText.length,
      acceptanceCriteria: criteria,
      hasTable,
      hasDiagram,
      hasFigma,
    })
  })
  return { content, patched, requirements }
}

// Priority đổi không làm REQ "khác nội dung" (không bị Stale chỉ vì đổi độ ưu tiên).
function stripVolatile(heading: TipTapNode): TipTapNode {
  const attrs = { ...(heading.attrs ?? {}) }
  delete attrs.priority
  return { ...heading, attrs }
}

/** Đổi `attrs.priority` của heading REQ có reqUid tương ứng (PATCH /requirements/{id}). */
export function setHeadingPriority(doc: TipTapDoc, reqUid: string, priority: Priority): TipTapDoc {
  return {
    ...doc,
    content: (doc.content ?? []).map((n) =>
      n.type === 'heading' && n.attrs?.reqUid === reqUid ? { ...n, attrs: { ...n.attrs, priority } } : n,
    ),
  }
}

// --- SHA-256 đồng bộ (đủ cho mock, không phụ thuộc crypto.subtle bất đồng bộ) ---

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
])

export function sha256(message: string): string {
  const bytes = new TextEncoder().encode(message)
  const bitLen = bytes.length * 8
  const total = Math.ceil((bytes.length + 9) / 64) * 64
  const buf = new Uint8Array(total)
  buf.set(bytes)
  buf[bytes.length] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(total - 4, bitLen >>> 0)
  view.setUint32(total - 8, Math.floor(bitLen / 2 ** 32))
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] += a
    h[1] += b
    h[2] += c
    h[3] += d
    h[4] += e
    h[5] += f
    h[6] += g
    h[7] += hh
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('')
}

// --- Tóm tắt REQ thay đổi giữa 2 phiên bản (note của activity SUBMITTED / APPROVED, §7.2b) ---

export interface ReqHashRef {
  reqUid: string
  reqKey: string
  contentHash: string
}

export interface ReqChangeSummary {
  modified: string[]
  added: string[]
  removed: string[]
}

/** So theo reqUid: khác hash → sửa; chỉ có ở bản sau → thêm; chỉ có ở bản trước → xoá (dùng key của bản trước). */
export function summarizeReqChanges(before: ReqHashRef[], after: ReqHashRef[]): ReqChangeSummary {
  const prev = new Map(before.map((r) => [r.reqUid, r]))
  const next = new Set(after.map((r) => r.reqUid))
  const modified: string[] = []
  const added: string[] = []
  for (const r of after) {
    const old = prev.get(r.reqUid)
    if (!old) added.push(r.reqKey)
    else if (old.contentHash !== r.contentHash) modified.push(r.reqKey)
  }
  const removed = before.filter((r) => !next.has(r.reqUid)).map((r) => r.reqKey)
  return { modified, added, removed }
}

/** "Sửa REQ-01, REQ-04; thêm REQ-05; xoá REQ-03" — null khi không có gì thay đổi. */
export function formatReqSummary(s: ReqChangeSummary): string | null {
  const parts: string[] = []
  if (s.modified.length) parts.push(`sửa ${s.modified.join(', ')}`)
  if (s.added.length) parts.push(`thêm ${s.added.join(', ')}`)
  if (s.removed.length) parts.push(`xoá ${s.removed.join(', ')}`)
  if (!parts.length) return null
  const text = parts.join('; ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
