import type { ThreeViewMode } from '../scene/view-mode'
import type { GoodsLiftViewMode } from '../geometry/goods/goods-lift-render-model'
import type { CarLiftViewMode } from '../geometry/car/car-lift-render-model'

export type ViewCameraPolicy = 'installation' | 'moving-detail' | 'fixed-detail' | 'section'

/** Hydraulic inspection follows its carrier connection; traction inspects the complete fixed system.
 * Only camera translation follows motion, never a repeated fit or a scene transform. */
export const getDriveInspectionCameraPolicy = (concept: string | undefined): ViewCameraPolicy =>
  concept === 'hydraulic' ? 'moving-detail' : 'fixed-detail'

/** Camera-only ownership: installation/section views never inherit carrier motion. */
export const PASSENGER_CAMERA_POLICIES: Readonly<Record<ThreeViewMode, ViewCameraPolicy>> = {
  overview: 'installation', cabin: 'moving-detail', mechanical: 'fixed-detail', drive: 'fixed-detail',
  safety: 'fixed-detail', doors: 'fixed-detail', cutaway: 'section',
}
export const GOODS_CAMERA_POLICIES: Readonly<Record<GoodsLiftViewMode, ViewCameraPolicy>> = {
  overview: 'installation', platform: 'moving-detail', loads: 'moving-detail',
  doors: 'fixed-detail', guides: 'moving-detail', cutaway: 'section',
  mechanical:'fixed-detail', drive:'fixed-detail', safety:'fixed-detail',
}
export const CAR_CAMERA_POLICIES: Readonly<Record<CarLiftViewMode, ViewCameraPolicy>> = {
  overview: 'installation', platform: 'moving-detail', vehicle: 'moving-detail',
  doors: 'fixed-detail', approach: 'fixed-detail', cutaway: 'section',
  mechanical:'fixed-detail', drive:'fixed-detail', guides:'moving-detail', safety:'fixed-detail',
}
