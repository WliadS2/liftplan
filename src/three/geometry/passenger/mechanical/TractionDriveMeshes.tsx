import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { MECHANICAL_MATERIALS } from '../../../materials/technical-materials'
import { ComponentBoxes } from './MechanicalComponentMeshes'
import { createSheaveGeometry, createSuspensionRopeGeometry } from './traction-geometry'
import type { TractionDriveModel } from './traction-drive-model'

export function TractionDriveMeshes({ model }: { readonly model: TractionDriveModel }) {
  const resources = useMemo(() => ({
    sheaves: model.sheaves.map((s) => createSheaveGeometry(s)),
    ropes: model.suspension?.ropes.map(createSuspensionRopeGeometry) ?? [],
  }), [model])
  const materials = useMemo(() => Object.fromEntries(Object.entries(MECHANICAL_MATERIALS)
    .map(([role, values]) => [role, new MeshStandardMaterial(values)])), [])
  useEffect(() => () => { resources.sheaves.forEach((g) => g.dispose()); resources.ropes.forEach((g) => g.dispose()) }, [resources])
  useEffect(() => () => { Object.values(materials).forEach((m) => m.dispose()) }, [materials])
  const boxes = useMemo(() => [...model.supports, ...(model.machine?.boxes ?? []), ...model.hitches.map((h) => h.plate)], [model])
  const cylinders = [...(model.machine?.cylinders ?? []), ...(model.suspension?.terminations ?? [])]
  return <group name="traction-drive">
    <ComponentBoxes parts={boxes} opacity={1} />
    {cylinders.map((c) => <mesh key={c.id} name={c.id} position={c.center} rotation={c.rotation} material={materials[c.material]}>
      <cylinderGeometry args={[c.radius, c.radius, c.length, 20]} />
    </mesh>)}
    {model.sheaves.map((s, i) => <group key={s.id} name={`sheave-${s.id}`} position={s.center} rotation={[0, s.rotationY, 0]}>
      {/* This child can rotate around local Z later without changing the mount transform. */}
      <mesh name={`sheave-rotor-${s.id}`} geometry={resources.sheaves[i]} material={materials.sheave} />
    </group>)}
    {model.suspension?.ropes.map((rope, i) => <mesh key={rope.id} name={rope.id} geometry={resources.ropes[i]} material={materials.rope} />)}
  </group>
}
