import { renderToStaticMarkup } from 'react-dom/server'
import { TechnicalDrawingSvg } from '../drawings/TechnicalDrawingSvg'
import { CAD_LINE_STYLES, type TechnicalDrawingPage, type TechnicalLineRole } from '../drawings/technical-drawing'
import type { PreparedTechnicalPlanPdf, TechnicalPlanPdfPage } from './technical-plan-pdf'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const cadDashPatterns: Partial<Readonly<Record<TechnicalLineRole, string>>> = {
  centerline: '4 1 1 1',
  hidden: '2 1',
  level: '5 1.5 1 1.5',
}

function exportCadStyle(role: TechnicalLineRole): Readonly<Record<string, string>> {
  const dashPattern = cadDashPatterns[role]
  const opacity = role === 'secondary' ? '0.82'
    : role === 'hidden' ? '0.75'
      : role === 'centerline' || role === 'level' ? '0.82'
        : undefined
  return {
    stroke: '#000000',
    'stroke-width': String(CAD_LINE_STYLES[role].weightMm),
    ...(dashPattern ? { 'stroke-dasharray': dashPattern } : {}),
    ...(opacity ? { 'stroke-opacity': opacity } : {}),
  }
}

const cadStyles: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'technical-cut': exportCadStyle('cut'),
  'technical-visible': exportCadStyle('visible'),
  'technical-secondary': exportCadStyle('secondary'),
  'technical-centerline': exportCadStyle('centerline'),
  'technical-hidden': exportCadStyle('hidden'),
  'technical-level': exportCadStyle('level'),
  'technical-section': exportCadStyle('section'),
  'technical-dimension': { color: '#000000', ...exportCadStyle('dimension') },
  'technical-hatch-line': { stroke: '#000000', 'stroke-width': '0.45' },
}

export interface TechnicalPlanPdfSvgMapping {
  readonly x: 0
  readonly y: 0
  readonly width: number
  readonly height: number
}

export function createTechnicalPlanPdfSvgMapping(page: TechnicalDrawingPage): TechnicalPlanPdfSvgMapping {
  return { x: 0, y: 0, width: page.widthMm, height: page.heightMm }
}

function setAttributes(element: Element, attributes: Readonly<Record<string, string>>) {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
}

function inlineDrawingStyles(svg: SVGSVGElement) {
  svg.setAttribute('xmlns', SVG_NAMESPACE)
  svg.setAttribute('color', '#000000')
  svg.querySelectorAll('line, rect, circle, path, polyline').forEach((element) => {
    if (!element.hasAttribute('fill') && !element.getAttribute('style')?.includes('fill:')) element.setAttribute('fill', 'none')
    element.setAttribute('stroke', '#000000')
  })
  svg.querySelectorAll('[class]').forEach((element) => {
    for (const className of element.classList) {
      const styles = cadStyles[className]
      if (styles) setAttributes(element, styles)
    }
  })
  svg.querySelectorAll('text').forEach((element) => {
    const style = element.getAttribute('style') ?? ''
    const fontSize = style.match(/--drawing-font-size:\s*([0-9.]+)px/)?.[1]
    const sheetFontSize = style.match(/--sheet-font-size:\s*([0-9.]+)px/)?.[1]
    setAttributes(element, {
      fill: '#000000', stroke: 'none', 'font-family': 'helvetica',
      ...(fontSize ? { 'font-size': fontSize } : sheetFontSize ? { 'font-size': sheetFontSize } : {}),
    })
    if (style.includes('--drawing-font-size:') || style.includes('--sheet-font-size:')) element.removeAttribute('style')
  })
  svg.querySelectorAll('.technical-printable-area').forEach((element) => element.remove())
  svg.querySelectorAll('.technical-paper').forEach((element) => setAttributes(element, {
    fill: '#ffffff', stroke: 'none',
  }))
  svg.querySelectorAll('[data-paper-primitive-id]').forEach((element) => element.removeAttribute('style'))
}

/**
 * Serializes the shared physical SVG sheet renderer. No drawing primitive,
 * engineering dimension, projection, or page-to-PDF mapping is recalculated.
 */
export function createTechnicalPlanPdfPageSvg(page: TechnicalPlanPdfPage): SVGSVGElement {
  const markup = renderToStaticMarkup(
    <TechnicalDrawingSvg document={page.document} presentation={page.presentation} sheet={page.metadata} />,
  )
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  if (parsed.querySelector('parsererror') || parsed.documentElement.tagName.toLowerCase() !== 'svg') {
    throw new Error('Technical drawing SVG serialization failed')
  }
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement
  inlineDrawingStyles(svg)
  if (!svg.querySelector('[data-technical-sheet-paper-space="true"]')) {
    throw new Error('Technical drawing SVG sheet layer is missing')
  }
  svg.setAttribute('data-pdf-vector-source', 'technical-drawing-svg')
  svg.setAttribute('data-pdf-mapping', 'physical-page-1-to-1')
  return svg
}

function mountSvgForConversion(svg: SVGSVGElement) {
  const container = document.createElement('div')
  container.hidden = true
  container.setAttribute('aria-hidden', 'true')
  container.append(svg)
  document.body.append(container)
  return () => container.remove()
}

export async function generateTechnicalPlanPdf(prepared: PreparedTechnicalPlanPdf): Promise<Blob> {
  if (!prepared.pages.length) throw new Error('A PDF requires at least one page')
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
  const firstPage = prepared.pages[0].presentation.page
  const pdf = new jsPDF({
    orientation: firstPage.orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  })
  pdf.setProperties({
    title: prepared.scope === 'plan-set' ? 'LiftPlan Plansatz' : `LiftPlan ${prepared.pages[0].document.title}`,
    subject: 'Technische Planungsdarstellung',
    author: 'LiftPlan',
    creator: 'LiftPlan',
  })

  for (const [index, page] of prepared.pages.entries()) {
    if (index > 0) pdf.addPage('a4', page.presentation.page.orientation)
    const svg = createTechnicalPlanPdfPageSvg(page)
    const unmount = mountSvgForConversion(svg)
    try {
      await svg2pdf(svg, pdf, {
        ...createTechnicalPlanPdfSvgMapping(page.presentation.page),
        loadExternalStyleSheets: false,
        loadImages: false,
      })
    } finally {
      unmount()
    }
  }
  return pdf.output('blob')
}

export function downloadTechnicalPlanPdf(blob: Blob, filename: string) {
  if (blob.size === 0) throw new Error('Generated PDF is empty')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
