# Passenger installation-height reflow QA

## Scope and provenance

This verifies the coordinate/layout correction, not lift operation or engineering approval. All fixture dimensions and offsets are synthetic `demo` data, not standards, recommendations, EN 81 limits or manufacturer specifications. Normal projects do not receive this fixture.

## Automated matrix

`passenger-vertical-model.test.ts` covers 2, 6 and 10 stops, each with rear/left/right counterweight arrangements and through-car landing doors. For every combination it checks ordered levels, shaft extent, semantic anchors, top drive/governor transforms, stable pit equipment, selected cabin reference, attached safety gear/linkage, counterweight envelope, door count/elevations, finite updated rope contacts, camera bounds, retained source classification and immutable inputs.

Additional regressions vary storey height, headroom and pit depth independently; move the current cabin to level index 1; supply explicit nonzero/uneven landing elevations; reject duplicate/unordered levels and invalid cabin selection; preserve legacy absolute placements; and omit only equipment whose semantic anchors are unavailable. Fractional millimetre placement offsets are compared in planning units rather than rounded normalized metres. Existing invalid geometry/route/support tests remain active.

Final commands: `pnpm test` (141 tests across 10 files), `pnpm lint`, `pnpm build`. The production build was searched for the demo controls, mechanical demo heading and DEV stop selector: no matches. The existing large Three.js chunk warning remains; it is not a build failure.

## Chrome visual inspection

Development URL: `/dev/mechanical`. The compact German DEV selector loads the same fixture pipeline with 2/6/10 stops. All twelve required views were inspected, with rear counterweight and front-only doors:

| Stops | Gesamtansicht | Mechanik | Antrieb | Sicherheit |
| --- | --- | --- | --- | --- |
| 2 | Full shaft/top/pit fitted | Car/frame/shoes/buffers/tension visible | Top machine/wheel/supports focused | Complete governor loop fitted |
| 6 | Six ordered landing assemblies; top equipment moved up | Same useful local assembly scale | Same useful top-drive scale/orbit direction | Extended governor loop fitted |
| 10 | Ten ordered landing assemblies; top equipment moved up | Same useful local assembly scale | Same useful top-drive scale/orbit direction | Full taller governor loop fitted |

The synthetic fixture's normalized height references were also asserted:

| Stops | Highest landing (m) | Shaft top (m) | Top mechanical anchor (m) | Machine origin (m) | Governor centre (m) | Pit bottom (m) |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 3 | 6 | 5 | 5.4 | 5.6 | -1.2 |
| 6 | 15 | 18 | 17 | 17.4 | 17.6 | -1.2 |
| 10 | 27 | 30 | 29 | 29.4 | 29.6 | -1.2 |

No false shaft/pit alert appeared in any required view. Car, sling, gears/linkage and counterweight remain together at the explicitly selected initial level. Traction spans and governor loop grow to their updated upper equipment. Overview and full-loop safety views necessarily become narrower at greater height; local mechanical and drive views do not inherit full-height rope/rail bounds. Rail tails and unrelated equipment may remain outside these local inspection frames, but are not removed from the model. Orbit/zoom remain available.

Browser console: no errors; only the existing upstream `THREE.Clock` deprecation warning. Screenshots of the ten-stop overview and focused drive were captured as local QA artifacts.

## Limits

No simulation/animation or reciprocal counterweight travel is implemented. Absolute imported coordinates remain absolute unless explicitly authored with semantic anchors. Changing a supplied current level can expose genuinely incompatible fixture routing/headroom; validation must continue reporting such geometry rather than moving equipment or inventing clearances. Explicit per-level elevations supersede the uniform count/height inputs. The fixture contains no deflection sheave; explicitly supplied deflection wheels use the same semantic placement contract.
