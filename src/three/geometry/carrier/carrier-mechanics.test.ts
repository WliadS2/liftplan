import { describe, expect, it } from 'vitest'
import { millimetres as mm, metresPerSecond } from '../../../engineering'
import { createGoodsLiftQaFixture } from '../../../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../../../dev/fixtures/car-lift-qa-fixture'
import { createGoodsLiftNormalizedModel } from '../../../elevator/goods/goods-lift-model'
import { createCarLiftNormalizedModel } from '../../../elevator/car/car-lift-model'
import { createGoodsLiftSceneModel } from '../../../elevator/goods/goods-lift-scene-model'
import { createCarLiftSceneModel } from '../../../elevator/car/car-lift-scene-model'
import { createGoodsLiftPlanningConfiguration, goodsLiftPlanningConfigurationSchema } from '../../../elevator/configuration/goods-lift-configuration'
import { createCarLiftPlanningConfiguration, carLiftPlanningConfigurationSchema } from '../../../elevator/configuration/car-lift-configuration'
import { validateGoodsLiftSpatialGeometry } from '../../../collision/goods-lift-spatial-validation'
import { validateCarLiftSpatialGeometry } from '../../../collision/car-lift-spatial-validation'
import { carrierBoxesPenetrate, validateCarrierMechanics } from '../../../collision/carrier-mechanical-validation'
import { createGoodsSimulationModel } from '../../../simulation/goods-simulation'
import { createCarSimulationModel } from '../../../simulation/car-simulation'
import { createPlatformSimulationController } from '../../../simulation/platform-simulation'
import { isGoodsMovingAssembly } from '../goods/goods-motion-bindings'
import { isCarMovingAssembly } from '../car/car-motion-bindings'
import { createGoodsLiftRenderModel, GOODS_LIFT_VIEW_MODES } from '../goods/goods-lift-render-model'
import { createCarLiftRenderModel, CAR_LIFT_VIEW_MODE_CATALOG } from '../car/car-lift-render-model'
import { createCarrierDoorLayouts, getCarrierDoorPanelOffsets } from './carrier-door-model'
import { getCarrierMotionTransforms } from './carrier-motion-bindings'
import { Group, Vector3 } from 'three'
import { createCarrierDoorSymbol } from './carrier-door-display'
import { getGoodsLiftCameraFrame } from '../../camera/goods-lift-camera'
import { getCarLiftCameraFrame } from '../../camera/car-lift-camera'

function prepare(family: 'goods' | 'car', count = 6) {
  const update = { stopCount: count, storeyHeightsMm: Array(count-1).fill(mm(3000)), nominalSpeedMetresPerSecond: metresPerSecond(1) }
  if (family === 'goods') {
    const configuration = { ...createGoodsLiftQaFixture(), ...update }
    const n = createGoodsLiftNormalizedModel(configuration)
    if (n.status === 'empty') throw Error('Missing geometry')
    const validation = validateGoodsLiftSpatialGeometry(n)
    return { configuration, normalized:n.model, scene:createGoodsLiftSceneModel(n.model), validation,
      result:createGoodsSimulationModel(n,validation) }
  }
  const configuration = { ...createCarLiftQaFixture(), ...update }
  const n = createCarLiftNormalizedModel(configuration)
  if (n.status === 'empty') throw Error('Missing geometry')
  const validation = validateCarLiftSpatialGeometry(n)
  return { configuration, normalized:n.model, scene:createCarLiftSceneModel(n.model), validation,
    result:createCarSimulationModel(n,validation) }
}

for (const family of ['goods','car'] as const) describe(`${family} explicit carrier mechanics`, ()=>{
  it('applies the same render bindings to frames/shoes/loads and keeps fixed rails/buffers/landing structures unchanged',()=>{
    const { result,scene } = prepare(family)
    if (result.status !== 'available') throw Error('Missing')
    const root = new Group(), carrier = new Group()
    carrier.name = `${family}-moving-assembly`; root.add(carrier)
    for (const a of scene.assemblies) {
      if (!('center' in a)) continue
      const node = new Group(); node.name = a.id; node.position.set(...a.center)
      const moving = family === 'goods' ? isGoodsMovingAssembly(a as Parameters<typeof isGoodsMovingAssembly>[0])
        : isCarMovingAssembly(a as Parameters<typeof isCarMovingAssembly>[0])
      ;(moving ? carrier : root).add(node)
    }
    const c = createPlatformSimulationController(result.model)
    c.dispatch({type:'start',targetLevel:'level-6'}); c.advance(result.model.timing.doorSeconds+c.getState().travelDurationSeconds/2)
    const doors = createCarrierDoorLayouts(scene.assemblies.filter((a)=>'center' in a))
    for (const t of getCarrierMotionTransforms(carrier.name,doors,c.getPose())) {
      const node = root.getObjectByName(t.nodeName); if (node) node.position[t.axis] = t.offset
    }
    root.updateMatrixWorld(true)
    for (const a of scene.assemblies) {
      if (!('center' in a)) continue
      const node = root.getObjectByName(a.id)!
      const moving = node.parent === carrier
      expect(node.getWorldPosition(new Vector3()).y).toBeCloseTo(a.center[1]+(moving ? 7.5 : 0))
      if (['guide','buffer','landing-door','shaft','approach-envelope'].includes(a.kind)) expect(moving).toBe(false)
    }
    expect(scene).toEqual(prepare(family).scene)
  })
  it.each([2,6,10])('normalizes deterministic sections and fixed/moving bindings at %i stops', (count)=>{
    const { normalized,scene,validation,result } = prepare(family,count)
    expect(validation.status).not.toBe('invalid'); expect(result.status).toBe('available')
    expect(prepare(family,count).scene).toEqual(scene)
    const parts = normalized.mechanical!.parts
    expect(parts.filter((p)=>p.kind === 'carrier-frame')).toHaveLength(4)
    expect(parts.filter((p)=>p.kind === 'floor-structure')).toHaveLength(1)
    expect(parts.filter((p)=>p.kind === 'guide-shoe')).toHaveLength(4)
    expect(parts.filter((p)=>p.kind === 'guide')).toHaveLength(2)
    expect(parts.filter((p)=>p.kind === 'buffer')).toHaveLength(6)
    expect(parts.every((p)=>p.source === 'demo')).toBe(true)
    const isMoving = (a: typeof scene.assemblies[number]) => family === 'goods'
      ? isGoodsMovingAssembly(a as Parameters<typeof isGoodsMovingAssembly>[0]) : isCarMovingAssembly(a as Parameters<typeof isCarMovingAssembly>[0])
    const moving = scene.assemblies.filter(isMoving), fixed = scene.assemblies.filter((a)=>!isMoving(a))
    expect(moving.filter((a)=>a.kind === 'carrier-frame')).toHaveLength(4)
    expect(moving.filter((a)=>a.kind === 'guide-shoe')).toHaveLength(4)
    expect(fixed.filter((a)=>a.kind === 'guide')).toHaveLength(2)
    expect(fixed.filter((a)=>a.kind === 'buffer')).toHaveLength(6)
    expect(moving.some((a)=>a.kind === 'guide' || a.kind === 'buffer' || a.kind === 'landing-door')).toBe(false)
    expect(family === 'goods' ? moving.filter((a)=>['pallet','roll-container','forklift-envelope'].includes(a.kind)).length
      : moving.filter((a)=>['vehicle-body','wheel-contact','vehicle-axle'].includes(a.kind)).length).toBe(family === 'goods' ? 3 : 7)
  })
  it.each([2,6,10])('animates only served landing leaves, keeps doors closed in motion at %i stops', (count)=>{
    const { result,scene } = prepare(family,count)
    if (result.status !== 'available') throw Error('Missing runtime')
    const c = createPlatformSimulationController(result.model)
    const doors = createCarrierDoorLayouts(scene.assemblies.filter((a)=>'center' in a))
    expect(doors.filter((d)=>d.role === 'platform')).toHaveLength(2)
    expect(doors.filter((d)=>d.role === 'landing')).toHaveLength(count*2)
    c.dispatch({ type:'start', targetLevel:`level-${count}` }); c.advance(result.model.timing.doorSeconds)
    c.advance(c.getState().travelDurationSeconds/2)
    expect(c.getPose().platformOffsetMm).toBe((count-1)*1500)
    expect(doors.every((d)=>getCarrierDoorPanelOffsets(d,c.getPose()).every((v)=>v === 0))).toBe(true)
    c.advance(c.getState().travelDurationSeconds/2+result.model.timing.doorSeconds)
    expect(c.getPose().activeLandingLevel).toBe(`level-${count}`)
    for (const d of doors) expect(getCarrierDoorPanelOffsets(d,c.getPose())).toEqual(
      d.role === 'platform' || d.levelId === `level-${count}` ? [-d.width/2,d.width/2] : [-0,0])
    c.dispatch({type:'start',targetLevel:'level-1'}); c.advance(result.model.timing.doorSeconds/2)
    expect(getCarrierDoorPanelOffsets(doors.find((d)=>d.role === 'landing' && d.levelId === `level-${count}`)!,c.getPose())[1]).toBeGreaterThan(0)
    expect(getCarrierDoorPanelOffsets(doors.find((d)=>d.role === 'landing' && d.levelId === 'level-1')!,c.getPose())[1]).toBe(0)
  })
  it('has no fabricated parts in defaults and preserves optional data through structural parsing', ()=>{
    const defaults = family === 'goods' ? createGoodsLiftPlanningConfiguration('Leer') : createCarLiftPlanningConfiguration('Leer')
    expect(defaults.mechanical).toBeUndefined()
    const { configuration } = prepare(family)
    const parsed = family === 'goods' ? goodsLiftPlanningConfigurationSchema.parse(configuration) : carLiftPlanningConfigurationSchema.parse(configuration)
    expect(parsed.mechanical).toEqual(configuration.mechanical)
    const n = family === 'goods' ? createGoodsLiftNormalizedModel({...createGoodsLiftQaFixture(),mechanical:undefined})
      : createCarLiftNormalizedModel({...createCarLiftQaFixture(),mechanical:undefined})
    if (n.status === 'empty') throw Error('Missing')
    expect(n.model.mechanical!.parts).toEqual([])
  })
  it('shows mechanical sections in local/cutaway views without coplanar duplicate floors', ()=>{
    const { scene } = prepare(family)
    const render = family === 'goods' ? createGoodsLiftRenderModel(scene as Parameters<typeof createGoodsLiftRenderModel>[0],'platform')
      : createCarLiftRenderModel(scene as Parameters<typeof createCarLiftRenderModel>[0],'platform')
    expect(render.assemblies.some((a)=>a.kind === 'platform-floor')).toBe(false)
    expect(render.assemblies.find((a)=>a.kind === 'floor-structure')!.appearance.opacity).toBe(1)
    expect(render.assemblies.filter((a)=>a.kind === 'carrier-frame')).toHaveLength(4)
    const modes = family === 'goods' ? GOODS_LIFT_VIEW_MODES : CAR_LIFT_VIEW_MODE_CATALOG.map((m)=>m.id)
    for (const mode of modes) {
      const r = family === 'goods' ? createGoodsLiftRenderModel(scene as Parameters<typeof createGoodsLiftRenderModel>[0],mode as 'overview')
        : createCarLiftRenderModel(scene as Parameters<typeof createCarLiftRenderModel>[0],mode as 'overview')
      expect(r.assemblies.length).toBeGreaterThan(0)
    }
  })
  it('frames the served landing locally without pulling in all other storeys',()=>{
    const { scene } = prepare(family)
    const frame = (level: string) => family === 'goods'
      ? getGoodsLiftCameraFrame(scene as Parameters<typeof getGoodsLiftCameraFrame>[0],'doors',true,level)
      : getCarLiftCameraFrame(scene as Parameters<typeof getCarLiftCameraFrame>[0],'doors',level)
    expect(frame('level-6').target[1]-frame('level-1').target[1]).toBeCloseTo(15)
    expect(frame('level-6').bounds.height).toBeLessThan(3)
    expect(frame('level-6').bounds.height).toBeCloseTo(frame('level-1').bounds.height)
    const render = family === 'goods' ? createGoodsLiftRenderModel(scene as Parameters<typeof createGoodsLiftRenderModel>[0],'doors','level-6')
      : createCarLiftRenderModel(scene as Parameters<typeof createCarLiftRenderModel>[0],'doors','level-6')
    expect(render.assemblies.filter((a)=>a.kind === 'landing-door').map((a)=>a.id))
      .toEqual([`${family}-landing-level-6-front`,`${family}-landing-level-6-rear`])
    expect(scene.assemblies.filter((a)=>a.kind === 'landing-door')).toHaveLength(12)
  })
  it('does not hide the scene or weaken guards for explicit mechanical conflicts', ()=>{
    const fixture = prepare(family).configuration
    const bad = {...fixture,mechanical:{...fixture.mechanical!, frame:{...fixture.mechanical!.frame!, spacingMm:mm(10000)}}}
    const n = family === 'goods' ? createGoodsLiftNormalizedModel(bad as Parameters<typeof createGoodsLiftNormalizedModel>[0])
      : createCarLiftNormalizedModel(bad as Parameters<typeof createCarLiftNormalizedModel>[0])
    if (n.status === 'empty') throw Error('Missing')
    const conflicts = validateCarrierMechanics(n.model.mechanical,n.model.shaft,n.model.platform,n.model.levels)
    expect(conflicts.some((c)=>c.code === 'component-outside-shaft')).toBe(true)
    expect(n.model.mechanical!.parts.some((p)=>p.kind === 'carrier-frame')).toBe(true)
    if (n.model.family === 'goods') {
      const result = { ...n,model:n.model } as ReturnType<typeof createGoodsLiftNormalizedModel>
      expect(createGoodsSimulationModel(result,validateGoodsLiftSpatialGeometry(result)).status).toBe('invalid')
    } else {
      const result = { ...n,model:n.model } as ReturnType<typeof createCarLiftNormalizedModel>
      expect(createCarSimulationModel(result,validateCarLiftSpatialGeometry(result)).status).toBe('invalid')
    }
  })
})

describe('carrier component geometry integrity',()=>{
  it('keeps schematic frame/track sections outside the clear opening and never mutates its dimensions',()=>{
    const { scene } = prepare('car')
    const door = createCarrierDoorLayouts(scene.assemblies.filter((a)=>'center' in a))[0]
    const original = structuredClone(door), symbol = createCarrierDoorSymbol(door)
    expect(door).toEqual(original)
    expect(symbol.leaves.map((l)=>l.size.slice(0,2))).toEqual([[door.width/2,door.height],[door.width/2,door.height]])
    expect(symbol.sections.every((p)=>p.source === 'visualization')).toBe(true)
    expect(symbol.sections.find((p)=>p.id.endsWith('header'))!.center[1]).toBeGreaterThan(door.height/2)
    expect(symbol.sections.find((p)=>p.id.endsWith('jamb-left'))!.center[0]).toBeLessThan(-door.width/2)
  })
  it('omits only dependent components when optional references are absent',()=>{
    const n = createGoodsLiftNormalizedModel({...createGoodsLiftQaFixture(),guideSystem:undefined})
    if (n.status === 'empty') throw Error('Missing')
    expect(n.model.mechanical!.parts.some((p)=>p.kind === 'guide' || p.kind === 'guide-shoe')).toBe(false)
    expect(n.model.mechanical!.parts.some((p)=>p.kind === 'carrier-frame')).toBe(true)
    expect(n.model.mechanical!.issues.every((i)=>i.code === 'missing-reference')).toBe(true)
    const rule = validateGoodsLiftSpatialGeometry(n).results.find((r)=>r.ruleId === 'goods.carrier.explicit-components')
    expect(rule?.status).toBe('unknown')
    expect(rule?.issues.every((i)=>!i.blocksPlatformTravel)).toBe(true)
  })
  it('keeps contact separate from penetration and blocks a real buffer/frame sweep',()=>{
    const { normalized } = prepare('goods')
    const floor = normalized.mechanical!.parts.find((p)=>p.kind === 'floor-structure')!.bounds
    expect(carrierBoxesPenetrate(floor,{...floor,minY:floor.maxY,maxY:mm(floor.maxY+100)})).toBe(false)
    expect(carrierBoxesPenetrate(floor,{...floor,minY:mm(floor.maxY-1),maxY:mm(floor.maxY+100)})).toBe(true)
    const bad = { ...normalized.mechanical!, parts:[...normalized.mechanical!.parts,{ id:'test-obstacle',kind:'buffer' as const,
      source:'planning' as const,attachment:'fixed' as const,bounds:{...floor,minY:mm(1000),maxY:mm(1200)}}] }
    expect(validateCarrierMechanics(bad,normalized.shaft,normalized.platform,normalized.levels))
      .toContainEqual({code:'fixed-component-penetration',involvedComponentIds:['floor-structure','test-obstacle']})
  })
  it('anchors all detailed components correctly to explicit elevated floor/pit data',()=>{
    const n = createCarLiftNormalizedModel({...createCarLiftQaFixture(),stopCount:2,storeyHeightsMm:undefined,
      levelElevationsMm:[mm(5000),mm(8000)]})
    if (n.status === 'empty') throw Error('Missing')
    expect(n.model.mechanical!.parts.find((p)=>p.kind === 'floor-structure')!.bounds.maxY).toBe(5000)
    expect(n.model.mechanical!.parts.find((p)=>p.id === 'buffer-support-1-base')!.bounds.minY).toBe(4000)
    expect(n.model.mechanical!.parts.filter((p)=>p.kind === 'guide-shoe').every((p)=>p.bounds.minY > 5000)).toBe(true)
  })
  it('exempts shoe/rail housing contact only, not shoe penetration into a fixed buffer',()=>{
    const { normalized } = prepare('goods')
    const shoe = normalized.mechanical!.parts.find((p)=>p.kind === 'guide-shoe')!
    const obstacle = { ...shoe,id:'shoe-obstacle',kind:'buffer' as const,attachment:'fixed' as const }
    const conflicts = validateCarrierMechanics({...normalized.mechanical!,parts:[...normalized.mechanical!.parts,obstacle]},
      normalized.shaft,normalized.platform,normalized.levels)
    expect(conflicts).toContainEqual({code:'fixed-component-penetration',involvedComponentIds:[shoe.id,obstacle.id]})
    expect(conflicts.some((c)=>c.involvedComponentIds[0] === shoe.id && c.involvedComponentIds[1] === 'rail-0')).toBe(false)
  })
  it('reports a declared frame intruding into usable platform geometry without hiding it',()=>{
    const fixture = createGoodsLiftQaFixture()
    const n = createGoodsLiftNormalizedModel({...fixture,mechanical:{...fixture.mechanical!,
      frame:{...fixture.mechanical!.frame!,spacingMm:mm(1800)}}})
    if (n.status === 'empty') throw Error('Missing')
    expect(validateCarrierMechanics(n.model.mechanical,n.model.shaft,n.model.platform,n.model.levels))
      .toContainEqual({code:'component-interior-penetration',involvedComponentIds:['frame-upright-0','platform']})
    expect(n.model.mechanical!.parts.filter((p)=>p.kind === 'carrier-frame')).toHaveLength(4)
  })
})
