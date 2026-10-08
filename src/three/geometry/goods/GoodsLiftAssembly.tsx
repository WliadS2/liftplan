import { Line } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { GoodsLiftRenderModel, GoodsRenderableAssembly } from './goods-lift-render-model'
import { TechnicalEnvelope, TechnicalSceneLabel } from '../TechnicalEnvelope'
import { isGoodsMovingAssembly, type GoodsVisualDoorLayout } from './goods-motion-bindings'
import { CarrierDoor } from '../carrier/CarrierDoor'
import { ShaftSection } from '../ShaftSection'
import { CarrierDriveAssembly } from '../carrier/CarrierDriveAssembly'
import { ConfiguredMechanicalPart } from '../mechanical/ConfiguredMechanicalPart'
import { hasConfiguredMechanicalVisual } from '../mechanical/mechanical-visual-model'

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
      : <meshStandardMaterial color={assembly.appearance.color} metalness={0.4} roughness={0.48} transparent={assembly.appearance.opacity < 1}
        opacity={assembly.appearance.opacity} side={DoubleSide} depthWrite={assembly.appearance.opacity >= 1} />}
  </mesh>
}

function BoxAssembly({ assembly }: { readonly assembly: GoodsRenderableAssembly }) {
  return <mesh name={assembly.id} position={assembly.center} userData={{ semanticKind: assembly.kind }}>
    <boxGeometry args={assembly.size} />
    {assembly.appearance.presentation === 'outline'
      ? <meshBasicMaterial visible={false} />
      : <meshStandardMaterial color={assembly.appearance.color} metalness={0.4} roughness={0.48} transparent={assembly.appearance.opacity < 1}
        opacity={assembly.appearance.opacity} depthWrite={assembly.appearance.opacity >= 1} />}
  </mesh>
}

function GoodsAssemblyPrimitive({ assembly, showLabels }: { readonly assembly: GoodsRenderableAssembly; readonly showLabels: boolean }) {
  if (assembly.appearance.presentation === 'section') return <ShaftSection center={assembly.center} size={assembly.size} color={assembly.appearance.color} />
  if (assembly.appearance.presentation === 'line') {
    const halfHeight = assembly.size[1] / 2
    return <Line name={assembly.id} points={[
      [assembly.center[0], assembly.center[1] - halfHeight, assembly.center[2]],
      [assembly.center[0], assembly.center[1] + halfHeight, assembly.center[2]],
    ]} color={assembly.appearance.color} transparent opacity={assembly.appearance.opacity} lineWidth={1.5}
    userData={{ semanticKind: assembly.kind }} />
  }
  const labels = { pallet: 'Palettenhülle', 'roll-container': 'Rollcontainer-Hülle', 'forklift-envelope': 'Gabelstapler-Hülle' }
  const loadLabel = labels[assembly.kind as keyof typeof labels]
  return <group>
    {assembly.size.some((dimension) => dimension === 0) ? <SurfaceAssembly assembly={assembly} /> : <BoxAssembly assembly={assembly} />}
    <group position={assembly.center}>
      <TechnicalEnvelope size={assembly.size} color={assembly.appearance.color}
        opacity={assembly.appearance.presentation === 'surface' ? Math.min(0.9, assembly.appearance.opacity * 1.6 + 0.2) : assembly.appearance.opacity}
        lineWidth={assembly.appearance.lineWidth} dashed={assembly.appearance.dashed} />
      {loadLabel && showLabels && <TechnicalSceneLabel position={[
        assembly.kind === 'pallet' ? -assembly.size[0]/2 : assembly.kind === 'roll-container' ? assembly.size[0]/2 : 0,
        assembly.size[1]/2, assembly.kind === 'pallet' ? assembly.size[2]/2 : assembly.kind === 'forklift-envelope' ? -assembly.size[2]/2 : 0,
      ]}>{loadLabel}</TechnicalSceneLabel>}
    </group>
  </group>
}

export function GoodsLiftAssembly({ model, doors = [] }: {
  readonly model: GoodsLiftRenderModel; readonly doors?: readonly GoodsVisualDoorLayout[]
}) {
  const primitive = (assembly: GoodsRenderableAssembly) => {
    const door = doors.find((entry) => entry.id === assembly.id)
    return door ? <CarrierDoor key={assembly.id} door={door} cutaway={model.viewMode === 'cutaway'} inspection={model.viewMode === 'doors'} />
      : hasConfiguredMechanicalVisual(assembly) ? <ConfiguredMechanicalPart key={assembly.id} input={assembly}
        assemblies={model.assemblies} opacity={assembly.appearance.opacity}/>
      : <GoodsAssemblyPrimitive key={assembly.id} assembly={assembly}
        showLabels={model.viewMode === 'platform' || model.viewMode === 'loads'} />
  }
  return <group name="goods-lift-assembly">
    <group name="goods-fixed-assembly">{model.assemblies.filter((a) => a.driveAttachment === undefined && !isGoodsMovingAssembly(a)).map(primitive)}</group>
    <group name="goods-moving-assembly">{model.assemblies.filter((a)=>a.driveAttachment === undefined && isGoodsMovingAssembly(a)).map(primitive)}</group>
    <CarrierDriveAssembly drive={model.drive} visibleIds={new Set(model.assemblies.map((a)=>a.id))} mode={model.viewMode}/>
  </group>
}
