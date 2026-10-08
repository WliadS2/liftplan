import type { MechanicalVisualDetail,MechanicalVisualInput,MechanicalVisualPiece,VisualVector } from '../../three/geometry/mechanical/mechanical-visual-model'

/** DEV-only synthetic display proportions inside existing envelopes. NOT hardware data,
 * manufacturer geometry, physical shaft/hub sizes, certification or planning defaults. */
export function createDemoMechanicalVisualDetail(input:MechanicalVisualInput):MechanicalVisualDetail | undefined {
  if (input.componentSource !== 'demo') return undefined
  const [w,h,d] = input.size
  const pieces:MechanicalVisualPiece[] = []
  const box = (id:string,center:VisualVector,size:VisualVector,material:MechanicalVisualPiece['material']) =>
    pieces.push({id,kind:'box',center,size,material})
  const cylinder = (id:string,center:VisualVector,radius:number,length:number,axis:'x'|'y'|'z',material:MechanicalVisualPiece['material']) =>
    pieces.push({id,kind:'cylinder',center,radius,length,axis,material})
  if (input.kind === 'machine') {
    box('mounting-foot',[0,-h*0.42,0],[w,h*0.16,d],'support')
    box('housing',[0,h*0.08,-d*0.15],[w*0.76,h*0.84,d*0.7],'machine')
    cylinder('end-housing',[0,h*0.08,d*0.29],Math.min(w*0.38,h*0.42),d*0.18,'z','machine')
    cylinder('shaft-symbol',[0,h*0.08,d*0.43],Math.min(w,h)*0.1,d*0.14,'z','plunger')
  } else if (input.kind === 'traction-sheave') {
    const r = Math.min(w,h)/2
    pieces.push({id:'grooved-wheel',kind:'revolved',center:[0,0,0],axis:'z',material:'sheave',section:[
      [r*0.2,-d/2],[r*0.45,-d/2],[r*0.45,-d*0.32],[r,-d*0.32],
      [r,-d*0.14],[r*0.86,-d*0.08],[r*0.86,d*0.08],[r,d*0.14],
      [r,d*0.32],[r*0.45,d*0.32],[r*0.45,d/2],[r*0.2,d/2],[r*0.2,-d/2],
    ]})
    cylinder('shaft-symbol',[0,0,0],r*0.19,d,'z','plunger')
  } else if (input.kind === 'machine-support') {
    // Two explicitly schematic channel-like mounting members, not inferred support sizing.
    for (const sign of [-1,1]) box(`support-${sign}`,[0,0,sign*d*0.38],[w,h,d*0.24],'support')
  } else if (input.kind === 'counterweight-frame') {
    const stack = input.relatedStack
    const side = Math.min(w*0.1,stack ? w/2-Math.abs(stack.center[0])-stack.size[0]/2 : w*0.1)
    const bottom = Math.min(h*0.1,stack ? stack.center[1]-stack.size[1]/2+h/2 : h*0.1)
    const top = Math.min(h*0.1,stack ? h/2-stack.center[1]-stack.size[1]/2 : h*0.1)
    if (Math.min(side,bottom,top) <= 0) return undefined
    for (const sign of [-1,1]) box(`side-${sign}`,[sign*(w-side)/2,0,0],[side,h,d],'frame')
    box('cross-bottom',[0,-h/2+bottom/2,0],[w-2*side,bottom,d],'frame')
    box('cross-top',[0,h/2-top/2,0],[w-2*side,top,d],'frame')
  } else if (input.kind === 'counterweight-stack') {
    for (let i=0;i<8;i++) box(`slab-${i}`,[0,-h/2+(i+0.5)*h/8,0],[w,h/8*0.94,d],'weight')
  } else if (input.kind === 'suspension-hitch') {
    box('anchor-plate',[0,-h*0.35,0],[w,h*0.3,d],'hitch')
    cylinder('termination-symbol',[0,h*0.15,0],Math.min(w,d)*0.18,h*0.7,'y','plunger')
  } else if (input.kind === 'hydraulic-cylinder') {
    const r = Math.min(w,d)/2
    // Hollow schematic housing and head land. A single section avoids coplanar collars.
    // These proportions do not imply real seals, wall thickness or telescopic stages.
    pieces.push({id:'housing-head-collar',kind:'revolved',center:[0,0,0],axis:'y',material:'machine',section:[
      [r*0.64,-h/2],[r*0.9,-h/2],[r*0.9,h*0.32],[r,h*0.32],
      [r,h/2],[r*0.64,h/2],[r*0.64,-h/2],
    ]})
  } else if (input.kind === 'hydraulic-plunger') {
    // The entire detail is a single extension envelope; no seal/head rides on its scaled mesh.
    cylinder('extension-envelope',[0,0,0],Math.min(w,d)/2,h,'y','plunger')
  } else if (input.kind === 'hydraulic-base') {
    box('base-plate',[0,-h*0.3,0],[w,h*0.4,d],'support')
    cylinder('housing-seat',[0,h*0.2,0],Math.min(w,d)*0.4,h*0.6,'y','frame')
  } else if (input.kind === 'hydraulic-connection') {
    // Full footprint preserves the declared platform-side attachment, without invented fasteners.
    box('connection-plate',[0,-h*0.2,0],[w,h*0.6,d],'support')
    cylinder('connection-seat',[w*0.25,h*0.3,0],Math.min(w*0.25,d/2),h*0.4,'y','hitch')
  } else if (input.kind === 'carrier-frame') {
    const axis = h >= Math.max(w,d) ? 'y' : w >= d ? 'x' : 'z'
    const u = axis === 'x' ? h : w,v = axis === 'y' || axis === 'x' ? d : h
    const t = Math.min(u,v)*0.16
    pieces.push({id:'channel-section',kind:'profile',center:[0,0,0],axis,length:axis === 'x' ? w : axis === 'y' ? h : d,material:'frame',section:[
      [-u/2,-v/2],[u/2,-v/2],[u/2,v/2],[u/2-t,v/2],
      [u/2-t,-v/2+t],[-u/2+t,-v/2+t],[-u/2+t,v/2],[-u/2,v/2],
    ]})
  } else if (['guide','counterweight-rail'].includes(input.kind) && input.guideFacing) {
    const xPair = input.guideFacing.startsWith('x'),sign = input.guideFacing.endsWith('positive') ? 1 : -1
    const flange = xPair ? d : w,depth = xPair ? w : d,t = depth*0.18,web = flange*0.25
    const section:readonly (readonly [number,number])[] = [
      [-flange/2,-depth/2],[flange/2,-depth/2],[flange/2,-depth/2+t],
      [web/2,-depth/2+t],[web/2,depth/2-t],[flange/4,depth/2-t],
      [flange/4,depth/2],[-flange/4,depth/2],[-flange/4,depth/2-t],
      [-web/2,depth/2-t],[-web/2,-depth/2+t],[-flange/2,-depth/2+t],
    ]
    pieces.push({id:'guide-profile',kind:'profile',center:[0,0,0],axis:'y',length:h,material:'rail',
      section:section.map(([u,v])=>xPair ? [sign*v,u] : [u,sign*v])})
  } else if (['guide-shoe','counterweight-shoe'].includes(input.kind) && input.relatedRailSize && input.guideFacing) {
    const xPair = input.guideFacing.startsWith('x'),sign = input.guideFacing.endsWith('positive') ? 1 : -1
    const outer = xPair ? w : d,across = xPair ? d : w
    const rail = xPair ? input.relatedRailSize[0] : input.relatedRailSize[2]
    const railAcross = xPair ? input.relatedRailSize[2] : input.relatedRailSize[0]
    if (outer <= rail || across <= railAcross) return undefined
    const at = (a:number,z:number):VisualVector => xPair ? [a,0,z] : [z,0,a]
    const size = (a:number,z:number):VisualVector => xPair ? [a,h,z] : [z,h,a]
    box('shoe-back',at(sign*(rail/2+(outer-rail)/4),0),size((outer-rail)/2,across),'shoe')
    for (const side of [-1,1]) box(`contact-liner-${side}`,at(sign*(-outer+rail)/4,side*(railAcross/2+(across-railAcross)/4)),
      size((outer+rail)/2,(across-railAcross)/2),'liner')
  } else if (input.kind === 'floor-structure') {
    box('floor-plate',[0,h*0.15,0],[w,h*0.7,d],'support')
    box('floor-edge',[0,-h*0.35,0],[w,h*0.3,d],'frame')
  } else if (input.kind === 'buffer' && !input.id.endsWith('-base')) {
    cylinder('buffer-section',[0,0,0],Math.min(w,d)/2,h,'y',input.id.endsWith('-contact') ? 'plunger' : 'buffer')
  }
  return pieces.length ? {source:'demo',reference:'LiftPlan DEV schematic display v1',pieces} : undefined
}

/** Synthetic rope thickness for this DEV schematic route only, not physical rope data. */
export const demoDriveRouteDiameter = (id:string):number | undefined => id === 'goods-suspension-route' ? 0.012 : undefined
