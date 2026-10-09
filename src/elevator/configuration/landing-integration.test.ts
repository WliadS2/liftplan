import { describe, expect, it } from 'vitest'
import { millimetres as mm, metresPerSecond } from '../../engineering'
import { createPassengerPlanningConfiguration, type RegisteredLiftConfiguration } from '../../elevator'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { editLanding, removeLanding, normalizeLandings } from './landing-planning'
import { createLiftGeometryPlanningInput } from '../../three/geometry/lift-geometry-planning-input'
import { createPassengerDrawingContext } from '../../drawings/passenger-technical-drawings'
import { createGoodsLiftDrawingContext } from '../../drawings/goods-lift-technical-drawings'
import { createCarLiftDrawingContext } from '../../drawings/car-lift-technical-drawings'
import { createLiftPlanDrawing, createLiftSectionDrawing, createLiftDoorElevationDrawing } from '../../drawings/lift-family-technical-drawings'
import { createTechnicalDrawingPresentation } from '../../drawings/technical-drawing'
import { createGoodsLiftSceneModel } from '../goods/goods-lift-scene-model'
import { createCarLiftSceneModel } from '../car/car-lift-scene-model'
import { createGoodsLiftNormalizedModel } from '../goods/goods-lift-model'
import { createCarLiftNormalizedModel } from '../car/car-lift-model'
import { createGoodsSimulationModel } from '../../simulation/goods-simulation'
import { createCarSimulationModel } from '../../simulation/car-simulation'
import { validateGoodsLiftSpatialGeometry } from '../../collision/goods-lift-spatial-validation'
import { validateCarLiftSpatialGeometry } from '../../collision/car-lift-spatial-validation'
import { createPassengerSimulationModel } from '../../simulation/passenger-simulation-model'
import { createPassengerSimulationController, createSimulationPose, createInitialSimulationState } from '../../simulation/passenger-simulation'
import { createPlatformSimulationController } from '../../simulation/platform-simulation'
import { getDoorMotionProgress } from '../../simulation/passenger-motion-bindings'
import { createLiftPlanProject, createProjectStore, createStoredProject, createLoadedProjectState,
  duplicateStoredProject, renameStoredProject, migrateStoredProject, serializeLiftPlanProjectFile,
  parseLiftPlanProjectFile, InMemoryProjectRepository, saveProjectVersion, restoreProjectVersion } from '../../projects'
import { createTechnicalPlanPdfMetadata, prepareTechnicalPlanPdf } from '../../documents/technical-plan-pdf'
import { createTechnicalPlanDxfMetadata, prepareTechnicalPlanDxf } from '../../documents/technical-plan-dxf'
import { generateTechnicalPlanDxf } from '../../documents/technical-plan-dxf-renderer'

const date = new Date('2026-10-09T12:00:00Z')
type Family = 'passenger' | 'goods' | 'car'
function legacy(family: Family, count: number) {
  if (family === 'passenger') return { ...createPassengerPlanningConfiguration('Test'),stopCount:count,
    ratedSpeedMetresPerSecond:metresPerSecond(1),floorHeightMm:mm(3000),throughCar:true,
    cabinWidthMm:mm(1100),cabinDepthMm:mm(1400),cabinHeightMm:mm(2200),doorWidthMm:mm(900),doorHeightMm:mm(2100),
    shaftWidthMm:mm(2600),shaftDepthMm:mm(3000),pitDepthMm:mm(1000),headroomMm:mm(3000) }
  const fixture = family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
  return {...fixture,stopCount:count,storeyHeightsMm:Array.from({length:count-1},()=>mm(3000)),
    mechanical:undefined,drive:undefined,safety:undefined,nominalSpeedMetresPerSecond:metresPerSecond(1)}
}
function customized(family: Family, count: number) {
  let c = legacy(family,count)
  const elevations = Array.from({length:count},(_,i)=>i===0?0:i===1?3200:6100+(i-2)*3100)
  for (let i=0;i<count;i++) c=editLanding(c,family==='passenger',i,{label:i===0?'EG':`OG ${i}`,
    elevationMm:mm(elevations[i]),frontAccess:i%3!==2,rearAccess:i%3!==0})
  return c
}
function contextFor(c: ReturnType<typeof legacy>) {
  const context = c.family==='passenger' ? createPassengerDrawingContext(createLiftGeometryPlanningInput(c)!)
    : c.family==='goods' ? createGoodsLiftDrawingContext(c) : createCarLiftDrawingContext(c)
  if (!context) throw Error('Expected drawing context')
  return context
}
function simulationFor(c: ReturnType<typeof legacy>) {
  const context = contextFor(c)
  if ('inputs' in context) {
    const result = createPassengerSimulationModel(context.inputs)
    if (result.status!=='available') throw Error(JSON.stringify(result))
    return {family:'passenger' as const, controller:createPassengerSimulationController(result.model),context}
  }
  const result = c.family==='goods' && context.model.family==='goods'
    ? createGoodsSimulationModel(createGoodsLiftNormalizedModel(c),validateGoodsLiftSpatialGeometry(createGoodsLiftNormalizedModel(c)))
    : c.family==='car' && context.model.family==='car'
      ? createCarSimulationModel(createCarLiftNormalizedModel(c),validateCarLiftSpatialGeometry(createCarLiftNormalizedModel(c))) : undefined
  if (result?.status!=='available') throw Error(JSON.stringify(result))
  return {family:'platform' as const,controller:createPlatformSimulationController(result.model),context}
}

describe.each(['passenger','goods','car'] as const)('%s floor-by-floor integration',family=>{
  it.each([2,6,10])('%s stops preserve exact normalized levels, IDs and served 3D openings',count=>{
    const c=customized(family,count),context=contextFor(c), levels=normalizeLandings(c,family==='passenger').levels
    expect(context.validation.status).not.toBe('invalid')
    expect(levels).toHaveLength(count)
    const expected=levels.flatMap((l)=>[...(l.frontAccess?[`${l.id}-front`]:[]),...(l.rearAccess?[`${l.id}-rear`]:[])])
    if ('inputs' in context) {
      expect(context.inputs.installation.levels.map((l)=>l.elevationY*1000)).toEqual(levels.map((l)=>l.elevationMm))
      expect(context.inputs.doors.landings.map((l)=>`${l.levelId}-${l.side}`)).toEqual(expect.arrayContaining(expected))
      expect(context.inputs.doors.landings).toHaveLength(expected.length)
    } else {
      const scene=context.model.family==='goods'?createGoodsLiftSceneModel(context.model):createCarLiftSceneModel(context.model)
      const doors=scene.assemblies.filter((a)=>'doorAttachment' in a && a.doorAttachment?.role==='landing')
      expect(doors).toHaveLength(expected.length)
      expect(doors.map((a)=>'doorAttachment' in a?`${a.doorAttachment?.role==='landing'?a.doorAttachment.levelId:''}-${a.doorAttachment?.side}`:'')).toEqual(expect.arrayContaining(expected))
      expect(context.model.levels.map((l)=>l.elevationMm)).toEqual(levels.map((l)=>l.elevationMm))
    }
  })
  it('targets nonuniform levels with exact speed timing, pause/resume, served-side motion and reset',()=>{
    const runtime=simulationFor(customized(family,3)),c=runtime.controller
    expect(c.dispatch({type:'start',targetLevel:'level-2'}).ok).toBe(true)
    expect(c.getState().travelDurationSeconds).toBeCloseTo(3.2)
    c.dispatch({type:'pause'}); const paused=c.getPose(); c.advance(2); expect(c.getPose()).toEqual(paused)
    c.dispatch({type:'resume'}); c.advance(30)
    expect(c.getState().currentLevel).toBe('level-2')
    expect(c.dispatch({type:'start',targetLevel:'level-3'}).ok).toBe(true)
    expect(c.getState().travelDurationSeconds).toBeCloseTo(2.9)
    if(runtime.family==='platform') {
      runtime.controller.advance(30)
      expect(runtime.controller.getPose()).toMatchObject({floorMm:6100,frontDoorProgress:0,rearDoorProgress:1})
    } else {
      expect(runtime.controller.getPose().activeEntranceSides).toEqual(['front','rear'])
      const result=runtime.controller.dispatch({type:'reset'}); expect(result.ok).toBe(true)
      const model=runtime.controller.model
      const pose=createSimulationPose(model,{...createInitialSimulationState(model),currentLevel:'level-3',sourceLevel:'level-3',targetLevel:'level-3',doorProgress:1})
      for (const door of runtime.context.inputs.doors.cabin) expect(getDoorMotionProgress(door,pose)).toBe(door.side==='rear'?pose.cabinDoorProgress:0)
    }
    c.dispatch({type:'reset'}); expect(c.getState().currentLevel).toBe('level-1')
    expect(c.dispatch({type:'start',targetLevel:'removed-stop'}).ok).toBe(false)
    c.setNominalSpeed(metresPerSecond(2));c.dispatch({type:'start',targetLevel:'level-2'})
    expect(c.getState().travelDurationSeconds).toBeCloseTo(1.6)
  })
  it('projects selected access, exact floor intervals and labels deterministically',()=>{
    const context=contextFor(customized(family,3))
    const section=createLiftSectionDrawing(context,'auto')
    const texts=section.primitives.flatMap((p)=>p.kind==='text'?[p.text]:[])
    expect(texts.some((s)=>s.includes('OG 1'))).toBe(true)
    const intervals=section.primitives.filter((p)=>p.kind==='dimension'&&p.semantic==='storey-height').map((p)=>p.kind==='dimension'?p.valueMm:0)
    expect(intervals[0]).toBeCloseTo(3200);expect(intervals[1]).toBeCloseTo(2900)
    expect(createLiftSectionDrawing(context,'auto')).toEqual(section)
    const front=createLiftDoorElevationDrawing(context,{levelId:'level-3',side:'front'},'auto')
    expect(front.status).toBe('incomplete');expect(front.primitives).toEqual([])
    const rear=createLiftDoorElevationDrawing(context,{levelId:'level-3',side:'rear'},'auto')
    expect(rear.status).toBe('complete')
    const plan=createLiftPlanDrawing(context,'auto','level-3')
    expect(plan.primitives.some((p)=>p.id.includes('front-opening'))).toBe(false)
    expect(plan.primitives.some((p)=>p.id.includes('rear-opening'))).toBe(true)
  })
  it('keeps PDF paper mapping and DXF millimetres while using the same customized documents',()=>{
    const config=customized(family,2), context=contextFor(config)
    const project={...createLiftPlanProject({liftFamily:family}),configuration:config}
    const documents=[createLiftPlanDrawing(context,'1:100','level-1'),createLiftSectionDrawing(context,'1:100'),
      createLiftDoorElevationDrawing(context,{levelId:'level-2',side:'rear'},'1:100')]
    const pdf=prepareTechnicalPlanPdf({scope:'plan-set',scale:'1:100',projectName:config.projectName,candidates:documents.map(document=>({document,
      presentation:createTechnicalDrawingPresentation(document),metadata:createTechnicalPlanPdfMetadata(project,document,'1:100',date)}))})
    expect(pdf.ok,JSON.stringify(pdf)).toBe(true)
    const dxfs=['1:20','1:25','1:50','1:100'].map(scale=>{
      const document=createLiftPlanDrawing(context,scale as '1:20','level-1')
      const prepared=prepareTechnicalPlanDxf({scope:'current',projectName:config.projectName,candidates:[{document,metadata:createTechnicalPlanDxfMetadata(project,document,date)}]})
      if(!prepared.ok)throw Error(JSON.stringify(prepared))
      return generateTechnicalPlanDxf(prepared.value)
    })
    expect(new Set(dxfs).size).toBe(1)
  })
  it('roundtrips inputs, versions, duplicate, rename, JSON and legacy records without geometry persistence',async()=>{
    const config=customized(family,6),store=createProjectStore();store.getState().updateConfiguration(config)
    const record=createStoredProject(store.getState().project),repository=new InMemoryProjectRepository()
    const version=await saveProjectVersion(repository,record,date.toISOString())
    const file=parseLiftPlanProjectFile(serializeLiftPlanProjectFile(version.project,date.toISOString(),[version.version]))
    if(!file.ok)throw Error(JSON.stringify(file))
    expect(createLoadedProjectState(file.value.project).project.configuration).toEqual(store.getState().project.configuration)
    const copy=duplicateStoredProject(record,{id:'copy',name:'Kopie',timestamp:date.toISOString()})
    const renamed=renameStoredProject(copy,'Neu',date.toISOString())
    expect(createLoadedProjectState(renamed).project.configuration).toMatchObject({landingSettings:config.landingSettings,levelElevationsMm:config.levelElevationsMm,projectName:'Neu'})
    const restored=await restoreProjectVersion(repository,renamed,version.version,date.toISOString())
    expect(createLoadedProjectState(restored).project.configuration).toMatchObject({landingSettings:config.landingSettings,levelElevationsMm:config.levelElevationsMm})
    const legacyConfiguration=legacy(family,6)
    const legacyRecord=createStoredProject({...store.getState().project,configuration:legacyConfiguration as RegisteredLiftConfiguration})
    const migrated=migrateStoredProject(legacyRecord)
    if(!migrated.ok)throw Error(JSON.stringify(migrated))
    const loaded=createLoadedProjectState(migrated.value).project.configuration
    expect(loaded).toEqual(legacyConfiguration)
    expect(normalizeLandings(legacyConfiguration,family==='passenger').levels.map((l)=>l.elevationMm)).toEqual([0,3000,6000,9000,12000,15000])
    const removed=removeLanding(config,family==='passenger','level-2')
    expect(normalizeLandings(removed,family==='passenger').levels.some((l)=>l.id==='level-2')).toBe(false)
  })
  it('rejects duplicates, ordering, unserved/unsupported access and leaves missing heights UNKNOWN',()=>{
    const c=customized(family,3)
    for (const elevation of [0,-10]) {
      const invalid=contextFor(editLanding(c,family==='passenger',1,{elevationMm:mm(elevation)}))
      expect(invalid.validation.status).toBe('invalid')
    }
    expect(contextFor(editLanding(c,family==='passenger',1,{frontAccess:false,rearAccess:false})).validation.status).toBe('invalid')
    expect(contextFor({...c,throughCar:false}).validation.status).toBe('invalid')
    expect(contextFor({...c,shaftWidthMm:mm(200)}).validation.issues.some((i)=>i.code==='landing-door-shaft-conflict' && i.severity==='error')).toBe(true)
    const conflictingReferences={...c,landingSettings:c.landingSettings!.map((l)=>({...l,id:'same-id'}))}
    expect(contextFor(conflictingReferences).validation.issues.some((i)=>i.code==='inconsistent-stop-references')).toBe(true)
    const partial=contextFor(editLanding(c,family==='passenger',1,{elevationMm:null}))
    expect(partial.validation.issues.some((i)=>i.code==='missing-elevation'&&i.severity==='info')).toBe(true)
    expect(partial.validation.status).not.toBe('invalid')
    const missing=editLanding(c,family==='passenger',1,{elevationMm:null})
    const store=createProjectStore();expect(store.getState().updateConfiguration(missing).status).toBe('valid')
    const file=parseLiftPlanProjectFile(serializeLiftPlanProjectFile(createStoredProject(store.getState().project),date.toISOString()))
    if(!file.ok)throw Error(JSON.stringify(file))
    expect(createLoadedProjectState(file.value.project).project.configuration).toMatchObject({levelElevationsMm:[0,null,6100]})
    if ('inputs' in partial) expect(createPassengerSimulationModel(partial.inputs).status).toBe('unavailable')
    else if (missing.family==='goods') {
      const n=createGoodsLiftNormalizedModel(missing);expect(createGoodsSimulationModel(n,validateGoodsLiftSpatialGeometry(n)).status).toBe('unavailable')
    } else if (missing.family==='car') {
      const n=createCarLiftNormalizedModel(missing);expect(createCarSimulationModel(n,validateCarLiftSpatialGeometry(n)).status).toBe('unavailable')
    }
  })
})
