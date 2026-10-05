import { millimetres, millimetresToMetres, type Metres } from '../../engineering'
import type { GoodsBoxMm, GoodsLiftNormalizedModel } from './goods-lift-model'

export interface GoodsSceneBox {
  readonly id: string
  readonly kind: 'shaft' | 'platform' | 'door' | 'guide' | 'moving-envelope' | 'pallet' | 'roll-container' | 'forklift-envelope'
  readonly center: readonly [Metres, Metres, Metres]
  readonly size: readonly [Metres, Metres, Metres]
}

export interface GoodsLiftSceneModel {
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

/** Render-neutral semantic scene contract; it creates no Three.js objects. */
export function createGoodsLiftSceneModel(model: GoodsLiftNormalizedModel): GoodsLiftSceneModel {
  const assemblies: GoodsSceneBox[] = []
  if (model.shaft) assemblies.push(box('goods-shaft', 'shaft', model.shaft))
  if (model.platform) assemblies.push(box('goods-platform', 'platform', model.platform))
  if (model.pallet) assemblies.push(box('goods-pallet', 'pallet', model.pallet))
  if (model.rollContainer) assemblies.push(box('goods-roll-container', 'roll-container', model.rollContainer))
  if (model.forkliftEnvelope) assemblies.push(box('goods-forklift-envelope', 'forklift-envelope', model.forkliftEnvelope))
  if (model.movingEnvelope) assemblies.push(box('goods-moving-envelope', 'moving-envelope', model.movingEnvelope))
  if (model.guideSystem && model.shaft) {
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
        center: [millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(model.platform!.minY + entrance.heightMm / 2)), millimetresToMetres(z)],
        size: [millimetresToMetres(entrance.widthMm), millimetresToMetres(entrance.heightMm), millimetresToMetres(millimetres(0))],
      })
    })
  }
  return { family: 'goods', assemblies }
}
