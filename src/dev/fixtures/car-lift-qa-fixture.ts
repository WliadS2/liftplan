import { createCarLiftPlanningConfiguration, createCenteredVehiclePosition, type CarLiftPlanningConfiguration } from '../../elevator'
import { kilograms, metresPerSecond, millimetres as mm } from '../../engineering'
import { createCarrierMechanicalDemo } from './carrier-mechanical-demo'
import { createCarHydraulicDemo,createCarrierSafetyDemo } from './carrier-drive-demo'

/** Development planning data only: no manufacturer, certified or regulatory provenance. */
export function createCarLiftQaFixture(): CarLiftPlanningConfiguration {
  return {
    ...createCarLiftPlanningConfiguration('Autoaufzug-Demo – Testdaten'),
    ratedLoadKg: kilograms(3000), nominalSpeedMetresPerSecond: metresPerSecond(0.5),
    stopCount: 6, storeyHeightsMm: Array.from({ length: 5 }, () => mm(2800)),
    platformWidthMm: mm(2800), platformDepthMm: mm(5600), usableHeightMm: mm(2400),
    vehicleLoadingDirection: 'shaft-z', shaftWidthMm: mm(3200), shaftDepthMm: mm(6200),
    pitDepthMm: mm(1000), headroomMm: mm(1400),
    doorClearWidthMm: mm(2600), doorClearHeightMm: mm(2300),
    frontAccess: true, rearAccess: true, throughCar: true,
    guideSystem: { orientation: 'x', spacingMm: mm(3000) },
    mechanical: createCarrierMechanicalDemo('car'),
    drive:createCarHydraulicDemo(),safety:createCarrierSafetyDemo('car'),
    vehicle: { widthMm: mm(1800), lengthMm: mm(4500), heightMm: mm(1600), massKg: kilograms(1800),
      frontOverhangMm: mm(900), rearOverhangMm: mm(900), wheelbaseMm: mm(2700), trackWidthMm: mm(1500) },
    vehiclePosition: createCenteredVehiclePosition(),
    entryApproachEnvelope: { widthMm: mm(2400), lengthMm: mm(3000), heightMm: mm(2100),
      longitudinalOffsetMm: mm(4300), lateralOffsetMm: mm(0), headingDegrees: 0 },
    exitApproachEnvelope: { widthMm: mm(2400), lengthMm: mm(3000), heightMm: mm(2100),
      longitudinalOffsetMm: mm(-4300), lateralOffsetMm: mm(0), headingDegrees: 0 },
    vehicleSweptEnvelope: { widthMm: mm(2000), lengthMm: mm(4700), heightMm: mm(1800),
      longitudinalOffsetMm: mm(0), lateralOffsetMm: mm(0), headingDegrees: 0 },
    doorPassageEnvelope: { clearWidthMm: mm(2300), clearHeightMm: mm(2100), depthMm: mm(1500) },
  }
}
