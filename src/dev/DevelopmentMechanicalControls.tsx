import { useProjectStore } from '../projects'
import {
  loadDevelopmentMechanicalFixture,
  resetDevelopmentMechanicalFixture,
} from './development-mechanical-session'

/** Development-only controls, loaded from the workspace behind import.meta.env.DEV. */
export function DevelopmentMechanicalControls() {
  const updateConfiguration = useProjectStore(
    (state) => state.updateConfiguration,
  )
  const createProject = useProjectStore((state) => state.createProject)

  return (
    <div className="development-mechanical-controls">
      <span>Entwicklungsdaten</span>
      <button
        type="button"
        onClick={() =>
          loadDevelopmentMechanicalFixture({ updateConfiguration, createProject })
        }
      >
        Demo-Mechanik laden
      </button>
      <button
        type="button"
        onClick={() =>
          resetDevelopmentMechanicalFixture({ updateConfiguration, createProject })
        }
      >
        Demo zurücksetzen
      </button>
      <a href="/dev/mechanical">Fahrdemo öffnen</a>
    </div>
  )
}
