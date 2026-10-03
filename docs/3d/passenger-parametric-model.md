# Passenger parametric visualization

## Purpose

The first LiftPlan 3D assembly is a lightweight planning visualization for the passenger lift family. It establishes a stable data and scene boundary for future CAD-quality work. It is not a detailed mechanical model and does not demonstrate compliance with a standard or approval rule.

## Data flow

1. The passenger planning schema stores engineering dimensions in millimetres.
2. The family geometry adapter creates a normalized `PassengerGeometryPlanningInput` without depending on React forms or Zustand.
3. The pure passenger installation transform creates every independently renderable submodel, reports an `empty`, `partial`, `complete`, or `invalid` state, and converts dimensions through `millimetresToMetres`.
4. React Three Fiber components render the resulting metre-based installation model.

Missing dimensions remain missing. The transform does not insert hidden shaft, cabin, level, pit, or counterweight defaults.

Partial models remain visible. Cabin geometry needs only its three explicit dimensions; doors, shaft footprint and envelope, levels, pit, guide rails, and counterweight are added only when their own placement and dimension inputs are available. A shaft with only width and depth is shown as its explicit footprint until known vertical extents are available. Levels without a known footprint use screen-sized point markers rather than an invented world-space width.

## Explicit planning inputs

The current scene can consume:

- cabin width, depth, and height;
- door width and height;
- through-car state;
- shaft width and depth;
- uniform stop count and storey height, with an explicit-elevation contract available for future data;
- pit depth and headroom;
- optional counterweight width, height, and rear, left, or right placement.

Capacity, passenger count, nominal speed, and drive concept remain project data but do not create geometry yet. A machine or drive placeholder is intentionally absent because no explicit machine envelope or placement input exists.

## Scene structure

`PassengerElevatorAssembly` composes independent shaft, pit, landing-level, guide-rail, counterweight, cabin, and door components. Cabin surfaces use shallow visualization-only solids while the optional counterweight remains a schematic plane. Guide rails and the counterweight are spatial placeholders, not engineering profiles or mechanical designs.

The cabin is composed from separate floor, ceiling, side-wall, rear-wall, entrance, sill, and door-leaf meshes. Each entrance owns two equal visualization leaves representing a center-opening door. When through-car planning is enabled, the rear wall is replaced by a second entrance assembly; when it is disabled, the rear wall remains closed.

Cabin wall, floor, door, frame, and sill thicknesses are defined in `visualization-geometry.ts`. These render-space constants exist only to make otherwise dimensionless surfaces readable. They are not planning values, engineering dimensions, manufactured thicknesses, or technical results, and they are bounded for very small input geometry.

The active view-mode contract supports `overview` and `cutaway`. Overview retains the normal technical enclosure. Cutaway opens the `+Z/+X` camera side by removing the front wall sections and right cabin wall, making the front doors and ceiling translucent, and reducing the shaft enclosure to its edge frame. Neither mode mutates the planning or installation model.

The scene uses a perspective camera, orbit controls, neutral technical lighting, and bounds-based automatic fitting. Changes that affect the installation bounds, level count, component availability, or view mode trigger reframing so the full installation remains visible.

## Deliberate limitations

The model does not include a traction system, ropes, pulleys, motor, controller, buffers, safety gear, governor, realistic rail profiles, movement, collision analysis, door animation, or imported CAD assets. These systems require their own explicit domain inputs and technical rules before they can be represented responsibly.
