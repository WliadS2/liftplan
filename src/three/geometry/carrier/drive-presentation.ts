import type { DrivePartKind } from '../../../elevator/models/carrier-drive-model'

export const DRIVE_KIND_LABELS: Readonly<Record<DrivePartKind,string>> = {
  machine:'Antriebsmaschine (Hülle)', 'machine-support':'Maschinenauflager', 'traction-sheave':'Seilrolle (Hülle)',
  'suspension-hitch':'Aufhängungspunkt', 'counterweight-frame':'Gegengewichtsrahmen', 'counterweight-stack':'Gegengewicht',
  'counterweight-rail':'Gegengewichtsschienen', 'counterweight-shoe':'Gegengewichtsführung',
  'hydraulic-cylinder':'Hydraulikzylinder (Hülle)', 'hydraulic-plunger':'Plunger-Bewegungshülle', 'hydraulic-base':'Zylinderfuß',
  'hydraulic-connection':'Trägeranbindung', 'hydraulic-pulley':'Hydraulikrolle (Hülle)', 'safety-gear':'Fangvorrichtung (Planungshülle)',
}
export const isDriveKind = (kind: string): kind is DrivePartKind => kind in DRIVE_KIND_LABELS
export const isSafetyKind = (kind: string) => ['safety-gear','buffer','guide','guide-shoe'].includes(kind)
export const isCarrierStructureKind = (kind: string) => ['carrier-frame','floor-structure','guide-shoe'].includes(kind)
export const isDriveContextKind = (kind: string) => isCarrierStructureKind(kind) || ['platform','platform-floor','guide'].includes(kind)
export const isMechanicsKind = (kind: string) => isDriveKind(kind) || ['carrier-frame','floor-structure','guide','guide-shoe','buffer'].includes(kind)
export const driveAppearance = (kind: DrivePartKind) => ({ color:kind.startsWith('hydraulic') ? '#786c58'
  : kind.startsWith('counterweight') ? '#617568' : kind === 'safety-gear' ? '#79664c' : '#586d7a',
  opacity:kind === 'hydraulic-cylinder' ? 0.28 : kind === 'counterweight-frame' ? 0.25 : 1,
  presentation:'solid' as const,lineWidth:1.2 })
