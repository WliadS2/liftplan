# Carrier mechanical QA — 2026-10-07

## Automated checks

The focused carrier suite covers both Goods and Car at 2, 6 and 10 stops: deterministic frame/floor/rail/shoe/buffer construction; fixed/moving classification; actual Three group world transforms using the shared driver bindings; carried loads/vehicle; served landing leaves only; closed doors during travel; defaults without demo data; optional schema roundtrip/provenance; all existing view modes; selected-landing camera bounds; absent dependencies as UNKNOWN; elevated platform/pit datum; contact versus penetration; frame intrusion; swept floor/buffer conflicts; and narrowly scoped shoe/rail exemptions. Schematic door sections never change clear opening dimensions.

Final validation: `pnpm test` passed all 561 tests in 35 files (28 focused carrier tests); `pnpm lint`, `pnpm build` and `git diff --check` passed. Existing Passenger, drawing/export, persistence and simulation tests remain in the full suite. The build reports its existing large-chunk advisory.

## Real Chrome inspection

Local `http://localhost:5173/`, isolated QA tab; user tabs and the running development server were not modified or stopped. All six views of each family were inspected. Both demos were checked idle, mid-travel (pause), top arrival, Türen, Gesamtansicht and Schnittansicht. Explicit floor/frame/shoes travel together with Goods loads or Auto vehicle; two rails and two three-part buffers stay fixed. Top landing leaves open only at the served floor. Door inspection isolates the current landing instead of framing the entire tower. Auto contact/axle/reference geometry remains attached; approaches remain fixed.

Native orbit during paused Auto travel was retained after resume and arrival. Family switching Goods → Car → Goods → Car → Passenger reset the family runtime without stale assemblies. Deliberately enlarging Goods platform width to 2200 mm or Auto width to 3100 mm caused genuine declared frame/guide geometry conflicts: status INVALID, playback unavailable, geometry still visible. Reloading the demo restored the baseline. Passenger source was not changed; its mechanical scene and complete 2-stop journey were checked in Chrome.

Measured uninterrupted vertical phase durations (DOM phase observation; browser-frame jitter, not certified journey times):

| Family | Stops / vertical distance | Speed | Observed vertical phase |
| --- | --- | --- | --- |
| Goods | 2 / 3 m | 2 m/s | 1.498 s |
| Goods | 10 / 27 m | 2 m/s | 13.491 s |
| Goods | 2 / 3 m | 1 m/s | 3.000 s |
| Auto | 2 / 2.8 m | 2 m/s | 1.378 s |
| Auto | 10 / 25.2 m | 2 m/s | 12.601 s |
| Auto | 2 / 2.8 m | 1 m/s | 2.787 s |
| Passenger | 2 / 3 m | 1 m/s | 3.001 s |

Six-stop trips were interrupted for mid-travel screenshots/manual orbit and are not uninterrupted duration measurements. Auto now includes schematic door-closing/opening phases outside the vertical phase. A first Passenger sample missed the arrival phase; the fresh complete phase trace above supersedes it. No browser console errors were recorded; the existing Three.Clock deprecation warning remains.

Screenshots and raw phase/timing observations are saved locally in `/private/tmp/liftplan-carrier-mechanics-qa.x9Bunf`. No screenshot is used as geometry or project data.

## Exact changed-file inventory

New:

- `src/elevator/configuration/carrier-mechanical-planning.ts`
- `src/elevator/models/carrier-mechanical-model.ts`
- `src/collision/carrier-mechanical-validation.ts`
- `src/dev/fixtures/carrier-mechanical-demo.ts`
- `src/three/geometry/carrier/carrier-door-model.ts`
- `src/three/geometry/carrier/carrier-door-display.ts`
- `src/three/geometry/carrier/CarrierDoor.tsx`
- `src/three/geometry/carrier/carrier-motion-bindings.ts`
- `src/three/geometry/carrier/carrier-mechanics.test.ts`
- `src/three/scene/CarrierSimulationDriver.tsx`
- `src/three/scene/use-carrier-inspection-level.ts`
- `docs/3d/carrier-mechanical-architecture.md`
- `docs/qa/carrier-mechanical-qa.md`

Updated:

- `src/elevator/configuration/goods-lift-configuration.ts`
- `src/elevator/configuration/car-lift-configuration.ts`
- `src/elevator/goods/goods-lift-model.ts`
- `src/elevator/goods/goods-lift-scene-model.ts`
- `src/elevator/car/car-lift-model.ts`
- `src/elevator/car/car-lift-scene-model.ts`
- `src/collision/goods-lift-spatial-validation.ts`
- `src/collision/car-lift-spatial-validation.ts`
- `src/dev/fixtures/goods-lift-qa-fixture.ts`
- `src/dev/fixtures/car-lift-qa-fixture.ts`
- `src/simulation/car-simulation.ts`
- `src/three/geometry/goods/GoodsLiftAssembly.tsx`
- `src/three/geometry/goods/goods-lift-render-model.ts`
- `src/three/geometry/goods/goods-motion-bindings.ts`
- `src/three/geometry/car/CarLiftAssembly.tsx`
- `src/three/geometry/car/car-lift-render-model.ts`
- `src/three/geometry/car/car-motion-bindings.ts`
- `src/three/camera/goods-lift-camera.ts`
- `src/three/camera/car-lift-camera.ts`
- `src/three/scene/GoodsLiftViewport.tsx`
- `src/three/scene/CarLiftViewport.tsx`
- `src/three/scene/GoodsSimulationDriver.tsx`
- `src/three/scene/CarSimulationDriver.tsx`
- `src/three/scene/PlatformSimulationControls.tsx`
- `src/three/geometry/car/car-lift-render-model.test.ts`
- `src/elevator/goods/goods-lift-qa.test.tsx`
- `src/features/project-workspace/FamilyConfigurationForms.stop-count.test.tsx`
- `src/simulation/vertical-travel.test.ts`
- `docs/architecture/application.md`

The pre-existing camera expectations in tests were updated only for explicit carrier sections; the platform-only camera test explicitly excludes mechanical data to retain its original purpose. No CSS, form presentation, Passenger source, drawings, PDF/DXF, persistence implementation or dependencies changed. No commit was created.
