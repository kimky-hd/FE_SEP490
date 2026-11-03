import { useEffect, useState } from 'react'
import type { useSearchParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'
import { changeElements, flash } from './editorDom'

interface Options {
  editor: Editor | null
  versionId: number
  latestId: number
  cmpId: number | undefined
  compareByDefault: boolean
  setParams: ReturnType<typeof useSearchParams>[1]
}

export function useVersionCompare({ editor, versionId, latestId, cmpId, compareByDefault, setParams }: Options) {
  const isLatest = versionId === latestId
  const [compare, setCompare] = useState(() => cmpId !== undefined || compareByDefault)
  // Chọn "So sánh" trên cùng phiên bản đang mở chỉ đổi ?cmp= (không remount) → bật chế độ so sánh tại đây.
  useEffect(() => {
    if (cmpId !== undefined) setCompare(true)
  }, [cmpId])

  const openVersion = (id: number, cmp?: number) => {
    const p: Record<string, string> = {}
    if (id !== latestId) p.v = String(id)
    if (cmp) p.cmp = String(cmp)
    setParams(p)
  }
  const compareVersions = (a: number, b: number) => {
    const [older, newer] = a < b ? [a, b] : [b, a]
    if (older === newer) return
    openVersion(newer, older)
  }
  const toggleCompare = () => {
    if (compare && cmpId) {
      const p = new URLSearchParams()
      if (!isLatest) p.set('v', String(versionId))
      setParams(p)
    }
    setCompare((v) => !v)
  }

  const [changeIndex, setChangeIndex] = useState(-1)
  const jump = (dir: 1 | -1) => {
    const els = changeElements(editor)
    if (!els.length) return
    const next = changeIndex < 0 ? (dir === 1 ? 0 : els.length - 1) : (changeIndex + dir + els.length) % els.length
    setChangeIndex(next)
    els[next].scrollIntoView({ behavior: 'smooth', block: 'center' })
    flash(els[next])
  }

  return { compare, setCompare, openVersion, compareVersions, toggleCompare, changeIndex, jump }
}
