import { describe, expect, it } from 'vitest'
import { millimetres as mm } from '../../engineering'
import { applyUniformLandingHeight, editLanding, getLandingRows, normalizeLandings, removeLanding, resizeLandings, type LandingPlanningData } from './landing-planning'
import { createPassengerPlanningConfiguration, updatePassengerPlanningConfiguration } from './passenger-planning-configuration'
import { createGoodsLiftPlanningConfiguration, updateGoodsLiftPlanningConfiguration } from './goods-lift-configuration'
import { createCarLiftPlanningConfiguration, updateCarLiftPlanningConfiguration } from './car-lift-configuration'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerDrawingContext } from '../../drawings/passenger-technical-drawings'
import { createLiftGeometryPlanningInput } from '../../three/geometry/lift-geometry-planning-input'

describe('landing planning commands', () => {
  for (const count of [2, 6, 10]) it(`reuses explicit legacy intervals for ${count} stops`, () => {
    const legacy: LandingPlanningData = { stopCount: count, storeyHeightsMm: Array(count - 1).fill(mm(3000)) }
    expect(normalizeLandings(legacy, false).levels.map((l) => l.elevationMm)).toEqual(Array.from({length:count},(_,i)=>i*3000))
    const edited = editLanding(legacy, false, 1, { label: 'OG 1', elevationMm: mm(3200) })
    expect(edited.levelElevationsMm?.[1]).toBe(3200)
    expect(edited.storeyHeightsMm).toBeUndefined()
    expect(getLandingRows(edited, false)[1].label).toBe('OG 1')
  })
  it('retains IDs and custom elevations on deletion, count changes and unrelated updates', () => {
    let c = { ...createGoodsLiftPlanningConfiguration('Test'), stopCount: 3,
      levelElevationsMm: [mm(0), mm(3200), mm(6100)], frontAccess: true, rearAccess: false, throughCar: false }
    c = editLanding(c, false, 1, { label: 'OG 1' })
    const removed = removeLanding(c, false, 'level-2')
    expect(removed.landingSettings?.map((l)=>l.id)).toEqual(['level-1','level-3'])
    expect(removed.levelElevationsMm).toEqual([0,6100])
    const added = resizeLandings(removed, false, 3)
    expect(added.levelElevationsMm).toEqual([0,6100,null])
    expect(new Set(added.landingSettings?.map((l)=>l.id)).size).toBe(3)
    expect(updateGoodsLiftPlanningConfiguration(added,{projectName:'Neu'}).levelElevationsMm).toEqual([0,6100,null])
  })
  it('shares customized count updates across all three families', () => {
    const configs = [createPassengerPlanningConfiguration('P'), createGoodsLiftPlanningConfiguration('G'), createCarLiftPlanningConfiguration('A')]
    configs.forEach((base,index)=>{
      const c = editLanding({...base,stopCount:2,levelElevationsMm:[mm(0),mm(3200)]},index===0,1,{label:'OG'})
      // The runtime family dispatch is exercised separately in workspace tests.
      const next = c.family === 'passenger' ? updatePassengerPlanningConfiguration(c,{stopCount:3})
        : c.family === 'goods' ? updateGoodsLiftPlanningConfiguration(c,{stopCount:3}) : updateCarLiftPlanningConfiguration(c,{stopCount:3})
      expect(next.stopCount).toBe(3)
      expect(next.levelElevationsMm).toEqual([0,3200,null])
      expect(next.landingSettings?.[1].label).toBe('OG')
    })
  })
  it('does not create a missing elevation or silently reorder invalid levels', () => {
    const c = {stopCount:3,levelElevationsMm:[mm(0),null,mm(6100)]}
    expect(normalizeLandings(c,false).issues).toContainEqual({code:'missing-elevation',status:'unknown',levelId:'level-2'})
    for (const values of [[0,0],[3200,0]]) {
      expect(normalizeLandings({stopCount:2,levelElevationsMm:values.map(mm)},false).levels).toEqual([])
      expect(normalizeLandings({stopCount:2,levelElevationsMm:values.map(mm)},false).issues.some((i)=>i.code==='invalid-elevation-order')).toBe(true)
    }
  })
  it('regenerates uniform positions only through an explicit command, preserving the declared datum',()=>{
    const c=editLanding({...createPassengerPlanningConfiguration('Test'),stopCount:3,
      levelElevationsMm:[mm(1000),mm(4200),mm(7100)],floorHeightMm:mm(3000)},true,1,{label:'OG 1'})
    const edited=updatePassengerPlanningConfiguration(c,{floorHeightMm:mm(3500)})
    expect(edited.levelElevationsMm).toEqual(c.levelElevationsMm)
    expect(applyUniformLandingHeight(edited,mm(3500))).toMatchObject({levelElevationsMm:[1000,4500,8000],landingSettings:c.landingSettings})
  })
  it('reports unserved and unsupported rear access without assuming capability', () => {
    const base = {stopCount:2,levelElevationsMm:[mm(0),mm(3200)],throughCar:false,frontAccess:true,rearAccess:false}
    const c = editLanding(base,false,1,{frontAccess:false,rearAccess:true})
    expect(normalizeLandings(c,false).issues.some((i)=>i.code==='unsupported-rear-access' && i.status==='invalid')).toBe(true)
    expect(normalizeLandings(editLanding(base,false,1,{frontAccess:false,rearAccess:false}),false).issues.some((i)=>i.code==='unserved-stop')).toBe(true)
  })
  it('keeps detailed Passenger door hardware and stable references while filtering served sides',()=>{
    let c={...createPassengerMechanicalFixture('left',true),stopCount:3,cabinLevelIndex:2}
    c=editLanding(c,true,0,{frontAccess:true,rearAccess:false})
    c=editLanding(c,true,1,{frontAccess:false,rearAccess:true,elevationMm:mm(3200)})
    const context=createPassengerDrawingContext(createLiftGeometryPlanningInput(c)!)!
    expect(context.inputs.doors.landings.map((l)=>`${l.levelId}-${l.side}`)).toEqual(expect.arrayContaining(['level-1-front','level-2-rear','level-3-front','level-3-rear']))
    expect(context.inputs.doors.landings).toHaveLength(4)
    expect(context.inputs.doors.landings.every((l)=>l.panels.length===2 && l.frame && l.track)).toBe(true)
    const series=c.doors!.landings![0]
    c={...c,doors:{...c.doors,landings:[{...series,overrides:[{levelId:'level-2'}]}]}}
    const removed=updatePassengerPlanningConfiguration(c,removeLanding(c,true,'level-2'))
    expect(removed.cabinLevelIndex).toBe(1)
    expect(removed.doors?.landings?.[0].overrides).toEqual([])
    expect(removed.landingSettings?.[1].id).toBe('level-3')
    const invalid={...c,doors:{...c.doors,landings:[{...series,overrides:[{levelId:'missing'}]}]}}
    expect(createPassengerDrawingContext(createLiftGeometryPlanningInput(invalid)!)!.validation.status).toBe('invalid')
  })
  it('does not shift Passenger cabin attachment when an intermediate elevation is unresolved',()=>{
    let c=editLanding({...createPassengerMechanicalFixture('left',true),stopCount:3,cabinLevelIndex:2},true,1,{elevationMm:null})
    let context=createPassengerDrawingContext(createLiftGeometryPlanningInput(c)!)!
    expect(context.inputs.installation.levels.map((l)=>l.id)).toEqual(['level-1','level-3'])
    expect(context.inputs.installation.cabin?.bottomY).toBe(6)
    c={...c,cabinLevelIndex:1}
    context=createPassengerDrawingContext(createLiftGeometryPlanningInput(c)!)!
    expect(context.inputs.installation.cabin).toBeUndefined()
    expect(context.validation.status).not.toBe('invalid')
  })
})
