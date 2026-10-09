// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LandingEditor } from './LandingEditor'
import { createProjectStore } from '../../projects'
import { millimetres as mm } from '../../engineering'
import { createPassengerPlanningConfiguration } from '../../elevator'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'

afterEach(cleanup)
describe('landing editor', () => {
  it.each(['passenger','goods','car'] as const)('%s edits real serializable project inputs', (family) => {
    const store = createProjectStore()
    const initial = family === 'passenger' ? { ...createPassengerPlanningConfiguration('Test'),
      stopCount:2, floorHeightMm:mm(3000), throughCar:true } : family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
    store.getState().updateConfiguration(initial)
    function Harness() {
      const [configuration,setConfiguration] = useState(initial)
      return <LandingEditor configuration={configuration} passenger={family==='passenger'} onChange={(c)=>{
        expect(store.getState().updateConfiguration(c).status).toBe('valid'); setConfiguration(c)
      }}/>
    }
    render(<Harness/>)
    fireEvent.change(screen.getByLabelText('Bezeichnung Haltestelle 2'),{target:{value:'OG 1'}})
    fireEvent.change(screen.getByLabelText('Höhenposition Haltestelle 2 (mm)'),{target:{value:'3200'}})
    fireEvent.change(screen.getByLabelText('Zugang vorne Haltestelle 2'),{target:{value:'false'}})
    expect(store.getState().project.configuration).toMatchObject({levelElevationsMm:expect.arrayContaining([3200]),
      landingSettings:expect.arrayContaining([expect.objectContaining({id:'level-2',label:'OG 1',frontAccess:false,rearAccess:true})])})
    fireEvent.click(screen.getByLabelText('Haltestelle 1 entfernen'))
    expect(store.getState().project.configuration).toMatchObject({landingSettings:expect.arrayContaining([expect.objectContaining({id:'level-2'})])})
    fireEvent.click(screen.getByText('Haltestelle hinzufügen'))
    expect(store.getState().project.configuration).toMatchObject({stopCount:initial.stopCount})
  })
  it('disables unsupported rear access and leaves unknown added positions empty',()=>{
    const configuration = {stopCount:2,levelElevationsMm:[mm(0),mm(3200)],throughCar:false}
    let latest = configuration
    render(<LandingEditor configuration={configuration} passenger onChange={(c)=>{latest=c}}/>)
    expect(screen.getByLabelText('Zugang hinten Haltestelle 2')).toHaveProperty('disabled',true)
    fireEvent.click(screen.getByText('Haltestelle hinzufügen'))
    expect(latest.levelElevationsMm).toEqual([0,3200,null])
  })
})
