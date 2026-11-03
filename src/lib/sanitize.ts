import DOMPurify from 'dompurify'

// Lớp phòng thủ bổ sung trước mọi dangerouslySetInnerHTML. Nguồn HTML/SVG vốn đã qua schema TipTap và
// mermaid securityLevel 'strict', nhưng nếu một thư viện hoặc dữ liệu từ BE có lỗi thì DOMPurify vẫn gỡ
// script, on*-handler, javascript: URL… trước khi chèn vào trang.

/**
 * Sơ đồ mermaid: SVG + filter, và cả HTML (nhãn flowchart nằm trong <foreignObject> dạng div/span —
 * thiếu thì sơ đồ mất chữ).
 */
const SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject'],
  // Cho phép phần tử HTML làm con của <foreignObject> (mermaid tự cấu hình DOMPurify giống vậy).
  HTML_INTEGRATION_POINTS: { foreignobject: true },
}

/** Nội dung tài liệu (bản in): HTML từ editor, có thể chứa SVG mermaid đã vẽ bên trong. */
const DOC_CONFIG = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_TAGS: ['foreignObject'],
  HTML_INTEGRATION_POINTS: { foreignobject: true },
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, SVG_CONFIG)
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, DOC_CONFIG)
}
