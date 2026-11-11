import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { DocumentDetailDto, DocumentNodeDto, SaveContentBody, TipTapDoc } from '@/types/document'
import { h, p, tasks } from '@/api/mock/documentSeed'
import { DocumentView } from './DocumentView'

const env = vi.hoisted(() => {
  const mem = new Map<string, string>()
  return {
    storage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) },
    permissions: [
      'document.view',
      'document.edit',
      'document.approve',
      'document.revise',
      'document.delete',
      'comment.view',
      'comment.write',
    ],
  }
})

vi.mock('@/api/documentApi', async () => {
  const { DocumentMockStore } = await import('@/api/mock/documentMockStore')
  const store = new DocumentMockStore({
    actor: async () => ({ userId: 7, fullName: 'Người test' }),
    projectAccess: async () => ({ permissions: env.permissions, aiEnabled: false, archived: false }),
    storage: env.storage,
    latency: () => 0,
  })
  const documentApi = {
    listTree: (pid: number) => store.listTree(pid).then((r) => r.items),
    createNode: store.createNode.bind(store),
    updateNode: store.updateNode.bind(store),
    get: store.getDocument.bind(store),
    saveContent: store.saveContent.bind(store),
    submit: store.submit.bind(store),
    approve: store.approve.bind(store),
    requestChanges: store.requestChanges.bind(store),
    createRevision: store.createRevision.bind(store),
    listRequirements: (id: number, v?: number) => store.listRequirements(id, v).then((r) => r.items),
    listComments: (id: number, p?: { versionId?: number }) => store.listComments(id, p).then((r) => r.items),
    activity: (id: number) => store.listActivity(id).then((r) => r.items),
    getGeneration: store.getGeneration.bind(store),
    confirmFresh: store.confirmFresh.bind(store),
    addComment: store.addComment.bind(store),
    resolveComment: store.resolveComment.bind(store),
  }
  return { documentApi, isDocumentsMock: true }
})

const { documentApi } = (await import('@/api/documentApi')) as unknown as {
  documentApi: {
    listTree: (pid: number) => Promise<DocumentNodeDto[]>
    createNode: (pid: number, body: { kind: 'PAGE'; title: string; docType: 'URD' }) => Promise<DocumentNodeDto>
    get: (id: number) => Promise<DocumentDetailDto>
    saveContent: (id: number, versionId: number, body: SaveContentBody) => Promise<unknown>
    addComment: (id: number, body: { versionId: number; body: string }) => Promise<unknown>
  }
}

const PROJECT = 1
let page: DocumentNodeDto
let pageWithReq: DocumentNodeDto

beforeAll(async () => {
  page = await documentApi.createNode(PROJECT, { kind: 'PAGE', title: 'Trang kiểm thử', docType: 'URD' })
  pageWithReq = await documentApi.createNode(PROJECT, { kind: 'PAGE', title: 'Trang có REQ', docType: 'URD' })
  const { current } = await documentApi.get(pageWithReq.documentId)
  const content: TipTapDoc = {
    type: 'doc',
    content: [
      h('r1', 2, 'Đăng nhập', { uid: 'req-login' }),
      p('p1', 'Người dùng đăng nhập bằng email.'),
      tasks('t1', [['Sai mật khẩu báo lỗi', false]]),
    ],
  }
  await documentApi.saveContent(pageWithReq.documentId, current.versionId, {
    content,
    subtitle: '',
    rowVersion: current.rowVersion,
  })
})

function renderView(onTreeChanged = vi.fn(), node = page) {
  render(
    <MemoryRouter initialEntries={[`/projects/${PROJECT}/documents/${node.documentId}`]}>
      <DocumentView
        documentId={node.documentId}
        nodes={[node]}
        treeOpen
        onToggleTree={() => undefined}
        onTreeChanged={onTreeChanged}
        onDeleteRequest={() => undefined}
      />
    </MemoryRouter>,
  )
  return { onTreeChanged }
}

describe('DocumentView', () => {
  it('hiện trang nháp: tiêu đề sửa được, nút "Gửi duyệt", đường dẫn trên thanh trên', async () => {
    renderView()
    expect(await screen.findByLabelText('Tiêu đề trang')).toHaveValue('Trang kiểm thử')
    expect(screen.getByRole('button', { name: 'Gửi duyệt' })).toBeInTheDocument()
    expect(screen.getByText(/Trang kiểm thử/, { selector: 'span' })).toBeInTheDocument()
  })

  it('sửa mô tả ngắn → "Chưa lưu" → tự lưu → "Đã lưu"', async () => {
    const user = userEvent.setup()
    renderView()
    const subtitle = await screen.findByLabelText('Mô tả ngắn')
    await user.type(subtitle, 'Mô tả mới')
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Đã lưu')).toBeInTheDocument(), { timeout: 4000 })
  })

  it('chưa có REQ thì không gửi duyệt được: báo lỗi, vẫn là bản nháp', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('button', { name: 'Gửi duyệt' }))
    expect(await screen.findByText('Cần ít nhất 1 yêu cầu (REQ) trước khi gửi duyệt.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi duyệt' })).toBeInTheDocument()
  })

  it('gửi duyệt → báo thành công, trang chuyển sang chờ duyệt (nút chính đổi thành "Phê duyệt")', async () => {
    const user = userEvent.setup()
    const { onTreeChanged } = renderView(vi.fn(), pageWithReq)
    await user.click(await screen.findByRole('button', { name: 'Gửi duyệt' }))
    expect(await screen.findByText('Đã gửi duyệt.')).toBeInTheDocument()
    expect(onTreeChanged).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Phê duyệt' })).toBeInTheDocument()
  })

  it('chờ duyệt: có "Yêu cầu sửa"; còn góp ý mở thì khoá "Phê duyệt", xử lý xong mới duyệt được', async () => {
    const user = userEvent.setup()
    const { current } = await documentApi.get(pageWithReq.documentId)
    expect(current.status).toBe('IN_REVIEW')
    await documentApi.addComment(pageWithReq.documentId, { versionId: current.versionId, body: 'OTP qua kênh nào?' })
    renderView(vi.fn(), pageWithReq)

    const blocked = await screen.findByRole('button', { name: 'Phê duyệt · còn 1 góp ý' })
    expect(blocked).toBeDisabled()
    expect(blocked).toHaveAccessibleDescription(/Còn 1 góp ý chưa xử lý/)
    expect(screen.getByRole('button', { name: 'Yêu cầu sửa' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Góp ý: 0 đã xử lý · 1 còn mở' }))
    await user.click(await screen.findByRole('button', { name: 'Đã xử lý' }))
    expect(await screen.findByRole('button', { name: 'Góp ý: 1 đã xử lý · 0 còn mở' })).toBeInTheDocument()
    const approve = screen.getByRole('button', { name: 'Phê duyệt' })
    expect(approve).toBeEnabled()

    await user.click(approve)
    expect(await screen.findByText('Đã phê duyệt.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Chỉnh sửa (tạo bản nháp mới)' })).toBeInTheDocument()
  })
})
