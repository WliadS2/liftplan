# Technical drawing architecture

LiftPlan technical drawings are deterministic vector projections of the same
family-owned normalized installation and spatial models used by validation and
the Three.js presentation. Passenger drawings additionally consume the detailed
mechanical and door models; goods-lift drawings consume the independent goods
platform, shaft, entrance, level, guide, and explicit load envelopes. Autoaufzug drawings consume their independent
platform, shaft, entrance, vehicle pose/contact-point, and approach-envelope model. They do not inspect Three.js meshes,
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

SVG output is stable and self-contained. Fixed-scale drawings can be exported
as browser-local vector PDFs through the document layer. The converter maps the
complete 210 × 297 mm or 297 × 210 mm SVG sheet to the identically sized PDF
sheet at the origin. It never fits drawing bounds, changes orientation, or
selects another scale. Automatic preview, incomplete/conflicting drawings, and
fixed-scale drawings that do not fit are rejected before a file is generated.

The common paper-space layer composes the unchanged fixed-scale drawing with a
physical sheet frame and a reusable information block in both browser preview
and PDF output. The frame is inset 9 mm from each paper edge. A 34 mm high
title area, at most 180 mm wide, is anchored to the lower-right corner of that
frame. The remaining drawing area is kept 6 mm away from the frame and title
area. It contains only project and drawing metadata already available to
LiftPlan plus the non-conformity notice: project number, deterministic drawing
number, scale, date, version, sheet number, planning status, and millimetre
unit.

The complete visible drawing bounds, including annotations, are centered in
that reserved drawing area by a single translation expressed in millimetres.
No additional scale transform is applied. A second PDF-sheet fit guard rejects
the export if those translated bounds would enter the title area or cross the
drawing-area limits.
The converter still maps the complete A4 SVG to the identically sized PDF page
at the origin.

## DXF model-space export

DXF export branches from the unpresented `TechnicalDrawingDocument`, before
paper-scale conversion. The browser-local writer emits ASCII AutoCAD R12
(`AC1009`) content with model coordinates in millimetres. A 2600 mm shaft and a
900 mm door therefore remain 2600 and 900 DXF drawing units regardless of the
selected SVG/PDF scale or browser viewport.

Lines, R12 polylines, circles, arcs, text, and explicit dimension lines/arrows
are derived from the existing drawing primitives. Deterministic layers separate
shaft, cabin, car frame, guide rails, counterweight, doors, machine, buffers,
ropes, loads, vehicles, approach envelopes, dimensions, centerlines, and annotations. Center and hidden line types
retain the drawing roles where R12 supports them. Missing optional normalized
systems create no entities.

A complete DXF plan set defines Grundriss, Schnitt, and the selected
Türansicht as separate model-space blocks and inserts them with translation
only. No INSERT scale is emitted. Project and drawing metadata are stored as
DXF comments; the export contains no certification or conformity claim.

A plan set is ordered as plan, section, then entrance elevations. Every page
uses the same sheet design and receives `Blatt X / Y`; repeated door elevations
receive sequential `DR` drawing numbers. Drawing numbers have the deterministic
presentation form `LP-[project-short-id]-GR|SC|DR-[sequence]`. This is not a
legal title block or regulated document-number system. Certified construction
drawings, DWG, multi-sheet tiling, per-page scales, native associative CAD
dimensions, CAD editing, and regulatory dimension rules remain deferred.

## Validation and progressive data

Missing optional systems are omitted instead of fabricated. A view with missing
required geometry remains an incomplete drawing and may retain any available
primitives. Spatially invalid planning data remains visible but the UI marks it
with `Planungsdaten enthalten Konflikte.` The drawing does not imply approval,
compliance, or certification.
