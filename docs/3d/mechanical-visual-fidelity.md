# Mechanical visualization fidelity

## Boundary and provenance

The engineering model remains authoritative: normalized component envelopes, explicit attachment relationships and domain millimetres are unchanged. Existing scene adapters perform the mm → m conversion. The new optional visual-detail layer operates **only in render-space metres**, below that boundary. It never enters project JSON/IndexedDB, spatial validation, technical drawing projections, PDF or DXF.

`MechanicalVisualDetail` is a render-neutral discriminated collection of box, cylinder, revolved-section and extruded-profile pieces. Each has a local center, material role and stable child identifier. A detail carries its own source and reference. `prepareMechanicalVisualModel` checks finite/nondegenerate shapes, resource budgets and containment in the existing parent envelope, then returns either detail or an explicit envelope fallback. The floating-point comparison epsilon is not an engineering clearance. Unusable detail is not a planning INVALID issue and cannot disable an otherwise valid project.

This is an optional component-provider seam for later verified manufacturer geometry, **not a CAD import system or new planning catalogue**. A future provider can supply explicit detail to the same preparation/mesh contracts without changing attachment ownership. No verified Goods/Auto hardware provider is implemented in this milestone.

## Production versus DEV

Goods/Auto planning currently describes most mechanical components by AABBs, not cylinder axes, wall thicknesses, rail sections, rope diameters or hub dimensions. Those missing facts are not inferred for production. Production receives role-specific PBR materials, restrained edges and the original envelope geometry where verified detail is absent.

`src/dev/fixtures/mechanical-visual-detail.ts` supplies **synthetic schematic render detail only** for existing components explicitly marked `demo`. It uses bounded display proportions; these are not hardware dimensions or recommended planning values. Both `import.meta.env.DEV` and demo provenance gate automatic use. The production build removes this factory and its marker strings. Supplying demo detail for a normal planning/verified component is rejected. No new project receives demo data, and existing fixture engineering inputs are unchanged.

## Representations

- Goods DEV traction: separated housing/foot/end section/shaft symbol, grooved sheave and hub, mounting members, hitch plates/termination symbols, open counterweight frame and repeated stack slabs. Frame member display sections respect the actual stack envelope instead of intruding into it.
- Auto DEV hydraulic: hollow housing/head-land section, fixed housing seat/base, reflective plunger extension envelope, carrier connection plate/seat. These are schematic, not seals, telescopic-stage designs or proof of a realizable actuator.
- Shared DEV carrier: channel-like frame extrusions, floor plate/edge, inward-facing guide profiles and shoe cavities around actual corresponding rail envelopes. A missing/unresolved guide pair retains envelope geometry. Buffers use schematic body/contact cylinders only for actual configured buffer segments; no buffer or support is added implicitly.
- Passenger: existing explicit profiles, channels, machine/sheave, ropes and doors are retained. Only its existing component boxes use shared geometry/material resources and restrained structural edges. Original IDs, position, Y rotation, size, source and motion groups remain intact. No synthetic detail provider is applied to Passenger.
- Doors: unchanged. Passenger already has explicit detailed door components. Goods/Auto do not provide enough mechanism data to justify invented operators, tracks or couplers.

The Goods route remains the existing explicit **schematic polyline**; no tangent wrapping, rope count, groove selection or physical traction design is inferred. Only the known DEV suspension route receives a labelled synthetic display thickness. Production routes stay lines where diameter is unknown.

## Motion ownership and cameras

All drive detail remains below the original `drive-motion-<id>` / `drive-shape-<id>` parents. Fixed parts remain fixed, carrier attachments translate once, counterweight follows its supplied ratio, and the plunger shape alone inherits the existing anchored extension transform. No cylinder collar or housing is added beneath the extending plunger node. Shared carrier parts stay beneath their original family moving/fixed groups.

Optional suspension segment meshes have stable names compiled into `bindCarrierDriveScene`. The existing route point coefficients update their endpoints, center, orientation and length with reusable vectors. Zero-length segments become invisible rather than producing invalid transforms. The original line buffer remains the binding source. No extra clock, simulation engine, per-frame model creation or geometry recreation is introduced.

Semantic filters, orbit/zoom/reset, moving follow and full-installation camera policies are unchanged. Parent envelopes still bound every visual detail, so added hardware does not demand a new camera architecture. Hydraulic local-view limitations documented in the carrier-drive architecture still apply.

## Resources and deliberate limits

Static detail uses memoized resources, unit boxes/cylinders, repeated-profile geometry keys and material-role reuse. Extrusions have one step and no bevels; revolved parts use 24 radial segments. Each route shares one 8-sided cylinder geometry/material across segments. Passenger retains existing instanced weight stacks. Resources have explicit disposal; no fasteners, pipes, textures, cloud assets or photorealistic effects are added.

Resource reuse is scoped to each rendered subassembly; a cross-scene global asset cache or distance-based LOD was not introduced. Tests guard the stock mechanical detail below 150 solid pieces / 25,000 submitted vertices per family and ensure detail complexity is independent of 2/6/10 stops. These are rendering regression budgets, not engineering limits or measured FPS guarantees.

Verified machine/sheave axes and supports, real suspension wrapping, steel section dimensions, seals/stages, actuator closed length, mounting/fastener designs and manufacturer CAD remain unresolved. Visual fidelity must not be confused with mechanical correctness or certification. See [QA evidence and manual checks](../qa/mechanical-visual-fidelity-qa.md).
