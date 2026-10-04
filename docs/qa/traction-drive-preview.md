# Generic traction-drive QA

Completed on 2026-10-04 against the local development app in Chrome.

- `pnpm test`: 79 tests across 7 files passed, including 17 drive-focused cases.
- `pnpm lint`: passed, including React/Three import restrictions on pure geometry modules.
- `pnpm build`: passed. The existing large Three.js chunk warning remains.
- Production assets contain neither demo control text nor fixture reference markers (`generic-qa`, `explicit-qa`, `Mechanische Demo`).
- A fresh normal workspace remained empty. Explicit demo load populated the fixture; reset restored a normal empty project and the initial viewport instruction.
- Gesamtansicht, Mechanik, Antrieb and Schnittansicht were inspected. Mode changes preserved mechanics and restored full framing outside Antrieb.
- Antrieb focused on the upper drive and frame attachment context. Orbit inspection showed a supported machine, aligned shaft/sheave, separate parallel rope lanes and separate car/counterweight connections. No obvious cabin-through routing or severe z-fighting was observed.
- Rear, left and right isolated fixture variants were inspected without layout alerts or browser errors.
- Chrome reported only the pre-existing dependency warning about deprecated `THREE.Clock`.

This is visual and geometry-construction QA of synthetic demo data. It is not mechanical verification, a collision certification, a rope selection, a compliant roping example or an engineering approval.
