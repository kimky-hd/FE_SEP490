import { invalidateData } from '@/lib/dataEvents'
import { documentApi, documentMockStore } from './documentApi'
import { MOCK } from './mockFlags'
import { withSystemSeedContext } from './mockSupport'
import { issueMockStore, testMockStore } from './workMockStores'

// "Tạo dữ liệu mẫu" (chỉ khi có module chạy mock): tạo bộ tài liệu demo (nếu Tài liệu còn mock), rồi issue / sprint /
// đợt test (Kanban / Test còn mock). Test cases cần 3 tài liệu đặc tả mẫu (SRS-014, URD-014, SRS-020 — testSpecSeed.ts)
// nên thêm chúng vào Tài liệu mock nếu chưa có. Phần nào đã có dữ liệu thì bỏ qua phần đó.

export const canSeedDemo = MOCK.documents || MOCK.kanban || MOCK.tests

export async function seedAllDemo(projectId: number): Promise<boolean> {
  if (!canSeedDemo) return false
  return withSystemSeedContext(async () => {
    let docs = documentApi.mock ? await documentApi.mock.seedDemo(projectId) : false
    if (documentMockStore && testMockStore)
      docs = (await documentMockStore.seedTestSpecs(projectId).catch(() => false)) || docs
    let work = false
    if (issueMockStore) work = !!(await issueMockStore.seedDemo(projectId).catch(() => null))
    if (testMockStore) work = (await testMockStore.seedDemo(projectId).catch(() => false)) || work
    invalidateData()
    return docs || work
  })
}

// Cho script kiểm thử / dev: `window.__ssamDocsMock.seedDemo(projectId)` tạo đủ tài liệu + issue + testcase.
if (canSeedDemo && typeof window !== 'undefined') {
  ;(window as unknown as { __ssamDocsMock?: { seedDemo: (projectId: number) => Promise<boolean> } }).__ssamDocsMock = {
    seedDemo: seedAllDemo,
  }
}
