/** A projection label owns a plain node, not a nested React root. Removal is safe after host teardown. */
export function createTechnicalSceneLabelElement(host: HTMLElement, text: string): HTMLSpanElement {
  const label = host.ownerDocument.createElement('span')
  label.textContent = text
  label.dataset.technicalSceneLabel = ''
  Object.assign(label.style, {
    position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: '1',
    color: '#26343c', fontFamily: 'monospace', fontSize: '10px', whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.85)', padding: '1px 3px',
  })
  host.appendChild(label)
  return label
}
