import { useMemo, useState } from 'react'
import { COUNTERWEIGHT_POSITIONS, type CounterweightPosition } from '../elevator'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import { ThreeConfiguratorViewport } from '../three/scene/ThreeConfiguratorViewport'
import { createPassengerSimulationFixture, PASSENGER_SIMULATION_DEMO_DATA } from './fixtures/passenger-simulation-demo'
import '../features/project-workspace/ProjectWorkspace.css'

const labels = { rear: 'Hinten', left: 'Links', right: 'Rechts' } as const

export default function MechanicalPreview() {
  const [arrangement, setArrangement] = useState<CounterweightPosition>('rear')
  const [throughCar, setThroughCar] = useState(false)
  const [stopCount, setStopCount] = useState(2)
  const input = useMemo(() => createLiftGeometryPlanningInput(createPassengerSimulationFixture(arrangement, throughCar, stopCount)), [arrangement, throughCar, stopCount])
  return (
    <main className="workspace" style={{ maxWidth: 1000 }}>
      <h1>Mechanische Demo</h1>
      <p>Entwicklungsansicht mit Testdaten. Die Werte sind keine Vorgaben für ein neues Projekt.</p>
      <label className="field">
        <span>Gegengewichtposition</span>
        <select value={arrangement} onChange={(event) => setArrangement(event.target.value as CounterweightPosition)}>
          {COUNTERWEIGHT_POSITIONS.map((position) => <option key={position} value={position}>{labels[position]}</option>)}
        </select>
      </label>
      <label><input type="checkbox" checked={throughCar} onChange={(event) => setThroughCar(event.target.checked)} /> Durchlader (Entwicklungsdaten)</label>
      <label className="field"><span>Haltestellen (Entwicklungsdaten)</span><select value={stopCount} onChange={(event) => setStopCount(Number(event.target.value))}>
        {[2, 6, 10].map((count) => <option key={count} value={count}>{count}</option>)}
      </select></label>
      <ThreeConfiguratorViewport geometryInput={input} visualizationData={PASSENGER_SIMULATION_DEMO_DATA} initialViewMode="mechanical" />
    </main>
  )
}
