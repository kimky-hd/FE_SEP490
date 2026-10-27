import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

interface AsyncState<T> {
  data: T | undefined
  error: unknown
  isLoading: boolean
  /** Gọi lại (sau khi tạo / sửa / xoá) — giữ data cũ trong lúc tải để màn hình không nháy. */
  reload: () => Promise<void>
  setData: (updater: (prev: T | undefined) => T | undefined) => void
}

// Hook tải dữ liệu tối giản (app chưa dùng thư viện query). Bỏ qua kết quả của request cũ khi deps đổi
// hoặc component đã unmount, tránh ghi đè dữ liệu mới bằng response về muộn.
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setDataState] = useState<T>()
  const [error, setError] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(true)
  const requestId = useRef(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setIsLoading(true)
    try {
      const result = await run()
      if (id === requestId.current) {
        setDataState(result)
        setError(null)
      }
    } catch (err) {
      if (id === requestId.current) setError(err)
    } finally {
      if (id === requestId.current) setIsLoading(false)
    }
  }, [run])

  useEffect(() => {
    void load()
    return () => {
      requestId.current++
    }
  }, [load])

  const setData = useCallback((updater: (prev: T | undefined) => T | undefined) => setDataState(updater), [])

  return { data, error, isLoading, reload: load, setData }
}
