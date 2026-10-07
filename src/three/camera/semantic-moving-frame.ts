import type { CameraBounds, CameraFrame, CameraVector } from './camera-fit'

/** Presentation-only local carrier frame; never an installation-overview policy or engineering envelope. */
export function getSemanticMovingFrame(bounds: CameraBounds, direction?: CameraVector,
  context?: CameraBounds): CameraFrame {
  if (!context) return { bounds, target: bounds.center, direction }
  const min: CameraVector = [Math.min(bounds.min[0], context.min[0]), bounds.min[1] - bounds.height / 2,
    Math.min(bounds.min[2], context.min[2])]
  const max: CameraVector = [Math.max(bounds.max[0], context.max[0]), bounds.max[1] + bounds.height / 2,
    Math.max(bounds.max[2], context.max[2])]
  return { bounds: { min, max, center: bounds.center, width: max[0]-min[0], height: max[1]-min[1], depth: max[2]-min[2] },
    target: bounds.center, direction }
}
