import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'
import { metres,millimetres } from '../../engineering'
import { createLiftGeometryPlanningInput } from '../geometry/lift-geometry-planning-input'
import { createPassengerDoorSystem, getDoorInspection } from '../geometry/passenger/doors/passenger-door-model'
import { createPassengerMechanicalComponents } from '../geometry/passenger/mechanical/mechanical-component-model'
import { createMechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalLayout } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerSafetyModel } from '../geometry/passenger/mechanical/passenger-safety-model'
import { createTractionDriveModel } from '../geometry/passenger/mechanical/traction-drive-model'
import { createPassengerInstallationModel } from '../geometry/passenger/passenger-installation-model'
import {
  calculateCameraFit, CAMERA_DEFAULT_DIRECTION, CAMERA_MAX_POLAR_ANGLE,
  CAMERA_MIN_POLAR_ANGLE, CAMERA_WORLD_UP,
} from './camera-fit'
import { getCameraFrameTrigger, transitionCameraInteraction, type CameraFrameRequest } from './camera-interaction-policy'
import { getPassengerCameraFrame, getPassengerCameraInstallationKey } from './passenger-camera-bounds'

function setup(stopCount: number,overrides:Partial<ReturnType<typeof createPassengerMechanicalFixture>> = {}) {
  const configuration = { ...createPassengerMechanicalFixture(), stopCount,...overrides }
  const input = createLiftGeometryPlanningInput(configuration)!
  const result = createPassengerInstallationModel(input)
  if (!('model' in result) || !result.model) throw new Error('Expected installation')
  const installation = result.model
  const layout = createPassengerMechanicalLayout(input, installation)
  const components = createPassengerMechanicalComponents(input.mechanical.components, layout)
  const drive = createTractionDriveModel(input.mechanical.drive, installation, layout, components)
  const safety = createPassengerSafetyModel(input.mechanical.safety, installation, layout, components, drive.machine)
  const doors = createPassengerDoorSystem(input.doors, installation)
  return { installation, components, drive, safety, doors }
}

const bounds = (width: number, height: number, depth: number) => createMechanicalBounds([
  [metres(-width / 2), metres(-height / 2), metres(-depth / 2)],
  [metres(width / 2), metres(height / 2), metres(depth / 2)],
])

describe('CAD-like camera fit and interaction policy', () => {
  it.each([2,6,10])('keeps Passenger full-installation framing independent of cabin floor at %i stops',count=>{
    const bottom=setup(count,{cabinLevelIndex:0}),top=setup(count,{cabinLevelIndex:count-1})
    const frame=(m:typeof bottom)=>getPassengerCameraFrame('overview',m.installation,m.components,m.drive,m.safety,m.doors)
    expect(frame(top)).toEqual(frame(bottom))
    expect(frame(top).bounds.min[1]).toBeLessThanOrEqual(top.installation.vertical.pitBottomY!)
    expect(frame(top).bounds.max[1]).toBeGreaterThanOrEqual(top.installation.vertical.shaftTopY!)
  })
  it('invalidates Passenger camera keys for cabin dimensions, not only subsystem presence',()=>{
    const original=setup(6),changed=setup(6,{cabinWidthMm:millimetres(1200)})
    const key=(m:typeof original)=>getPassengerCameraInstallationKey(m.installation,m.components,m.drive,m.safety,m.doors)
    expect(key(changed)).not.toBe(key(original))
  })
  it('fits tall/narrow and short/wide bounds using the actual viewport aspect', () => {
    const tall = calculateCameraFit(bounds(2, 30, 2), [metres(0), metres(0), metres(0)], { width: 600, height: 420 })
    const wide = calculateCameraFit(bounds(12, 2, 2), [metres(0), metres(0), metres(0)], { width: 600, height: 420 })
    const narrowViewport = calculateCameraFit(bounds(12, 2, 2), [metres(0), metres(0), metres(0)], { width: 300, height: 600 })
    expect(tall.distance).toBeGreaterThan(wide.distance)
    expect(narrowViewport.distance).toBeGreaterThan(wide.distance)
    expect(tall.near).toBeGreaterThan(0)
    expect(tall.far).toBeGreaterThan(tall.maxDistance)
  })

  it('uses normalized semantic targets for overview, drive, safety and selected doors', () => {
    const model = setup(6)
    const overview = getPassengerCameraFrame('overview', model.installation, model.components, model.drive, model.safety, model.doors)
    const drive = getPassengerCameraFrame('drive', model.installation, model.components, model.drive, model.safety, model.doors)
    const safety = getPassengerCameraFrame('safety', model.installation, model.components, model.drive, model.safety, model.doors)
    const inspection = getDoorInspection(model.doors, model.installation.levels, 'level-6', 'front')
    const doors = getPassengerCameraFrame('doors', model.installation, model.components, model.drive, model.safety, model.doors, inspection)
    expect(overview.target[1]).toBeCloseTo((overview.bounds.min[1] + overview.bounds.max[1]) / 2)
    expect(overview.bounds.min[1]).toBeLessThanOrEqual(model.installation.vertical.pitBottomY!)
    expect(overview.bounds.max[1]).toBeGreaterThanOrEqual(model.installation.vertical.shaftTopY!)
    expect(drive.target[1]).toBeGreaterThan(model.installation.vertical.highestLandingY!)
    expect(safety.target[1]).toBeGreaterThan(model.installation.vertical.pitBottomY!)
    expect(safety.target[1]).toBeLessThan(model.installation.vertical.shaftTopY!)
    expect(doors.target).toEqual(inspection.landing!.bounds.center)
  })

  it('scales distance limits and keeps subsystem frames independent of full-shaft bounds', () => {
    const short = setup(2), tall = setup(10)
    const shortOverview = getPassengerCameraFrame('overview', short.installation, short.components, short.drive, short.safety, short.doors)
    const tallOverview = getPassengerCameraFrame('overview', tall.installation, tall.components, tall.drive, tall.safety, tall.doors)
    const shortFit = calculateCameraFit(shortOverview.bounds, shortOverview.target, { width: 600, height: 420 })
    const tallFit = calculateCameraFit(tallOverview.bounds, tallOverview.target, { width: 600, height: 420 })
    expect(tallFit.maxDistance).toBeGreaterThan(shortFit.maxDistance)
    for (const mode of ['mechanical', 'drive', 'doors'] as const) {
      const inspection = mode === 'doors' ? getDoorInspection(tall.doors, tall.installation.levels, 'level-10') : undefined
      const frame = getPassengerCameraFrame(mode, tall.installation, tall.components, tall.drive, tall.safety, tall.doors, inspection)
      expect(frame.bounds.height).toBeLessThan(tall.installation.bounds.height)
    }
  })

  it('keeps user ownership across ordinary renders but reframes for meaningful events', () => {
    const base: CameraFrameRequest = { viewMode: 'overview', installationKey: '2-stops', doorSelectionKey: '', viewportKey: '600:420', resetRevision: 0 }
    expect(getCameraFrameTrigger(undefined, base)).toBe('initial')
    const user = transitionCameraInteraction('auto', 'user-interaction')
    expect(user).toEqual({ state: 'user', reframe: false })
    expect(transitionCameraInteraction(user.state, getCameraFrameTrigger(base, { ...base }))).toEqual({ state: 'user', reframe: false })
    expect(transitionCameraInteraction(user.state, getCameraFrameTrigger(base, { ...base, viewMode: 'drive' })).reframe).toBe(true)
    expect(transitionCameraInteraction(user.state, getCameraFrameTrigger(base, { ...base, installationKey: '10-stops' })).reframe).toBe(true)
    expect(transitionCameraInteraction(user.state, getCameraFrameTrigger(base, { ...base, resetRevision: 1 }))).toEqual({ state: 'auto', reframe: true })
    const short = setup(2), tall = setup(10)
    expect(getPassengerCameraInstallationKey(short.installation, short.components, short.drive, short.safety, short.doors))
      .not.toBe(getPassengerCameraInstallationKey(tall.installation, tall.components, tall.drive, tall.safety, tall.doors))
  })

  it('restores the canonical three-quarter orientation with Y-up and inversion-safe polar limits', () => {
    const target = [metres(1), metres(4), metres(-2)] as const
    const fit = calculateCameraFit(bounds(2, 6, 2), target, { width: 600, height: 420 })
    const direction = fit.position.map((value, index) => (value - target[index]) / fit.distance)
    direction.forEach((value, index) => expect(value).toBeCloseTo(CAMERA_DEFAULT_DIRECTION[index]))
    expect(fit.up).toEqual(CAMERA_WORLD_UP)
    expect(CAMERA_WORLD_UP).toEqual([0, 1, 0])
    expect(CAMERA_MIN_POLAR_ANGLE).toBeGreaterThan(0)
    expect(CAMERA_MAX_POLAR_ANGLE).toBeLessThan(Math.PI)
    expect(CAMERA_MAX_POLAR_ANGLE).toBeGreaterThan(Math.PI / 2)
  })
})
