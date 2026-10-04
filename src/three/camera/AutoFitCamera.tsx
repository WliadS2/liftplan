import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type ElementRef } from 'react'
import type { PassengerCameraFrame } from './passenger-camera-bounds'
import { calculateCameraFit, CAMERA_MAX_POLAR_ANGLE, CAMERA_MIN_POLAR_ANGLE } from './camera-fit'
import {
  getCameraFrameTrigger, transitionCameraInteraction,
  type CameraFrameRequest, type CameraInteractionState,
} from './camera-interaction-policy'
import type { PassengerSimulationController } from '../../simulation/passenger-simulation'
import type { PassengerSimulationInputs } from '../../simulation/passenger-simulation-model'
import { getPassengerSimulationCameraFrame } from './passenger-simulation-camera-frame'

export interface AutoFitCameraProps {
  readonly frame: PassengerCameraFrame
  readonly request: Omit<CameraFrameRequest, 'viewportKey'>
  readonly simulation?: PassengerSimulationController
  readonly simulationInputs?: PassengerSimulationInputs
}

/** Owns camera framing and OrbitControls locally; it never mutates scene/model transforms. */
export function AutoFitCamera({ frame, request, simulation, simulationInputs }: AutoFitCameraProps) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)
  const previousRequest = useRef<CameraFrameRequest | undefined>(undefined)
  const interactionState = useRef<CameraInteractionState>('auto')

  useFrame(({ camera, size }) => {
    const nextRequest: CameraFrameRequest = { ...request, viewportKey: `${size.width}:${size.height}` }
    const trigger = getCameraFrameTrigger(previousRequest.current, nextRequest)
    const decision = transitionCameraInteraction(interactionState.current, trigger)
    previousRequest.current = nextRequest
    interactionState.current = decision.state
    if (!decision.reframe || !controlsRef.current) return

    const effectiveFrame = simulation && simulationInputs
      ? getPassengerSimulationCameraFrame(request.viewMode, frame, simulationInputs, simulation.getPose()) : frame
    const fit = calculateCameraFit(effectiveFrame.bounds, effectiveFrame.target, size)
    camera.up.set(...fit.up)
    camera.position.set(...fit.position)
    camera.near = fit.near
    camera.far = fit.far
    camera.lookAt(...fit.target)
    camera.updateProjectionMatrix()
    controlsRef.current.target.set(...fit.target)
    controlsRef.current.minDistance = fit.minDistance
    controlsRef.current.maxDistance = fit.maxDistance
    controlsRef.current.update()
  })

  return <OrbitControls
    ref={controlsRef}
    makeDefault
    enableDamping
    dampingFactor={0.075}
    enablePan
    enableRotate
    enableZoom
    rotateSpeed={0.72}
    zoomSpeed={0.9}
    panSpeed={0.8}
    minPolarAngle={CAMERA_MIN_POLAR_ANGLE}
    maxPolarAngle={CAMERA_MAX_POLAR_ANGLE}
    onStart={() => {
      interactionState.current = transitionCameraInteraction(interactionState.current, 'user-interaction').state
    }}
  />
}
