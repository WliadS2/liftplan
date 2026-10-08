import { describe,expect,it } from 'vitest'
import { millimetres as mm,metresPerSecond } from '../../engineering'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { createLiftFamilyTechnicalModel } from '../../lift-families/technical-family-model'
import { carrierDrivePlanningSchema } from '../configuration/carrier-drive-planning'
import { createGoodsLiftPlanningConfiguration,goodsLiftPlanningConfigurationSchema } from '../configuration/goods-lift-configuration'
import { createCarLiftPlanningConfiguration,carLiftPlanningConfigurationSchema } from '../configuration/car-lift-configuration'
import { normalizeCarrierDrive,drivePartBoundsAtOffset } from './carrier-drive-model'
import type { CarrierDrivePlanning } from '../configuration/carrier-drive-planning'
import { validateCarrierDrive,carrierBoxOverlapMm } from '../../collision/carrier-drive-validation'
import { carrierBoxesPenetrate } from '../../collision/carrier-mechanical-validation'
import { createGoodsSimulationModel } from '../../simulation/goods-simulation'
import { createCarSimulationModel } from '../../simulation/car-simulation'
import { createPlatformSimulationController } from '../../simulation/platform-simulation'
import { createLiftPlanProject } from '../../projects/project-factory'
import { createStoredProject,createLoadedProjectState,duplicateStoredProject,renameStoredProject } from '../../projects/persistence/project-persistence-service'
import { migrateStoredProject,parseLiftPlanProjectFile,serializeLiftPlanProjectFile } from '../../projects/persistence/project-persistence-schema'
import { createProjectStore } from '../../projects/project-store'
import { InMemoryProjectRepository,saveProjectVersion,restoreProjectVersion } from '../../projects'

export function driveFixture(family:'goods'|'car',count=6,drive?:CarrierDrivePlanning) {
  const config = family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
  return {...config,stopCount:count,storeyHeightsMm:Array.from({length:count-1},()=>mm(3000)),
    nominalSpeedMetresPerSecond:metresPerSecond(1),drive:drive ?? config.drive}
}
function prepare(family:'goods'|'car',count=6,drive?:CarrierDrivePlanning) {
  const config = driveFixture(family,count,drive),technical = createLiftFamilyTechnicalModel(config)
  if (technical.status !== 'available' || technical.family === 'passenger' || technical.normalized.status === 'empty') throw Error('Expected technical model')
  const model = technical.normalized.model
  const result = technical.family === 'goods' ? createGoodsSimulationModel(technical.normalized,technical.validation)
    : createCarSimulationModel(technical.normalized,technical.validation)
  return {config,technical,model,rules:validateCarrierDrive(model.drive,model),result}
}
const traction = () => {
  const value = createGoodsLiftQaFixture().drive!
  if (value.concept !== 'traction') throw Error('Expected traction')
  return value
}
const hydraulic = () => {
  const value = createCarLiftQaFixture().drive!
  if (value.concept !== 'hydraulic') throw Error('Expected hydraulic')
  return value
}

describe('explicit independent carrier drive planning',()=>{
  it('has no production drive, dimensions, safety, or demo provenance defaults',()=>{
    for (const config of [createGoodsLiftPlanningConfiguration('Neu'),createCarLiftPlanningConfiguration('Neu')]) {
      expect(config).not.toHaveProperty('drive');expect(config).not.toHaveProperty('safety')
      expect(normalizeCarrierDrive(config.drive)).toMatchObject({concept:'unspecified',parts:[],routes:[]})
    }
    const store = createProjectStore()
    store.getState().createProject({liftFamily:'goods'})
    store.getState().loadDevelopmentConfiguration(createGoodsLiftQaFixture())
    expect(store.getState().persistenceMode).toBe('development-demo')
    store.getState().resetProject()
    expect(JSON.stringify(store.getState().project.configuration)).not.toContain('demo')
  })
  it.each(['unspecified','traction','hydraulic'] as const)('structurally parses %s without selecting components',concept=>{
    const drive = concept === 'unspecified' ? {concept} : {concept,source:'planning'}
    expect(carrierDrivePlanningSchema.safeParse(drive).success).toBe(true)
    expect(normalizeCarrierDrive(carrierDrivePlanningSchema.parse(drive)).parts).toEqual([])
  })
  it('rejects nonfinite, unknown and mixed-concept input without regulatory minimums',()=>{
    expect(carrierDrivePlanningSchema.safeParse({concept:'hydraulic',source:'planning',counterweight:{}}).success).toBe(false)
    expect(carrierDrivePlanningSchema.safeParse({concept:'traction',source:'planning',counterweight:{travelRatio:Infinity}}).success).toBe(false)
    expect(normalizeCarrierDrive({...hydraulic(),travel:{availableStrokeMm:mm(-1)}}).issues).toContainEqual({code:'invalid-relation',path:'drive.travel'})
  })
  for (const family of ['goods','car'] as const) {
    it(`${family}: repository snapshots and version restore retain explicit drive/safety planning only`,async()=>{
      const {config,model} = prepare(family)
      const repository = new InMemoryProjectRepository()
      const project = {...createLiftPlanProject({liftFamily:family,projectName:config.projectName}),configuration:config}
      const record = createStoredProject(project)
      const first = await saveProjectVersion(repository,record,'2026-10-08T00:00:00Z')
      await repository.saveProject({...first.project,planningData:JSON.parse(JSON.stringify({...config,drive:{concept:'unspecified'}}))})
      const restored = await restoreProjectVersion(repository,first.project,first.version,'2026-10-08T01:00:00Z')
      const loaded = createLoadedProjectState((await repository.getProject(restored.id))!)
      const technical = createLiftFamilyTechnicalModel(loaded.project.configuration)
      if (technical.status !== 'available' || technical.family === 'passenger' || technical.normalized.status === 'empty') throw Error('Expected restored model')
      expect(technical.normalized.model).toEqual(model)
      expect((await repository.listVersions(record.id))).toHaveLength(1)
      expect(restored.planningData).not.toHaveProperty('assemblies')
    })
    it(`${family}: front-only access retains the declared drive and omits rear entrance geometry`,()=>{
      const {config} = prepare(family)
      const technical = createLiftFamilyTechnicalModel({...config,throughCar:false,rearAccess:false})
      if (technical.status !== 'available' || technical.family === 'passenger' || technical.normalized.status === 'empty') throw Error('Expected model')
      expect(technical.validation.status).toBe('ok')
      expect(technical.normalized.model.entrances.map((e)=>e.side)).toEqual(['front'])
      expect(technical.scene!.assemblies.some((a)=>(a.kind === 'door' || a.kind === 'landing-door') && a.id.endsWith('-rear'))).toBe(false)
    })
    it(`${family}: a genuine carrier frame intrusion blocks travel through the same structured guard`,()=>{
      const {config} = prepare(family)
      const technical = createLiftFamilyTechnicalModel({...config,mechanical:{...config.mechanical!,frame:{...config.mechanical!.frame!,spacingMm:mm(200)}}})
      if (technical.status !== 'available' || technical.family === 'passenger') throw Error('Expected technical family')
      const result = technical.family === 'goods' ? createGoodsSimulationModel(technical.normalized,technical.validation)
        : createCarSimulationModel(technical.normalized,technical.validation)
      expect(technical.validation.status).toBe('invalid')
      expect(result.status).toBe('invalid')
    })
    it.each([2,6,10])(`${family}: deterministic explicit components and coherent travel at %i stops`,count=>{
      const {model,rules,result,config,technical} = prepare(family,count)
      expect(rules.filter((r)=>r.status !== 'ok')).toEqual([])
      expect(technical.validation.status).toBe('ok')
      expect(model).toEqual(prepare(family,count).model)
      expect(model.drive.parts.every((p)=>p.source === 'demo')).toBe(true)
      const schema = family === 'goods' ? goodsLiftPlanningConfigurationSchema : carLiftPlanningConfigurationSchema
      expect(schema.safeParse(config).success).toBe(true)
      expect(result.status).toBe('available')
      if (result.status !== 'available') throw Error('Expected travel')
      const c = createPlatformSimulationController(result.model)
      expect(c.dispatch({type:'start',targetLevel:`level-${count}`}).ok).toBe(true)
      const duration = c.getState().travelDurationSeconds
      expect(duration).toBe((count-1)*3)
      c.advance(result.model.timing.doorSeconds+duration/2)
      expect(c.getPose().platformOffsetMm).toBe((count-1)*1500)
      c.dispatch({type:'pause'});const paused = c.getPose();c.advance(10);expect(c.getPose()).toEqual(paused)
      c.setNominalSpeed(metresPerSecond(2));c.dispatch({type:'resume'});c.advance(duration/2+2)
      expect(c.getState().currentLevel).toBe(`level-${count}`)
      const offset = c.getPose().platformOffsetMm
      for (const part of model.drive.parts) {
        const atTop = drivePartBoundsAtOffset(model.drive,part,offset)!
        if (part.attachment === 'fixed') expect(atTop).toEqual(part.bounds)
        if (part.attachment === 'carrier') expect(atTop.minY-part.bounds.minY).toBe(offset)
        if (part.attachment === 'counterweight') expect(atTop.minY-part.bounds.minY).toBe(-offset)
        if (part.attachment === 'plunger') {expect(atTop.minY).toBe(part.bounds.minY);expect(atTop.maxY-part.bounds.maxY).toBe(offset)}
        expect(atTop.minY).toBeGreaterThanOrEqual(model.shaft!.minY);expect(atTop.maxY).toBeLessThanOrEqual(model.shaft!.maxY)
      }
      c.dispatch({type:'start',targetLevel:'level-1'});expect(c.getState().travelDurationSeconds).toBe(duration/2)
      c.advance(duration+4);expect(c.getState().currentLevel).toBe('level-1')
      c.dispatch({type:'reset'});expect(c.getPose().platformOffsetMm).toBe(0)
      expect(result.model.mechanicalVisualization).toMatchObject(family === 'goods' ? {counterweight:'available',suspension:'available'} : {plunger:'available'})
    })
    it(`${family}: incomplete optional drive stays UNKNOWN without blocking unrelated carrier playback`,()=>{
      const {rules,result} = prepare(family,6,{concept:family === 'goods' ? 'traction' : 'hydraulic',source:'planning'})
      expect(rules.some((r)=>r.status === 'unknown')).toBe(true)
      expect(rules.some((r)=>r.status === 'invalid' || r.blocksTravel)).toBe(false)
      expect(result.status).toBe('available')
    })
    it(`${family}: persists planning only through old migration, JSON, duplicate and rename`,()=>{
      const {config,model} = prepare(family)
      const project = {...createLiftPlanProject({liftFamily:family,projectName:config.projectName}),configuration:config}
      const stored = createStoredProject(project),source = serializeLiftPlanProjectFile(stored,'2026-10-08T00:00:00Z')
      expect(source).not.toContain('assemblies');expect(source).not.toContain('mechanicalVisualization');expect(source).not.toContain('results')
      const parsed = parseLiftPlanProjectFile(source)
      if (!parsed.ok) throw Error('Expected JSON')
      const loaded = createLoadedProjectState(parsed.value.project),technical = createLiftFamilyTechnicalModel(loaded.project.configuration)
      if (technical.status !== 'available' || technical.family === 'passenger' || technical.normalized.status === 'empty') throw Error('Missing model')
      expect(technical.normalized.model).toEqual(model)
      const clone = duplicateStoredProject(stored,{id:'copy',name:'Kopie',timestamp:'2026-10-08'})
      const renamed = renameStoredProject(clone,'Umbenannt','2026-10-08')
      const copied = createLoadedProjectState(renamed).project.configuration
      expect('drive' in copied && copied.drive).toEqual(config.drive)
      const old = {...stored,planningData:{family,schemaVersion:config.schemaVersion,projectName:'Alt'}}
      const migrated = migrateStoredProject(old)
      if (!migrated.ok) throw Error('Expected old v1')
      expect(createLoadedProjectState(migrated.value).project.configuration).not.toHaveProperty('drive')
    })
  }
})

describe('mechanical spatial guards',()=>{
  it('overlapping Y travel with separated X/Z is not a counterweight collision',()=>{
    const {rules} = prepare('goods')
    expect(rules.filter((r)=>r.ruleId.includes('counterweight.carrier'))).toEqual([])
  })
  it('actual counterweight/carrier penetration is INVALID and blocks only the spatial conflict',()=>{
    const d = traction(),frame = d.counterweight!.frame!
    const drive = {...d,counterweight:{...d.counterweight,frame:{...frame,bounds:{...frame.bounds,minZ:mm(-100),maxZ:mm(100)}}}}
    const {rules,result} = prepare('goods',6,drive)
    expect(rules.some((r)=>r.reason === 'swept-penetration' && r.blocksTravel)).toBe(true)
    expect(result.status).toBe('invalid')
  })
  it('oversized fixed machinery remains visible and INVALID without inventing a moving-system obstruction',()=>{
    const d = traction(),machine = d.machine!,drive = {...d,machine:{...machine,bounds:{...machine.bounds,maxX:mm(9000)}}}
    const {rules,model,result} = prepare('goods',6,drive)
    expect(model.drive.parts.find((p)=>p.id === machine.id)?.bounds.maxX).toBe(9000)
    expect(rules.find((r)=>r.ruleId === `drive.shaft.${machine.id}`)?.status).toBe('invalid')
    expect(rules.find((r)=>r.ruleId === `drive.shaft.${machine.id}`)?.blocksTravel).toBe(false)
    expect(result.status).toBe('available')
  })
  it('fixed-only equipment penetration is INVALID but is not itself a carrier travel obstruction',()=>{
    const base = prepare('goods').model
    const rail = base.mechanical!.parts.find((p)=>p.kind === 'guide')!
    const machine = base.drive.parts.find((p)=>p.kind === 'machine')!
    const fixedOnly = validateCarrierDrive(base.drive,{...base,mechanical:{...base.mechanical!,parts:[...base.mechanical!.parts,
      {...rail,id:'fixed-upper-obstacle',bounds:machine.bounds}]}})
    expect(fixedOnly.find((r)=>r.ruleId === `drive.static.${machine.id}.fixed-upper-obstacle`)).toMatchObject({status:'invalid',blocksTravel:false})
    expect(fixedOnly.some((r)=>r.blocksTravel)).toBe(false)
  })
  it('fixed machine in the car swept volume blocks playback',()=>{
    const d = traction(),m = d.machine!
    const {rules,result} = prepare('goods',6,{...d,machine:{...m,verticalReference:'lowest-stop',bounds:{...m.bounds,minY:mm(3000),maxY:mm(3300)}}})
    expect(rules.some((r)=>r.reason === 'fixed-obstacle-penetration' && r.blocksTravel)).toBe(true)
    expect(result.status).toBe('invalid')
  })
  it('hydraulic cylinder penetration, alignment and insufficient stroke are independent spatial conflicts',()=>{
    const d = hydraulic(),c = d.cylinder!
    const intersect = {...d,cylinder:{...c,bounds:{...c.bounds,minX:mm(-40),maxX:mm(40),minZ:mm(-40),maxZ:mm(40),minY:mm(-200),maxY:mm(300)}}}
    expect(prepare('car',6,intersect).rules.some((r)=>r.reason === 'fixed-obstacle-penetration')).toBe(true)
    expect(prepare('car',6,intersect).result.status).toBe('invalid')
    const short = prepare('car',6,{...d,travel:{plungerPerCarrierRatio:1,availableStrokeMm:mm(100)}})
    expect(short.rules.find((r)=>r.ruleId === 'drive.hydraulic.stroke')).toMatchObject({status:'invalid',blocksTravel:true})
    expect(short.result.status).toBe('invalid')
  })
  it('missing direct relation and incomplete indirect routing remain UNKNOWN, never an invented 2:1 ratio',()=>{
    const d = hydraulic()
    expect(prepare('car',6,{...d,travel:undefined}).rules.find((r)=>r.ruleId === 'drive.hydraulic.stroke')?.status).toBe('unknown')
    expect(prepare('car',6,{...d,layout:'indirect'}).rules.find((r)=>r.ruleId === 'drive.hydraulic.indirect')?.status).toBe('unknown')
    expect(normalizeCarrierDrive({concept:'traction',source:'planning',counterweight:{}}).counterweightTravelRatio).toBeUndefined()
  })
  it('omits unresolved suspension motion from the scene rather than rendering a detached frozen end',()=>{
    const d = traction(),{technical,result} = prepare('goods',6,{...d,counterweight:{...d.counterweight,travelRatio:undefined}})
    expect(technical.scene!.drive!.routes.some((r)=>r.kind === 'suspension')).toBe(false)
    if (result.status !== 'available') throw Error('Carrier playback remains available')
    expect(result.model.mechanicalVisualization).toMatchObject({counterweight:'unknown',suspension:'unknown'})
    const direct = prepare('car').result
    if (direct.status !== 'available') throw Error('Expected direct hydraulic playback')
    expect(direct.model.mechanicalVisualization?.suspension).toBe('unavailable')
  })
  it('an explicit indirect pulley follows its own declared attachment and ratio, not an assumed carrier offset',()=>{
    const d = hydraulic(),pulley = {...d.connection!,id:'indirect-pulley',attachment:'plunger' as const}
    const model = prepare('car',6,{...d,layout:'indirect',pulley,travel:{plungerPerCarrierRatio:0.5,availableStrokeMm:mm(10000)}}).model.drive
    const part = model.parts.find((p)=>p.kind === 'hydraulic-pulley')!
    expect(drivePartBoundsAtOffset(model,part,mm(2000))!.minY-part.bounds.minY).toBe(1000)
    expect(carrierDrivePlanningSchema.safeParse({...d,pulley:{...d.connection!,id:'no-attachment'}}).success).toBe(false)
  })
  it('touching AABBs have zero overlap and are not penetration',()=>{
    const b = traction().machine!.bounds,contact = {...b,minX:b.maxX,maxX:mm(b.maxX+100)}
    expect(carrierBoxOverlapMm(b,contact).x).toBe(0);expect(carrierBoxesPenetrate(b,contact)).toBe(false)
  })
  it('detached suspension endpoint is reported and missing reference anchors stay UNKNOWN',()=>{
    const d = traction(),r = d.suspension![0]
    const wrong = {...d,suspension:[{...r,points:r.points.map((p,i)=>i ? p : {...p,x:mm(500)})}]}
    expect(prepare('goods',6,wrong).rules.find((r)=>r.ruleId === 'drive.route.suspension-route')).toMatchObject({status:'invalid',reason:'detached-endpoint'})
    expect(prepare('goods',6,{...d,carrierHitches:undefined}).rules.find((r)=>r.ruleId === 'drive.route.suspension-route')?.status).toBe('unknown')
  })
  it('checks declared rail engagement throughout travel, not just at the reference landing',()=>{
    const d = traction(),rails = d.counterweight!.rails!.map((r)=>({...r,verticalSpan:undefined,
      verticalReference:'highest-stop' as const,bounds:{...r.bounds,minY:mm(0),maxY:mm(3000)}}))
    const {rules,result} = prepare('goods',6,{...d,counterweight:{...d.counterweight,rails}})
    expect(rules.some((r)=>r.ruleId.includes('engagement') && r.status === 'invalid')).toBe(true)
    expect(result.status).toBe('invalid')
  })
  it('rejects a route segment that collapses mid-travel even if both endpoint poses have nonzero length',()=>{
    const d = traction()
    const {rules} = prepare('goods',6,{...d,suspension:[{id:'crossing',points:[
      {x:mm(0),y:mm(2510),z:mm(0),attachment:'carrier'},
      {x:mm(0),y:mm(8000),z:mm(0),attachment:'fixed'},
    ]}]})
    expect(rules.find((r)=>r.ruleId === 'drive.route.crossing')).toMatchObject({status:'invalid',reason:'zero-length-segment',blocksTravel:true})
  })
})
