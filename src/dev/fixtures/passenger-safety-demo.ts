import type { PassengerSafetyData, SafetyWheelAssemblyData } from '../../elevator/configuration/passenger-safety-data'
import type { TractionDriveData } from '../../elevator/configuration/traction-drive-data'
import { millimetres as mm } from '../../engineering'

const point = (x: number, y: number, z: number) => ({ xMm: mm(x), yMm: mm(y), zMm: mm(z) })
const box = (x: number, y: number, z: number, w: number, h: number, d: number) => ({
  centerMm: point(x, y, z), sizeMm: { widthMm: mm(w), heightMm: mm(h), depthMm: mm(d) },
})
const carPoint = (x: number, y: number, z: number) => ({ ...point(x, y, z), verticalAnchor: 'cabin-floor' as const })

/** Synthetic visual-QA parts and route, NOT safety equipment selection or approval data. */
export function createPassengerSafetyDemo(drive: TractionDriveData): PassengerSafetyData {
  const wheelAssembly = (kind: 'governor' | 'tension', y: number): SafetyWheelAssemblyData => ({
    source: 'demo', reference: `generic-qa-${kind}`, shaftLengthMm: mm(140),
    wheel: {
      id: `${kind}-wheel`, source: 'demo', reference: 'synthetic-single-groove-wheel', originMm: { ...point(0, y, 1150), verticalAnchor: kind === 'governor' ? 'top-mechanical' : 'pit-bottom' }, rotationYRad: Math.PI / 2,
      diameterMm: mm(406), widthMm: mm(40), hubDiameterMm: mm(80), hubWidthMm: mm(70), shaftDiameterMm: mm(30),
      grooves: { count: 1, spacingMm: mm(20), depthMm: mm(6), widthMm: mm(10) },
    },
    housing: [-50, 50].flatMap((z) => [box(0, 0, z, 90, 90, 20), box(0, -132.5, z, 50, 175, 20)]),
    base: box(0, -240, 0, 180, 40, 140),
    supports: kind === 'governor'
      ? [-60, 60].map((x) => ({ ...box(x, 360, 1365, 20, 40, 270), centerMm: { ...point(x, 360, 1365), verticalAnchor: 'top-mechanical' as const }, rotationYRad: 0 }))
      : [-60, 60].map((x) => ({ ...box(x, 45, 1150, 20, 90, 140), centerMm: { ...point(x, 45, 1150), verticalAnchor: 'pit-bottom' as const }, rotationYRad: 0 })),
    ...(kind === 'tension' ? { tensionDevice: box(0, -305, 0, 100, 90, 100) } : {}),
  })
  const machine = drive.machine!
  const rear = machine.rotationYRad === Math.PI / 2
  const brakeOrigin = { ...point(machine.originMm.xMm + (rear ? 200 : 0), machine.originMm.yMm, machine.originMm.zMm + (rear ? 0 : 200)), verticalAnchor: machine.originMm.verticalAnchor }
  return {
    governor: wheelAssembly('governor', 600), tension: wheelAssembly('tension', 350),
    gears: (['left', 'right'] as const).map((side, i) => ({
      source: 'demo', reference: 'generic-qa-safety-gear', id: `safety-gear-${side}`, side, railId: `car-rail-${i + 1}`, kind: 'generic',
      elevationMm: mm(-220), elevationAnchor: 'cabin-floor', heightMm: mm(100), bodyDepthMm: mm(55), wallThicknessMm: mm(12),
      slotWidthMm: mm(44), slotDepthMm: mm(30), railTipGapMm: mm(5), mountingPlateThicknessMm: mm(12), mountingPlateWidthMm: mm(120),
      linkagePointLocalMm: point(side === 'left' ? -34 : 34, 0, 40),
    })),
    linkage: {
      source: 'demo', reference: 'synthetic-under-frame-linkage', id: 'governor-linkage', ropeConnectionMm: carPoint(0, -340, 950),
      clamp: { ...box(0, -340, 950, 40, 60, 30), centerMm: carPoint(0, -340, 950), rotationYRad: 0 }, rodDiameterMm: mm(20),
      paths: (['left', 'right'] as const).map((side) => ({ id: `${side}-activation-path`, gearId: `safety-gear-${side}`,
        pointsMm: [carPoint(side === 'left' ? -710 : 710, -220, 34), carPoint(side === 'left' ? -710 : 710, -340, 34),
          carPoint(side === 'left' ? -710 : 710, -340, 850), carPoint(0, -340, 850), carPoint(0, -340, 950)],
      })),
    },
    governorRope: {
      source: 'demo', reference: 'explicit-qa-governor-loop', diameterMm: mm(6),
      route: [
        { kind: 'contact', wheel: 'governor', entryAngleRad: Math.PI, exitAngleRad: 0 },
        { kind: 'linkage', linkageId: 'governor-linkage' },
        { kind: 'contact', wheel: 'tension', entryAngleRad: 0, exitAngleRad: -Math.PI },
      ],
    },
    machineBrake: {
      source: 'demo', reference: 'generic-qa-outboard-shaft-brake', kind: 'generic', machineMountPartId: 'machine-base',
      wheel: { source: 'demo', id: 'brake-surface', originMm: brakeOrigin, rotationYRad: machine.rotationYRad,
        diameterMm: mm(360), widthMm: mm(20), hubDiameterMm: mm(120), hubWidthMm: mm(24), shaftDiameterMm: mm(80) },
      parts: [
        { ...box(0, -520, -780, 60, 340, 60), role: 'mount' },
        { ...box(0, -705, -390, 60, 30, 840), role: 'mount' },
        { ...box(0, -445, 45, 60, 520, 30), role: 'mount' },
        { ...box(0, -200, 0, 90, 40, 90), role: 'body' },
        ...[-1, 1].flatMap((sign) => [
          { ...box(0, -135, sign * 25.5, 90, 90, 15), role: 'arm' as const },
          { ...box(0, -135, sign * 14, 60, 90, 8), role: 'arm' as const },
        ]),
      ],
    },
  }
}
