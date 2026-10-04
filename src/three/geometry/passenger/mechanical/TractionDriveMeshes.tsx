import { useEffect, useMemo } from 'react'
import { Line } from '@react-three/drei'
import { MeshStandardMaterial } from 'three'
import { MECHANICAL_MATERIALS } from '../../../materials/technical-materials'
import { ComponentBoxes } from './MechanicalComponentMeshes'
import { createSheaveGeometry } from './traction-geometry'
import type { TractionDriveModel } from './traction-drive-model'
import { DynamicCableMeshes } from './DynamicCableMeshes'

export function TractionDriveMeshes({ model, showRopes = true }: { readonly model: TractionDriveModel; readonly showRopes?: boolean }) {
  const resources = useMemo(() => ({
    sheaves: model.sheaves.map((s) => createSheaveGeometry(s)),
  }), [model])
  const materials = useMemo(() => Object.fromEntries(Object.entries(MECHANICAL_MATERIALS)
    .map(([role, values]) => [role, new MeshStandardMaterial(values)])), [])
  useEffect(() => () => { resources.sheaves.forEach((g) => g.dispose()) }, [resources])
  useEffect(() => () => { Object.values(materials).forEach((m) => m.dispose()) }, [materials])
  const boxes = useMemo(() => [...model.supports, ...(model.machine?.boxes ?? [])], [model])
  const cylinders = model.machine?.cylinders ?? []
  return <group name="traction-drive">
    <ComponentBoxes parts={boxes} opacity={1} />
    {cylinders.map((c) => <mesh key={c.id} name={c.id} position={c.center} rotation={c.rotation} material={materials[c.material]}>
      <cylinderGeometry args={[c.radius, c.radius, c.length, 20]} />
    </mesh>)}
    {(['car', 'counterweight', 'fixed'] as const).map((attachment) => <group key={attachment} name={`simulation-${attachment}-hitches`}>
      <ComponentBoxes parts={model.hitches.filter((hitch) => hitch.attachment === attachment).map((hitch) => hitch.plate)} opacity={1} />
      {model.suspension?.terminations.filter((termination) => model.hitches.some((hitch) => hitch.attachment === attachment && termination.id.startsWith(`${hitch.id}-termination-`)))
        .map((c) => <mesh key={c.id} name={c.id} position={c.center} rotation={c.rotation} material={materials[c.material]}>
          <cylinderGeometry args={[c.radius, c.radius, c.length, 20]} />
        </mesh>)}
    </group>)}
    {model.sheaves.map((s, i) => <group key={s.id} name={`sheave-${s.id}`} position={s.center} rotation={[0, s.rotationY, 0]}>
      <group name={`sheave-rotor-${s.id}`}>
        <mesh geometry={resources.sheaves[i]} material={materials.sheave} />
        {s.role === 'traction' && <Line points={[[s.hubDiameter / 2, 0, s.width / 2], [s.diameter * 0.45, 0, s.width / 2]]} color="#59697a" lineWidth={2} />}
      </group>
    </group>)}
    {model.suspension?.ropes.map((rope) => <DynamicCableMeshes key={rope.id} id={rope.id} segments={rope.segments} diameter={rope.diameter} material="rope" visible={showRopes} />)}
  </group>
}
