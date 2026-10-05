import { lazy, Suspense, useMemo, useState } from 'react'
import {
  COUNTERWEIGHT_POSITIONS,
  RAIL_ORIENTATIONS,
  LIFT_FAMILIES,
  getLiftTypeDefinitions,
  isRegisteredLiftFamily,
  updatePassengerPlanningConfiguration,
  type PassengerMechanicalPlanningInput,
} from '../../elevator'
import {
  kilograms,
  metresPerSecond,
  millimetres,
  type Millimetres,
} from '../../engineering'
import { useProjectStore } from '../../projects'
import { createLiftGeometryPlanningInput } from '../../three/geometry/lift-geometry-planning-input'
import { ThreeSceneErrorBoundary } from '../../three/scene/ThreeSceneErrorBoundary'
import { createPassengerDrawingContext } from '../../drawings/passenger-technical-drawings'
import { getSpatialIssueMessage, SPATIAL_STATUS_LABELS } from './spatial-validation-messages'
import { PlansWorkspace } from './PlansWorkspace'
import './ProjectWorkspace.css'

const liftTypes = getLiftTypeDefinitions()
const ThreeConfiguratorViewport = lazy(async () => {
  const module = await import(
    '../../three/scene/ThreeConfiguratorViewport'
  )

  return { default: module.ThreeConfiguratorViewport }
})

const DevelopmentMechanicalControls = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('../../dev/DevelopmentMechanicalControls')

      return { default: module.DevelopmentMechanicalControls }
    })
  : undefined

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatValue(value: number | undefined, unit?: string): string {
  if (value === undefined) {
    return 'Nicht angegeben'
  }

  return unit ? `${value} ${unit}` : String(value)
}

interface MillimetreFieldProps {
  readonly label: string
  readonly value?: Millimetres
  readonly onChange: (value?: Millimetres) => void
}

function MillimetreField({ label, value, onChange }: MillimetreFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => {
          const parsed = parseOptionalNumber(event.target.value)
          onChange(parsed === undefined ? undefined : millimetres(parsed))
        }}
      />
    </label>
  )
}

export function ProjectWorkspace() {
  const project = useProjectStore((state) => state.project)
  const validation = useProjectStore((state) => state.validation)
  const createProject = useProjectStore((state) => state.createProject)
  const setLiftFamily = useProjectStore((state) => state.setLiftFamily)
  const updateConfiguration = useProjectStore(
    (state) => state.updateConfiguration,
  )
  const resetProject = useProjectStore((state) => state.resetProject)

  const [activeTab, setActiveTab] = useState<'3d' | 'plans'>('3d')

  const geometryInput = useMemo(
    () => createLiftGeometryPlanningInput(project.configuration),
    [project.configuration],
  )
  const drawingContext = useMemo(
    () => geometryInput ? createPassengerDrawingContext(geometryInput) : undefined,
    [geometryInput],
  )
  const spatialValidation = drawingContext?.validation
  const spatialIssues = spatialValidation?.issues.filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.code === entry.code &&
      candidate.affectedLevelId === entry.affectedLevelId) === index) ?? []
  const spatialConflicts = spatialIssues.filter((issue) => issue.severity === 'error').length
  const spatialWarnings = spatialIssues.filter((issue) => issue.severity === 'warning').length
  const spatialUnknown = spatialIssues.filter((issue) => issue.severity === 'info').length
  const isPassengerLift =
    project.configuration.family === LIFT_FAMILIES.passenger
  const passengerConfiguration = isPassengerLift ? project.configuration : undefined

  const updatePassengerConfiguration = (
    update: Parameters<typeof updatePassengerPlanningConfiguration>[1],
  ) => {
    if (!isPassengerLift) {
      return
    }

    updateConfiguration(
      updatePassengerPlanningConfiguration(project.configuration, update),
    )
  }

  const updateMechanicalConfiguration = (update: Partial<PassengerMechanicalPlanningInput>) => {
    if (!isPassengerLift) return
    updatePassengerConfiguration({ mechanical: { ...project.configuration.mechanical, ...update } })
  }

  return (
    <div className="workspace" aria-label="LiftPlan-Konfiguration">
      <header className="workspace-header">
        <div className="workspace-header-title">
          <h1>LiftPlan</h1>
          <span className="eyebrow">Engineering Workspace</span>
        </div>
        <div className="workspace-header-actions">
          {DevelopmentMechanicalControls && (
            <Suspense fallback={null}>
              <DevelopmentMechanicalControls />
            </Suspense>
          )}
          <button type="button" className="primary-action" onClick={() => createProject()}>
            Neues Projekt
          </button>
        </div>
      </header>

      <div className="workspace-body">
        <aside className="workspace-panel configuration-panel" aria-labelledby="configuration-heading">
          <div className="panel-content">
            <h2 id="configuration-heading">Konfiguration</h2>

            <label className="field">
              <span>Aufzugstyp</span>
              <select
                value={project.liftFamily}
                onChange={(event) => {
                  if (isRegisteredLiftFamily(event.target.value)) {
                    setLiftFamily(event.target.value)
                  }
                }}
              >
                {liftTypes.map((liftType) => (
                  <option key={liftType.id} value={liftType.id}>
                    {liftType.displayName}
                  </option>
                ))}
              </select>
            </label>

            {isPassengerLift ? (
              <div className="field-group">
                <label className="field">
                  <span>Projektname</span>
                  <input
                    type="text"
                    value={project.configuration.projectName}
                    onChange={(event) =>
                      updatePassengerConfiguration({
                        projectName: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="field">
                  <span>Tragfähigkeit (kg)</span>
                  <input
                    type="number"
                    value={project.configuration.capacityKg ?? ''}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value)
                      updatePassengerConfiguration({
                        capacityKg: value === undefined ? undefined : kilograms(value),
                      })
                    }}
                  />
                </label>

                <label className="field">
                  <span>Personenanzahl</span>
                  <input
                    type="number"
                    step="1"
                    value={project.configuration.passengerCount ?? ''}
                    onChange={(event) =>
                      updatePassengerConfiguration({
                        passengerCount: parseOptionalNumber(event.target.value),
                      })
                    }
                  />
                </label>

                <label className="field">
                  <span>Anzahl Haltestellen</span>
                  <input
                    type="number"
                    step="1"
                    value={project.configuration.stopCount ?? ''}
                    onChange={(event) =>
                      updatePassengerConfiguration({
                        stopCount: parseOptionalNumber(event.target.value),
                      })
                    }
                  />
                </label>

                <label className="field">
                  <span>Geschwindigkeit (m/s)</span>
                  <input
                    type="number"
                    step="any"
                    value={project.configuration.ratedSpeedMetresPerSecond ?? ''}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value)
                      updatePassengerConfiguration({
                        ratedSpeedMetresPerSecond:
                          value === undefined ? undefined : metresPerSecond(value),
                      })
                    }}
                  />
                </label>

                <label className="field">
                  <span>Kabinenbreite (mm)</span>
                  <input
                    type="number"
                    value={project.configuration.cabinWidthMm ?? ''}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value)
                      updatePassengerConfiguration({
                        cabinWidthMm:
                          value === undefined ? undefined : millimetres(value),
                      })
                    }}
                  />
                </label>

                <label className="field">
                  <span>Kabinentiefe (mm)</span>
                  <input
                    type="number"
                    value={project.configuration.cabinDepthMm ?? ''}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value)
                      updatePassengerConfiguration({
                        cabinDepthMm:
                          value === undefined ? undefined : millimetres(value),
                      })
                    }}
                  />
                </label>

                <label className="field">
                  <span>Kabinenhöhe (mm)</span>
                  <input
                    type="number"
                    value={project.configuration.cabinHeightMm ?? ''}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value)
                      updatePassengerConfiguration({
                        cabinHeightMm:
                          value === undefined ? undefined : millimetres(value),
                      })
                    }}
                  />
                </label>

                <label className="field">
                  <span>Türbreite (mm)</span>
                  <input
                    type="number"
                    value={project.configuration.doorWidthMm ?? ''}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value)
                      updatePassengerConfiguration({
                        doorWidthMm:
                          value === undefined ? undefined : millimetres(value),
                      })
                    }}
                  />
                </label>

                <label className="field">
                  <span>Türhöhe (mm)</span>
                  <input
                    type="number"
                    value={project.configuration.doorHeightMm ?? ''}
                    onChange={(event) => {
                      const value = parseOptionalNumber(event.target.value)
                      updatePassengerConfiguration({
                        doorHeightMm:
                          value === undefined ? undefined : millimetres(value),
                      })
                    }}
                  />
                </label>

                <h3>Schacht und Ebenen (mm)</h3>

                <MillimetreField
                  label="Schachtbreite"
                  value={project.configuration.shaftWidthMm}
                  onChange={(shaftWidthMm) =>
                    updatePassengerConfiguration({ shaftWidthMm })
                  }
                />

                <MillimetreField
                  label="Schachttiefe"
                  value={project.configuration.shaftDepthMm}
                  onChange={(shaftDepthMm) =>
                    updatePassengerConfiguration({ shaftDepthMm })
                  }
                />

                <MillimetreField
                  label="Geschosshöhe"
                  value={project.configuration.floorHeightMm}
                  onChange={(floorHeightMm) =>
                    updatePassengerConfiguration({ floorHeightMm })
                  }
                />

                <MillimetreField
                  label="Grubentiefe"
                  value={project.configuration.pitDepthMm}
                  onChange={(pitDepthMm) =>
                    updatePassengerConfiguration({ pitDepthMm })
                  }
                />

                <MillimetreField
                  label="Schachtkopf"
                  value={project.configuration.headroomMm}
                  onChange={(headroomMm) =>
                    updatePassengerConfiguration({ headroomMm })
                  }
                />

                <label className="field">
                  <span>Durchlader</span>
                  <select
                    value={
                      project.configuration.throughCar === undefined
                        ? ''
                        : String(project.configuration.throughCar)
                    }
                    onChange={(event) =>
                      updatePassengerConfiguration({
                        throughCar:
                          event.target.value === ''
                            ? undefined
                            : event.target.value === 'true',
                      })
                    }
                  >
                    <option value="">Nicht angegeben</option>
                    <option value="true">Ja</option>
                    <option value="false">Nein</option>
                  </select>
                </label>

                <label className="field">
                  <span>Antriebskonzept</span>
                  <input
                    type="text"
                    value={project.configuration.driveConcept ?? ''}
                    onChange={(event) =>
                      updatePassengerConfiguration({
                        driveConcept: event.target.value || undefined,
                      })
                    }
                  />
                </label>

                <h3>Schematisches Gegengewicht (mm)</h3>

                <MillimetreField
                  label="Gegengewichtbreite"
                  value={project.configuration.counterweightWidthMm}
                  onChange={(counterweightWidthMm) =>
                    updatePassengerConfiguration({ counterweightWidthMm })
                  }
                />

                <MillimetreField
                  label="Gegengewichthöhe"
                  value={project.configuration.counterweightHeightMm}
                  onChange={(counterweightHeightMm) =>
                    updatePassengerConfiguration({ counterweightHeightMm })
                  }
                />

                <label className="field">
                  <span>Gegengewichtposition</span>
                  <select
                    value={project.configuration.counterweightPosition ?? ''}
                    onChange={(event) => {
                      const counterweightPosition = COUNTERWEIGHT_POSITIONS.find(
                        (position) => position === event.target.value,
                      )
                      updatePassengerConfiguration({
                        counterweightPosition,
                        mechanical: { ...passengerConfiguration?.mechanical, counterweightArrangement: counterweightPosition },
                      })
                    }}
                  >
                    <option value="">Nicht angegeben</option>
                    <option value="rear">Hinten</option>
                    <option value="left">Links</option>
                    <option value="right">Rechts</option>
                  </select>
                </label>
                <details>
                  <summary>Mechanische Anordnung (mm)</summary>
                  <p className="panel-note">Positionen relativ zur Kabinenmitte. Fehlende Werte bleiben offen.</p>
                  <label className="field">
                    <span>Ausrichtung Kabinenschienen</span>
                    <select
                      value={project.configuration.mechanical?.carRailOrientation ?? ''}
                      onChange={(event) => updateMechanicalConfiguration({ carRailOrientation: RAIL_ORIENTATIONS.find((orientation) => orientation === event.target.value) })}
                    >
                      <option value="">Nicht angegeben</option>
                      <option value="x">Links / rechts</option>
                      <option value="z">Vorn / hinten</option>
                    </select>
                  </label>
                  <MillimetreField label="Kabinenschienenabstand" value={project.configuration.mechanical?.carRailSpacingMm} onChange={(carRailSpacingMm) => updateMechanicalConfiguration({ carRailSpacingMm })} />
                  <MillimetreField label="Gegengewichttiefe" value={project.configuration.counterweightDepthMm} onChange={(counterweightDepthMm) => updatePassengerConfiguration({ counterweightDepthMm })} />
                  <MillimetreField label="GG-Schienenabstand" value={project.configuration.mechanical?.counterweightRailSpacingMm} onChange={(counterweightRailSpacingMm) => updateMechanicalConfiguration({ counterweightRailSpacingMm })} />
                  {(['xMm', 'yMm', 'zMm'] as const).map((axis, index) => (
                    <MillimetreField
                      key={axis}
                      label={`GG-Versatz ${['X', 'Y', 'Z'][index]}`}
                      value={passengerConfiguration?.mechanical?.counterweightOffsetMm?.[axis]}
                      onChange={(value) => updateMechanicalConfiguration({ counterweightOffsetMm: { ...passengerConfiguration?.mechanical?.counterweightOffsetMm, [axis]: value } })}
                    />
                  ))}
                </details>
              </div>
            ) : (
              <p className="coming-soon-message">
                Dieser Aufzugstyp wird in einer kommenden Ausbaustufe unterstützt.
              </p>
            )}
          </div>
        </aside>

        <main className="central-workspace">
          <div className="central-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className="central-tab"
              aria-pressed={activeTab === '3d'}
              onClick={() => setActiveTab('3d')}
            >
              3D-Modell
            </button>
            <button
              type="button"
              role="tab"
              className="central-tab"
              aria-pressed={activeTab === 'plans'}
              onClick={() => setActiveTab('plans')}
            >
              Pläne
            </button>
          </div>
          <div className="central-content" style={{ display: activeTab === '3d' ? 'flex' : 'none' }}>
            <ThreeSceneErrorBoundary>
              <Suspense
                fallback={
                  <div className="viewport-fallback">3D-Ansicht wird geladen.</div>
                }
              >
                <ThreeConfiguratorViewport geometryInput={geometryInput} />
              </Suspense>
            </ThreeSceneErrorBoundary>
          </div>
          <div className="central-content" style={{ display: activeTab === 'plans' ? 'flex' : 'none' }}>
             <PlansWorkspace context={drawingContext} project={project} />
          </div>
        </main>

        <aside className="workspace-panel data-panel" aria-labelledby="data-heading">
          <div className="panel-content">
            <h2 id="data-heading">Technische Daten</h2>
            <section className="planning-status" aria-labelledby="planning-status-heading">
              <h3 id="planning-status-heading">Planungsstatus</h3>
              <p className={spatialConflicts > 0 ? 'planning-status-conflict' : ''}>
                {SPATIAL_STATUS_LABELS[spatialValidation?.status ?? 'unknown']}
              </p>
              <p>
                {spatialConflicts} {spatialConflicts === 1 ? 'Konflikt' : 'Konflikte'} ·{' '}
                {spatialWarnings} {spatialWarnings === 1 ? 'Hinweis' : 'Hinweise'}
                {spatialUnknown > 0 ? ` · ${spatialUnknown} noch nicht bewertet` : ''}
              </p>
              {spatialIssues.length > 0 && <details>
                <summary>Prüfhinweise</summary>
                <ul>
                  {spatialIssues.map((issue, index) => <li key={`${issue.code}-${issue.affectedLevelId ?? index}`}>
                    {getSpatialIssueMessage(issue)}
                  </li>)}
                </ul>
              </details>}
              <p className="panel-note">Geometrische Planungsprüfung, keine technische oder normative Freigabe.</p>
            </section>
            
            <dl className="data-list">
              <div>
                <dt>Projekt</dt>
                <dd>{project.name || 'Nicht angegeben'}</dd>
              </div>
              <div>
                <dt>Aufzugstyp</dt>
                <dd>
                  {
                    liftTypes.find((liftType) => liftType.id === project.liftFamily)
                      ?.displayName
                  }
                </dd>
              </div>
              {isPassengerLift && (
                <>
                  <div>
                    <dt>Tragfähigkeit</dt>
                    <dd>{formatValue(project.configuration.capacityKg, 'kg')}</dd>
                  </div>
                  <div>
                    <dt>Personenanzahl</dt>
                    <dd>{formatValue(project.configuration.passengerCount)}</dd>
                  </div>
                  <div>
                    <dt>Haltestellen</dt>
                    <dd>{formatValue(project.configuration.stopCount)}</dd>
                  </div>
                  <div>
                    <dt>Nenngeschwindigkeit</dt>
                    <dd>
                      {formatValue(
                        project.configuration.ratedSpeedMetresPerSecond,
                        'm/s',
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Kabine (B/T/H)</dt>
                    <dd>
                      {formatValue(project.configuration.cabinWidthMm)}×
                      {formatValue(project.configuration.cabinDepthMm)}×
                      {formatValue(project.configuration.cabinHeightMm)} mm
                    </dd>
                  </div>
                  <div>
                    <dt>Tür (B/H)</dt>
                    <dd>
                      {formatValue(project.configuration.doorWidthMm)}×
                      {formatValue(project.configuration.doorHeightMm)} mm
                    </dd>
                  </div>
                  <div>
                    <dt>Schacht (B/T)</dt>
                    <dd>
                      {formatValue(project.configuration.shaftWidthMm)}×
                      {formatValue(project.configuration.shaftDepthMm)} mm
                    </dd>
                  </div>
                  <div>
                    <dt>Geschosshöhe</dt>
                    <dd>{formatValue(project.configuration.floorHeightMm, 'mm')}</dd>
                  </div>
                  <div>
                    <dt>Grube / Kopf</dt>
                    <dd>
                      {formatValue(project.configuration.pitDepthMm)} /{' '}
                      {formatValue(project.configuration.headroomMm)} mm
                    </dd>
                  </div>
                  <div>
                    <dt>Durchlader</dt>
                    <dd>
                      {project.configuration.throughCar === undefined
                        ? 'Nicht angegeben'
                        : project.configuration.throughCar
                          ? 'Ja'
                          : 'Nein'}
                    </dd>
                  </div>
                  <div>
                    <dt>Antriebskonzept</dt>
                    <dd>{project.configuration.driveConcept || 'Nicht angegeben'}</dd>
                  </div>
                </>
              )}
            </dl>

            <h3>Projektinformationen</h3>
            <dl className="data-list">
              <div>
                <dt>Projektkennung</dt>
                <dd>{project.id}</dd>
              </div>
              <div>
                <dt>Versionskennung</dt>
                <dd>{project.schemaVersion}</dd>
              </div>
              <div>
                <dt>Strukturprüfung</dt>
                <dd>
                  {validation.status === 'valid'
                    ? 'Struktur geprüft'
                    : 'Eingabe prüfen'}
                </dd>
              </div>
            </dl>
            <button type="button" className="secondary-button" onClick={resetProject}>
              Projekt zurücksetzen
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
