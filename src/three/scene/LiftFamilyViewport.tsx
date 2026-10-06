import type { LiftFamilyTechnicalModel } from '../../lift-families'
import type { PassengerVisualizationData } from '../../simulation/passenger-simulation-model'
import { GoodsLiftViewport } from './GoodsLiftViewport'
import { CarLiftViewport } from './CarLiftViewport'
import { ThreeConfiguratorViewport } from './ThreeConfiguratorViewport'

export interface LiftFamilyViewportProps {
  readonly technicalModel: LiftFamilyTechnicalModel
  readonly visualizationData?: PassengerVisualizationData
}

function FamilyViewportFallback({ message }: { readonly message: string }) {
  return <section className="workspace-panel viewport-panel" aria-labelledby="family-viewport-heading">
    <div className="viewport-heading-row"><h2 id="family-viewport-heading">3D-Ansicht</h2></div>
    <div className="viewport-fallback" role="status">{message}</div>
    <p className="panel-note">Planungsvisualisierung ohne Nachweis technischer oder normativer Konformität.</p>
  </section>
}

/** Family dispatcher. Family renderers own their controls, scene composition, and camera policy. */
export function LiftFamilyViewport({ technicalModel, visualizationData }: LiftFamilyViewportProps) {
  if (technicalModel.status === 'unavailable') {
    return <FamilyViewportFallback message="3D-Darstellung für diesen Aufzugstyp noch nicht verfügbar." />
  }
  if (technicalModel.family === 'passenger') {
    return <ThreeConfiguratorViewport geometryInput={technicalModel.planning} visualizationData={visualizationData} />
  }
  if (technicalModel.family === 'goods') {
    return <GoodsLiftViewport normalized={technicalModel.normalized} sceneModel={technicalModel.scene}
      validation={technicalModel.validation} />
  }
  return <CarLiftViewport normalized={technicalModel.normalized} sceneModel={technicalModel.scene}
    validation={technicalModel.validation} />
}
