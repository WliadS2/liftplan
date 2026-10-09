import {
  GOODS_LOAD_CATEGORIES,
  createCenteredVehiclePosition,
  updateCarLiftPlanningConfiguration,
  updateGoodsLiftPlanningConfiguration,
  type CarLiftApproachEnvelope,
  type CarLiftPlanningConfiguration,
  type GoodsLiftPlanningConfiguration,
  type GoodsLoadCategory,
  type GoodsLoadEnvelope,
} from '../../elevator'
import { kilograms, metresPerSecond, millimetres, type Millimetres } from '../../engineering'
import type { CarrierDrivePlanning } from '../../elevator/configuration/carrier-drive-planning'
import { LandingEditor } from './LandingEditor'

function DrivePlanningFields({drive,onChange}:{readonly drive?:CarrierDrivePlanning;readonly onChange:(drive:CarrierDrivePlanning)=>void}) {
  return <details><summary>Antrieb und Mechanik</summary>
    <label className="field"><span>Antriebskonzept</span><select value={drive?.concept ?? 'unspecified'} onChange={(event)=>{
      const concept = event.target.value
      if (concept === 'unspecified') onChange({concept})
      else if (concept === 'traction' || concept === 'hydraulic') onChange({concept,source:'planning'})
    }}><option value="unspecified">Nicht angegeben</option><option value="traction">Traktion</option><option value="hydraulic">Hydraulisch</option></select></label>
    {drive?.concept === 'traction' && <NumberField label="Gegengewichtsweg je Trägerweg" step="any" value={drive.counterweight?.travelRatio}
      onChange={(travelRatio)=>onChange({...drive,counterweight:{...drive.counterweight,travelRatio}})}/>}
    {drive?.concept === 'hydraulic' && <>
      <label className="field"><span>Hydraulikanordnung</span><select value={drive.layout ?? ''} onChange={(event)=>onChange({...drive,
        layout:event.target.value === 'direct' || event.target.value === 'indirect' ? event.target.value : undefined})}>
        <option value="">Nicht angegeben</option><option value="direct">Direkt wirkend</option><option value="indirect">Indirekt mit expliziter Seilführung</option>
      </select></label>
      <MillimetreField label="Verfügbarer Plungerhub" value={drive.travel?.availableStrokeMm}
        onChange={(availableStrokeMm)=>onChange({...drive,travel:{...drive.travel,availableStrokeMm}})}/>
      <NumberField label="Plungerweg je Trägerweg" step="any" value={drive.travel?.plungerPerCarrierRatio}
        onChange={(plungerPerCarrierRatio)=>onChange({...drive,travel:{...drive.travel,plungerPerCarrierRatio}})}/>
    </>}
    <p className="panel-note">Komponentenhüllen und Anbindungen benötigen explizite Planungsdaten. Keine automatische Auslegung oder Konformitätsbewertung.</p>
  </details>
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function NumberField({ label, value, step, onChange }: {
  readonly label: string
  readonly value?: number
  readonly step?: string
  readonly onChange: (value?: number) => void
}) {
  const match = label.match(/^(.*?)\s+\(([^)]+)\)$/)
  const text = match ? match[1] : label
  const unit = match ? match[2] : undefined
  return <label className="field">
    <span>{text}</span>
    <input type="number" step={step} value={value ?? ''}
      onChange={(event) => onChange(parseOptionalNumber(event.target.value))} />
    {unit && <span className="unit-label">{unit}</span>}
  </label>
}

function MillimetreField({ label, value, onChange }: {
  readonly label: string
  readonly value?: Millimetres
  readonly onChange: (value?: Millimetres) => void
}) {
  const text = label.replace(/\s*\(mm\)$/, '')
  return <label className="field">
    <span>{text}</span>
    <input type="number" value={value ?? ''}
      onChange={(event) => {
        const parsed = parseOptionalNumber(event.target.value)
        onChange(parsed === undefined ? undefined : millimetres(parsed))
      }} />
    <span className="unit-label">mm</span>
  </label>
}

function BooleanField({ label, value, onChange }: {
  readonly label: string
  readonly value?: boolean
  readonly onChange: (value?: boolean) => void
}) {
  return <label className="field">
    <span>{label}</span>
    <select value={value === undefined ? '' : String(value)} onChange={(event) => onChange(
      event.target.value === '' ? undefined : event.target.value === 'true',
    )}>
      <option value="">Nicht angegeben</option>
      <option value="true">Ja</option>
      <option value="false">Nein</option>
    </select>
  </label>
}

function uniformStoreyHeight(configuration: { readonly storeyHeightsMm?: readonly Millimetres[] }): Millimetres | undefined {
  const heights = configuration.storeyHeightsMm
  if (!heights?.length || heights.some((height) => height !== heights[0])) return undefined
  return heights[0]
}

function repeatedStoreyHeights(stopCount: number | undefined, height: Millimetres | undefined): readonly Millimetres[] | undefined {
  if (height === undefined) return undefined
  if (!Number.isInteger(stopCount) || !stopCount || stopCount < 1) return [height]
  return Array.from({ length: Math.max(0, stopCount - 1) }, () => height)
}

function LoadEnvelopeFields({ title, value, onChange }: {
  readonly title: string
  readonly value?: GoodsLoadEnvelope
  readonly onChange: (value?: GoodsLoadEnvelope) => void
}) {
  const update = (entry: Partial<GoodsLoadEnvelope>) => onChange({ ...value, ...entry })
  return <>
    <h3>{title}</h3>
    <MillimetreField label={`${title} Breite`} value={value?.widthMm} onChange={(widthMm) => update({ widthMm })} />
    <MillimetreField label={`${title} Tiefe`} value={value?.depthMm} onChange={(depthMm) => update({ depthMm })} />
    <MillimetreField label={`${title} Höhe`} value={value?.heightMm} onChange={(heightMm) => update({ heightMm })} />
  </>
}

const goodsLoadLabels: Readonly<Record<GoodsLoadCategory, string>> = {
  'general-goods': 'Allgemeine Waren',
  palletized: 'Palettierte Waren',
  'roll-container': 'Rollcontainer',
  'forklift-assisted': 'Staplerunterstützt',
  mixed: 'Gemischte Nutzung',
}

export function GoodsLiftConfigurationForm({ configuration, onChange }: {
  readonly configuration: GoodsLiftPlanningConfiguration
  readonly onChange: (configuration: GoodsLiftPlanningConfiguration) => void
}) {
  const update = (value: Parameters<typeof updateGoodsLiftPlanningConfiguration>[1]) =>
    onChange(updateGoodsLiftPlanningConfiguration(configuration, value))
  return <div className="field-group" data-lift-family-form="goods">
    <LandingEditor configuration={configuration} passenger={false} onChange={onChange}/>
    <DrivePlanningFields drive={configuration.drive} onChange={(drive)=>update({drive})}/>
    <h3>Allgemein</h3>
    <label className="field"><span>Projektname</span><input type="text" value={configuration.projectName}
      onChange={(event) => update({ projectName: event.target.value })} /></label>
    <NumberField label="Tragfähigkeit (kg)" value={configuration.ratedLoadKg}
      onChange={(value) => update({ ratedLoadKg: value === undefined ? undefined : kilograms(value) })} />
    <NumberField label="Anzahl Haltestellen" step="1" value={configuration.levelElevationsMm?.length ?? configuration.stopCount}
      onChange={(stopCount) => update({ stopCount })} />
    <NumberField label="Nenngeschwindigkeit (m/s)" step="any" value={configuration.nominalSpeedMetresPerSecond}
      onChange={(value) => update({ nominalSpeedMetresPerSecond: value === undefined ? undefined : metresPerSecond(value) })} />

    <h3>Plattform / Kabine</h3>
    <MillimetreField label="Plattformbreite" value={configuration.platformWidthMm} onChange={(platformWidthMm) => update({ platformWidthMm })} />
    <MillimetreField label="Plattformtiefe" value={configuration.platformDepthMm} onChange={(platformDepthMm) => update({ platformDepthMm })} />
    <MillimetreField label="Plattformhöhe" value={configuration.platformHeightMm} onChange={(platformHeightMm) => update({ platformHeightMm })} />

    <h3>Türen und Zugang</h3>
    <MillimetreField label="Türbreite" value={configuration.doorWidthMm} onChange={(doorWidthMm) => update({ doorWidthMm })} />
    <MillimetreField label="Türhöhe" value={configuration.doorHeightMm} onChange={(doorHeightMm) => update({ doorHeightMm })} />
    <BooleanField label="Zugang vorne" value={configuration.frontAccess} onChange={(frontAccess) => update({ frontAccess })} />
    <BooleanField label="Zugang hinten" value={configuration.rearAccess} onChange={(rearAccess) => update({ rearAccess })} />
    <BooleanField label="Durchlader" value={configuration.throughCar} onChange={(throughCar) => update({ throughCar })} />

    <h3>Schacht und Ebenen</h3>
    <MillimetreField label="Schachtbreite" value={configuration.shaftWidthMm} onChange={(shaftWidthMm) => update({ shaftWidthMm })} />
    <MillimetreField label="Schachttiefe" value={configuration.shaftDepthMm} onChange={(shaftDepthMm) => update({ shaftDepthMm })} />
    <MillimetreField label="Grubentiefe" value={configuration.pitDepthMm} onChange={(pitDepthMm) => update({ pitDepthMm })} />
    <MillimetreField label="Schachtkopf" value={configuration.headroomMm} onChange={(headroomMm) => update({ headroomMm })} />
    <MillimetreField label="Einheitliche Geschosshöhe" value={uniformStoreyHeight(configuration)}
      onChange={(height) => update({ storeyHeightsMm: repeatedStoreyHeights(configuration.stopCount, height), levelElevationsMm: undefined })} />

    <h3>Last / Nutzung</h3>
    <label className="field"><span>Nutzungskategorie</span><select value={configuration.loadCategory ?? ''}
      onChange={(event) => update({ loadCategory: GOODS_LOAD_CATEGORIES.find((entry) => entry === event.target.value) })}>
      <option value="">Nicht angegeben</option>
      {GOODS_LOAD_CATEGORIES.map((entry) => <option key={entry} value={entry}>{goodsLoadLabels[entry]}</option>)}
    </select></label>

    <details>
      <summary>Optionale Lasthüllen</summary>
      <LoadEnvelopeFields title="Palette" value={configuration.pallet} onChange={(pallet) => update({ pallet })} />
      <LoadEnvelopeFields title="Rollcontainer" value={configuration.rollContainer} onChange={(rollContainer) => update({ rollContainer })} />
      <LoadEnvelopeFields title="Gabelstapler-Hülle" value={configuration.forkliftEnvelope} onChange={(forkliftEnvelope) => update({ forkliftEnvelope })} />
    </details>

    <details>
      <summary>Führungssystem</summary>
      <label className="field"><span>Ausrichtung</span><select value={configuration.guideSystem?.orientation ?? ''}
        onChange={(event) => update({ guideSystem: { ...configuration.guideSystem,
          orientation: event.target.value === 'x' || event.target.value === 'z' ? event.target.value : undefined } })}>
        <option value="">Nicht angegeben</option><option value="x">X-Achse</option><option value="z">Z-Achse</option>
      </select></label>
      <MillimetreField label="Schienenabstand" value={configuration.guideSystem?.spacingMm}
        onChange={(spacingMm) => update({ guideSystem: { ...configuration.guideSystem, spacingMm } })} />
    </details>
  </div>
}

function ApproachEnvelopeFields({ title, value, onChange }: {
  readonly title: string
  readonly value?: CarLiftApproachEnvelope
  readonly onChange: (value?: CarLiftApproachEnvelope) => void
}) {
  const update = (entry: Partial<CarLiftApproachEnvelope>) => onChange({ ...value, ...entry })
  return <>
    <h3>{title}</h3>
    <MillimetreField label="Breite" value={value?.widthMm} onChange={(widthMm) => update({ widthMm })} />
    <MillimetreField label="Länge" value={value?.lengthMm} onChange={(lengthMm) => update({ lengthMm })} />
    <MillimetreField label="Höhe" value={value?.heightMm} onChange={(heightMm) => update({ heightMm })} />
    <MillimetreField label="Längsversatz" value={value?.longitudinalOffsetMm}
      onChange={(longitudinalOffsetMm) => update({ longitudinalOffsetMm })} />
    <MillimetreField label="Querversatz" value={value?.lateralOffsetMm}
      onChange={(lateralOffsetMm) => update({ lateralOffsetMm })} />
    <NumberField label="Ausrichtung (°)" step="any" value={value?.headingDegrees}
      onChange={(headingDegrees) => update({ headingDegrees })} />
  </>
}

export function CarLiftConfigurationForm({ configuration, onChange }: {
  readonly configuration: CarLiftPlanningConfiguration
  readonly onChange: (configuration: CarLiftPlanningConfiguration) => void
}) {
  const update = (value: Parameters<typeof updateCarLiftPlanningConfiguration>[1]) =>
    onChange(updateCarLiftPlanningConfiguration(configuration, value))
  const updateVehicle = (value: Partial<NonNullable<CarLiftPlanningConfiguration['vehicle']>>) =>
    update({ vehicle: { ...configuration.vehicle, ...value } })
  const updatePosition = (value: Partial<NonNullable<CarLiftPlanningConfiguration['vehiclePosition']>>) =>
    update({ vehiclePosition: { ...configuration.vehiclePosition, ...value } })
  return <div className="field-group" data-lift-family-form="car">
    <LandingEditor configuration={configuration} passenger={false} onChange={onChange}/>
    <DrivePlanningFields drive={configuration.drive} onChange={(drive)=>update({drive})}/>
    <h3>Allgemein</h3>
    <label className="field"><span>Projektname</span><input type="text" value={configuration.projectName}
      onChange={(event) => update({ projectName: event.target.value })} /></label>
    <NumberField label="Tragfähigkeit (kg)" value={configuration.ratedLoadKg}
      onChange={(value) => update({ ratedLoadKg: value === undefined ? undefined : kilograms(value) })} />
    <NumberField label="Anzahl Haltestellen" step="1" value={configuration.levelElevationsMm?.length ?? configuration.stopCount}
      onChange={(stopCount) => update({ stopCount })} />
    <NumberField label="Nenngeschwindigkeit (m/s)" step="any" value={configuration.nominalSpeedMetresPerSecond}
      onChange={(value) => update({ nominalSpeedMetresPerSecond: value === undefined ? undefined : metresPerSecond(value) })} />

    <h3>Plattform</h3>
    <MillimetreField label="Plattformbreite" value={configuration.platformWidthMm} onChange={(platformWidthMm) => update({ platformWidthMm })} />
    <MillimetreField label="Plattformtiefe" value={configuration.platformDepthMm} onChange={(platformDepthMm) => update({ platformDepthMm })} />
    <MillimetreField label="Nutzbare Höhe" value={configuration.usableHeightMm} onChange={(usableHeightMm) => update({ usableHeightMm })} />
    <label className="field"><span>Beladerichtung</span><select value={configuration.vehicleLoadingDirection ?? ''}
      onChange={(event) => update({ vehicleLoadingDirection: event.target.value === 'shaft-x' || event.target.value === 'shaft-z'
        ? event.target.value : undefined })}>
      <option value="">Nicht angegeben</option><option value="shaft-z">In Schachttiefe</option><option value="shaft-x">In Schachtbreite</option>
    </select></label>

    <h3>Schacht und Ebenen</h3>
    <MillimetreField label="Schachtbreite" value={configuration.shaftWidthMm} onChange={(shaftWidthMm) => update({ shaftWidthMm })} />
    <MillimetreField label="Schachttiefe" value={configuration.shaftDepthMm} onChange={(shaftDepthMm) => update({ shaftDepthMm })} />
    <MillimetreField label="Grubentiefe" value={configuration.pitDepthMm} onChange={(pitDepthMm) => update({ pitDepthMm })} />
    <MillimetreField label="Schachtkopf" value={configuration.headroomMm} onChange={(headroomMm) => update({ headroomMm })} />
    <MillimetreField label="Einheitliche Geschosshöhe" value={uniformStoreyHeight(configuration)}
      onChange={(height) => update({ storeyHeightsMm: repeatedStoreyHeights(configuration.stopCount, height), levelElevationsMm: undefined })} />

    <h3>Türen und Zugang</h3>
    <MillimetreField label="Türbreite" value={configuration.doorClearWidthMm} onChange={(doorClearWidthMm) => update({ doorClearWidthMm })} />
    <MillimetreField label="Türhöhe" value={configuration.doorClearHeightMm} onChange={(doorClearHeightMm) => update({ doorClearHeightMm })} />
    <BooleanField label="Zugang vorne" value={configuration.frontAccess} onChange={(frontAccess) => update({ frontAccess })} />
    <BooleanField label="Zugang hinten" value={configuration.rearAccess} onChange={(rearAccess) => update({ rearAccess })} />
    <BooleanField label="Durchlader" value={configuration.throughCar} onChange={(throughCar) => update({ throughCar })} />

    <h3>Fahrzeug</h3>
    <MillimetreField label="Fahrzeugbreite" value={configuration.vehicle?.widthMm} onChange={(widthMm) => updateVehicle({ widthMm })} />
    <MillimetreField label="Fahrzeuglänge" value={configuration.vehicle?.lengthMm} onChange={(lengthMm) => updateVehicle({ lengthMm })} />
    <MillimetreField label="Fahrzeughöhe" value={configuration.vehicle?.heightMm} onChange={(heightMm) => updateVehicle({ heightMm })} />
    <NumberField label="Fahrzeugmasse (kg)" value={configuration.vehicle?.massKg}
      onChange={(value) => updateVehicle({ massKg: value === undefined ? undefined : kilograms(value) })} />
    <MillimetreField label="Radstand" value={configuration.vehicle?.wheelbaseMm} onChange={(wheelbaseMm) => updateVehicle({ wheelbaseMm })} />
    <MillimetreField label="Spurbreite" value={configuration.vehicle?.trackWidthMm} onChange={(trackWidthMm) => updateVehicle({ trackWidthMm })} />
    <MillimetreField label="Überhang vorne" value={configuration.vehicle?.frontOverhangMm} onChange={(frontOverhangMm) => updateVehicle({ frontOverhangMm })} />
    <MillimetreField label="Überhang hinten" value={configuration.vehicle?.rearOverhangMm} onChange={(rearOverhangMm) => updateVehicle({ rearOverhangMm })} />

    <h3>Fahrzeugposition</h3>
    <MillimetreField label="Längsversatz" value={configuration.vehiclePosition?.longitudinalOffsetMm}
      onChange={(longitudinalOffsetMm) => updatePosition({ longitudinalOffsetMm })} />
    <MillimetreField label="Querversatz" value={configuration.vehiclePosition?.lateralOffsetMm}
      onChange={(lateralOffsetMm) => updatePosition({ lateralOffsetMm })} />
    <NumberField label="Ausrichtung (°)" step="any" value={configuration.vehiclePosition?.headingDegrees}
      onChange={(headingDegrees) => updatePosition({ headingDegrees })} />
    <button type="button" className="secondary-button" onClick={() => update({
      vehiclePosition: createCenteredVehiclePosition(configuration.vehiclePosition?.headingDegrees ?? 0),
    })}>Fahrzeug zentrieren</button>

    <details>
      <summary>Erweiterte Fahrzeuggeometrie</summary>
      <ApproachEnvelopeFields title="Einfahrhülle" value={configuration.entryApproachEnvelope}
        onChange={(entryApproachEnvelope) => update({ entryApproachEnvelope })} />
      <ApproachEnvelopeFields title="Ausfahrhülle" value={configuration.exitApproachEnvelope}
        onChange={(exitApproachEnvelope) => update({ exitApproachEnvelope })} />
      <ApproachEnvelopeFields title="Fahrzeug-Bewegungshülle" value={configuration.vehicleSweptEnvelope}
        onChange={(vehicleSweptEnvelope) => update({ vehicleSweptEnvelope })} />
      <h3>Türdurchfahrtshülle</h3>
      <MillimetreField label="Freie Breite" value={configuration.doorPassageEnvelope?.clearWidthMm}
        onChange={(clearWidthMm) => update({ doorPassageEnvelope: { ...configuration.doorPassageEnvelope, clearWidthMm } })} />
      <MillimetreField label="Freie Höhe" value={configuration.doorPassageEnvelope?.clearHeightMm}
        onChange={(clearHeightMm) => update({ doorPassageEnvelope: { ...configuration.doorPassageEnvelope, clearHeightMm } })} />
      <MillimetreField label="Tiefe" value={configuration.doorPassageEnvelope?.depthMm}
        onChange={(depthMm) => update({ doorPassageEnvelope: { ...configuration.doorPassageEnvelope, depthMm } })} />
    </details>
  </div>
}
