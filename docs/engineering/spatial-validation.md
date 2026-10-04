# Spatial validation

## Scope and boundary

LiftPlan's spatial validator answers deterministic geometric questions about
the planning data that is currently present. It does not inspect rendered
Three.js meshes, React state, or Zustand. It consumes the same normalized
installation, mechanical, door, traction, and safety models used to build the
scene.

This layer is not EN 81 validation, certification, a manufacturer check, or an
engineering release. It contains no regulatory minimum clearance, automatic
shaft sizing, mass balance, structural-load, rail-force, or traction formula.

## Architecture

The implementation has three layers:

1. `spatial-primitives.ts` contains pure static AABB and axis-aligned plan
   rectangle operations.
2. `passenger-spatial-envelopes.ts` adapts normalized passenger models into a
   common envelope vocabulary.
3. `passenger-spatial-validation.ts` evaluates a registry of independent rules
   and aggregates their structured results.

All coordinates in this layer are normalized metres using the shared branded
unit types. Planning dimensions remain millimetres until the existing geometry
normalizers convert them.

## Collision primitives

The lightweight collision layer supports:

- explicit AABB separation, zero-volume contact, and positive-volume
  penetration classification, plus positive-area plan-rectangle intersection;
- containment and outside checks;
- per-axis separation and Euclidean separation distance;
- raw left, right, front, rear, top, and bottom clearances;
- AABB translation and union;
- an analytic vertical swept AABB over a supplied displacement interval.

Merely touching faces do not intersect because their shared volume is zero.
They do have zero geometric clearance. Negative clearance values mean the
subject extends beyond the container. No tolerance or required safety margin is
silently added.

## Envelope model

`PassengerSpatialEnvelopes` can represent the shaft interior, cabin, car frame,
counterweight, cabin and counterweight rail systems, cabin and landing doors,
buffers, explicit upper mechanical components, and cabin/car-frame/counterweight
swept spaces. Each envelope has a stable identifier, subsystem, involved
component identifiers, a plan rectangle, and an AABB where vertical data is
known.

Door, component, and motion envelopes are derived from normalized domain
geometry. Decorative mesh thicknesses and scene-only effects cannot change a
validation result.

## Result and status model

Every rule returns its own status and typed issues. Overall priority is
`invalid`, then `warning`, then `unknown`, then `ok`.

| Internal status | German presentation | Meaning |
| --- | --- | --- |
| `ok` | Geeignet | Available geometry passed this set of geometric checks. |
| `warning` | Prüfung erforderlich | Geometry can be represented, but an explicit relationship needs review. |
| `invalid` | Nicht möglich | Available geometry contains a demonstrated conflict. |
| `unknown` | Noch nicht bewertet | Required explicit data is absent, so the rule was not evaluated. |

An issue contains a stable English code, severity, subsystem, message key,
involved component IDs, and optional raw measurements, affected level,
suggested field, and cabin-travel blocking flag. German text is mapped in
`spatial-validation-messages.ts`; it is not embedded in engineering logic.

## Progressive validation

Rules list the data they require. Missing data produces `unknown`, never an
invented fallback and never an `invalid` result merely because the project is
incomplete. For example, a known cabin without shaft width/depth cannot be
checked for shaft fit, while its positive dimensions and any valid levels can
still be evaluated independently.

## Registered geometric rules

The current passenger registry checks only relationships that follow directly
from explicit geometry:

- finite, strictly ordered, non-duplicate levels inside known installation
  bounds;
- positive cabin dimensions, cabin plan containment, and vertical cabin sweep;
- car-frame containment and normalized frame/cabin conflicts;
- static counterweight containment, cabin intersection, and explicit swept
  counterweight containment;
- distinct rail pairs, rail-axis shaft containment, and guide-shoe references;
- positive/non-degenerate door geometry, finite panel transforms, valid landing
  level assignment, stable cabin-entrance references, opening fit within the
  explicit cabin dimensions, closed-panel fit, and cabin/landing entrance-axis
  correspondence;

Cabin entrance fit uses the normalized semantic usable opening. Its source is
either the project `Türbreite`/`Türhöhe` or an explicit per-entrance opening.
Frame jambs, headers, tracks, operators, and visualization shell thickness do
not shrink this validation envelope.
- buffer and explicit upper-mechanical containment;
- analytic cabin/car-frame sweep conflicts with fixed components;
- positive-volume overlap of cabin and counterweight swept spaces without
  inferring timing or collision probability. This is travel-blocking because
  both moving envelopes occupy the same X/Y/Z volume; Y overlap alone is not a
  conflict.

The registry classifies rule sources as `geometric`, `planning`,
`verified-standard`, or `manufacturer`. Only geometric rules are registered in
this increment. A future verified rule must be implemented as a separate,
traceable registry entry with its approved source; it must not change the raw
geometric measurements.

## UI and simulation use

The technical-data panel shows the aggregate German status, compact conflict
and hint counts, and expandable translated issues. It also states that the
result is not a technical or normative release.

The simulation adapter evaluates the same registry after it establishes the
available motion envelope. It refuses `Fahrt starten` only when an error issue
explicitly declares that cabin travel is blocked. Warnings and unrelated
`unknown` results do not disable simulation.

Issue component identifiers are intentionally render-neutral and can later be
mapped to a restrained scene highlight. No highlighting policy is part of the
validator.

## Known limitations

- AABBs and axis-aligned plan rectangles are conservative for rotated or
  irregular parts; this is not a general physics engine.
- Sweeps are analytic unions, not frame-by-frame collision simulation.
- Cabin/counterweight swept overlap reports spatial overlap only; it does not
  infer synchronized timing, likelihood, mass, or impact.
- There is no collision response, automatic correction, or automatic sizing.
- No certified clearance, building-code rule, EN 81 rule, manufacturer rule,
  structural calculation, rail-load calculation, or traction calculation is
  included.
