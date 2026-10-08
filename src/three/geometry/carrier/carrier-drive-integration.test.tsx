// @vitest-environment jsdom
import { describe,expect,it } from 'vitest'
import { BufferAttribute,BufferGeometry,Group,Line,LineBasicMaterial,type Object3D } from 'three'
import { createGoodsLiftQaFixture } from '../../../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../../../dev/fixtures/car-lift-qa-fixture'
import { createLiftFamilyTechnicalModel } from '../../../lift-families/technical-family-model'
import { bindCarrierDriveScene } from './carrier-drive-render-bindings'
import { createCarrierDriveMotionPlan } from './carrier-drive-motion'
import { getAvailableGoodsLiftViewModes,createGoodsLiftRenderModel } from '../goods/goods-lift-render-model'
import { getAvailableCarLiftViewModes,createCarLiftRenderModel } from '../car/car-lift-render-model'
import { getGoodsLiftCameraFrame } from '../../camera/goods-lift-camera'
import { getCarLiftCameraFrame } from '../../camera/car-lift-camera'
import { GOODS_CAMERA_POLICIES,CAR_CAMERA_POLICIES } from '../../camera/view-camera-policy'
import { createGoodsLiftDrawingContext } from '../../../drawings/goods-lift-technical-drawings'
import { createCarLiftDrawingContext } from '../../../drawings/car-lift-technical-drawings'
import { createLiftPlanDrawing,createLiftSectionDrawing,createLiftDoorElevationDrawing } from '../../../drawings/lift-family-technical-drawings'
import { createTechnicalDrawingPresentation,type TechnicalDrawingDocument,type TechnicalDrawingScale } from '../../../drawings/technical-drawing'
import { createLiftPlanProject } from '../../../projects/project-factory'
import { createTechnicalPlanDxfMetadata,prepareTechnicalPlanDxf } from '../../../documents/technical-plan-dxf'
import { generateTechnicalPlanDxf,technicalDxfLayerForPrimitive } from '../../../documents/technical-plan-dxf-renderer'
import { createTechnicalPlanPdfMetadata,prepareTechnicalPlanPdf,type FixedTechnicalDrawingScale } from '../../../documents/technical-plan-pdf'
import { createTechnicalPlanPdfPageSvg } from '../../../documents/technical-plan-pdf-renderer'

const date = new Date(2026,9,8,12)
function data(family:'goods'|'car',count=6) {
  const base = family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
  const config = {...base,stopCount:count,storeyHeightsMm:Array.from({length:count-1},()=>base.storeyHeightsMm![0])}
  const technical = createLiftFamilyTechnicalModel(config)
  if (technical.status !== 'available' || technical.family === 'passenger' || !technical.scene || technical.normalized.status === 'empty') throw Error('Missing')
  const context = config.family === 'goods' ? createGoodsLiftDrawingContext(config) : createCarLiftDrawingContext(config)
  if (!context) throw Error('Missing context')
  const project = {...createLiftPlanProject({liftFamily:family,projectName:config.projectName,projectId:`${family}-drive-qa`}),configuration:config}
  const docs = (scale:TechnicalDrawingScale) => [createLiftPlanDrawing(context,scale),createLiftSectionDrawing(context,scale),
    createLiftDoorElevationDrawing(context,{levelId:'level-1',side:'front'},scale)]
  const dxf = (doc:TechnicalDrawingDocument) => {
    const prepared = prepareTechnicalPlanDxf({scope:'current',projectName:project.name,candidates:[{document:doc,metadata:createTechnicalPlanDxfMetadata(project,doc,date)}]})
    if (!prepared.ok) throw Error(prepared.error.code)
    return generateTechnicalPlanDxf(prepared.value)
  }
  return {config,technical,context,project,docs,dxf}
}
function primitiveExtent(dxf:string,id:string) {
  const lines = dxf.split(/\r?\n/),pairs = [] as {code:number;value:string}[]
  for (let i=0;i+1<lines.length;i+=2) pairs.push({code:Number(lines[i]),value:lines[i+1]})
  const start = pairs.findIndex((p)=>p.code === 999 && p.value === `Primitive: ${id}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = pairs.findIndex((p,i)=>i>start && p.code === 999 && p.value.startsWith('Primitive:'))
  const primitive = pairs.slice(start+1,end<0 ? undefined : end)
  const coords = (axis:number)=>primitive.filter((p)=>p.code === axis).map((p)=>Number(p.value))
  const x = coords(10),y = coords(20)
  return {width:Math.max(...x)-Math.min(...x),height:Math.max(...y)-Math.min(...y)}
}

for (const family of ['goods','car'] as const) describe(`${family} mechanical runtime and vector export`,()=>{
  it.each([2,6,10])('reserves the entire installation stroke in overview while drive inspection remains semantic for %s stops',count=>{
    const {technical} = data(family,count)
    const drive = technical.scene!.drive!
    const frame = technical.family === 'goods' ? getGoodsLiftCameraFrame(technical.scene!,'overview') : getCarLiftCameraFrame(technical.scene!,'overview')
    expect(frame.bounds.height).toBeGreaterThan(drive.carrierTravelMetres!)
    expect(frame.bounds.min[1]).toBeLessThanOrEqual(0)
    expect(frame.bounds.max[1]).toBeGreaterThanOrEqual(drive.carrierTravelMetres!-0.1)
  })
  it('updates actual cached Three bindings for moving parts/routes while fixed parts remain fixed',()=>{
    const {technical} = data(family),drive = technical.scene!.drive!
    const nodes = new Map<string,Object3D>()
    for (const part of drive.parts) {
      nodes.set(`drive-motion-${part.id}`,new Group())
      const shape = new Group();shape.position.set(...part.center);nodes.set(`drive-shape-${part.id}`,shape)
    }
    const geometries:BufferGeometry[] = [],materials:LineBasicMaterial[] = []
    for (const route of drive.routes) {
      const geometry = new BufferGeometry(),material = new LineBasicMaterial()
      geometry.setAttribute('position',new BufferAttribute(new Float32Array(route.points.flatMap((p)=>[...p.position])),3))
      geometries.push(geometry);materials.push(material);nodes.set(route.id,new Line(geometry,material))
    }
    const plan = createCarrierDriveMotionPlan(drive),apply = bindCarrierDriveScene(drive,nodes)
    for (const offset of [0,7,14,7,0]) {
      apply(offset)
      for (const part of plan.parts) {
        if (part.extends) {
          const node = nodes.get(`drive-shape-${part.id}`)!
          expect(node.position.y-node.scale.y*part.height/2).toBeCloseTo(part.centerY-part.height/2)
          expect(node.position.y+node.scale.y*part.height/2).toBeCloseTo(part.centerY+part.height/2+offset*part.factor!)
        } else expect(nodes.get(`drive-motion-${part.id}`)!.position.y).toBe(offset*part.factor!)
      }
      for (const route of plan.routes) {
        const attribute = (nodes.get(route.id) as Line).geometry.getAttribute('position')
        route.points.forEach((p,i)=>expect(attribute.getY(i)).toBeCloseTo(p.base[1]+offset*p.factor!,5))
      }
    }
    geometries.forEach((g)=>g.dispose());materials.forEach((m)=>m.dispose())
  })
  it('offers meaningful conditional modes, fixed mechanical frames and local current-position detail semantics',()=>{
    const {technical} = data(family)
    const modes = technical.family === 'goods' ? getAvailableGoodsLiftViewModes(technical.scene!) : getAvailableCarLiftViewModes(technical.scene!)
    expect(modes.map((m)=>m.id)).toEqual(expect.arrayContaining(['mechanical','drive','guides','safety']))
    for (const mode of ['mechanical','drive','safety'] as const) {
      const render = technical.family === 'goods' ? createGoodsLiftRenderModel(technical.scene!,mode) : createCarLiftRenderModel(technical.scene!,mode)
      expect(render.assemblies.length).toBeGreaterThan(0)
      expect(render.assemblies.some((a)=>['pallet','vehicle-body','landing-door','approach-envelope'].includes(a.kind))).toBe(false)
      if (mode === 'drive') expect(render.assemblies.some((a)=>a.kind === 'safety-gear')).toBe(false)
      const frame = technical.family === 'goods' ? getGoodsLiftCameraFrame(technical.scene!,mode) : getCarLiftCameraFrame(technical.scene!,mode)
      expect(frame.target).toEqual(frame.bounds.center)
      expect((family === 'goods' ? GOODS_CAMERA_POLICIES : CAR_CAMERA_POLICIES)[mode]).toBe('fixed-detail')
    }
    const noDrive = {...technical.scene!,drive:undefined,assemblies:technical.scene!.assemblies.filter((a)=>!('driveAttachment' in a))}
    const available = technical.family === 'goods' ? getAvailableGoodsLiftViewModes(noDrive as NonNullable<typeof technical.scene>) : getAvailableCarLiftViewModes(noDrive as NonNullable<typeof technical.scene>)
    expect(available.some((m)=>m.id === 'drive')).toBe(false)
  })
  it('does not duplicate guide/drive inspections with an empty carrier mechanics mode',()=>{
    const {technical} = data(family)
    const partial = {...technical.scene!,assemblies:technical.scene!.assemblies.filter((a)=>
      ['guide','machine','shaft','platform-floor'].includes(a.kind))}
    const available = technical.family === 'goods' ? getAvailableGoodsLiftViewModes(partial as NonNullable<typeof technical.scene>)
      : getAvailableCarLiftViewModes(partial as NonNullable<typeof technical.scene>)
    expect(available.some((m)=>m.id === 'mechanical')).toBe(false)
    expect(available.some((m)=>m.id === 'drive')).toBe(family === 'goods')
  })
  it.each(['1:20','1:25','1:50','1:100'] as const)('keeps new plan/section mechanics and numeric DXF dimensions 1:1 at %s',scale=>{
    const {docs,dxf,technical} = data(family),documents = docs(scale)
    expect(documents).toEqual(docs(scale))
    const plan = documents[0],section = documents[1]
    if (technical.normalized.status === 'empty') throw Error('Expected geometry')
    const normalized = technical.normalized.model
    for (const part of normalized.drive.parts) {
      expect(plan.primitives.find((p)=>p.id === `${family}-${part.id}-plan`)).toMatchObject({x:part.bounds.minX,width:part.bounds.maxX-part.bounds.minX})
      expect(section.primitives.find((p)=>p.id === `${family}-${part.id}-section`)).toMatchObject({height:part.bounds.maxY-part.bounds.minY})
    }
    const content = dxf(plan),baseline = dxf(docs('auto')[0])
    expect(content).toBe(baseline)
    expect(primitiveExtent(content,`${family}-shaft`)).toEqual(family === 'goods' ? {width:2600,height:3000} : {width:3200,height:6200})
    expect(primitiveExtent(dxf(documents[2]),`${family}-door-opening`)).toEqual(family === 'goods' ? {width:1600,height:2200} : {width:2600,height:2300})
    const first = normalized.drive.parts[0],primitive = plan.primitives.find((p)=>p.id === `${family}-${first.id}-plan`)!
    expect(technicalDxfLayerForPrimitive(primitive)).toBe(family === 'goods' ? 'MACHINE' : 'HYDRAULIC')
    expect(dxf(plan)).toContain('AC1009')
    const opening = plan.primitives.find((p)=>p.id === `${family}-front-opening`)!
    expect(technicalDxfLayerForPrimitive(opening)).toBe('DOORS')
  })
  it.each(['auto','1:20','1:25','1:50','1:100'] as const)('keeps vertical plan dimension labels outside their dimension lanes at %s',scale=>{
    const document = data(family).docs(scale)[0]
    const presentation = createTechnicalDrawingPresentation(document)
    for (const dimension of presentation.primitives.filter((p)=>p.kind === 'dimension')) {
      if (dimension.kind !== 'dimension' || dimension.dimensionStart.x !== dimension.dimensionEnd.x) continue
      const half = dimension.label.length*(dimension.textSizeMm ?? 100)*0.29
      if (dimension.dimensionStart.x < dimension.start.x) expect(dimension.labelPosition.x+half).toBeLessThan(dimension.dimensionStart.x)
      else expect(dimension.labelPosition.x-half).toBeGreaterThan(dimension.dimensionStart.x)
      expect(dimension.valueMm).toBeGreaterThan(0)
    }
  })
  it('prepares complete vector A4 sets without changing scale mapping and blocks oversized/auto exports',()=>{
    const {docs,project} = data(family),documents = docs('1:100')
    const candidates = documents.map((document)=>({document,presentation:createTechnicalDrawingPresentation(document),
      metadata:createTechnicalPlanPdfMetadata(project,document,'1:100',date,document.view === 'door-elevation' ? {landing:1,side:'front'} : undefined)}))
    const result = prepareTechnicalPlanPdf({scope:'plan-set',scale:'1:100',projectName:project.name,candidates})
    expect(result.ok).toBe(true)
    if (!result.ok) throw Error(result.error.code)
    expect(result.value.pages.map((p)=>p.document.view)).toEqual(['plan','section','door-elevation'])
    result.value.pages.forEach((page,index)=>{
      const svg = createTechnicalPlanPdfPageSvg(page)
      expect(svg.getAttribute('data-pdf-mapping')).toBe('physical-page-1-to-1')
      expect(svg.querySelectorAll('image,canvas,[transform*="scale"]')).toHaveLength(0)
      expect(svg.querySelector('[data-technical-sheet-paper-space]')).not.toBeNull()
      expect(page.metadata.sheetNumber).toBe(index+1);expect(page.metadata.sheetCount).toBe(3)
      expect(svg.textContent).toContain(project.name)
    })
    expect(prepareTechnicalPlanPdf({scope:'current',scale:'auto',projectName:project.name,candidates:[]})).toMatchObject({ok:false,error:{code:'fixed-scale-required'}})
    const doc20 = docs('1:20')[1],scale:FixedTechnicalDrawingScale = '1:20'
    expect(prepareTechnicalPlanPdf({scope:'current',scale,projectName:project.name,candidates:[{document:doc20,
      presentation:createTechnicalDrawingPresentation(doc20),metadata:createTechnicalPlanPdfMetadata(project,doc20,scale,date)}]})).toMatchObject({ok:false,error:{code:'drawing-does-not-fit'}})
  })
})
