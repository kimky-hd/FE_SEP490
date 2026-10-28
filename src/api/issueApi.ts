import type {
  BugSeverity,
  DataClassification,
  DepartmentLabel,
  EnvironmentType,
  IssueComment,
  IssuePriority,
  IssueType,
  IssueWatcher,
  ProjectIssue,
  ProjectIssueStats,
} from '@/types/issue'
import type { StatusCategory } from '@/types/project'

const STORAGE_KEY = 'ssam.issues.v3'
const PREV_KEYS = ['ssam.issues.v2', 'ssam.issues.v1']

interface StoredIssueData {
  issues: ProjectIssue[]
}

function createInitialSeed(): StoredIssueData {
  const issues: ProjectIssue[] = [
    {
      id: 'iss-20-101',
      projectId: 20,
      key: 'CORE-101',
      type: 'TASK',
      summary: 'Configure Spring Security OAuth2 and JWT Token Filter',
      description:
        'Implement JWT authentication filters at API Gateway and Resource Server. Validate Access Token expiration (15 mins), RSA signatures, and automated Refresh Token rotation per OWASP ASVS guidelines.',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 302,
      statusName: 'In Progress',
      statusCategory: 'IN_PROGRESS',
      priority: 'HIGH',
      storyPoints: 5,
      originalEstimate: '2d',
      dueDate: '2026-10-31',

      // 4-Role Ownership
      assigneeName: 'Sarah Lin',
      assigneeRole: 'Senior Developer',
      assigneeAvatar: 'SL',
      ownerName: 'Sarah Lin',
      ownerRole: 'Senior Developer',
      reporterName: 'Pham Van Khoa (PM)',
      reporterRole: 'Project Manager',
      watchers: [
        { name: 'Pham Van Khoa (PM)', role: 'Project Manager' },
        { name: 'Vu Kim Ky', role: 'Backend Developer' },
      ],

      // Organization & Security Classification
      departmentLabel: 'Backend Team',
      component: 'Authentication & SSO',
      dataClassification: 'CONFIDENTIAL_PII',
      environment: 'DEV',
      labels: ['Backend', 'Security', 'JWT', 'Sprint-3'],

      createdAt: '2026-10-21T09:00:00.000Z',
      updatedAt: '2026-10-27T14:30:00.000Z',
      linkedDocumentId: 101,
      linkedRequirementItemId: 'item-101-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '2.1. Multi-factor Authentication & Temporary Account Lockout',
      traceabilityStatus: 'FRESH',
      comments: [
        {
          id: 'cmt-iss-1',
          authorName: 'Pham Van Khoa (PM)',
          authorRole: 'Project Manager',
          body: '@Sarah Lin Please make sure to handle token expiration gracefully during large multipart file uploads.',
          mentions: ['Sarah Lin'],
          createdAt: '2026-10-22T10:00:00.000Z',
        },
        {
          id: 'cmt-iss-2',
          authorName: 'Sarah Lin',
          authorRole: 'Senior Developer',
          body: 'Added Axios interceptor with single retry on 401 token expired.',
          createdAt: '2026-10-23T11:15:00.000Z',
        },
      ],
      activityLog: [
        {
          id: 'act-1',
          authorName: 'Pham Van Khoa (PM)',
          action: 'Created Issue',
          details: 'Created Task CORE-101 and assigned to Sarah Lin',
          timestamp: '2026-10-21T09:00:00.000Z',
        },
        {
          id: 'act-2',
          authorName: 'Sarah Lin',
          action: 'Transitioned Status',
          details: 'From "To Do" to "In Progress"',
          timestamp: '2026-10-22T08:30:00.000Z',
        },
        {
          id: 'act-3',
          authorName: 'Sarah Lin',
          action: 'Linked Confluence Requirement',
          details: 'Linked with REQ-01 in SRS-01',
          timestamp: '2026-10-22T08:35:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-102',
      projectId: 20,
      key: 'CORE-102',
      type: 'BUG',
      summary: 'Redis brute-force lockout failure after 5 invalid login attempts',
      description:
        'The system fails to increment failed attempt counters in Redis cache, leaving accounts in ACTIVE state rather than transitioning to TEMP_LOCKED after 5 consecutive failures.',
      severity: 'CRITICAL',
      stepsToReproduce:
        '1. Navigate to /login\n2. Enter email: test@company.com with incorrect password\n3. Click Login 6 consecutive times\n4. Observed: System continues displaying invalid credentials without triggering the 15-minute account lockout required by REQ-01.',
      linkedTestCaseCode: 'TC-01-01',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 301,
      statusName: 'To Do',
      statusCategory: 'TODO',
      priority: 'HIGHEST',
      storyPoints: 3,
      originalEstimate: '1d',
      dueDate: '2026-10-29',

      // 4-Role Ownership
      assigneeName: 'Vu Kim Ky',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'KK',
      ownerName: 'Sarah Lin',
      ownerRole: 'Senior Developer',
      reporterName: 'Vu Thi Mai (QA)',
      reporterRole: 'QA Lead',
      watchers: [
        { name: 'Sarah Lin', role: 'Senior Developer' },
        { name: 'Vu Thi Mai (QA)', role: 'QA Lead' },
      ],

      // Organization & Security Classification
      departmentLabel: 'Backend Team',
      component: 'Authentication & SSO',
      dataClassification: 'RESTRICTED',
      environment: 'STAGING',
      labels: ['Bug', 'Security', 'Hotfix', 'Redis'],

      createdAt: '2026-10-25T14:00:00.000Z',
      updatedAt: '2026-10-26T16:00:00.000Z',
      linkedDocumentId: 101,
      linkedRequirementItemId: 'item-101-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '2.1. Multi-factor Authentication & Temporary Account Lockout',
      traceabilityStatus: 'FRESH',
      comments: [
        {
          id: 'cmt-iss-3',
          authorName: 'Vu Thi Mai (QA)',
          authorRole: 'QA Lead',
          body: '@Vu Kim Ky Urgent fix needed for afternoon UAT demonstration.',
          mentions: ['Vu Kim Ky'],
          createdAt: '2026-10-25T14:10:00.000Z',
        },
      ],
      activityLog: [
        {
          id: 'act-4',
          authorName: 'Vu Thi Mai (QA)',
          action: 'Created Defect',
          details: 'Reported defect from Test Case TC-01-01 and assigned to Vu Kim Ky',
          timestamp: '2026-10-25T14:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-103',
      projectId: 20,
      key: 'CORE-103',
      type: 'TASK',
      summary: 'Integrate Napas247 VietQR SDK and Dynamic QR Code Generation',
      description:
        'Implement dynamic EMVCo Napas QR generation with transaction amounts and order reference IDs. Enforce 15-minute expiration timestamp and checksum validation.',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 302,
      statusName: 'In Progress',
      statusCategory: 'IN_PROGRESS',
      priority: 'HIGH',
      storyPoints: 8,
      originalEstimate: '3d',
      dueDate: '2026-11-02',

      // 4-Role Ownership
      assigneeName: 'Pham Minh Luong',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'ML',
      ownerName: 'Pham Minh Luong',
      ownerRole: 'Tech Lead / Payment',
      reporterName: 'Sarah Lin',
      reporterRole: 'Senior Developer',
      watchers: [
        { name: 'Pham Van Khoa (PM)', role: 'Project Manager' },
        { name: 'Vu Kim Ky', role: 'Backend Developer' },
      ],

      // Organization & Security Classification
      departmentLabel: 'Backend Team',
      component: 'Core Banking & VietQR',
      dataClassification: 'RESTRICTED',
      environment: 'DEV',
      labels: ['Payment', 'VietQR', 'SDK', 'Napas'],

      createdAt: '2026-10-22T08:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
      linkedDocumentId: 102,
      linkedRequirementItemId: 'item-102-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '2.1. Dynamic VietQR Generation & Expiration Control',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-5',
          authorName: 'Sarah Lin',
          action: 'Created Issue',
          details: 'Created VietQR payment integration Task',
          timestamp: '2026-10-22T08:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-104',
      projectId: 20,
      key: 'CORE-104',
      type: 'BUG',
      summary: 'Duplicate Credit on Bank Webhook Retries under Network Flapping',
      description:
        'Payment gateway dispatches retry webhooks 200ms apart during latency spikes, triggering double balance credit. Must implement Redis Distributed Lock by transactionId with idempotency key.',
      severity: 'BLOCKER',
      stepsToReproduce:
        '1. Dispatch Napas Webhook request with transactionId = "TXN-9999"\n2. While processing, send identical second request\n3. Observed: Both return HTTP 200 and credit user balance twice.',
      linkedTestCaseCode: 'TC-02-02',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 302,
      statusName: 'In Progress',
      statusCategory: 'IN_PROGRESS',
      priority: 'HIGHEST',
      storyPoints: 5,
      originalEstimate: '1d 4h',
      dueDate: '2026-10-28',

      // 4-Role Ownership
      assigneeName: 'Pham Minh Luong',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'ML',
      ownerName: 'Pham Minh Luong',
      ownerRole: 'Tech Lead / Payment',
      reporterName: 'Vu Thi Mai (QA)',
      reporterRole: 'QA Lead',
      watchers: [
        { name: 'Pham Minh Luong', role: 'Backend Developer' },
        { name: 'Vu Thi Mai (QA)', role: 'QA Lead' },
        { name: 'Pham Van Khoa (PM)', role: 'Project Manager' },
      ],

      // Organization & Security Classification
      departmentLabel: 'Backend Team',
      component: 'Core Banking & VietQR',
      dataClassification: 'RESTRICTED',
      environment: 'PRODUCTION',
      labels: ['Bug', 'Webhook', 'Finance', 'Blocker'],

      createdAt: '2026-10-26T11:00:00.000Z',
      updatedAt: '2026-10-27T15:20:00.000Z',
      linkedDocumentId: 102,
      linkedRequirementItemId: 'item-102-2',
      linkedRequirementKeyCode: 'REQ-02',
      linkedRequirementTitle: '2.2. Bank Webhook Processing & Asynchronous Reconciliation',
      traceabilityStatus: 'UNCONFIRMED_STALE',
      comments: [
        {
          id: 'cmt-iss-4',
          authorName: 'Vu Kim Ky (BA)',
          authorRole: 'Business Analyst',
          body: 'Note: Partial payment rules were just updated in Confluence spec v1.1. Please inspect the diff before patching!',
          mentions: ['Pham Minh Luong'],
          createdAt: '2026-10-27T09:30:00.000Z',
        },
      ],
      activityLog: [
        {
          id: 'act-6',
          authorName: 'SSAM Traceability Engine',
          action: 'Stale Alert',
          details: 'Requirement REQ-02 in SRS-02 draft was updated. Source code verification required!',
          timestamp: '2026-10-27T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-105',
      projectId: 20,
      key: 'CORE-105',
      type: 'TASK',
      summary: 'Build VietQR Transaction History and Settlement Table',
      description:
        'Construct interactive payment history dashboard with real-time transaction statuses, QR modal viewer, and date range filtering.',
      phaseId: 2,
      phaseName: 'Phase 2: UI/UX Design',
      statusId: 203,
      statusName: 'In Review',
      statusCategory: 'IN_PROGRESS',
      priority: 'MEDIUM',
      storyPoints: 3,
      originalEstimate: '2d',
      dueDate: '2026-11-04',

      // 4-Role Ownership
      assigneeName: 'Sarah Lin',
      assigneeRole: 'Frontend Developer',
      assigneeAvatar: 'SL',
      ownerName: 'Vu Kim Ky (BA)',
      ownerRole: 'Product Designer',
      reporterName: 'Pham Minh Luong',
      reporterRole: 'Backend Developer',
      watchers: [{ name: 'Vu Kim Ky (BA)', role: 'Product Designer' }],

      // Organization & Security Classification
      departmentLabel: 'Frontend Team',
      component: 'Confluence Spec Editor',
      dataClassification: 'INTERNAL',
      environment: 'DEV',
      labels: ['Frontend', 'UI/UX', 'Table'],

      createdAt: '2026-10-23T10:00:00.000Z',
      updatedAt: '2026-10-26T17:00:00.000Z',
      linkedDocumentId: 102,
      linkedRequirementItemId: 'item-102-3',
      linkedRequirementKeyCode: 'REQ-03',
      linkedRequirementTitle: '2.3. Requirement Item Parsing & Stale RTM Alerts',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-7',
          authorName: 'Pham Minh Luong',
          action: 'Created Issue',
          details: 'Created payment transactions table task',
          timestamp: '2026-10-23T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-106',
      projectId: 20,
      key: 'CORE-106',
      type: 'TASK',
      summary: 'Draft 3-Step Mobile eKYC Use Case Specs and Wireframes',
      description:
        'Finalize URD specification and Figma wireframe components for 3-step digital identity verification on mobile devices.',
      phaseId: 1,
      phaseName: 'Phase 1: Requirement & Analysis',
      statusId: 104,
      statusName: 'Done',
      statusCategory: 'DONE',
      priority: 'MEDIUM',
      storyPoints: 3,
      originalEstimate: '4d',
      dueDate: '2026-10-20',

      // 4-Role Ownership
      assigneeName: 'Pham Minh Luong',
      assigneeRole: 'Business Analyst',
      assigneeAvatar: 'ML',
      ownerName: 'Pham Van Khoa (PM)',
      ownerRole: 'Project Manager',
      reporterName: 'Pham Van Khoa (PM)',
      reporterRole: 'Project Manager',
      watchers: [{ name: 'Sarah Lin', role: 'Senior Developer' }],

      // Organization & Security Classification
      departmentLabel: 'BA & Product',
      component: 'Traceability & RTM',
      dataClassification: 'CONFIDENTIAL_PII',
      environment: 'STAGING',
      labels: ['BA', 'Design', 'eKYC', 'Wireframe'],

      createdAt: '2026-10-14T08:00:00.000Z',
      updatedAt: '2026-10-20T16:00:00.000Z',
      linkedDocumentId: 103,
      linkedRequirementItemId: 'item-103-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '1. 3-Step Mobile eKYC Verification Journey',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-8',
          authorName: 'Pham Minh Luong',
          action: 'Completed Work',
          details: 'Reviewed and accepted by PM',
          timestamp: '2026-10-20T16:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-107',
      projectId: 20,
      key: 'CORE-107',
      type: 'TASK',
      summary: 'Publish OpenAPI 3.0 Swagger Documentation for Core APIs',
      description:
        'Consolidate core service endpoints and publish OpenAPI 3.0 interactive Swagger documentation for external integration partners.',
      phaseId: 4,
      phaseName: 'Phase 4: UAT & Deployment',
      statusId: 404,
      statusName: 'Done',
      statusCategory: 'DONE',
      priority: 'LOW',
      storyPoints: 2,
      originalEstimate: '1d',
      dueDate: '2026-10-24',

      // 4-Role Ownership
      assigneeName: 'Vu Kim Ky',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'KK',
      ownerName: 'Sarah Lin',
      ownerRole: 'Senior Developer',
      reporterName: 'Pham Van Khoa (PM)',
      reporterRole: 'Project Manager',
      watchers: [{ name: 'Pham Van Khoa (PM)', role: 'Project Manager' }],

      // Organization & Security Classification
      departmentLabel: 'DevOps & SecOps',
      component: 'AI Generation Engine',
      dataClassification: 'PUBLIC',
      environment: 'UAT',
      labels: ['DevOps', 'Swagger', 'Docs'],

      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-24T12:00:00.000Z',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-9',
          authorName: 'Vu Kim Ky',
          action: 'Completed Work',
          details: 'Published Swagger documentation at /api-docs',
          timestamp: '2026-10-24T12:00:00.000Z',
        },
      ],
    },
  ]

  return { issues }
}

function loadStorage(): StoredIssueData {
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      for (const oldKey of PREV_KEYS) {
        raw = localStorage.getItem(oldKey)
        if (raw) break
      }
    }
    if (!raw) {
      const seeded = createInitialSeed()
      saveStorage(seeded)
      return seeded
    }
    const parsed = JSON.parse(raw) as StoredIssueData
    if (!parsed || !Array.isArray(parsed.issues)) {
      const seeded = createInitialSeed()
      saveStorage(seeded)
      return seeded
    }

    // Check if issues contain legacy Vietnamese text; if so, replace with clean English seed
    const hasLegacyVietnamese = parsed.issues.some((i) => i.summary.includes('Cấu hình') || i.summary.includes('Lỗi'))
    if (hasLegacyVietnamese) {
      const seeded = createInitialSeed()
      saveStorage(seeded)
      return seeded
    }

    // Ensure all modern fields exist
    let modified = false
    parsed.issues = parsed.issues.map((iss) => {
      let changed = false
      const copy: ProjectIssue = { ...iss }

      if (!copy.ownerName) {
        copy.ownerName = copy.assigneeName || 'Sarah Lin'
        copy.ownerRole = copy.assigneeRole || 'Senior Developer'
        changed = true
      }
      if (!copy.ownerRole) {
        copy.ownerRole = 'Senior Developer'
        changed = true
      }
      if (!copy.reporterRole) {
        copy.reporterRole = 'QA Lead'
        changed = true
      }
      if (!copy.watchers || !Array.isArray(copy.watchers) || copy.watchers.length === 0) {
        copy.watchers = [
          { name: 'Pham Van Khoa (PM)', role: 'Project Manager' },
          { name: 'Sarah Lin', role: 'Senior Developer' },
        ]
        changed = true
      }
      if (!copy.departmentLabel) {
        copy.departmentLabel = 'Backend Team'
        changed = true
      }
      if (!copy.component) {
        copy.component = 'Authentication & SSO'
        changed = true
      }
      if (!copy.dataClassification) {
        copy.dataClassification = 'INTERNAL'
        changed = true
      }
      if (!copy.environment) {
        copy.environment = 'DEV'
        changed = true
      }
      if (!copy.labels || !Array.isArray(copy.labels)) {
        copy.labels = [copy.type === 'BUG' ? 'Bug' : 'Task']
        changed = true
      }
      if (!copy.originalEstimate) {
        copy.originalEstimate = '2d'
        changed = true
      }
      if (!copy.dueDate) {
        copy.dueDate = '2026-11-05'
        changed = true
      }

      if (changed) modified = true
      return copy
    })

    if (modified) {
      saveStorage(parsed)
    }
    return parsed
  } catch {
    const seeded = createInitialSeed()
    saveStorage(seeded)
    return seeded
  }
}

function saveStorage(data: StoredIssueData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Failed to persist issues to localStorage', err)
  }
}

/** Automatically seeds sample issues if a project has no issues yet */
function ensureProjectSeeded(projectId: number, projectKey = 'PRJ'): StoredIssueData {
  const data = loadStorage()
  const exists = data.issues.some((i) => i.projectId === projectId)
  if (exists) return data

  const initial = createInitialSeed()
  const newIssues = initial.issues.map((iss, idx) => ({
    ...iss,
    id: `iss-${projectId}-${101 + idx}`,
    projectId,
    key: `${projectKey}-${101 + idx}`,
  }))

  data.issues.push(...newIssues)
  saveStorage(data)
  return data
}

export const issueApi = {
  /** Fetch issues for a project */
  getIssues: async (projectId?: number, projectKey?: string): Promise<ProjectIssue[]> => {
    let data = loadStorage()
    if (projectId) {
      data = ensureProjectSeeded(projectId, projectKey || 'CORE')
      return data.issues
        .filter((i) => i.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    return data.issues.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  /** Get issue detail by ID */
  getIssueById: async (id: string): Promise<ProjectIssue | null> => {
    const data = loadStorage()
    return data.issues.find((i) => i.id === id) || null
  },

  /** Create new Task or Bug */
  createIssue: async (params: {
    projectId: number
    projectKey?: string
    type: IssueType
    summary: string
    description: string
    phaseId: number
    phaseName: string
    statusId: number
    statusName: string
    statusCategory: StatusCategory
    priority: IssuePriority
    storyPoints?: number
    originalEstimate?: string
    dueDate?: string
    assigneeName: string
    assigneeRole: string
    ownerName?: string
    ownerRole?: string
    reporterName: string
    reporterRole?: string
    watchers?: IssueWatcher[]
    departmentLabel?: DepartmentLabel
    component?: string
    dataClassification?: DataClassification
    environment?: EnvironmentType
    labels?: string[]
    severity?: BugSeverity
    stepsToReproduce?: string
    linkedTestCaseCode?: string
    linkedDocumentId?: number
    linkedRequirementItemId?: string
    linkedRequirementKeyCode?: string
    linkedRequirementTitle?: string
  }): Promise<ProjectIssue> => {
    const data = loadStorage()
    const now = new Date().toISOString()
    const projectKey = params.projectKey || 'CORE'

    // Compute incrementing key (e.g., CORE-108)
    const projectIssues = data.issues.filter((i) => i.projectId === params.projectId)
    const existingNums = projectIssues
      .map((i) => {
        const parts = i.key.split('-')
        const num = parseInt(parts[parts.length - 1], 10)
        return isNaN(num) ? 0 : num
      })
      .filter((n) => n > 0)
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 101
    const key = `${projectKey}-${nextNum}`
    const id = `iss-${params.projectId}-${Date.now()}`

    // Initials for avatar
    const initials = params.assigneeName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

    const newIssue: ProjectIssue = {
      id,
      projectId: params.projectId,
      key,
      type: params.type,
      summary: params.summary.trim(),
      description: params.description.trim(),
      severity: params.type === 'BUG' ? params.severity || 'MAJOR' : undefined,
      stepsToReproduce: params.type === 'BUG' ? params.stepsToReproduce?.trim() : undefined,
      linkedTestCaseCode: params.type === 'BUG' ? params.linkedTestCaseCode?.trim() : undefined,
      phaseId: params.phaseId,
      phaseName: params.phaseName,
      statusId: params.statusId,
      statusName: params.statusName,
      statusCategory: params.statusCategory,
      priority: params.priority,
      storyPoints: params.storyPoints || (params.type === 'BUG' ? 3 : 5),
      originalEstimate: params.originalEstimate || '1d',
      dueDate: params.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],

      // 4-Role Ownership
      assigneeName: params.assigneeName,
      assigneeRole: params.assigneeRole,
      assigneeAvatar: initials,
      ownerName: params.ownerName || params.assigneeName,
      ownerRole: params.ownerRole || params.assigneeRole,
      reporterName: params.reporterName,
      reporterRole: params.reporterRole || 'QA Lead',
      watchers:
        params.watchers && params.watchers.length > 0
          ? params.watchers
          : [
              { name: params.reporterName, role: params.reporterRole || 'Reporter' },
              { name: params.assigneeName, role: params.assigneeRole },
            ],

      // Classification & Organization
      departmentLabel: params.departmentLabel || 'Backend Team',
      component: params.component || 'Authentication & SSO',
      dataClassification: params.dataClassification || 'INTERNAL',
      environment: params.environment || 'DEV',
      labels: params.labels || [params.type === 'BUG' ? 'Bug' : 'Task'],

      createdAt: now,
      updatedAt: now,
      linkedDocumentId: params.linkedDocumentId,
      linkedRequirementItemId: params.linkedRequirementItemId,
      linkedRequirementKeyCode: params.linkedRequirementKeyCode,
      linkedRequirementTitle: params.linkedRequirementTitle,
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          authorName: params.reporterName,
          action: `Created ${params.type === 'BUG' ? 'Defect' : 'Task'}`,
          details: `Created ${key}: "${params.summary}" and assigned to ${params.assigneeName}`,
          timestamp: now,
        },
      ],
    }

    data.issues.unshift(newIssue)
    saveStorage(data)
    return newIssue
  },

  /** Update issue details */
  updateIssue: async (
    id: string,
    updates: Partial<ProjectIssue>,
    actor = 'User',
    reason?: string,
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Issue #${id} not found`)

    const now = new Date().toISOString()
    Object.assign(issue, updates, { updatedAt: now })

    if (reason) {
      issue.activityLog.unshift({
        id: `act-${Date.now()}`,
        authorName: actor,
        action: 'Updated Issue',
        details: reason,
        timestamp: now,
      })
    }

    saveStorage(data)
    return issue
  },

  /** Toggle Watch/Unwatch on an Issue */
  toggleWatcher: async (
    id: string,
    watcher: IssueWatcher,
    actor = 'User',
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Issue #${id} not found`)

    const now = new Date().toISOString()
    if (!Array.isArray(issue.watchers)) issue.watchers = []
    const exists = issue.watchers.some((w) => w.name === watcher.name)

    if (exists) {
      issue.watchers = issue.watchers.filter((w) => w.name !== watcher.name)
      issue.activityLog.unshift({
        id: `act-${Date.now()}`,
        authorName: actor,
        action: 'Stopped Watching',
        details: `${watcher.name} stopped watching this issue`,
        timestamp: now,
      })
    } else {
      issue.watchers.push(watcher)
      issue.activityLog.unshift({
        id: `act-${Date.now()}`,
        authorName: actor,
        action: 'Started Watching',
        details: `${watcher.name} started watching this issue`,
        timestamp: now,
      })
    }

    issue.updatedAt = now
    saveStorage(data)
    return issue
  },

  /**
   * Delete issue with RTM protection check (GB-07)
   */
  deleteIssue: async (id: string, force = false): Promise<{ success: boolean; error?: string }> => {
    const data = loadStorage()
    const idx = data.issues.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error(`Issue #${id} not found`)

    const issue = data.issues[idx]
    const hasReqLink = !!issue.linkedRequirementKeyCode
    const hasTcLink = !!issue.linkedTestCaseCode

    if ((hasReqLink || hasTcLink) && !force) {
      return {
        success: false,
        error: `MSG04: Warning: Deleting an issue linked to traceability matrix! Issue ${issue.key} is linked to ${
          hasReqLink ? `Requirement [${issue.linkedRequirementKeyCode}]` : ''
        } ${hasTcLink ? `and Test Case [${issue.linkedTestCaseCode}]` : ''}. Deleting this issue may break the RTM matrix. Are you sure you want to permanently delete it?`,
      }
    }

    data.issues.splice(idx, 1)
    saveStorage(data)
    return { success: true }
  },

  /** Transition workflow status with transition rules check */
  transitionIssue: async (
    id: string,
    newStatusId: number,
    newStatusName: string,
    newStatusCategory: StatusCategory,
    comment?: string,
    actor = 'User',
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Issue #${id} not found`)

    const prevStatusName = issue.statusName
    const now = new Date().toISOString()

    issue.statusId = newStatusId
    issue.statusName = newStatusName
    issue.statusCategory = newStatusCategory
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Transitioned Status',
      details: `Moved from "${prevStatusName}" to "${newStatusName}"${comment ? ` (Note: ${comment})` : ''}`,
      timestamp: now,
    })

    if (comment) {
      issue.comments.unshift({
        id: `cmt-${Date.now()}`,
        authorName: actor,
        authorRole: 'Team Member',
        body: `[Transitioned to ${newStatusName}]: ${comment}`,
        createdAt: now,
      })
    }

    saveStorage(data)
    return issue
  },

  /** Re-assign issue with handover note */
  reassignIssue: async (
    id: string,
    newAssigneeName: string,
    newAssigneeRole: string,
    handoverNote?: string,
    actor = 'User',
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Issue #${id} not found`)

    const prevAssignee = issue.assigneeName
    const now = new Date().toISOString()
    const initials = newAssigneeName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

    issue.assigneeName = newAssigneeName
    issue.assigneeRole = newAssigneeRole
    issue.assigneeAvatar = initials
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Reassigned Issue',
      details: `Reassigned from ${prevAssignee} to @${newAssigneeName}${handoverNote ? ` · Note: "${handoverNote}"` : ''}`,
      timestamp: now,
    })

    if (handoverNote) {
      issue.comments.unshift({
        id: `cmt-${Date.now()}`,
        authorName: actor,
        authorRole: 'Team Member',
        body: `@${newAssigneeName} Handover Note: ${handoverNote}`,
        mentions: [newAssigneeName],
        createdAt: now,
      })
    }

    saveStorage(data)
    return issue
  },

  /** Link Confluence Requirement */
  linkRequirement: async (
    id: string,
    req: { docId: number; reqId: string; reqKey: string; reqTitle: string },
    actor = 'User',
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Issue #${id} not found`)

    const now = new Date().toISOString()
    issue.linkedDocumentId = req.docId
    issue.linkedRequirementItemId = req.reqId
    issue.linkedRequirementKeyCode = req.reqKey
    issue.linkedRequirementTitle = req.reqTitle
    issue.traceabilityStatus = 'FRESH'
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Linked Confluence Requirement',
      details: `Linked with [${req.reqKey}] - ${req.reqTitle}`,
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /** Unlink Requirement */
  unlinkRequirement: async (id: string, actor = 'User'): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Issue #${id} not found`)

    const prevKey = issue.linkedRequirementKeyCode
    const now = new Date().toISOString()

    issue.linkedDocumentId = undefined
    issue.linkedRequirementItemId = undefined
    issue.linkedRequirementKeyCode = undefined
    issue.linkedRequirementTitle = undefined
    issue.traceabilityStatus = 'FRESH'
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Unlinked Requirement',
      details: `Removed link with [${prevKey}]`,
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /** Reset Stale status back to FRESH */
  resetStaleStatus: async (id: string, actor = 'User'): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Issue #${id} not found`)

    const now = new Date().toISOString()
    issue.traceabilityStatus = 'FRESH'
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Synchronized Traceability Status',
      details: `Confirmed update according to spec [${issue.linkedRequirementKeyCode || 'REQ'}] → Status reset to Fresh.`,
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /** Bidirectional sync: mark issues Stale when Confluence requirement is edited */
  markRequirementStale: async (
    docId: number,
    reqKeyCode: string,
    status: 'UNCONFIRMED_STALE' | 'CONFIRMED_STALE',
  ): Promise<void> => {
    const data = loadStorage()
    const now = new Date().toISOString()
    let changed = false

    for (const iss of data.issues) {
      if (
        (iss.linkedDocumentId === docId || !iss.linkedDocumentId) &&
        iss.linkedRequirementKeyCode === reqKeyCode
      ) {
        iss.traceabilityStatus = status
        iss.updatedAt = now
        iss.activityLog.unshift({
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          authorName: 'SSAM Confluence Sync',
          action:
            status === 'UNCONFIRMED_STALE'
              ? 'Draft Revision Alert (Unconfirmed Stale)'
              : 'Approved Revision Alert (Confirmed Stale)',
          details: `Requirement [${reqKeyCode}] content was modified. Please review and update associated implementation and test cases.`,
          timestamp: now,
        })
        changed = true
      }
    }

    if (changed) {
      saveStorage(data)
    }
  },

  /** Add comment with @mention support */
  addComment: async (
    issueId: string,
    comment: { authorName: string; authorRole: string; body: string; mentions?: string[] },
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === issueId)
    if (!issue) throw new Error(`Issue #${issueId} not found`)

    const now = new Date().toISOString()
    const newComment: IssueComment = {
      id: `cmt-${Date.now()}`,
      authorName: comment.authorName,
      authorRole: comment.authorRole,
      body: comment.body.trim(),
      mentions: comment.mentions || [],
      createdAt: now,
    }

    issue.comments.unshift(newComment)
    issue.updatedAt = now
    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: comment.authorName,
      action: 'Added Comment',
      details: comment.mentions?.length
        ? `Mentioned @${comment.mentions.join(', @')}`
        : 'Posted a comment',
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /** Get issue statistics for Project Header & KPI cards */
  getProjectIssueStats: async (
    projectId: number,
  ): Promise<ProjectIssueStats> => {
    const data = loadStorage()
    const projectIssues = data.issues.filter((i) => i.projectId === projectId)
    const open = projectIssues.filter((i) => i.statusCategory !== 'DONE').length
    const done = projectIssues.filter((i) => i.statusCategory === 'DONE').length
    const tasks = projectIssues.filter((i) => i.type === 'TASK').length
    const bugs = projectIssues.filter((i) => i.type === 'BUG').length
    const staleCount = projectIssues.filter((i) => i.traceabilityStatus !== 'FRESH').length

    return {
      total: projectIssues.length,
      open,
      done,
      tasks,
      bugs,
      staleCount,
    }
  },

  /** Get current user issues */
  getMyIssues: async (userFullName = 'Sarah Lin'): Promise<ProjectIssue[]> => {
    const data = loadStorage()
    return data.issues
      .filter((i) => i.assigneeName.toLowerCase().includes(userFullName.toLowerCase()) || i.assigneeName.includes('Sarah'))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
}
