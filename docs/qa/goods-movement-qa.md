# Goods visual movement and door QA

Date: 2026-10-06. This is kinematic visualization, not elevator performance, drive design or an engineering approval.

Historical implementation report: its fixed travel profile and fixed overview policy were superseded on 2026-10-07 by [shared nominal-speed travel and semantic camera tracking](nominal-speed-camera-qa.md). The door/attachment/validation observations below remain useful; current timing and overview behavior are described in the newer report.

## Runtime architecture

The independent goods simulation adapter consumes normalized millimetre geometry and structured validation. Its external controller owns current/source/target landing IDs, phase, elapsed screen time, progress and pause state. It has no React, Three.js or Zustand dependency. Start → close doors → travel → open destination doors is deterministic across tick subdivisions. Doors stay open after arrival until another departure; reset returns to the lowest declared elevation, closed doors and idle state. All stop elevations, including explicit nonuniform/elevated references, remain authoritative.

Timing is an isolated visual profile (6 seconds per journey, 1.5 seconds per opening/closing), never derived from rated speed/load, persisted or exported as real performance. Model capabilities independently report platform, front/rear door, landing-door and load-envelope movement. Drive/counterweight/rope/safety simulation remain explicitly unsupported. The family registry now exposes goods simulation; Auto simulation remains unavailable and passenger simulation is unchanged.

The goods viewport recreates its controller on normalized input changes, same-geometry demo reloads and validation changes. Family switches unmount it. Selection is controller-bound so an old six/ten-stop target cannot survive a new two-stop controller. Runtime pose never modifies configurationDraft, the last-valid project, IndexedDB, file export or demo persistence mode.

## Moving and fixed attachments

One R3F clock advances the pure controller and applies rigid transforms to a single moving group. Platform shell/floor, configured load envelopes and platform-side door symbols move together. Shaft/pit/headroom, landing references/frames, guide axes and the declared swept envelope remain fixed. Door attachment metadata carries role, side and landing ID directly from the normalized scene adapter; bindings do not infer landing identity from renderer state.

Two-leaf sliding symbols are visualization geometry only: each covers half the existing clear opening and slides outward by that half-width. They add no engineering panel thickness/operator specification. Front and rear are independent capabilities; through-car animates both configured sides. Only panels of the current landing open; all other landing panels stay closed at their original elevations. During travel every door is closed. Opening perimeter, sill and dashed track references remain in place as zero-thickness technical lines. No second usable-opening or engineering geometry model is introduced.

## Geometry guards

Goods spatial issues now explicitly declare `blocksPlatformTravel`, independent of aggregate INVALID/UNKNOWN status. Actual platform/shaft penetration, moving-envelope containment failure and guide-axis penetration block playback. The adapter additionally checks carried loads against shaft swept bounds and declared guide axes, and closed platform-door extents against shaft bounds. Contact is not converted into a clearance violation. Invalid load/platform fit that still leaves the load inside the declared shaft and outside the guide axes is reported by planning validation but does not blanket-disable travel.

Missing fundamental platform, shaft or two ordered elevations yields an unavailable runtime and a German incomplete-planning notice. Missing optional door/load data only disables the affected visual capability. Invalid but normalizable geometry remains rendered. No regulatory clearance, drive formula or manufacturer limit was introduced.

## Camera

Full-installation modes (overview, doors, guides and cutaway) use stable bounds/pivots throughout playback. Local platform/load modes translate camera and orbit pivot by the carrier offset, retaining the user's relative orbit/pan/zoom. Fitting occurs only on existing framing events or controller replacement, never on animation progress. Reset uses the current mode; motion reset also requests its canonical frame. Camera-only bounds reserve full schematic door travel once. Neither normalized geometry nor drawing/export bounds change.

## Honest mechanical scope

The current goods model supplies platform surfaces, opening dimensions and two guide axes. This pass adds explicit moving/fixed organization, animated schematic panels and opening frame/sill/track references. It does not fabricate carrier-member sections, slab thickness, shoes, buffer sizes, rail profiles, ropes, counterweights, traction/hydraulic machinery or safety gear. Those need explicit domain/component data before detailed meshes can be implemented. The six-stop fixture remains unchanged, complete for the available visual capabilities and excluded from production defaults/autosave.

## Automated coverage

- Start/pause/resume/reset; current/target stop; upward/downward and middle-stop journeys at 2/6/10 stops.
- Explicit elevations, tick subdivision, invalid clocks/transitions and closed-before-travel guards.
- Front-only/rear-only/through-car capabilities, destination-only landing panels and reset poses.
- Moving platform/load/door attachments versus fixed shaft/levels/rails/landing frames/swept bounds.
- Missing optional inputs, incomplete fundamental geometry, true travel conflicts and unrelated fit results.
- Actual viewport controls, same-geometry reload, count changes, empty-project reset and Passenger/Goods/Car switching.
- Stable all-mode bounds/keys, full door-travel reservation and a camera binding test proving 100 motion frames produce only the initial fit while retaining user offsets/reset behavior.
- Existing passenger, Auto, drawing/PDF/DXF and persistence regression tests.

Verification: `pnpm test` passed 509 tests in 33 files. `pnpm lint`, `pnpm build` and `git diff --check` passed. The pre-existing production chunk-size warning remains.

## Chrome QA

Real WebGL Chrome checks covered:

- Six-stop Goods journeys 1→6, 6→1, 1→2→5, pause/resume and deterministic reset.
- Ground→top and top→ground at ten stops; ground→top and reset at two stops. The pure tests cover both directions and mid-stop transitions at all three counts.
- All six Goods modes at 2/6/10 stops. Overview/section keep the full vertical installation visible; local platform/load modes retain their usable inspection scale at any elevation. Ten-stop whole-tower details naturally become smaller; no engineering geometry is stretched or cropped to compensate.
- Front-only, rear-only and through-car playback: the configured side(s) open on arrival, with the remaining landing doors closed/fixed. Platform/load bounds include open leaf travel without clipping.
- Orbit and wheel zoom while paused, current-view camera reset, continuation and load labels remaining attached. Pan remains enabled by the unchanged OrbitControls interaction contract; a held-button pan gesture was not independently exercised.
- Count changes and same-geometry fixture reload return to idle/lowest stop/closed doors. Passenger→Goods→Passenger→Goods and Goods→Auto→Goods restore the correct view catalog, controls and idle state.
- Passenger start/pause/resume/reset remains functional with its existing partial capability state and pre-existing UNKNOWN counterweight movement assessment (zero INVALID issues). Auto retains its vehicle renderer, geometric OK fixture and no Fahrdemo controls.
- A 2800 mm platform in the explicit 2600 mm shaft blocks movement but keeps the invalid geometry visible. Reloading the unmodified fixture restores zero conflicts and available playback.
- Development demo save/file-export controls remain disabled; normal empty projects receive no fixture values.
- Final demo reset returns to an empty Goods project, removes the playback controls/scene and shows the incomplete-planning notice. Console error checks are empty; the only browser warnings are the pre-existing `THREE.Clock` deprecation messages.

Proof images are scratch QA artifacts under `/private/tmp/liftplan-goods-motion-qa.Qj16r1/`. No screenshots are used as application assets or export geometry.

## Files

New:

- `src/simulation/goods-simulation.ts`
- `src/simulation/goods-simulation.test.ts`
- `src/three/geometry/goods/goods-motion-bindings.ts`
- `src/three/scene/GoodsSimulationDriver.tsx`
- `src/three/scene/GoodsSimulationControls.tsx`
- `src/three/camera/AutoFitCamera.motion.test.tsx`
- `docs/qa/goods-movement-qa.md`

Modified:

- `src/collision/goods-lift-spatial-validation.ts`
- `src/elevator/configuration/lift-type-registry.ts`
- `src/elevator/goods/goods-lift-scene-model.ts`
- `src/elevator/goods/goods-lift.test.ts`
- `src/three/geometry/goods/GoodsLiftAssembly.tsx`
- `src/three/scene/GoodsLiftViewport.tsx`
- `src/three/scene/GoodsLiftViewport.test.tsx`
- `src/three/camera/AutoFitCamera.tsx`
- `src/three/camera/goods-lift-camera.ts`
- `docs/architecture/application.md`

No CSS, ProjectWorkspace, passenger simulation, Auto implementation, normalized engineering geometry, fixture, persistence schema or drawing/export implementation changed. No commit was created.
