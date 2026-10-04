# Application architecture

## Architectural intent

LiftPlan separates product presentation, domain configuration, engineering truth, rendering, and infrastructure concerns. The application composition root wires modules together; leaf modules do not reach back into React or application state.

## Modules

| Module | Responsibility | May depend on |
| --- | --- | --- |
| `src/lib` | Small domain-independent utilities | No LiftPlan feature module |
| `src/engineering` | Units and shared engineering/validation contracts | `lib` |
| `src/elevator/types` | Stable lift-family identifiers and common types | `lib` |
| `src/elevator/models` | Family-neutral configuration models | `elevator/types`, `engineering` |
| `src/elevator/configuration` | Contracts and future family registration | `elevator/models`, `elevator/types`, `engineering` |
| `src/elevator/rules` | Family-specific technical rule implementations | Elevator models and engineering contracts |
| `src/elevator/calculations` | Pure family-specific calculations | Elevator models, approved rules, and engineering units |
| `src/collision` | Pure collision models and queries | Engineering and geometry-neutral domain inputs |
| `src/simulation` | Pure kinematic runtime state, stepping and pose contracts | Engineering units and read-only render-neutral installation/layout contracts; no rendering runtime or project store |
| `src/three` | Three.js scene, visual geometry, assets, materials, camera, and interaction | Read-only domain outputs and explicit unit conversion |
| `src/projects` | Project use cases and future persistence ports | Elevator public contracts |
| `src/documents` | Export models and future document generation | Project and domain read models |
| `src/features` | UI-facing use-case orchestration and state adapters | Public domain and project APIs |
| `src/components` | Reusable presentation components | UI contracts; no engineering implementation |
| `src/pages` | Page composition and customer-facing copy | Features and components |
| `src/app` | Composition root and application shell | All public module APIs as needed for wiring |

## Dependency direction

Dependencies point inward toward stable contracts and pure domain logic. Presentation may consume already-computed results, but React components must not calculate technical values or decide technical validity. Three.js consumes geometry configuration and engineering dimensions only through explicit adapters; it is not the source of engineering truth.

Family-specific code implements the shared lift-type contract. Shared modules must not switch on one family and embed that family's behavior into the platform. Until a public API is intentionally defined for a module, its internals are not a cross-module contract.

ESLint guardrails prevent presentation modules from importing technical implementation folders and keep core technical modules independent from React and Three.js runtime types. These checks complement code review; they do not replace the dependency rules in this document.

## State and side effects

Zustand may hold application and feature state, but it must not become a container for hidden engineering logic. Zod schemas validate data shape at trust boundaries; technical validity is a separate structured result.

The current project store owns one in-memory `LiftPlanProject`. It delegates creation, family changes, and configuration replacement to pure project functions. Store state contains serializable project data and structural validation output only; it does not contain React refs, Three.js objects, scene state, or technical calculations.

## Lift-family registry

`src/elevator/configuration/lift-type-registry.ts` is the single registry for currently selectable lift families. A definition supplies its stable ID, German customer-facing display metadata, implementation status, configuration schema, default draft configuration, UI section descriptors, and references to future engineering and geometry modules.

The Personenaufzug definition is currently available as a planning-input draft. The remaining registered families are explicitly marked `coming-soon` and use a deliberately empty placeholder configuration. Adding a family means adding one definition and its family-owned schema rather than changing application-wide switches.

## Configuration and 3D boundary

Configuration schemas are structural only. They validate data types, finite numeric input, and the family/schema identity; they do not approve an installation or encode engineering limits. The validation adapter returns stable codes, paths, and message keys for German presentation code.

`src/three/geometry/lift-geometry-planning-input.ts` converts a structurally valid family configuration into a normalized, render-neutral planning input. The passenger adapter groups explicit cabin, shaft, level, and counterweight planning values while preserving their unit-aware millimetre types. Its level contract supports both the current uniform storey height and future explicit per-level elevations.

`src/three/geometry/passenger/passenger-installation-model.ts` is the pure boundary between planning data and render-space installation geometry. It reports `empty`, `partial`, `complete`, or `invalid` without reaching into React or Zustand, performs all millimetre-to-metre conversion through the engineering unit module, and produces a lightweight scene model. Cabin, door, shaft, level, and pit submodels are created independently when their explicit inputs are sufficient, so missing data does not suppress unrelated geometry. Counterweight placement belongs to the mechanical transform and no longer uses a shaft-boundary fallback.

`src/three/geometry/passenger/mechanical/passenger-mechanical-layout.ts` is the next pure boundary. It combines read-only planning input and normalized installation geometry into an explicit mechanical layout with structured geometric sanity issues, missing inputs, and full bounds/debug positions. The optional mechanical planning schema is domain-owned and serializable, including rail axes/spacing, weight offset/depth, buffers, machine/sheave, and routing. Optional component records classify dimensional provenance as planning, verified, demo, or visualization. `mechanical-component-model.ts` creates normalized T profiles, sliding shoes, frame members, weight slabs and buffers from those explicit records and layout paths. Detailed shapes have no production defaults. React Three Fiber components consume these models and build/shared-render meshes; they do not select engineering dimensions or inspect application state. Development fixture controls and `/dev/mechanical` remain guarded by `import.meta.env.DEV` and excluded from production bundles.

The current scene is a schematic planning visualization, not an engineering approval result. Renderability checks protect geometry construction but do not claim regulatory compliance, certified clearances, structural suitability, or installation approval.

The optional `mechanical.drive` contract is domain-owned in `traction-drive-data.ts`. A separate pure `traction-drive-model.ts` normalizes explicit machine/mount/sheave/hitch/suspension data, retaining provenance and ordered analytic rope segments. Reusable Three factories materialize the sheave lathe and independent rope tubes; React only binds meshes. Drive camera bounds are also pure. Ratios, rope count/diameter and routing never come from rated load or defaults. See the [mechanical architecture](../3d/passenger-mechanical-architecture.md) for coordinates, 1:1/2:1 contracts and geometric-check limitations.

The optional `mechanical.safety` contract in `passenger-safety-data.ts` is separately normalized by pure `passenger-safety-model.ts` after installation/layout/component models. Governor, its separate closed rope loop, pit tension assembly, car-rail-associated safety gears and explicit linkage do not depend on traction suspension. The optional machine brake consumes only the normalized machine attachment/shaft contract. The shared rotational-wheel schema/model and cable geometry factory are low-level reuse, not shared equipment-selection logic. All safety dimensions/placements/provenance are explicit; missing subsystems remain unavailable. Sicherheit visibility and camera bounds are presentation policies over normalized geometry. No safety calculation, certification rule, automatic component selection or production demo default is introduced.

The optional `doors` contract in `passenger-door-data.ts` supplies independent cabin entrances and explicit landing series with per-level overrides. The pure `passenger-door-model.ts` transforms installation openings/levels into static panels, frames, sills, tracks, operators, coupling and generic interlocks, retaining provenance and structured construction issues. React binds shared geometry/materials only. Türen selection and bounds are view-local; no cabin movement or store dependency enters the renderer. See [door architecture](../3d/passenger-door-architecture.md) for types, animation-ready transforms and deliberate engineering exclusions.

`passenger-vertical-model.ts` supplies the canonical installation vertical references and immutable semantic-placement resolution. Optional explicit level elevations/current cabin index are domain configuration; optional world-point anchors are serialized with component data. Mechanical/drive/safety transforms resolve these against installation geometry before using their existing factories. Missing anchors remain structured missing data; validation continues using physical shaft/pit bounds. No coordinate correction is implemented in React. See [vertical layout](../3d/passenger-vertical-layout.md).

Future database, authentication, file storage, or network services belong behind ports owned by the relevant domain module. Infrastructure adapters may depend on those ports. Domain modules must not depend on a backend SDK.

## Passenger kinematic visualization

Normalized installation/layout output feeds `src/simulation/passenger-simulation-model.ts`. The adapter exposes structured cabin, door, counterweight, traction, suspension and governor capabilities: valid levels, cabin geometry and a travel envelope enable the fundamental cabin movement, while absent optional subsystem geometry disables only that subsystem. `passenger-simulation.ts` owns the deterministic state machine, elapsed-time stepping, guards and pose. `passenger-motion-bindings.ts` supplies render-neutral attachment offsets. None of these modules accesses React, Three.js objects or the project store. Render-neutral type imports from the existing pure geometry models are the current input contract; geometry factories are not called while stepping.

The viewport creates a local external simulation controller whenever the normalized project meets the fundamental cabin-movement requirements. One `PassengerSimulationDriver` advances that controller and applies only the capabilities present in its pose. Compact viewport controls subscribe to phase/command notifications; the development build additionally exposes sampled motion data. Runtime motion never writes planning configuration or pushes frame updates through Zustand. `PASSENGER_VISUALIZATION_TIMING` is a built-in screen-animation profile and is not persisted or exported as project data. `/dev/mechanical` continues to supply its separate, richer motion fixture and demo timing; production excludes that route and fixture. See [simulation architecture](../3d/passenger-kinematic-simulation.md).

## Ownership

Codex owns the domain, engineering, validation, calculation, rendering, geometry, collision, simulation, and technical integration layers. Gemini may implement and polish the visual frontend against their public contracts, but must not rewrite their internals.
