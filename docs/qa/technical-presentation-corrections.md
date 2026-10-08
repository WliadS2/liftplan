# Technical presentation corrections — 2026-10-08

Branch: `feature/codex-next`. All pre-existing uncommitted/untracked carrier-drive and camera work is preserved. No commit, push, branch switch, engineering/default change or Passenger camera change was made in this pass.

## Root causes and corrections

### Automatic plan preview

The document content bounds and raw SVG viewBox included the drawing and annotations, but the browser previously displayed that model-space SVG directly without an explicit whole-sheet viewport or measured pixel dimensions. The plans container also imposed a 700 px minimum height and lacked the central flex/min-height constraint used by the adjacent 3D tab. Intrinsic SVG sizing, available height and stale scroll position could therefore disagree. No erroneous model projection or accumulated geometry transform was found.

`PlanDrawingViewer` measures its actual remaining viewport before paint, observes resizes (with a window-resize fallback), and resets scroll on project/family/view/scale/landing/side selection changes. Hidden zero-size tabs wait for a real measurement. A pure pixel-only function computes:

`factor = min((viewportWidth - 32) / sheetWidth, (viewportHeight - 32) / sheetHeight)`

The outer SVG fits the entire A4 sheet, preserving aspect ratio with a minimum 16 px surrounding margin. The existing frame, title block and reserved drawing area are reused. An inner SVG fits the unchanged model-content viewBox inside that area using `xMidYMid meet`; this is automatic, non-print-binding preview only. Sheet bounds and model bounds are separate. Scoped flex constraints allocate the actual available viewport instead of forcing a taller sheet container. No broad/global SVG CSS selectors were added.

Fixed 1:20 / 1:25 / 1:50 / 1:100 SVG sheets keep their physical dimensions and scroll. No additional drawing scale transform was introduced into fixed-scale, PDF or DXF output. PDF projection, scale math, fit guards and SVG-to-PDF mapping are untouched. DXF remains real millimetres. The PDF metadata factory now also supplies honest automatic-preview metadata, labelled `Automatisch (Vorschau)`.

### Auto hydraulic Antrieb

The semantic filter excluded carrier/frame/floor/guide context, while the local camera policy did not follow the moving connection. The view now includes actual normalized frame/floor/shoes/guides and a reduced platform outline, alongside configured hydraulic parts. It excludes vehicle, walls, landing doors and safety-only gear.

The reference camera frame includes complete carrier context and local cylinder/base/connection. Existing moving-detail camera translation follows carrier displacement; no continuous refit, second camera architecture or mesh manipulation was introduced. At upper stops the fixed base can intentionally leave this local view. Overview remains available for full-installation context. Fixed cylinder/base bindings and plunger extension behavior are unchanged.

### Goods traction Antrieb

Previous local framing bounds clipped full-height drive structures even though the renderer still displayed their complete geometry. Carrier context was also filtered out. The traction camera now frames visible drive parts and suspension endpoints over their actual travel, full-height rails and carrier context, using existing camera-fit/OrbitControls. No rails or routes are shortened or components exaggerated. Full-system framing may make detail small on a tall installation; normal zoom/orbit remains available for inspection.

### Annotation placement

Auto Grundriss used default vertical-dimension label placement: the left-side label was offset toward the shaft rather than outside its dimension lane. It now opts into the existing exterior-column annotation layout, also reapplied by fixed-scale presentation. Only label positioning changes; dimension values and model geometry remain unchanged.

## Automated evidence

- Initial baseline: 649/655 tests passed. Six full-stroke drive-framing expectations disagreed with the existing local camera implementation.
- Those six assertions are retained against the full-installation overview contract, while new tests explicitly cover hydraulic local framing and complete traction framing at 2 / 6 / 10 stops. They were not deleted or replaced with vacuous assertions.
- 14 measured-viewer tests: A4 dimensions, aspect ratio, margins, invalid/zero measurements, first paint, hidden-to-visible transition, ResizeObserver cleanup, family/view changes, scroll reset, and fixed physical sheets independent of resize at all four scales.
- 8 contextual drive/camera tests: actual visible assemblies, no unrelated/fake context, bounds, traction parts/routes at idle/mid/top, hydraulic connection-to-camera displacement, fixed cylinder, desktop/mobile camera projection containment, reset and manual interaction ownership, overview and distinct semantic subjects.
- 10 dimension-label tests: Goods/Auto plan labels outside vertical dimension lanes in automatic mode and all four fixed scales.
- Existing actual cached Three.js motion-binding, vector PDF preparation and numerical DXF coordinate regression tests continue passing, as do Passenger and persistence tests.
- Final `pnpm test`: **687 tests passed, 42 files**.
- Final `pnpm lint`: passed.
- Final `pnpm build`: passed. Existing >500 kB chunk-size advisory remains; no compilation error.
- Final `git diff --check`: passed.

## Browser status — visual acceptance pending

One browser discovery attempt failed: `Sky Computer Use native pipe startup failed`; no apps or browser surfaces were available. Reconnection was not repeatedly attempted. No current browser screenshots, live console results, live exports or visual acceptance are claimed. Earlier milestone artifacts are not evidence for these new presentation corrections.

Required manual verification:

1. Auto DEV hydraulic: Antrieb at idle, mid-travel and top stop; connection remains attached, cylinder stays fixed, extension follows carrier. Inspect local context, orbit/zoom and semantic reset, then Gesamtansicht and Schnittansicht.
2. Goods DEV traction: Antrieb at idle/mid/top, full rails/routes/machine/counterweight context, orbit/zoom/reset; Gesamtansicht, Mechanik, Sicherheit and Schnittansicht.
3. Passenger: Gesamtansicht, Kabine, camera reset, travel and plans regression.
4. All three families: Grundriss/Schnitt/Türansicht in automatic mode, first tab opening, repeated family/view switches, viewport resize and scroll reset. Entire frame/title/content must remain visible with no black fills or clipped geometry.
5. All fixed scales: physical sheet remains unchanged, oversized preview scrolls, explicit export fit guards remain. Export PDF/DXF and inspect vector output and expected dimensions. Live browser export verification remains pending.

## Exact files changed by this correction pass

This list excludes unrelated pre-existing milestone changes visible in `git status`.

- `src/features/project-workspace/drawing-preview-fit.ts` (new)
- `src/features/project-workspace/PlanDrawingViewer.tsx` (new)
- `src/features/project-workspace/PlanDrawingViewer.test.tsx` (new)
- `src/features/project-workspace/PlansWorkspace.tsx`
- `src/features/project-workspace/PlansWorkspace.test.tsx`
- `src/features/project-workspace/ProjectWorkspace.tsx` (plans container sizing only)
- `src/features/project-workspace/ProjectWorkspace.css` (scoped plans sizing only)
- `src/drawings/AutomaticDrawingSheetPreview.tsx` (new)
- `src/drawings/TechnicalDrawingSvg.tsx`
- `src/drawings/technical-drawing-sheet.ts`
- `src/drawings/car-lift-technical-drawings.ts` (plan annotation layout only in this pass)
- `src/documents/technical-plan-pdf.ts` (metadata factory only)
- `src/three/geometry/carrier/drive-presentation.ts`
- `src/three/geometry/car/car-lift-render-model.ts`
- `src/three/geometry/goods/goods-lift-render-model.ts`
- `src/three/geometry/carrier/carrier-drive-integration.test.tsx`
- `src/three/camera/carrier-drive-camera.ts`
- `src/three/camera/carrier-drive-presentation.test.ts` (new)
- `src/three/camera/car-lift-camera.ts`
- `src/three/camera/goods-lift-camera.ts`
- `src/three/camera/view-camera-policy.ts`
- `src/three/scene/CarLiftViewport.tsx`
- `src/three/scene/GoodsLiftViewport.tsx`
- `docs/3d/carrier-drive-architecture.md`
- `docs/qa/technical-presentation-corrections.md` (new)
