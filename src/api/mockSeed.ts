import { invalidateData } from '@/lib/dataEvents'
import { documentApi } from './documentApi'
import { MOCK } from './mockFlags'
import { issueMockStore, testMockStore } from './workMockStores'

// "Tạo dữ liệu mẫu" (chỉ khi có module chạy mock): tạo bộ tài liệu demo (nếu Tài liệu còn mock), rồi issue / sprint /
// testcase / đợt chạy bám theo REQ của dự án (Kanban / Test còn mock). Phần nào đã có dữ liệu thì bỏ qua phần đó.

export const canSeedDemo = MOCK.documents || MOCK.kanban || MOCK.tests

export async function seedAllDemo(projectId: number): Promise<boolean> {
  if (!canSeedDemo) return false
  const docs = documentApi.mock ? await documentApi.mock.seedDemo(projectId) : false
  let work = false
  if (issueMockStore) {
    const keys = await issueMockStore.seedDemo(projectId).catch(() => null)
    work = !!keys
    if (keys && testMockStore) work = (await testMockStore.seedDemo(projectId, keys).catch(() => false)) || work
  }
  invalidateData()
  return docs || work
}

// Cho script kiểm thử / dev: `window.__ssamDocsMock.seedDemo(projectId)` tạo đủ tài liệu + issue + testcase.
if (canSeedDemo && typeof window !== 'undefined') {
  ;(window as unknown as { __ssamDocsMock?: { seedDemo: (projectId: number) => Promise<boolean> } }).__ssamDocsMock = {
    seedDemo: seedAllDemo,
  }
}
