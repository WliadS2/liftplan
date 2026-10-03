# 3D coordinate system

LiftPlan uses the right-handed Three.js coordinate system.

- `+Y` is vertical and points upward.
- `+X` points right when the installation is viewed from its designated primary access side.
- `+Z` points from the shaft centre toward that primary access side; looking into the shaft from the primary access side therefore looks toward `-Z`.
- Positive lift travel is along `+Y`.

One world unit equals one metre. Engineering dimensions are stored in millimetres and converted at the rendering boundary through the shared unit module.

The installation origin is the shaft centre on the finished-floor plane of the lowest served level unless an imported source defines and documents a different project datum. Imported coordinates must be transformed into the canonical system by an adapter; downstream scene code must not carry source-specific axis conventions.

Local component coordinates follow the same axis orientation. A component's pivot represents its documented assembly or placement reference, not an arbitrary visual centre.

## Passenger planning scene

The current passenger installation places the cabin floor at the lowest served level (`Y = 0`). Uniform landing elevations are derived from the explicit stop count and storey height before React rendering. The level contract also accepts explicit millimetre elevations so later project data can replace uniform spacing without changing scene components.

The primary entrance is on the `+Z` shaft face. A through-car configuration adds the corresponding rear opening on the `-Z` face. The pit extends below the lowest finished-floor plane only when an explicit pit depth is present.

The passenger cutaway view opens the model toward the default camera on the `+Z/+X` side. It removes the front wall sections and right cabin wall, makes the front door leaves and ceiling translucent, and retains the shaft edges without its transparent enclosure surface. This is a rendering visibility convention only; it does not change planning geometry.

## Mechanical coordinates

Mechanical planning points use the same canonical `X/Y/Z` axes and are stored in millimetres. The mechanical layout transform converts them to metre-based immutable tuples before rendering. Rail paths use bottom-to-top points along `+Y`; buffer positions refer to their base points; machine and sheave positions refer to their visual envelope centres; suspension paths retain their supplied point order.

The current rear/left/right counterweight arrangement indicates only a side of the shaft. Until exact coordinates are supplied, its placement and the related rail positions are explicitly schematic. They must not be interpreted as clearances or approved mechanical coordinates.
