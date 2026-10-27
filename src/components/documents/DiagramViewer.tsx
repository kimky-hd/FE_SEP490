import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { SparklesIcon, CheckIcon, FrameIcon } from '@/components/ui/icons'
import type { DiagramType } from '@/types/document'

interface DiagramViewerProps {
  title?: string
  sourceCode?: string
  code?: string
  diagramType?: DiagramType
  readOnly?: boolean
  onChangeType?: (type: DiagramType) => void
  onChangeSource?: (code: string) => void
  onChange?: (code: string) => void
  itemContentForAi?: string
}

interface ParsedNode {
  id: string
  label: string
  isDecision: boolean
}

interface ParsedEdge {
  from: string
  to: string
  label?: string
}

function parseMermaidFlowchart(code: string): { nodes: ParsedNode[]; edges: ParsedEdge[] } {
  const nodesMap = new Map<string, ParsedNode>()
  const edges: ParsedEdge[] = []

  const lines = code.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('flowchart') || line.startsWith('graph') || line.startsWith('%%')) {
      continue
    }

    // Match edge patterns: A[Label] -->|Text| B[Label] or A --> B or A{Cond} -->|Yes| B[Step]
    const arrowMatch = line.match(/^([A-Za-z0-9_-]+)(?:\[(.*?)\]|\{(.*?)\})?\s*-->\s*(?:\|(.*?)\|\s*)?([A-Za-z0-9_-]+)(?:\[(.*?)\]|\{(.*?)\})?$/)
    if (arrowMatch) {
      const fromId = arrowMatch[1]
      const fromRectLabel = arrowMatch[2]
      const fromDiamondLabel = arrowMatch[3]
      const edgeLabel = arrowMatch[4]
      const toId = arrowMatch[5]
      const toRectLabel = arrowMatch[6]
      const toDiamondLabel = arrowMatch[7]

      if (!nodesMap.has(fromId)) {
        nodesMap.set(fromId, {
          id: fromId,
          label: fromDiamondLabel ?? fromRectLabel ?? fromId,
          isDecision: fromDiamondLabel !== undefined,
        })
      }
      if (!nodesMap.has(toId)) {
        nodesMap.set(toId, {
          id: toId,
          label: toDiamondLabel ?? toRectLabel ?? toId,
          isDecision: toDiamondLabel !== undefined,
        })
      }
      edges.push({
        from: fromId,
        to: toId,
        label: edgeLabel ? edgeLabel.trim() : undefined,
      })
    }
  }

  const nodes = Array.from(nodesMap.values())
  return { nodes, edges }
}

const SAMPLE_TEMPLATES = [
  {
    name: 'Xác thực & Rẽ nhánh (Conditional Decision)',
    code: 'flowchart TD\n  A[Khách hàng] --> B[Nhập thông tin]\n  B --> C{Kiểm tra dữ liệu}\n  C -->|Hợp lệ| D[Cấp quyền truy cập]\n  C -->|Không hợp lệ| E[Thông báo lỗi & Tăng đếm]',
  },
  {
    name: 'Tuần tự 3 bước (Standard Pipeline)',
    code: 'flowchart TD\n  A[Bắt đầu yêu cầu] --> B[Xử lý nghiệp vụ lõi]\n  B --> C[Ghi nhận Audit Log]\n  C --> D[Hoàn tất & Trả về kết quả]',
  },
  {
    name: 'Khóa tài khoản & Gửi cảnh báo (Security Rate-limit)',
    code: 'flowchart TD\n  A[Đăng nhập thất bại] --> B{Số lần sai >= 5?}\n  B -->|Chưa đủ| C[Cảnh báo số lần còn lại]\n  B -->|Đã đủ| D[Khóa tạm thời 15 phút]\n  D --> E[Gửi Email cảnh báo bảo mật]',
  },
  {
    name: 'Đồng bộ Webhook & Cập nhật RTM (Figma / CI)',
    code: 'flowchart TD\n  A[Figma Version Update] --> B[Webhook gửi tới SSAM]\n  B --> C[Phân tích Frame ID khớp REQ]\n  C --> D[Gắn cờ Stale lên Test Case]\n  D --> E[Gửi thông báo tới Reviewer]',
  },
]

export function DiagramViewer({
  title = 'Sơ đồ luồng quy trình (Flowchart)',
  sourceCode,
  code,
  diagramType = 'MERMAID_PLANTUML',
  readOnly = false,
  onChangeType,
  onChangeSource,
  onChange,
  itemContentForAi = '',
}: DiagramViewerProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'templates'>('preview')
  const [copied, setCopied] = useState(false)

  const effectiveCode = sourceCode ?? code ?? ''
  const handleSourceChange = onChangeSource ?? onChange

  const parsed = useMemo(() => {
    if (!effectiveCode.trim()) return { nodes: [], edges: [] }
    return parseMermaidFlowchart(effectiveCode)
  }, [effectiveCode])

  const handleGenerateAiDiagram = () => {
    if (!handleSourceChange) return
    const topic = itemContentForAi ? itemContentForAi.slice(0, 30) : title.slice(0, 30)
    const sample = `flowchart TD\n  A[Bắt đầu: ${topic}] --> B[Tiếp nhận thông tin]\n  B --> C{Kiểm tra tính hợp lệ}\n  C -->|Đạt yêu cầu| D[Thực thi luồng nghiệp vụ]\n  C -->|Không đạt| E[Ghi nhận lỗi & Thông báo]\n  D --> F[Lưu vết Audit & Hoàn tất]`
    handleSourceChange(sample)
    setActiveTab('preview')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(effectiveCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (diagramType === 'NONE') {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <FrameIcon className="h-5 w-5" />
        </div>
        <p className="mt-2 text-sm font-medium text-slate-700">Mục này chưa được gắn sơ đồ minh họa</p>
        <p className="mt-1 text-xs text-slate-500">
          Gắn sơ đồ Mermaid hoặc PlantUML để trực quan hóa luồng dữ liệu và tiêu chí nghiệm thu cho lập trình viên & QA.
        </p>
        {!readOnly && onChangeType && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                onChangeType('MERMAID_PLANTUML')
                if (!sourceCode && onChangeSource) {
                  onChangeSource(
                    'flowchart TD\n  A[Bắt đầu] --> B[Xử lý yêu cầu]\n  B --> C{Kiểm tra}\n  C -->|Đúng| D[Hoàn tất]\n  C -->|Sai| E[Báo lỗi]',
                  )
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <SparklesIcon className="h-4 w-4" />
              Thêm sơ đồ Mermaid / PlantUML
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            <FrameIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-slate-800">{title}</span>
          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
            Mermaid Flowchart
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={clsx(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                activeTab === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Sơ đồ trực quan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={clsx(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                activeTab === 'code' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Mã nguồn
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={clsx(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  activeTab === 'templates' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Mẫu có sẵn
              </button>
            )}
          </div>

          {!readOnly && onChangeType && (
            <button
              type="button"
              onClick={() => onChangeType('NONE')}
              className="text-xs text-slate-400 hover:text-red-600 ml-1 px-1"
              title="Gỡ bỏ sơ đồ"
            >
              Gỡ
            </button>
          )}
        </div>
      </div>

      {/* Tab: Rendered Preview */}
      {activeTab === 'preview' && (
        <div className="p-4 bg-slate-900/5 min-h-[220px] flex flex-col items-center justify-center">
          {parsed.nodes.length > 0 ? (
            <div className="w-full max-w-xl overflow-x-auto py-4">
              <svg
                viewBox={`0 0 ${Math.max(480, parsed.nodes.length * 130)} ${Math.max(260, parsed.edges.length * 60 + 80)}`}
                className="mx-auto w-full max-h-[360px]"
              >
                <defs>
                  <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ecfdf5" />
                    <stop offset="100%" stopColor="#d1fae5" />
                  </linearGradient>
                  <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
                  </marker>
                </defs>

                {/* Draw Nodes & Edges layout */}
                {parsed.nodes.map((node, i) => {
                  const x = 80 + (i % 3) * 160
                  const y = 40 + Math.floor(i / 3) * 110

                  return (
                    <g key={node.id} className="transition-transform hover:scale-105 cursor-default">
                      {node.isDecision ? (
                        // Diamond polygon
                        <polygon
                          points={`${x + 65},${y} ${x + 130},${y + 35} ${x + 65},${y + 70} ${x},${y + 35}`}
                          fill="#fef3c7"
                          stroke="#d97706"
                          strokeWidth="2"
                        />
                      ) : (
                        // Rounded rectangle
                        <rect
                          x={x}
                          y={y}
                          width="130"
                          height="50"
                          rx="10"
                          fill="url(#emeraldGrad)"
                          stroke="#059669"
                          strokeWidth="1.5"
                        />
                      )}
                      <text
                        x={x + 65}
                        y={y + (node.isDecision ? 38 : 28)}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="system-ui"
                      >
                        {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                      </text>
                    </g>
                  )
                })}

                {/* Draw Connected Paths */}
                {parsed.edges.map((edge, i) => {
                  const fromIndex = parsed.nodes.findIndex((n) => n.id === edge.from)
                  const toIndex = parsed.nodes.findIndex((n) => n.id === edge.to)
                  if (fromIndex < 0 || toIndex < 0) return null

                  const x1 = 80 + (fromIndex % 3) * 160 + 65
                  const y1 = 40 + Math.floor(fromIndex / 3) * 110 + 50
                  const x2 = 80 + (toIndex % 3) * 160 + 65
                  const y2 = 40 + Math.floor(toIndex / 3) * 110

                  return (
                    <g key={`${edge.from}-${edge.to}-${i}`}>
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="1.5"
                        strokeDasharray={edge.label ? '4 2' : 'none'}
                        markerEnd="url(#arrow)"
                      />
                      {edge.label && (
                        <rect
                          x={(x1 + x2) / 2 - 25}
                          y={(y1 + y2) / 2 - 9}
                          width="50"
                          height="16"
                          rx="4"
                          fill="#ffffff"
                          stroke="#cbd5e1"
                          strokeWidth="0.8"
                        />
                      )}
                      {edge.label && (
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 + 3}
                          textAnchor="middle"
                          fill="#475569"
                          fontSize="9"
                          fontWeight="500"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-slate-500">Chưa có mã Mermaid hợp lệ để hiển thị sơ đồ.</p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleGenerateAiDiagram}
                  className="mt-2 inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Sinh mã Mermaid tự động
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Code Editor */}
      {activeTab === 'code' && (
        <div className="p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-mono text-slate-500">Mã Mermaid Flowchart (TD = Top-Down):</span>
            <div className="flex items-center gap-2">
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleGenerateAiDiagram}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  AI viết mã sơ đồ
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-semibold">Đã chép</span>
                  </>
                ) : (
                  'Sao chép mã'
                )}
              </button>
            </div>
          </div>
          <textarea
            value={effectiveCode}
            readOnly={readOnly}
            onChange={(e) => handleSourceChange && handleSourceChange(e.target.value)}
            rows={6}
            placeholder="flowchart TD&#10;  A[Bắt đầu] --> B[Xử lý]&#10;  B --> C[Kết thúc]"
            className={clsx(
              'w-full font-mono text-xs leading-relaxed rounded-lg border border-slate-300 p-3 bg-slate-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500',
              readOnly && 'opacity-80 cursor-not-allowed',
            )}
          />
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === 'templates' && (
        <div className="p-4 space-y-2">
          <p className="text-xs text-slate-500 mb-2">Chọn một mẫu luồng quy trình chuẩn để nạp nhanh vào mục này:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SAMPLE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                type="button"
                onClick={() => {
                  if (onChangeSource) onChangeSource(tmpl.code)
                  setActiveTab('preview')
                }}
                className="text-left rounded-lg border border-slate-200 p-2.5 hover:border-emerald-500 hover:bg-emerald-50/40 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-800">{tmpl.name}</p>
                <pre className="mt-1 text-[10px] font-mono text-slate-500 truncate">{tmpl.code.split('\n')[1]}</pre>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
