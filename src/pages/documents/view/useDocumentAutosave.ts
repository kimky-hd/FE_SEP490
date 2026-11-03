import { useCallback, useEffect, useRef, useState } from 'react'
import { documentApi } from '@/api/documentApi'
import { ApiError } from '@/lib/apiClient'
import type { VersionConflictCurrent } from '@/types/auth'
import type { SaveContentResult, TipTapDoc } from '@/types/document'
import { errorCode } from '../docUi'

export const AUTOSAVE_MS = 1200

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export interface AutosaveSource {
  getJSON: () => unknown
}

interface Options {
  editor: AutosaveSource | null
  documentId: number
  versionId: number
  initialRowVersion: number
  initialSubtitle: string
  initialReqCount: number
  onSaved: (res: SaveContentResult) => void
  onReqCountChange: () => void
  /** `current` = bản đang lưu trên máy chủ (D19), null nếu BE không gửi. */
  onConflict: (current: VersionConflictCurrent | null) => void
}

/**
 * Tự lưu nội dung trang: gõ xong AUTOSAVE_MS thì lưu, Ctrl/Cmd+S lưu ngay, rời trang khi còn thay đổi thì lưu nốt
 * và trình duyệt hỏi trước khi đóng tab. Không bao giờ chạy 2 lượt lưu chồng nhau; có thay đổi mới trong lúc đang
 * lưu thì lưu tiếp một lượt sau đó. Lưu lỗi thì giữ cờ "chưa lưu" và không tự thử lại (người dùng bấm "Thử lại").
 */
export function useDocumentAutosave({
  editor,
  documentId,
  versionId,
  initialRowVersion,
  initialSubtitle,
  initialReqCount,
  onSaved,
  onReqCountChange,
  onConflict,
}: Options) {
  const rowVersion = useRef(initialRowVersion)
  const subtitle = useRef(initialSubtitle)
  const lastReqCount = useRef(initialReqCount)
  const dirty = useRef(false)
  const saving = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const [saveState, setSaveState] = useState<SaveState>('saved')

  // Callback luôn là bản mới nhất mà không làm `save` đổi danh tính mỗi render.
  const callbacks = useRef({ onSaved, onReqCountChange, onConflict })
  callbacks.current = { onSaved, onReqCountChange, onConflict }

  const saveRef = useRef<() => Promise<void>>(async () => undefined)
  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void saveRef.current(), AUTOSAVE_MS)
  }, [])

  const save = useCallback(async () => {
    if (!editor || !dirty.current || saving.current) return
    clearTimeout(timer.current)
    saving.current = true
    dirty.current = false
    setSaveState('saving')
    let failed = false
    try {
      const res = await documentApi.saveContent(documentId, versionId, {
        content: editor.getJSON() as TipTapDoc,
        subtitle: subtitle.current,
        rowVersion: rowVersion.current,
      })
      rowVersion.current = res.version.rowVersion
      callbacks.current.onSaved(res)
      setSaveState(dirty.current ? 'dirty' : 'saved')
      if (res.requirements.length !== lastReqCount.current) {
        lastReqCount.current = res.requirements.length
        callbacks.current.onReqCountChange()
      }
    } catch (err) {
      dirty.current = true
      failed = true
      if (errorCode(err) === 'VERSION_CONFLICT')
        callbacks.current.onConflict(err instanceof ApiError ? (err.current ?? null) : null)
      setSaveState('error')
    } finally {
      saving.current = false
      if (dirty.current && !failed) schedule()
    }
  }, [editor, documentId, versionId, schedule])
  saveRef.current = save

  const markDirty = useCallback(() => {
    dirty.current = true
    setSaveState('dirty')
    schedule()
  }, [schedule])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty.current) void saveRef.current()
      }
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onBeforeUnload)
      clearTimeout(timer.current)
      // Rời trang khi còn thay đổi: lưu nốt (không chờ).
      if (dirty.current) void saveRef.current()
    }
  }, [])

  return {
    saveState,
    markDirty,
    save: useCallback(() => saveRef.current(), []),
    flush: useCallback(async () => {
      if (dirty.current) await saveRef.current()
    }, []),
    setSubtitle: useCallback(
      (value: string) => {
        subtitle.current = value
        markDirty()
      },
      [markDirty],
    ),
    discard: useCallback(() => {
      dirty.current = false
      clearTimeout(timer.current)
    }, []),
  }
}
