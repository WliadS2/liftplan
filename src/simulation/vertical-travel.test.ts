import { describe, expect, it } from 'vitest'
import { metres, metresPerSecond, millimetres as mm } from '../engineering'
import { calculateVerticalTravelDuration } from './vertical-travel'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import { createPassengerMechanicalLayout } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from '../three/geometry/passenger/mechanical/mechanical-component-model'
import { createTractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import { createPassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import { createPassengerDoorSystem } from '../three/geometry/passenger/doors/passenger-door-model'
import { createPassengerSimulationFixture } from '../dev/fixtures/passenger-simulation-demo'
import { createGoodsLiftQaFixture } from '../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../dev/fixtures/car-lift-qa-fixture'
import { createGoodsLiftNormalizedModel } from '../elevator/goods/goods-lift-model'
import { createCarLiftNormalizedModel } from '../elevator/car/car-lift-model'
import { validateGoodsLiftSpatialGeometry } from '../collision/goods-lift-spatial-validation'
import { validateCarLiftSpatialGeometry } from '../collision/car-lift-spatial-validation'
import { createPassengerSimulationModel } from './passenger-simulation-model'
import { createPassengerSimulationController } from './passenger-simulation'
import { createGoodsSimulationController, createGoodsSimulationModel } from './goods-simulation'
import { createCarSimulationModel } from './car-simulation'
import { createPlatformSimulationController } from './platform-simulation'
import { createCarLiftSceneModel } from '../elevator/car/car-lift-scene-model'
import { isCarMovingAssembly } from '../three/geometry/car/car-motion-bindings'
import { getCarLiftCameraFrame } from '../three/camera/car-lift-camera'
import { getPassengerCameraFrame } from '../three/camera/passenger-camera-bounds'
import { createGoodsLiftSceneModel } from '../elevator/goods/goods-lift-scene-model'
import { getGoodsLiftCameraFrame } from '../three/camera/goods-lift-camera'

function passenger(count: number, speed?: number) {
  const configuration = { ...createPassengerSimulationFixture('rear', true, count),
    ratedSpeedMetresPerSecond: speed === undefined ? undefined : metresPerSecond(speed) }
  const planning = createLiftGeometryPlanningInput(configuration)!
  const normalized = createPassengerInstallationModel(planning)
  if (!('model' in normalized) || !normalized.model) throw Error('No installation')
  const installation = normalized.model, layout = createPassengerMechanicalLayout(planning, installation)
  const components = createPassengerMechanicalComponents(planning.mechanical.components, layout)
  const drive = createTractionDriveModel(planning.mechanical.drive, installation, layout, components)
  const safety = createPassengerSafetyModel(planning.mechanical.safety, installation, layout, components, drive.machine)
  const doors = createPassengerDoorSystem(planning.doors, installation)
  const inputs = { planning, installation, layout, components, drive, safety, doors }
  return { result: createPassengerSimulationModel(inputs), inputs }
}
function platform(family: 'goods' | 'car', count: number, speed?: number) {
  const update = { stopCount: count, storeyHeightsMm: Array(count-1).fill(mm(3000)),
    nominalSpeedMetresPerSecond: speed === undefined ? undefined : metresPerSecond(speed) }
  if (family === 'goods') {
    const normalized = createGoodsLiftNormalizedModel({ ...createGoodsLiftQaFixture(), ...update })
    return createGoodsSimulationModel(normalized, validateGoodsLiftSpatialGeometry(normalized))
  }
  const normalized = createCarLiftNormalizedModel({ ...createCarLiftQaFixture(), ...update })
  return createCarSimulationModel(normalized, validateCarLiftSpatialGeometry(normalized))
}

describe('shared nominal-speed vertical kinematics', () => {
  it.each([[0.5,12],[1,6],[2,3]])('6 m at %s m/s takes exactly %s seconds', (speed, expected) => {
    expect(calculateVerticalTravelDuration(metres(-2), metres(4), metresPerSecond(speed)))
      .toEqual({ status: 'available', seconds: expected })
    expect(calculateVerticalTravelDuration(metres(4), metres(-2), metresPerSecond(speed)))
      .toEqual({ status: 'available', seconds: expected })
  })
  it('preserves fractional precision and zero distance, and safely rejects missing/non-finite data', () => {
    expect(calculateVerticalTravelDuration(metres(0.1), metres(6.37), metresPerSecond(1.7)))
      .toMatchObject({ status: 'available', seconds: expect.closeTo(6.27/1.7, 12) })
    expect(calculateVerticalTravelDuration(metres(5), metres(5), metresPerSecond(1)))
      .toEqual({ status: 'available', seconds: 0 })
    expect(calculateVerticalTravelDuration(metres(0), metres(1))).toMatchObject({ status: 'unknown' })
    for (const speed of [0,-1,NaN,Infinity,Number.MIN_VALUE]) {
      expect(calculateVerticalTravelDuration(metres(0), metres(6), metresPerSecond(speed)).status).toBe('invalid')
    }
    expect(calculateVerticalTravelDuration(metres(NaN), metres(1), metresPerSecond(1)).status).toBe('invalid')
  })
  for (const family of ['passenger','goods','car'] as const) {
    it.each([2,6,10])(`${family}: speed ratios and constant-speed position at %i stops`, (count) => {
      for (const speed of [0.5,1,2]) {
        const result = family === 'passenger' ? passenger(count, speed).result : platform(family,count,speed)
        if (result.status !== 'available') throw Error(JSON.stringify(result))
        if (family === 'passenger') {
          const model = passenger(count,speed).result
          if (model.status !== 'available') throw Error('Unavailable')
          const c = createPassengerSimulationController(model.model)
          c.dispatch({ type: 'start', targetLevel: `level-${count}` })
          expect(c.getState().travelDurationSeconds).toBe((count-1)*3/speed)
          c.advance(model.model.capabilities.doorMovement.available ? model.model.timing.doorClosingSeconds : 0)
          c.advance(c.getState().travelDurationSeconds / 2)
          expect(c.getPose().cabinY).toBeCloseTo((count-1)*1.5)
          c.advance(c.getState().travelDurationSeconds / 2 + 10)
          expect(c.getPose().cabinY).toBe((count-1)*3)
          c.dispatch({ type: 'start', targetLevel: 'level-1' }); c.advance(c.getState().travelDurationSeconds + 10)
          expect(c.getPose().cabinY).toBe(0)
          if (count > 2) {
            const middle = Math.floor(count / 2)
            c.dispatch({ type: 'start', targetLevel: `level-${middle}` }); c.advance(c.getState().travelDurationSeconds + 10)
            c.dispatch({ type: 'start', targetLevel: `level-${middle+1}` })
            expect(c.getState().travelDurationSeconds).toBe(3/speed)
            c.advance(c.getState().travelDurationSeconds + 10)
            expect(c.getPose().cabinY).toBe(middle*3)
          }
        } else {
          const model = platform(family,count,speed)
          if (model.status !== 'available') throw Error('Unavailable')
          const c = createPlatformSimulationController(model.model)
          c.dispatch({ type: 'start', targetLevel: `level-${count}` })
          expect(c.getState().travelDurationSeconds).toBe((count-1)*3/speed)
          c.advance(model.model.capabilities.landingDoorMovement.available ? model.model.timing.doorSeconds : 0)
          c.advance(c.getState().travelDurationSeconds / 2)
          expect(c.getPose().floorMm).toBeCloseTo((count-1)*1500)
          c.advance(c.getState().travelDurationSeconds / 2 + 3)
          expect(c.getPose().floorMm).toBe((count-1)*3000)
          c.dispatch({ type: 'start', targetLevel: 'level-1' }); c.advance(c.getState().travelDurationSeconds + 3)
          expect(c.getPose().floorMm).toBe(0)
          if (count > 2) {
            const middle = Math.floor(count / 2)
            c.dispatch({ type: 'start', targetLevel: `level-${middle}` }); c.advance(c.getState().travelDurationSeconds + 3)
            c.dispatch({ type: 'start', targetLevel: `level-${middle+1}` })
            expect(c.getState().travelDurationSeconds).toBe(3/speed)
            c.advance(c.getState().travelDurationSeconds + 3)
            expect(c.getPose().floorMm).toBe(middle*3000)
          }
        }
      }
    })
    it(`${family}: active speed edit never changes pose/phase and next trip uses new speed`, () => {
      if (family === 'passenger') {
        const r = passenger(6,1).result
        if (r.status !== 'available') throw Error('Unavailable')
        const c = createPassengerSimulationController(r.model)
        c.dispatch({ type: 'start', targetLevel: 'level-3' }); c.advance(r.model.timing.doorClosingSeconds + 2)
        const state = c.getState(), pose = c.getPose()
        c.setNominalSpeed(metresPerSecond(2))
        expect(c.getState()).toBe(state); expect(c.getPose()).toBe(pose)
        c.advance(20); c.dispatch({ type: 'start', targetLevel: 'level-5' })
        expect(c.getState().travelDurationSeconds).toBe(3)
      } else {
        const r = platform(family,6,1)
        if (r.status !== 'available') throw Error('Unavailable')
        const c = createGoodsSimulationController(r.model)
        c.dispatch({ type: 'start', targetLevel: 'level-3' }); c.advance(3)
        const state = c.getState(), pose = c.getPose()
        c.setNominalSpeed(metresPerSecond(2))
        expect(c.getState()).toBe(state); expect(c.getPose()).toBe(pose)
        c.advance(20); c.dispatch({ type: 'start', targetLevel: 'level-5' })
        expect(c.getState().travelDurationSeconds).toBe(3)
      }
    })
    it(`${family}: missing speed is unavailable and zero/invalid speed is invalid`, () => {
      const prepare = (speed?: number) => family === 'passenger' ? passenger(2,speed).result : platform(family,2,speed)
      expect(prepare().status).toBe('unavailable')
      if (family === 'passenger') {
        const inputs = passenger(2,1).inputs
        for (const speed of [0,-1,NaN,Infinity]) expect(createPassengerSimulationModel({ ...inputs,
          planning: { ...inputs.planning, nominalSpeedMetresPerSecond: metresPerSecond(speed) } }).status).toBe('invalid')
      }
      // Passenger's structural schema rejects nonpositive speed before its geometry adapter.
      if (family !== 'passenger') for (const speed of [0,-1,NaN,Infinity]) expect(prepare(speed).status).toBe('invalid')
    })
  }
})

describe('installation overview, local carrier camera and Auto attachments', () => {
  it.each([2,6,10])('overview contains the full %i-stop installation while carrier detail stays local', (count) => {
    const p = passenger(count,1).inputs
    const pf = getPassengerCameraFrame('overview',p.installation,p.components,p.drive,p.safety,p.doors)
    expect(pf.bounds.min[1]).toBeLessThanOrEqual(p.installation.vertical.pitBottomY!)
    expect(pf.bounds.max[1]).toBeGreaterThanOrEqual(p.installation.vertical.shaftTopY!)
    expect(pf.target).toEqual(pf.bounds.center)
    expect(getPassengerCameraFrame('mechanical',p.installation,p.components,p.drive,p.safety,p.doors).bounds.height).toBeLessThan(10)
    for (const family of ['goods','car'] as const) {
      const fixture = family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
      const update = { stopCount: count, storeyHeightsMm: Array(count-1).fill(mm(3000)) }
      if (fixture.family === 'goods') {
        const n = createGoodsLiftNormalizedModel({ ...fixture,...update })
        if (n.status === 'empty') throw Error('Missing')
        const scene = createGoodsLiftSceneModel(n.model), f = getGoodsLiftCameraFrame(scene,'overview',true)
        expect(f.bounds.min[1]).toBeCloseTo(n.model.shaft!.minY/1000)
        expect(f.bounds.max[1]).toBeCloseTo(n.model.shaft!.maxY/1000)
        expect(f.target).toEqual(f.bounds.center)
        expect(getGoodsLiftCameraFrame(scene,'platform').bounds.height).toBeCloseTo(2.66)
      } else {
        const n = createCarLiftNormalizedModel({ ...fixture,...update })
        if (n.status === 'empty') throw Error('Missing')
        const scene = createCarLiftSceneModel(n.model), f = getCarLiftCameraFrame(scene,'overview')
        expect(f.bounds.min[1]).toBeCloseTo(n.model.shaft!.minY/1000)
        expect(f.bounds.max[1]).toBeCloseTo(n.model.shaft!.maxY/1000)
        expect(f.target).toEqual(f.bounds.center)
        expect(getCarLiftCameraFrame(scene,'platform').bounds.height).toBeCloseTo(2.76)
        const moving = scene.assemblies.filter(isCarMovingAssembly)
        expect(moving.filter(a=>a.kind==='wheel-contact')).toHaveLength(4)
        expect(moving.some(a=>a.kind==='vehicle-body')).toBe(true)
        expect(moving.filter(a=>a.kind==='vehicle-axle')).toHaveLength(2)
        expect(moving.some(a=>['approach-envelope','guide','landing-door'].includes(a.kind))).toBe(false)
      }
    }
  })
})
