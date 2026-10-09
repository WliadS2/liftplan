// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'
import { createLiftGeometryPlanningInput } from '../geometry/lift-geometry-planning-input'
import type { PassengerSimulationController } from '../../simulation/passenger-simulation'
import type { AutoFitCameraProps } from '../camera/AutoFitCamera'
import { ThreeConfiguratorViewport } from './ThreeConfiguratorViewport'
import { getPassengerViewVisibility, PASSENGER_RUNTIME_VIEW_MODES } from './view-mode'

const runtime = vi.hoisted(() => ({ controller: undefined as PassengerSimulationController | undefined,
  camera: undefined as AutoFitCameraProps | undefined }))
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('@react-three/drei', () => ({ PerspectiveCamera: () => null }))
vi.mock('./PassengerSimulationDriver', () => ({ PassengerSimulationDriver: ({ children, controller }: {
  children: ReactNode; controller?: PassengerSimulationController
}) => { runtime.controller = controller; return <>{children}</> } }))
vi.mock('../camera/AutoFitCamera', () => ({ AutoFitCamera: (props: AutoFitCameraProps) => { runtime.camera = props; return null } }))
vi.mock('../geometry/passenger/PassengerElevatorAssembly', () => ({ PassengerElevatorAssembly: ({ viewMode }: { viewMode: string }) =>
  <div data-testid="passenger-scene-mode">{viewMode}</div> }))
afterEach(cleanup)

describe('actual passenger viewport mode wiring', () => {
  it('keeps paused passenger travel and the target selection intact when Fahrdemo is collapsed', () => {
    render(<ThreeConfiguratorViewport geometryInput={createLiftGeometryPlanningInput({ ...createPassengerMechanicalFixture(), stopCount: 6 })} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-6' } })
    fireEvent.click(screen.getByRole('button', { name: '▶ Fahrt starten' }))
    act(() => { runtime.controller!.advance(2); runtime.controller!.dispatch({ type: 'pause' }) })
    const controller = runtime.controller!, pose = controller.getPose(), state = controller.getState()
    fireEvent.click(screen.getByRole('button', { name: 'Fahrdemo' }))
    expect(screen.getByRole('button', { name: 'Fahrdemo' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('passenger-scene-mode')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fahrdemo' }))
    expect(screen.getByRole('combobox', { name: 'Zielhaltestelle' })).toHaveValue('level-6')
    expect(controller.getState()).toBe(state); expect(controller.getPose()).toBe(pose)
    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
    expect(controller.getState().paused).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Fahrdemo' }))
    act(() => controller.dispatch({ type: 'start', targetLevel: 'level-6' }))
    expect(screen.getByRole('alert')).toBeVisible()
  })

  it('renders the implemented catalog in order and selects every runtime scene/camera mode', () => {
    render(<ThreeConfiguratorViewport geometryInput={createLiftGeometryPlanningInput(createPassengerMechanicalFixture())} />)
    const toolbar = within(screen.getByRole('group', { name: 'Ansichtsmodus' }))
    expect(toolbar.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Gesamtansicht', 'Kabine', 'Mechanik', 'Antrieb', 'Sicherheit', 'Türen', 'Schnittansicht', 'Ansicht zurücksetzen',
    ])
    for (const mode of PASSENGER_RUNTIME_VIEW_MODES) {
      fireEvent.click(toolbar.getByRole('button', { name: mode.label }))
      expect(screen.getByTestId('passenger-scene-mode')).toHaveTextContent(mode.id)
      expect(runtime.camera!.request.viewMode).toBe(mode.id)
      expect(toolbar.getByRole('button', { name: mode.label })).toHaveAttribute('aria-pressed', 'true')
    }
  })
  it('follows only Kabine and resets its current pose, then restores fixed overview/mechanics/section', () => {
    render(<ThreeConfiguratorViewport geometryInput={createLiftGeometryPlanningInput({ ...createPassengerMechanicalFixture(), stopCount: 6 })} />)
    const initialFrame = runtime.camera!.frame
    fireEvent.click(screen.getByRole('button', { name: 'Kabine' }))
    const cabinFrame = runtime.camera!.frame
    fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-6' } })
    fireEvent.click(screen.getByRole('button', { name: '▶ Fahrt starten' }))
    act(() => runtime.controller!.advance(30))
    expect(runtime.controller!.getPose().cabinOffsetY).toBe(15)
    expect(runtime.camera!.motion!.getOffset()).toEqual([0, 15, 0])
    expect(runtime.camera!.frame).toEqual(cabinFrame)
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }))
    expect(runtime.camera!.request).toMatchObject({ viewMode: 'cabin', resetRevision: 1 })
    expect(runtime.camera!.motion!.getOffset()).toEqual([0, 15, 0])
    for (const label of ['Mechanik', 'Schnittansicht', 'Gesamtansicht']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(runtime.camera!.motion!.getOffset()).toEqual([0, 0, 0])
    }
    expect(runtime.camera!.frame).toEqual(initialFrame)
  })
  it('keeps cabin subject and section visibility distinct from the mechanical and installation views', () => {
    const cabin = getPassengerViewVisibility('cabin'), mechanics = getPassengerViewVisibility('mechanical')
    const section = getPassengerViewVisibility('cutaway'), overview = getPassengerViewVisibility('overview')
    expect(cabin.showCounterweight).toBe(false)
    expect(cabin.showTractionRopes).toBe(false)
    expect(cabin.cabinShellOpacity).toBe(1)
    expect(mechanics.showCounterweight).toBe(true)
    expect(mechanics.cabinShellOpacity).toBeLessThan(0.1)
    expect(section.showShaftSection).toBe(true)
    expect(section.showRightCabinWall).toBe(false)
    expect(section.showFrontWallSections).toBe(false)
    expect(overview.showShaftSection).toBe(false)
  })
})
