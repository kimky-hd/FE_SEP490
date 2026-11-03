import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { useI18n } from '@/i18n'
import { useHelpTopic } from '@/help/HelpProvider'
import { documentApi } from '@/api/documentApi'
import { projectApi } from '@/api/projectApi'
import { canSeedDemo, seedAllDemo } from '@/api/mockSeed'
import { useAsync } from '@/lib/useAsync'
import { rememberItem } from '@/lib/recentItems'
import { useAuth } from '@/context/AuthContext'
import { ErrorState, ForbiddenState } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextField } from '@/components/ui/TextField'
import { SelectField } from '@/components/ui/SelectField'
import { DocumentIcon, FolderIcon, MenuIcon, NotesIcon, PlusIcon } from '@/components/ui/icons'
import { PERMISSIONS } from '@/types/rbac'
import type { DocType, DocumentKind, DocumentNodeDto } from '@/types/document'
import { useProjectContext } from '../projects/ProjectLayout'
import { SearchInput } from '@/components/ui/listControls'
import { DocumentTree } from './DocumentTree'
import { DocumentView, type DocFocusState } from './DocumentView'
import { DocumentsHome } from './DocumentsHome'
import { GenerateWizard } from './GenerateWizard'
import { pageTemplate } from './templates'
import {
  DOC_TYPES,
  IconButton,
  PageIcon,
  ShrinkIcon,
  SidebarIcon,
  docErrorMessage,
  docTypeLabel,
  menuItem,
  menuPanel,
  usePopover,
} from './docUi'

const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null)

// Trang mở gần nhất theo dự án: vào lại tab Tài liệu thì mở lại trang đó (trừ khi người dùng chủ động bấm "Tất cả tài liệu").
const lastKey = (projectId: number) => `ssam.docs.last.${projectId}`
function readLastPage(projectId: number) {
  try {
    return num(window.localStorage.getItem(lastKey(projectId)) ?? undefined)
  } catch {
    return null
  }
}
function writeLastPage(projectId: number, documentId: number | null) {
  try {
    if (documentId === null) window.localStorage.removeItem(lastKey(projectId))
    else window.localStorage.setItem(lastKey(projectId), String(documentId))
  } catch {
    // Storage bị chặn: lần sau vào tab sẽ hiện trang chủ tài liệu.
  }
}

// Tab "Tài liệu" của dự án: tràn sát mép khung trắng — cây trang bên trái, bên phải là trang đang mở
// hoặc "trang chủ tài liệu" khi chưa chọn trang. Dự án chưa có trang → màn "Bắt đầu" (ẩn cây).
// ?new=blank|notes (từ trang Tổng quan) mở thẳng hộp tạo trang trống / trình sinh từ ghi chú họp.
export function ProjectDocumentsPage() {
  const { t } = useI18n()
  const { project, can, isArchived, fullscreen, setFullscreen } = useProjectContext()
  const projectId = project.projectId
  const documentId = num(useParams().documentId)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const canView = can(PERMISSIONS.documentView)
  const canEdit = can(PERMISSIONS.documentEdit) && !isArchived
  const canDelete = can(PERMISSIONS.documentDelete) && !isArchived
  const canApprove = can(PERMISSIONS.documentApprove) && !isArchived
  // D09: AI tài liệu (#19–#22) cần document.edit + ai.use + dự án bật AI.
  const canUseAi = can(PERMISSIONS.aiUse)
  // D08: bình luận tài liệu theo comment.view / comment.write.
  const commentAccess = useMemo(
    () => ({ view: can(PERMISSIONS.commentView), write: can(PERMISSIONS.commentWrite) && !isArchived }),
    [can, isArchived],
  )
  // D01: @nhắc trong bình luận — thành viên dự án (GET /projects/{id}/members, E5).
  const membersQ = useAsync(
    () =>
      commentAccess.write
        ? projectApi
            .listMembers(project.projectId)
            .then((list) => list.map((m) => ({ userId: m.userId, fullName: m.fullName })))
            .catch(() => [])
        : Promise.resolve([]),
    [project.projectId, commentAccess.write],
  )

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const treeQ = useAsync(
    () => (canView ? documentApi.listTree(projectId, query || undefined) : Promise.resolve([])),
    [projectId, query, canView],
  )
  const nodes = useMemo(() => treeQ.data ?? [], [treeQ.data])
  const folders = nodes.filter((n) => n.kind === 'FOLDER')

  const [treeOpen, setTreeOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  )
  const newMenu = usePopover()
  const [newNode, setNewNode] = useState<NewNodeTarget | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DocumentNodeDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const treeLoaded = treeQ.data !== undefined
  const newParam = params.get('new')

  // Lần đầu vào tab (chưa chỉ định trang, không kèm ?new=) → mở lại trang xem gần nhất nếu còn tồn tại.
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || !treeLoaded || query) return
    restored.current = true
    if (documentId !== null || newParam) return
    const last = readLastPage(projectId)
    if (last !== null && nodes.some((n) => n.documentId === last && n.kind === 'PAGE')) {
      navigate(`/projects/${projectId}/documents/${last}`, { replace: true })
    }
  }, [treeLoaded, query, documentId, newParam, nodes, navigate, projectId])

  // ?new=blank|notes: mở hộp tạo tương ứng rồi bỏ tham số khỏi URL.
  useEffect(() => {
    if (!newParam || !treeLoaded) return
    if (canEdit) {
      if (newParam === 'notes') setWizardOpen(true)
      else setNewNode({ kind: 'PAGE', parentId: null, docType: 'OTHER' })
    }
    setParams(
      (p) => {
        p.delete('new')
        return p
      },
      { replace: true },
    )
  }, [newParam, treeLoaded, canEdit, setParams])

  const empty = treeLoaded && !treeQ.error && !query && nodes.length === 0
  // Chỉ mở trang khi cây đã tải: mock seed / quyền đi theo request cây, và id lạ thì báo "không tồn tại"
  // thay vì lỗi thô từ API chi tiết.
  const inTree = documentId !== null && nodes.some((n) => n.documentId === documentId && n.kind === 'PAGE')
  const docState: 'none' | 'loading' | 'open' | 'missing' =
    documentId === null
      ? 'none'
      : !treeLoaded || treeQ.error
        ? 'loading'
        : inTree || query
          ? 'open'
          : treeQ.isLoading
            ? 'loading'
            : 'missing'

  useRememberOpenPage(projectId, docState === 'open' && !query ? documentId : null)

  // "Tiếp tục" trong Ctrl K.
  const { user } = useAuth()
  const openNode = docState === 'open' ? nodes.find((n) => n.documentId === documentId) : undefined
  useEffect(() => {
    if (user && openNode)
      rememberItem(user.id, {
        href: `/projects/${projectId}/documents/${openNode.documentId}`,
        title: openNode.title,
        code: openNode.code,
      })
  }, [user, openNode, projectId])

  if (!canView)
    return (
      <ForbiddenState
        message={t('Bạn chưa có quyền xem tài liệu của dự án này.', "You can't view this project's documents yet.")}
      />
    )

  const reloadTree = () => void treeQ.reload()
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches
  const openPage = (id: number, state?: DocFocusState) => {
    navigate(`/projects/${projectId}/documents/${id}`, state ? { state } : undefined)
    if (!isDesktop()) setTreeOpen(false)
  }
  const goHome = () => {
    writeLastPage(projectId, null)
    if (!isDesktop()) setTreeOpen(false)
  }

  const move = async (node: DocumentNodeDto, dir: -1 | 1) => {
    const siblings = nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.sortOrder - b.sortOrder)
    const index = siblings.findIndex((n) => n.documentId === node.documentId)
    try {
      await documentApi.updateNode(node.documentId, { sortOrder: index + dir })
      reloadTree()
    } catch (err) {
      setActionError(docErrorMessage(err))
    }
  }
  const rename = async (node: DocumentNodeDto, title: string) => {
    try {
      await documentApi.updateNode(node.documentId, { title })
      reloadTree()
    } catch (err) {
      setActionError(docErrorMessage(err))
    }
  }

  const afterCreate = async (id: number) => {
    await treeQ.reload()
    openPage(id, { focusEditor: true })
  }
  const startBlank = () => setNewNode({ kind: 'PAGE', parentId: null, docType: 'OTHER' })
  const startFolder = () => setNewNode({ kind: 'FOLDER', parentId: null })

  const treeColumn = (
    <aside
      aria-label={t('Cây tài liệu', 'Document tree')}
      className={clsx(
        'flex w-[264px] shrink-0 flex-col border-r border-gray-200 bg-gray-50',
        'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-[min(18rem,85vw)] max-lg:shadow-float',
        !treeOpen && 'hidden',
      )}
    >
      <div
        className={clsx(
          'flex shrink-0 items-center gap-1.5 p-2.5',
          fullscreen && 'h-[52px] border-b border-gray-200 lg:py-0',
        )}
      >
        <SearchInput
          className="min-w-0 flex-1"
          value={search}
          onChange={setSearch}
          label={t('Tìm trang', 'Search pages')}
          placeholder={t('Tìm trang', 'Search pages')}
        />
        {canEdit && (
          <div ref={newMenu.ref} className="relative">
            <Button
              inline
              variant="secondary"
              onClick={() => newMenu.setOpen((v) => !v)}
              aria-expanded={newMenu.open}
              className="px-2.5 lg:h-9"
            >
              <PlusIcon className="h-4 w-4" />
              {t('Mới', 'New')}
            </Button>
            {newMenu.open && (
              <div className={clsx(menuPanel, 'right-0 top-full w-56')} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => (newMenu.setOpen(false), startBlank())}
                >
                  <PageIcon className="text-gray-500" />
                  {t('Trang trống', 'Blank page')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => (newMenu.setOpen(false), setWizardOpen(true))}
                >
                  <NotesIcon className="h-4 w-4 text-gray-500" />
                  {t('Từ ghi chú họp', 'From meeting notes')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => (newMenu.setOpen(false), startFolder())}
                >
                  <FolderIcon className="h-4 w-4 text-gray-500" />
                  {t('Thư mục', 'Folder')}
                </button>
              </div>
            )}
          </div>
        )}
        <IconButton
          label={t('Ẩn cây trang', 'Hide page tree')}
          onClick={() => setTreeOpen(false)}
          className={clsx('hidden', !fullscreen && 'lg:inline-flex')}
        >
          <SidebarIcon />
        </IconButton>
      </div>
      <div className={clsx('min-h-0 flex-1 overflow-y-auto px-2 pb-4', fullscreen && 'pt-2')}>
        <Link
          to={`/projects/${projectId}/documents`}
          onClick={goHome}
          aria-current={documentId === null ? 'page' : undefined}
          className={clsx(
            'mb-1.5 mt-0.5 flex min-h-9 items-center rounded-control px-2.5 text-sm font-medium transition-colors lg:min-h-8',
            documentId === null
              ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-200'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
          )}
        >
          {t('Tất cả tài liệu', 'All documents')}
        </Link>
        {treeQ.error ? (
          <ErrorState message={docErrorMessage(treeQ.error)} onRetry={reloadTree} />
        ) : treeQ.isLoading && !treeQ.data ? (
          <p className="px-3 py-2 text-sm text-gray-500">{t('Đang tải…', 'Loading…')}</p>
        ) : (
          <DocumentTree
            projectId={projectId}
            nodes={nodes}
            activeId={documentId}
            canEdit={canEdit}
            canDelete={canDelete}
            onAddChild={(parent) => setNewNode({ kind: 'PAGE', parentId: parent.documentId })}
            onRename={(n, title) => void rename(n, title)}
            onMove={(n, d) => void move(n, d)}
            onDelete={setDeleteTarget}
          />
        )}
      </div>
    </aside>
  )

  // Thanh mảnh 52px ở chế độ toàn màn hình khi chưa mở trang nào (trang đang mở tự vẽ thanh của nó).
  const fullscreenBar = fullscreen && (
    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-gray-200 px-3 text-sm sm:px-4">
      <IconButton
        label={treeOpen ? t('Ẩn cây trang', 'Hide page tree') : t('Hiện cây trang', 'Show page tree')}
        onClick={() => setTreeOpen((v) => !v)}
        active={treeOpen}
      >
        <MenuIcon className="h-4 w-4" />
      </IconButton>
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-gray-950">{project.name}</span>
        <span className="text-gray-500"> / {t('Tất cả tài liệu', 'All documents')}</span>
      </p>
      <IconButton
        label={t('Thoát toàn màn hình (Esc)', 'Exit full screen (Esc)')}
        onClick={() => setFullscreen(false)}
        className="border border-gray-200 text-gray-600"
      >
        <ShrinkIcon />
      </IconButton>
    </div>
  )

  let mainArea
  if (docState === 'open' && documentId !== null) {
    mainArea = (
      <DocumentView
        key={documentId}
        documentId={documentId}
        nodes={nodes}
        treeOpen={treeOpen}
        onToggleTree={() => setTreeOpen((v) => !v)}
        onTreeChanged={reloadTree}
        onDeleteRequest={setDeleteTarget}
        fullscreen={fullscreen}
        projectName={project.name}
        onExitFullscreen={() => setFullscreen(false)}
        onFromNotes={canEdit ? () => setWizardOpen(true) : undefined}
        aiEnabled={project.aiEnabled && canUseAi}
        commentAccess={commentAccess}
        mentionPeople={(membersQ.data ?? []).filter((m) => m.userId !== user?.id)}
      />
    )
  } else if (docState === 'none' && treeLoaded && !treeQ.error && !empty) {
    mainArea = (
      <div className="flex min-w-0 flex-1 flex-col">
        {fullscreenBar}
        <DocumentsHome
          projectId={projectId}
          nodes={nodes}
          canEdit={canEdit}
          canApprove={canApprove}
          onToggleTree={() => setTreeOpen(true)}
          onBlank={startBlank}
          onNotes={() => setWizardOpen(true)}
          onFolder={startFolder}
        />
      </div>
    )
  } else {
    mainArea = (
      <div className="flex min-w-0 flex-1 flex-col">
        {fullscreenBar}
        {!empty && !fullscreen && (
          <div className="flex h-12 items-center border-b border-gray-200 px-3 lg:hidden">
            <IconButton label={t('Hiện cây trang', 'Show page tree')} onClick={() => setTreeOpen(true)}>
              <SidebarIcon />
            </IconButton>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
          {docState === 'missing' ? (
            <div className="max-w-sm text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-control border border-gray-200 bg-white text-gray-500 shadow-xs">
                <DocumentIcon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-gray-950">
                {t('Trang này không tồn tại hoặc đã bị xoá', "This page doesn't exist or was deleted")}
              </p>
              <Button
                inline
                variant="secondary"
                className="mt-4"
                onClick={() => navigate(`/projects/${projectId}/documents`, { replace: true })}
              >
                {t('Về trang tài liệu', 'Back to documents')}
              </Button>
            </div>
          ) : empty ? (
            canEdit ? (
              <StartScreen
                onWizard={() => setWizardOpen(true)}
                onTemplate={(docType) =>
                  setNewNode({ kind: 'PAGE', parentId: null, docType, title: templateTitle(docType, t) })
                }
                onBlank={startBlank}
                onSeedDemo={
                  canSeedDemo
                    ? async () => {
                        try {
                          await seedAllDemo(projectId)
                          await treeQ.reload()
                        } catch (err) {
                          setActionError(docErrorMessage(err))
                        }
                      }
                    : undefined
                }
              />
            ) : (
              <div className="max-w-sm text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-control border border-gray-200 bg-white text-gray-500 shadow-xs">
                  <DocumentIcon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-gray-950">{t('Chưa có tài liệu', 'No documents yet')}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {t(
                    'Khi đội dự án tạo trang, bạn sẽ thấy ở đây.',
                    'Pages the project team creates will show up here.',
                  )}
                </p>
              </div>
            )
          ) : (
            <p className="text-sm text-gray-500">
              {treeQ.error
                ? t('Không tải được cây trang.', "Couldn't load the page tree.")
                : query && documentId === null
                  ? t('Chọn một trang trong kết quả tìm kiếm.', 'Pick a page from the results.')
                  : t('Đang tải…', 'Loading…')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      {treeOpen && !empty && (
        <button
          type="button"
          aria-label={t('Đóng cây trang', 'Close page tree')}
          onClick={() => setTreeOpen(false)}
          className="fixed inset-0 z-30 bg-gray-950/20 lg:hidden"
        />
      )}
      {/* Cây trang ẩn cho tới khi dự án có trang đầu tiên. */}
      {!empty && (treeLoaded || !!treeQ.error) && treeColumn}

      {mainArea}

      <NewNodeModal
        target={newNode}
        folders={folders}
        projectId={projectId}
        onClose={() => setNewNode(null)}
        onCreated={(node) => {
          setNewNode(null)
          if (node.kind === 'PAGE') void afterCreate(node.documentId)
          else reloadTree()
        }}
      />

      <GenerateWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        projectId={projectId}
        aiEnabled={project.aiEnabled}
        canUseAi={canUseAi}
        folders={folders}
        defaultParentId={folders.find((f) => /srs|đặc tả/i.test(f.title))?.documentId ?? folders[0]?.documentId ?? null}
        onCreated={(detail) => {
          setWizardOpen(false)
          void afterCreate(detail.node.documentId)
        }}
      />

      <Modal
        open={!!deleteTarget}
        tone="danger"
        title={t(`Xoá "${deleteTarget?.title ?? ''}"?`, `Delete "${deleteTarget?.title ?? ''}"?`)}
        description={t('Các trang con cũng bị xoá.', 'Sub-pages are deleted too.')}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button inline variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('Huỷ', 'Cancel')}
            </Button>
            <DeleteButton
              onConfirm={async () => {
                if (!deleteTarget) return
                try {
                  await documentApi.deleteNode(deleteTarget.documentId)
                  const wasOpen = deleteTarget.documentId === documentId
                  setDeleteTarget(null)
                  reloadTree()
                  if (wasOpen) navigate(`/projects/${projectId}/documents`, { replace: true })
                } catch (err) {
                  setDeleteTarget(null)
                  setActionError(docErrorMessage(err))
                }
              }}
            />
          </>
        }
      >
        {deleteTarget?.currentVersion?.status === 'APPROVED' ? (
          <p className="text-sm text-gray-600">
            {t(
              'Trang này đã có bản được duyệt. Việc xoá được ghi vào lịch sử.',
              'This page has an approved version. The deletion is recorded in the history.',
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            {t('Không thể hoàn tác từ giao diện.', "This can't be undone from the app.")}
          </p>
        )}
      </Modal>

      {actionError && (
        <div
          role="alert"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-control bg-red-700 px-4 py-2.5 text-sm text-white shadow-pop"
        >
          {actionError}
          <button type="button" className="ml-3 font-medium underline" onClick={() => setActionError(null)}>
            {t('Đóng', 'Dismiss')}
          </button>
        </div>
      )}
    </div>
  )
}

interface NewNodeTarget {
  kind: DocumentKind
  parentId: number | null
  docType?: DocType
  title?: string
}

const TEMPLATE_TYPES: { docType: Exclude<DocType, 'OTHER'>; vi: string; en: string }[] = [
  { docType: 'URD', vi: 'Yêu cầu người dùng', en: 'User requirements' },
  { docType: 'BRD', vi: 'Yêu cầu nghiệp vụ', en: 'Business requirements' },
  { docType: 'SRS', vi: 'Đặc tả phần mềm', en: 'Software spec' },
]

function templateTitle(docType: DocType, t: (vi: string, en: string) => string) {
  const x = TEMPLATE_TYPES.find((d) => d.docType === docType)
  return x ? `${t(x.vi, x.en)} (${docType})` : ''
}

// Màn hình bắt đầu khi dự án chưa có tài liệu: 3 cách tạo trang đầu tiên ("Từ ghi chú họp" được làm nổi).
function StartScreen({
  onWizard,
  onTemplate,
  onBlank,
  onSeedDemo,
}: {
  onWizard: () => void
  onTemplate: (docType: DocType) => void
  onBlank: () => void
  onSeedDemo?: () => Promise<void>
}) {
  const { t } = useI18n()
  useHelpTopic('project.documents.start')
  const [seeding, setSeeding] = useState(false)
  const card =
    'flex flex-col items-center rounded-card border bg-white px-4 py-5 text-center shadow-xs transition-colors'
  const focus = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100'
  const icon = 'flex h-10 w-10 items-center justify-center rounded-[10px]'
  return (
    <div className="w-full max-w-3xl py-6 text-center">
      <h2 className="text-xl font-bold tracking-tight text-gray-950">
        {t('Bắt đầu tài liệu cho dự án', 'Start the project documentation')}
      </h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-gray-500">
        {t(
          'Chọn cách tạo trang đầu tiên. Bạn luôn có thể thêm thư mục và trang sau.',
          'Pick how to create the first page. You can always add folders and pages later.',
        )}
      </p>
      <div className="mx-auto mt-6 grid max-w-[688px] gap-3.5 sm:grid-cols-3">
        <button
          type="button"
          onClick={onWizard}
          className={clsx(
            card,
            focus,
            'border-brand-200 shadow-[0_0_0_3px_theme(colors.brand.50)] hover:border-brand-400',
          )}
        >
          <span className={clsx(icon, 'bg-brand-50 text-brand-600')}>
            <NotesIcon className="h-5 w-5" />
          </span>
          <span className="mt-2.5 text-sm font-medium text-gray-950">{t('Từ ghi chú họp', 'From meeting notes')}</span>
          <span className="mt-1 text-[13px] text-gray-500">
            {t(
              'Dán ghi chú, SSAM tách thành REQ có tiêu chí nghiệm thu.',
              'Paste notes; SSAM splits them into REQs with acceptance criteria.',
            )}
          </span>
          <span className="mt-2.5 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
            {t('Nhanh nhất', 'Fastest')}
          </span>
        </button>

        <div className={clsx(card, 'border-gray-200')}>
          <span className={clsx(icon, 'bg-violet-100 text-violet-700')}>
            <TemplateIcon />
          </span>
          <span className="mt-2.5 text-sm font-medium text-gray-950">{t('Từ mẫu', 'From a template')}</span>
          <span className="mt-1 text-[13px] text-gray-500">
            {t('Khung mục chuẩn có sẵn.', 'A standard outline, ready to fill.')}
          </span>
          <div
            className="mt-2.5 flex justify-center gap-1.5"
            role="group"
            aria-label={t('Chọn mẫu', 'Pick a template')}
          >
            {TEMPLATE_TYPES.map((x) => (
              <button
                key={x.docType}
                type="button"
                title={t(x.vi, x.en)}
                onClick={() => onTemplate(x.docType)}
                className={clsx(
                  'min-h-8 rounded-[5px] border border-gray-200 bg-gray-50 px-2 text-xs font-medium text-gray-600 hover:border-brand-300 hover:bg-white hover:text-brand-700 lg:min-h-6',
                  focus,
                )}
              >
                {x.docType}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onBlank}
          className={clsx(card, focus, 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}
        >
          <span className={clsx(icon, 'bg-gray-100 text-gray-600')}>
            <PageIcon className="h-5 w-5" />
          </span>
          <span className="mt-2.5 text-sm font-medium text-gray-950">{t('Trang trống', 'Blank page')}</span>
          <span className="mt-1 text-[13px] text-gray-500">
            {t('Tự viết từ đầu, gõ "/" để chèn khối.', 'Write from scratch; type "/" to insert blocks.')}
          </span>
        </button>
      </div>
      {onSeedDemo && (
        <p className="mt-5 text-[13px] text-gray-500">
          {t('Hoặc ', 'Or ')}
          <button
            type="button"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true)
              await onSeedDemo()
              setSeeding(false)
            }}
            className="rounded-control font-medium text-brand-700 underline-offset-4 hover:underline disabled:opacity-60"
          >
            {seeding
              ? t('đang tạo dữ liệu mẫu…', 'creating sample data…')
              : t('tạo dữ liệu mẫu để xem thử', 'create sample data to try it out')}
          </button>
        </p>
      )}
    </div>
  )
}

function TemplateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M9 9v11" />
    </svg>
  )
}

/** Ghi nhớ trang đang mở để lần sau vào tab mở lại đúng trang đó. */
function useRememberOpenPage(projectId: number, documentId: number | null) {
  useEffect(() => {
    if (documentId !== null) writeLastPage(projectId, documentId)
  }, [projectId, documentId])
}

function DeleteButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      inline
      isLoading={busy}
      className="bg-red-600 hover:bg-red-700 active:bg-red-800"
      onClick={async () => {
        setBusy(true)
        await onConfirm()
        setBusy(false)
      }}
    >
      {t('Xoá', 'Delete')}
    </Button>
  )
}

function NewNodeModal({
  target,
  folders,
  projectId,
  onClose,
  onCreated,
}: {
  target: NewNodeTarget | null
  folders: DocumentNodeDto[]
  projectId: number
  onClose: () => void
  onCreated: (node: DocumentNodeDto) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState<DocType>('SRS')
  const [useTemplate, setUseTemplate] = useState(true)
  const [parentId, setParentId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPage = target?.kind === 'PAGE'

  useEffect(() => {
    if (!target) return
    setTitle(target.title ?? '')
    setError(null)
    setParentId(target.parentId)
    setDocType(target.docType ?? 'SRS')
    setUseTemplate(true)
  }, [target])

  const submit = async () => {
    if (!target || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const node = await documentApi.createNode(projectId, {
        kind: target.kind,
        title: title.trim(),
        parentId,
        docType: isPage ? docType : undefined,
      })
      if (isPage && useTemplate && docType !== 'OTHER') {
        const d = await documentApi.get(node.documentId)
        await documentApi.saveContent(node.documentId, d.current.versionId, {
          content: pageTemplate(docType, t),
          rowVersion: d.current.rowVersion,
        })
      }
      onCreated(node)
    } catch (err) {
      setError(docErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const parentIsFolder = target?.parentId === null || folders.some((f) => f.documentId === target?.parentId)

  return (
    <Modal
      open={!!target}
      title={isPage ? t('Trang mới', 'New page') : t('Thư mục mới', 'New folder')}
      onClose={onClose}
      footer={
        <>
          <Button inline variant="secondary" onClick={onClose}>
            {t('Huỷ', 'Cancel')}
          </Button>
          <Button inline type="submit" form="new-node" isLoading={busy} disabled={!title.trim()}>
            {t('Tạo', 'Create')}
          </Button>
        </>
      }
    >
      <form
        id="new-node"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {error && <p className="rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <TextField
          id="new-node-title"
          label={t('Tiêu đề', 'Title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus
        />
        {isPage && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="new-node-type"
                label={t('Loại tài liệu', 'Document type')}
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
              >
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {docTypeLabel(d)}
                  </option>
                ))}
              </SelectField>
              {parentIsFolder && (
                <SelectField
                  id="new-node-parent"
                  label={t('Lưu vào', 'Save to')}
                  value={parentId ?? ''}
                  onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{t('Gốc', 'Top level')}</option>
                  {folders.map((f) => (
                    <option key={f.documentId} value={f.documentId}>
                      {f.title}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>
            {docType !== 'OTHER' && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={useTemplate}
                  onChange={(e) => setUseTemplate(e.target.checked)}
                />
                {t(`Bắt đầu với khung mục chuẩn ${docType}`, `Start with the standard ${docType} outline`)}
              </label>
            )}
          </>
        )}
      </form>
    </Modal>
  )
}
