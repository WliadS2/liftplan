import { metres } from '../../engineering'
import type { SimulationPose } from '../../simulation/passenger-simulation'
import type { PassengerSimulationInputs } from '../../simulation/passenger-simulation-model'
import { createMechanicalBounds, type MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import type { ThreeViewMode } from '../scene/view-mode'
import type { PassengerCameraFrame } from './passenger-camera-bounds'
import { PASSENGER_CAMERA_POLICIES } from './view-camera-policy'

const shifted = (bounds: MechanicalBounds, offsetY: number) => createMechanicalBounds([bounds.min, bounds.max].map((point) => [point[0], metres(point[1] + offsetY), point[2]]))

/** Pure explicit-frame sampling. Runtime tracking uses the same rigid offset in AutoFitCamera,
 * not a changing fit or a combined car/counterweight centre. */
export function getPassengerSimulationCameraFrame(mode: ThreeViewMode, fallback: PassengerCameraFrame, inputs: PassengerSimulationInputs, pose: SimulationPose): PassengerCameraFrame {
  if (!inputs.installation.cabin || PASSENGER_CAMERA_POLICIES[mode] !== 'moving-detail') return fallback
  return { ...fallback, bounds: shifted(fallback.bounds, pose.cabinOffsetY),
    target: [fallback.target[0], metres(fallback.target[1] + pose.cabinOffsetY), fallback.target[2]] }
}
