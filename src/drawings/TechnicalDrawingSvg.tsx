import type { CSSProperties, ReactNode } from 'react'
import {
  createTechnicalDrawingPresentation,
  type DrawingArc,
  type DrawingDimension,
  type TechnicalDrawingDocument,
  type TechnicalDrawingPrimitive,
  type TechnicalDrawingPresentation,
} from './technical-drawing'

const roleClass = (primitive: TechnicalDrawingPrimitive) => `technical-${primitive.role}`

function arcPath(arc: DrawingArc) {
  const start = {
    x: arc.center.x + Math.cos(arc.startAngleRad) * arc.radius,
    y: arc.center.y + Math.sin(arc.startAngleRad) * arc.radius,
  }
  const end = {
    x: arc.center.x + Math.cos(arc.endAngleRad) * arc.radius,
    y: arc.center.y + Math.sin(arc.endAngleRad) * arc.radius,
  }
  const sweep = arc.endAngleRad - arc.startAngleRad
  return `M ${start.x} ${start.y} A ${arc.radius} ${arc.radius} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep >= 0 ? 1 : 0} ${end.x} ${end.y}`
}

function Dimension({ primitive, markerId }: { readonly primitive: DrawingDimension; readonly markerId: string }) {
  return <g className={roleClass(primitive)}>
    <line x1={primitive.start.x} y1={primitive.start.y} x2={primitive.dimensionStart.x} y2={primitive.dimensionStart.y} />
    <line x1={primitive.end.x} y1={primitive.end.y} x2={primitive.dimensionEnd.x} y2={primitive.dimensionEnd.y} />
    <line x1={primitive.dimensionStart.x} y1={primitive.dimensionStart.y} x2={primitive.dimensionEnd.x} y2={primitive.dimensionEnd.y}
      markerStart={`url(#${markerId})`} markerEnd={`url(#${markerId})`} />
    <text x={primitive.labelPosition.x} y={primitive.labelPosition.y} textAnchor="middle"
      style={{ '--drawing-font-size': `${primitive.textSizeMm ?? 100}px` } as CSSProperties}>{primitive.label}</text>
  </g>
}

function Primitive({ primitive, markerId, hatchId }: {
  readonly primitive: TechnicalDrawingPrimitive
  readonly markerId: string
  readonly hatchId: string
}): ReactNode {
  const className = roleClass(primitive)
  switch (primitive.kind) {
    case 'line':
    case 'centerline':
    case 'extension-line':
      return <line className={className} x1={primitive.start.x} y1={primitive.start.y} x2={primitive.end.x} y2={primitive.end.y} />
    case 'polyline':
      return <polyline className={className} points={primitive.points.map((entry) => `${entry.x},${entry.y}`).join(' ')}
        fill="none" {...(primitive.closed ? { points: [...primitive.points, primitive.points[0]].map((entry) => `${entry.x},${entry.y}`).join(' ') } : {})} />
    case 'rectangle':
    case 'component-outline':
      return <rect className={className} x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} />
    case 'hatch':
      return <rect className={className} x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height}
        style={{ fill: `url(#${hatchId})` }} />
    case 'circle':
      return <circle className={className} cx={primitive.center.x} cy={primitive.center.y} r={primitive.radius} />
    case 'arc':
      return <path className={className} d={arcPath(primitive)} fill="none" />
    case 'text':
      return <text className={className} x={primitive.position.x} y={primitive.position.y}
        textAnchor={primitive.anchor ?? 'start'} style={{ '--drawing-font-size': `${primitive.sizeMm ?? 110}px` } as CSSProperties}>{primitive.text}</text>
    case 'dimension':
      return <Dimension primitive={primitive} markerId={markerId} />
    case 'section-marker':
      return <g className={className}><line x1={primitive.start.x} y1={primitive.start.y} x2={primitive.end.x} y2={primitive.end.y} />
        <text x={primitive.end.x} y={primitive.end.y}>{primitive.label}</text></g>
  }
}

export function TechnicalDrawingSvg({ document, presentation: suppliedPresentation }: {
  readonly document: TechnicalDrawingDocument
  readonly presentation?: TechnicalDrawingPresentation
}) {
  const presentation = suppliedPresentation ?? createTechnicalDrawingPresentation(document)
  const bounds = presentation.viewBounds
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const markerId = `${document.id.replace(/[^a-z0-9-]/gi, '-')}-arrow`
  const hatchId = `${document.id.replace(/[^a-z0-9-]/gi, '-')}-section-hatch`
  const sheetClipId = `${document.id.replace(/[^a-z0-9-]/gi, '-')}-sheet-clip`
  const page = presentation.page
  return <svg className={`technical-drawing-svg technical-drawing-${presentation.mode}`} role="img" aria-label={document.title}
    width={page ? `${page.widthMm}mm` : undefined} height={page ? `${page.heightMm}mm` : undefined}
    data-page-fit={presentation.fit}
    viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
    <defs>
      <marker id={markerId} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
        <path d="M 5.5 0.5 L 0.5 3 L 5.5 5.5" fill="none" stroke="currentColor" />
      </marker>
      <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line className="technical-hatch-line" x1="0" y1="0" x2="0" y2="4" />
      </pattern>
      {page && <clipPath id={sheetClipId}><rect x="0" y="0" width={page.widthMm} height={page.heightMm} /></clipPath>}
    </defs>
    {page && <g>
      <rect className="technical-paper" x="0" y="0" width={page.widthMm} height={page.heightMm} />
      <rect className="technical-printable-area" x={page.contentBounds.minX} y={page.contentBounds.minY}
        width={page.contentBounds.maxX - page.contentBounds.minX}
        height={page.contentBounds.maxY - page.contentBounds.minY} />
    </g>}
    <g clipPath={page ? `url(#${sheetClipId})` : undefined}>
      {presentation.primitives.map((primitive) => <g key={primitive.id} data-primitive-id={primitive.id}>
        <Primitive primitive={primitive} markerId={markerId} hatchId={hatchId} />
      </g>)}
    </g>
  </svg>
}
