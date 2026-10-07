import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group, Object3D } from 'three'
import type { PlatformSimulationController } from '../../simulation/platform-simulation'
import type { CarrierDoorLayout } from '../geometry/carrier/carrier-door-model'
import { getCarrierMotionTransforms } from '../geometry/carrier/carrier-motion-bindings'

/** One clock and one attachment group; cached mesh identities are render bindings, not domain inputs. */
export function CarrierSimulationDriver({ controller, doors, movingGroupName, children }: {
  readonly controller?: PlatformSimulationController; readonly doors: readonly CarrierDoorLayout[]
  readonly movingGroupName: string; readonly children: ReactNode
}) {
  const root = useRef<Group>(null), nodes = useRef(new Map<string,Object3D>())
  useLayoutEffect(()=>{
    nodes.current.clear()
    root.current?.traverse((node)=>{ if (node.name) nodes.current.set(node.name,node) })
  })
  useFrame((_,delta)=>{
    controller?.advance(delta)
    for (const transform of getCarrierMotionTransforms(movingGroupName,doors,controller?.getPose())) {
      const node = nodes.current.get(transform.nodeName)
      if (node) node.position[transform.axis] = transform.offset
    }
  },-2)
  return <group ref={root}>{children}</group>
}
