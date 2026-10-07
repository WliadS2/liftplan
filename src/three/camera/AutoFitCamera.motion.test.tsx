// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { AutoFitCamera } from './AutoFitCamera'

const runtime = vi.hoisted(() => ({
  tick: undefined as undefined | ((state: unknown) => void), onStart: undefined as undefined | (() => void),
  controls: undefined as undefined | { target: Vector3; update: ReturnType<typeof vi.fn>; minDistance: number; maxDistance: number },
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
  it('translates camera and pivot without per-frame fits, preserves interaction, and resets at the current pose', () => {
    const frame = { bounds: { min: [-1, 0, -1] as const, max: [1, 2, 1] as const,
      center: [0, 1, 0] as const, width: 2, height: 2, depth: 2 }, target: [0, 1, 0] as const, direction: [1, 1, 1] as const }
    const camera = new PerspectiveCamera(38, 1280/720)
    let offset = 0
    const motion = { identity: {}, getOffset: () => [0, offset, 0] as const }
    const request = { viewMode: 'platform', installationKey: 'fixture', doorSelectionKey: '', resetRevision: 0 }
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
    const manualOrientation = camera.quaternion.clone()
    offset = 16; tick()
    expect(camera.position.x).toBe(initial.x + 2)
    expect(camera.quaternion.equals(manualOrientation)).toBe(true)
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
