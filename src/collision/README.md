# Collision

This module owns render-independent geometric envelopes, collision queries, and
structured spatial-validation results. It must not inspect Three.js meshes or
React state.

- `spatial-primitives.ts` provides AABB and axis-aligned plan-rectangle
  containment, intersection, separation, raw clearance, translation, union,
  and analytic vertical-sweep operations.
- `passenger-spatial-envelopes.ts` adapts normalized passenger installation,
  mechanical, door, drive, and safety models into reusable envelopes.
- `passenger-spatial-validation.ts` declares and evaluates the scalable rule
  registry. Rules return stable codes and message keys; German presentation
  copy lives in the feature layer.

Touching faces do not count as a positive-volume intersection. A zero measured
clearance is nevertheless retained and may be reported as a geometric warning.
Negative clearance values describe geometric overflow. These values are not
certified clearances and are not compared with a regulatory minimum.

See `docs/engineering/spatial-validation.md` for status semantics, progressive
evaluation, rule sources, and limitations.
