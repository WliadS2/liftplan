export type CameraInteractionState = 'auto' | 'user'
export type CameraFrameTrigger = 'initial' | 'view-mode' | 'installation-bounds' | 'door-selection' | 'viewport' | 'reset' | 'render' | 'user-interaction'

export interface CameraFrameRequest {
  readonly viewMode: string
  readonly installationKey: string
  readonly doorSelectionKey: string
  readonly viewportKey: string
  readonly resetRevision: number
}

export interface CameraInteractionDecision {
  readonly state: CameraInteractionState
  readonly reframe: boolean
}

export function getCameraFrameTrigger(previous: CameraFrameRequest | undefined, next: CameraFrameRequest): CameraFrameTrigger {
  if (!previous) return 'initial'
  if (previous.resetRevision !== next.resetRevision) return 'reset'
  if (previous.viewMode !== next.viewMode) return 'view-mode'
  if (previous.installationKey !== next.installationKey) return 'installation-bounds'
  if (next.viewMode === 'doors' && previous.doorSelectionKey !== next.doorSelectionKey) return 'door-selection'
  if (previous.viewportKey !== next.viewportKey) return 'viewport'
  return 'render'
}

/** Camera ownership changes only for explicit interaction or a meaningful framing event. */
export function transitionCameraInteraction(state: CameraInteractionState, trigger: CameraFrameTrigger): CameraInteractionDecision {
  if (trigger === 'user-interaction') return { state: 'user', reframe: false }
  if (trigger === 'render') return { state, reframe: false }
  return { state: 'auto', reframe: true }
}
