import type { DoorAssemblyData, PassengerDoorSystemData } from '../../elevator/configuration/passenger-door-data'
import { millimetres as mm } from '../../engineering'

const point = (x: number, y: number, z: number) => ({ xMm: mm(x), yMm: mm(y), zMm: mm(z) })
const size = (w: number, h: number, d: number) => ({ widthMm: mm(w), heightMm: mm(h), depthMm: mm(d) })
const box = (id: string, x: number, y: number, z: number, w: number, h: number, d: number) => ({ id, centerMm: point(x, y, z), sizeMm: size(w, h, d) })

/** Explicit synthetic parts only: not manufacturer, selection, clearance, force or approval data. */
export function createPassengerDoorDemo(throughCar: boolean): PassengerDoorSystemData {
  const assembly = (landing: boolean): DoorAssemblyData => ({
    source: 'demo', reference: 'synthetic-two-panel-door', openingType: 'center-opening-2', panelCount: 2,
    panelThicknessMm: mm(24), panelOverlapMm: mm(0),
    panelDepthOffsetsMm: [mm(landing ? -25 : 40), mm(landing ? -25 : 40)],
    panelTravelMm: [point(-470, 0, 0), point(470, 0, 0)],
    frame: { jambWidthMm: mm(50), jambDepthMm: mm(landing ? 20 : 60), headerHeightMm: mm(80), headerDepthMm: mm(landing ? 20 : 60), depthOffsetMm: mm(landing ? 15 : 0) },
    sill: { widthMm: mm(1000), depthMm: mm(80), heightMm: mm(30), depthOffsetMm: mm(landing ? -40 : 40),
      grooves: [{ depthOffsetMm: mm(landing ? 15 : 0), widthMm: mm(10), depthMm: mm(8) }] },
    track: { widthMm: mm(1100), heightMm: mm(4), depthMm: mm(20), aboveOpeningMm: mm(87), depthOffsetMm: mm(landing ? -25 : 40),
      mounts: [-480, 480].map((x) => box(`mount-${x}`, x, 82, landing ? -10 : 25, 20, 14, 50)) },
    hanger: { carrierSizeMm: size(90, 40, 20), connectorSizeMm: size(25, 30, 24), aboveOpeningMm: mm(35), depthOffsetMm: mm(landing ? -25 : 40),
      rollers: [-30, 30].map((x) => ({ id: `roller-${x}`, centerMm: point(x, 35, 0), diameterMm: mm(30), lengthMm: mm(10), axis: 'z' })) },
    bottomGuide: { sizeMm: size(20, 6, 6), depthOffsetsMm: [mm(landing ? -25 : 40), mm(landing ? -25 : 40)] },
  })
  const sides = throughCar ? ['front', 'rear'] as const : ['front'] as const
  return {
    cabin: sides.map((side) => ({
      source: 'demo', reference: 'synthetic-cabin-entrance', id: `cabin-${side}`, side, axisXMm: mm(0), assembly: assembly(false),
      operator: {
        source: 'demo', reference: 'synthetic-door-operator', offsetXMm: mm(0), aboveOpeningMm: mm(140), depthOffsetMm: mm(100),
        housing: { centerMm: point(0, 0, 0), sizeMm: size(900, 90, 60) },
        parts: [
          ...[-300, 300].map((x) => box(`mount-${x}`, x, -70, -35, 30, 100, 90)),
          box('motor-body', 380, 0, 45, 100, 70, 30),
          ...[-225, 225].map((x) => box(`drive-link-${x}`, x, -62.5, -50, 20, 85, 40)),
        ],
        cylinders: [-350, 350].map((x) => ({ id: `pulley-shaft-${x}`, centerMm: point(x, 0, -20), diameterMm: mm(10), lengthMm: mm(40), axis: 'z' })),
        pulleys: [-350, 350].map((x, i) => ({ source: 'demo', id: `${side}-operator-pulley-${i}`, originMm: point(x, 0, -40), rotationYRad: 0,
          diameterMm: mm(60), widthMm: mm(8), hubDiameterMm: mm(20), hubWidthMm: mm(12), shaftDiameterMm: mm(10),
          grooves: { count: 1, spacingMm: mm(6), depthMm: mm(2), widthMm: mm(4) } })),
        drivePath: { source: 'demo', reference: 'synthetic-operator-drive-loop', diameterMm: mm(2), route: [
          { kind: 'contact', wheelId: `${side}-operator-pulley-0`, entryAngleRad: Math.PI / 2, exitAngleRad: 3 * Math.PI / 2 },
          { kind: 'contact', wheelId: `${side}-operator-pulley-1`, entryAngleRad: -Math.PI / 2, exitAngleRad: Math.PI / 2 },
        ] },
      },
      coupling: { source: 'demo', reference: 'synthetic-cabin-coupling-blade', panelIndex: 0,
        boxes: [box('blade', -80, 1850, 88, 6, 140, 72)], cylinders: [], interfacePointMm: point(-80, 1850, 104) },
    })),
    landings: sides.map((side) => ({
      source: 'demo', reference: 'synthetic-landing-series', id: `landing-${side}`, cabinEntranceId: `cabin-${side}`, side,
      separationMm: mm(200), assembly: assembly(true),
      coupling: { source: 'demo', reference: 'synthetic-landing-coupling-receiver', panelIndex: 0,
        boxes: [box('mount', -80, 1850, -41, 60, 160, 8), ...[-18, 18].map((x) => box(`arm-${x}`, -80 + x, 1850, -80, 10, 160, 70))],
        cylinders: [-10, 10].map((x) => ({ id: `contact-${x}`, centerMm: point(-80 + x, 1850, -103), diameterMm: mm(14), lengthMm: mm(20), axis: 'z' })),
        interfacePointMm: point(-80, 1850, -96) },
      interlock: { source: 'demo', reference: 'synthetic-landing-lock-interface', offsetXMm: mm(400), aboveOpeningMm: mm(35), depthOffsetMm: mm(35),
        boxes: [box('body', 0, 0, 0, 60, 60, 20), box('lever', -35, -20, -5, 40, 10, 10)],
        cylinders: [{ id: 'contact-roller', centerMm: point(-55, -20, -5), diameterMm: mm(12), lengthMm: mm(10), axis: 'z' }] },
    })),
  }
}
