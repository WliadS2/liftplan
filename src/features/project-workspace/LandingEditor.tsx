import { millimetres } from '../../engineering'
import { applyUniformLandingHeight, editLanding, getLandingRows, normalizeLandings, removeLanding, resizeLandings,
  type LandingPlanningData } from '../../elevator/configuration/landing-planning'
import { LANDING_ISSUE_MESSAGES as messages } from './landing-validation-messages'

/** Presentation dispatches pure planning commands; no geometry or travel calculations. */
export function LandingEditor<T extends LandingPlanningData>({ configuration, passenger, onChange }: {
  readonly configuration: T; readonly passenger: boolean; readonly onChange: (configuration: T) => void
}) {
  const rows = getLandingRows(configuration, passenger)
  const issues = normalizeLandings(configuration, passenger).issues
  const rearEnabled = configuration.throughCar === true && (passenger || configuration.rearAccess === true)
  const frontEnabled = passenger || configuration.frontAccess === true
  return <section className="field-group" aria-label="Haltestellen und Zugänge">
    <h3>Haltestellen &amp; Zugänge</h3>
    <p className="panel-note">Höhenpositionen in mm. Kabinen-/Plattformöffnungen und bediente Haltestellenzugänge werden getrennt konfiguriert.</p>
    {rows.map((row) => <details key={row.id} open>
      <summary>{row.label || `Haltestelle ${row.index + 1}`}</summary>
      <label className="field"><span>Haltestellenbezeichnung</span><input aria-label={`Bezeichnung Haltestelle ${row.index + 1}`}
        value={row.label} onChange={(event) => onChange(editLanding(configuration, passenger, row.index, { label: event.target.value }))}/></label>
      <label className="field"><span>Höhenposition (mm)</span><input type="number" step="any" aria-label={`Höhenposition Haltestelle ${row.index + 1} (mm)`}
        value={row.elevationMm ?? ''} onChange={(event) => onChange(editLanding(configuration, passenger, row.index,
          { elevationMm: event.target.value === '' ? null : millimetres(Number(event.target.value)) }))}/></label>
      {(['front', 'rear'] as const).map((side) => {
        const value = side === 'front' ? row.frontAccess : row.rearAccess
        const label = side === 'front' ? 'Zugang vorne' : 'Zugang hinten'
        return <label className="field" key={side}><span>{label}</span><select aria-label={`${label} Haltestelle ${row.index + 1}`}
          value={value === undefined ? '' : String(value)} disabled={side === 'front' ? !frontEnabled : !rearEnabled}
          onChange={(event) => onChange(editLanding(configuration, passenger, row.index,
            { [side === 'front' ? 'frontAccess' : 'rearAccess']: event.target.value === '' ? undefined : event.target.value === 'true' }))}>
          <option value="">Nicht angegeben</option><option value="true">Ja</option><option value="false">Nein</option>
        </select></label>
      })}
      <button type="button" className="secondary-button" aria-label={`Haltestelle ${row.index + 1} entfernen`} disabled={rows.length <= 1}
        onClick={() => onChange(removeLanding(configuration, passenger, row.id))}>Haltestelle entfernen</button>
      {issues.filter((issue) => issue.levelId === row.id).map((issue) => <p className="panel-note" role="status" key={issue.code}>{messages[issue.code]}</p>)}
    </details>)}
    {issues.filter((issue) => !issue.levelId).map((issue) => <p className="panel-note" role="status" key={issue.code}>{messages[issue.code]}</p>)}
    <button type="button" className="secondary-button" onClick={() => onChange(resizeLandings(configuration, passenger, rows.length + 1))}>Haltestelle hinzufügen</button>
    {passenger && configuration.floorHeightMm !== undefined && <button type="button" className="secondary-button"
      disabled={configuration.floorHeightMm <= 0 || rows.length===0 || rows[0].elevationMm===null}
      onClick={()=>onChange(applyUniformLandingHeight(configuration,configuration.floorHeightMm!))}>Höhen aus Geschosshöhe übernehmen</button>}
  </section>
}
