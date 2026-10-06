// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateGoodsLiftSpatialGeometry } from '../../collision/goods-lift-spatial-validation'
import {
  createGoodsLiftNormalizedModel,
  createGoodsLiftPlanningConfiguration,
  createGoodsLiftSceneModel,
  type GoodsLiftPlanningConfiguration,
} from '../../elevator'
import { millimetres } from '../../engineering'
import { GoodsLiftViewport } from './GoodsLiftViewport'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="goods-canvas">{children}</div>,
}))
vi.mock('@react-three/drei', () => ({ PerspectiveCamera: () => null }))
const camera = vi.hoisted(() => ({ props: undefined as undefined | {
  frame: unknown; request: { viewMode: string; resetRevision: number }
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
    stopCount: 2,
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
