# Product vision

## What LiftPlan is

LiftPlan is a professional browser-based platform for planning and configuring lift installations. It is intended to provide one shared product foundation for multiple lift families while allowing each family to supply its own configuration, validation, calculation, geometry, load-type, and user-interface requirements.

The platform is expected to support project work, technical configuration, visual inspection in 3D, and document generation as those capabilities are introduced in explicitly scoped phases.

## What LiftPlan is not

LiftPlan is not currently a certified engineering tool, a source of regulatory truth, a manufacturing system, or a replacement for qualified technical review. No engineering value is valid merely because it appears in the software.

The present codebase is an architectural foundation. It does not yet provide detailed lift geometry, real engineering formulas, collision decisions, mechanical simulation, persistence, authentication, requests for quotation, or production documents.

## Product principles

- Support multiple lift families through shared platform contracts and family-specific implementations.
- Keep engineering truth independent from presentation and rendering.
- Make technical assumptions and unresolved inputs visible rather than silently inventing defaults.
- Keep the customer-facing product in German while maintaining code and technical documentation in English.
- Add capability in verifiable increments without coupling the product to a specific backend or vendor.
