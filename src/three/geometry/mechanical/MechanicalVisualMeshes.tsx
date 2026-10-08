import { useEffect,useMemo } from 'react'
import { createMechanicalVisualResources,mechanicalGeometryKey,visualAxisRotation,visualPieceScale } from './mechanical-visual-geometry'
import type { MechanicalVisualModel } from './mechanical-visual-model'

/** All detail inherits the existing assembly's transform, including hydraulic extension.
 * No animation clock, Zustand access, dimensions or hardware decisions live here. */
export function MechanicalVisualMeshes({model,opacity=1}:{readonly model:MechanicalVisualModel;readonly opacity?:number}) {
  const resources = useMemo(()=>createMechanicalVisualResources([model],opacity),[model,opacity])
  useEffect(()=>()=>resources.dispose(),[resources])
  return <group dispose={null} userData={{visualSource:model.source,visualReference:model.reference,visualStatus:model.status}}>
    {model.pieces.map(piece=>{
      const key = mechanicalGeometryKey(piece)
      return <group key={piece.id} name={`${model.componentId}-visual-${piece.id}`} position={piece.center}
        rotation={piece.kind === 'box' ? [0,0,0] : visualAxisRotation(piece.axis)} scale={visualPieceScale(piece)}>
        <mesh geometry={resources.geometry.get(key)} material={resources.materials.get(piece.material)}/>
        {resources.edges.has(key) && <lineSegments geometry={resources.edges.get(key)} material={resources.edgeMaterial}/>}
      </group>
    })}
  </group>
}
