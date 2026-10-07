# Three-family view-mode runtime QA — 2026-10-07

## Root cause and completed wiring

The unfinished workspace added `cabin` to the passenger type/catalog, visibility and camera files, but `ThreeConfiguratorViewport` still rendered six hard-coded buttons. The catalog was not the runtime toolbar's source. Its order also differed from the required order. Existing reset/follow infrastructure could handle the new mode, but users could not select it.

The toolbar now directly consumes the typed, ordered implemented catalog. Its actual order is Gesamtansicht, Kabine, Mechanik, Antrieb, Sicherheit, Türen, Schnittansicht, Ansicht zurücksetzen. Selection reaches the scene, semantic frame and motion policy, not only a label list. A mounted viewport regression exercises every button and both scene/camera props.

The previous attempt also left Mechanik as a moving cabin clone, let fixed rails/machinery/landing components clutter Kabine, and classified sections as installation views without distinct Goods/Auto shaft presentation. Those useful initial cabin/section changes were completed, not discarded.

## Final semantic matrix

| Family | Installation, fixed | Moving detail, rigid follow | Fixed detail, no follow | Section, fixed full height |
| --- | --- | --- | --- | --- |
| Passenger | Gesamtansicht | Kabine | Mechanik, Antrieb, Sicherheit, Türen | Schnittansicht |
| Goods | Gesamtansicht | Plattform/Kabine, Lasten, Führungssystem when guide data exist | Türen | Schnittansicht |
| Auto | Gesamtansicht | Plattform, Fahrzeug | Türen, Zufahrt | Schnittansicht |

Kabine displays the cabin, frame, shoes, cabin doors/operators, carried safety/linkage and car-side hitches. Fixed rails, counterweight, buffers, levels, shaft and machine are hidden; full suspension/governor routes do not clutter the local view. Hidden mounted components retain simulation bindings. The optional schematic frame reference gets the same existing car offset. Mechanik instead frames the represented mechanical system, including full rails/buffers, and reduces the cabin shell.

Sections use the shared render-only `ShaftSection`: the far faces/edges of the existing shaft envelope remain, the +X/+Z near faces are omitted, and cabin/platform front/right/roof obstruction is removed or reduced. No wall thickness, domain part or engineering dimension is added. Full-height semantic bounds remain, with a lateral section direction. Goods/Auto retain independent filtering. Auto approach shows only declared approach, passage and supplied sweep references. Goods load view removes doors and reduces the largest load wire hierarchy without relocating any load.

Auto contact symbols and axle/centerline references render above body/floor surfaces in the transparent overlay queue with depth testing disabled. Four existing contact locations remain unchanged. Vehicle labels use small pixel-space offsets from unchanged normalized anchors; no vehicle dimension or CAD projection is changed.

All modes reuse the existing perspective fit and OrbitControls owner. Only meaningful initial/view/geometry/resize/reset requests fit. Moving details translate camera and pivot together, preserving manual orbit/zoom/pan. Reset samples the current offset, not a bottom-floor offset. Installation, fixed details and sections have zero follow.

## Actual Chrome acceptance

An isolated Chrome tab ran the existing localhost development server. Native canvas drag/scroll exercised real orbit and zoom. Screenshots are in `/private/tmp/liftplan-view-modes-qa.PJmi0Q`. The original user tab/server were left untouched.

- Passenger Mechanical Demo: 2, 6 and 10 stops; Gesamtansicht, Kabine, Mechanik and Schnittansicht inspected at each count. Complete shaft/pit/headroom/all landing references fit; cabin detail stays local when count changes. The actual Kabine button was visibly present in the required order. Six-stop drive, safety and door views also inspected.
- Passenger six-stop travel: manually orbited/zoomed Kabine at floor 1; reached floor 6 with the same camera-relative cabin focus and orientation. Current-view reset restored the canonical cabin frame at floor 6. Switched to Gesamtansicht and returned to floor 1: shaft framing stayed in the same screen position, without following. The section is visibly lateral/open-sided rather than the overview box.
- Goods six-stop demo: every mode inspected, including conditional Führungssystem. Lasten shows only declared nested pallet/roll-container/forklift wires with distinct labels/styles and floor context, without doors/mechanical clutter. Front/rear platform and served landing layers inspected at bottom/top. Orbited/zoomed platform travel reached floor 6 with retained focus; reset framed the carrier there. Overview return to floor 1 stayed fixed. Section far faces expose the carrier/rails over the complete installation height.
- Auto six-stop demo: every mode inspected. Zufahrt contained only explicit entry/exit/passage/sweep envelopes. Browser inspection exposed contact symbols obscured by surfaces; render ordering was corrected and rechecked, including a native-detail screenshot confirming all four contacts, both axles, centerline, wheelbase, track and overhang labels. Orbited/zoomed platform reached floor 6; reset framed it there. Overview return stayed fixed. Front/rear doors and distinct full-height section rechecked after travel.
- Travel checks used an explicitly entered 2 m/s QA planning speed for shorter observation; timing code and fixture/default speeds were not changed. Passenger → Goods → Auto → Passenger switching and demo replacement returned the correct toolbar/runtime. A final Passenger six-stop Kabine screenshot verifies the current workspace after switching back.
- Chrome console: zero errors. Only the pre-existing Three.Clock deprecation warning was recorded; no new warning was introduced.

## Automated verification

`pnpm test`: 594 tests passed in 37 files. Coverage includes the real mounted passenger toolbar, all mode selections, current top-floor reset/follow wiring, fixed Mechanik/overview/section offsets, deterministic 2/6/10 frames, distinct shaft section policies preserving normalized coordinates, Auto approach isolation, conditional Goods guides, and shared camera interaction preservation over 100 ticks. Fixed overview and section tests run across all three policy maps; moving cases cover cabin/platform/vehicle/loads/guides. Existing domain, collision, timing, persistence, drawing/PDF/DXF regressions remain in the complete suite.

`pnpm lint`, `pnpm build`, `git diff --check`: passed. Build retains the existing large-chunk advisory. No commit was created.

## Exact changed files

This inventory includes the five pre-existing unfinished files, which were preserved and completed.

```text
docs/3d/passenger-camera-interaction.md
docs/architecture/application.md
docs/qa/installation-camera-qa.md
docs/qa/view-mode-runtime-qa.md (new)
src/simulation/passenger-motion-bindings.ts
src/simulation/passenger-simulation.test.ts
src/simulation/vertical-travel.test.ts
src/three/camera/AutoFitCamera.motion.test.tsx
src/three/camera/camera-fit.test.ts
src/three/camera/car-lift-camera.ts
src/three/camera/goods-lift-camera.ts
src/three/camera/installation-camera.test.ts
src/three/camera/passenger-camera-bounds.ts
src/three/camera/view-camera-policy.ts
src/three/geometry/ShaftSection.tsx (new)
src/three/geometry/TechnicalEnvelope.tsx
src/three/geometry/car/CarLiftAssembly.tsx
src/three/geometry/car/car-lift-render-model.test.ts
src/three/geometry/car/car-lift-render-model.ts
src/three/geometry/goods/GoodsLiftAssembly.tsx
src/three/geometry/goods/goods-lift-render-model.test.ts
src/three/geometry/goods/goods-lift-render-model.ts
src/three/geometry/passenger/PassengerElevatorAssembly.tsx
src/three/geometry/passenger/Shaft.tsx
src/three/geometry/passenger/doors/PassengerDoorMeshes.tsx
src/three/geometry/passenger/mechanical/MechanicalComponentMeshes.tsx
src/three/geometry/passenger/mechanical/PassengerMechanicalAssembly.tsx
src/three/geometry/passenger/mechanical/PassengerSafetyMeshes.tsx
src/three/geometry/passenger/mechanical/TractionDriveMeshes.tsx
src/three/geometry/passenger/mechanical/passenger-safety-model.test.ts
src/three/geometry/passenger/mechanical/traction-drive-model.test.ts
src/three/geometry/passenger/passenger-vertical-model.test.ts
src/three/scene/CarLiftViewport.test.tsx
src/three/scene/GoodsLiftViewport.test.tsx
src/three/scene/ThreeConfiguratorViewport.test.tsx (new)
src/three/scene/ThreeConfiguratorViewport.tsx
src/three/scene/view-mode.ts
```

## Deliberate limitations

No orthographic camera, user-defined section plane, bookmark, fabricated mechanical part or new control was added. This is a presentation cutaway of normalized envelopes, not a newly calculated engineering section. Tall installations necessarily appear narrow in a full-height overview; detail modes permit closer inspection. Arbitrary manual camera motion can still cause annotation overlap/cropping; a general screen-space label collision solver remains outside this correction. Auto approaches remain at explicitly configured building positions. Missing mechanical/simulation inputs keep their existing unavailable/partial statuses.

No engineering dimensions, normalization, validation thresholds, collision rules, nominal-speed/acceleration/door timing, project/persistence/migration, drawing/PDF/DXF/physical-scale code or unrelated frontend CSS was modified.
