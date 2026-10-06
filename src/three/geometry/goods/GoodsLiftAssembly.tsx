import { Edges, Line } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { GoodsLiftRenderModel, GoodsRenderableAssembly } from './goods-lift-render-model'

function SurfaceAssembly({ assembly }: { readonly assembly: GoodsRenderableAssembly }) {
  const [width, height, depth] = assembly.size
  const plane = height === 0
    ? { args: [width, depth] as const, rotation: [-Math.PI / 2, 0, 0] as const }
    : depth === 0
      ? { args: [width, height] as const, rotation: [0, 0, 0] as const }
      : { args: [depth, height] as const, rotation: [0, Math.PI / 2, 0] as const }
  return <mesh name={assembly.id} position={assembly.center} rotation={plane.rotation}
    userData={{ semanticKind: assembly.kind }}>
    <planeGeometry args={plane.args} />
    {assembly.appearance.presentation === 'outline'
      ? <meshBasicMaterial visible={false} />
      : <meshStandardMaterial color={assembly.appearance.color} transparent={assembly.appearance.opacity < 1}
        opacity={assembly.appearance.opacity} side={DoubleSide} depthWrite={assembly.appearance.opacity >= 1} />}
    <Edges color={assembly.appearance.color} transparent opacity={assembly.kind === 'level' ? 0.25 : 0.65} />
  </mesh>
}

function BoxAssembly({ assembly }: { readonly assembly: GoodsRenderableAssembly }) {
  return <mesh name={assembly.id} position={assembly.center} userData={{ semanticKind: assembly.kind }}>
    <boxGeometry args={assembly.size} />
    {assembly.appearance.presentation === 'outline'
      ? <meshBasicMaterial visible={false} />
      : <meshStandardMaterial color={assembly.appearance.color} transparent={assembly.appearance.opacity < 1}
        opacity={assembly.appearance.opacity} depthWrite={assembly.appearance.opacity >= 1} />}
    {assembly.appearance.presentation === 'outline' && <Edges color={assembly.appearance.color} />}
  </mesh>
}

function GoodsAssemblyPrimitive({ assembly }: { readonly assembly: GoodsRenderableAssembly }) {
  if (assembly.appearance.presentation === 'line') {
    const halfHeight = assembly.size[1] / 2
    return <Line name={assembly.id} points={[
      [assembly.center[0], assembly.center[1] - halfHeight, assembly.center[2]],
      [assembly.center[0], assembly.center[1] + halfHeight, assembly.center[2]],
    ]} color={assembly.appearance.color} transparent opacity={assembly.appearance.opacity} lineWidth={1.5}
    userData={{ semanticKind: assembly.kind }} />
  }
  if (assembly.size.some((dimension) => dimension === 0)) return <SurfaceAssembly assembly={assembly} />
  return <BoxAssembly assembly={assembly} />
}

export function GoodsLiftAssembly({ model }: { readonly model: GoodsLiftRenderModel }) {
  return <group name="goods-lift-assembly">
    {model.assemblies.map((assembly) => <GoodsAssemblyPrimitive key={assembly.id} assembly={assembly} />)}
  </group>
}
