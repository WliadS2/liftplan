import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import { millimetresToMetres } from '../../engineering'
import type { PlatformSimulationController } from '../../simulation/platform-simulation'

export function CarSimulationDriver({ controller, children }: {
  readonly controller?: PlatformSimulationController; readonly children: ReactNode
}) {
  const root = useRef<Group>(null)
  useFrame((_, delta) => {
    controller?.advance(delta)
    const moving = root.current?.getObjectByName('car-moving-assembly')
    if (moving) moving.position.y = controller ? millimetresToMetres(controller.getPose().platformOffsetMm) : 0
  }, -2)
  return <group ref={root}>{children}</group>
}
