# LiftPlan development rules

These rules apply to the entire repository.

## Language

- All customer-facing application copy must be German.
- Source code, identifiers, comments, commit messages, and technical documentation must be English.
- Treat `docs/product/terminology-de.md` as the source of truth for German product terminology.

## Product and engineering integrity

- Do not add runtime AI services, AI SDKs, AI API keys, or dependencies on OpenAI, Gemini, Claude, or similar systems.
- Never fabricate engineering dimensions, loads, tolerances, standards, formulas, defaults, or safety rules. Missing technical facts must remain explicit and unresolved until an authoritative source is provided.
- Engineering calculations and technical validation must not live in React presentation components.
- Store engineering dimensions in millimetres. The Three.js world uses metres, where one Three.js unit equals one metre.
- Perform unit conversion explicitly through the shared engineering unit module.
- Reuse existing components, contracts, and APIs instead of duplicating logic.

## Ownership boundaries

- Codex owns architecture, engineering, calculations, technical validation, Three.js, parametric geometry, collision, simulation, persistence architecture, and technical integration.
- Gemini primarily owns visual frontend implementation: layout, responsive design, typography, navigation, forms, dashboards, micro-interactions, and visual polish.
- Gemini must not rewrite core Three.js, engineering, calculation, validation, collision, or simulation code.
- Presentation code may display domain results and dispatch user intent, but it must not implement engineering decisions.

## Scope and completion

- Keep changes scoped. Do not modify unrelated subsystems during a focused task.
- Do not add backend or persistence implementations until their work is explicitly requested.
- Run `pnpm lint` and `pnpm build` before considering work complete.
- A change is complete only when it respects the architecture boundaries and the checklist in `docs/qa/definition-of-done.md`.
