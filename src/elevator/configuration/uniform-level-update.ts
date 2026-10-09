import type { Millimetres } from '../../engineering'

interface VerticalPlanningData {
  readonly stopCount?: number
  readonly storeyHeightsMm?: readonly Millimetres[]
  readonly levelElevationsMm?: readonly (Millimetres | null)[]
}

/** Editing a count reuses a known uniform interval, never extrapolates independent elevations. */
export function updateUniformLevelIntervals<T extends VerticalPlanningData>(configuration: T, update: Partial<NoInfer<T>>): T {
  const next = { ...configuration, ...update }
  if (!Object.hasOwn(update, 'stopCount') || update.stopCount === configuration.stopCount ||
    Object.hasOwn(update, 'storeyHeightsMm') || Object.hasOwn(update, 'levelElevationsMm') ||
    configuration.levelElevationsMm !== undefined) return next
  const heights = configuration.storeyHeightsMm
  const height = heights?.[0]
  if (!heights?.length || heights.length !== (configuration.stopCount ?? 0) - 1 ||
    height === undefined || !Number.isFinite(height) || height <= 0 || heights.some((value) => value !== height) ||
    update.stopCount === undefined || !Number.isInteger(update.stopCount) || update.stopCount < 1) return next
  return { ...next, storeyHeightsMm: Array.from({ length: update.stopCount - 1 }, () => height) }
}
