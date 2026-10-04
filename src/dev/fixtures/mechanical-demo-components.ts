import { millimetres as mm } from '../../engineering'
import type { MechanicalComponentData } from '../../elevator/configuration/mechanical-component-data'

/** Synthetic component dimensions solely for visual QA. No product catalogue or approved sizing data. */
export function createMechanicalDemoComponents(): MechanicalComponentData {
  return {
    railProfile: {
      source: 'demo', reference: 'visual-qa-t-profile',
      profileDepthMm: mm(85), flangeWidthMm: mm(100), flangeThicknessMm: mm(12),
      webThicknessMm: mm(12), headWidthMm: mm(32), headThicknessMm: mm(18),
    },
    carGuideShoe: {
      source: 'demo', kind: 'sliding', heightMm: mm(160), bodyDepthMm: mm(55),
      wallThicknessMm: mm(12), linerThicknessMm: mm(5), railClearanceMm: mm(1),
      mountingPlateThicknessMm: mm(12), mountingPlateWidthMm: mm(140),
      lowerInsetMm: mm(200), upperInsetMm: mm(80),
    },
    counterweightGuideShoe: {
      source: 'demo', kind: 'sliding', heightMm: mm(160), bodyDepthMm: mm(88),
      wallThicknessMm: mm(12), linerThicknessMm: mm(5), railClearanceMm: mm(1),
      mountingPlateThicknessMm: mm(12), mountingPlateWidthMm: mm(140),
      lowerInsetMm: mm(170), upperInsetMm: mm(170),
    },
    carSling: {
      source: 'demo', uprightWidthMm: mm(80), uprightDepthMm: mm(140),
      channelWallThicknessMm: mm(12), crossheadHeightMm: mm(160), crossheadDepthMm: mm(140),
      lowerMemberHeightMm: mm(160), platformMemberWidthMm: mm(80), platformMemberHeightMm: mm(120),
      railToUprightCentreMm: mm(107),
    },
    counterweightFrame: {
      source: 'demo', sideMemberWidthMm: mm(60), crossMemberHeightMm: mm(90),
      channelWallThicknessMm: mm(12), slabWidthMm: mm(560), slabHeightMm: mm(130),
      slabDepthMm: mm(180), slabGapMm: mm(4), slabCount: 12, stackBottomInsetMm: mm(0),
    },
    carBuffer: {
      source: 'demo', baseWidthMm: mm(240), baseDepthMm: mm(240), baseThicknessMm: mm(30),
      bodyDiameterMm: mm(160), bodyHeightMm: mm(420), plungerDiameterMm: mm(75),
      plungerHeightMm: mm(300), contactDiameterMm: mm(180), contactThicknessMm: mm(30),
    },
    counterweightBuffer: {
      source: 'demo', baseWidthMm: mm(190), baseDepthMm: mm(180), baseThicknessMm: mm(25),
      bodyDiameterMm: mm(130), bodyHeightMm: mm(360), plungerDiameterMm: mm(65),
      plungerHeightMm: mm(280), contactDiameterMm: mm(150), contactThicknessMm: mm(25),
    },
  }
}
