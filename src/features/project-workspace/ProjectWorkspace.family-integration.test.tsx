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
      return <div>Planungsdaten unvollständig</div>
    }
    if (technicalModel.family === 'car') return <div>Autoaufzug 3D</div>
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
  fireEvent.change(screen.getByLabelText('Aufzugstyp', { exact: false }), { target: { value: family } })
}

describe('family-specific project workspace forms', () => {
  it.each(['passenger', 'goods', 'car'] as const)('collapses %s inspectors independently without losing fields or changing project state', (family) => {
    useProjectStore.getState().setLiftFamily(family)
    const { container } = render(<ProjectWorkspace />)
    const before = useProjectStore.getState().project
    const field = screen.getByLabelText('Aufzugstyp', { exact: false })
    fireEvent.click(screen.getByRole('button', { name: 'Konfiguration einklappen' }))
    expect(container.querySelector('.workspace-body')).toHaveAttribute('data-left-collapsed', 'true')
    expect(field).not.toBeVisible()
    expect(screen.getByRole('button', { name: 'Technische Daten einklappen' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Technische Daten einklappen' }))
    expect(container.querySelector('#data-content')).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Konfiguration einblenden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Technische Daten einblenden' }))
    expect(field).toBeVisible()
    expect(field).toBe(screen.getByLabelText('Aufzugstyp', { exact: false }))
    expect(useProjectStore.getState().project).toBe(before)
    const heading = container.querySelector('.data-panel .inspector-heading')!
    expect(heading.querySelector('h2')).toHaveTextContent('Technische Daten')
    expect(heading.querySelector('button')).toHaveAttribute('aria-controls', 'data-content')
  })

  it('preserves the existing passenger form path', () => {
    render(<ProjectWorkspace />)
    expect(screen.getByLabelText('Personenanzahl', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Dieser Aufzugstyp wird in einer kommenden Ausbaustufe unterstützt.')).not.toBeInTheDocument()
  })

  it('shows and updates the Waren-/Lastenaufzug form including loads and through-car access', () => {
    const { container } = render(<ProjectWorkspace />)
    selectFamily('goods')

    expect(container.querySelector('[data-lift-family-form="goods"]')).not.toBeNull()
    expect(screen.getByLabelText('Plattformbreite', { exact: false })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen', { exact: false }), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Plattformbreite', { exact: false }), { target: { value: '1800' } })
    fireEvent.change(screen.getByLabelText('Palette Breite', { exact: false }), { target: { value: '1200' } })
    fireEvent.change(screen.getByLabelText('Rollcontainer Tiefe', { exact: false }), { target: { value: '900' } })
    fireEvent.change(screen.getByLabelText('Durchlader', { exact: false }), { target: { value: 'true' } })

    expect(useProjectStore.getState().project.configuration).toMatchObject({
      family: 'goods', stopCount: 2, platformWidthMm: 1800, throughCar: true,
      pallet: { widthMm: 1200 }, rollContainer: { depthMm: 900 },
    })
  })

  it('keeps an invalid Waren-/Lastenaufzug draft visible and restores saved family values', () => {
    render(<ProjectWorkspace />)
    selectFamily('goods')
    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen', { exact: false }), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Plattformbreite', { exact: false }), { target: { value: '1800' } })
    const stored = createStoredProject(useProjectStore.getState().project, useProjectStore.getState().configurationDraft)

    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen', { exact: false }), { target: { value: '2.5' } })
    expect(screen.getByLabelText('Anzahl Haltestellen', { exact: false })).toHaveValue(2.5)
    expect(useProjectStore.getState().validation.status).toBe('invalid')
    expect(useProjectStore.getState().configurationDraft).toMatchObject({ stopCount: 2.5 })
    expect(useProjectStore.getState().project.configuration).toMatchObject({ stopCount: 2 })

    const loaded = createLoadedProjectState(stored)
    act(() => useProjectStore.getState().loadProject(loaded.project, loaded.configurationDraft))
    expect(screen.getByLabelText('Plattformbreite', { exact: false })).toHaveValue(1800)
    expect(screen.getByLabelText('Anzahl Haltestellen', { exact: false })).toHaveValue(2)
  })

  it('shows and updates all core Autoaufzug vehicle inputs and uses the centering helper', () => {
    const { container } = render(<ProjectWorkspace />)
    selectFamily('car')

    expect(container.querySelector('[data-lift-family-form="car"]')).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Fahrzeugbreite', { exact: false }), { target: { value: '1900' } })
    fireEvent.change(screen.getByLabelText('Fahrzeuglänge', { exact: false }), { target: { value: '4700' } })
    fireEvent.change(screen.getByLabelText('Fahrzeughöhe', { exact: false }), { target: { value: '1900' } })
    fireEvent.change(screen.getByLabelText('Fahrzeugmasse', { exact: false }), { target: { value: '2100' } })
    fireEvent.change(screen.getByLabelText('Radstand', { exact: false }), { target: { value: '3100' } })
    fireEvent.change(screen.getByLabelText('Spurbreite', { exact: false }), { target: { value: '1600' } })
    fireEvent.change(screen.getByLabelText('Überhang vorne', { exact: false }), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Überhang hinten', { exact: false }), { target: { value: '750' } })
    fireEvent.change(screen.getAllByLabelText('Längsversatz', { exact: false })[0], { target: { value: '120' } })
    fireEvent.change(screen.getAllByLabelText('Querversatz', { exact: false })[0], { target: { value: '-40' } })
    fireEvent.change(screen.getAllByLabelText('Ausrichtung', { exact: false })[0], { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Durchlader', { exact: false }), { target: { value: 'true' } })
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

  it('dispatches available Auto geometry instead of showing renderer unavailability', () => {
    render(<ProjectWorkspace />)
    selectFamily('car')
    expect(screen.getByText(/Planungsdaten unvollst.ndig/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Plattformbreite', { exact: false }), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Plattformtiefe', { exact: false }), { target: { value: '5500' } })
    fireEvent.change(screen.getByLabelText('Nutzbare Höhe', { exact: false }), { target: { value: '2400' } })
    expect(screen.getByText('Autoaufzug 3D')).toBeInTheDocument()
  })

  it('shows family-specific geometric validation output in German', () => {
    render(<ProjectWorkspace />)
    selectFamily('goods')
    fireEvent.change(screen.getByLabelText('Plattformbreite', { exact: false }), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Plattformtiefe', { exact: false }), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Plattformhöhe', { exact: false }), { target: { value: '2200' } })
    fireEvent.change(screen.getByLabelText('Schachtbreite', { exact: false }), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Schachttiefe', { exact: false }), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('Grubentiefe', { exact: false }), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Schachtkopf', { exact: false }), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('Anzahl Haltestellen', { exact: false }), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Einheitliche Geschosshöhe', { exact: false }), { target: { value: '3000' } })
    expect(screen.getByText('Nicht möglich')).toBeInTheDocument()
    expect(screen.getByText('Die Ladefläche überschreitet den angegebenen Schacht.')).toBeInTheDocument()

    selectFamily('car')
    fireEvent.change(screen.getByLabelText('Plattformbreite', { exact: false }), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Plattformtiefe', { exact: false }), { target: { value: '4000' } })
    fireEvent.change(screen.getByLabelText('Nutzbare Höhe', { exact: false }), { target: { value: '2200' } })
    fireEvent.change(screen.getByLabelText('Fahrzeugbreite', { exact: false }), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Fahrzeuglänge', { exact: false }), { target: { value: '3500' } })
    fireEvent.change(screen.getByLabelText('Beladerichtung', { exact: false }), { target: { value: 'shaft-z' } })
    expect(screen.getByText('Nicht möglich')).toBeInTheDocument()
    expect(screen.getByText('Die Fahrzeughülle passt nicht auf die Plattform.')).toBeInTheDocument()
  })
})
