import type { CarrierDoorLayout } from './carrier-door-model'
import { TechnicalEnvelope } from '../TechnicalEnvelope'
import { MECHANICAL_MATERIALS } from '../../materials/technical-materials'
import { createCarrierDoorSymbol } from './carrier-door-display'

/** Isolated display sections in metres: not sill/frame/track engineering data.
 * They sit OUTSIDE the usable opening and never enter domain bounds or drawing/validation data. */
export function CarrierDoor({ door, cutaway = false, inspection = false }: {
  readonly door: CarrierDoorLayout; readonly cutaway?: boolean; readonly inspection?: boolean
}) {
  const symbol = createCarrierDoorSymbol(door)
  return <group name={door.id} position={door.center} userData={{ role: door.role, levelId: door.levelId, source: door.source }}>
    {symbol.sections.map((part)=><mesh key={part.id} name={part.id} position={part.center} userData={{source:part.source}}>
      <boxGeometry args={part.size} />
      <meshStandardMaterial {...MECHANICAL_MATERIALS[part.material]} />
    </mesh>)}
    {symbol.leaves.map((leaf)=><group key={leaf.id} name={leaf.motionId}>
      <group position={leaf.center}>
        <mesh name={leaf.id} userData={{ source: leaf.source }}>
          <boxGeometry args={leaf.size} />
          <meshStandardMaterial {...MECHANICAL_MATERIALS[door.role === 'platform' ? 'cabinDoor' : 'landingDoor']}
            transparent opacity={cutaway ? 0.1 : inspection ? 0.85 : 0.45} depthWrite={inspection && !cutaway} />
        </mesh>
        <TechnicalEnvelope size={[leaf.size[0],leaf.size[1],0]} color="#465862" lineWidth={1.2} opacity={0.8} />
      </group>
    </group>)}
  </group>
}
