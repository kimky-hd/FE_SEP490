import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, PageHeader } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { documentApi } from '@/api/documentApi'
import { projectApi } from '@/api/projectApi'
import { useAuth } from '@/context/AuthContext'
import type { ProjectDto } from '@/types/project'
import type { DocumentStatus, DocumentType, SpecificationDocument } from '@/types/document'

export function GlobalDocumentsPage() {
  const navigate = useNavigate()
  const { currentCompany } = useAuth()
  const [documents, setDocuments] = useState<SpecificationDocument[]>([])
  const [projects, setProjects] = useState<ProjectDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'ALL'>('ALL')
  const [selectedType, setSelectedType] = useState<DocumentType | 'ALL'>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [docs, projs] = await Promise.all([
          documentApi.getAllDocuments(),
          projectApi.listMine(currentCompany?.companyId ?? null).catch(() => []),
        ])
        setDocuments(docs)
        setProjects(projs)
      } catch (err) {
        console.error('Lỗi tải danh sách tài liệu toàn cục:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [currentCompany])

  const filteredDocs = documents.filter((doc) => {
    if (selectedProjectId !== 'ALL' && doc.projectId !== selectedProjectId) return false
    if (selectedType !== 'ALL' && doc.docType !== selectedType) return false
    if (selectedStatus !== 'ALL' && doc.status !== selectedStatus) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchCode = doc.code.toLowerCase().includes(q)
      const matchTitle = doc.title.toLowerCase().includes(q)
      const matchDesc = doc.description?.toLowerCase().includes(q)
      if (!matchCode && !matchTitle && !matchDesc) return false
    }
    return true
  })

  const totalApproved = documents.filter((d) => d.status === 'APPROVED').length
  const totalInReview = documents.filter((d) => d.status === 'IN_REVIEW').length
  const totalDraft = documents.filter((d) => d.status === 'DRAFT').length

  const projectMap = new Map(projects.map((p) => [p.projectId, p]))

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="// REQUIREMENTS DOCUMENT CENTER"
        title="Requirements & System Specifications"
        description="Quickly search and explore all specification documents (SRS, URD, BRD), baseline approval statuses, and requirement item decomposition matrices across projects."
        meta={
          <Badge tone="brand" dot>
            {documents.length} Documents
          </Badge>
        }
      />

      {/* KPI Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border-l-4 border-l-emerald-600">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Total Documents</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{documents.length}</p>
          <p className="text-[11px] text-slate-500">Across all workspace projects</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Baseline Approved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{totalApproved}</p>
          <p className="text-[11px] text-emerald-600">Safe Mode Locked (GB-01)</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">In Review</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{totalInReview}</p>
          <p className="text-[11px] text-blue-600">Pending sign-off</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Drafts in Progress</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{totalDraft}</p>
          <p className="text-[11px] text-amber-600">Authoring or AI-assisted</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Project Filter */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  [{p.key}] {p.name}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType | 'ALL')}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Types (SRS/URD/BRD)</option>
              <option value="SRS">SRS - Software Requirements</option>
              <option value="URD">URD - User Requirements</option>
              <option value="BRD">BRD - Business Requirements</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as DocumentStatus | 'ALL')}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative min-w-[14rem]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents, SRS-01..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
            <svg
              className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </Card>

      {/* Documents Grid */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <Card className="p-8 text-center">
            <span className="text-3xl">📂</span>
            <p className="mt-2 text-sm font-semibold text-slate-700">No matching documents found</p>
            <p className="text-xs text-slate-400">Try clearing your filters or selecting a different project.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => {
              const project = projectMap.get(doc.projectId)
              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/projects/${doc.projectId}/documents/${doc.id}`)}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md cursor-pointer"
                >
                  <div>
                    {/* Project and Doc Code */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                          {project?.key || 'PRJ'}
                        </span>
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700">
                          {doc.code}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-500">[{doc.version}]</span>
                      </div>

                      <Badge
                        tone={
                          doc.status === 'APPROVED' ? 'brand' : doc.status === 'IN_REVIEW' ? 'blue' : 'amber'
                        }
                        dot={doc.status === 'APPROVED'}
                      >
                        {doc.status === 'APPROVED'
                          ? 'Approved'
                          : doc.status === 'IN_REVIEW'
                            ? 'In Review'
                            : 'Draft'}
                      </Badge>
                    </div>

                    <h3 className="mt-2.5 text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {doc.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {doc.description || 'No detailed description provided.'}
                    </p>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Project: {project?.name || `ID #${doc.projectId}`}</span>
                    <span className="font-medium text-emerald-600 group-hover:underline">Open document →</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
