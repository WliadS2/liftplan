export const THREE_VIEW_MODES = ['overview', 'cabin', 'mechanical', 'drive', 'safety', 'doors', 'cutaway'] as const

export type ThreeViewMode = (typeof THREE_VIEW_MODES)[number]

export const PASSENGER_VIEW_MODE_CATALOG = [
  { id: 'overview', label: 'Gesamtansicht', implemented: true },
  { id: 'cabin', label: 'Kabine', implemented: true },
  { id: 'shaft', label: 'Schacht', implemented: false },
  { id: 'mechanical', label: 'Mechanik', implemented: true },
  { id: 'drive', label: 'Antrieb', implemented: true },
  { id: 'safety', label: 'Sicherheit', implemented: true },
  { id: 'doors', label: 'Türen', implemented: true },
  { id: 'cutaway', label: 'Schnittansicht', implemented: true },
  { id: 'exploded', label: 'Explosionsansicht', implemented: false },
] as const

export type PassengerViewModeId =
  (typeof PASSENGER_VIEW_MODE_CATALOG)[number]['id']

/** The actual runtime toolbar and mode selection share this typed, ordered catalog. */
export const PASSENGER_RUNTIME_VIEW_MODES = PASSENGER_VIEW_MODE_CATALOG.filter((mode) => mode.implemented)

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
  readonly showCounterweight: boolean
  readonly showTractionRopes: boolean
  readonly showMechanicalSystems: boolean
  /** Presentation-only section: render the far shaft walls and omit the near ones facing the section camera. */
  readonly showShaftSection: boolean
}

export function getPassengerViewVisibility(
  viewMode: ThreeViewMode,
): PassengerViewVisibility {
  if (viewMode === 'doors') return {
    showRightCabinWall: true, showFrontWallSections: true, cabinShellOpacity: 0.12, cabinCeilingOpacity: 0.025,
    frontDoorOpacity: 1, shaftEnvelopeOpacity: 0, mechanicalOpacity: 1, landingOpacity: 0.025, pitOpacity: 0,
    showCounterweight: false, showTractionRopes: false, showMechanicalSystems: false, showShaftSection: false,
  }
  if (viewMode === 'cabin') {
    // The cabin is the subject: opaque shell, translucent ceiling to expose the car-top frame,
    // no shaft envelope or counterweight competing with the moving car assembly.
    return {
      showRightCabinWall: true,
      showFrontWallSections: true,
      cabinShellOpacity: 1,
      cabinCeilingOpacity: 0.35,
      frontDoorOpacity: 1,
      shaftEnvelopeOpacity: 0,
      mechanicalOpacity: 1,
      landingOpacity: 0,
      pitOpacity: 0,
      showCounterweight: false,
      showTractionRopes: false,
      showMechanicalSystems: true,
      showShaftSection: false,
    }
  }
  if (viewMode === 'cutaway') {
    return {
      showRightCabinWall: false,
      showFrontWallSections: false,
      cabinShellOpacity: 1,
      cabinCeilingOpacity: 0.08,
      frontDoorOpacity: 0.08,
      shaftEnvelopeOpacity: 0,
      mechanicalOpacity: 1,
      landingOpacity: 0.22,
      pitOpacity: 0.08,
      showCounterweight: true,
      showTractionRopes: true,
      showMechanicalSystems: true,
      showShaftSection: true,
    }
  }

  if (viewMode === 'mechanical' || viewMode === 'drive' || viewMode === 'safety') {
    return {
      showRightCabinWall: true,
      showFrontWallSections: true,
      cabinShellOpacity: viewMode === 'mechanical' ? 0.085 : 0.035,
      cabinCeilingOpacity: 0.025,
      frontDoorOpacity: 0.025,
      shaftEnvelopeOpacity: 0,
      mechanicalOpacity: 1,
      landingOpacity: 0.025,
      pitOpacity: 0,
      showCounterweight: viewMode !== 'safety',
      showTractionRopes: viewMode !== 'safety',
      showMechanicalSystems: true,
      showShaftSection: false,
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
    showCounterweight: true,
    showTractionRopes: true,
    showMechanicalSystems: true,
    showShaftSection: false,
  }
}

export function getDoorViewVisibility(mode: ThreeViewMode, selected: boolean, role?: 'cabin' | 'landing'): { readonly panelOpacity: number; readonly componentOpacity: number } {
  if (mode === 'doors') return { panelOpacity: selected ? 1 : 0.025, componentOpacity: selected ? 1 : 0.025 }
  if (mode === 'cabin') return role === 'landing' ? { panelOpacity: 0.025, componentOpacity: 0.025 } : { panelOpacity: 1, componentOpacity: 1 }
  if (mode === 'cutaway') return { panelOpacity: 0.12, componentOpacity: 1 }
  if (mode === 'mechanical' || mode === 'drive' || mode === 'safety') return { panelOpacity: 0.025, componentOpacity: 1 }
  return { panelOpacity: 1, componentOpacity: 1 }
}
