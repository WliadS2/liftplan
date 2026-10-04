# Static passenger door system

## Boundary and provenance

`passenger-door-data.ts` owns the optional serializable `doors` planning contract. Entrance, assembly, operator, coupling, interlock and drive-path records carry `planning | verified | demo | visualization` provenance and an optional reference. These labels describe supplied data, not approval. All manufactured dimensions, offsets and travel vectors are explicit millimetre inputs. New project factories supply no door-system records.

The pipeline is planning/component data → normalized installation → `createPassengerDoorSystem` → `PassengerDoorMeshes`. Installation establishes cabin openings, independent front/rear axes and normalized levels. The pure door transform converts through the shared unit module, assigns identities/metre-space transforms, and returns independent submodels, missing-data paths and structured validation issues. It has no React, Three.js or Zustand dependency. Missing assembly data leaves an opening outline, not invented leaves, sills or operators. Legacy installation `doorLeaves` descriptors remain for compatibility but no longer generate manufactured meshes.

## Cabin entrance and door types

A cabin record identifies its side and explicit horizontal entrance axis. Optional opening dimensions override the explicitly planned common opening dimensions; width/height must fit the unchanged cabin. The pure shell helper creates wall sections around the actual opening, not a colored rectangle. Existing shell thickness is visualization-only.

Assemblies supply type, panel count, thickness, two depth offsets and two travel vectors. Center-opening two-panel and side-opening two-panel types are supported; the latter requires an explicit left/right direction. Four-panel center opening and telescopic identifiers are reserved and report unsupported type rather than rendering two panels. There is no global equipment-type default.

Each supported leaf partitions half the explicit clear width. A supplied overlap extends that leaf width; without it, no overlap is added. Non-overlapping depth planes must be supplied when extended leaves would otherwise intersect. Height follows the explicit opening height. These are mesh-construction relationships, not engineering sizing rules. Jambs/header, track with mounts, carriers with panel connectors, optional rollers, sill and bottom guides are independent explicit geometry. Hangers/guides belong to their respective panel. Rollers are simplified cylinders, not detailed bearings.

## Landing doors and levels

A landing series explicitly references a cabin entrance and matching side. Its opening-plane separation is not a regulatory sill gap. Separate assemblies with unique identities are created at **each normalized level**, using the level ID and exact elevation. Supplied series data explicitly describes repeated equipment; optional level-ID overrides allow independent opening dimensions, separation, assembly, coupling and interlock. Unspecified opening dimensions reuse the referenced known cabin opening, not fabricated dimensions. No series means no fabricated landing equipment. Unknown/duplicate level overrides and invalid entrance references are reported.

Local X/Y define the entrance plane; local +Z points outward. Front entrances have Y rotation zero, rear entrances π. Cabin origins use their actual floor and shell face. Landing origins use the associated elevation and explicit outward displacement. Front/rear records and level overrides are independent; Durchlader does not require identical dimensions. No building wall thickness or masonry is inferred. Landing surfaces are visualization context, not door-position inputs.

## Operator

The optional cabin operator has an explicit transform relative to the opening top, local housing/parts/cylinders, optional generic pulleys and optional closed drive path. It is mounted above the opening, connected to its frame through supplied mounts, and retains its entrance identity. Shared wheel normalization/lathe geometry and low-level analytic cable segments are reused; traction/governor routing is not used as a door rule. Pulley contacts, finite geometry and tangent connections are checked. Invalid attachments are omitted with structured issues; unrelated geometry remains visible.

No technology or manufacturer is identified. Motor power, force, opening time, gearing and belt teeth are not calculated. The synthetic fixture supplies a motor/body placeholder, housing, mounts, hanger-drive links, shafts, two pulleys and an explicit closed belt-like path.

## Sills and guides

Cabin and landing sills have separate identities and independent width/depth/height/placement. Their top is at the entrance-floor plane and bodies extend below it. Explicit grooves are constructed as non-overlapping strips with recessed tops. Supplied guides must fit a groove and reach the corresponding panel bottom. No sill profile is inserted when absent.

Relationship metadata reports the signed separation of supplied sill envelopes along the access direction. This is descriptive geometry, **not** a minimum clearance rule or approval result. Demo spacing is synthetic, never a required gap.

## Coupling and interlocks

Cabin coupling and landing receiver are separate records/meshes, each with panel index, local boxes/cylinders and an interface point. Parts must connect to their referenced panel and contain the interface point within their bounds. Relationship metadata records axis correspondence and whether points coincide **if** the cabin were at that level. This predictive transform is metadata only: it never moves/duplicates the actual cabin and does not simulate engagement or clearance.

A generic interlock belongs to its landing entrance and level. Its explicit above-opening mount, body, optional lever and roller are normalized independently and checked for frame connection. This is not a certified lock, proof of secure engagement, electrical contact or safety-chain implementation. Attachment connectivity uses conservative bounding-box checks, not contact mechanics.

## Views, inspection and resources

The six controls are Gesamtansicht, Mechanik, Antrieb, Sicherheit, Türen and Schnittansicht. Türen keeps the chosen-side cabin system and selected landing system opaque, greatly reduces other doors and shell/levels, hides shaft/pit surfaces and other mechanical systems, and retains contextual outlines. Schnittansicht makes panels translucent while retaining components. Restrained materials distinguish panels, frame, sill, operator, coupling and interlock without branding/textures.

The compact Haltestelle selector resolves IDs against normalized levels. Durchlader additionally offers Zugang: Vorn/Hinten. Selection is view-local, not business state. At the cabin's real level the camera frames both systems; higher stops frame only that landing entrance and show a German explanation that the cabin stays at its original position. Bounds changes trigger existing fitting; no six-stop coordinates or cabin movement are introduced. Stale selections fall back to the first available level/side.

Identical boxes share unit geometry, simplified cylinders share unit geometry, and identical wheel profiles share cached geometry. Materials are shared by role/opacity; resources are disposed on replacement/unmount. Visibility changes do not rebuild geometry. Instancing remains a future optimization.

## Future animation contract

Every leaf exposes identity, closed transform, open transform and normalized world-space travel. Open position is closed position plus **explicit** local travel rotated into the entrance frame. Rendering uses the closed transform only. No animation, timing, forces, mass, nudging, obstruction detection, light curtain, electrical chain, certified interlock, fire rating, manufacturer-specific mechanism, travelling cable, cabinet, cabin movement, collision simulation or EN 81 validation is implemented.

## Development data and tests

`src/dev/fixtures/passenger-door-demo.ts` is the sole source of complete synthetic demo door dimensions; React contains no fixture dimensions. The mechanical fixture explicitly composes it, with separate front/rear records when requested. DEV-only workspace load/reset and `/dev/mechanical` consume it. Production creation/reset remain empty; production bundles exclude fixture markers/controls.

Pure tests cover types, dimensions, provenance, separate leaves/deterministic travel, mounting/malformed geometry, level counts/identities/overrides, independent sills/couplings/interlocks, through-car dimensions, defaults, visibility and selected-floor bounds. Browser observations appear in [door visual QA](../qa/passenger-door-preview.md). These checks protect data/scene construction, not engineering approval or operating interference assessment.
