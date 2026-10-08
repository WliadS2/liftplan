import { describe,expect,it } from 'vitest'
import { Euler,Matrix4,Quaternion,Vector3 } from 'three'
import { createPassengerMechanicalFixture } from '../../../../dev/fixtures/passenger-mechanical-fixture'
import { createLiftGeometryPlanningInput } from '../../lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../passenger-installation-model'
import { createPassengerMechanicalLayout } from './passenger-mechanical-layout'
import { componentBoxBounds,createPassengerMechanicalComponents } from './mechanical-component-model'
import { createPassengerBoxVisualModel } from './passenger-box-visual'
import { createMechanicalVisualResources } from '../../mechanical/mechanical-visual-geometry'

describe('Passenger explicit component presentation regression',()=>{
  it.each([2,6,10])('preserves original component IDs/materials/transforms and world bounds at %i stops',count=>{
    const fixture = createPassengerMechanicalFixture()
    const input = createLiftGeometryPlanningInput({...fixture,stopCount:count})!
    const installation = createPassengerInstallationModel(input)
    if (!('model' in installation) || !installation.model) throw Error('Expected installation')
    const layout = createPassengerMechanicalLayout(input,installation.model)
    const components = createPassengerMechanicalComponents(input.mechanical.components,layout),before = structuredClone(components)
    const parts = [...components.carSling!.boxes,...components.counterweightFrame!.boxes,...components.carGuideShoes.flatMap(s=>s.boxes)]
    const model = createPassengerBoxVisualModel(parts),resources = createMechanicalVisualResources([model],0.65)
    expect(model.pieces.map(p=>p.id)).toEqual(parts.map(p=>p.id));expect(resources.geometry.size).toBe(1)
    parts.forEach((part,index)=>{
      expect(model.pieces[index]).toMatchObject({size:part.size,material:part.material,center:[0,0,0]})
      const matrix = new Matrix4().compose(new Vector3(...part.center),new Quaternion().setFromEuler(new Euler(0,part.rotationY,0)),new Vector3(...part.size))
      const geometry = resources.geometry.get('box')!
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!.clone().applyMatrix4(matrix)
      const original = componentBoxBounds(part)
      box.min.toArray().forEach((value,axis)=>expect(value).toBeCloseTo(original.min[axis],8))
      box.max.toArray().forEach((value,axis)=>expect(value).toBeCloseTo(original.max[axis],8))
      expect(resources.materials.get(part.material)?.opacity).toBe(0.65)
    })
    expect(components).toEqual(before);resources.dispose()
  })
  it('does not create components when supplied data is absent',()=>{
    const model = createPassengerBoxVisualModel([]),resources = createMechanicalVisualResources([model])
    expect(model.pieces).toEqual([]);expect(resources.geometry.size).toBe(0);resources.dispose()
  })
})
