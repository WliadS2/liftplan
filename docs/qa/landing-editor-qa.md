# Landing editor QA — 2026-10-09

Branch: `feature/engineering-v2`. Workspace clean at task start; existing mechanical milestone preserved. No branch switch, commit or push.

## Automated evidence

Baseline: 718 tests in 44 files. New tests cover:

- Domain editing, deterministic legacy expansion, nullable missing elevations, count changes, stable IDs, custom-height preservation and explicit uniform regeneration.
- Actual React editor controls wired through the real project store for Passenger, Goods and Auto; rear capability controls and add/remove actions.
- All families at 2/6/10 stops: normalization, scene landing positions and only served openings.
- Actual runtime controllers: 3200 mm then 2900 mm legs, declared speed changes, target guards, pause/resume, reset and side-specific doors.
- Passenger explicit door hardware preserved, deleted override reconciliation, invalid imported references and unresolved intermediate floor attachment.
- Deterministic Grundriss/Schnitt/Türansicht, labels, intervals, selected access, unserved-side omission and fixed-scale PDF preparation.
- DXF output independent of selected paper scale; existing model-space coordinate tests retained.
- Real SVG-to-PDF conversion of current and plan-set documents with customized landings for all three families; no image XObjects.
- Persistence, versions, restore, duplicate, rename, JSON roundtrip, null preservation and legacy records.
- Duplicate/nonascending positions, unserved/unsupported access, inconsistent IDs and actual landing opening/shaft conflict.

Final verification:

- `pnpm test`: 759 tests passed across 47 files (41 additional tests).
- `pnpm lint`: passed.
- `pnpm build`: passed; the existing large-chunk advisory remains.
- `git diff --check`: passed.

Existing regression suites retain mechanical, camera, drawing-scale, CSS/preview and persistence coverage.

## Browser availability

One discovery attempt returned no apps/browsers and `Sky Computer Use native pipe startup failed`. No live visual, browser-console or interaction acceptance is claimed.

Manual acceptance still required for each family:

1. Open an existing project and check the compact `Haltestellen & Zugänge` rows and the existing count control.
2. Configure EG / OG 1 / OG 2 at 0 / 3200 / 6100 mm; select front / both / rear access with matching cabin/platform capabilities.
3. Inspect immediate landing marker/threshold/door reflow in 3D, including existing mechanical views and camera reset/orbit.
4. Run EG → OG 1 → OG 2, pause/resume, reset and change speed. Check served-side opening and alignment.
5. Delete a target stop, change count and confirm fresh runtime and valid target options.
6. Inspect all drawing types, selected landing access, automatic/fixed preview, and download PDF/DXF. Confirm existing sheet framing and absence of black fills/clipping.
7. Save, reload/reopen, duplicate, rename, export/import JSON and restore a version; compare labels, elevations, sides and drive configuration.
8. Inspect workspace overflow, React/runtime warnings, NaN transforms and blank viewports.

No manufactured landing mechanism is introduced for missing component records. Complex door physics, new certification rules and a drawing-style redesign remain outside scope.
