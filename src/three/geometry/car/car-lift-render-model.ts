import type { CarLiftSceneModel, CarSceneBox, CarSceneLine } from '../../../elevator/car/car-lift-scene-model'
import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import { DRIVE_KIND_LABELS, driveAppearance, isDriveKind, isMechanicsKind, isSafetyKind, isCarrierStructureKind, isDriveContextKind } from '../carrier/drive-presentation'

export const CAR_LIFT_VIEW_MODE_CATALOG = [
  { id: 'overview', label: 'Gesamtansicht' },
  { id: 'platform', label: 'Plattform' },
  { id: 'vehicle', label: 'Fahrzeug' },
  { id: 'mechanical', label: 'Mechanik' },
  { id: 'drive', label: 'Antrieb' },
  { id: 'doors', label: 'Türen' },
  { id: 'approach', label: 'Zufahrt' },
  { id: 'guides', label: 'Führungssystem' },
  { id: 'safety', label: 'Sicherheit' },
  { id: 'cutaway', label: 'Schnittansicht' },
] as const
export type CarLiftViewMode = typeof CAR_LIFT_VIEW_MODE_CATALOG[number]['id']
export type CarSceneAssembly = CarSceneBox | CarSceneLine
export interface CarRenderAppearance {
  readonly color: string
  readonly opacity: number
  readonly presentation: 'outline' | 'surface' | 'solid' | 'line' | 'marker' | 'section'
  readonly lineWidth?: number
  readonly dashed?: boolean
}
export type CarRenderableAssembly = CarSceneAssembly & { readonly appearance: CarRenderAppearance }
export interface CarLiftRenderModel {
  readonly drive?: CarrierDriveScene
  readonly family: 'car'
  readonly viewMode: CarLiftViewMode
  readonly assemblies: readonly CarRenderableAssembly[]
}

/** Visual contact symbol only: not a tire radius or any engineering dimension. */
export const CAR_CONTACT_SYMBOL_RADIUS_METRES = 0.12
const platformKinds: readonly CarSceneAssembly['kind'][] = ['platform', 'platform-floor', 'platform-wall', 'door', 'loading-direction',
  'carrier-frame', 'floor-structure', 'guide-shoe']
const vehicleKinds: readonly CarSceneAssembly['kind'][] = ['vehicle-body', 'wheel-contact', 'vehicle-centerline', 'vehicle-axle', 'vehicle-reference']
const approachKinds: readonly CarSceneAssembly['kind'][] = ['approach-envelope', 'vehicle-swept-envelope', 'door-passage-envelope']

function visible(assembly: CarSceneAssembly, mode: CarLiftViewMode): boolean {
  if (mode === 'mechanical') return isMechanicsKind(assembly.kind) || assembly.kind === 'platform'
  if (mode === 'drive') return isDriveKind(assembly.kind) && assembly.kind !== 'safety-gear' || isDriveContextKind(assembly.kind)
  if (mode === 'safety') return isSafetyKind(assembly.kind) || assembly.kind === 'carrier-frame'
  if (mode === 'guides') return ['guide','guide-shoe','carrier-frame','floor-structure'].includes(assembly.kind)
  if ('driveAttachment' in assembly && assembly.driveAttachment !== undefined && mode === 'platform') return assembly.driveAttachment === 'carrier'
  if (assembly.kind === 'vehicle-reference') return mode === 'vehicle'
  if (mode === 'overview') return assembly.kind !== 'moving-envelope' && !approachKinds.includes(assembly.kind)
  if (mode === 'vehicle') return ['platform-floor', 'floor-structure', 'loading-direction'].includes(assembly.kind) || vehicleKinds.includes(assembly.kind)
  if (mode === 'platform') return platformKinds.includes(assembly.kind) || vehicleKinds.includes(assembly.kind)
  if (mode === 'doors') return ['shaft', 'platform', 'door', 'landing-door', 'level'].includes(assembly.kind)
  if (mode === 'approach') return approachKinds.includes(assembly.kind)
  return !approachKinds.includes(assembly.kind) && assembly.kind !== 'platform-roof' && !(assembly.kind === 'platform-wall' &&
    (assembly.id.includes('-front') || assembly.id.endsWith('-right')))
}

function appearance(assembly: CarSceneAssembly, mode: CarLiftViewMode): CarRenderAppearance {
  if (isDriveKind(assembly.kind)) return driveAppearance(assembly.kind)
  if (mode === 'drive' && assembly.kind === 'platform') return {color:'#82919a',opacity:0.25,presentation:'outline',lineWidth:1}
  if (assembly.kind === 'shaft' && mode === 'cutaway') return { color: '#64748b', opacity: 0.22, presentation: 'section' }
  if (assembly.kind === 'carrier-frame') return { color: '#5e707c', opacity: 1, presentation: 'solid', lineWidth: 1.2 }
  if (assembly.kind === 'floor-structure') return { color: '#687d88', opacity: 1, presentation: 'solid', lineWidth: 1.2 }
  if (assembly.kind === 'guide-shoe') return { color: '#364953', opacity: 1, presentation: 'solid', lineWidth: 1 }
  if (assembly.kind === 'buffer') return { color: assembly.id.endsWith('contact') ? '#9caab2' : '#5f6e76', opacity: 1, presentation: 'solid', lineWidth: 1 }
  if (assembly.kind === 'wheel-contact') return { color: '#293b44', opacity: 1, presentation: 'marker' }
  if (assembly.kind === 'vehicle-axle') return { color: '#26343c', opacity: 1, presentation: 'line', lineWidth: 2.4 }
  if (assembly.kind === 'vehicle-reference') return { color: '#374650', opacity: 0.85, presentation: 'line', lineWidth: 1, dashed: true }
  if (assembly.kind === 'vehicle-centerline') return { color: '#526b77', opacity: 0.85, presentation: 'line', dashed: true }
  if (assembly.kind === 'loading-direction') return { color: '#7a6b4f', opacity: 0.6, presentation: 'line' }
  if (assembly.kind === 'guide') return { color: '#75858e', opacity: 1, presentation: 'componentSource' in assembly && assembly.componentSource ? 'solid' : 'line', lineWidth: 1 }
  if (assembly.kind === 'platform-floor') return { color: '#849198', opacity: mode === 'platform' ? 0.9 : 0.22, presentation: 'surface', lineWidth: 2 }
  if (assembly.kind === 'platform-roof' || assembly.kind === 'platform-wall') return { color: '#a4b0b6', opacity: mode === 'vehicle' || mode === 'approach' ? 0.025 : 0.1, presentation: 'surface' }
  if (assembly.kind === 'door' || assembly.kind === 'landing-door') return {
    color: assembly.id.endsWith('rear') ? '#736c61' : '#526b77',
    opacity: mode === 'doors' ? 0.1 : mode === 'platform' ? 0.12 : 0.04, presentation: 'surface', lineWidth: mode === 'doors' ? 2 : 1.4,
  }
  if (assembly.kind === 'vehicle-body') return { color: '#657680', opacity: mode === 'platform' ? 0.12 : mode === 'vehicle' ? 0.72 : 0.55, presentation: 'surface', lineWidth: mode === 'vehicle' ? 2 : 1.4 }
  if (assembly.kind === 'approach-envelope') return { color: assembly.id.includes('entry') ? '#536859' : '#796952', opacity: 0.9, presentation: 'outline', lineWidth: 1.8, dashed: assembly.id.includes('exit') }
  if (assembly.kind === 'vehicle-swept-envelope') return { color: '#67596a', opacity: 0.9, presentation: 'outline', lineWidth: 1.2, dashed: true }
  if (assembly.kind === 'door-passage-envelope') return { color: '#435f6d', opacity: 0.9, presentation: 'outline', lineWidth: 2.3 }
  return { color: '#7b8a93', opacity: assembly.kind === 'platform' ? 0.65 : 0.5, presentation: 'outline', lineWidth: assembly.kind === 'platform' ? 1.6 : 1 }
}

/** Pure presentation policy; positions and dimensions are copied unchanged from the scene adapter. */
export function createCarLiftRenderModel(scene: CarLiftSceneModel, viewMode: CarLiftViewMode, inspectionLevel?: string): CarLiftRenderModel {
  const firstDoor = scene.assemblies.find((a)=>'doorAttachment' in a && a.doorAttachment?.role === 'landing')
  const level = inspectionLevel ?? (firstDoor && 'doorAttachment' in firstDoor && firstDoor.doorAttachment?.role === 'landing' ? firstDoor.doorAttachment.levelId : undefined)
  return { family: 'car', viewMode, drive:scene.drive, assemblies: scene.assemblies.filter((a) => visible(a, viewMode))
    .filter((a)=>viewMode !== 'doors' || !level ||
      (a.kind !== 'landing-door' || ('doorAttachment' in a && a.doorAttachment?.role === 'landing' && a.doorAttachment.levelId === level)) &&
      (a.kind !== 'level' || a.id === `car-${level}`))
    .filter((a)=>a.kind !== 'platform-floor' || !scene.assemblies.some((p)=>p.kind === 'floor-structure' && visible(p,viewMode)))
    .map((a) => ({ ...a, appearance: appearance(a, viewMode) })) }
}

export function getCarLiftRenderLegend(model: CarLiftRenderModel): readonly string[] {
  const labels: Partial<Record<CarSceneAssembly['kind'], string>> = {
    shaft: 'Schacht', platform: 'Plattform / Nutzraum', 'vehicle-body': 'Fahrzeughülle',
    'wheel-contact': 'Radkontaktpunkte (schematische Symbole)', 'vehicle-centerline': 'Fahrzeugachse',
    'vehicle-axle': 'Vorder-/Hinterachse', 'vehicle-reference': 'Fahrzeugmaße',
    'loading-direction': 'Beladungsachse', level: 'Haltestellen', guide: 'Schienenachsen',
    'door-passage-envelope': 'Durchfahrtshülle', 'vehicle-swept-envelope': 'Explizite Bewegungshülle',
    'carrier-frame': 'Tragrahmen', 'floor-structure': 'Plattformboden', 'guide-shoe': 'Führungsschuhe', buffer: 'Puffer',
  }
  return [...new Set(model.assemblies.map((a) => a.kind === 'approach-envelope'
    ? (a.id.includes('entry') ? 'Einfahrtshülle' : 'Ausfahrtshülle')
    : isDriveKind(a.kind) ? DRIVE_KIND_LABELS[a.kind] : a.kind === 'guide' && 'componentSource' in a && a.componentSource ? 'Führungsschienen (Hüllkörper)'
    : a.kind === 'door' || a.kind === 'landing-door' ? `Türen ${a.id.endsWith('rear') ? 'hinten' : 'vorne'}` : labels[a.kind]).filter(Boolean))] as string[]
}

export function getAvailableCarLiftViewModes(scene: CarLiftSceneModel) {
  return CAR_LIFT_VIEW_MODE_CATALOG.filter((entry)=>entry.id === 'mechanical' ? scene.assemblies.some((a)=>isCarrierStructureKind(a.kind))
    : entry.id === 'drive' ? scene.assemblies.some((a)=>isDriveKind(a.kind) && a.kind !== 'safety-gear')
    : entry.id === 'safety' ? scene.assemblies.some((a)=>a.kind === 'safety-gear' || a.kind === 'buffer')
    : entry.id === 'guides' ? scene.assemblies.some((a)=>a.kind === 'guide') : true)
}
