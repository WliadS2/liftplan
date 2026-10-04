import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../../../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema } from '../../../../elevator'
import { COMPONENT_DATA_SOURCES } from '../../../../elevator/configuration/mechanical-component-data'
import { tractionDriveDataSchema, type TractionDriveData } from '../../../../elevator/configuration/traction-drive-data'
import { millimetres as mm } from '../../../../engineering'
import { createProjectStore } from '../../../../projects/project-store'
import { createLiftGeometryPlanningInput } from '../../lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../passenger-installation-model'
import { createPassengerMechanicalLayout } from './passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from './mechanical-component-model'
import { componentBoxBounds } from './mechanical-component-model'
import { driveBoundsOverlap } from './drive-geometry'
import { createTractionDriveModel } from './traction-drive-model'
import { createSheaveModel, sheaveContactPoint } from './sheave-model'
import { createSheaveGeometry, createSuspensionRopeGeometry } from './traction-geometry'
import { getPassengerCameraBounds } from '../../../camera/passenger-camera-bounds'
import { getPassengerViewVisibility, PASSENGER_VIEW_MODE_CATALOG } from '../../../scene/view-mode'

function setup(arrangement: 'rear' | 'left' | 'right' = 'rear') {
  const configuration = createPassengerMechanicalFixture(arrangement)
  const input = createLiftGeometryPlanningInput(configuration)!
  const result = createPassengerInstallationModel(input)
  if (!('model' in result) || !result.model) throw new Error('Expected installation')
  const installation = result.model, layout = createPassengerMechanicalLayout(input, installation)
  const components = createPassengerMechanicalComponents(input.mechanical.components, layout)
  const data = input.mechanical.drive!
  const create = (driveData: TractionDriveData | undefined) => createTractionDriveModel(driveData, installation, layout, components)
  return { configuration, data, installation, layout, components, create, model: create(data) }
}
const point = (x: number, y: number, z: number) => ({ xMm: mm(x), yMm: mm(y), zMm: mm(z) })
function hasIssue(model: ReturnType<typeof createTractionDriveModel>, code: string) {
  return model.validation.issues.some((issue) => issue.code === code)
}

describe('explicit generic traction and suspension foundation', () => {
  it.each(['rear', 'left', 'right'] as const)('normalizes the %s demo without React, state or engineering claims', (arrangement) => {
    const { model, configuration } = setup(arrangement)
    expect(passengerPlanningConfigurationSchema.safeParse(configuration).success).toBe(true)
    expect(model.validation).toEqual({ state: 'valid', issues: [] })
    expect(model.machine?.boxes.map((b) => b.id)).toEqual(['machine-housing', 'machine-bearing-support', 'machine-base'])
    expect(model.machine?.cylinders).toHaveLength(2)
    expect(model.supports).toHaveLength(4)
    for (const member of [...model.supports, ...model.machine!.boxes]) {
      expect(driveBoundsOverlap(componentBoxBounds(member), model.sheaves[0].bounds)).toBe(false)
    }
    expect(model.suspension?.ropes).toHaveLength(4)
    expect(JSON.parse(JSON.stringify(model))).toMatchObject({ machine: { source: 'demo' } })
  })

  it('creates a finite, non-degenerate annular sheave with grooves and a local Z axis', () => {
    const { model } = setup()
    const sheave = model.sheaves[0]
    expect(sheave.axis[0]).toBeCloseTo(1)
    expect(sheave.axis[2]).toBeCloseTo(0)
    sheave.grooveOffsets.forEach((offset, i) => expect(offset).toBeCloseTo([-0.036, -0.012, 0.012, 0.036][i]))
    const geometry = createSheaveGeometry(sheave)
    expect(geometry.boundingBox?.max.z).toBeCloseTo(sheave.hubWidth / 2)
    expect(geometry.boundingBox?.max.x).toBeCloseTo(sheave.diameter / 2)
    const positions = geometry.getAttribute('position'), indices = geometry.index!
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true)
    for (let i = 0; i < indices.count; i += 3) {
      const vertices = [0, 1, 2].map((j) => { const k = indices.getX(i + j); return [positions.getX(k), positions.getY(k), positions.getZ(k)] })
      const a = vertices[1].map((v, j) => v - vertices[0][j]), b = vertices[2].map((v, j) => v - vertices[0][j])
      expect(Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])).toBeGreaterThan(0)
    }
    geometry.dispose()
    expect(setup('right').model.sheaves[0].axis).toEqual([0, 0, 1])
  })

  it('keeps ropes independent, deterministic, tangent and aligned with their own grooves', () => {
    const { model, create, data } = setup()
    const suspension = model.suspension!, sheave = model.sheaves[0]
    expect(suspension.ratio).toBe('1:1')
    expect(suspension.ropeCount).toBe(4)
    expect(suspension.ropeDiameter).toBe(0.01)
    expect(create(data).suspension).toEqual(suspension)
    expect(new Set(suspension.ropes.map((r) => r.points[0].join(','))).size).toBe(4)
    expect(new Set(suspension.ropes.map((r) => r.points)).size).toBe(4)
    for (const rope of suspension.ropes) {
      expect(rope.segments.map((s) => s.kind)).toEqual(['line', 'arc', 'line'])
      expect(rope.points.every((p) => p.every(Number.isFinite))).toBe(true)
      expect(rope.points[1]).toEqual(sheaveContactPoint(sheave, Math.PI, rope.laneOffset, rope.diameter))
      expect(rope.contacts).toEqual(['traction'])
      expect(rope.startHitchId).toBe('car-hitch')
      expect(rope.endHitchId).toBe('counterweight-hitch')
      const geometry = createSuspensionRopeGeometry(rope)
      expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
      expect(geometry.getAttribute('position').count).toBeLessThan(600)
      geometry.dispose()
    }
    expect(suspension.terminations).toHaveLength(8)
    expect(suspension.ropes[1].laneOffset - suspension.ropes[0].laneOffset).toBeCloseTo(0.024)
  })

  it('never infers a ratio, rope count, diameter, groove selection, or route', () => {
    const { create, data } = setup()
    for (const key of ['ratio', 'ropeCount', 'ropeDiameterMm', 'grooveIndices', 'route', 'carConnectionId', 'counterweightConnectionId'] as const) {
      const partial = create({ ...data, suspension: { ...data.suspension!, [key]: undefined } })
      expect(partial.suspension).toBeUndefined()
      expect(partial.machine).toBeDefined()
      expect(partial.missingData).toContain('mechanical.drive.suspension')
    }
    expect(create(undefined).suspension).toBeUndefined()
    expect(create({ ...data, suspension: { ...data.suspension!, ratio: '2:1' } }).suspension).toBeUndefined()
  })

  it('keeps car/counterweight hitches distinct and seated on their own frames', () => {
    const { model, components } = setup()
    const [car, cw] = model.hitches
    expect(car.id).not.toBe(cw.id)
    expect(car.attachment).toBe('car'); expect(cw.attachment).toBe('counterweight')
    expect(car.bounds.min[1]).toBeCloseTo(components.carSling!.bounds.max[1])
    expect(cw.bounds.min[1]).toBeCloseTo(components.counterweightFrame!.bounds.max[1])
    expect(car.anchor).not.toEqual(cw.anchor)
  })

  it('structurally rejects non-finite paths, missing sources, fractional counts and literal zero sections', () => {
    const { data } = setup()
    const route = [{ kind: 'point', positionMm: point(0, 0, 0) }, { kind: 'point', positionMm: point(0, 0, 0) }]
    for (const suspension of [
      { ...data.suspension, ropeCount: 1.5 }, { ...data.suspension, source: undefined },
      { ...data.suspension, route },
      { ...data.suspension, route: [{ kind: 'point', positionMm: point(NaN, 0, 0) }, ...data.suspension!.route!] },
      { ...data.suspension, route: [{ kind: 'contact', sheaveId: 'traction', entryAngleRad: 0, exitAngleRad: 0 }, { kind: 'hitch', hitchId: 'car-hitch' }] },
    ]) expect(tractionDriveDataSchema.safeParse({ ...data, suspension }).success).toBe(false)
  })

  it('returns structured errors for geometric zero segments, sharp contacts and solid crossings', () => {
    const { create, data } = setup()
    const original = data.suspension!
    const duplicatedAnchor = create({ ...data, suspension: { ...original, route: [original.route![0], { kind: 'point', positionMm: point(0, 2490, 0) }, ...original.route!.slice(1)] } })
    expect(hasIssue(duplicatedAnchor, 'zero-length-route')).toBe(true)
    const wrongArc = create({ ...data, suspension: { ...original, route: [original.route![0], { kind: 'contact', sheaveId: 'traction', entryAngleRad: 2, exitAngleRad: 0 }, original.route![2]] } })
    expect(hasIssue(wrongArc, 'non-tangent-route')).toBe(true)
    const cabinHitch = { ...data.hitches![0], originMm: point(0, 1800, 0) }
    // Remove frame dimensional data in this isolated test so the crossing check is the rejecting boundary.
    const s = setup()
    const crossed = createTractionDriveModel({ ...data, hitches: [cabinHitch, data.hitches![1]] }, s.installation, s.layout, { ...s.components, carSling: undefined })
    expect(hasIssue(crossed, 'rope-intersects-solid')).toBe(true)
    expect(crossed.suspension).toBeUndefined()
    expect(crossed.machine).toBeDefined()
  })

  it('rejects missing support, invalid sheaves and incompatible shaft orientation independently', () => {
    const { create, data } = setup()
    expect(hasIssue(create({ ...data, mount: undefined }), 'unsupported-machine')).toBe(true)
    expect(create({ ...data, mount: undefined }).machine).toBeUndefined()
    expect(createSheaveModel({ ...data.sheaves![0], diameterMm: mm(0) })).toBeUndefined()
    expect(createSheaveModel({ ...data.sheaves![0], grooves: { ...data.sheaves![0].grooves!, depthMm: mm(1000) } })).toBeUndefined()
    expect(hasIssue(create({ ...data, sheaves: [{ ...data.sheaves![0], rotationYRad: 0 }] }), 'machine-sheave-axis-mismatch')).toBe(true)
    expect(hasIssue(create({ ...data, sheaves: [{ ...data.sheaves![0], originMm: point(0, 7000, 0) }] }), 'outside-drive-envelope')).toBe(true)
    for (const value of [0, -1, NaN]) expect(hasIssue(create({ ...data, suspension: { ...data.suspension!, ropeDiameterMm: mm(value) } }), 'invalid-suspension-data')).toBe(true)
  })

  it('supports an explicitly routed 2:1 system with moving car/counterweight sheaves and fixed endpoints', () => {
    const { data, installation, layout, components } = setup()
    const sheave = data.sheaves![0]
    const h = data.hitches![0]
    const routed: TractionDriveData = {
      sheaves: [
        { ...sheave, rotationYRad: 0, originMm: point(0, 5300, 0), diameterMm: mm(1206) },
        { ...sheave, id: 'car-pulley', role: 'car', rotationYRad: 0, originMm: point(-800, 2000, 0), diameterMm: mm(406) },
        { ...sheave, id: 'cw-pulley', role: 'counterweight', rotationYRad: 0, originMm: point(800, 2000, 0), diameterMm: mm(406) },
      ],
      hitches: [
        { ...h, id: 'fixed-a', attachment: 'fixed', rotationYRad: 0, originMm: point(-1000, 4870, 0) },
        { ...h, id: 'fixed-b', attachment: 'fixed', rotationYRad: 0, originMm: point(1000, 4870, 0) },
      ],
      suspension: { ...data.suspension!, ratio: '2:1', carConnectionId: 'car-pulley', counterweightConnectionId: 'cw-pulley', route: [
        { kind: 'hitch', hitchId: 'fixed-a' },
        { kind: 'contact', sheaveId: 'car-pulley', entryAngleRad: Math.PI, exitAngleRad: 2 * Math.PI },
        { kind: 'contact', sheaveId: 'traction', entryAngleRad: Math.PI, exitAngleRad: 0 },
        { kind: 'contact', sheaveId: 'cw-pulley', entryAngleRad: Math.PI, exitAngleRad: 2 * Math.PI },
        { kind: 'hitch', hitchId: 'fixed-b' },
      ] },
    }
    const result = createTractionDriveModel(routed, { ...installation, cabin: undefined }, { ...layout, carFrame: undefined, counterweight: undefined }, { ...components, carSling: undefined, counterweightFrame: undefined })
    expect(result.validation.issues).toEqual([])
    expect(result.suspension?.ratio).toBe('2:1')
    expect(result.suspension?.ropes).toHaveLength(4)
    expect(result.suspension?.ropes[0].contacts).toEqual(['car-pulley', 'traction', 'cw-pulley'])
  })

  it('activates Antrieb with reduced enclosure and uses drive bounds while restoring overall bounds', () => {
    const { model, components } = setup()
    expect(PASSENGER_VIEW_MODE_CATALOG.find((m) => m.id === 'drive')?.implemented).toBe(true)
    expect(getPassengerViewVisibility('drive')).toMatchObject({ mechanicalOpacity: 1, shaftEnvelopeOpacity: 0 })
    expect(getPassengerViewVisibility('drive').cabinShellOpacity).toBeLessThan(getPassengerViewVisibility('mechanical').cabinShellOpacity)
    const bounds = getPassengerCameraBounds('drive', components, model)
    for (const extent of [model.machine!.bounds, ...model.sheaves.map((s) => s.bounds), ...model.supports.map(componentBoxBounds)]) {
      for (const i of [0, 1, 2]) {
        expect(bounds.min[i]).toBeLessThanOrEqual(extent.min[i]); expect(bounds.max[i]).toBeGreaterThanOrEqual(extent.max[i])
      }
    }
    expect(bounds.min[1]).toBeGreaterThan(components.carSling!.bounds.max[1])
    expect(bounds.height).toBeLessThan(getPassengerCameraBounds('overview', components, model).height)
    expect(getPassengerCameraBounds('mechanical', components, model).height).toBeLessThan(getPassengerCameraBounds('overview', components, model).height)
  })

  it.each(COMPONENT_DATA_SOURCES)('preserves %s provenance throughout parsing and normalization', (source) => {
    const { data, create } = setup()
    const parsed = tractionDriveDataSchema.parse({
      machine: { ...data.machine, source }, mount: { ...data.mount, source },
      sheaves: data.sheaves!.map((s) => ({ ...s, source })), hitches: data.hitches!.map((h) => ({ ...h, source })), suspension: { ...data.suspension, source },
    })
    const model = create(parsed)
    expect(model.machine?.source).toBe(source)
    expect(model.machine?.reference).toBe('generic-qa-machine')
    expect(model.supports.every((s) => s.source === source)).toBe(true)
    expect(model.sheaves[0].source).toBe(source)
    expect(model.hitches.every((h) => h.source === source)).toBe(true)
    expect(model.suspension?.source).toBe(source)
    expect(model.suspension?.terminations.every((t) => t.source === source)).toBe(true)
  })

  it('never implicitly applies demo dimensions to defaults, project creation or reset', () => {
    expect(createPassengerPlanningConfiguration('Neues Projekt').mechanical).toBeUndefined()
    const store = createProjectStore()
    expect(passengerPlanningConfigurationSchema.parse(store.getState().project.configuration).mechanical?.drive).toBeUndefined()
    store.getState().updateConfiguration(createPassengerMechanicalFixture())
    expect(passengerPlanningConfigurationSchema.parse(store.getState().project.configuration).mechanical?.drive?.suspension?.source).toBe('demo')
    store.getState().resetProject()
    expect(passengerPlanningConfigurationSchema.parse(store.getState().project.configuration).mechanical).toBeUndefined()
  })
})
