import clsx from 'clsx'
import type { DraftPhase } from '@/lib/workflowDraft'

interface WorkflowBpmnViewerProps {
  phase: DraftPhase
  className?: string
}

export function WorkflowBpmnViewer({ phase, className }: WorkflowBpmnViewerProps) {
  const activeStatuses = phase.statuses.filter((s) => s.isActive)
  const count = activeStatuses.length

  if (count === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
        Chưa có trạng thái nào để vẽ sơ đồ quy trình.
      </div>
    )
  }

  // Cấu hình viewBox responsive
  const startCircleR = 16
  const endCircleR = 16
  const nodeWidth = 125
  const nodeHeight = 52
  const paddingX = 40
  const centerY = 85
  const gap = 55
  const totalSvgWidth = paddingX * 2 + startCircleR * 2 + 50 + count * nodeWidth + (count - 1) * gap + 50 + endCircleR * 2
  const totalSvgHeight = 175

  // Tọa độ Start
  const startX = paddingX + startCircleR

  // Tọa độ từng status
  const statusPositions: Record<string, { x: number; y: number; width: number; height: number }> = {}
  activeStatuses.forEach((s, idx) => {
    const x = startX + 45 + idx * (nodeWidth + gap)
    statusPositions[s.key] = {
      x,
      y: centerY - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    }
  })

  // Tọa độ End
  const lastStatus = activeStatuses[count - 1]
  const endX = (statusPositions[lastStatus?.key]?.x ?? 400) + nodeWidth + 45 + endCircleR

  const transitions = phase.transitions.filter((t) => statusPositions[t.from] && statusPositions[t.to])

  return (
    <div className={clsx('w-full rounded-md border border-gray-200 bg-white p-4 shadow-2xs', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-800">
            Sơ đồ quy trình BPMN trực quan (State Flow)
          </h4>
          <p className="text-[11px] text-gray-400">
            Toàn bộ chu trình tiến triển của issue tự động khớp vừa vặn trong khung hình.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-500 bg-emerald-50" /> Bắt đầu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-3 rounded-xs border border-gray-400 bg-white" /> Trạng thái (Task)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-3 border-gray-900 bg-white" /> Kết thúc
          </span>
        </div>
      </div>

      <div className="w-full">
        <svg
          viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
          className="h-auto w-full max-h-[220px] select-none"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <marker
              id="bpmn-arrow-forward"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-angle"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
            </marker>
            <marker
              id="bpmn-arrow-back"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-angle"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
            <marker
              id="bpmn-arrow-gray"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-angle"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
          </defs>

          {/* 1. Start Event */}
          <circle
            cx={startX}
            cy={centerY}
            r={startCircleR}
            fill="#ecfdf5"
            stroke="#059669"
            strokeWidth="2"
          />
          <text
            x={startX}
            y={centerY + 26}
            textAnchor="middle"
            fontSize="9"
            className="fill-emerald-800 font-mono font-medium"
          >
            Start
          </text>

          {/* Nối Start -> Initial status */}
          {(() => {
            const initial = activeStatuses.find((s) => s.isInitial) ?? activeStatuses[0]
            if (!initial) return null
            const pos = statusPositions[initial.key]
            if (!pos) return null
            return (
              <line
                x1={startX + startCircleR}
                y1={centerY}
                x2={pos.x}
                y2={centerY}
                stroke="#059669"
                strokeWidth="1.8"
                markerEnd="url(#bpmn-arrow-forward)"
              />
            )
          })()}

          {/* 2. Transitions */}
          {transitions.map((t, idx) => {
            const fromPos = statusPositions[t.from]
            const toPos = statusPositions[t.to]
            if (!fromPos || !toPos) return null

            const fromIdx = activeStatuses.findIndex((s) => s.key === t.from)
            const toIdx = activeStatuses.findIndex((s) => s.key === t.to)
            const isForward = toIdx > fromIdx
            const isAdjacent = Math.abs(toIdx - fromIdx) === 1

            if (isForward && isAdjacent) {
              const x1 = fromPos.x + fromPos.width
              const y1 = centerY
              const x2 = toPos.x
              const y2 = centerY
              return (
                <line
                  key={`trans-${idx}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#059669"
                  strokeWidth="1.8"
                  markerEnd="url(#bpmn-arrow-forward)"
                />
              )
            }

            if (isForward && !isAdjacent) {
              const x1 = fromPos.x + fromPos.width / 2
              const y1 = fromPos.y
              const x2 = toPos.x + toPos.width / 2
              const y2 = toPos.y
              const curveOffset = 25 + (toIdx - fromIdx) * 8
              return (
                <path
                  key={`trans-${idx}`}
                  d={`M ${x1} ${y1} C ${x1} ${y1 - curveOffset}, ${x2} ${y2 - curveOffset}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  markerEnd="url(#bpmn-arrow-forward)"
                />
              )
            }

            // Trả ngược
            const x1 = fromPos.x + fromPos.width / 2
            const y1 = fromPos.y + fromPos.height
            const x2 = toPos.x + toPos.width / 2
            const y2 = toPos.y + toPos.height
            const curveOffset = 25 + (fromIdx - toIdx) * 10

            return (
              <path
                key={`trans-${idx}`}
                d={`M ${x1} ${y1} C ${x1} ${y1 + curveOffset}, ${x2} ${y2 + curveOffset}, ${x2} ${y2}`}
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.6"
                markerEnd="url(#bpmn-arrow-back)"
              />
            )
          })}

          {/* 3. Node Trạng thái */}
          {activeStatuses.map((s, idx) => {
            const pos = statusPositions[s.key]
            if (!pos) return null

            const isInit = s.isInitial
            return (
              <g key={s.key}>
                <rect
                  x={pos.x + 1.5}
                  y={pos.y + 1.5}
                  width={pos.width}
                  height={pos.height}
                  rx={6}
                  fill="#000000"
                  opacity="0.04"
                />
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.width}
                  height={pos.height}
                  rx={6}
                  fill="#ffffff"
                  stroke={isInit ? '#059669' : '#cbd5e1'}
                  strokeWidth={isInit ? '2' : '1.2'}
                />
                <rect
                  x={pos.x + 8}
                  y={pos.y + 8}
                  width={7}
                  height={7}
                  rx={1.5}
                  fill={s.color || '#94a3b8'}
                />
                <text
                  x={pos.x + 20}
                  y={pos.y + 16}
                  fontSize="11"
                  fontWeight="600"
                  fill="#1e293b"
                  className="select-none font-sans"
                >
                  {s.name.length > 13 ? s.name.slice(0, 12) + '…' : s.name || `Status ${idx + 1}`}
                </text>
                <text
                  x={pos.x + 8}
                  y={pos.y + 35}
                  fontSize="8.5"
                  fill="#64748b"
                  className="select-none font-mono"
                >
                  {s.category} {isInit ? '· [Initial]' : ''}
                </text>
              </g>
            )
          })}

          {/* 4. End Event */}
          {(() => {
            if (!lastStatus) return null
            const lastPos = statusPositions[lastStatus.key]
            if (!lastPos) return null

            return (
              <g>
                <line
                  x1={lastPos.x + lastPos.width}
                  y1={centerY}
                  x2={endX - endCircleR}
                  y2={centerY}
                  stroke="#64748b"
                  strokeWidth="1.8"
                  markerEnd="url(#bpmn-arrow-gray)"
                />
                <circle
                  cx={endX}
                  cy={centerY}
                  r={endCircleR}
                  fill="#ffffff"
                  stroke="#1e293b"
                  strokeWidth="3"
                />
                <circle
                  cx={endX}
                  cy={centerY}
                  r={endCircleR - 4}
                  fill="#f1f5f9"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <text
                  x={endX}
                  y={centerY + 26}
                  textAnchor="middle"
                  fontSize="9"
                  className="fill-gray-700 font-mono font-medium"
                >
                  End
                </text>
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}
