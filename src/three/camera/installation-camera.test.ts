import { describe,expect,it } from 'vitest'
import { PerspectiveCamera,Vector3 } from 'three'
import { millimetres as mm,metres } from '../../engineering'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { getGoodsLiftCameraFrame } from './goods-lift-camera'
import { getCarLiftCameraFrame } from './car-lift-camera'
import { calculateCameraFit } from './camera-fit'
import { GOODS_CAMERA_POLICIES,CAR_CAMERA_POLICIES,PASSENGER_CAMERA_POLICIES } from './view-camera-policy'

function prepare(family:'goods'|'car',count:number) {
  const fixture = family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
  const model = createLiftFamilyTechnicalModel({...fixture,stopCount:count,storeyHeightsMm:Array(count-1).fill(mm(3000))})
  if (model.status !== 'available' || model.family === 'passenger' || !model.scene || model.normalized.status === 'empty') throw Error('Missing')
  const shaft=model.normalized.model.shaft!
  const frame = (mode:'overview'|'platform'|'cutaway',level?:string)=>model.family === 'goods'
    ? getGoodsLiftCameraFrame(model.scene!,mode,true,level):getCarLiftCameraFrame(model.scene!,mode,level)
  return {model,frame,shaft}
}
describe('fixed installation camera contract',()=>{
  for (const family of ['goods','car'] as const) it.each([2,6,10])(`${family}: fits all shaft corners and remains independent of served level at %i stops`,count=>{
    const {frame,shaft}=prepare(family,count)
    const f=frame('overview')
    expect(f.bounds.min[1]).toBeCloseTo(shaft.minY/1000);expect(f.bounds.max[1]).toBeCloseTo(shaft.maxY/1000)
    expect(f.bounds.width).toBeGreaterThanOrEqual((shaft.maxX-shaft.minX)/1000)
    expect(f.bounds.depth).toBeGreaterThanOrEqual((shaft.maxZ-shaft.minZ)/1000)
    expect(frame('overview','level-1')).toEqual(frame('overview',`level-${count}`))
    expect(frame('cutaway').bounds.height).toBe(f.bounds.height)
    for (const size of [{width:1280,height:720},{width:400,height:700}]) {
      const fit=calculateCameraFit(f.bounds,f.target,size,undefined,undefined,f.direction)
      const camera=new PerspectiveCamera(38,size.width/size.height,fit.near,fit.far)
      camera.position.set(...fit.position);camera.lookAt(...fit.target);camera.updateMatrixWorld()
      for(const x of [f.bounds.min[0],f.bounds.max[0]])for(const y of [f.bounds.min[1],f.bounds.max[1]])for(const z of [f.bounds.min[2],f.bounds.max[2]]){
        const p=new Vector3(x,y,z).project(camera)
        expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1)
        expect(Math.abs(p.z)).toBeLessThan(1)
      }
    }
  })
  it('keeps platform details local while full installation responds to stop and shaft changes',()=>{
    for(const family of ['goods','car'] as const){
      const short=prepare(family,2),tall=prepare(family,10)
      expect(short.frame('platform')).toEqual(tall.frame('platform'))
      expect(tall.frame('overview').bounds.height).toBeGreaterThan(short.frame('overview').bounds.height)
    }
    const model=createLiftFamilyTechnicalModel({...createGoodsLiftQaFixture(),shaftWidthMm:mm(4000),shaftDepthMm:mm(5000)})
    if(model.status !== 'available'||model.family !== 'goods'||!model.scene)throw Error('Missing')
    expect(getGoodsLiftCameraFrame(model.scene,'overview').bounds.width).toBe(4)
    expect(getGoodsLiftCameraFrame(model.scene,'overview').bounds.depth).toBe(5)
  })
  it.each(['goods','car'] as const)('%s: served-door framing contains both landing and platform layers',family=>{
    const {model}=prepare(family,6)
    if(!model.scene)throw Error('Missing')
    const frame=model.family === 'goods' ? getGoodsLiftCameraFrame(model.scene,'doors',true,'level-6')
      :getCarLiftCameraFrame(model.scene,'doors','level-6')
    const boxes=model.scene.assemblies.filter(a=>'center' in a&&(a.kind==='door'||a.kind==='landing-door'))
    for(const door of boxes){
      if(!('center' in door)||!door.doorAttachment)continue
      if(door.doorAttachment.role==='landing'&&door.doorAttachment.levelId!=='level-6')continue
      expect(frame.bounds.min[0]).toBeLessThanOrEqual(door.center[0]-door.size[0])
      expect(frame.bounds.max[0]).toBeGreaterThanOrEqual(door.center[0]+door.size[0])
      expect(frame.bounds.min[2]).toBeLessThanOrEqual(door.center[2]-door.size[2]/2)
      expect(frame.bounds.max[2]).toBeGreaterThanOrEqual(door.center[2]+door.size[2]/2)
    }
    expect(frame.bounds.min[1]).toBeCloseTo(15)
    expect(frame.bounds.height).toBeLessThan(3)
  })
  it('does not include hidden approach/sweep or outlying load envelopes in installation bounds',()=>{
    const goods=prepare('goods',6).model,car=prepare('car',6).model
    if(goods.family!=='goods'||car.family!=='car'||!goods.scene||!car.scene)throw Error('Missing')
    const g={...goods.scene,assemblies:goods.scene.assemblies.map(a=>a.kind==='forklift-envelope'?{...a,center:[metres(100000),metres(100000),metres(100000)] as typeof a.center}:a)}
    expect(getGoodsLiftCameraFrame(g,'overview',true)).toEqual(getGoodsLiftCameraFrame(goods.scene,'overview',true))
    const c={...car.scene,assemblies:car.scene.assemblies.map(a=>'center' in a&&a.kind==='approach-envelope'?{...a,center:[100000,100000,100000] as unknown as typeof a.center}:a)}
    expect(getCarLiftCameraFrame(c,'overview')).toEqual(getCarLiftCameraFrame(car.scene,'overview'))
  })
  it('declares distinct installation, moving-detail and fixed-detail ownership for every family view',()=>{
    for(const policies of [PASSENGER_CAMERA_POLICIES,GOODS_CAMERA_POLICIES,CAR_CAMERA_POLICIES]){
      expect(policies.overview).toBe('installation');expect(policies.cutaway).toBe('section');expect(policies.doors).toBe('fixed-detail')
    }
    expect(PASSENGER_CAMERA_POLICIES.cabin).toBe('moving-detail')
    expect(PASSENGER_CAMERA_POLICIES.mechanical).toBe('fixed-detail')
    expect(GOODS_CAMERA_POLICIES.platform).toBe('moving-detail');expect(GOODS_CAMERA_POLICIES.loads).toBe('moving-detail')
    expect(GOODS_CAMERA_POLICIES.guides).toBe('moving-detail')
    expect(CAR_CAMERA_POLICIES.vehicle).toBe('moving-detail');expect(CAR_CAMERA_POLICIES.approach).toBe('fixed-detail')
  })
})
