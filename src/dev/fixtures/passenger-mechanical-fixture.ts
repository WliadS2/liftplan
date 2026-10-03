import {
  createPassengerPlanningConfiguration,
  type CounterweightPosition,
  type PassengerPlanningConfiguration,
} from '../../elevator'
import { kilograms, metresPerSecond, millimetres } from '../../engineering'

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
      carRailOrientation: 'x', carRailSpacingMm: millimetres(1500),
      carRailAxisMm: { xMm: millimetres(0), zMm: millimetres(0) },
      counterweightArrangement: arrangement, counterweightOffsetMm: offset,
      counterweightRailSpacingMm: millimetres(900),
      carBufferPositionsMm: [
        { xMm: millimetres(-350), yMm: millimetres(-1200), zMm: millimetres(0) },
        { xMm: millimetres(350), yMm: millimetres(-1200), zMm: millimetres(0) },
      ],
      counterweightBufferPositionsMm: [{ xMm: offset.xMm, yMm: millimetres(-1200), zMm: offset.zMm }],
      machine: {
        positionMm: { xMm: millimetres(-800), yMm: millimetres(5550), zMm: millimetres(-600) },
        envelopeMm: { widthMm: millimetres(500), heightMm: millimetres(450), depthMm: millimetres(550) },
      },
      tractionSheave: {
        positionMm: { xMm: millimetres(-350), yMm: millimetres(5550), zMm: millimetres(-600) },
        diameterMm: millimetres(400),
      },
      suspension: {
        arrangement: '1:1',
        pathPointsMm: [
          { xMm: millimetres(-350), yMm: millimetres(2250), zMm: millimetres(0) },
          { xMm: millimetres(-350), yMm: millimetres(5350), zMm: millimetres(-600) },
          { xMm: millimetres(-350), yMm: millimetres(5750), zMm: millimetres(-600) },
          { xMm: offset.xMm, yMm: millimetres(5350), zMm: offset.zMm },
          { xMm: offset.xMm, yMm: millimetres(2000), zMm: offset.zMm },
        ],
      },
    },
  }
}
