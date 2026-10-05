// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'
import { kilograms, metresPerSecond, millimetres } from '../../engineering'
import { createLiftGeometryPlanningInput } from '../../three/geometry/lift-geometry-planning-input'
import { createPassengerDrawingContext } from '../../drawings/passenger-technical-drawings'
import { createGoodsLiftDrawingContext } from '../../drawings/goods-lift-technical-drawings'
import { createCarLiftDrawingContext } from '../../drawings/car-lift-technical-drawings'
import { createCarLiftPlanningConfiguration, createCenteredVehiclePosition, createGoodsLiftPlanningConfiguration,
  type CarLiftPlanningConfiguration, type GoodsLiftPlanningConfiguration } from '../../elevator'
import { createLiftPlanProject, replaceProjectConfiguration } from '../../projects'
import { PlansWorkspace } from './PlansWorkspace'

afterEach(cleanup)

function demoContext(update: Partial<ReturnType<typeof createPassengerMechanicalFixture>> = {}) {
  const planning = createLiftGeometryPlanningInput({
    ...createPassengerMechanicalFixture(),
    ...update,
  })
  if (!planning) throw new Error('Expected demo planning input')
  const context = createPassengerDrawingContext(planning)
  if (!context) throw new Error('Expected demo drawing context')
  return context
}

const project = createLiftPlanProject(
  { projectId: 'test-project', projectName: 'Mechanische Demo – Testdaten', createdAt: '2026-10-04T10:00:00.000Z' },
  { createId: () => 'test-project', now: () => '2026-10-04T10:00:00.000Z' },
)

function goodsPlanConfiguration(): GoodsLiftPlanningConfiguration {
  return {
    ...createGoodsLiftPlanningConfiguration('Warenaufzug UI'),
    ratedLoadKg: kilograms(2000), stopCount: 2, nominalSpeedMetresPerSecond: metresPerSecond(0.6),
    platformWidthMm: millimetres(1800), platformDepthMm: millimetres(2400), platformHeightMm: millimetres(2300),
    doorWidthMm: millimetres(1400), doorHeightMm: millimetres(2200),
    shaftWidthMm: millimetres(2600), shaftDepthMm: millimetres(3200), pitDepthMm: millimetres(1200),
    headroomMm: millimetres(3800), storeyHeightsMm: [millimetres(3500)],
    frontAccess: true, rearAccess: false, throughCar: false,
  }
}

function carPlanConfiguration(): CarLiftPlanningConfiguration {
  return {
    ...createCarLiftPlanningConfiguration('Autoaufzug UI'),
    ratedLoadKg: kilograms(3000), stopCount: 2, nominalSpeedMetresPerSecond: metresPerSecond(0.5),
    platformWidthMm: millimetres(2500), platformDepthMm: millimetres(5500), usableHeightMm: millimetres(2400),
    doorClearWidthMm: millimetres(2400), doorClearHeightMm: millimetres(2300),
    shaftWidthMm: millimetres(3200), shaftDepthMm: millimetres(6500), pitDepthMm: millimetres(1200),
    headroomMm: millimetres(3600), storeyHeightsMm: [millimetres(3600)],
    vehicleLoadingDirection: 'shaft-z', frontAccess: true, rearAccess: false, throughCar: false,
    vehicle: { widthMm: millimetres(1900), lengthMm: millimetres(4700), heightMm: millimetres(1900) },
    vehiclePosition: createCenteredVehiclePosition(),
  }
}

function familyProject(configuration: GoodsLiftPlanningConfiguration | CarLiftPlanningConfiguration) {
  const created = createLiftPlanProject(
    { projectId: `${configuration.family}-ui-plan`, projectName: configuration.projectName,
      liftFamily: configuration.family, createdAt: '2026-10-05T12:00:00.000Z' },
    { now: () => '2026-10-05T12:00:00.000Z' },
  )
  return replaceProjectConfiguration(created, configuration, '2026-10-05T12:00:00.000Z').project
}

describe('PlansWorkspace validation status', () => {
  it('does not show a conflict banner for the known-good Mechanical Demo', () => {
    const context = demoContext()
    expect(context.validation.status).not.toBe('invalid')

    render(<PlansWorkspace context={context} project={project} />)

    expect(screen.queryByText('Planungsdaten enthalten Konflikte.')).not.toBeInTheDocument()
  })

  it('shows the shared conflict status for genuinely invalid spatial geometry', () => {
    const context = demoContext({ shaftWidthMm: millimetres(1000) })
    expect(context.validation.status).toBe('invalid')

    render(<PlansWorkspace context={context} project={project} />)

    expect(screen.getByText('Planungsdaten enthalten Konflikte.')).toBeInTheDocument()
  })

  it('clips the oversized 1:20 section on one physical A4 and reports that it does not fit', () => {
    render(<PlansWorkspace context={demoContext()} project={project} />)
    fireEvent.click(screen.getByRole('button', { name: 'Schnitt' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Maßstab' }), { target: { value: '1:20' } })
    const svg = screen.getByRole('img', { name: 'Schnitt' })
    expect(svg).toHaveAttribute('width', '210mm')
    expect(svg).toHaveAttribute('height', '297mm')
    expect(svg).toHaveAttribute('viewBox', '0 0 210 297')
    expect(svg).toHaveAttribute('data-page-fit', 'does-not-fit')
    expect(svg.querySelector('[data-primitive-id="shaft-section"] rect')).toHaveAttribute('height', '410')
    expect(svg.querySelector('g[clip-path]')).toHaveAttribute('clip-path', 'url(#passenger-section-sheet-clip)')
    expect(screen.getByText('Die Zeichnung passt im Maßstab 1:20 nicht auf A4.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Maßstab' })).toHaveValue('1:20')

    fireEvent.change(screen.getByRole('combobox', { name: 'Maßstab' }), { target: { value: '1:50' } })
    expect(svg).toHaveAttribute('data-page-fit', 'fits')
    expect(svg.querySelector('[data-primitive-id="shaft-section"] rect')).toHaveAttribute('height', '164')
    expect(screen.queryByText('Die Zeichnung passt im Maßstab 1:20 nicht auf A4.')).not.toBeInTheDocument()
  })

  it('keeps fixed paper coordinates, fit result, and scale independent of container size', () => {
    const { container } = render(<PlansWorkspace context={demoContext()} project={project} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Maßstab' }), { target: { value: '1:20' } })
    const svg = screen.getByRole('img', { name: 'Grundriss' })
    const before = svg.outerHTML
    expect(svg).toHaveAttribute('width', '297mm')
    expect(svg).toHaveAttribute('height', '210mm')
    expect(svg).toHaveAttribute('viewBox', '0 0 297 210')
    expect(svg.querySelector('[data-primitive-id="shaft"] rect')).toHaveAttribute('width', '130')
    container.style.width = '400px'
    fireEvent(window, new Event('resize'))
    expect(svg.outerHTML).toBe(before)
    expect(screen.getByRole('combobox', { name: 'Maßstab' })).toHaveValue('1:20')
  })

  it('shows the same structured technical frame and title-block metadata in a fixed-scale browser preview', () => {
    render(<PlansWorkspace context={demoContext()} project={project} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Maßstab' }), { target: { value: '1:50' } })
    const svg = screen.getByRole('img', { name: 'Grundriss' })
    expect(svg.querySelector('[data-technical-sheet-paper-space="true"]')).not.toBeNull()
    expect(svg.querySelector('[data-paper-primitive-id="sheet-frame"]')).not.toBeNull()
    expect(svg.querySelector('[data-paper-primitive-id="title-block"]')).not.toBeNull()
    expect(svg.querySelector('[data-paper-primitive-id="title-project-value"]')?.textContent)
      .toBe('Mechanische Demo – Testdaten')
    expect(svg.querySelector('[data-paper-primitive-id="title-drawing-number-value"]')?.textContent)
      .toBe('LP-TESTPROJ-GR-001')
    expect(svg.querySelector('[data-paper-primitive-id="title-sheet-value"]')?.textContent).toBe('1 / 1')
    expect(svg.querySelector('[data-technical-drawing-content="true"]')?.getAttribute('transform')).toMatch(/^translate\(/)
  })

  it('retains auto preview fitting without a physical-page warning', () => {
    render(<PlansWorkspace context={demoContext()} project={project} />)
    fireEvent.click(screen.getByRole('button', { name: 'Schnitt' }))
    const svg = screen.getByRole('img', { name: 'Schnitt' })
    expect(svg).not.toHaveAttribute('width')
    expect(svg).not.toHaveAttribute('height')
    expect(svg).not.toHaveAttribute('data-page-fit')
    expect(svg.querySelector('g[clip-path]')).toBeNull()
    expect(svg.getAttribute('viewBox')).not.toBe('0 0 210 297')
  })

  it('blocks automatic preview export with a clear German message', () => {
    render(<PlansWorkspace context={demoContext()} project={project} />)
    fireEvent.click(screen.getByRole('button', { name: 'PDF erstellen' }))
    expect(screen.getByText('Für den PDF-Export wählen Sie bitte einen festen Maßstab.')).toBeInTheDocument()
  })

  it('offers browser-local DXF export for the current drawing or complete plan set', () => {
    render(<PlansWorkspace context={demoContext()} project={project} />)
    expect(screen.getByRole('button', { name: 'DXF exportieren' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Aktuelle Ansicht' })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Gesamter Plansatz' }))
    expect(screen.getByRole('radio', { name: 'Gesamter Plansatz' })).toBeChecked()
  })

  it('does not duplicate the existing fixed-scale fit warning after an export attempt', () => {
    render(<PlansWorkspace context={demoContext()} project={project} />)
    fireEvent.click(screen.getByRole('button', { name: 'Schnitt' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Maßstab' }), { target: { value: '1:20' } })
    fireEvent.click(screen.getByRole('button', { name: 'PDF erstellen' }))
    expect(screen.getAllByText('Die Zeichnung passt im Maßstab 1:20 nicht auf A4.')).toHaveLength(1)
  })

  it('uses the Waren-/Lastenaufzug drawing generators for all three plan views', () => {
    const configuration = goodsPlanConfiguration()
    const context = createGoodsLiftDrawingContext(configuration)
    if (!context) throw new Error('Expected goods drawing context')
    render(<PlansWorkspace context={context} project={familyProject(configuration)} />)
    expect(screen.getByRole('img', { name: 'Grundriss' }).querySelector('[data-primitive-id="goods-shaft"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Schnitt' }))
    expect(screen.getByRole('img', { name: 'Schnitt' }).querySelector('[data-primitive-id="goods-shaft-section"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Türansicht' }))
    expect(screen.getByRole('img', { name: 'Türansicht' }).querySelector('[data-primitive-id="goods-door-opening"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'PDF erstellen' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'DXF exportieren' })).toBeEnabled()
  })

  it('uses the Autoaufzug drawing generators for all three plan views', () => {
    const configuration = carPlanConfiguration()
    const context = createCarLiftDrawingContext(configuration)
    if (!context) throw new Error('Expected car drawing context')
    render(<PlansWorkspace context={context} project={familyProject(configuration)} />)
    const plan = screen.getByRole('img', { name: 'Grundriss' })
    expect(plan.querySelector('[data-primitive-id="car-shaft"]')).not.toBeNull()
    expect(plan.querySelector('[data-primitive-id="car-vehicle-envelope"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Schnitt' }))
    expect(screen.getByRole('img', { name: 'Schnitt' }).querySelector('[data-primitive-id="car-shaft-section"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Türansicht' }))
    expect(screen.getByRole('img', { name: 'Türansicht' }).querySelector('[data-primitive-id="car-door-opening"]')).not.toBeNull()
  })
})
