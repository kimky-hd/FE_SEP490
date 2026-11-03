import { describe, expect, it } from 'vitest'
import { sanitizeHtml, sanitizeSvg } from './sanitize'

describe('sanitize (F7)', () => {
  it('sanitizeHtml gỡ onerror / script nhưng giữ nội dung tài liệu', () => {
    const out = sanitizeHtml(
      '<p data-id="b1">Xin <strong>chào</strong></p><img src=x onerror=alert(1)><script>alert(2)</script>',
    )
    expect(out).not.toMatch(/onerror/i)
    expect(out).not.toMatch(/<script/i)
    expect(out).toContain('<strong>chào</strong>')
    expect(out).toContain('data-id="b1"')
  })

  it('sanitizeHtml gỡ javascript: URL trong link', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toMatch(/javascript:/i)
  })

  it('sanitizeSvg gỡ handler/script nhưng giữ nhãn HTML trong foreignObject của mermaid', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><style>.node{fill:#fff}</style>' +
      '<g class="node"><rect width="10" height="10"/><foreignObject width="80" height="20">' +
      '<div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Thanh toán</span><img src=x onerror=alert(4)><script>alert(5)</script></div></foreignObject></g>' +
      '<script>alert(2)</script><image href="x" onerror="alert(3)"/></svg>'
    const out = sanitizeSvg(svg)
    expect(out).not.toMatch(/onload|onerror|<script/i)
    expect(out).toMatch(/<foreignObject/i)
    expect(out).toContain('Thanh toán')
    expect(out).toContain('<style>')
  })
})
