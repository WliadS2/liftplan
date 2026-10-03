# LiftPlan

LiftPlan is the technical foundation for a professional browser-based lift planning and configuration platform. Customer-facing application copy is German; source code and technical documentation are English.

The current repository intentionally contains architecture and contracts rather than product features or engineering rules. See:

- [`AGENTS.md`](AGENTS.md) for permanent development rules;
- [`docs/product/vision.md`](docs/product/vision.md) for product scope;
- [`docs/architecture/application.md`](docs/architecture/application.md) for module boundaries;
- [`docs/qa/definition-of-done.md`](docs/qa/definition-of-done.md) for completion criteria.

## Commands

```sh
pnpm dev
pnpm lint
pnpm build
```

## Current boundaries

- `src/app`, `src/pages`, `src/components`, and `src/features` own application composition and presentation.
- `src/elevator` owns multi-family configuration contracts and future family implementations.
- `src/engineering` owns units and technical validation contracts.
- `src/three`, `src/collision`, and `src/simulation` own technical visualization and behavior.
- `src/projects` and `src/documents` are prepared for future use cases and ports; no backend is present.
