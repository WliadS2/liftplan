// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { validateGoodsLiftSpatialGeometry } from '../../collision/goods-lift-spatial-validation'
import {
  createGoodsLiftDoorElevationDrawing,
  createGoodsLiftDrawingContext,
  createGoodsLiftPlanDrawing,
  createGoodsLiftSectionDrawing,
} from '../../drawings/goods-lift-technical-drawings'
import { createTechnicalDrawingPresentation } from '../../drawings/technical-drawing'
import {
  createTechnicalPlanDxfMetadata,
  prepareTechnicalPlanDxf,
} from '../../documents/technical-plan-dxf'
import { generateTechnicalPlanDxf } from '../../documents/technical-plan-dxf-renderer'
import {
  createTechnicalPlanPdfMetadata,
  prepareTechnicalPlanPdf,
} from '../../documents/technical-plan-pdf'
import { kilograms, metresPerSecond, millimetres } from '../../engineering'
import {
  InMemoryProjectRepository,
  createLiftPlanProject,
  createLoadedProjectState,
  createStoredProject,
  migrateStoredProject,
  parseLiftPlanProjectFile,
  replaceProjectConfiguration,
} from '../../projects'
import {
  LIFT_FAMILIES,
  createGoodsLiftNormalizedModel,
  createGoodsLiftPlanningConfiguration,
  createGoodsLiftSceneModel,
  createPassengerPlanningConfiguration,
  getLiftFamilyCapability,
  getLiftTypeDefinitions,
  goodsLiftPlanningConfigurationSchema,
  passengerPlanningConfigurationSchema,
  type GoodsLiftPlanningConfiguration,
} from '..'
import { createLiftFamilyTechnicalModel } from '../../lift-families'

const timestamp = '2026-10-05T12:00:00.000Z'
const mm = millimetres

function goodsConfiguration(update: Partial<GoodsLiftPlanningConfiguration> = {}): GoodsLiftPlanningConfiguration {
  return {
    ...createGoodsLiftPlanningConfiguration('Logistikzentrum'),
    ratedLoadKg: kilograms(2500),
    stopCount: 2,
    nominalSpeedMetresPerSecond: metresPerSecond(0.8),
    platformWidthMm: mm(1800),
    platformDepthMm: mm(2400),
    platformHeightMm: mm(2300),
    doorWidthMm: mm(1400),
    doorHeightMm: mm(2200),
    shaftWidthMm: mm(2600),
    shaftDepthMm: mm(3200),
    pitDepthMm: mm(1200),
    headroomMm: mm(3800),
    storeyHeightsMm: [mm(3500)],
    throughCar: true,
    frontAccess: true,
    rearAccess: true,
    loadCategory: 'mixed',
    pallet: { widthMm: mm(1200), depthMm: mm(800), heightMm: mm(1600) },
    rollContainer: { widthMm: mm(800), depthMm: mm(1200), heightMm: mm(1800) },
    forkliftEnvelope: { widthMm: mm(1500), depthMm: mm(2200), heightMm: mm(2200) },
    guideSystem: { orientation: 'x', spacingMm: mm(2100) },
    ...update,
  }
}

function context(configuration = goodsConfiguration()) {
  const value = createGoodsLiftDrawingContext(configuration)
  if (!value) throw new Error('Expected goods drawing context')
  return value
}

function goodsProject(configuration = goodsConfiguration()) {
  const created = createLiftPlanProject(
    { projectId: 'goods-project', projectName: configuration.projectName, liftFamily: 'goods', createdAt: timestamp },
    { createId: () => 'goods-project', now: () => timestamp },
  )
  return replaceProjectConfiguration(created, configuration, timestamp).project
}

function dxfFor(document: ReturnType<typeof createGoodsLiftPlanDrawing>, project = goodsProject()) {
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

describe('lift-family registry', () => {
  it('registers all eight target families with explicit capabilities', () => {
    expect(getLiftTypeDefinitions().map((entry) => entry.id)).toEqual([
      'passenger', 'goods', 'car', 'small-goods', 'hospital-bed', 'home', 'platform', 'heavy-duty',
    ])
    expect(getLiftFamilyCapability('goods', 'validation').status).toBe('available')
    expect(getLiftFamilyCapability('goods', 'simulation').status).toBe('unavailable')
    expect(getLiftFamilyCapability('car', 'drawings').status).toBe('unavailable')
  })

  it('keeps passenger configuration parsing backwards-compatible', () => {
    const configuration = createPassengerPlanningConfiguration('Bestand')
    expect(passengerPlanningConfigurationSchema.parse(configuration)).toEqual(configuration)
    expect(configuration.family).toBe(LIFT_FAMILIES.passenger)
  })
})

describe('goods-lift configuration and normalization', () => {
  it('parses the typed planning configuration without engineering defaults', () => {
    expect(goodsLiftPlanningConfigurationSchema.parse(goodsConfiguration())).toEqual(goodsConfiguration())
    expect(createGoodsLiftPlanningConfiguration('Leer')).toEqual({
      family: 'goods', schemaVersion: 'goods-planning-v1', projectName: 'Leer',
    })
  })

  it.each([2, 6, 10])('normalizes %i ordered stops deterministically', (stopCount) => {
    const storeyHeightsMm = Array.from({ length: stopCount - 1 }, () => mm(3500))
    const first = createGoodsLiftNormalizedModel(goodsConfiguration({ stopCount, storeyHeightsMm }))
    const second = createGoodsLiftNormalizedModel(goodsConfiguration({ stopCount, storeyHeightsMm }))
    expect(first).toEqual(second)
    expect(first.status).toBe('complete')
    if (first.status === 'empty') throw new Error('Expected model')
    expect(first.model.levels).toHaveLength(stopCount)
    expect(first.model.levels.at(-1)?.elevationMm).toBe((stopCount - 1) * 3500)
  })

  it('creates separate semantic scene assemblies without Three.js objects', () => {
    const normalized = createGoodsLiftNormalizedModel(goodsConfiguration())
    if (normalized.status === 'empty') throw new Error('Expected model')
    const scene = createGoodsLiftSceneModel(normalized.model)
    expect(scene.assemblies.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'goods-shaft', 'goods-platform', 'goods-front', 'goods-rear',
      'goods-guide-a', 'goods-guide-b', 'goods-pallet', 'goods-roll-container', 'goods-forklift-envelope',
    ]))
  })

  it('returns discriminated family models and explicit unavailable states', () => {
    expect(createLiftFamilyTechnicalModel(goodsConfiguration())).toMatchObject({
      status: 'available', family: 'goods', validation: { status: 'ok' },
    })
    expect(createLiftFamilyTechnicalModel(createPassengerPlanningConfiguration('Bestand'))).toMatchObject({
      status: 'available', family: 'passenger', planning: { liftFamily: 'passenger' },
    })
    expect(createLiftFamilyTechnicalModel({ family: 'car', schemaVersion: 'lift-planning-placeholder-v1' })).toEqual({
      status: 'unavailable', family: 'car', reason: 'family-capability-unavailable',
    })
  })
})

describe('goods-lift geometric validation', () => {
  const validate = (configuration: GoodsLiftPlanningConfiguration) =>
    validateGoodsLiftSpatialGeometry(createGoodsLiftNormalizedModel(configuration))
  const rule = (configuration: GoodsLiftPlanningConfiguration, id: string) =>
    validate(configuration).results.find((entry) => entry.ruleId === id)

  it('validates platform, moving envelope, doors and through-car access geometrically', () => {
    const validation = validate(goodsConfiguration())
    expect(validation.status).toBe('ok')
    expect(rule(goodsConfiguration(), 'goods.access.consistency')?.status).toBe('ok')
    expect(rule(goodsConfiguration({ rearAccess: false }), 'goods.access.consistency')?.status).toBe('invalid')
  })

  it('detects platform and door geometry outside explicit bounds', () => {
    expect(rule(goodsConfiguration({ platformWidthMm: mm(2800) }), 'goods.platform.shaft-fit')?.status).toBe('invalid')
    expect(rule(goodsConfiguration({ doorHeightMm: mm(2400) }), 'goods.doors.platform-fit')?.status).toBe('invalid')
  })

  it.each([
    ['pallet', 'goods.load.pallet-fit', 'pallet-outside-platform'],
    ['rollContainer', 'goods.load.roll-container-fit', 'roll-container-outside-platform'],
    ['forkliftEnvelope', 'goods.load.forklift-envelope-fit', 'forklift-envelope-outside-platform'],
  ] as const)('reports fit, non-fit and missing %s data without invented limits', (field, ruleId, issueCode) => {
    expect(rule(goodsConfiguration(), ruleId)?.status).toBe('ok')
    expect(rule(goodsConfiguration({ [field]: { widthMm: mm(1900), depthMm: mm(1000) } }), ruleId))
      .toMatchObject({ status: 'invalid', issues: [{ code: issueCode }] })
    expect(rule(goodsConfiguration({ [field]: undefined }), ruleId)?.status).toBe('unknown')
  })

  it('reports unordered explicit stops as INVALID and missing levels as UNKNOWN', () => {
    expect(validate(goodsConfiguration({ stopCount: 3, levelElevationsMm: [mm(0), mm(4000), mm(3000)] })).status).toBe('invalid')
    expect(rule(goodsConfiguration({ stopCount: undefined, storeyHeightsMm: undefined }), 'goods.levels.order')?.status).toBe('unknown')
  })
})

describe('goods persistence, drawings and export', () => {
  it('round-trips goods planning through the existing project repository', async () => {
    const repository = new InMemoryProjectRepository()
    const project = goodsProject()
    await repository.saveProject(createStoredProject(project))
    const loaded = createLoadedProjectState((await repository.getProject(project.id))!)
    expect(loaded.project.liftFamily).toBe('goods')
    expect(loaded.project.configuration).toEqual(project.configuration)
  })

  it('migrates the legacy goods placeholder and leaves passenger records unchanged', () => {
    const base = createStoredProject(goodsProject())
    const legacy = migrateStoredProject({
      ...base,
      planningData: { family: 'goods', schemaVersion: 'lift-planning-placeholder-v1' },
    })
    expect(legacy).toMatchObject({
      ok: true,
      value: { planningData: { family: 'goods', schemaVersion: 'goods-planning-v1', projectName: 'Logistikzentrum' } },
    })
    const passenger = createStoredProject(createLiftPlanProject({ projectId: 'passenger', createdAt: timestamp }, { now: () => timestamp }))
    expect(migrateStoredProject(passenger)).toEqual({ ok: true, value: passenger })

    const file = parseLiftPlanProjectFile(JSON.stringify({
      format: 'liftplan-project-file', schemaVersion: 1, exportedAt: timestamp,
      project: { ...base, planningData: { family: 'goods', schemaVersion: 'lift-planning-placeholder-v1' } },
    }))
    expect(file).toMatchObject({ ok: true, value: { project: { planningData: { schemaVersion: 'goods-planning-v1' } } } })
  })

  it('creates deterministic Grundriss, Schnitt and Türansicht documents', () => {
    const ctx = context()
    const create = () => [
      createGoodsLiftPlanDrawing(ctx),
      createGoodsLiftSectionDrawing(ctx),
      createGoodsLiftDoorElevationDrawing(ctx, { levelId: 'level-2', side: 'rear' }),
    ]
    expect(create()).toEqual(create())
    expect(create().map((entry) => entry.status)).toEqual(['complete', 'complete', 'complete'])
  })

  it.each(['1:20', '1:25', '1:50', '1:100'] as const)(
    'keeps DXF model-space coordinates independent of paper scale %s', (scale) => {
      const plan = createGoodsLiftPlanDrawing(context(), scale)
      const dxf = dxfFor(plan)
      expect(primitiveExtents(dxf, 'goods-shaft')).toEqual({ width: 2600, height: 3200 })
    },
  )

  it('preserves the 1400 x 2200 door in DXF and prepares fixed-scale PDF from the same drawing', () => {
    const project = goodsProject()
    const document = createGoodsLiftDoorElevationDrawing(context(), { levelId: 'level-1', side: 'front' }, '1:50')
    expect(primitiveExtents(dxfFor(document, project), 'goods-door-opening')).toEqual({ width: 1400, height: 2200 })
    const presentation = createTechnicalDrawingPresentation(document)
    const candidate = {
      document, presentation,
      metadata: createTechnicalPlanPdfMetadata(project, document, '1:50', new Date(timestamp), { landing: 1, side: 'front' }),
    }
    expect(prepareTechnicalPlanPdf({ scope: 'current', scale: '1:50', projectName: project.name, candidates: [candidate] }))
      .toMatchObject({ ok: true })
  })
})
