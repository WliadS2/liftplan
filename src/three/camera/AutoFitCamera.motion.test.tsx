// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { AutoFitCamera } from './AutoFitCamera'
import { calculateCameraFit } from './camera-fit'
import { PASSENGER_CAMERA_POLICIES, GOODS_CAMERA_POLICIES, CAR_CAMERA_POLICIES } from './view-camera-policy'

const runtime = vi.hoisted(() => ({
  tick: undefined as undefined | ((state: unknown) => void), onStart: undefined as undefined | (() => void),
  controls: undefined as undefined | { target: Vector3; update: ReturnType<typeof vi.fn>; minDistance: number; maxDistance: number; enableDamping?: boolean },
}))
vi.mock('@react-three/fiber', () => ({ useFrame: (tick: typeof runtime.tick) => { runtime.tick = tick } }))
vi.mock('@react-three/drei', async () => {
  const React = await import('react')
  const { Vector3 } = await import('three')
  return { OrbitControls: React.forwardRef(function Controls({ onStart }: { onStart: () => void }, ref) {
    const controls = React.useMemo(() => ({ target: new Vector3(), update: vi.fn(), minDistance: 0, maxDistance: 0 }), [])
    runtime.controls = controls; runtime.onStart = onStart
    React.useImperativeHandle(ref, () => controls)
    return null
  }) }
})
afterEach(cleanup)
describe('rigid simulation camera following', () => {
  it('clears residual damping before fitting so reset and resize cannot drift away from the target', () => {
    const frame = { bounds: { min: [-1, 0, -1] as const, max: [1, 2, 1] as const,
      center: [0, 1, 0] as const, width: 2, height: 2, depth: 2 }, target: [0, 1, 0] as const }
    const camera = new PerspectiveCamera(38)
    const request = { viewMode: 'overview', installationKey: 'fixture', doorSelectionKey: '', resetRevision: 0 }
    const view = render(<AutoFitCamera frame={frame} request={request} />)
    const controls = runtime.controls!
    controls.enableDamping = true
    let residual = 3
    controls.update.mockImplementation(() => {
      controls.target.x += residual
      camera.position.x += residual
      residual = controls.enableDamping ? residual * 0.9 : 0
    })
    let size = { width: 704, height: 455 }
    const tick = () => act(() => runtime.tick!({ camera, size }))
    tick()
    expect(controls.target.toArray()).toEqual(frame.target)
    expect(camera.position.toArray()).toEqual(calculateCameraFit(frame.bounds, frame.target, size).position)
    runtime.onStart!(); residual = 2
    view.rerender(<AutoFitCamera frame={frame} request={{ ...request, resetRevision: 1 }} />)
    tick()
    expect(controls.target.toArray()).toEqual(frame.target)
    expect(residual).toBe(0); expect(controls.enableDamping).toBe(true)
    residual = 2; size = { width: 956, height: 455 }; tick()
    expect(controls.target.toArray()).toEqual(frame.target)
    expect(camera.position.toArray()).toEqual(calculateCameraFit(frame.bounds, frame.target, size).position)
    expect(controls.update).toHaveBeenCalledTimes(6)
  })

  it('reframes to the real resized canvas after inspector or Fahrdemo changes, then allows manual orbit and reset', () => {
    const frame = { bounds: { min: [-2, -1, -2] as const, max: [2, 20, 2] as const,
      center: [0, 9.5, 0] as const, width: 4, height: 21, depth: 4 }, target: [0, 9.5, 0] as const }
    const camera = new PerspectiveCamera(38)
    const request = { viewMode: 'overview', installationKey: 'fixture', doorSelectionKey: '', resetRevision: 0 }
    const view = render(<AutoFitCamera frame={frame} request={request} />)
    let size = { width: 704, height: 420 }
    const tick = () => act(() => runtime.tick!({ camera, size }))
    for (const next of [size, { width: 956, height: 420 }, { width: 1208, height: 420 }, { width: 704, height: 510 }]) {
      size = next
      tick()
      expect(camera.position.toArray()).toEqual(calculateCameraFit(frame.bounds, frame.target, size).position)
      expect(runtime.controls!.target.toArray()).toEqual(frame.target)
    }
    expect(runtime.controls!.update).toHaveBeenCalledTimes(4)
    runtime.onStart!(); camera.position.x += 3
    const manual = camera.position.clone()
    tick(); expect(camera.position.equals(manual)).toBe(true)
    view.rerender(<AutoFitCamera frame={frame} request={{ ...request, resetRevision: 1 }} />)
    tick()
    expect(camera.position.toArray()).toEqual(calculateCameraFit(frame.bounds, frame.target, size).position)
  })

  it.each([PASSENGER_CAMERA_POLICIES,GOODS_CAMERA_POLICIES,CAR_CAMERA_POLICIES].flatMap((policies) =>
    (['overview', 'cutaway'] as const).map((viewMode) => ({ policies, viewMode }))))('$viewMode: keeps installation position, pivot and zoom fixed throughout travel and manual orbit', ({policies,viewMode})=>{
    const frame = {bounds:{min:[-2,-1,-2] as const,max:[2,32,2] as const,center:[0,15.5,0] as const,
      width:4,height:33,depth:4},target:[0,15.5,0] as const}
    const camera = new PerspectiveCamera(38,1280/720)
    let travel = 0
    const motion = {identity:{},getOffset:()=>[0,policies[viewMode] === 'moving-detail' ? travel : 0,0] as const}
    const request = {viewMode,installationKey:'10-stops',doorSelectionKey:'level-1',resetRevision:0}
    const view = render(<AutoFitCamera frame={frame} request={request} motion={motion}/> )
    const tick = ()=>act(()=>runtime.tick!({camera,size:{width:1280,height:720}}))
    tick()
    const position = camera.position.clone(),target=runtime.controls!.target.clone(),zoom=camera.zoom
    for (let i=0;i<100;i++){travel=i*0.27;tick()}
    expect(camera.position.equals(position)).toBe(true);expect(runtime.controls!.target.equals(target)).toBe(true)
    expect(camera.zoom).toBe(zoom);expect(runtime.controls!.update).toHaveBeenCalledTimes(1)
    runtime.onStart!();camera.position.x+=2;camera.rotation.y+=0.3
    const manual = camera.position.clone(),orientation=camera.quaternion.clone()
    view.rerender(<AutoFitCamera frame={frame} request={{...request,doorSelectionKey:'level-10'}} motion={motion}/>)
    travel=27;tick()
    expect(camera.position.equals(manual)).toBe(true);expect(camera.quaternion.equals(orientation)).toBe(true)
    expect(runtime.controls!.update).toHaveBeenCalledTimes(1)
    view.rerender(<AutoFitCamera frame={frame} request={{...request,resetRevision:1}} motion={motion}/>)
    tick();expect(camera.position.equals(position)).toBe(true);expect(runtime.controls!.target.equals(target)).toBe(true)
  })
  it.each(['cabin', 'platform', 'vehicle', 'loads', 'guides'])('%s: translates camera and pivot without per-frame fits, preserves interaction, and resets at the current pose', (viewMode) => {
    const frame = { bounds: { min: [-1, 0, -1] as const, max: [1, 2, 1] as const,
      center: [0, 1, 0] as const, width: 2, height: 2, depth: 2 }, target: [0, 1, 0] as const, direction: [1, 1, 1] as const }
    const camera = new PerspectiveCamera(38, 1280/720)
    let offset = 0
    const motion = { identity: {}, getOffset: () => [0, offset, 0] as const }
    const request = { viewMode, installationKey: 'fixture', doorSelectionKey: '', resetRevision: 0 }
    const view = render(<AutoFitCamera frame={frame} request={request} motion={motion} />)
    const tick = () => act(() => runtime.tick!({ camera, size: { width: 1280, height: 720 } }))
    tick()
    const initial = camera.position.clone(), target = runtime.controls!.target.clone()
    for (let i = 1; i <= 100; i++) { offset = i * 0.15; tick() }
    expect(camera.position.y).toBeCloseTo(initial.y + 15)
    expect(runtime.controls!.target.y).toBeCloseTo(target.y + 15)
    expect(camera.position.x).toBe(initial.x)
    expect(runtime.controls!.update).toHaveBeenCalledTimes(1)
    runtime.onStart!()
    camera.position.x += 2; runtime.controls!.target.x += 2
    camera.rotation.y += 0.3
    camera.zoom = 1.4
    const manualDistance = camera.position.distanceTo(runtime.controls!.target)
    const manualOrientation = camera.quaternion.clone()
    offset = 16; tick()
    expect(camera.position.x).toBe(initial.x + 2)
    expect(camera.quaternion.equals(manualOrientation)).toBe(true)
    expect(camera.zoom).toBe(1.4)
    expect(camera.position.distanceTo(runtime.controls!.target)).toBeCloseTo(manualDistance)
    view.rerender(<AutoFitCamera frame={frame} request={{ ...request, resetRevision: 1 }} motion={motion} />)
    tick()
    expect(camera.position.x).toBe(initial.x)
    expect(camera.position.y).toBeCloseTo(initial.y + 16)
    expect(runtime.controls!.update).toHaveBeenCalledTimes(2)
    view.rerender(<AutoFitCamera frame={frame} request={request} motion={{ identity: {}, getOffset: () => [0, 0, 0] }} />)
    tick()
    expect(camera.position.y).toBe(initial.y)
  })
})
