# Non-passenger 3D visual QA

Date: 2026-10-06. Scope: goods/car stop-count editing and technical 3D readability. No CSS/frontend redesign, manufacturer geometry, regulatory clearance or certified value was introduced.

## Exact two-stop failure

Both original six-stop fixtures store five explicitly uniform storey intervals. The forms previously passed `{ stopCount: 2 }` into a plain-spread family update helper. The displayed uniform height remained populated, but the five-entry list was not regenerated until that height input itself changed.

The normalizers require exactly `stopCount - 1` intervals. Consequently, five entries with two stops produced `invalidFields: ['storeyHeightsMm']` and an empty normalized level list. Validation reported:

- Goods: rule `goods.planning.structure`, status `invalid`, issue `invalid-planning-geometry`, severity `error`.
- Car: rule `car.planning.structure`, status `invalid`, issue `invalid-planning-geometry`, severity `error`.

This was the single INVALID issue shown in Chrome. The additional shaft, guide, vertical-coherence and movement rules became UNKNOWN because level normalization could not supply their anchors. Zod type parsing remained valid: `configurationDraft` and the stored project both held the updated count and old interval list, not different last-valid geometry. The scene was recalculated, not cached incorrectly. No physical overlap caused this failure.

## Source-level fix

The two family update helpers call the shared pure `updateUniformLevelIntervals` command helper. When count changes and the old interval list is coherent, positive and uniform, it repeats that already declared interval for the new count. It does not supply a height for missing data, extrapolate explicit elevations/nonuniform heights, overwrite an explicit vertical-data patch or mask an invalid count.

Normalization and all geometric validation rules are unchanged. Imported raw inconsistent arrays still report their incompatibility. Explicit nonuniform/elevation projects need matching user-provided vertical data when their count changes; there is no safe basis for fabricating new elevations.

Actual form → domain update → Zustand → normalized model → validation → scene tests exercise `6 → 2 → 6 → 10 → 2`. Each update produces exactly N levels and 2N front/rear landing openings, unique IDs, fresh moving/shaft bounds, guide height and camera keys. Pit/headroom retain their explicit dimensions at the regenerated lowest/highest levels. Car approach/sweep inputs retain their platform-relative coordinates and do not depend on stop count. Demo persistence isolation remains unchanged.

## Auto vehicle and view distinction

- A shaded semi-opaque body volume retains the exact normalized dimensions and heading.
- Four low-poly flat contact discs plus crossed references use the existing normalized contact positions. Disc radius is a visualization symbol, not a claimed wheel/tire size.
- Front/rear axle lines, wheelbase, track and front/rear overhang references connect normalized contacts and centerline endpoints. No separate React vehicle-position calculation or normalization formula was added. The front marker/label identifies orientation.
- Vehicle mode prioritizes the body, contacts, axles and dimension labels; only the platform floor/loading reference remains as secondary context. Its semantic bounds are tighter than platform mode.
- Platform mode prioritizes the floor, usable boundary and openings while rendering the vehicle with much lower opacity. This removes the previous near-identical view policies.

## Approach and section

Entry, exit, passage and supplied sweep volumes remain present simultaneously. Continuous/dashed lines, differentiated restrained hues and line widths identify each volume; short German labels sit at actual normalized envelope anchors. Volumes are outlines, avoiding opaque mutual occlusion. These remain declared planning envelopes, not calculated trajectories.

Cutaway omits unrelated approach/passage/sweep boxes and the obstructing platform roof/front/right surfaces. Shaft, levels, platform, vehicle and guide context remain at full installation height. The full-height tower naturally becomes narrower relative to the viewport at ten stops; it is not artificially stretched or cropped. Local modes provide the detailed platform/vehicle/load inspection instead.

## Goods platform, loads and doors

The explicit platform floor is opaque with a stronger boundary; no slab thickness was fabricated. The platform view omits its roof, reduces shell opacity and turns the actual front/rear usable door planes into light fills with readable opening boundaries. Declared load envelopes are visible when present. Landing interfaces remain visible at their real shaft-side positions in overview/door/section views, distinct from platform-side openings.

The three load volumes remain wire envelopes: pallet is strongest/continuous, roll container medium/dashed and forklift envelope thin/dashed. German labels anchor at different actual top-edge positions rather than overlapping at one central point. The local load view removes obstructing walls/roof and uses a higher inspection angle. Missing optional loads create no substitute geometry.

Door audit found no orientation, dimensional or duplication bug: platform-side openings and shaft-side landing openings are distinct interfaces. Each declared side has one landing opening at every normalized level. Front is positive Z, rear negative Z. Car continues respecting independently normalized side dimensions; goods consumes its actual normalized entrance records. The door cameras use a more oblique view so through-car sides do not visually stack as closely. No passenger-specific door mechanisms were added.

## Camera and label lifecycle

Local platform/load views use higher inspection angles; Auto vehicle mode has a separate tighter frame. Approach uses a higher angle over its actual footprint. Door and cutaway presets are deliberately distinct from overview. All frames remain based on visible semantic bounds and normalized targets, with the existing shared camera ownership/reset implementation unchanged.

Browser QA revealed an additional lifecycle defect in the first label implementation: the HTML helper created nested React roots whose synchronous disposal could emit unmount/removeChild errors on view/family changes. The final implementation owns plain text DOM nodes, projects actual scene anchors each frame and safely removes nodes even after host teardown. There are no nested roots or remote font/asset downloads. Regression tests cover repeated cleanup after host removal. A clean Chrome run verifies that labels do not leak between modes/families and produces no console errors.

## Chrome QA

Verified with real WebGL Chrome:

- Both goods and car count-only sequences `2 → 6 → 10 → 2`: “Geeignet”, zero conflicts/zero hints, with no storey-height re-entry.
- All six modes for each non-passenger family; view reset restores the active semantic preset.
- Overview/door/cutaway framing at 2 and 10 stops, in addition to the complete six-stop view audit.
- Auto headings 0°/90°/180°; the 90° vehicle genuinely exceeds the declared platform footprint and remains visible with an INVALID position-fit result. Centering, offsets and an invalid lateral offset remain correctly represented.
- Goods and Auto front-only access removes rear landing openings; through-car restores both declared sides.
- Native orbit and wheel zoom work; projected labels follow scene anchors, and reset restores the current view. Pan remains enabled by the unchanged OrbitControls contract; a held-button pan gesture was not independently exercised.
- Passenger → Goods → Car → Goods → Passenger switching restores each family’s form, modes, validation and scene. Goods/Car are fully geometrically OK after fixture loading. Passenger has zero INVALID issues but retains its pre-existing UNKNOWN counterweight movement rule; it is not manually marked fully evaluated.
- Demo save controls remain disabled. No demo fixture or normal production defaults were changed.
- Final clean-session console: no errors; only the pre-existing dependency `THREE.Clock` deprecation warning. The build retains its existing chunk-size warning.

Proof screenshots are scratch QA artifacts in `/private/tmp/liftplan-family-visual-qa.fca7Ng/` (`auto-vehicle.png`, `goods-loads.png`).

## Exact files changed

New:

- `src/elevator/configuration/uniform-level-update.ts`
- `src/features/project-workspace/FamilyConfigurationForms.stop-count.test.tsx`
- `src/three/geometry/TechnicalEnvelope.tsx`
- `src/three/geometry/technical-scene-label.ts`
- `src/three/geometry/technical-scene-label.test.ts`
- `docs/qa/non-passenger-visual-qa.md`

Modified:

- `src/elevator/configuration/car-lift-configuration.ts`
- `src/elevator/configuration/goods-lift-configuration.ts`
- `src/elevator/car/car-lift-scene-model.ts`
- `src/three/camera/car-lift-camera.ts`
- `src/three/camera/goods-lift-camera.ts`
- `src/three/geometry/car/CarLiftAssembly.tsx`
- `src/three/geometry/car/car-lift-render-model.ts`
- `src/three/geometry/car/car-lift-render-model.test.ts`
- `src/three/geometry/goods/GoodsLiftAssembly.tsx`
- `src/three/geometry/goods/goods-lift-render-model.ts`
- `src/three/geometry/goods/goods-lift-render-model.test.ts`
- `src/three/scene/GoodsLiftViewport.test.tsx`
- `docs/architecture/application.md`

No production form/workspace presentation or CSS file changed. Engineering normalization, collision rules, fixtures, persistence and drawing/PDF/DXF implementations are unchanged.

## Verification and deferred work

`pnpm test`: 31 files, 487 tests passed. `pnpm lint`, `pnpm build` and `git diff --check` passed. Coverage includes real form/store count transitions, no stale levels/doors, independent door positions/dimensions, normalized contact/axle orientation, asymmetric wheel geometry, all envelopes, view distinction, finite all-mode camera fits and current-mode reset. Existing passenger, drawing, PDF/DXF, persistence and simulation regression tests pass.

Vehicle dynamics, physical tires, manufacturer mechanisms, regulatory rules, unknown passenger counterweight travel data and dependency Clock migration remain outside this pass. No commit was created.
