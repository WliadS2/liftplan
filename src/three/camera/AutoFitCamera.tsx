import { useBounds } from '@react-three/drei'
import { useLayoutEffect } from 'react'

export interface AutoFitCameraProps {
  readonly frameKey: string
}

export function AutoFitCamera({ frameKey }: AutoFitCameraProps) {
  const bounds = useBounds()

  useLayoutEffect(() => {
    bounds.refresh().clip().fit()
  }, [bounds, frameKey])

  return null
}
