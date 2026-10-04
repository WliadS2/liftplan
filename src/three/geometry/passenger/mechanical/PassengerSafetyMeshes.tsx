import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { MECHANICAL_MATERIALS } from '../../../materials/technical-materials'
import { ComponentBoxes } from './MechanicalComponentMeshes'
import { createSheaveGeometry, createTechnicalCableGeometry } from './traction-geometry'
import type { PassengerSafetyModel } from './passenger-safety-model'

/** Thin mesh binding only. The safety model owns every dimension, contact and transform. */
export function PassengerSafetyMeshes({ model }: { readonly model: PassengerSafetyModel }) {
  const wheels = useMemo(() => [model.governor?.wheel, model.tension?.wheel, model.machineBrake?.wheel].filter((w) => !!w), [model])
  const resources = useMemo(() => ({ wheels: wheels.map(createSheaveGeometry),
    rope: model.governorRope ? createTechnicalCableGeometry(model.governorRope) : undefined }), [wheels, model.governorRope])
  const materials = useMemo(() => Object.fromEntries(Object.entries(MECHANICAL_MATERIALS).map(([role, values]) => [role, new MeshStandardMaterial(values)])), [])
  useEffect(() => () => { resources.wheels.forEach((g) => g.dispose()); resources.rope?.dispose() }, [resources])
  useEffect(() => () => { Object.values(materials).forEach((m) => m.dispose()) }, [materials])
  const boxes = useMemo(() => [...model.governor?.boxes ?? [], ...model.tension?.boxes ?? [], ...model.gears.flatMap((g) => g.boxes),
    ...model.linkage ? [model.linkage.clamp] : [], ...model.machineBrake?.boxes ?? []], [model])
  const cylinders = [model.governor?.shaft, model.tension?.shaft, ...model.linkage?.rods ?? []].filter((c) => !!c)
  return <group name="passenger-safety-system">
    <ComponentBoxes parts={boxes} opacity={1} />
    {wheels.map((wheel, i) => <group key={wheel.id} name={wheel.id} position={wheel.center} rotation={[0, wheel.rotationY, 0]}>
      <mesh geometry={resources.wheels[i]} material={materials[wheel.role === 'brake' ? 'brake' : wheel.role === 'tension' ? 'tension' : 'governor']} />
    </group>)}
    {cylinders.map((c) => <mesh key={c.id} name={c.id} position={c.center} rotation={c.rotation} material={materials.linkage}>
      <cylinderGeometry args={[c.radius, c.radius, c.length, 16]} />
    </mesh>)}
    {resources.rope && <mesh name="governor-rope-loop" geometry={resources.rope} material={materials.governorRope} />}
  </group>
}
