import { Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { createTechnicalSceneLabelElement } from './technical-scene-label'

type Vector = readonly [number, number, number]

/** Render-space wire box/plane. Line thickness and dash lengths are visual symbols only. */
export function TechnicalEnvelope({ size, color, opacity = 1, lineWidth = 1, dashed = false }: {
  readonly size: Vector; readonly color: string; readonly opacity?: number
  readonly lineWidth?: number; readonly dashed?: boolean
}) {
  const [x, y, z] = size.map((v) => v / 2)
  const p: Vector[] = [[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]]
  const pairs = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
  const seen = new Set<string>()
  const points = pairs.flatMap(([a,b]) => {
    const key = [p[a].join(','),p[b].join(',')].sort().join('|')
    if (key.split('|')[0] === key.split('|')[1] || seen.has(key)) return []
    seen.add(key)
    return [p[a],p[b]]
  })
  return <Line points={points} segments color={color} opacity={opacity} transparent
    lineWidth={lineWidth} dashed={dashed} dashSize={0.16} gapSize={0.08} depthWrite={false} />
}

/** DOM labels avoid downloading fonts or introducing external 3D assets. */
export function TechnicalSceneLabel({ position, children }: { readonly position: Vector; readonly children: string }) {
  const { gl } = useThree()
  const anchor = useRef<Group>(null)
  const element = useRef<HTMLSpanElement | undefined>(undefined)
  const projected = useRef(new Vector3())
  useEffect(() => {
    const parent = gl.domElement.parentElement
    if (!parent) return
    const label = createTechnicalSceneLabelElement(parent, children)
    element.current = label
    return () => { label.remove(); element.current = undefined }
  }, [gl, children])
  useFrame(({ camera, size }) => {
    if (!element.current || !anchor.current) return
    anchor.current.getWorldPosition(projected.current).project(camera)
    const p = projected.current
    element.current.style.display = p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1 ? 'none' : 'block'
    element.current.style.transform = `translate(${(p.x+1)*size.width/2}px,${(1-p.y)*size.height/2}px) translate(-50%,-50%)`
  })
  return <group ref={anchor} position={position} />
}
