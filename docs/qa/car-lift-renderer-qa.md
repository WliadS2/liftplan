# Autoaufzug renderer QA

Date: 2026-10-06. All fixture dimensions are development planning examples, not standards, certified limits or manufacturer data.

## Changed files

New:

- `src/dev/fixtures/car-lift-qa-fixture.ts`
- `src/dev/development-family-session.test.tsx`
- `src/three/camera/car-lift-camera.ts`
- `src/three/geometry/car/car-lift-render-model.ts`
- `src/three/geometry/car/car-lift-render-model.test.ts`
- `src/three/geometry/car/CarLiftAssembly.tsx`
- `src/three/scene/CarLiftViewport.tsx`
- `src/three/scene/CarLiftViewport.test.tsx`
- `docs/qa/car-lift-renderer-qa.md`

Modified:

- `src/elevator/car/car-lift-scene-model.ts`
- `src/three/scene/LiftFamilyViewport.tsx`
- `src/three/scene/LiftFamilyViewport.test.tsx`
- `src/dev/development-mechanical-session.ts`
- `src/dev/DevelopmentMechanicalControls.tsx`
- `src/features/project-workspace/ProjectWorkspace.family-integration.test.tsx`
- `docs/architecture/application.md`

No CSS, production workspace/form layout, passenger/goods renderer, engineering normalization/validation, drawing projection, PDF scale engine or DXF exporter changed.

## Architecture and visible assemblies

The existing family technical orchestration supplies normalization, validation and scene data to a dedicated Auto viewport. A pure render policy determines appearance and visibility; React Three Fiber only materializes the supplied scene. The Three.js layer never reads Zustand.

Assemblies comprise the shaft outline, explicit pit/headroom portions, every normalized landing level, platform floor/roof/end and side surfaces, front/rear usable openings and landing doors, declared guide axes, moving envelope, vehicle body, centerline, four contact symbols, loading axis and optional entry/exit/passage/sweep envelopes. No guide profiles, wheel sizes or wall thicknesses are fabricated. Front and rear dimensions remain side-specific. Missing optional components are omitted.

Vehicle body size and pose come from the normalized vehicle; React only applies the declared heading. Wheelbase, track and asymmetric overhangs are already resolved into four contact positions by normalization, which the scene adapter copies. The centered-position helper remains unchanged. Approach boxes preserve explicit centers, dimensions and headings. Passage volumes follow the configured entrances; absent depth remains a plane rather than a hidden length default. These volumes do not simulate vehicle turning.

Six German modes are available: Gesamtansicht, Plattform, Fahrzeug, Türen, Zufahrt and Schnittansicht. Local platform/vehicle/approach views exclude the full tower. Cutaway removes obstructing roof/front/right platform surfaces while retaining technical context.

Camera frames use mode-filtered semantic bounds, including rotated-box extents, lines and contact symbols. The scene key includes dimensions, levels, vehicle pose and approach data; edits request reframing. The shared camera/controller remains the sole camera owner. Reset restores the active Auto mode rather than changing mode. Finite fits are tested at portrait and landscape aspect ratios for 2, 6 and 10 stops.

## Development isolation

One DEV-only control, “Demo laden”, selects the passenger, goods or car fixture from the current family. Unsupported families disable it and cannot fall back to passenger. Auto loading immediately yields a complete, geometrically valid six-stop model without entering engineering fields. Saving/exporting ordinary project records and autosave remain disabled for development-demo state. Reset returns to the normal empty configuration of the current family. Production controls/fixtures are excluded by the existing DEV lazy-import boundary, not runtime hiding.

## Real Chrome QA

Verified in Chrome with actual WebGL rendering:

- All six modes display their intended assemblies; no passenger safety/drive or goods load controls appear for Auto.
- Centered vehicle and four contact crosses are visible. Longitudinal/lateral offsets update the body; headings 0°, 90° and 180° update orientation. The existing centering helper restores offsets without inventing a heading.
- Oversized vehicle width, a 2000 mm lateral offset and a 1500 mm door opening produce geometric conflicts while the vehicle remains rendered. Restoring the fixture returns to “Geeignet”, zero conflicts and zero hints.
- Front-only access removes rear doors; the complete fixture displays both sides at every stop.
- Explicitly coherent 2-, 6- and 10-stop inputs render correctly and fit the viewport. Changing only stop count while leaving an incompatible storey array correctly remains incomplete/invalid; updating the uniform storey-height input supplies the matching explicit array.
- Native orbit dragging, wheel zoom and current-mode reset work. Pan is enabled by the unchanged shared OrbitControls implementation; a held-button pan gesture was not independently exercised because the available browser drag API does not expose that gesture.
- Auto → passenger → goods → Auto switching replaces forms, validation, scenes, modes and drawing previews without stale vehicle/load/mechanical geometry. Passenger mechanical rendering and simulation start/pause/reset were checked; goods load rendering and plan preview were checked.
- Reset clears Auto engineering fields without changing family. Homelift disables demo loading. Development demos visibly disable ordinary saving and report that they are not saved.
- No console errors were observed. The pre-existing dependency warning about `THREE.Clock` deprecation remains; it originates from React Three Fiber and was not changed in this task.

### Actual browser-generated exports

Generated current Grundriss and a three-page Plansatz PDF at 1:100, plus current/set ASCII DXF. The set contains Grundriss, Schnitt and the selected sixth-landing rear Türansicht. All three previews were checked. The full approach footprint fails the existing 1:50 fit guard on the selected A4 sheet, correctly; no automatic scale adjustment was introduced.

Actual downloaded files were parsed locally with PyMuPDF and a DXF entity-coordinate parser, and all PDF pages were rendered and visually inspected:

- Shaft plan: 3200 × 6200 mm in DXF; 32 × 62 mm in PDF at 1:100.
- Platform plan: 2800 × 5600 DXF units.
- Vehicle: 1800 × 4500 DXF units.
- Shaft section: 18,800 mm installation height; 188 mm in PDF at 1:100.
- Door: 2600 × 2300 DXF units; 26 × 23 mm in PDF at 1:100.
- Correct Auto project metadata, selected rear landing, date, scale and sheet numbering; visible border/title block, no clipping or title-block overlap.
- All PDF pages contain vector paths/text and zero embedded images (44, 32 and 21 vector path records for plan, section and door respectively).

Existing Auto annotation presentation has not been redesigned: section level labels can cross the shaft outline and vertical dimension text sits on dimension lines. Those drawing-only improvements are outside this renderer task. Export pipelines and physical scale are unchanged.

## Automated verification

The added tests cover family dispatch, complete demo normalization/validation, all semantic assemblies, explicit dimensions/elevations, 2/6/10 stops, four contacts including asymmetric overhangs, offsets/headings, centered helper, optional omission, front-only/rear-only/through-car, independent rear-door dimensions, approach/passages/sweep, loading direction, invalid-but-renderable geometry, all view modes, camera bounds/keys/reset, partial/empty UI and family-aware ephemeral demo/reset behavior.

The Auto fixture also passes deterministic drawing preparation and unchanged DXF model-space entity comparisons across selected 1:20, 1:25, 1:50 and 1:100 scales. PDF preparation at a geometrically fitting 1:100 scale passes. The full regression suite retains passenger/goods/persistence/simulation and export tests.

Final verification passed: `pnpm test` (29 files, 468 tests), `pnpm lint`, `pnpm build`, and `git diff --check`. Production bundle inspection found no demo control labels, Auto fixture name or fixture-module identifier. The existing build chunk-size warning remains. No commit is created.

## Deferred

Vehicle dynamics, turning trajectories, animated Auto travel, tire/body realism, guide profiles and manufacturer-specific machinery remain unsupported. Regulatory clearances, certification and fabricated technical defaults are not introduced. Existing Auto drawing annotation polish and dependency Clock migration remain separate tasks.
