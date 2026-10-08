# Goods / Auto drive maturity QA — 2026-10-08

## Baseline and outcome

Branch: `feature/codex-next`; initial HEAD: `d8de07b`. The initial worktree was clean; baseline was 594 tests in 37 files. Existing independent Goods/Auto planning, carrier mechanics, doors, loads/vehicle, vertical travel, semantic cameras, persistence and vector drawing/export pipelines were retained. Explicit traction/hydraulic/safety contracts and bindings were the missing extension.

The implementation is substantially complete, but the full milestone is **not signed off**: live Auto/Passenger browser regression and UI IndexedDB save/reload remain blocked by the computer-use connection failure. No commit or push was created. No CSS, Passenger implementation, PDF scale engine, drawing engine or AutoFitCamera implementation changed.

See [drive architecture](../3d/carrier-drive-architecture.md) for ownership, coverage and deliberate engineering limits.

## Automated gates

| Check | Result |
| --- | --- |
| `pnpm test` | 655 passed; 40 files (baseline 594 / 37) |
| `pnpm lint` | Passed |
| `pnpm build` | Passed; existing large-chunk warning remains |
| `git diff --check` | Passed |
| Production isolation | All 10 JS chunks checked: no Goods/Auto demo names, demo controls, or fixture route identifiers |

Focused coverage includes both concepts and unspecified/incomplete data; 2/6/10 stops; front-only and through-car; moving/fixed attachment identities; counterweight opposition; hydraulic extension with fixed lower endpoint; explicit indirect pulley attachment/ratio; nominal speed, pause/resume/return/reset; genuine spatial blockers; contact versus penetration; missing-data UNKNOWN; full-travel guide engagement; suspension anchoring and mid-travel segment collapse; conditional modes and stable camera framing; deterministic projections and numeric exports.

Planning-only persistence tests exercise repository snapshots, version restore, JSON round-trip, additive v1 migration, duplication, rename, DEV reset and untouched production defaults. They use the existing in-memory repository boundary, not a claim of a completed live IndexedDB/browser round-trip.

Existing assertions were updated only for legitimate new behavior: absent drive/safety information now contributes UNKNOWN, explicit hitch geometry expands the local platform frame, a genuinely mechanics-free test removes drive/safety too, and complete Auto demos expose ten modes. The guide-only Goods catalog still omits an empty Mechanik view. No test was removed and no fit guard was relaxed.

Fixed-only containment/overlap remains INVALID planning geometry without automatically vetoing travel. Tests independently preserve blocking for actual moving-envelope penetration and explicit motion/guide/stroke conflicts.

## Actual browser evidence

An isolated Chrome QA tab used the existing localhost:5173 development server. User tabs/projects were not changed or saved. The Goods DEV demo remained ephemeral.

Completed Goods checks:

- All nine modes: Gesamtansicht, Plattform/Kabine, Mechanik, Antrieb, Türen, Lasten, Führungssystem, Sicherheit, Schnittansicht.
- Overview and non-invalid status at 2, 6 and 10 stops.
- Six-stop departure, mid-travel pause, resume to top, return to stop 1, reset; speed edits 0.8 → 1 → 2 m/s.
- Carrier/frame/shoes/doors move together; counterweight moves opposite; suspension remains attached; fixed machinery/rails/buffers stay fixed.
- Manual orbit in Antrieb and semantic view reset.
- Planning status displayed Geeignet, 0 conflicts / 0 notices for the complete explicit fixture.
- Grundriss fixed 1:100 preview and actual browser PDF download.

The download-event wait timed out although the PDF was successfully written. Afterwards computer-use inventory repeatedly returned no apps/browsers and `Sky Computer Use native pipe startup failed`, including the final reconnect attempt. No unsupported alternate browser automation was used.

**Not completed live:** Auto's ten views and travel, Passenger's requested views/travel/speed regression, remaining family/stop/view combinations, save/reload through IndexedDB UI, full browser plan-set export workflow and final browser-console audit. Automated/domain/render-binding/export tests are not substitutes for these visual checks.

Scratch evidence: `/private/tmp/liftplan-drive-qa.aZdrsX`. Representative actual-browser capture: `goods-6-top-drive.png`; other captures cover all Goods modes, 2/10-stop overview, paused/orbited drive, return and plan preview. Original browser export: `/Users/volodymyrwildschut/Downloads/LiftPlan_Warenaufzug-Demo-Testdaten_Grundriss_1-100.pdf`; an independently named scratch copy preserves it.

## PDF and DXF evidence

The production SVG→PDF converter generated six real QA PDFs: current Grundriss and a three-page plan set for each family at fixed 1:100. The integration harness only supplies jsdom text metrics using the same jsPDF Helvetica font data; converter, geometry, page mapping and scale remain real and unmocked. The actual Goods browser download was also inspected.

All plan-set pages were rendered with local PDFKit/AppKit and visually inspected, including the final Goods/Auto section annotations. Frames/title blocks are present, annotations remain outside geometry, and no geometry/title overlap or clipping was found in the new sheets. Passenger's existing drawing presentation was not redesigned.

Numeric inspection confirms A4 media boxes (existing PDF point rounding), correct plan/section/door order and metadata, selectable text/vector paths, and **zero image objects** in all six PDFs. Current/set vector path counts: Passenger 208/580, Goods 276/693, Auto 210/508. PDF scale/projection/page mapping code is unchanged; tests cover 1:20, 1:25, 1:50 and 1:100 preparation and explicit oversized/auto fit rejection. Larger fixed scales remain blocked where the actual drawing cannot fit.

An independent local ASCII group-code parser checked all nine AC1009 DXFs:

| Family | Plan shaft X × Z (mm) | Section shaft X × Y (mm) | Door W × H (mm) |
| --- | --- | --- | --- |
| Passenger | 2600 × 3000 | 2600 × 8200 | 900 × 2100 |
| Goods | 2600 × 3000 | 2600 × 19800 | 1600 × 2200 |
| Auto | 3200 × 6200 | 3200 × 18800 | 2600 × 2300 |

New mechanical parts/routes share the existing TechnicalDrawingDocument projections; HYDRAULIC and SAFETY classify actual supplied primitives. Tests establish exact 1:1 model-space coordinates and identical DXF across selected drawing scales. No external CAD application was available; numerical parser verification is not a claim of CAD-viewer QA.

## Remaining engineering / product limits

Hydraulic plunger display is an explicit schematic extension envelope, **not a realizable closed-length/stage actuator design**. The synthetic DEV stroke and housing dimensions are not manufacturer specifications. Closed-length/stages, pressure, force, buckling and structural feasibility remain unresolved. Traction routes are explicit schematic paths, not wrapping/traction solutions. AABB sweeps are conservative spatial checks, not full dynamics.

No acceleration/braking/jerk, rope/pressure/stress calculations, certified safety behavior, manufacturer hardware, pump room/pipe defaults, DWG or regulatory claims were added. Indirect hydraulics supports explicit envelopes/attachments, not a reeving solver. Detailed component envelope/route editing remains typed planning/JSON and DEV-fixture work; the compact UI only exposes useful concept/layout/stroke/ratio inputs.

## Final integration QA retry

The subsequent final integration pass preserved the existing uncommitted milestone on `feature/codex-next`. Browser discovery still returned no apps/browsers with `Sky Computer Use native pipe startup failed`. Resetting the automation session and attempting a fresh isolated Chrome tab returned `Browser is not available: chrome`; a separate browser inventory was empty.

No new live-browser check was completed in this retry. Specifically outstanding:

- Auto hydraulic views, fixed/moving attachment inspection, travel, pause/resume, return, speed and orbit/reset.
- Repeated Goods traction/guide/suspension visual inspection and Passenger visual/travel/reset regression.
- All-family plan previews (automatic/fixed), CSS fill/clipping/framing inspection and browser PDF/DXF workflows.
- Create/configure/save/reload/reopen, drive-value retention, family switching, duplication and JSON export/import through the actual browser.
- Runtime/console audit, React key warnings, NaN transforms, blank viewport, inspector controls and workspace overflow.

Fresh automated verification again passed: 655 tests in 40 files, lint, TypeScript/build and diff-check. The existing large-chunk build warning remains. No implementation defect was reproduced, no speculative source/CSS/validation fix was applied, and no commit or push was created. Only this QA record was updated during the retry; earlier browser/artifact evidence above is not presented as a new browser pass.

## Exact changed-file manifest

- `docs/3d/carrier-drive-architecture.md`
- `docs/3d/carrier-mechanical-architecture.md`
- `docs/architecture/application.md`
- `docs/qa/carrier-drive-maturity-qa.md`
- `src/collision/car-lift-spatial-validation.ts`
- `src/collision/carrier-drive-validation.ts`
- `src/collision/goods-lift-spatial-validation.ts`
- `src/dev/fixtures/car-lift-qa-fixture.ts`
- `src/dev/fixtures/carrier-drive-demo.ts`
- `src/dev/fixtures/goods-lift-qa-fixture.ts`
- `src/documents/carrier-drive-export.integration.test.tsx`
- `src/documents/technical-plan-dxf-renderer.ts`
- `src/drawings/car-lift-technical-drawings.ts`
- `src/drawings/carrier-mechanical-drawings.ts`
- `src/drawings/goods-lift-technical-drawings.ts`
- `src/elevator/car/car-lift-model.ts`
- `src/elevator/car/car-lift-scene-model.ts`
- `src/elevator/car/car-lift.test.ts`
- `src/elevator/configuration/car-lift-configuration.ts`
- `src/elevator/configuration/carrier-drive-planning.ts`
- `src/elevator/configuration/goods-lift-configuration.ts`
- `src/elevator/goods/goods-lift-model.ts`
- `src/elevator/goods/goods-lift-qa.test.tsx`
- `src/elevator/goods/goods-lift-scene-model.ts`
- `src/elevator/goods/goods-lift.test.ts`
- `src/elevator/index.ts`
- `src/elevator/models/carrier-drive-model.ts`
- `src/elevator/models/carrier-drive-scene.ts`
- `src/elevator/models/carrier-drive.test.ts`
- `src/features/project-workspace/FamilyConfigurationForms.stop-count.test.tsx`
- `src/features/project-workspace/FamilyConfigurationForms.tsx`
- `src/features/project-workspace/spatial-validation-messages.ts`
- `src/simulation/car-simulation.ts`
- `src/simulation/carrier-drive-visualization.ts`
- `src/simulation/goods-simulation.ts`
- `src/simulation/platform-simulation.ts`
- `src/simulation/vertical-travel.test.ts`
- `src/three/camera/car-lift-camera.ts`
- `src/three/camera/carrier-drive-camera.ts`
- `src/three/camera/goods-lift-camera.ts`
- `src/three/camera/view-camera-policy.ts`
- `src/three/geometry/car/CarLiftAssembly.tsx`
- `src/three/geometry/car/car-lift-render-model.ts`
- `src/three/geometry/car/car-motion-bindings.ts`
- `src/three/geometry/carrier/CarrierDriveAssembly.tsx`
- `src/three/geometry/carrier/carrier-drive-integration.test.tsx`
- `src/three/geometry/carrier/carrier-drive-motion.ts`
- `src/three/geometry/carrier/carrier-drive-render-bindings.ts`
- `src/three/geometry/carrier/drive-presentation.ts`
- `src/three/geometry/goods/GoodsLiftAssembly.tsx`
- `src/three/geometry/goods/goods-lift-render-model.ts`
- `src/three/geometry/goods/goods-motion-bindings.ts`
- `src/three/scene/CarLiftViewport.test.tsx`
- `src/three/scene/CarLiftViewport.tsx`
- `src/three/scene/CarSimulationDriver.tsx`
- `src/three/scene/CarrierDriveNotice.tsx`
- `src/three/scene/CarrierSimulationDriver.tsx`
- `src/three/scene/GoodsLiftViewport.tsx`
- `src/three/scene/GoodsSimulationDriver.tsx`
