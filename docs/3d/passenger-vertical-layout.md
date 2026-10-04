# Canonical passenger vertical layout

## Fixed-height defect and boundary

The installation previously regenerated levels/shaft extents but the synthetic drive and safety fixtures stored world Y coordinates for a two-stop installation. Increasing stops left the machine, supports, governor and rope contacts at those old heights; the governor then failed its headroom-region check. Cabin floor and safety-gear elevations also independently assumed Y=0. The correction changes data placement, not validation tolerances or React mesh offsets.

`PassengerInstallationModel.vertical`, created by the pure `passenger-vertical-model.ts`, is now the shared vertical reference source. Planning remains millimetres, normalized references/geometry remain metres. The installation, mechanical, drive, safety and door transforms run before React. Their immutable outputs and bounds regenerate whenever project input changes. Three.js never reads Zustand.

## References

| Normalized reference | Explicit input relationship |
| --- | --- |
| `landingElevations` | Uniform index × supplied storey height, or supplied ordered elevations |
| `lowestLandingY` / `highestLandingY` | First / last valid normalized landing |
| `travelRegion` | Lowest to highest landing-floor reference; not a permitted solid-body envelope |
| `pitBottomY` | Lowest landing minus supplied pit depth |
| `shaftTopY` | Highest landing plus supplied headroom |
| `headroomRegion` | Highest landing to shaft top |
| `topMechanicalY` | Shaft top minus explicit `mechanical.zones.topInsetMm` |
| `topMechanicalZone` | That mechanical reference to shaft top |
| `cabinLevelIndex` / `cabinElevationY` | Supplied zero-based current level index, resolved against normalized landings |

`topInsetMm` is a placement offset, not a required clearance. Missing headroom, pit or inset means the corresponding anchor is unavailable. An invalid inset is reported, not clamped. Existing zone `topOffsetMm`/`bottomOffsetMm` keep their previous region-boundary semantics; they do not replace physical shaft/pit limits in validation.

Uniform levels are deterministically ordered from the canonical lowest datum at zero. `levelElevationsMm` enables explicit ordered, finite, strictly increasing elevations, including an imported nonzero datum. Explicit elevations take precedence over uniform count/height. Duplicate/unordered lists and out-of-range current indexes are invalid. The current index does not silently clamp after a level is removed.

Without an explicit current index, the first known level is the static cabin reference. Progressive cabin-only geometry can still use the documented project datum before levels exist; that is not an invented landing. A supplied but unresolved index does not fall back to world Y=0. The complete development fixture explicitly supplies index zero. Door-view Haltestelle selection remains separate inspection state and never moves the cabin.

## Serializable semantic placements

`vertical-placement-data.ts` defines optional `verticalAnchor` on **world-placement points only**. With it, `yMm` is an explicit offset from `pit-bottom`, `lowest-landing`, `highest-landing`, `shaft-top`, `top-mechanical`, `cabin-floor` or `counterweight-center`. X/Z remain explicit world coordinates. Without it, all coordinates remain absolute: existing planning data is never reinterpreted. Local component boxes, wheel profiles and local attachment points remain local and do not accept these anchors.

`resolveVerticalRecord` resolves each independent serializable record against the installation references and, when needed, normalized counterweight centre. It retains provenance/references and removes placement metadata from the temporary absolute record consumed by existing geometry factories. Missing anchors return structured missing-data paths and omit only dependent equipment. The source record is not mutated. Referenced suspension equipment with an unresolved anchor makes that route incomplete, not a fabricated world-space rope.

The optional safety-gear `elevationAnchor` gives the same meaning to its explicit `elevationMm`; local linkage-point geometry remains local. Drive/safety schemas accept semantic placements on world origins, supports and world route points. Legacy schematic machine/sheave/polyline and buffer inputs also accept anchored world points. No manufacturer data or new engineering sizing rule is introduced.

## Assembly behavior

- Machine, traction/explicit deflection wheels, machine supports, governor and its upper supports resolve their supplied upper anchors. The demo uses shaft-top-relative mechanical inset plus explicit component offsets, so headroom changes move top equipment as well as stop/storey changes.
- Car/counterweight buffers, tension wheel and lower supports resolve pit-bottom offsets. Changing only stops leaves their normalized positions unchanged. Changing pit depth moves them with the pit floor.
- Cabin floor resolves its current level. Sling and shoes already follow its envelope; safety gears, linkage/clamp paths and car hitch now use explicit cabin-floor offsets. Cabin door/operator/sill geometry already follows the normalized cabin origin.
- Counterweight centre remains cabin centre plus the supplied `counterweightOffsetMm` vector. This is a static planning relationship, not real reciprocal travel, balance or mass calculation. Its hitch uses an explicit offset from that resolved centre; its frame/shoes continue to follow its envelope.
- Traction rope contacts are regenerated from resolved wheels and hitches; any explicit point node resolves its own anchor. Governor rope is regenerated from its resolved top wheel, pit wheel and cabin linkage. Existing tangent, finite, nonzero and known-solid checks remain active.
- Each landing door continues to use the exact normalized level elevation, independent of cabin position. Changing stops changes the number of independent landing assemblies; current-level changes move cabin equipment only.

Structural/spatial checks use canonical known shaft/pit limits rather than duplicate height computations or inset zone boundaries. The fixture's moving assemblies, top equipment, pit equipment and rope endpoints are covered by regression tests. These are construction checks, not permitted operating ranges or certification.

## Camera and development QA

Gesamtansicht and Schnittansicht retain aggregate installation/component/drive/safety/door bounds. Mechanik focuses the actual car/counterweight frames, shoes, buffers and local safety/door context, excluding long rail tails and distant top equipment from automatic fitting. Antrieb focuses top machine/supports/traction and deflection wheels/brake rather than forcing the entire suspension span into the frame. Sicherheit includes the complete governor loop, top governor, car linkage and pit tension assembly; taller shafts necessarily produce a taller full-loop view. Orbit/zoom remain available.

DEV-only `/dev/mechanical` adds a compact 2/6/10 stop selector for repeatable QA, not simulation control. Fixtures now store explicit semantic offsets, not a fixed installation-height snapshot. Sources remain `demo`; normal project creation/reset still supplies no fixture, inset, current-index or equipment dimensions. See [height reflow QA](../qa/passenger-height-reflow.md).

Automatic reframing preserves the camera's current orbit direction and moves the focus to the new bounds centre. Reusing the old world-space camera position relative to a new centre could otherwise create a steep upward view when switching from the car to a high top-drive assembly. Fitting/clipping still use the existing Bounds API and selected subsystem bounds; no installation-specific camera offsets are introduced.

## Limits

There is no lift animation, reciprocal counterweight motion, clearance selection, rope sizing, buffer sizing, speed/force/balance calculation or EN 81 rule. Absolute imported placements require an intentional adapter/authoring choice to become relative. A selected cabin level and supplied headroom/routing must be geometrically compatible; impossible layouts remain invalid rather than being adjusted to pass. Explicit level lists define the actual stop set and must be updated directly instead of changing the ignored uniform count.
