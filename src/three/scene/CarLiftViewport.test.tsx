// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { createCarLiftPlanningConfiguration, type CarLiftPlanningConfiguration } from '../../elevator'
import { millimetres as mm } from '../../engineering'
import { CarLiftViewport } from './CarLiftViewport'

vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="car-canvas">{children}</div> }))
vi.mock('@react-three/drei', () => ({ PerspectiveCamera: () => null }))
const camera = vi.hoisted(() => ({ props: undefined as undefined | { frame: unknown; request: { viewMode: string; resetRevision: number } } }))
vi.mock('../camera/AutoFitCamera', () => ({ AutoFitCamera: (props: NonNullable<typeof camera.props>) => { camera.props = props; return null } }))
vi.mock('../geometry/car/CarLiftAssembly', () => ({ CarLiftAssembly: ({ model }: { readonly model: { readonly viewMode: string } }) => <div data-testid="car-assembly">{model.viewMode}</div> }))
afterEach(cleanup)

function viewport(configuration: CarLiftPlanningConfiguration) {
  const model = createLiftFamilyTechnicalModel(configuration)
  if (model.status !== 'available' || model.family !== 'car') throw new Error('Expected Auto model')
  return render(<CarLiftViewport normalized={model.normalized} validation={model.validation} sceneModel={model.scene} />)
}
describe('Autoaufzug viewport states and controls', () => {
  it('distinguishes empty planning data from renderer unavailability', () => {
    viewport(createCarLiftPlanningConfiguration('Leer'))
    expect(screen.getByText('Planungsdaten eingeben, um die 3D-Ansicht zu starten.')).toBeInTheDocument()
    expect(screen.queryByTestId('car-canvas')).not.toBeInTheDocument()
    expect(screen.queryByText('3D-Darstellung für diesen Aufzugstyp noch nicht verfügbar.')).not.toBeInTheDocument()
  })
  it('offers all six Auto-specific modes without passenger/goods controls', () => {
    viewport(createCarLiftQaFixture())
    for (const label of ['Gesamtansicht', 'Plattform', 'Fahrzeug', 'Türen', 'Zufahrt', 'Schnittansicht']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    }
    for (const label of ['Lasten', 'Antrieb', 'Sicherheit', 'Mechanik']) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
  })
  it('resets the current semantic camera without reverting the view', () => {
    viewport(createCarLiftQaFixture())
    fireEvent.click(screen.getByRole('button', { name: 'Fahrzeug' }))
    const frame = camera.props!.frame
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }))
    expect(camera.props!.frame).toEqual(frame)
    expect(camera.props!.request).toMatchObject({ viewMode: 'vehicle', resetRevision: 1 })
  })
  it('keeps oversized geometry rendered with a conflict notice', () => {
    const fixture = createCarLiftQaFixture()
    viewport({ ...fixture, vehicle: { ...fixture.vehicle, widthMm: mm(4000) } })
    expect(screen.getByTestId('car-assembly')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Geometrie enthält Konflikte')
  })
  it('shows partial geometry and allows returning from an empty view', () => {
    viewport({ ...createCarLiftQaFixture(), platformWidthMm: undefined, vehicle: undefined,
      entryApproachEnvelope: undefined, exitApproachEnvelope: undefined, vehicleSweptEnvelope: undefined })
    expect(screen.getByText('Teilansicht – weitere Planungsdaten fehlen.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fahrzeug' }))
    expect(screen.getByText('Für diesen Ansichtsmodus fehlen Planungsdaten.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Gesamtansicht' }))
    expect(screen.getByTestId('car-assembly')).toHaveTextContent('overview')
  })
})
