import { describe, expect, it } from 'vitest'
import { HELP_QA, HELP_TOPICS, findHelpTopic, helpContextFromPath, topicTips } from './helpContent'
import { answerQuestion, looksLikeQuestion, normalizeHelpText, searchHelp } from './searchHelp'

const top = (q: string) => searchHelp(q)[0]?.entry.id

describe('help content', () => {
  it('every topic and role variant has exactly 3 tips', () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.tips, topic.id).toHaveLength(3)
      for (const tips of Object.values(topic.roles ?? {})) expect(tips, topic.id).toHaveLength(3)
    }
  })

  it('tip titles stay short (≤ 6 words in Vietnamese)', () => {
    for (const topic of HELP_TOPICS)
      for (const tips of [topic.tips, ...Object.values(topic.roles ?? {})])
        for (const t of tips)
          expect(t.title.vi.split(/\s+/).length, `${topic.id}: ${t.title.vi}`).toBeLessThanOrEqual(6)
  })

  it('has ~30 Q&A entries with unique ids and valid related links', () => {
    expect(HELP_QA.length).toBeGreaterThanOrEqual(30)
    const ids = new Set(HELP_QA.map((e) => e.id))
    expect(ids.size).toBe(HELP_QA.length)
    for (const e of HELP_QA) for (const r of e.related ?? []) expect(ids.has(r), `${e.id} → ${r}`).toBe(true)
  })
})

describe('findHelpTopic', () => {
  it.each([
    ['/', 'home'],
    ['/projects/7/my-work', 'project.myWork'],
    ['/projects/7/overview', 'project.overview'],
    ['/projects/7/documents', 'project.documents.home'],
    ['/projects/7/documents/', 'project.documents.home'],
    ['/projects/7/documents/42', 'project.documents.editor'],
    ['/projects/7/kanban', 'project.kanban'],
    ['/projects/7/kanban/backlog', 'project.backlog'],
    ['/projects/7/tests', 'project.tests'],
    ['/projects/7/tests/cycles', 'project.cycles'],
    ['/projects/7/tests/cycles/3', 'project.cycles'],
    ['/projects/7/workflow', 'project.workflow'],
    ['/projects/7/members', 'project.members'],
    ['/projects/7/settings', 'project.settings'],
    ['/workspaces', 'workspace.list'],
    ['/workspaces/3', 'workspace.detail'],
    ['/workspaces/3/members', 'workspace.detail'],
    ['/workspaces/3/projects/new', 'wizard'],
    ['/admin/roles', 'admin.roles'],
    ['/admin/roles/12', 'admin.roles'],
    ['/admin/users', 'admin.users'],
  ])('%s → %s', (path, id) => {
    expect(findHelpTopic(path)?.id).toBe(id)
  })

  it('documents with ?new= shows the start tips', () => {
    expect(findHelpTopic('/projects/7/documents', '?new=blank')?.id).toBe('project.documents.start')
  })

  it('returns null for pages without help', () => {
    expect(findHelpTopic('/login')).toBeNull()
  })

  it('picks role variants and falls back to defaults', () => {
    const editor = findHelpTopic('/projects/1/documents/2')!
    expect(topicTips(editor, 'BA')[1].icon).toBe('✦')
    expect(topicTips(editor, 'OTHER')).toBe(editor.tips)
    expect(topicTips(editor, null)).toBe(editor.tips)
    const myWork = findHelpTopic('/projects/1/my-work')!
    expect(topicTips(myWork, 'QA')).not.toBe(myWork.tips)
  })

  it('reads ids from the path for actions', () => {
    expect(helpContextFromPath('/projects/5/documents/9')).toEqual({
      projectId: 5,
      workspaceId: undefined,
      documentId: 9,
    })
    expect(helpContextFromPath('/workspaces/4/projects/new').workspaceId).toBe(4)
  })

  it('project actions are hidden outside a project', () => {
    const submit = HELP_QA.find((e) => e.id === 'submit')!
    expect(submit.actions![0].to({})).toBeNull()
    expect(submit.actions![0].to({ projectId: 3 })).toBe('/projects/3/documents')
  })
})

describe('searchHelp', () => {
  it('normalizes Vietnamese diacritics and đ', () => {
    expect(normalizeHelpText('Đánh dấu REQ?')).toBe('danh dau req')
  })

  it.each([
    ['làm sao gửi duyệt', 'submit'],
    ['lam sao gui duyet', 'submit'],
    ['ai được phê duyệt', 'approver'],
    ['REQ là gì', 'req-what'],
    ['đánh dấu REQ', 'req-mark'],
    ['vẽ sơ đồ', 'diagram'],
    ['so sánh phiên bản', 'compare'],
    ['tạo issue từ REQ', 'issue-from-req'],
    ['kéo issue', 'drag-issue'],
    ['bắt đầu sprint', 'sprint-start'],
    ['chạy test', 'run-test'],
    ['ghi kết quả lỗi', 'test-fail'],
    ['testcase cần xem lại là gì', 'test-review'],
    ['mời thành viên', 'invite'],
    ['đổi role', 'change-role'],
    ['phím tắt', 'shortcuts'],
  ])('"%s" → %s', (q, id) => {
    expect(top(q)).toBe(id)
  })

  it('understands English', () => {
    expect(top('how do I submit for review')).toBe('submit')
    expect(top('compare versions')).toBe('compare')
    expect(top('start sprint')).toBe('sprint-start')
    expect(top('invite member')).toBe('invite')
  })

  it('tolerates light typos', () => {
    expect(top('gui duyt')).toBe('submit')
    expect(top('so snah phien ban')).toBe('compare')
    expect(top('diagarm')).toBe('diagram')
  })

  it('answerQuestion gives a best answer and up to 2 related', () => {
    const a = answerQuestion('làm sao gửi duyệt')!
    expect(a.best.id).toBe('submit')
    expect(a.related.length).toBeLessThanOrEqual(2)
    expect(a.related.map((r) => r.id)).toContain('approver')
  })

  it('stays quiet for plain document searches', () => {
    expect(answerQuestion('SRS-02')).toBeNull()
    expect(answerQuestion('Thanh toán VietQR')).toBeNull()
    expect(answerQuestion('')).toBeNull()
  })

  it('detects questions', () => {
    expect(looksLikeQuestion('làm sao gửi duyệt')).toBe(true)
    expect(looksLikeQuestion('how to start sprint')).toBe(true)
    expect(looksLikeQuestion('SRS-02')).toBe(false)
  })
})
