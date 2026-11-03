// Báo "dữ liệu vừa đổi" cho toàn app. App chưa dùng thư viện query nên mỗi màn tự tải bằng useAsync và vài
// module giữ cache ngắn (dự án gần đây, quyền dự án, việc của tôi). Sau mỗi thao tác ghi thành công (POST/PUT/
// PATCH/DELETE qua apiClient, hoặc thao tác ghi của mock tài liệu) ta xoá các cache đó và báo cho mọi màn đang
// mở tự tải lại — tránh cảnh tạo dự án xong mà sidebar / Tổng quan / danh sách vẫn hiện dữ liệu cũ.

type Listener = () => void

const cacheClearers = new Set<() => void>()
const listeners = new Set<Listener>()
let pending: ReturnType<typeof setTimeout> | null = null

/** Module có cache gọi hàm này một lần để được xoá cache khi dữ liệu đổi. */
export function registerCache(clear: () => void) {
  cacheClearers.add(clear)
}

/** Lắng nghe "dữ liệu đã đổi". Trả về hàm huỷ đăng ký. */
export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Chỉ xoá cache trong bộ nhớ, không báo các màn tải lại — dùng khi đăng xuất (không còn token để tải). */
export function clearCachedData() {
  cacheClearers.forEach((clear) => clear())
}

/**
 * Xoá mọi cache ngay, rồi gộp các lần báo trong ~60ms thành một lần để nhiều thao tác liên tiếp
 * (vd tạo dự án + thêm thành viên) chỉ làm các màn tải lại một lần.
 */
export function invalidateData() {
  clearCachedData()
  if (pending) return
  pending = setTimeout(() => {
    pending = null
    listeners.forEach((listener) => listener())
  }, 60)
}

/** Bọc một API object: `mutations` chạy xong thì báo dữ liệu đổi; `quietMutations` chỉ xoá cache. */
export function withInvalidation<T extends object>(
  api: T,
  mutations: readonly (keyof T)[],
  quietMutations: readonly (keyof T)[] = [],
): T {
  const wrapped = { ...api }
  const wrap = (key: keyof T, after: () => void) => {
    const fn = api[key]
    if (typeof fn !== 'function') return
    ;(wrapped as Record<keyof T, unknown>)[key] = (...args: unknown[]) => {
      const result = (fn as (...a: unknown[]) => unknown).apply(api, args)
      if (result instanceof Promise) {
        return result.then((value) => {
          after()
          return value
        })
      }
      after()
      return result
    }
  }
  for (const key of mutations) wrap(key, invalidateData)
  for (const key of quietMutations) wrap(key, clearCachedData)
  return wrapped
}
