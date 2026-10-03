import type { LiftGeometryPlanningInput } from '../geometry/lift-geometry-planning-input'

export interface ThreeConfiguratorViewportProps {
  readonly geometryInput?: LiftGeometryPlanningInput
}

export function ThreeConfiguratorViewport({
  geometryInput,
}: ThreeConfiguratorViewportProps) {
  return (
    <section className="workspace-panel viewport-panel" aria-labelledby="viewport-heading">
      <h2 id="viewport-heading">3D-Ansicht</h2>
      <div className="viewport-placeholder">
        {geometryInput ? (
          <p>3D-Planungsdaten sind mit der Konfiguration verbunden.</p>
        ) : (
          <p>
            Für diesen Aufzugstyp stehen noch keine 3D-Planungsdaten bereit.
          </p>
        )}
      </div>
      <p className="panel-note">
        Die detaillierte 3D-Konfiguration wird in einer späteren Ausbaustufe
        ergänzt.
      </p>
    </section>
  )
}
