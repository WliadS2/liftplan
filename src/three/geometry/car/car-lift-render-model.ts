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
  readonly lineWidth?: number
  readonly dashed?: boolean
}
export type CarRenderableAssembly = CarSceneAssembly & { readonly appearance: CarRenderAppearance }
export interface CarLiftRenderModel {
  readonly family: 'car'
  readonly viewMode: CarLiftViewMode
  readonly assemblies: readonly CarRenderableAssembly[]
}

/** Visual contact symbol only: not a tire radius or any engineering dimension. */
export const CAR_CONTACT_SYMBOL_RADIUS_METRES = 0.12
const platformKinds: readonly CarSceneAssembly['kind'][] = ['platform', 'platform-floor', 'platform-wall', 'door', 'loading-direction']
const vehicleKinds: readonly CarSceneAssembly['kind'][] = ['vehicle-body', 'wheel-contact', 'vehicle-centerline', 'vehicle-axle', 'vehicle-reference']
const approachKinds: readonly CarSceneAssembly['kind'][] = ['approach-envelope', 'vehicle-swept-envelope', 'door-passage-envelope']

function visible(assembly: CarSceneAssembly, mode: CarLiftViewMode): boolean {
  if (assembly.kind === 'vehicle-reference') return mode === 'vehicle'
  if (mode === 'overview') return assembly.kind !== 'moving-envelope' && !approachKinds.includes(assembly.kind)
  if (mode === 'vehicle') return ['platform-floor', 'loading-direction'].includes(assembly.kind) || vehicleKinds.includes(assembly.kind)
  if (mode === 'platform') return platformKinds.includes(assembly.kind) || vehicleKinds.includes(assembly.kind)
  if (mode === 'doors') return ['shaft', 'platform', 'door', 'landing-door', 'level'].includes(assembly.kind)
  if (mode === 'approach') return platformKinds.includes(assembly.kind) || vehicleKinds.includes(assembly.kind) || approachKinds.includes(assembly.kind)
  return !approachKinds.includes(assembly.kind) && assembly.kind !== 'platform-roof' && !(assembly.kind === 'platform-wall' &&
    (assembly.id.includes('-front') || assembly.id.endsWith('-right')))
}

function appearance(assembly: CarSceneAssembly, mode: CarLiftViewMode): CarRenderAppearance {
  if (assembly.kind === 'wheel-contact') return { color: '#293b44', opacity: 1, presentation: 'marker' }
  if (assembly.kind === 'vehicle-axle') return { color: '#26343c', opacity: 1, presentation: 'line', lineWidth: 2.4 }
  if (assembly.kind === 'vehicle-reference') return { color: '#374650', opacity: 0.85, presentation: 'line', lineWidth: 1, dashed: true }
  if (assembly.kind === 'vehicle-centerline') return { color: '#526b77', opacity: 0.85, presentation: 'line', dashed: true }
  if (assembly.kind === 'loading-direction') return { color: '#7a6b4f', opacity: 0.6, presentation: 'line' }
  if (assembly.kind === 'guide') return { color: '#334155', opacity: 1, presentation: 'line' }
  if (assembly.kind === 'platform-floor') return { color: '#849198', opacity: mode === 'platform' ? 0.9 : 0.22, presentation: 'surface', lineWidth: 2 }
  if (assembly.kind === 'platform-roof' || assembly.kind === 'platform-wall') return { color: '#a4b0b6', opacity: mode === 'vehicle' || mode === 'approach' ? 0.025 : 0.1, presentation: 'surface' }
  if (assembly.kind === 'door' || assembly.kind === 'landing-door') return {
    color: assembly.id.endsWith('rear') ? '#736c61' : '#526b77',
    opacity: mode === 'doors' ? 0.1 : mode === 'platform' ? 0.12 : 0.04, presentation: 'surface', lineWidth: mode === 'doors' ? 2 : 1.4,
  }
  if (assembly.kind === 'vehicle-body') return { color: '#657680', opacity: mode === 'platform' ? 0.05 : 0.5, presentation: 'surface', lineWidth: mode === 'vehicle' ? 2 : 1.4 }
  if (assembly.kind === 'approach-envelope') return { color: assembly.id.includes('entry') ? '#536859' : '#796952', opacity: 0.9, presentation: 'outline', lineWidth: 1.8, dashed: assembly.id.includes('exit') }
  if (assembly.kind === 'vehicle-swept-envelope') return { color: '#67596a', opacity: 0.9, presentation: 'outline', lineWidth: 1.2, dashed: true }
  if (assembly.kind === 'door-passage-envelope') return { color: '#435f6d', opacity: 0.9, presentation: 'outline', lineWidth: 2.3 }
  return { color: '#7b8a93', opacity: assembly.kind === 'platform' ? 0.65 : 0.5, presentation: 'outline', lineWidth: assembly.kind === 'platform' ? 1.6 : 1 }
}

/** Pure presentation policy; positions and dimensions are copied unchanged from the scene adapter. */
export function createCarLiftRenderModel(scene: CarLiftSceneModel, viewMode: CarLiftViewMode): CarLiftRenderModel {
  return { family: 'car', viewMode, assemblies: scene.assemblies.filter((a) => visible(a, viewMode))
    .map((a) => ({ ...a, appearance: appearance(a, viewMode) })) }
}

export function getCarLiftRenderLegend(model: CarLiftRenderModel): readonly string[] {
  const labels: Partial<Record<CarSceneAssembly['kind'], string>> = {
    shaft: 'Schacht', platform: 'Plattform / Nutzraum', 'vehicle-body': 'Fahrzeughülle',
    'wheel-contact': 'Radkontaktpunkte (schematische Symbole)', 'vehicle-centerline': 'Fahrzeugachse',
    'vehicle-axle': 'Vorder-/Hinterachse', 'vehicle-reference': 'Fahrzeugmaße',
    'loading-direction': 'Beladungsachse', level: 'Haltestellen', guide: 'Schienenachsen',
    'door-passage-envelope': 'Durchfahrtshülle', 'vehicle-swept-envelope': 'Explizite Bewegungshülle',
  }
  return [...new Set(model.assemblies.map((a) => a.kind === 'approach-envelope'
    ? (a.id.includes('entry') ? 'Einfahrtshülle' : 'Ausfahrtshülle')
    : a.kind === 'door' || a.kind === 'landing-door' ? `Türen ${a.id.endsWith('rear') ? 'hinten' : 'vorne'}` : labels[a.kind]).filter(Boolean))] as string[]
}
