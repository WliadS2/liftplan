# Static passenger door visual QA

Inspected locally in Chrome on 2026-10-04. This is synthetic development geometry, not certification, a clearance assessment or an operating simulation.

## Reproduce

1. Run `pnpm dev`; load “Demo-Mechanik laden” in the normal workspace or open DEV-only `/dev/mechanical`.
2. Inspect Gesamtansicht, Türen and Schnittansicht. Orbit around both sides of the entrance; closed panels naturally obscure parts behind them. Allow automatic fitting to settle after a mode/selection change.
3. In Türen select Haltestelle 1, then 2. The second landing door is framed at its fixed upper elevation; the cabin/operator remain at their real base position, as the German notice explains.
4. On the isolated route enable “Durchlader (Entwicklungsdaten)” and inspect Zugang Vorn/Hinten at both levels. Front and rear have independent equipment records. This option is development-only.
5. Reset a workspace demo with “Demo zurücksetzen”; no door-system data remains in the normal project.

## Observations

- Gesamtansicht frames the full installation, with separate fixed door assemblies at both supplied levels. Through-car adds a second system on the rear face without moving the cabin.
- Türen frames the selected level/access and reduces the shell, other doors and unrelated mechanics. Changing the stop updates camera focus; no six-stop framing assumption is present.
- Base-level inspection shows distinct cabin/landing panel planes, independent frames/sills and an above-entrance cabin operator. Orbit views expose their depth separation. Closed panels can conceal coupling, track and roller details depending on the angle; no exploded view or door opening is implemented.
- Upper-floor inspection shows its own landing panels, sill, track, receiver/interlock rather than a moved cabin or copied operator. The actual cabin system remains below the focused region.
- Rear entrance selection correctly emphasizes the rear system while the front system becomes faint contextual geometry. Both selected levels render without door-validation alerts.
- Schnittansicht keeps door equipment and mechanics while reducing panel opacity and obstructing shell surfaces.
- No severe z-fighting or obvious detached door assembly was observed in the inspected views. Pure mounting/association tests additionally check conservative attachment bounds, distinct panel volumes, separate sill envelopes and coupling interface metadata. Neither visual inspection nor those checks establish interference-free operation.
- No new browser console errors were observed. The existing dependency warning about deprecated `THREE.Clock` remains.
- In the normal workspace, explicit demo loading populated the complete door fixture and retained structural validity. Reset returned every planning field to the normal empty project and the viewport to its German empty-state message, without console errors.

## Automated checks

The pure door suite covers two distinct leaves, explicit width/height/thickness, opening types/reserved types, deterministic open/closed transforms, normalized level counts/elevations/identities, per-level changes, operator mounting, independent sills/couplings/interlocks, front/rear dimensions, all four source classifications, malformed/finite/non-zero geometry, default/reset isolation, Türen visibility and selected-floor camera bounds. Shared pulley/path geometry is checked for finite vertices. No screenshot tests were added.

`pnpm test` passes 126 tests across nine files; `pnpm lint` and `pnpm build` pass. Production JavaScript was searched for development controls and unique door-fixture markers: none were present. The existing large-chunk advisory remains. Engineering calculations, automatic animation, movement and certification remain deferred; see [door architecture](../3d/passenger-door-architecture.md).
