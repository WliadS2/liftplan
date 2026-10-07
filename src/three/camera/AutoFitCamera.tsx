import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type ElementRef } from 'react'
import { calculateCameraFit, CAMERA_MAX_POLAR_ANGLE, CAMERA_MIN_POLAR_ANGLE, type CameraFrame } from './camera-fit'
import {
  getCameraFrameTrigger, transitionCameraInteraction,
  type CameraFrameRequest, type CameraInteractionState,
} from './camera-interaction-policy'

export interface AutoFitCameraProps {
  readonly frame: CameraFrame
  readonly request: Omit<CameraFrameRequest, 'viewportKey'>
  /** Render-neutral rigid camera translation; never re-fit on animation ticks. */
  readonly motion?: { readonly identity: object; readonly getOffset: () => readonly [number, number, number] }
}

/** Owns camera framing and OrbitControls locally; it never mutates scene/model transforms. */
export function AutoFitCamera({ frame, request, motion }: AutoFitCameraProps) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)
  const previousRequest = useRef<CameraFrameRequest | undefined>(undefined)
  const interactionState = useRef<CameraInteractionState>('auto')
  const previousMotion = useRef<object | undefined>(undefined)
  const previousOffset = useRef<readonly [number, number, number]>([0, 0, 0])

  useFrame(({ camera, size }) => {
    const nextRequest: CameraFrameRequest = { ...request, viewportKey: `${size.width}:${size.height}` }
    const runtimeChanged = previousMotion.current !== motion?.identity
    previousMotion.current = motion?.identity
    const trigger = getCameraFrameTrigger(runtimeChanged ? undefined : previousRequest.current, nextRequest)
    const decision = transitionCameraInteraction(interactionState.current, trigger)
    previousRequest.current = nextRequest
    interactionState.current = decision.state
    if (!controlsRef.current) return
    const offset = motion?.getOffset() ?? [0, 0, 0]
    if (!decision.reframe) {
      const delta = offset.map((value, axis) => value - previousOffset.current[axis])
      if (delta.some((value) => value !== 0)) {
        camera.position.set(camera.position.x + delta[0], camera.position.y + delta[1], camera.position.z + delta[2])
        controlsRef.current.target.set(controlsRef.current.target.x + delta[0], controlsRef.current.target.y + delta[1], controlsRef.current.target.z + delta[2])
      }
      previousOffset.current = offset
      return
    }
    previousOffset.current = offset

    const fit = calculateCameraFit(frame.bounds, frame.target, size, undefined, undefined, frame.direction)
    camera.up.set(...fit.up)
    camera.position.set(...fit.position)
    camera.position.x += offset[0]; camera.position.y += offset[1]; camera.position.z += offset[2]
    camera.near = fit.near
    camera.far = fit.far
    camera.lookAt(fit.target[0] + offset[0], fit.target[1] + offset[1], fit.target[2] + offset[2])
    camera.updateProjectionMatrix()
    controlsRef.current.target.set(fit.target[0] + offset[0], fit.target[1] + offset[1], fit.target[2] + offset[2])
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
