// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createCarLiftQaFixture } from '../../dev/fixtures/car-lift-qa-fixture'
import { createGoodsLiftQaFixture } from '../../dev/fixtures/goods-lift-qa-fixture'
import { createProjectStore } from '../../projects'
import { createLiftFamilyTechnicalModel } from '../../lift-families'
import { GoodsLiftConfigurationForm, CarLiftConfigurationForm } from './FamilyConfigurationForms'
import { updateUniformLevelIntervals } from '../../elevator/configuration/uniform-level-update'
import { millimetres as mm } from '../../engineering'
import { getGoodsLiftCameraFrame, getGoodsLiftCameraInstallationKey } from '../../three/camera/goods-lift-camera'
import { getCarLiftCameraFrame, getCarLiftCameraInstallationKey } from '../../three/camera/car-lift-camera'
import { calculateCameraFit } from '../../three/camera/camera-fit'
import { getCameraFrameTrigger } from '../../three/camera/camera-interaction-policy'

afterEach(cleanup)
describe('conditional explicit drive planning forms', () => {
  it.each(['goods', 'car'] as const)('%s edits only the selected concept and does not seed component dimensions', (family) => {
    const store = createProjectStore()
    store.getState().setLiftFamily(family)
    const initial = store.getState().project.configuration
    if (initial.family !== 'goods' && initial.family !== 'car') throw Error('Expected carrier family')
    const editable = initial
    function Harness() {
      const [configuration, setConfiguration] = useState(editable)
      const onChange = (next: typeof editable) => { store.getState().updateConfiguration(next); setConfiguration(next) }
      return configuration.family === 'goods' ? <GoodsLiftConfigurationForm configuration={configuration} onChange={onChange}/>
        : <CarLiftConfigurationForm configuration={configuration} onChange={onChange}/>
    }
    render(<Harness/>)
    fireEvent.click(screen.getByText('Antrieb und Mechanik'))
    const concept = screen.getByRole('combobox', {name:'Antriebskonzept'})
    expect(concept).toHaveProperty('value','unspecified')
    fireEvent.change(concept, {target:{value:'traction'}})
    fireEvent.change(screen.getByRole('spinbutton', {name:'Gegengewichtsweg je Trägerweg'}), {target:{value:'1'}})
    expect(store.getState().project.configuration).toMatchObject({drive:{concept:'traction',source:'planning',counterweight:{travelRatio:1}}})
    fireEvent.change(concept, {target:{value:'hydraulic'}})
    expect(screen.queryByRole('spinbutton',{name:'Gegengewichtsweg je Trägerweg'})).toBeNull()
    fireEvent.change(screen.getByRole('combobox', {name:'Hydraulikanordnung'}), {target:{value:'direct'}})
    fireEvent.change(screen.getByRole('spinbutton', {name:'Verfügbarer Plungerhub mm'}), {target:{value:'1234'}})
    fireEvent.change(screen.getByRole('spinbutton', {name:'Plungerweg je Trägerweg'}), {target:{value:'1'}})
    expect(store.getState().project.configuration).toMatchObject({drive:{concept:'hydraulic',source:'planning',layout:'direct',travel:{availableStrokeMm:1234,plungerPerCarrierRatio:1}}})
    const configured = store.getState().project.configuration
    expect('drive' in configured && configured.drive).not.toHaveProperty('cylinder')
    expect('drive' in configured && configured.drive).not.toHaveProperty('counterweight')
    fireEvent.change(concept, {target:{value:'unspecified'}})
    expect(store.getState().project.configuration).toMatchObject({drive:{concept:'unspecified'}})
    expect(store.getState().persistenceMode).toBe('project')
  })
})
describe('non-passenger stop count editing through the actual forms and store', () => {
  it.each(['goods', 'car'] as const)('%s regenerates uniform levels through 6 → 2 → 6 → 10 → 2', (family) => {
    const store = createProjectStore()
    store.getState().setLiftFamily(family)
    const fixture = family === 'goods' ? createGoodsLiftQaFixture() : createCarLiftQaFixture()
    store.getState().loadDevelopmentConfiguration(fixture)
    function Harness() {
      const [configuration, setConfiguration] = useState(fixture)
      const onChange = (next: typeof fixture) => { store.getState().updateConfiguration(next); setConfiguration(next) }
      return configuration.family === 'goods' ? <GoodsLiftConfigurationForm configuration={configuration} onChange={onChange} />
        : <CarLiftConfigurationForm configuration={configuration} onChange={onChange} />
    }
    render(<Harness />)
    const height = fixture.storeyHeightsMm![0]
    let previousKey = ''
    for (const count of [2, 6, 10, 2]) {
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Anzahl Haltestellen' }), { target: { value: String(count) } })
      const state = store.getState()
      expect(state.configurationDraft).toMatchObject({ stopCount: count, storeyHeightsMm: Array(count-1).fill(height) })
      expect(state.project.configuration).toMatchObject({ stopCount: count })
      expect(state.persistenceMode).toBe('development-demo')
      const technical = createLiftFamilyTechnicalModel(state.project.configuration)
      if (technical.status !== 'available' || technical.family === 'passenger' || !technical.scene || technical.normalized.status === 'empty') throw new Error('Expected scene')
      expect(technical.normalized.status).toBe('complete')
      expect(technical.validation.status).toBe('ok')
      const model = technical.normalized.model
      expect(model.levels.map((l) => l.elevationMm)).toEqual(Array.from({ length: count }, (_, i) => i*height))
      expect(technical.scene.assemblies.filter((a) => a.kind === 'level')).toHaveLength(count)
      const doors = technical.scene.assemblies.filter((a) => a.kind === 'landing-door')
      expect(doors).toHaveLength(2*count)
      expect(new Set(doors.map((d) => d.id)).size).toBe(2*count)
      const top = (count-1)*height
      const cabinHeight = fixture.family === 'goods' ? fixture.platformHeightMm! : fixture.usableHeightMm!
      expect(model.shaft!.minY).toBe(-fixture.pitDepthMm!)
      expect(model.shaft!.maxY).toBe(top+cabinHeight+fixture.headroomMm!)
      expect(model.movingEnvelope!.maxY).toBe(top+cabinHeight)
      const guides = technical.scene.assemblies.filter((a) => a.kind === 'guide')
      expect(guides).toHaveLength(2)
      expect(guides.every((a) => 'size' in a && a.size[1] === (model.shaft!.maxY-model.shaft!.minY)/1000)).toBe(true)
      const frame = technical.family === 'goods' ? getGoodsLiftCameraFrame(technical.scene, 'cutaway') : getCarLiftCameraFrame(technical.scene, 'cutaway')
      expect(frame.target[1]).toBeCloseTo((model.shaft!.minY+model.shaft!.maxY) / 2000)
      expect(frame.bounds.height).toBeCloseTo((model.shaft!.maxY-model.shaft!.minY) / 1000)
      expect(calculateCameraFit(frame.bounds, frame.target, { width: 1000, height: 700 }).position.every(Number.isFinite)).toBe(true)
      const key = technical.family === 'goods' ? getGoodsLiftCameraInstallationKey(technical.scene) : getCarLiftCameraInstallationKey(technical.scene)
      expect(key).not.toBe(previousKey)
      const request = { viewMode: 'cutaway', installationKey: key, doorSelectionKey: '', viewportKey: '1000:700', resetRevision: 0 }
      expect(getCameraFrameTrigger(request, { ...request, resetRevision: 1 })).toBe('reset')
      previousKey = key
    }
  })
})
describe('uniform interval update preserves explicit source data', () => {
  it('does not invent a height for missing data', () => {
    expect(updateUniformLevelIntervals({ stopCount: 6 }, { stopCount: 2 })).toEqual({ stopCount: 2 })
  })
  it('preserves independently entered nonuniform heights, elevations and explicit replacements', () => {
    const configuration = { stopCount: 3, storeyHeightsMm: [mm(2800), mm(3000)] }
    expect(updateUniformLevelIntervals(configuration, { stopCount: 2 }).storeyHeightsMm).toEqual(configuration.storeyHeightsMm)
    const elevated = { stopCount: 2, levelElevationsMm: [mm(100), mm(3100)] }
    expect(updateUniformLevelIntervals(elevated, { stopCount: 6 }).levelElevationsMm).toEqual(elevated.levelElevationsMm)
    const uniform = { stopCount: 6, storeyHeightsMm: Array(5).fill(mm(2800)) }
    expect(updateUniformLevelIntervals(uniform, { stopCount: 2, storeyHeightsMm: [mm(3500)] }).storeyHeightsMm).toEqual([3500])
    expect(updateUniformLevelIntervals(uniform, { stopCount: 2, storeyHeightsMm: undefined }).storeyHeightsMm).toBeUndefined()
  })
  it('does not mask invalid counts or already incoherent interval arrays', () => {
    const c = { stopCount: 6, storeyHeightsMm: [mm(2800)] }
    expect(updateUniformLevelIntervals(c, { stopCount: 10 }).storeyHeightsMm).toEqual([2800])
    const uniform = { stopCount: 2, storeyHeightsMm: [mm(2800)] }
    expect(updateUniformLevelIntervals(uniform, { stopCount: -1 }).storeyHeightsMm).toEqual([2800])
  })
})
