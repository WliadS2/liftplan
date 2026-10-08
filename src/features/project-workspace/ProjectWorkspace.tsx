import { lazy, Suspense, useMemo, useState } from 'react'
import {
  COUNTERWEIGHT_POSITIONS,
  RAIL_ORIENTATIONS,
  LIFT_FAMILIES,
  getLiftTypeDefinitions,
  isRegisteredLiftFamily,
  updatePassengerPlanningConfiguration,
  type CarLiftPlanningConfiguration,
  type GoodsLiftPlanningConfiguration,
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
import { createGoodsLiftDrawingContext } from '../../drawings/goods-lift-technical-drawings'
import { createCarLiftDrawingContext } from '../../drawings/car-lift-technical-drawings'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import { getLiftSpatialIssueMessage, SPATIAL_STATUS_LABELS } from './spatial-validation-messages'
import { CarLiftConfigurationForm, GoodsLiftConfigurationForm } from './FamilyConfigurationForms'
import { PlansWorkspace } from './PlansWorkspace'
import { ProjectPersistenceControls } from './ProjectPersistenceControls'
import './ProjectWorkspace.css'

const liftTypes = getLiftTypeDefinitions()
const LiftFamilyViewport = lazy(async () => {
  const module = await import(
    '../../three/scene/LiftFamilyViewport'
  )

  return { default: module.LiftFamilyViewport }
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
  const text = label.replace(/\s*\(mm\)$/, '')
  return (
    <label className="field">
      <span>{text}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => {
          const parsed = parseOptionalNumber(event.target.value)
          onChange(parsed === undefined ? undefined : millimetres(parsed))
        }}
      />
      <span className="unit-label">mm</span>
    </label>
  )
}

export function ProjectWorkspace() {
  const project = useProjectStore((state) => state.project)
  const configurationDraft = useProjectStore((state) => state.configurationDraft)
  const validation = useProjectStore((state) => state.validation)
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
  const drawingContext = useMemo(() => {
    if (project.configuration.family === LIFT_FAMILIES.passenger) {
      return geometryInput ? createPassengerDrawingContext(geometryInput) : undefined
    }
    if (project.configuration.family === LIFT_FAMILIES.goods) {
      return createGoodsLiftDrawingContext(project.configuration)
    }
    if (project.configuration.family === LIFT_FAMILIES.car) {
      return createCarLiftDrawingContext(project.configuration)
    }
    return undefined
  }, [geometryInput, project.configuration])
  const technicalFamilyModel = useMemo(
    () => createLiftFamilyTechnicalModel(project.configuration),
    [project.configuration],
  )
  const spatialValidation = drawingContext?.validation
  const spatialIssues = spatialValidation?.issues.filter((entry, index, all) => {
    const affectedLevelId = 'affectedLevelId' in entry ? entry.affectedLevelId : undefined
    return all.findIndex((candidate) => candidate.code === entry.code &&
      ('affectedLevelId' in candidate ? candidate.affectedLevelId : undefined) === affectedLevelId) === index
  }) ?? []
  const spatialConflicts = spatialIssues.filter((issue) => issue.severity === 'error').length
  const spatialWarnings = spatialIssues.filter((issue) => issue.severity === 'warning').length
  const spatialUnknown = spatialIssues.filter((issue) => issue.severity === 'info').length
  const isPassengerLift =
    project.configuration.family === LIFT_FAMILIES.passenger
  const isGoodsLift = project.configuration.family === LIFT_FAMILIES.goods
  const isCarLift = project.configuration.family === LIFT_FAMILIES.car
  const passengerConfiguration = isPassengerLift ? project.configuration : undefined
  const validGoodsConfiguration = isGoodsLift ? project.configuration : undefined
  const validCarConfiguration = isCarLift ? project.configuration : undefined
  const goodsConfiguration = isGoodsLift && configurationDraft && typeof configurationDraft === 'object' &&
    'family' in configurationDraft && configurationDraft.family === LIFT_FAMILIES.goods
    ? configurationDraft as GoodsLiftPlanningConfiguration
    : isGoodsLift ? project.configuration : undefined
  const carConfiguration = isCarLift && configurationDraft && typeof configurationDraft === 'object' &&
    'family' in configurationDraft && configurationDraft.family === LIFT_FAMILIES.car
    ? configurationDraft as CarLiftPlanningConfiguration
    : isCarLift ? project.configuration : undefined

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
        </div>
      </header>
      <ProjectPersistenceControls />

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
            ) : goodsConfiguration ? (
              <GoodsLiftConfigurationForm
                configuration={goodsConfiguration}
                onChange={updateConfiguration}
              />
            ) : carConfiguration ? (
              <CarLiftConfigurationForm
                configuration={carConfiguration}
                onChange={updateConfiguration}
              />
            ) : (
              <p className="coming-soon-message">
                Dieser Aufzugstyp wird in einer kommenden Ausbaustufe unterstützt.
              </p>
            )}
          </div>
        </aside>

        <main className="central-workspace">
          <div className="central-tabs-header">
            <div className="central-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className="central-tab"
                aria-selected={activeTab === '3d'}
                onClick={() => setActiveTab('3d')}
              >
                3D-Modell
              </button>
              <button
                type="button"
                role="tab"
                className="central-tab"
                aria-selected={activeTab === 'plans'}
                onClick={() => setActiveTab('plans')}
              >
                Pläne
              </button>
            </div>
          </div>
          <div className="central-content" style={{ display: activeTab === '3d' ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <ThreeSceneErrorBoundary>
              <Suspense fallback={<div className="viewport-fallback">3D-Ansicht wird geladen.</div>}>
                <LiftFamilyViewport technicalModel={technicalFamilyModel} />
              </Suspense>
            </ThreeSceneErrorBoundary>
          </div>
          <div className="central-content" style={{ display: activeTab === 'plans' ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0 }}>
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
                  {spatialIssues.map((issue, index) => {
                    const affectedLevelId = 'affectedLevelId' in issue ? issue.affectedLevelId : undefined
                    const family = isGoodsLift ? 'goods' : isCarLift ? 'car' : 'passenger'
                    return <li key={`${issue.code}-${affectedLevelId ?? index}`}>
                      {getLiftSpatialIssueMessage(family, issue)}
                    </li>
                  })}
                </ul>
              </details>}
              <p className="panel-note">Geometrische Planungsprüfung, keine technische oder normative Freigabe.</p>
            </section>
            
            <div className="data-list">
              <div className="data-row">
                <span className="data-label">Projekt</span>
                <span className="data-value">{project.name || 'Nicht angegeben'}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Aufzugstyp</span>
                <span className="data-value">
                  {
                    liftTypes.find((liftType) => liftType.id === project.liftFamily)
                      ?.displayName
                  }
                </span>
              </div>
              {isPassengerLift && (
                <>
                  <div className="data-row">
                    <span className="data-label">Tragfähigkeit</span>
                    <span className="data-value">{formatValue(project.configuration.capacityKg, 'kg')}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Personenanzahl</span>
                    <span className="data-value">{formatValue(project.configuration.passengerCount)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Haltestellen</span>
                    <span className="data-value">{formatValue(project.configuration.stopCount)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Nenngeschwindigkeit</span>
                    <span className="data-value">
                      {formatValue(
                        project.configuration.ratedSpeedMetresPerSecond,
                        'm/s',
                      )}
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Kabine (B/T/H)</span>
                    <span className="data-value">
                      {formatValue(project.configuration.cabinWidthMm)}×
                      {formatValue(project.configuration.cabinDepthMm)}×
                      {formatValue(project.configuration.cabinHeightMm)} mm
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Tür (B/H)</span>
                    <span className="data-value">
                      {formatValue(project.configuration.doorWidthMm)}×
                      {formatValue(project.configuration.doorHeightMm)} mm
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Schacht (B/T)</span>
                    <span className="data-value">
                      {formatValue(project.configuration.shaftWidthMm)}×
                      {formatValue(project.configuration.shaftDepthMm)} mm
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Geschosshöhe</span>
                    <span className="data-value">{formatValue(project.configuration.floorHeightMm, 'mm')}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Grube / Kopf</span>
                    <span className="data-value">
                      {formatValue(project.configuration.pitDepthMm)} /{' '}
                      {formatValue(project.configuration.headroomMm)} mm
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Durchlader</span>
                    <span className="data-value">
                      {project.configuration.throughCar === undefined
                        ? 'Nicht angegeben'
                        : project.configuration.throughCar
                          ? 'Ja'
                          : 'Nein'}
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Antriebskonzept</span>
                    <span className="data-value">{project.configuration.driveConcept || 'Nicht angegeben'}</span>
                  </div>
                </>
              )}
              {validGoodsConfiguration && (
                <>
                  <div className="data-row"><span className="data-label">Tragfähigkeit</span><span className="data-value">{formatValue(validGoodsConfiguration.ratedLoadKg, 'kg')}</span></div>
                  <div className="data-row"><span className="data-label">Haltestellen</span><span className="data-value">{formatValue(validGoodsConfiguration.stopCount)}</span></div>
                  <div className="data-row"><span className="data-label">Nenngeschwindigkeit</span><span className="data-value">{formatValue(validGoodsConfiguration.nominalSpeedMetresPerSecond, 'm/s')}</span></div>
                  <div className="data-row"><span className="data-label">Plattform (B/T/H)</span><span className="data-value">
                    {formatValue(validGoodsConfiguration.platformWidthMm)}×
                    {formatValue(validGoodsConfiguration.platformDepthMm)}×
                    {formatValue(validGoodsConfiguration.platformHeightMm)} mm
                  </span></div>
                  <div className="data-row"><span className="data-label">Tür (B/H)</span><span className="data-value">
                    {formatValue(validGoodsConfiguration.doorWidthMm)}×
                    {formatValue(validGoodsConfiguration.doorHeightMm)} mm
                  </span></div>
                  <div className="data-row"><span className="data-label">Schacht (B/T)</span><span className="data-value">
                    {formatValue(validGoodsConfiguration.shaftWidthMm)}×
                    {formatValue(validGoodsConfiguration.shaftDepthMm)} mm
                  </span></div>
                  <div className="data-row"><span className="data-label">Durchlader</span><span className="data-value">{validGoodsConfiguration.throughCar === undefined
                    ? 'Nicht angegeben' : validGoodsConfiguration.throughCar ? 'Ja' : 'Nein'}</span></div>
                </>
              )}
              {validCarConfiguration && (
                <>
                  <div className="data-row"><span className="data-label">Tragfähigkeit</span><span className="data-value">{formatValue(validCarConfiguration.ratedLoadKg, 'kg')}</span></div>
                  <div className="data-row"><span className="data-label">Haltestellen</span><span className="data-value">{formatValue(validCarConfiguration.stopCount)}</span></div>
                  <div className="data-row"><span className="data-label">Nenngeschwindigkeit</span><span className="data-value">{formatValue(validCarConfiguration.nominalSpeedMetresPerSecond, 'm/s')}</span></div>
                  <div className="data-row"><span className="data-label">Plattform (B/T/H)</span><span className="data-value">
                    {formatValue(validCarConfiguration.platformWidthMm)}×
                    {formatValue(validCarConfiguration.platformDepthMm)}×
                    {formatValue(validCarConfiguration.usableHeightMm)} mm
                  </span></div>
                  <div className="data-row"><span className="data-label">Tür (B/H)</span><span className="data-value">
                    {formatValue(validCarConfiguration.doorClearWidthMm)}×
                    {formatValue(validCarConfiguration.doorClearHeightMm)} mm
                  </span></div>
                  <div className="data-row"><span className="data-label">Fahrzeug (B/L/H)</span><span className="data-value">
                    {formatValue(validCarConfiguration.vehicle?.widthMm)}×
                    {formatValue(validCarConfiguration.vehicle?.lengthMm)}×
                    {formatValue(validCarConfiguration.vehicle?.heightMm)} mm
                  </span></div>
                  <div className="data-row"><span className="data-label">Fahrzeugmasse</span><span className="data-value">{formatValue(validCarConfiguration.vehicle?.massKg, 'kg')}</span></div>
                  <div className="data-row"><span className="data-label">Fahrzeugversatz (L/Q)</span><span className="data-value">
                    {formatValue(validCarConfiguration.vehiclePosition?.longitudinalOffsetMm)} /{' '}
                    {formatValue(validCarConfiguration.vehiclePosition?.lateralOffsetMm)} mm
                  </span></div>
                  <div className="data-row"><span className="data-label">Durchlader</span><span className="data-value">{validCarConfiguration.throughCar === undefined
                    ? 'Nicht angegeben' : validCarConfiguration.throughCar ? 'Ja' : 'Nein'}</span></div>
                </>
              )}
            </div>

            <h3>Projektinformationen</h3>
            <div className="data-list">
              <div className="data-row">
                <span className="data-label">Projektkennung</span>
                <span className="data-value">{project.id}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Versionskennung</span>
                <span className="data-value">{project.schemaVersion}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Projektversion</span>
                <span className="data-value">{project.projectVersion === 0 ? 'Noch keine Version gespeichert' : `Version ${project.projectVersion}`}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Strukturprüfung</span>
                <span className="data-value">
                  {validation.status === 'valid'
                    ? 'Struktur geprüft'
                    : 'Eingabe prüfen'}
                </span>
              </div>
            </div>
            <button type="button" className="btn-danger" onClick={resetProject}>
              Projekt zurücksetzen
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
