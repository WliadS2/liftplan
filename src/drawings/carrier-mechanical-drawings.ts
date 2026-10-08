import { millimetres as mm } from '../engineering'
import type { CarrierMechanicalModel } from '../elevator/models/carrier-mechanical-model'
import type { CarrierDriveModel } from '../elevator/models/carrier-drive-model'
import { componentAnnotation,drawingPoint,type TechnicalDrawingPrimitive } from './technical-drawing'

const sectionLabels:Readonly<Record<string,string>> = {
  machine:'Maschinenhülle', 'counterweight-frame':'Gegengewichtsrahmen', 'carrier-frame':'Tragrahmen',
  'hydraulic-cylinder':'Zylinderhülle', 'hydraulic-plunger':'Plunger-Bewegungshülle',
  'safety-gear':'Fangvorrichtung (Hülle)', buffer:'Pufferhülle',
}

/** Orthogonal envelopes at the declared reference floor, not a second mechanical model.
 * Shared by Goods/Auto only; Passenger projections/scale/layout are not touched. */
export function projectCarrierMechanicalPrimitives(family:'goods'|'car',view:'plan'|'section',
  mechanical:CarrierMechanicalModel | undefined,drive:CarrierDriveModel):TechnicalDrawingPrimitive[] {
  const primitives:TechnicalDrawingPrimitive[] = []
  const labeled = new Set<string>()
  for (const part of [...mechanical?.parts ?? [],...drive.parts]) {
    const b = part.bounds, id = `${family}-${part.id}-${view}`
    primitives.push({id,kind:'component-outline',layer:'geometry',role:part.kind === 'guide' || part.kind.includes('rail') ? 'visible' : 'secondary',
      componentId:`${family}-${part.id}`,x:b.minX,y:mm(view === 'plan' ? -b.maxZ : -b.maxY),width:mm(b.maxX-b.minX),
      height:mm(view === 'plan' ? b.maxZ-b.minZ : b.maxY-b.minY)})
    const label = sectionLabels[part.kind]
    if (view === 'section' && label && !labeled.has(part.kind)) {
      labeled.add(part.kind)
      primitives.push(...componentAnnotation(`${id}-label`,label,drawingPoint(b.maxX,-(b.minY+b.maxY)/2),
        drawingPoint(b.maxX,-(b.minY+b.maxY)/2)))
    }
  }
  for (const route of drive.routes) primitives.push({id:`${family}-${route.id}-${view}`,kind:'polyline',role:'hidden',layer:'geometry',
    points:route.points.map((p)=>drawingPoint(p.x,view === 'plan' ? -p.z : -p.y))})
  return primitives
}
