import { describe, expect, it, vi } from 'vitest'
import { invalidateData, onDataChanged, registerCache, withInvalidation } from './dataEvents'

describe('dataEvents', () => {
  it('xoá cache ngay và gộp nhiều lần báo thành một lần gọi listener', async () => {
    vi.useFakeTimers()
    const clear = vi.fn()
    const listener = vi.fn()
    registerCache(clear)
    const off = onDataChanged(listener)
    invalidateData()
    invalidateData()
    expect(clear).toHaveBeenCalledTimes(2)
    expect(listener).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    invalidateData()
    await vi.advanceTimersByTimeAsync(100)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('withInvalidation chỉ báo sau khi thao tác ghi thành công', async () => {
    vi.useFakeTimers()
    const listener = vi.fn()
    const off = onDataChanged(listener)
    const api = withInvalidation(
      {
        read: async () => 1,
        write: async () => 2,
        fail: async () => {
          throw new Error('x')
        },
      },
      ['write', 'fail'],
    )
    await api.read()
    await vi.advanceTimersByTimeAsync(100)
    expect(listener).not.toHaveBeenCalled()
    await expect(api.fail()).rejects.toThrow('x')
    await vi.advanceTimersByTimeAsync(100)
    expect(listener).not.toHaveBeenCalled()
    expect(await api.write()).toBe(2)
    await vi.advanceTimersByTimeAsync(100)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    vi.useRealTimers()
  })

  it('withInvalidation: thao tác "lặng" chỉ xoá cache, không bắt các màn tải lại', async () => {
    vi.useFakeTimers()
    const clear = vi.fn()
    const listener = vi.fn()
    registerCache(clear)
    const off = onDataChanged(listener)
    const api = withInvalidation({ save: async () => 'ok', submit: async () => 'ok' }, ['submit'], ['save'])
    await api.save()
    await vi.advanceTimersByTimeAsync(100)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(listener).not.toHaveBeenCalled()
    await api.submit()
    await vi.advanceTimersByTimeAsync(100)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    vi.useRealTimers()
  })
})
