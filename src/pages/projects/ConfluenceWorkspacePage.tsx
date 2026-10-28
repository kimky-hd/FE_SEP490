import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  convertItemsToBlocks,
  documentApi,
  extractRequirementsFromBlocks,
} from '@/api/documentApi'
import { issueApi } from '@/api/issueApi'
import { projectApi } from '@/api/projectApi'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/lib/useAsync'
import type { IssuePriority, IssueType } from '@/types/issue'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { Avatar } from '@/components/ui/Avatar'
import { DiagramViewer } from '@/components/documents/DiagramViewer'
import { HistoryDiffModal } from '@/components/documents/HistoryDiffModal'
import { AiSpecificationModal } from '@/pages/projects/AiSpecificationModal'
import { formatDate } from '@/lib/format'
import type { ProjectDto } from '@/types/project'
import type {
  CalloutTone,
  ConfluenceBlock,
  ConfluenceBlockType,
  DiagramType,
  DocumentComment,
  ItemPriority,
  RequirementHistoryLog,
  RequirementItem,
  SpecificationDocument,
} from '@/types/document'

/** Ô nhập văn bản tự động co giãn chiều cao theo nội dung (Confluence Free-form Block Textarea) */
function AutoResizeTextarea({
  value,
  onChange,
  onKeyDown,
  disabled,
  placeholder,
  className,
}: {
  value: string
  onChange: (val: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${Math.max(ref.current.scrollHeight, 32)}px`
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={1}
      className={clsx(
        'w-full resize-none overflow-hidden bg-transparent outline-none transition-colors',
        disabled ? 'cursor-default' : 'focus:bg-slate-50/70 rounded px-1 -mx-1',
        className,
      )}
    />
  )
}

const SLASH_COMMANDS: {
  cmd: string
  label: string
  desc: string
  icon: string
  type: ConfluenceBlockType
  makeReq?: boolean
}[] = [
  {
    cmd: '/req',
    label: 'Heading Yêu cầu [REQ-xx]',
    desc: 'Tạo tiêu đề Heading tự động gắn mã REQ và đồng bộ vào RTM',
    icon: '🏷️',
    type: 'h2',
    makeReq: true,
  },
  {
    cmd: '/h1',
    label: 'Heading 1 (Tiêu đề chương lớn)',
    desc: 'Tiêu đề phân mục cấp 1',
    icon: 'H1',
    type: 'h1',
  },
  {
    cmd: '/h2',
    label: 'Heading 2 (Tiêu đề mục)',
    desc: 'Tiêu đề phân mục cấp 2',
    icon: 'H2',
    type: 'h2',
  },
  {
    cmd: '/h3',
    label: 'Heading 3 (Tiêu đề nhánh)',
    desc: 'Tiêu đề phân mục cấp 3',
    icon: 'H3',
    type: 'h3',
  },
  {
    cmd: '/table',
    label: 'Bảng đặc tả tự do (Table)',
    desc: 'Kẻ bảng dữ liệu, bảng Use Case, bảng quy tắc nghiệp vụ',
    icon: '📊',
    type: 'table',
  },
  {
    cmd: '/callout',
    label: 'Hộp Ghi chú / Quy tắc (Confluence Panel)',
    desc: 'Khung Info, Warning, Business Rule nổi bật',
    icon: '💡',
    type: 'callout',
  },
  {
    cmd: '/diagram',
    label: 'Sơ đồ Luồng (Mermaid / PlantUML)',
    desc: 'Chèn sơ đồ Flowchart / Sequence trực quan ngay trong bài viết',
    icon: '📐',
    type: 'diagram',
  },
  {
    cmd: '/figma',
    label: 'Khung Thiết kế Figma (Figma Embed)',
    desc: 'Nhúng preview màn hình UI Figma vào tài liệu',
    icon: '🎨',
    type: 'figma',
  },
  {
    cmd: '/check',
    label: 'Danh sách Nghiệm thu (Checklist)',
    desc: 'Các tiêu chí nghiệm thu Given-When-Then có ô đánh dấu',
    icon: '☑️',
    type: 'checklist',
  },
  {
    cmd: '/bullet',
    label: 'Danh sách chấm tròn (Bullet List)',
    desc: 'Liệt kê các ý gạch đầu dòng',
    icon: '•',
    type: 'bullet_list',
  },
]

export function ConfluenceWorkspacePage() {
  const { projectId: projectIdParam, docId: docIdParam } = useParams<{ projectId?: string; docId?: string }>()
  const navigate = useNavigate()
  const { user, currentCompany } = useAuth()

  const activeProjectId = projectIdParam ? Number(projectIdParam) : 20

  // Danh sách dự án (để chuyển đổi Space nhanh) & thông tin dự án hiện tại
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [currentProject, setCurrentProject] = useState<ProjectDto | null>(null)

  // Cây trang tài liệu của dự án & trang đang mở
  const [allPages, setAllPages] = useState<SpecificationDocument[]>([])
  const [currentPage, setCurrentPage] = useState<SpecificationDocument | null>(null)
  const [blocks, setBlocks] = useState<ConfluenceBlock[]>([])
  const [savedItems, setSavedItems] = useState<RequirementItem[]>([])
  const [history, setHistory] = useState<RequirementHistoryLog[]>([])
  const [comments, setComments] = useState<DocumentComment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Trạng thái chỉnh sửa trên mặt giấy
  const [pageTitle, setPageTitle] = useState('')
  const [pageDescription, setPageDescription] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Trạng thái đóng/mở Sidebar trái & Cây thư mục
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [expandedPageIds, setExpandedPageIds] = useState<Record<number, boolean>>({
    100: true,
    200: true,
    102: true,
  })
  const [treeSearch, setTreeSearch] = useState('')
  const [treeMenuOpenId, setTreeMenuOpenId] = useState<number | null>(null)

  // Ngăn trượt bên phải (Slide-over Drawer - MẶC ĐỊNH ĐÓNG để mặt giấy rộng rãi)
  const [drawerTab, setDrawerTab] = useState<'req' | 'history' | 'comments' | null>(null)
  const [focusedReqId, setFocusedReqId] = useState<string | null>(null)

  // Modal tạo trang mới trên cây Confluence
  const [showCreatePageModal, setShowCreatePageModal] = useState(false)
  const [createParentId, setCreateParentId] = useState<number | null>(null)
  const [newPageTitle, setNewPageTitle] = useState('')
  const [newPageDocType, setNewPageDocType] = useState<'SRS' | 'URD' | 'BRD'>('SRS')
  const [newPageTemplate, setNewPageTemplate] = useState<'BLANK' | 'SRS' | 'URD' | 'MEETING_NOTES'>('SRS')
  const [newPageIsFolder, setNewPageIsFolder] = useState(false)

  // Modal đổi tên trang
  const [renamingPage, setRenamingPage] = useState<SpecificationDocument | null>(null)
  const [renameText, setRenameText] = useState('')

  // Modal sửa Sơ đồ Mermaid
  const [editingDiagramBlock, setEditingDiagramBlock] = useState<ConfluenceBlock | null>(null)
  const [tempDiagramTitle, setTempDiagramTitle] = useState('')
  const [tempDiagramCode, setTempDiagramCode] = useState('')
  const [tempDiagramType, setTempDiagramType] = useState<DiagramType>('MERMAID_PLANTUML')

  // Modal AI Sinh nội dung từ Raw Notes
  const [showAiModal, setShowAiModal] = useState(false)

  // Modal Xem đối chiếu Diff Trước / Sau
  const [diffLog, setDiffLog] = useState<RequirementHistoryLog | null>(null)

  // Modal Xuất / Xem in
  const [showPrintModal, setShowPrintModal] = useState(false)

  // Modal Từ chối phê duyệt (Reject)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Input thêm bình luận & thêm Test Case trong Drawer
  const [newCommentText, setNewCommentText] = useState('')
  const [commentTargetReqId, setCommentTargetReqId] = useState<string>('')
  const [addingTcForReqId, setAddingTcForReqId] = useState<string | null>(null)
  const [newTcCode, setNewTcCode] = useState('')

  // Tải danh sách Jira Issues của dự án để hiển thị và liên kết 2 chiều
  const issuesAsync = useAsync(() => issueApi.getIssues(activeProjectId), [activeProjectId])
  const projectIssues = issuesAsync.data ?? []

  // Modal Tạo Jira Issue trực tiếp từ Confluence REQ
  const [creatingJiraForReq, setCreatingJiraForReq] = useState<{
    docId: number
    reqId: string
    reqKey: string
    reqTitle: string
  } | null>(null)
  const [jiraIssueType, setJiraIssueType] = useState<IssueType>('TASK')
  const [jiraIssueSummary, setJiraIssueSummary] = useState('')
  const [jiraIssueDesc, setJiraIssueDesc] = useState('')
  const [jiraIssuePriority, setJiraIssuePriority] = useState<IssuePriority>('HIGH')
  const [jiraStoryPoints, setJiraStoryPoints] = useState<number>(5)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4200)
  }

  // Nạp danh sách dự án
  useEffect(() => {
    projectApi
      .listMine(currentCompany?.companyId ?? null)
      .then((list) => {
        setProjects(list)
        const found = list.find((p) => p.projectId === activeProjectId)
        if (found) setCurrentProject(found)
      })
      .catch(() => {})
    projectApi
      .get(activeProjectId)
      .then((p) => setCurrentProject(p))
      .catch(() => {})
  }, [activeProjectId, currentCompany])

  // Nạp cây tài liệu & trang đang chọn
  const loadWorkspace = async (preferredDocId?: number) => {
    setIsLoading(true)
    try {
      const pages = await documentApi.list(activeProjectId)
      setAllPages(pages)

      // Xác định trang cần mở
      let targetId = preferredDocId ?? (docIdParam ? Number(docIdParam) : undefined)
      if (!targetId || !pages.some((p) => p.id === targetId)) {
        // Ưu tiên mở trang SRS-02 (102) hoặc trang không phải thư mục đầu tiên
        const firstRealPage = pages.find((p) => p.id === 102) || pages.find((p) => !p.isFolder) || pages[0]
        targetId = firstRealPage?.id
      }

      if (targetId) {
        const detail = await documentApi.get(targetId)
        setCurrentPage(detail.document)
        setPageTitle(detail.document.title)
        setPageDescription(detail.document.description || '')
        setBlocks(detail.document.blocks || [])
        setSavedItems(detail.items)
        setHistory(detail.history)
        setComments(detail.comments)
        setIsDirty(false)
        if (detail.items.length > 0 && !commentTargetReqId) {
          setCommentTargetReqId(detail.items[0].id)
        }
      }
    } catch (err) {
      console.error('Lỗi tải Confluence Workspace:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspace(docIdParam ? Number(docIdParam) : undefined)
  }, [activeProjectId, docIdParam])

  const isSafeMode = currentPage?.status === 'APPROVED'

  // ============================================================================
  // REAL-TIME PARSER: Tự động bóc tách Requirement Items từ các Heading trên mặt giấy
  // ============================================================================
  const liveExtractedItems = useMemo(() => {
    if (!currentPage) return []
    return extractRequirementsFromBlocks(currentPage.id, blocks, savedItems)
  }, [currentPage, blocks, savedItems])

  // Danh sách toàn bộ các Heading (H1, H2, H3) để hiển thị trên Live Outline ở nửa dưới Sidebar trái
  const liveHeadings = useMemo(() => {
    return blocks.filter((b) => b.type === 'h1' || b.type === 'h2' || b.type === 'h3')
  }, [blocks])

  // Đường dẫn Breadcrumb của nhánh trang đang mở trên cây Confluence
  const pageBreadcrumb = useMemo(() => {
    if (!currentPage) return []
    const trail: SpecificationDocument[] = [currentPage]
    let currParentId = currentPage.parentPageId
    let guard = 0
    while (currParentId && guard < 10) {
      guard++
      const parent = allPages.find((p) => p.id === currParentId)
      if (parent) {
        trail.unshift(parent)
        currParentId = parent.parentPageId
      } else {
        break
      }
    }
    return trail
  }, [currentPage, allPages])

  // Các phiên bản cùng mã tài liệu (để chuyển đổi v1.0 / v1.1)
  const siblingVersions = useMemo(() => {
    if (!currentPage) return []
    const list = allPages.filter(
      (d) =>
        d.code === currentPage.code ||
        d.id === currentPage.id ||
        d.parentDocId === currentPage.id ||
        currentPage.parentDocId === d.id,
    )
    return list.length > 0 ? list : [currentPage]
  }, [currentPage, allPages])

  // Chuyển sang trang khác trên cây
  const handleSelectPage = (pageId: number) => {
    if (isDirty) {
      const ok = window.confirm('Trang hiện tại có thay đổi chưa lưu. Bạn có muốn chuyển trang không?')
      if (!ok) return
    }
    navigate(`/projects/${activeProjectId}/documents/${pageId}`)
  }

  // Lưu toàn bộ nội dung trang Confluence & chạy Parser đồng bộ xuống Database
  const handleSavePage = async () => {
    if (!currentPage || isSafeMode) return
    setIsSaving(true)
    try {
      const author = user?.fullName || 'Sarah Lin'
      const result = await documentApi.saveConfluencePage(
        currentPage.id,
        {
          title: pageTitle.trim() || currentPage.title,
          description: pageDescription.trim() || null,
        },
        blocks,
        author,
      )
      setCurrentPage(result.document)
      setSavedItems(result.items)
      setIsDirty(false)

      // Cập nhật lại cây và lịch sử
      const [pages, detail] = await Promise.all([
        documentApi.list(activeProjectId),
        documentApi.get(currentPage.id),
      ])
      setAllPages(pages)
      setHistory(detail.history)
      setComments(detail.comments)

      if (result.changedKeys.length > 0) {
        for (const k of result.changedKeys) {
          await issueApi.markRequirementStale(currentPage.id, k, 'UNCONFIRMED_STALE')
        }
        issuesAsync.reload()
        showToast(
          `Đã lưu trang & bóc tách ${result.items.length} mục REQ! Các mục [${result.changedKeys.join(', ')}] vừa thay đổi đã bật cờ Unconfirmed Stale cho Jira Tasks/Bugs liên quan.`,
        )
      } else {
        showToast(`Đã lưu trang tài liệu và đồng bộ ${result.items.length} mục REQ vào CSDL!`)
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi lưu trang tài liệu')
    } finally {
      setIsSaving(false)
    }
  }

  // Phím tắt Ctrl+S / Cmd+S để lưu nhanh
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!isSafeMode && currentPage) {
          handleSavePage()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // ============================================================================
  // CÁC THAO TÁC TRÊN KHỐI SOẠN THẢO (CONFLUENCE BLOCK OPERATIONS)
  // ============================================================================
  const updateBlock = (blockId: string, patch: Partial<ConfluenceBlock>) => {
    if (isSafeMode) return
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)))
    setIsDirty(true)
  }

  const insertBlockAfter = (afterBlockId: string | null, newBlock: ConfluenceBlock) => {
    if (isSafeMode) return
    setBlocks((prev) => {
      if (!afterBlockId) return [...prev, newBlock]
      const idx = prev.findIndex((b) => b.id === afterBlockId)
      if (idx < 0) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setSelectedBlockId(newBlock.id)
    setIsDirty(true)
  }

  const deleteBlock = (blockId: string) => {
    if (isSafeMode) return
    if (blocks.length <= 1) return
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    setIsDirty(true)
  }

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    if (isSafeMode) return
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId)
      if (idx < 0) return prev
      const targetIdx = idx + direction
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      const next = [...prev]
      const [removed] = next.splice(idx, 1)
      next.splice(targetIdx, 0, removed)
      return next
    })
    setIsDirty(true)
  }

  // Cấp mã REQ-xx mới cho một dòng Heading (hoặc gỡ nhãn REQ)
  const toggleHeadingReq = (block: ConfluenceBlock) => {
    if (isSafeMode) return
    if (block.isReq) {
      updateBlock(block.id, { isReq: false })
      showToast(`Đã chuyển "${block.text}" về Heading thông thường (không đưa vào RTM).`)
    } else {
      // Tìm số thứ tự REQ tiếp theo chưa dùng
      const usedNums = blocks
        .filter((b) => b.isReq && b.reqKeyCode)
        .map((b) => {
          const m = b.reqKeyCode?.match(/REQ-(\d+)/)
          return m ? Number(m[1]) : 0
        })
      const nextNum = (usedNums.length > 0 ? Math.max(...usedNums) : 0) + 1
      const nextCode = `REQ-${String(nextNum).padStart(2, '0')}`
      const reqId = block.reqId || `item-${currentPage?.id || 'doc'}-${Date.now()}`

      updateBlock(block.id, {
        isReq: true,
        reqId,
        reqKeyCode: nextCode,
        reqPriority: block.reqPriority || 'HIGH',
      })
      showToast(`Đã gắn nhãn [${nextCode}] cho Heading! Toàn bộ nội dung bên dưới Heading này sẽ được bóc tách vào RTM.`)
    }
  }

  // Tự động nhận diện & gắn mã REQ-xx cho mọi Heading (H2, H3) trong bài viết
  const handleAutoTagAllHeadings = () => {
    if (isSafeMode) return
    let counter = 0
    const nextBlocks = blocks.map((b) => {
      if (b.type === 'h2' || b.type === 'h3') {
        counter++
        const code = b.reqKeyCode || `REQ-${String(counter).padStart(2, '0')}`
        const reqId = b.reqId || `item-${currentPage?.id || 'doc'}-${b.id}`
        return {
          ...b,
          isReq: true,
          reqId,
          reqKeyCode: code,
          reqPriority: b.reqPriority || ('HIGH' as ItemPriority),
        }
      }
      return b
    })
    setBlocks(nextBlocks)
    setIsDirty(true)
    showToast(`Đã tự động gắn nhãn REQ cho ${counter} phân đoạn Heading trong tài liệu!`)
  }

  // Công cụ trên thanh Toolbar: Chèn nhanh khối mới sau khối đang chọn
  const handleToolbarInsertBlock = (type: ConfluenceBlockType, makeReq = false) => {
    if (isSafeMode) return
    const ts = Date.now()
    const baseId = `blk-${ts}`
    let newBlock: ConfluenceBlock = { id: baseId, type: 'paragraph', text: '' }

    if (type === 'h1' || type === 'h2' || type === 'h3') {
      const usedCount = blocks.filter((b) => b.isReq).length + 1
      newBlock = {
        id: baseId,
        type,
        text: makeReq ? `${usedCount}. Tiêu đề Yêu cầu Chức năng Mới` : 'Tiêu đề Phân mục Mới',
        isReq: makeReq,
        reqId: makeReq ? `item-${currentPage?.id || 'doc'}-${ts}` : undefined,
        reqKeyCode: makeReq ? `REQ-${String(usedCount).padStart(2, '0')}` : undefined,
        reqPriority: 'HIGH',
      }
    } else if (type === 'table') {
      newBlock = {
        id: baseId,
        type: 'table',
        tableHeaders: ['Trường dữ liệu / Bước', 'Mô tả chi tiết', 'Ràng buộc / Quy tắc nghiệp vụ'],
        tableRows: [
          ['Giá trị 1', 'Mô tả hành vi xử lý của hệ thống...', 'Bắt buộc (Required)'],
          ['Giá trị 2', 'Kiểm tra điều kiện biên và phản hồi...', 'Theo chuẩn nghiệp vụ'],
        ],
      }
    } else if (type === 'callout') {
      newBlock = {
        id: baseId,
        type: 'callout',
        calloutTone: 'info',
        calloutTitle: 'Ghi chú / Quy tắc Nghiệp vụ Quan trọng',
        text: 'Nhập nội dung lưu ý, quy tắc nghiệp vụ hoặc điều kiện ngoại lệ tại đây...',
      }
    } else if (type === 'diagram') {
      newBlock = {
        id: baseId,
        type: 'diagram',
        diagramType: 'MERMAID_PLANTUML',
        diagramTitle: 'Sơ đồ Luồng Xử lý Nghiệp vụ',
        diagramSourceCode: `flowchart TD\n  A[Bắt đầu] --> B[Xác thực Yêu cầu]\n  B --> C{Đạt điều kiện?}\n  C -->|Hợp lệ| D[Xử lý & Lưu CSDL]\n  C -->|Không hợp lệ| E[Trả thông báo lỗi]`,
      }
    } else if (type === 'figma') {
      newBlock = {
        id: baseId,
        type: 'figma',
        figmaFrameName: 'Screen / Màn hình Giao diện Người dùng',
        figmaUrl: 'https://www.figma.com/file/ssam-ui-design',
      }
    } else if (type === 'checklist') {
      newBlock = {
        id: baseId,
        type: 'checklist',
        checklistItems: [
          { id: `chk-${ts}-1`, text: 'Given người dùng ở màn hình chức năng...', checked: true },
          { id: `chk-${ts}-2`, text: 'When thực hiện thao tác và bấm xác nhận...', checked: false },
        ],
      }
    } else if (type === 'bullet_list' || type === 'numbered_list') {
      newBlock = {
        id: baseId,
        type,
        listItems: ['Ý thứ nhất...', 'Ý thứ hai...'],
      }
    } else if (type === 'divider') {
      newBlock = { id: baseId, type: 'divider' }
    }

    insertBlockAfter(selectedBlockId, newBlock)
    setSlashMenuBlockId(null)
  }

  // Xử lý gõ phím trong khối văn bản: Hỗ trợ Markdown (#, ##, ###), Slash Menu (/) và Enter tách dòng
  const handleBlockTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, block: ConfluenceBlock) => {
    if (isSafeMode) return
    const val = block.text || ''

    // Nếu nhấn Enter (không giữ Shift) ở khối Heading -> Tạo khối Paragraph mới ngay bên dưới
    if (e.key === 'Enter' && !e.shiftKey && (block.type === 'h1' || block.type === 'h2' || block.type === 'h3')) {
      e.preventDefault()
      insertBlockAfter(block.id, {
        id: `blk-${Date.now()}`,
        type: 'paragraph',
        text: '',
      })
      return
    }

    // Nếu gõ phím Space sau #, ##, ### ở đầu dòng -> Tự động chuyển thành Heading 1, 2, 3
    if (e.key === ' ' && block.type === 'paragraph') {
      if (val === '#') {
        e.preventDefault()
        updateBlock(block.id, { type: 'h1', text: '' })
      } else if (val === '##') {
        e.preventDefault()
        const nextNum = blocks.filter((b) => b.isReq).length + 1
        updateBlock(block.id, {
          type: 'h2',
          text: '',
          isReq: true,
          reqId: `item-${currentPage?.id || 'doc'}-${Date.now()}`,
          reqKeyCode: `REQ-${String(nextNum).padStart(2, '0')}`,
          reqPriority: 'HIGH',
        })
      } else if (val === '###') {
        e.preventDefault()
        updateBlock(block.id, { type: 'h3', text: '' })
      }
    }
  }

  const handleBlockTextChange = (block: ConfluenceBlock, newText: string) => {
    updateBlock(block.id, { text: newText })
    if (newText.trim().startsWith('/')) {
      setSlashMenuBlockId(block.id)
    } else if (slashMenuBlockId === block.id) {
      setSlashMenuBlockId(null)
    }
  }

  // Thực thi lệnh từ Slash Menu (/)
  const executeSlashCommand = (block: ConfluenceBlock, item: (typeof SLASH_COMMANDS)[number]) => {
    const cleanText = (block.text || '').replace(/^\/\w*\s*/, '')
    if (item.type === 'h1' || item.type === 'h2' || item.type === 'h3') {
      const nextNum = blocks.filter((b) => b.isReq).length + 1
      updateBlock(block.id, {
        type: item.type,
        text: cleanText || (item.makeReq ? `${nextNum}. Tiêu đề Yêu cầu Mới` : 'Tiêu đề phân mục'),
        isReq: !!item.makeReq,
        reqId: item.makeReq ? `item-${currentPage?.id || 'doc'}-${Date.now()}` : undefined,
        reqKeyCode: item.makeReq ? `REQ-${String(nextNum).padStart(2, '0')}` : undefined,
        reqPriority: 'HIGH',
      })
      setSlashMenuBlockId(null)
    } else {
      // Thay thế block hiện tại bằng block chuyên biệt
      const prevId = block.id
      setSelectedBlockId(prevId)
      handleToolbarInsertBlock(item.type, item.makeReq)
      setBlocks((prev) => prev.filter((b) => b.id !== prevId))
      setSlashMenuBlockId(null)
    }
  }

  // ============================================================================
  // CÁC THAO TÁC QUẢN LÝ CÂY TRANG TÀI LIỆU & WORKFLOW PHÊ DUYỆT
  // ============================================================================
  const handleOpenCreateModal = (parentId: number | null, isFolder = false) => {
    setCreateParentId(parentId)
    setNewPageIsFolder(isFolder)
    setNewPageTitle('')
    setNewPageTemplate(isFolder ? 'BLANK' : 'SRS')
    setShowCreatePageModal(true)
  }

  const handleCreateNewPage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPageTitle.trim()) return
    try {
      const created = await documentApi.createConfluencePage({
        projectId: activeProjectId,
        parentPageId: createParentId,
        title: newPageTitle.trim(),
        docType: newPageDocType,
        template: newPageTemplate,
        isFolder: newPageIsFolder,
        createdBy: user?.fullName || 'Sarah Lin',
      })
      if (createParentId) {
        setExpandedPageIds((prev) => ({ ...prev, [createParentId]: true }))
      }
      setShowCreatePageModal(false)
      showToast(`Đã tạo trang "${created.title}" trên cây Confluence!`)
      navigate(`/projects/${activeProjectId}/documents/${created.id}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi tạo trang mới')
    }
  }

  const handleConfirmRenamePage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renamingPage || !renameText.trim()) return
    try {
      await documentApi.update(renamingPage.id, { title: renameText.trim() })
      setRenamingPage(null)
      await loadWorkspace(currentPage?.id)
      showToast('Đã đổi tên trang tài liệu!')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi đổi tên trang')
    }
  }

  const handleDuplicatePage = async (pageId: number) => {
    try {
      const copy = await documentApi.duplicatePage(pageId, user?.fullName || 'Sarah Lin')
      setTreeMenuOpenId(null)
      showToast(`Đã nhân bản trang "${copy.title}"!`)
      navigate(`/projects/${activeProjectId}/documents/${copy.id}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi nhân bản trang')
    }
  }

  const handleDeletePage = async (page: SpecificationDocument) => {
    const ok = window.confirm(`Bạn có chắc muốn xóa trang "${page.title}" khỏi cây tài liệu?`)
    if (!ok) return
    try {
      await documentApi.deletePage(page.id)
      setTreeMenuOpenId(null)
      showToast(`Đã xóa trang "${page.title}".`)
      await loadWorkspace()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi xóa trang')
    }
  }

  // Quy trình duyệt: Submit -> Approve Baseline (Safe Mode) / Reject
  const handleSubmitForReview = async () => {
    if (!currentPage) return
    if (isDirty) await handleSavePage()
    await documentApi.update(currentPage.id, { status: 'IN_REVIEW' })
    showToast('Đã gửi trang tài liệu sang trạng thái Chờ duyệt (IN_REVIEW)!')
    await loadWorkspace(currentPage.id)
  }

  const handleApproveBaseline = async () => {
    if (!currentPage) return
    if (isDirty) await handleSavePage()
    const ok = window.confirm(
      `Phê duyệt trang [${currentPage.code}] làm Baseline chính thức?\n• Trang sẽ được khóa ở Chế độ Đọc An toàn (Safe Mode - GB-01).\n• Mọi mục REQ đang là Unconfirmed Stale sẽ chuyển sang Confirmed Stale để QA cập nhật Test Case.`,
    )
    if (!ok) return
    await documentApi.approve(currentPage.id, user?.fullName || 'Sarah Lin')
    // Cập nhật các Jira Task/Bug liên quan sang CONFIRMED_STALE
    for (const item of savedItems) {
      if (item.syncStatus !== 'FRESH') {
        await issueApi.markRequirementStale(currentPage.id, item.keyCode, 'CONFIRMED_STALE')
      }
    }
    issuesAsync.reload()
    showToast('Đã phê duyệt Baseline thành công! Trang đã kích hoạt khóa Safe Mode và đồng bộ cờ Confirmed Stale sang Jira.')
    await loadWorkspace(currentPage.id)
  }

  const handleConfirmReject = async () => {
    if (!currentPage) return
    await documentApi.rejectOrReturn(currentPage.id, rejectReason || 'Yêu cầu bổ sung chi tiết đặc tả')
    setShowRejectModal(false)
    setRejectReason('')
    showToast('Đã hoàn tác tài liệu về trạng thái Bản nháp (DRAFT) và khôi phục các Test Case về Fresh.')
    await loadWorkspace(currentPage.id)
  }

  const handleCreateRevision = async () => {
    if (!currentPage) return
    const ok = window.confirm(
      `Tạo phiên bản sửa đổi mới từ bản ${currentPage.version}?\nHệ thống sẽ sao chép toàn bộ nội dung trang sang bản nháp mới để bạn chỉnh sửa.`,
    )
    if (!ok) return
    const newRev = await documentApi.createRevision(currentPage.id)
    showToast(`Đã khởi tạo phiên bản mới ${newRev.version} (Draft)!`)
    navigate(`/projects/${activeProjectId}/documents/${newRev.id}`)
  }

  // Nhập các mục yêu cầu từ Modal AI vào thẳng mặt giấy Confluence
  const handleImportAiItems = async (aiItems: Partial<RequirementItem>[]) => {
    if (!currentPage) return
    const generatedBlocks = convertItemsToBlocks(aiItems)
    const nextBlocks = [...blocks, ...generatedBlocks]
    setBlocks(nextBlocks)
    setShowAiModal(false)
    setIsDirty(true)
    showToast(`AI đã chèn ${aiItems.length} phân đoạn Heading [REQ-xx] kèm nội dung và sơ đồ vào trang! Bấm Lưu để đồng bộ CSDL.`)
  }

  // Đổi nhanh mức độ ưu tiên hoặc đồng bộ Fresh cho 1 mục REQ trong Drawer
  const handleQuickChangePriority = async (reqItem: RequirementItem, priority: ItemPriority) => {
    // Cập nhật trên block Heading
    setBlocks((prev) =>
      prev.map((b) =>
        b.reqId === reqItem.id || b.reqKeyCode === reqItem.keyCode ? { ...b, reqPriority: priority } : b,
      ),
    )
    if (currentPage) {
      await documentApi.updateRequirementMeta(currentPage.id, reqItem.id, { priority }).catch(() => {})
      const detail = await documentApi.get(currentPage.id)
      setSavedItems(detail.items)
    }
  }

  const handleSyncReqToFresh = async (reqItem: RequirementItem) => {
    if (!currentPage) return
    await documentApi.syncArtifactsToFresh(currentPage.id, reqItem.id)
    const detail = await documentApi.get(currentPage.id)
    setSavedItems(detail.items)
    showToast(`Đã đồng bộ Test Case của mục [${reqItem.keyCode}] về trạng thái Tươi mới (Fresh)!`)
  }

  const handleAddTestCaseToReq = async (reqItem: RequirementItem) => {
    if (!currentPage || !newTcCode.trim()) return
    const updatedList = [...reqItem.linkedTestCases, newTcCode.trim().toUpperCase()]
    await documentApi.updateRequirementMeta(currentPage.id, reqItem.id, { linkedTestCases: updatedList })
    setNewTcCode('')
    setAddingTcForReqId(null)
    const detail = await documentApi.get(currentPage.id)
    setSavedItems(detail.items)
    showToast(`Đã gắn Test Case ${newTcCode.trim().toUpperCase()} vào ${reqItem.keyCode}!`)
  }

  // Gửi bình luận mới
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPage || !newCommentText.trim()) return
    const targetReq = commentTargetReqId || liveExtractedItems[0]?.id || 'general'
    await documentApi.addComment(currentPage.id, {
      documentId: currentPage.id,
      requirementItemId: targetReq,
      authorName: user?.fullName || 'Sarah Lin',
      authorRole: 'Business Analyst / Reviewer',
      body: newCommentText.trim(),
      content: newCommentText.trim(),
    })
    setNewCommentText('')
    const detail = await documentApi.get(currentPage.id)
    setComments(detail.comments)
  }

  const handleResolveComment = async (commentId: string) => {
    if (!currentPage) return
    await documentApi.resolveComment(currentPage.id, commentId)
    const detail = await documentApi.get(currentPage.id)
    setComments(detail.comments)
  }

  // Render đệ quy cây thư mục trang Confluence bên cột trái
  const renderPageTreeNodes = (parentId: number | null, depth = 0) => {
    const children = allPages.filter((p) => {
      if (treeSearch.trim()) {
        return p.title.toLowerCase().includes(treeSearch.toLowerCase()) || p.code.toLowerCase().includes(treeSearch.toLowerCase())
      }
      return (p.parentPageId ?? null) === parentId
    })

    return children.map((node) => {
      const hasSubPages = allPages.some((p) => p.parentPageId === node.id)
      const isExpanded = expandedPageIds[node.id] ?? true
      const isActive = currentPage?.id === node.id

      return (
        <div key={node.id} className="select-none">
          <div
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className={clsx(
              'group relative flex items-center justify-between gap-1 rounded-md py-1.5 pr-2 text-xs transition-colors cursor-pointer',
              isActive
                ? 'bg-emerald-50 text-emerald-900 font-semibold'
                : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-950',
            )}
            onClick={() => handleSelectPage(node.id)}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {hasSubPages ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedPageIds((prev) => ({ ...prev, [node.id]: !isExpanded }))
                  }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="w-4 shrink-0 text-center text-[10px] text-slate-300">•</span>
              )}

              <span className="shrink-0 text-sm">{node.icon || (node.isFolder ? '📂' : '📄')}</span>
              <span className="truncate" title={node.title}>
                {node.title}
              </span>
            </div>

            {/* Trạng thái & Nút hover (+) và (•••) giống hệt Confluence */}
            <div className="flex items-center gap-1 shrink-0">
              {node.status === 'APPROVED' && !node.isFolder && (
                <span title="Đã phê duyệt Baseline (Safe Mode)" className="text-[10px] group-hover:hidden">
                  🔒
                </span>
              )}
              {node.status === 'IN_REVIEW' && !node.isFolder && (
                <span
                  title="Đang chờ rà soát"
                  className="h-1.5 w-1.5 rounded-full bg-blue-500 group-hover:hidden"
                />
              )}

              {/* Hover actions: [+] tạo trang con & [•••] menu */}
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  type="button"
                  title="Tạo trang con (nhánh mới) bên dưới trang này"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenCreateModal(node.id, false)
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 font-bold text-xs"
                >
                  +
                </button>
                <button
                  type="button"
                  title="Tác vụ trang (Đổi tên, Nhân bản, Xóa)"
                  onClick={(e) => {
                    e.stopPropagation()
                    setTreeMenuOpenId(treeMenuOpenId === node.id ? null : node.id)
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 font-bold text-[10px]"
                >
                  •••
                </button>
              </div>
            </div>

            {/* Context menu khi bấm ••• */}
            {treeMenuOpenId === node.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-2 top-8 z-50 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl text-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTreeMenuOpenId(null)
                    handleOpenCreateModal(node.id, false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                >
                  <span>➕</span>
                  <span>Thêm trang con</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTreeMenuOpenId(null)
                    setRenamingPage(node)
                    setRenameText(node.title)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                >
                  <span>✏️</span>
                  <span>Đổi tên trang</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicatePage(node.id)}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                >
                  <span>📋</span>
                  <span>Nhân bản trang</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => handleDeletePage(node)}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50"
                >
                  <span>🗑️</span>
                  <span>Xóa trang này</span>
                </button>
              </div>
            )}
          </div>

          {/* Render nhánh con nếu đang mở */}
          {!treeSearch.trim() && hasSubPages && isExpanded && renderPageTreeNodes(node.id, depth + 1)}
        </div>
      )
    })
  }

  const staleReqCount = liveExtractedItems.filter((i) => i.syncStatus !== 'FRESH').length

  return (
    <div className="fixed inset-0 z-40 flex h-screen w-screen flex-col bg-slate-100 text-slate-900 overflow-hidden select-text">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-2xl border border-slate-700">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
            ✓
          </span>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* A. THANH TOP BAR KIỂU CONFLUENCE (Cao 52px, cố định trên cùng)            */}
      {/* ========================================================================= */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4 shadow-2xs z-30">
        {/* Góc trái: Toggle Sidebar + Quay lại Dự án + Space Switcher + Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setLeftSidebarOpen((v) => !v)}
            title={leftSidebarOpen ? 'Thu gọn thanh cây thư mục trái' : 'Mở thanh cây thư mục trái'}
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-md border text-xs transition-colors',
              leftSidebarOpen
                ? 'border-slate-200 bg-slate-100 text-slate-800'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
            )}
          >
            ◧
          </button>

          <Link
            to={`/projects/${activeProjectId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors shrink-0"
          >
            <span>←</span>
            <span>Dự án {currentProject?.name || `CORE`}</span>
          </Link>

          <span className="text-slate-300 hidden sm:inline">|</span>

          {/* Bộ chọn Confluence Space (Đổi nhanh dự án) */}
          <div className="hidden md:flex items-center gap-1.5 rounded-md bg-emerald-50/80 border border-emerald-200 px-2 py-1 text-xs">
            <span className="text-emerald-700 font-bold">📘 Confluence Space:</span>
            <select
              value={activeProjectId}
              onChange={(e) => navigate(`/projects/${e.target.value}/documents`)}
              className="bg-transparent font-mono font-bold text-emerald-900 focus:outline-none cursor-pointer"
            >
              {projects.length > 0 ? (
                projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    [{p.key}] {p.name}
                  </option>
                ))
              ) : (
                <option value={activeProjectId}>[{currentProject?.key || 'CORE'}]</option>
              )}
            </select>
          </div>

          {/* Đường dẫn Breadcrumb của nhánh trang đang mở */}
          <nav className="hidden xl:flex items-center gap-1 text-xs text-slate-500 truncate max-w-md">
            {pageBreadcrumb.map((crumb, idx) => (
              <span key={crumb.id} className="flex items-center gap-1 truncate">
                <span className="text-slate-300">/</span>
                <button
                  type="button"
                  onClick={() => handleSelectPage(crumb.id)}
                  className={clsx(
                    'truncate hover:underline',
                    idx === pageBreadcrumb.length - 1 ? 'font-semibold text-slate-800' : 'text-slate-500',
                  )}
                >
                  {crumb.title}
                </button>
              </span>
            ))}
          </nav>
        </div>

        {/* Góc phải: Trạng thái lưu, Chọn Version, AI, 3 Nút Slide-over Drawer & Nút Duyệt */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Trạng thái lưu & Nút Lưu vào CSDL */}
          {!isSafeMode && (
            <button
              type="button"
              onClick={handleSavePage}
              disabled={isSaving}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
                isDirty
                  ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 animate-pulse'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
              )}
            >
              <span>{isDirty ? '💾 Lưu thay đổi (Ctrl+S)' : '✓ Đã lưu vào CSDL'}</span>
              <span className="rounded bg-black/10 px-1.5 py-0.2 font-mono text-[10px]">
                {liveExtractedItems.length} REQ
              </span>
            </button>
          )}

          {/* Bộ chọn Phiên bản (Version Switcher) */}
          {currentPage && (
            <select
              value={currentPage.id}
              onChange={(e) => handleSelectPage(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
            >
              {siblingVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version} ({v.status === 'APPROVED' ? 'Approved 🔒' : v.status === 'IN_REVIEW' ? 'In Review' : 'Draft'})
                </option>
              ))}
            </select>
          )}

          {/* Nút AI Sinh nội dung / Bóc tách từ Raw Notes */}
          {!isSafeMode && (
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <span>✨ AI Bóc tách Raw Notes</span>
            </button>
          )}

          <span className="text-slate-200">|</span>

          {/* 3 Nút bật Ngăn trượt (Slide-over Drawer) bên phải */}
          <button
            type="button"
            onClick={() => setDrawerTab(drawerTab === 'req' ? null : 'req')}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
              drawerTab === 'req'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span># REQ & RTM ({liveExtractedItems.length})</span>
            {staleReqCount > 0 && (
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" title="Có mục Stale cần rà soát" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setDrawerTab(drawerTab === 'history' ? null : 'history')}
            className={clsx(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
              drawerTab === 'history'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span>🕒 Lịch sử & Diff ({history.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerTab(drawerTab === 'comments' ? null : 'comments')}
            className={clsx(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
              drawerTab === 'comments'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span>💬 Bình luận ({comments.filter((c) => !c.isResolved).length})</span>
          </button>

          <span className="text-slate-200">|</span>

          {/* Nút Hành động Workflow chính theo trạng thái */}
          {currentPage?.status === 'DRAFT' && (
            <Button variant="primary" inline onClick={handleSubmitForReview} className="h-8! px-3! text-xs font-semibold">
              Gửi duyệt (Submit)
            </Button>
          )}

          {currentPage?.status === 'IN_REVIEW' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                ↺ Yêu cầu sửa lại
              </button>
              <button
                type="button"
                onClick={handleApproveBaseline}
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
              >
                ✓ Phê duyệt Baseline
              </button>
            </div>
          )}

          {currentPage?.status === 'APPROVED' && (
            <button
              type="button"
              onClick={handleCreateRevision}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              + Tạo phiên bản sửa đổi mới
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* THÂN WORKSPACE: CỘT TRÁI (280px) + MẶT GIẤY GIỮA + SLIDE-OVER DRAWER PHẢI */}
      {/* ========================================================================= */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ======================================================================= */}
        {/* B. CỘT TRÁI: CONFLUENCE PAGE TREE & LIVE HEADING OUTLINE (Rộng 280px)   */}
        {/* ======================================================================= */}
        {leftSidebarOpen && (
          <aside className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/90 select-none z-20">
            {/* PHẦN 1: CÂY THƯ MỤC & TRANG TÀI LIỆU ĐA CẤP (60% chiều cao trên) */}
            <div className="flex flex-1 flex-col min-h-0 border-b border-slate-200">
              <div className="p-3 space-y-2 border-b border-slate-200/70 bg-white">
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(null, false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 px-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                >
                  <span>+ Tạo trang tài liệu mới</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={treeSearch}
                      onChange={(e) => setTreeSearch(e.target.value)}
                      placeholder="Tìm trang trong cây..."
                      className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pl-7 pr-2 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                    <span className="absolute left-2 top-1.5 text-[11px] text-slate-400">🔍</span>
                  </div>
                  <button
                    type="button"
                    title="Tạo nhánh thư mục mới"
                    onClick={() => handleOpenCreateModal(null, true)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    📂+
                  </button>
                </div>
              </div>

              <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  // CÂY TÀI LIỆU ({allPages.length})
                </span>
                <span className="text-[10px] text-slate-400">Hover bấm [+] thêm nhánh</span>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
                {renderPageTreeNodes(null, 0)}
              </div>
            </div>

            {/* PHẦN 2: MỤC LỤC HEADING TỰ ĐỘNG CỦA TRANG ĐANG MỞ (LIVE OUTLINE - 40% dưới) */}
            <div className="flex h-[38%] shrink-0 flex-col bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  // MỤC LỤC TRANG (LIVE OUTLINE)
                </span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-700">
                  {liveExtractedItems.length} REQ
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {liveHeadings.length === 0 ? (
                  <p className="p-3 text-center text-[11px] text-slate-400">
                    Gõ Heading (H1, H2, H3) trong bài viết để tự động sinh mục lục và bóc tách REQ.
                  </p>
                ) : (
                  liveHeadings.map((h) => {
                    const matchedReq = liveExtractedItems.find(
                      (it) => it.id === h.reqId || (h.reqKeyCode && it.keyCode === h.reqKeyCode),
                    )
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setSelectedBlockId(h.id)
                          window.document
                            .getElementById(`conf-block-${h.id}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }}
                        style={{
                          paddingLeft: h.type === 'h1' ? '6px' : h.type === 'h2' ? '16px' : '26px',
                        }}
                        className="flex w-full items-center justify-between gap-1.5 rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <span
                          className={clsx(
                            'truncate',
                            h.type === 'h1' ? 'font-bold text-slate-900' : 'font-medium text-slate-700',
                          )}
                        >
                          {h.text || 'Tiêu đề trống'}
                        </span>

                        {h.isReq && (
                          <span
                            className={clsx(
                              'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.2 font-mono text-[9px] font-bold',
                              matchedReq?.syncStatus === 'UNCONFIRMED_STALE'
                                ? 'bg-amber-100 text-amber-800'
                                : matchedReq?.syncStatus === 'CONFIRMED_STALE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800',
                            )}
                          >
                            <span
                              className={clsx(
                                'h-1.5 w-1.5 rounded-full',
                                matchedReq?.syncStatus === 'UNCONFIRMED_STALE'
                                  ? 'bg-amber-500'
                                  : matchedReq?.syncStatus === 'CONFIRMED_STALE'
                                    ? 'bg-rose-500'
                                    : 'bg-emerald-500',
                              )}
                            />
                            {h.reqKeyCode || 'REQ'}
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </aside>
        )}

        {/* ======================================================================= */}
        {/* C. VÙNG GIỮA: CONFLUENCE FREE-FORM RICH DOCUMENT CANVAS                 */}
        {/* ======================================================================= */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-slate-100">
          {/* 1. THANH CÔNG CỤ ĐỊNH DẠNG CỐ ĐỊNH TRÊN ĐỈNH (CONFLUENCE EDITOR TOOLBAR) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-1.5 shadow-2xs z-10">
            <div className="flex flex-wrap items-center gap-1">
              {/* Chọn kiểu chữ cho khối đang chọn */}
              <select
                disabled={isSafeMode}
                value={blocks.find((b) => b.id === selectedBlockId)?.type || 'paragraph'}
                onChange={(e) => {
                  const val = e.target.value as ConfluenceBlockType
                  if (selectedBlockId) {
                    updateBlock(selectedBlockId, { type: val })
                  } else {
                    handleToolbarInsertBlock(val)
                  }
                }}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                <option value="paragraph">Văn bản thường (Paragraph)</option>
                <option value="h1">Heading 1 (H1 - Chương lớn)</option>
                <option value="h2">Heading 2 (H2 - Mục yêu cầu)</option>
                <option value="h3">Heading 3 (H3 - Mục con)</option>
              </select>

              <span className="mx-1 text-slate-200">|</span>

              {/* B / I / U */}
              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => {
                  const blk = blocks.find((b) => b.id === selectedBlockId)
                  if (blk) updateBlock(blk.id, { bold: !blk.bold })
                }}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40"
                title="In đậm (Bold)"
              >
                B
              </button>
              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => {
                  const blk = blocks.find((b) => b.id === selectedBlockId)
                  if (blk) updateBlock(blk.id, { italic: !blk.italic })
                }}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 text-xs italic font-serif text-slate-700 disabled:opacity-40"
                title="In nghiêng (Italic)"
              >
                I
              </button>
              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => {
                  const blk = blocks.find((b) => b.id === selectedBlockId)
                  if (blk) updateBlock(blk.id, { underline: !blk.underline })
                }}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 text-xs underline text-slate-700 disabled:opacity-40"
                title="Gạch chân (Underline)"
              >
                U
              </button>

              <span className="mx-1 text-slate-200">|</span>

              {/* Danh sách & Checklist */}
              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => handleToolbarInsertBlock('bullet_list')}
                className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                title="Chèn danh sách chấm tròn"
              >
                • Danh sách
              </button>
              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => handleToolbarInsertBlock('checklist')}
                className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                title="Chèn Checklist tiêu chí nghiệm thu"
              >
                ☑️ Checklist
              </button>

              <span className="mx-1 text-slate-200">|</span>

              {/* Các công cụ chèn Khối Đặc tả chuyên sâu */}
              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => handleToolbarInsertBlock('table')}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <span>➕ Chèn Bảng (Table)</span>
              </button>

              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => handleToolbarInsertBlock('callout')}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <span>➕ Hộp Ghi chú (Panel)</span>
              </button>

              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => handleToolbarInsertBlock('diagram')}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <span>➕ Sơ đồ (Mermaid)</span>
              </button>

              <button
                type="button"
                disabled={isSafeMode}
                onClick={() => handleToolbarInsertBlock('figma')}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <span>➕ Khung Figma</span>
              </button>
            </div>

            {/* Công cụ gắn nhãn REQ tự động & In ấn */}
            <div className="flex items-center gap-1.5">
              {!isSafeMode && (
                <>
                  <button
                    type="button"
                    onClick={() => handleToolbarInsertBlock('h2', true)}
                    className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <span>🏷️ + Chèn Heading [REQ]</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoTagAllHeadings}
                    className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    title="Quét và gắn mã REQ-xx cho toàn bộ các Heading H2/H3 trong trang"
                  >
                    <span>⚡ Tự động nhận diện REQ từ mọi Heading</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                title="Xem bản in chuẩn của tài liệu"
              >
                🖨️ Xem in
              </button>
            </div>
          </div>

          {/* 2. MẶT GIẤY TRẮNG CONFLUENCE (FREE-FORM DOCUMENT CANVAS) */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {isLoading ? (
              <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
                <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <p className="mt-2 text-xs text-slate-500">Đang tải trang tài liệu Confluence…</p>
              </div>
            ) : currentPage ? (
              <article className="mx-auto max-w-4xl rounded-xl border border-slate-200/90 bg-white px-8 py-10 sm:px-14 sm:py-12 shadow-xs min-h-[calc(100vh-140px)]">
                {/* Dải băng Safe Mode nếu trang đã được phê duyệt Baseline (GB-01) */}
                {isSafeMode && (
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-xs text-emerald-950">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔒</span>
                      <div>
                        <span className="font-bold">CHẾ ĐỘ ĐỌC AN TOÀN (SAFE MODE - GB-01): </span>
                        <span>
                          Trang tài liệu này đã được phê duyệt làm Baseline bởi{' '}
                          <b>{currentPage.approvedBy || 'Project Manager'}</b> lúc{' '}
                          <b>{formatDate(currentPage.approvedAt || currentPage.updatedAt)}</b>. Nội dung bị khóa chỉnh sửa
                          trực tiếp.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateRevision}
                      className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      + Tạo bản sửa đổi mới ({currentPage.version}.1)
                    </button>
                  </div>
                )}

                {/* TIÊU ĐỀ LỚN CỦA TRANG TÀI LIỆU (CONFLUENCE PAGE TITLE) */}
                <div className="border-b border-slate-100 pb-5 mb-6">
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-slate-500">
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-mono font-bold text-emerald-800">
                      {currentPage.code}
                    </span>
                    <Badge
                      tone={
                        currentPage.status === 'APPROVED'
                          ? 'brand'
                          : currentPage.status === 'IN_REVIEW'
                            ? 'blue'
                            : 'amber'
                      }
                      dot={currentPage.status === 'APPROVED'}
                    >
                      {currentPage.status === 'APPROVED'
                        ? 'Baseline Approved'
                        : currentPage.status === 'IN_REVIEW'
                          ? 'Đang chờ duyệt (In Review)'
                          : 'Bản nháp đang soạn (Draft)'}
                    </Badge>
                    <span>·</span>
                    <span>Tác giả: <b>{currentPage.createdBy}</b></span>
                    <span>·</span>
                    <span>Cập nhật: {formatDate(currentPage.updatedAt)}</span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('req')}
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      🏷️ Đã bóc tách tự động {liveExtractedItems.length} mục REQ
                    </button>
                  </div>

                  {/* Input Tiêu đề trang lớn không viền */}
                  <input
                    type="text"
                    disabled={isSafeMode}
                    value={pageTitle}
                    onChange={(e) => {
                      setPageTitle(e.target.value)
                      setIsDirty(true)
                    }}
                    placeholder="Nhập tiêu đề trang tài liệu..."
                    className="w-full border-0 bg-transparent text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 outline-none focus:ring-0 p-0"
                  />

                  {/* Mô tả ngắn / Tóm tắt trang */}
                  <input
                    type="text"
                    disabled={isSafeMode}
                    value={pageDescription}
                    onChange={(e) => {
                      setPageDescription(e.target.value)
                      setIsDirty(true)
                    }}
                    placeholder="Thêm mô tả tóm tắt mục đích của trang tài liệu này..."
                    className="mt-2 w-full border-0 bg-transparent text-xs sm:text-sm italic text-slate-500 outline-none focus:ring-0 p-0"
                  />
                </div>

                {/* DANH SÁCH CÁC KHỐI NỘI DUNG TỰ DO (CONFLUENCE BLOCKS) */}
                <div className="space-y-4">
                  {blocks.map((block) => {
                    const isHeading = block.type === 'h1' || block.type === 'h2' || block.type === 'h3'
                    const matchedReq = isHeading
                      ? liveExtractedItems.find(
                          (it) => it.id === block.reqId || (block.reqKeyCode && it.keyCode === block.reqKeyCode),
                        )
                      : undefined

                    return (
                      <div
                        key={block.id}
                        id={`conf-block-${block.id}`}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={clsx(
                          'group/blk relative rounded-lg transition-all',
                          isHeading && block.isReq
                            ? 'mt-7 pt-2 border-t border-slate-100'
                            : isHeading
                              ? 'mt-6 pt-1'
                              : '',
                        )}
                      >
                        {/* Thanh điều khiển khối nhỏ gọn bên lề trái khi di chuột (Hover Block Controls) */}
                        {!isSafeMode && (
                          <div className="absolute -left-11 top-1 hidden group-hover/blk:flex items-center gap-0.5 bg-white border border-slate-200 rounded-md px-1 py-0.5 shadow-xs z-10">
                            <button
                              type="button"
                              title="Chèn đoạn văn mới bên dưới"
                              onClick={(e) => {
                                e.stopPropagation()
                                insertBlockAfter(block.id, {
                                  id: `blk-${Date.now()}`,
                                  type: 'paragraph',
                                  text: '',
                                })
                              }}
                              className="text-xs font-bold text-slate-400 hover:text-emerald-600 px-0.5"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              title="Di chuyển khối lên"
                              onClick={(e) => {
                                e.stopPropagation()
                                moveBlock(block.id, -1)
                              }}
                              className="text-[10px] text-slate-400 hover:text-slate-800 px-0.5"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              title="Di chuyển khối xuống"
                              onClick={(e) => {
                                e.stopPropagation()
                                moveBlock(block.id, 1)
                              }}
                              className="text-[10px] text-slate-400 hover:text-slate-800 px-0.5"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              title="Xóa khối này"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteBlock(block.id)
                              }}
                              className="text-[10px] text-slate-400 hover:text-rose-600 px-0.5"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* 1. KHỐI HEADING (H1 / H2 / H3) + PILL BADGE [REQ-xx]      */}
                        {/* ========================================================= */}
                        {isHeading && (
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex-1 min-w-[240px]">
                                <AutoResizeTextarea
                                  disabled={isSafeMode}
                                  value={block.text || ''}
                                  onChange={(val) => handleBlockTextChange(block, val)}
                                  onKeyDown={(e) => handleBlockTextKeyDown(e, block)}
                                  placeholder={
                                    block.type === 'h1'
                                      ? 'Heading 1 (Tiêu đề chương)...'
                                      : block.type === 'h2'
                                        ? 'Heading 2 (Tiêu đề mục yêu cầu)...'
                                        : 'Heading 3 (Tiêu đề mục con)...'
                                  }
                                  className={clsx(
                                    'text-slate-900 tracking-tight',
                                    block.type === 'h1'
                                      ? 'text-xl sm:text-2xl font-extrabold'
                                      : block.type === 'h2'
                                        ? 'text-lg sm:text-xl font-bold'
                                        : 'text-base sm:text-lg font-semibold',
                                  )}
                                />
                              </div>

                              {/* Pill Badge [REQ-xx · Fresh / Stale] hoặc nút [+ Đánh dấu là REQ] */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {block.isReq ? (
                                  <>
                                    <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/90 pl-2.5 pr-1.5 py-0.5 text-[11px] font-semibold text-emerald-900 shadow-2xs">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setFocusedReqId(matchedReq?.id || block.reqId || null)
                                          setDrawerTab('req')
                                        }}
                                        className="inline-flex items-center gap-1.5 hover:underline"
                                        title="Bấm để mở Ngăn bóc tách REQ & Ma trận RTM bên phải"
                                      >
                                        <span
                                          className={clsx(
                                            'h-2 w-2 rounded-full',
                                            matchedReq?.syncStatus === 'UNCONFIRMED_STALE'
                                              ? 'bg-amber-500 animate-pulse'
                                              : matchedReq?.syncStatus === 'CONFIRMED_STALE'
                                                ? 'bg-rose-500'
                                                : 'bg-emerald-500',
                                          )}
                                        />
                                        <span className="font-mono font-bold">
                                          {block.reqKeyCode || matchedReq?.keyCode || 'REQ'}
                                        </span>
                                        <span className="text-slate-400">·</span>
                                        <span
                                          className={clsx(
                                            matchedReq?.syncStatus === 'UNCONFIRMED_STALE'
                                              ? 'text-amber-700 font-bold'
                                              : matchedReq?.syncStatus === 'CONFIRMED_STALE'
                                                ? 'text-rose-700 font-bold'
                                                : 'text-emerald-700',
                                          )}
                                        >
                                          {matchedReq?.syncStatus === 'UNCONFIRMED_STALE'
                                            ? 'Unconfirmed Stale'
                                            : matchedReq?.syncStatus === 'CONFIRMED_STALE'
                                              ? 'Confirmed Stale'
                                              : 'Fresh'}
                                        </span>
                                      </button>

                                      {/* Nút bỏ gắn nhãn REQ */}
                                      {!isSafeMode && (
                                        <button
                                          type="button"
                                          title="Chuyển về Heading thường (Không đưa vào RTM)"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            toggleHeadingReq(block)
                                          }}
                                          className="ml-1 rounded-full px-1 text-[10px] text-slate-400 hover:bg-slate-200 hover:text-rose-600"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>

                                    {/* Hiển thị các Jira Issues đã liên kết & Nút tạo Jira Issue */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {projectIssues
                                        .filter(
                                          (iss) =>
                                            iss.linkedRequirementKeyCode ===
                                            (block.reqKeyCode || matchedReq?.keyCode),
                                        )
                                        .map((iss) => (
                                          <Link
                                            key={iss.id}
                                            to={`/projects/${activeProjectId}/issues?issueId=${iss.id}`}
                                            target="_blank"
                                            className={clsx(
                                              'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold shadow-2xs hover:opacity-85 transition-opacity',
                                              iss.type === 'BUG'
                                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                : 'bg-blue-100 text-blue-800 border border-blue-200',
                                            )}
                                            title={`Xem ${iss.key}: ${iss.summary} trên Jira Kanban`}
                                          >
                                            <span>{iss.type === 'BUG' ? '🐞' : '☑️'}</span>
                                            <span>{iss.key}</span>
                                          </Link>
                                        ))}

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const reqKey = block.reqKeyCode || matchedReq?.keyCode || 'REQ-01'
                                          const reqTitle = block.text || 'Mục yêu cầu'
                                          setCreatingJiraForReq({
                                            docId: currentPage?.id || 101,
                                            reqId: matchedReq?.id || block.reqId || `req-${block.id}`,
                                            reqKey,
                                            reqTitle,
                                          })
                                          setJiraIssueSummary(
                                            `Triển khai & Test cho ${reqKey}: ${reqTitle.replace(/^\d+(\.\d+)*\.?\s*/, '')}`,
                                          )
                                          setJiraIssueDesc(
                                            `Đặc tả chi tiết theo tài liệu Confluence [${currentPage?.code || 'SRS'}] mục [${reqKey}].`,
                                          )
                                        }}
                                        className="opacity-0 group-hover/blk:opacity-100 inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition-all shadow-2xs"
                                        title="Tạo Jira Task hoặc Bug liên kết trực tiếp với mục yêu cầu này"
                                      >
                                        <span>+ Jira Issue</span>
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  !isSafeMode && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleHeadingReq(block)
                                      }}
                                      className="opacity-0 group-hover/blk:opacity-100 rounded-full border border-dashed border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                                    >
                                      [+ Đánh dấu là REQ]
                                    </button>
                                  )
                                )}
                              </div>
                            </div>

                            {/* Hộp cảnh báo điểm cần làm rõ (clarificationNeeded) nếu có trên Heading */}
                            {block.clarificationNeeded && (
                              <div className="mt-2 flex items-start justify-between gap-3 rounded-lg border-l-4 border-amber-400 bg-amber-50/90 p-3 text-xs text-amber-950">
                                <div>
                                  <span className="font-bold">⚠️ Điểm cần làm rõ (AI / Reviewer): </span>
                                  <span>{block.clarificationNeeded}</span>
                                </div>
                                {!isSafeMode && (
                                  <button
                                    type="button"
                                    onClick={() => updateBlock(block.id, { clarificationNeeded: null })}
                                    className="shrink-0 rounded bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-700"
                                  >
                                    ✓ Đã làm rõ
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* 2. KHỐI VĂN BẢN TỰ DO (PARAGRAPH)                         */}
                        {/* ========================================================= */}
                        {block.type === 'paragraph' && (
                          <AutoResizeTextarea
                            disabled={isSafeMode}
                            value={block.text || ''}
                            onChange={(val) => handleBlockTextChange(block, val)}
                            onKeyDown={(e) => handleBlockTextKeyDown(e, block)}
                            placeholder="Gõ văn bản tự do, hoặc gõ '/' để mở menu chèn Bảng biểu, Sơ đồ Mermaid, Khung Figma, Heading [REQ]..."
                            className={clsx(
                              'text-sm text-slate-700 leading-relaxed',
                              block.bold && 'font-bold text-slate-900',
                              block.italic && 'italic',
                              block.underline && 'underline',
                            )}
                          />
                        )}

                        {/* ========================================================= */}
                        {/* 3. KHỐI DANH SÁCH CHẤM TRÒN / ĐÁNH SỐ                     */}
                        {/* ========================================================= */}
                        {(block.type === 'bullet_list' || block.type === 'numbered_list') && (
                          <div className="space-y-1.5 pl-4">
                            {(block.listItems || ['']).map((itemText, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                <span className="mt-1 shrink-0 font-mono text-xs text-slate-400 select-none">
                                  {block.type === 'bullet_list' ? '•' : `${idx + 1}.`}
                                </span>
                                <input
                                  type="text"
                                  disabled={isSafeMode}
                                  value={itemText}
                                  onChange={(e) => {
                                    const nextList = [...(block.listItems || [])]
                                    nextList[idx] = e.target.value
                                    updateBlock(block.id, { listItems: nextList })
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isSafeMode) {
                                      e.preventDefault()
                                      const nextList = [...(block.listItems || [])]
                                      nextList.splice(idx + 1, 0, '')
                                      updateBlock(block.id, { listItems: nextList })
                                    } else if (
                                      e.key === 'Backspace' &&
                                      !itemText &&
                                      (block.listItems?.length || 0) > 1 &&
                                      !isSafeMode
                                    ) {
                                      e.preventDefault()
                                      const nextList = (block.listItems || []).filter((_, i) => i !== idx)
                                      updateBlock(block.id, { listItems: nextList })
                                    }
                                  }}
                                  placeholder="Nhập nội dung danh sách (Nhấn Enter để thêm dòng)..."
                                  className="flex-1 bg-transparent border-0 outline-none focus:bg-slate-50 rounded px-1 py-0.5 text-sm text-slate-700"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* 4. KHỐI CHECKLIST NGHIỆM THU (ACCEPTANCE CRITERIA)        */}
                        {/* ========================================================= */}
                        {block.type === 'checklist' && (
                          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                ☑️ CHECKLIST TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
                              </span>
                              {!isSafeMode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [
                                      ...(block.checklistItems || []),
                                      { id: `chk-${Date.now()}`, text: 'Tiêu chí nghiệm thu mới...', checked: false },
                                    ]
                                    updateBlock(block.id, { checklistItems: next })
                                  }}
                                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                                >
                                  + Thêm tiêu chí
                                </button>
                              )}
                            </div>

                            {(block.checklistItems || []).map((ci, idx) => (
                              <div key={ci.id} className="flex items-center gap-2.5 text-xs sm:text-sm">
                                <input
                                  type="checkbox"
                                  disabled={isSafeMode}
                                  checked={ci.checked}
                                  onChange={(e) => {
                                    const next = (block.checklistItems || []).map((item, i) =>
                                      i === idx ? { ...item, checked: e.target.checked } : item,
                                    )
                                    updateBlock(block.id, { checklistItems: next })
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <input
                                  type="text"
                                  disabled={isSafeMode}
                                  value={ci.text}
                                  onChange={(e) => {
                                    const next = (block.checklistItems || []).map((item, i) =>
                                      i === idx ? { ...item, text: e.target.value } : item,
                                    )
                                    updateBlock(block.id, { checklistItems: next })
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isSafeMode) {
                                      e.preventDefault()
                                      const next = [...(block.checklistItems || [])]
                                      next.splice(idx + 1, 0, {
                                        id: `chk-${Date.now()}`,
                                        text: '',
                                        checked: false,
                                      })
                                      updateBlock(block.id, { checklistItems: next })
                                    }
                                  }}
                                  placeholder="Given... When... Then..."
                                  className={clsx(
                                    'flex-1 bg-transparent border-0 outline-none focus:bg-white rounded px-1.5 py-0.5',
                                    ci.checked ? 'text-slate-700' : 'text-slate-600',
                                  )}
                                />
                                {!isSafeMode && (block.checklistItems?.length || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = (block.checklistItems || []).filter((_, i) => i !== idx)
                                      updateBlock(block.id, { checklistItems: next })
                                    }}
                                    className="text-slate-300 hover:text-rose-500 text-xs px-1"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* 5. KHỐI BẢNG BIỂU TỰ DO (CONFLUENCE DYNAMIC TABLE)        */}
                        {/* ========================================================= */}
                        {block.type === 'table' && (
                          <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-100/90">
                                  {(block.tableHeaders || ['Cột 1', 'Cột 2']).map((header, cIdx) => (
                                    <th key={cIdx} className="border-r border-slate-200 last:border-r-0 p-2 font-bold text-slate-800">
                                      <input
                                        type="text"
                                        disabled={isSafeMode}
                                        value={header}
                                        onChange={(e) => {
                                          const nextHeaders = [...(block.tableHeaders || [])]
                                          nextHeaders[cIdx] = e.target.value
                                          updateBlock(block.id, { tableHeaders: nextHeaders })
                                        }}
                                        className="w-full bg-transparent font-bold text-slate-800 outline-none focus:bg-white rounded px-1"
                                      />
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {(block.tableRows || []).map((row, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-slate-50/60">
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="border-r border-slate-200 last:border-r-0 p-2 align-top">
                                        <input
                                          type="text"
                                          disabled={isSafeMode}
                                          value={cell}
                                          onChange={(e) => {
                                            const nextRows = (block.tableRows || []).map((r, ri) =>
                                              ri === rIdx ? r.map((c, ci) => (ci === cIdx ? e.target.value : c)) : r,
                                            )
                                            updateBlock(block.id, { tableRows: nextRows })
                                          }}
                                          placeholder="..."
                                          className="w-full bg-transparent text-slate-700 outline-none focus:bg-white rounded px-1"
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Thanh công cụ thêm/xóa hàng cột của Bảng */}
                            {!isSafeMode && (
                              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const colCount = block.tableHeaders?.length || 2
                                      const nextRows = [
                                        ...(block.tableRows || []),
                                        Array(colCount).fill(''),
                                      ]
                                      updateBlock(block.id, { tableRows: nextRows })
                                    }}
                                    className="font-semibold text-emerald-700 hover:underline"
                                  >
                                    + Thêm hàng
                                  </button>
                                  <span>·</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextHeaders = [
                                        ...(block.tableHeaders || []),
                                        `Cột ${(block.tableHeaders?.length || 0) + 1}`,
                                      ]
                                      const nextRows = (block.tableRows || []).map((r) => [...r, ''])
                                      updateBlock(block.id, { tableHeaders: nextHeaders, tableRows: nextRows })
                                    }}
                                    className="font-semibold text-emerald-700 hover:underline"
                                  >
                                    + Thêm cột
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 text-slate-400">
                                  {(block.tableRows?.length || 0) > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextRows = (block.tableRows || []).slice(0, -1)
                                        updateBlock(block.id, { tableRows: nextRows })
                                      }}
                                      className="hover:text-rose-600"
                                    >
                                      Xóa hàng cuối
                                    </button>
                                  )}
                                  {(block.tableHeaders?.length || 0) > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextHeaders = (block.tableHeaders || []).slice(0, -1)
                                        const nextRows = (block.tableRows || []).map((r) => r.slice(0, -1))
                                        updateBlock(block.id, { tableHeaders: nextHeaders, tableRows: nextRows })
                                      }}
                                      className="hover:text-rose-600"
                                    >
                                      Xóa cột cuối
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* 6. KHỐI HỘP GHI CHÚ (CONFLUENCE CALLOUT PANEL)            */}
                        {/* ========================================================= */}
                        {block.type === 'callout' && (
                          <div
                            className={clsx(
                              'my-2 rounded-lg border-l-4 p-3.5 text-xs sm:text-sm',
                              block.calloutTone === 'warning'
                                ? 'border-amber-500 bg-amber-50/80 text-amber-950'
                                : block.calloutTone === 'rule'
                                  ? 'border-indigo-500 bg-indigo-50/80 text-indigo-950'
                                  : block.calloutTone === 'success'
                                    ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950'
                                    : 'border-blue-500 bg-blue-50/80 text-blue-950',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-1">
                                <span>
                                  {block.calloutTone === 'warning'
                                    ? '⚠️'
                                    : block.calloutTone === 'rule'
                                      ? '📏'
                                      : block.calloutTone === 'success'
                                        ? '✅'
                                        : 'ℹ️'}
                                </span>
                                <input
                                  type="text"
                                  disabled={isSafeMode}
                                  value={block.calloutTitle || ''}
                                  onChange={(e) => updateBlock(block.id, { calloutTitle: e.target.value })}
                                  placeholder="Tiêu đề hộp ghi chú / Quy tắc nghiệp vụ..."
                                  className="flex-1 bg-transparent font-bold outline-none"
                                />
                              </div>

                              {!isSafeMode && (
                                <select
                                  value={block.calloutTone || 'info'}
                                  onChange={(e) =>
                                    updateBlock(block.id, { calloutTone: e.target.value as CalloutTone })
                                  }
                                  className="rounded border border-black/10 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold"
                                >
                                  <option value="info">Info (Xanh dương)</option>
                                  <option value="warning">Warning (Cam)</option>
                                  <option value="rule">Business Rule (Tím)</option>
                                  <option value="success">Success (Ngọc)</option>
                                </select>
                              )}
                            </div>

                            <AutoResizeTextarea
                              disabled={isSafeMode}
                              value={block.text || ''}
                              onChange={(val) => updateBlock(block.id, { text: val })}
                              placeholder="Nhập nội dung ghi chú hoặc quy tắc nghiệp vụ..."
                              className="text-xs sm:text-sm leading-relaxed"
                            />
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* 7. KHỐI SƠ ĐỒ TRỰC QUAN (MERMAID / PLANTUML DIAGRAM)      */}
                        {/* ========================================================= */}
                        {block.type === 'diagram' && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isSafeMode) {
                                setEditingDiagramBlock(block)
                                setTempDiagramTitle(block.diagramTitle || 'Sơ đồ Luồng Xử lý')
                                setTempDiagramCode(block.diagramSourceCode || '')
                                setTempDiagramType(block.diagramType || 'MERMAID_PLANTUML')
                              }
                            }}
                            className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-xs">
                              <div className="flex items-center gap-2 font-semibold text-slate-800">
                                <span>📐</span>
                                <span>{block.diagramTitle || 'Sơ đồ Luồng Quy trình (Mermaid / PlantUML)'}</span>
                              </div>
                              {!isSafeMode && (
                                <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  ✏️ Bấm để chỉnh mã Mermaid / AI Sinh sơ đồ
                                </span>
                              )}
                            </div>
                            <div className="p-2">
                              <DiagramViewer
                                code={block.diagramSourceCode || ''}
                                title={block.diagramTitle}
                                diagramType={block.diagramType || 'MERMAID_PLANTUML'}
                                readOnly
                              />
                            </div>
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* 8. KHỐI NHÚNG KHUNG THIẾT KẾ FIGMA (FIGMA EMBED BLOCK)    */}
                        {/* ========================================================= */}
                        {block.type === 'figma' && (
                          <div className="my-3 overflow-hidden rounded-xl border border-pink-200 bg-pink-50/30 p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-pink-200/60">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded bg-pink-600 text-white text-xs font-bold">
                                  F
                                </span>
                                <input
                                  type="text"
                                  disabled={isSafeMode}
                                  value={block.figmaFrameName || ''}
                                  onChange={(e) => updateBlock(block.id, { figmaFrameName: e.target.value })}
                                  placeholder="Tên màn hình thiết kế Figma (Frame Name)..."
                                  className="bg-transparent text-xs font-bold text-slate-900 outline-none focus:bg-white rounded px-1"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  disabled={isSafeMode}
                                  value={block.figmaUrl || ''}
                                  onChange={(e) => updateBlock(block.id, { figmaUrl: e.target.value })}
                                  placeholder="https://www.figma.com/file/..."
                                  className="w-56 rounded border border-pink-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 outline-none"
                                />
                                {block.figmaUrl && (
                                  <a
                                    href={block.figmaUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded bg-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-pink-700"
                                  >
                                    Mở Figma ↗
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Khung Mockup UI Preview trực quan ngay trong bài viết */}
                            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-16 items-center justify-center rounded border border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-400">
                                  UI MOCK
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">
                                    {block.figmaFrameName || 'Màn hình Thiết kế Giao diện'}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Đã đồng bộ với phân đoạn yêu cầu trên trang Confluence · Sẵn sàng cho Frontend & QA đối chiếu
                                  </p>
                                </div>
                              </div>
                              <Badge tone="brand" dot>
                                Figma Linked
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* ========================================================= */}
                        {/* MENU NỔI SLASH COMMAND (/) KHI NGƯỜI DÙNG GÕ DẤU "/"      */}
                        {/* ========================================================= */}
                        {slashMenuBlockId === block.id && !isSafeMode && (
                          <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                            <div className="px-2.5 py-1 flex items-center justify-between border-b border-slate-100 text-[10px] font-mono uppercase text-slate-400">
                              <span>Chèn nhanh khối Confluence (Slash Menu)</span>
                              <button
                                type="button"
                                onClick={() => setSlashMenuBlockId(null)}
                                className="hover:text-slate-700"
                              >
                                Đóng ✕
                              </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 mt-1">
                              {SLASH_COMMANDS.map((item) => (
                                <button
                                  key={item.cmd}
                                  type="button"
                                  onClick={() => executeSlashCommand(block, item)}
                                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-emerald-50/80 transition-colors"
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-xs font-bold text-slate-700">
                                    {item.icon}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-900">{item.label}</span>
                                      <span className="font-mono text-[10px] text-emerald-700">{item.cmd}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate">{item.desc}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* VÙNG CHÈN NHANH CUỐI TRANG GIẤY (BOTTOM QUICK ADD BAR) */}
                {!isSafeMode && (
                  <div className="mt-10 pt-6 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToolbarInsertBlock('paragraph')}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        + Thêm đoạn văn
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsertBlock('h2', true)}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        🏷️ + Thêm Heading [REQ-xx]
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsertBlock('table')}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        📊 + Chèn Bảng
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsertBlock('diagram')}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        📐 + Chèn Sơ đồ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsertBlock('figma')}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        🎨 + Chèn Figma
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSavePage}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 font-semibold text-white shadow-xs hover:bg-emerald-700"
                    >
                      💾 Lưu trang & Cập nhật RTM
                    </button>
                  </div>
                )}
              </article>
            ) : null}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* D. NGĂN TRƯỢT BÊN PHẢI (SLIDE-OVER CONTEXT DRAWER - RỘNG 400px)         */}
        {/* ======================================================================= */}
        {drawerTab !== null && (
          <aside className="flex w-[400px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xl z-30 animate-fade-in">
            {/* Header của Slide-over Drawer */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDrawerTab('req')}
                  className={clsx(
                    'rounded-md px-2.5 py-1 transition-colors',
                    drawerTab === 'req' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200/70',
                  )}
                >
                  # REQ & RTM ({liveExtractedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('history')}
                  className={clsx(
                    'rounded-md px-2.5 py-1 transition-colors',
                    drawerTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200/70',
                  )}
                >
                  🕒 Lịch sử ({history.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('comments')}
                  className={clsx(
                    'rounded-md px-2.5 py-1 transition-colors',
                    drawerTab === 'comments' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200/70',
                  )}
                >
                  💬 Bình luận ({comments.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDrawerTab(null)}
                className="rounded-md p-1 text-xs font-bold text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                title="Đóng ngăn trượt để mở rộng mặt giấy"
              >
                ✕
              </button>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* TAB 1: DANH SÁCH REQ ĐƯỢC BÓC TÁCH TỰ ĐỘNG TỪ HEADING & MA TRẬN RTM */}
            {/* ------------------------------------------------------------------- */}
            {drawerTab === 'req' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950">
                  <p className="font-bold">⚡ Cơ chế Tự động Bóc tách Heading → Database:</p>
                  <p className="mt-0.5 text-[11px] text-emerald-800 leading-relaxed">
                    Mỗi dòng Heading được gắn nhãn <b>[REQ-xx]</b> trên trang giấy sẽ tự động thu thập toàn bộ văn bản,
                    bảng biểu, sơ đồ Mermaid và khung Figma nằm bên dưới nó thành 1 bản ghi chuẩn trong Ma trận RTM.
                  </p>
                </div>

                {liveExtractedItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    Chưa có Heading nào được gắn nhãn REQ trên trang này. Hãy di chuột vào dòng Heading và bấm{' '}
                    <b>[+ Đánh dấu là REQ]</b>!
                  </div>
                ) : (
                  liveExtractedItems.map((req) => {
                    const isHighlighted = focusedReqId === req.id
                    return (
                      <div
                        key={req.id}
                        className={clsx(
                          'rounded-xl border p-3.5 text-xs transition-all space-y-2.5',
                          isHighlighted
                            ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300',
                        )}
                      >
                        {/* Hàng trên: Mã REQ + Trạng thái Stale/Fresh + Chỉnh nhanh Priority */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                              {req.keyCode}
                            </span>
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                req.syncStatus === 'FRESH'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : req.syncStatus === 'UNCONFIRMED_STALE'
                                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                                    : 'bg-rose-100 text-rose-800',
                              )}
                            >
                              <span
                                className={clsx(
                                  'h-1.5 w-1.5 rounded-full',
                                  req.syncStatus === 'FRESH'
                                    ? 'bg-emerald-600'
                                    : req.syncStatus === 'UNCONFIRMED_STALE'
                                      ? 'bg-amber-600'
                                      : 'bg-rose-600',
                                )}
                              />
                              {req.syncStatus === 'FRESH'
                                ? 'Fresh'
                                : req.syncStatus === 'UNCONFIRMED_STALE'
                                  ? 'Unconfirmed Stale'
                                  : 'Confirmed Stale'}
                            </span>
                          </div>

                          {/* Chỉnh nhanh Priority bằng 1 click */}
                          <div className="flex items-center rounded border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-bold">
                            {(['HIGH', 'MEDIUM', 'LOW'] as ItemPriority[]).map((p) => (
                              <button
                                key={p}
                                type="button"
                                disabled={isSafeMode}
                                onClick={() => handleQuickChangePriority(req, p)}
                                className={clsx(
                                  'rounded px-1.5 py-0.5 transition-colors',
                                  req.priority === p
                                    ? p === 'HIGH'
                                      ? 'bg-rose-600 text-white'
                                      : p === 'MEDIUM'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-slate-600 text-white'
                                    : 'text-slate-400 hover:text-slate-700',
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tiêu đề Heading */}
                        <p className="font-bold text-slate-900 text-xs leading-snug">{req.headingTitle}</p>

                        {/* Các thành phần đầu vào đã bóc tách tự động trong phân đoạn */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                            ✓ Văn bản ({req.content.length} ký tự)
                          </span>
                          {req.hasTable && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                              📊 Có Bảng biểu
                            </span>
                          )}
                          {req.diagramType !== 'NONE' && (
                            <span className="rounded bg-purple-50 px-1.5 py-0.5 font-semibold text-purple-700">
                              📐 Có Sơ đồ Mermaid
                            </span>
                          )}
                          {req.requiresUi && (
                            <span className="rounded bg-pink-50 px-1.5 py-0.5 font-semibold text-pink-700">
                              🎨 Có Khung Figma
                            </span>
                          )}
                        </div>

                        {/* Tóm tắt nội dung bóc tách */}
                        <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-600 line-clamp-3 whitespace-pre-line border border-slate-100">
                          {req.content}
                        </div>

                        {/* Danh sách Test Cases / Issues liên kết & Nút Đồng bộ Fresh */}
                        <div className="border-t border-slate-100 pt-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                              Test Cases & Issues liên kết:
                            </span>
                            <button
                              type="button"
                              onClick={() => setAddingTcForReqId(addingTcForReqId === req.id ? null : req.id)}
                              className="text-[10px] font-semibold text-emerald-700 hover:underline"
                            >
                              + Gắn thêm TC
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {req.linkedTestCases.map((tc) => (
                              <span
                                key={tc}
                                className={clsx(
                                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                                  req.syncStatus === 'FRESH'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : req.syncStatus === 'UNCONFIRMED_STALE'
                                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                                      : 'border-rose-300 bg-rose-50 text-rose-900',
                                )}
                              >
                                <span>🧪 {tc}</span>
                              </span>
                            ))}
                            {/* Jira Issues thực tế từ kho lưu trữ issueApi */}
                            {projectIssues
                              .filter((iss) => iss.linkedRequirementKeyCode === req.keyCode)
                              .map((iss) => (
                                <Link
                                  key={iss.id}
                                  to={`/projects/${activeProjectId}/issues?issueId=${iss.id}`}
                                  target="_blank"
                                  className={clsx(
                                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold shadow-2xs hover:opacity-80 transition-opacity',
                                    iss.type === 'BUG'
                                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                                      : 'border-blue-300 bg-blue-50 text-blue-800',
                                  )}
                                  title={`Xem chi tiết ${iss.key}: ${iss.summary} trên Jira`}
                                >
                                  <span>{iss.type === 'BUG' ? '🐞' : '☑️'}</span>
                                  <span>{iss.key}</span>
                                </Link>
                              ))}
                          </div>

                          {/* Nút Tạo Jira Task/Bug trực tiếp từ REQ này */}
                          <div className="mt-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                setCreatingJiraForReq({
                                  docId: currentPage?.id || 101,
                                  reqId: req.id,
                                  reqKey: req.keyCode,
                                  reqTitle: req.headingTitle,
                                })
                                setJiraIssueSummary(
                                  `Triển khai cho ${req.keyCode}: ${req.headingTitle.replace(/^\d+(\.\d+)*\.?\s*/, '')}`,
                                )
                                setJiraIssueDesc(
                                  `Đặc tả chi tiết theo mục [${req.keyCode}] trong tài liệu ${currentPage?.title}.`,
                                )
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline"
                            >
                              <span>+ Tạo Jira Task/Bug từ REQ này</span>
                            </button>
                          </div>

                          {/* Ô nhập thêm mã Test Case */}
                          {addingTcForReqId === req.id && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <input
                                type="text"
                                value={newTcCode}
                                onChange={(e) => setNewTcCode(e.target.value)}
                                placeholder="VD: TC-05-01..."
                                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddTestCaseToReq(req)}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
                              >
                                Lưu
                              </button>
                            </div>
                          )}

                          {/* Nút QA xác nhận đã cập nhật Test Case -> Chuyển về Fresh */}
                          {req.syncStatus !== 'FRESH' && (
                            <button
                              type="button"
                              onClick={() => handleSyncReqToFresh(req)}
                              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                            >
                              <span>✓ QA Xác nhận đã cập nhật Test Case → Fresh</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* TAB 2: LỊCH SỬ CHỈNH SỬA & ĐỐI CHIẾU DIFF (REQUIREMENT HISTORY LOG) */}
            {/* ------------------------------------------------------------------- */}
            {drawerTab === 'history' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Mỗi khi bạn sửa nội dung bên dưới một Heading <b>[REQ-xx]</b> và bấm Lưu, hệ thống tự động lưu bản ghi
                  trước & sau tại đây.
                </div>

                {history.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    Chưa có lịch sử thay đổi nào trên trang tài liệu này.
                  </p>
                ) : (
                  history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-900">
                            {h.requirementKeyCode}
                          </span>
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">
                            {h.changeType}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">[{h.version}]</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{formatDate(h.changedAt)}</span>
                      </div>

                      <p className="text-slate-700">
                        Chỉnh sửa bởi: <b className="text-slate-900">{h.changedBy}</b>
                      </p>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span
                          className={clsx(
                            'text-[10px] font-semibold',
                            h.confirmationState === 'CONFIRMED_APPROVED' ? 'text-emerald-700' : 'text-amber-700',
                          )}
                        >
                          {h.confirmationState === 'CONFIRMED_APPROVED'
                            ? '✓ Đã chốt Baseline'
                            : '• Bản sửa nháp (Unconfirmed)'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDiffLog(h)}
                          className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                          <span>🔍 Xem đối chiếu Trước / Sau (Diff)</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* TAB 3: BÌNH LUẬN PHẢN BIỆN THEO TỪNG MỤC REQ                        */}
            {/* ------------------------------------------------------------------- */}
            {drawerTab === 'comments' && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {comments.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400">
                      Chưa có bình luận nào trên trang tài liệu này.
                    </p>
                  ) : (
                    comments.map((c) => {
                      const reqObj = liveExtractedItems.find((i) => i.id === c.requirementItemId)
                      return (
                        <div
                          key={c.id}
                          className={clsx(
                            'rounded-xl border p-3 text-xs space-y-1.5',
                            c.isResolved ? 'border-slate-100 bg-slate-50 opacity-65' : 'border-slate-200 bg-white shadow-2xs',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Avatar name={c.authorName} size="sm" />
                              <div>
                                <span className="font-bold text-slate-900">{c.authorName}</span>
                                <span className="ml-1 text-[10px] text-slate-400">({c.authorRole})</span>
                              </div>
                            </div>
                            {reqObj && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                                {reqObj.keyCode}
                              </span>
                            )}
                          </div>

                          {c.isStale && (
                            <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] font-semibold text-amber-800">
                              ⚠️ Nội dung phân đoạn {reqObj?.keyCode || 'REQ'} đã thay đổi sau khi bình luận này được tạo
                            </div>
                          )}

                          <p className="text-slate-700 leading-relaxed whitespace-pre-line">{c.body || c.content}</p>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
                            <span>{formatDate(c.createdAt)}</span>
                            {c.isResolved ? (
                              <span className="font-bold text-emerald-600">✓ Đã giải quyết</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleResolveComment(c.id)}
                                className="font-bold text-emerald-700 hover:underline"
                              >
                                ✓ Đánh dấu đã giải quyết
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Form thêm bình luận mới */}
                <form onSubmit={handleAddComment} className="border-t border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Gắn với mục REQ:</span>
                    <select
                      value={commentTargetReqId}
                      onChange={(e) => setCommentTargetReqId(e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800"
                    >
                      {liveExtractedItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          [{it.keyCode}] {it.headingTitle.slice(0, 28)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Nhập nhận xét phản biện cho mục yêu cầu này..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" inline className="h-8! px-3! text-xs">
                      Gửi bình luận
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CÁC MODAL PHỤ TRỢ (TẠO TRANG, SỬA SƠ ĐỒ, DIFF, AI RAW NOTES, PRINT)       */}
      {/* ========================================================================= */}

      {/* 1. Modal Tạo Trang Tài liệu / Nhánh mới trên Cây Confluence */}
      <Modal
        open={showCreatePageModal}
        onClose={() => setShowCreatePageModal(false)}
        title={newPageIsFolder ? 'Tạo Nhánh Thư mục Tài liệu Mới' : 'Tạo Trang Tài liệu Confluence Mới'}
        size="md"
      >
        <form onSubmit={handleCreateNewPage} className="space-y-4">
          {createParentId && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
              Trang mới sẽ nằm bên dưới nhánh:{' '}
              <b className="text-slate-900">{allPages.find((p) => p.id === createParentId)?.title}</b>
            </div>
          )}

          <TextField
            label="Tiêu đề trang / nhánh tài liệu"
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.target.value)}
            placeholder="VD: 2.3. SRS - Phân hệ Thông báo & Cảnh báo Giao dịch..."
            required
          />

          {!newPageIsFolder && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(['SRS', 'URD', 'BRD'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewPageDocType(t)}
                    className={clsx(
                      'rounded-lg border p-2.5 text-left text-xs transition-all',
                      newPageDocType === t
                        ? 'border-emerald-600 bg-emerald-50/70 font-bold text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <div>{t}</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      {t === 'SRS' ? 'Đặc tả Kỹ thuật' : t === 'URD' ? 'Yêu cầu Người dùng' : 'Yêu cầu Nghiệp vụ'}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Chọn Mẫu Khởi tạo Trang (Confluence Template)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    {
                      id: 'BLANK',
                      icon: '📄',
                      label: 'Trang trắng tự do',
                      desc: 'Mặt giấy trống hoàn toàn để tự trình bày',
                    },
                    {
                      id: 'SRS',
                      icon: '📐',
                      label: 'Mẫu Đặc tả SRS Chuẩn',
                      desc: 'Có sẵn Heading REQ, Bảng dữ liệu & Sơ đồ',
                    },
                    {
                      id: 'URD',
                      icon: '👤',
                      label: 'Mẫu URD / User Story',
                      desc: 'Khung As a... I want... & Checklist Given-When-Then',
                    },
                    {
                      id: 'MEETING_NOTES',
                      icon: '📝',
                      label: 'Biên bản họp Raw Notes',
                      desc: 'Ghi chú cuộc họp kết hợp AI bóc tách REQ',
                    },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setNewPageTemplate(tpl.id as typeof newPageTemplate)}
                      className={clsx(
                        'flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all',
                        newPageTemplate === tpl.id
                          ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600'
                          : 'border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <span className="text-base">{tpl.icon}</span>
                      <div>
                        <p className="font-bold text-slate-900">{tpl.label}</p>
                        <p className="text-[10px] text-slate-500">{tpl.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="secondary" inline onClick={() => setShowCreatePageModal(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" inline>
              + Khởi tạo trang ngay
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal Đổi tên trang trên cây */}
      <Modal open={!!renamingPage} onClose={() => setRenamingPage(null)} title="Đổi tên Trang Tài liệu" size="md">
        <form onSubmit={handleConfirmRenamePage} className="space-y-4">
          <TextField
            label="Tên mới của trang tài liệu"
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="secondary" inline onClick={() => setRenamingPage(null)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" inline>
              Lưu tên mới
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal Chỉnh sửa Sơ đồ Mermaid / PlantUML */}
      {editingDiagramBlock && (
        <Modal
          open={!!editingDiagramBlock}
          onClose={() => setEditingDiagramBlock(null)}
          title="Trình biên soạn Sơ đồ Luồng (Mermaid / PlantUML)"
          size="lg"
        >
          <div className="space-y-3">
            <TextField
              label="Tiêu đề sơ đồ"
              value={tempDiagramTitle}
              onChange={(e) => setTempDiagramTitle(e.target.value)}
            />
            <DiagramViewer
              code={tempDiagramCode}
              title={tempDiagramTitle}
              diagramType={tempDiagramType}
              onChangeSource={setTempDiagramCode}
              onChangeType={setTempDiagramType}
            />
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="secondary" inline onClick={() => setEditingDiagramBlock(null)}>
                Đóng
              </Button>
              <Button
                variant="primary"
                inline
                onClick={() => {
                  updateBlock(editingDiagramBlock.id, {
                    diagramTitle: tempDiagramTitle,
                    diagramSourceCode: tempDiagramCode,
                    diagramType: tempDiagramType,
                  })
                  setEditingDiagramBlock(null)
                }}
              >
                ✓ Cập nhật sơ đồ vào bài viết
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Modal Đối chiếu Lịch sử Trước / Sau (Side-by-Side Diff) */}
      <HistoryDiffModal open={!!diffLog} onClose={() => setDiffLog(null)} log={diffLog} />

      {/* 5. Modal AI Sinh nội dung & Bóc tách từ Raw Notes */}
      <AiSpecificationModal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        onImportItems={handleImportAiItems}
        documentTitle={pageTitle}
      />

      {/* 6. Modal Xem In / Xuất PDF */}
      <Modal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title={`Bản Xem In Chuẩn: ${currentPage?.code} — ${pageTitle}`}
        size="lg"
      >
        <div className="max-h-[70vh] overflow-y-auto rounded border border-slate-200 bg-white p-6 space-y-4 text-xs text-slate-800">
          <div className="border-b pb-4 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              // CONFLUENCE SPECIFICATION WORKSPACE · {currentProject?.name}
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{pageTitle}</h1>
            <p className="mt-1 text-slate-500">
              Mã: {currentPage?.code} · Phiên bản: {currentPage?.version} · Số mục REQ bóc tách:{' '}
              {liveExtractedItems.length}
            </p>
          </div>
          {liveExtractedItems.map((it) => (
            <div key={it.id} className="rounded-lg border border-slate-200 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between border-b pb-1">
                <span className="font-bold text-slate-900">{it.headingTitle}</span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                  {it.keyCode} · {it.priority}
                </span>
              </div>
              <p className="whitespace-pre-line text-slate-700 leading-relaxed">{it.content}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          <Button variant="secondary" inline onClick={() => setShowPrintModal(false)}>
            Đóng
          </Button>
          <Button variant="primary" inline onClick={() => window.print()}>
            🖨️ In tài liệu / Lưu PDF
          </Button>
        </div>
      </Modal>

      {/* 7. Modal Từ chối phê duyệt (Reject) */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Yêu cầu Sửa lại / Hoàn tác về Bản Nháp"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Trang tài liệu sẽ quay về trạng thái <b>DRAFT</b> để BA chỉnh sửa lại. Các Test Case đang ở trạng thái{' '}
            <b>Unconfirmed Stale</b> sẽ được khôi phục về <b>Fresh</b>.
          </p>
          <TextAreaField
            label="Lý do yêu cầu sửa lại"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Nhập nội dung cần BA bổ sung hoặc làm rõ..."
          />
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="secondary" inline onClick={() => setShowRejectModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" inline onClick={handleConfirmReject} className="bg-rose-600 hover:bg-rose-700">
              Xác nhận hoàn tác về DRAFT
            </Button>
          </div>
        </div>
      </Modal>

      {/* 8. Modal Tạo Jira Task / Bug từ Requirement Item */}
      {creatingJiraForReq && (
        <Modal
          open={true}
          onClose={() => setCreatingJiraForReq(null)}
          title={`+ Tạo Jira Issue cho [${creatingJiraForReq.reqKey}]`}
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-3 text-xs text-blue-900">
              <p className="font-bold">Đang liên kết với Yêu cầu Confluence:</p>
              <p className="mt-0.5 font-mono text-[11px] text-blue-800">
                [{creatingJiraForReq.reqKey}] - {creatingJiraForReq.reqTitle}
              </p>
            </div>

            {/* Chọn Loại Task / Bug */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setJiraIssueType('TASK')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-colors',
                  jiraIssueType === 'TASK'
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-600',
                )}
              >
                <span>☑️</span>
                <span>Task (Công việc)</span>
              </button>
              <button
                type="button"
                onClick={() => setJiraIssueType('BUG')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-colors',
                  jiraIssueType === 'BUG'
                    ? 'border-rose-600 bg-rose-50 text-rose-800'
                    : 'border-slate-200 text-slate-600',
                )}
              >
                <span>🐞</span>
                <span>Bug (Lỗi phần mềm)</span>
              </button>
            </div>

            <TextField
              label="Tiêu đề Issue (Summary)"
              value={jiraIssueSummary}
              onChange={(e) => setJiraIssueSummary(e.target.value)}
              placeholder="VD: Triển khai kiểm soát đăng nhập..."
              required
            />

            <TextAreaField
              label="Mô tả chi tiết"
              value={jiraIssueDesc}
              onChange={(e) => setJiraIssueDesc(e.target.value)}
              rows={3}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Độ ưu tiên</label>
                <select
                  value={jiraIssuePriority}
                  onChange={(e) => setJiraIssuePriority(e.target.value as IssuePriority)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none"
                >
                  <option value="HIGHEST">Highest (Cao nhất)</option>
                  <option value="HIGH">High (Cao)</option>
                  <option value="MEDIUM">Medium (Trung bình)</option>
                  <option value="LOW">Low (Thấp)</option>
                </select>
              </div>

              <TextField
                label="Story Points (pts)"
                type="number"
                min={1}
                max={21}
                value={String(jiraStoryPoints)}
                onChange={(e) => setJiraStoryPoints(Number(e.target.value))}
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="secondary" inline onClick={() => setCreatingJiraForReq(null)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                inline
                onClick={async () => {
                  if (!jiraIssueSummary.trim()) return
                  const newIss = await issueApi.createIssue({
                    projectId: activeProjectId,
                    type: jiraIssueType,
                    summary: jiraIssueSummary.trim(),
                    description: jiraIssueDesc.trim(),
                    phaseId: 3,
                    phaseName: 'Phase 3: Sprint Execution & Coding',
                    statusId: 301,
                    statusName: 'To Do',
                    statusCategory: 'TODO',
                    priority: jiraIssuePriority,
                    storyPoints: jiraStoryPoints,
                    assigneeName: user?.fullName || 'Sarah Lin',
                    assigneeRole: 'Thành viên dự án',
                    reporterName: user?.fullName || 'Sarah Lin',
                    linkedDocumentId: creatingJiraForReq.docId,
                    linkedRequirementItemId: creatingJiraForReq.reqId,
                    linkedRequirementKeyCode: creatingJiraForReq.reqKey,
                    linkedRequirementTitle: creatingJiraForReq.reqTitle,
                  })
                  setCreatingJiraForReq(null)
                  issuesAsync.reload()
                  showToast(
                    `Đã tạo thành công Issue ${newIss.key} trên Jira Kanban và kết nối với [${creatingJiraForReq.reqKey}]!`,
                  )
                }}
              >
                + Khởi tạo trên Jira
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
