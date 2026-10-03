import type { CounterweightPosition } from '../../../../elevator'
import {
  metres,
  millimetresToMetres,
  type Metres,
} from '../../../../engineering'
import type { PassengerGeometryPlanningInput } from '../../lift-geometry-planning-input'
import type {
  PassengerInstallationBounds,
  PassengerInstallationModel,
} from '../passenger-installation-model'
import type {
  MechanicalPlanningPlanPositionMm,
  MechanicalPlanningPointMm,
  SuspensionArrangement,
} from './passenger-mechanical-planning-input'

export type MechanicalLayoutSource = 'planning' | 'schematic'
export type MechanicalPoint = readonly [Metres, Metres, Metres]

export interface PassengerCarFrameLayout {
  readonly envelopeSource: 'planning'
  readonly constructionSource: 'schematic'
  readonly width: Metres
  readonly depth: Metres
  readonly bottomY: Metres
  readonly topY: Metres
}

export interface PassengerRailLineLayout {
  readonly id: string
  readonly start: MechanicalPoint
  readonly end: MechanicalPoint
}

export interface PassengerRailSystemLayout {
  readonly kind: 'car' | 'counterweight'
  readonly source: MechanicalLayoutSource
  readonly rails: readonly [PassengerRailLineLayout, PassengerRailLineLayout]
}

export interface PassengerCounterweightLayout {
  readonly dimensionsSource: 'planning'
  readonly placementSource: 'schematic'
  readonly arrangement: CounterweightPosition
  readonly width: Metres
  readonly height: Metres
  readonly center: MechanicalPoint
  readonly rotationY: number
}

export interface PassengerBufferLayout {
  readonly kind: 'car' | 'counterweight'
  readonly source: MechanicalLayoutSource
  readonly basePositions: readonly MechanicalPoint[]
}

export interface PassengerMachineLayout {
  readonly source: 'planning'
  readonly center: MechanicalPoint
  readonly size: MechanicalPoint
}

export interface PassengerSheaveLayout {
  readonly source: 'planning'
  readonly center: MechanicalPoint
  readonly diameter: Metres
}

export interface PassengerSuspensionLayout {
  readonly source: 'planning'
  readonly arrangement: SuspensionArrangement
  readonly path: readonly MechanicalPoint[]
}

export interface PassengerMechanicalZoneLayout {
  readonly kind: 'bottom' | 'top'
  readonly source: 'planning'
  readonly width: Metres
  readonly depth: Metres
  readonly bottomY: Metres
  readonly topY: Metres
  readonly centerY: Metres
  readonly height: Metres
}

export interface PassengerMechanicalLayout {
  readonly carFrame?: PassengerCarFrameLayout
  readonly carRails?: PassengerRailSystemLayout
  readonly counterweight?: PassengerCounterweightLayout
  readonly counterweightRails?: PassengerRailSystemLayout
  readonly carBuffers?: PassengerBufferLayout
  readonly counterweightBuffers?: PassengerBufferLayout
  readonly machine?: PassengerMachineLayout
  readonly tractionSheave?: PassengerSheaveLayout
  readonly suspension?: PassengerSuspensionLayout
  readonly zones: readonly PassengerMechanicalZoneLayout[]
  readonly bounds: PassengerInstallationBounds
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isFinitePoint(point: MechanicalPlanningPointMm): boolean {
  return [point.xMm, point.yMm, point.zMm].every(Number.isFinite)
}

function toPoint(point: MechanicalPlanningPointMm): MechanicalPoint {
  return [
    millimetresToMetres(point.xMm),
    millimetresToMetres(point.yMm),
    millimetresToMetres(point.zMm),
  ]
}

function toPlanPoint(
  point: MechanicalPlanningPlanPositionMm,
  y: Metres,
): MechanicalPoint {
  return [
    millimetresToMetres(point.xMm),
    y,
    millimetresToMetres(point.zMm),
  ]
}

function createRailSystem(
  kind: PassengerRailSystemLayout['kind'],
  source: MechanicalLayoutSource,
  positions: readonly [
    readonly [Metres, Metres],
    readonly [Metres, Metres],
  ],
  bottomY: Metres,
  topY: Metres,
): PassengerRailSystemLayout {
  return {
    kind,
    source,
    rails: positions.map(([x, z], index) => ({
      id: `${kind}-rail-${index + 1}`,
      start: [x, bottomY, z],
      end: [x, topY, z],
    })) as unknown as readonly [
      PassengerRailLineLayout,
      PassengerRailLineLayout,
    ],
  }
}

function createBounds(
  installation: PassengerInstallationModel,
  points: readonly MechanicalPoint[],
): PassengerInstallationBounds {
  const halfWidth = installation.bounds.width / 2
  const halfDepth = installation.bounds.depth / 2
  const installationBottom =
    installation.bounds.centerY - installation.bounds.height / 2
  const installationTop =
    installation.bounds.centerY + installation.bounds.height / 2
  const xValues = [-halfWidth, halfWidth, ...points.map(([x]) => x)]
  const yValues = [
    installationBottom,
    installationTop,
    ...points.map(([, y]) => y),
  ]
  const zValues = [-halfDepth, halfDepth, ...points.map(([, , z]) => z)]
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)

  return {
    width: metres(Math.max(...xValues) - Math.min(...xValues)),
    depth: metres(Math.max(...zValues) - Math.min(...zValues)),
    height: metres(maxY - minY),
    centerY: metres(minY + (maxY - minY) / 2),
  }
}

export function createPassengerMechanicalLayout(
  input: PassengerGeometryPlanningInput,
  installation: PassengerInstallationModel,
): PassengerMechanicalLayout {
  const mechanical = input.mechanical
  const cabin = installation.cabin
  const verticalExtent = installation.shaft?.verticalExtent
  const railBottomY = verticalExtent?.bottomY ?? cabin?.bottomY
  const railTopY = verticalExtent?.topY ??
    (cabin ? metres(cabin.bottomY + cabin.height) : undefined)

  const carFrame = cabin
    ? {
        envelopeSource: 'planning' as const,
        constructionSource: 'schematic' as const,
        width: cabin.width,
        depth: cabin.depth,
        bottomY: cabin.bottomY,
        topY: metres(cabin.bottomY + cabin.height),
      }
    : undefined

  let carRails: PassengerRailSystemLayout | undefined
  if (railBottomY !== undefined && railTopY !== undefined) {
    if (
      mechanical.carRailPositionsMm?.every((position) =>
        [position.xMm, position.zMm].every(Number.isFinite),
      )
    ) {
      const positions = mechanical.carRailPositionsMm.map((position) => {
        const [x, , z] = toPlanPoint(position, railBottomY)
        return [x, z] as const
      }) as unknown as readonly [
        readonly [Metres, Metres],
        readonly [Metres, Metres],
      ]
      carRails = createRailSystem(
        'car',
        'planning',
        positions,
        railBottomY,
        railTopY,
      )
    } else if (cabin) {
      carRails = createRailSystem(
        'car',
        'schematic',
        [
          [metres(-cabin.width / 2), metres(0)],
          [metres(cabin.width / 2), metres(0)],
        ],
        railBottomY,
        railTopY,
      )
    }
  }

  const counterweight = installation.counterweight
    ? {
        dimensionsSource: 'planning' as const,
        placementSource: 'schematic' as const,
        arrangement: installation.counterweight.position,
        width: installation.counterweight.width,
        height: installation.counterweight.height,
        center: installation.counterweight.center,
        rotationY: installation.counterweight.rotationY,
      }
    : undefined

  let counterweightRails: PassengerRailSystemLayout | undefined
  if (
    counterweight &&
    railBottomY !== undefined &&
    railTopY !== undefined
  ) {
    if (
      mechanical.counterweightRailPositionsMm?.every((position) =>
        [position.xMm, position.zMm].every(Number.isFinite),
      )
    ) {
      const positions = mechanical.counterweightRailPositionsMm.map(
        (position) => {
          const [x, , z] = toPlanPoint(position, railBottomY)
          return [x, z] as const
        },
      ) as unknown as readonly [
        readonly [Metres, Metres],
        readonly [Metres, Metres],
      ]
      counterweightRails = createRailSystem(
        'counterweight',
        'planning',
        positions,
        railBottomY,
        railTopY,
      )
    } else {
      const [centerX, , centerZ] = counterweight.center
      const positions =
        counterweight.arrangement === 'rear'
          ? ([
              [metres(centerX - counterweight.width / 2), centerZ],
              [metres(centerX + counterweight.width / 2), centerZ],
            ] as const)
          : ([
              [centerX, metres(centerZ - counterweight.width / 2)],
              [centerX, metres(centerZ + counterweight.width / 2)],
            ] as const)
      counterweightRails = createRailSystem(
        'counterweight',
        'schematic',
        positions,
        railBottomY,
        railTopY,
      )
    }
  }

  const pitBottomY = installation.pit
    ? metres(installation.pit.centerY - installation.pit.height / 2)
    : undefined
  const plannedCarBuffers = mechanical.carBufferPositionsMm?.filter(
    isFinitePoint,
  )
  const carBuffers =
    installation.pit && cabin && pitBottomY !== undefined
      ? {
          kind: 'car' as const,
          source:
            plannedCarBuffers && plannedCarBuffers.length > 0
              ? ('planning' as const)
              : ('schematic' as const),
          basePositions:
            plannedCarBuffers && plannedCarBuffers.length > 0
              ? plannedCarBuffers.map(toPoint)
              : ([[metres(0), pitBottomY, metres(0)]] as const),
        }
      : undefined
  const plannedCounterweightBuffers =
    mechanical.counterweightBufferPositionsMm?.filter(isFinitePoint)
  const counterweightBuffers =
    installation.pit && counterweight && pitBottomY !== undefined
      ? {
          kind: 'counterweight' as const,
          source:
            plannedCounterweightBuffers &&
            plannedCounterweightBuffers.length > 0
              ? ('planning' as const)
              : ('schematic' as const),
          basePositions:
            plannedCounterweightBuffers &&
            plannedCounterweightBuffers.length > 0
              ? plannedCounterweightBuffers.map(toPoint)
              : ([
                  [counterweight.center[0], pitBottomY, counterweight.center[2]],
                ] as const),
        }
      : undefined

  const machineInput = mechanical.machine
  const machine =
    machineInput?.positionMm &&
    machineInput.envelopeMm &&
    isFinitePoint(machineInput.positionMm) &&
    [
      machineInput.envelopeMm.widthMm,
      machineInput.envelopeMm.heightMm,
      machineInput.envelopeMm.depthMm,
    ].every(isPositive)
      ? {
          source: 'planning' as const,
          center: toPoint(machineInput.positionMm),
          size: [
            millimetresToMetres(machineInput.envelopeMm.widthMm),
            millimetresToMetres(machineInput.envelopeMm.heightMm),
            millimetresToMetres(machineInput.envelopeMm.depthMm),
          ] as const,
        }
      : undefined

  const sheaveInput = mechanical.tractionSheave
  const tractionSheave =
    sheaveInput?.positionMm &&
    sheaveInput.diameterMm !== undefined &&
    isFinitePoint(sheaveInput.positionMm) &&
    isPositive(sheaveInput.diameterMm)
      ? {
          source: 'planning' as const,
          center: toPoint(sheaveInput.positionMm),
          diameter: millimetresToMetres(sheaveInput.diameterMm),
        }
      : undefined

  const suspensionInput = mechanical.suspension
  const validSuspensionPoints = suspensionInput?.pathPointsMm?.filter(
    isFinitePoint,
  )
  const suspension =
    suspensionInput?.arrangement &&
    validSuspensionPoints &&
    validSuspensionPoints.length >= 2
      ? {
          source: 'planning' as const,
          arrangement: suspensionInput.arrangement,
          path: validSuspensionPoints.map(toPoint),
        }
      : undefined

  const zones: PassengerMechanicalZoneLayout[] = []
  if (installation.pit && installation.shaft && pitBottomY !== undefined) {
    const offset = mechanical.zones?.bottomOffsetMm
    const bottomY = metres(
      pitBottomY +
        (offset === undefined || !Number.isFinite(offset)
          ? 0
          : millimetresToMetres(offset)),
    )
    const topY = metres(0)
    if (bottomY < topY) {
      zones.push({
        kind: 'bottom',
        source: 'planning',
        width: installation.shaft.width,
        depth: installation.shaft.depth,
        bottomY,
        topY,
        centerY: metres(bottomY + (topY - bottomY) / 2),
        height: metres(topY - bottomY),
      })
    }
  }

  const headroom = input.shaft.headroomMm
  const highestLevel =
    installation.levels.length > 0
      ? Math.max(...installation.levels.map(({ elevationY }) => elevationY))
      : undefined
  if (
    installation.shaft &&
    highestLevel !== undefined &&
    headroom !== undefined &&
    isPositive(headroom)
  ) {
    const offset = mechanical.zones?.topOffsetMm
    const bottomY = metres(
      highestLevel +
        (offset === undefined || !Number.isFinite(offset)
          ? 0
          : millimetresToMetres(offset)),
    )
    const topY = metres(highestLevel + millimetresToMetres(headroom))
    if (bottomY < topY) {
      zones.push({
        kind: 'top',
        source: 'planning',
        width: installation.shaft.width,
        depth: installation.shaft.depth,
        bottomY,
        topY,
        centerY: metres(bottomY + (topY - bottomY) / 2),
        height: metres(topY - bottomY),
      })
    }
  }

  const counterweightBoundsPoints: MechanicalPoint[] = counterweight
    ? counterweight.arrangement === 'rear'
      ? [
          [
            metres(counterweight.center[0] - counterweight.width / 2),
            metres(counterweight.center[1] - counterweight.height / 2),
            counterweight.center[2],
          ],
          [
            metres(counterweight.center[0] + counterweight.width / 2),
            metres(counterweight.center[1] + counterweight.height / 2),
            counterweight.center[2],
          ],
        ]
      : [
          [
            counterweight.center[0],
            metres(counterweight.center[1] - counterweight.height / 2),
            metres(counterweight.center[2] - counterweight.width / 2),
          ],
          [
            counterweight.center[0],
            metres(counterweight.center[1] + counterweight.height / 2),
            metres(counterweight.center[2] + counterweight.width / 2),
          ],
        ]
    : []
  const machineBoundsPoints: MechanicalPoint[] = machine
    ? [
        [
          metres(machine.center[0] - machine.size[0] / 2),
          metres(machine.center[1] - machine.size[1] / 2),
          metres(machine.center[2] - machine.size[2] / 2),
        ],
        [
          metres(machine.center[0] + machine.size[0] / 2),
          metres(machine.center[1] + machine.size[1] / 2),
          metres(machine.center[2] + machine.size[2] / 2),
        ],
      ]
    : []
  const sheaveBoundsPoints: MechanicalPoint[] = tractionSheave
    ? [
        [
          metres(tractionSheave.center[0] - tractionSheave.diameter / 2),
          metres(tractionSheave.center[1] - tractionSheave.diameter / 2),
          tractionSheave.center[2],
        ],
        [
          metres(tractionSheave.center[0] + tractionSheave.diameter / 2),
          metres(tractionSheave.center[1] + tractionSheave.diameter / 2),
          tractionSheave.center[2],
        ],
      ]
    : []
  const additionalBoundsPoints = [
    ...counterweightBoundsPoints,
    ...machineBoundsPoints,
    ...sheaveBoundsPoints,
    ...(carBuffers?.basePositions ?? []),
    ...(counterweightBuffers?.basePositions ?? []),
    ...(suspension?.path ?? []),
  ]

  return {
    carFrame,
    carRails,
    counterweight,
    counterweightRails,
    carBuffers,
    counterweightBuffers,
    machine,
    tractionSheave,
    suspension,
    zones,
    bounds: createBounds(installation, additionalBoundsPoints),
  }
}
