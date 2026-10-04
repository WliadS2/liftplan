import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerPlanningConfiguration, type PassengerPlanningConfiguration } from '../elevator'
import { metres, metresToMillimetres, millimetres } from '../engineering'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import {
  createPassengerDoorElevationDrawing,
  createPassengerDrawingContext,
  createPassengerPlanDrawing,
  createPassengerSectionDrawing,
  findDimensions,
} from './passenger-technical-drawings'
import type { DrawingRectangle, TechnicalDrawingDocument } from './technical-drawing'
import { createTechnicalDrawingPresentation } from './technical-drawing'

function context(configuration: PassengerPlanningConfiguration) {
  const planning = createLiftGeometryPlanningInput(configuration)
  if (!planning) throw new Error('Expected valid planning structure')
  const result = createPassengerDrawingContext(planning)
  if (!result) throw new Error('Expected normalized drawing context')
  return result
}

const rectangles = (drawing: TechnicalDrawingDocument) => drawing.primitives.filter((primitive): primitive is DrawingRectangle =>
  primitive.kind === 'rectangle' || primitive.kind === 'component-outline')

function partialConfiguration(): PassengerPlanningConfiguration {
  return {
    ...createPassengerPlanningConfiguration('Teilprojekt'),
    cabinWidthMm: millimetres(1100), cabinDepthMm: millimetres(1400), cabinHeightMm: millimetres(2200),
  }
}

describe('passenger technical drawing projections', () => {
  it('projects shaft and cabin to plan coordinates using X horizontally and -Z vertically', () => {
    const drawing = createPassengerPlanDrawing(context(createPassengerMechanicalFixture()))
    const shaft = rectangles(drawing).find((entry) => entry.componentId === 'shaft')
    const cabin = rectangles(drawing).find((entry) => entry.componentId === 'cabin')
    expect(shaft).toMatchObject({ x: -1300, y: -1500, width: 2600, height: 3000 })
    expect(cabin).toMatchObject({ x: -550, y: -700, width: 1100, height: 1400 })
    expect(drawing.coordinateSystem).toContain('page Y = -Z')
  })

  it('keeps counterweight geometry optional', () => {
    expect(rectangles(createPassengerPlanDrawing(context(createPassengerMechanicalFixture())))
      .some((entry) => entry.componentId === 'counterweight')).toBe(true)
    expect(rectangles(createPassengerPlanDrawing(context(partialConfiguration())))
      .some((entry) => entry.componentId === 'counterweight')).toBe(false)
  })

  it('projects the explicit front door opening at the cabin front plane', () => {
    const drawing = createPassengerPlanDrawing(context(createPassengerMechanicalFixture()))
    expect(drawing.primitives.find((entry) => entry.id === 'cabin-front-opening')).toMatchObject({
      kind: 'line', start: { x: -450, y: -700 }, end: { x: 450, y: -700 },
    })
  })

  it.each([2, 6, 10])('renders ordered level lines and deterministic section extents for %i stops', (stopCount) => {
    const fixture = { ...createPassengerMechanicalFixture(), stopCount }
    const drawing = createPassengerSectionDrawing(context(fixture))
    const levels = drawing.primitives.filter((entry) => entry.id.endsWith('-line'))
    expect(levels).toHaveLength(stopCount)
    expect(levels.map((entry) => entry.kind === 'line' ? entry.start.y : undefined)).toEqual(
      Array.from({ length: stopCount }, (_, index) => -index * 3000),
    )
    expect(drawing.fittedBounds.minY).toBeLessThanOrEqual(-(stopCount - 1) * 3000 - 4000)
    expect(findDimensions(drawing, 'headroom')).toEqual([4000])
    expect(findDimensions(drawing, 'installation-height')[0]).toBeCloseTo(
      1200 + (stopCount - 1) * 3000 + 4000,
    )
  })

  it('represents pit, headroom, installation height and only explicit machine geometry', () => {
    const complete = createPassengerSectionDrawing(context(createPassengerMechanicalFixture()))
    expect(rectangles(complete).map((entry) => entry.componentId)).toEqual(expect.arrayContaining(['pit', 'headroom', 'machine']))
    expect(findDimensions(complete, 'pit-depth')).toEqual([1200])
    expect(findDimensions(complete, 'headroom')).toEqual([4000])
    expect(findDimensions(complete, 'installation-height')).toEqual([8200])

    const withoutMachine = createPassengerSectionDrawing(context({
      ...createPassengerMechanicalFixture(), mechanical: undefined,
    }))
    expect(rectangles(withoutMachine).some((entry) => entry.componentId === 'machine')).toBe(false)
  })

  it('keeps demo configuration, normalized geometry, validation, and drawings on one semantic source', () => {
    const configuration = createPassengerMechanicalFixture()
    const ctx = context(configuration)
    const { installation, planning } = ctx.inputs
    const plan = createPassengerPlanDrawing(ctx)
    const section = createPassengerSectionDrawing(ctx)
    const door = createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'front' })

    expect(planning.shaft).toMatchObject({
      widthMm: configuration.shaftWidthMm,
      depthMm: configuration.shaftDepthMm,
      pitDepthMm: configuration.pitDepthMm,
      headroomMm: configuration.headroomMm,
    })
    expect(metresToMillimetres(installation.shaft!.width)).toBe(configuration.shaftWidthMm)
    expect(metresToMillimetres(installation.shaft!.depth)).toBe(configuration.shaftDepthMm)
    expect(metresToMillimetres(installation.cabin!.width)).toBe(configuration.cabinWidthMm)
    expect(metresToMillimetres(installation.cabin!.depth)).toBe(configuration.cabinDepthMm)
    expect(metresToMillimetres(installation.cabin!.height)).toBe(configuration.cabinHeightMm)
    expect(installation.levels.map((level) => metresToMillimetres(level.elevationY))).toEqual([0, 3000])
    expect(findDimensions(plan, 'shaft-width')).toEqual([configuration.shaftWidthMm])
    expect(findDimensions(plan, 'shaft-depth')).toEqual([configuration.shaftDepthMm])
    expect(findDimensions(plan, 'cabin-width')).toEqual([configuration.cabinWidthMm])
    expect(findDimensions(plan, 'cabin-depth')).toEqual([configuration.cabinDepthMm])
    expect(findDimensions(plan, 'door-width')).toEqual([configuration.doorWidthMm])
    expect(findDimensions(section, 'pit-depth')).toEqual([configuration.pitDepthMm])
    expect(findDimensions(section, 'headroom')).toEqual([configuration.headroomMm])
    expect(findDimensions(section, 'installation-height')).toEqual([
      metresToMillimetres(installation.bounds.height),
    ])
    expect(findDimensions(door, 'door-width')).toEqual([configuration.doorWidthMm])
    expect(findDimensions(door, 'door-height')).toEqual([configuration.doorHeightMm])
    expect(ctx.validation.status).not.toBe('invalid')
    expect([plan.status, section.status, door.status]).not.toContain('conflict')
  })

  it('reflows normalized headroom, validation, and section dimensions together', () => {
    const fixture = createPassengerMechanicalFixture()
    const validContext = context({ ...fixture, headroomMm: millimetres(4500) })
    const conflictingContext = context({ ...fixture, headroomMm: millimetres(3000) })

    expect(metresToMillimetres(metres(validContext.inputs.installation.vertical.headroomRegion!.topY -
      validContext.inputs.installation.vertical.headroomRegion!.bottomY))).toBe(4500)
    expect(findDimensions(createPassengerSectionDrawing(validContext), 'headroom')).toEqual([4500])
    expect(findDimensions(createPassengerSectionDrawing(validContext), 'installation-height')).toEqual([8700])
    expect(validContext.validation.status).not.toBe('invalid')

    expect(metresToMillimetres(metres(conflictingContext.inputs.installation.vertical.headroomRegion!.topY -
      conflictingContext.inputs.installation.vertical.headroomRegion!.bottomY))).toBe(3000)
    expect(findDimensions(createPassengerSectionDrawing(conflictingContext), 'headroom')).toEqual([3000])
    expect(findDimensions(createPassengerSectionDrawing(conflictingContext), 'installation-height')).toEqual([7200])
    expect(conflictingContext.validation.status).toBe('invalid')
    expect(createPassengerSectionDrawing(conflictingContext).status).toBe('conflict')
  })

  it('uses selected landing door width and height for the door elevation', () => {
    const drawing = createPassengerDoorElevationDrawing(context(createPassengerMechanicalFixture()), { levelId: 'level-2', side: 'front' })
    expect(rectangles(drawing).find((entry) => entry.componentId?.startsWith('landing-front'))).toMatchObject({
      x: -450, y: -2100, width: 900, height: 2100,
    })
    expect(findDimensions(drawing, 'door-width')).toEqual([900])
    expect(findDimensions(drawing, 'door-height')).toEqual([2100])
    expect(drawing.primitives.some((entry) => entry.kind === 'text' && entry.text.includes('Haltestelle 2'))).toBe(true)
  })

  it('keeps front and rear door elevations independent for a through car', () => {
    const ctx = context(createPassengerMechanicalFixture('rear', true))
    const front = createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'front' })
    const rear = createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'rear' })
    expect(front.id).toBe('passenger-door-level-1-front')
    expect(rear.id).toBe('passenger-door-level-1-rear')
    expect(front.primitives.find((entry) => entry.kind === 'text' && entry.id === 'door-title')).toMatchObject({ text: expect.stringContaining('Vorne') })
    expect(rear.primitives.find((entry) => entry.kind === 'text' && entry.id === 'door-title')).toMatchObject({ text: expect.stringContaining('Hinten') })
  })

  it('emits only normalized planning dimensions, not demo component thicknesses', () => {
    const plan = createPassengerPlanDrawing(context(createPassengerMechanicalFixture()))
    const dimensions = plan.primitives.filter((entry) => entry.kind === 'dimension')
    expect(dimensions.map((entry) => entry.semantic).sort()).toEqual([
      'cabin-depth', 'cabin-width', 'door-width', 'shaft-depth', 'shaft-width',
    ])
    expect(dimensions.map((entry) => entry.valueMm)).toEqual(expect.arrayContaining([2600, 3000, 1100, 1400, 900]))
    expect(dimensions.some((entry) => entry.semantic.includes('frame') || entry.semantic.includes('jamb') || entry.semantic.includes('header'))).toBe(false)
  })

  it('places plan labels in deterministic annotation lanes with leaders', () => {
    const drawing = createPassengerPlanDrawing(context(createPassengerMechanicalFixture()))
    const counterweight = rectangles(drawing).find((entry) => entry.componentId === 'counterweight')!
    const counterweightLabel = drawing.primitives.find((entry) => entry.id === 'counterweight-label')
    const cabinLabel = drawing.primitives.find((entry) => entry.id === 'cabin-label')
    const railLabel = drawing.primitives.find((entry) => entry.id === 'car-rail-label')
    const doorDimension = drawing.primitives.find((entry) => entry.kind === 'dimension' && entry.semantic === 'door-width')
    const cabinDimension = drawing.primitives.find((entry) => entry.kind === 'dimension' && entry.semantic === 'cabin-width')

    expect(counterweightLabel).toMatchObject({
      kind: 'text',
      position: { x: counterweight.x + counterweight.width / 2, y: counterweight.y + counterweight.height + 150 },
    })
    expect(drawing.primitives).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'counterweight-label-leader', kind: 'line', layer: 'annotation' }),
      expect.objectContaining({ id: 'cabin-label-leader', kind: 'line', layer: 'annotation' }),
      expect.objectContaining({ id: 'car-rail-label-leader', kind: 'line', layer: 'annotation' }),
    ]))
    expect(cabinLabel).toMatchObject({ kind: 'text', anchor: 'start' })
    expect(railLabel).toMatchObject({ kind: 'text', text: 'Führungsschiene', anchor: 'start' })
    expect(doorDimension).toMatchObject({ kind: 'dimension' })
    expect(cabinDimension).toMatchObject({ kind: 'dimension' })
    if (doorDimension?.kind !== 'dimension' || cabinDimension?.kind !== 'dimension') {
      throw new Error('Expected plan dimensions')
    }
    expect(Math.abs(doorDimension.dimensionStart.y - doorDimension.start.y)).toBeLessThan(
      Math.abs(cabinDimension.dimensionStart.y - cabinDimension.start.y),
    )
  })

  it('calculates deterministic bounds and includes annotations in fitted bounds', () => {
    const first = createPassengerPlanDrawing(context(createPassengerMechanicalFixture()))
    const second = createPassengerPlanDrawing(context(createPassengerMechanicalFixture()))
    expect(first).toEqual(second)
    expect(first.fittedBounds.minX).toBeLessThanOrEqual(first.geometryBounds.minX)
    expect(first.fittedBounds.minX).toBeLessThanOrEqual(first.annotationBounds.minX)
    expect(first.fittedBounds.maxY).toBeGreaterThanOrEqual(first.geometryBounds.maxY)
    expect(first.fittedBounds.maxY).toBeGreaterThanOrEqual(first.annotationBounds.maxY)
  })

  it('returns graceful incomplete drawing states while retaining available geometry', () => {
    const ctx = context(partialConfiguration())
    const plan = createPassengerPlanDrawing(ctx)
    const section = createPassengerSectionDrawing(ctx)
    const door = createPassengerDoorElevationDrawing(ctx)
    expect(plan.status).toBe('incomplete')
    expect(rectangles(plan).some((entry) => entry.componentId === 'cabin')).toBe(true)
    expect(section.status).toBe('incomplete')
    expect(door).toMatchObject({ status: 'incomplete', primitives: [] })
  })

  it('marks invalid planning geometry as conflicting without hiding the drawing', () => {
    const fixture = createPassengerMechanicalFixture()
    const drawing = createPassengerPlanDrawing(context({ ...fixture, shaftWidthMm: millimetres(1000) }))
    expect(drawing.status).toBe('conflict')
    expect(drawing.primitives.length).toBeGreaterThan(0)
  })

  it('uses a professional plan hierarchy with explicit rail profiles and counterweight internals', () => {
    const drawing = createPassengerPlanDrawing(context(createPassengerMechanicalFixture()), '1:20')
    expect(drawing.primitives.find((entry) => entry.id === 'shaft')).toMatchObject({ role: 'cut' })
    expect(drawing.primitives.filter((entry) => entry.kind === 'polyline' && entry.id.includes('car-rail'))).toHaveLength(2)
    expect(drawing.primitives.filter((entry) => entry.kind === 'polyline' && entry.id.includes('counterweight-rail'))).toHaveLength(2)
    expect(drawing.primitives.find((entry) => entry.id === 'counterweight-stack')).toMatchObject({ role: 'hidden' })
    expect(drawing.primitives.find((entry) => entry.id === 'cabin-axis-x')).toMatchObject({ kind: 'centerline' })
    expect(drawing.primitives.find((entry) => entry.id === 'cabin-front-axis')).toMatchObject({ kind: 'centerline' })
  })

  it('draws two center-opening leaves as separate panels with a center axis', () => {
    const drawing = createPassengerDoorElevationDrawing(context(createPassengerMechanicalFixture()),
      { levelId: 'level-1', side: 'front' }, '1:20')
    const panels = rectangles(drawing).filter((entry) => entry.id.includes('panel-'))
    expect(panels).toHaveLength(2)
    expect(panels[0].x + panels[0].width).toBe(0)
    expect(panels[1].x).toBe(0)
    expect(drawing.primitives.find((entry) => entry.id === 'door-axis')).toMatchObject({ kind: 'centerline' })
    expect(findDimensions(drawing, 'door-width')).toEqual([900])
    expect(findDimensions(drawing, 'door-height')).toEqual([2100])
  })

  it('formats level markers from exact normalized elevations', () => {
    const drawing = createPassengerSectionDrawing(context({ ...createPassengerMechanicalFixture(), stopCount: 3 }))
    const labels = drawing.primitives.filter((entry) => entry.kind === 'text' && entry.id.endsWith('-label'))
      .map((entry) => entry.kind === 'text' ? entry.text : '')
    expect(labels).toEqual(expect.arrayContaining([
      '±0.000 · Haltestelle 1', '+3.000 · Haltestelle 2', '+6.000 · Haltestelle 3',
    ]))
  })

  it('ties machine, sheave, and suspension projections to normalized drive geometry', () => {
    const ctx = context(createPassengerMechanicalFixture())
    const drawing = createPassengerSectionDrawing(ctx, '1:20')
    const sheave = ctx.inputs.drive.sheaves[0]
    expect(drawing.primitives.find((entry) => entry.id === `${sheave.id}-section`)).toMatchObject({
      kind: 'circle', center: { x: metresToMillimetres(sheave.center[0]), y: -metresToMillimetres(sheave.center[1]) },
      radius: metresToMillimetres(metres(sheave.diameter / 2)),
    })
    expect(ctx.inputs.drive.machine?.boxes.every((part) => drawing.primitives.some((entry) => entry.id === part.id))).toBe(true)
    expect(drawing.primitives.some((entry) => entry.id.endsWith('-section') && entry.id.includes('rope'))).toBe(true)
  })

  it('emits richer 1:20 detail than 1:100 without changing engineering dimensions', () => {
    const ctx = context(createPassengerMechanicalFixture())
    const plan20 = createPassengerPlanDrawing(ctx, '1:20')
    const plan100 = createPassengerPlanDrawing(ctx, '1:100')
    const door20 = createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'front' }, '1:20')
    const door100 = createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'front' }, '1:100')
    expect(plan20.primitives.length).toBeGreaterThan(plan100.primitives.length)
    expect(door20.primitives.length).toBeGreaterThan(door100.primitives.length)
    for (const semantic of ['shaft-width', 'shaft-depth', 'cabin-width', 'cabin-depth', 'door-width']) {
      expect(findDimensions(plan20, semantic)).toEqual(findDimensions(plan100, semantic))
    }
    expect(findDimensions(door20, 'door-width')).toEqual(findDimensions(door100, 'door-width'))
    expect(findDimensions(door20, 'door-height')).toEqual(findDimensions(door100, 'door-height'))
  })

  it('orders fixed-page door, cabin, and shaft dimension lanes in paper space', () => {
    const presentation = createTechnicalDrawingPresentation(
      createPassengerPlanDrawing(context(createPassengerMechanicalFixture()), '1:50'),
    )
    const offset = (semantic: string) => {
      const entry = presentation.primitives.find((primitive) => primitive.kind === 'dimension' && primitive.semantic === semantic)
      if (!entry || entry.kind !== 'dimension') throw new Error(`Missing ${semantic}`)
      return Math.hypot(entry.dimensionStart.x - entry.start.x, entry.dimensionStart.y - entry.start.y)
    }
    expect(offset('door-width')).toBeLessThan(offset('cabin-width'))
    expect(offset('cabin-width')).toBeLessThan(offset('shaft-width'))
  })

  it.each(['1:20', '1:50', '1:100'] as const)('keeps primitive identities unique at %s', (scale) => {
    const ctx = context(createPassengerMechanicalFixture())
    const documents = [
      createPassengerPlanDrawing(ctx, scale),
      createPassengerSectionDrawing(ctx, scale),
      createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'front' }, scale),
    ]
    for (const document of documents) {
      const ids = document.primitives.map((primitive) => primitive.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('preserves the demo shaft width and landscape page occupancy at 1:20', () => {
    const presentation = createTechnicalDrawingPresentation(
      createPassengerPlanDrawing(context(createPassengerMechanicalFixture()), '1:20'),
    )
    expect(presentation.primitives.find((entry) => entry.id === 'shaft')).toMatchObject({ width: 130 })
    expect(presentation.page).toMatchObject({ orientation: 'landscape', widthMm: 297, heightMm: 210 })
    expect(130 / presentation.page!.widthMm).toBeCloseTo(0.4377104377)
  })

  it.each([['1:20', 410, 'does-not-fit'], ['1:25', 328, 'does-not-fit'],
    ['1:50', 164, 'fits'], ['1:100', 82, 'fits']] as const)(
    'keeps the complete 8200 mm section physically truthful at %s', (scale, height, fit) => {
      const presentation = createTechnicalDrawingPresentation(
        createPassengerSectionDrawing(context(createPassengerMechanicalFixture()), scale),
      )
      expect(presentation.primitives.find((entry) => entry.id === 'shaft-section')).toMatchObject({ height })
      expect(presentation.fit).toBe(fit)
      expect(presentation.viewBounds).toEqual({ minX: 0, minY: 0, maxX: 210, maxY: 297 })
      expect(presentation.primitives.find((entry) => entry.id === 'installation-height')).toMatchObject({
        kind: 'dimension', valueMm: 8200, label: '8200 mm',
      })
    },
  )

  it.each([['1:20', 45, 105], ['1:50', 18, 42]] as const)(
    'preserves the 900 x 2100 entrance opening on paper at %s', (scale, width, height) => {
      const presentation = createTechnicalDrawingPresentation(createPassengerDoorElevationDrawing(
        context(createPassengerMechanicalFixture()), { levelId: 'level-1', side: 'front' }, scale,
      ))
      expect(presentation.primitives.find((entry) => entry.id === 'door-opening')).toMatchObject({ width, height })
      expect(presentation.viewBounds).toEqual({ minX: 0, minY: 0, maxX: 297, maxY: 210 })
    },
  )
})
