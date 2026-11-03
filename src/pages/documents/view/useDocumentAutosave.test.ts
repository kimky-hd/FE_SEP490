import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/apiClient'
import type { SaveContentResult } from '@/types/document'
import { AUTOSAVE_MS, useDocumentAutosave } from './useDocumentAutosave'

const saveContent = vi.fn()
vi.mock('@/api/documentApi', () => ({ documentApi: { saveContent: (...args: unknown[]) => saveContent(...args) } }))

const DOC = { type: 'doc', content: [] }
const editor = { getJSON: () => DOC }

function result(rowVersion: number, reqCount = 0): SaveContentResult {
  return {
    version: { rowVersion },
    requirements: Array.from({ length: reqCount }, (_, i) => ({ requirementId: i })),
  } as unknown as SaveContentResult
}

function setup(overrides: Partial<Parameters<typeof useDocumentAutosave>[0]> = {}) {
  const callbacks = { onSaved: vi.fn(), onReqCountChange: vi.fn(), onConflict: vi.fn() }
  const hook = renderHook(() =>
    useDocumentAutosave({
      editor,
      documentId: 7,
      versionId: 70,
      initialRowVersion: 1,
      initialSubtitle: '',
      initialReqCount: 0,
      ...callbacks,
      ...overrides,
    }),
  )
  return { ...hook, ...callbacks }
}

const settle = () => act(async () => undefined)

beforeEach(() => {
  vi.useFakeTimers()
  saveContent.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useDocumentAutosave', () => {
  it('chỉ lưu sau AUTOSAVE_MS kể từ lần sửa cuối (debounce), gửi kèm rowVersion', async () => {
    saveContent.mockResolvedValue(result(2))
    const { result: r, onSaved } = setup()

    act(() => r.current.markDirty())
    expect(r.current.saveState).toBe('dirty')
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS - 100))
    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS - 100))
    expect(saveContent).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(100))
    await settle()
    expect(saveContent).toHaveBeenCalledTimes(1)
    expect(saveContent).toHaveBeenCalledWith(7, 70, { content: DOC, subtitle: '', rowVersion: 1 })
    expect(onSaved).toHaveBeenCalled()
    expect(r.current.saveState).toBe('saved')
  })

  it('lượt lưu sau dùng rowVersion mới mà BE trả về', async () => {
    saveContent.mockResolvedValueOnce(result(2)).mockResolvedValueOnce(result(3))
    const { result: r } = setup()

    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    await settle()
    act(() => r.current.setSubtitle('Mô tả'))
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    await settle()

    expect(saveContent).toHaveBeenLastCalledWith(7, 70, { content: DOC, subtitle: 'Mô tả', rowVersion: 2 })
  })

  it('không lưu chồng: sửa trong lúc đang lưu thì lưu thêm một lượt sau khi lượt trước xong', async () => {
    let finishFirst!: (v: SaveContentResult) => void
    saveContent
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValue(result(3))
    const { result: r } = setup()

    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    expect(r.current.saveState).toBe('saving')

    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    expect(saveContent).toHaveBeenCalledTimes(1)

    await act(async () => finishFirst(result(2)))
    expect(r.current.saveState).toBe('dirty')
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    await settle()
    expect(saveContent).toHaveBeenCalledTimes(2)
    expect(r.current.saveState).toBe('saved')
  })

  it('409 VERSION_CONFLICT: báo xung đột, giữ trạng thái lỗi và không tự thử lại', async () => {
    const current = { rowVersion: 9, updatedAt: '2026-10-30T07:05:00Z', updatedBy: { userId: 2, fullName: 'Trần Hà' } }
    saveContent.mockRejectedValue(new ApiError(409, { code: 'VERSION_CONFLICT', message: 'conflict', current }))
    const { result: r, onConflict } = setup()

    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    await settle()

    expect(onConflict).toHaveBeenCalledTimes(1)
    // D19: chuyển `current` của body lỗi cho hộp xung đột ("Trần Hà vừa lưu lúc …").
    expect(onConflict).toHaveBeenCalledWith(current)
    expect(r.current.saveState).toBe('error')
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS * 5))
    await settle()
    expect(saveContent).toHaveBeenCalledTimes(1)
  })

  it('số REQ đổi sau khi lưu thì báo để tải lại cây trang', async () => {
    saveContent.mockResolvedValueOnce(result(2, 1)).mockResolvedValueOnce(result(3, 1))
    const { result: r, onReqCountChange } = setup()

    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    await settle()
    expect(onReqCountChange).toHaveBeenCalledTimes(1)

    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    await settle()
    expect(onReqCountChange).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+S lưu ngay; flush() lưu nốt trước thao tác khác; không có thay đổi thì không gọi API', async () => {
    saveContent.mockResolvedValue(result(2))
    const { result: r } = setup()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    })
    expect(saveContent).not.toHaveBeenCalled()

    act(() => r.current.markDirty())
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    })
    await settle()
    expect(saveContent).toHaveBeenCalledTimes(1)

    act(() => r.current.markDirty())
    await act(() => r.current.flush())
    expect(saveContent).toHaveBeenCalledTimes(2)
  })

  it('rời trang (unmount) khi còn thay đổi thì lưu nốt; discard() thì bỏ', async () => {
    saveContent.mockResolvedValue(result(2))
    const first = setup()
    act(() => first.result.current.markDirty())
    first.unmount()
    await settle()
    expect(saveContent).toHaveBeenCalledTimes(1)

    const second = setup()
    act(() => second.result.current.markDirty())
    act(() => second.result.current.discard())
    second.unmount()
    await settle()
    expect(saveContent).toHaveBeenCalledTimes(1)
  })

  it('chưa có editor thì không lưu', async () => {
    const { result: r } = setup({ editor: null })
    act(() => r.current.markDirty())
    act(() => vi.advanceTimersByTime(AUTOSAVE_MS))
    await settle()
    expect(saveContent).not.toHaveBeenCalled()
  })
})
