// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createProjectStore, useProjectStore } from '../projects'
import { createDefaultLiftConfiguration, REGISTERED_LIFT_FAMILIES } from '../elevator'
import { hasDevelopmentFixture, loadDevelopmentFamilyFixture } from './development-mechanical-session'
import { DevelopmentMechanicalControls } from './DevelopmentMechanicalControls'

afterEach(cleanup)
describe('family-aware development loading', () => {
  it.each(['passenger', 'goods', 'car'] as const)('loads only the selected %s family into ephemeral state', (family) => {
    const store = createProjectStore()
    store.getState().setLiftFamily(family)
    const result = loadDevelopmentFamilyFixture(family, store.getState())
    expect(result.status).toBe('loaded')
    expect(store.getState()).toMatchObject({ persistenceMode: 'development-demo', validation: { status: 'valid' },
      project: { liftFamily: family, configuration: { family } } })
    store.getState().createProject({ liftFamily: family })
    expect(store.getState().persistenceMode).toBe('project')
    expect(store.getState().project.configuration).toEqual(createDefaultLiftConfiguration(family, store.getState().project.name))
  })
  it('does not fall back to a passenger fixture for unsupported families', () => {
    const store = createProjectStore()
    for (const family of REGISTERED_LIFT_FAMILIES.filter((f) => !hasDevelopmentFixture(f))) {
      store.getState().setLiftFamily(family)
      const before = store.getState()
      expect(loadDevelopmentFamilyFixture(family, store.getState())).toEqual({ status: 'unavailable' })
      expect(store.getState()).toBe(before)
    }
  })
  it('switches repeatedly without stale family configuration or demo data', () => {
    const store = createProjectStore()
    for (const family of ['passenger', 'goods', 'car', 'passenger', 'goods', 'car'] as const) {
      store.getState().setLiftFamily(family)
      expect(store.getState().persistenceMode).toBe('project')
      expect(store.getState().project.configuration).toEqual(createDefaultLiftConfiguration(family, store.getState().project.name))
      loadDevelopmentFamilyFixture(family, store.getState())
      expect(store.getState().project.configuration.family).toBe(family)
    }
  })
  it('shows one German demo control and resets to an empty project of the current family', () => {
    useProjectStore.getState().createProject({ liftFamily: 'car' })
    render(<DevelopmentMechanicalControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Demo laden' }))
    expect(useProjectStore.getState()).toMatchObject({ persistenceMode: 'development-demo', project: { liftFamily: 'car' } })
    expect(screen.queryByText('Fahrdemo öffnen')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demo zurücksetzen' }))
    expect(useProjectStore.getState()).toMatchObject({ persistenceMode: 'project', project: { liftFamily: 'car' } })
    expect(useProjectStore.getState().project.configuration).not.toHaveProperty('vehicle')
  })
  it('disables demo loading for future families', () => {
    useProjectStore.getState().createProject({ liftFamily: 'home' })
    render(<DevelopmentMechanicalControls />)
    expect(screen.getByRole('button', { name: 'Demo laden' })).toBeDisabled()
  })
})
