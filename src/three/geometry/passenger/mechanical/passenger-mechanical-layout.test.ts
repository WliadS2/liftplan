import { describe, expect, it } from 'vitest'
import {
  createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema,
  type CounterweightPosition, type PassengerPlanningConfiguration,
} from '../../../../elevator'
import { createPassengerMechanicalFixture } from '../../../../dev/fixtures/passenger-mechanical-fixture'
import { metres, millimetres } from '../../../../engineering'
import { createLiftGeometryPlanningInput, type PassengerGeometryPlanningInput } from '../../lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../passenger-installation-model'
import { getPassengerViewVisibility } from '../../../scene/view-mode'
import { createMechanicalBounds, createPassengerMechanicalLayout, getPassengerMechanicalDebugPositions } from './passenger-mechanical-layout'

function fromInput(input: PassengerGeometryPlanningInput) {
  const result = createPassengerInstallationModel(input)
  if (!('model' in result) || !result.model) throw new Error('Expected installation geometry')
  return createPassengerMechanicalLayout(input, result.model)
}
function layout(configuration = createPassengerMechanicalFixture()) {
  const input = createLiftGeometryPlanningInput(configuration)
  if (!input) throw new Error('Expected structurally valid planning data')
  return fromInput(input)
}
function changeMechanical(update: Partial<NonNullable<PassengerPlanningConfiguration['mechanical']>>) {
  const configuration = createPassengerMechanicalFixture()
  return { ...configuration, mechanical: { ...configuration.mechanical, ...update } }
}

describe('explicit passenger mechanical layout', () => {
  it('has two distinct cabin rails tied to the explicit symmetric spacing', () => {
    const model = layout()
    expect(model.carRails?.rails.map((r) => r.start[0])).toEqual([-0.75, 0.75])
    expect(model.carRails?.rails.map((r) => r.start[2])).toEqual([0, 0])
    expect(model.carRails?.rails[0].end[1]).toBe(7)
    expect(model.carRails?.source).toBe('planning')
  })
  it('creates a sling around unchanged cabin dimensions and shares its rail axes', () => {
    const configuration = createPassengerMechanicalFixture()
    const frame = layout(configuration).carFrame
    expect(frame?.bounds.min[0]).toBe(-0.75)
    expect(frame?.bounds.max[0]).toBe(0.75)
    expect(frame?.cabinBounds.width).toBe(1.1)
    expect(frame?.cabinBounds.depth).toBe(1.4)
    expect(frame?.cabinBounds.height).toBe(2.2)
    expect(frame?.uprights).toHaveLength(2)
    expect(frame?.platformSupports).toHaveLength(2)
    expect(frame?.crosshead.start[1]).toBe(2.2)
    expect(frame?.lowerSling.start[1]).toBe(0)
    expect(configuration.cabinWidthMm).toBe(1100)
  })
  it.each<CounterweightPosition>(['rear', 'left', 'right'])(
    'places the %s counterweight from its explicit offset and depth', (arrangement) => {
      const model = layout(createPassengerMechanicalFixture(arrangement))
      const cw = model.counterweight!
      expect(cw.arrangement).toBe(arrangement)
      expect(cw.placementSource).toBe('planning')
      expect(cw.depth).toBe(0.22)
      if (arrangement === 'rear') expect(cw.center).toEqual([0, 1.1, -1.15])
      else expect(cw.center).toEqual([arrangement === 'left' ? -1.05 : 1.05, 1.1, 0])
      expect(model.validation.issues).toEqual([])
    },
  )
  it('keeps counterweight rails distinct from one another and from cabin rails', () => {
    const model = layout()
    expect(model.counterweightRails?.rails.map((r) => r.start)).toEqual([
      [-0.45, -1.2, -1.15], [0.45, -1.2, -1.15],
    ])
    expect(model.counterweightRails?.rails[0].id).not.toBe(model.carRails?.rails[0].id)
  })
  it('supports explicit rail axes and z-oriented cabin rail/frame pairs', () => {
    const model = layout(changeMechanical({ carRailOrientation: 'z', carRailSpacingMm: millimetres(1800) }))
    expect(model.carRails?.rails.map((r) => r.start[2])).toEqual([-0.9, 0.9])
    expect(model.carFrame?.orientation).toBe('z')
    expect(model.validation.issues).toEqual([])
  })
  it('includes the full installation and all mechanical envelopes in bounds', () => {
    const model = layout()
    expect(model.bounds.min[0]).toBeCloseTo(-1.3)
    expect(model.bounds.min[1]).toBeCloseTo(-1.2)
    expect(model.bounds.min[2]).toBeCloseTo(-1.5)
    expect(model.bounds.max).toEqual([1.3, 7, 1.5])
    expect(model.bounds.height).toBeCloseTo(8.2)
    const debug = getPassengerMechanicalDebugPositions(model)
    // Detailed traction placement now belongs to the separate pure drive model.
    expect(debug.machinePosition).toBeUndefined()
    expect(debug.counterweightRailB).toBeDefined()
    expect(debug.frameBounds).toEqual(model.carFrame?.bounds)
  })
  it('does not make buffers without explicit positions and pit context', () => {
    const absent = layout(changeMechanical({ carBufferPositionsMm: undefined, counterweightBufferPositionsMm: undefined }))
    expect(absent.carBuffers).toBeUndefined()
    expect(absent.counterweightBuffers).toBeUndefined()
    const noPit = layout({ ...createPassengerMechanicalFixture(), pitDepthMm: undefined })
    expect(noPit.carBuffers).toBeUndefined()
    expect(noPit.counterweightBuffers).toBeUndefined()
    expect(layout().carBuffers?.basePositions).toEqual([[-0.35, -1.2, 0], [0.35, -1.2, 0]])
  })
  it('does not invent machine, sheave or suspension data', () => {
    const model = layout(changeMechanical({ machine: { positionMm: { xMm: millimetres(0), yMm: millimetres(0), zMm: millimetres(0) } }, tractionSheave: undefined, suspension: { arrangement: '2:1' } }))
    expect(model.machine).toBeUndefined()
    expect(model.tractionSheave).toBeUndefined()
    expect(model.suspension).toBeUndefined()
  })
  it('renders a complete fixture and validates its structure without any React context', () => {
    const fixture = createPassengerMechanicalFixture()
    expect(passengerPlanningConfigurationSchema.safeParse(fixture).success).toBe(true)
    const model = layout(fixture)
    expect(model.validation).toEqual({ state: 'valid', issues: [] })
    for (const key of ['carFrame', 'carRails', 'counterweight', 'counterweightRails', 'carBuffers', 'counterweightBuffers'] as const) expect(model[key]).toBeDefined()
    expect(fixture.mechanical?.drive).toBeDefined()
    expect(model.zones.map((z) => z.kind)).toEqual(['bottom', 'top'])
  })
  it('emphasizes mechanics with reduced shaft, cabin, door, pit and landing obstruction', () => {
    const mechanical = getPassengerViewVisibility('mechanical')
    const overview = getPassengerViewVisibility('overview')
    expect(mechanical.mechanicalOpacity).toBe(1)
    expect(mechanical.shaftEnvelopeOpacity).toBe(0)
    expect(mechanical.pitOpacity).toBe(0)
    expect(mechanical.cabinShellOpacity).toBeLessThan(0.1)
    expect(mechanical.frontDoorOpacity).toBeLessThan(0.1)
    expect(mechanical.landingOpacity).toBeLessThan(overview.landingOpacity)
    expect(getPassengerViewVisibility('cutaway').mechanicalOpacity).toBe(1)
  })
  it('keeps missing layout data graceful and production projects empty', () => {
    const defaultConfig = createPassengerPlanningConfiguration('Leeres Projekt')
    expect(defaultConfig.mechanical).toBeUndefined()
    expect(defaultConfig.counterweightPosition).toBeUndefined()
    const input = createLiftGeometryPlanningInput(defaultConfig)!
    expect(createPassengerInstallationModel(input).status).toBe('empty')
    const model = layout({ ...defaultConfig, cabinWidthMm: millimetres(1100), cabinDepthMm: millimetres(1400), cabinHeightMm: millimetres(2200) })
    expect(model.carRails).toBeUndefined()
    expect(model.carFrame).toBeUndefined()
    expect(model.counterweight).toBeUndefined()
    expect(model.validation.state).toBe('incomplete')
  })
  it('requires counterweight arrangement, depth and position individually', () => {
    const fixture = createPassengerMechanicalFixture()
    expect(layout({ ...fixture, counterweightDepthMm: undefined }).counterweight).toBeUndefined()
    expect(layout(changeMechanical({ counterweightOffsetMm: undefined })).counterweight).toBeUndefined()
    expect(layout({ ...changeMechanical({ counterweightArrangement: undefined }), counterweightPosition: undefined }).counterweight).toBeUndefined()
  })
  it('has no mass or balance outputs and no placement defaults in visualization constants', () => {
    const cw = layout().counterweight!
    expect(Object.keys(cw).sort()).toEqual(['arrangement', 'bounds', 'center', 'depth', 'dimensionsSource', 'height', 'placementSource', 'rotationY', 'width'].sort())
    expect(layout(changeMechanical({ carRailSpacingMm: undefined })).carRails).toBeUndefined()
    expect(layout(changeMechanical({ counterweightRailSpacingMm: undefined })).counterweightRails).toBeUndefined()
  })
  it('reports and omits collapsed rail pairs without hiding unrelated geometry', () => {
    const model = layout(changeMechanical({ carRailPositionsMm: [
      { xMm: millimetres(700), zMm: millimetres(0) }, { xMm: millimetres(700), zMm: millimetres(0) },
    ] }))
    expect(model.carRails).toBeUndefined()
    expect(model.counterweight).toBeDefined()
    expect(model.validation.issues).toContainEqual(expect.objectContaining({ code: 'collapsed-rail-pair', severity: 'error', messageKey: 'mechanical.collapsed-rail-pair' }))
    const cw = layout(changeMechanical({ counterweightRailPositionsMm: [
      { xMm: millimetres(0), zMm: millimetres(-1150) }, { xMm: millimetres(0), zMm: millimetres(-1150) },
    ] }))
    expect(cw.counterweightRails).toBeUndefined()
    expect(cw.validation.state).toBe('invalid')
  })
  it('rejects frame/rail positions within the cabin interior', () => {
    const model = layout(changeMechanical({ carRailSpacingMm: millimetres(800) }))
    expect(model.carFrame).toBeUndefined()
    expect(model.carRails).toBeUndefined()
    expect(model.validation.issues.map((i) => i.code)).toContain('frame-intersects-cabin')
  })
  it('rejects a counterweight outside the shaft or crossing the cabin', () => {
    const outside = layout(changeMechanical({ counterweightOffsetMm: { xMm: millimetres(0), yMm: millimetres(0), zMm: millimetres(-2000) } }))
    expect(outside.counterweight).toBeUndefined()
    expect(outside.validation.issues.map((i) => i.code)).toContain('outside-shaft')
    const crossing = layout(changeMechanical({ counterweightOffsetMm: { xMm: millimetres(0), yMm: millimetres(0), zMm: millimetres(-600) } }))
    expect(crossing.validation.issues.map((i) => i.code)).toContain('counterweight-intersects-cabin')
  })
  it('rejects invalid buffer relationships and machine/sheave envelopes', () => {
    const model = layout(changeMechanical({
      carBufferPositionsMm: [{ xMm: millimetres(0), yMm: millimetres(100), zMm: millimetres(0) }],
      machine: { positionMm: { xMm: millimetres(0), yMm: millimetres(7000), zMm: millimetres(0) }, envelopeMm: { widthMm: millimetres(500), heightMm: millimetres(500), depthMm: millimetres(500) } },
    }))
    expect(model.carBuffers).toBeUndefined()
    expect(model.machine).toBeUndefined()
    expect(model.validation.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['buffer-outside-pit', 'outside-shaft']))
  })
  it('returns errors for non-finite coordinates and non-positive explicit dimensions', () => {
    const input = createLiftGeometryPlanningInput(createPassengerMechanicalFixture())!
    const invalid = fromInput({ ...input, mechanical: { ...input.mechanical, carRailSpacingMm: millimetres(-1), tractionSheave: { positionMm: { xMm: millimetres(NaN), yMm: millimetres(0), zMm: millimetres(0) }, diameterMm: millimetres(400) } } })
    expect(invalid.validation.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['non-positive-dimension', 'non-finite-coordinate']))
    expect(invalid.tractionSheave).toBeUndefined()
    expect(invalid.bounds.min.every(Number.isFinite)).toBe(true)
  })
  it('reports invalid partial mechanical values before their subsystem is complete', () => {
    const input = createLiftGeometryPlanningInput(createPassengerMechanicalFixture())!
    const model = fromInput({ ...input, mechanical: { ...input.mechanical,
      counterweightOffsetMm: { xMm: millimetres(NaN) },
      machine: { envelopeMm: { widthMm: millimetres(-1), heightMm: millimetres(300), depthMm: millimetres(400) } },
    } })
    expect(model.counterweight).toBeUndefined()
    expect(model.machine).toBeUndefined()
    expect(model.validation.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['non-finite-coordinate', 'non-positive-dimension']))
  })
  it('reports exact non-centred mechanical bounds and finite empty bounds', () => {
    expect(createMechanicalBounds([[metres(1), metres(0), metres(-2)], [metres(3), metres(4), metres(0)]]).center).toEqual([2, 2, -1])
    expect(createMechanicalBounds([]).center).toEqual([0, 0, 0])
  })
})
