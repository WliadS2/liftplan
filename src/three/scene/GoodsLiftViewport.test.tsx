// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateGoodsLiftSpatialGeometry } from '../../collision/goods-lift-spatial-validation'
import {
  createGoodsLiftNormalizedModel,
  createGoodsLiftPlanningConfiguration,
  createGoodsLiftSceneModel,
  type GoodsLiftPlanningConfiguration,
} from '../../elevator'
import { millimetres, metresPerSecond } from '../../engineering'
import { GoodsLiftViewport } from './GoodsLiftViewport'
import { LiftFamilyViewport } from './LiftFamilyViewport'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import { createProjectStore } from '../../projects/project-store'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'

vi.mock('./ThreeConfiguratorViewport', () => ({ ThreeConfiguratorViewport: () => <div>Personenaufzug</div> }))
vi.mock('./CarLiftViewport', () => ({ CarLiftViewport: () => <div>Autoaufzug</div> }))

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="goods-canvas">{children}</div>,
}))
vi.mock('@react-three/drei', () => ({ PerspectiveCamera: () => null }))
const driver = vi.hoisted(() => ({ controller: undefined as import('../../simulation/goods-simulation').GoodsSimulationController | undefined }))
vi.mock('./GoodsSimulationDriver', () => ({
  GoodsSimulationDriver: ({ children, controller }: { children: React.ReactNode; controller?: typeof driver.controller }) => {
    driver.controller = controller
    return <>{children}</>
  },
}))
const camera = vi.hoisted(() => ({ props: undefined as undefined | {
  frame: unknown; request: { viewMode: string; resetRevision: number }; motion?: { identity: object }
} }))
vi.mock('../camera/AutoFitCamera', () => ({ AutoFitCamera: (props: NonNullable<typeof camera.props>) => {
  camera.props = props
  return null
} }))
vi.mock('../geometry/goods/GoodsLiftAssembly', () => ({
  GoodsLiftAssembly: ({ model }: { readonly model: { readonly viewMode: string } }) =>
    <div data-testid="goods-assembly">{model.viewMode}</div>,
}))

afterEach(cleanup)

function configured(update: Partial<GoodsLiftPlanningConfiguration> = {}): GoodsLiftPlanningConfiguration {
  return {
    ...createGoodsLiftPlanningConfiguration('Viewport'),
    stopCount: 2, nominalSpeedMetresPerSecond: metresPerSecond(1),
    platformWidthMm: millimetres(1800), platformDepthMm: millimetres(2400), platformHeightMm: millimetres(2300),
    doorWidthMm: millimetres(1400), doorHeightMm: millimetres(2200),
    shaftWidthMm: millimetres(2600), shaftDepthMm: millimetres(3200),
    pitDepthMm: millimetres(1200), headroomMm: millimetres(3800), storeyHeightsMm: [millimetres(3500)],
    frontAccess: true, rearAccess: true, throughCar: true,
    guideSystem: { orientation: 'x', spacingMm: millimetres(2100) },
    ...update,
  }
}

function renderConfiguration(configuration: GoodsLiftPlanningConfiguration) {
  const normalized = createGoodsLiftNormalizedModel(configuration)
  const validation = validateGoodsLiftSpatialGeometry(normalized)
  const sceneModel = normalized.status === 'empty' ? undefined : createGoodsLiftSceneModel(normalized.model)
  return render(<GoodsLiftViewport normalized={normalized} validation={validation} sceneModel={sceneModel} />)
}

describe('goods-lift viewport', () => {
  it('keeps active pose and camera identity across speed-only edits, including paused travel', () => {
    const propsFor = (speed: number) => {
      const normalized = createGoodsLiftNormalizedModel(configured({ nominalSpeedMetresPerSecond: metresPerSecond(speed) }))
      return { normalized, validation: validateGoodsLiftSpatialGeometry(normalized),
        sceneModel: normalized.status === 'empty' ? undefined : createGoodsLiftSceneModel(normalized.model) }
    }
    const view = render(<GoodsLiftViewport {...propsFor(1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fahrt starten' }))
    act(() => { driver.controller!.advance(2.5); driver.controller!.dispatch({ type: 'pause' }) })
    const controller = driver.controller!, pose = controller.getPose(), state = controller.getState()
    view.rerender(<GoodsLiftViewport {...propsFor(2)} />)
    expect(driver.controller).toBe(controller)
    expect(camera.props!.motion?.identity).toBe(controller)
    expect(controller.getPose()).toBe(pose); expect(controller.getState()).toBe(state)
    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
    act(() => { controller.advance(10) })
    fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fahrt starten' }))
    expect(controller.getState().travelDurationSeconds).toBe(1.75)
  })
  it('isolates runtime from the project store and resets on Passenger/Goods/Car switching', () => {
    const store = createProjectStore()
    const element = () => <LiftFamilyViewport technicalModel={createLiftFamilyTechnicalModel(store.getState().project.configuration)} />
    const view = render(element())
    for (const family of ['goods', 'passenger', 'goods', 'car', 'goods', 'passenger', 'goods'] as const) {
      store.getState().setLiftFamily(family)
      if (family === 'goods') store.getState().loadDevelopmentConfiguration(createGoodsLiftQaFixture())
      view.rerender(element())
      if (family !== 'goods') {
        expect(screen.queryByRole('button', { name: 'Fahrt starten' })).not.toBeInTheDocument()
        continue
      }
      const configurationBefore = JSON.stringify(store.getState().project.configuration)
      expect(driver.controller!.getState()).toMatchObject({ phase: 'idle', currentLevel: 'level-1', paused: false })
      fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-6' } })
      fireEvent.click(screen.getByRole('button', { name: 'Fahrt starten' }))
      act(() => { driver.controller!.advance(driver.controller!.getState().travelDurationSeconds + 3) })
      expect(driver.controller!.getPose().floorMm).toBe(15000)
      expect(JSON.stringify(store.getState().project.configuration)).toBe(configurationBefore)
      expect(store.getState().persistenceMode).toBe('development-demo')
    }
  })
  it('runs the goods control sequence and resets motion plus current-view camera', () => {
    renderConfiguration(configured())
    expect(screen.getByText('Fahrdemo verfügbar.', { exact: false })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fahrt starten' }))
    expect(driver.controller!.getState().phase).toBe('door-closing')
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(driver.controller!.getState().paused).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
    act(() => { driver.controller!.advance(driver.controller!.getState().travelDurationSeconds + 3) })
    expect(screen.getByRole('status')).toHaveTextContent('Türen geöffnet · Haltestelle 2')
    fireEvent.click(screen.getByRole('button', { name: 'Lasten' }))
    fireEvent.click(screen.getByRole('button', { name: /^Zurücksetzen$/ }))
    expect(driver.controller!.getPose()).toMatchObject({ platformOffsetMm: 0, frontDoorProgress: 0, rearDoorProgress: 0 })
    expect(camera.props!.request).toMatchObject({ viewMode: 'loads', resetRevision: 1 })
  })
  it('replaces runtime and stale target on count changes, same-geometry demo reload and empty project', () => {
    const propsFor = (configuration: GoodsLiftPlanningConfiguration) => {
      const normalized = createGoodsLiftNormalizedModel(configuration)
      return { normalized, validation: validateGoodsLiftSpatialGeometry(normalized),
        sceneModel: normalized.status === 'empty' ? undefined : createGoodsLiftSceneModel(normalized.model) }
    }
    const config = configured({ stopCount: 6, storeyHeightsMm: Array(5).fill(millimetres(3500)) })
    const view = render(<GoodsLiftViewport {...propsFor(config)} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Zielhaltestelle' }), { target: { value: 'level-6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fahrt starten' }))
    act(() => { driver.controller!.advance(driver.controller!.getState().travelDurationSeconds + 3) })
    const old = driver.controller
    view.rerender(<GoodsLiftViewport {...propsFor({ ...config })} />)
    expect(driver.controller).not.toBe(old)
    expect(driver.controller!.getState()).toMatchObject({ currentLevel: 'level-1', phase: 'idle' })
    expect(camera.props!.motion?.identity).toBe(driver.controller)
    expect(screen.getByRole('combobox', { name: 'Zielhaltestelle' })).toHaveValue('level-2')
    view.rerender(<GoodsLiftViewport {...propsFor(configured())} />)
    expect(driver.controller!.model.levels).toHaveLength(2)
    expect(screen.getByRole('combobox', { name: 'Zielhaltestelle' })).toHaveValue('level-2')
    view.rerender(<GoodsLiftViewport {...propsFor(createGoodsLiftPlanningConfiguration('Reset'))} />)
    expect(screen.queryByRole('button', { name: 'Fahrt starten' })).not.toBeInTheDocument()
    expect(screen.getByText(/Fahrdemo nicht verfügbar – Planung unvollständig/)).toBeInTheDocument()
  })
  it('resets the active semantic frame without changing the goods view', () => {
    renderConfiguration(configured())
    fireEvent.click(screen.getByRole('button', { name: 'Lasten' }))
    const frame = camera.props!.frame
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }))
    expect(camera.props!.frame).toEqual(frame)
    expect(camera.props!.request).toMatchObject({ viewMode: 'loads', resetRevision: 1 })
  })
  it('shows the explicit incomplete state when no semantic scene can be created', () => {
    renderConfiguration(createGoodsLiftPlanningConfiguration('Leer'))
    expect(screen.getByText('Planungsdaten eingeben, um die 3D-Ansicht zu starten.')).toBeInTheDocument()
    expect(screen.queryByTestId('goods-canvas')).not.toBeInTheDocument()
  })

  it('offers goods-specific modes and switches the pure render model', () => {
    renderConfiguration(configured())
    expect(screen.getByTestId('goods-canvas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gesamtansicht' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plattform/Kabine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Türen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lasten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Führungssystem' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schnittansicht' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Antrieb' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lasten' }))
    expect(screen.getByTestId('goods-assembly')).toHaveTextContent('loads')
  })

  it('continues rendering invalid but structurally normalizable geometry', () => {
    renderConfiguration(configured({ platformWidthMm: millimetres(2800) }))
    expect(screen.getByTestId('goods-assembly')).toBeInTheDocument()
    expect(screen.getByText('Die konfigurierte Geometrie enthält Konflikte und wird zur Prüfung weiterhin dargestellt.'))
      .toBeInTheDocument()
  })

  it('resets the selected semantic camera frame without falling back to the tower overview', () => {
    renderConfiguration(configured())
    fireEvent.click(screen.getByRole('button', { name: 'Plattform/Kabine' }))
    const frame = camera.props!.frame
    expect(camera.props!.request.viewMode).toBe('platform')
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }))
    expect(camera.props!.frame).toEqual(frame)
    expect(camera.props!.request).toMatchObject({ viewMode: 'platform', resetRevision: 1 })
  })

  it('renders available partial geometry with a clear notice', () => {
    renderConfiguration(configured({ shaftWidthMm: undefined, shaftDepthMm: undefined }))
    expect(screen.getByTestId('goods-assembly')).toBeInTheDocument()
    expect(screen.getByText('Teilansicht – weitere Planungsdaten fehlen.')).toBeInTheDocument()
  })
})
