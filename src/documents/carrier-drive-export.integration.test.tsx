// @vitest-environment jsdom
/// <reference types="node" />
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest'
import { jsPDF } from 'jspdf'
import { createGoodsLiftQaFixture } from '../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../dev/fixtures/car-lift-qa-fixture'
import { createPassengerMechanicalFixture } from '../dev/fixtures/passenger-mechanical-fixture'
import { createGoodsLiftDrawingContext } from '../drawings/goods-lift-technical-drawings'
import { createCarLiftDrawingContext } from '../drawings/car-lift-technical-drawings'
import { createPassengerDrawingContext } from '../drawings/passenger-technical-drawings'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import { createLiftPlanDrawing,createLiftSectionDrawing,createLiftDoorElevationDrawing } from '../drawings/lift-family-technical-drawings'
import { createTechnicalDrawingPresentation } from '../drawings/technical-drawing'
import { createLiftPlanProject } from '../projects/project-factory'
import { createTechnicalPlanPdfMetadata,prepareTechnicalPlanPdf } from './technical-plan-pdf'
import { generateTechnicalPlanPdf } from './technical-plan-pdf-renderer'
import { createTechnicalPlanDxfMetadata,prepareTechnicalPlanDxf } from './technical-plan-dxf'
import { generateTechnicalPlanDxf } from './technical-plan-dxf-renderer'
import { editLanding,resizeLandings } from '../elevator/configuration/landing-planning'
import { millimetres } from '../engineering'

// Exercise the browser ESM build used by Vite, rather than the package's Node UMD entry.
vi.mock('svg2pdf.js',async()=>{
  const entry = 'svg2pdf.js/dist/svg2pdf.es.min.js'
  return import(entry)
})

// jsdom has no font layout. Supply only text metrics from the same PDF font;
// the actual svg2pdf converter and all geometry/page transforms remain unmocked.
beforeAll(()=>{
  const metrics = new jsPDF({unit:'pt'})
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null)
  Object.defineProperty(SVGElement.prototype,'getBBox',{configurable:true,value:function(this:SVGElement) {
    if (this.tagName.toLowerCase() !== 'text') throw Error('Unexpected non-text layout dependency')
    const size = parseFloat(this.style.fontSize || this.getAttribute('font-size') || '16')
    metrics.setFont('helvetica',this.style.fontWeight === 'bold' ? 'bold' : 'normal');metrics.setFontSize(size)
    return {x:0,y:-size,width:metrics.getTextWidth(this.textContent ?? ''),height:size}
  }})
})
afterAll(()=>{Reflect.deleteProperty(SVGElement.prototype,'getBBox');vi.restoreAllMocks()})

describe('actual SVG to PDF vector generation regression',()=>{
  it.each((['passenger','goods','car'] as const).flatMap(family=>[false,true].map(custom=>({family,custom}))))('$family generates current and complete vector A4 sheets (custom landings: $custom)',async ({family,custom})=>{
    const base = family === 'goods' ? createGoodsLiftQaFixture() : family === 'car' ? createCarLiftQaFixture() : createPassengerMechanicalFixture()
    const config = custom ? editLanding(editLanding(resizeLandings(base,family==='passenger',2),family==='passenger',0,{label:'EG'}),
      family==='passenger',1,{label:'OG 1',elevationMm:millimetres(3200)}) : base
    const planning = createLiftGeometryPlanningInput(config)
    const context = config.family === 'goods' ? createGoodsLiftDrawingContext(config) : config.family === 'car' ? createCarLiftDrawingContext(config)
      : planning ? createPassengerDrawingContext(planning) : undefined
    if (!context) throw Error('Missing drawing context')
    const project = {...createLiftPlanProject({liftFamily:family,projectName:config.projectName,projectId:`${family}-drive-export-qa`}),configuration:config}
    const documents = [createLiftPlanDrawing(context,'1:100'),createLiftSectionDrawing(context,'1:100'),
      createLiftDoorElevationDrawing(context,{levelId:'level-1',side:'front'},'1:100')]
    const candidates = documents.map((document)=>({document,presentation:createTechnicalDrawingPresentation(document),
      metadata:createTechnicalPlanPdfMetadata(project,document,'1:100',new Date(2026,9,8),
        document.view === 'door-elevation' ? {landing:1,side:'front'} : undefined)}))
    if (process.env.LIFTPLAN_QA_OUTPUT_DIR) {
      const {writeFile} = await import('node:fs/promises')
      for (const document of documents) {
        const result = prepareTechnicalPlanDxf({scope:'current',projectName:project.name,candidates:[{document,
          metadata:createTechnicalPlanDxfMetadata(project,document,new Date(2026,9,8),
            document.view === 'door-elevation' ? {landing:1,side:'front'} : undefined)}]})
        if (!result.ok) throw Error(result.error.code)
        await writeFile(`${process.env.LIFTPLAN_QA_OUTPUT_DIR}/${family}-${document.view}.dxf`,generateTechnicalPlanDxf(result.value))
      }
    }
    for (const scope of ['current','plan-set'] as const) {
      const prepared = prepareTechnicalPlanPdf({scope,scale:'1:100',projectName:project.name,candidates:scope === 'current' ? candidates.slice(0,1) : candidates})
      if (!prepared.ok) throw Error(prepared.error.code)
      const blob = await generateTechnicalPlanPdf(prepared.value)
      const buffer = await new Promise<ArrayBuffer>((resolve,reject)=>{
        const reader = new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=()=>reject(reader.error);reader.readAsArrayBuffer(blob)
      })
      const bytes = new Uint8Array(buffer),text = new TextDecoder('latin1').decode(bytes)
      expect(text.startsWith('%PDF-')).toBe(true)
      expect(text).not.toContain('/Subtype /Image')
      expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBe(scope === 'current' ? 1 : 3)
      if (process.env.LIFTPLAN_QA_OUTPUT_DIR) {
        const {writeFile} = await import('node:fs/promises')
        await writeFile(`${process.env.LIFTPLAN_QA_OUTPUT_DIR}/${family}-${scope}-100.pdf`,bytes)
      }
    }
  })
})
