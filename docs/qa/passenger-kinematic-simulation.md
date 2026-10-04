# Passenger kinematic visualization QA

Date: 2026-10-04. Chrome, local `/dev/mechanical`, explicit synthetic simulation fixture. No screenshot assertions were added to the test suite.

## Automated verification

`pnpm test`: 12 files, 173 tests passed. Existing domain/geometry/camera tests remain green. Pure simulation tests cover the exact cycle, invalid transitions/levels/timing/envelopes, open-door travel rejection, positive/negative travel, canonical exact arrival after partitioned ticks, 0..1 progress, inverse counterweight travel, finite pose, all arrangements, rope endpoints/fixed contacts, door attachments/current landing isolation, pause/resume/reset, command rejection without motion interruption, clock-fault freezing/reset, immutable project/default data, bounded UI notifications and explicit camera sampling. Regression coverage adds cabin-only normal projects, panel animation without operator geometry, complete capability data, structured incomplete requirements, optional-subsystem degradation, playback-profile isolation, and normal 2/6/10-stop up/down travel. `pnpm lint` and `pnpm build` passed. Production assets contain the normal simulation controls but no sampled development inspector or synthetic fixture markers. The existing large Three.js chunk warning remains.

## Chrome observations

| Scenario | Observed result |
| --- | --- |
| 2 stops, 1 → 2 | Departure closing precedes travel; car rises and counterweight descends; top traction rotor stroke rotates; rope connections remain attached |
| 2 stops, doors at level 2 | Exact arrival; cabin/selected landing panels open together, carriers/guides follow panels; level 1 remains closed |
| 2 stops, 2 → 1 | Inverse return movement; doors open at lowest landing and upper landing remains closed |
| 6 stops, 1 → 6 | Paused moving state resumes; cabin and selected landing doors align/open at level 6 |
| 10 stops, paused ascent | Inspector captured cabin floor 9.254 m, counterweight centre 18.846 m, travel 34.3%, doors 0%, rotor −16.095 rad |
| 10 stops, top arrival | Exact cabin floor 27.000 m, counterweight centre 1.100 m, travel 100%, doors 100%, rotor −46.957 rad |
| 10 stops, paused descent | Cabin floor 17.778 m and counterweight centre 10.322 m; opposite displacement, closed panels, finite coordinates |
| 10 stops, lower arrival/reset | Lower arrival resolves exactly to 0.000 m, counterweight to 28.100 m, rotor to 0.000 rad; reset returns idle with doors/travel progress zero |
| Pause | Repeated paused screenshots were byte-identical; no car, rope, rotor or door motion |
| Resume | Continues the same cycle/target and opens only after arrival |
| View changes during travel | Gesamtansicht, Mechanik, Antrieb, Sicherheit, Türen and Schnittansicht render the same centralized runtime; Antrieb retains close fixed-drive framing |
| Camera ownership | Manual orbit during a 10-stop trip stays Y-up and does not snap back on ordinary ticks; local modes sample runtime pose only on explicit framing events |
| Normal project, incomplete | Opens with absent planning dimensions and no fixture values; precise missing level/cabin/travel information is shown; no simulation setup is inserted into project state |
| Normal project, six stops | Entered cabin, shaft, floor-height, pit and headroom planning data manually; “Fahrdemo teilweise verfügbar.” appeared; controls listed stops 1–6; travel completed 1→6 and 6→1 while mechanical/drive/door details remained absent |
| Progressive capability UI | Missing counterweight, door, traction, suspension and governor functions remain in the collapsed “Fehlende Teilfunktionen” disclosure and do not block cabin movement |
| Full development fixture | `/dev/mechanical` reports “Fahrdemo verfügbar.”; start, pause, resume and exact arrival remain operational with the complete mechanical visualization |

Exact numeric readings above are synthetic fixture observations, not engineering values. High trip speed on a 10-stop fixture follows its explicit eight-second visual duration, independent of rated project speed. At endpoints the current car and counterweight are far apart, so a mode framing both must show a tall region. Local inspection does not automatically follow the moving car.

Console: no introduced errors/warnings. The existing upstream `THREE.Clock` deprecation warning remains. Proof screenshot: `/private/tmp/liftplan-kinematic-10-doors.png`, showing top-level aligned/open doors and the sampled normalized pose.

## Limits of this QA

Pure tests establish exact identities, coordinates and attachment offsets; browser inspection establishes visible coordinated motion. Neither proves clearance, interference-free operation, dynamics, certified door zones or engineering compliance. The supported runtime is the explicit vertical 1:1 fixed-wrap demo route; other routes return structured unsupported-data results. Background-tab elapsed time is not a certified real-time clock.
