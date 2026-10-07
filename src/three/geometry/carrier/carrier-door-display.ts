/** Small display-only metre-space sections. Never engineering, validation or drawing dimensions. */
import type { CarrierDoorLayout } from './carrier-door-model'

export const CARRIER_DOOR_DISPLAY = Object.freeze({ frameSection: 0.025, frameDepth: 0.04,
  sillHeight: 0.018, sillDepth: 0.08, trackHeight: 0.025, leafThickness: 0.012 })

type DisplayVector = readonly [number,number,number]
export function createCarrierDoorSymbol(door: CarrierDoorLayout) {
  const v = CARRIER_DOOR_DISPLAY, w = door.width, h = door.height
  const section = (id: string, size: DisplayVector, center: DisplayVector, material: 'doorFrame' | 'doorSill' = 'doorFrame') =>
    ({ id:`${door.id}-${id}`,size,center,material,source:'visualization' as const })
  return {
    sections: [
      section('jamb-left',[v.frameSection,h+v.frameSection,v.frameDepth],[-w/2-v.frameSection/2,v.frameSection/2,0]),
      section('jamb-right',[v.frameSection,h+v.frameSection,v.frameDepth],[w/2+v.frameSection/2,v.frameSection/2,0]),
      section('header',[w+2*v.frameSection,v.frameSection,v.frameDepth],[0,h/2+v.frameSection/2,0]),
      section('threshold',[w,v.sillHeight,v.sillDepth],[0,-h/2-v.sillHeight/2,0],'doorSill'),
      section('track-symbol',[2*w,v.trackHeight,v.frameDepth],[0,h/2+v.frameSection+v.trackHeight/2,0]),
    ],
    leaves: [-1,1].map((sign,index)=>({ id:`${door.id}-visual-panel-${index}`,motionId:`${door.id}-panel-motion-${index}`,
      size:[w/2,h,v.leafThickness] as DisplayVector,center:[sign*w/4,0,0] as DisplayVector,source:'visualization' as const })),
  }
}
