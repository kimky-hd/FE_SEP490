// Sinh mã (slug) từ tên tiếng Việt — cùng quy tắc với BE (doc/Workspace-RBAC-API-Contract.md §4.3):
// bỏ dấu, chữ thường, mọi cụm ký tự không phải [a-z0-9] thành 1 dấu '-', tối đa 50 ký tự.

const MAX_SLUG_LENGTH = 50

function stripVietnamese(input: string) {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

export function slugify(input: string) {
  return stripVietnamese(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')
}

// Mã role: UPPER_SNAKE, bắt đầu bằng chữ cái (contract §3.3).
export function toRoleCode(input: string) {
  const code = stripVietnamese(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  return /^[A-Z]/.test(code) ? code : code ? `R_${code}`.slice(0, 50) : ''
}

export const WORKSPACE_CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/

// Project Key (doc/Workspace-RBAC-API-Contract.md §10.4): 2–10 ký tự HOA/số, bắt đầu bằng chữ — tiền tố Issue ID.
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

/**
 * Gợi ý key từ tên dự án (Figma frame 02 badge "AUTO"): ưu tiên từ viết HOA sẵn có trong tên ("… SSAM" → SSAM),
 * không có thì lấy chữ cái đầu mỗi từ ("Thanh toán QR" → TTQR).
 */
export function toProjectKey(name: string) {
  const words = stripVietnamese(name).split(/[^A-Za-z0-9]+/).filter(Boolean)
  const acronym = words.find((w) => /^[A-Z][A-Z0-9]{1,9}$/.test(w) && w.length >= 2)
  if (acronym) return acronym
  let key = words.map((w) => w[0]).join('').toUpperCase().replace(/^[0-9]+/, '')
  if (key.length < 2) key = (words[0] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^[0-9]+/, '')
  return key.slice(0, 10)
}
