# Passenger parametric visualization

## Purpose

The first LiftPlan 3D assembly is a lightweight planning visualization for the passenger lift family. It establishes a stable data and scene boundary for future CAD-quality work. It is not a detailed mechanical model and does not demonstrate compliance with a standard or approval rule.

## Data flow

1. The passenger planning schema stores engineering dimensions in millimetres.
2. The family geometry adapter creates a normalized `PassengerGeometryPlanningInput` without depending on React forms or Zustand.
3. The pure passenger installation transform creates every independently renderable submodel, reports an `empty`, `partial`, `complete`, or `invalid` state, and converts dimensions through `millimetresToMetres`.
4. The pure mechanical-layout transform adds independent schematic mechanical subsystems from available planning and installation geometry.
5. The independent pure door transform normalizes explicitly supplied equipment against cabin openings and landing levels.
6. React Three Fiber components render metre-based installation, mechanical and door models.

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
- optional rail spacing/orientation/axes, buffer positions, machine/sheave geometry, and suspension routing;
- optional independently sourced cabin/landing door assemblies, operators, sills, coupling and interlocks.

Capacity, passenger count, nominal speed, and drive concept remain project data but do not create geometry yet. Machine, sheave, and suspension placeholders remain absent unless their complete optional mechanical planning inputs are supplied.

## Scene structure

`PassengerElevatorAssembly` composes the installation and a separate `PassengerMechanicalAssembly`. The latter owns car-frame, cabin-rail, counterweight, counterweight-rail, buffer, machine, sheave, suspension-path, and zone renderers. Mechanical rendering consumes the pure layout and does not inspect project state or derive technical rules.

The cabin has separate floor, ceiling, side-wall, rear-wall and entrance wall sections. The independent door renderer adds panels/equipment only from explicit data. Center-opening and side-opening two-panel types are supported; missing component data leaves an opening outline. Through-car replaces the rear wall with an independent entrance, without changing cabin dimensions.

Cabin wall/floor thicknesses in `visualization-geometry.ts` are bounded visualization-only constants for dimensionless shell surfaces. Door panels, frames and sills no longer use thickness constants: they require explicit component data.

The six modes are `overview`, `mechanical`, `drive`, `safety`, `doors` and `cutaway`. Overview retains the enclosure; mechanical reduces shell obstruction; drive/safety focus their systems. Doors emphasizes the selected entrance and landing. Cutaway removes front wall sections/right cabin wall, makes door panels/ceiling translucent and retains shaft edges/mechanics. No mode mutates planning or normalized geometry.

The scene uses a perspective camera, orbit controls, neutral technical lighting, and bounds-based automatic fitting. Changes that affect the installation bounds, level count, component availability, or view mode trigger reframing so the full installation remains visible.

The detailed mechanical boundary, schematic-value policy, and deferred systems are documented in [Passenger mechanical visualization architecture](./passenger-mechanical-architecture.md).

Door equipment, level association, explicit mounting/sill relationships, selected-floor camera behavior and future travel are documented in [Static passenger door system](./passenger-door-architecture.md).
