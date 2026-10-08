// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { createCarLiftPlanningConfiguration, type CarLiftPlanningConfiguration } from '../../elevator'
import { millimetres as mm, metresPerSecond } from '../../engineering'
import { CarLiftViewport } from './CarLiftViewport'

vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="car-canvas">{children}</div> }))
const driver = vi.hoisted(() => ({ controller: undefined as import('../../simulation/platform-simulation').PlatformSimulationController | undefined }))
vi.mock('./CarSimulationDriver', () => ({ CarSimulationDriver: ({ children, controller }: { children: React.ReactNode; controller?: typeof driver.controller }) => {
  driver.controller = controller
  return <>{children}</>
} }))
vi.mock('@react-three/drei', () => ({ PerspectiveCamera: () => null }))
const camera = vi.hoisted(() => ({ props: undefined as undefined | { frame: unknown; request: { viewMode: string; resetRevision: number }; motion?:{getOffset:()=>readonly number[]} } }))
vi.mock('../camera/AutoFitCamera', () => ({ AutoFitCamera: (props: NonNullable<typeof camera.props>) => { camera.props = props; return null } }))
vi.mock('../geometry/car/CarLiftAssembly', () => ({ CarLiftAssembly: ({ model }: { readonly model: { readonly viewMode: string } }) => <div data-testid="car-assembly">{model.viewMode}</div> }))
afterEach(cleanup)

function viewport(configuration: CarLiftPlanningConfiguration) {
  const model = createLiftFamilyTechnicalModel(configuration)
  if (model.status !== 'available' || model.family !== 'car') throw new Error('Expected Auto model')
  return render(<CarLiftViewport normalized={model.normalized} validation={model.validation} sceneModel={model.scene} />)
}
describe('Autoaufzug viewport states and controls', () => {
  it('wires fixed installation motion separately from vehicle/platform following and resets the active view',()=>{
    viewport(createCarLiftQaFixture())
    const overview=camera.props!.frame
    fireEvent.change(screen.getByRole('combobox',{name:'Zielhaltestelle'}),{target:{value:'level-6'}})
    fireEvent.click(screen.getByRole('button',{name:'▶ Fahrt starten'}))
    act(()=>driver.controller!.advance(4))
    expect(driver.controller!.getPose().platformOffsetMm).toBeGreaterThan(0)
    expect(camera.props!.motion!.getOffset()).toEqual([0,0,0]);expect(camera.props!.frame).toEqual(overview)
    fireEvent.click(screen.getByRole('button',{name:'Fahrzeug'}))
    expect(camera.props!.motion!.getOffset()[1]).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button',{name:'Ansicht zurücksetzen'}))
    expect(camera.props!.request.viewMode).toBe('vehicle');expect(camera.props!.motion!.getOffset()[1]).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button',{name:'Schnittansicht'}))
    expect(camera.props!.request.viewMode).toBe('cutaway')
    expect(camera.props!.motion!.getOffset()).toEqual([0,0,0])
    expect(camera.props!.frame).not.toEqual(overview)
    fireEvent.click(screen.getByRole('button',{name:'Gesamtansicht'}))
    expect(camera.props!.frame).toEqual(overview);expect(camera.props!.motion!.getOffset()).toEqual([0,0,0])
  })
  it('preserves active motion on a speed-only edit and uses new speed on the next departure', () => {
    const props = (speed: number) => {
      const m = createLiftFamilyTechnicalModel({ ...createCarLiftQaFixture(), nominalSpeedMetresPerSecond: metresPerSecond(speed) })
      if (m.status !== 'available' || m.family !== 'car') throw Error('Missing Auto model')
      return { normalized: m.normalized, validation: m.validation, sceneModel: m.scene }
    }
    const view = render(<CarLiftViewport {...props(1)} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-6' } })
    fireEvent.click(screen.getByRole('button', { name: '▶ Fahrt starten' }))
    act(() => { driver.controller!.advance(4); driver.controller!.dispatch({ type: 'pause' }) })
    const controller = driver.controller!, pose = controller.getPose(), state = controller.getState()
    view.rerender(<CarLiftViewport {...props(2)} />)
    expect(driver.controller).toBe(controller)
    expect(controller.getState()).toBe(state); expect(controller.getPose()).toBe(pose)
    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
    act(() => { controller.advance(20) })
    fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-1' } })
    fireEvent.click(screen.getByRole('button', { name: '▶ Fahrt starten' }))
    expect(controller.getState().travelDurationSeconds).toBe(7)
    view.rerender(<CarLiftViewport {...props(2)} />)
    expect(driver.controller).not.toBe(controller)
    expect(driver.controller!.getState().phase).toBe('idle')
  })
  it('distinguishes empty planning data from renderer unavailability', () => {
    viewport(createCarLiftPlanningConfiguration('Leer'))
    expect(screen.getByText(/Planungsdaten unvollst.ndig/)).toBeInTheDocument()
    expect(screen.queryByTestId('car-canvas')).not.toBeInTheDocument()
    expect(screen.queryByText('3D-Darstellung für diesen Aufzugstyp noch nicht verfügbar.')).not.toBeInTheDocument()
  })
  it('offers configured Auto-specific mechanical modes without goods load controls', () => {
    viewport(createCarLiftQaFixture())
    for (const label of ['Gesamtansicht', 'Plattform', 'Fahrzeug', 'Mechanik','Antrieb','Türen', 'Zufahrt','Führungssystem','Sicherheit', 'Schnittansicht']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.queryByRole('button', { name: 'Lasten' })).not.toBeInTheDocument()
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
