import type { TestStep } from '@/types/testing'

// Bước test: hợp đồng giữ dạng mảng { action, expected } (#48/#50), bảng testcase hiển thị / sửa như Excel — hai ô chữ
// "Các bước" và "Kết quả mong đợi", mỗi bước một dòng đánh số "1. …". Dòng không đánh số nối vào bước trước đó
// (xuống dòng trong một bước). Chiều đi về giữ nguyên nội dung (trừ khoảng trắng thừa và số thứ tự).

const NUMBERED = /^\s*(\d+)[.)]\s?(.*)$/

/** Tách ô chữ thành danh sách bước theo số thứ tự đầu dòng. Chữ trước dòng số đầu tiên là bước 1. */
export function splitNumbered(text: string | null | undefined): string[] {
  const out: string[] = []
  for (const raw of (text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const m = NUMBERED.exec(raw)
    if (m) out.push(m[2].trim())
    else if (out.length === 0) {
      if (raw.trim()) out.push(raw.trim())
    } else if (raw.trim())
      out[out.length - 1] = out[out.length - 1] ? `${out[out.length - 1]}\n${raw.trim()}` : raw.trim()
  }
  return out
}

/** Ghép danh sách thành ô chữ "1. …\n2. …"; ô trống ở giữa giữ "—" để không lệch số với cột kia. */
export function joinNumbered(lines: string[]): string {
  return lines.map((l, i) => `${i + 1}. ${l.trim() || '—'}`).join('\n')
}

const blank = (s: string) => s.trim() === '' || s.trim() === '—' || s.trim() === '-'

/** Hai ô chữ → bước gửi API. Bước có cả hai phần trống thì bỏ. */
export function textToSteps(stepsText: string | null | undefined, expectedText: string | null | undefined): TestStep[] {
  const actions = splitNumbered(stepsText)
  const expected = splitNumbered(expectedText)
  const n = Math.max(actions.length, expected.length)
  const out: TestStep[] = []
  for (let i = 0; i < n; i++) {
    const action = blank(actions[i] ?? '') ? '' : (actions[i] ?? '').trim()
    const exp = blank(expected[i] ?? '') ? '' : (expected[i] ?? '').trim()
    if (action || exp) out.push({ action, expected: exp })
  }
  return out
}

/** Bước API → hai ô chữ để hiển thị. */
export function stepsToText(steps: TestStep[]): { steps: string; expected: string } {
  if (!steps.length) return { steps: '', expected: '' }
  return {
    steps: joinNumbered(steps.map((s) => s.action)),
    expected: joinNumbered(steps.map((s) => s.expected)),
  }
}
