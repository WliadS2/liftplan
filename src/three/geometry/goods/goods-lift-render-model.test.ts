import { describe, expect, it } from 'vitest'
import { validateGoodsLiftSpatialGeometry } from '../../../collision/goods-lift-spatial-validation'
import {
  createGoodsLiftNormalizedModel,
  createGoodsLiftPlanningConfiguration,
  createGoodsLiftSceneModel,
  type GoodsLiftPlanningConfiguration,
} from '../../../elevator'
import { kilograms, metresPerSecond, millimetres } from '../../../engineering'
import { calculateCameraFit } from '../../camera/camera-fit'
import { getGoodsLiftCameraFrame, getGoodsLiftCameraInstallationKey } from '../../camera/goods-lift-camera'
import {
  createGoodsLiftRenderModel,
  getAvailableGoodsLiftViewModes,
} from './goods-lift-render-model'

const mm = millimetres

function configuration(update: Partial<GoodsLiftPlanningConfiguration> = {}): GoodsLiftPlanningConfiguration {
  return {
    ...createGoodsLiftPlanningConfiguration('3D-Warenaufzug'),
    ratedLoadKg: kilograms(2500), stopCount: 2, nominalSpeedMetresPerSecond: metresPerSecond(0.8),
    platformWidthMm: mm(1800), platformDepthMm: mm(2400), platformHeightMm: mm(2300),
    doorWidthMm: mm(1400), doorHeightMm: mm(2200),
    shaftWidthMm: mm(2600), shaftDepthMm: mm(3200), pitDepthMm: mm(1200), headroomMm: mm(3800),
    storeyHeightsMm: [mm(3500)], frontAccess: true, rearAccess: true, throughCar: true,
    pallet: { widthMm: mm(1200), depthMm: mm(800), heightMm: mm(1600) },
    rollContainer: { widthMm: mm(800), depthMm: mm(1200), heightMm: mm(1800) },
    forkliftEnvelope: { widthMm: mm(1500), depthMm: mm(2200), heightMm: mm(2200) },
    guideSystem: { orientation: 'x', spacingMm: mm(2100) },
    ...update,
  }
}

function scene(value = configuration()) {
  const normalized = createGoodsLiftNormalizedModel(value)
  if (normalized.status === 'empty') throw new Error('Expected goods model')
  return { normalized, scene: createGoodsLiftSceneModel(normalized.model) }
}

describe('goods-lift semantic 3D model', () => {
  it('makes floor and configured openings readable without inventing a slab thickness', () => {
    const render = createGoodsLiftRenderModel(scene().scene, 'platform')
    const floor = render.assemblies.find((a) => a.kind === 'platform-floor')!
    expect(floor.size[1]).toBe(0)
    expect(floor.appearance.opacity).toBe(1)
    expect(render.assemblies.some((a) => a.kind === 'platform-roof')).toBe(false)
    expect(render.assemblies.filter((a) => a.kind === 'door')).toHaveLength(2)
    expect(render.assemblies.filter((a) => a.kind === 'door').every((a) => a.appearance.opacity < 0.1)).toBe(true)
  })
  it('keeps all nested load envelopes with distinct weight/dash policies and without opaque fills', () => {
    const render = createGoodsLiftRenderModel(scene().scene,'loads')
    const loads = render.assemblies.filter((a) => ['pallet','roll-container','forklift-envelope'].includes(a.kind))
    expect(loads).toHaveLength(3)
    expect(new Set(loads.map((a) => a.appearance.lineWidth)).size).toBe(3)
    expect(loads.every((a) => a.appearance.presentation === 'outline')).toBe(true)
    expect(render.assemblies.some((a) => a.kind === 'platform-wall' || a.kind === 'platform-roof')).toBe(false)
  })
  it.each([2,6,10])('fits all goods modes with the target inside visible semantic bounds at %i stops', (stopCount) => {
    const model = scene(configuration({ stopCount, storeyHeightsMm: Array(stopCount-1).fill(mm(3500)) })).scene
    for(const {id} of getAvailableGoodsLiftViewModes(model)) {
      const frame = getGoodsLiftCameraFrame(model,id)
      expect(frame.target.every((v,i) => v >= frame.bounds.min[i] && v <= frame.bounds.max[i])).toBe(true)
      expect(frame).toEqual(getGoodsLiftCameraFrame(model,id))
      for(const viewport of [{width:1280,height:720},{width:360,height:700}]) {
        expect(calculateCameraFit(frame.bounds,frame.target,viewport,undefined,undefined,frame.direction).position.every(Number.isFinite)).toBe(true)
      }
    }
  })
  it('preserves shaft and platform dimensions in metres', () => {
    const { scene: model } = scene()
    expect(model.assemblies.find((entry) => entry.id === 'goods-shaft')).toMatchObject({
      size: [2.6, 10.8, 3.2],
    })
    expect(model.assemblies.find((entry) => entry.id === 'goods-platform')).toMatchObject({
      size: [1.8, 2.3, 2.4],
    })
    expect(model.assemblies.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'goods-pit', 'goods-headroom', 'goods-platform-floor', 'goods-platform-roof',
    ]))
  })

  it.each([2, 6, 10])('creates deterministic levels and landing doors for %i stops', (stopCount) => {
    const storeyHeightsMm = Array.from({ length: stopCount - 1 }, () => mm(3500))
    const first = scene(configuration({ stopCount, storeyHeightsMm })).scene
    const second = scene(configuration({ stopCount, storeyHeightsMm })).scene
    expect(first).toEqual(second)
    expect(first.assemblies.filter((entry) => entry.kind === 'level')).toHaveLength(stopCount)
    expect(first.assemblies.filter((entry) => entry.kind === 'landing-door')).toHaveLength(stopCount * 2)
  })

  it('represents front-only, rear-only and through-car openings independently', () => {
    const front = scene(configuration({ frontAccess: true, rearAccess: false, throughCar: false })).scene
    expect(front.assemblies.some((entry) => entry.id === 'goods-front')).toBe(true)
    expect(front.assemblies.some((entry) => entry.id === 'goods-rear')).toBe(false)
    expect(front.assemblies.filter((entry) => entry.kind === 'landing-door')).toHaveLength(2)

    const rear = scene(configuration({ frontAccess: false, rearAccess: true, throughCar: false })).scene
    expect(rear.assemblies.some((entry) => entry.id === 'goods-front')).toBe(false)
    expect(rear.assemblies.some((entry) => entry.id === 'goods-rear')).toBe(true)

    const through = scene().scene
    expect(through.assemblies.filter((entry) => entry.kind === 'door').map((entry) => entry.id))
      .toEqual(['goods-front', 'goods-rear'])
  })

  it('preserves door dimensions, side coordinates and landing elevations without duplicated IDs', () => {
    const { normalized, scene: model } = scene()
    const doors = model.assemblies.filter((a) => a.kind === 'door' || a.kind === 'landing-door')
    expect(new Set(doors.map((a) => a.id)).size).toBe(doors.length)
    for (const door of doors) {
      expect(door.size).toEqual([1.4,2.2,0])
      const side = door.id.endsWith('rear') ? -1 : 1
      expect(door.center[2]).toBe(side * (door.kind === 'door' ? 1.2 : 1.6))
      expect(door.center[1]).toBeCloseTo((door.id.includes('level-2') ? normalized.model.levels[1].elevationMm/1000 : 0)+1.1)
    }
  })

  it('creates the configured guide pair with its explicit orientation and spacing', () => {
    const guides = scene().scene.assemblies.filter((entry) => entry.kind === 'guide')
    expect(guides).toHaveLength(2)
    expect(guides.map((entry) => entry.center[0])).toEqual([-1.05, 1.05])
    expect(guides.every((entry) => entry.size[0] === 0 && entry.size[2] === 0)).toBe(true)
  })

  it('renders only explicitly configured load envelopes', () => {
    const complete = scene().scene
    expect(complete.assemblies.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'goods-pallet', 'goods-roll-container', 'goods-forklift-envelope',
    ]))
    const absent = scene(configuration({ pallet: undefined, rollContainer: undefined, forkliftEnvelope: undefined })).scene
    expect(absent.assemblies.some((entry) =>
      entry.kind === 'pallet' || entry.kind === 'roll-container' || entry.kind === 'forklift-envelope')).toBe(false)
  })

  it('provides only family-specific view modes and exposes guides conditionally', () => {
    const withGuides = getAvailableGoodsLiftViewModes(scene().scene)
    expect(withGuides.map((entry) => entry.label)).toEqual([
      'Gesamtansicht', 'Plattform/Kabine', 'Türen', 'Lasten', 'Führungssystem', 'Schnittansicht',
    ])
    const withoutGuides = getAvailableGoodsLiftViewModes(scene(configuration({ guideSystem: undefined })).scene)
    expect(withoutGuides.some((entry) => entry.id === 'guides')).toBe(false)
  })

  it('shows the moving envelope only in relevant technical views', () => {
    const model = scene().scene
    expect(createGoodsLiftRenderModel(model, 'overview').assemblies.some((entry) => entry.kind === 'moving-envelope')).toBe(false)
    expect(createGoodsLiftRenderModel(model, 'guides').assemblies.some((entry) => entry.kind === 'moving-envelope')).toBe(true)
    expect(createGoodsLiftRenderModel(model, 'cutaway').assemblies.some((entry) => entry.kind === 'moving-envelope')).toBe(true)
  })

  it('removes the obstructing front wall in cutaway without hiding rear geometry', () => {
    const cutaway = createGoodsLiftRenderModel(scene().scene, 'cutaway')
    expect(cutaway.assemblies.some((entry) => entry.id.includes('wall-front'))).toBe(false)
    expect(cutaway.assemblies.some((entry) => entry.id.includes('wall-rear'))).toBe(true)
    const shaft = cutaway.assemblies.find((entry) => entry.kind === 'shaft')!
    expect(shaft.appearance.presentation).toBe('section')
    expect(shaft).toMatchObject(scene().scene.assemblies.find((entry) => entry.kind === 'shaft')!)
    expect(createGoodsLiftRenderModel(scene().scene, 'overview').assemblies.find((entry) => entry.kind === 'shaft')!.appearance.presentation).toBe('outline')
    expect(getGoodsLiftCameraFrame(scene().scene, 'cutaway').direction).not.toEqual(getGoodsLiftCameraFrame(scene().scene, 'overview').direction)
  })

  it.each([2, 6, 10])('keeps camera fitting finite and deterministic for %i stops', (stopCount) => {
    const model = scene(configuration({
      stopCount, storeyHeightsMm: Array.from({ length: stopCount - 1 }, () => mm(3500)),
    })).scene
    const first = getGoodsLiftCameraFrame(model, 'overview')
    const second = getGoodsLiftCameraFrame(model, 'overview')
    expect(first).toEqual(second)
    const fit = calculateCameraFit(first.bounds, first.target, { width: 1280, height: 720 },
      undefined, undefined, first.direction)
    expect(Object.values(fit).flatMap((value) => Array.isArray(value) ? value : [value])
      .every((value) => Number.isFinite(value))).toBe(true)
    expect(getGoodsLiftCameraInstallationKey(model)).toBe(getGoodsLiftCameraInstallationKey(model))
  })

  it('keeps invalid but normalizable geometry available to the renderer', () => {
    const normalized = createGoodsLiftNormalizedModel(configuration({ platformWidthMm: mm(2800) }))
    expect(validateGoodsLiftSpatialGeometry(normalized).status).toBe('invalid')
    if (normalized.status === 'empty') throw new Error('Expected model')
    const render = createGoodsLiftRenderModel(createGoodsLiftSceneModel(normalized.model), 'overview')
    expect(render.assemblies.map((entry) => entry.id)).toEqual(expect.arrayContaining(['goods-shaft', 'goods-platform']))
  })

  it('keeps a configuration without usable geometry in the explicit empty state', () => {
    expect(createGoodsLiftNormalizedModel(createGoodsLiftPlanningConfiguration('Leer'))).toMatchObject({ status: 'empty' })
  })
})
