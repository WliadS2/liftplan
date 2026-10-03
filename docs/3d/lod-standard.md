# Level-of-detail concept

LiftPlan will use semantic detail modes rather than assuming that level of detail means polygon count alone. Numeric distance thresholds, mesh budgets, and loading policies are intentionally deferred until representative assets and performance targets exist.

## Planned modes

1. **Full installation**: project context and the complete lift installation at overview detail.
2. **Elevator**: one lift isolated from wider project context.
3. **Assembly**: a selected functional assembly with unrelated systems reduced or hidden.
4. **Component**: a selected component at the detail needed for placement and inspection.
5. **Engineering inspection**: a technical view that may add datums, clearances, collision states, measurements, and rule results. This is a semantic inspection mode, not necessarily the highest-polygon mesh.

## Rules

- Detail selection must not change engineering truth.
- Simplified meshes must preserve the interfaces and bounds required by their declared use.
- Collision and simulation models are independent from decorative render meshes.
- Asset metadata declares available modes and fallbacks.
- Loading and disposal are owned by the Three.js asset layer, not page components.
