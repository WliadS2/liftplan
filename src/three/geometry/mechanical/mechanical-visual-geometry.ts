import { BoxGeometry,CylinderGeometry,EdgesGeometry,ExtrudeGeometry,LatheGeometry,LineBasicMaterial,MeshStandardMaterial,Shape,Vector2,type BufferGeometry } from 'three'
import { MECHANICAL_MATERIALS } from '../../materials/technical-materials'
import type { MechanicalVisualModel,MechanicalVisualPiece,VisualVector } from './mechanical-visual-model'

export const MECHANICAL_RADIAL_SEGMENTS = 24
export const visualAxisRotation = (axis:'x'|'y'|'z'):VisualVector => axis === 'y' ? [0,0,0] : axis === 'z' ? [Math.PI/2,0,0] : [0,0,-Math.PI/2]

/** Geometry is local to a stable parent attachment; no engineering or motion decisions. */
export function createMechanicalPieceGeometry(piece:MechanicalVisualPiece):BufferGeometry {
  if (piece.kind === 'box') return new BoxGeometry(1,1,1)
  if (piece.kind === 'cylinder') return new CylinderGeometry(1,1,1,MECHANICAL_RADIAL_SEGMENTS)
  if (piece.kind === 'revolved') return new LatheGeometry(piece.section.map(p=>new Vector2(...p)),MECHANICAL_RADIAL_SEGMENTS)
  const shape = new Shape()
  piece.section.forEach(([u,v],index)=>index === 0 ? shape.moveTo(u,v) : shape.lineTo(u,v))
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape,{depth:piece.length,steps:1,bevelEnabled:false,curveSegments:1})
  geometry.translate(0,0,-piece.length/2)
  // Local Y is the common extrusion/revolution axis at the renderer boundary.
  geometry.rotateX(Math.PI/2)
  return geometry
}
export function visualPieceScale(piece:MechanicalVisualPiece):VisualVector {
  return piece.kind === 'box' ? piece.size : piece.kind === 'cylinder' ? [piece.radius,piece.length,piece.radius] : [1,1,1]
}
export const mechanicalGeometryKey = (p:MechanicalVisualPiece) => p.kind === 'box' || p.kind === 'cylinder' ? p.kind
  : JSON.stringify(p.kind === 'revolved' ? [p.kind,p.section] : [p.kind,p.section,p.length])

/** Owned per static assembly. Reuses unit boxes/cylinders, repeated profiles and role materials. */
export function createMechanicalVisualResources(models:readonly MechanicalVisualModel[],opacity=1) {
  const geometry = new Map<string,BufferGeometry>(),edges = new Map<string,EdgesGeometry>()
  const materials = new Map<string,MeshStandardMaterial>()
  const edgeMaterial = new LineBasicMaterial({color:'#34444d',transparent:true,opacity:opacity*0.45})
  for (const piece of models.flatMap(m=>m.pieces)) {
    const key = mechanicalGeometryKey(piece)
    if (!geometry.has(key)) {
      const shape = createMechanicalPieceGeometry(piece);geometry.set(key,shape)
      if (piece.kind === 'box' || piece.kind === 'profile') edges.set(key,new EdgesGeometry(shape,35))
    }
    if (!materials.has(piece.material)) materials.set(piece.material,new MeshStandardMaterial({
      ...MECHANICAL_MATERIALS[piece.material],opacity,transparent:opacity < 1,depthWrite:opacity >= 1,
    }))
  }
  return {geometry,edges,materials,edgeMaterial,dispose:()=>{
    geometry.forEach(g=>g.dispose());edges.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());edgeMaterial.dispose()
  }}
}
