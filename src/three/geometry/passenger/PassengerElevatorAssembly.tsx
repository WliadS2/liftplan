import { Cabin } from './Cabin'
import { LandingLevels } from './LandingLevels'
import { Pit, Shaft } from './Shaft'
import {
  getPassengerViewVisibility,
  type ThreeViewMode,
} from '../../scene/view-mode'
import { PassengerMechanicalAssembly } from './mechanical/PassengerMechanicalAssembly'
import type { PassengerMechanicalLayout } from './mechanical/passenger-mechanical-layout'
import type { PassengerMechanicalComponentModel } from './mechanical/mechanical-component-model'
import type { PassengerInstallationModel } from './passenger-installation-model'
import type { TractionDriveModel } from './mechanical/traction-drive-model'
import type { PassengerSafetyModel } from './mechanical/passenger-safety-model'
import type { DoorInspection, PassengerDoorSystemModel } from './doors/passenger-door-model'
import { PassengerDoorMeshes } from './doors/PassengerDoorMeshes'

export interface PassengerElevatorAssemblyProps {
  readonly model: PassengerInstallationModel
  readonly mechanicalLayout: PassengerMechanicalLayout
  readonly mechanicalComponents: PassengerMechanicalComponentModel
  readonly drive: TractionDriveModel
  readonly safety: PassengerSafetyModel
  readonly doors: PassengerDoorSystemModel
  readonly doorInspection: DoorInspection
  readonly viewMode: ThreeViewMode
}

export function PassengerElevatorAssembly({
  model,
  mechanicalLayout,
  mechanicalComponents,
  drive,
  safety,
  doors,
  doorInspection,
  viewMode,
}: PassengerElevatorAssemblyProps) {
  const visibility = getPassengerViewVisibility(viewMode)

  // Recreate only shell materials on mode changes so opaque/transparent shader state resets.
  // The mechanical component subtree and its shared profile geometry remain mounted.
  return (
    <group>
      {model.shaft && <Shaft key={`shaft-${viewMode}`} shaft={model.shaft} viewMode={viewMode} />}
      {model.pit && <Pit key={`pit-${viewMode}`} pit={model.pit} opacity={visibility.pitOpacity} />}
      <LandingLevels
        key={`landings-${viewMode}`}
        footprint={model.levelFootprint}
        levels={model.levels}
        opacity={visibility.landingOpacity}
      />
      <group visible={visibility.showMechanicalSystems}><PassengerMechanicalAssembly
        layout={mechanicalLayout}
        components={mechanicalComponents}
        drive={drive}
        safety={safety}
        showCounterweight={visibility.showCounterweight}
        showTractionRopes={visibility.showTractionRopes}
        opacity={visibility.mechanicalOpacity}
      /></group>
      <PassengerDoorMeshes model={doors} inspection={doorInspection} viewMode={viewMode} />
      {model.cabin && <Cabin key={`cabin-${viewMode}`} cabin={model.cabin} viewMode={viewMode} />}
    </group>
  )
}
