import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import Heading from '@tiptap/extension-heading'
import CodeBlock from '@tiptap/extension-code-block'
import { newUid } from '@/api/mock/documentContent'
import { CalloutView, CodeBlockView, FigmaFrameView, createCodeBlockStorage } from './nodeViews'

// Các khối cấp cao nhất phải có `attrs.id` ổn định (doc/Documents-API-Contract.md §3 "Id khối").
export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'table',
  'callout',
  'codeBlock',
  'figmaFrame',
  'horizontalRule',
  'blockquote',
]

export const newBlockId = () => `b-${newUid().slice(0, 8)}`

const blockIdKey = new PluginKey('blockId')

/**
 * Thuộc tính `id` cho mọi loại khối + appendTransaction vá id thiếu / trùng (dán, tách đoạn) ở cấp cao nhất,
 * và reqUid trùng giữa các heading REQ (copy-paste).
 */
export const BlockId = Extension.create({
  name: 'blockId',
  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          id: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-id'),
            renderHTML: (attrs) => (attrs.id ? { 'data-id': attrs.id } : {}),
          },
        },
      },
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockIdKey,
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((t) => t.docChanged)) return null
          const seen = new Set<string>()
          const seenUids = new Set<string>()
          let tr = null as ReturnType<typeof state.tr.setNodeMarkup> | null
          state.doc.forEach((node, offset) => {
            if (!BLOCK_TYPES.includes(node.type.name)) return
            const attrs = { ...node.attrs }
            let changed = false
            if (!attrs.id || seen.has(attrs.id)) {
              attrs.id = newBlockId()
              changed = true
            }
            seen.add(attrs.id)
            if (node.type.name === 'heading' && attrs.req) {
              if (!attrs.reqUid || seenUids.has(attrs.reqUid)) {
                attrs.reqUid = newUid()
                changed = true
              }
              seenUids.add(attrs.reqUid)
            }
            if (changed) {
              tr = (tr ?? state.tr).setNodeMarkup(offset, undefined, attrs)
            }
          })
          if (tr) tr.setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})

/** Heading có thêm attr REQ (§3): req, reqUid, priority. */
export const ReqHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      req: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-req') === 'true',
        renderHTML: (attrs) => (attrs.req ? { 'data-req': 'true' } : {}),
      },
      reqUid: {
        default: null,
        keepOnSplit: false,
        parseHTML: (el) => el.getAttribute('data-req-uid'),
        renderHTML: (attrs) => (attrs.reqUid ? { 'data-req-uid': attrs.reqUid } : {}),
      },
      priority: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-priority'),
        renderHTML: (attrs) => (attrs.priority ? { 'data-priority': attrs.priority } : {}),
      },
    }
  },
}).configure({ levels: [1, 2, 3] })

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-tone') ?? 'info',
        renderHTML: (attrs) => ({ 'data-tone': attrs.tone }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})

export const FigmaFrame = Node.create({
  name: 'figmaFrame',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') ?? '',
        renderHTML: (a) => ({ 'data-url': a.url }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') ?? '',
        renderHTML: (a) => ({ 'data-title': a.title }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-figma]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-figma': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigmaFrameView)
  },
})

/** Code block; language "mermaid" hiện sơ đồ (§3). */
export const DocCodeBlock = CodeBlock.extend({
  // editor.storage.codeBlock.ai: DocEditor gắn hàm sinh sơ đồ cho nút "✦ Sinh từ nội dung" trong khối.
  addStorage() {
    return createCodeBlockStorage()
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})
