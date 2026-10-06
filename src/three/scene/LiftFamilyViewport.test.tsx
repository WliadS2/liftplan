// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCarLiftPlanningConfiguration,
  createGoodsLiftPlanningConfiguration,
  createPassengerPlanningConfiguration,
} from '../../elevator'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import { LiftFamilyViewport } from './LiftFamilyViewport'

vi.mock('./ThreeConfiguratorViewport', () => ({
  ThreeConfiguratorViewport: () => <div data-testid="passenger-renderer">Personenaufzug-Renderer</div>,
}))
vi.mock('./GoodsLiftViewport', () => ({
  GoodsLiftViewport: ({ normalized }: { readonly normalized: { readonly status: string } }) =>
    <div data-testid="goods-renderer">Warenaufzug-Renderer: {normalized.status}</div>,
}))

afterEach(cleanup)

describe('lift-family viewport dispatch', () => {
  it('keeps passenger projects on the existing passenger renderer', () => {
    render(<LiftFamilyViewport technicalModel={createLiftFamilyTechnicalModel(
      createPassengerPlanningConfiguration('Personenaufzug'),
    )} />)
    expect(screen.getByTestId('passenger-renderer')).toBeInTheDocument()
    expect(screen.queryByTestId('goods-renderer')).not.toBeInTheDocument()
  })

  it('dispatches goods projects to the dedicated goods renderer even while incomplete', () => {
    render(<LiftFamilyViewport technicalModel={createLiftFamilyTechnicalModel(
      createGoodsLiftPlanningConfiguration('Warenaufzug'),
    )} />)
    expect(screen.getByTestId('goods-renderer')).toHaveTextContent('Warenaufzug-Renderer: empty')
    expect(screen.queryByTestId('passenger-renderer')).not.toBeInTheDocument()
  })

  it('keeps Autoaufzug explicitly unavailable instead of dispatching goods geometry', () => {
    render(<LiftFamilyViewport technicalModel={createLiftFamilyTechnicalModel(
      createCarLiftPlanningConfiguration('Autoaufzug'),
    )} />)
    expect(screen.getByText('Planungsdaten eingeben, um die 3D-Ansicht zu starten.')).toBeInTheDocument()
    expect(screen.queryByTestId('goods-renderer')).not.toBeInTheDocument()
  })
})
