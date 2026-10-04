import type { PassengerCabinModel, PassengerEntranceModel } from '../passenger-installation-model'
import { visualizationWallThickness } from '../visualization-geometry'
import { drivePoint as p } from '../mechanical/drive-geometry'
import type { MechanicalPoint } from '../mechanical/passenger-mechanical-layout'

/** Existing visualization-only shell thickness; never used as a door/component dimension. */
export function createCabinEntranceShell(cabin: PassengerCabinModel, entrance: PassengerEntranceModel): readonly {
  readonly id: string; readonly center: MechanicalPoint; readonly size: MechanicalPoint
}[] {
  const thickness = Math.min(visualizationWallThickness, cabin.depth / 4)
  const z = (entrance.side === 'front' ? 1 : -1) * (cabin.depth / 2 - thickness / 2)
  const { width, height } = entrance.opening
  const leftEdge = entrance.centerX - width / 2, rightEdge = entrance.centerX + width / 2
  const leftWidth = leftEdge + cabin.width / 2, rightWidth = cabin.width / 2 - rightEdge, headerHeight = cabin.height - height
  return [
    ...(leftWidth > 0 ? [{ id: 'left-shell', center: p(-cabin.width / 2 + leftWidth / 2, cabin.bottomY + height / 2, z), size: p(leftWidth, height, thickness) }] : []),
    ...(rightWidth > 0 ? [{ id: 'right-shell', center: p(rightEdge + rightWidth / 2, cabin.bottomY + height / 2, z), size: p(rightWidth, height, thickness) }] : []),
    ...(headerHeight > 0 ? [{ id: 'header-shell', center: p(0, cabin.bottomY + height + headerHeight / 2, z), size: p(cabin.width, headerHeight, thickness) }] : []),
  ]
}
