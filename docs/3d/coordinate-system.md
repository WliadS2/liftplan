# 3D coordinate system

LiftPlan uses the right-handed Three.js coordinate system.

- `+Y` is vertical and points upward.
- `+X` points right when the installation is viewed from its designated primary access side.
- `+Z` points from the shaft centre toward that primary access side; looking into the shaft from the primary access side therefore looks toward `-Z`.
- Positive lift travel is along `+Y`.

One world unit equals one metre. Engineering dimensions are stored in millimetres and converted at the rendering boundary through the shared unit module.

The installation origin is the shaft centre on the finished-floor plane of the lowest served level unless an imported source defines and documents a different project datum. Imported coordinates must be transformed into the canonical system by an adapter; downstream scene code must not carry source-specific axis conventions.

Local component coordinates follow the same axis orientation. A component's pivot represents its documented assembly or placement reference, not an arbitrary visual centre.
