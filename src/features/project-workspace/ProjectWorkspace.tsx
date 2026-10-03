import {
  LIFT_FAMILIES,
  getLiftTypeDefinitions,
  isRegisteredLiftFamily,
  updatePassengerPlanningConfiguration,
} from '../../elevator'
import {
  kilograms,
  metresPerSecond,
  millimetres,
} from '../../engineering'
import { useProjectStore } from '../../projects'
import {
  ThreeConfiguratorViewport,
  createLiftGeometryPlanningInput,
} from '../../three'
import './ProjectWorkspace.css'

const liftTypes = getLiftTypeDefinitions()

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

export function ProjectWorkspace() {
  const project = useProjectStore((state) => state.project)
  const validation = useProjectStore((state) => state.validation)
  const createProject = useProjectStore((state) => state.createProject)
  const setLiftFamily = useProjectStore((state) => state.setLiftFamily)
  const updateConfiguration = useProjectStore(
    (state) => state.updateConfiguration,
  )
  const resetProject = useProjectStore((state) => state.resetProject)

  const geometryInput = createLiftGeometryPlanningInput(project.configuration)
  const isPassengerLift =
    project.configuration.family === LIFT_FAMILIES.passenger

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

  return (
    <main className="workspace" aria-label="LiftPlan-Konfiguration">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Professionelle Aufzugsplanung</p>
          <h1>LiftPlan</h1>
        </div>
        <button type="button" onClick={() => createProject()}>
          Neues Projekt
        </button>
      </header>

      <div className="workspace-grid">
        <aside className="workspace-panel configuration-panel" aria-labelledby="configuration-heading">
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
                <span>Nenngeschwindigkeit (m/s)</span>
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
            </div>
          ) : (
            <p className="coming-soon-message">
              Dieser Aufzugstyp wird in einer kommenden Ausbaustufe unterstützt.
            </p>
          )}
        </aside>

        <ThreeConfiguratorViewport geometryInput={geometryInput} />

        <aside className="workspace-panel data-panel" aria-labelledby="data-heading">
          <h2 id="data-heading">Technische Daten</h2>
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
                  <dt>Kabine</dt>
                  <dd>
                    {formatValue(project.configuration.cabinWidthMm, 'mm')} ×{' '}
                    {formatValue(project.configuration.cabinDepthMm, 'mm')} ×{' '}
                    {formatValue(project.configuration.cabinHeightMm, 'mm')}
                  </dd>
                </div>
                <div>
                  <dt>Tür</dt>
                  <dd>
                    {formatValue(project.configuration.doorWidthMm, 'mm')} ×{' '}
                    {formatValue(project.configuration.doorHeightMm, 'mm')}
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

          <h2>Projektinformationen</h2>
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
        </aside>
      </div>
    </main>
  )
}
