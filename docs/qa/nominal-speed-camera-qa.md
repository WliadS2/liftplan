# Cross-family nominal-speed and semantic-camera QA

Date: 2026-10-07. Current uncommitted workspace; no commit created. Existing passenger, goods and car domain/render work was retained. No CSS, ProjectWorkspace presentation, engineering dimensions, drawing projection or PDF/DXF scale changes were made.

## Root causes and implementation

Passenger normalization did not pass configured nominal speed into its simulation contract. The passenger state machine read `VisualizationTiming.travelSeconds` (6 seconds in the application profile, 8 in the separate development profile), so distance and speed could not determine duration. The existing uncommitted goods runtime similarly used a 6-second visualization duration. Both also smoothed vertical interpolation instead of representing constant nominal speed. The inspected workspace had no car vertical runtime: its registry explicitly declared simulation unavailable.

`simulation/vertical-travel.ts` is now the single pure calculation: absolute elevation difference in metres divided by explicit nominal speed in m/s. It returns available/unknown/invalid, with no fallback speed. Nonpositive/nonfinite speed, nonfinite elevation and overflow are invalid. Passenger and the common goods/car carrier runtime capture the result at departure and use linear vertical interpolation. Door easing and deterministic door/dwell/arrival timings remain separate. The passenger counterweight, rope, sheave and door pose calculations remain in their existing controller.

Goods and car have independent geometry/validation adapters; they share only the render-neutral carrier state machine. Auto now has minimal, explicitly partial platform/vehicle vertical visualization, not goods vehicle engineering. It does not claim door animation, turning, acceleration, motor, safety, rope or counterweight behavior.

The React lifecycle adapter preserves controller identity, phase, pause, pose and camera identity for speed-only edits. A journey retains its captured speed; the edited speed applies at the next departure. This is stated in German in all controls. Missing speed blocks a new departure without destroying an active controller. A same-speed demo reload or other geometry replacement still resets normally.

Previously overview fitting used the entire tower/static travel midpoint. Passenger local simulation framing also combined moving car and inversely moving counterweight bounds on explicit fit events, instead of following the car each tick. Increasing stop count therefore moved or diluted the focus; arrival did not reliably move it to the current car.

The common `semantic-moving-frame.ts` derives a local frame around the carrier. Overview retains horizontal shaft context and a local vertical context band, not the whole installation height. Passenger uses cabin/frame/car-side parts, goods uses platform/carried loads, and car uses platform/vehicle/contacts/axles/reference parts. Fixed approaches are excluded from the car focal assembly. No Three.js mesh is queried as a domain source.

`AutoFitCamera` accepts a render-neutral motion identity and offset callback. On ordinary animation frames it translates camera position and OrbitControls target by the same offset delta, without fitting, look-at, projection reset, quaternion reset or controls reset. Initial load, geometry/view/viewport changes and explicit reset fit once, then add the CURRENT runtime offset. Arrival, target selection and pause do not re-fit.

Moving policies: passenger overview/mechanics/cutaway; goods overview/platform/loads/cutaway; car overview/platform/vehicle/cutaway. Fixed inspection policies: passenger drive/safety/doors; goods guides/landing doors; car approach/landing doors.

## Real Chrome measurements

Chrome at localhost:5173, existing development server, isolated agent-created tab. All fixtures were loaded explicitly through development controls. No fixture values became production defaults.

Passenger/goods times below measure the observed `Fahrt` phase, excluding doors and arrival. Car starts immediately without a closing-door phase, so its comparable measurement starts immediately before the start click and ends at observed arrival. This includes approximately 0.03–0.04 seconds of command/frame overhead; starting its timer after the awaited click misses approximately 0.28 seconds of actual travel. Raw records preserve both observations. Measurements are browser/frame observations, not certified journey times.

| Family / stops / bottom-to-top distance | 0.5 m/s | 1 m/s | 2 m/s |
| --- | ---: | ---: | ---: |
| Passenger / 2 / 3 m | 6.003 s | 2.994 s | 1.499 s |
| Passenger / 6 / 15 m | 30.001 s | 15.016 s | 7.501 s |
| Goods / 6 / 15 m | 30.000 s | 14.994 s | 7.497 s |
| Car / 6 / 14 m (click to arrival) | 28.032 s | 14.037 s | 7.037 s |

Each family's same-distance samples demonstrate half the duration when doubling speed. Passenger/goods fixture storeys are 3000 mm; car fixture storeys are 2800 mm. The fixtures were not changed to make their distances identical.

| Chrome trip | Speed | Observed seconds |
| --- | ---: | ---: |
| Passenger 10 stops, 1 → 10 / 10 → 1 | 2 | 13.496 / 13.497 |
| Passenger 10 stops, 1 → 4 / 4 → 5 | 2 | 4.494 / 1.495 |
| Passenger 6 stops, repeated 1 → 6 / 6 → 1 | 2 | 7.491 / 7.503 |
| Passenger 2 stops, next downward trip after speed edit | 1 | 2.992 |
| Goods 2 stops, 1 → 2 / 2 → 1 | 2 | 1.502 / 1.504 |
| Goods 10 stops, 1 → 10 / 10 → 1 | 2 | 13.495 / 13.502 |
| Goods 10 stops, 1 → 4 | 2 | 4.503 |
| Goods 10 stops, 7 → 6 after speed edit | 1 | 2.997 |
| Goods local loads view, 6 stops, 1 → 6 / 6 → 1 | 2 | 7.496 / 7.488 |
| Car 2 stops, 1 → 2 / 2 → 1 | 2 | 1.436 / 1.441 |
| Car 6 stops, repeated 1 → 6 / 6 → 1 | 2 | 7.040 / 7.036 |
| Car 10 stops, 1 → 10 / 10 → 1 | 2 | 12.638 / 12.641 |
| Car 10 stops, 1 → 4 | 2 | 4.237 |
| Car 10 stops, 7 → 6 after speed edit | 1 | 2.836 |
| Car local vehicle view, 6 → 4 | 1 | 5.633 |

Active-edit checks paused a journey, changed speed 2 → 1, and resumed. The current pose/level/target were retained for all three families. The wall-clock observations including the intentional pause were passenger 1.934 s (3 m, 1.5 s moving), goods 4.982 s (9 m, 4.5 s moving), and car 4.714 s (8.4 m, 4.2 s moving plus click overhead). Those are NOT used as uninterrupted speed measurements. The following trip used the new speed, as recorded above.

## Camera and assembly observations

All three families stayed usefully framed during upward/downward movement and after top-floor arrival. Manual native Chrome orbit drags during the 1 m/s six-stop trips changed the camera angle and the new angle survived continued travel and arrival. Explicit view reset at an upper floor framed the current carrier, not the original ground-floor position. Goods Lasten and car Fahrzeug local views also followed their moving assembly.

Goods platform-side doors and pallet/roll-container/forklift envelopes retain their moving bindings. Fixed landing doors and guides do not travel. Auto platform, body, four contact markers, two axle references and vehicle reference geometry share one moving group; fixed approaches and guides stay fixed. Passenger inverse counterweight/rope/door regression tests still pass.

Manual pan/zoom invariance is covered by common camera tests (stable relative position and target, retained quaternion, no repeated fit); native Chrome manual-orbit acceptance was exercised separately in each family. No claim is made that every pan/zoom gesture was independently repeated in all three browser views.

Screenshot evidence and raw timings for this run are local QA artifacts:

- `/private/tmp/liftplan-speed-focus-qa.MSTzGl/passenger-top-six.png`
- `/private/tmp/liftplan-speed-focus-qa.MSTzGl/goods-top-six.png`
- `/private/tmp/liftplan-speed-focus-qa.MSTzGl/car-top-six.png`
- `/private/tmp/liftplan-speed-focus-qa.MSTzGl/passenger-speed-edit.png`
- `/private/tmp/liftplan-speed-focus-qa.MSTzGl/timings.json`

Console: no errors; existing `THREE.Clock` deprecation warnings only. A development source-module HMR reload during implementation reloaded the ephemeral test project; fixtures were explicitly reloaded. Speed edits after implementation did not reload or teleport it.

## Automated verification

- Shared math: identical 6 m trips produce exactly 12/6/3 seconds; reverse, zero distance, fractional precision, unknown and invalid input.
- All three families: 2/6/10 stops at 0.5/1/2 m/s; constant-speed midpoint, bottom/top and downward arrivals; middle/adjacent trips where count permits; active speed edits and next departure; missing/nonpositive/nonfinite speed.
- Camera: semantic local bounds independent of tower count; simulated-Y translation; stable camera-target offset and manual quaternion; 100 ticks without repeated fitting; current-position reset and arrival; Auto approach exclusion.
- Integration: goods/car paused speed-only rerenders preserve the actual controller; next trip changes duration; same-speed fixture reload resets normally.
- Existing passenger mechanics, collision, drawings, PDF/DXF, persistence and family tests retained.
- Final commands: `pnpm test` (533 tests / 34 files), `pnpm lint`, `pnpm build`, `git diff --check`. All passed. Existing build chunk-size warning remains.

## Exact task file scope

New:

- `src/simulation/vertical-travel.ts`, `vertical-travel.test.ts`, `platform-simulation.ts`, `car-simulation.ts`
- `src/three/camera/semantic-moving-frame.ts`
- `src/three/geometry/car/car-motion-bindings.ts`
- `src/three/scene/use-kinematic-runtime.ts`, `PlatformSimulationControls.tsx`, `CarSimulationDriver.tsx`
- `docs/qa/nominal-speed-camera-qa.md`

Updated (paths below are relative to their group):

- `src/simulation/`: `passenger-simulation.ts`, `passenger-simulation-model.ts`, `passenger-visualization-profile.ts`, `passenger-simulation.test.ts`, `goods-simulation.ts`, `goods-simulation.test.ts`, `README.md`
- `src/three/camera/`: `AutoFitCamera.tsx`, `AutoFitCamera.motion.test.tsx`, `passenger-camera-bounds.ts`, `passenger-simulation-camera-frame.ts`, `goods-lift-camera.ts`, `car-lift-camera.ts`, `camera-fit.test.ts`
- `src/three/scene/`: `ThreeConfiguratorViewport.tsx`, `GoodsLiftViewport.tsx`, `GoodsLiftViewport.test.tsx`, `CarLiftViewport.tsx`, `CarLiftViewport.test.tsx`, `GoodsSimulationControls.tsx`, `PassengerSimulationControls.tsx`
- `src/three/geometry/`: `lift-geometry-planning-input.ts`, `car/CarLiftAssembly.tsx`, `car/car-lift-render-model.test.ts`
- `src/elevator/`: `goods/goods-lift-model.ts`, `goods/goods-lift-qa.test.tsx`, `car/car-lift-model.ts`, `car/car-lift.test.ts`, `configuration/lift-type-registry.ts`
- `src/dev/fixtures/passenger-simulation-demo.ts`
- `src/collision/passenger-spatial-validation.test.ts`
- `src/features/project-workspace/FamilyConfigurationForms.stop-count.test.tsx` (test only)
- `docs/architecture/application.md`, `docs/3d/passenger-kinematic-simulation.md`, `docs/qa/goods-movement-qa.md` (historical note retained)

The goods simulation/control/camera-motion test and goods QA files were already untracked at task entry. Their pre-existing implementation was evolved, not discarded. Pre-existing goods collision/scene/render/binding changes outside this timing/focus scope were preserved unchanged.

## Limitations and completion gate

This is constant-speed kinematic visualization only. There is no acceleration, jerk, braking, certified journey-time or load-performance model. Active journeys use their departure speed rather than retiming remaining travel. Auto doors/vehicle dynamics/turning remain unavailable. Overview prioritizes local moving context rather than showing every floor at once; fixed subsystem views retain fixed policies. Geometry edits retain existing reset semantics. No claims of exhaustive browser performance or engineering conformity are made.

PASSENGER SPEED: PASS

GOODS SPEED: PASS

AUTO SPEED: PASS

PASSENGER CAMERA FOLLOW: PASS

GOODS CAMERA FOLLOW: PASS

AUTO CAMERA FOLLOW: PASS
