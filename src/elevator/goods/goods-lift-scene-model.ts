import { millimetres, millimetresToMetres, type Metres } from '../../engineering'
import type { GoodsBoxMm, GoodsLiftNormalizedModel } from './goods-lift-model'
import { createCarrierDriveScene, type CarrierDriveScene, type DriveSceneBox } from '../models/carrier-drive-scene'

export interface GoodsSceneBox {
  readonly id: string
  readonly kind: 'shaft' | 'pit' | 'headroom' | 'level' |
    'platform' | 'platform-floor' | 'platform-roof' | 'platform-wall' |
    'door' | 'landing-door' | 'guide' | 'moving-envelope' |
    'carrier-frame' | 'floor-structure' | 'guide-shoe' | 'buffer' |
    'pallet' | 'roll-container' | 'forklift-envelope' | DriveSceneBox['kind']
  readonly driveAttachment?: DriveSceneBox['driveAttachment']
  readonly center: readonly [Metres, Metres, Metres]
  readonly size: readonly [Metres, Metres, Metres]
  readonly componentSource?: import('../configuration/carrier-mechanical-planning').CarrierComponentSource
  readonly doorAttachment?:
    | { readonly role: 'platform'; readonly side: 'front' | 'rear' }
    | { readonly role: 'landing'; readonly side: 'front' | 'rear'; readonly levelId: string }
}

export interface GoodsLiftSceneModel {
  readonly drive?: CarrierDriveScene
  readonly family: 'goods'
  readonly assemblies: readonly GoodsSceneBox[]
}

function box(id: string, kind: GoodsSceneBox['kind'], value: GoodsBoxMm): GoodsSceneBox {
  return {
    id, kind,
    center: [
      millimetresToMetres(millimetres((value.minX + value.maxX) / 2)),
      millimetresToMetres(millimetres((value.minY + value.maxY) / 2)),
      millimetresToMetres(millimetres((value.minZ + value.maxZ) / 2)),
    ],
    size: [
      millimetresToMetres(millimetres(value.maxX - value.minX)),
      millimetresToMetres(millimetres(value.maxY - value.minY)),
      millimetresToMetres(millimetres(value.maxZ - value.minZ)),
    ],
  }
}

function sceneBox(id: string, kind: GoodsSceneBox['kind'],
  min: readonly [number, number, number], max: readonly [number, number, number]): GoodsSceneBox {
  return {
    id, kind,
    center: [
      millimetresToMetres(millimetres((min[0] + max[0]) / 2)),
      millimetresToMetres(millimetres((min[1] + max[1]) / 2)),
      millimetresToMetres(millimetres((min[2] + max[2]) / 2)),
    ],
    size: [
      millimetresToMetres(millimetres(max[0] - min[0])),
      millimetresToMetres(millimetres(max[1] - min[1])),
      millimetresToMetres(millimetres(max[2] - min[2])),
    ],
  }
}

/** Render-neutral semantic scene contract; it creates no Three.js objects. */
export function createGoodsLiftSceneModel(model: GoodsLiftNormalizedModel): GoodsLiftSceneModel {
  const assemblies: GoodsSceneBox[] = []
  if (model.shaft) {
    assemblies.push(box('goods-shaft', 'shaft', model.shaft))
    const lowest = model.levels[0]?.elevationMm
    const highest = model.levels.at(-1)?.elevationMm
    if (lowest !== undefined && model.shaft.minY < lowest) {
      assemblies.push(sceneBox('goods-pit', 'pit',
        [model.shaft.minX, model.shaft.minY, model.shaft.minZ],
        [model.shaft.maxX, lowest, model.shaft.maxZ]))
    }
    if (highest !== undefined && model.platform) {
      const platformHeight = model.platform.maxY - model.platform.minY
      const headroomBottom = highest + platformHeight
      if (headroomBottom < model.shaft.maxY) {
        assemblies.push(sceneBox('goods-headroom', 'headroom',
          [model.shaft.minX, headroomBottom, model.shaft.minZ],
          [model.shaft.maxX, model.shaft.maxY, model.shaft.maxZ]))
      }
    }
    model.levels.forEach((level) => assemblies.push(sceneBox(`goods-${level.id}`, 'level',
      [model.shaft!.minX, level.elevationMm, model.shaft!.minZ],
      [model.shaft!.maxX, level.elevationMm, model.shaft!.maxZ])))
  }
  if (model.platform) {
    assemblies.push(box('goods-platform', 'platform', model.platform))
    assemblies.push(sceneBox('goods-platform-floor', 'platform-floor',
      [model.platform.minX, model.platform.minY, model.platform.minZ],
      [model.platform.maxX, model.platform.minY, model.platform.maxZ]))
    assemblies.push(sceneBox('goods-platform-roof', 'platform-roof',
      [model.platform.minX, model.platform.maxY, model.platform.minZ],
      [model.platform.maxX, model.platform.maxY, model.platform.maxZ]))
    assemblies.push(sceneBox('goods-platform-wall-left', 'platform-wall',
      [model.platform.minX, model.platform.minY, model.platform.minZ],
      [model.platform.minX, model.platform.maxY, model.platform.maxZ]))
    assemblies.push(sceneBox('goods-platform-wall-right', 'platform-wall',
      [model.platform.maxX, model.platform.minY, model.platform.minZ],
      [model.platform.maxX, model.platform.maxY, model.platform.maxZ]))

    const addEndWall = (side: 'front' | 'rear') => {
      const entrance = model.entrances.find((entry) => entry.side === side)
      const z = side === 'front' ? model.platform!.maxZ : model.platform!.minZ
      const id = `goods-platform-wall-${side}`
      if (!entrance) {
        assemblies.push(sceneBox(id, 'platform-wall',
          [model.platform!.minX, model.platform!.minY, z],
          [model.platform!.maxX, model.platform!.maxY, z]))
        return
      }
      const sideWidth = (model.platform!.maxX - model.platform!.minX - entrance.widthMm) / 2
      if (sideWidth > 0) {
        assemblies.push(sceneBox(`${id}-left`, 'platform-wall',
          [model.platform!.minX, model.platform!.minY, z],
          [model.platform!.minX + sideWidth, model.platform!.maxY, z]))
        assemblies.push(sceneBox(`${id}-right`, 'platform-wall',
          [model.platform!.maxX - sideWidth, model.platform!.minY, z],
          [model.platform!.maxX, model.platform!.maxY, z]))
      }
      const headerHeight = model.platform!.maxY - model.platform!.minY - entrance.heightMm
      if (headerHeight > 0) {
        assemblies.push(sceneBox(`${id}-header`, 'platform-wall',
          [-entrance.widthMm / 2, model.platform!.maxY - headerHeight, z],
          [entrance.widthMm / 2, model.platform!.maxY, z]))
      }
    }
    addEndWall('front')
    addEndWall('rear')
  }
  if (model.pallet) assemblies.push(box('goods-pallet', 'pallet', model.pallet))
  if (model.rollContainer) assemblies.push(box('goods-roll-container', 'roll-container', model.rollContainer))
  if (model.forkliftEnvelope) assemblies.push(box('goods-forklift-envelope', 'forklift-envelope', model.forkliftEnvelope))
  if (model.movingEnvelope) assemblies.push(box('goods-moving-envelope', 'moving-envelope', model.movingEnvelope))
  if (model.guideSystem && model.shaft && !model.mechanical?.parts.some((part)=>part.kind === 'guide')) {
    const halfSpacing = model.guideSystem.spacingMm / 2
    const height = millimetres(model.shaft.maxY - model.shaft.minY)
    const centerY = millimetres((model.shaft.minY + model.shaft.maxY) / 2)
    const guide = (id: string, offset: number): GoodsSceneBox => ({
      id,
      kind: 'guide',
      center: model.guideSystem!.orientation === 'x'
        ? [millimetresToMetres(millimetres(offset)), millimetresToMetres(centerY), millimetresToMetres(millimetres(0))]
        : [millimetresToMetres(millimetres(0)), millimetresToMetres(centerY), millimetresToMetres(millimetres(offset))],
      size: [millimetresToMetres(millimetres(0)), millimetresToMetres(height), millimetresToMetres(millimetres(0))],
    })
    assemblies.push(guide('goods-guide-a', -halfSpacing), guide('goods-guide-b', halfSpacing))
  }
  if (model.platform) {
    model.entrances.forEach((entrance) => {
      const z = entrance.side === 'front' ? model.platform!.maxZ : model.platform!.minZ
      assemblies.push({
        id: entrance.id,
        kind: 'door',
        doorAttachment: { role: 'platform', side: entrance.side },
        center: [millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(model.platform!.minY + entrance.heightMm / 2)), millimetresToMetres(z)],
        size: [millimetresToMetres(entrance.widthMm), millimetresToMetres(entrance.heightMm), millimetresToMetres(millimetres(0))],
      })
      if (model.shaft) {
        model.levels.forEach((level) => {
          const landingZ = entrance.side === 'front' ? model.shaft!.maxZ : model.shaft!.minZ
          assemblies.push({
            id: `goods-landing-${level.id}-${entrance.side}`,
            kind: 'landing-door',
            doorAttachment: { role: 'landing', side: entrance.side, levelId: level.id },
            center: [millimetresToMetres(millimetres(0)),
              millimetresToMetres(millimetres(level.elevationMm + entrance.heightMm / 2)),
              millimetresToMetres(landingZ)],
            size: [millimetresToMetres(entrance.widthMm), millimetresToMetres(entrance.heightMm),
              millimetresToMetres(millimetres(0))],
          })
        })
      }
    })
  }
  for (const part of model.mechanical?.parts ?? []) {
    const id = part.id === 'rail-0' ? 'goods-guide-a' : part.id === 'rail-1' ? 'goods-guide-b' : `goods-${part.id}`
    assemblies.push({ ...box(id,part.kind,part.bounds), componentSource: part.source })
  }
  const drive = createCarrierDriveScene(model.drive,'goods')
  assemblies.push(...drive.parts)
  return { family: 'goods', assemblies, drive }
}
