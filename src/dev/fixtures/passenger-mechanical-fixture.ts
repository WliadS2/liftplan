import {
  createPassengerPlanningConfiguration,
  type CounterweightPosition,
  type PassengerPlanningConfiguration,
} from '../../elevator'
import { kilograms, metresPerSecond, millimetres } from '../../engineering'
import { createMechanicalDemoComponents } from './mechanical-demo-components'
import { createTractionDriveDemo } from './traction-drive-demo'
import { createPassengerSafetyDemo } from './passenger-safety-demo'

// Demo/test coordinates only. Never imported by production default factories or the project store.
export function createPassengerMechanicalFixture(
  arrangement: CounterweightPosition = 'rear',
): PassengerPlanningConfiguration {
  const offsets = {
    rear: { xMm: millimetres(0), yMm: millimetres(0), zMm: millimetres(-1150) },
    left: { xMm: millimetres(-1050), yMm: millimetres(0), zMm: millimetres(0) },
    right: { xMm: millimetres(1050), yMm: millimetres(0), zMm: millimetres(0) },
  }
  const offset = offsets[arrangement]
  const drive = createTractionDriveDemo(arrangement)
  return {
    ...createPassengerPlanningConfiguration('Mechanische Demo – Testdaten'),
    capacityKg: kilograms(630), passengerCount: 8,
    ratedSpeedMetresPerSecond: metresPerSecond(1), stopCount: 2,
    cabinWidthMm: millimetres(1100), cabinDepthMm: millimetres(1400), cabinHeightMm: millimetres(2200),
    doorWidthMm: millimetres(900), doorHeightMm: millimetres(2100), throughCar: false,
    shaftWidthMm: millimetres(2600), shaftDepthMm: millimetres(3000),
    floorHeightMm: millimetres(3000), pitDepthMm: millimetres(1200), headroomMm: millimetres(3000),
    counterweightWidthMm: millimetres(700), counterweightHeightMm: millimetres(1800), counterweightDepthMm: millimetres(220),
    counterweightPosition: arrangement,
    mechanical: {
      components: createMechanicalDemoComponents(),
      drive,
      safety: createPassengerSafetyDemo(drive),
      carRailOrientation: 'x', carRailSpacingMm: millimetres(1500),
      carRailAxisMm: { xMm: millimetres(0), zMm: millimetres(0) },
      counterweightArrangement: arrangement, counterweightOffsetMm: offset,
      counterweightRailSpacingMm: millimetres(900),
      carBufferPositionsMm: [
        { xMm: millimetres(-350), yMm: millimetres(-1200), zMm: millimetres(0) },
        { xMm: millimetres(350), yMm: millimetres(-1200), zMm: millimetres(0) },
      ],
      counterweightBufferPositionsMm: [{ xMm: offset.xMm, yMm: millimetres(-1200), zMm: offset.zMm }],
    },
  }
}
