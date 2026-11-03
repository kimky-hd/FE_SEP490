import { HELP_QA, findQA, type HelpQA } from './helpContent'

// Tìm câu trả lời trong kho hỏi đáp: bỏ dấu tiếng Việt (đ → d), tách từ, chấm điểm theo độ hiếm của từ (IDF),
// cho phép khớp tiền tố và gõ sai 1 ký tự với từ dài. Điểm 0..~1.2: tỉ lệ "trọng lượng" câu hỏi được khớp.

export function normalizeHelpText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Từ đệm của câu hỏi, không mang nghĩa tra cứu.
const STOPWORDS = new Set(
  (
    'lam sao the nao nhu cach gi la co khong duoc ko k toi minh em anh chi de va voi cua o nhe a ha vay mot nhung cac nay kia ' +
    'how does did i can to the a an is are what which why where when who of in on for my me it this that with be should'
  ).split(' '),
)

// Dấu hiệu "đây là câu hỏi" (đã bỏ dấu).
const QUESTION_HINTS =
  /(^|\s)(lam sao|lam the nao|the nao|nhu the nao|cach|la gi|o dau|vi sao|tai sao|ai duoc|khi nao|co the|how|what|why|where|who|when|can i|is there)(\s|$)/

export function tokenize(text: string): string[] {
  return normalizeHelpText(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
}

export function looksLikeQuestion(query: string): boolean {
  return query.trim().endsWith('?') || QUESTION_HINTS.test(normalizeHelpText(query))
}

interface IndexedEntry {
  entry: HelpQA
  tokens: Set<string>
  keywords: Set<string>
  phrases: string[]
}

let index: { entries: IndexedEntry[]; idf: Map<string, number>; maxIdf: number } | null = null

function buildIndex() {
  if (index) return index
  const entries: IndexedEntry[] = HELP_QA.map((entry) => {
    const texts = [entry.q.vi, entry.q.en, entry.title.vi, entry.title.en, ...entry.variants]
    const tokens = new Set(texts.flatMap(tokenize))
    const keywords = new Set((entry.keywords ?? []).flatMap(tokenize))
    keywords.forEach((k) => tokens.add(k))
    return { entry, tokens, keywords, phrases: texts.map((t) => tokenize(t).join(' ')) }
  })
  const df = new Map<string, number>()
  for (const e of entries) e.tokens.forEach((t) => df.set(t, (df.get(t) ?? 0) + 1))
  const n = entries.length
  const idf = new Map<string, number>()
  df.forEach((count, token) => idf.set(token, Math.log(1 + n / count)))
  index = { entries, idf, maxIdf: Math.log(1 + n) }
  return index
}

/** Khoảng cách sửa ≤ 1 (thêm / bớt / thay 1 ký tự hoặc đảo 2 ký tự liền nhau). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    const diff: number[] = []
    for (let i = 0; i < a.length && diff.length < 3; i++) if (a[i] !== b[i]) diff.push(i)
    if (diff.length === 1) return true
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  while (i < s.length && s[i] === l[i]) i++
  return s.slice(i) === l.slice(i + 1)
}

/** Mức khớp của một từ trong câu hỏi với một mục: 1 trùng, 0.8 tiền tố, 0.6 gõ sai nhẹ. */
function tokenMatch(token: string, e: IndexedEntry): number {
  if (e.tokens.has(token)) return e.keywords.has(token) ? 1.2 : 1
  let best = 0
  for (const t of e.tokens) {
    if (token.length >= 3 && t.length > token.length && t.startsWith(token)) best = Math.max(best, 0.8)
    else if (token.length >= 4 && t.length >= 4 && withinOneEdit(token, t)) best = Math.max(best, 0.6)
    if (best >= 0.8) break
  }
  return best
}

export interface HelpMatch {
  entry: HelpQA
  score: number
}

export function searchHelp(query: string, limit = 5): HelpMatch[] {
  const qTokens = [...new Set(tokenize(query))]
  if (qTokens.length === 0) return []
  const { entries, idf, maxIdf } = buildIndex()
  const weight = (t: string) => idf.get(t) ?? maxIdf
  const total = qTokens.reduce((s, t) => s + weight(t), 0)
  const joined = qTokens.join(' ')
  const out: HelpMatch[] = []
  for (const e of entries) {
    let hit = 0
    let matched = 0
    for (const t of qTokens) {
      const m = tokenMatch(t, e)
      if (m > 0) matched++
      hit += m * weight(t)
    }
    if (matched === 0) continue
    let score = hit / total
    // Cả cụm câu hỏi nằm nguyên trong một cách hỏi đã biết → cộng điểm.
    if (qTokens.length > 1 && e.phrases.some((p) => ` ${p} `.includes(` ${joined} `))) score += 0.2
    out.push({ entry: e.entry, score })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Ngưỡng hiện câu trả lời: câu có dáng câu hỏi được dễ hơn câu tìm kiếm thường (vd tên tài liệu). */
export const HELP_THRESHOLD_QUESTION = 0.45
export const HELP_THRESHOLD_PLAIN = 0.75

export interface HelpAnswer {
  best: HelpQA
  score: number
  related: HelpQA[]
}

/** Câu trả lời tốt nhất + tối đa 2 câu liên quan, hoặc null nếu không đủ chắc. */
export function answerQuestion(query: string): HelpAnswer | null {
  const matches = searchHelp(query, 3)
  const top = matches[0]
  if (!top) return null
  const threshold = looksLikeQuestion(query) ? HELP_THRESHOLD_QUESTION : HELP_THRESHOLD_PLAIN
  if (top.score < threshold) return null
  const related: HelpQA[] = []
  for (const id of top.entry.related ?? []) {
    const qa = findQA(id)
    if (qa) related.push(qa)
  }
  for (const m of matches.slice(1))
    if (m.score >= HELP_THRESHOLD_QUESTION && !related.includes(m.entry)) related.push(m.entry)
  return { best: top.entry, score: top.score, related: related.filter((r) => r !== top.entry).slice(0, 2) }
}
