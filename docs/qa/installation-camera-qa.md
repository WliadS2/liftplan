# Installation versus detail camera QA — 2026-10-07

## Root cause and scoped fix

All three camera adapters classified Gesamtansicht as a moving-assembly frame. The semantic helper limited vertical context to a carrier-sized region, and all three viewports included overview in their follow-offset lists. This was an ownership/framing bug, not a geometry, simulation-timing or scale defect.

The explicit per-family `view-camera-policy.ts` now separates:

| Family | Fixed full-installation views | Moving-detail views | Fixed-detail views |
| --- | --- | --- | --- |
| Passenger | Gesamtansicht, Schnittansicht | Mechanik | Antrieb, Sicherheit, Türen |
| Goods | Gesamtansicht, Schnittansicht | Plattform/Kabine, Lasten, Führungssystem | Türen |
| Auto | Gesamtansicht, Schnittansicht | Plattform, Fahrzeug | Türen, Zufahrt |

Installation views contain full shaft width/depth, pit, all levels, headroom and relevant visible lift/landing structures. Their target is the complete bounds centre, not cabin height. Optional outlying loads and Auto approach/sweep references do not dominate overview bounds. Empty detail modes no longer fall back to hidden whole-scene bounds. The sectional view intentionally shows complete vertical context with its own shallower direction.

Moving details use carrier-local extents. Goods guide inspection reserves nearby rail/shaft context rather than fitting the entire rail length. The normalized rails remain unchanged and fixed; only the camera follows. No per-frame refit, zoom or rotation is introduced. The existing rigid translation preserves orbit, zoom and pan offsets.

Reset still triggers the existing camera owner for the current family/view/geometry, sampling the runtime offset only for moving details. Passenger's key now includes numeric cabin and subsystem bounds rather than presence booleans. Door camera extents include both platform/cabin and landing layers at the inspection floor in camera space only. Passenger defaults to the served floor through boundary notifications; an explicit user door-floor selection retains priority. Neither scene coordinates nor door animation change.

## Chrome acceptance

Actual localhost Chrome, isolated tab. Screenshots saved under `/private/tmp/liftplan-camera-qa.FaUsAW`.

- Passenger: 2/6/10-stop full overviews, six-stop bottom-to-top overview travel with matching shaft screen position, target/current-floor changes through playback, all five detail modes and resets. Mechanik travel retained manual orbit. Türen automatically inspected served floor 6. Reset did not return moving details to floor 1.
- Goods: 2/6/10-stop overview travel; complete shaft remained visible and fixed at bottom/middle/top. All five detail modes and reset checked. Platform follow retained manual orbit. Final guide inspection retained manual orbit and zoom during travel; reset restored its local preset at floor 6, not floor 1.
- Auto: 2/6/10-stop overview travel. Six-stop baseline at the fixture's 0.5 m/s confirmed fixed framing throughout the longer trip. Ten-stop manual orbit during paused travel persisted after resume/arrival without carrier following. Platform, vehicle, doors, approach and sectional presets/reset checked; vehicle local follow retained manual orbit. Ephemeral shaft width/depth edits to 3600/6800 mm and platform-width edit to 2600 mm reframed the current geometry without stale bounds.
- Family/demo replacements rebuilt the correct family camera and runtime. No new browser console errors were recorded. No user tab or running development server was closed/stopped; only the isolated QA tab was cleaned up.

One HMR source edit reset an intermediate Auto runtime; the affected local-follow trip was restarted from the visibly reported current floor. It was not treated as a simulation regression. Selector retries were resolved against fresh UI state.

## Automated coverage and commands

Camera regressions cover full overview bounds at 2/6/10 stops, Passenger cabin-floor independence, shaft/cabin dimension keys, exclusion of hidden/outlying envelopes, eight-corner perspective containment at wide/narrow aspect ratios, distinct policy ownership, actual viewport motion wiring, fixed camera/pivot/zoom throughout 100 travel ticks, manual interaction preservation, served-door extents and current-view reset. Existing timing/door/mechanical/validation/drawing/export/persistence regressions remain in the full suite.

Final commands: `pnpm test` passed 581 tests in 36 files; `pnpm lint`, `pnpm build` and `git diff --check` passed. The existing production chunk-size advisory is unrelated.

## Files changed in this task

New:

- `src/three/camera/view-camera-policy.ts`
- `src/three/camera/installation-camera.test.ts`
- `docs/qa/installation-camera-qa.md`

Updated:

- `src/three/camera/goods-lift-camera.ts`
- `src/three/camera/car-lift-camera.ts`
- `src/three/camera/passenger-camera-bounds.ts`
- `src/three/camera/passenger-simulation-camera-frame.ts`
- `src/three/camera/semantic-moving-frame.ts` (contract comment only)
- `src/three/camera/camera-fit.test.ts`
- `src/three/camera/AutoFitCamera.motion.test.tsx`
- `src/three/scene/ThreeConfiguratorViewport.tsx`
- `src/three/scene/GoodsLiftViewport.tsx`
- `src/three/scene/CarLiftViewport.tsx`
- `src/three/scene/use-carrier-inspection-level.ts` (structural controller input; boundary-only subscription unchanged)
- `src/three/scene/GoodsLiftViewport.test.tsx`
- `src/three/scene/CarLiftViewport.test.tsx`
- `src/simulation/passenger-simulation.test.ts` (camera expectations only)
- `src/simulation/vertical-travel.test.ts` (camera expectations only)
- `src/elevator/goods/goods-lift-qa.test.tsx` (camera expectations only)
- `src/features/project-workspace/FamilyConfigurationForms.stop-count.test.tsx` (camera expectations only)
- `src/three/geometry/car/car-lift-render-model.test.ts` (section camera expectation only)
- `docs/architecture/application.md`
- `docs/3d/passenger-camera-interaction.md`
- `docs/3d/carrier-mechanical-architecture.md`

The preceding uncommitted mechanical implementation is preserved. This task changed no engineering/normalization/validation/mechanical geometry, simulation timing/speed/door stepping, frontend styling, drawings, PDF/DXF or persistence implementation. No commit was created.

## Remaining limitations

Tall, narrow installations necessarily appear narrow when the whole shaft is fitted; detail modes remain available for close inspection. User-controlled pan/zoom/orbit can intentionally crop geometry until reset. Auto approaches remain at their explicit building-space positions, not extrapolated to other stops. Door inspection is a served/selected-floor view, not a continuously moving camera during transit. No orthographic mode, bookmarks or new controls were added.
