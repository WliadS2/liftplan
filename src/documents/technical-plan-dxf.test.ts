// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../dev/fixtures/passenger-mechanical-fixture'
import type { PassengerPlanningConfiguration } from '../elevator'
import {
  createPassengerDoorElevationDrawing,
  createPassengerDrawingContext,
  createPassengerPlanDrawing,
  createPassengerSectionDrawing,
} from '../drawings/passenger-technical-drawings'
import type { TechnicalDrawingDocument } from '../drawings/technical-drawing'
import { createLiftPlanProject, replaceProjectConfiguration } from '../projects'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import {
  createTechnicalPlanDxfFilename,
  createTechnicalPlanDxfMetadata,
  prepareTechnicalPlanDxf,
  type DoorDrawingDxfSelection,
  type PreparedTechnicalPlanDxf,
  type TechnicalPlanDxfCandidate,
} from './technical-plan-dxf'
import {
  generateTechnicalPlanDxf,
  TECHNICAL_DXF_LAYERS,
  TECHNICAL_DXF_VERSION,
} from './technical-plan-dxf-renderer'

const fixture = createPassengerMechanicalFixture()
const createdProject = createLiftPlanProject(
  { projectId: 'LP-DXF-2026-001', projectName: fixture.projectName, createdAt: '2026-10-05T10:00:00.000Z' },
  { createId: () => 'LP-DXF-2026-001', now: () => '2026-10-05T10:00:00.000Z' },
)
const project = replaceProjectConfiguration(createdProject, fixture, '2026-10-05T10:00:00.000Z').project
const exportDate = new Date(2026, 9, 5, 12, 0, 0)

function context(configuration: PassengerPlanningConfiguration = fixture) {
  const planning = createLiftGeometryPlanningInput(configuration)
  if (!planning) throw new Error('Expected planning input')
  const value = createPassengerDrawingContext(planning)
  if (!value) throw new Error('Expected drawing context')
  return value
}

function candidate(document: TechnicalDrawingDocument, doorSelection?: DoorDrawingDxfSelection): TechnicalPlanDxfCandidate {
  return {
    document,
    metadata: createTechnicalPlanDxfMetadata(project, document, exportDate, doorSelection),
  }
}

function prepareCurrent(document: TechnicalDrawingDocument, doorSelection?: DoorDrawingDxfSelection): PreparedTechnicalPlanDxf {
  const result = prepareTechnicalPlanDxf({
    scope: 'current', projectName: project.name, candidates: [candidate(document, doorSelection)],
  })
  if (!result.ok) throw new Error(`DXF preparation failed: ${result.error.code}`)
  return result.value
}

interface DxfPair {
  readonly code: number
  readonly value: string
}

function pairs(content: string): readonly DxfPair[] {
  const lines = content.trimEnd().split(/\r?\n/)
  const result: DxfPair[] = []
  for (let index = 0; index < lines.length; index += 2) {
    result.push({ code: Number(lines[index]), value: lines[index + 1] ?? '' })
  }
  return result
}

function primitivePairs(content: string, primitiveId: string): readonly DxfPair[] {
  const values = pairs(content)
  const start = values.findIndex((entry) => entry.code === 999 && entry.value === `Primitive: ${primitiveId}`)
  if (start < 0) throw new Error(`Missing primitive ${primitiveId}`)
  const end = values.findIndex((entry, index) => index > start && (
    entry.code === 999 && entry.value.startsWith('Primitive: ') ||
    entry.code === 0 && (entry.value === 'ENDSEC' || entry.value === 'ENDBLK')
  ))
  return values.slice(start + 1, end < 0 ? undefined : end)
}

function vertexExtents(content: string, primitiveId: string) {
  const values = primitivePairs(content, primitiveId)
  const points: Array<readonly [number, number]> = []
  for (let index = 0; index < values.length; index += 1) {
    if (values[index].code !== 0 || values[index].value !== 'VERTEX') continue
    const x = values.slice(index + 1).find((entry) => entry.code === 10)
    const y = values.slice(index + 1).find((entry) => entry.code === 20)
    if (x && y) points.push([Number(x.value), Number(y.value)])
  }
  return {
    minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)),
  }
}

function primitiveEntityLayer(content: string, primitiveId: string): string | undefined {
  return primitivePairs(content, primitiveId).find((entry) => entry.code === 8)?.value
}

function sectionContent(content: string, name: string): string {
  const marker = `0\r\nSECTION\r\n2\r\n${name}\r\n`
  const start = content.indexOf(marker)
  if (start < 0) throw new Error(`Missing section ${name}`)
  const end = content.indexOf('0\r\nENDSEC\r\n', start)
  return content.slice(start, end)
}

describe('technical plan DXF export', () => {
  it('writes ASCII DXF R12 with all deterministic CAD layers and semantic line types', () => {
    const content = generateTechnicalPlanDxf(prepareCurrent(createPassengerPlanDrawing(context(), 'auto')))
    expect(content).toContain(`9\r\n$ACADVER\r\n1\r\n${TECHNICAL_DXF_VERSION}\r\n`)
    expect(content.endsWith('0\r\nEOF\r\n')).toBe(true)
    for (const layer of TECHNICAL_DXF_LAYERS) expect(content).toContain(`0\r\nLAYER\r\n2\r\n${layer}\r\n`)
    expect(content).toContain('2\r\nCENTER\r\n')
    expect(content).toContain('2\r\nHIDDEN\r\n')
    expect([...content].every((character) => {
      const code = character.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || code >= 32 && code <= 126
    })).toBe(true)
  })

  it('exports the 2600 x 3000 shaft exactly in real model-space millimetres', () => {
    const content = generateTechnicalPlanDxf(prepareCurrent(createPassengerPlanDrawing(context(), 'auto')))
    const shaft = vertexExtents(content, 'shaft')
    expect(shaft.maxX - shaft.minX).toBe(2600)
    expect(shaft.maxY - shaft.minY).toBe(3000)
  })

  it('exports the selected 900 x 2100 door exactly in real model-space millimetres', () => {
    const document = createPassengerDoorElevationDrawing(context(), { levelId: 'level-1', side: 'front' }, 'auto')
    const content = generateTechnicalPlanDxf(prepareCurrent(document, { landing: 1, side: 'front' }))
    const opening = vertexExtents(content, 'door-opening')
    expect(opening.maxX - opening.minX).toBe(900)
    expect(opening.maxY - opening.minY).toBe(2100)
  })

  it('places normalized systems on deterministic semantic CAD layers', () => {
    const ctx = context()
    const planDocument = createPassengerPlanDrawing(ctx, 'auto')
    const sectionDocument = createPassengerSectionDrawing(ctx, 'auto')
    const plan = generateTechnicalPlanDxf(prepareCurrent(planDocument))
    const section = generateTechnicalPlanDxf(prepareCurrent(sectionDocument))
    const rail = planDocument.primitives.find((entry) => entry.id.includes('car-rail') && entry.kind === 'polyline')
    const rope = sectionDocument.primitives.find((entry) => entry.id.includes('rope') && entry.kind === 'polyline')
    expect(primitiveEntityLayer(plan, 'shaft')).toBe('SHAFT')
    expect(primitiveEntityLayer(plan, 'cabin')).toBe('CABIN')
    expect(primitiveEntityLayer(plan, 'car-crosshead')).toBe('CAR_FRAME')
    expect(primitiveEntityLayer(plan, 'counterweight')).toBe('COUNTERWEIGHT')
    expect(primitiveEntityLayer(plan, 'cabin-front-opening')).toBe('DOORS')
    expect(primitiveEntityLayer(plan, rail?.id ?? '')).toBe('GUIDE_RAILS')
    expect(primitiveEntityLayer(section, 'machine')).toBe('MACHINE')
    expect(primitiveEntityLayer(section, 'buffer-0')).toBe('BUFFERS')
    expect(primitiveEntityLayer(section, rope?.id ?? '')).toBe('ROPES')
    expect(primitiveEntityLayer(plan, 'shaft-width')).toBe('DIMENSIONS')
    expect(primitiveEntityLayer(plan, 'shaft-axis-x')).toBe('CENTERLINES')
    expect(primitiveEntityLayer(plan, 'shaft-label')).toBe('ANNOTATIONS')
  })

  it.each(['1:20', '1:25', '1:50', '1:100'] as const)(
    'keeps DXF model geometry independent of the selected PDF scale %s', (scale) => {
      const planContent = generateTechnicalPlanDxf(prepareCurrent(createPassengerPlanDrawing(context(), scale)))
      const doorContent = generateTechnicalPlanDxf(prepareCurrent(createPassengerDoorElevationDrawing(
        context(), { levelId: 'level-1', side: 'front' }, scale,
      ), { landing: 1, side: 'front' }))
      expect(vertexExtents(planContent, 'shaft')).toEqual({ minX: -1300, maxX: 1300, minY: -1500, maxY: 1500 })
      expect(vertexExtents(doorContent, 'door-opening')).toEqual({ minX: -450, maxX: 450, minY: 0, maxY: 2100 })
      expect(planContent).not.toContain('0\r\nINSERT\r\n8\r\nANNOTATIONS\r\n2\r\nLP_GRUNDRISS')
    },
  )

  it.each([2, 6, 10])('produces deterministic section geometry for %i stops', (stopCount) => {
    const configuration = { ...fixture, stopCount }
    const document = createPassengerSectionDrawing(context(configuration), 'auto')
    const first = generateTechnicalPlanDxf(prepareCurrent(document))
    const second = generateTechnicalPlanDxf(prepareCurrent(document))
    expect(first).toBe(second)
    expect(first.match(/999\r\nPrimitive: level-\d+-line\r\n/g)).toHaveLength(stopCount)
  })

  it('omits entities for absent optional mechanical systems', () => {
    const configuration: PassengerPlanningConfiguration = {
      ...fixture,
      counterweightWidthMm: undefined,
      counterweightHeightMm: undefined,
      counterweightDepthMm: undefined,
      counterweightPosition: undefined,
      mechanical: undefined,
    }
    const content = generateTechnicalPlanDxf(prepareCurrent(createPassengerSectionDrawing(context(configuration), 'auto')))
    const entities = sectionContent(content, 'ENTITIES')
    for (const layer of ['COUNTERWEIGHT', 'MACHINE', 'BUFFERS', 'ROPES']) {
      expect(entities).not.toContain(`8\r\n${layer}\r\n`)
    }
  })

  it('does not consume browser viewport dimensions when serializing coordinates', () => {
    const prepared = prepareCurrent(createPassengerPlanDrawing(context(), 'auto'))
    const before = generateTechnicalPlanDxf(prepared)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 })
    expect(generateTechnicalPlanDxf(prepared)).toBe(before)
  })

  it('includes real project and drawing metadata without certification claims', () => {
    const content = generateTechnicalPlanDxf(prepareCurrent(createPassengerDoorElevationDrawing(
      context(), { levelId: 'level-2', side: 'front' }, 'auto',
    ), { landing: 2, side: 'front' }))
    expect(content).toContain('999\r\nProject: Mechanische Demo - Testdaten\r\n')
    expect(content).toContain('999\r\nProject ID: LP-DXF-2026-001\r\n')
    expect(content).toContain('999\r\nLiftPlan version: liftplan-project-v1\r\n')
    expect(content).toContain('999\r\nExport date: 2026-10-05\r\n')
    expect(content).toContain('999\r\nModel-space unit: millimetres\r\n')
    expect(content).not.toContain('EN 81')
    expect(content).not.toContain('certified')
  })

  it('creates deterministic filenames for every drawing type and the complete set', () => {
    const ctx = context()
    const plan = candidate(createPassengerPlanDrawing(ctx, 'auto'))
    const section = candidate(createPassengerSectionDrawing(ctx, 'auto'))
    const door = candidate(createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'front' }, 'auto'),
      { landing: 1, side: 'front' })
    expect(createTechnicalPlanDxfFilename(project.name, 'current', plan))
      .toBe('LiftPlan_Mechanische-Demo-Testdaten_Grundriss.dxf')
    expect(createTechnicalPlanDxfFilename(project.name, 'current', section))
      .toBe('LiftPlan_Mechanische-Demo-Testdaten_Schnitt.dxf')
    expect(createTechnicalPlanDxfFilename(project.name, 'current', door))
      .toBe('LiftPlan_Mechanische-Demo-Testdaten_Tueransicht_Haltestelle-1.dxf')
    expect(createTechnicalPlanDxfFilename(project.name, 'plan-set', plan))
      .toBe('LiftPlan_Mechanische-Demo-Testdaten_Plansatz.dxf')
  })

  it('orders and packages a complete plan set as unscaled model-space blocks', () => {
    const ctx = context()
    const plan = candidate(createPassengerPlanDrawing(ctx, 'auto'))
    const section = candidate(createPassengerSectionDrawing(ctx, 'auto'))
    const door = candidate(createPassengerDoorElevationDrawing(ctx, { levelId: 'level-1', side: 'front' }, 'auto'),
      { landing: 1, side: 'front' })
    const result = prepareTechnicalPlanDxf({
      scope: 'plan-set', projectName: project.name, candidates: [door, section, plan],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.drawings.map((entry) => entry.document.view)).toEqual(['plan', 'section', 'door-elevation'])
    const content = generateTechnicalPlanDxf(result.value)
    expect(content).toContain('0\r\nBLOCK\r\n8\r\n0\r\n2\r\nLP_GRUNDRISS\r\n')
    expect(content).toContain('0\r\nBLOCK\r\n8\r\n0\r\n2\r\nLP_SCHNITT\r\n')
    expect(content).toContain('0\r\nBLOCK\r\n8\r\n0\r\n2\r\nLP_TUERANSICHT_003\r\n')
    expect(sectionContent(content, 'ENTITIES').match(/0\r\nINSERT\r\n/g)).toHaveLength(3)
    expect(vertexExtents(content, 'shaft').maxX - vertexExtents(content, 'shaft').minX).toBe(2600)
  })
})
