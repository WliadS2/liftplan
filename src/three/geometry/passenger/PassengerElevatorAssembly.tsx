import { Cabin } from './Cabin'
import { Counterweight } from './Counterweight'
import { GuideRails } from './GuideRails'
import { LandingLevels } from './LandingLevels'
import { Pit, Shaft } from './Shaft'
import type { PassengerInstallationModel } from './passenger-installation-model'

export interface PassengerElevatorAssemblyProps {
  readonly model: PassengerInstallationModel
}

export function PassengerElevatorAssembly({
  model,
}: PassengerElevatorAssemblyProps) {
  return (
    <group>
      {model.shaft && <Shaft shaft={model.shaft} />}
      {model.pit && <Pit pit={model.pit} />}
      <LandingLevels
        cabin={model.cabin}
        footprint={model.levelFootprint}
        levels={model.levels}
        shaft={model.shaft}
      />
      {model.guideRails && <GuideRails guideRails={model.guideRails} />}
      {model.counterweight && (
        <Counterweight counterweight={model.counterweight} />
      )}
      {model.cabin && <Cabin cabin={model.cabin} />}
    </group>
  )
}
