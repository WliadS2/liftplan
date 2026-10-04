import { useBounds } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Box3, Vector3 } from 'three'
import type { MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'

export interface AutoFitCameraProps {
  readonly frameKey: string
  readonly mechanicalBounds?: MechanicalBounds
}

export function AutoFitCamera({ frameKey, mechanicalBounds }: AutoFitCameraProps) {
  const bounds = useBounds()
  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    const box = mechanicalBounds
      ? new Box3(new Vector3(...mechanicalBounds.min), new Vector3(...mechanicalBounds.max))
      : undefined
    // Preserve the orbit direction, not the old world-space camera position:
    // a new focus center can be many storeys above the previous one.
    const direction = camera.getWorldDirection(new Vector3()).negate()
    bounds.refresh(box).clip()
    const { center, distance } = bounds.getSize()
    bounds.moveTo(center.clone().addScaledVector(direction, distance)).lookAt({ target: center })
  }, [bounds, camera, frameKey, mechanicalBounds])

  return null
}
