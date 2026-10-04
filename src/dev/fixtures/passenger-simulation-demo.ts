import type { CounterweightPosition } from '../../elevator'
import { millimetres } from '../../engineering'
import type { PassengerVisualizationData } from '../../simulation/passenger-simulation-model'
import { createPassengerMechanicalFixture } from './passenger-mechanical-fixture'

/** Synthetic motion QA data only; never imported by project factories or normal defaults. */
export const PASSENGER_SIMULATION_DEMO_DATA: PassengerVisualizationData = {
  source: 'demo', initialLevelIndex: 0,
  counterweightInitialCenter: { anchor: 'highest-landing', offsetMm: millimetres(1100) },
  timing: { source: 'demo', doorOpeningSeconds: 2, doorClosingSeconds: 2, dwellSeconds: 3,
    travelSeconds: 8, arrivalSeconds: 0.4 },
}

export function createPassengerSimulationFixture(arrangement: CounterweightPosition = 'rear', throughCar = false, stopCount = 2) {
  return {
    ...createPassengerMechanicalFixture(arrangement, throughCar), stopCount,
    // Explicit demo headroom keeps moving hitch endpoints below the fixed top wraps at every served level.
    headroomMm: millimetres(4000),
  }
}
