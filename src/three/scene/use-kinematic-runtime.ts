import { useLayoutEffect, useState } from 'react'
import type { MetresPerSecond } from '../../engineering'

/** Speed-only edits preserve the runtime, including pose, doors, pause and camera identity.
 * A journey captures speed at departure; edits apply at the next departure.
 * Other input replacements (including same-speed demo reload) keep existing reset semantics. */
export function useKinematicRuntime<M, C extends { setNominalSpeed: (speed?: MetresPerSecond) => void }>(
  result: { readonly status: string; readonly model?: M }, speed: MetresPerSecond | undefined,
  geometryKey: string, create: (model: M) => C,
): C | undefined {
  const make = () => result.status === 'available' && result.model ? create(result.model) : undefined
  const [binding, setBinding] = useState(() => ({ result, speed, geometryKey, controller: make() }))
  let current = binding
  if (binding.result !== result) {
    const speedOnly = binding.geometryKey === geometryKey && binding.speed !== speed
    current = { result, speed, geometryKey, controller: speedOnly ? binding.controller : make() }
    setBinding(current)
  }
  const controller = current.controller
  useLayoutEffect(() => { controller?.setNominalSpeed(speed) }, [controller, speed])
  return controller
}

export function withoutNominalSpeedKey(value: unknown): string {
  return JSON.stringify(value, (key, entry) => key === 'nominalSpeedMetresPerSecond' ? undefined : entry)
}
