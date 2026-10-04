# Passenger kinematic visualization

## Architecture and scope

`configuration/layout → normalized installation → simulation model → state machine → simulation pose → Three.js transforms` is the complete motion pipeline. This is deterministic kinematic visualization, not an elevator dynamics simulation, equipment recommendation or performance/EN 81 result. Rated project speed does not drive the animation.

`src/simulation` stays independent of React, Three.js runtime, engineering calculations and Zustand. The input adapter reads existing immutable normalized levels, shaft extents, component bounds, analytic cable segments and door transforms. Visualization setup is a separate record with `demo | visualization` provenance. Missing data remains unavailable. Unsupported or impossible layouts return structured `{ code, path }` issues; there is no implicit correction or fallback physical relationship.

## State machine and clock

The cycle is `idle → door-closing (departure) → moving → arriving → door-opening → door-open → door-closing (completion) → idle`. Departure closing is an explicit timed phase even though reset initializes closed panels. Arrival publishes the exact target elevation/current-level identity before opening. Current, source and target levels remain explicit; travel direction, normalized travel progress and door progress are distinct fields.

`start` requires a different existing finite target, idle state and closed doors. Pause/resume require an active cycle. Reset is accepted in every phase. Doors cannot open during moving, and starting with open doors is rejected. There is no optional manual door command or dispatch logic in this first version.

`advanceSimulation` consumes elapsed seconds across all crossed phase boundaries, so a coarse tick and partitioned ticks produce the same state within floating-point arithmetic. A boundary comparison of scaled machine epsilon canonicalizes accumulated numeric roundoff only; it is not a physical tolerance. `smoothVisualizationProgress(t) = t²(3−2t)` is reusable normalized visual interpolation, never a claim about real acceleration or jerk.

One R3F callback in `PassengerSimulationDriver` advances the controller and applies the resulting pose before ordinary camera/render callbacks. There are no independent component clocks, requestAnimationFrame loops or hidden background timers. Pause freezes elapsed time and every pose field. Reset restores the explicitly configured initial level, initial counterweight position, closed panels, zero travel progress and zero traction rotation without project writes. View changes preserve runtime state; installation/configuration replacement creates a fresh controller. Suspended browser tabs may deliver a large elapsed tick on return, which is consumed deterministically; users should pause before backgrounding if they want time to stop.

## Pose and rigid attachments

The pose contains canonical world-metre `cabinY` (floor), `counterweightY` (centre), offsets from static layout references, traction rotation, cabin and active landing door progress, active landing ID, phase, direction, travel progress, four normalized suspension routes and the separate governor route.

Named moving groups translate cabin shell, sling, cabin guide shoes, safety gear/linkage and car hitches/terminations together. Each cabin entrance carries panels, fixed frame/sill/track, operator and coupling with the car. Counterweight frame, slab instances, shoes and its hitches/terminations share the inverse offset. Rails, buffers, machine/supports, governor, pit tension assembly, landing doors and machine brake remain fixed. No geometry layout or project coordinate is mutated.

## Counterweight and traction

The first supported runtime contract is the normalized explicit 1:1 route: car hitch → fixed traction wrap → counterweight hitch, with vertical endpoint spans and one fixed contact arc. The suspension ratio/reference identifies the inverse equal-displacement relationship; mass never participates. The separate visualization record explicitly defines the initial counterweight centre relative to the highest normalized landing. Its centre envelope is derived from supplied shaft bounds and complete frame/shoe/hitch bounds. Every served level is checked before simulation is enabled.

Other routes, including 2:1 moving-pulley systems, remain structurally representable in static geometry but are rejected by this first runtime adapter. No unprovided relationship is guessed.

Traction rotor angle is signed cabin displacement divided by the normalized explicit rope-contact radius. The sign follows supplied contact-route sweep. A small radial visual stroke makes rotation observable on the otherwise symmetric generic sheave. There is no slip, force, torque, rated-speed or motor calculation. Returning to the initial elevation/reset restores rotation to exact zero.

## Rope updates and resource lifetime

Each suspension lane preserves its ID, count, spacing, diameter, fixed traction contact and arc. Only its car and counterweight endpoints translate with their assemblies. The first/last straight segments are rebuilt as small normalized pose records; no tube geometry is regenerated per frame. The governor and pit tension arcs remain fixed; both line ends attached to the supplied linkage connection follow the car. No governor trip or rotation is implemented.

`DynamicCableMeshes` memoizes fixed arc tubes and one reusable unit cylinder per cable with a shared material. The renderer updates straight-span position, direction and length from analytic pose segments. It allocates no geometry/material per frame and disposes owned resources on replacement/unmount. Ropes remain untensioned geometric routing, not wire strands, elasticity or collision simulation.

## Door coordination

Panel translation interpolates the existing closed/open travel vectors. Hanger carriers/rollers, bottom guides and the supplied panel-side coupling share panel translation. Operator, tracks, entrance frame and generic interlock remain attached to their entrance. Only landings whose normalized level ID matches `activeLandingLevel` receive open progress; all other panels remain at zero. Front/rear cabin entrances and their corresponding served landing entrances follow the same cycle in the through-car demo. Independent entrance dispatch is deferred.

Between levels the active landing ID is absent and all door progress is zero. Exact level identity—not visual proximity—enables opening. This is a state-machine guard, not certified door-zone or electrical interlock logic. The operator belt and generic interlock mechanism remain static; no lock engagement or safety circuits are simulated.

## Development access and timing

Run `pnpm dev` and open `/dev/mechanical` directly or choose “Fahrdemo öffnen” from the development workspace controls. The compact viewport controls supply “Zielhaltestelle”, “Fahrt starten”, “Pause”, “Fortsetzen” and “Zurücksetzen”. The same route supports 2/6/10 stops and rear/left/right arrangements.

`src/dev/fixtures/passenger-simulation-demo.ts` wraps the existing mechanical fixture. Only this motion QA variant supplies 4000 mm synthetic headroom, an initial counterweight centre at highest landing + 1100 mm, and explicitly demo-classified durations: 2 s closing, 8 s travel for any selected trip, 0.4 s arrival, 2 s opening and 3 s dwell. These are synthetic test values, not standards, recommendations, manufacturer values or engineering performance. The larger demo headroom keeps the explicit moving suspension endpoints below the top wraps throughout travel; the existing static mechanical fixture remains unchanged.

Neither motion setup nor timing is inserted in project defaults or normal fixture loading. A normal/incomplete planning viewport reports unavailable visualization data. Route, setup, controls and German demo messages are excluded from production by `import.meta.env.DEV`; core rendering contracts remain reusable.

## Camera and performance

Travel does not change the camera installation key or request a reframe. Manual orbit, zoom and pan retain ownership. Explicit mode changes or camera reset can sample the current car/counterweight bounds for Mechanik/Schnittansicht; this sampling never runs continuously. Local views can naturally lose a moving assembly outside the fixed camera frustum until the user pans, changes mode or resets. Follow mode is absent.

The external controller exposes pose directly to the renderer and notifies UI subscribers on commands, level/phase changes or errors. Continuous ticks do not re-render the viewport or project. A stepping fault freezes further stepping until an accepted command/reset; rejected commands leave valid motion running. Structured errors are mapped to German controls. The project store contains no simulation state or Three references.

A small optional development-only “Bewegungsdaten” disclosure shows cabin floor, counterweight centre, travel/door progress and traction angle captured at the last phase/command notification. Its explicit label distinguishes a sampled inspector from a continuously updated instrument. Pause samples the exact frozen pose; it is useful for visual QA without frame-rate UI updates.

## Guards, verification and limitations

Tests cover the complete cycle, upward/downward exact arrival, normalized progress, inverse envelopes, finite pose, 2/6/10 stops, all counterweight arrangements, through-car door coordination, immutable planning inputs, route attachments, pause/resume/reset, invalid commands/timing/data, UI notification frequency and explicit camera-frame sampling. See [browser QA](../qa/passenger-kinematic-simulation.md).

The current guards enforce known coordinate/envelope/state relationships only. No full dynamic collision, pulley/hitch clearance engine, acceleration/jerk model, braking/traction/rope-force/motor/energy model, load-dependent movement, emergency stop, safety gear activation, governor trip, electrical controller dispatch, door obstruction/light curtain, multi-car control or EN 81 performance verification exists.
