# Explicit passenger mechanical layout

## Data boundary

The serializable mechanical planning contract and its structural Zod schema live in `src/elevator/configuration/passenger-mechanical-planning.ts`. Passenger configuration v2 now accepts an optional `mechanical` object and optional counterweight depth. This is an additive draft-schema extension; no persistence or migration layer exists yet. Default configuration factories supply none of these values.

Data flows through pure transformations before React rendering:

1. Passenger configuration in millimetres.
2. Normalized installation planning input and installation geometry in metres.
3. `createPassengerMechanicalLayout` creates optional mechanical subsystems, complete bounds, missing-field information, and structured spatial issues.
4. `createPassengerMechanicalComponents` combines that layout with explicit component data, producing render-neutral profile, shoe, member, slab and buffer geometry in metres.
5. `createTractionDriveModel` combines explicit `mechanical.drive` records with installation/layout/component envelopes to produce machine, sheave, hitch and ordered multi-rope geometry.
6. React Three Fiber renders these outputs without consulting Zustand or deriving placement rules.

Missing inputs omit only dependent subsystems. Invalid placement omits the affected subsystem and returns an issue with a code, path, severity, message key, and optional coordinates. A renderable cabin remains available independently of mechanical completeness.

## Explicit layout inputs

Cabin rails accept either two explicit plan positions or explicit spacing and an `x`/`z` orientation. The spacing mode means a pair symmetric about the cabin travel axis; an optional explicit `carRailAxisMm` shifts that axis. The canonical cabin axis is the project origin, not an assumed clearance. Explicit positions take precedence over spacing.

The frame uses the same rail axes. Its two uprights flank the cabin along the selected orientation; upper and lower cross-members connect them, and platform supports follow the cabin depth or width. A pair that does not surround the cabin or is not on a common transverse axis produces an error. Cabin dimensions are never enlarged to fit the frame. Without a usable explicit rail layout, frame and rails remain unavailable.

Counterweights require explicit width, height, depth, arrangement (`rear`, `left`, `right`), and a complete `counterweightOffsetMm`. This three-coordinate vector displaces the counterweight centre from the cabin centre. Its Y component is therefore a centre-to-centre displacement, not a bottom elevation. Unknown coordinates remain absent while being entered. Rear arrangements orient counterweight width along X; side arrangements orient width along Z. Exact placement comes from the offset; the arrangement identifies the intended side and is checked against that geometry.

Counterweight rails accept either two explicit plan positions or explicit spacing centred on the counterweight. Spacing is along its width axis. The pair must bracket the weight envelope and share its transverse plane. Neither system infers a rail spacing from a frame or weight width.

Buffers accept explicit base positions. Car and counterweight buffers remain separate. The pit and related assembly must exist; the base must lie in the pit and under that assembly's plan envelope. No buffer count or position is inferred.

Legacy machine envelopes and suspension polylines remain accepted as schematic planning records, but do not supply detailed drive geometry. Legacy machine envelopes are wire-only, and polylines remain pixel-width annotations, never dimensional ropes. The old sheave display-depth fallback has been removed. Detailed drive geometry requires the separate explicit contract below. Zones represent explicit pit and headroom regions with optional inward offsets.

The production form exposes only orientation/spacing, counterweight depth, counterweight rail spacing, and centre-offset coordinates under the collapsed German “Mechanische Anordnung” section. Advanced rail axes, individual buffers, machine/sheave, and routing remain data-contract inputs.

## Component dimensional sources

`mechanical-component-data.ts` defines serializable optional data under `mechanical.components`. Each component record requires a `source`: `planning` (explicit planning dimensions), `verified` (externally verified component data supplied by a caller), `demo` (synthetic development/test data), or `visualization` (display geometry only). An optional `reference` identifies the source. No verified component catalogue exists in this application. A source label is provenance, not approval; accepting a record never verifies it. Sources survive structural parsing and normalization and are not displayed in customer forms.

Placement and member spans still come from the existing planning/layout contract; cross-sections, shoe dimensions, buffer details, and slab count come from component records. The existing layout's `source: planning` describes its input boundary, not manufacturer provenance. Fixture placement values remain synthetic demo/test inputs. Drive records include their own dimensional and placement provenance. Pixel-width axis lines and material appearance are visualization-only.

No profile/member/shoe/buffer dimensions are automatically supplied to production projects. Missing detailed data preserves known rail axes, sling paths and counterweight envelopes as line/wire representations. Unavailable buffer shapes are omitted. The viewport reports incomplete component geometry without suppressing independent cabin/shaft or mechanical subsystems. Incompatible component dimensions produce structured `invalid-component-shape` issues. These are geometry-construction checks only.

## Generic T profile and orientation

`rail-profile.ts` creates a concave 12-vertex T-like section using explicit profile depth, flange width/thickness, web thickness and head width/thickness. Profile depth is the total cross-section depth, not vertical rail length. The head must be wider than the web; the flange/head thicknesses must leave a nonzero web. `rail-extrusion.ts` creates one continuous low-poly extruded prism for the normalized installation region. There is one implementation for both independent rail systems. Segments, joints and brackets remain future work.

The rail section uses local U across its flange and local V from the flange toward the moving assembly. The head tip lies at V=0, matching the existing planning rail/guide axis; the flange lies at V=-profileDepth. U maps to local X, V to local Z, and extrusion to +Y. Rotation about world Y aims +V inward toward the respective assembly. For an X pair the negative-side rail uses +π/2 and the positive-side rail -π/2; for a Z pair they use 0 and π respectively. Rail order does not control orientation. Cabin and counterweight transforms are independent.

## Sliding guide shoes

One reusable sliding-shoe model serves both systems using separate component records. A U-shaped housing, three liner strips, and a mounting plate surround the rail head at its axis. Supplied rail clearance and head dimensions define the open slot. Two shoes per rail are positioned using explicit lower/upper insets in the associated frame's vertical envelope. Cabin shoe mounting faces meet the car upright's outer face; counterweight shoes meet the outer counterweight side member. Inconsistent mounting offsets omit only that shoe system. `FutureGuideType` reserves `roller`; only `sliding` has geometry. No guide forces, wear, tolerances, or manufacturer matching are calculated.

## Car sling

The independent sling contains two open-channel uprights, a substantial upper crosshead, lower cross-member, and two platform beams. Explicit rail-to-upright offsets position the upright centres inward from the rail axes. Cross-sections and wall thickness are explicit component data. Uprights connect the lower and upper members; platform beams touch the lower member from below. Shoes include the mounting regions. Pure bounds checks reject a sling that enters the cabin interior. Cabin dimensions are never resized, and the existing schematic rail/frame planning paths are preserved.

## Counterweight frame and stack

The normalized counterweight envelope defines the outer assembly. Explicit side-member width, cross-member height, and channel wall thickness form its frame. The remaining internal region is recorded as `stackBounds`. Slab dimensions, count, spacing, and bottom inset are supplied independently. Every slab must fit inside that region; overflowing stacks are omitted rather than resized. The demo stack begins at the lower cross-member and uses small explicit visual separation between slabs. The separate counterweight guide shoes attach to this frame and its own rail pair. No mass or balance factor is inferred or displayed. The 1000-slab allocation guard is a rendering resource cap, not an engineering limit.

## Buffer components

One reusable component builds a base plate, body cylinder, exposed plunger and contact plate from explicit dimensions. All vertical sections meet consecutively above the supplied pit base. Car and counterweight buffers use separate data and separate positions; neither inherits the other's dimensions. Their parked distance from the moving assembly is inherited from the planning layout, not a stroke or contact calculation. No buffer selection, speed compatibility, energy, or certification calculation exists.

## Rendering and bounds

The technical materials use restrained metal, weight, liner, and plunger categories with PBR roughness/metalness. Profiles are memoized and shared for identical sections/lengths across rail systems, with one continuous mesh per rail. Structural/shoe boxes share unit geometry; the repeated slabs use one `InstancedMesh`. Geometry is disposed when its owner unmounts or parameters change. The viewport memoizes installation/layout/component transformations, so switching view modes does not rebuild profile geometry. The camera includes explicit detailed component extents as well as installation bounds.

## Traction drive contract and machine

`src/elevator/configuration/traction-drive-data.ts` owns the optional serializable `mechanical.drive` schema. Every machine, mount, sheave, hitch and suspension record requires the existing `planning | verified | demo | visualization` source classification and accepts a reference. Structural parsing preserves these sources. Normal configuration factories supply no drive record. Finite dimensions/coordinates and integer rope/groove counts are structural constraints, not equipment-selection rules.

`traction-drive-model.ts` is a pure, ESLint-guarded transform with no React, Three.js or Zustand imports. Machine housing, bearing-support region and base are explicit local boxes; motor and shaft are explicit axial cylinders. Origin and Y rotation constitute the mounting transform. Local +Y is up and local +Z is the shaft axis. The normalized model exposes the axis, housing/base bounds, separate parts and aggregate bounds. Section connectivity, machine/sheave shaft alignment and shaft/hub diameter agreement are geometry checks only. No brake, gearing, windings, nameplate or manufacturer shape is represented.

Mount supports are explicit world-space boxes, each with its own supplied transform. A connected support graph must touch the base from below and, when shaft dimensions exist, reach a supplied shaft wall plane. The demo has two wall-spanning beams and two pedestals, placed below/behind the sheave sweep. Missing or disconnected mounting omits the machine rather than leaving a solid floating box. This graph does not calculate beam strength, loads, anchors or bearing reactions.

## Reusable sheave coordinate system

`sheave-model.ts` prepares traction, deflection and future moving car/counterweight pulleys from the same explicit data: origin, Y rotation, outer diameter, width, hub diameter/width, shaft bore diameter and optional groove count/spacing/depth/width. The local circular plane is XY; the rotation/shaft axis is +Z. The outer mount transform remains separate from the rotor child, so later local Z rotation does not change placement.

The pure model supplies a closed radius/axial lathe section. `traction-geometry.ts` revolves it with 48 radial segments and aligns the result to local Z. Grooves are deliberately generic flat-bottom recesses, not certified traction groove profiles. Their axial centres are `(index - (count - 1) / 2) * explicit spacing`. Hub/shaft/rim relationships and non-overlapping grooves protect mesh construction. Ungrooved sheaves can render, but cannot provide dimensional rope contacts. Optional deflection pulleys are rendered only when explicit records exist; the demo contains none.

## Suspension routes, ratios and terminations

Suspension ratio, rope count, rope diameter, selected groove indices, ordered route and car/counterweight connection IDs must all be explicit before rope geometry exists. Rated load, capacity, speed and passenger count are not inputs to rope selection. Missing fields omit suspension independently of other geometry.

Routes consist of ordered `hitch`, `point` and `contact` nodes. Contacts identify a sheave and explicit entry/exit angles measured from local +X towards +Y; the signed angular difference defines the sweep. Normalized output retains analytic line/arc segments, ordered contact IDs, endpoint hitch IDs and low-resolution sampled positions for sanity checking. Each selected groove produces its own immutable rope path. All contacts must have that groove; no extra pulley or wrap direction is inferred.

The rope centreline radius is the explicit groove-floor radius plus half the explicit rope diameter: a geometric placement convention, not a pitch-diameter, traction or D/d calculation. Hitch and optional straight-point lane offsets follow their explicit mount axes. Tangency checks reject incompatible transitions and sharp unsupported point bends. They do not solve routing automatically. Rendering uses analytic lines/arcs rather than smoothing splines, avoiding overshoot through solids.

For `1:1`, the route starts at the explicit car hitch, contacts the traction sheave, and ends at the distinct counterweight hitch. For `2:1`, fixed endpoint hitches and explicitly identified moving car/counterweight sheaves must be present in the ordered contacts. A pure test supplies a complete synthetic 2:1 route. Neither ratio is a default, preference or kinematic simulation; no route is generated from the ratio alone.

Hitches classify attachments as `car`, `counterweight` or `fixed`; future termination kinds `wedge` and `socket` are typed but intentionally unsupported geometrically. Only `generic` creates the explicit plate and, when suspension lanes exist, separate cylindrical generic terminations. Anchor elevation and termination length must meet the supplied plate. Known car/counterweight frame bounds constrain their own hitch seats. This representation does not claim any particular termination technology or connection strength.

## Drive sanity checks and resources

Structured drive issues contain stable codes, paths, severity and message keys; German presentation messages are mapped in the viewport. Checks cover finite coordinates, positive supplied dimensions, integer counts, groove fit, duplicate IDs, missing references, zero-length sections, tangential continuity, support connectivity, machine/sheave axis agreement, and inclusion in known shaft/pit/headroom bounds. Segment clipping checks expanded rope-radius AABBs against cabin, counterweight, machine and support solids. These are conservative geometric checks, not full curved-surface collision, clearance, regulatory or engineering approval.

The `1e-9` comparison epsilon is only floating-point construction precision in metres, never a manufactured tolerance. Rope/groove allocation is capped at 64 solely as a browser-resource guard, not a technical limit. Rope meshes use six radial tube segments, one interval per straight section and 24 intervals per half-turn (26 longitudinal intervals in the demo). Rings coincide with line/contact boundaries; analytic tangents avoid corner distortion. Wire strands and helices are absent. Drive geometry is memoized across view changes, materials are shared across ropes/sheaves/cylinders, box geometry is reused, and owned geometry/materials are disposed on replacement/unmount.

Antrieb camera bounds are derived from drive extents plus the upper halves of the car/counterweight frames, retaining their connection context and excluding unrelated pit/rail tails. Halving is a camera-only framing policy, never a mechanical dimension or data change. Other modes restore installation/component/drive aggregate framing. No fixture-specific camera position is added.

## Spatial sanity and debugging

The pure transform checks finite coordinates, positive supplied dimensions, distinct rail axes, frame/cabin relationships, arrangement/offset consistency, counterweight/cabin overlap, buffer relationships, and inclusion in an explicitly known shaft envelope. No required clearance is added. Vertical shaft constraints are applied only when the corresponding pit or landing/headroom data are explicitly known; a partially visualized shaft does not establish a missing technical limit.

`validation.state` is `valid`, `incomplete`, or `invalid` for these geometric checks only. It does not mean engineering approval or full completeness of every optional subsystem. `getPassengerMechanicalDebugPositions` exposes sorted cabin rail paths, counterweight rail paths, frame/weight bounds, buffer positions, machine/sheave centres, full min/max/centre bounds, and structured issues without React.

## Development fixture

`src/dev/fixtures/passenger-mechanical-fixture.ts` defines a complete dataset for automated tests and browser inspection. `mechanical-demo-components.ts` adds explicit `source: demo` dimensions for profiles, independent cabin/counterweight shoes, sling, counterweight frame/slabs and independent buffers. All dimensions and coordinates in these files are synthetic demo/test values, not standards, recommendations, manufacturer specifications, or compliant examples. Rear/left/right variants exercise the placement model. The values never enter a new user project automatically.

`traction-drive-demo.ts` now adds synthetic machine sections, shaft/hub alignment, four mounting members, a four-groove sheave, separate generic car/counterweight hitches, and four 10 mm ropes with explicit 1:1 upper-half wrap. Rear and side variants explicitly supply their own axis, locations and sheave diameter (1156 mm rear, 1056 mm side), with 140 mm rim width, 240/190 mm hub diameter/width, 80 mm shaft bore, 24 mm groove spacing and 8/14 mm recess depth/width. These numbers are only visual-QA data and are not sizing recommendations. Both endpoint plates meet their supplied frame tops; no production field is filled by these factories.

In local development, the normal workspace exposes the compact controls “Demo-Mechanik laden” and “Demo zurücksetzen” in its header. Loading uses this fixture to replace the current in-memory project configuration; resetting creates a normal, empty project again. Both controls and their fixture import are guarded by `import.meta.env.DEV` and are excluded from production bundles. The separate `/dev/mechanical` route remains available for isolated fixture inspection without changing the project store.

## View policy and remaining scope

Mechanik hides shaft/pit surfaces, reduces landing opacity, makes cabin surfaces highly translucent, and reduces door edges along with door surfaces. Antrieb further reduces the shell while retaining the opaque frame/counterweight connection context and drive system. Rails, sling, weight frame/block, buffers, machine, sheave, and ropes remain opaque in a restrained neutral material hierarchy. Schnittansicht also retains mechanics. Shell resources are remounted on mode changes to reliably reset opaque/transparent shader state; the mechanical subtree remains mounted and shared geometry is retained. View modes do not alter planning data.

The geometry is recognizable generic planning equipment, not certified, EN 81-validated, structurally verified, or manufacturer-specific. Machine, grooves and terminations remain deliberately generic. Deferred systems include brakes/motor internals, real manufacturer equipment, wire strands/wear/tension/traction/D/d/balance calculations, compensation ropes/chains, governor/rope/tension pulley, safety gear/overspeed, rail brackets/joints, door operator, electrical internals, travelling cable, sensors, bolts/threads, animation/motion and EN 81 validation.
