import { millimetres as mm } from '../../engineering'
import type { CarrierMechanicalPlanning } from '../../elevator/configuration/carrier-mechanical-planning'

/** Synthetic QA sections only. No manufacturer, engineering approval or default data. */
export function createCarrierMechanicalDemo(family: 'goods' | 'car'): CarrierMechanicalPlanning {
  return {
    source: 'demo', floorThicknessMm: mm(80),
    frame: { orientation: 'x', spacingMm: mm(family === 'goods' ? 1980 : 2880),
      uprightWidthMm: mm(80), uprightDepthMm: mm(120), lowerMemberHeightMm: mm(120), upperMemberHeightMm: mm(160) },
    rails: { widthMm: mm(40), depthMm: mm(50) },
    shoes: { widthMm: mm(140), heightMm: mm(100), depthMm: mm(100), lowerInsetMm: mm(200), upperInsetMm: mm(200) },
    buffers: [-1,1].map((sign,index)=>({
      id: `support-${index+1}`, xMm: mm(sign*(family === 'goods' ? 500 : 900)), zMm: mm(0),
      baseWidthMm: mm(220), baseDepthMm: mm(220), baseHeightMm: mm(40),
      bodyWidthMm: mm(130), bodyDepthMm: mm(130), bodyHeightMm: mm(260),
      contactWidthMm: mm(180), contactDepthMm: mm(180), contactHeightMm: mm(30),
    })),
  }
}
