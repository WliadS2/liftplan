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
| `src/simulation` | Mechanical simulation models and orchestration | Engineering, calculations, and collision contracts |
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

Future database, authentication, file storage, or network services belong behind ports owned by the relevant domain module. Infrastructure adapters may depend on those ports. Domain modules must not depend on a backend SDK.

## Ownership

Codex owns the domain, engineering, validation, calculation, rendering, geometry, collision, simulation, and technical integration layers. Gemini may implement and polish the visual frontend against their public contracts, but must not rewrite their internals.
