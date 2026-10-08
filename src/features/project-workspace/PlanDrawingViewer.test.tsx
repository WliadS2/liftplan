// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'
import { createCarLiftDrawingContext } from '../../drawings/car-lift-technical-drawings'
import { createGoodsLiftDrawingContext } from '../../drawings/goods-lift-technical-drawings'
import { createPassengerDrawingContext } from '../../drawings/passenger-technical-drawings'
import { createLiftGeometryPlanningInput } from '../../three/geometry/lift-geometry-planning-input'
import { createLiftPlanProject } from '../../projects'
import { PlansWorkspace } from './PlansWorkspace'
import { automaticPreviewSheetSize } from '../../drawings/technical-drawing-sheet'
import { fitDrawingSheetToViewport } from './drawing-preview-fit'

let width=960,height=560
const observers: {callback:ResizeObserverCallback;disconnect:ReturnType<typeof vi.fn>}[] = []
beforeEach(()=>{
  width=960;height=560;observers.length=0
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockImplementation(()=>width)
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockImplementation(()=>height)
  vi.stubGlobal('ResizeObserver',class {
    disconnect=vi.fn()
    readonly callback:ResizeObserverCallback
    constructor(callback:ResizeObserverCallback) {this.callback=callback;observers.push(this)}
    observe=vi.fn()
  })
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
function inputs(family:'car'|'goods'|'passenger') {
  const configuration = family === 'car' ? createCarLiftQaFixture() : family === 'goods' ? createGoodsLiftQaFixture() : createPassengerMechanicalFixture()
  const planning = createLiftGeometryPlanningInput(configuration)
  const context = configuration.family === 'car' ? createCarLiftDrawingContext(configuration)
    : configuration.family === 'goods' ? createGoodsLiftDrawingContext(configuration)
      : planning ? createPassengerDrawingContext(planning) : undefined
  if (!context) throw Error('Expected fixture drawing context')
  return {context,project:{...createLiftPlanProject({liftFamily:family,projectId:`preview-${family}`}),configuration}}
}
const image = (name='Grundriss')=>screen.getByRole('img',{name}) as unknown as SVGSVGElement
function expectFitted(svg:SVGSVGElement) {
  const box = svg.getAttribute('viewBox')!.split(' ').map(Number)
  const w = parseFloat(svg.style.width),h = parseFloat(svg.style.height)
  expect(w/h).toBeCloseTo(box[2]/box[3],10)
  expect(w).toBeLessThanOrEqual(width-32+1e-9)
  expect(h).toBeLessThanOrEqual(height-32+1e-9)
  expect(w).toBeGreaterThan(0);expect(h).toBeGreaterThan(0)
  expect(svg.style.transform).toBe('')
  expect(svg.querySelector('[data-paper-primitive-id="sheet-frame"]')).not.toBeNull()
  expect(svg.querySelector('[data-paper-primitive-id="title-block"]')).not.toBeNull()
}

describe('automatic sheet fit in screen pixels only',()=>{
  it.each([{width:1200,height:700},{width:400,height:300},{width:300,height:900}])('fits both A4 orientations inside %j',viewport=>{
    for (const view of ['plan','section','door-elevation'] as const) {
      const sheet = automaticPreviewSheetSize(view),fit = fitDrawingSheetToViewport(viewport,sheet)
      expect(fit.width/fit.height).toBeCloseTo(sheet.width/sheet.height,12)
      expect(fit.width).toBeLessThanOrEqual(viewport.width-32+1e-9)
      expect(fit.height).toBeLessThanOrEqual(viewport.height-32+1e-9)
      expect(Math.min(viewport.width-fit.width,viewport.height-fit.height)).toBeCloseTo(32)
    }
  })
  it('does not invent initial dimensions, divide by zero or accumulate scale',()=>{
    for (const viewport of [{width:0,height:0},{width:NaN,height:500},{width:20,height:20}])
      expect(fitDrawingSheetToViewport(viewport,{width:297,height:210})).toEqual({width:0,height:0})
    const fit = ()=>fitDrawingSheetToViewport({width:900,height:600},{width:297,height:210})
    expect(fit()).toEqual(fit())
  })
})

describe('measured plan viewer integration',()=>{
  it.each(['car','goods','passenger'] as const)('%s fits a complete sheet on the first measured paint and on view switches',family=>{
    render(<PlansWorkspace {...inputs(family)}/>)
    for (const [label,viewBox] of [['Grundriss','0 0 297 210'],['Schnitt','0 0 210 297'],['Türansicht','0 0 297 210']]) {
      fireEvent.click(screen.getByRole('button',{name:label}))
      expect(image(label)).toHaveAttribute('viewBox',viewBox)
      expectFitted(image(label))
      const inner = image(label).querySelector('svg')!
      expect(inner).toHaveAttribute('preserveAspectRatio','xMidYMid meet')
      expect(Number(inner.getAttribute('x'))).toBeGreaterThan(0)
      expect(Number(inner.getAttribute('y'))+Number(inner.getAttribute('height'))).toBeLessThan(
        Number(image(label).querySelector('[data-paper-primitive-id="title-block"]')!.getAttribute('y')))
    }
  })
  it('measures the viewport on mount, responds to ResizeObserver and releases it on unmount',()=>{
    const {unmount} = render(<PlansWorkspace {...inputs('car')}/>)
    const before = image().style.width
    expectFitted(image());expect(observers).toHaveLength(1)
    width=410;height=310
    act(()=>observers[0].callback([],{} as ResizeObserver))
    expectFitted(image());expect(image().style.width).not.toBe(before)
    unmount();expect(observers[0].disconnect).toHaveBeenCalledOnce()
  })
  it('waits for real dimensions when mounted in a hidden tab, then fits when shown',()=>{
    width=0;height=0
    const {container} = render(<PlansWorkspace {...inputs('car')}/>)
    expect(container.querySelector('[data-preview-mode="automatic-sheet"]')).toHaveStyle({visibility:'hidden',width:'0px',height:'0px'})
    width=800;height=480
    act(()=>observers[0].callback([],{} as ResizeObserver))
    expect(image()).toHaveStyle({visibility:'visible'});expectFitted(image())
  })
  it('resets stale scroll and recomputes sheet dimensions on view and family changes',()=>{
    const {container,rerender} = render(<PlansWorkspace {...inputs('car')}/>)
    const viewport = container.querySelector('[data-drawing-viewport]')!
    viewport.scrollTop=300;viewport.scrollLeft=200
    fireEvent.click(screen.getByRole('button',{name:'Schnitt'}))
    expect(viewport.scrollTop).toBe(0);expect(viewport.scrollLeft).toBe(0);expectFitted(image('Schnitt'))
    viewport.scrollTop=400;viewport.scrollLeft=100
    rerender(<PlansWorkspace {...inputs('goods')}/>)
    expect(viewport.scrollTop).toBe(0);expect(viewport.scrollLeft).toBe(0)
    expectFitted(image('Schnitt'))
    expect(image('Schnitt').querySelector('[data-primitive-id="goods-shaft-section"]')).not.toBeNull()
  })
  it.each(['1:20','1:25','1:50','1:100'])('keeps %s physical SVG dimensions and geometry unchanged on viewport resize',scale=>{
    render(<PlansWorkspace {...inputs('car')}/>)
    fireEvent.change(screen.getByRole('combobox',{name:'Maßstab'}),{target:{value:scale}})
    const svg = image(),before = svg.outerHTML
    expect(svg).toHaveAttribute('width','297mm');expect(svg).toHaveAttribute('height','210mm')
    expect(svg.style.width).toBe('');expect(svg.style.height).toBe('')
    expect(svg.querySelector('[data-primitive-id="car-shaft"] rect')).toHaveAttribute('width',String(3200/Number(scale.slice(2))))
    width=300;height=240
    act(()=>observers[0].callback([],{} as ResizeObserver))
    expect(svg.outerHTML).toBe(before)
    fireEvent.change(screen.getByRole('combobox',{name:'Maßstab'}),{target:{value:'auto'}})
    expectFitted(image())
  })
})
