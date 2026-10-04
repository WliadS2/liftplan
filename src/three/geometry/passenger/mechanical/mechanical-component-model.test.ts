import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../../../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema } from '../../../../elevator'
import { COMPONENT_DATA_SOURCES, type MechanicalComponentData } from '../../../../elevator/configuration/mechanical-component-data'
import { millimetres } from '../../../../engineering'
import { createProjectStore } from '../../../../projects/project-store'
import { createLiftGeometryPlanningInput } from '../../lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../passenger-installation-model'
import { createPassengerMechanicalLayout, type MechanicalBounds } from './passenger-mechanical-layout'
import { componentBoxBounds, createPassengerMechanicalComponents } from './mechanical-component-model'
import { createTRailProfile } from './rail-profile'
import { createRailExtrusion } from './rail-extrusion'

function setup(configuration = createPassengerMechanicalFixture()) {
  const input = createLiftGeometryPlanningInput(configuration)!
  const installation = createPassengerInstallationModel(input)
  if (!('model' in installation) || !installation.model) throw new Error('Expected fixture installation')
  const layout = createPassengerMechanicalLayout(input, installation.model)
  return { configuration, installation: installation.model, layout,
    components: createPassengerMechanicalComponents(input.mechanical.components, layout) }
}
function withComponents(update: Partial<MechanicalComponentData>) {
  const fixture = createPassengerMechanicalFixture()
  return { ...fixture, mechanical: { ...fixture.mechanical, components: { ...fixture.mechanical?.components, ...update } } }
}
function contained(inner: MechanicalBounds, outer: MechanicalBounds) {
  return [0, 1, 2].every((axis) => inner.min[axis] >= outer.min[axis] - 1e-12 && inner.max[axis] <= outer.max[axis] + 1e-12)
}

describe('explicit mechanical component geometry', () => {
  it('builds a non-degenerate T cross-section and one finite continuous extrusion', () => {
    const profile = createTRailProfile(createPassengerMechanicalFixture().mechanical!.components!.railProfile!)!
    expect(profile.points).toHaveLength(12)
    expect(new Set(profile.points.map((p) => p.join(':'))).size).toBe(12)
    const area = profile.points.reduce((sum, p, i, points) => {
      const next = points[(i + 1) % points.length]
      return sum + p[0] * next[1] - next[0] * p[1]
    }, 0) / 2
    expect(area).toBeGreaterThan(0)
    const geometry = createRailExtrusion(profile, 7.2)
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-profile.flangeWidth / 2)
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-profile.depth)
    expect(geometry.boundingBox?.max.y).toBeCloseTo(7.2)
    const positions = geometry.getAttribute('position')
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true)
    for (let i = 0; i < positions.count; i += 3) {
      const a = [positions.getX(i), positions.getY(i), positions.getZ(i)]
      const b = [positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1)]
      const c = [positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2)]
      const ab = b.map((v, axis) => v - a[axis]), ac = c.map((v, axis) => v - a[axis])
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
      expect(Math.hypot(...cross)).toBeGreaterThan(0)
    }
    geometry.dispose()
  })

  it('rejects degenerate, non-finite or incompatible profile dimensions', () => {
    const profile = createPassengerMechanicalFixture().mechanical!.components!.railProfile!
    for (const update of [
      { webThicknessMm: millimetres(0) }, { flangeWidthMm: millimetres(NaN) },
      { profileDepthMm: millimetres(20) }, { headWidthMm: millimetres(5) },
    ]) expect(createTRailProfile({ ...profile, ...update })).toBeUndefined()
    expect(() => createRailExtrusion(createTRailProfile(profile)!, 0)).toThrow()
  })

  it('shares the profile while maintaining independent inward-facing rail transforms', () => {
    const { components } = setup()
    const [left, right] = components.carRails!
    expect(left.profile).toBe(right.profile)
    expect(left.profile).toBe(components.counterweightRails![0].profile)
    expect(left.origin).not.toEqual(right.origin)
    expect(left.rotationY).toBe(Math.PI / 2)
    expect(right.rotationY).toBe(-Math.PI / 2)
    expect(left.facing[0]).toBeCloseTo(1)
    expect(right.facing[0]).toBeCloseTo(-1)
    expect(left.length).toBeCloseTo(7.2)
  })

  it('orients z-axis cabin rails toward their sling', () => {
    const fixture = createPassengerMechanicalFixture()
    const { components } = setup({ ...fixture, mechanical: { ...fixture.mechanical, carRailOrientation: 'z', carRailSpacingMm: millimetres(1800) } })
    expect(components.carRails?.map((r) => r.rotationY)).toEqual([0, Math.PI])
    expect(components.carGuideShoes).toHaveLength(4)
    expect(components.issues).toEqual([])
  })

  it.each(['rear', 'left', 'right'] as const)('keeps the %s counterweight shoes on their own rails and frame', (arrangement) => {
    const { components, layout } = setup(createPassengerMechanicalFixture(arrangement))
    expect(components.counterweightRails).toHaveLength(2)
    expect(components.counterweightGuideShoes).toHaveLength(4)
    expect(components.issues).toEqual([])
    const axis = arrangement === 'rear' ? 0 : 2
    for (const shoe of components.counterweightGuideShoes) {
      const rail = components.counterweightRails!.find((r) => r.id === shoe.railId)!
      expect(shoe.railAxis[0]).toBe(rail.origin[0])
      expect(shoe.railAxis[2]).toBe(rail.origin[2])
      expect(shoe.rotationY).toBe(rail.rotationY)
      expect(Math.abs(shoe.mountingCenter[axis] - layout.counterweight!.center[axis])).toBeCloseTo(layout.counterweight!.width / 2)
      expect(components.carGuideShoes.some((s) => s.railId === shoe.railId)).toBe(false)
    }
  })

  it('aligns cabin guide shoes with rail tips and the sling mounting faces', () => {
    const { components, configuration } = setup()
    const slingData = configuration.mechanical!.components!.carSling!
    expect(components.carGuideShoes).toHaveLength(4)
    for (const shoe of components.carGuideShoes) {
      const rail = components.carRails!.find((r) => r.id === shoe.railId)!
      expect(shoe.railAxis[0]).toBe(rail.origin[0])
      expect(shoe.railAxis[2]).toBe(rail.origin[2])
      const mountingDistance = slingData.railToUprightCentreMm - slingData.uprightWidthMm / 2
      expect(Math.abs(shoe.mountingCenter[0] - rail.origin[0])).toBeCloseTo(mountingDistance / 1000)
      const plate = shoe.boxes.find((p) => p.id.endsWith('-mount'))!
      const bounds = componentBoxBounds(plate)
      const frameSide = components.carSling!.boxes.filter((part) => part.id.startsWith(rail.origin[0] < 0 ? 'car-upright-0' : 'car-upright-1'))
      expect(frameSide.some((part) => {
        const member = componentBoxBounds(part)
        return rail.origin[0] < 0 ? Math.abs(bounds.max[0] - member.min[0]) < 1e-12 : Math.abs(bounds.min[0] - member.max[0]) < 1e-12
      })).toBe(true)
    }
  })

  it('constructs a substantial sling outside the unchanged cabin envelope', () => {
    const { components, layout, installation, configuration } = setup()
    const cabin = layout.carFrame!.cabinBounds
    expect(components.carSling!.boxes.length).toBeGreaterThan(8)
    for (const part of components.carSling!.boxes) {
      const bounds = componentBoxBounds(part)
      const overlap = [0, 1, 2].every((axis) => bounds.min[axis] < cabin.max[axis] - 1e-12 && bounds.max[axis] > cabin.min[axis] + 1e-12)
      expect(overlap, part.id).toBe(false)
    }
    expect(installation.cabin).toMatchObject({ width: 1.1, depth: 1.4, height: 2.2 })
    expect(configuration.cabinWidthMm).toBe(1100)
  })

  it('contains every repeated slab in the stack region and counterweight envelope', () => {
    const { components, layout } = setup()
    const frame = components.counterweightFrame!
    expect(contained(frame.stackBounds, layout.counterweight!.bounds)).toBe(true)
    expect(frame.slabs).toHaveLength(12)
    for (const slab of frame.slabs) {
      expect(contained(componentBoxBounds(slab), frame.stackBounds)).toBe(true)
      expect(contained(componentBoxBounds(slab), frame.bounds)).toBe(true)
      const slabBounds = componentBoxBounds(slab)
      for (const member of frame.boxes) {
        const memberBounds = componentBoxBounds(member)
        expect([0, 1, 2].every((axis) => slabBounds.min[axis] < memberBounds.max[axis] - 1e-12 && slabBounds.max[axis] > memberBounds.min[axis] + 1e-12)).toBe(false)
      }
    }
    expect('massKg' in frame).toBe(false)
    expect('balanceFactor' in frame).toBe(false)
  })

  it('builds independent car and counterweight buffers at their supplied pit bases', () => {
    const { components, layout } = setup()
    expect(components.carBuffers?.boxes).toHaveLength(2)
    expect(components.counterweightBuffers?.boxes).toHaveLength(1)
    expect(components.carBuffers?.cylinders).toHaveLength(6)
    expect(components.counterweightBuffers?.cylinders).toHaveLength(3)
    for (const [model, positions] of [[components.carBuffers!, layout.carBuffers!.basePositions], [components.counterweightBuffers!, layout.counterweightBuffers!.basePositions]] as const) {
      model.boxes.forEach((base, index) => {
        expect(base.center[0]).toBe(positions[index][0])
        expect(base.center[2]).toBe(positions[index][2])
        expect(componentBoxBounds(base).min[1]).toBeCloseTo(positions[index][1])
      })
    }
    const partial = setup(withComponents({ carBuffer: undefined }))
    expect(partial.components.carBuffers).toBeUndefined()
    expect(partial.components.counterweightBuffers).toBeDefined()
  })

  it('omits unavailable component shapes independently without inventing profile dimensions', () => {
    const fixture = createPassengerMechanicalFixture()
    const missing = setup({ ...fixture, mechanical: { ...fixture.mechanical, components: undefined } })
    expect(missing.layout.carRails?.rails).toHaveLength(2)
    expect(missing.components.carRails).toBeUndefined()
    expect(missing.components.carSling).toBeUndefined()
    expect(missing.components.counterweightFrame).toBeUndefined()
    expect(missing.components.carGuideShoes).toEqual([])
    expect(missing.components.issues).toEqual([])
    expect(missing.components.missingData).toContain('mechanical.components.railProfile')
    const partial = setup(withComponents({ carSling: undefined }))
    expect(partial.components.carGuideShoes).toEqual([])
    expect(partial.components.counterweightFrame).toBeDefined()
    const noCabin = setup({ ...fixture, cabinWidthMm: undefined, cabinDepthMm: undefined, cabinHeightMm: undefined })
    expect(noCabin.components.carRails).toHaveLength(2)
    expect(noCabin.components.carSling).toBeUndefined()
  })

  it('rejects component geometry crossing the cabin or overflowing the weight stack', () => {
    const data = createPassengerMechanicalFixture().mechanical!.components!
    const hugeSling = setup(withComponents({ carSling: { ...data.carSling!, uprightWidthMm: millimetres(600) } }))
    expect(hugeSling.components.carSling).toBeUndefined()
    expect(hugeSling.components.issues).toContainEqual({ code: 'invalid-component-shape', path: 'mechanical.components.carSling' })
    const largeStack = setup(withComponents({ counterweightFrame: { ...data.counterweightFrame!, slabCount: 50 } }))
    expect(largeStack.components.counterweightFrame).toBeUndefined()
    expect(largeStack.components.carSling).toBeDefined()
    const wrongMount = setup(withComponents({ carGuideShoe: { ...data.carGuideShoe!, bodyDepthMm: millimetres(200) } }))
    expect(wrongMount.components.carGuideShoes).toEqual([])
    expect(wrongMount.components.issues).toContainEqual(expect.objectContaining({ path: 'mechanical.components.carGuideShoe' }))
  })

  it.each(COMPONENT_DATA_SOURCES)('preserves %s dimensional provenance through schema and normalization', (source) => {
    const data = createPassengerMechanicalFixture().mechanical!.components!
    const components = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { ...value, source, reference: 'explicit-test-source' }]))
    const parsed = passengerPlanningConfigurationSchema.parse(withComponents(components))
    const { components: model } = setup(parsed)
    expect(model.carRails![0].profile.source).toBe(source)
    expect(model.carRails![0].profile.reference).toBe('explicit-test-source')
    expect(model.carSling?.source).toBe(source)
    expect(model.carSling?.reference).toBe('explicit-test-source')
    expect(model.counterweightFrame?.source).toBe(source)
    expect(model.carGuideShoes[0].source).toBe(source)
    expect(model.carGuideShoes[0].reference).toBe('explicit-test-source')
    expect(model.counterweightGuideShoes[0].source).toBe(source)
    expect(model.carBuffers?.source).toBe(source)
  })

  it('keeps demo geometry out of normal project creation and reset', () => {
    const normal = createPassengerPlanningConfiguration('Neues LiftPlan-Projekt')
    expect(normal.mechanical?.components).toBeUndefined()
    const store = createProjectStore()
    store.getState().updateConfiguration(createPassengerMechanicalFixture())
    expect(passengerPlanningConfigurationSchema.parse(store.getState().project.configuration).mechanical?.components?.railProfile?.source).toBe('demo')
    store.getState().resetProject()
    expect(store.getState().project.configuration).toEqual(normal)
    expect(passengerPlanningConfigurationSchema.parse(store.getState().project.configuration).mechanical?.components).toBeUndefined()
  })
})
