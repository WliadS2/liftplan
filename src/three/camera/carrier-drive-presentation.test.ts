import { describe,expect,it } from 'vitest'
import { PerspectiveCamera,Vector3 } from 'three'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { createLiftFamilyTechnicalModel } from '../../lift-families/technical-family-model'
import { getCarLiftCameraFrame } from './car-lift-camera'
import { getGoodsLiftCameraFrame } from './goods-lift-camera'
import { calculateCameraFit,type CameraBounds,type CameraVector } from './camera-fit'
import { getDriveInspectionCameraPolicy } from './view-camera-policy'
import { getCameraFrameTrigger, transitionCameraInteraction } from './camera-interaction-policy'
import { createCarLiftRenderModel } from '../geometry/car/car-lift-render-model'
import { createGoodsLiftRenderModel } from '../geometry/goods/goods-lift-render-model'
import { driveMotionFactor } from '../geometry/carrier/carrier-drive-motion'

function data(family:'car'|'goods',count=6) {
  const fixture = family === 'car' ? createCarLiftQaFixture() : createGoodsLiftQaFixture()
  const technical = createLiftFamilyTechnicalModel({...fixture,stopCount:count,
    storeyHeightsMm:Array.from({length:count-1},()=>fixture.storeyHeightsMm![0])})
  if (technical.status !== 'available' || technical.family === 'passenger' || !technical.scene) throw Error('Expected scene')
  return technical
}
function contains(bounds:CameraBounds,point:readonly number[]) {
  point.forEach((value,axis)=>{
    expect(value).toBeGreaterThanOrEqual(bounds.min[axis]-1e-9)
    expect(value).toBeLessThanOrEqual(bounds.max[axis]+1e-9)
  })
}
function expectFits(bounds:CameraBounds,target:CameraVector,direction:CameraVector|undefined) {
  for (const size of [{width:1280,height:720},{width:360,height:700}]) {
    const fit = calculateCameraFit(bounds,target,size,undefined,undefined,direction)
    const camera = new PerspectiveCamera(38,size.width/size.height,fit.near,fit.far)
    camera.position.set(...fit.position);camera.up.set(...fit.up);camera.lookAt(...fit.target);camera.updateMatrixWorld()
    for (const x of [bounds.min[0],bounds.max[0]]) for (const y of [bounds.min[1],bounds.max[1]]) for (const z of [bounds.min[2],bounds.max[2]]) {
      const ndc = new Vector3(x,y,z).project(camera)
      expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1)
      expect(Math.abs(ndc.z)).toBeLessThanOrEqual(1)
    }
    expect(fit.minDistance).toBeLessThan(fit.distance)
    expect(fit.maxDistance).toBeGreaterThan(fit.distance)
  }
}

describe('contextual drive presentation and existing camera ownership',()=>{
  it.each([2,6,10])('hydraulic reference detail contains the complete carrier connection/context without full-stroke fitting at %i stops',count=>{
    const technical = data('car',count)
    if (technical.family !== 'car') throw Error('Expected Auto')
    const scene = technical.scene!,render = createCarLiftRenderModel(scene,'drive')
    const frame = getCarLiftCameraFrame(scene,'drive','level-1')
    expect(render.assemblies.map((a)=>a.kind)).toEqual(expect.arrayContaining([
      'platform','carrier-frame','floor-structure','guide-shoe','guide','hydraulic-cylinder','hydraulic-base','hydraulic-plunger','hydraulic-connection',
    ]))
    expect(render.assemblies.some((a)=>['vehicle-body','shaft','safety-gear','landing-door','platform-wall'].includes(a.kind))).toBe(false)
    expect(render.assemblies.find((a)=>a.kind === 'platform')?.appearance).toMatchObject({presentation:'outline',opacity:0.25})
    for (const a of render.assemblies.filter((a)=>'center' in a && ['platform','carrier-frame','floor-structure','hydraulic-cylinder','hydraulic-base','hydraulic-connection'].includes(a.kind))) {
      if (!('center' in a)) continue
      contains(frame.bounds,a.center.map((v,i)=>v-a.size[i]/2));contains(frame.bounds,a.center.map((v,i)=>v+a.size[i]/2))
    }
    expect(frame.bounds.height).toBeLessThan(5)
    expect(getCarLiftCameraFrame(scene,'drive',`level-${count}`)).toEqual(frame)
    expect(getDriveInspectionCameraPolicy(scene.drive?.concept)).toBe('moving-detail')
    expectFits(frame.bounds,frame.target,frame.direction)
    // Camera and carrier-connection receive the same rigid displacement. The fixed
    // cylinder/base is never moved to keep it in a local view at upper stops.
    const connection = scene.drive!.parts.find((p)=>p.kind === 'hydraulic-connection')!
    const cylinder = scene.drive!.parts.find((p)=>p.kind === 'hydraulic-cylinder')!
    for (const offset of [0,scene.drive!.carrierTravelMetres!/2,scene.drive!.carrierTravelMetres!]) {
      expect(connection.center[1]+offset-(frame.target[1]+offset)).toBeCloseTo(connection.center[1]-frame.target[1],12)
      expect(driveMotionFactor(scene.drive!,cylinder.driveAttachment)).toBe(0)
    }
  })
  it.each([2,6,10])('traction frames actual full rails, machinery, routes and carrier context at %i stops',count=>{
    const technical = data('goods',count)
    if (technical.family !== 'goods') throw Error('Expected Goods')
    const scene = technical.scene!,render = createGoodsLiftRenderModel(scene,'drive')
    const frame = getGoodsLiftCameraFrame(scene,'drive'),drive = scene.drive!
    expect(render.assemblies.map((a)=>a.kind)).toEqual(expect.arrayContaining([
      'platform','carrier-frame','floor-structure','guide-shoe','guide','machine','machine-support','traction-sheave','suspension-hitch','counterweight-frame','counterweight-rail',
    ]))
    expect(getDriveInspectionCameraPolicy(drive.concept)).toBe('fixed-detail')
    for (const offset of [0,drive.carrierTravelMetres!/2,drive.carrierTravelMetres!]) {
      for (const a of drive.parts.filter((p)=>render.assemblies.some((v)=>v.id === p.id))) {
        const shift = driveMotionFactor(drive,a.driveAttachment)!*offset
        contains(frame.bounds,a.center.map((v,i)=>v-a.size[i]/2+(i === 1 ? shift : 0)))
        contains(frame.bounds,a.center.map((v,i)=>v+a.size[i]/2+(i === 1 ? shift : 0)))
      }
      for (const route of drive.routes.filter((r)=>r.kind === 'suspension')) for (const point of route.points)
        contains(frame.bounds,[point.position[0],point.position[1]+driveMotionFactor(drive,point.attachment)!*offset,point.position[2]])
    }
    expect(getGoodsLiftCameraFrame(scene,'drive',false,`level-${count}`)).toEqual(frame)
    expectFits(frame.bounds,frame.target,frame.direction)
  })
  it.each(['goods','car'] as const)('%s preserves overview/reset semantics and distinct inspection subjects',family=>{
    const technical = data(family),scene = technical.scene!
    const frame = scene.family === 'goods' ? getGoodsLiftCameraFrame(scene,'overview') : getCarLiftCameraFrame(scene,'overview')
    const shaft = scene.assemblies.find((a)=>a.kind === 'shaft')!
    if (!('center' in shaft)) throw Error('Expected shaft box')
    contains(frame.bounds,shaft.center.map((v,i)=>v-shaft.size[i]/2));contains(frame.bounds,shaft.center.map((v,i)=>v+shaft.size[i]/2))
    const request = {viewMode:'drive',installationKey:'same',doorSelectionKey:'',resetRevision:0,viewportKey:'1280:720'}
    expect(getCameraFrameTrigger(request,{...request})).toBe('render')
    expect(transitionCameraInteraction('user',getCameraFrameTrigger(request,{...request}))).toEqual({state:'user',reframe:false})
    expect(getCameraFrameTrigger(request,{...request,resetRevision:1})).toBe('reset')
    expect(transitionCameraInteraction('user','reset')).toEqual({state:'auto',reframe:true})
    const models = (['mechanical','drive','safety','cutaway'] as const).map(mode=>scene.family === 'goods'
      ? createGoodsLiftRenderModel(scene,mode).assemblies.map((a)=>a.id)
      : createCarLiftRenderModel(scene,mode).assemblies.map((a)=>a.id))
    expect(new Set(models.map((ids)=>ids.join('|'))).size).toBe(4)
  })
})
