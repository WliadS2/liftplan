import type { GoodsLiftSceneModel, GoodsSceneBox } from '../../../elevator/goods/goods-lift-scene-model'
import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import { DRIVE_KIND_LABELS, driveAppearance, isDriveKind, isMechanicsKind, isSafetyKind, isCarrierStructureKind, isDriveContextKind } from '../carrier/drive-presentation'

export const GOODS_LIFT_VIEW_MODES = [
  'overview', 'platform', 'mechanical', 'drive', 'doors', 'loads', 'guides', 'safety', 'cutaway',
] as const

export type GoodsLiftViewMode = (typeof GOODS_LIFT_VIEW_MODES)[number]

export const GOODS_LIFT_VIEW_MODE_CATALOG: readonly {
  readonly id: GoodsLiftViewMode
  readonly label: string
  readonly requiresGuides?: boolean
  readonly requires?: 'mechanical' | 'drive' | 'safety'
}[] = [
  { id: 'overview', label: 'Gesamtansicht' },
  { id: 'platform', label: 'Plattform/Kabine' },
  { id: 'mechanical', label: 'Mechanik', requires:'mechanical' },
  { id: 'drive', label: 'Antrieb', requires:'drive' },
  { id: 'doors', label: 'Türen' },
  { id: 'loads', label: 'Lasten' },
  { id: 'guides', label: 'Führungssystem', requiresGuides: true },
  { id: 'safety', label: 'Sicherheit', requires:'safety' },
  { id: 'cutaway', label: 'Schnittansicht' },
]

export interface GoodsRenderAppearance {
  readonly color: string
  readonly opacity: number
  readonly presentation: 'solid' | 'surface' | 'outline' | 'line' | 'section'
  readonly lineWidth?: number
  readonly dashed?: boolean
}

export interface GoodsRenderableAssembly extends GoodsSceneBox {
  readonly appearance: GoodsRenderAppearance
}

export interface GoodsLiftRenderModel {
  readonly drive?: CarrierDriveScene
  readonly family: 'goods'
  readonly viewMode: GoodsLiftViewMode
  readonly assemblies: readonly GoodsRenderableAssembly[]
}

const loadKinds = new Set<GoodsSceneBox['kind']>(['pallet', 'roll-container', 'forklift-envelope'])
const platformKinds = new Set<GoodsSceneBox['kind']>([
  'platform', 'platform-floor', 'platform-roof', 'platform-wall', 'door',
  'carrier-frame', 'floor-structure', 'guide-shoe',
])

function visibleInMode(assembly: GoodsSceneBox, mode: GoodsLiftViewMode): boolean {
  if (mode === 'mechanical') return isMechanicsKind(assembly.kind) || assembly.kind === 'platform'
  if (mode === 'drive') return isDriveKind(assembly.kind) && assembly.kind !== 'safety-gear' || isDriveContextKind(assembly.kind)
  if (mode === 'safety') return isSafetyKind(assembly.kind) || assembly.kind === 'carrier-frame'
  if (assembly.driveAttachment !== undefined && mode === 'platform') return assembly.driveAttachment === 'carrier'
  if (mode === 'overview') return assembly.kind !== 'moving-envelope'
  if (mode === 'platform') return (platformKinds.has(assembly.kind) && assembly.kind !== 'platform-roof') || loadKinds.has(assembly.kind)
  if (mode === 'doors') {
    return assembly.kind === 'door' || assembly.kind === 'landing-door' || assembly.kind === 'level' ||
      assembly.kind === 'shaft' || assembly.kind === 'platform' || assembly.kind === 'platform-wall'
  }
  if (mode === 'loads') return loadKinds.has(assembly.kind) || ['platform-floor', 'floor-structure', 'platform'].includes(assembly.kind)
  if (mode === 'guides') {
    return assembly.kind === 'guide' || assembly.kind === 'shaft' || assembly.kind === 'platform' ||
      assembly.kind === 'moving-envelope' || assembly.kind === 'level' ||
      ['carrier-frame','floor-structure','guide-shoe','buffer'].includes(assembly.kind)
  }
  if (assembly.kind === 'platform-roof' || (assembly.kind === 'platform-wall' &&
    (assembly.id.includes('-front') || assembly.id.endsWith('-right')))) return false
  return true
}

function appearance(assembly: GoodsSceneBox, mode: GoodsLiftViewMode): GoodsRenderAppearance {
  if (isDriveKind(assembly.kind)) return driveAppearance(assembly.kind)
  if (mode === 'drive' && assembly.kind === 'platform') return {color:'#82919a',opacity:0.25,presentation:'outline',lineWidth:1}
  if (assembly.kind === 'carrier-frame') return { color: '#5e707c', opacity: 1, presentation: 'solid', lineWidth: 1.2 }
  if (assembly.kind === 'floor-structure') return { color: '#687d88', opacity: 1, presentation: 'solid', lineWidth: 1.2 }
  if (assembly.kind === 'guide-shoe') return { color: '#364953', opacity: 1, presentation: 'solid', lineWidth: 1 }
  if (assembly.kind === 'buffer') return { color: assembly.id.endsWith('contact') ? '#9caab2' : '#5f6e76', opacity: 1, presentation: 'solid', lineWidth: 1 }
  if (assembly.kind === 'shaft') return { color: '#64748b', opacity: 0.45, presentation: mode === 'cutaway' ? 'section' : 'outline', lineWidth: 1 }
  if (assembly.kind === 'pit' || assembly.kind === 'headroom') return { color: '#64748b', opacity: 0.055, presentation: 'outline' }
  if (assembly.kind === 'level') return { color: '#64748b', opacity: 0.25, presentation: 'outline' }
  if (assembly.kind === 'platform') return { color: '#82919a', opacity: mode === 'loads' ? 0.3 : 0.6, presentation: 'outline', lineWidth: 1 }
  if (assembly.kind === 'platform-floor') return { color: '#697983', opacity: mode === 'loads' ? 0.35 : 1, presentation: 'surface', lineWidth: 2.4 }
  if (assembly.kind === 'platform-roof') return { color: '#9aa7ae', opacity: mode === 'cutaway' || mode === 'loads' ? 0.04 : 0.2, presentation: 'surface' }
  if (assembly.kind === 'platform-wall') return { color: '#a4b0b6', opacity: mode === 'doors' ? 0.035 : 0.08, presentation: 'surface' }
  if (assembly.kind === 'door' || assembly.kind === 'landing-door') return {
    color: assembly.id.endsWith('rear') ? '#736c61' : '#526b77',
    opacity: mode === 'doors' ? 0.08 : 0.025,
    presentation: 'surface', lineWidth: mode === 'doors' ? 2 : 1.6,
  }
  if (assembly.kind === 'guide') return { color: '#75858e', opacity: 1, presentation: assembly.componentSource ? 'solid' : 'line', lineWidth: 1 }
  if (assembly.kind === 'moving-envelope') return { color: '#64748b', opacity: 0.18, presentation: 'outline' }
  if (assembly.kind === 'pallet') return { color: '#716349', opacity: 1, presentation: 'outline', lineWidth: 2.5 }
  if (assembly.kind === 'roll-container') return { color: '#435f6a', opacity: 1, presentation: 'outline', lineWidth: 1.8, dashed: true }
  return { color: '#67596b', opacity: mode === 'loads' ? 0.45 : 0.9, presentation: 'outline', lineWidth: 1, dashed: true }
}

const assemblyLabels: Partial<Record<GoodsSceneBox['kind'], string>> = {
  shaft: 'Schacht', platform: 'Ladefläche/Kabine', level: 'Haltestellen', guide: 'Schienenachsen',
  'moving-envelope': 'Bewegungsraum', pallet: 'Palettenhülle', 'roll-container': 'Rollcontainer-Hülle',
  'forklift-envelope': 'Gabelstapler-Hülle',
  'carrier-frame': 'Tragrahmen', 'floor-structure': 'Plattformboden', 'guide-shoe': 'Führungsschuhe', buffer: 'Puffer',
}

export function getGoodsLiftRenderLegend(model: GoodsLiftRenderModel): readonly { label: string; color: string }[] {
  const entries = new Map<string, string>()
  for (const assembly of model.assemblies) {
    const label = isDriveKind(assembly.kind) ? DRIVE_KIND_LABELS[assembly.kind] : assembly.kind === 'guide' && assembly.componentSource ? 'Führungsschienen (Hüllkörper)' : assembly.kind === 'door' || assembly.kind === 'landing-door'
      ? `Türen ${assembly.id.endsWith('rear') ? 'hinten' : 'vorne'}` : assemblyLabels[assembly.kind]
    if (label) entries.set(label, assembly.appearance.color)
  }
  return [...entries].map(([label, color]) => ({ label, color }))
}

/** Pure presentation model. It filters semantic scene assemblies but never creates or changes dimensions. */
export function createGoodsLiftRenderModel(
  scene: GoodsLiftSceneModel,
  viewMode: GoodsLiftViewMode,
  inspectionLevel?: string,
): GoodsLiftRenderModel {
  const firstDoor = scene.assemblies.find((a)=>a.doorAttachment?.role === 'landing')
  const level = inspectionLevel ?? (firstDoor?.doorAttachment?.role === 'landing' ? firstDoor.doorAttachment.levelId : undefined)
  return {
    family: 'goods',
    drive: scene.drive,
    viewMode,
    assemblies: scene.assemblies
      .filter((assembly) => visibleInMode(assembly, viewMode))
      .filter((a)=>viewMode !== 'doors' || !level ||
        (a.kind !== 'landing-door' || (a.doorAttachment?.role === 'landing' && a.doorAttachment.levelId === level)) &&
        (a.kind !== 'level' || a.id === `goods-${level}`))
      .filter((a)=>a.kind !== 'platform-floor' || !scene.assemblies.some((p)=>p.kind === 'floor-structure' && visibleInMode(p,viewMode)))
      .map((assembly) => ({ ...assembly, appearance: appearance(assembly, viewMode) })),
  }
}

export function getAvailableGoodsLiftViewModes(scene: GoodsLiftSceneModel): readonly typeof GOODS_LIFT_VIEW_MODE_CATALOG[number][] {
  const hasGuides = scene.assemblies.some((assembly) => assembly.kind === 'guide')
  return GOODS_LIFT_VIEW_MODE_CATALOG.filter((entry) => (!entry.requiresGuides || hasGuides) &&
    (!entry.requires || scene.assemblies.some((a)=>entry.requires === 'mechanical' ? isCarrierStructureKind(a.kind)
      : entry.requires === 'drive' ? isDriveKind(a.kind) && a.kind !== 'safety-gear' : a.kind === 'safety-gear' || a.kind === 'buffer')))
}
