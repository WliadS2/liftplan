// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTechnicalSceneLabelElement } from './technical-scene-label'

describe('technical projection label lifecycle', () => {
  it('mounts plain German text without a nested React root or external assets', () => {
    const host = document.createElement('div')
    const label = createTechnicalSceneLabelElement(host,'Spurbreite 1500 mm')
    expect(host.children).toHaveLength(1)
    expect(label.textContent).toBe('Spurbreite 1500 mm')
    expect(label.style.pointerEvents).toBe('none')
    label.remove()
    expect(host.children).toHaveLength(0)
  })
  it('can clean up repeatedly after the canvas host has already been removed', () => {
    for(let i=0;i<20;i++) {
      const host = document.createElement('div')
      document.body.appendChild(host)
      const label = createTechnicalSceneLabelElement(host,'Einfahrtshülle')
      host.replaceChildren()
      host.remove()
      expect(() => { label.remove(); label.remove() }).not.toThrow()
    }
  })
})
