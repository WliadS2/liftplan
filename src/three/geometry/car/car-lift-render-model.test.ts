// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createCarLiftQaFixture } from '../../../dev/fixtures/car-lift-qa-fixture'
import { createCarLiftNormalizedModel, createCarLiftSceneModel, createCenteredVehiclePosition, type CarLiftPlanningConfiguration } from '../../../elevator'
import { validateCarLiftSpatialGeometry } from '../../../collision/car-lift-spatial-validation'
import { millimetres as mm } from '../../../engineering'
import { getCarAssemblyBounds, getCarLiftCameraFrame, getCarLiftCameraInstallationKey } from '../../camera/car-lift-camera'
import { calculateCameraFit } from '../../camera/camera-fit'
import { CAR_LIFT_VIEW_MODE_CATALOG, createCarLiftRenderModel } from './car-lift-render-model'
import { createCarLiftDrawingContext, createCarLiftPlanDrawing, createCarLiftSectionDrawing, createCarLiftDoorElevationDrawing } from '../../../drawings/car-lift-technical-drawings'
import { createTechnicalDrawingPresentation } from '../../../drawings/technical-drawing'
import { prepareTechnicalPlanPdf, createTechnicalPlanPdfMetadata } from '../../../documents/technical-plan-pdf'
import { prepareTechnicalPlanDxf, createTechnicalPlanDxfMetadata } from '../../../documents/technical-plan-dxf'
import { generateTechnicalPlanDxf } from '../../../documents/technical-plan-dxf-renderer'
import { createLiftPlanProject, replaceProjectConfiguration } from '../../../projects'

function data(update: Partial<CarLiftPlanningConfiguration> = {}) {
  const configuration = { ...createCarLiftQaFixture(), ...update }
  const normalized = createCarLiftNormalizedModel(configuration)
  if (normalized.status === 'empty') throw new Error('Expected QA geometry')
  return { configuration, normalized, model: normalized.model, scene: createCarLiftSceneModel(normalized.model) }
}
function sceneBox(id: string, update: Partial<CarLiftPlanningConfiguration> = {}) {
  const a = data(update).scene.assemblies.find((a) => a.id === id)
  if (!a || !('center' in a)) throw new Error(`Expected box ${id}`)
  return a
}

describe('Autoaufzug scene and presentation', () => {
  it('creates a complete valid QA baseline without manual edits', () => {
    const { normalized } = data()
    expect(normalized.status).toBe('complete')
    expect(validateCarLiftSpatialGeometry(normalized)).toMatchObject({ status: 'ok', issues: [] })
    expect(sceneBox('car-platform').size).toEqual([2.8, 2.4, 5.6])
    expect(sceneBox('car-shaft').size).toEqual([3.2, 18.8, 6.2])
    expect(sceneBox('car-pit').size[1]).toBe(1)
    expect(sceneBox('car-headroom').size[1]).toBeCloseTo(1.4)
    expect(sceneBox('car-platform-floor').center[1]).toBe(0)
    expect(data().scene.assemblies.filter((a) => a.kind === 'guide')).toHaveLength(2)
  })
  it.each([2, 6, 10])('renders actual levels and both landing openings at %i stops', (stopCount) => {
    const { model, scene } = data({ stopCount, storeyHeightsMm: Array.from({ length: stopCount - 1 }, () => mm(2800)) })
    expect(scene.assemblies.filter((a) => a.kind === 'level')).toHaveLength(stopCount)
    expect(scene.assemblies.filter((a) => a.kind === 'landing-door')).toHaveLength(stopCount * 2)
    model.levels.forEach((level) => {
      for (const side of ['front', 'rear']) {
        const door = scene.assemblies.find((a) => a.id === `car-landing-${level.id}-${side}`)!
        expect('center' in door && door.center).toEqual([0, (level.elevationMm + 1150) / 1000, side === 'front' ? 3.1 : -3.1])
      }
    })
  })
  it('shows exact vehicle dimensions and all four domain-derived contacts', () => {
    const { model, scene } = data()
    expect(sceneBox('car-vehicle-body')).toMatchObject({ size: [1.8, 1.6, 4.5], center: [0, 0.8, 0], headingDegrees: 0 })
    const wheels = scene.assemblies.filter((a) => a.kind === 'wheel-contact')
    expect(wheels).toHaveLength(4)
    expect(wheels.map((a) => 'center' in a && a.center)).toEqual(model.vehicle!.wheelContactPoints!.map((p) => [p.x / 1000, 0, p.z / 1000]))
    expect(model.vehicle!.wheelContactPoints).toEqual([
      { x: -750, z: -1350 }, { x: 750, z: -1350 }, { x: -750, z: 1350 }, { x: 750, z: 1350 },
    ])
    expect(4500 / 2 - model.vehicle!.wheelContactPoints![2].z).toBe(900)
    expect(model.vehicle!.wheelContactPoints![0].z + 4500 / 2).toBe(900)
  })
  it.each([0, 90, 180])('copies the domain pose and rotation-aware bounds at %i degrees', (headingDegrees) => {
    const { model, scene } = data({ vehiclePosition: { longitudinalOffsetMm: mm(200), lateralOffsetMm: mm(-100), headingDegrees } })
    const body = scene.assemblies.find((a) => a.kind === 'vehicle-body')!
    expect('center' in body && body.center).toEqual([-0.1, 0.8, 0.2])
    expect('headingDegrees' in body && body.headingDegrees).toBe(headingDegrees)
    const bounds = getCarAssemblyBounds([body])
    expect(bounds.min[0]).toBeCloseTo(model.vehicle!.bounds!.minX / 1000)
    expect(bounds.max[2]).toBeCloseTo(model.vehicle!.bounds!.maxZ / 1000)
  })
  it('retains asymmetric overhangs and changed track/wheelbase through the normalized contact points', () => {
    const { model, scene } = data({ vehicle: { ...createCarLiftQaFixture().vehicle!, rearOverhangMm: mm(800),
      frontOverhangMm: mm(1100), wheelbaseMm: mm(2600), trackWidthMm: mm(1400) } })
    const points = model.vehicle!.wheelContactPoints!
    expect(points[0]).toEqual({ x: -700, z: -1450 })
    expect(points[3]).toEqual({ x: 700, z: 1150 })
    expect(2250 - points[3].z).toBe(1100)
    expect(points[3].z - points[0].z).toBe(2600)
    expect(scene.assemblies.filter((a) => a.kind === 'wheel-contact').map((a) => 'center' in a && a.center))
      .toEqual(points.map((p) => [p.x / 1000, 0, p.z / 1000]))
  })
  it('uses centered helper results without a separate renderer centering decision', () => {
    expect(sceneBox('car-vehicle-body', { vehiclePosition: createCenteredVehiclePosition(180) }).center).toEqual([0, 0.8, 0])
  })
  it('retains optional wheel/approach absence instead of inventing data', () => {
    const { scene } = data({ vehicle: { widthMm: mm(1800), lengthMm: mm(4500), heightMm: mm(1600) },
      entryApproachEnvelope: undefined, exitApproachEnvelope: undefined, vehicleSweptEnvelope: undefined, doorPassageEnvelope: undefined })
    expect(scene.assemblies.some((a) => a.kind === 'wheel-contact' || a.kind.includes('approach') || a.kind.includes('passage'))).toBe(false)
  })
  it.each([
    { frontAccess: true, rearAccess: false, throughCar: false, side: 'front' },
    { frontAccess: false, rearAccess: true, throughCar: false, side: 'rear' },
  ])('uses only configured access for $side-only doors and passage', ({ side, ...update }) => {
    const { scene } = data(update)
    expect(scene.assemblies.filter((a) => a.kind === 'door').map((a) => a.id)).toEqual([`car-${side}`])
    expect(scene.assemblies.filter((a) => a.kind === 'door-passage-envelope').map((a) => a.id)).toEqual([`car-door-passage-envelope-${side}`])
    expect(sceneBox(`car-${side}`, update).size).toEqual([2.6, 2.3, 0])
  })
  it('preserves independent normalized front/rear door dimensions', () => {
    const { model } = data()
    const scene = createCarLiftSceneModel({ ...model, entrances: model.entrances.map((e) => e.side === 'rear'
      ? { ...e, clearWidthMm: mm(2200), clearHeightMm: mm(2000) } : e) })
    const rear = scene.assemblies.find((a) => a.id === 'car-rear')!
    expect('size' in rear && rear.size).toEqual([2.2, 2, 0])
  })
  it('renders entry/exit and explicit sweep, plus passage on both configured sides', () => {
    expect(sceneBox('car-entry-approach')).toMatchObject({ size: [2.4, 2.1, 3], center: [0, 1.05, 4.3] })
    expect(sceneBox('car-exit-approach').center[2]).toBe(-4.3)
    expect(sceneBox('car-vehicle-sweep').size).toEqual([2, 1.8, 4.7])
    expect(sceneBox('car-door-passage-envelope-front').center[2]).toBe(3.55)
    expect(sceneBox('car-door-passage-envelope-rear').center[2]).toBe(-3.55)
  })
  it('uses explicit elevated platform datum for vehicle, contact, passage and level geometry', () => {
    const update = { storeyHeightsMm: undefined, levelElevationsMm: [mm(5000), mm(7800)], stopCount: 2 }
    expect(sceneBox('car-platform-floor', update).center[1]).toBe(5)
    expect(sceneBox('car-wheel-contact-1', update).center[1]).toBe(5)
    expect(sceneBox('car-vehicle-body', update).center[1]).toBe(5.8)
    expect(sceneBox('car-door-passage-envelope-front', update).center[1]).toBe(6.05)
  })
  it('distinguishes loading direction from vehicle heading', () => {
    const { scene } = data({ vehicleLoadingDirection: 'shaft-x' })
    const axis = scene.assemblies.find((a) => a.kind === 'loading-direction')!
    expect('start' in axis && axis.start).toEqual([-1.4, 0, 0])
    expect('end' in axis && axis.end).toEqual([1.4, 0, 0])
  })
  it.each([
    { vehicle: { ...createCarLiftQaFixture().vehicle!, widthMm: mm(3500) } },
    { vehicle: { ...createCarLiftQaFixture().vehicle!, lengthMm: mm(6500) } },
    { vehicle: { ...createCarLiftQaFixture().vehicle!, heightMm: mm(3000) } },
    { doorClearWidthMm: mm(1500) },
    { vehiclePosition: { ...createCenteredVehiclePosition(), lateralOffsetMm: mm(2000) } },
  ])('keeps geometrically conflicting inputs visible: %j', (update) => {
    const { normalized, scene } = data(update)
    expect(validateCarLiftSpatialGeometry(normalized).status).toBe('invalid')
    expect(createCarLiftRenderModel(scene, 'overview').assemblies.some((a) => a.kind === 'vehicle-body')).toBe(true)
  })
})

describe('Auto camera and export regressions', () => {
  it('makes platform and vehicle presentation and camera intent distinct', () => {
    const { scene } = data()
    const platform = createCarLiftRenderModel(scene, 'platform'), vehicle = createCarLiftRenderModel(scene, 'vehicle')
    const body = (m: typeof vehicle) => m.assemblies.find((a) => a.kind === 'vehicle-body')!
    expect(body(vehicle).appearance.presentation).toBe('surface')
    expect(body(vehicle).appearance.opacity).toBeGreaterThan(body(platform).appearance.opacity)
    expect(vehicle.assemblies.some((a) => a.kind === 'platform-wall')).toBe(false)
    expect(platform.assemblies.some((a) => a.kind === 'platform-wall')).toBe(true)
    expect(getCarLiftCameraFrame(scene, 'vehicle').bounds.height).toBeLessThan(getCarLiftCameraFrame(scene, 'platform').bounds.height)
    expect(getCarLiftCameraFrame(scene, 'vehicle').direction).not.toEqual(getCarLiftCameraFrame(scene, 'platform').direction)
  })
  it.each([0, 90, 180])('derives axle and dimension references only from normalized contacts at %i degrees', (headingDegrees) => {
    const { scene } = data({ vehiclePosition: { lateralOffsetMm: mm(100), longitudinalOffsetMm: mm(200), headingDegrees } })
    const contacts = scene.assemblies.filter((a) => a.kind === 'wheel-contact')
    const rear = scene.assemblies.find((a) => a.id === 'car-rear-axle')!, front = scene.assemblies.find((a) => a.id === 'car-front-axle')!
    expect('start' in rear && rear.start).toEqual('center' in contacts[0] && contacts[0].center)
    expect('end' in front && front.end).toEqual('center' in contacts[3] && contacts[3].center)
    const render = createCarLiftRenderModel(scene, 'vehicle')
    expect(render.assemblies.filter((a) => a.kind === 'vehicle-reference').map((a) => 'label' in a && a.label))
      .toEqual(['Radstand 2700 mm','Überhang hinten 900 mm','Vorne · Überhang 900 mm','Spurbreite 1500 mm'])
    expect(render.assemblies.filter((a) => a.kind === 'vehicle-axle')).toHaveLength(2)
  })
  it('retains all approach envelopes with distinct hierarchy without dominating the full-height section', () => {
    const { scene } = data()
    const approach = createCarLiftRenderModel(scene, 'approach')
    expect(approach.assemblies.every((a) => ['approach-envelope', 'vehicle-swept-envelope', 'door-passage-envelope'].includes(a.kind))).toBe(true)
    const entry = approach.assemblies.find((a) => a.id === 'car-entry-approach')!, exit = approach.assemblies.find((a) => a.id === 'car-exit-approach')!
    expect(entry.appearance).not.toEqual(exit.appearance)
    expect(approach.assemblies.filter((a) => a.kind === 'door-passage-envelope')).toHaveLength(2)
    expect(approach.assemblies.some((a) => a.kind === 'vehicle-swept-envelope')).toBe(true)
    const section = createCarLiftRenderModel(scene, 'cutaway')
    expect(section.assemblies.some((a) => a.kind === 'approach-envelope')).toBe(false)
    expect(section.assemblies.some((a) => a.kind === 'vehicle-swept-envelope')).toBe(false)
    const shaft = section.assemblies.find((a) => a.kind === 'shaft')!
    expect(shaft.appearance.presentation).toBe('section')
    expect(shaft).toMatchObject(scene.assemblies.find((a) => a.kind === 'shaft')!)
    expect(createCarLiftRenderModel(scene, 'overview').assemblies.find((a) => a.kind === 'shaft')!.appearance.presentation).toBe('outline')
    expect(getCarLiftCameraFrame(scene, 'cutaway').direction).not.toEqual(getCarLiftCameraFrame(scene, 'overview').direction)
    expect(getCarLiftCameraFrame(scene,'cutaway').bounds.height).toBeCloseTo(18.8)
  })
  it.each([2, 6, 10])('fits finite deterministic semantic bounds in all views for %i stops', (stopCount) => {
    const { scene } = data({ stopCount, storeyHeightsMm: Array.from({ length: stopCount - 1 }, () => mm(2800)) })
    for (const { id } of CAR_LIFT_VIEW_MODE_CATALOG) {
      const frame = getCarLiftCameraFrame(scene, id)
      expect(frame).toEqual(getCarLiftCameraFrame(scene, id))
      expect([...frame.target, ...frame.bounds.min, ...frame.bounds.max].every(Number.isFinite)).toBe(true)
      for (const viewport of [{ width: 800, height: 600 }, { width: 360, height: 700 }]) {
        const fit = calculateCameraFit(frame.bounds, frame.target, viewport, undefined, undefined, frame.direction)
        expect(fit.position.every(Number.isFinite)).toBe(true)
      }
      if (id === 'vehicle' || id === 'platform' || id === 'approach') expect(frame.bounds.height).toBeLessThan(3)
    }
  })
  it('changes framing keys for pose, dimensions, approaches and shaft changes', () => {
    const { scene } = data()
    const key = getCarLiftCameraInstallationKey(scene)
    for (const update of [
      { vehiclePosition: createCenteredVehiclePosition(90) }, { shaftWidthMm: mm(4000) },
      { platformDepthMm: mm(6000) }, { vehicle: { ...createCarLiftQaFixture().vehicle!, widthMm: mm(2000) } },
      { entryApproachEnvelope: { ...createCarLiftQaFixture().entryApproachEnvelope!, longitudinalOffsetMm: mm(6000) } },
    ]) expect(getCarLiftCameraInstallationKey(data(update).scene)).not.toBe(key)
  })
  it('prepares all three deterministic drawing types and vector exports without a second geometry system', () => {
    const configuration = createCarLiftQaFixture()
    const context = createCarLiftDrawingContext(configuration)!
    const documents = [createCarLiftPlanDrawing(context, '1:100'), createCarLiftSectionDrawing(context, '1:100'),
      createCarLiftDoorElevationDrawing(context, { levelId: 'level-6', side: 'rear' }, '1:100')]
    expect(documents.every((d) => d.status === 'complete')).toBe(true)
    expect(createCarLiftPlanDrawing(context, '1:100')).toEqual(documents[0])
    expect(createCarLiftSectionDrawing(context, '1:100')).toEqual(documents[1])
    const date = new Date('2026-10-06T12:00:00Z')
    const project = replaceProjectConfiguration(createLiftPlanProject({ liftFamily: 'car' }), configuration, date.toISOString()).project
    const pdf = prepareTechnicalPlanPdf({ scope: 'plan-set', scale: '1:100', projectName: project.name, candidates: documents.map((document) => ({
      document, presentation: createTechnicalDrawingPresentation(document), metadata: createTechnicalPlanPdfMetadata(project, document, '1:100', date),
    })) })
    expect(pdf.ok).toBe(true)
    const outputs = ['1:20', '1:25', '1:50', '1:100'].map((scale) => {
      const document = createCarLiftPlanDrawing(context, scale as '1:20')
      const dxf = prepareTechnicalPlanDxf({ scope: 'current', projectName: project.name, candidates: [{
        document, metadata: createTechnicalPlanDxfMetadata(project, document, date),
      }] })
      if (!dxf.ok) throw new Error(dxf.error.code)
      return generateTechnicalPlanDxf(dxf.value)
    })
    // Scale metadata comments differ; the model-space ENTITIES section must not.
    expect(new Set(outputs.map((s) => s.split('ENTITIES')[1])).size).toBe(1)
  })
})
