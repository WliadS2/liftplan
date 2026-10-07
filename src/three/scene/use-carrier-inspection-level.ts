import { useSyncExternalStore } from 'react'

interface InspectionController {
  readonly subscribe: (listener:()=>void)=>()=>void
  readonly getSnapshot: ()=>{readonly state:{readonly currentLevel:string}}
}

const subscribeNone = () => () => {}
const noSnapshot = () => undefined
/** Boundary notifications only; not a frame-by-frame React camera update. */
export function useCarrierInspectionLevel(controller: InspectionController | undefined, firstLevel?: string) {
  const snapshot = useSyncExternalStore(controller?.subscribe ?? subscribeNone, controller?.getSnapshot ?? noSnapshot)
  return snapshot?.state.currentLevel ?? firstLevel
}
