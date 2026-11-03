import { useMemo, useRef, useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { Editor } from '@tiptap/react'
import { useI18n } from '@/i18n'
import { documentApi } from '@/api/documentApi'
import type { VersionConflictCurrent } from '@/types/auth'
import type { MentionPerson } from '@/components/work/MentionInput'
import { useAsync } from '@/lib/useAsync'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import type {
  DocumentActivityDto,
  DocumentCommentDto,
  DocumentDetailDto,
  DocumentNodeDto,
  Priority,
  RequirementItemDto,
  TipTapDoc,
  VersionStatus,
} from '@/types/document'
import { DocEditor } from './editor/DocEditor'
import type { DocMarksInput } from './editor/docMarks'
import { SidePanel, type PanelTab } from './SidePanel'
import { docErrorMessage } from './docUi'
import { useDocumentAutosave } from './view/useDocumentAutosave'
import { useLiveDiff } from './view/useLiveDiff'
import { Toast, useToast } from './view/Toast'
import { PrintView, usePrint } from './view/PrintView'
import { BlockCompareModal, ConflictModal, RequestChangesModal } from './view/DocumentModals'
import { CompareBar, DocumentTopBar } from './view/DocumentTopBar'
import { useVersionCompare } from './view/useVersionCompare'
import { useReviewActions } from './view/useReviewActions'
import { DocumentHeading } from './view/DocumentHeading'
import { anchorOfReq, scrollToAnchor, setHeadingPriority } from './view/editorDom'
import { useReqLinkCounts } from '../kanban/reqLinkCounts'

const EDITABLE: VersionStatus[] = ['DRAFT', 'CHANGES_REQUESTED']

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined)

interface Props {
  documentId: number
  nodes: DocumentNodeDto[]
  treeOpen: boolean
  onToggleTree: () => void
  onTreeChanged: () => void
  onDeleteRequest: (node: DocumentNodeDto) => void
  /** Chế độ toàn màn hình: thanh trên thành dải 52px có ☰ (cây trang), đường dẫn kèm tên dự án và ⤡ thoát. */
  fullscreen?: boolean
  projectName?: string
  onExitFullscreen?: () => void
  /** Mở trình "Từ ghi chú họp" (nút gợi ý ở trang trống). */
  onFromNotes?: () => void
  /** project.aiEnabled + quyền ai.use: bật lối vào AI sinh sơ đồ trong editor (#22, D09). */
  aiEnabled?: boolean
  /** D08: quyền bình luận tài liệu (`comment.view` / `comment.write`, ghi đã trừ dự án lưu trữ). */
  commentAccess?: { view: boolean; write: boolean }
  /** D01: thành viên dự án để @nhắc trong bình luận. */
  mentionPeople?: MentionPerson[]
}

const ALL_COMMENT_ACCESS = { view: true, write: true }

/** State điều hướng khi vừa tạo trang: DocumentView tự focus editor (tiêu đề nếu trống, không thì cuối nội dung). */
export interface DocFocusState {
  focusEditor?: boolean
}

export function DocumentView({
  documentId,
  nodes,
  treeOpen,
  onToggleTree,
  onTreeChanged,
  onDeleteRequest,
  fullscreen = false,
  projectName,
  onExitFullscreen,
  onFromNotes,
  aiEnabled,
  commentAccess,
  mentionPeople,
}: Props) {
  const [params, setParams] = useSearchParams()
  const viewId = num(params.get('v'))
  const cmpId = num(params.get('cmp'))
  const detailQ = useAsync(() => documentApi.get(documentId, viewId), [documentId, viewId])
  const [editorKey, setEditorKey] = useState(0)

  if (detailQ.error && !detailQ.data) {
    return (
      <div className="p-6">
        <ErrorState message={docErrorMessage(detailQ.error)} onRetry={detailQ.reload} />
      </div>
    )
  }
  if (!detailQ.data || (detailQ.isLoading && detailQ.data.node.documentId !== documentId)) {
    return (
      <div className="p-6">
        <LoadingBlock />
      </div>
    )
  }
  return (
    <LoadedDocument
      key={`${detailQ.data.current.versionId}-${editorKey}`}
      detail={detailQ.data}
      setDetail={(d) => detailQ.setData(() => d)}
      reload={() => {
        void detailQ.reload()
        setEditorKey((k) => k + 1)
      }}
      cmpId={cmpId}
      setParams={setParams}
      nodes={nodes}
      treeOpen={treeOpen}
      onToggleTree={onToggleTree}
      onTreeChanged={onTreeChanged}
      onDeleteRequest={onDeleteRequest}
      fullscreen={fullscreen}
      projectName={projectName}
      onExitFullscreen={onExitFullscreen}
      onFromNotes={onFromNotes}
      aiEnabled={aiEnabled}
      commentAccess={commentAccess}
      mentionPeople={mentionPeople}
    />
  )
}

interface LoadedProps extends Omit<Props, 'documentId'> {
  detail: DocumentDetailDto
  setDetail: (d: DocumentDetailDto) => void
  reload: () => void
  cmpId: number | undefined
  setParams: ReturnType<typeof useSearchParams>[1]
}

function LoadedDocument({
  detail,
  setDetail,
  reload,
  cmpId,
  setParams,
  nodes,
  treeOpen,
  onToggleTree,
  onTreeChanged,
  onDeleteRequest,
  fullscreen = false,
  projectName,
  onExitFullscreen,
  onFromNotes,
  aiEnabled,
  commentAccess = ALL_COMMENT_ACCESS,
  mentionPeople = [],
}: LoadedProps) {
  const { t } = useI18n()
  const { node, current, can, versions } = detail
  const documentId = node.documentId
  const latestId = node.currentVersion?.versionId ?? current.versionId
  const isLatest = current.versionId === latestId
  const editableStatus = EDITABLE.includes(current.status)
  const inReviewForMe = isLatest && current.status === 'IN_REVIEW' && can.approve

  // ---------- So sánh ----------
  const defaultBaseId =
    isLatest && node.baselineVersionId && node.baselineVersionId !== current.versionId
      ? node.baselineVersionId
      : current.baseVersionId
  const baseId = cmpId ?? defaultBaseId ?? null
  const baseQ = useAsync(
    () => (baseId ? documentApi.get(documentId, baseId) : Promise.resolve(null)),
    [documentId, baseId],
  )
  const base = baseQ.data?.current ?? null
  const [editor, setEditor] = useState<Editor | null>(null)
  const versionNav = useVersionCompare({
    editor,
    versionId: current.versionId,
    latestId,
    cmpId,
    compareByDefault: inReviewForMe,
    setParams,
  })
  const { compare, setCompare, openVersion } = versionNav
  const editable = can.edit && isLatest && editableStatus && !compare

  // ---------- Danh sách phụ ----------
  const reqsQ = useAsync(
    () => documentApi.listRequirements(documentId, current.versionId),
    [documentId, current.versionId],
  )
  const commentsQ = useAsync(
    () =>
      commentAccess.view
        ? documentApi.listComments(documentId, { versionId: current.versionId })
        : Promise.resolve([] as DocumentCommentDto[]),
    [documentId, current.versionId, commentAccess.view],
  )
  const canComment = commentAccess.write && isLatest
  // Tự lưu là ghi "lặng" (không tải lại toàn app) nên lịch sử tự làm mới khi mở bảng Lịch sử.
  const activityQ = useAsync(() => documentApi.activity(documentId), [documentId])
  const genQ = useAsync(() => documentApi.getGeneration(documentId).catch(() => null), [documentId])
  const requirements = useMemo(() => reqsQ.data ?? [], [reqsQ.data])
  const comments = useMemo(() => commentsQ.data ?? [], [commentsQ.data])
  const activity = activityQ.data ?? []

  const [panel, setPanel] = useState<PanelTab | null>(null)
  const panelRef = useRef(panel)
  panelRef.current = panel
  const reloadActivity = activityQ.reload
  useEffect(() => {
    if (panel === 'history') void reloadActivity()
  }, [panel, reloadActivity])
  const linkCounts = useReqLinkCounts(node.projectId, documentId, panel === 'reqs')
  const [pending, setPending] = useState<{ anchorId: string; quote: string } | null>(null)
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null)
  const [highlightReqUid, setHighlightReqUid] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'changes' | 'conflict' | { blockId: string }>(null)
  const [conflict, setConflict] = useState<VersionConflictCurrent | null>(null)
  const { toast, notify } = useToast()
  const { printing, print } = usePrint()

  // ---------- Editor + thông tin diff trực tiếp ----------
  const titleRef = useRef<HTMLTextAreaElement | null>(null)
  const { diff, sections, reqKeys } = useLiveDiff(editor)

  // Vừa tạo trang (trống / mẫu / từ ghi chú họp): đặt con trỏ sẵn để gõ ngay, rồi bỏ cờ khỏi history.
  const location = useLocation()
  const navigate = useNavigate()
  const wantsFocus = (location.state as DocFocusState | null)?.focusEditor === true
  useEffect(() => {
    if (!wantsFocus || !editor) return
    const id = requestAnimationFrame(() => {
      if (can.edit && titleRef.current && !titleRef.current.value.trim()) titleRef.current.focus()
      else if (editable) editor.commands.focus('end')
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsFocus, editor])

  const hasBase = !!base && base.versionId !== current.versionId
  const changeCount = hasBase ? (diff?.count ?? 0) : 0
  const changedBlocksByReq = useMemo(() => {
    const m = new Map<string, number>()
    if (!diff) return m
    for (const s of sections)
      m.set(s.reqUid, s.ids.filter((id) => diff.blocks.get(id) && diff.blocks.get(id)?.status !== 'format').length)
    return m
  }, [diff, sections])

  const marks = useMemo<DocMarksInput>(
    () => ({
      base: hasBase ? base!.content : null,
      baseLabel: base?.label ?? null,
      compare: compare && hasBase,
      staleReqUids: requirements.filter((r) => r.freshness === 'STALE').map((r) => r.reqUid),
      comments: comments.map((c) => ({ commentId: c.commentId, anchorId: c.anchorId, quote: c.quote })),
      activeCommentId,
    }),
    [hasBase, base, compare, requirements, comments, activeCommentId],
  )
  const commentCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of comments) if (c.anchorId && !c.parentId) m[c.anchorId] = (m[c.anchorId] ?? 0) + 1
    return m
  }, [comments])

  // ---------- Tự lưu ----------
  const autosave = useDocumentAutosave({
    editor,
    documentId,
    versionId: current.versionId,
    initialRowVersion: current.rowVersion,
    initialSubtitle: current.subtitle ?? '',
    initialReqCount: node.reqCount,
    onSaved: (res) => {
      reqsQ.setData(() => res.requirements)
      if (panelRef.current === 'history') void activityQ.reload()
    },
    onReqCountChange: onTreeChanged,
    onConflict: (cur) => {
      setConflict(cur)
      setModal('conflict')
    },
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------- Vòng đời phiên bản ----------
  const review = useReviewActions({
    detail,
    isLatest,
    editableStatus,
    flush: autosave.flush,
    onChanged: (next) => {
      setDetail(next)
      onTreeChanged()
    },
    onBackToLatest: () => setParams({}, { replace: true }),
    notify,
  })

  // ---------- Yêu cầu (RTM) ----------
  const changePriority = (r: RequirementItemDto, p: Priority) => {
    if (!editor || !editable || !setHeadingPriority(editor, r.reqUid, p)) return
    reqsQ.setData((list) => list?.map((x) => (x.requirementId === r.requirementId ? { ...x, priority: p } : x)))
  }
  const confirmFresh = async (r: RequirementItemDto) => {
    try {
      const updated = await documentApi.confirmFresh(r.requirementId)
      reqsQ.setData((list) =>
        list?.map((x) => (x.reqUid === updated.reqUid ? { ...x, freshness: updated.freshness } : x)),
      )
      void activityQ.reload()
      notify(t(`${r.reqKey} đã được xác nhận.`, `${r.reqKey} marked up to date.`))
    } catch (err) {
      notify(docErrorMessage(err), 'error')
    }
  }

  // ---------- Bình luận ----------
  const addComment = async (body: string, opts: { parentId: number | null; mentionUserIds: number[] }) => {
    const reply = opts.parentId !== null
    try {
      const c = await documentApi.addComment(documentId, {
        versionId: current.versionId,
        anchorId: reply ? null : (pending?.anchorId ?? null),
        quote: reply ? null : (pending?.quote ?? null),
        body,
        parentId: opts.parentId,
        mentionUserIds: opts.mentionUserIds,
      })
      commentsQ.setData((list) => [...(list ?? []), c])
      if (!reply) setPending(null)
      setActiveCommentId(opts.parentId ?? c.commentId)
      return true
    } catch (err) {
      notify(docErrorMessage(err), 'error')
      return false
    }
  }
  const resolveComment = async (c: DocumentCommentDto) => {
    try {
      await documentApi.resolveComment(c.commentId)
      // Resolve bình luận gốc = resolve cả luồng trả lời.
      commentsQ.setData((list) => list?.filter((x) => x.commentId !== c.commentId && x.parentId !== c.commentId))
    } catch (err) {
      notify(docErrorMessage(err), 'error')
    }
  }
  const openComment = (commentId: number) => {
    setActiveCommentId(commentId)
    setPanel('comments')
    setTimeout(
      () => document.getElementById(`comment-${commentId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      50,
    )
  }

  const renameTitle = async (title: string) => {
    if (!title.trim() || title.trim() === node.title) return
    try {
      const n = await documentApi.updateNode(documentId, { title: title.trim() })
      setDetail({ ...detail, node: { ...detail.node, title: n.title } })
      onTreeChanged()
    } catch (err) {
      notify(docErrorMessage(err), 'error')
    }
  }

  // ---------- Hiển thị ----------
  const parent = node.parentId ? nodes.find((n) => n.documentId === node.parentId) : null
  const blockModal = modal && typeof modal === 'object' ? modal : null
  const blockPair = blockModal
    ? {
        before: base?.content.content.find((b) => b.attrs?.id === blockModal.blockId) ?? null,
        after:
          (editor?.getJSON() as TipTapDoc | undefined)?.content.find((b) => b.attrs?.id === blockModal.blockId) ?? null,
      }
    : null

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <DocumentTopBar
          node={node}
          parentTitle={parent?.title ?? null}
          fullscreen={fullscreen}
          projectName={projectName}
          treeOpen={treeOpen}
          onToggleTree={onToggleTree}
          onExitFullscreen={onExitFullscreen}
          editable={editable}
          saveState={autosave.saveState}
          onRetrySave={() => void autosave.save()}
          reqCount={requirements.length}
          commentCount={comments.filter((c) => !c.parentId).length}
          panel={panel}
          onPanel={setPanel}
          primary={review.primary}
          busyKey={review.busy}
          canRequestChanges={review.canReview}
          onRequestChanges={() => setModal('changes')}
          onPrint={print}
          canDelete={can.delete}
          onDelete={() => onDeleteRequest(node)}
        />

        {compare && hasBase && (
          <CompareBar
            currentLabel={current.label}
            baseLabel={base!.label}
            changeIndex={versionNav.changeIndex}
            changeCount={changeCount}
            onJump={versionNav.jump}
            onExit={versionNav.toggleCompare}
          />
        )}

        {/* Nội dung */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Cột đọc tối đa ~820px, căn giữa vùng còn lại. */}
          <article className="mx-auto w-full max-w-[868px] px-5 pb-24 pt-8 sm:px-6">
            <DocumentHeading
              detail={detail}
              isLatest={isLatest}
              activity={activity}
              generation={genQ.data ?? null}
              baseLabel={hasBase ? base!.label : null}
              changeCount={changeCount}
              compare={compare}
              onToggleCompare={versionNav.toggleCompare}
              onOpenVersion={(id) => openVersion(id)}
              onCompareVersions={versionNav.compareVersions}
              onOpenHistory={() => setPanel('history')}
              onBackToLatest={() => setParams({})}
              canRename={can.edit}
              editable={editable}
              titleRef={titleRef}
              onRename={(title) => void renameTitle(title)}
              onSubtitleChange={autosave.setSubtitle}
              onTitleEnter={() => editor?.commands.focus('start')}
            />

            <div className="mt-8">
              <DocEditor
                content={current.content}
                editable={editable}
                canComment={canComment}
                marks={marks}
                highlightReqUid={highlightReqUid}
                commentCounts={isLatest ? commentCounts : {}}
                onReady={setEditor}
                onUserChange={() => editable && autosave.markDirty()}
                onCommentRequest={(anchorId, quote) => {
                  setPending({ anchorId, quote })
                  setPanel('comments')
                }}
                onCommentClick={openComment}
                onCommentBubbleClick={(anchorId) => {
                  const c = comments.find((x) => x.anchorId === anchorId)
                  if (c) openComment(c.commentId)
                }}
                onBlockCompare={(blockId) => setModal({ blockId })}
                docType={node.docType}
                onFromNotes={onFromNotes}
                generateDiagram={
                  aiEnabled
                    ? (body) => documentApi.generateDiagram(node.projectId, { ...body, documentId: node.documentId })
                    : undefined
                }
              />
            </div>
          </article>
        </div>
      </div>

      {panel && (
        <>
          <button
            type="button"
            aria-label={t('Đóng bảng bên', 'Close panel')}
            onClick={() => setPanel(null)}
            className="fixed inset-0 z-30 bg-gray-950/20 lg:hidden"
          />
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l border-gray-200 shadow-float lg:static lg:z-auto lg:w-[340px] lg:max-w-none lg:shrink-0 lg:shadow-none">
            <SidePanel
              tab={panel}
              onTab={setPanel}
              onClose={() => setPanel(null)}
              requirements={requirements}
              changedReqUids={hasBase ? (diff?.changedReqUids ?? null) : null}
              changedBlocksByReq={changedBlocksByReq}
              canEditPriority={editable}
              canConfirm={can.edit}
              onPriority={changePriority}
              onConfirmFresh={(r) => void confirmFresh(r)}
              onSelectReq={(r) => scrollToAnchor(editor, r.anchorId)}
              linkCounts={linkCounts}
              comments={comments}
              canComment={canComment}
              mentionPeople={mentionPeople}
              pending={pending}
              activeCommentId={activeCommentId}
              onCancelPending={() => setPending(null)}
              onAddComment={addComment}
              onResolve={(c) => void resolveComment(c)}
              onSelectComment={(c) => {
                setActiveCommentId(c.commentId)
                if (c.anchorId) scrollToAnchor(editor, c.anchorId)
              }}
              activity={activity}
              versions={versions}
              generation={genQ.data ?? null}
              reqKeyByUid={reqKeys}
              onOpenActivity={(a: DocumentActivityDto) => {
                const idx = versions.findIndex((x) => x.label === a.versionLabel)
                if (idx < 0) return
                const prev = versions[idx + 1]
                openVersion(versions[idx].versionId, prev?.versionId)
                setCompare(!!prev)
              }}
              onHoverGeneratedReq={setHighlightReqUid}
              onSelectGeneratedReq={(uid) => {
                setHighlightReqUid(uid)
                const id = anchorOfReq(editor, uid)
                if (id) scrollToAnchor(editor, id)
              }}
            />
          </div>
        </>
      )}

      <RequestChangesModal
        open={modal === 'changes'}
        busy={review.busy === 'changes'}
        onClose={() => setModal(null)}
        onSubmit={async (note) => {
          if (await review.requestChanges(note)) {
            setModal(null)
            setCompare(false)
          }
        }}
      />
      <ConflictModal
        open={modal === 'conflict'}
        current={conflict}
        onClose={() => setModal(null)}
        onReload={() => {
          autosave.discard()
          setModal(null)
          reload()
        }}
      />
      <BlockCompareModal
        pair={blockPair}
        baseLabel={base?.label ?? ''}
        currentLabel={current.label}
        onClose={() => setModal(null)}
      />

      <Toast toast={toast} />

      {printing && editor && <PrintView detail={detail} html={editor.view.dom.innerHTML} requirements={requirements} />}
    </div>
  )
}
