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

export interface PassengerElevatorAssemblyProps {
  readonly model: PassengerInstallationModel
  readonly mechanicalLayout: PassengerMechanicalLayout
  readonly mechanicalComponents: PassengerMechanicalComponentModel
  readonly viewMode: ThreeViewMode
}

export function PassengerElevatorAssembly({
  model,
  mechanicalLayout,
  mechanicalComponents,
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
        cabin={model.cabin}
        footprint={model.levelFootprint}
        levels={model.levels}
        shaft={model.shaft}
        opacity={visibility.landingOpacity}
      />
      <PassengerMechanicalAssembly
        layout={mechanicalLayout}
        components={mechanicalComponents}
        opacity={visibility.mechanicalOpacity}
      />
      {model.cabin && <Cabin key={`cabin-${viewMode}`} cabin={model.cabin} viewMode={viewMode} />}
    </group>
  )
}
