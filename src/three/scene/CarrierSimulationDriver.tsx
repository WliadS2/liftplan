import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group, Object3D } from 'three'
import { millimetresToMetres } from '../../engineering'
import type { CarrierDriveScene } from '../../elevator/models/carrier-drive-scene'
import { bindCarrierDriveScene } from '../geometry/carrier/carrier-drive-render-bindings'
import type { PlatformSimulationController } from '../../simulation/platform-simulation'
import type { CarrierDoorLayout } from '../geometry/carrier/carrier-door-model'
import { getCarrierMotionTransforms } from '../geometry/carrier/carrier-motion-bindings'

/** One clock and one attachment group; cached mesh identities are render bindings, not domain inputs. */
export function CarrierSimulationDriver({ controller, doors, movingGroupName, children, drive }: {
  readonly controller?: PlatformSimulationController; readonly doors: readonly CarrierDoorLayout[]
  readonly movingGroupName: string; readonly children: ReactNode
  readonly drive?:CarrierDriveScene
}) {
  const root = useRef<Group>(null), nodes = useRef(new Map<string,Object3D>())
  const driveUpdate = useRef<(offset:number)=>void>(()=>{})
  useLayoutEffect(()=>{
    nodes.current.clear()
    root.current?.traverse((node)=>{ if (node.name) nodes.current.set(node.name,node) })
    driveUpdate.current = bindCarrierDriveScene(drive,nodes.current)
  })
  useFrame((_,delta)=>{
    controller?.advance(delta)
    for (const transform of getCarrierMotionTransforms(movingGroupName,doors,controller?.getPose())) {
      const node = nodes.current.get(transform.nodeName)
      if (node) node.position[transform.axis] = transform.offset
    }
    driveUpdate.current(controller ? millimetresToMetres(controller.getPose().platformOffsetMm) : 0)
  },-2)
  return <group ref={root}>{children}</group>
}
