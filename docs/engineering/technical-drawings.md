# Technical drawing architecture

LiftPlan technical drawings are deterministic vector projections of the same
normalized passenger installation, mechanical, door, and spatial models used by
validation and the Three.js presentation. They do not inspect Three.js meshes,
screenshots, DOM dimensions, or rendered pixels.

The pipeline is:

1. serializable passenger planning configuration;
2. normalized installation, mechanical, component, drive, safety, and door
   models;
3. spatial validation and a React-independent drawing context;
4. one pure projection for plan, section, or entrance elevation;
5. typed technical primitives with deterministic geometry and annotation
   bounds;
6. a presentation-only SVG renderer.

## Coordinates and units

Normalized domain geometry remains Y-up in metres. The drawing projection
boundary converts it once to millimetres with the shared engineering unit
module. Drawing coordinates therefore represent millimetres even though an SVG
`viewBox` is physically unitless.

- **Plan (Grundriss):** world X maps to page X; world Z maps to page Y with
  `pageY = -Z`. Rear geometry appears above and front geometry below.
- **Section (Schnitt):** world X maps to page X; world Y maps to page Y with
  `pageY = -Y`.
- **Entrance elevation (Türansicht):** entrance-local width maps to page X;
  world Y maps with `pageY = -Y`. Rear entrances reverse world X so the view is
  consistently read while facing that entrance.

The world coordinate system is not changed by drawing projection.

## Primitives, dimensions, and bounds

The drawing document supports lines, polylines, rectangles/component outlines,
circles, arcs, text, center/extension lines, section markers, restrained hatch
regions, and semantic dimensions. A typed CAD hierarchy distinguishes cut
structure, visible outlines, secondary detail, dimensions, centerlines, hidden
geometry, level references, and section lines. Dimension values come only from normalized planning geometry:
shaft, cabin, opening, pit, headroom, installation, and level relationships.
Explicit demo component outlines may be drawn, but demo frame, jamb, header,
operator, rail-profile, and visualization-shell thicknesses are never emitted
as project dimensions.

Dimension lanes use deterministic offsets. Door, cabin, and shaft dimensions
occupy progressively outer paper-space lanes. Geometry bounds and annotation
bounds are calculated separately and united with a fixed drawing margin for
preview fitting. Hatch regions on the annotation layer cannot change model
bounds. No DOM measurement participates in fitting.

## Scale and output

The typed scale vocabulary is `auto`, `1:20`, `1:25`, `1:50`, and `1:100`.
`auto` is a responsive browser preview. Fixed ratios create a deterministic A4
paper-space presentation: model geometry is divided by the selected denominator
while line weights, text, dimension lanes, leaders, and page margins remain in
paper millimetres. Each fixed preview uses exactly one physical A4 sheet:
portrait sections are 210 × 297 mm; landscape plans and door elevations are
297 × 210 mm. A 12 mm margin and 18 mm future title-block reservation define
the content bounds. Neither page dimensions nor model scale depend on drawing
size or browser/container size.

The presentation calculates scaled geometry bounds, paper-space annotation
bounds, and complete bounds including drawing strokes/arrowheads. Comparing
complete bounds with content bounds returns `fits` or `does-not-fit`. Oversized
drawings retain their selected scale, show a German fit notice, and are clipped
at the physical sheet boundary. They are never compressed or spread across an
automatically enlarged multi-sheet viewBox. For example, the 8200 mm demo
section is 410 mm at 1:20 (`does-not-fit`) and 164 mm at 1:50 (`fits`).

Fixed SVG output declares physical `width`/`height` in mm and a page viewBox
(`0 0 210 297` or `0 0 297 210`). CSS may resize the whole sheet uniformly for
screen display; it never changes paper-space primitive coordinates or fit
status. Automatic mode alone uses the document's fitted drawing bounds.

Scale also controls visual detail without changing engineering values. `1:20`
and `1:25` retain available guide-shoe and door-mechanism detail; `1:100`
simplifies those small features while preserving shaft, cabin, doors, rails,
counterweight, primary labels, and semantic dimensions.

SVG output is stable and self-contained, so the same drawing document can later
be embedded in PDF reports, RFQ documents, or other project artifacts. The A4
contract reserves future title-block space but does not render a legal title
block. Certified construction drawings, PDF export, DXF/DWG, CAD editing, and
regulatory dimension rules remain deferred.

## Validation and progressive data

Missing optional systems are omitted instead of fabricated. A view with missing
required geometry remains an incomplete drawing and may retain any available
primitives. Spatially invalid planning data remains visible but the UI marks it
with `Planungsdaten enthalten Konflikte.` The drawing does not imply approval,
compliance, or certification.
