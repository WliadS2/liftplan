// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'
import { millimetres } from '../../engineering'
import { createLiftGeometryPlanningInput } from '../../three/geometry/lift-geometry-planning-input'
import { createPassengerDrawingContext } from '../../drawings/passenger-technical-drawings'
import { createLiftPlanProject } from '../../projects'
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
})
