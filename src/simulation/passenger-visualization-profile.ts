import type { VisualizationTiming } from './passenger-simulation'

/**
 * Screen-animation timing only. These values are not elevator performance,
 * engineering inputs, rated-speed calculations, or technical project data.
 */
export const PASSENGER_VISUALIZATION_TIMING: VisualizationTiming = Object.freeze({
  source: 'visualization',
  doorOpeningSeconds: 1.5,
  doorClosingSeconds: 1.5,
  dwellSeconds: 2,
  arrivalSeconds: 0.3,
})
