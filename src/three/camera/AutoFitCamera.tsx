import { useBounds } from '@react-three/drei'
import { useLayoutEffect } from 'react'
import { Box3, Vector3 } from 'three'
import type { MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'

export interface AutoFitCameraProps {
  readonly frameKey: string
  readonly mechanicalBounds?: MechanicalBounds
}

export function AutoFitCamera({ frameKey, mechanicalBounds }: AutoFitCameraProps) {
  const bounds = useBounds()

  useLayoutEffect(() => {
    const box = mechanicalBounds
      ? new Box3(new Vector3(...mechanicalBounds.min), new Vector3(...mechanicalBounds.max))
      : undefined
    bounds.refresh(box).clip().fit()
  }, [bounds, frameKey, mechanicalBounds])

  return null
}
