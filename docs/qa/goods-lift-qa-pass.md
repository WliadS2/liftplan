# Goods-lift QA and correction pass

Date: 2026-10-05. Scope: Waren-/Lastenaufzug configuration, normalization,
validation, development data, scene presentation, cameras, drawings and exports.
Existing uncommitted work from the preceding renderer task was preserved.

## Verified problems and root causes

| Problem | Root cause | Correction |
| --- | --- | --- |
| Goods demo could not be loaded independently | The development loader only constructed the passenger fixture; there was no goods fixture in this checkout. | A DEV-only goods QA fixture and family-aware control use the existing ephemeral store boundary. |
| Implausible rail spacing could still receive an OK result | Spatial validation did not evaluate guide axes. | Check explicit axis containment in the shaft and penetration of the moving platform footprint. Contact remains allowed; missing guide data are UNKNOWN. |
| Loads were vertically misplaced at nonzero first elevations | Normalization fixed load minY at absolute zero. | Use the normalized platform floor elevation. |
| Missing load heights could incorrectly pass height fit | Missing height was represented as a flat footprint without retaining whether its height was known. | Preserve height knowledge and report UNKNOWN for the affected height check. |
| Explicit malformed optional dimensions disappeared | Nonpositive load/guide values were omitted by normalization without an invalid field result. | Report these explicitly as invalid planning geometry; retain other renderable assemblies. |
| A configuration with no access could pass access consistency | The rule only checked the through-car/front-plus-rear relationship. | Require at least one configured access side. |
| Platform inspection framed the full tower | The platform render mode included the shaft, which enlarged camera bounds. | Frame only the platform assemblies in that mode; load inspection includes platform/load bounds. |
| Nested transparent envelopes obscured one another | Outline volumes also rendered filled transparent box faces. | Render envelope edges without box-face fills; use distinct restrained colors and a semantic legend. |
| Landing planes dominated the scene and coincided with the floor | Entire planes were filled. | Show their outline with low opacity rather than a filled surface. |
| Ground-plan labels overlapped | Platform and every load label used position (0, 0). | Deterministic exterior annotation columns, independent targets and routed leaders in model and paper coordinates. |
| Annotation leaders crossed dimension values | Leaders followed the same horizontal elevation as centered height/depth values. | Route around dimension text obstacles. |
| Vertical dimension values crossed their own lines | Shared text placement used a fixed small horizontal offset with centered text. | Goods annotation layout positions text beside its dimension line using its estimated text extent. |
| Plan guide geometry disagreed with 3D | Vertical rails were projected as full-depth/full-width lines. | Symbolic crossed-axis markers at the actual normalized X/Z coordinates. No rail profile is fabricated. |
| Plan dimensions and entrance annotations were incomplete | Door width, guide spacing and front/rear labels were absent. | Add distinct semantic dimensions and opening annotations without duplicate equal front/rear width dimensions. |
| Section omitted explicit subsystems and vertical dimensions | Only shaft, platform, total height and stop labels were projected. | Add pit, headroom, storey heights, landing openings, guide axes and configured load envelopes. Front/rear coincident projections share one outline and an access legend. |
| Door elevation silently changed an invalid selection | Unknown explicit landing IDs fell back to the first landing, and the default side was always front. | Explicit unknown landings remain incomplete; an unspecified side uses an actual available entrance. |
| Guide entities landed on the wrong DXF layer | Layer routing recognized rail/shoe IDs, but not goods-guide IDs. | Route goods guide geometry to GUIDE_RAILS. |
| A dash-dot load outline could land on CENTERLINES | Visual line role was evaluated before semantic envelope ownership. | Goods envelopes remain on LOADS independent of their visual line pattern. |
| Fully annotated two-stop section narrowly exceeded A4 width at 1:50 | The long access legend consumed excessive annotation space. | Use the equivalent compact label “Zugänge: vorne / hinten”. Geometry and scale stay unchanged. |

## Demo and production isolation

The deterministic goods fixture contains six stops at 3000 mm storey intervals,
a 2600 x 3000 mm shaft, 1800 x 2400 x 2300 mm platform, 1000 mm pit,
1500 mm headroom, front/rear 1600 x 2200 mm openings, through-car access,
guide axes spaced 2100 mm apart, and pallet/roll-container/forklift envelopes.
All values are development planning data, not technical recommendations or
manufacturer/regulatory data. The configured envelopes fit the demo platform
and opening dimensions.

The fixture is not imported by normal configuration factories. Loading it
sets persistenceMode to development-demo; existing autosave and project-file
save controls exclude that state. Reset returns to an ordinary new project.
The production bundle contains neither demo controls nor fixture data.

## 3D and camera verification

The scene contract remains the geometric source: dimensions map to X=width,
Y=height/elevation and Z=depth, with explicit shared unit conversion to metres.
Front/rear doors and openings are independent. Landing doors align to declared
stop elevations. Guide axes retain configured orientation and spacing.
Load envelopes retain normalized centered plan positions and platform elevation.

Overall, platform/cabin, doors, loads, guide and cutaway modes remain available
as appropriate. Installation views retain a shaft-centered pivot. Platform and
load views are local; the reset action preserves the selected semantic frame.
Invalid but normalizable geometry continues to render with a conflict notice.

## Drawing and export verification

Ground plan, section and selected door elevation use the same normalized goods
model and shared drawing primitives. Annotation placement changes only text,
leaders and dimension presentation. The SVG and PDF consume the same prepared
drawing/presentation; DXF consumes the model-space document.

Physical A4 dimensions, engineering projection, model dimension values, 1:N
geometry transform, SVG-to-PDF page mapping, title-block reservation and fit
guards remain unchanged. There is no additional drawing scale transform.

Actual browser exports were generated and their rendered pages inspected:

| Export | Verified vector geometry |
| --- | --- |
| Ground plan 1:50 | Shaft 52 x 60 mm on paper, from 2600 x 3000 mm model geometry |
| Section 1:100 | Shaft 26 x 198 mm on paper; all six stops and explicit vertical dimensions |
| Door elevation 1:20 | Opening 80 x 110 mm on paper, from 1600 x 2200 mm model geometry; landing 6 rear |
| Three-page plan set 1:100 | Ground plan, section, rear door elevation; correct 1/3, 2/3, 3/3 sheet metadata |

The actual PDFs contain vector paths and text and zero embedded raster images.
Frame, title block, German umlauts, labels and leaders are visible. No clipping
or overlap with the title area was observed. Browser resize leaves the drawing
primitives unchanged. Automatic preview remains non-print-accurate; fixed PDF
export continues to require a selected scale.

Actual AC1009 DXF files were parsed numerically: shaft 2600 x 3000 units,
platform 1800 x 2400 units and door opening 1600 x 2200 units. Guides use
GUIDE_RAILS and all three envelopes use LOADS. Automated tests cover unchanged
model-space dimensions at 1:20, 1:25, 1:50 and 1:100.

With the full QA annotations, two-stop sections fit at 1:50 and 1:100,
six-stop sections fit at 1:100, and ten-stop sections exceed A4 at these fixed
scales and remain explicitly blocked. Automatic preview remains available.

## Validation and regression results

The complete six-stop demo is normalized as complete with spatial status OK,
zero conflicts and zero warnings. Setting guide spacing to 12 mm produces an
INVALID geometric issue and retains the rendered scene. Missing optional data
stay UNKNOWN. No regulatory clearance or certification rule was added.

Headless Chrome with software WebGL exercised every goods view, front-only and
through-car access, 2/6/10 stops, all load envelopes, orbit, zoom, reset, browser
resize, all drawing views, scale guards and actual PDF/DXF downloads. IndexedDB
inspection verified that the demo was not autosaved. The selected rear door at
landing 6 was checked in the preview and metadata. No application console error
or JavaScript exception was observed.

Passenger overall/door/drawing views and simulation start, pause, resume and
reset were exercised in the same browser. Existing passenger and car domain,
persistence, simulation, drawing and export tests remain green. Native computer
use was unavailable; the local isolated Chrome session provided the actual
browser/WebGL/export verification instead.

Final verification: 26 test files, 429 tests passed; pnpm lint, pnpm build and
git diff --check passed. The existing Vite large-chunk advisory remains.
Chrome also reports the dependency-level THREE.Clock deprecation: the installed
React Three Fiber runtime constructs THREE.Clock. This is not an application
exception; changing the shared rendering dependencies is outside this goods QA
pass and was intentionally deferred.
No commit was created.

## Exact files changed in this QA pass

Created:

- src/dev/fixtures/goods-lift-qa-fixture.ts
- src/drawings/goods-drawing-annotation-layout.ts
- src/elevator/goods/goods-lift-qa.test.tsx
- docs/qa/goods-lift-qa-pass.md

Modified:

- docs/architecture/application.md
- src/collision/goods-lift-spatial-validation.ts
- src/dev/DevelopmentMechanicalControls.tsx
- src/dev/development-mechanical-session.ts
- src/documents/technical-plan-dxf-renderer.ts
- src/drawings/goods-lift-technical-drawings.ts
- src/drawings/technical-drawing.ts
- src/elevator/goods/goods-lift-model.ts
- src/features/project-workspace/spatial-validation-messages.ts
- src/three/camera/goods-lift-camera.ts
- src/three/geometry/goods/GoodsLiftAssembly.tsx
- src/three/geometry/goods/goods-lift-render-model.ts
- src/three/scene/GoodsLiftViewport.tsx
- src/three/scene/GoodsLiftViewport.test.tsx

The dispatcher, ProjectWorkspace integration, shared camera generalization and
other prior uncommitted renderer changes were preserved, not reimplemented by
this QA pass. No CSS, passenger renderer, passenger engineering, car model or
persistence schema was changed.

## Intentionally deferred

Detailed rail profiles, traction/safety systems, manufacturer parts, certified
clearances, goods movement simulation, load handling/turning dynamics and
Autoaufzug 3D remain outside this task. Guide validation covers the explicit
axes only; it cannot evaluate profiles that have not been supplied. Front/rear
goods openings currently share the single explicit width/height configuration;
the projections do not invent independent rear dimensions or door frames.
