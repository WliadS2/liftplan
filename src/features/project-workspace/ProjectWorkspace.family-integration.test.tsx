// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoadedProjectState, createStoredProject, useProjectStore } from '../../projects'
import { ProjectWorkspace } from './ProjectWorkspace'

vi.mock('./ProjectPersistenceControls', () => ({ ProjectPersistenceControls: () => null }))
vi.mock('../../three/scene/LiftFamilyViewport', () => ({
  LiftFamilyViewport: ({ technicalModel }: { technicalModel: {
    readonly status: string
    readonly family: string
    readonly normalized?: { readonly status: string }
  } }) => {
    if (technicalModel.family === 'passenger') return <div>Personenaufzug 3D</div>
    if (technicalModel.family === 'goods') return <div>Warenaufzug 3D</div>
    if (technicalModel.family === 'car' && technicalModel.normalized?.status === 'empty') {
      return <div>Planungsdaten eingeben, um die 3D-Ansicht zu starten.</div>
    }
    return <div>3D-Darstellung für diesen Aufzugstyp noch nicht verfügbar.</div>
  },
}))

beforeEach(() => {
  useProjectStore.getState().createProject({
    projectId: 'ui-family-test',
    projectName: 'UI-Familientest',
    liftFamily: 'passenger',
    createdAt: '2026-10-05T12:00:00.000Z',
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function selectFamily(family: 'goods' | 'car') {
  fireEvent.change(screen.getByLabelText('Aufzugstyp'), { target: { value: family } })
}

describe('family-specific project workspace forms', () => {
  it('preserves the existing passenger form path', () => {
    render(<ProjectWorkspace />)
    expect(screen.getByLabelText('Personenanzahl')).toBeInTheDocument()
    expect(screen.queryByText('Dieser Aufzugstyp wird in einer kommenden Ausbaustufe unterstützt.')).not.toBeInTheDocument()
  })

  it('shows and updates the Waren-/Lastenaufzug form including loads and through-car access', () => {
    const { container } = render(<ProjectWorkspace />)
    selectFamily('goods')

    expect(container.querySelector('[data-lift-family-form="goods"]')).not.toBeNull()
    expect(screen.getByLabelText('Plattformbreite (mm)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Plattformbreite (mm)'), { target: { value: '1800' } })
    fireEvent.change(screen.getByLabelText('Palette Breite (mm)'), { target: { value: '1200' } })
    fireEvent.change(screen.getByLabelText('Rollcontainer Tiefe (mm)'), { target: { value: '900' } })
    fireEvent.change(screen.getByLabelText('Durchlader'), { target: { value: 'true' } })

    expect(useProjectStore.getState().project.configuration).toMatchObject({
      family: 'goods', stopCount: 2, platformWidthMm: 1800, throughCar: true,
      pallet: { widthMm: 1200 }, rollContainer: { depthMm: 900 },
    })
  })

  it('keeps an invalid Waren-/Lastenaufzug draft visible and restores saved family values', () => {
    render(<ProjectWorkspace />)
    selectFamily('goods')
    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Plattformbreite (mm)'), { target: { value: '1800' } })
    const stored = createStoredProject(useProjectStore.getState().project, useProjectStore.getState().configurationDraft)

    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen'), { target: { value: '2.5' } })
    expect(screen.getByLabelText('Anzahl Haltestellen')).toHaveValue(2.5)
    expect(useProjectStore.getState().validation.status).toBe('invalid')
    expect(useProjectStore.getState().configurationDraft).toMatchObject({ stopCount: 2.5 })
    expect(useProjectStore.getState().project.configuration).toMatchObject({ stopCount: 2 })

    const loaded = createLoadedProjectState(stored)
    act(() => useProjectStore.getState().loadProject(loaded.project, loaded.configurationDraft))
    expect(screen.getByLabelText('Plattformbreite (mm)')).toHaveValue(1800)
    expect(screen.getByLabelText('Anzahl Haltestellen')).toHaveValue(2)
  })

  it('shows and updates all core Autoaufzug vehicle inputs and uses the centering helper', () => {
    const { container } = render(<ProjectWorkspace />)
    selectFamily('car')

    expect(container.querySelector('[data-lift-family-form="car"]')).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Fahrzeugbreite (mm)'), { target: { value: '1900' } })
    fireEvent.change(screen.getByLabelText('Fahrzeuglänge (mm)'), { target: { value: '4700' } })
    fireEvent.change(screen.getByLabelText('Fahrzeughöhe (mm)'), { target: { value: '1900' } })
    fireEvent.change(screen.getByLabelText('Fahrzeugmasse (kg)'), { target: { value: '2100' } })
    fireEvent.change(screen.getByLabelText('Radstand (mm)'), { target: { value: '3100' } })
    fireEvent.change(screen.getByLabelText('Spurbreite (mm)'), { target: { value: '1600' } })
    fireEvent.change(screen.getByLabelText('Überhang vorne (mm)'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Überhang hinten (mm)'), { target: { value: '750' } })
    fireEvent.change(screen.getAllByLabelText('Längsversatz (mm)')[0], { target: { value: '120' } })
    fireEvent.change(screen.getAllByLabelText('Querversatz (mm)')[0], { target: { value: '-40' } })
    fireEvent.change(screen.getAllByLabelText('Ausrichtung (°)')[0], { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Durchlader'), { target: { value: 'true' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fahrzeug zentrieren' }))

    expect(useProjectStore.getState().project.configuration).toMatchObject({
      family: 'car', throughCar: true,
      vehicle: {
        widthMm: 1900, lengthMm: 4700, heightMm: 1900, massKg: 2100,
        wheelbaseMm: 3100, trackWidthMm: 1600, frontOverhangMm: 850, rearOverhangMm: 750,
      },
      vehiclePosition: { longitudinalOffsetMm: 0, lateralOffsetMm: 0, headingDegrees: 15 },
    })
  })

  it('distinguishes missing family planning data from an unavailable detailed 3D renderer', () => {
    render(<ProjectWorkspace />)
    selectFamily('car')
    expect(screen.getByText('Planungsdaten eingeben, um die 3D-Ansicht zu starten.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Plattformbreite (mm)'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Plattformtiefe (mm)'), { target: { value: '5500' } })
    fireEvent.change(screen.getByLabelText('Nutzbare Höhe (mm)'), { target: { value: '2400' } })
    expect(screen.getByText('3D-Darstellung für diesen Aufzugstyp noch nicht verfügbar.')).toBeInTheDocument()
  })

  it('shows family-specific geometric validation output in German', () => {
    render(<ProjectWorkspace />)
    selectFamily('goods')
    fireEvent.change(screen.getByLabelText('Plattformbreite (mm)'), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Plattformtiefe (mm)'), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Plattformhöhe (mm)'), { target: { value: '2200' } })
    fireEvent.change(screen.getByLabelText('Schachtbreite (mm)'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Schachttiefe (mm)'), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('Grubentiefe (mm)'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Schachtkopf (mm)'), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Einheitliche Geschosshöhe (mm)'), { target: { value: '3000' } })
    expect(screen.getByText('Nicht möglich')).toBeInTheDocument()
    expect(screen.getByText('Die Ladefläche überschreitet den angegebenen Schacht.')).toBeInTheDocument()

    selectFamily('car')
    fireEvent.change(screen.getByLabelText('Plattformbreite (mm)'), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Plattformtiefe (mm)'), { target: { value: '4000' } })
    fireEvent.change(screen.getByLabelText('Nutzbare Höhe (mm)'), { target: { value: '2200' } })
    fireEvent.change(screen.getByLabelText('Fahrzeugbreite (mm)'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Fahrzeuglänge (mm)'), { target: { value: '3500' } })
    fireEvent.change(screen.getByLabelText('Beladerichtung'), { target: { value: 'shaft-z' } })
    expect(screen.getByText('Nicht möglich')).toBeInTheDocument()
    expect(screen.getByText('Die Fahrzeughülle passt nicht auf die Plattform.')).toBeInTheDocument()
  })
})
