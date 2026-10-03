# 3D asset standard

This standard applies to future externally authored CAD, GLB, and related visual assets.

## Naming

- Use lowercase kebab-case for files and stable asset identifiers.
- Names describe lift family, assembly, and component where applicable.
- Do not encode mutable engineering dimensions in an asset name.
- Keep human-facing German labels in metadata or UI resources, not in internal identifiers.

## Geometry and orientation

- Deliver runtime mesh assets as GLB unless a scoped integration defines another format.
- Use metres in asset geometry so one imported unit equals one Three.js unit.
- Use `+Y` up and component front toward `+Z`.
- Apply object transforms before export unless the asset manifest explicitly requires a transform.
- Do not bake project-specific placement into reusable component geometry.

## Pivots and origins

Place the pivot at a documented assembly, mounting, or alignment datum. The asset manifest must name the pivot convention. Visual centring is not a substitute for an engineering reference.

## Metadata

Every production asset will require metadata covering:

- stable asset ID and version;
- family and component classification;
- source and ownership;
- coordinate and pivot convention;
- material slots;
- supported detail modes;
- import notes and known limitations.

Engineering dimensions in metadata use millimetres. Asset bounds derived in the Three.js world use metres and must not become the engineering source of truth.

## Versioning

Version assets and their metadata together. Breaking changes to pivots, node names, material slots, or semantic structure require a major asset version. Compatible visual corrections require a minor or patch version according to the future asset pipeline policy. Never replace a versioned production asset with an incompatible file under the same identifier.
