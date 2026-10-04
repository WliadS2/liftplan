import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema, type PassengerPlanningConfiguration } from '../../../elevator'
import { millimetres as mm, metres } from '../../../engineering'
import { createLiftGeometryPlanningInput } from '../lift-geometry-planning-input'
import { createPassengerInstallationModel } from './passenger-installation-model'
import { createPassengerMechanicalLayout } from './mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents, componentBoxBounds, componentCylinderBounds } from './mechanical/mechanical-component-model'
import { createTractionDriveModel } from './mechanical/traction-drive-model'
import { createPassengerSafetyModel } from './mechanical/passenger-safety-model'
import { createPassengerDoorSystem, getDoorInspection } from './doors/passenger-door-model'
import { getPassengerCameraBounds } from '../../camera/passenger-camera-bounds'
import { createPassengerVerticalModel, resolveVerticalRecord } from './passenger-vertical-model'

function normalize(configuration: PassengerPlanningConfiguration) {
  const input = createLiftGeometryPlanningInput(configuration)!
  const result = createPassengerInstallationModel(input)
  if (!('model' in result) || !result.model) throw new Error('Expected installation')
  const installation = result.model, layout = createPassengerMechanicalLayout(input, installation)
  const components = createPassengerMechanicalComponents(input.mechanical.components, layout)
  const drive = createTractionDriveModel(input.mechanical.drive, installation, layout, components)
  const safety = createPassengerSafetyModel(input.mechanical.safety, installation, layout, components, drive.machine)
  const doors = createPassengerDoorSystem(input.doors, installation)
  return { result, installation, layout, components, drive, safety, doors }
}
function valid(model: ReturnType<typeof normalize>) {
  expect(model.result.status).toBe('complete')
  expect(model.layout.validation.issues).toEqual([])
  expect(model.components.issues).toEqual([])
  expect(model.drive.validation).toEqual({ state: 'valid', issues: [] })
  expect(model.safety.validation).toEqual({ state: 'valid', issues: [] })
  expect(model.doors.validation).toEqual({ state: 'valid', issues: [] })
}

describe('semantic installation-height reflow', () => {
  it('resolves explicit fractional offsets without metre-rounding false missing anchors', () => {
    const vertical = createPassengerVerticalModel([metres(0), metres(15)], mm(1200), mm(500.5), 0, mm(500.5))
    expect(vertical.topMechanicalY).toBeCloseTo(15)
    expect(createPassengerVerticalModel([metres(0), metres(15)], mm(1200), mm(500.5), 0, mm(500.6)).topMechanicalY).toBeUndefined()
    const config = createPassengerMechanicalFixture()
    const model = normalize({ ...config, stopCount: 6, headroomMm: mm(3500.5), mechanical: {
      ...config.mechanical, zones: { topInsetMm: mm(3500.5) },
    } })
    expect(model.layout.validation.issues.some((issue) => issue.code === 'invalid-zone-offset')).toBe(false)
  })
  const cases = [2, 6, 10].flatMap((count) => (['rear', 'left', 'right'] as const).map((arrangement) => ({ count, arrangement })))
  it.each(cases)('reflows $count stops with $arrangement counterweight without stale positions or envelope errors', ({ count, arrangement }) => {
    const config = { ...createPassengerMechanicalFixture(arrangement, true), stopCount: count }
    expect(passengerPlanningConfigurationSchema.safeParse(config).success).toBe(true)
    const original = JSON.stringify(config), model = normalize(config)
    valid(model)
    const { installation: i, layout: l, components: c, drive: d, safety: s, doors } = model
    const highest = (count - 1) * 3
    expect(i.levels.map((level) => level.elevationY)).toEqual(Array.from({ length: count }, (_, j) => j * 3))
    expect(i.vertical).toMatchObject({ lowestLandingY: 0, highestLandingY: highest, pitBottomY: -1.2,
      shaftTopY: highest + 3, topMechanicalY: highest + 2, cabinLevelIndex: 0, cabinElevationY: 0,
      travelRegion: { bottomY: 0, topY: highest }, headroomRegion: { bottomY: highest, topY: highest + 3 } })
    expect(i.shaft!.verticalExtent!.height).toBeCloseTo(highest + 4.2)
    expect(d.machine!.origin[1]).toBeCloseTo(highest + 2.4)
    expect(d.sheaves[0].center[1]).toBe(d.machine!.origin[1])
    expect(d.supports[0].center[1]).toBeCloseTo(highest + 1.61)
    expect(s.governor!.wheel.center[1]).toBeCloseTo(highest + 2.6)
    expect(s.governor!.bounds.max[1]).toBeLessThan(i.vertical.shaftTopY!)
    expect(d.machine!.bounds.max[1]).toBeLessThan(i.vertical.shaftTopY!)
    expect(l.carBuffers!.basePositions.map((p) => p[1])).toEqual([-1.2, -1.2])
    expect(l.counterweightBuffers!.basePositions[0][1]).toBe(-1.2)
    expect(s.tension!.wheel.center[1]).toBeCloseTo(-0.85)
    expect(s.tension!.bounds.min[1]).toBeCloseTo(i.vertical.pitBottomY!)
    expect(s.tension!.bounds.max[1]).toBeLessThan(0)
    for (const part of [...c.carBuffers!.boxes.map(componentBoxBounds), ...c.carBuffers!.cylinders.map(componentCylinderBounds)]) {
      expect(part.min[1]).toBeGreaterThanOrEqual(i.vertical.pitBottomY!)
      expect(part.max[1]).toBeLessThan(i.vertical.lowestLandingY!)
    }
    expect(i.cabin!.bottomY).toBe(0)
    expect(s.gears.map((g) => g.mountPoint[1])).toEqual([-0.22, -0.22])
    expect(s.linkage!.ropeConnection[1]).toBe(-0.34)
    expect(l.counterweight!.center[1]).toBeCloseTo(i.cabin!.centerY + mm(0))
    expect(l.counterweight!.bounds.min[1]).toBeGreaterThanOrEqual(i.vertical.pitBottomY!)
    expect(l.counterweight!.bounds.max[1]).toBeLessThanOrEqual(i.vertical.shaftTopY!)
    expect(doors.landings).toHaveLength(count * 2)
    for (const door of doors.landings) expect(door.origin[1]).toBe(i.levels.find((level) => level.id === door.levelId)!.elevationY)
    for (const rope of d.suspension!.ropes) {
      expect(rope.points.every((p) => p.every(Number.isFinite))).toBe(true)
      expect(rope.points[1][1]).toBeCloseTo(highest + 2.4)
      expect(rope.points[0][1]).toBeCloseTo(2.49)
    }
    expect(s.governorRope!.points.every((p) => p.every(Number.isFinite))).toBe(true)
    expect(s.governorRope!.bounds.max[1]).toBeCloseTo(highest + 2.803)
    const overview = getPassengerCameraBounds('overview', c, d, s, doors)
    expect(overview.min[1]).toBeLessThanOrEqual(i.vertical.pitBottomY!)
    expect(overview.max[1]).toBeGreaterThanOrEqual(i.vertical.shaftTopY!)
    expect(getPassengerCameraBounds('drive', c, d, s).height).toBeLessThan(2)
    expect(getPassengerCameraBounds('mechanical', c, d, s).height).toBeLessThan(4)
    const safetyBounds = getPassengerCameraBounds('safety', c, d, s)
    expect(safetyBounds.min[1]).toBeLessThanOrEqual(s.tension!.bounds.min[1])
    expect(safetyBounds.max[1]).toBeGreaterThanOrEqual(s.governor!.bounds.max[1])
    expect(JSON.stringify(config)).toBe(original)
  })

  it('reflows explicit storey height, headroom and pit changes independently', () => {
    const base = { ...createPassengerMechanicalFixture(), stopCount: 6 }
    const original = normalize(base)
    for (const config of [{ ...base, floorHeightMm: mm(3500) }, { ...base, headroomMm: mm(4000) }, { ...base, pitDepthMm: mm(1600) }]) {
      const model = normalize(config)
      valid(model)
      const { vertical: v } = model.installation
      expect(model.drive.machine!.origin[1]).toBeCloseTo(v.shaftTopY! - 0.6)
      expect(model.safety.governor!.wheel.center[1]).toBeCloseTo(v.shaftTopY! - 0.4)
      expect(model.layout.carBuffers!.basePositions[0][1]).toBe(v.pitBottomY)
      expect(model.safety.tension!.wheel.center[1]).toBeCloseTo(v.pitBottomY! + 0.35)
      if (config.pitDepthMm === base.pitDepthMm) expect(model.safety.tension).toEqual(original.safety.tension)
      else expect(model.drive.machine).toEqual(original.drive.machine)
    }
  })

  it('moves cabin, frame, shoes, gears, linkage, doors and hitches together at an explicit current level', () => {
    const config = { ...createPassengerMechanicalFixture(), stopCount: 6, cabinLevelIndex: 1 }
    const base = normalize({ ...config, cabinLevelIndex: 0 }), model = normalize(config)
    valid(model)
    expect(model.installation.cabin!.bottomY).toBe(3)
    expect(model.layout.counterweight!.center[1] - base.layout.counterweight!.center[1]).toBeCloseTo(3)
    expect(model.components.carSling!.bounds.min[1] - base.components.carSling!.bounds.min[1]).toBeCloseTo(3)
    model.components.carGuideShoes.forEach((s, i) => expect(s.mountingCenter[1] - base.components.carGuideShoes[i].mountingCenter[1]).toBeCloseTo(3))
    model.safety.gears.forEach((g, i) => expect(g.mountPoint[1] - base.safety.gears[i].mountPoint[1]).toBeCloseTo(3))
    expect(model.safety.linkage!.ropeConnection[1] - base.safety.linkage!.ropeConnection[1]).toBe(3)
    expect(model.drive.hitches[0].anchor[1] - base.drive.hitches[0].anchor[1]).toBeCloseTo(3)
    expect(model.drive.hitches[1].anchor[1] - base.drive.hitches[1].anchor[1]).toBeCloseTo(3)
    expect(model.doors.cabin[0].origin[1]).toBe(3)
    expect(getDoorInspection(model.doors, model.installation.levels, 'level-2').cabinAtLevel).toBe(true)
    expect(model.safety.tension).toEqual(base.safety.tension)
    expect(model.drive.machine).toEqual(base.drive.machine)
  })

  it('preserves explicit ordered elevations, including a nonzero imported lowest datum', () => {
    const model = normalize({ ...createPassengerMechanicalFixture(), levelElevationsMm: [mm(1000), mm(4000), mm(8500)], cabinLevelIndex: 1 })
    valid(model)
    expect(model.installation.levels.map((l) => l.elevationY)).toEqual([1, 4, 8.5])
    expect(model.installation.vertical.pitBottomY).toBeCloseTo(-0.2)
    expect(model.installation.pit!.centerY).toBeCloseTo(0.4)
    expect(model.installation.cabin!.bottomY).toBe(4)
    expect(model.drive.machine!.origin[1]).toBeCloseTo(10.9)
    expect(model.doors.landings.map((d) => d.origin[1])).toEqual([1, 4, 8.5])
  })

  it('reports unknown, unordered or invalid level selection instead of silently moving the cabin', () => {
    for (const levels of [[mm(0), mm(0)], [mm(3000), mm(0)]]) {
      const model = normalize({ ...createPassengerMechanicalFixture(), levelElevationsMm: levels })
      expect(model.result.status).toBe('invalid')
      expect(model.installation.cabin).toBeUndefined()
    }
    expect(normalize({ ...createPassengerMechanicalFixture(), cabinLevelIndex: 99 }).result.status).toBe('invalid')
    expect(passengerPlanningConfigurationSchema.safeParse({ ...createPassengerMechanicalFixture(), cabinLevelIndex: 0.5 }).success).toBe(false)
  })

  it('preserves absolute points and sources, while unavailable anchors omit only dependent equipment', () => {
    const model = normalize(createPassengerMechanicalFixture())
    const missing: string[] = []
    const point = { xMm: mm(0), yMm: mm(5400), zMm: mm(0) }
    expect(resolveVerticalRecord(point, model.installation.vertical, missing, 'absolute')).toEqual(point)
    expect(resolveVerticalRecord({ ...point, verticalAnchor: undefined }, model.installation.vertical, missing, 'absolute')).toEqual(point)
    expect(resolveVerticalRecord({ ...point, yMm: mm(-600), verticalAnchor: 'shaft-top' }, model.installation.vertical, missing, 'relative')).toEqual(point)
    expect(model.drive.machine!.source).toBe('demo')
    expect(model.safety.governor!.source).toBe('demo')
    const partial = normalize({ ...createPassengerMechanicalFixture(), headroomMm: undefined })
    expect(partial.drive.machine).toBeUndefined()
    expect(partial.safety.governor).toBeUndefined()
    expect(partial.safety.tension).toBeDefined()
    expect(partial.safety.gears).toHaveLength(2)
    expect(partial.drive.missingData.some((p) => p.includes('anchor.top-mechanical'))).toBe(true)
    expect(partial.drive.validation.issues).toEqual([])
    expect(partial.safety.validation.issues).toEqual([])
    expect(createPassengerPlanningConfiguration('Normal')).not.toHaveProperty('cabinLevelIndex')
    expect(resolveVerticalRecord({ ...point, verticalAnchor: 'counterweight-center' }, model.installation.vertical, [], 'cw', metres(1))).toMatchObject({ yMm: 6400 })
  })
})
