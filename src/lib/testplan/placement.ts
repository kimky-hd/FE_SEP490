import type { TestModuleDto, TestPlacementDto, TestSectionDto } from '@/types/testing'

// Chỗ đặt testcase do AI sinh (mockup: "module › mục › loại test"): module = tài liệu chứa REQ, mục lớn = heading tài
// liệu chứa REQ, nhóm con = loại test. Thiếu chỗ nào thì "sẽ tạo mới". Đổi REQ / loại → tính lại. Hàm thuần.

export interface ReqSection {
  documentId: number
  /** Heading chứa REQ; null nếu REQ không nằm dưới heading nào. */
  anchorId: string | null
  /** Tiêu đề mục (đã bỏ số) — dùng khi phải tạo mục mới. */
  title: string
}

/** Mục lớn của module (theo thứ tự). */
export const topSections = (m: TestModuleDto) =>
  m.sections.filter((s) => s.parentId === null).sort((a, b) => a.position - b.position)

/** Nhóm con của một mục lớn. */
export const groupsOf = (m: TestModuleDto, sectionId: number) =>
  m.sections.filter((s) => s.parentId === sectionId).sort((a, b) => a.position - b.position)

const same = (a: string, b: string) => a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi')

export function findPlacement(modules: TestModuleDto[], at: ReqSection, category: string): TestPlacementDto {
  const m = modules.find((x) => x.documentId === at.documentId) ?? null
  const top: TestSectionDto | null = m
    ? (topSections(m).find((s) =>
        at.anchorId ? s.anchorId === at.anchorId : s.anchorId === null && same(s.title, at.title),
      ) ?? null)
    : null
  const group = m && top ? (groupsOf(m, top.sectionId).find((g) => same(g.title, category)) ?? null) : null
  return {
    moduleId: m?.moduleId ?? null,
    sectionId: top?.sectionId ?? null,
    groupId: group?.sectionId ?? null,
    documentId: at.documentId,
    anchorId: at.anchorId,
    sectionTitle: top?.title ?? at.title,
    category,
  }
}

/** Khoá gom nhóm đề xuất theo chỗ đặt (cùng module / mục / nhóm — kể cả chỗ sẽ tạo mới). */
export const placementKey = (p: TestPlacementDto) =>
  [
    p.documentId,
    p.sectionId ?? `new:${p.anchorId ?? ''}:${p.sectionTitle}`,
    p.category.trim().toLocaleLowerCase('vi'),
  ].join('|')

/** Mã mục lớn kế tiếp ("3.") và mã nhóm kế tiếp trong mục ("2.4"). */
// Mã = (số lớn nhất đang có) + 1, không phải (số lượng) + 1 — xoá mục giữa chừng không sinh mã trùng.
const lastNumber = (code: string) => Number(/(\d+)\.?\s*$/.exec(code)?.[1] ?? 0)

export const nextTopCode = (m: Pick<TestModuleDto, 'sections'>) =>
  `${m.sections.filter((s) => s.parentId === null).reduce((n, s) => Math.max(n, lastNumber(s.code)), 0) + 1}.`

export function nextGroupCode(m: Pick<TestModuleDto, 'sections'>, top: Pick<TestSectionDto, 'sectionId' | 'code'>) {
  const n =
    m.sections.filter((s) => s.parentId === top.sectionId).reduce((x, s) => Math.max(x, lastNumber(s.code)), 0) + 1
  return `${top.code.replace(/\.$/, '')}.${n}`
}

/** Mã testcase kế tiếp trong module: TC_(max + 1). */
export function nextCaseCode(codes: string[]): string {
  const max = codes.reduce((n, c) => Math.max(n, Number(/(\d+)\s*$/.exec(c)?.[1] ?? 0)), 0)
  return `TC_${max + 1}`
}
