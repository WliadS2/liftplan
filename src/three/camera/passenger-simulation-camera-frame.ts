import { metres } from '../../engineering'
import type { SimulationPose } from '../../simulation/passenger-simulation'
import type { PassengerSimulationInputs } from '../../simulation/passenger-simulation-model'
import { createMechanicalBounds, type MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import type { ThreeViewMode } from '../scene/view-mode'
import type { PassengerCameraFrame } from './passenger-camera-bounds'

const shifted = (bounds: MechanicalBounds, offsetY: number) => createMechanicalBounds([bounds.min, bounds.max].map((point) => [point[0], metres(point[1] + offsetY), point[2]]))

/** Sample current runtime pose only on an explicit framing event; never follow the moving cabin every frame. */
export function getPassengerSimulationCameraFrame(mode: ThreeViewMode, fallback: PassengerCameraFrame, inputs: PassengerSimulationInputs, pose: SimulationPose): PassengerCameraFrame {
  if (mode !== 'mechanical' && mode !== 'cutaway') return fallback
  const car = inputs.components.carSling?.bounds, cw = inputs.components.counterweightFrame?.bounds
  const bounds = createMechanicalBounds([
    ...car ? [shifted(car, pose.cabinOffsetY)] : [],
    ...(cw && pose.counterweightOffsetY !== undefined ? [shifted(cw, pose.counterweightOffsetY)] : []),
    ...inputs.doors.cabin.map((entry) => shifted(entry.bounds, pose.cabinOffsetY)),
    ...inputs.safety.linkage ? [shifted(inputs.safety.linkage.bounds, pose.cabinOffsetY)] : [],
  ].flatMap((entry) => [entry.min, entry.max]))
  return { bounds, target: mode === 'cutaway' ? [metres(0), metres(pose.cabinY + (inputs.installation.cabin?.height ?? 0) / 2), metres(0)] : bounds.center }
}
