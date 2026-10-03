export const THREE_VIEW_MODES = ['overview', 'mechanical', 'cutaway'] as const

export type ThreeViewMode = (typeof THREE_VIEW_MODES)[number]

export const PASSENGER_VIEW_MODE_CATALOG = [
  { id: 'overview', label: 'Gesamtansicht', implemented: true },
  { id: 'cabin', label: 'Kabine', implemented: false },
  { id: 'shaft', label: 'Schacht', implemented: false },
  { id: 'mechanical', label: 'Mechanik', implemented: true },
  { id: 'doors', label: 'Türen', implemented: false },
  { id: 'drive', label: 'Antrieb', implemented: false },
  { id: 'cutaway', label: 'Schnittansicht', implemented: true },
  { id: 'exploded', label: 'Explosionsansicht', implemented: false },
] as const

export type PassengerViewModeId =
  (typeof PASSENGER_VIEW_MODE_CATALOG)[number]['id']

export interface PassengerViewVisibility {
  readonly showRightCabinWall: boolean
  readonly showFrontWallSections: boolean
  readonly cabinShellOpacity: number
  readonly cabinCeilingOpacity: number
  readonly frontDoorOpacity: number
  readonly shaftEnvelopeOpacity: number
  readonly mechanicalOpacity: number
  readonly landingOpacity: number
  readonly pitOpacity: number
}

export function getPassengerViewVisibility(
  viewMode: ThreeViewMode,
): PassengerViewVisibility {
  if (viewMode === 'cutaway') {
    return {
      showRightCabinWall: false,
      showFrontWallSections: false,
      cabinShellOpacity: 1,
      cabinCeilingOpacity: 0.08,
      frontDoorOpacity: 0.08,
      shaftEnvelopeOpacity: 0,
      mechanicalOpacity: 1,
      landingOpacity: 0.06,
      pitOpacity: 0,
    }
  }

  if (viewMode === 'mechanical') {
    return {
      showRightCabinWall: true,
      showFrontWallSections: true,
      cabinShellOpacity: 0.085,
      cabinCeilingOpacity: 0.025,
      frontDoorOpacity: 0.025,
      shaftEnvelopeOpacity: 0,
      mechanicalOpacity: 1,
      landingOpacity: 0.025,
      pitOpacity: 0,
    }
  }

  return {
    showRightCabinWall: true,
    showFrontWallSections: true,
    cabinShellOpacity: 1,
    cabinCeilingOpacity: 1,
    frontDoorOpacity: 1,
    shaftEnvelopeOpacity: 0.08,
    mechanicalOpacity: 1,
    landingOpacity: 0.12,
    pitOpacity: 0.1,
  }
}
