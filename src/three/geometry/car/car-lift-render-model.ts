import type { CarLiftSceneModel, CarSceneBox, CarSceneLine } from '../../../elevator/car/car-lift-scene-model'

export const CAR_LIFT_VIEW_MODE_CATALOG = [
  { id: 'overview', label: 'Gesamtansicht' },
  { id: 'platform', label: 'Plattform' },
  { id: 'vehicle', label: 'Fahrzeug' },
  { id: 'doors', label: 'Türen' },
  { id: 'approach', label: 'Zufahrt' },
  { id: 'cutaway', label: 'Schnittansicht' },
] as const
export type CarLiftViewMode = typeof CAR_LIFT_VIEW_MODE_CATALOG[number]['id']
export type CarSceneAssembly = CarSceneBox | CarSceneLine
export interface CarRenderAppearance {
  readonly color: string
  readonly opacity: number
  readonly presentation: 'outline' | 'surface' | 'line' | 'marker'
}
export type CarRenderableAssembly = CarSceneAssembly & { readonly appearance: CarRenderAppearance }
export interface CarLiftRenderModel {
  readonly family: 'car'
  readonly viewMode: CarLiftViewMode
  readonly assemblies: readonly CarRenderableAssembly[]
}

/** Visual contact symbol only: not a tire radius or any engineering dimension. */
export const CAR_CONTACT_SYMBOL_RADIUS_METRES = 0.045
const platformKinds: readonly CarSceneAssembly['kind'][] = ['platform', 'platform-floor', 'platform-wall', 'door', 'loading-direction']
const vehicleKinds: readonly CarSceneAssembly['kind'][] = ['vehicle-body', 'wheel-contact', 'vehicle-centerline']
const approachKinds: readonly CarSceneAssembly['kind'][] = ['approach-envelope', 'vehicle-swept-envelope', 'door-passage-envelope']

function visible(assembly: CarSceneAssembly, mode: CarLiftViewMode): boolean {
  if (mode === 'overview') return assembly.kind !== 'moving-envelope' && !approachKinds.includes(assembly.kind)
  if (mode === 'platform' || mode === 'vehicle') return platformKinds.includes(assembly.kind) || vehicleKinds.includes(assembly.kind)
  if (mode === 'doors') return ['shaft', 'platform', 'door', 'landing-door', 'level'].includes(assembly.kind)
  if (mode === 'approach') return platformKinds.includes(assembly.kind) || vehicleKinds.includes(assembly.kind) || approachKinds.includes(assembly.kind)
  return assembly.kind !== 'platform-roof' && !(assembly.kind === 'platform-wall' &&
    (assembly.id.includes('-front') || assembly.id.endsWith('-right')))
}

function appearance(assembly: CarSceneAssembly, mode: CarLiftViewMode): CarRenderAppearance {
  if (assembly.kind === 'wheel-contact') return { color: '#293b44', opacity: 1, presentation: 'marker' }
  if (assembly.kind === 'vehicle-centerline') return { color: '#526b77', opacity: 0.85, presentation: 'line' }
  if (assembly.kind === 'loading-direction') return { color: '#7a6b4f', opacity: 0.6, presentation: 'line' }
  if (assembly.kind === 'guide') return { color: '#334155', opacity: 1, presentation: 'line' }
  if (assembly.kind === 'platform-floor') return { color: '#849198', opacity: 0.45, presentation: 'surface' }
  if (assembly.kind === 'platform-roof' || assembly.kind === 'platform-wall') return { color: '#a4b0b6', opacity: mode === 'vehicle' ? 0.06 : 0.12, presentation: 'surface' }
  if (assembly.kind === 'door' || assembly.kind === 'landing-door') return {
    color: assembly.id.endsWith('rear') ? '#736c61' : '#526b77',
    opacity: mode === 'doors' ? 0.45 : 0.15, presentation: 'surface',
  }
  if (assembly.kind === 'vehicle-body') return { color: '#394f5c', opacity: 1, presentation: 'outline' }
  if (assembly.kind === 'approach-envelope') return { color: assembly.id.includes('entry') ? '#637b69' : '#867157', opacity: 0.8, presentation: 'outline' }
  if (assembly.kind === 'vehicle-swept-envelope') return { color: '#705f74', opacity: 0.75, presentation: 'outline' }
  if (assembly.kind === 'door-passage-envelope') return { color: '#526b77', opacity: 0.7, presentation: 'outline' }
  return { color: '#7b8a93', opacity: assembly.kind === 'platform' ? 0.6 : 0.25, presentation: 'outline' }
}

/** Pure presentation policy; positions and dimensions are copied unchanged from the scene adapter. */
export function createCarLiftRenderModel(scene: CarLiftSceneModel, viewMode: CarLiftViewMode): CarLiftRenderModel {
  return { family: 'car', viewMode, assemblies: scene.assemblies.filter((a) => visible(a, viewMode))
    .map((a) => ({ ...a, appearance: appearance(a, viewMode) })) }
}

export function getCarLiftRenderLegend(model: CarLiftRenderModel): readonly string[] {
  const labels: Partial<Record<CarSceneAssembly['kind'], string>> = {
    shaft: 'Schacht', platform: 'Plattform / Nutzraum', 'vehicle-body': 'Fahrzeughülle',
    'wheel-contact': 'Radkontaktpunkte (Symbole)', 'vehicle-centerline': 'Fahrzeugachse',
    'loading-direction': 'Beladungsachse', level: 'Haltestellen', guide: 'Schienenachsen',
    'door-passage-envelope': 'Durchfahrtshülle', 'vehicle-swept-envelope': 'Explizite Bewegungshülle',
  }
  return [...new Set(model.assemblies.map((a) => a.kind === 'approach-envelope'
    ? (a.id.includes('entry') ? 'Einfahrtshülle' : 'Ausfahrtshülle')
    : a.kind === 'door' || a.kind === 'landing-door' ? `Türen ${a.id.endsWith('rear') ? 'hinten' : 'vorne'}` : labels[a.kind]).filter(Boolean))] as string[]
}
