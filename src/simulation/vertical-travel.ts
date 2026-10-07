import { seconds, type Metres, type MetresPerSecond, type Seconds } from '../engineering'

export type VerticalTravelDuration = { readonly status: 'available'; readonly seconds: Seconds }
  | { readonly status: 'unknown' | 'invalid'; readonly path: 'nominalSpeedMetresPerSecond' | 'levels' }

/** Constant-speed kinematic visualization only; no acceleration, braking or performance claim. */
export function calculateVerticalTravelDuration(start: Metres, target: Metres, speed?: MetresPerSecond): VerticalTravelDuration {
  if (!Number.isFinite(start) || !Number.isFinite(target)) return { status: 'invalid', path: 'levels' }
  if (speed === undefined) return { status: 'unknown', path: 'nominalSpeedMetresPerSecond' }
  if (!Number.isFinite(speed) || speed <= 0) return { status: 'invalid', path: 'nominalSpeedMetresPerSecond' }
  const duration = Math.abs(target - start) / speed
  return Number.isFinite(duration) ? { status: 'available', seconds: seconds(duration) }
    : { status: 'invalid', path: 'levels' }
}
