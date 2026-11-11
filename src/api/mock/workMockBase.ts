// Phần chung của mock Kanban (issueMockStore) và Test cases (testMockStore): môi trường inject được, lỗi, liên kết REQ
// và luật "REQ đổi sau lần duyệt" (doc/Issues-Testcases-API-Contract.md §3).
//
// Cách phát hiện REQ đổi: mỗi liên kết lưu `hash` = ContentHash của REQ trong bản baseline lúc liên kết / lúc ghi nhận
// thay đổi gần nhất. Mỗi lần đọc / ghi dữ liệu một dự án, store so hash đó với baseline hiện tại của tài liệu (đọc từ
// mock tài liệu). Khác → đánh dấu (issue.reqChanged, testcase: cờ test lại REQ_CHANGED theo môi trường). Baseline chỉ đổi khi một
// bản được DUYỆT nên kết quả giống BE chạy bước §3 ngay sau khi duyệt, mà không phải móc vào luồng duyệt.

import { ApiError } from '@/lib/apiClient'
import { tr } from '@/i18n'
import type { KeyValueStorage, MockProjectAccess } from '@/api/mockSupport'
import type { ReqRefDto, RequirementRef, UserRef } from '@/types/issue'
import type { WorkflowDto } from '@/types/project'
import type { DocSectionDto } from '@/types/testing'
import type { DocReqIndex, ReqLite } from './documentMockStore'

export interface WorkMockEnv {
  actor: () => Promise<UserRef>
  projectAccess: (projectId: number) => Promise<MockProjectAccess>
  workflow: (projectId: number) => Promise<WorkflowDto>
  /** Thành viên thật của dự án (người được giao việc). */
  members: (projectId: number) => Promise<UserRef[]>
  /** REQ của các tài liệu trong dự án (đồng bộ từ kho mock tài liệu, hoặc bất đồng bộ qua API Tài liệu thật). */
  reqs: (projectId: number) => DocReqIndex[] | Promise<DocReqIndex[]>
  /** Mục (heading) của một tài liệu — Test cases v2 (GET /documents/{id}/sections). Mặc định: rỗng. */
  sections?: (documentId: number) => Promise<DocSectionDto[]>
  /** Loại vai trò (RoleKind) của thành viên theo userId — để biết ai là QA. Mặc định: không biết. */
  memberKinds?: (projectId: number) => Promise<Record<number, string>>
  storage?: KeyValueStorage | null
  now?: () => Date
  /** Độ trễ giả (ms). Mặc định 120–250ms; test truyền 0. */
  latency?: () => number
}

export type ResolvedEnv = Required<Omit<WorkMockEnv, 'storage'>> & { storage: KeyValueStorage | null }

export function resolveEnv(env: WorkMockEnv): ResolvedEnv {
  return {
    ...env,
    storage: env.storage ?? null,
    sections: env.sections ?? (async () => []),
    memberKinds: env.memberKinds ?? (async () => ({})),
    now: env.now ?? (() => new Date()),
    latency: env.latency ?? (() => 120 + Math.round(Math.random() * 130)),
  }
}

export const fail = (status: number, code: string, message: string, errors?: Record<string, string[]>): never => {
  throw new ApiError(status, { code, message, errors })
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const has = (permissions: readonly string[], key: string) =>
  permissions.includes('*') || permissions.includes(key)

export async function sleep(ms: number) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms))
}

export function loadJson<T>(storage: KeyValueStorage | null, key: string, empty: () => T): T {
  try {
    const raw = storage?.getItem(key)
    if (raw) return { ...empty(), ...(JSON.parse(raw) as T) }
  } catch {
    // Dữ liệu hỏng / storage bị chặn: bắt đầu rỗng.
  }
  return empty()
}

export function saveJson(storage: KeyValueStorage | null, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Hết quota / bị chặn: vẫn chạy trong bộ nhớ.
  }
}

export const validationError = (errors: Record<string, string[]>) =>
  fail(400, 'VALIDATION_ERROR', tr('Dữ liệu không hợp lệ.', 'Invalid data.'), errors)

// ---------- Liên kết REQ ----------

/** Hash đặc biệt: REQ đã bị xoá khỏi baseline (đã ghi nhận). */
export const REMOVED_HASH = '-'

export interface LinkRec {
  documentId: number
  reqUid: string
  /** ContentHash của REQ trong baseline đã "biết"; null nếu lúc liên kết REQ chưa nằm trong bản đã duyệt nào. */
  hash: string | null
  /** Nhãn bản đã duyệt làm REQ đổi (chưa xác nhận); null = không đổi. */
  changedLabel: string | null
}

export function findReq(
  index: DocReqIndex[],
  documentId: number,
  reqUid: string,
): { doc: DocReqIndex | null; req: ReqLite | null } {
  const doc = index.find((d) => d.documentId === documentId) ?? null
  if (!doc) return { doc: null, req: null }
  const req = doc.baseline.find((r) => r.reqUid === reqUid) ?? doc.current.find((r) => r.reqUid === reqUid) ?? null
  return { doc, req }
}

/** Tạo liên kết mới; `400 INVALID_REQUIREMENT` nếu REQ không thuộc dự án. */
export function newLink(index: DocReqIndex[], ref: RequirementRef, keep?: LinkRec[]): LinkRec {
  const old = keep?.find((l) => l.documentId === ref.documentId && l.reqUid === ref.reqUid)
  if (old) return old
  const { doc, req } = findReq(index, Number(ref.documentId), String(ref.reqUid))
  if (!doc || !req)
    fail(
      400,
      'INVALID_REQUIREMENT',
      tr('REQ không thuộc dự án hoặc không tồn tại.', "The REQ doesn't exist in this project."),
    )
  const base = doc!.baseline.find((r) => r.reqUid === ref.reqUid)
  return { documentId: doc!.documentId, reqUid: req!.reqUid, hash: base?.contentHash ?? null, changedLabel: null }
}

export function newLinks(index: DocReqIndex[], refs: RequirementRef[] | undefined, keep?: LinkRec[]): LinkRec[] {
  const out: LinkRec[] = []
  for (const ref of refs ?? []) {
    if (out.some((l) => l.documentId === ref.documentId && l.reqUid === ref.reqUid)) continue
    out.push(newLink(index, ref, keep))
  }
  return out
}

/** So liên kết với baseline hiện tại; trả về nhãn bản nếu vừa phát hiện REQ đổi / bị xoá. */
export function syncLink(index: DocReqIndex[], link: LinkRec): string | null {
  const doc = index.find((d) => d.documentId === link.documentId)
  if (!doc || !doc.baselineVersionId) return null
  const base = doc.baseline.find((r) => r.reqUid === link.reqUid)
  if (link.hash === null) {
    // REQ lần đầu vào bản đã duyệt: ghi nhận, không coi là "đổi".
    if (base) link.hash = base.contentHash
    return null
  }
  if (!base) {
    if (link.hash === REMOVED_HASH) return null
    link.hash = REMOVED_HASH
  } else if (base.contentHash !== link.hash) {
    link.hash = base.contentHash
  } else {
    return null
  }
  link.changedLabel = doc.baselineLabel ?? '?'
  return link.changedLabel
}

export function reqRefDto(index: DocReqIndex[], link: LinkRec, flagged: boolean): ReqRefDto {
  const { doc, req } = findReq(index, link.documentId, link.reqUid)
  const removed = link.hash === REMOVED_HASH && !req
  return {
    documentId: link.documentId,
    documentCode: doc?.code ?? `DOC-${link.documentId}`,
    reqUid: link.reqUid,
    reqKey: req?.reqKey ?? null,
    title: req?.title ?? null,
    freshness: req?.freshness ?? null,
    changedNote:
      flagged && link.changedLabel
        ? removed
          ? tr(`REQ đã bị xoá ở bản ${link.changedLabel}`, `REQ removed in v${link.changedLabel}`)
          : tr(`Đổi trong bản ${link.changedLabel}`, `Changed in v${link.changedLabel}`)
        : null,
  }
}

// ---------- Người dùng ----------

/** Người giả cho dữ liệu mẫu (dự án thật thường chỉ có 1–2 thành viên). userId âm để không trùng người thật. */
export const DEMO_PEOPLE: UserRef[] = [
  { userId: -101, fullName: 'Lê Ngọc' },
  { userId: -102, fullName: 'Trần Hà' },
  { userId: -103, fullName: 'Nguyễn Mai' },
  { userId: -104, fullName: 'Phạm Khoa' },
]

export function mergePeople(...lists: UserRef[][]): UserRef[] {
  const out: UserRef[] = []
  for (const u of lists.flat())
    if (!out.some((x) => x.userId === u.userId)) out.push({ userId: u.userId, fullName: u.fullName })
  return out
}
