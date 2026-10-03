# Explicit passenger mechanical layout

## Data boundary

The serializable mechanical planning contract and its structural Zod schema live in `src/elevator/configuration/passenger-mechanical-planning.ts`. Passenger configuration v2 now accepts an optional `mechanical` object and optional counterweight depth. This is an additive draft-schema extension; no persistence or migration layer exists yet. Default configuration factories supply none of these values.

Data flows through pure transformations before React rendering:

1. Passenger configuration in millimetres.
2. Normalized installation planning input and installation geometry in metres.
3. `createPassengerMechanicalLayout` creates optional mechanical subsystems, complete bounds, missing-field information, and structured spatial issues.
4. React Three Fiber renders the normalized layout without consulting Zustand or deriving placement rules.

Missing inputs omit only dependent subsystems. Invalid placement omits the affected subsystem and returns an issue with a code, path, severity, message key, and optional coordinates. A renderable cabin remains available independently of mechanical completeness.

## Explicit layout inputs

Cabin rails accept either two explicit plan positions or explicit spacing and an `x`/`z` orientation. The spacing mode means a pair symmetric about the cabin travel axis; an optional explicit `carRailAxisMm` shifts that axis. The canonical cabin axis is the project origin, not an assumed clearance. Explicit positions take precedence over spacing.

The frame uses the same rail axes. Its two uprights flank the cabin along the selected orientation; upper and lower cross-members connect them, and platform supports follow the cabin depth or width. A pair that does not surround the cabin or is not on a common transverse axis produces an error. Cabin dimensions are never enlarged to fit the frame. Without a usable explicit rail layout, frame and rails remain unavailable.

Counterweights require explicit width, height, depth, arrangement (`rear`, `left`, `right`), and a complete `counterweightOffsetMm`. This three-coordinate vector displaces the counterweight centre from the cabin centre. Its Y component is therefore a centre-to-centre displacement, not a bottom elevation. Unknown coordinates remain absent while being entered. Rear arrangements orient counterweight width along X; side arrangements orient width along Z. Exact placement comes from the offset; the arrangement identifies the intended side and is checked against that geometry.

Counterweight rails accept either two explicit plan positions or explicit spacing centred on the counterweight. Spacing is along its width axis. The pair must bracket the weight envelope and share its transverse plane. Neither system infers a rail spacing from a frame or weight width.

Buffers accept explicit base positions. Car and counterweight buffers remain separate. The pit and related assembly must exist; the base must lie in the pit and under that assembly's plan envelope. No buffer count or position is inferred.

Machines require an explicit centre and width/height/depth envelope. Sheaves require an explicit centre and diameter; the schematic disc lies in the XY plane. Suspension requires an explicit `1:1` or `2:1` state and ordered path points. These inputs do not select a machine, calculate ropes, or prove an actual roping arrangement. Zones represent explicit pit and headroom regions with optional inward offsets.

The production form exposes only orientation/spacing, counterweight depth, counterweight rail spacing, and centre-offset coordinates under the collapsed German “Mechanische Anordnung” section. Advanced rail axes, individual buffers, machine/sheave, and routing remain data-contract inputs.

## Visualization constants

`mechanical-visualization.ts` contains only rail display thickness, frame member thickness, buffer display radius/height, and sheave display thickness. These control readability, never planning positions. Counterweight depth is now explicit planning data; the earlier visual counterweight-depth constant and fallback placements have been removed.

Frame member display thickness extends outward from the normalized boundary paths and above/below the cabin. It is not a manufactured cross-section or an engineering clearance. Buffer cylinders are markers anchored at explicit base positions; their display size is not a selected buffer's capacity or stroke. Sanity validation uses normalized planning envelopes/axes only, excluding display thicknesses. The camera uses complete normalized installation/mechanical bounds with a visual margin.

## Spatial sanity and debugging

The pure transform checks finite coordinates, positive supplied dimensions, distinct rail axes, frame/cabin relationships, arrangement/offset consistency, counterweight/cabin overlap, buffer relationships, and inclusion in an explicitly known shaft envelope. No required clearance is added. Vertical shaft constraints are applied only when the corresponding pit or landing/headroom data are explicitly known; a partially visualized shaft does not establish a missing technical limit.

`validation.state` is `valid`, `incomplete`, or `invalid` for these geometric checks only. It does not mean engineering approval or full completeness of every optional subsystem. `getPassengerMechanicalDebugPositions` exposes sorted cabin rail paths, counterweight rail paths, frame/weight bounds, buffer positions, machine/sheave centres, full min/max/centre bounds, and structured issues without React.

## Development fixture

`src/dev/fixtures/passenger-mechanical-fixture.ts` defines a complete schematic dataset for automated tests and browser inspection. All dimensions and coordinates in that file are synthetic demo/test values, not standards, recommendations, manufacturer specifications, or compliant examples. Its rear/left/right variants exercise the placement model. The values never enter a new user project automatically.

Run `pnpm dev`, then open `/dev/mechanical` to inspect the fixture in Gesamtansicht, Mechanik, and Schnittansicht. The preview reads local fixture data directly and does not change the project store. Its dynamic import is guarded by `import.meta.env.DEV`; the fixture and preview are excluded from production bundles.

## View policy and remaining scope

Mechanik hides shaft/pit surfaces, reduces landing opacity, makes cabin surfaces highly translucent, and reduces door edges along with door surfaces. Rails, sling, weight frame/block, buffers, machine, sheave, and routing remain opaque in a restrained neutral material hierarchy. Schnittansicht also retains mechanics. View modes do not alter planning data.

This is a schematic planning layer, not a certified, EN 81-validated, structurally verified, or manufacturer-specific installation. Deferred systems include real rail profiles, guide shoes, brackets/joints, detailed weights/buffers/machines, brakes, governor, safety gear, realistic ropes, rope count/diameter, mass/balance/load calculation, CAD imports, fasteners, collision simulation, movement, and certification rules.
