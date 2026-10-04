import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../../../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema } from '../../../../elevator'
import { COMPONENT_DATA_SOURCES } from '../../../../elevator/configuration/mechanical-component-data'
import { passengerSafetyDataSchema, type PassengerSafetyData } from '../../../../elevator/configuration/passenger-safety-data'
import { millimetres as mm } from '../../../../engineering'
import { createProjectStore } from '../../../../projects/project-store'
import { createLiftGeometryPlanningInput } from '../../lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../passenger-installation-model'
import { createMechanicalBounds, createPassengerMechanicalLayout } from './passenger-mechanical-layout'
import { drivePoint } from './drive-geometry'
import { createPassengerMechanicalComponents } from './mechanical-component-model'
import { createTractionDriveModel } from './traction-drive-model'
import { createPassengerSafetyModel } from './passenger-safety-model'
import { createSheaveGeometry, createTechnicalCableGeometry } from './traction-geometry'
import { getPassengerCameraBounds } from '../../../camera/passenger-camera-bounds'
import { getPassengerViewVisibility, PASSENGER_VIEW_MODE_CATALOG, THREE_VIEW_MODES } from '../../../scene/view-mode'

function setup(arrangement: 'rear' | 'left' | 'right' = 'rear') {
  const configuration = createPassengerMechanicalFixture(arrangement)
  const input = createLiftGeometryPlanningInput(configuration)!
  const result = createPassengerInstallationModel(input)
  if (!('model' in result) || !result.model) throw new Error('Expected installation')
  const installation = result.model, layout = createPassengerMechanicalLayout(input, installation)
  const components = createPassengerMechanicalComponents(input.mechanical.components, layout)
  const drive = createTractionDriveModel(input.mechanical.drive, installation, layout, components)
  const data = input.mechanical.safety!
  const create = (safety: PassengerSafetyData | undefined) => createPassengerSafetyModel(safety, installation, layout, components, drive.machine)
  return { configuration, installation, layout, components, drive, data, create, model: create(data) }
}
const point = (x: number, y: number, z: number) => ({ xMm: mm(x), yMm: mm(y), zMm: mm(z) })
const hasIssue = (model: ReturnType<typeof createPassengerSafetyModel>, code: string) => model.validation.issues.some((i) => i.code === code)

describe('explicit generic passenger safety geometry', () => {
  it.each(['rear', 'left', 'right'] as const)('normalizes the %s development fixture without safety engineering', (arrangement) => {
    const { configuration, model } = setup(arrangement)
    expect(passengerPlanningConfigurationSchema.safeParse(configuration).success).toBe(true)
    expect(model.validation).toEqual({ state: 'valid', issues: [] })
    expect(model.missingData).toEqual([])
    expect(model.governor?.wheel.role).toBe('governor')
    expect(model.tension?.wheel.role).toBe('tension')
    expect(model.gears).toHaveLength(2)
    expect(model.linkage).toBeDefined()
    expect(model.governorRope).toBeDefined()
    expect(model.machineBrake).toBeDefined()
  })

  it('keeps governor, tension, gears, linkage and rope independent of traction suspension', () => {
    const { data, model, installation, layout, components } = setup()
    const independent = createPassengerSafetyModel({ ...data, machineBrake: undefined }, installation, layout, components)
    expect(independent.governor).toEqual(model.governor)
    expect(independent.tension).toEqual(model.tension)
    expect(independent.gears).toEqual(model.gears)
    expect(independent.linkage).toEqual(model.linkage)
    expect(independent.governorRope).toEqual(model.governorRope)
    expect(independent.machineBrake).toBeUndefined()
    expect(independent.validation.state).toBe('valid')
  })

  it('creates finite, non-degenerate reusable wheel geometry', () => {
    const { model } = setup()
    for (const wheel of [model.governor!.wheel, model.tension!.wheel, model.machineBrake!.wheel]) {
      const geometry = createSheaveGeometry(wheel), positions = geometry.getAttribute('position'), indices = geometry.index!
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true)
      expect(geometry.boundingBox!.max.z).toBeCloseTo(wheel.hubWidth / 2)
      for (let i = 0; i < indices.count; i += 3) {
        const vertices = [0, 1, 2].map((j) => { const k = indices.getX(i + j); return [positions.getX(k), positions.getY(k), positions.getZ(k)] })
        const a = vertices[1].map((v, j) => v - vertices[0][j]), b = vertices[2].map((v, j) => v - vertices[0][j])
        expect(Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])).toBeGreaterThan(0)
      }
      geometry.dispose()
    }
  })

  it('requires explicit rope diameter and route while unrelated components remain visible', () => {
    const { data, create } = setup()
    for (const key of ['diameterMm', 'route'] as const) {
      const model = create({ ...data, governorRope: { ...data.governorRope!, [key]: undefined } })
      expect(model.governorRope).toBeUndefined()
      expect(model.governor).toBeDefined()
      expect(model.gears).toHaveLength(2)
      expect(model.validation.state).toBe('incomplete')
    }
    expect(create({ ...data, governor: undefined }).governorRope).toBeUndefined()
    expect(create({ ...data, tension: undefined }).governorRope).toBeUndefined()
  })

  it('uses a closed, tangent, separately dimensioned loop with top and bottom contacts', () => {
    const { model, drive } = setup()
    const rope = model.governorRope!
    expect(rope.closed).toBe(true)
    expect(rope.contacts).toEqual(['governor', 'tension'])
    expect(rope.linkageId).toBe(model.linkage!.id)
    expect(rope.diameter).toBe(0.006)
    expect(rope.points.at(-1)).toEqual(rope.points[0])
    expect(rope.segments.filter((s) => s.kind === 'arc').map((s) => s.sheaveId)).toEqual(['governor-wheel', 'tension-wheel'])
    expect(rope.segments).not.toEqual(drive.suspension!.ropes[0].segments)
    expect(model.tension!.wheel.id).not.toBe(drive.sheaves[0].id)
    expect(model.tension!.wheel.role).not.toBe(drive.sheaves[0].role)
    expect(model.tension!.bounds.max[1]).toBeLessThan(0)
    expect(model.tension!.boxes.some((b) => b.id === 'tension-tension-device')).toBe(true)
    const geometry = createTechnicalCableGeometry(rope)
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
    expect(geometry.getAttribute('position').count).toBeLessThan(1200)
    geometry.dispose()
  })

  it('aligns two distinct generic gears with their own car rails and external sling faces', () => {
    const { model, components } = setup()
    expect(model.gears.map((g) => g.side)).toEqual(['left', 'right'])
    expect(new Set(model.gears.map((g) => g.railId)).size).toBe(2)
    for (const gear of model.gears) {
      const rail = components.carRails!.find((r) => r.id === gear.railId)!
      expect(gear.railAxis[0]).toBe(rail.origin[0])
      expect(gear.railAxis[2]).toBe(rail.origin[2])
      expect(gear.rotationY).toBe(rail.rotationY)
      expect(gear.kind).toBe('generic')
      expect(gear.bounds.max[1]).toBeLessThan(0)
      expect(Math.abs(gear.mountPoint[0])).toBeCloseTo(components.carSling!.bounds.max[0])
    }
  })

  it('creates deterministic explicit linkage connections and does not duplicate shared rods', () => {
    const { model, data, create } = setup()
    expect(create(data).linkage).toEqual(model.linkage)
    expect(model.linkage!.paths).toHaveLength(2)
    expect(model.linkage!.rods).toHaveLength(7)
    for (const path of model.linkage!.paths) {
      expect(path.points[0]).toEqual(model.gears.find((g) => g.id === path.gearId)!.linkagePoint)
      expect(path.points.at(-1)).toEqual(model.linkage!.ropeConnection)
    }
    for (const rod of model.linkage!.rods) {
      expect(rod.length).toBeGreaterThan(0)
      expect([...rod.center, ...rod.rotation].every(Number.isFinite)).toBe(true)
    }
  })

  it('also derives gear transforms from a Z-oriented car rail/frame pair', () => {
    const { configuration, data } = setup()
    const input = createLiftGeometryPlanningInput({ ...configuration, cabinWidthMm: mm(1400), cabinDepthMm: mm(1100),
      mechanical: { ...configuration.mechanical, carRailOrientation: 'z' } })!
    const result = createPassengerInstallationModel(input)
    if (!('model' in result) || !result.model) throw new Error('Expected installation')
    const layout = createPassengerMechanicalLayout(input, result.model)
    const components = createPassengerMechanicalComponents(input.mechanical.components, layout)
    const model = createPassengerSafetyModel({ gears: data.gears }, result.model, layout, components)
    expect(model.validation.issues).toEqual([])
    expect(model.gears).toHaveLength(2)
    expect(model.gears[0].railAxis[2]).toBeLessThan(model.gears[1].railAxis[2])
    expect(model.gears[0].rotationY).toBe(0)
    expect(model.gears[1].rotationY).toBe(Math.PI)
  })

  it('rejects structural non-finite dimensions, missing provenance and zero-length route data', () => {
    const { data } = setup()
    const route = [{ kind: 'point', positionMm: point(0, 0, 0) }, { kind: 'point', positionMm: point(0, 0, 0) }, { kind: 'linkage', linkageId: 'governor-linkage' }]
    for (const patch of [
      { governor: { ...data.governor!, source: undefined } },
      { governor: { ...data.governor!, wheel: { ...data.governor!.wheel, diameterMm: NaN } } },
      { governorRope: { ...data.governorRope!, diameterMm: Infinity } },
      { governorRope: { ...data.governorRope!, route: [{ kind: 'point', positionMm: point(NaN, 0, 0) }, ...data.governorRope!.route!] } },
      { governorRope: { ...data.governorRope!, route } },
      { governorRope: { ...data.governorRope!, route: [{ kind: 'contact', wheel: 'governor', entryAngleRad: 0, exitAngleRad: 0 }, ...data.governorRope!.route!.slice(1)] } },
    ]) expect(passengerSafetyDataSchema.safeParse({ ...data, ...patch }).success).toBe(false)
  })

  it('rejects non-positive wheel/rope sizes and invalid spatial data even without Zod', () => {
    const { data, create } = setup()
    for (const diameterMm of [mm(0), mm(-6), mm(NaN)]) {
      expect(hasIssue(create({ ...data, governorRope: { ...data.governorRope!, diameterMm } }), 'invalid-governor-rope')).toBe(true)
      expect(hasIssue(create({ ...data, governor: { ...data.governor!, wheel: { ...data.governor!.wheel, diameterMm } } }), 'invalid-safety-shape')).toBe(true)
    }
    const wrongAxis = create({ ...data, governor: { ...data.governor!, wheel: { ...data.governor!.wheel, rotationYRad: 0 } } })
    expect(wrongAxis.governorRope).toBeUndefined()
    expect(wrongAxis.validation.state).not.toBe('valid')
    const outside = create({ ...data, tension: { ...data.tension!, wheel: { ...data.tension!.wheel, originMm: point(0, -1600, 1150) } } })
    expect(outside.tension).toBeUndefined()
  })

  it('rejects floating wheel mounts, invalid rail references, duplicate or detached gears', () => {
    const { data, create } = setup()
    const floating = create({ ...data, governor: { ...data.governor!, supports: [] } })
    expect(hasIssue(floating, 'unmounted-safety-wheel')).toBe(true)
    expect(hasIssue(create({ ...data, gears: [{ ...data.gears![0], railId: 'counterweight-rail-1' }] }), 'missing-safety-rail')).toBe(true)
    expect(hasIssue(create({ ...data, gears: [data.gears![0], data.gears![0]] }), 'duplicate-safety-gear')).toBe(true)
    expect(hasIssue(create({ ...data, gears: [{ ...data.gears![0], elevationMm: mm(3000) }, data.gears![1]] }), 'detached-safety-gear')).toBe(true)
    expect(hasIssue(create({ ...data, gears: [{ ...data.gears![0], railId: data.gears![1].railId }] }), 'missing-safety-rail')).toBe(true)
    expect(hasIssue(create({ ...data, gears: [{ ...data.gears![0], kind: 'progressive' }] }), 'unsupported-safety-gear')).toBe(true)
  })

  it('rejects disconnected linkage, geometrically collapsed rope segments and non-tangent loops', () => {
    const { data, create, model } = setup()
    const paths = data.linkage!.paths!
    expect(hasIssue(create({ ...data, linkage: { ...data.linkage!, paths: [{ ...paths[0], pointsMm: [point(0, 0, 0), ...paths[0].pointsMm.slice(1)] }, paths[1]] } }), 'invalid-safety-linkage')).toBe(true)
    const route = data.governorRope!.route!
    const start = model.governorRope!.points[0].map((v) => v * 1000)
    expect(hasIssue(create({ ...data, governorRope: { ...data.governorRope!, route: [...route, { kind: 'point', positionMm: point(start[0], start[1], start[2]) }] } }), 'zero-length-safety-route')).toBe(true)
    expect(hasIssue(create({ ...data, governorRope: { ...data.governorRope!, route: [{ kind: 'contact', wheel: 'governor', entryAngleRad: 2, exitAngleRad: 0 }, ...route.slice(1)] } }), 'non-tangent-safety-route')).toBe(true)
  })

  it('requires explicit brake geometry and coherent mounting on the supplied machine shaft', () => {
    const { data, create, model, installation, layout, components } = setup()
    expect(create({ ...data, machineBrake: undefined }).machineBrake).toBeUndefined()
    const missingMachine = createPassengerSafetyModel(data, installation, layout, components)
    expect(missingMachine.machineBrake).toBeUndefined()
    expect(missingMachine.missingData).toContain('mechanical.safety.machineBrake.machine')
    expect(hasIssue(create({ ...data, machineBrake: { ...data.machineBrake!, machineMountPartId: 'missing-base' } }), 'invalid-machine-brake')).toBe(true)
    expect(hasIssue(create({ ...data, machineBrake: { ...data.machineBrake!, wheel: { ...data.machineBrake!.wheel, rotationYRad: 0 } } }), 'invalid-machine-brake')).toBe(true)
    expect(model.machineBrake!.wheel.role).toBe('brake')
    expect(model.machineBrake!.kind).toBe('generic')
    expect(model.machineBrake!.wheel.id).not.toBe(model.governor!.wheel.id)
  })

  it('rejects non-finite paths and a loop crossing a proven cabin solid', () => {
    const { data, create, installation, layout, components } = setup()
    const invalid = create({ ...data, governorRope: { ...data.governorRope!, route: [
      ...data.governorRope!.route!, { kind: 'point', positionMm: point(Infinity, 0, 0) },
    ] } })
    expect(hasIssue(invalid, 'invalid-governor-rope')).toBe(true)
    expect(invalid.governorRope).toBeUndefined()
    // A deliberately supplied cabin envelope occupies the loop's car-side leg in this isolated clipping test.
    const cabinBounds = createMechanicalBounds([drivePoint(0, 0, 0.9), drivePoint(0.5, 2, 1)])
    const crossed = createPassengerSafetyModel({ ...data, machineBrake: undefined }, installation,
      { ...layout, carFrame: { ...layout.carFrame!, cabinBounds } }, components)
    expect(hasIssue(crossed, 'safety-rope-intersects-solid')).toBe(true)
    expect(crossed.governorRope).toBeUndefined()
  })

  it.each(COMPONENT_DATA_SOURCES)('preserves explicit %s provenance throughout normalization', (source) => {
    const { data, create } = setup()
    const model = create({ ...data,
      governor: { ...data.governor!, source, reference: 'explicit', wheel: { ...data.governor!.wheel, source } },
      tension: { ...data.tension!, source, wheel: { ...data.tension!.wheel, source } },
      gears: data.gears!.map((g) => ({ ...g, source })), linkage: { ...data.linkage!, source },
      governorRope: { ...data.governorRope!, source }, machineBrake: { ...data.machineBrake!, source, wheel: { ...data.machineBrake!.wheel, source } },
    })
    expect(model.governor!.source).toBe(source)
    expect(model.governor!.wheel.source).toBe(source)
    expect(model.governor!.reference).toBe('explicit')
    expect(model.tension!.source).toBe(source)
    expect(model.gears.every((g) => g.source === source && g.boxes.every((b) => b.source === source))).toBe(true)
    expect(model.linkage!.rods.every((r) => r.source === source)).toBe(true)
    expect(model.governorRope!.source).toBe(source)
    expect(model.machineBrake!.source).toBe(source)
  })

  it('keeps production creation/reset empty and never implicitly applies demo safety data', () => {
    expect(createPassengerPlanningConfiguration('Normal').mechanical).toBeUndefined()
    const { create } = setup()
    const empty = create(undefined)
    expect(empty.bounds).toBeUndefined()
    expect(empty.gears).toEqual([])
    expect(empty.governorRope).toBeUndefined()
    const store = createProjectStore()
    store.getState().createProject({ projectName: 'Normal', liftFamily: 'passenger' })
    expect(store.getState().project!.configuration).not.toHaveProperty('mechanical')
    store.getState().resetProject()
    expect(store.getState().project!.configuration).not.toHaveProperty('mechanical')
  })

  it('frames top governor, middle sling/linkage and pit tension in safety mode without fixture camera coordinates', () => {
    const { model, components, drive } = setup()
    const bounds = getPassengerCameraBounds('safety', components, drive, model)
    for (const part of [model.governor!, model.tension!, model.linkage!, model.machineBrake!, ...model.gears]) {
      for (let i = 0; i < 3; i++) {
        expect(bounds.min[i]).toBeLessThanOrEqual(part.bounds.min[i])
        expect(bounds.max[i]).toBeGreaterThanOrEqual(part.bounds.max[i])
      }
    }
    for (const mode of THREE_VIEW_MODES.filter((m) => m !== 'drive')) {
      const frame = getPassengerCameraBounds(mode, components, drive, model)
      expect(frame.min[1]).toBeLessThanOrEqual(model.bounds!.min[1])
      expect(frame.max[1]).toBeGreaterThanOrEqual(model.bounds!.max[1])
    }
    expect(PASSENGER_VIEW_MODE_CATALOG.find((v) => v.id === 'safety')?.implemented).toBe(true)
    const visibility = getPassengerViewVisibility('safety')
    expect(visibility.cabinShellOpacity).toBeLessThan(0.1)
    expect(visibility.shaftEnvelopeOpacity).toBe(0)
    expect(visibility.mechanicalOpacity).toBe(1)
    expect(visibility.showCounterweight).toBe(false)
    expect(visibility.showTractionRopes).toBe(false)
  })
})
