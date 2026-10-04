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

The passenger installation resolves the static cabin floor from optional `cabinLevelIndex` against normalized levels (first known level when unspecified). The development fixture explicitly selects index zero. Uniform levels use the supplied count/storey height; optional `levelElevationsMm` supplies strictly ordered elevations and takes precedence. Shared `installation.vertical` exposes landing, pit, headroom, shaft-top and current-cabin references. See [canonical vertical layout](./passenger-vertical-layout.md) for anchor semantics and missing-data behavior.

The primary cabin entrance is on its `+Z` shell face; through-car adds the rear opening on its `-Z` shell face. Landing planes require explicit separation from these cabin planes, not inferred shaft-face placement. Pit depth remains explicit.

Door local X/Y define the opening plane; local +Z points outward. Front/rear Y rotations are zero/π. Component offsets use this local frame, operator/interlock mounts use the opening top, and landing origins use normalized level elevations. A door inspection selection never translates the cabin. See [door coordinates and relationships](./passenger-door-architecture.md).

The passenger cutaway view opens the model toward the default camera on the `+Z/+X` side. It removes the front wall sections and right cabin wall, makes the front door leaves and ceiling translucent, and retains the shaft edges without its transparent enclosure surface. This is a rendering visibility convention only; it does not change planning geometry.

## Mechanical coordinates

Mechanical planning points use the canonical axes and millimetres. World-placement points may explicitly declare `verticalAnchor`, making their Y an offset from a canonical reference; unanchored points remain absolute. Local shape coordinates remain local. Pure transforms resolve anchors before conversion/rendering. Rail paths use bottom-to-top points along `+Y`; buffer positions refer to bases; machine/wheel origins identify assembly references; supplied route order is retained.

The rear/left/right counterweight arrangement indicates a side of the cabin and the width-axis orientation. `counterweightOffsetMm` supplies an explicit three-coordinate centre-to-centre displacement from the cabin centre; no shaft-boundary placement is inferred. Cabin rails use either an explicit pair of X/Z positions or spacing along X/Z symmetric about the canonical cabin axis (or an explicitly supplied rail axis). Counterweight rails use explicit positions or explicit spacing along the weight's width axis.

Mechanical debugging bounds contain full `min`, `max`, and three-coordinate `center` tuples, including non-centred components. Bounds-based camera fitting consumes the complete installation and mechanical envelopes.
