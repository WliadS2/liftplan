import { useMemo } from 'react'
import { MechanicalVisualMeshes } from './MechanicalVisualMeshes'
import { withMechanicalGuideContext,type MechanicalVisualInput } from './mechanical-visual-model'
import { resolveMechanicalVisual } from './resolve-mechanical-visual'

/** Stable component parent remains beneath its existing family moving/fixed group. */
export function ConfiguredMechanicalPart({input,assemblies,opacity=1}:{readonly input:MechanicalVisualInput;
  readonly assemblies:readonly MechanicalVisualInput[];readonly opacity?:number}) {
  const model = useMemo(()=>resolveMechanicalVisual(withMechanicalGuideContext(input,assemblies)),[input,assemblies])
  return <group name={input.id} position={input.center} userData={{semanticKind:input.kind,componentSource:input.componentSource}}>
    <MechanicalVisualMeshes model={model} opacity={opacity}/>
  </group>
}
