// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../dev/fixtures/passenger-mechanical-fixture'
import { millimetres } from '../engineering'
import {
  createPassengerDoorElevationDrawing,
  createPassengerDrawingContext,
  createPassengerPlanDrawing,
  createPassengerSectionDrawing,
} from '../drawings/passenger-technical-drawings'
import {
  createTechnicalDrawingPresentation,
  TECHNICAL_A4_PAGE_SIZE_MM,
  type TechnicalDrawingDocument,
} from '../drawings/technical-drawing'
import { createLiftPlanProject, replaceProjectConfiguration } from '../projects'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import {
  createTechnicalPlanPdfFilename,
  createTechnicalPlanPdfDrawingNumber,
  createTechnicalPlanPdfMetadata,
  prepareTechnicalPlanPdf,
  sanitizePdfFilenameSegment,
  type FixedTechnicalDrawingScale,
  type TechnicalPlanPdfCandidate,
} from './technical-plan-pdf'
import { createTechnicalPlanPdfPageSvg, createTechnicalPlanPdfSvgMapping } from './technical-plan-pdf-renderer'
import {
  createTechnicalPlanPdfSheetLayout,
  TECHNICAL_PDF_FRAME_MARGIN_MM,
  TECHNICAL_PDF_TITLE_BLOCK_HEIGHT_MM,
} from './technical-plan-pdf-sheet'

const fixture = createPassengerMechanicalFixture()
const planning = createLiftGeometryPlanningInput(fixture)
if (!planning) throw new Error('Expected demo planning input')
const context = (() => {
  const value = createPassengerDrawingContext(planning)
  if (!value) throw new Error('Expected demo drawing context')
  return value
})()

const createdProject = createLiftPlanProject(
  { projectId: 'LP-2026-ÄÖÜ-ß', projectName: fixture.projectName, createdAt: '2026-10-04T10:00:00.000Z' },
  { createId: () => 'LP-2026-ÄÖÜ-ß', now: () => '2026-10-04T10:00:00.000Z' },
)
const project = replaceProjectConfiguration(createdProject, fixture, '2026-10-04T10:00:00.000Z').project
const date = new Date(2026, 9, 4, 23, 59, 59)

function candidate(document: TechnicalDrawingDocument, doorSide: 'front' | 'rear' = 'front'): TechnicalPlanPdfCandidate {
  const scale = document.scale.requested as FixedTechnicalDrawingScale
  return {
    document,
    presentation: createTechnicalDrawingPresentation(document),
    metadata: createTechnicalPlanPdfMetadata(
      project,
      document,
      scale,
      date,
      document.view === 'door-elevation' ? { landing: 1, side: doorSide } : undefined,
    ),
  }
}

function fixedDocuments(scale: FixedTechnicalDrawingScale) {
  return {
    plan: createPassengerPlanDrawing(context, scale),
    section: createPassengerSectionDrawing(context, scale),
    door: createPassengerDoorElevationDrawing(context, { levelId: 'level-1', side: 'front' }, scale),
  }
}

function prepareCurrent(document: TechnicalDrawingDocument) {
  return prepareTechnicalPlanPdf({
    scope: 'current',
    scale: document.scale.requested,
    projectName: project.name,
    candidates: document.scale.requested === 'auto' ? [] : [candidate(document)],
  })
}

describe('technical plan PDF preparation', () => {
  it('uses exact physical A4 portrait and landscape page sizes', () => {
    expect(TECHNICAL_A4_PAGE_SIZE_MM.portrait).toEqual({ width: 210, height: 297 })
    expect(TECHNICAL_A4_PAGE_SIZE_MM.landscape).toEqual({ width: 297, height: 210 })
    const documents = fixedDocuments('1:50')
    expect(createTechnicalDrawingPresentation(documents.plan).page).toMatchObject({ widthMm: 297, heightMm: 210 })
    expect(createTechnicalDrawingPresentation(documents.section).page).toMatchObject({ widthMm: 210, heightMm: 297 })
  })

  it.each([
    ['plan', '1:20', 'shaft', 'width', 130],
    ['plan', '1:50', 'shaft', 'width', 52],
    ['door', '1:20', 'door-opening', 'width', 45],
    ['door', '1:20', 'door-opening', 'height', 105],
    ['section', '1:50', 'shaft-section', 'height', 164],
  ] as const)('preserves engineering-to-paper scale for %s at %s', (view, scale, id, property, expected) => {
    const documents = fixedDocuments(scale)
    const presentation = createTechnicalDrawingPresentation(documents[view])
    const primitive = presentation.primitives.find((entry) => entry.id === id)
    expect(primitive).toBeDefined()
    expect((primitive as unknown as Record<string, number>)[property]).toBe(expected)
  })

  it('maps the complete physical SVG page to PDF millimetres without a second fit transform', () => {
    const result = prepareCurrent(fixedDocuments('1:50').plan)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const page = result.value.pages[0]
    expect(createTechnicalPlanPdfSvgMapping(page.presentation.page)).toEqual({ x: 0, y: 0, width: 297, height: 210 })
    const svg = createTechnicalPlanPdfPageSvg(page)
    expect(svg.getAttribute('viewBox')).toBe('0 0 297 210')
    expect(svg.getAttribute('width')).toBe('297mm')
    expect(svg.getAttribute('height')).toBe('210mm')
    expect(svg.getAttribute('data-pdf-mapping')).toBe('physical-page-1-to-1')
    expect(svg.querySelector('[transform*="scale"]')).toBeNull()
  })

  it('blocks an oversized section at 1:20 and accepts it at 1:50 without shrinking it', () => {
    const section20 = fixedDocuments('1:20').section
    const blocked = prepareCurrent(section20)
    expect(blocked).toEqual({
      ok: false,
      error: { code: 'drawing-does-not-fit', drawingType: 'Schnitt', scale: '1:20' },
    })
    expect(createTechnicalDrawingPresentation(section20).primitives.find((entry) => entry.id === 'shaft-section'))
      .toMatchObject({ height: 410 })

    const section50 = fixedDocuments('1:50').section
    expect(prepareCurrent(section50).ok).toBe(true)
    expect(createTechnicalDrawingPresentation(section50).primitives.find((entry) => entry.id === 'shaft-section'))
      .toMatchObject({ height: 164 })
  })

  it('rejects automatic preview as a technical PDF scale', () => {
    const result = prepareTechnicalPlanPdf({ scope: 'current', scale: 'auto', projectName: project.name, candidates: [] })
    expect(result).toEqual({ ok: false, error: { code: 'fixed-scale-required', scale: 'auto' } })
  })

  it('sanitizes filenames deterministically without project UUID suffixes', () => {
    expect(sanitizePdfFilenameSegment('Müller / Süd: Demo?')).toBe('Mueller-Sued-Demo')
    expect(createTechnicalPlanPdfFilename('Mechanische Demo – Testdaten', 'current', 'Grundriss', '1:50'))
      .toBe('LiftPlan_Mechanische-Demo-Testdaten_Grundriss_1-50.pdf')
    expect(createTechnicalPlanPdfFilename('Mechanische Demo', 'plan-set', 'Grundriss', '1:50'))
      .toBe('LiftPlan_Mechanische-Demo_Plansatz_1-50.pdf')
  })

  it('uses actual project metadata and preserves selected landing and entrance side', () => {
    const rearDoor = createPassengerDoorElevationDrawing(context, { levelId: 'level-1', side: 'rear' }, '1:20')
    const metadata = createTechnicalPlanPdfMetadata(project, rearDoor, '1:20', date, { landing: 2, side: 'rear' })
    expect(metadata).toMatchObject({
      productName: 'LiftPlan',
      projectName: 'Mechanische Demo – Testdaten',
      liftFamilyName: 'Personenaufzug',
      drawingType: 'Türansicht',
      scale: '1:20',
      date: '04.10.2026',
      projectNumber: 'LP-2026-ÄÖÜ-ß',
      version: 'liftplan-project-v1',
      drawingNumber: 'LP-LP2026AE-DR-001',
      sheetNumber: 1,
      sheetCount: 1,
      status: 'Planungsstand',
      unit: 'mm',
      doorSelection: { landing: 2, sideLabel: 'Rückseite' },
    })
  })

  it('creates deterministic drawing numbers from the project identifier and drawing view', () => {
    expect(createTechnicalPlanPdfDrawingNumber('LP-2026-ÄÖÜ-ß', 'plan')).toBe('LP-LP2026AE-GR-001')
    expect(createTechnicalPlanPdfDrawingNumber('LP-2026-ÄÖÜ-ß', 'section')).toBe('LP-LP2026AE-SC-001')
    expect(createTechnicalPlanPdfDrawingNumber('LP-2026-ÄÖÜ-ß', 'door-elevation', 2)).toBe('LP-LP2026AE-DR-002')
  })

  it('orders a complete plan set deterministically and uses one shared scale', () => {
    const documents = fixedDocuments('1:50')
    const result = prepareTechnicalPlanPdf({
      scope: 'plan-set', scale: '1:50', projectName: project.name,
      candidates: [candidate(documents.door), candidate(documents.section), candidate(documents.plan)],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pages.map((page) => page.document.view)).toEqual(['plan', 'section', 'door-elevation'])
    expect(result.value.pages.map((page) => page.metadata.scale)).toEqual(['1:50', '1:50', '1:50'])
    expect(result.value.pages.map((page) => page.metadata.drawingNumber)).toEqual([
      'LP-LP2026AE-GR-001', 'LP-LP2026AE-SC-001', 'LP-LP2026AE-DR-001',
    ])
    expect(result.value.pages.map((page) => `${page.metadata.sheetNumber} / ${page.metadata.sheetCount}`)).toEqual([
      '1 / 3', '2 / 3', '3 / 3',
    ])
  })

  it('orders additional door elevations after plan and section with sequential pages and drawing numbers', () => {
    const documents = fixedDocuments('1:50')
    const firstDoor = candidate(documents.door)
    const secondDoor = {
      ...candidate(documents.door),
      metadata: createTechnicalPlanPdfMetadata(project, documents.door, '1:50', date, { landing: 2, side: 'front' }),
    }
    const result = prepareTechnicalPlanPdf({
      scope: 'plan-set', scale: '1:50', projectName: project.name,
      candidates: [secondDoor, firstDoor, candidate(documents.section), candidate(documents.plan)],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pages.map((page) => page.document.view)).toEqual(['plan', 'section', 'door-elevation', 'door-elevation'])
    expect(result.value.pages.map((page) => page.metadata.drawingNumber)).toEqual([
      'LP-LP2026AE-GR-001', 'LP-LP2026AE-SC-001', 'LP-LP2026AE-DR-001', 'LP-LP2026AE-DR-002',
    ])
    expect(result.value.pages.map((page) => page.metadata.sheetNumber)).toEqual([1, 2, 3, 4])
    expect(result.value.pages.map((page) => page.metadata.sheetCount)).toEqual([4, 4, 4, 4])
  })

  it('blocks the whole plan set when a required page does not fit', () => {
    const documents = fixedDocuments('1:20')
    const result = prepareTechnicalPlanPdf({
      scope: 'plan-set', scale: '1:20', projectName: project.name,
      candidates: [candidate(documents.plan), candidate(documents.section), candidate(documents.door)],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'drawing-does-not-fit', scale: '1:20' } })
  })

  it('blocks incomplete and spatially conflicting drawings before generation', () => {
    const partialPlanning = createLiftGeometryPlanningInput({
      ...fixture,
      shaftWidthMm: undefined,
      shaftDepthMm: undefined,
    })
    if (!partialPlanning) throw new Error('Expected partial planning input')
    const partialContext = createPassengerDrawingContext(partialPlanning)
    if (!partialContext) throw new Error('Expected partial drawing context')
    expect(prepareCurrent(createPassengerPlanDrawing(partialContext, '1:50'))).toMatchObject({
      ok: false, error: { code: 'drawing-incomplete' },
    })

    const invalidPlanning = createLiftGeometryPlanningInput({ ...fixture, shaftWidthMm: millimetres(1000) })
    if (!invalidPlanning) throw new Error('Expected invalid planning input')
    const invalidContext = createPassengerDrawingContext(invalidPlanning)
    if (!invalidContext) throw new Error('Expected invalid drawing context')
    expect(prepareCurrent(createPassengerPlanDrawing(invalidContext, '1:50'))).toMatchObject({
      ok: false, error: { code: 'drawing-conflict' },
    })
  })

  it('serializes vector SVG primitives and German information text without canvas or raster images', () => {
    const result = prepareCurrent(fixedDocuments('1:20').door)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const svg = createTechnicalPlanPdfPageSvg(result.value.pages[0])
    expect(svg.getAttribute('data-pdf-vector-source')).toBe('technical-drawing-svg')
    expect(svg.querySelectorAll('line, rect, circle, path, polyline').length).toBeGreaterThan(0)
    expect(svg.querySelectorAll('text').length).toBeGreaterThan(0)
    expect(svg.querySelector('canvas, image')).toBeNull()
    expect(svg.textContent).toContain('900 mm')
    expect(svg.textContent).toContain('2100 mm')
    expect(svg.textContent).toContain('Vorderseite')
    expect(svg.textContent).toContain('ÄÖÜ-ß')
    expect(svg.textContent).toContain('Planungsdarstellung ohne Nachweis technischer oder normativer Konformität.')
  })

  it('creates a consistent 9 mm frame and a reserved professional bottom-right title area', () => {
    const plan = candidate(fixedDocuments('1:50').plan)
    const layout = createTechnicalPlanPdfSheetLayout(plan.presentation.page!, plan.presentation.completeBounds)
    expect(TECHNICAL_PDF_FRAME_MARGIN_MM).toBe(9)
    expect(TECHNICAL_PDF_TITLE_BLOCK_HEIGHT_MM).toBe(34)
    expect(layout.frame).toMatchObject({ x: 9, y: 9, width: 279, height: 192 })
    expect(layout.titleArea).toMatchObject({ x: 108, y: 167, width: 180, height: 34 })
    expect(layout.drawingArea).toMatchObject({ x: 15, y: 15, width: 267, height: 146 })
    expect(layout.translatedDrawingBounds.maxY).toBeLessThan(layout.titleArea.minY)
    expect(layout.fits).toBe(true)
  })

  it('centres complete visible bounds using translation only', () => {
    const door = candidate(fixedDocuments('1:20').door)
    const result = prepareTechnicalPlanPdf({
      scope: 'current', scale: '1:20', projectName: project.name, candidates: [door],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const page = result.value.pages[0]
    const layout = createTechnicalPlanPdfSheetLayout(page.presentation.page, page.presentation.completeBounds)
    const drawingCenter = {
      x: (layout.translatedDrawingBounds.minX + layout.translatedDrawingBounds.maxX) / 2,
      y: (layout.translatedDrawingBounds.minY + layout.translatedDrawingBounds.maxY) / 2,
    }
    expect(drawingCenter.x).toBeCloseTo((layout.drawingArea.minX + layout.drawingArea.maxX) / 2, 3)
    expect(drawingCenter.y).toBeCloseTo((layout.drawingArea.minY + layout.drawingArea.maxY) / 2, 3)

    const svg = createTechnicalPlanPdfPageSvg(page)
    const drawingContent = svg.querySelector('[data-technical-drawing-content="true"]')
    expect(drawingContent?.getAttribute('transform')).toMatch(/^translate\(-?[\d.]+ -?[\d.]+\)$/)
    expect(drawingContent?.getAttribute('transform')).not.toContain('scale')
    const opening = svg.querySelector('[data-primitive-id="door-opening"] rect')
    expect(opening?.getAttribute('width')).toBe('45')
    expect(opening?.getAttribute('height')).toBe('105')
  })

  it('renders vector frame and title metadata as reusable paper-space primitives on every plan-set page', () => {
    const documents = fixedDocuments('1:50')
    const result = prepareTechnicalPlanPdf({
      scope: 'plan-set', scale: '1:50', projectName: project.name,
      candidates: [candidate(documents.plan), candidate(documents.section), candidate(documents.door)],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const page of result.value.pages) {
      const svg = createTechnicalPlanPdfPageSvg(page)
      const frame = svg.querySelector('[data-paper-primitive-id="sheet-frame"]')
      expect(frame).not.toBeNull()
      expect(frame?.getAttribute('fill')).toBe('none')
      expect(frame?.getAttribute('stroke')).toBe('#000000')
      expect(frame?.getAttribute('stroke-width')).toBe('0.35')
      expect(svg.querySelector('[data-paper-primitive-id="title-block"]')).not.toBeNull()
      expect(svg.querySelector('[data-paper-primitive-id="title-project-value"]')?.textContent).toBe(project.name)
      expect(svg.querySelector('[data-paper-primitive-id="title-drawing-value"]')?.textContent).toBe(page.document.title)
      expect(svg.querySelector('[data-paper-primitive-id="title-scale-value"]')?.textContent).toBe('1:50')
      expect(svg.querySelector('[data-paper-primitive-id="title-drawing-number-value"]')?.textContent).toBe(page.metadata.drawingNumber)
      expect(svg.querySelector('[data-paper-primitive-id="title-sheet-value"]')?.textContent)
        .toBe(`${page.metadata.sheetNumber} / ${page.metadata.sheetCount}`)
      expect(svg.querySelector('[data-paper-primitive-id="title-status-value"]')?.textContent).toBe('Planungsstand')
      expect(svg.querySelector('[data-paper-primitive-id="title-unit-value"]')?.textContent).toBe('mm')
      expect(svg.querySelector('canvas, image')).toBeNull()
    }
  })

  it.each(['1:20', '1:25', '1:50', '1:100'] as FixedTechnicalDrawingScale[])('preserves title-block layout and scale for a fitted door drawing at %s', (scale) => {
    const result = prepareCurrent(createPassengerDoorElevationDrawing(context, { levelId: 'level-1', side: 'front' }, scale))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const svg = createTechnicalPlanPdfPageSvg(result.value.pages[0])
    expect(svg.querySelector('[data-paper-primitive-id="title-block"]')).not.toBeNull()
    expect(svg.querySelector('[data-primitive-id="door-opening"] rect')?.getAttribute('width')).toBe(String(900 / Number(scale.slice(2))))
  })
})
