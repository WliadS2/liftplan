import type { CarSceneAssembly } from './car-lift-render-model'

const movingKinds = new Set<CarSceneAssembly['kind']>(['platform', 'platform-floor', 'platform-roof',
  'platform-wall', 'door', 'vehicle-body', 'wheel-contact', 'vehicle-centerline', 'vehicle-axle',
  'vehicle-reference', 'loading-direction', 'carrier-frame', 'floor-structure', 'guide-shoe'])
/** Approach/sweep/passage envelopes, guides and landing doors are fixed planning references. */
export const isCarMovingAssembly = (a: CarSceneAssembly) => ('driveAttachment' in a && a.driveAttachment === 'carrier') || movingKinds.has(a.kind)
