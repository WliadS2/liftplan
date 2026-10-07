import { metres } from '../engineering'
import type { SimulationPose } from './passenger-simulation'
import type { DoorEntranceModel, DoorPanelModel, PassengerDoorSystemModel } from '../three/geometry/passenger/doors/passenger-door-model'
import type { MechanicalPoint } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'

export const CAR_MOTION_GROUPS = ['simulation-car-shell', 'simulation-car-mechanics', 'simulation-car-frame-reference', 'simulation-car-safety', 'simulation-car-hitches'] as const
export const COUNTERWEIGHT_MOTION_GROUPS = ['simulation-counterweight-mechanics', 'simulation-counterweight-hitches'] as const
export const cableLineName = (id: string, index: number) => `simulation-cable-${id}-${index}`
export const doorPanelGroupName = (panelId: string) => `simulation-panel-${panelId}`

/** Only the served landing opens. Door motion uses the supplied open/closed travel vectors. */
export function getDoorMotionProgress(entry: DoorEntranceModel, pose: SimulationPose): number {
  return entry.role === 'cabin' ? pose.cabinDoorProgress : entry.levelId === pose.activeLandingLevel ? pose.activeLandingDoorProgress : 0
}
export function getDoorPanelOffset(entry: DoorEntranceModel, panel: DoorPanelModel, pose: SimulationPose): MechanicalPoint {
  const progress = getDoorMotionProgress(entry, pose)
  return panel.travel.map((value) => metres(value * progress)) as unknown as MechanicalPoint
}
export function getDoorMotionBindings(doors: PassengerDoorSystemModel, pose: SimulationPose) {
  return [...doors.cabin, ...doors.landings].map((entry) => ({
    entryId: entry.id, offsetY: entry.role === 'cabin' ? pose.cabinOffsetY : metres(0),
    panels: entry.panels.map((panel) => ({ name: doorPanelGroupName(panel.id), offset: getDoorPanelOffset(entry, panel, pose) })),
  }))
}
