# Passenger parametric visualization

## Purpose

The first LiftPlan 3D assembly is a lightweight planning visualization for the passenger lift family. It establishes a stable data and scene boundary for future CAD-quality work. It is not a detailed mechanical model and does not demonstrate compliance with a standard or approval rule.

## Data flow

1. The passenger planning schema stores engineering dimensions in millimetres.
2. The family geometry adapter creates a normalized `PassengerGeometryPlanningInput` without depending on React forms or Zustand.
3. The pure passenger installation transform creates every independently renderable submodel, reports an `empty`, `partial`, `complete`, or `invalid` state, and converts dimensions through `millimetresToMetres`.
4. The pure mechanical-layout transform adds independent schematic mechanical subsystems from available planning and installation geometry.
5. React Three Fiber components render the resulting metre-based installation and mechanical models.

Missing dimensions remain missing. The transform does not insert hidden shaft, cabin, level, pit, or counterweight defaults.

Partial models remain visible. Cabin geometry needs only its three explicit dimensions; doors, shaft footprint and envelope, levels, and pit are added independently. Frame and rail systems require their own explicit layout inputs. The separate mechanical transform positions a counterweight only with complete dimensions, arrangement, and centre-offset data. A shaft with only width and depth is shown as its explicit footprint until known vertical extents are available. Levels without a known footprint use screen-sized point markers rather than an invented world-space width.

## Explicit planning inputs

The current scene can consume:

- cabin width, depth, and height;
- door width and height;
- through-car state;
- shaft width and depth;
- uniform stop count and storey height, with an explicit-elevation contract available for future data;
- pit depth and headroom;
- optional counterweight width, height, depth, rear/left/right arrangement, and centre offset;
- optional rail spacing/orientation/axes, buffer positions, machine/sheave geometry, and suspension routing.

Capacity, passenger count, nominal speed, and drive concept remain project data but do not create geometry yet. Machine, sheave, and suspension placeholders remain absent unless their complete optional mechanical planning inputs are supplied.

## Scene structure

`PassengerElevatorAssembly` composes the installation and a separate `PassengerMechanicalAssembly`. The latter owns car-frame, cabin-rail, counterweight, counterweight-rail, buffer, machine, sheave, suspension-path, and zone renderers. Mechanical rendering consumes the pure layout and does not inspect project state or derive technical rules.

The cabin is composed from separate floor, ceiling, side-wall, rear-wall, entrance, sill, and door-leaf meshes. Each entrance owns two equal visualization leaves representing a center-opening door. When through-car planning is enabled, the rear wall is replaced by a second entrance assembly; when it is disabled, the rear wall remains closed.

Cabin wall, floor, door, frame, and sill thicknesses are defined in `visualization-geometry.ts`. These render-space constants exist only to make otherwise dimensionless surfaces readable. They are not planning values, engineering dimensions, manufactured thicknesses, or technical results, and they are bounded for very small input geometry.

The active view-mode contract supports `overview`, `mechanical`, and `cutaway`. Overview retains the normal technical enclosure. Mechanical mode reduces cabin and shaft obstruction while emphasizing mechanical components. Cutaway opens the `+Z/+X` camera side by removing the front wall sections and right cabin wall, making the front doors and ceiling translucent, and reducing the shaft enclosure to its edge frame. Mechanical components remain visible in cutaway. No mode mutates the planning, installation, or mechanical model.

The scene uses a perspective camera, orbit controls, neutral technical lighting, and bounds-based automatic fitting. Changes that affect the installation bounds, level count, component availability, or view mode trigger reframing so the full installation remains visible.

The detailed mechanical boundary, schematic-value policy, and deferred systems are documented in [Passenger mechanical visualization architecture](./passenger-mechanical-architecture.md).
