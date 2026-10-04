import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../../../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema } from '../../../../elevator'
import { passengerDoorSystemDataSchema, type PassengerDoorSystemData } from '../../../../elevator/configuration/passenger-door-data'
import { COMPONENT_DATA_SOURCES } from '../../../../elevator/configuration/mechanical-component-data'
import { millimetres as mm } from '../../../../engineering'
import { createProjectStore } from '../../../../projects/project-store'
import { createLiftGeometryPlanningInput } from '../../lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../passenger-installation-model'
import { componentBoxBounds } from '../mechanical/mechanical-component-model'
import { createPassengerDoorSystem, getDoorInspection } from './passenger-door-model'
import { getDoorViewVisibility, getPassengerViewVisibility, PASSENGER_VIEW_MODE_CATALOG } from '../../../scene/view-mode'
import { getPassengerCameraBounds } from '../../../camera/passenger-camera-bounds'
import { createPassengerMechanicalLayout } from '../mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from '../mechanical/mechanical-component-model'
import { createTractionDriveModel } from '../mechanical/traction-drive-model'
import { createPassengerSafetyModel } from '../mechanical/passenger-safety-model'
import { createSheaveGeometry, createTechnicalCableGeometry } from '../mechanical/traction-geometry'

function setup(throughCar = false, count = 2) {
  const configuration = { ...createPassengerMechanicalFixture('rear', throughCar), stopCount: count }
  const input = createLiftGeometryPlanningInput(configuration)!
  const result = createPassengerInstallationModel(input)
  if (!('model' in result) || !result.model) throw new Error('Expected installation')
  const installation = result.model, data = input.doors!
  const create = (doors: PassengerDoorSystemData | undefined) => createPassengerDoorSystem(doors, installation)
  return { configuration, installation, data, create, model: create(data) }
}
const point = (x: number, y: number, z: number) => ({ xMm: mm(x), yMm: mm(y), zMm: mm(z) })
const hasIssue = (model: ReturnType<typeof createPassengerDoorSystem>, code: string) => model.validation.issues.some((issue) => issue.code === code)

describe('explicit static cabin and landing doors', () => {
  it('normalizes the complete demo without React, state, or engineering selection', () => {
    const { model, configuration } = setup()
    expect(passengerPlanningConfigurationSchema.safeParse(configuration).success).toBe(true)
    expect(model.validation).toEqual({ state: 'valid', issues: [] })
    expect(model.cabin).toHaveLength(1)
    expect(model.landings).toHaveLength(2)
    expect(model.cabin[0].operator?.pulleys).toHaveLength(2)
    expect(model.cabin[0].operator?.drivePath).toBeDefined()
    expect(model.cabin[0].hangers?.cylinders).toHaveLength(4)
    expect(model.cabin[0].guides?.boxes).toHaveLength(2)
    expect(model.landings.every((entry) => entry.interlock && entry.coupling && entry.frame && entry.sill && entry.track)).toBe(true)
  })

  it('creates two distinct centre-opening leaves following the explicit opening and thickness', () => {
    const { model } = setup()
    const [left, right] = model.cabin[0].panels
    expect(left.id).not.toBe(right.id)
    expect(left.width).toBe(0.45)
    expect(right.width).toBe(0.45)
    expect(left.height).toBe(2.1)
    expect(left.thickness).toBe(0.024)
    expect(left.closed.center[0]).toBe(-0.225)
    expect(right.closed.center[0]).toBe(0.225)
    expect(left.open.center[0]).toBe(-0.695)
    expect(right.open.center[0]).toBe(0.695)
  })

  it.each([1, 3, 6])('creates independent assemblies for all %i normalized stops', (count) => {
    const { model, installation } = setup(false, count)
    expect(model.landings).toHaveLength(count)
    expect(new Set(model.landings.map((entry) => entry.id)).size).toBe(count)
    model.landings.forEach((entry, i) => {
      expect(entry.levelId).toBe(installation.levels[i].id)
      expect(entry.origin[1]).toBe(installation.levels[i].elevationY)
      expect(entry.panels[0].closed.center[1]).toBeCloseTo(installation.levels[i].elevationY + 1.05)
      expect(entry.interlock!.levelId).toBe(entry.levelId)
      expect(entry.interlock!.entranceId).toBe(entry.id)
    })
    if (count > 1) expect(model.landings[0].panels).not.toBe(model.landings.at(-1)?.panels)
  })

  it('keeps cabin/landing sills independent and reports their explicit geometric separation', () => {
    const { model } = setup()
    const car = model.cabin[0].sill!, landing = model.landings[0].sill!
    expect(car).not.toBe(landing)
    expect(car.bounds.max[1]).toBe(0)
    expect(landing.bounds.max[1]).toBe(0)
    expect(model.relationships[0].sillSeparation).toBeCloseTo(0.04)
    expect(car.boxes).toHaveLength(3)
    expect(landing.boxes).toHaveLength(3)
  })

  it('mounts the operator above its own entrance and keeps coupling/interlock identities distinct', () => {
    const { model } = setup()
    const car = model.cabin[0], landing = model.landings[0]
    expect(car.operator!.entranceId).toBe(car.id)
    expect(car.operator!.bounds.min[1]).toBeGreaterThan(car.origin[1] + car.openingHeight)
    expect(car.coupling!.attachment).toBe('cabin')
    expect(landing.coupling!.attachment).toBe('landing')
    expect(car.coupling!.panelId).toBe(car.panels[0].id)
    expect(landing.coupling!.panelId).toBe(landing.panels[0].id)
    expect(model.relationships.every((entry) => entry.entranceAxesCorrespond && entry.interfacePointsCoincide)).toBe(true)
  })

  it('separates front/rear doors and repeats both series for Durchlader without sharing instances', () => {
    const { model } = setup(true, 3)
    expect(model.validation.issues).toEqual([])
    expect(model.cabin.map((entry) => entry.side)).toEqual(['front', 'rear'])
    expect(model.landings).toHaveLength(6)
    expect(model.cabin[0].origin[2]).toBe(0.7)
    expect(model.cabin[1].origin[2]).toBe(-0.7)
    expect(model.cabin[1].rotationY).toBe(Math.PI)
    expect(model.cabin[0].panels[0].closed.center).not.toEqual(model.cabin[1].panels[0].closed.center)
    expect(model.cabin[0].operator!.pulleys[0].id).not.toBe(model.cabin[1].operator!.pulleys[0].id)
  })

  it('supports separately supplied rear opening dimensions without changing cabin dimensions', () => {
    const { configuration } = setup(true)
    const rear = configuration.doors!.cabin![1]
    const input = createLiftGeometryPlanningInput({ ...configuration, doors: { ...configuration.doors,
      cabin: [configuration.doors!.cabin![0], { ...rear, opening: { widthMm: mm(800), heightMm: mm(2000) } }],
    } })!
    const result = createPassengerInstallationModel(input)
    if (!('model' in result) || !result.model) throw new Error('Expected installation')
    expect(result.model.cabin).toMatchObject({ width: 1.1, depth: 1.4, height: 2.2 })
    expect(result.model.cabin!.entrances[1]).toMatchObject({ width: 0.8, height: 2 })
    const model = createPassengerDoorSystem(input.doors, result.model)
    expect(model.cabin[1].panels[0]).toMatchObject({ width: 0.4, height: 2 })
  })

  it('supports explicit per-floor dimensions instead of assuming every floor is identical', () => {
    const { data, create } = setup()
    const model = create({ ...data, landings: [{ ...data.landings![0], overrides: [{ levelId: 'level-2', opening: { widthMm: mm(800), heightMm: mm(2000) } }] }] })
    expect(model.landings[0].openingWidth).toBe(0.9)
    expect(model.landings[1].openingWidth).toBe(0.8)
    expect(model.landings[1].panels[0].width).toBe(0.4)
    expect(model.landings[1].origin[1]).toBe(3)
  })

  it('supports explicitly specified side-opening travel and reserves future types without pretending they render', () => {
    const { data, create } = setup()
    const car = data.cabin![0], assembly = car.assembly!
    const side = create({ cabin: [{ ...car, operator: undefined, coupling: undefined, assembly: { ...assembly,
      openingType: 'side-opening-2', sideOpeningDirection: 'right', panelDepthOffsetsMm: [mm(40), mm(70)], panelTravelMm: [point(950, 0, 0), point(480, 0, 0)],
      hanger: undefined, bottomGuide: undefined,
    } }] })
    expect(side.cabin[0].panels).toHaveLength(2)
    expect(side.cabin[0].panels.every((panel) => panel.open.center[0] > panel.closed.center[0])).toBe(true)
    const future = create({ cabin: [{ ...car, operator: undefined, coupling: undefined, assembly: { ...assembly, openingType: 'center-opening-4', panelCount: 4 } }] })
    expect(hasIssue(future, 'unsupported-door-type')).toBe(true)
    expect(future.cabin[0].panels).toEqual([])
  })

  it('normalizes deterministic closed/open transforms while inspection never moves the cabin', () => {
    const { model, data, create, installation } = setup()
    expect(create(data)).toEqual(model)
    const selected = getDoorInspection(model, installation.levels, 'level-2')
    expect(selected.level!.id).toBe('level-2')
    expect(selected.landing!.origin[1]).toBe(3)
    expect(selected.cabin!.origin[1]).toBe(0)
    expect(selected.cabinAtLevel).toBe(false)
    expect(selected.bounds!.min[1]).toBeCloseTo(2.97)
    expect(selected.bounds!.max[1]).toBeGreaterThan(5.1)
    const base = getDoorInspection(model, installation.levels, 'level-1')
    expect(base.cabinAtLevel).toBe(true)
    expect(base.bounds!.min[2]).toBeLessThanOrEqual(model.cabin[0].bounds.min[2])
    expect(base.bounds!.max[2]).toBeGreaterThanOrEqual(model.landings[0].bounds.max[2])
    expect(getDoorInspection(model, installation.levels, 'removed-level').level!.id).toBe('level-1')
  })

  it('keeps missing manufactured data absent while preserving explicit opening outlines', () => {
    const { create } = setup()
    const model = create(undefined)
    expect(model.cabin[0].panels).toEqual([])
    expect(model.cabin[0].operator).toBeUndefined()
    expect(model.cabin[0].sill).toBeUndefined()
    expect(model.landings).toEqual([])
    expect(model.cabin[0].outline).toHaveLength(4)
    expect(model.validation.state).toBe('incomplete')
  })

  it('rejects malformed structural data without engineering thresholds', () => {
    const { data } = setup()
    const car = data.cabin![0]
    for (const entry of [
      { ...car, source: undefined }, { ...car, axisXMm: Infinity },
      { ...car, assembly: { ...car.assembly!, panelCount: 1.5 } },
      { ...car, assembly: { ...car.assembly!, panelTravelMm: [point(NaN, 0, 0)] } },
      { ...car, operator: { ...car.operator!, motorPower: 500 } },
    ]) expect(passengerDoorSystemDataSchema.safeParse({ cabin: [entry] }).success).toBe(false)
  })

  it('rejects zero panels, overlapping leaves, non-finite transforms, and invalid level/axis references', () => {
    const { data, create } = setup()
    const car = data.cabin![0], assembly = car.assembly!
    for (const patch of [
      { panelThicknessMm: mm(0) }, { panelDepthOffsetsMm: [mm(NaN), mm(40)] },
      { panelOverlapMm: mm(20) }, { panelCount: 3 }, { panelTravelMm: [point(0, 0, 0), point(470, 0, 0)] },
    ]) expect(hasIssue(create({ cabin: [{ ...car, operator: undefined, coupling: undefined, assembly: { ...assembly, ...patch } }] }), 'invalid-door-panel')).toBe(true)
    expect(hasIssue(create({ ...data, landings: [{ ...data.landings![0], cabinEntranceId: 'missing' }] }), 'missing-door-reference')).toBe(true)
    expect(hasIssue(create({ ...data, landings: [{ ...data.landings![0], side: 'rear' }] }), 'entrance-axis-mismatch')).toBe(true)
    expect(hasIssue(create({ ...data, landings: [{ ...data.landings![0], overrides: [{ levelId: 'level-99' }] }] }), 'invalid-door-level')).toBe(true)
  })

  it('omits detached operator/coupling/interlock and invalid sill/guide geometry independently', () => {
    const { data, create } = setup()
    const car = data.cabin![0]
    const operator = create({ ...data, cabin: [{ ...car, operator: { ...car.operator!, aboveOpeningMm: mm(-300) } }] })
    expect(operator.cabin[0].operator).toBeUndefined()
    expect(operator.cabin[0].panels).toHaveLength(2)
    const coupling = create({ ...data, cabin: [{ ...car, coupling: { ...car.coupling!, panelIndex: 99 } }] })
    expect(hasIssue(coupling, 'invalid-door-coupling')).toBe(true)
    const interlock = create({ ...data, landings: [{ ...data.landings![0], interlock: { ...data.landings![0].interlock!, depthOffsetMm: mm(500) } }] })
    expect(hasIssue(interlock, 'invalid-door-interlock')).toBe(true)
    const sill = create({ ...data, cabin: [{ ...car, assembly: { ...car.assembly!, sill: { ...car.assembly!.sill!, heightMm: mm(0) } } }] })
    expect(hasIssue(sill, 'invalid-door-sill')).toBe(true)
    for (const panel of sill.cabin[0].panels) expect(componentBoxBounds(panel.box).height).toBeGreaterThan(0)
  })

  it.each(COMPONENT_DATA_SOURCES)('preserves %s component provenance', (source) => {
    const { data, create } = setup()
    const car = data.cabin![0]
    const model = create({ cabin: [{ ...car, source, reference: 'explicit', assembly: { ...car.assembly!, source },
      operator: { ...car.operator!, source, pulleys: car.operator!.pulleys.map((wheel) => ({ ...wheel, source })), drivePath: { ...car.operator!.drivePath!, source } },
      coupling: { ...car.coupling!, source } }], landings: [{ ...data.landings![0], source,
        assembly: { ...data.landings![0].assembly!, source }, coupling: { ...data.landings![0].coupling!, source }, interlock: { ...data.landings![0].interlock!, source },
      }] })
    expect(model.cabin[0].source).toBe(source)
    expect(model.cabin[0].reference).toBe('explicit')
    expect(model.cabin[0].panels.every((panel) => panel.source === source)).toBe(true)
    expect(model.cabin[0].operator!.source).toBe(source)
    expect(model.cabin[0].operator!.drivePath!.source).toBe(source)
    expect(model.cabin[0].coupling!.source).toBe(source)
    expect(model.landings[0].interlock!.source).toBe(source)
  })

  it('keeps operator/interlock demo data out of project defaults and reset', () => {
    const normal = createPassengerPlanningConfiguration('Neues LiftPlan-Projekt')
    expect(normal.doors).toBeUndefined()
    const store = createProjectStore()
    store.getState().updateConfiguration(createPassengerMechanicalFixture())
    expect(passengerPlanningConfigurationSchema.parse(store.getState().project.configuration).doors!.cabin![0].operator!.source).toBe('demo')
    store.getState().resetProject()
    expect(store.getState().project.configuration).toEqual(normal)
  })

  it('emphasizes only the selected entrance in Türen mode without changing models', () => {
    expect(PASSENGER_VIEW_MODE_CATALOG.find((entry) => entry.id === 'doors')?.implemented).toBe(true)
    const visibility = getPassengerViewVisibility('doors')
    expect(visibility.showMechanicalSystems).toBe(false)
    expect(visibility.shaftEnvelopeOpacity).toBe(0)
    expect(visibility.cabinShellOpacity).toBeLessThan(0.2)
    expect(getDoorViewVisibility('doors', true)).toEqual({ panelOpacity: 1, componentOpacity: 1 })
    expect(getDoorViewVisibility('doors', false).componentOpacity).toBeLessThan(0.1)
    expect(getDoorViewVisibility('cutaway', true).panelOpacity).toBeLessThan(1)
  })

  it('uses the selected floor and side bounds in the actual viewport camera contract', () => {
    const { model, configuration, installation } = setup(true, 6)
    const input = createLiftGeometryPlanningInput(configuration)!
    const layout = createPassengerMechanicalLayout(input, installation)
    const components = createPassengerMechanicalComponents(input.mechanical.components, layout)
    const drive = createTractionDriveModel(input.mechanical.drive, installation, layout, components)
    const safety = createPassengerSafetyModel(input.mechanical.safety, installation, layout, components, drive.machine)
    const inspection = getDoorInspection(model, installation.levels, 'level-6', 'rear')
    expect(inspection.landing!.side).toBe('rear')
    expect(inspection.bounds!.min[1]).toBeCloseTo(14.97)
    expect(getPassengerCameraBounds('doors', components, drive, safety, model, inspection)).toEqual(inspection.bounds)
    expect(inspection.bounds!.height).toBeLessThan(3)
    expect(model.cabin.every((entry) => entry.origin[1] === 0)).toBe(true)
  })

  it('builds finite lightweight operator wheels and a separate closed drive loop', () => {
    const { model } = setup()
    const operator = model.cabin[0].operator!
    for (const wheel of operator.pulleys) {
      const geometry = createSheaveGeometry(wheel)
      expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
      geometry.dispose()
    }
    const geometry = createTechnicalCableGeometry(operator.drivePath!)
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
    expect(geometry.getAttribute('position').count).toBeLessThan(800)
    geometry.dispose()
  })

  it('does not shrink the cabin or accept an explicit opening that cannot fit its shell', () => {
    const { configuration } = setup()
    const input = createLiftGeometryPlanningInput({ ...configuration, doors: { cabin: [{ ...configuration.doors!.cabin![0], opening: { widthMm: mm(1200), heightMm: mm(2100) } }] } })!
    const result = createPassengerInstallationModel(input)
    expect(result.status).toBe('invalid')
    if (!('model' in result) || !result.model) throw new Error('Expected cabin')
    expect(result.model.cabin!.width).toBe(1.1)
    expect(result.model.cabin!.entrances).toEqual([])
  })
})
