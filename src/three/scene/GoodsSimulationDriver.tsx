import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group, Object3D } from 'three'
import { millimetresToMetres } from '../../engineering'
import type { GoodsSimulationController } from '../../simulation/goods-simulation'
import { getGoodsDoorPanelOffsets, type GoodsVisualDoorLayout } from '../geometry/goods/goods-motion-bindings'

/** One clock, one moving attachment group; domain models are never rebuilt per frame. */
export function GoodsSimulationDriver({ controller, doors, children }: {
  readonly controller?: GoodsSimulationController; readonly doors: readonly GoodsVisualDoorLayout[]; readonly children: ReactNode
}) {
  const root = useRef<Group>(null)
  const nodes = useRef(new Map<string, Object3D>())
  useLayoutEffect(() => {
    nodes.current.clear()
    root.current?.traverse((node) => { if (node.name) nodes.current.set(node.name, node) })
  })
  useFrame((_, delta) => {
    controller?.advance(delta)
    const pose = controller?.getPose()
    const moving = nodes.current.get('goods-moving-assembly')
    if (moving) moving.position.y = pose ? millimetresToMetres(pose.platformOffsetMm) : 0
    for (const door of doors) {
      getGoodsDoorPanelOffsets(door, pose).forEach((offset, index) => {
        const panel = nodes.current.get(`${door.id}-panel-motion-${index}`)
        if (panel) panel.position.x = offset
      })
    }
  }, -2)
  return <group ref={root}>{children}</group>
}
