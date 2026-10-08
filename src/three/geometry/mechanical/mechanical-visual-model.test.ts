import { describe,expect,it,vi } from 'vitest'
import { Box3,BufferAttribute,BufferGeometry,Euler,Group,Line,LineBasicMaterial,Matrix4,Mesh,Quaternion,Vector3,type Object3D } from 'three'
import { createGoodsLiftQaFixture } from '../../../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../../../dev/fixtures/car-lift-qa-fixture'
import { createLiftFamilyTechnicalModel } from '../../../lift-families/technical-family-model'
import { hasConfiguredMechanicalVisual,prepareMechanicalVisualModel,visualPieceSize,withMechanicalGuideContext,withMechanicalVisualContext,type MechanicalVisualDetail,type MechanicalVisualInput,type MechanicalVisualPiece } from './mechanical-visual-model'
import { resolveDriveRouteDiameter,resolveMechanicalVisual } from './resolve-mechanical-visual'
import { bindCarrierDriveScene } from '../carrier/carrier-drive-render-bindings'
import { driveMotionFactor,driveRouteSegmentName } from '../carrier/carrier-drive-motion'
import { createMechanicalPieceGeometry,createMechanicalVisualResources,mechanicalGeometryKey,visualAxisRotation,visualPieceScale } from './mechanical-visual-geometry'

const input:MechanicalVisualInput = {id:'test',kind:'machine',componentSource:'planning',size:[1,2,3]}
function detail(pieces:readonly MechanicalVisualPiece[]):MechanicalVisualDetail {return {source:'verified',reference:'explicit test detail',pieces}}
export function expectInsideEnvelope(model:ReturnType<typeof prepareMechanicalVisualModel>,size:readonly number[]) {
  for (const piece of model.pieces) {
    const geometry = createMechanicalPieceGeometry(piece)
    const matrix = new Matrix4().compose(new Vector3(...piece.center),new Quaternion().setFromEuler(new Euler(...(piece.kind === 'box' ? [0,0,0] as const : visualAxisRotation(piece.axis)))),new Vector3(...visualPieceScale(piece)))
    geometry.applyMatrix4(matrix);geometry.computeBoundingBox()
    for (const axis of ['x','y','z'] as const) {
      const index = ['x','y','z'].indexOf(axis)
      expect(geometry.boundingBox!.min[axis]).toBeGreaterThanOrEqual(-size[index]/2-1e-6)
      expect(geometry.boundingBox!.max[axis]).toBeLessThanOrEqual(size[index]/2+1e-6)
    }
    expect(geometry.getAttribute('position').count).toBeLessThan(5000)
    geometry.dispose()
  }
}
export function sceneFor(family:'goods'|'car',count=6) {
  const configuration = family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
  const technical = createLiftFamilyTechnicalModel({...configuration,stopCount:count,storeyHeightsMm:Array.from({length:count-1},()=>configuration.storeyHeightsMm![0])})
  if (technical.status !== 'available' || technical.family === 'passenger' || !technical.scene) throw Error('Expected carrier scene')
  return technical.scene
}

describe('optional render-only detail contract',()=>{
  it('preserves envelope fallback without fabricating missing detail or applying demo data to production',()=>{
    for (const source of ['planning','verified','visualization',undefined] as const) {
      expect(resolveMechanicalVisual({...input,componentSource:source},undefined,true)).toMatchObject({status:'envelope',reason:'missing-detail'})
    }
    expect(resolveMechanicalVisual({...input,componentSource:'demo'},undefined,false)).toMatchObject({status:'envelope'})
    expect(prepareMechanicalVisualModel(input,{source:'demo',reference:'demo',pieces:[]})).toMatchObject({reason:'source-mismatch'})
  })
  it('accepts supplied verified geometry without changing the input',()=>{
    const original = structuredClone(input)
    const model = prepareMechanicalVisualModel(input,detail([{id:'housing',kind:'box',center:[0,0,0],size:[1,2,3],material:'machine'}]))
    expect(model.status).toBe('detail');expectInsideEnvelope(model,input.size);expect(input).toEqual(original)
  })
  it('rejects nonfinite, oversized, duplicate, empty and excessive detail without changing validation envelopes',()=>{
    const piece:MechanicalVisualPiece = {id:'housing',kind:'box',center:[0,0,0],size:[1,2,3],material:'machine'}
    for (const pieces of [[],[piece,piece],[{...piece,size:[NaN,2,3] as const}],[{...piece,center:[1,0,0] as const}],
      [{...piece,size:[2,2,3] as const}],Array.from({length:65},(_,i)=>({...piece,id:String(i)}))]) {
      expect(prepareMechanicalVisualModel(input,detail(pieces))).toMatchObject({status:'envelope',reason:'invalid-detail'})
    }
  })
  it.each(['x','y','z'] as const)('keeps cylinder/revolved/profile geometry inside its %s-axis declared envelope',axis=>{
    const pieces:MechanicalVisualPiece[] = [
      {id:'cylinder',kind:'cylinder',center:[0,0,0],radius:0.1,length:0.8,axis,material:'plunger'},
      {id:'wheel',kind:'revolved',center:[0,0,0],section:[[0.1,-0.3],[0.2,-0.3],[0.2,0.4],[0.1,0.4],[0.1,-0.3]],axis,material:'sheave'},
      {id:'profile',kind:'profile',center:[0,0,0],section:[[-0.1,-0.2],[0.1,-0.2],[0.1,0.2],[-0.1,0.2]],length:0.8,axis,material:'frame'},
    ]
    const model = prepareMechanicalVisualModel(input,detail(pieces))
    expect(model.status).toBe('detail');expectInsideEnvelope(model,input.size)
    expect(pieces.map(visualPieceSize).flat().every(Number.isFinite)).toBe(true)
  })
  it('shares repeated geometry/materials and releases every owned resource',()=>{
    const model = resolveMechanicalVisual({...input,componentSource:'demo'},undefined,true)
    const resources = createMechanicalVisualResources([model,model])
    expect(resources.geometry.size).toBe(2);expect(resources.materials.size).toBe(3)
    const disposals = [...resources.geometry.values(),...resources.edges.values(),...resources.materials.values(),resources.edgeMaterial].map(r=>vi.spyOn(r,'dispose'))
    resources.dispose();disposals.forEach(d=>expect(d).toHaveBeenCalledOnce())
  })
})

describe('Auto hydraulic fidelity stage',()=>{
  it.each([2,6,10])('keeps housing/head/base/connection and the extension envelope bounded at %i stops',count=>{
    const scene = sceneFor('car',count),drive = scene.drive!,nodes = new Map<string,Object3D>(),root = new Group()
    const owned:ReturnType<typeof createMechanicalVisualResources>[] = []
    for (const part of drive.parts) {
      const contextual = withMechanicalVisualContext(part,scene.drive!.parts)
      const model = resolveMechanicalVisual(contextual,undefined,true)
      if (part.kind.startsWith('hydraulic')) {expect(model.status).toBe('detail');expectInsideEnvelope(model,part.size)}
      const motion = new Group(),shape = new Group()
      motion.name=`drive-motion-${part.id}`;shape.name=`drive-shape-${part.id}`;shape.position.set(...part.center)
      nodes.set(motion.name,motion);nodes.set(shape.name,shape);motion.add(shape);root.add(motion)
      const resources = createMechanicalVisualResources([model]);owned.push(resources)
      for (const piece of model.pieces) {
        const mesh = new Mesh(resources.geometry.get(mechanicalGeometryKey(piece)),resources.materials.get(piece.material))
        mesh.position.set(...piece.center);mesh.scale.set(...visualPieceScale(piece))
        if (piece.kind !== 'box') mesh.rotation.set(...visualAxisRotation(piece.axis))
        shape.add(mesh)
      }
    }
    const apply = bindCarrierDriveScene(drive,nodes),travel = drive.carrierTravelMetres!
    const partOf = (kind:string)=>drive.parts.find(p=>p.kind === kind)!
    const bounds = (kind:string)=>new Box3().setFromObject(nodes.get(`drive-shape-${partOf(kind).id}`)!)
    root.updateMatrixWorld(true)
    const housing = bounds('hydraulic-cylinder').clone(),base = bounds('hydraulic-base').clone()
    const initialBottom = bounds('hydraulic-plunger').min.y
    for (const offset of [0,travel/2,travel,travel/2,0]) {
      apply(offset);root.updateMatrixWorld(true)
      expect(bounds('hydraulic-cylinder')).toEqual(housing);expect(bounds('hydraulic-base')).toEqual(base)
      expect(bounds('hydraulic-plunger').min.y).toBeCloseTo(initialBottom,6)
      expect(bounds('hydraulic-plunger').max.y).toBeCloseTo(bounds('hydraulic-connection').min.y,5)
      expect(nodes.get(`drive-motion-${partOf('hydraulic-connection').id}`)!.position.y).toBe(offset)
    }
    expect(nodes.size).toBe(drive.parts.length*2)
    owned.forEach(r=>r.dispose())
  })
})

describe('shared carrier/guidance fidelity stage',()=>{
  for (const family of ['goods','car'] as const) it.each([2,6,10])(`${family} keeps explicit profiles and guide interfaces within the same envelopes at %i stops`,count=>{
    const scene = sceneFor(family,count),boxes = scene.assemblies.filter(a=>'center' in a)
    const parts = boxes.filter(p=>['carrier-frame','floor-structure','guide','guide-shoe','buffer','counterweight-rail','counterweight-shoe'].includes(p.kind))
    expect(parts.some(p=>p.kind === 'guide-shoe')).toBe(true)
    for (const part of parts) {
      const input = withMechanicalGuideContext(part,boxes),model = resolveMechanicalVisual(input,undefined,true)
      if (part.kind !== 'buffer' || !part.id.endsWith('-base')) expect(model.status).toBe('detail')
      expectInsideEnvelope(model,part.size)
      expect(model).toEqual(resolveMechanicalVisual(input,undefined,true))
      expect(resolveMechanicalVisual(input,undefined,false).status).toBe('envelope')
      if (part.kind === 'guide-shoe' || part.kind === 'counterweight-shoe') {
        expect(input.relatedRailSize).toBeDefined()
        const rail = input.relatedRailSize!
        for (const piece of model.pieces) {
          const size = visualPieceSize(piece)
          const overlapsCore = [0,2].every(axis=>piece.center[axis]-size[axis]/2 < rail[axis]/2-1e-9 && piece.center[axis]+size[axis]/2 > -rail[axis]/2+1e-9)
          expect(overlapsCore).toBe(false)
        }
      }
    }
  })
  it('does not fabricate shoe cavities or profiled rails without a resolved guide pair',()=>{
    const shoe:MechanicalVisualInput = {...input,kind:'guide-shoe',componentSource:'demo',center:[0,0,0]}
    expect(resolveMechanicalVisual(withMechanicalGuideContext(shoe,[]),undefined,true).status).toBe('envelope')
    expect(resolveMechanicalVisual({...shoe,kind:'guide'},undefined,true).status).toBe('envelope')
  })
  it.each(['goods','car'] as const)('%s detail tessellation stays bounded and independent of stop count',family=>{
    const budgets = [2,6,10].map(count=>{
      const boxes = sceneFor(family,count).assemblies.filter(a=>'center' in a)
      const models = boxes.filter(p=>hasConfiguredMechanicalVisual(p) || 'driveAttachment' in p)
        .map(p=>resolveMechanicalVisual(withMechanicalVisualContext(p,boxes),undefined,true))
      const resources = createMechanicalVisualResources(models)
      const pieces = models.flatMap(m=>m.pieces)
      const vertices = pieces.reduce((sum,p)=>sum+resources.geometry.get(mechanicalGeometryKey(p))!.getAttribute('position').count,0)
      // Rendering regression budgets, not engineering component or installation limits.
      expect(pieces.length).toBeLessThan(150);expect(vertices).toBeLessThan(25000)
      expect(resources.geometry.size).toBeLessThan(pieces.length)
      resources.dispose()
      return {meshes:pieces.length,vertices}
    })
    expect(budgets[0]).toEqual(budgets[1]);expect(budgets[1]).toEqual(budgets[2])
  })
})

describe('Goods traction fidelity stage',()=>{
  it.each([2,6,10])('adds bounded deterministic schematic subassemblies for configured demo parts at %i stops',count=>{
    const scene = sceneFor('goods',count),before = structuredClone(scene)
    const parts = scene.drive!.parts.filter(p=>['machine','machine-support','traction-sheave','counterweight-frame','counterweight-stack','suspension-hitch'].includes(p.kind))
    expect(parts.length).toBeGreaterThan(6)
    for (const part of parts) {
      const contextual = withMechanicalVisualContext(part,scene.drive!.parts)
      const model = resolveMechanicalVisual(contextual,undefined,true)
      expect(model.status).toBe('detail');expect(model.source).toBe('demo')
      expect(model).toEqual(resolveMechanicalVisual(contextual,undefined,true));expectInsideEnvelope(model,part.size)
      expect(resolveMechanicalVisual(part,undefined,false).status).toBe('envelope')
    }
    expect(scene).toEqual(before)
  })
  it('keeps synthetic frame members out of the actual counterweight stack envelope',()=>{
    const scene = sceneFor('goods'),frame = scene.drive!.parts.find(p=>p.kind === 'counterweight-frame')!
    const input = withMechanicalVisualContext(frame,scene.drive!.parts),stack = input.relatedStack!
    const model = resolveMechanicalVisual(input,undefined,true)
    expect(model.status).toBe('detail')
    for (const piece of model.pieces) {
      const size = visualPieceSize(piece)
      expect([0,1,2].every(axis=>piece.center[axis]-size[axis]/2 < stack.center[axis]+stack.size[axis]/2-1e-9 &&
        piece.center[axis]+size[axis]/2 > stack.center[axis]-stack.size[axis]/2+1e-9)).toBe(false)
    }
  })
  it('retains line-only routes without explicit display diameter outside the DEV schematic',()=>{
    const drive = sceneFor('goods').drive!,route = drive.routes[0]
    expect(resolveDriveRouteDiameter(drive,route.id,true)).toBe(0.012)
    expect(resolveDriveRouteDiameter(drive,route.id,false)).toBeUndefined()
    expect(resolveDriveRouteDiameter(drive,'missing-route',true)).toBeUndefined()
    expect(resolveDriveRouteDiameter({...drive,parts:drive.parts.map(p=>({...p,componentSource:'planning'}))},route.id,true)).toBeUndefined()
  })
  it.each([2,6,10])('keeps rendered suspension segment endpoints attached at idle/mid/top/return with %i stops',count=>{
    const drive = sceneFor('goods',count).drive!,nodes = new Map<string,Object3D>()
    const geometries:BufferGeometry[] = [],materials:LineBasicMaterial[] = []
    for (const route of drive.routes) {
      const geometry = new BufferGeometry(),material = new LineBasicMaterial()
      geometry.setAttribute('position',new BufferAttribute(new Float32Array(route.points.flatMap(p=>[...p.position])),3))
      nodes.set(route.id,new Line(geometry,material));geometries.push(geometry);materials.push(material)
      route.points.slice(1).forEach((_,index)=>{
        const mesh = new Group();mesh.scale.set(0.006,1,0.006)
        nodes.set(driveRouteSegmentName(route.id,index),mesh)
      })
    }
    const update = bindCarrierDriveScene(drive,nodes),travel = drive.carrierTravelMetres!
    for (const offset of [0,travel/2,travel,travel/2,0]) {
      update(offset)
      for (const route of drive.routes) for (let index=0;index<route.points.length-1;index++) {
        const mesh = nodes.get(driveRouteSegmentName(route.id,index))!
        mesh.updateMatrixWorld(true)
        for (const [end,sign] of [[index,-1],[index+1,1]] as const) {
          const point = route.points[end],actual = new Vector3(0,sign/2,0).applyMatrix4(mesh.matrixWorld)
          const expected = [point.position[0],point.position[1]+offset*driveMotionFactor(drive,point.attachment)!,point.position[2]]
          actual.toArray().forEach((value,axis)=>expect(value).toBeCloseTo(expected[axis],5))
        }
        expect(mesh.scale.x).toBe(0.006);expect(mesh.scale.z).toBe(0.006)
      }
    }
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
  })
})
