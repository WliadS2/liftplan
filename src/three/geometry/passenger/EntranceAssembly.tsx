import { getPassengerViewVisibility, type ThreeViewMode } from '../../scene/view-mode'
import { CabinWall } from './CabinWall'
import type { PassengerCabinModel, PassengerEntranceModel } from './passenger-installation-model'
import { createCabinEntranceShell } from './doors/cabin-entrance-shell'

/** Shell opening only. Manufactured door parts belong to the normalized door subsystem. */
export function EntranceAssembly({ cabin, entrance, viewMode }: {
  readonly cabin: PassengerCabinModel; readonly entrance: PassengerEntranceModel; readonly viewMode: ThreeViewMode
}) {
  const visibility = getPassengerViewVisibility(viewMode)
  const shell = createCabinEntranceShell(cabin, entrance)
  return <group>{shell.map((part) => <CabinWall key={part.id} dimensions={part.size} position={part.center}
    visible={entrance.side !== 'front' || visibility.showFrontWallSections} opacity={visibility.cabinShellOpacity} />)}</group>
}
