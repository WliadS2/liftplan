import { useEffect,useMemo } from 'react'
import { BufferAttribute,BufferGeometry,CylinderGeometry,Line as ThreeLine,LineBasicMaterial,MeshStandardMaterial,Quaternion,Vector3 } from 'three'
import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import { TechnicalEnvelope } from '../TechnicalEnvelope'
import { driveAppearance } from './drive-presentation'
import { MechanicalVisualMeshes } from '../mechanical/MechanicalVisualMeshes'
import { resolveDriveRouteDiameter,resolveMechanicalVisual } from '../mechanical/resolve-mechanical-visual'
import { MECHANICAL_MATERIALS } from '../../materials/technical-materials'
import { driveRouteSegmentName } from './carrier-drive-motion'
import { withMechanicalVisualContext } from '../mechanical/mechanical-visual-model'

function DrivePart({part,parts}:{readonly part:CarrierDriveScene['parts'][number];readonly parts:CarrierDriveScene['parts']}) {
  const appearance = driveAppearance(part.kind)
  const model = useMemo(()=>resolveMechanicalVisual(withMechanicalVisualContext(part,parts)),[part,parts])
  return <group name={`drive-motion-${part.id}`}>
    <group name={`drive-shape-${part.id}`} position={part.center}>
      <MechanicalVisualMeshes model={model} opacity={part.kind === 'hydraulic-cylinder' ? appearance.opacity : 1}/>
      {model.status === 'envelope' && <TechnicalEnvelope size={part.size} color={appearance.color} opacity={0.6} lineWidth={1}/>}
    </group>
  </group>
}

function DriveRoute({route,diameter}:{readonly route:CarrierDriveScene['routes'][number];readonly diameter?:number}) {
  const object = useMemo(()=>{
    const geometry = new BufferGeometry()
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(route.points.flatMap((p)=>[...p.position])),3))
    const material = new LineBasicMaterial({color:route.kind === 'monitoring' ? '#896e48' : '#394c59'})
    const line = new ThreeLine(geometry,material)
    line.name = route.id
    return line
  },[route])
  const tubes = useMemo(()=>diameter === undefined ? undefined : {
    geometry:new CylinderGeometry(1,1,1,8),material:new MeshStandardMaterial(MECHANICAL_MATERIALS.rope),
    segments:route.points.slice(1).map((point,index)=>{
      const start = new Vector3(...route.points[index].position),end = new Vector3(...point.position),direction = end.clone().sub(start)
      return {center:start.clone().add(end).multiplyScalar(0.5),length:direction.length(),
        rotation:new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.normalize())}
    }),
  },[route,diameter])
  useEffect(()=>()=>{object.geometry.dispose();object.material.dispose()},[object])
  useEffect(()=>()=>{tubes?.geometry.dispose();tubes?.material.dispose()},[tubes])
  return <group dispose={null}>
    <primitive object={object} visible={!tubes}/>
    {tubes?.segments.map((segment,index)=><mesh key={index} name={driveRouteSegmentName(route.id,index)}
      geometry={tubes.geometry} material={tubes.material} position={segment.center} quaternion={segment.rotation}
      scale={[diameter!/2,segment.length,diameter!/2]} visible={segment.length > 0} userData={{visualSource:'demo'}}/>)}
  </group>
}

/** Schematic envelopes, not manufactured parts. Normalized scene values are never adjusted here. */
export function CarrierDriveAssembly({drive,visibleIds,mode}:{readonly drive?:CarrierDriveScene;
  readonly visibleIds:ReadonlySet<string>;readonly mode:string}) {
  if (!drive) return null
  const showSuspension = ['overview','drive','cutaway'].includes(mode)
  const showMonitoring = ['overview','safety','cutaway'].includes(mode)
  return <group name="carrier-drive-assembly">
    {drive.parts.filter((part)=>visibleIds.has(part.id)).map((part)=><DrivePart key={part.id} part={part} parts={drive.parts}/>)}
    {drive.routes.filter((r)=>r.kind === 'suspension' ? showSuspension : showMonitoring).map((route)=><DriveRoute key={route.id} route={route}
      diameter={resolveDriveRouteDiameter(drive,route.id)}/>)}
  </group>
}
