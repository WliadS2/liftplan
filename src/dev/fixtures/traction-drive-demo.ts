import type { CounterweightPosition } from '../../elevator'
import type { TractionDriveData } from '../../elevator/configuration/traction-drive-data'
import { millimetres as mm } from '../../engineering'

const point = (x: number, y: number, z: number) => ({ xMm: mm(x), yMm: mm(y), zMm: mm(z) })
const size = (w: number, h: number, d: number) => ({ widthMm: mm(w), heightMm: mm(h), depthMm: mm(d) })
const localBox = (x: number, y: number, z: number, w: number, h: number, d: number) => ({ centerMm: point(x, y, z), sizeMm: size(w, h, d) })

/** Synthetic QA geometry only. NOT sizing guidance, manufacturer data or certified roping. */
export function createTractionDriveDemo(arrangement: CounterweightPosition): TractionDriveData {
  const rear = arrangement === 'rear', left = arrangement === 'left'
  const rotationYRad = rear ? Math.PI / 2 : 0
  const originMm = rear ? point(0, 5400, -575) : point(left ? -525 : 525, 5400, 0)
  const cw = rear ? point(0, 2000, -1150) : point(left ? -1050 : 1050, 2000, 0)
  const hitch = (id: string, attachment: 'car' | 'counterweight', origin: ReturnType<typeof point>) => ({
    id, attachment, source: 'demo' as const, reference: 'generic-qa-hitch', kind: 'generic' as const,
    originMm: origin, rotationYRad, plate: localBox(0, 15, 0, 120, 30, 120),
    anchorMm: point(0, 130, 0), terminationDiameterMm: mm(24), terminationLengthMm: mm(100),
  })
  return {
    machine: {
      source: 'demo', reference: 'generic-qa-machine', originMm, rotationYRad,
      housing: localBox(0, 0, -510, 400, 500, 400),
      bearingSupport: localBox(0, -50, -210, 350, 400, 200),
      base: localBox(0, -300, -580, 550, 100, 940),
      motor: { centerMm: point(0, 0, -835), diameterMm: mm(450), lengthMm: mm(250) },
      shaft: { centerMm: point(0, 0, -150), diameterMm: mm(80), lengthMm: mm(540) },
    },
    mount: {
      source: 'demo', reference: 'explicit-qa-wall-spanning-beams',
      supports: (rear ? [-180, 180] : [-100, 100]).flatMap((offset) => [
        {
          centerMm: rear ? point(0, 4610, -575 + offset) : point((left ? -525 : 525) + offset, 4610, 0),
          sizeMm: rear ? size(2600, 180, 160) : size(160, 180, 3000), rotationYRad: 0,
        },
        {
          centerMm: rear ? point(-580, 4875, -575 + offset) : point((left ? -525 : 525) + offset, 4875, -580),
          sizeMm: size(160, 350, 160), rotationYRad: 0,
        },
      ]),
    },
    sheaves: [{
      source: 'demo', reference: 'generic-qa-grooved-sheave', id: 'traction', role: 'traction', originMm, rotationYRad,
      // Explicit synthetic diameter puts the 10 mm rope centreline at 575 / 525 mm radius.
      diameterMm: mm(rear ? 1156 : 1056), widthMm: mm(140), hubDiameterMm: mm(240), hubWidthMm: mm(190), shaftDiameterMm: mm(80),
      grooves: { count: 4, spacingMm: mm(24), depthMm: mm(8), widthMm: mm(14) },
    }],
    hitches: [hitch('car-hitch', 'car', point(0, 2360, 0)), hitch('counterweight-hitch', 'counterweight', cw)],
    suspension: {
      source: 'demo', reference: 'explicit-qa-1-to-1-route', ratio: '1:1', ropeCount: 4, ropeDiameterMm: mm(10), grooveIndices: [0, 1, 2, 3],
      carConnectionId: 'car-hitch', counterweightConnectionId: 'counterweight-hitch',
      route: [
        { kind: 'hitch', hitchId: 'car-hitch' },
        { kind: 'contact', sheaveId: 'traction', entryAngleRad: left ? 0 : Math.PI, exitAngleRad: left ? Math.PI : 0 },
        { kind: 'hitch', hitchId: 'counterweight-hitch' },
      ],
    },
  }
}
