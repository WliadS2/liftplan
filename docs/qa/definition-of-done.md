# Definition of done

A scoped change is complete only when all applicable statements are true:

- TypeScript compilation passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- No browser console error or warning was introduced in the affected flow.
- Customer-facing copy is German and no accidental English UI string was introduced.
- No engineering value, formula, tolerance, standard, or technical default was fabricated.
- Engineering calculations and validation remain outside presentation components.
- Dimensions remain in millimetres in engineering code and convert explicitly to metres at the Three.js boundary.
- Module and ownership boundaries described in `docs/architecture/application.md` are respected.
- Existing APIs and components are reused where appropriate; equivalent logic is not duplicated.
- Tests are added or updated when the changed behavior can be meaningfully verified at the current project stage.
- Documentation is updated when a contract, boundary, convention, or product term changes.
- The change is limited to the requested scope and does not modify unrelated subsystems.
- Deferred work and unresolved source data remain explicit.
