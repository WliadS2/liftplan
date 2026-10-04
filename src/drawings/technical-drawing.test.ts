import { describe, expect, it } from 'vitest'
import { millimetres } from '../engineering'
import {
  CAD_LINE_STYLES,
  calculateDrawingBounds,
  createTechnicalDrawingDocument,
  createTechnicalDrawingPresentation,
  drawingPoint,
  type TechnicalDrawingScale,
  type DrawingHatch,
  type TechnicalDrawingPrimitive,
} from './technical-drawing'

describe('technical drawing paper-space architecture', () => {
  function modelDocument(scale: TechnicalDrawingScale, width = 1000, height = 1000) {
    return createTechnicalDrawingDocument({
      id: 'physical-scale', title: 'Maßstab', view: 'section', status: 'complete', coordinateSystem: 'test',
      scale: { requested: scale, previewMode: scale === 'auto' ? 'automatic-fit' : 'fixed-page',
        printAccuracy: false, detail: 'planning' },
      primitives: [{ id: 'model', kind: 'rectangle', role: 'visible', layer: 'geometry',
        x: millimetres(0), y: millimetres(0), width: millimetres(width), height: millimetres(height) }],
    })
  }

  it.each([['1:20', 50], ['1:25', 40], ['1:50', 20], ['1:100', 10]] as const)(
    'converts 1000 mm at %s to exactly %i paper mm', (scale, expected) => {
      const presentation = createTechnicalDrawingPresentation(modelDocument(scale))
      expect(presentation.primitives[0]).toMatchObject({ width: expected, height: expected })
      expect(presentation.viewBounds).toEqual({ minX: 0, minY: 0, maxX: 210, maxY: 297 })
    },
  )

  it('reports a 410 mm model as too tall without shrinking geometry or enlarging A4', () => {
    const presentation = createTechnicalDrawingPresentation(modelDocument('1:20', 2600, 8200))
    expect(presentation.primitives[0]).toMatchObject({ width: 130, height: 410 })
    expect(presentation.page).toMatchObject({ widthMm: 210, heightMm: 297,
      contentBounds: { minX: 12, minY: 12, maxX: 198, maxY: 267 } })
    expect(presentation.fit).toBe('does-not-fit')
  })

  it('includes paper-space annotation extents in the fit result', () => {
    const document = modelDocument('1:20', 3500, 1000)
    const withAnnotation = { ...document, primitives: [...document.primitives, {
      id: 'large-label', kind: 'text' as const, role: 'secondary' as const, layer: 'annotation' as const,
      position: drawingPoint(3500, 500), text: 'Beschriftung außerhalb der Seite', anchor: 'start' as const,
    }] }
    expect(createTechnicalDrawingPresentation(document).fit).toBe('fits')
    const presentation = createTechnicalDrawingPresentation(withAnnotation)
    expect(presentation.fit).toBe('does-not-fit')
    expect(presentation.primitives[0]).toMatchObject({ width: 175 })
  })

  it('never consumes drawing fit bounds in fixed modes', () => {
    const document = modelDocument('1:20', 2600, 8200)
    const poisonedFit = { ...document, fittedBounds: {
      minX: millimetres(-1e9), minY: millimetres(-1e9), maxX: millimetres(1e9), maxY: millimetres(1e9),
    } }
    expect(createTechnicalDrawingPresentation(poisonedFit)).toEqual(createTechnicalDrawingPresentation(document))
  })

  it('keeps automatic preview fitting independent of physical page fit', () => {
    const document = modelDocument('auto', 2600, 8200)
    const presentation = createTechnicalDrawingPresentation(document)
    expect(presentation.mode).toBe('automatic-fit')
    expect(presentation.page).toBeUndefined()
    expect(presentation.fit).toBeUndefined()
    expect(presentation.viewBounds).toEqual(document.fittedBounds)
    expect(presentation.primitives).toBe(document.primitives)
  })

  it('defines deterministic and distinct CAD line classifications', () => {
    expect(CAD_LINE_STYLES.cut.weightMm).toBeGreaterThan(CAD_LINE_STYLES.visible.weightMm)
    expect(CAD_LINE_STYLES.visible.weightMm).toBeGreaterThan(CAD_LINE_STYLES.secondary.weightMm)
    expect(CAD_LINE_STYLES.dimension.pattern).toBe('solid')
    expect(CAD_LINE_STYLES.centerline.pattern).toBe('dash-dot')
    expect(CAD_LINE_STYLES.hidden.pattern).toBe('dashed')
  })

  it('scales model geometry at 1:N while retaining actual dimension values', () => {
    const primitives: TechnicalDrawingPrimitive[] = [{
      id: 'cabin', kind: 'rectangle', role: 'visible', layer: 'geometry',
      x: millimetres(0), y: millimetres(0), width: millimetres(1100), height: millimetres(1400),
    }, {
      id: 'width', kind: 'dimension', role: 'dimension', layer: 'annotation', semantic: 'cabin-width',
      valueMm: millimetres(1100), label: '1100 mm', start: drawingPoint(0, 0), end: drawingPoint(1100, 0),
      dimensionStart: drawingPoint(0, -500), dimensionEnd: drawingPoint(1100, -500), labelPosition: drawingPoint(550, -555),
    }]
    const document = (requested: '1:20' | '1:50') => createTechnicalDrawingDocument({
      id: `scale-${requested}`, title: 'Maßstab', view: 'plan', status: 'complete', coordinateSystem: 'test',
      scale: { requested, previewMode: 'fixed-page', printAccuracy: false,
        denominator: requested === '1:20' ? 20 : 50, detail: 'planning' }, primitives,
    })
    const at20 = createTechnicalDrawingPresentation(document('1:20'))
    const at50 = createTechnicalDrawingPresentation(document('1:50'))
    const cabin20 = at20.primitives.find((entry) => entry.id === 'cabin')
    const cabin50 = at50.primitives.find((entry) => entry.id === 'cabin')
    const dimension20 = at20.primitives.find((entry) => entry.id === 'width')
    const dimension50 = at50.primitives.find((entry) => entry.id === 'width')
    expect(cabin20).toMatchObject({ kind: 'rectangle', width: 55 })
    expect(cabin50).toMatchObject({ kind: 'rectangle', width: 22 })
    expect(dimension20).toMatchObject({ kind: 'dimension', valueMm: 1100, label: '1100 mm', textSizeMm: 2.5 })
    expect(dimension50).toMatchObject({ kind: 'dimension', valueMm: 1100, label: '1100 mm', textSizeMm: 2.5 })
    expect(at20.page).toMatchObject({ format: 'A4', orientation: 'landscape', widthMm: 297 })
  })

  it('keeps annotation hatching out of engineering geometry bounds', () => {
    const geometry: TechnicalDrawingPrimitive = {
      id: 'shaft', kind: 'rectangle', role: 'cut', layer: 'geometry', x: millimetres(0), y: millimetres(0),
      width: millimetres(2000), height: millimetres(2500),
    }
    const hatch: DrawingHatch = {
      id: 'structure-hatch', kind: 'hatch', role: 'secondary', layer: 'annotation', pattern: 'section-structure',
      x: millimetres(-200), y: millimetres(-200), width: millimetres(2400), height: millimetres(2900),
    }
    expect(calculateDrawingBounds([geometry, hatch], 'geometry')).toEqual(calculateDrawingBounds([geometry], 'geometry'))
  })
})
