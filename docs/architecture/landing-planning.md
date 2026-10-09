# Floor-by-floor landing planning

## Single elevation source

Passenger, Goods and Auto retain their existing `stopCount` and `levelElevationsMm` planning fields. The additive `landingSettings` array stores stable ID, editable label and served front/rear access, aligned with those elevations. It does not contain a second elevation or stop count. A `null` elevation means explicitly unresolved planning data and survives JSON; it is never interpreted as zero.

`landing-planning.ts` supplies pure editing commands and the common normalized landing contract in millimetres. Existing Passenger uniform `floorHeightMm` and Goods/Auto `storeyHeightsMm` expand deterministically. Legacy IDs remain `level-1`, `level-2`, etc. Legacy Passenger explicit elevations retain their historical authority over an old count field; the first editor command reconciles count and metadata. Goods/Auto continue rejecting ambiguous explicit elevations plus interval lists and inconsistent counts.

The first explicit editor command materializes existing heights and access, preserving configured geometry, and removes the Goods/Auto interval source. Unrelated edits never regenerate elevations. Count edits and add/remove commands use the same resize operation after customization. Existing IDs and remaining elevations survive deletion. A new elevation remains null unless an explicitly available uniform height can extend it. Passenger's explicit uniform-height action preserves the existing lowest datum and labels; editing its convenience height alone does not overwrite custom values.

Passenger-specific update logic preserves the selected cabin stop when preceding rows disappear and removes overrides only for deliberately deleted landing IDs. Invalid references imported from elsewhere remain validation conflicts. Missing intermediate elevations do not shift a cabin's attachment to another stop.

## Access and geometry

Per-stop access describes the building landing, not the moving cabin/platform opening. Passenger retains front access and its explicit through-car rear capability. Goods/Auto retain their independent `frontAccess`, `rearAccess` and `throughCar` declarations. Rear editor controls require the corresponding capability; imported contradictions are still validated.

Each family's existing normalizer attaches IDs, labels and served sides to its own normalized levels. Scene adapters and Passenger door-series expansion filter fixed landing doors by those sides. Cabin/platform doors remain separate moving assemblies. Existing explicit hardware records, component identities, vertical anchors and mechanical bindings are retained. Explicit Passenger stop access without a manufactured landing-door series may show the clear opening on the declared shaft boundary; no panel, sill gap, track or manufacturer mechanism is invented.

## Simulation

Existing runtime replacement semantics reset travel after count, elevation or access changes; invalid old targets cannot be dispatched. Existing speed-only edits retain active journey timing and apply on the next departure. The shared travel calculation is unchanged: actual source/target elevation distance divided by declared nominal speed. Side-specific door progress uses the current served landing. Passenger binds the same side filter to its explicit panel travel vectors. Missing/invalid stops prevent travel; physical collision rules remain active.

## Drawing and export boundary

`createLiftPlanDrawing` accepts an optional landing ID. The Plans workspace exposes landing selection in Grundriss and Türansicht and filters side choices by that landing. Schnitt projects actual elevations, labels, adjacent intervals and served openings; coincident front/rear opening outlines are not duplicated. Invalid/deleted references and unserved requested door sides do not fall back to a different opening.

All views still return `TechnicalDrawingDocument`. A4 sheet design, fit guards, SVG/PDF scale mathematics and DXF 1:1 model coordinates are unchanged. Current export and plan-set orchestration pass the same landing selection to the drawing factories. A plan set retains its existing selected-door-page scope; automatic enumeration of every landing/side is not introduced here.

## Validation and persistence

New structured rule codes cover unresolved elevations, nonascending/duplicate positions, count/identity inconsistencies, unserved stops, unsupported access and usable landing-opening containment in the declared shaft. Missing data is UNKNOWN; contradictions are INVALID. Existing German planning status labels and all mechanical validation remain unchanged. No regulatory spacing or margins are added.

The family schemas accept additive metadata and nullable elevations without changing their schema identifiers or the IndexedDB/file record envelope. The existing repository, autosave, snapshots, duplication, rename and JSON serialization persist planning inputs only. Legacy records require no destructive eager rewrite: normalization supplies equivalent deterministic elevations, and editor use materializes them. Existing invalid drafts remain recoverable through the same draft boundary.

See [landing editor QA](../qa/landing-editor-qa.md) for evidence and pending live checks.
