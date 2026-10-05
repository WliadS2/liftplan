// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { validateCarLiftSpatialGeometry } from '../../collision/car-lift-spatial-validation'
import {
  createCarLiftDoorElevationDrawing,
  createCarLiftDrawingContext,
  createCarLiftPlanDrawing,
  createCarLiftSectionDrawing,
} from '../../drawings/car-lift-technical-drawings'
import { createTechnicalDrawingPresentation } from '../../drawings/technical-drawing'
import { createTechnicalPlanDxfMetadata, prepareTechnicalPlanDxf } from '../../documents/technical-plan-dxf'
import { generateTechnicalPlanDxf } from '../../documents/technical-plan-dxf-renderer'
import { createTechnicalPlanPdfMetadata, prepareTechnicalPlanPdf } from '../../documents/technical-plan-pdf'
import { kilograms, metresPerSecond, millimetres } from '../../engineering'
import {
  InMemoryProjectRepository,
  createLiftPlanProject,
  createLoadedProjectState,
  createStoredProject,
  duplicateStoredProject,
  migrateStoredProject,
  parseLiftPlanProjectFile,
  renameStoredProject,
  replaceProjectConfiguration,
  saveProjectVersion,
  serializeLiftPlanProjectFile,
} from '../../projects'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import {
  carLiftPlanningConfigurationSchema,
  createCarLiftNormalizedModel,
  createCarLiftPlanningConfiguration,
  createCarLiftSceneModel,
  createCenteredVehiclePosition,
  getLiftFamilyCapability,
  type CarLiftPlanningConfiguration,
} from '..'

const timestamp = '2026-10-05T12:00:00.000Z'
const mm = millimetres

function carConfiguration(update: Partial<CarLiftPlanningConfiguration> = {}): CarLiftPlanningConfiguration {
  return {
    ...createCarLiftPlanningConfiguration('Parkhaus Mitte'),
    ratedLoadKg: kilograms(3000),
    stopCount: 2,
    nominalSpeedMetresPerSecond: metresPerSecond(0.5),
    platformWidthMm: mm(2500),
    platformDepthMm: mm(5500),
    usableHeightMm: mm(2400),
    vehicleLoadingDirection: 'shaft-z',
    frontAccess: true,
    rearAccess: true,
    throughCar: true,
    doorClearWidthMm: mm(2400),
    doorClearHeightMm: mm(2300),
    shaftWidthMm: mm(3200),
    shaftDepthMm: mm(6500),
    pitDepthMm: mm(1200),
    headroomMm: mm(3600),
    storeyHeightsMm: [mm(3600)],
    vehicle: {
      widthMm: mm(1900), lengthMm: mm(4700), heightMm: mm(1900), massKg: kilograms(2100),
      frontOverhangMm: mm(850), rearOverhangMm: mm(750), wheelbaseMm: mm(3100), trackWidthMm: mm(1600),
    },
    vehiclePosition: createCenteredVehiclePosition(),
    entryApproachEnvelope: {
      widthMm: mm(2200), lengthMm: mm(1800), heightMm: mm(2200),
      lateralOffsetMm: mm(0), longitudinalOffsetMm: mm(-3650), headingDegrees: 0,
    },
    exitApproachEnvelope: {
      widthMm: mm(2200), lengthMm: mm(1800), heightMm: mm(2200),
      lateralOffsetMm: mm(0), longitudinalOffsetMm: mm(3650), headingDegrees: 0,
    },
    vehicleSweptEnvelope: {
      widthMm: mm(2000), lengthMm: mm(5000), heightMm: mm(2000),
      lateralOffsetMm: mm(0), longitudinalOffsetMm: mm(0), headingDegrees: 0,
    },
    doorPassageEnvelope: { clearWidthMm: mm(2200), clearHeightMm: mm(2200), depthMm: mm(400) },
    guideSystem: { orientation: 'x', spacingMm: mm(2700) },
    ...update,
  }
}

function context(configuration = carConfiguration()) {
  const value = createCarLiftDrawingContext(configuration)
  if (!value) throw new Error('Expected car drawing context')
  return value
}

function carProject(configuration = carConfiguration()) {
  const created = createLiftPlanProject(
    { projectId: 'car-project', projectName: configuration.projectName, liftFamily: 'car', createdAt: timestamp },
    { createId: () => 'car-project', now: () => timestamp },
  )
  return replaceProjectConfiguration(created, configuration, timestamp).project
}

function dxfFor(document: ReturnType<typeof createCarLiftPlanDrawing>, project = carProject()) {
  const candidate = { document, metadata: createTechnicalPlanDxfMetadata(project, document, new Date(timestamp)) }
  const prepared = prepareTechnicalPlanDxf({ scope: 'current', projectName: project.name, candidates: [candidate] })
  if (!prepared.ok) throw new Error(prepared.error.code)
  return generateTechnicalPlanDxf(prepared.value)
}

function primitiveExtents(content: string, primitiveId: string) {
  const pairs = content.trimEnd().split(/\r?\n/).reduce<Array<{ code: number; value: string }>>((all, value, index, lines) => {
    if (index % 2 === 0) all.push({ code: Number(value), value: lines[index + 1] ?? '' })
    return all
  }, [])
  const start = pairs.findIndex((entry) => entry.code === 999 && entry.value === `Primitive: ${primitiveId}`)
  const end = pairs.findIndex((entry, index) => index > start && entry.code === 999 && entry.value.startsWith('Primitive: '))
  const entity = pairs.slice(start, end < 0 ? undefined : end)
  const xs = entity.filter((entry) => entry.code === 10).map((entry) => Number(entry.value))
  const ys = entity.filter((entry) => entry.code === 20).map((entry) => Number(entry.value))
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

const validation = (configuration: CarLiftPlanningConfiguration) =>
  validateCarLiftSpatialGeometry(createCarLiftNormalizedModel(configuration))
const rule = (configuration: CarLiftPlanningConfiguration, id: string) =>
  validation(configuration).results.find((entry) => entry.ruleId === id)

describe('car-lift configuration and normalization', () => {
  it('parses a typed configuration and creates no technical defaults', () => {
    expect(carLiftPlanningConfigurationSchema.parse(carConfiguration())).toEqual(carConfiguration())
    expect(createCarLiftPlanningConfiguration('Leer')).toEqual({
      family: 'car', schemaVersion: 'car-lift-planning-v1', projectName: 'Leer',
    })
  })

  it.each([2, 6, 10])('normalizes %i stops deterministically', (stopCount) => {
    const storeyHeightsMm = Array.from({ length: stopCount - 1 }, () => mm(3600))
    const first = createCarLiftNormalizedModel(carConfiguration({ stopCount, storeyHeightsMm }))
    const second = createCarLiftNormalizedModel(carConfiguration({ stopCount, storeyHeightsMm }))
    expect(first).toEqual(second)
    expect(first.status).toBe('complete')
    if (first.status === 'empty') throw new Error('Expected model')
    expect(first.model.levels).toHaveLength(stopCount)
    expect(first.model.levels.at(-1)?.elevationMm).toBe((stopCount - 1) * 3600)
  })

  it('supports explicit stop elevations independently of storey heights', () => {
    const normalized = createCarLiftNormalizedModel(carConfiguration({
      stopCount: 3, storeyHeightsMm: undefined, levelElevationsMm: [mm(0), mm(3700), mm(7600)],
    }))
    if (normalized.status === 'empty') throw new Error('Expected model')
    expect(normalized.model.levels.map((level) => level.elevationMm)).toEqual([0, 3700, 7600])
  })

  it('normalizes position, centerline and four wheel contact markers', () => {
    const normalized = createCarLiftNormalizedModel(carConfiguration())
    if (normalized.status === 'empty') throw new Error('Expected model')
    expect(normalized.model.vehicle?.center).toEqual({ x: 0, z: 0 })
    expect(normalized.model.vehicle?.wheelContactPoints).toHaveLength(4)
    const scene = createCarLiftSceneModel(normalized.model)
    expect(scene.assemblies.filter((entry) => entry.kind === 'wheel-contact')).toHaveLength(4)
    expect(scene.assemblies.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'car-shaft', 'car-platform', 'car-front', 'car-rear', 'car-vehicle-body',
      'car-guide-a', 'car-guide-b', 'car-vehicle-centerline', 'car-entry-approach', 'car-exit-approach',
    ]))
  })

  it('registers all technical capabilities except simulation', () => {
    for (const capability of ['configuration', 'normalization', 'validation', 'geometry', 'three', 'drawings', 'pdf', 'dxf', 'persistence', 'migration'] as const) {
      expect(getLiftFamilyCapability('car', capability).status).toBe('available')
    }
    expect(getLiftFamilyCapability('car', 'simulation').status).toBe('unavailable')
    expect(createLiftFamilyTechnicalModel(carConfiguration())).toMatchObject({
      status: 'available', family: 'car', validation: { status: 'ok' },
    })
  })
})

describe('car-lift geometric validation', () => {
  it('validates front and through-car configurations', () => {
    expect(rule(carConfiguration(), 'car.access.consistency')?.status).toBe('ok')
    expect(rule(carConfiguration({ throughCar: false, rearAccess: false }), 'car.access.consistency')?.status).toBe('ok')
    expect(rule(carConfiguration({ throughCar: true, rearAccess: false }), 'car.access.consistency')?.status).toBe('invalid')
  })

  it('detects oversized vehicle width and length independently', () => {
    expect(rule(carConfiguration({ vehicle: { ...carConfiguration().vehicle, widthMm: mm(2600) } }),
      'car.vehicle.platform-fit')?.status).toBe('invalid')
    expect(rule(carConfiguration({ vehicle: { ...carConfiguration().vehicle, lengthMm: mm(5600) } }),
      'car.vehicle.platform-fit')?.status).toBe('invalid')
  })

  it('detects excessive vehicle height', () => {
    expect(rule(carConfiguration({ vehicle: { ...carConfiguration().vehicle, heightMm: mm(2500) } }),
      'car.vehicle.height-fit')?.status).toBe('invalid')
  })

  it('validates vehicle passage through configured doors', () => {
    expect(rule(carConfiguration(), 'car.vehicle.door-passage')?.status).toBe('ok')
    expect(rule(carConfiguration({ doorClearWidthMm: mm(1800) }), 'car.vehicle.door-passage')?.status).toBe('invalid')
    expect(rule(carConfiguration({ doorClearHeightMm: mm(1800) }), 'car.vehicle.door-passage')?.status).toBe('invalid')
  })

  it('validates an explicit passage envelope against each configured opening', () => {
    expect(rule(carConfiguration(), 'car.approach.door-passage-envelope')?.status).toBe('ok')
    expect(rule(carConfiguration({ doorPassageEnvelope: {
      clearWidthMm: mm(2500), clearHeightMm: mm(2200), depthMm: mm(400),
    } }), 'car.approach.door-passage-envelope')?.status).toBe('invalid')
    expect(rule(carConfiguration({ doorPassageEnvelope: undefined }),
      'car.approach.door-passage-envelope')?.status).toBe('unknown')
  })

  it('detects vehicle offsets that put the oriented vehicle outside the platform', () => {
    const positioned = rule(carConfiguration({
      vehiclePosition: { lateralOffsetMm: mm(500), longitudinalOffsetMm: mm(0), headingDegrees: 0 },
    }), 'car.vehicle.position-fit')
    expect(positioned?.status).toBe('invalid')
  })

  it('returns UNKNOWN for rules affected by missing optional vehicle data', () => {
    const configuration = carConfiguration({ vehicle: undefined, vehiclePosition: undefined, vehicleSweptEnvelope: undefined })
    expect(rule(configuration, 'car.vehicle.platform-fit')?.status).toBe('unknown')
    expect(rule(configuration, 'car.vehicle.height-fit')?.status).toBe('unknown')
    expect(rule(configuration, 'car.vehicle.position-fit')?.status).toBe('unknown')
    expect(rule(configuration, 'car.vehicle.swept-envelope-fit')?.status).toBe('unknown')
  })

  it('validates only an explicitly configured swept envelope', () => {
    expect(rule(carConfiguration(), 'car.vehicle.swept-envelope-fit')?.status).toBe('ok')
    expect(rule(carConfiguration({ vehicleSweptEnvelope: {
      widthMm: mm(3000), lengthMm: mm(5000), heightMm: mm(2000), lateralOffsetMm: mm(0),
      longitudinalOffsetMm: mm(0), headingDegrees: 0,
    } }), 'car.vehicle.swept-envelope-fit')?.status).toBe('invalid')
  })

  it('checks shaft containment, ordered stops and explicit vertical geometry', () => {
    expect(rule(carConfiguration({ platformWidthMm: mm(3300) }), 'car.platform.shaft-fit')?.status).toBe('invalid')
    expect(validation(carConfiguration({
      stopCount: 3, storeyHeightsMm: undefined, levelElevationsMm: [mm(0), mm(4000), mm(3500)],
    })).status).toBe('invalid')
    expect(rule(carConfiguration({ pitDepthMm: undefined }), 'car.vertical.pit-headroom')?.status).toBe('unknown')
  })
})

describe('car-lift persistence, drawings and export', () => {
  it('round-trips, renames and duplicates car planning data', async () => {
    const repository = new InMemoryProjectRepository()
    const project = carProject()
    const stored = createStoredProject(project)
    await repository.saveProject(stored)
    const loaded = createLoadedProjectState((await repository.getProject(project.id))!)
    expect(loaded.project.configuration).toEqual(project.configuration)
    expect(renameStoredProject(stored, 'Umbenannt', timestamp).planningData).toMatchObject({ projectName: 'Umbenannt' })
    expect(duplicateStoredProject(stored, { id: 'copy', name: 'Kopie', timestamp }).planningData).toMatchObject({ projectName: 'Kopie' })
  })

  it('preserves car planning data in versions and .liftplan.json files', async () => {
    const repository = new InMemoryProjectRepository()
    const stored = createStoredProject(carProject())
    const saved = await saveProjectVersion(repository, stored, timestamp, 'Autoaufzug Planungsstand')
    const source = serializeLiftPlanProjectFile(saved.project, timestamp, [saved.version])
    const parsed = parseLiftPlanProjectFile(source)
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        project: { liftFamily: 'car', planningData: { schemaVersion: 'car-lift-planning-v1' } },
        versions: [{ snapshot: { liftFamily: 'car', planningData: { family: 'car' } } }],
      },
    })
  })

  it('migrates the legacy car placeholder without changing the storage schema', () => {
    const base = createStoredProject(carProject())
    expect(migrateStoredProject({
      ...base, planningData: { family: 'car', schemaVersion: 'lift-planning-placeholder-v1' },
    })).toMatchObject({
      ok: true,
      value: { planningData: { family: 'car', schemaVersion: 'car-lift-planning-v1', projectName: 'Parkhaus Mitte' } },
    })
  })

  it('creates deterministic Grundriss, Schnitt and Türansicht documents', () => {
    const create = () => [
      createCarLiftPlanDrawing(context()),
      createCarLiftSectionDrawing(context()),
      createCarLiftDoorElevationDrawing(context(), { levelId: 'level-2', side: 'rear' }),
    ]
    expect(create()).toEqual(create())
    expect(create().map((document) => document.status)).toEqual(['complete', 'complete', 'complete'])
  })

  it.each(['1:20', '1:25', '1:50', '1:100'] as const)(
    'keeps DXF model coordinates independent of paper scale %s', (scale) => {
      const dxf = dxfFor(createCarLiftPlanDrawing(context(), scale))
      expect(primitiveExtents(dxf, 'car-shaft')).toEqual({ width: 3200, height: 6500 })
    },
  )

  it('does not use browser viewport dimensions for DXF coordinates', () => {
    const document = createCarLiftPlanDrawing(context(), '1:50')
    const before = dxfFor(document)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 333 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 777 })
    expect(dxfFor(document)).toBe(before)
  })

  it('preserves a 2400 x 2300 door in DXF and prepares PDF from the same document', () => {
    const project = carProject()
    const document = createCarLiftDoorElevationDrawing(context(), { levelId: 'level-1', side: 'front' }, '1:50')
    expect(primitiveExtents(dxfFor(document, project), 'car-door-opening')).toEqual({ width: 2400, height: 2300 })
    const candidate = {
      document, presentation: createTechnicalDrawingPresentation(document),
      metadata: createTechnicalPlanPdfMetadata(project, document, '1:50', new Date(timestamp), { landing: 1, side: 'front' }),
    }
    expect(prepareTechnicalPlanPdf({ scope: 'current', scale: '1:50', projectName: project.name, candidates: [candidate] }))
      .toMatchObject({ ok: true })
  })
})
