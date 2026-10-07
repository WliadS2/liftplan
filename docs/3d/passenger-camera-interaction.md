# Passenger CAD camera interaction

## Ownership and framing events

Camera state is local to the Three.js viewport; it is not project/domain state and is not stored in Zustand. `AutoFitCamera` owns one OrbitControls instance and records whether the latest action belongs to automatic framing or the user. Starting orbit, pan or zoom transfers ownership to the user. Ordinary React renders then do not alter camera position, target, zoom or orientation.

Automatic framing is requested only for initial scene availability, view-mode changes, normalized installation-bound changes, selected door changes, viewport-size changes and the explicit reset button. Numeric cabin, installation and subsystem bounds are represented by the installation key so dimension edits and loading/clearing explicit mechanical demo data get an appropriate frame. Runtime floor/target changes do not change this key. Door-selection events apply only to Türen, not Gesamtansicht.

## Coordinate and orientation contract

The camera always uses world up `(0, 1, 0)`. Automatic/reset framing uses a normalized three-quarter direction, but computes its world-space position from the semantic target and required perspective distance. OrbitControls rotates the camera; elevator transforms remain aligned to the canonical world coordinates.

Polar angles are limited to 8–92% of π. This permits useful top and pit inspection while excluding the Y-up singularities and inverted camera states. Azimuth is unrestricted. Reset reapplies the canonical direction, Y-up vector, target, projection planes and distance limits for the current mode.

Orbit tuning is intentionally restrained: damping `0.075`, rotation `0.72`, zoom `0.9`, pan `0.8`. Rotation, zoom and pan remain enabled.

## Semantic targets and bounds

| Mode | Orbit target | Fit bounds |
| --- | --- | --- |
| Gesamtansicht | Full installation bounds centre, fixed during travel | Complete normalized installation and represented systems, including pit and headroom |
| Mechanik | Moving cabin/car-sling/shoe/door assembly centre | Local car assembly; long fixed rails and pit parts do not force a tower fit |
| Antrieb | Mean of machine, traction/deflection wheels, supports and brake | Same upper drive subsystem |
| Sicherheit | Midpoint of governor and pit tension assemblies | Explicit governor/safety route and car sling context |
| Türen | Explicitly selected landing, otherwise the served landing; cabin fallback | Selected landing plus cabin-door inspection extents aligned to that floor for framing only |
| Schnittansicht | Complete installation centre, fixed during travel | Vertical sectional overview of the installation |

No target contains fixture coordinates. Missing optional systems fall back to the available normalized bounds.

Only Mechanik uses rigid runtime camera/target translation. User orbit, zoom and pan relationships survive that translation; no frame-by-frame fitting occurs. Gesamtansicht and Schnittansicht have zero follow offset. The shared family-specific policy and Chrome acceptance checks are documented in [installation/detail camera QA](../qa/installation-camera-qa.md).

## Responsive fit and clipping

`calculateCameraFit` projects all eight AABB corners onto the canonical camera's horizontal and vertical screen axes. It derives the required distance from the actual vertical FOV and viewport aspect ratio, with one small proportional framing margin. A narrow viewport therefore expands distance based on horizontal fit; a wide viewport remains vertically fitted without a fixed oversized multiplier. Semantic targets may differ from bounds centres, and the projection accounts for that offset.

Minimum distance derives from the smallest positive framed dimension so a tall Gesamtansicht can still zoom toward local detail. Maximum distance scales with fitted distance and bounds diagonal. Near/far planes scale with the same frame rather than using one global extreme range.

## Limitations

There are no stored camera bookmarks, orthographic projections, named front/side/top presets, keyboard navigation or animated transitions. Safety framing must show a route that physically spans governor to pit tension and therefore remains vertically extensive. Panning can intentionally move the semantic pivot until the next meaningful frame or reset.
