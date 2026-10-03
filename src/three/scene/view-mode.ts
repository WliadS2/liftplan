export const THREE_VIEW_MODES = ['overview', 'cutaway'] as const

export type ThreeViewMode = (typeof THREE_VIEW_MODES)[number]

export interface PassengerViewVisibility {
  readonly showRightCabinWall: boolean
  readonly showFrontWallSections: boolean
  readonly cabinCeilingOpacity: number
  readonly frontDoorOpacity: number
  readonly shaftEnvelopeOpacity: number
}

export function getPassengerViewVisibility(
  viewMode: ThreeViewMode,
): PassengerViewVisibility {
  if (viewMode === 'cutaway') {
    return {
      showRightCabinWall: false,
      showFrontWallSections: false,
      cabinCeilingOpacity: 0.08,
      frontDoorOpacity: 0.08,
      shaftEnvelopeOpacity: 0,
    }
  }

  return {
    showRightCabinWall: true,
    showFrontWallSections: true,
    cabinCeilingOpacity: 1,
    frontDoorOpacity: 1,
    shaftEnvelopeOpacity: 0.08,
  }
}
