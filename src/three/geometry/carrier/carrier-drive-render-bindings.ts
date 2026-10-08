import { BufferAttribute,Line,type Object3D } from 'three'
import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import { createCarrierDriveMotionPlan } from './carrier-drive-motion'

/** Compile mesh identities/attributes once. No per-tick geometry/model/array creation. */
export function bindCarrierDriveScene(drive:CarrierDriveScene | undefined,nodes:ReadonlyMap<string,Object3D>) {
  const plan = createCarrierDriveMotionPlan(drive)
  const parts = plan.parts.flatMap((part)=>{
    const node = nodes.get(`${part.extends ? 'drive-shape' : 'drive-motion'}-${part.id}`)
    return node && part.factor !== undefined ? [{...part,node,factor:part.factor}] : []
  })
  const routes = plan.routes.flatMap((route)=>{
    const node = nodes.get(route.id)
    const attribute = node instanceof Line ? node.geometry.getAttribute('position') : undefined
    if (node) node.frustumCulled=false
    return attribute instanceof BufferAttribute ? [{...route,attribute}] : []
  })
  let previousOffset: number | undefined
  return (offset:number)=>{
    if (offset === previousOffset) return
    previousOffset=offset
    for (const part of parts) {
      const shift = offset*part.factor
      if (part.extends) {part.node.position.y=part.centerY+shift/2;part.node.scale.y=(part.height+shift)/part.height}
      else part.node.position.y=shift
    }
    for (const route of routes) {
      for (let index=0;index<route.points.length;index++) {
        const point = route.points[index]
        route.attribute.setXYZ(index,point.base[0],point.base[1]+offset*(point.factor ?? 0),point.base[2])
      }
      route.attribute.needsUpdate=true
    }
  }
}
