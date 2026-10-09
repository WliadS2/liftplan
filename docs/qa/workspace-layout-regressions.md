# Workspace layout regression QA — 2026-10-09

## Baseline and scope

The working branch was `feature/workspace-ui-overhaul`, with a clean worktree at inspection. No branch switch, stash, reset, commit or push was performed. This branch contains the Passenger/Goods/Auto foundations but not the project-variants workspace. Variants were neither changed nor imported from another branch.

## Root causes

- `.viewport-panel` had two `min-height: 700px` declarations, inherited the general panel's `height: 100%`, and lived inside a scrolling flex center without a complete minimum-height chain. At 1280 × 800, the actual canvas was 632 × 631 at y=247.5, ending at y=878.5 outside the window. Camera fitting used that partly obscured/offscreen canvas, not the visible remaining area.
- Both inspector columns required 320 px. The center could shrink, but the non-wrapping mode control group could not. The Auto reset button reached x=1369.55 at 1280 px window width. It extended beyond both the center and the page. The title also wrapped to two lines beside this oversized group.
- The center tabs and view/plans toolbars used sticky positioning with independent hard-coded offsets (`top: 0` and `top: 55px`). Notices used absolute `top: 64px`, independent of the toolbar's actual height. The toolbar's z-index 15 put it above the notices' z-index 5. The resulting notices/toolbar intersection was measured in the original layout.
- Fahrdemo used an absolute, horizontally translated, minimum-320-px floating box at `bottom: 20px`. Its narrow content wrapped into many rows, obscured the installation and could extend offscreen. The footer was also absolute at the bottom, competing with those controls. Neither reserved canvas space.
- Form labels had `white-space: nowrap`, ellipsis and a third fixed unit column even for fields without units. Long labels were truncated. Technical data used a fixed 120 px key column without wrapping, so long keys painted into the value column.
- The separate persistence toolbar did not wrap, reserve its height or have its own spacing boundary. Numerous secondary actions and save/demo messages competed for the same row. Inspector titles were inside scrolling content. There were no inspector-collapse buttons on this branch, so the reported pre-existing button/title collision could not be reproduced literally.
- Browser interaction additionally reproduced residual OrbitControls damping after an explicit camera reset. Pending pan inertia shifted the freshly fitted target; the Passenger reproduction left a 0.003359 m render-space displacement. This is a camera interaction issue, not an engineering dimension or clearance.

## Targeted fixes

- One three-column grid owns inspector widths (288 px expanded / 36 px collapsed) and the `minmax(0, 1fr)` center. Flex/grid ancestors now have explicit zero minimum constraints. Inspector contents, expanded control details, notices and physical fixed-page previews own their scrolling instead of the entire desktop center.
- Header, tabs and toolbars reserve their actual content height in normal flow. Existing common actions remain visible; secondary project actions use a native `details` menu. No persistence handlers were changed.
- Inspector titles and keyboard-accessible collapse buttons have separate flex slots outside their scroll containers. Collapse hides rather than unmounts form content and does not mutate the project.
- Canvas takes the exact remaining center area. No added CSS scale, negative offset, blanket clipping or changed camera-fit mathematics was used.
- Fahrdemo is an in-flow compact strip with a keyboard-accessible toggle, retained target selection and unchanged controller commands. Expanded detailed content scrolls above 25vh. Action errors remain visible even when controls are collapsed.
- View modes wrap in a constrained group beside the title in a two-column header grid. Notices/footer reserve separate space, never cover the canvas, and remain accessible through a maximum-96-px scrolling notice area. Goods/Auto legends are collapsible instead of permanently consuming several text rows.
- Form labels and technical keys/values wrap. Text/select fields use the full form width where necessary; numeric units retain explicit columns.
- On an explicit reframe only, OrbitControls consumes pending inertia with damping temporarily disabled before the existing fit is applied. Ordinary orbit/pan/zoom and frame-following behavior remain unchanged. Browser reset coordinates now match the fitted coordinates exactly.

The UI-styling skill was used for container sizing and accessible disclosure controls only. Existing tokens, colors, technical drawing styling and the application design system were retained.

## Browser evidence

Native computer-use discovery failed with `Sky Computer Use native pipe startup failed`. An isolated local Chromium headless shell with SwiftShader WebGL provided real DOM layout, actual R3F rendering, camera state, input events and screenshots instead. QA used the existing DEV fixtures through their UI controls; no fixtures became production defaults.

The layout matrix covers empty Passenger, configured Passenger/Goods/Auto, expanded/collapsed Fahrdemo, left/both inspectors collapsed, and all three automatic plan projections plus fixed 1:50 preview at 1920 × 1080, 1440 × 900 and 1280 × 800. Supplementary checks exercise right-only collapse, all view modes, orbit/pan/zoom/reset, target selection, start/pause/resume/reset, the actions menu and partial-plan warning scrolling.

Measured canvas sizes with both inspectors and Fahrdemo expanded:

| Window | Passenger | Goods | Auto |
| --- | --- | --- | --- |
| 1920 × 1080 | 1344 × 760 | 1344 × 732 | 1344 × 732 |
| 1440 × 900 | 864 × 580 | 864 × 527 | 864 × 527 |
| 1280 × 800 | 704 × 455 | 704 × 427 | 704 × 427 |

The 75-case matrix reported no horizontal page overflow, tested label/action clipping, canvas/control or canvas/notice intersection, or toolbar/notice intersection. Independent right-only collapse was additionally checked for every family at all three requested sizes (nine additional screenshots). Inspector collapse enlarges and resizes the canvas; actual camera aspect matches its measured canvas aspect. At 1280 px, right-only collapse increases canvas width from 704 to 956 px. Fahrdemo collapse adds 74 px of canvas height without changing controller state.

Screenshots were visually reviewed for the empty/partial Passenger, all three configured families, inspector states, automatic drawing sheets, fixed-page scrolling, and the secondary actions menu. White paper, outline-only SVG shapes, dimension text and title blocks remain intact. Fixed A4 pages intentionally exceed the center at small window sizes and remain accessible through horizontal/vertical scrolling; their physical preview dimensions were not auto-fitted.

No runtime exceptions, React key warnings or NaN camera values were found in the checked workflows. The existing dependency warning `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` remains. Chromium's software-driver stderr also reported ReadPixels performance stalls during screenshot capture; no rendering failure occurred. Native headed-browser/GPU behavior and layouts below the requested desktop widths were not verified. Project variants comparison is unavailable on this branch and therefore unverified.

Local QA artifacts (not product source): `/private/tmp/liftplan-layout-qa.YzoHe1/` contains the before/after JSON bounding boxes, screenshots, `interactions.json` and the local CDP scripts. Native browser access failure is not represented as a pass.

## Verification and changed files

- `pnpm test`: 767 tests / 47 files passed (8 new regression cases).
- `pnpm lint`: passed.
- `pnpm build`: passed; existing large-chunk advisory remains.
- `git diff --check`: passed.

Production/presentation changes:

- `src/features/project-workspace/ProjectWorkspace.css`
- `src/features/project-workspace/ProjectWorkspace.tsx`
- `src/features/project-workspace/ProjectPersistenceControls.tsx` (action grouping only)
- `src/three/scene/PassengerSimulationControls.tsx`
- `src/three/scene/PlatformSimulationControls.tsx`
- `src/three/scene/GoodsLiftViewport.tsx` (legend disclosure only)
- `src/three/scene/CarLiftViewport.tsx` (legend disclosure only)
- `src/three/camera/AutoFitCamera.tsx` (clear pending damping on reframe only)

Regression tests:

- `src/features/project-workspace/ProjectWorkspace.family-integration.test.tsx`
- `src/three/scene/ThreeConfiguratorViewport.test.tsx`
- `src/three/scene/GoodsLiftViewport.test.tsx`
- `src/three/scene/CarLiftViewport.test.tsx`
- `src/three/camera/AutoFitCamera.motion.test.tsx`

This QA report is the only new file. No domain models, engineering calculations, persistence/version schemas, variant implementation, mechanical meshes, simulation engines, technical drawing geometry or PDF/DXF export code were modified.
