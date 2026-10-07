# Simulation

Pure kinematic visualization state, deterministic stepping, structured capability guards and normalized poses live here. The module has no React, Three.js runtime or Zustand dependency. It consumes read-only render-neutral installation/layout contracts. The built-in playback profile and optionally supplied demo profile are visualization-only inputs; neither is technical project data or an engineering-performance claim.

See [passenger kinematic visualization](../../docs/3d/passenger-kinematic-simulation.md) for the current state machine, progressive capability contract, clock and limitations.

All three simulation-capable families use `vertical-travel.ts` for constant-speed duration from explicit elevations and nominal speed. Passenger keeps its mechanical state machine; Goods and Auto have independent geometry adapters over the generic `platform-simulation.ts` carrier runtime. Door timing is separate. Active journeys capture duration; speed edits apply on the next departure without resetting the pose. These are visualization contracts, not certified performance.
