import { describe, expect, it } from 'vitest'
import {
  createPassengerPlanningConfiguration,
  updatePassengerPlanningConfiguration,
  type CounterweightPosition,
  type PassengerPlanningConfigurationUpdate,
} from '../../../../elevator'
import { millimetres } from '../../../../engineering'
import {
  createLiftGeometryPlanningInput,
  type PassengerGeometryPlanningInput,
} from '../../lift-geometry-planning-input'
import {
  getPassengerViewVisibility,
  PASSENGER_VIEW_MODE_CATALOG,
} from '../../../scene/view-mode'
import {
  createPassengerInstallationModel,
  type PassengerInstallationModel,
} from '../passenger-installation-model'
import { createPassengerMechanicalLayout } from './passenger-mechanical-layout'

function createPlanningInput(
  update: PassengerPlanningConfigurationUpdate = {},
): PassengerGeometryPlanningInput {
  const configuration = updatePassengerPlanningConfiguration(
    createPassengerPlanningConfiguration('Mechanik-Testprojekt'),
    update,
  )
  const input = createLiftGeometryPlanningInput(configuration)

  if (!input) {
    throw new Error('Expected passenger planning input.')
  }

  return input
}

function createModel(input: PassengerGeometryPlanningInput) {
  const result = createPassengerInstallationModel(input)

  if (!('model' in result) || !result.model) {
    throw new Error('Expected renderable installation model.')
  }

  return result.model
}

function createLayout(input: PassengerGeometryPlanningInput) {
  return createPassengerMechanicalLayout(input, createModel(input))
}

function createCabinInput(update: PassengerPlanningConfigurationUpdate = {}) {
  return createPlanningInput({
    cabinWidthMm: millimetres(1100),
    cabinDepthMm: millimetres(1400),
    cabinHeightMm: millimetres(2200),
    ...update,
  })
}

function createInstallationInput(
  update: PassengerPlanningConfigurationUpdate = {},
) {
  return createCabinInput({
    stopCount: 3,
    shaftWidthMm: millimetres(1800),
    shaftDepthMm: millimetres(2100),
    floorHeightMm: millimetres(3000),
    pitDepthMm: millimetres(1200),
    headroomMm: millimetres(3600),
    counterweightWidthMm: millimetres(700),
    counterweightHeightMm: millimetres(1800),
    counterweightPosition: 'rear',
    ...update,
  })
}

describe('passenger mechanical layout', () => {
  it('runs as a pure transformation without a React rendering context', () => {
    const input = createCabinInput()

    expect(() => createLayout(input)).not.toThrow()
    expect(createLayout(input).carFrame).toBeDefined()
  })

  it('tracks cabin dimensions without mutating the installation cabin', () => {
    const input = createCabinInput()
    const installation = createModel(input)
    const originalCabin = { ...installation.cabin }
    const layout = createPassengerMechanicalLayout(input, installation)

    expect(layout.carFrame).toMatchObject({
      width: 1.1,
      depth: 1.4,
      bottomY: 0,
      topY: 2.2,
      envelopeSource: 'planning',
      constructionSource: 'schematic',
    })
    expect(installation.cabin).toEqual(originalCabin)
  })

  it('keeps cabin and counterweight rails as separate systems', () => {
    const layout = createLayout(createInstallationInput())

    expect(layout.carRails).toMatchObject({ kind: 'car' })
    expect(layout.counterweightRails).toMatchObject({
      kind: 'counterweight',
    })
    expect(layout.carRails).not.toBe(layout.counterweightRails)
    expect(layout.carRails?.rails[0].id).toBe('car-rail-1')
    expect(layout.counterweightRails?.rails[0].id).toBe(
      'counterweight-rail-1',
    )
  })

  it.each<CounterweightPosition>(['rear', 'left', 'right'])(
    'retains the explicit %s counterweight arrangement',
    (arrangement) => {
      const layout = createLayout(
        createInstallationInput({ counterweightPosition: arrangement }),
      )

      expect(layout.counterweight?.arrangement).toBe(arrangement)
      expect(layout.counterweight?.dimensionsSource).toBe('planning')
      expect(layout.counterweight?.placementSource).toBe('schematic')
    },
  )

  it('does not fail when mechanical subsystems lack planning data', () => {
    const layout = createLayout(createCabinInput())

    expect(layout.counterweight).toBeUndefined()
    expect(layout.counterweightRails).toBeUndefined()
    expect(layout.machine).toBeUndefined()
    expect(layout.tractionSheave).toBeUndefined()
    expect(layout.suspension).toBeUndefined()
  })

  it('keeps buffers optional until pit and related assembly context exist', () => {
    const withoutPit = createLayout(
      createInstallationInput({ pitDepthMm: undefined }),
    )
    const withPit = createLayout(createInstallationInput())

    expect(withoutPit.carBuffers).toBeUndefined()
    expect(withoutPit.counterweightBuffers).toBeUndefined()
    expect(withPit.carBuffers).toMatchObject({ kind: 'car' })
    expect(withPit.counterweightBuffers).toMatchObject({
      kind: 'counterweight',
    })
  })

  it('creates machine and sheave only from complete explicit inputs', () => {
    const base = createInstallationInput()
    const partialInput: PassengerGeometryPlanningInput = {
      ...base,
      mechanical: {
        ...base.mechanical,
        machine: {
          positionMm: {
            xMm: millimetres(0),
            yMm: millimetres(9500),
            zMm: millimetres(0),
          },
        },
      },
    }
    const explicitInput: PassengerGeometryPlanningInput = {
      ...base,
      mechanical: {
        ...base.mechanical,
        machine: {
          positionMm: {
            xMm: millimetres(0),
            yMm: millimetres(9500),
            zMm: millimetres(0),
          },
          envelopeMm: {
            widthMm: millimetres(800),
            heightMm: millimetres(500),
            depthMm: millimetres(600),
          },
        },
        tractionSheave: {
          positionMm: {
            xMm: millimetres(0),
            yMm: millimetres(9200),
            zMm: millimetres(0),
          },
          diameterMm: millimetres(400),
        },
      },
    }

    expect(createLayout(partialInput).machine).toBeUndefined()
    expect(createLayout(partialInput).tractionSheave).toBeUndefined()
    expect(createLayout(explicitInput).machine).toMatchObject({
      center: [0, 9.5, 0],
      size: [0.8, 0.5, 0.6],
    })
    expect(createLayout(explicitInput).tractionSheave).toMatchObject({
      center: [0, 9.2, 0],
      diameter: 0.4,
    })
  })

  it('creates a suspension path only from an explicit arrangement and path', () => {
    const base = createInstallationInput()
    const input: PassengerGeometryPlanningInput = {
      ...base,
      mechanical: {
        ...base.mechanical,
        suspension: {
          arrangement: '2:1',
          pathPointsMm: [
            {
              xMm: millimetres(0),
              yMm: millimetres(9000),
              zMm: millimetres(0),
            },
            {
              xMm: millimetres(0),
              yMm: millimetres(0),
              zMm: millimetres(0),
            },
          ],
        },
      },
    }

    expect(createLayout(base).suspension).toBeUndefined()
    expect(createLayout(input).suspension).toEqual({
      source: 'planning',
      arrangement: '2:1',
      path: [
        [0, 9, 0],
        [0, 0, 0],
      ],
    })
  })

  it('emphasizes mechanics while reducing cabin and shaft obstruction', () => {
    const overview = getPassengerViewVisibility('overview')
    const mechanical = getPassengerViewVisibility('mechanical')

    expect(mechanical.mechanicalOpacity).toBeGreaterThan(
      overview.mechanicalOpacity,
    )
    expect(mechanical.cabinShellOpacity).toBeLessThan(
      overview.cabinShellOpacity,
    )
    expect(mechanical.shaftEnvelopeOpacity).toBeLessThan(
      overview.shaftEnvelopeOpacity,
    )
  })

  it('keeps mechanical components visible in cutaway mode', () => {
    const cutaway = getPassengerViewVisibility('cutaway')

    expect(cutaway.mechanicalOpacity).toBeGreaterThan(0)
    expect(cutaway.showRightCabinWall).toBe(false)
    expect(cutaway.shaftEnvelopeOpacity).toBe(0)
  })

  it('keeps future view modes typed but exposes only implemented controls', () => {
    expect(
      PASSENGER_VIEW_MODE_CATALOG.filter(({ implemented }) => implemented).map(
        ({ id }) => id,
      ),
    ).toEqual(['overview', 'mechanical', 'cutaway'])
    expect(
      PASSENGER_VIEW_MODE_CATALOG.find(({ id }) => id === 'drive'),
    ).toMatchObject({ label: 'Antrieb', implemented: false })
  })

  it('does not add counterweight mass or balance calculations', () => {
    const counterweight = createLayout(createInstallationInput()).counterweight

    expect(counterweight).toBeDefined()
    expect(counterweight).not.toHaveProperty('mass')
    expect(counterweight).not.toHaveProperty('massKg')
    expect(counterweight).not.toHaveProperty('balanceFactor')
  })

  it('leaves the provided installation object reusable', () => {
    const input = createInstallationInput()
    const installation: PassengerInstallationModel = createModel(input)

    expect(
      createPassengerMechanicalLayout(input, installation).bounds.height,
    ).toBeCloseTo(installation.bounds.height)
  })
})
