import { Edges, Line } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial } from 'three'
import { MECHANICAL_MATERIALS, TECHNICAL_MATERIALS } from '../../../materials/technical-materials'
import { createSheaveGeometry, createTechnicalCableGeometry } from '../mechanical/traction-geometry'
import type { DoorCylinder, DoorInspection, PassengerDoorSystemModel } from './passenger-door-model'
import { getDoorPanelParts } from './passenger-door-model'
import { doorPanelGroupName } from '../../../../simulation/passenger-motion-bindings'
import type { ThreeViewMode } from '../../../scene/view-mode'
import { getDoorViewVisibility } from '../../../scene/view-mode'
import type { ComponentBox } from '../mechanical/mechanical-component-model'

export function PassengerDoorMeshes({ model, viewMode, inspection }: {
  readonly model: PassengerDoorSystemModel; readonly viewMode: ThreeViewMode; readonly inspection: DoorInspection
}) {
  const entrances = useMemo(() => [...model.cabin, ...model.landings], [model])
  const wheels = useMemo(() => entrances.flatMap((entry) => entry.operator?.pulleys ?? []), [entrances])
  const resources = useMemo(() => {
    const wheelGeometry = new Map<string, ReturnType<typeof createSheaveGeometry>>()
    wheels.forEach((wheel) => { const key = JSON.stringify(wheel.latheProfile); if (!wheelGeometry.has(key)) wheelGeometry.set(key, createSheaveGeometry(wheel)) })
    const paths = new Map(entrances.flatMap((entry) => entry.operator?.drivePath ? [[entry.id, createTechnicalCableGeometry(entry.operator.drivePath)] as const] : []))
    return { box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(1, 1, 1, 16), wheelGeometry, paths }
  }, [wheels, entrances])
  const materials = useMemo(() => {
    const maps = new Map<number, Record<string, MeshStandardMaterial>>()
    for (const opacity of [1, 0.12, 0.025]) maps.set(opacity, Object.fromEntries(Object.entries(MECHANICAL_MATERIALS).map(([role, values]) =>
      [role, new MeshStandardMaterial({ ...values, opacity, transparent: opacity < 1, depthWrite: opacity >= 1 })])))
    return maps
  }, [])
  useEffect(() => () => {
    resources.box.dispose(); resources.cylinder.dispose()
    resources.wheelGeometry.forEach((geometry) => geometry.dispose()); resources.paths.forEach((geometry) => geometry.dispose())
  }, [resources])
  useEffect(() => () => materials.forEach((map) => Object.values(map).forEach((material) => material.dispose())), [materials])
  const boxes = (parts: readonly ComponentBox[], opacity: number) => parts.map((part) => <mesh key={part.id} name={part.id}
    position={part.center} rotation={[0, part.rotationY, 0]} scale={part.size} geometry={resources.box} material={materials.get(opacity)![part.material]} />)
  const cylinders = (parts: readonly DoorCylinder[], opacity: number) => parts.map((part) => <group key={part.id} name={part.id} position={part.center} rotation={[0, part.rotationY, 0]}>
    <mesh rotation={part.axisRotation} scale={part.scale} geometry={resources.cylinder} material={materials.get(opacity)![part.material]} />
  </group>)
  return <group name="passenger-door-system">{entrances.map((entry) => {
    const policy = getDoorViewVisibility(viewMode, entry.role === 'cabin' ? entry.side === inspection.side : entry.id === inspection.landing?.id, entry.role)
    const groups = [entry.frame, entry.sill, entry.track, entry.operator, entry.interlock].filter((part) => !!part)
    return <group key={entry.id} name={entry.id} visible={viewMode !== 'cabin' || entry.role === 'cabin'}>
      {!entry.panels.length && <Line points={entry.outline} lineWidth={1} color={TECHNICAL_MATERIALS.doorEdge} />}
      {entry.panels.map((panel) => {
        const attached = getDoorPanelParts(entry, panel)
        return <group key={panel.id} name={doorPanelGroupName(panel.id)}>
        <mesh name={panel.id} position={panel.closed.center} rotation={[0, panel.closed.rotationY, 0]}
        scale={panel.box.size} geometry={resources.box} material={materials.get(policy.panelOpacity)![panel.box.material]}>
        <Edges color={TECHNICAL_MATERIALS.doorEdge} opacity={policy.panelOpacity} transparent={policy.panelOpacity < 1} />
        </mesh>
        {boxes(attached.boxes, policy.componentOpacity)}
        {cylinders(attached.cylinders, policy.componentOpacity)}
        </group>
      })}
      {groups.flatMap((group) => [...boxes(group.boxes, policy.componentOpacity), ...cylinders(group.cylinders, policy.componentOpacity)])}
      {entry.operator?.pulleys.map((wheel) => <mesh key={wheel.id} name={`${entry.id}-${wheel.id}`} position={wheel.center} rotation={[0, wheel.rotationY, 0]}
        geometry={resources.wheelGeometry.get(JSON.stringify(wheel.latheProfile))} material={materials.get(policy.componentOpacity)!.doorOperator} />)}
      {resources.paths.has(entry.id) && <mesh name={`${entry.id}-operator-drive-path`} geometry={resources.paths.get(entry.id)} material={materials.get(policy.componentOpacity)!.doorOperator} />}
    </group>
  })}</group>
}
