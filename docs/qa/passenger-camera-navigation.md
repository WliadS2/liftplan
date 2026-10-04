# Passenger camera navigation QA

## Automated verification

`camera-fit.test.ts` verifies tall/narrow and short/wide perspective fitting, narrow viewport behavior, semantic targets for Gesamtansicht/Antrieb/Sicherheit/Türen, subsystem bounds isolation, installation-scaled distance limits, user ownership, meaningful reframe events, explicit reset behavior, canonical direction, Y-up and inversion-safe polar limits.

The camera modules are render-neutral except for `AutoFitCamera`, which performs the imperative camera/OrbitControls update. No elevator geometry or normalized vertical-layout transform is changed.

## Chrome matrix

The development fixture was inspected at 2, 6 and 10 stops in Gesamtansicht, Mechanik, Antrieb, Sicherheit, Türen and Schnittansicht.

- Every Gesamtansicht completed a full horizontal orbit, moderate upper/lower inspection, zoom-in and zoom-out without roll or loss of the installation.
- Mechanik remained focused on the current cabin/frame/counterweight region at every height.
- Antrieb retained the same useful upper-system scale at every height.
- Sicherheit framed the governor-to-tension route around its semantic endpoint midpoint.
- Türen stayed close to the selected landing; uppermost levels 2, 6 and 10 were selected and reframed independently.
- Schnittansicht remained focused on the current cabin region rather than inheriting full-shaft bounds.
- After manual orbit and no data change, repeated observations retained the user camera. Stop-count changes produced one canonical reframe. Reset restored the current mode's canonical framing.

No browser error was observed. The existing upstream `THREE.Clock` deprecation warning remains unrelated to this change.
