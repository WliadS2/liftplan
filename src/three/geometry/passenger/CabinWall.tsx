import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'

export interface CabinWallProps {
  readonly dimensions: readonly [number, number, number]
  readonly opacity?: number
  readonly position: readonly [number, number, number]
  readonly visible?: boolean
}

export function CabinWall({
  dimensions,
  opacity = 1,
  position,
  visible = true,
}: CabinWallProps) {
  if (!visible) {
    return null
  }

  return (
    <mesh position={position}>
      <boxGeometry args={dimensions} />
      <meshStandardMaterial
        color={TECHNICAL_MATERIALS.cabinWall}
        depthWrite={opacity >= 1}
        metalness={0.04}
        opacity={opacity}
        roughness={0.76}
        transparent={opacity < 1}
      />
    </mesh>
  )
}
