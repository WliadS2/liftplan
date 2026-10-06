import { useProjectStore } from '../projects'
import {
  loadDevelopmentMechanicalFixture,
  resetDevelopmentMechanicalFixture,
  loadDevelopmentGoodsFixture,
} from './development-mechanical-session'

/** Development-only controls, loaded from the workspace behind import.meta.env.DEV. */
export function DevelopmentMechanicalControls() {
  const family = useProjectStore((state) => state.project.liftFamily)
  const updateConfiguration = useProjectStore(
    (state) => state.updateConfiguration,
  )
  const createProject = useProjectStore((state) => state.createProject)
  const loadDevelopmentConfiguration = useProjectStore(
    (state) => state.loadDevelopmentConfiguration,
  )

  return (
    <div className="development-mechanical-controls">
      <span>Entwicklungsdaten</span>
      <button
        type="button"
        onClick={() =>
          family === 'goods' ? loadDevelopmentGoodsFixture({ loadDevelopmentConfiguration }) : loadDevelopmentMechanicalFixture({
            updateConfiguration,
            createProject,
            loadDevelopmentConfiguration,
          })
        }
      >
        {family === 'goods' ? 'Warenaufzug-Demo laden' : 'Demo-Mechanik laden'}
      </button>
      <button
        type="button"
        onClick={() =>
          resetDevelopmentMechanicalFixture({ updateConfiguration, createProject })
        }
      >
        Demo zurücksetzen
      </button>
      {family === 'passenger' && <a href="/dev/mechanical">Fahrdemo öffnen</a>}
    </div>
  )
}
