import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { reqSections, type DocDiff } from '@/lib/docDiff'
import type { TipTapDoc } from '@/types/document'
import { docMarksKey } from '../editor/docMarks'

export function useLiveDiff(editor: Editor | null) {
  const [diff, setDiff] = useState<DocDiff | null>(null)
  const [sections, setSections] = useState<ReturnType<typeof reqSections>>([])
  const [reqKeys, setReqKeys] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!editor) return
    const read = () => {
      setDiff(docMarksKey.getState(editor.state)?.diff ?? null)
      const secs = reqSections(editor.getJSON() as TipTapDoc)
      setSections(secs)
      setReqKeys(new Map(secs.map((s) => [s.reqUid, s.key])))
    }
    read()
    editor.on('transaction', read)
    return () => {
      editor.off('transaction', read)
    }
  }, [editor])

  return { diff, sections, reqKeys }
}
