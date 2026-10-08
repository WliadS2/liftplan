import { BufferAttribute,Line,Vector3,type Object3D } from 'three'
import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import { createCarrierDriveMotionPlan,driveRouteSegmentName } from './carrier-drive-motion'

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
    const segments = route.points.slice(1).flatMap((_,index)=>{
      const mesh = nodes.get(driveRouteSegmentName(route.id,index))
      return mesh ? [{node:mesh,index}] : []
    })
    return attribute instanceof BufferAttribute ? [{...route,attribute,segments}] : []
  })
  const up = new Vector3(0,1,0),direction = new Vector3(),start = new Vector3(),end = new Vector3()
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
      for (const segment of route.segments) {
        start.fromBufferAttribute(route.attribute,segment.index);end.fromBufferAttribute(route.attribute,segment.index+1)
        direction.subVectors(end,start)
        const length = direction.length()
        segment.node.visible=length > 0
        if (!length) continue
        segment.node.position.copy(start).add(end).multiplyScalar(0.5)
        segment.node.quaternion.setFromUnitVectors(up,direction.divideScalar(length))
        segment.node.scale.y=length
      }
    }
  }
}
