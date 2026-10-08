# Mechanical visualization fidelity QA — 2026-10-09

## Baseline and stages

Branch: `feature/engineering-v2`. The workspace was clean at task start. Baseline: **687 tests / 42 files passed**. No commit, push, branch switch, reset or discarded implementation work.

Audit findings:

- Passenger already has explicit dimensioned rail profiles, channels, shoes, buffers, grooved sheaves, machine parts, ropes and doors. These are not replaced with synthetic hardware.
- Goods/Auto drive renderers used solid boxes and one-pixel route lines. Carrier frame members, shoes, rail envelopes and buffer segments were mostly plain boxes.
- Goods/Auto AABBs alone do not define real section thicknesses, machine axes, rope diameters or hydraulic construction details. Production therefore retains honest envelope fallbacks with improved role materials/edges; detailed synthetic examples are isolated to DEV demo components.
- Existing stable attachment parents and cached bindings are sufficient for the improved representations. Cameras, validation, persistence and drawings need no architectural changes.

Implementation proceeded through independent passing stages:

1. Audit and baseline.
2. Shared optional visual-detail contract/resources and Goods traction: focused detail + existing drive integration tests passed (42), then route-endpoint tests passed (46).
3. Auto hydraulic: detail, actual mesh extension/connection and camera/drive integration checks passed (57).
4. Shared carrier/guidance: profiles, cavities, existing mechanics and camera checks passed (92).
5. Passenger: material/edge adapter and explicit-box world-bounds checks passed alongside existing mechanical/traction regressions (64).
6. Full regression, production isolation and build verification.

Tests caught a synthetic counterweight cross-member extending into its configured stack. The display generator now derives the available internal span from the real stack envelope. A dedicated nonpenetration regression protects this; engineering data and collision rules were not adjusted to hide it.

## Automated coverage

New tests cover optional-detail/fallback behavior, source isolation, finite/bounded shapes on all three axes, deterministic geometry, resource reuse/disposal, 2/6/10 stops, actual suspension mesh endpoints on idle/mid/top/return, fixed hydraulic housing/base, anchored plunger lower datum, plunger-to-connection attachment, actual guide-core shoe cavities, stack/frame separation, missing optional interfaces and rendering budgets. Passenger tests preserve IDs/material roles, local sizes, opacity and transformed world bounds without altering input models.

Existing tests continue to cover moving/fixed classification, counterweight opposition, carrier frame/shoes, semantic visibility/camera reset, Passenger behavior, drawings, physical PDF preparation, model-space DXF coordinates and project persistence.

Final verification:

- `pnpm test`: **718 passed / 44 files** (31 added tests; baseline 687).
- `pnpm lint`: passed.
- `pnpm build`: passed. Existing >500 kB chunk-size advisory remains.
- `git diff --check`: passed.
- Production `dist/assets` search for `LiftPlan DEV schematic display v1`, `housing-head-collar`, `termination-symbol`, `grooved-wheel` and `contact-liner-`: no matches. The synthetic factory is removed behind the compile-time DEV gate.
- Git diff remains scoped to the six existing 3D files and the new visual-detail, test and documentation files listed below. No drawing/export, camera, schema, persistence, validation or UI/CSS file is changed.

No visual acceptance or performance/FPS claim is implied by these deterministic tests.

## Browser status

One discovery attempt returned no apps/browsers and `Sky Computer Use native pipe startup failed`. Repeated reconnection attempts were not made. **All current live visual acceptance remains pending.** No browser console, GPU rendering or current screenshots are claimed.

Manual checklist:

- Goods DEV traction: Gesamtansicht / Mechanik / Antrieb / Sicherheit / Schnittansicht, housing/sheave/mount separation, frame/stack clearance, carrier and counterweight guide relationships, suspension at idle/mid/top/return, pause/resume, orbit/zoom/reset.
- Auto DEV hydraulic: same semantic views; fixed housing/base, visible head land, reflective extension envelope, connection attached to platform throughout idle/mid/top/return. Confirm the existing local-follow camera remains useful, with full installation available in Gesamtansicht.
- Passenger: Gesamtansicht / Kabine / Mechanik / Antrieb / Sicherheit / Schnittansicht, existing detailed rails/doors/ropes, travel and reset unchanged; inspect restrained edges for excessive density or depth artifacts.
- All families: no NaN transforms, duplicated moving hardware, missing geometry, runtime warnings or unacceptable frame-rate/resource behavior. Check production normal projects show no synthetic detail.
- Smoke-check existing plans/automatic preview and PDF/DXF exports; their implementation files were not edited.

## Exact changed files

- `src/dev/fixtures/mechanical-visual-detail.ts` (new)
- `src/three/geometry/mechanical/mechanical-visual-model.ts` (new)
- `src/three/geometry/mechanical/mechanical-visual-geometry.ts` (new)
- `src/three/geometry/mechanical/resolve-mechanical-visual.ts` (new)
- `src/three/geometry/mechanical/MechanicalVisualMeshes.tsx` (new)
- `src/three/geometry/mechanical/ConfiguredMechanicalPart.tsx` (new)
- `src/three/geometry/mechanical/mechanical-visual-model.test.ts` (new)
- `src/three/geometry/carrier/CarrierDriveAssembly.tsx`
- `src/three/geometry/carrier/carrier-drive-motion.ts`
- `src/three/geometry/carrier/carrier-drive-render-bindings.ts`
- `src/three/geometry/car/CarLiftAssembly.tsx`
- `src/three/geometry/goods/GoodsLiftAssembly.tsx`
- `src/three/geometry/passenger/mechanical/MechanicalComponentMeshes.tsx`
- `src/three/geometry/passenger/mechanical/passenger-box-visual.ts` (new)
- `src/three/geometry/passenger/mechanical/passenger-box-visual.test.ts` (new)
- `docs/3d/mechanical-visual-fidelity.md` (new)
- `docs/qa/mechanical-visual-fidelity-qa.md` (new)
