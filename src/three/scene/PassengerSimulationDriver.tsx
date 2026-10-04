import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Vector3, type Group, type Object3D } from 'three'
import { CAR_MOTION_GROUPS, COUNTERWEIGHT_MOTION_GROUPS, cableLineName, getDoorMotionBindings } from '../../simulation/passenger-motion-bindings'
import type { PassengerSimulationController } from '../../simulation/passenger-simulation'
import type { PassengerDoorSystemModel } from '../geometry/passenger/doors/passenger-door-model'
import type { CableSegment } from '../geometry/passenger/mechanical/cable-segment'

/** The only simulation clock. Binding contains transforms only; the controller owns all movement/state rules. */
export function PassengerSimulationDriver({ controller, doors, children }: {
  readonly controller?: PassengerSimulationController; readonly doors: PassengerDoorSystemModel; readonly children: ReactNode
}) {
  const root = useRef<Group>(null)
  const objects = useRef(new Map<string, Object3D>())
  const vectors = useRef({ start: new Vector3(), end: new Vector3(), direction: new Vector3(), up: new Vector3(0, 1, 0) })
  // JSX nodes can be replaced by a view-mode switch; refresh bindings after each committed scene render.
  useLayoutEffect(() => {
    objects.current.clear()
    root.current?.traverse((object) => { if (object.name) objects.current.set(object.name, object) })
  })
  useFrame((_, deltaSeconds) => {
    if (!controller) return
    controller.advance(deltaSeconds)
    const pose = controller.getPose(), nodes = objects.current, v = vectors.current
    for (const name of CAR_MOTION_GROUPS) { const object = nodes.get(name); if (object) object.position.y = pose.cabinOffsetY }
    for (const name of COUNTERWEIGHT_MOTION_GROUPS) { const object = nodes.get(name); if (object) object.position.y = pose.counterweightOffsetY }
    const rotor = nodes.get(`sheave-rotor-${controller.model.tractionSheaveId}`)
    if (rotor) rotor.rotation.z = pose.tractionSheaveRotation
    for (const binding of getDoorMotionBindings(doors, pose)) {
      const entrance = nodes.get(binding.entryId)
      if (entrance) entrance.position.y = binding.offsetY
      for (const panel of binding.panels) nodes.get(panel.name)?.position.set(...panel.offset)
    }
    function updateCable(id: string, segments: readonly CableSegment[]) {
      segments.forEach((segment, index) => {
        if (segment.kind !== 'line') return
        const mesh = nodes.get(cableLineName(id, index))
        if (!mesh) return
        v.start.set(...segment.start); v.end.set(...segment.end); v.direction.subVectors(v.end, v.start)
        mesh.position.copy(v.start).add(v.end).multiplyScalar(0.5)
        mesh.scale.y = v.direction.length()
        mesh.quaternion.setFromUnitVectors(v.up, v.direction.normalize())
      })
    }
    for (const rope of pose.suspensionRopes) updateCable(rope.id, rope.segments)
    updateCable('governor-rope-loop', pose.governorSegments)
  }, -2)
  return <group ref={root}>{children}</group>
}
