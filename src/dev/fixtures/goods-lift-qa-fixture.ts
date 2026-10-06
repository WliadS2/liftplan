import { createGoodsLiftPlanningConfiguration, type GoodsLiftPlanningConfiguration } from '../../elevator'
import { kilograms, metresPerSecond, millimetres as mm } from '../../engineering'

/** Deterministic development planning data, never production defaults or engineering recommendations. */
export function createGoodsLiftQaFixture(): GoodsLiftPlanningConfiguration {
  return {
    ...createGoodsLiftPlanningConfiguration('Warenaufzug-Demo – Testdaten'),
    ratedLoadKg: kilograms(2500), nominalSpeedMetresPerSecond: metresPerSecond(0.8),
    stopCount: 6, storeyHeightsMm: Array.from({ length: 5 }, () => mm(3000)),
    platformWidthMm: mm(1800), platformDepthMm: mm(2400), platformHeightMm: mm(2300),
    shaftWidthMm: mm(2600), shaftDepthMm: mm(3000), pitDepthMm: mm(1000), headroomMm: mm(1500),
    doorWidthMm: mm(1600), doorHeightMm: mm(2200),
    frontAccess: true, rearAccess: true, throughCar: true, loadCategory: 'mixed',
    guideSystem: { orientation: 'x', spacingMm: mm(2100) },
    pallet: { widthMm: mm(1200), depthMm: mm(800), heightMm: mm(1600) },
    rollContainer: { widthMm: mm(800), depthMm: mm(1200), heightMm: mm(1800) },
    forkliftEnvelope: { widthMm: mm(1500), depthMm: mm(2200), heightMm: mm(2200) },
  }
}
