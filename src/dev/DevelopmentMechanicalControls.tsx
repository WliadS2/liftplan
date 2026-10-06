import { useProjectStore } from '../projects'
import {
  hasDevelopmentFixture,
  loadDevelopmentFamilyFixture,
} from './development-mechanical-session'

/** Development-only controls, loaded from the workspace behind import.meta.env.DEV. */
export function DevelopmentMechanicalControls() {
  const family = useProjectStore((state) => state.project.liftFamily)
  const createProject = useProjectStore((state) => state.createProject)
  const loadDevelopmentConfiguration = useProjectStore(
    (state) => state.loadDevelopmentConfiguration,
  )

  return (
    <div className="development-mechanical-controls">
      <span>Entwicklungsdaten</span>
      <button
        type="button"
        disabled={!hasDevelopmentFixture(family)}
        title={!hasDevelopmentFixture(family) ? 'Für diesen Aufzugstyp sind noch keine Entwicklungsdaten verfügbar.' : undefined}
        onClick={() => loadDevelopmentFamilyFixture(family, { loadDevelopmentConfiguration })}
      >
        Demo laden
      </button>
      <button
        type="button"
        onClick={() => createProject({ liftFamily: family })}
      >
        Demo zurücksetzen
      </button>
      {family === 'passenger' && <a href="/dev/mechanical">Fahrdemo öffnen</a>}
    </div>
  )
}
