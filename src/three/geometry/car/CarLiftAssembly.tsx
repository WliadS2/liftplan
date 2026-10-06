import { Edges, Line } from '@react-three/drei'
import { DoubleSide } from 'three'
import { CAR_CONTACT_SYMBOL_RADIUS_METRES, type CarLiftRenderModel, type CarRenderableAssembly } from './car-lift-render-model'

function CarPrimitive({ assembly: a }: { readonly assembly: CarRenderableAssembly }) {
  const { color, opacity, presentation } = a.appearance
  if ('start' in a) return <Line name={a.id} points={[a.start, a.end]} color={color}
    transparent opacity={opacity} dashed dashSize={0.12} gapSize={0.06} lineWidth={1.4} />
  if (presentation === 'marker') {
    const r = CAR_CONTACT_SYMBOL_RADIUS_METRES
    return <group name={a.id} position={a.center}>
      <Line points={[[-r, 0, 0], [r, 0, 0]]} color={color} lineWidth={3} depthTest={false} />
      <Line points={[[0, 0, -r], [0, 0, r]]} color={color} lineWidth={3} depthTest={false} />
    </group>
  }
  if (presentation === 'line') return <Line name={a.id} points={[
    [a.center[0], a.center[1] - a.size[1] / 2, a.center[2]],
    [a.center[0], a.center[1] + a.size[1] / 2, a.center[2]],
  ]} color={color} lineWidth={1.6} />
  const [w, h, d] = a.size
  const plane = h === 0 ? { args: [w, d] as const, rotation: [-Math.PI / 2, 0, 0] as const }
    : d === 0 ? { args: [w, h] as const, rotation: [0, 0, 0] as const }
      : { args: [d, h] as const, rotation: [0, Math.PI / 2, 0] as const }
  return <group name={a.id} position={a.center} rotation={[0, (a.headingDegrees ?? 0) * Math.PI / 180, 0]}
    userData={{ semanticKind: a.kind }}>
    <mesh rotation={a.size.some((v) => v === 0) ? plane.rotation : [0, 0, 0]}>
      {a.size.some((v) => v === 0) ? <planeGeometry args={plane.args} /> : <boxGeometry args={a.size} />}
      {presentation === 'outline' ? <meshBasicMaterial visible={false} />
        : <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} side={DoubleSide} />}
      <Edges color={color} transparent opacity={opacity} />
    </mesh>
  </group>
}

/** Dedicated Autoaufzug materialization; no goods assembly, store, or vehicle calculation. */
export function CarLiftAssembly({ model }: { readonly model: CarLiftRenderModel }) {
  return <group name="car-lift-assembly">{model.assemblies.map((a) => <CarPrimitive key={a.id} assembly={a} />)}</group>
}
