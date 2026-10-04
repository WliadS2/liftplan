# Passenger safety geometry visual QA

Checked locally in Chrome on 2026-10-04 using the DEV-only mechanical fixture. This records visual QA of synthetic geometry, not a safety assessment or engineering approval.

## Reproduce

1. Run `pnpm dev` and open the normal workspace.
2. Choose “Demo-Mechanik laden”, then “Sicherheit”. Alternatively use the existing DEV-only `/dev/mechanical` route without changing the project store.
3. Inspect Gesamtansicht, Mechanik, Antrieb, Sicherheit and Schnittansicht. Orbit and zoom for component details; allow automatic framing to finish after mode/fixture changes.
4. On the isolated route, select Hinten, Links and Rechts to inspect independent traction arrangements with the same separate governor loop.
5. “Demo zurücksetzen” in the workspace restores a normal empty project; no mechanical or safety dimensions remain.

## Observations

- Gesamtansicht retains the full shaft/cabin/mechanical context, including the top governor and pit tension assembly.
- Mechanik reduces the shell and exposes both rail systems, sling, suspension and separate safety components.
- Antrieb frames the normalized drive and supplied brake with upper-frame context. The brake surface shares the machine shaft axis and has its own connected mount/body/arm geometry. The pit is intentionally outside this drive-focused frame.
- Sicherheit keeps the car rails, sling, governor, separate thin governor loop, generic rail-associated gears, linkage, tension assembly and brake. Counterweight and traction rope meshes are hidden. Bounds-derived framing includes the upper and lower safety assemblies and intermediate gear/linkage context.
- Schnittansicht retains safety/mechanical parts while removing the obstructing right cabin/front sections and reducing ceiling/doors/shaft surfaces.
- Orbit inspection showed the governor base/support reaching the front shaft wall, the tension frame/device seated on the pit floor, the closed two-wheel route connected to the under-frame linkage, and the two gears at separate rail/platform-support mounting regions. No obvious unrelated crossing or severe z-fighting was observed in the inspected views. This does not establish interference-free operation.
- The rear/left/right variants rendered without safety validation alerts. The separate governor loop does not inherit traction suspension routing.
- The normal workspace starts empty; explicit demo load/reset worked and retained German UI copy. No new browser console errors were observed. The existing dependency warning about deprecated `THREE.Clock` remains.

## Automated coverage and production isolation

The focused pure safety suite covers all three demo variants, traction independence, finite/non-degenerate wheels, explicit rope data, closed route/contact identities, structural and normalized finite/zero/positive checks, cabin-solid clipping, connected mount/pit relationships, separate rail-aligned frame-mounted gears (X and Z pairs), deterministic linkage, optional machine brake attachment, all four source classifications, empty production creation/reset, safety visibility and complete safety camera bounds. Existing project/development-session tests also round-trip the extended fixture through Zustand and reset it.

`pnpm test`, `pnpm lint` and `pnpm build` pass. Production assets are checked for the development controls and unique governor/safety fixture markers; none are included. The existing Vite large-chunk advisory remains. Detailed manufacturer mechanisms, safety engineering, motion and certification remain out of scope; see the [mechanical contract](../3d/passenger-mechanical-architecture.md).
