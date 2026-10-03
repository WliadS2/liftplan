import { Cabin } from './Cabin'
import { LandingLevels } from './LandingLevels'
import { Pit, Shaft } from './Shaft'
import {
  getPassengerViewVisibility,
  type ThreeViewMode,
} from '../../scene/view-mode'
import { PassengerMechanicalAssembly } from './mechanical/PassengerMechanicalAssembly'
import type { PassengerMechanicalLayout } from './mechanical/passenger-mechanical-layout'
import type { PassengerInstallationModel } from './passenger-installation-model'

export interface PassengerElevatorAssemblyProps {
  readonly model: PassengerInstallationModel
  readonly mechanicalLayout: PassengerMechanicalLayout
  readonly viewMode: ThreeViewMode
}

export function PassengerElevatorAssembly({
  model,
  mechanicalLayout,
  viewMode,
}: PassengerElevatorAssemblyProps) {
  const visibility = getPassengerViewVisibility(viewMode)

  return (
    <group>
      {model.shaft && <Shaft shaft={model.shaft} viewMode={viewMode} />}
      {model.pit && <Pit pit={model.pit} />}
      <LandingLevels
        cabin={model.cabin}
        footprint={model.levelFootprint}
        levels={model.levels}
        shaft={model.shaft}
      />
      <PassengerMechanicalAssembly
        layout={mechanicalLayout}
        opacity={visibility.mechanicalOpacity}
      />
      {model.cabin && <Cabin cabin={model.cabin} viewMode={viewMode} />}
    </group>
  )
}
