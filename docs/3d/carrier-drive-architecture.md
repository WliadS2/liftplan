# Goods and Auto explicit drive foundation

## Data ownership

Independent Goods/Auto planning schemas accept optional `CarrierDrivePlanning` (`unspecified`, `traction`, `hydraulic`) and independent `CarrierSafetyPlanning`. Neither family imports Passenger mechanics. Shared carrier concepts do not merge their independent vehicle/load engineering models.

The pipeline remains planning → millimetre normalization → structured spatial rules → scene boundary/metres → cached render bindings and shared technical drawing projections. React controls dispatch planning changes; Three.js objects and generated validation/drawing/export output never enter project persistence.

All component dimensions are explicit AABBs with stable IDs and provenance. Optional vertical references resolve against the supplied lowest/highest stop; an explicitly declared shaft span is useful for full-height rails. Missing references omit the affected component and produce UNKNOWN. Undrawable nonpositive bounds produce an input issue; positive oversized geometry remains visible for inspection. No drive concept, ratio, stroke, hardware dimension or safety equipment is inferred.

## Attachments and motion

| Attachment | Declared kinematic display behavior |
| --- | --- |
| Fixed | No carrier displacement: machinery, supports, cylinder housing/base, rails, buffers |
| Carrier | Carrier displacement: frame, shoes, gears, carrier hitch/connection and platform doors |
| Counterweight | Negative carrier displacement multiplied by its explicit ratio |
| Plunger | Explicit ratio; extension envelope retains its bottom and moves its top |
| Indirect pulley | Explicit fixed/carrier/plunger attachment; no assumed reeving ratio |

`CarrierSimulationDriver` retains the single existing vertical-travel controller. It caches node identities and route buffer attributes on render changes. Applying a changed pose mutates those bindings without allocating arrays/geometries/models; unchanged offsets do no work. Pause/resume/reset and nominal-speed-at-departure behavior remain the common runtime's responsibility. Building-side landing doors stay fixed except for the served leaves' schematic opening motion.

Hydraulic plunger geometry is a **schematic extension envelope**, not a manufactured rod or a closed-length/stage design. The DEV cylinder's short housing and independently declared synthetic stroke do not prove a realizable actuator. Closed length, stages, pressure, buckling, mount strength and constructive feasibility are unresolved. This limitation is not hidden behind an engineering approval claim.

Suspension routes use explicit attachment coefficients. Unresolved coefficients omit the rendered route instead of leaving a detached frozen end; normalized planning and UNKNOWN diagnostics remain available. Static component reference envelopes can still be inspected when their motion relation is missing. `mechanicalVisualization` reports these display capabilities separately from unavailable physical drive/rope/safety simulations.

## Spatial coverage

- Full-travel shaft containment of fixed/carrier/counterweight/plunger envelopes.
- Strict XYZ swept penetration against actual fixed obstacles; rails and landing structures never enlarge a moving car/counterweight group.
- Carrier/counterweight swept overlap requires horizontal overlap as well as Y overlap.
- Contact is not penetration. Explicit rail interfaces and cylinder/plunger nesting are intentional relationships, not blanket obstacle exemptions.
- Referenced shoes/gears must reach their declared rail at both travel endpoints, including its vertical extent.
- Declared hydraulic stroke, cylinder/plunger alignment and direct connection endpoint alignment.
- Indirect layout availability requires explicit pulley and route data, with no assumed ratio.
- Route containment, endpoint anchoring, zero-length segments including mid-travel collapse.

The rules integrate into existing family statuses and carry stable IDs, reason codes, component IDs and millimetre measurements. Missing data yields UNKNOWN only for affected checks. Only explicit travel-blocking spatial INVALID results block carrier playback. General input/completeness status is not a blanket motion veto. No regulatory clearance, certified buffer performance or traction formula is introduced.

Fixed-only containment or fixed-component overlap remains INVALID planning data without alone blocking carrier travel. Moving swept penetration, motion containment and explicit kinematic/guide-interface failures are independent travel guards.

AABB swept spaces are conservative occupancy envelopes, not time-synchronized dynamics or exact arbitrary-shape collision proofs. Route sanity is not rope wrapping/traction analysis. Landing opening references have no fabricated physical thickness, so they are not invented solid obstacles. Mechanical parts only receive obstacle validation where actual component envelopes exist.

## Inspection and drawings

Goods has overview, platform/cabin, mechanics, drive, doors, loads, guides, safety and cutaway. Auto retains vehicle/approach inspections and adds conditional mechanics, drive, guides and safety. Drive excludes safety-only gear; safety emphasizes configured gears/buffers/rail relationships. No empty mechanical mode is advertised solely by name.

Overview/cutaway remain fixed full-installation frames. Traction drive frames the complete visible system, including full-height rails, route endpoints and moving-component travel, rather than clipping framing bounds while rendering unshortened parts. Hydraulic drive uses a local reference frame containing the cylinder/base, carrier frame/floor and connection; the existing moving-detail camera follows the carrier by rigid translation. The fixed hydraulic base can leave that local view at upper stops; overview remains the full-installation inspection. Carrier context is rendered from actual normalized geometry, with a reduced platform outline and no invented shaft detail. Mechanics/safety remain fixed-detail. Manual orbit retains ownership until a semantic reset or other explicit framing event; no frame-by-frame camera fit occurs.

Shared orthogonal projection reads normalized carrier and drive envelopes at the reference floor. Plan/section include real mechanical footprints/bounds and route references; section annotations reuse the existing exterior-column layout. Auto adds actual wheel-contact axle/wheelbase references and configured landing openings. Door semantics are unchanged. All results remain TechnicalDrawingDocument primitives for SVG, vector PDF and 1:1 mm DXF. New HYDRAULIC/SAFETY layers classify real supplied systems; PDF scale/projection/page mapping are untouched.

The automatic browser plan viewer distinguishes model-content bounds from the entire A4 sheet: an inner SVG fits model content into the existing reserved drawing area, while a measured outer viewport fits the whole sheet with a modest screen-space margin. Fixed-scale sheets retain their physical dimensions and scroll instead. Auto plan dimension annotations use the existing exterior-column layout. See [presentation correction QA](../qa/technical-presentation-corrections.md) for deterministic checks and pending visual acceptance.

## Persistence and deliberate limits

The additions are optional v1 fields: old projects load without drive/safety data and without synthetic migration defaults. IndexedDB, versions, duplication, rename and JSON use the existing planning-only persistence boundary. DEV Goods traction/Auto hydraulic fixtures are ephemeral, never autosaved or used as configuration defaults, and excluded from production bundles.

The compact collapsed inspector exposes concept and applicable layout/ratio/stroke inputs. Detailed component envelopes/routes are supported by the typed planning/JSON contract and DEV fixtures, not a new dozens-field component editor.

No manufacturer hardware, safety certification, physical acceleration/braking/jerk, rope traction, hydraulic pressure, stage sizing, stress analysis, real door operator, governor mechanism, wheel loads, DWG or new lift family is implemented. Indirect hydraulics is a contract/explicit-envelope foundation, not a reeving solver. See [QA evidence](../qa/carrier-drive-maturity-qa.md) for automated coverage and the outstanding live-browser checks.
