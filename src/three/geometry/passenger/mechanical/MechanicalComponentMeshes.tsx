import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Matrix4, Vector3, type InstancedMesh } from 'three'
import { MECHANICAL_MATERIALS } from '../../../materials/technical-materials'
import type {
  BufferComponentModel, ComponentBox, DetailedRail, GuideShoeModel,
  MechanicalMaterialRole, PassengerMechanicalComponentModel,
} from './mechanical-component-model'
import { createRailExtrusion } from './rail-extrusion'
import type { ProfilePoint } from './rail-profile'

function ComponentMaterial({ role, opacity }: { readonly role: MechanicalMaterialRole; readonly opacity: number }) {
  return <meshStandardMaterial {...MECHANICAL_MATERIALS[role]} opacity={opacity} transparent={opacity < 1} depthWrite={opacity >= 1} />
}

export function ComponentBoxes({ parts, opacity }: { readonly parts: readonly ComponentBox[]; readonly opacity: number }) {
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <group>{parts.map((part) => (
    <mesh key={part.id} name={part.id} position={part.center} rotation={[0, part.rotationY, 0]} scale={part.size} geometry={geometry}>
      <ComponentMaterial role={part.material} opacity={opacity} />
    </mesh>
  ))}</group>
}

export function ProfiledRails({ rails, opacity, hiddenIds = [] }: { readonly rails: readonly DetailedRail[]; readonly opacity: number; readonly hiddenIds?: readonly string[] }) {
  // Identical profile/length pairs share one extrusion, including the separate rail systems.
  const signature = JSON.stringify([...new Set(rails.map((rail) => JSON.stringify([rail.profile.points, rail.length])))])
  const geometries = useMemo(() => {
    const result = new Map<string, ReturnType<typeof createRailExtrusion>>()
    for (const key of JSON.parse(signature) as string[]) {
      const [points, length] = JSON.parse(key) as [ProfilePoint[], number]
      result.set(key, createRailExtrusion({ points }, length))
    }
    return result
  }, [signature])
  useEffect(() => () => { for (const geometry of geometries.values()) geometry.dispose() }, [geometries])
  return <group>{rails.map((rail) => (
    <mesh key={rail.id} name={rail.id} visible={!hiddenIds.includes(rail.id)} position={rail.origin} rotation={[0, rail.rotationY, 0]}
      geometry={geometries.get(JSON.stringify([rail.profile.points, rail.length]))}>
      <ComponentMaterial role="rail" opacity={opacity} />
    </mesh>
  ))}</group>
}

export function GuideShoes({ shoes, opacity }: { readonly shoes: readonly GuideShoeModel[]; readonly opacity: number }) {
  const parts = useMemo(() => shoes.flatMap((shoe) => shoe.boxes), [shoes])
  return <ComponentBoxes parts={parts} opacity={opacity} />
}

function WeightStack({ slabs, opacity }: { readonly slabs: readonly ComponentBox[]; readonly opacity: number }) {
  const instances = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = instances.current
    if (!mesh) return
    slabs.forEach((slab, i) => {
      const matrix = new Matrix4().makeRotationY(slab.rotationY)
      matrix.scale(new Vector3(...slab.size))
      matrix.setPosition(...slab.center)
      mesh.setMatrixAt(i, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
  }, [slabs])
  return <instancedMesh ref={instances} args={[undefined, undefined, slabs.length]} name="counterweight-weight-stack">
    <boxGeometry args={[1, 1, 1]} />
    <ComponentMaterial role="weight" opacity={opacity} />
  </instancedMesh>
}

export function DetailedBuffers({ buffers, opacity }: { readonly buffers: BufferComponentModel; readonly opacity: number }) {
  return <group>
    <ComponentBoxes parts={buffers.boxes} opacity={opacity} />
    {buffers.cylinders.map((part) => <mesh key={part.id} name={part.id} position={part.center}>
      <cylinderGeometry args={[part.radius, part.radius, part.height, 20]} />
      <ComponentMaterial role={part.material} opacity={opacity} />
    </mesh>)}
  </group>
}

export function MechanicalComponentMeshes({ model, opacity, showCounterweight = true, carOnly = false }: { readonly model: PassengerMechanicalComponentModel; readonly opacity: number; readonly showCounterweight?: boolean; readonly carOnly?: boolean }) {
  const rails = useMemo(() => [...(model.carRails ?? []), ...(model.counterweightRails ?? [])], [model.carRails, model.counterweightRails])
  return <group>
    <group visible={!carOnly}><ProfiledRails rails={rails} opacity={opacity} hiddenIds={showCounterweight ? [] : model.counterweightRails?.map((r) => r.id)} /></group>
    <group name="simulation-car-mechanics">
      {model.carSling && <ComponentBoxes parts={model.carSling.boxes} opacity={opacity} />}
      <GuideShoes shoes={model.carGuideShoes} opacity={opacity} />
    </group>
    <group visible={showCounterweight && !carOnly}>
    <group name="simulation-counterweight-mechanics">
    {model.counterweightFrame && <group>
      <ComponentBoxes parts={model.counterweightFrame.boxes} opacity={opacity} />
      <WeightStack slabs={model.counterweightFrame.slabs} opacity={opacity} />
    </group>}
    <GuideShoes shoes={model.counterweightGuideShoes} opacity={opacity} />
    </group>
    {model.counterweightBuffers && <DetailedBuffers buffers={model.counterweightBuffers} opacity={opacity} />}
    </group>
    <group visible={!carOnly}>{model.carBuffers && <DetailedBuffers buffers={model.carBuffers} opacity={opacity} />}</group>
  </group>
}
