import { useEffect,useMemo } from 'react'
import { BufferAttribute,BufferGeometry,Line as ThreeLine,LineBasicMaterial } from 'three'
import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import { TechnicalEnvelope } from '../TechnicalEnvelope'
import { driveAppearance } from './drive-presentation'

function DriveRoute({route}:{readonly route:CarrierDriveScene['routes'][number]}) {
  const object = useMemo(()=>{
    const geometry = new BufferGeometry()
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(route.points.flatMap((p)=>[...p.position])),3))
    const material = new LineBasicMaterial({color:route.kind === 'monitoring' ? '#896e48' : '#394c59'})
    const line = new ThreeLine(geometry,material)
    line.name = route.id
    return line
  },[route])
  useEffect(()=>()=>{object.geometry.dispose();object.material.dispose()},[object])
  return <primitive object={object}/>
}

/** Schematic envelopes, not manufactured parts. Normalized scene values are never adjusted here. */
export function CarrierDriveAssembly({drive,visibleIds,mode}:{readonly drive?:CarrierDriveScene;
  readonly visibleIds:ReadonlySet<string>;readonly mode:string}) {
  if (!drive) return null
  const showSuspension = ['overview','drive','cutaway'].includes(mode)
  const showMonitoring = ['overview','safety','cutaway'].includes(mode)
  return <group name="carrier-drive-assembly">
    {drive.parts.filter((part)=>visibleIds.has(part.id)).map((part)=>{
      const appearance = driveAppearance(part.kind)
      return <group name={`drive-motion-${part.id}`} key={part.id}>
        <group name={`drive-shape-${part.id}`} position={part.center}>
          <mesh><boxGeometry args={part.size}/><meshStandardMaterial color={appearance.color} transparent={appearance.opacity < 1}
            opacity={appearance.opacity} depthWrite={appearance.opacity >= 1}/></mesh>
          <TechnicalEnvelope size={part.size} color={appearance.color} opacity={0.9} lineWidth={1.2}/>
        </group>
      </group>
    })}
    {drive.routes.filter((r)=>r.kind === 'suspension' ? showSuspension : showMonitoring).map((route)=><DriveRoute key={route.id} route={route}/>)}
  </group>
}
