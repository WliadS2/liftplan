import { millimetres as mm } from '../../engineering'
import type { CarrierDrivePlanning, CarrierSafetyPlanning, DriveBoxPlanning, DrivePointMm } from '../../elevator/configuration/carrier-drive-planning'

/** Synthetic schematic QA envelopes only; no manufacturer, approval, recommendation or defaults. */
function box(id:string,x:number,y:number,z:number,w:number,h:number,d:number,
  verticalReference?:DriveBoxPlanning['verticalReference']):DriveBoxPlanning {
  return {id,verticalReference,bounds:{minX:mm(x-w/2),maxX:mm(x+w/2),minY:mm(y),maxY:mm(y+h),minZ:mm(z-d/2),maxZ:mm(z+d/2)}}
}
const point = (x:number,y:number,z:number,attachment:DrivePointMm['attachment'],
  verticalReference?:DrivePointMm['verticalReference']):DrivePointMm => ({x:mm(x),y:mm(y),z:mm(z),attachment,verticalReference})

export function createGoodsTractionDemo():CarrierDrivePlanning {
  return {concept:'traction',source:'demo',
    machine:box('drive-machine',0,3400,-600,600,300,500,'highest-stop'),
    supports:[box('machine-support',0,3300,-600,800,100,600,'highest-stop')],
    sheaves:[box('traction-sheave-car',0,3100,0,240,240,180,'highest-stop'),
      box('traction-sheave-counterweight',0,3100,-1360,240,240,160,'highest-stop')],
    carrierHitches:[box('suspension-hitch-car',0,2460,0,160,100,160,'lowest-stop')],
    counterweight:{travelRatio:1,
      frame:box('counterweight-frame',0,500,-1360,1000,1800,140,'highest-stop'),
      stack:box('counterweight-stack',0,600,-1360,780,1550,100,'highest-stop'),
      rails:[-1,1].map((sign,index)=>({...box(`counterweight-rail-${index}`,sign*550,-1000,-1360,40,1,50),verticalSpan:'shaft' as const})),
      shoes:[-1,1].flatMap((sign,index)=>[600,2000].map((y)=>({...box(`counterweight-shoe-${index}-${y}`,sign*550,y,-1360,100,100,100,'highest-stop'),railId:`counterweight-rail-${index}`}))),
      hitches:[box('suspension-hitch-counterweight',0,2300,-1360,160,100,140,'highest-stop')],
    },
    suspension:[{id:'suspension-route',points:[point(0,2510,0,'carrier','lowest-stop'),
      point(0,3220,0,'fixed','highest-stop'),point(0,3220,-1360,'fixed','highest-stop'),
      point(0,2350,-1360,'counterweight','highest-stop')]}],
  }
}
export function createCarHydraulicDemo():CarrierDrivePlanning {
  return {concept:'hydraulic',source:'demo',layout:'direct',
    cylinder:box('hydraulic-cylinder',1540,-900,-1500,80,600,80,'lowest-stop'),
    base:box('hydraulic-base',1540,-1000,-1500,100,100,100,'lowest-stop'),
    plunger:box('hydraulic-plunger',1540,-800,-1500,40,700,40,'lowest-stop'),
    connection:box('hydraulic-connection',1490,-100,-1500,180,20,100,'lowest-stop'),
    // Declared synthetic stroke only, not inferred from a real cylinder's closed length or pressure.
    travel:{plungerPerCarrierRatio:1,availableStrokeMm:mm(30000)},
  }
}
export function createCarrierSafetyDemo(family:'goods'|'car'):CarrierSafetyPlanning {
  return {source:'demo',gears:[-1,1].map((sign,index)=>({...box(`safety-gear-${index}`,
    sign*(family === 'goods' ? 1090 : 1540),300,0,100,140,100,'lowest-stop'),railId:`rail-${index}`})),
    monitoringPaths:[{id:'monitoring-path',points:[
      point(family === 'goods' ? 1230 : 1590,-600,100,'fixed','lowest-stop'),
      point(family === 'goods' ? 1230 : 1590,2600,100,'fixed','highest-stop'),
      point(family === 'goods' ? 1230 : 1590,2600,-100,'fixed','highest-stop'),
      point(family === 'goods' ? 1230 : 1590,-600,-100,'fixed','lowest-stop'),
      point(family === 'goods' ? 1230 : 1590,-600,100,'fixed','lowest-stop'),
    ]}]}
}
