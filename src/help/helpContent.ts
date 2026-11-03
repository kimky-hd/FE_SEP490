import type { ProjectRoleKind } from '@/lib/projectRole'

// Nội dung trợ giúp: mẹo theo trang (nút "?" — mock-role-modules.html 4b) và kho hỏi đáp cho Ctrl K (4c).
// Thêm trang: thêm một mục vào HELP_TOPICS (pattern khớp pathname, đúng 3 mẹo, tuỳ chọn biến thể theo vai trò).
// Thêm câu hỏi: thêm một mục vào HELP_QA (câu hỏi + vài cách hỏi khác, trả lời 1–3 câu, hành động "Làm luôn" chỉ là điều hướng).

export interface Bilingual {
  vi: string
  en: string
}

const L = (vi: string, en: string): Bilingual => ({ vi, en })

export interface HelpTip {
  /** Ký hiệu ngắn trong ô vuông bên trái ("/", "✦", "↗", "Ctrl K"). */
  icon: string
  /** Tối đa ~6 chữ. */
  title: Bilingual
  /** Một câu. */
  body: Bilingual
}

export interface HelpTopic {
  id: string
  /** Tên trang, dùng trong "Mẹo cho trang <tên>". */
  title: Bilingual
  /** Khớp pathname (không gồm query). Mục đứng trước được ưu tiên. */
  pattern: RegExp
  /** Thêm điều kiện theo query string (vd `?new=`). */
  search?: RegExp
  tips: [HelpTip, HelpTip, HelpTip]
  roles?: Partial<Record<ProjectRoleKind, [HelpTip, HelpTip, HelpTip]>>
}

export interface HelpContext {
  projectId?: number
  workspaceId?: number
  documentId?: number
}

export interface HelpAction {
  kind: 'navigate'
  label: Bilingual
  /** Đích điều hướng; null = không làm được ở ngữ cảnh hiện tại (ẩn nút). */
  to: (ctx: HelpContext) => string | null
  /** Ghi chú nhỏ bên phải ("Việc của tôi"). */
  hint?: Bilingual
}

export interface HelpQA {
  id: string
  /** Câu hỏi chuẩn (hiện ở "Liên quan"). */
  q: Bilingual
  /** Tiêu đề in đậm của thẻ trả lời. */
  title: Bilingual
  answer: Bilingual
  /** Các cách hỏi khác (vi hoặc en, có dấu hay không đều được). */
  variants: string[]
  /** Từ khoá nặng ký (khớp được cộng thêm điểm). */
  keywords?: string[]
  actions?: HelpAction[]
  related?: string[]
}

// ---------- Mẹo theo trang ----------

const tip = (icon: string, title: Bilingual, body: Bilingual): HelpTip => ({ icon, title, body })

const TIP_CTRL_K = tip(
  'Ctrl K',
  L('Tìm và hỏi bằng Ctrl K', 'Search and ask with Ctrl K'),
  L(
    'Gõ tên trang, mã REQ hoặc một câu hỏi như "làm sao gửi duyệt".',
    'Type a page name, a REQ key or a question like "how do I submit for review".',
  ),
)

const P = '/projects/\\d+'
const proj = (rest: string) => new RegExp(`^${P}${rest}$`)

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'home',
    title: L('Tổng quan', 'Home'),
    pattern: /^\/$/,
    tips: [
      tip(
        '◎',
        L('Việc gấp nằm trên cùng', 'Urgent work comes first'),
        L(
          'Tài liệu chờ bạn duyệt hoặc bị yêu cầu sửa luôn xếp đầu danh sách.',
          'Documents waiting for your review or sent back for changes are listed first.',
        ),
      ),
      tip(
        '＋',
        L('Viết nhanh từ ghi chú họp', 'Draft from meeting notes'),
        L(
          'Bấm Tài liệu mới → Từ ghi chú họp để có bản nháp có sẵn REQ.',
          'Use New document → From meeting notes to get a draft with REQs already marked.',
        ),
      ),
      tip(
        '↗',
        L('Mở dự án gần đây', 'Jump back into a project'),
        L(
          'Dự án vừa mở luôn nằm ở nhóm "Dự án gần đây" trên thanh bên.',
          'Projects you opened recently stay in the "Recent projects" group of the sidebar.',
        ),
      ),
    ],
  },
  {
    id: 'project.myWork',
    title: L('Việc của tôi', 'My work'),
    pattern: proj('/my-work'),
    tips: [
      tip(
        '◎',
        L('Sắp theo mức gấp', 'Sorted by urgency'),
        L(
          'Việc quá hạn và bị chặn đứng đầu; làm từ trên xuống là đủ.',
          'Overdue and blocked items come first; just work top to bottom.',
        ),
      ),
      tip(
        '↗',
        L('Bấm để làm ngay', 'Click to act'),
        L(
          'Mỗi dòng mở thẳng đúng tài liệu, issue hoặc lượt chạy cần làm.',
          'Each row opens the exact document, issue or test run to work on.',
        ),
      ),
      TIP_CTRL_K,
    ],
    roles: {
      BA: [
        tip(
          '↗',
          L('Sửa trang bị trả về trước', 'Fix sent-back pages first'),
          L(
            'Trang bị yêu cầu sửa có ghi chú của người duyệt ngay trong khung bình luận.',
            "Sent-back pages show the reviewer's note right in the comments panel.",
          ),
        ),
        tip(
          '⚑',
          L('REQ thay đổi cần báo đội', 'Changed REQs ripple out'),
          L(
            'Khi bản mới được duyệt, issue và testcase liên kết REQ đó sẽ được đánh dấu xem lại.',
            'Once a new version is approved, issues and test cases linked to that REQ get flagged for review.',
          ),
        ),
        TIP_CTRL_K,
      ],
      QA: [
        tip(
          '▶',
          L('Lượt chạy chờ bạn', 'Runs waiting for you'),
          L(
            '"Chạy" và "Chạy lại" mở thẳng chế độ chạy từng test của đợt đang mở.',
            '"Run" and "Re-run" open the step-by-step runner for the open cycle.',
          ),
        ),
        tip(
          '⚑',
          L('Testcase cần xem lại', 'Test cases to review'),
          L(
            'REQ vừa đổi thì testcase liên kết cần xem lại trước khi chạy tiếp.',
            'When a REQ changes, its linked test cases need a review before the next run.',
          ),
        ),
        tip(
          '＋',
          L('REQ chưa có testcase', 'REQs without tests'),
          L(
            'Bấm "+ Testcase" để tạo nhanh, có thể nhờ gợi ý từ tiêu chí nghiệm thu.',
            'Use "+ Test case" to add one quickly, optionally suggested from acceptance criteria.',
          ),
        ),
      ],
      DEV: [
        tip(
          '●',
          L('Issue được giao cho bạn', 'Issues assigned to you'),
          L(
            'Mở issue để xem REQ gốc, testcase liên kết và bình luận.',
            'Open an issue to see its source REQ, linked test cases and comments.',
          ),
        ),
        tip(
          '⚑',
          L('REQ đổi sau khi bạn nhận', 'REQ changed after you started'),
          L(
            '"Xem thay đổi" so sánh REQ cũ và mới; xác nhận để bỏ cờ.',
            '"See changes" compares the old and new REQ; acknowledge to clear the flag.',
          ),
        ),
        tip(
          '✕',
          L('Lỗi từ lượt test FAIL', 'Bugs from failed runs'),
          L(
            'Bug sinh từ lượt chạy lỗi đã gắn sẵn REQ và testcase để bạn tái hiện.',
            'Bugs created from failed runs already link the REQ and test case so you can reproduce.',
          ),
        ),
      ],
      PM: [
        tip(
          '✓',
          L('Duyệt tài liệu đang chờ', 'Review pending documents'),
          L(
            'Trang chờ duyệt mở ở chế độ đọc, có nút Phê duyệt và Yêu cầu chỉnh sửa.',
            'Pages in review open read-only with Approve and Request changes buttons.',
          ),
        ),
        tip(
          '●',
          L('Issue sắp xong', 'Issues ready to close'),
          L(
            'Issue ở Review/QA có mọi test PASS sẽ hiện "Chuyển Xong".',
            'Issues in Review/QA whose tests all pass show "Move to Done".',
          ),
        ),
        TIP_CTRL_K,
      ],
      DESIGNER: [
        tip(
          '◇',
          L('Trang cần thiết kế', 'Pages needing design'),
          L(
            'Trang có REQ liên quan UI hiện ở đây để bạn gắn khung Figma.',
            'Pages with UI-related REQs show here so you can attach Figma frames.',
          ),
        ),
        tip(
          '↗',
          L('Bấm để làm ngay', 'Click to act'),
          L('Mỗi dòng mở thẳng đúng trang hoặc issue cần làm.', 'Each row opens the exact page or issue to work on.'),
        ),
        TIP_CTRL_K,
      ],
    },
  },
  {
    id: 'project.overview',
    title: L('Tổng quan dự án', 'Project overview'),
    pattern: proj('/overview'),
    tips: [
      tip(
        '◔',
        L('Tiến độ theo giai đoạn', 'Progress by phase'),
        L(
          'Mỗi giai đoạn workflow cho thấy số tài liệu đã duyệt trên tổng.',
          'Each workflow phase shows approved documents out of the total.',
        ),
      ),
      tip(
        '⚑',
        L('Cần chú ý trước', 'Check attention items'),
        L(
          'Trang bị yêu cầu sửa và REQ cần cập nhật được gom ở một chỗ.',
          'Sent-back pages and REQs to update are grouped in one place.',
        ),
      ),
      tip(
        '＋',
        L('Tạo tài liệu nhanh', 'Create a document fast'),
        L(
          'Lệnh nhanh trong Ctrl K tạo trang trống hoặc từ ghi chú họp.',
          'Quick actions in Ctrl K create a blank page or one from meeting notes.',
        ),
      ),
    ],
  },
  {
    id: 'project.documents.start',
    title: L('Tài liệu', 'Documents'),
    pattern: proj('/documents/?'),
    search: /[?&]new=/,
    tips: [
      tip(
        '＋',
        L('Bắt đầu từ ghi chú họp', 'Start from meeting notes'),
        L(
          'Dán ghi chú, SSAM dựng sẵn khung trang và đánh dấu REQ cho bạn sửa.',
          'Paste your notes and SSAM drafts the page with REQs marked for you to edit.',
        ),
      ),
      tip(
        '▤',
        L('Hoặc trang trống có mẫu', 'Or a blank template'),
        L('Chọn mẫu URD, BRD hoặc SRS để có sẵn mục lục.', 'Pick a URD, BRD or SRS template to start with sections.'),
      ),
      tip(
        '/',
        L('Chèn mọi thứ bằng phím /', 'Insert anything with /'),
        L('Bảng, REQ, checklist, sơ đồ, khung Figma.', 'Tables, REQs, checklists, diagrams, Figma frames.'),
      ),
    ],
  },
  {
    id: 'project.documents.editor',
    title: L('Tài liệu', 'Documents'),
    pattern: proj('/documents/\\d+'),
    tips: [
      tip(
        '/',
        L('Chèn mọi thứ bằng phím /', 'Insert anything with /'),
        L('Bảng, REQ, checklist, sơ đồ, khung Figma.', 'Tables, REQs, checklists, diagrams, Figma frames.'),
      ),
      tip(
        '◷',
        L('Xem lại các phiên bản', 'Browse versions'),
        L(
          'Bấm số phiên bản cạnh tên trang → So sánh để thấy từng thay đổi.',
          'Click the version next to the title → Compare to step through each change.',
        ),
      ),
      tip(
        'F',
        L('Toàn màn hình bằng phím F', 'Full screen with F'),
        L(
          'Ẩn mọi thanh bên để đọc và viết tập trung; Esc để thoát.',
          'Hide every sidebar to read and write in focus; Esc to exit.',
        ),
      ),
    ],
    roles: {
      BA: [
        tip(
          '/',
          L('Chèn mọi thứ bằng phím /', 'Insert anything with /'),
          L('Bảng, REQ, checklist, sơ đồ, khung Figma.', 'Tables, REQs, checklists, diagrams, Figma frames.'),
        ),
        tip(
          '✦',
          L('Bôi đen để vẽ sơ đồ', 'Select text to draw a diagram'),
          L(
            'Chọn đoạn mô tả luồng → ✦ Vẽ sơ đồ → Tab để áp dụng.',
            'Select a flow description → ✦ Draw diagram → Tab to apply.',
          ),
        ),
        tip(
          '↗',
          L('Gửi duyệt khi xong', 'Submit when done'),
          L(
            'PM sẽ thấy trong Việc của tôi; bạn được báo khi duyệt hoặc bị yêu cầu sửa.',
            "The PM sees it in My work; you're notified when it's approved or sent back.",
          ),
        ),
      ],
      DESIGNER: [
        tip(
          '/',
          L('Gắn khung Figma bằng /', 'Embed Figma with /'),
          L(
            'Gõ / → Figma rồi dán link khung; khung luôn hiện bản mới nhất.',
            'Type / → Figma and paste a frame link; it always shows the latest version.',
          ),
        ),
        tip(
          '▣',
          L('Bám theo REQ', 'Design against REQs'),
          L(
            'Mỗi REQ có mã riêng; nhắc mã REQ trong bình luận để đội tìm lại được.',
            'Every REQ has a key; mention it in comments so the team can find it.',
          ),
        ),
        tip(
          '◷',
          L('So sánh phiên bản thiết kế', 'Compare design versions'),
          L(
            'Bấm số phiên bản → So sánh để thấy REQ nào vừa đổi.',
            'Click the version → Compare to see which REQs just changed.',
          ),
        ),
      ],
      QA: [
        tip(
          '▣',
          L('REQ là đầu vào của test', 'REQs drive your tests'),
          L(
            'Mỗi tiêu chí nghiệm thu của REQ nên có ít nhất một testcase.',
            'Every acceptance criterion of a REQ should have at least one test case.',
          ),
        ),
        tip(
          '◷',
          L('Xem REQ vừa đổi', 'See what just changed'),
          L(
            'So sánh phiên bản để biết testcase nào cần xem lại.',
            'Compare versions to know which test cases need a review.',
          ),
        ),
        tip(
          '💬',
          L('Hỏi ngay trên đoạn văn', 'Ask right on the text'),
          L(
            'Bôi đen một câu → Bình luận; người viết được báo ngay.',
            'Select a sentence → Comment; the author is notified right away.',
          ),
        ),
      ],
      DEV: [
        tip(
          '▣',
          L('Đọc theo REQ', 'Read by REQ'),
          L(
            'Mỗi issue trỏ về một REQ; Ctrl K rồi gõ mã REQ để nhảy tới.',
            'Each issue points to a REQ; press Ctrl K and type the key to jump there.',
          ),
        ),
        tip(
          '◷',
          L('Xem REQ vừa đổi', 'See what just changed'),
          L(
            'So sánh phiên bản để biết phần nào của issue bị ảnh hưởng.',
            'Compare versions to see which part of your issue is affected.',
          ),
        ),
        tip(
          '💬',
          L('Hỏi ngay trên đoạn văn', 'Ask right on the text'),
          L(
            'Bôi đen một câu → Bình luận; người viết được báo ngay.',
            'Select a sentence → Comment; the author is notified right away.',
          ),
        ),
      ],
      PM: [
        tip(
          '✓',
          L('Duyệt hoặc yêu cầu sửa', 'Approve or request changes'),
          L(
            'Trang chờ duyệt có nút Phê duyệt; yêu cầu sửa nằm trong menu ⋯.',
            'Pages in review have an Approve button; Request changes is in the ⋯ menu.',
          ),
        ),
        tip(
          '◷',
          L('So sánh trước khi duyệt', 'Compare before approving'),
          L(
            'Bấm số phiên bản → So sánh để chỉ đọc phần đã đổi.',
            'Click the version → Compare to read only what changed.',
          ),
        ),
        tip(
          '⚑',
          L('Duyệt là chốt REQ', 'Approval baselines REQs'),
          L(
            'REQ đổi trong bản được duyệt sẽ đánh dấu issue và testcase liên quan.',
            'REQs changed in an approved version flag the linked issues and test cases.',
          ),
        ),
      ],
    },
  },
  {
    id: 'project.documents.home',
    title: L('Tài liệu', 'Documents'),
    pattern: proj('/documents/?'),
    tips: [
      tip(
        '▦',
        L('Lọc theo trạng thái', 'Filter by status'),
        L(
          'Bấm Nháp, Chờ duyệt, Cần sửa… để chỉ xem các trang đó.',
          'Click Draft, In review, Changes requested… to show only those pages.',
        ),
      ),
      tip(
        '⚑',
        L('REQ cần cập nhật', 'REQs to update'),
        L(
          'Trang có REQ cũ hơn bản đã duyệt được gom ở ô màu cam.',
          'Pages whose REQs lag behind the approved version are grouped in the amber tile.',
        ),
      ),
      tip(
        '＋',
        L('Tạo trang từ ghi chú họp', 'Create from meeting notes'),
        L(
          'Nút Tài liệu mới có sẵn lựa chọn từ ghi chú họp.',
          'The New document button has a from-meeting-notes option.',
        ),
      ),
    ],
    roles: {
      PM: [
        tip(
          '✓',
          L('Trang chờ bạn duyệt', 'Pages waiting for you'),
          L(
            'Ô Chờ duyệt lọc ra các trang cần bạn phê duyệt.',
            'The In review tile filters pages that need your approval.',
          ),
        ),
        tip(
          '⚑',
          L('REQ cần cập nhật', 'REQs to update'),
          L(
            'Trang có REQ cũ hơn bản đã duyệt được gom ở ô màu cam.',
            'Pages whose REQs lag behind the approved version are grouped in the amber tile.',
          ),
        ),
        TIP_CTRL_K,
      ],
    },
  },
  {
    id: 'project.backlog',
    title: L('Backlog', 'Backlog'),
    pattern: proj('/kanban/backlog'),
    tips: [
      tip(
        '⇅',
        L('Kéo issue vào sprint', 'Drag issues into a sprint'),
        L(
          'Kéo từ Backlog lên sprint tới; thanh sức chứa cho biết còn bao nhiêu điểm.',
          'Drag from Backlog into the next sprint; the capacity bar shows points left.',
        ),
      ),
      tip(
        '＋',
        L('Tạo issue từ REQ', 'Create issues from REQs'),
        L(
          'REQ chưa có issue hiện nút "Tạo issue từ REQ" để tạo kèm liên kết.',
          'REQs without issues show "Create issue from REQ" to create one already linked.',
        ),
      ),
      tip(
        '▶',
        L('Bắt đầu sprint', 'Start the sprint'),
        L(
          'Khi sprint tới đã đủ việc, bấm Bắt đầu sprint để đưa lên board.',
          'When the next sprint is filled, click Start sprint to put it on the board.',
        ),
      ),
    ],
    roles: {
      BA: [
        tip(
          '＋',
          L('Tạo issue từ REQ', 'Create issues from REQs'),
          L(
            'REQ chưa có issue hiện nút "Tạo issue từ REQ" để tạo kèm liên kết.',
            'REQs without issues show "Create issue from REQ" to create one already linked.',
          ),
        ),
        tip(
          '⚑',
          L('REQ đổi → issue được báo', 'Changed REQs flag issues'),
          L(
            'Khi bản mới được duyệt, issue liên kết REQ đổi sẽ có cờ "REQ đã đổi".',
            'When a new version is approved, issues linked to changed REQs get a "REQ changed" flag.',
          ),
        ),
        tip(
          '⇅',
          L('Sắp ưu tiên bằng kéo thả', 'Prioritize by dragging'),
          L('Issue trên cùng backlog là việc nên làm trước.', 'The top of the backlog is what should be done first.'),
        ),
      ],
    },
  },
  {
    id: 'project.kanban',
    title: L('Kanban', 'Kanban'),
    pattern: proj('/kanban'),
    tips: [
      tip(
        '⇄',
        L('Kéo thẻ để đổi trạng thái', 'Drag cards to change status'),
        L(
          'Cột là trạng thái workflow; thả sang cột khác là cập nhật luôn.',
          'Columns are workflow statuses; drop a card in another column to update it.',
        ),
      ),
      tip(
        '◉',
        L('Lọc nhanh bằng chip', 'Filter with chips'),
        L(
          'Chip "Của tôi", "REQ đã đổi", "Bug" lọc board ngay, không cần tải lại.',
          'Chips like "Mine", "REQ changed" and "Bug" filter the board instantly.',
        ),
      ),
      tip(
        '▸',
        L('Bấm thẻ xem chi tiết', 'Click a card for details'),
        L('Chi tiết mở ở bảng bên phải, không rời board.', 'Details open in a side panel without leaving the board.'),
      ),
    ],
    roles: {
      DEV: [
        tip(
          '◉',
          L('Chỉ xem việc của bạn', 'Show only your work'),
          L(
            'Bật chip "Của tôi" để board chỉ còn issue bạn đang làm.',
            'Turn on the "Mine" chip to see only issues you work on.',
          ),
        ),
        tip(
          '⚑',
          L('Thẻ có cờ REQ đã đổi', 'Cards flagged "REQ changed"'),
          L(
            'Mở thẻ → Xem thay đổi để so REQ cũ/mới, rồi xác nhận.',
            'Open the card → See changes to compare old and new REQ, then acknowledge.',
          ),
        ),
        tip(
          '⇄',
          L('Kéo thẻ để đổi trạng thái', 'Drag cards to change status'),
          L(
            'Thả sang Review khi xong; QA sẽ thấy trong Việc của tôi.',
            'Drop into Review when done; QA will see it in My work.',
          ),
        ),
      ],
      QA: [
        tip(
          '✓',
          L('Cột Review/QA là của bạn', 'Review/QA is your column'),
          L(
            'Mở thẻ để xem testcase liên kết và kết quả lượt chạy gần nhất.',
            'Open a card to see linked test cases and their latest results.',
          ),
        ),
        tip(
          '✕',
          L('Bug từ lượt chạy lỗi', 'Bugs from failed runs'),
          L(
            'Bug tạo khi ghi FAIL đã gắn sẵn REQ và testcase.',
            'Bugs created when you record FAIL already link the REQ and test case.',
          ),
        ),
        tip(
          '◉',
          L('Lọc nhanh bằng chip', 'Filter with chips'),
          L(
            'Chip "Bug" và "REQ đã đổi" giúp chọn việc cần kiểm lại.',
            'The "Bug" and "REQ changed" chips help pick what to retest.',
          ),
        ),
      ],
      PM: [
        tip(
          '▤',
          L('Lên kế hoạch ở Backlog', 'Plan in the Backlog'),
          L(
            'Kéo issue vào sprint và theo dõi sức chứa theo điểm.',
            'Drag issues into sprints and watch capacity in points.',
          ),
        ),
        tip(
          '◔',
          L('Giới hạn việc đang làm', 'Work-in-progress limits'),
          L('Cột vượt giới hạn WIP chuyển màu cảnh báo.', 'Columns over their WIP limit turn to a warning color.'),
        ),
        tip(
          '▸',
          L('Bấm thẻ xem chi tiết', 'Click a card for details'),
          L(
            'Đổi người làm, sprint, điểm ngay trong bảng bên phải.',
            'Change assignee, sprint and points right in the side panel.',
          ),
        ),
      ],
    },
  },
  {
    id: 'project.cycles',
    title: L('Đợt chạy', 'Test cycles'),
    pattern: proj('/tests/cycles(/\\d+)?'),
    tips: [
      tip(
        '▶',
        L('Bấm Chạy để test từng bước', 'Run step by step'),
        L(
          'Chế độ chạy hiện từng testcase; ghi P (đạt), F (lỗi) hoặc B (bị chặn).',
          'The runner shows one test at a time; record P (pass), F (fail) or B (blocked).',
        ),
      ),
      tip(
        '✕',
        L('Lỗi → tạo bug ngay', 'Fail → file a bug'),
        L(
          'Khi ghi FAIL, chọn tạo bug: bug được gắn sẵn REQ và testcase.',
          'When recording FAIL, choose to create a bug already linked to the REQ and test case.',
        ),
      ),
      tip(
        '↻',
        L('Lượt cần chạy lại', 'Runs to re-run'),
        L(
          'REQ đổi trong lúc đợt đang mở sẽ đánh dấu lượt cần chạy lại, kết quả cũ vẫn giữ.',
          'If a REQ changes while the cycle is open, runs are marked to re-run; old results stay.',
        ),
      ),
    ],
    roles: {
      PM: [
        tip(
          '＋',
          L('Tạo đợt theo sprint', 'One cycle per sprint'),
          L(
            'Chọn sprint và testcase; mỗi testcase thành một lượt chạy.',
            'Pick a sprint and test cases; each test case becomes one run.',
          ),
        ),
        tip(
          '◉',
          L('Giao cho nhiều tester', 'Assign several testers'),
          L(
            'Đổi người chạy từng lượt hoặc đặt người chạy mặc định cho cả đợt.',
            'Change the runner per run or set a default runner for the cycle.',
          ),
        ),
        tip(
          '◔',
          L('Theo dõi tỉ lệ đạt', 'Track the pass rate'),
          L(
            'Thanh tiến độ của đợt tách PASS, FAIL, BLOCKED và chưa chạy.',
            "The cycle's progress bar splits pass, fail, blocked and not run.",
          ),
        ),
      ],
    },
  },
  {
    id: 'project.tests',
    title: L('Testcase', 'Test cases'),
    pattern: proj('/tests'),
    tips: [
      tip(
        '▤',
        L('Cây nhóm theo thư mục', 'Folders on the left'),
        L(
          'Kéo testcase giữa các thư mục; thư mục có thể lồng nhau.',
          'Drag test cases between folders; folders can be nested.',
        ),
      ),
      tip(
        '⚑',
        L('Testcase cần xem lại', 'Test cases to review'),
        L(
          'Cờ vàng nghĩa là REQ liên kết vừa đổi; sửa rồi lưu để bỏ cờ.',
          'An amber flag means the linked REQ changed; edit and save to clear it.',
        ),
      ),
      tip(
        '▶',
        L('Chạy trong Đợt chạy', 'Run inside a cycle'),
        L(
          'Kết quả được ghi theo đợt chạy, không ghi thẳng vào testcase.',
          'Results are recorded per test cycle, not directly on the test case.',
        ),
      ),
    ],
    roles: {
      QA: [
        tip(
          '✦',
          L('Gợi ý testcase từ REQ', 'Suggest tests from REQs'),
          L(
            'Chọn REQ → Gợi ý; mỗi tiêu chí nghiệm thu chưa có test thành một đề xuất.',
            'Pick REQs → Suggest; each untested acceptance criterion becomes a proposal.',
          ),
        ),
        tip(
          '⚑',
          L('Testcase cần xem lại', 'Test cases to review'),
          L(
            'Cờ vàng nghĩa là REQ liên kết vừa đổi; sửa rồi lưu để bỏ cờ.',
            'An amber flag means the linked REQ changed; edit and save to clear it.',
          ),
        ),
        tip(
          '▶',
          L('Gom vào Đợt chạy', 'Group into a cycle'),
          L(
            'Tạo đợt chạy cho sprint rồi bấm Chạy để ghi kết quả.',
            'Create a cycle for the sprint, then click Run to record results.',
          ),
        ),
      ],
      DEV: [
        tip(
          '↗',
          L('Tái hiện lỗi từ testcase', 'Reproduce from the test'),
          L(
            'Mở testcase liên kết bug để xem các bước và kết quả mong đợi.',
            'Open the test case linked to a bug to see steps and expected results.',
          ),
        ),
        tip(
          '✓',
          L('Biết issue đã đạt test', 'Know when tests pass'),
          L(
            'Issue có mọi testcase PASS sẽ hiện "Chuyển Xong" trong Việc của tôi.',
            'Issues whose test cases all pass show "Move to Done" in My work.',
          ),
        ),
        TIP_CTRL_K,
      ],
    },
  },
  {
    id: 'project.workflow',
    title: L('Workflow', 'Workflow'),
    pattern: proj('/workflow'),
    tips: [
      tip(
        '▤',
        L('Giai đoạn là các bước giao', 'Phases are delivery steps'),
        L(
          'Mỗi giai đoạn gom tài liệu và trạng thái cần có trước khi sang bước sau.',
          'Each phase groups the documents and statuses needed before moving on.',
        ),
      ),
      tip(
        '⇄',
        L('Trạng thái thành cột Kanban', 'Statuses become board columns'),
        L('Đổi tên hay thứ tự trạng thái là board đổi theo.', 'Renaming or reordering statuses changes the board too.'),
      ),
      tip(
        '✓',
        L('Lưu sau khi kiểm tra', 'Validate, then save'),
        L(
          'Lỗi cấu hình hiện ngay cạnh mục sai trước khi bạn lưu.',
          'Configuration errors show next to the faulty item before you save.',
        ),
      ),
    ],
  },
  {
    id: 'project.members',
    title: L('Thành viên', 'Members'),
    pattern: proj('/members'),
    tips: [
      tip(
        '＋',
        L('Thêm người vào dự án', 'Add people to the project'),
        L(
          'Chỉ thêm được người đã ở trong workspace; chưa có thì mời vào công ty trước.',
          'Only workspace members can be added; invite them to the company first.',
        ),
      ),
      tip(
        '◉',
        L('Role quyết định menu', 'Role shapes the menu'),
        L(
          'Role QA, BA, Dev… đổi thứ tự menu và nội dung Việc của tôi của người đó.',
          "QA, BA, Dev… roles change that person's menu order and My work.",
        ),
      ),
      tip(
        '✎',
        L('Quyền bổ sung cho từng người', 'Extra permissions per person'),
        L('Cấp thêm quyền lẻ mà không phải tạo role mới.', 'Grant one-off permissions without creating a new role.'),
      ),
    ],
  },
  {
    id: 'project.settings',
    title: L('Cài đặt dự án', 'Project settings'),
    pattern: proj('/settings'),
    tips: [
      tip(
        '✎',
        L('Đổi tên và mô tả', 'Rename and describe'),
        L(
          'Mã dự án giữ nguyên để link và mã REQ không bị gãy.',
          "The project key stays fixed so links and REQ keys don't break.",
        ),
      ),
      tip(
        '✦',
        L('Bật tắt tiện ích AI', 'Toggle AI helpers'),
        L(
          'Tắt AI thì ẩn Vẽ sơ đồ, Gợi ý testcase và Tạo từ ghi chú họp.',
          'Turning AI off hides Draw diagram, Suggest tests and From meeting notes.',
        ),
      ),
      tip(
        '▣',
        L('Lưu trữ thay vì xoá', 'Archive instead of delete'),
        L(
          'Dự án lưu trữ chuyển sang chỉ đọc, vẫn tra cứu được.',
          'Archived projects become read-only but stay searchable.',
        ),
      ),
    ],
  },
  {
    id: 'wizard',
    title: L('Tạo dự án', 'Create project'),
    pattern: /^\/workspaces\/\d+\/projects\/new$/,
    tips: [
      tip(
        '1',
        L('Chọn quy trình phù hợp', 'Pick the right process'),
        L(
          'Scrum cho sprint cố định, Kanban cho việc liên tục, Tuỳ chỉnh để tự đặt giai đoạn.',
          'Scrum for fixed sprints, Kanban for continuous flow, Custom to define your own phases.',
        ),
      ),
      tip(
        '2',
        L('Mã dự án ngắn, dễ nhớ', 'Keep the key short'),
        L(
          'Mã đứng đầu mọi mã REQ và issue, không đổi được sau này.',
          "The key prefixes every REQ and issue key and can't change later.",
        ),
      ),
      tip(
        '3',
        L('Thêm đội ngay từ đầu', 'Add the team up front'),
        L(
          'Gán role cho từng người để mỗi người có menu đúng vai trò.',
          'Give each person a role so they get the right menu.',
        ),
      ),
    ],
  },
  {
    id: 'workspace.detail',
    title: L('Workspace', 'Workspace'),
    pattern: /^\/workspaces\/\d+(\/(projects|members|settings))?\/?$/,
    tips: [
      tip(
        '▤',
        L('Workspace gom các dự án', 'Workspaces group projects'),
        L(
          'Mỗi phòng ban hay khách hàng nên có một workspace riêng.',
          'Give each department or client its own workspace.',
        ),
      ),
      tip(
        '＋',
        L('Thêm thành viên workspace', 'Add workspace members'),
        L(
          'Người trong workspace mới được thêm vào các dự án bên trong.',
          'Only workspace members can be added to its projects.',
        ),
      ),
      tip(
        '◉',
        L('Kế thừa quyền dự án', 'Inherited project access'),
        L(
          'Role có quyền kế thừa sẽ vào được mọi dự án trong workspace.',
          'Roles with inherited access can open every project in the workspace.',
        ),
      ),
    ],
  },
  {
    id: 'workspace.list',
    title: L('Workspace', 'Workspaces'),
    pattern: /^\/workspaces\/?$/,
    tips: [
      tip(
        '＋',
        L('Tạo workspace theo nhóm', 'One workspace per team'),
        L(
          'Tách workspace theo phòng ban hoặc khách hàng để quyền gọn hơn.',
          'Split workspaces by department or client to keep access simple.',
        ),
      ),
      tip(
        '↗',
        L('Đổi nhanh ở thanh bên', 'Switch from the sidebar'),
        L(
          'Ô trên cùng thanh bên chuyển workspace mà không cần quay lại đây.',
          'The box at the top of the sidebar switches workspace without coming back here.',
        ),
      ),
      tip(
        '▣',
        L('Lưu trữ khi xong việc', 'Archive when done'),
        L(
          'Workspace lưu trữ chuyển sang chỉ đọc cùng mọi dự án bên trong.',
          'Archiving makes the workspace and all its projects read-only.',
        ),
      ),
    ],
  },
  {
    id: 'projects',
    title: L('Dự án', 'Projects'),
    pattern: /^\/projects\/?$/,
    tips: [
      tip(
        '↗',
        L('Mở thẳng Việc của tôi', 'Projects open on My work'),
        L(
          'Mỗi dự án mở ra danh sách việc của riêng bạn trong dự án đó.',
          'Each project opens on your own work list for that project.',
        ),
      ),
      tip(
        '＋',
        L('Tạo dự án trong workspace', 'Create inside a workspace'),
        L(
          'Dự án luôn thuộc một workspace; chọn workspace trước khi tạo.',
          'Projects always belong to a workspace; pick one before creating.',
        ),
      ),
      TIP_CTRL_K,
    ],
  },
  {
    id: 'admin.roles',
    title: L('Quản trị vai trò', 'Roles'),
    pattern: /^\/admin\/roles(\/.*)?$/,
    tips: [
      tip(
        '▦',
        L('Role theo phạm vi', 'Roles have a scope'),
        L(
          'Role công ty, workspace và dự án tách riêng; chỉ gán được đúng phạm vi.',
          'Company, workspace and project roles are separate and assigned at their own level.',
        ),
      ),
      tip(
        '✎',
        L('Đặt tên theo vai trò thật', 'Name roles after real jobs'),
        L(
          'Tên có "QA", "BA", "Dev"… giúp SSAM xếp menu đúng cho người được gán.',
          'Names containing "QA", "BA", "Dev"… let SSAM order menus right for assignees.',
        ),
      ),
      tip(
        '⊘',
        L('Vô hiệu hoá trước khi xoá', 'Disable before deleting'),
        L(
          'Role đang được gán không xoá được; vô hiệu hoá để ngừng dùng.',
          "Roles in use can't be deleted; disable them instead.",
        ),
      ),
    ],
  },
  {
    id: 'admin.users',
    title: L('Quản trị người dùng', 'Users'),
    pattern: /^\/admin\/users\/?$/,
    tips: [
      tip(
        '＋',
        L('Mời kèm role và workspace', 'Invite with role and workspace'),
        L(
          'Người được mời vào thẳng đúng workspace với role đã chọn.',
          'Invitees land in the right workspace with the chosen role.',
        ),
      ),
      tip(
        '⇪',
        L('Nhập hàng loạt từ CSV', 'Bulk import from CSV'),
        L('Dùng khi cần thêm cả đội một lần.', 'Use it to add a whole team at once.'),
      ),
      tip(
        '⊘',
        L('Vô hiệu hoá thay vì xoá', 'Deactivate, not delete'),
        L(
          'Tài khoản bị vô hiệu hoá không đăng nhập được nhưng lịch sử vẫn giữ.',
          "Deactivated accounts can't sign in but their history is kept.",
        ),
      ),
    ],
  },
]

// ---------- Hỏi đáp ----------

const projectPath = (rest: string) => (ctx: HelpContext) => (ctx.projectId ? `/projects/${ctx.projectId}${rest}` : null)

const GO_MY_WORK: HelpAction = {
  kind: 'navigate',
  label: L('Mở Việc của tôi', 'Open My work'),
  to: projectPath('/my-work'),
  hint: L('Dự án này', 'This project'),
}
const GO_DOCS: HelpAction = {
  kind: 'navigate',
  label: L('Mở Tài liệu', 'Open Documents'),
  to: projectPath('/documents'),
}
const GO_NEW_DOC: HelpAction = {
  kind: 'navigate',
  label: L('Tạo tài liệu mới', 'Create a document'),
  to: projectPath('/documents?new=blank'),
}
const GO_NOTES: HelpAction = {
  kind: 'navigate',
  label: L('Tạo từ ghi chú họp', 'Create from meeting notes'),
  to: projectPath('/documents?new=notes'),
}
const GO_KANBAN: HelpAction = { kind: 'navigate', label: L('Mở Kanban', 'Open Kanban'), to: projectPath('/kanban') }
const GO_BACKLOG: HelpAction = {
  kind: 'navigate',
  label: L('Mở Backlog', 'Open Backlog'),
  to: projectPath('/kanban/backlog'),
}
const GO_TESTS: HelpAction = {
  kind: 'navigate',
  label: L('Mở kho testcase', 'Open test cases'),
  to: projectPath('/tests'),
}
const GO_CYCLES: HelpAction = {
  kind: 'navigate',
  label: L('Mở Đợt chạy', 'Open test cycles'),
  to: projectPath('/tests/cycles'),
}
const GO_MEMBERS: HelpAction = {
  kind: 'navigate',
  label: L('Mở Thành viên dự án', 'Open project members'),
  to: projectPath('/members'),
}
const GO_WORKFLOW: HelpAction = {
  kind: 'navigate',
  label: L('Mở Workflow', 'Open Workflow'),
  to: projectPath('/workflow'),
}
const GO_SETTINGS: HelpAction = {
  kind: 'navigate',
  label: L('Mở Cài đặt dự án', 'Open project settings'),
  to: projectPath('/settings'),
}
const GO_INVITE: HelpAction = {
  kind: 'navigate',
  label: L('Mời vào công ty', 'Invite to the company'),
  to: () => '/members/invite',
}
const GO_ROLES: HelpAction = {
  kind: 'navigate',
  label: L('Mở Quản trị vai trò', 'Open Roles'),
  to: () => '/admin/roles',
}
const GO_USERS: HelpAction = {
  kind: 'navigate',
  label: L('Mở Quản trị người dùng', 'Open Users'),
  to: () => '/admin/users',
}
const GO_WORKSPACES: HelpAction = {
  kind: 'navigate',
  label: L('Mở danh sách workspace', 'Open workspaces'),
  to: () => '/workspaces',
}
const GO_NEW_PROJECT: HelpAction = {
  kind: 'navigate',
  label: L('Tạo dự án', 'Create a project'),
  to: (ctx) => (ctx.workspaceId ? `/workspaces/${ctx.workspaceId}/projects/new` : '/workspaces'),
}

export const HELP_QA: HelpQA[] = [
  {
    id: 'submit',
    q: L('Làm sao gửi duyệt tài liệu?', 'How do I submit a document for review?'),
    title: L('Gửi duyệt tài liệu', 'Submit a document for review'),
    answer: L(
      'Mở trang → bấm Gửi duyệt ở góc phải. Trang cần có ít nhất 1 REQ. Người có quyền duyệt (thường là PM) sẽ thấy trong Việc của tôi.',
      'Open the page → click Submit for review at the top right. The page needs at least one REQ. Approvers (usually the PM) see it in My work.',
    ),
    variants: [
      'gửi duyệt',
      'nộp duyệt',
      'trình duyệt tài liệu',
      'submit for review',
      'send for approval',
      'request review',
      'submit document',
    ],
    keywords: ['gửi', 'duyệt', 'submit'],
    actions: [
      GO_DOCS,
      {
        ...GO_MY_WORK,
        label: L('Xem tài liệu đang chờ duyệt', 'See documents in review'),
        hint: L('Việc của tôi', 'My work'),
      },
    ],
    related: ['approver', 'changes-requested'],
  },
  {
    id: 'approver',
    q: L('Ai được phê duyệt tài liệu?', 'Who can approve documents?'),
    title: L('Ai được phê duyệt', 'Who can approve'),
    answer: L(
      'Người có quyền "Phê duyệt tài liệu" trong dự án, thường là PM. Quyền này nằm trong role dự án; người viết không tự duyệt trang của mình.',
      'Anyone with the "Approve documents" permission in the project, usually the PM. It comes from the project role; authors cannot approve their own pages.',
    ),
    variants: ['ai duyệt', 'người duyệt', 'quyền phê duyệt', 'who approves', 'approval permission', 'approver'],
    keywords: ['phê', 'duyệt', 'approve', 'approver'],
    actions: [GO_MEMBERS, GO_ROLES],
    related: ['submit', 'change-role'],
  },
  {
    id: 'approve',
    q: L('Làm sao phê duyệt một trang?', 'How do I approve a page?'),
    title: L('Phê duyệt trang', 'Approve a page'),
    answer: L(
      'Mở trang đang chờ duyệt (có trong Việc của tôi) → bấm Phê duyệt. Bấm số phiên bản → So sánh để chỉ đọc phần đã đổi trước khi duyệt.',
      'Open the page in review (listed in My work) → click Approve. Click the version → Compare to read only what changed first.',
    ),
    variants: ['phê duyệt trang', 'duyệt tài liệu', 'chấp thuận', 'approve document', 'approve page', 'sign off'],
    keywords: ['phê', 'approve'],
    actions: [GO_MY_WORK],
    related: ['changes-requested', 'compare'],
  },
  {
    id: 'changes-requested',
    q: L('Bị yêu cầu chỉnh sửa thì làm gì?', 'What do I do when changes are requested?'),
    title: L('Bị yêu cầu chỉnh sửa', 'Changes requested'),
    answer: L(
      'Mở trang từ Việc của tôi, đọc ghi chú của người duyệt trong khung bình luận, sửa rồi Gửi duyệt lại. Người duyệt yêu cầu sửa qua menu ⋯ → Yêu cầu chỉnh sửa.',
      "Open the page from My work, read the reviewer's note in the comments panel, edit and submit again. Reviewers send pages back via ⋯ → Request changes.",
    ),
    variants: ['yêu cầu sửa', 'bị trả về', 'cần sửa', 'request changes', 'sent back', 'rejected document'],
    keywords: ['sửa', 'changes'],
    actions: [GO_MY_WORK],
    related: ['submit', 'comment'],
  },
  {
    id: 'req-what',
    q: L('REQ là gì?', 'What is a REQ?'),
    title: L('REQ là gì', 'What a REQ is'),
    answer: L(
      'REQ là một yêu cầu được đánh dấu trong tài liệu, có mã riêng (vd CORE-REQ-12). Issue và testcase liên kết vào REQ, nên khi REQ đổi cả đội được báo.',
      'A REQ is a requirement marked in a document with its own key (e.g. CORE-REQ-12). Issues and test cases link to REQs, so the team is told when one changes.',
    ),
    variants: ['req là gì', 'requirement là gì', 'yêu cầu là gì', 'mã req', 'what is req', 'requirement key'],
    keywords: ['req', 'requirement'],
    related: ['req-mark', 'req-changed'],
  },
  {
    id: 'req-mark',
    q: L('Làm sao đánh dấu REQ?', 'How do I mark a REQ?'),
    title: L('Đánh dấu REQ', 'Mark a REQ'),
    answer: L(
      'Bôi đen tiêu đề hoặc đoạn yêu cầu → bấm Đánh dấu REQ trên thanh nổi, hoặc gõ / rồi chọn REQ. Mã REQ được cấp tự động.',
      'Select a heading or requirement paragraph → click Mark as REQ in the floating bar, or type / and pick REQ. The key is assigned automatically.',
    ),
    variants: ['đánh dấu req', 'tạo req', 'thêm req', 'gắn req', 'mark req', 'add requirement', 'create req'],
    keywords: ['đánh', 'dấu', 'mark', 'req'],
    actions: [GO_DOCS],
    related: ['req-what', 'issue-from-req'],
  },
  {
    id: 'req-changed',
    q: L('REQ đã đổi nghĩa là gì?', 'What does "REQ changed" mean?'),
    title: L('Cờ "REQ đã đổi"', 'The "REQ changed" flag'),
    answer: L(
      'Một bản tài liệu mới được duyệt đã sửa REQ này. Issue liên kết có cờ "REQ đã đổi": mở → Xem thay đổi để so REQ cũ/mới rồi xác nhận để bỏ cờ.',
      'A newly approved version changed this REQ. Linked issues get a "REQ changed" flag: open it → See changes to compare old and new, then acknowledge to clear it.',
    ),
    variants: [
      'req thay đổi',
      'req bị đổi',
      'yêu cầu thay đổi',
      'req changed',
      'requirement changed',
      'xác nhận thay đổi req',
      'acknowledge change',
    ],
    keywords: ['đổi', 'changed'],
    actions: [GO_MY_WORK, GO_KANBAN],
    related: ['test-review', 'compare'],
  },
  {
    id: 'diagram',
    q: L('Làm sao vẽ sơ đồ?', 'How do I draw a diagram?'),
    title: L('Vẽ sơ đồ', 'Draw a diagram'),
    answer: L(
      'Bôi đen đoạn mô tả luồng → ✦ Vẽ sơ đồ; khi bản xem trước hiện ra, nhấn Tab để áp dụng. Hoặc gõ / → Sơ đồ để tự viết.',
      'Select a flow description → ✦ Draw diagram; when the preview shows, press Tab to apply. Or type / → Diagram to write one yourself.',
    ),
    variants: [
      'vẽ sơ đồ',
      'tạo sơ đồ',
      'vẽ flow',
      'sơ đồ luồng',
      'mermaid',
      'draw diagram',
      'flowchart',
      'create diagram',
    ],
    keywords: ['sơ', 'đồ', 'diagram', 'flowchart', 'mermaid'],
    actions: [GO_DOCS],
    related: ['slash', 'figma'],
  },
  {
    id: 'compare',
    q: L('Làm sao so sánh phiên bản?', 'How do I compare versions?'),
    title: L('So sánh phiên bản', 'Compare versions'),
    answer: L(
      'Bấm số phiên bản cạnh tên trang → chọn bản → So sánh. Dùng ↑ ↓ để nhảy giữa các thay đổi, Tắt so sánh để quay lại.',
      'Click the version next to the page title → pick a version → Compare. Use ↑ ↓ to jump between changes, Exit compare to go back.',
    ),
    variants: [
      'so sánh phiên bản',
      'xem lịch sử',
      'phiên bản cũ',
      'khác nhau giữa hai bản',
      'compare versions',
      'version history',
      'diff',
    ],
    keywords: ['so', 'sánh', 'phiên', 'compare', 'version', 'diff'],
    actions: [GO_DOCS],
    related: ['req-changed', 'approve'],
  },
  {
    id: 'comment',
    q: L('Làm sao bình luận trên tài liệu?', 'How do I comment on a document?'),
    title: L('Bình luận', 'Comment'),
    answer: L(
      'Bôi đen một câu → Bình luận; người viết được báo ngay. Trả lời và đánh dấu đã xử lý trong khung bình luận bên phải. Ctrl Enter để gửi nhanh.',
      'Select a sentence → Comment; the author is notified right away. Reply and resolve in the comments panel on the right. Ctrl Enter sends.',
    ),
    variants: ['bình luận', 'góp ý', 'comment', 'trả lời bình luận', 'reply comment', 'feedback'],
    keywords: ['bình', 'luận', 'comment'],
    actions: [GO_DOCS],
    related: ['changes-requested'],
  },
  {
    id: 'slash',
    q: L('Phím / trong tài liệu làm gì?', 'What does / do in a document?'),
    title: L('Chèn bằng phím /', 'Insert with /'),
    answer: L(
      'Gõ / ở đầu dòng để chèn bảng, REQ, checklist, sơ đồ, khung Figma, khối code hay callout.',
      'Type / at the start of a line to insert tables, REQs, checklists, diagrams, Figma frames, code blocks or callouts.',
    ),
    variants: ['chèn bảng', 'thêm bảng', 'checklist', 'slash command', 'insert table', 'phím gạch chéo'],
    keywords: ['chèn', 'insert', 'bảng', 'table'],
    actions: [GO_DOCS],
    related: ['diagram', 'figma'],
  },
  {
    id: 'figma',
    q: L('Làm sao gắn thiết kế Figma?', 'How do I embed a Figma design?'),
    title: L('Gắn khung Figma', 'Embed a Figma frame'),
    answer: L(
      'Trong tài liệu gõ / → Figma rồi dán link khung. Khung hiện ngay trong trang và luôn là bản mới nhất.',
      'In a document type / → Figma and paste the frame link. It shows inline and always reflects the latest version.',
    ),
    variants: ['figma', 'gắn thiết kế', 'nhúng figma', 'embed figma', 'design link', 'mockup'],
    keywords: ['figma', 'thiết', 'kế', 'design'],
    actions: [GO_DOCS],
    related: ['slash'],
  },
  {
    id: 'meeting-notes',
    q: L('Tạo tài liệu từ ghi chú họp thế nào?', 'How do I create a document from meeting notes?'),
    title: L('Tạo từ ghi chú họp', 'From meeting notes'),
    answer: L(
      'Bấm Tài liệu mới → Từ ghi chú họp, dán ghi chú. SSAM dựng khung trang và đánh dấu sẵn REQ để bạn sửa lại.',
      'Click New document → From meeting notes and paste your notes. SSAM drafts the page and marks REQs for you to refine.',
    ),
    variants: [
      'ghi chú họp',
      'biên bản họp',
      'tạo tài liệu tự động',
      'meeting notes',
      'generate document',
      'ai tạo tài liệu',
    ],
    keywords: ['ghi', 'chú', 'họp', 'notes', 'meeting'],
    actions: [GO_NOTES],
    related: ['new-doc'],
  },
  {
    id: 'new-doc',
    q: L('Làm sao tạo tài liệu mới?', 'How do I create a new document?'),
    title: L('Tạo tài liệu mới', 'Create a document'),
    answer: L(
      'Trong tab Tài liệu bấm Tài liệu mới (trang trống hoặc theo mẫu), hoặc Ctrl K → Tạo tài liệu.',
      'In Documents click New document (blank or from a template), or Ctrl K → New document.',
    ),
    variants: ['tạo tài liệu', 'thêm trang', 'trang mới', 'tài liệu mới', 'new document', 'new page', 'create page'],
    keywords: ['tạo', 'mới', 'new', 'create'],
    actions: [GO_NEW_DOC, GO_NOTES],
    related: ['meeting-notes', 'submit'],
  },
  {
    id: 'fullscreen',
    q: L('Làm sao đọc tài liệu toàn màn hình?', 'How do I read a document full screen?'),
    title: L('Toàn màn hình', 'Full screen'),
    answer: L(
      'Trong tab Tài liệu nhấn F (hoặc nút ⤢ trên đầu trang). Esc để thoát.',
      'In Documents press F (or the ⤢ button at the top). Esc to exit.',
    ),
    variants: ['toàn màn hình', 'phóng to', 'chế độ tập trung', 'full screen', 'focus mode', 'fullscreen'],
    keywords: ['toàn', 'màn', 'fullscreen'],
    actions: [GO_DOCS],
    related: ['shortcuts'],
  },
  {
    id: 'issue-from-req',
    q: L('Làm sao tạo issue từ REQ?', 'How do I create an issue from a REQ?'),
    title: L('Tạo issue từ REQ', 'Create an issue from a REQ'),
    answer: L(
      'Vào Backlog: REQ chưa có issue hiện nút "Tạo issue từ REQ"; issue tạo ra đã liên kết sẵn REQ đó.',
      'Go to the Backlog: REQs without issues show "Create issue from REQ"; the new issue is already linked to that REQ.',
    ),
    variants: [
      'tạo issue',
      'tạo task từ req',
      'issue từ yêu cầu',
      'create issue',
      'new issue',
      'create ticket',
      'tạo việc',
    ],
    keywords: ['issue', 'task', 'ticket'],
    actions: [GO_BACKLOG],
    related: ['drag-issue', 'sprint-start'],
  },
  {
    id: 'drag-issue',
    q: L('Làm sao kéo issue đổi trạng thái?', 'How do I move an issue to another status?'),
    title: L('Kéo issue', 'Move an issue'),
    answer: L(
      'Trên Kanban kéo thẻ sang cột khác là đổi trạng thái. Trong Backlog kéo issue lên sprint để đưa vào sprint đó.',
      'On the Kanban board drag a card to another column to change status. In the Backlog drag an issue into a sprint to plan it.',
    ),
    variants: [
      'kéo issue',
      'kéo thẻ',
      'đổi trạng thái issue',
      'chuyển cột',
      'move card',
      'drag issue',
      'change status',
    ],
    keywords: ['kéo', 'drag', 'move', 'trạng', 'thái'],
    actions: [GO_KANBAN, GO_BACKLOG],
    related: ['sprint-start', 'wip'],
  },
  {
    id: 'sprint-start',
    q: L('Làm sao bắt đầu sprint?', 'How do I start a sprint?'),
    title: L('Bắt đầu sprint', 'Start a sprint'),
    answer: L(
      'Vào Backlog, kéo issue vào sprint tới (xem thanh sức chứa theo điểm) rồi bấm Bắt đầu sprint. Board Kanban chuyển sang sprint đó.',
      'In the Backlog, drag issues into the next sprint (watch the capacity bar) and click Start sprint. The Kanban board switches to that sprint.',
    ),
    variants: [
      'bắt đầu sprint',
      'mở sprint',
      'tạo sprint',
      'lên kế hoạch sprint',
      'start sprint',
      'sprint planning',
      'create sprint',
    ],
    keywords: ['sprint'],
    actions: [GO_BACKLOG],
    related: ['drag-issue', 'issue-from-req'],
  },
  {
    id: 'wip',
    q: L('Giới hạn WIP là gì?', 'What is a WIP limit?'),
    title: L('Giới hạn WIP', 'WIP limits'),
    answer: L(
      'Số issue tối đa nên nằm cùng lúc trong một cột. Cột vượt giới hạn đổi màu cảnh báo để đội xử lý cho xong trước khi nhận thêm.',
      'The most issues a column should hold at once. Columns over the limit turn to a warning color so the team finishes before pulling more.',
    ),
    variants: ['wip', 'giới hạn cột', 'việc đang làm', 'work in progress', 'column limit'],
    keywords: ['wip'],
    actions: [GO_KANBAN],
    related: ['drag-issue'],
  },
  {
    id: 'run-test',
    q: L('Làm sao chạy test?', 'How do I run tests?'),
    title: L('Chạy test', 'Run tests'),
    answer: L(
      'Vào Đợt chạy, mở đợt đang mở → bấm Chạy. Chế độ chạy hiện từng testcase; ghi P (đạt), F (lỗi) hoặc B (bị chặn) rồi sang test tiếp.',
      'Open Test cycles, pick the open cycle → Run. The runner shows one test at a time; record P (pass), F (fail) or B (blocked) and move on.',
    ),
    variants: ['chạy test', 'chạy testcase', 'kiểm thử', 'thực hiện test', 'run test', 'execute test', 'test runner'],
    keywords: ['chạy', 'run', 'execute'],
    actions: [
      GO_CYCLES,
      { ...GO_MY_WORK, label: L('Xem lượt chạy của tôi', 'See my test runs'), hint: L('Việc của tôi', 'My work') },
    ],
    related: ['test-fail', 'cycle-create'],
  },
  {
    id: 'test-fail',
    q: L('Ghi kết quả lỗi thế nào?', 'How do I record a failed test?'),
    title: L('Ghi kết quả lỗi', 'Record a failure'),
    answer: L(
      'Trong chế độ chạy bấm F (Lỗi), ghi chú ngắn và chọn Tạo bug: bug được gắn sẵn REQ và testcase, Dev nhận trong Việc của tôi.',
      "In the runner press F (Fail), add a short note and choose Create bug: the bug links the REQ and test case and lands in the dev's My work.",
    ),
    variants: [
      'ghi lỗi',
      'test fail',
      'báo lỗi',
      'tạo bug',
      'ghi kết quả fail',
      'record failure',
      'report bug',
      'create defect',
    ],
    keywords: ['lỗi', 'fail', 'bug', 'defect'],
    actions: [GO_CYCLES],
    related: ['run-test', 'test-blocked'],
  },
  {
    id: 'test-blocked',
    q: L('Khi nào ghi Bị chặn (B)?', 'When do I mark a test Blocked?'),
    title: L('Kết quả Bị chặn', 'Blocked result'),
    answer: L(
      'Khi không thể chạy test (thiếu dữ liệu, môi trường hỏng, tính năng chưa xong). Ghi lý do để người khác gỡ chặn rồi chạy lại.',
      "When the test can't be executed (missing data, broken environment, unfinished feature). Note why so someone can unblock it, then re-run.",
    ),
    variants: ['bị chặn', 'blocked', 'không chạy được test', 'test blocked'],
    keywords: ['chặn', 'blocked'],
    actions: [GO_CYCLES],
    related: ['test-fail', 'rerun'],
  },
  {
    id: 'test-review',
    q: L('Testcase cần xem lại là gì?', 'What does "needs review" on a test case mean?'),
    title: L('Testcase cần xem lại', 'Test case needs review'),
    answer: L(
      'REQ liên kết vừa đổi trong một bản tài liệu được duyệt, nên các bước có thể không còn đúng. Mở testcase, sửa nếu cần rồi lưu để bỏ cờ.',
      'Its linked REQ changed in an approved document version, so the steps may be outdated. Open the test case, update it if needed and save to clear the flag.',
    ),
    variants: ['cần xem lại', 'testcase cờ vàng', 'needs review', 'test case outdated', 'testcase lỗi thời'],
    keywords: ['xem', 'lại', 'review'],
    actions: [GO_TESTS],
    related: ['rerun', 'req-changed'],
  },
  {
    id: 'rerun',
    q: L('Lượt cần chạy lại là gì?', 'What is a run to re-run?'),
    title: L('Lượt cần chạy lại', 'Runs to re-run'),
    answer: L(
      'REQ đổi trong lúc đợt chạy đang mở thì các lượt đã có kết quả được đánh dấu chạy lại; kết quả cũ vẫn được giữ trong lịch sử.',
      'If a REQ changes while the cycle is open, runs with results are marked to re-run; old results stay in the history.',
    ),
    variants: ['chạy lại', 'rerun', 're-run', 'needs rerun', 'test lại'],
    keywords: ['rerun'],
    actions: [GO_CYCLES],
    related: ['run-test', 'test-review'],
  },
  {
    id: 'suggest-tests',
    q: L('Làm sao tạo testcase từ REQ?', 'How do I create test cases from a REQ?'),
    title: L('Tạo testcase từ REQ', 'Test cases from a REQ'),
    answer: L(
      'Trong kho testcase chọn REQ → Gợi ý: mỗi tiêu chí nghiệm thu chưa có test thành một đề xuất, bạn chọn, sửa rồi lưu. Cần bật tiện ích AI của dự án.',
      'In Test cases pick REQs → Suggest: each untested acceptance criterion becomes a proposal you can select, edit and save. Requires the project AI helpers.',
    ),
    variants: [
      'tạo testcase',
      'gợi ý testcase',
      'sinh testcase',
      'testcase từ yêu cầu',
      'create test case',
      'suggest tests',
      'generate tests',
    ],
    keywords: ['testcase', 'gợi', 'ý', 'suggest'],
    actions: [GO_TESTS],
    related: ['cycle-create', 'run-test'],
  },
  {
    id: 'cycle-create',
    q: L('Làm sao tạo đợt chạy?', 'How do I create a test cycle?'),
    title: L('Tạo đợt chạy', 'Create a test cycle'),
    answer: L(
      'Vào Đợt chạy → Tạo đợt: đặt tên, chọn sprint và các testcase; mỗi testcase thành một lượt chạy giao cho tester.',
      'Open Test cycles → New cycle: name it, pick a sprint and test cases; each test case becomes a run assigned to a tester.',
    ),
    variants: ['tạo đợt chạy', 'test cycle', 'đợt test', 'create cycle', 'test plan', 'giao test'],
    keywords: ['đợt', 'cycle'],
    actions: [GO_CYCLES],
    related: ['run-test'],
  },
  {
    id: 'invite',
    q: L('Làm sao mời thành viên?', 'How do I invite members?'),
    title: L('Mời thành viên', 'Invite members'),
    answer: L(
      'Mời người vào công ty kèm role và workspace (Mời thành viên). Sau đó vào Thành viên của dự án để thêm họ vào dự án.',
      "Invite people to the company with a role and workspace (Invite members). Then add them in the project's Members tab.",
    ),
    variants: [
      'mời thành viên',
      'thêm thành viên',
      'thêm người',
      'mời đồng nghiệp',
      'invite member',
      'add member',
      'add user',
      'invite team',
    ],
    keywords: ['mời', 'invite', 'thành', 'viên', 'member'],
    actions: [GO_INVITE, GO_MEMBERS],
    related: ['change-role', 'workspace'],
  },
  {
    id: 'change-role',
    q: L('Làm sao đổi role của một người?', "How do I change someone's role?"),
    title: L('Đổi role', 'Change a role'),
    answer: L(
      'Trong dự án: Thành viên → chọn người → đổi role (cần quyền quản lý thành viên). Role cấp công ty đổi ở Quản trị người dùng.',
      'In a project: Members → pick the person → change role (needs member management permission). Company roles change in Users admin.',
    ),
    variants: ['đổi role', 'đổi vai trò', 'phân quyền', 'gán role', 'change role', 'assign role', 'permissions'],
    keywords: ['role', 'vai', 'trò', 'quyền'],
    actions: [GO_MEMBERS, GO_USERS],
    related: ['create-role', 'approver'],
  },
  {
    id: 'create-role',
    q: L('Làm sao tạo role mới?', 'How do I create a new role?'),
    title: L('Tạo role', 'Create a role'),
    answer: L(
      'Quản trị vai trò → Tạo role, chọn phạm vi (công ty, workspace, dự án) và tick quyền. Đặt tên có "QA", "BA", "Dev"… để SSAM xếp menu đúng vai trò.',
      'Roles admin → New role, pick a scope (company, workspace, project) and tick permissions. Names containing "QA", "BA", "Dev"… let SSAM order menus for that job.',
    ),
    variants: ['tạo role', 'thêm vai trò', 'role mới', 'new role', 'create role', 'custom role'],
    keywords: ['role', 'vai', 'trò'],
    actions: [GO_ROLES],
    related: ['change-role'],
  },
  {
    id: 'menu-order',
    q: L('Vì sao menu dự án của tôi khác người khác?', 'Why is my project menu different?'),
    title: L('Menu theo vai trò', 'Menu by role'),
    answer: L(
      'SSAM sắp menu và Việc của tôi theo role của bạn trong dự án: QA thấy Testcase trước, Dev thấy Kanban trước, PM thấy Tổng quan trước. Mục khác vẫn mở được bằng Ctrl K.',
      'SSAM orders the menu and My work by your project role: QA sees Test cases first, Dev sees Kanban first, PM sees Overview first. Other sections stay reachable via Ctrl K.',
    ),
    variants: [
      'menu khác',
      'thiếu menu',
      'không thấy kanban',
      'không thấy testcase',
      'menu order',
      'missing menu',
      'where is kanban',
    ],
    keywords: ['menu'],
    related: ['change-role'],
  },
  {
    id: 'workflow',
    q: L('Workflow dự án là gì?', 'What is the project workflow?'),
    title: L('Workflow dự án', 'Project workflow'),
    answer: L(
      'Workflow gồm các giai đoạn giao hàng và trạng thái của issue. Trạng thái chính là các cột Kanban; đổi ở tab Workflow (cần quyền sửa dự án).',
      'The workflow defines delivery phases and issue statuses. Statuses are the Kanban columns; edit them in the Workflow tab (needs project edit permission).',
    ),
    variants: [
      'workflow',
      'quy trình',
      'giai đoạn',
      'trạng thái',
      'thêm cột kanban',
      'phases',
      'statuses',
      'add column',
    ],
    keywords: ['workflow', 'quy', 'trình', 'giai', 'đoạn'],
    actions: [GO_WORKFLOW],
    related: ['drag-issue'],
  },
  {
    id: 'ai-toggle',
    q: L('Làm sao bật tắt AI?', 'How do I turn AI on or off?'),
    title: L('Bật tắt tiện ích AI', 'Toggle AI helpers'),
    answer: L(
      'Cài đặt dự án → Tiện ích AI. Tắt thì ẩn Vẽ sơ đồ, Gợi ý testcase và Tạo từ ghi chú họp cho cả dự án.',
      'Project settings → AI helpers. Turning it off hides Draw diagram, Suggest tests and From meeting notes for the whole project.',
    ),
    variants: ['bật ai', 'tắt ai', 'tiện ích ai', 'ai không hoạt động', 'enable ai', 'disable ai', 'ai features'],
    keywords: ['ai'],
    actions: [GO_SETTINGS],
    related: ['diagram', 'suggest-tests'],
  },
  {
    id: 'archive',
    q: L('Lưu trữ dự án thì sao?', 'What happens when I archive a project?'),
    title: L('Lưu trữ dự án', 'Archive a project'),
    answer: L(
      'Dự án chuyển sang chỉ đọc: tài liệu, issue, testcase vẫn xem và tìm được nhưng không sửa được. Làm ở Cài đặt dự án.',
      'The project becomes read-only: documents, issues and test cases stay viewable and searchable but cannot be edited. Do it in Project settings.',
    ),
    variants: ['lưu trữ', 'xoá dự án', 'đóng dự án', 'archive project', 'delete project', 'close project'],
    keywords: ['lưu', 'trữ', 'archive'],
    actions: [GO_SETTINGS],
  },
  {
    id: 'workspace',
    q: L('Workspace là gì?', 'What is a workspace?'),
    title: L('Workspace', 'Workspaces'),
    answer: L(
      'Workspace gom các dự án của một phòng ban hay khách hàng. Người phải ở trong workspace mới được thêm vào dự án bên trong.',
      'A workspace groups the projects of one department or client. People must be in the workspace before joining its projects.',
    ),
    variants: ['workspace là gì', 'không gian làm việc', 'tạo workspace', 'what is workspace', 'create workspace'],
    keywords: ['workspace'],
    actions: [GO_WORKSPACES],
    related: ['new-project', 'invite'],
  },
  {
    id: 'new-project',
    q: L('Làm sao tạo dự án?', 'How do I create a project?'),
    title: L('Tạo dự án', 'Create a project'),
    answer: L(
      'Vào một workspace → Tạo dự án. Trình tạo hỏi quy trình (Scrum, Kanban, Tuỳ chỉnh), mã dự án và đội; bạn thành PM của dự án.',
      'Open a workspace → Create project. The wizard asks for a process (Scrum, Kanban, Custom), a key and the team; you become its PM.',
    ),
    variants: ['tạo dự án', 'dự án mới', 'thêm dự án', 'create project', 'new project'],
    keywords: ['dự', 'án', 'project'],
    actions: [GO_NEW_PROJECT],
    related: ['workspace'],
  },
  {
    id: 'shortcuts',
    q: L('Có những phím tắt nào?', 'What keyboard shortcuts are there?'),
    title: L('Phím tắt', 'Keyboard shortcuts'),
    answer: L(
      'Ctrl K tìm và hỏi (trong dự án), / chèn khối trong tài liệu, F toàn màn hình, Tab áp dụng gợi ý AI, Esc đóng, ? mở mẹo của trang.',
      'Ctrl K to search and ask (in a project), / to insert blocks in a document, F for full screen, Tab to apply an AI suggestion, Esc to close, ? for page tips.',
    ),
    variants: ['phím tắt', 'phim tat', 'keyboard', 'shortcut', 'hotkey', 'ctrl k'],
    keywords: ['phím', 'tắt', 'shortcut', 'shortcuts', 'keyboard', 'hotkey'],
    related: ['fullscreen', 'slash'],
  },
]

// ---------- Phím tắt (thân thẻ "Phím tắt") ----------

export interface HelpShortcut {
  keys: string[]
  label: Bilingual
}

export const HELP_SHORTCUTS: HelpShortcut[] = [
  { keys: ['Ctrl', 'K'], label: L('Tìm và hỏi (trong dự án)', 'Search and ask (in a project)') },
  { keys: ['/'], label: L('Chèn khối trong tài liệu', 'Insert a block in a document') },
  { keys: ['Ctrl', 'S'], label: L('Không cần: tài liệu tự lưu', 'Not needed: documents autosave') },
  { keys: ['F'], label: L('Toàn màn hình tài liệu', 'Document full screen') },
  { keys: ['Tab'], label: L('Áp dụng gợi ý AI (sơ đồ)', 'Apply an AI suggestion (diagram)') },
  { keys: ['Esc'], label: L('Đóng / thoát toàn màn hình', 'Close / exit full screen') },
  { keys: ['?'], label: L('Mở mẹo của trang', 'Open page tips') },
]

// ---------- Tra cứu ----------

/** Mẹo cho đường dẫn hiện tại (pathname + search). Không có trang phù hợp → null. */
export function findHelpTopic(pathname: string, search = ''): HelpTopic | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const topic of HELP_TOPICS) {
    if (!topic.pattern.test(path)) continue
    if (topic.search && !topic.search.test(search)) continue
    return topic
  }
  return null
}

export function topicTips(topic: HelpTopic, role?: ProjectRoleKind | null): HelpTip[] {
  return (role && topic.roles?.[role]) || topic.tips
}

export function findQA(id: string): HelpQA | undefined {
  return HELP_QA.find((e) => e.id === id)
}

/** Ngữ cảnh điều hướng từ URL hiện tại. */
export function helpContextFromPath(pathname: string): HelpContext {
  const num = (re: RegExp) => {
    const m = pathname.match(re)
    return m ? Number(m[1]) : undefined
  }
  return {
    projectId: num(/^\/projects\/(\d+)/),
    workspaceId: num(/^\/workspaces\/(\d+)/),
    documentId: num(/^\/projects\/\d+\/documents\/(\d+)/),
  }
}

export const pick = (text: Bilingual, lang: 'vi' | 'en') => (lang === 'en' ? text.en : text.vi)
