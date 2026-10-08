// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { millimetres as mm } from '../../engineering'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { loadDevelopmentGoodsFixture, resetDevelopmentMechanicalFixture } from '../../dev/development-mechanical-session'
import { createProjectStore } from '../../projects/project-store'
import { createGoodsLiftNormalizedModel } from './goods-lift-model'
import { createGoodsLiftSceneModel } from './goods-lift-scene-model'
import { validateGoodsLiftSpatialGeometry } from '../../collision/goods-lift-spatial-validation'
import {
  createGoodsLiftDrawingContext, createGoodsLiftPlanDrawing, createGoodsLiftSectionDrawing,
  createGoodsLiftDoorElevationDrawing,
} from '../../drawings/goods-lift-technical-drawings'
import { calculateDrawingBounds, createTechnicalDrawingPresentation,
  type DrawingText, type TechnicalDrawingDocument, type TechnicalDrawingPrimitive } from '../../drawings/technical-drawing'
import { TechnicalDrawingSvg } from '../../drawings/TechnicalDrawingSvg'
import { createTechnicalPlanPdfMetadata, prepareTechnicalPlanPdf } from '../../documents/technical-plan-pdf'
import { createTechnicalPlanPdfPageSvg } from '../../documents/technical-plan-pdf-renderer'
import { createTechnicalPlanDxfMetadata, prepareTechnicalPlanDxf } from '../../documents/technical-plan-dxf'
import { generateTechnicalPlanDxf, technicalDxfLayerForPrimitive } from '../../documents/technical-plan-dxf-renderer'
import { getGoodsLiftCameraFrame } from '../../three/camera/goods-lift-camera'
import { calculateCameraFit } from '../../three/camera/camera-fit'
import { createGoodsLiftRenderModel, GOODS_LIFT_VIEW_MODES, getGoodsLiftRenderLegend } from '../../three/geometry/goods/goods-lift-render-model'

const fixture = createGoodsLiftQaFixture()
const date = new Date('2026-10-05T12:00:00Z')
function context(configuration = fixture) {
  const value = createGoodsLiftDrawingContext(configuration)
  if (!value) throw new Error('Expected goods context')
  return value
}
function model(configuration = fixture) {
  const normalized = createGoodsLiftNormalizedModel(configuration)
  if (normalized.status === 'empty') throw new Error('Expected goods model')
  return normalized
}
function drawings(scale: 'auto' | '1:20' | '1:25' | '1:50' | '1:100' = 'auto', configuration = fixture) {
  const ctx = context(configuration)
  return [createGoodsLiftPlanDrawing(ctx, scale), createGoodsLiftSectionDrawing(ctx, scale),
    createGoodsLiftDoorElevationDrawing(ctx, { levelId: 'level-6', side: 'rear' }, scale)]
}
function project() {
  const store = createProjectStore({ createId: () => 'goods-qa', now: () => date.toISOString() })
  loadDevelopmentGoodsFixture(store.getState())
  return store.getState().project
}
function labels(primitives: readonly TechnicalDrawingPrimitive[]) {
  return primitives.filter((entry): entry is DrawingText => entry.kind === 'text')
}
function verifyLabels(primitives: readonly TechnicalDrawingPrimitive[]) {
  const texts = labels(primitives)
  expect(new Set(texts.map((entry) => `${entry.position.x}:${entry.position.y}`)).size).toBe(texts.length)
  for (let i = 0; i < texts.length; i++) {
    const a = calculateDrawingBounds([texts[i]])
    for (const other of texts.slice(i + 1)) {
      const b = calculateDrawingBounds([other])
      expect(a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY).toBe(true)
    }
    // Exterior columns keep text off all geometry, axes and dimensions.
    const obstacles = calculateDrawingBounds(primitives.filter((p) => p.layer === 'geometry' || p.kind === 'dimension'))
    expect(a.maxX < obstacles.minX || a.minX > obstacles.maxX).toBe(true)
    expect(primitives.find((p) => p.id === `${texts[i].id}-leader`)).toMatchObject({ kind: 'polyline', layer: 'annotation' })
  }
}
function dxf(document: TechnicalDrawingDocument) {
  const current = project()
  const prepared = prepareTechnicalPlanDxf({ scope: 'current', projectName: current.name,
    candidates: [{ document, metadata: createTechnicalPlanDxfMetadata(current, document, date) }] })
  if (!prepared.ok) throw new Error(prepared.error.code)
  return generateTechnicalPlanDxf(prepared.value)
}
function dxfVertices(content: string, id: string) {
  const block = content.split(`Primitive: ${id}\r\n`)[1]?.split('999\r\nPrimitive: ')[0]
  if (!block) throw new Error(`Missing DXF primitive ${id}`)
  const pairs = block.trimEnd().split(/\r?\n/)
  const xs: number[] = [], ys: number[] = []
  for (let i = 0; i < pairs.length - 1; i += 2) {
    if (Number(pairs[i]) === 10) xs.push(Number(pairs[i + 1]))
    if (Number(pairs[i]) === 20) ys.push(Number(pairs[i + 1]))
  }
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

describe('goods development QA fixture', () => {
  it('loads a complete six-stop model with usable guides, drawings and ephemeral state', () => {
    const store = createProjectStore()
    store.getState().setLiftFamily('goods')
    expect(store.getState().project.configuration).not.toHaveProperty('guideSystem')
    loadDevelopmentGoodsFixture(store.getState())
    expect(store.getState().persistenceMode).toBe('development-demo')
    expect(model().status).toBe('complete')
    expect(validateGoodsLiftSpatialGeometry(model())).toMatchObject({ status: 'ok', issues: [] })
    expect(fixture.guideSystem!.spacingMm! > fixture.platformWidthMm!).toBe(true)
    expect(fixture.guideSystem!.spacingMm! < fixture.shaftWidthMm!).toBe(true)
    expect([fixture.pallet, fixture.rollContainer, fixture.forkliftEnvelope]
      .every((load) => load!.widthMm! <= fixture.doorWidthMm! && load!.heightMm! <= fixture.doorHeightMm!)).toBe(true)
    expect(drawings().every((drawing) => drawing.status === 'complete')).toBe(true)
    resetDevelopmentMechanicalFixture(store.getState())
    expect(store.getState().persistenceMode).toBe('project')
    expect(store.getState().project.configuration).not.toHaveProperty('guideSystem')
  })
  it('detects guides through the moving footprint, outside the shaft, and allows boundary contact', () => {
    for (const [spacing, status] of [[12, 'invalid'], [2700, 'invalid'], [1800, 'ok'], [2100, 'ok']] as const) {
      const result = validateGoodsLiftSpatialGeometry(model({ ...fixture, guideSystem: { orientation: 'x', spacingMm: mm(spacing) } }))
      expect(result.results.find((r) => r.ruleId === 'goods.guides.geometry')?.status).toBe(status)
    }
    expect(validateGoodsLiftSpatialGeometry(model({ ...fixture, guideSystem: undefined })).results
      .find((r) => r.ruleId === 'goods.guides.geometry')?.status).toBe('unknown')
  })
  it('places loads on the declared first elevation instead of absolute zero', () => {
    const normalized = model({ ...fixture, storeyHeightsMm: undefined,
      levelElevationsMm: [5000, 8000, 11000, 14000, 17000, 20000].map(mm) })
    expect(normalized.model.pallet?.minY).toBe(5000)
    expect(normalized.model.pallet?.maxY).toBe(6600)
    expect(createGoodsLiftSceneModel(normalized.model).assemblies.find((a) => a.id === 'goods-pallet')?.center[1]).toBe(5.8)
  })
  it('keeps missing load heights UNKNOWN and rejects explicit nonpositive optional dimensions', () => {
    expect(validateGoodsLiftSpatialGeometry(model({ ...fixture, pallet: { widthMm: mm(1200), depthMm: mm(800) } }))
      .results.find((r) => r.ruleId === 'goods.load.pallet-fit')?.status).toBe('unknown')
    expect(model({ ...fixture, pallet: { widthMm: mm(-1), depthMm: mm(800) } }).status).toBe('invalid')
    expect(model({ ...fixture, guideSystem: { orientation: 'x', spacingMm: mm(-1) } }).status).toBe('invalid')
    expect(validateGoodsLiftSpatialGeometry(model({ ...fixture, frontAccess: false, rearAccess: false, throughCar: false }))
      .results.find((r) => r.ruleId === 'goods.access.consistency')?.status).toBe('invalid')
  })
})

describe('goods geometry and camera QA', () => {
  it.each([2, 6, 10])('aligns every front/rear landing with %i explicit stops', (stopCount) => {
    const configuration = { ...fixture, stopCount, storeyHeightsMm: Array.from({ length: stopCount - 1 }, () => mm(3000)) }
    const scene = createGoodsLiftSceneModel(model(configuration).model)
    expect(scene.assemblies.filter((a) => a.kind === 'landing-door')).toHaveLength(stopCount * 2)
    expect(scene.assemblies.filter((a) => a.kind === 'landing-door').map((a) => a.center[1]))
      .toEqual(Array.from({ length: stopCount }, (_, i) => i * 3 + 1.1).flatMap((y) => [y]).concat(
        Array.from({ length: stopCount }, (_, i) => i * 3 + 1.1)))
    for (const mode of GOODS_LIFT_VIEW_MODES) {
      const frame = getGoodsLiftCameraFrame(scene, mode)
      expect(frame).toEqual(getGoodsLiftCameraFrame(scene, mode))
      for (const viewport of [{ width: 1280, height: 720 }, { width: 500, height: 900 }]) {
        const fit = calculateCameraFit(frame.bounds, frame.target, viewport, undefined, undefined, frame.direction)
        expect([...fit.position, ...fit.target, fit.distance, fit.near, fit.far].every(Number.isFinite)).toBe(true)
      }
    }
  })
  it('keeps platform and load inspection local when the tower grows', () => {
    const small = createGoodsLiftSceneModel(model({ ...fixture, stopCount: 2, storeyHeightsMm: [mm(3000)] }).model)
    const tall = createGoodsLiftSceneModel(model({ ...fixture, stopCount: 10, storeyHeightsMm: Array(9).fill(mm(3000)) }).model)
    expect(getGoodsLiftCameraFrame(small, 'platform')).toEqual(getGoodsLiftCameraFrame(tall, 'platform'))
    expect(getGoodsLiftCameraFrame(tall, 'platform').bounds.height).toBeCloseTo(2.76) // Explicit car hitch extends above the frame.
    expect(getGoodsLiftCameraFrame(tall, 'loads').bounds.height).toBeCloseTo(2.38)
    expect(getGoodsLiftCameraFrame(tall, 'overview').target).not.toEqual(getGoodsLiftCameraFrame(tall, 'platform').target)
  })
  it.each(['pallet', 'rollContainer', 'forkliftEnvelope'] as const)('renders only the explicit %s envelope', (key) => {
    const scene = createGoodsLiftSceneModel(model({ ...fixture, pallet: undefined, rollContainer: undefined,
      forkliftEnvelope: undefined, [key]: fixture[key] }).model)
    const loads = scene.assemblies.filter((a) => ['pallet', 'roll-container', 'forklift-envelope'].includes(a.kind))
    expect(loads).toHaveLength(1)
    const rendered = createGoodsLiftRenderModel(scene, 'loads')
    expect(rendered.assemblies.find((a) => a.id === loads[0].id)?.appearance.presentation).toBe('outline')
  })
  it('distinguishes all envelopes in the technical legend without solid volume fills', () => {
    const render = createGoodsLiftRenderModel(createGoodsLiftSceneModel(model().model), 'loads')
    expect(getGoodsLiftRenderLegend(render).map((l) => l.label)).toEqual(expect.arrayContaining([
      'Palettenhülle', 'Rollcontainer-Hülle', 'Gabelstapler-Hülle',
    ]))
    expect(new Set(render.assemblies.filter((a) => ['pallet', 'roll-container', 'forklift-envelope'].includes(a.kind))
      .map((a) => a.appearance.color)).size).toBe(3)
  })
})

describe('goods drawing and export QA', () => {
  it.each(['auto', '1:20', '1:25', '1:50', '1:100'] as const)('places distinct exterior labels with leaders at %s', (scale) => {
    for (const drawing of drawings(scale)) {
      expect(drawing).toEqual(drawings(scale).find((d) => d.id === drawing.id))
      verifyLabels(drawing.primitives)
      verifyLabels(createTechnicalDrawingPresentation(drawing).primitives)
    }
  })
  it('uses actual vertical rail-axis positions in the plan instead of full-depth rails', () => {
    const plan = createGoodsLiftPlanDrawing(context())
    const axis = plan.primitives.find((p) => p.id === 'goods-guide-a-x')
    expect(axis).toMatchObject({ kind: 'line', start: { x: -1085, y: 0 }, end: { x: -1015, y: 0 } })
    expect(technicalDxfLayerForPrimitive(axis!)).toBe('GUIDE_RAILS')
    for (const id of ['goods-pallet', 'goods-roll-container', 'goods-forklift-envelope']) {
      expect(technicalDxfLayerForPrimitive(plan.primitives.find((p) => p.id === id)!)).toBe('LOADS')
    }
    const planZ = createGoodsLiftPlanDrawing(context({ ...fixture, guideSystem: { orientation: 'z', spacingMm: mm(2600) } }))
    expect(planZ.primitives.find((p) => p.id === 'goods-guide-a-x')).toMatchObject({ start: { y: 1300 } })
  })
  it('ties dimensions to their exact distinct shaft/platform/door/guide geometry', () => {
    const plan = createGoodsLiftPlanDrawing(context())
    expect(Object.fromEntries(plan.primitives.filter((p) => p.kind === 'dimension').map((p) => [p.id, p.valueMm])))
      .toEqual({ 'goods-shaft-width': 2600, 'goods-shaft-depth': 3000, 'goods-platform-width': 1800,
        'goods-platform-depth': 2400, 'goods-door-width': 1600, 'goods-guide-spacing': 2100 })
  })
  it('routes annotation leaders around dimension text boxes', () => {
    for (const drawing of drawings('1:50').slice(0, 2)) {
      const presentation = createTechnicalDrawingPresentation(drawing)
      const dimensions = presentation.primitives.filter((p) => p.kind === 'dimension')
      for (const leader of presentation.primitives.filter((p) => p.kind === 'polyline' && p.id.endsWith('-leader'))) {
        if (leader.kind !== 'polyline') continue
        const a = leader.points[1], b = leader.points[2]
        for (const dimension of dimensions) {
          const size = dimension.textSizeMm ?? 2.5
          const halfWidth = dimension.label.length * size * 0.29
          const crosses = a.y >= dimension.labelPosition.y - size && a.y <= dimension.labelPosition.y + size * 0.3 &&
            Math.min(a.x, b.x) < dimension.labelPosition.x + halfWidth &&
            Math.max(a.x, b.x) > dimension.labelPosition.x - halfWidth
          expect(crosses).toBe(false)
        }
      }
    }
  })
  it('keeps vertical dimension text beside its dimension line', () => {
    for (const document of drawings('1:100')) {
      for (const p of createTechnicalDrawingPresentation(document).primitives) {
        if (p.kind !== 'dimension' || p.dimensionStart.x !== p.dimensionEnd.x) continue
        const halfWidth = p.label.length * (p.textSizeMm ?? 2.5) * 0.29
        expect(Math.abs(p.labelPosition.x - p.dimensionStart.x)).toBeGreaterThan(halfWidth)
      }
    }
  })
  it.each([900, 3600])('frames %i mm platforms locally with optional loads absent', (width) => {
    const scene = createGoodsLiftSceneModel(model({ ...fixture, platformWidthMm: mm(width),
      platformDepthMm: mm(width * 1.4), doorWidthMm: mm(width * 0.8),
      pallet: undefined, rollContainer: undefined, forkliftEnvelope: undefined, mechanical: undefined,drive:undefined,safety:undefined }).model)
    for (const mode of ['platform', 'loads'] as const) {
      const frame = getGoodsLiftCameraFrame(scene, mode)
      expect(frame.bounds.width).toBe(width / 1000)
      expect(frame.bounds.depth).toBe(width * 1.4 / 1000)
      expect(frame.target).toEqual(scene.assemblies.find((a) => a.kind === 'platform')?.center)
    }
  })
  it.each([2, 6, 10])('projects %i stops, openings, pit, headroom and storeys without duplicate labels', (stopCount) => {
    const ctx = context({ ...fixture, stopCount, storeyHeightsMm: Array.from({ length: stopCount - 1 }, () => mm(3000)) })
    const section = createGoodsLiftSectionDrawing(ctx)
    expect(section.primitives.filter((p) => p.id.match(/^goods-level-\d+-label$/))).toHaveLength(stopCount)
    expect(section.primitives.filter((p) => p.id.match(/^goods-landing-level-\d+-opening$/))).toHaveLength(stopCount)
    expect(section.primitives.find((p) => p.id === 'goods-pit-depth')).toMatchObject({ valueMm: 1000 })
    expect(section.primitives.find((p) => p.id === 'goods-headroom')).toMatchObject({ valueMm: 1500 })
    expect(section.primitives.filter((p) => p.id.startsWith('goods-storey-'))).toHaveLength(stopCount - 1)
  })
  it.each([2, 6, 10])('retains explicit A4 fit guards for %i stops at every fixed scale', (stopCount) => {
    const configuration = { ...fixture, stopCount, storeyHeightsMm: Array.from({ length: stopCount - 1 }, () => mm(3000)) }
    for (const scale of ['1:20', '1:25', '1:50', '1:100'] as const) {
      const document = createGoodsLiftSectionDrawing(context(configuration), scale)
      const candidate = { document, presentation: createTechnicalDrawingPresentation(document),
        metadata: createTechnicalPlanPdfMetadata(project(), document, scale, date) }
      const result = prepareTechnicalPlanPdf({ scope: 'current', scale, projectName: configuration.projectName, candidates: [candidate] })
      const expectedFit = (stopCount === 2 && (scale === '1:50' || scale === '1:100')) || (stopCount === 6 && scale === '1:100')
      expect(result.ok, JSON.stringify({ scale, result, bounds: candidate.presentation.completeBounds })).toBe(expectedFit)
      if (!result.ok) expect(result.error.code).toBe('drawing-does-not-fit')
    }
  })
  it('honors selected doors and never silently substitutes an unknown stop or unavailable side', () => {
    expect(createGoodsLiftDoorElevationDrawing(context(), { levelId: 'level-4', side: 'rear' }).id).toBe('goods-door-level-4-rear')
    expect(createGoodsLiftDoorElevationDrawing(context(), { levelId: 'missing' }).status).toBe('incomplete')
    expect(createGoodsLiftDoorElevationDrawing(context({ ...fixture, frontAccess: false, throughCar: false })).status).toBe('complete')
    expect(createGoodsLiftDoorElevationDrawing(context({ ...fixture, rearAccess: false, throughCar: false }), { side: 'rear' }).status)
      .toBe('incomplete')
  })
  it('prepares the complete six-stop plan set at 1:100 from the identical vector preview', () => {
    const prepared = prepareTechnicalPlanPdf({ scope: 'plan-set', scale: '1:100', projectName: fixture.projectName,
      candidates: drawings('1:100').map((document) => ({ document, presentation: createTechnicalDrawingPresentation(document),
        metadata: createTechnicalPlanPdfMetadata(project(), document, '1:100', date,
          document.view === 'door-elevation' ? { landing: 6, side: 'rear' } : undefined) })) })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error(prepared.error.code)
    expect(prepared.value.pages.map((p) => p.metadata.sheetNumber)).toEqual([1, 2, 3])
    for (const page of prepared.value.pages) {
      const svg = createTechnicalPlanPdfPageSvg(page)
      const preview = new DOMParser().parseFromString(renderToStaticMarkup(
        <TechnicalDrawingSvg document={page.document} presentation={page.presentation} sheet={page.metadata} />), 'image/svg+xml')
      expect(svg.querySelector('[data-technical-drawing-content]')?.textContent)
        .toBe(preview.querySelector('[data-technical-drawing-content]')?.textContent)
      expect(svg.querySelectorAll('[data-primitive-id]')).toHaveLength(page.presentation.primitives.length)
      expect(svg.querySelector('[data-paper-primitive-id="title-block"]')).not.toBeNull()
      expect(svg.querySelector('image,foreignObject,canvas')).toBeNull()
      expect(svg.querySelector('[transform*="scale"]')).toBeNull()
      expect(svg.querySelector('[data-primitive-id="goods-forklift-envelope-label"]')?.textContent ?? '').not.toContain('Staplerhülle')
    }
  })
  it.each(['1:20', '1:25', '1:50', '1:100'] as const)('preserves DXF geometry and physical paper scale at %s', (scale) => {
    const [plan, section, door] = drawings(scale)
    expect(dxfVertices(dxf(plan), 'goods-shaft')).toEqual({ width: 2600, height: 3000 })
    expect(dxfVertices(dxf(plan), 'goods-platform')).toEqual({ width: 1800, height: 2400 })
    expect(dxfVertices(dxf(door), 'goods-door-opening')).toEqual({ width: 1600, height: 2200 })
    const denominator = Number(scale.slice(2))
    expect(createTechnicalDrawingPresentation(plan).primitives.find((p) => p.id === 'goods-shaft'))
      .toMatchObject({ width: 2600 / denominator, height: 3000 / denominator })
    expect(createTechnicalDrawingPresentation(section).primitives.find((p) => p.id === 'goods-shaft-section'))
      .toMatchObject({ height: 19800 / denominator })
    expect(createTechnicalDrawingPresentation(door).primitives.find((p) => p.id === 'goods-door-opening'))
      .toMatchObject({ width: 1600 / denominator, height: 2200 / denominator })
    const before = createTechnicalDrawingPresentation(plan)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 420 })
    expect(createTechnicalDrawingPresentation(plan)).toEqual(before)
  })
})
