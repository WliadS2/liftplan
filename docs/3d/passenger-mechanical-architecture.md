# Passenger mechanical visualization architecture

## Scope and data flow

The passenger mechanical layer is a schematic planning visualization. It does not represent a certified, EN 81-validated, structurally verified, or manufacturer-specific installation.

The dependency chain is deliberately one-way:

1. `PassengerGeometryPlanningInput` carries optional millimetre-based planning values.
2. `createPassengerInstallationModel` creates normalized installation geometry in metres.
3. `createPassengerMechanicalLayout` combines those two read-only inputs into a normalized, React-independent mechanical layout.
4. `PassengerMechanicalAssembly` and its child renderers display that layout without reading Zustand or deriving engineering rules.

This keeps rope routing, component placement, and future mechanical rules testable outside React and Three.js. Missing data removes only the affected subsystem.

## Planning-driven and schematic geometry

Mechanical layout values are classified explicitly:

- `planning` identifies a dimension or position supplied by project planning data.
- `schematic` identifies a derived visual relationship that is useful for orientation but is not an engineering placement or dimension.

Counterweight width and height are planning-driven. Its current plan position is schematic because `rear`, `left`, or `right` defines an arrangement side, not an exact coordinate. The layout therefore exposes `dimensionsSource: planning` and `placementSource: schematic` separately.

The car frame, fallback rail positions, and fallback buffer positions are schematic. They communicate subsystem relationships without claiming certified spacing or component selection. Explicit future rail and buffer coordinates replace the schematic positions and are marked as planning-driven.

Small member thicknesses, counterweight depth, buffer display size, and sheave display depth live in `mechanical-visualization.ts`. These constants only make simplified shapes visible. They are never returned as technical data, used by validation, or presented as manufactured dimensions.

## Subsystems

### Car frame

The layout follows the explicit cabin envelope without changing it. The renderer adds upper and lower cross-members and vertical sling members as a recognizable schematic frame. Frame geometry remains separate from the cabin shell.

### Rail systems

Cabin and counterweight rails are separate typed systems with independent IDs, sources, and paths. Rails extend through the known shaft vertical extent, or through the cabin height when that is the only usable extent. Current rails are line placeholders, not T profiles. Schematic positions do not represent approved rail spacing.

### Counterweight

The counterweight assembly separates a schematic frame from a visible weight-mass placeholder. Its arrangement is the explicit `rear`, `left`, or `right` planning state. No counterweight mass, cabin-weight relationship, or balance factor is calculated.

### Buffers

Car and counterweight buffers are independent systems. They appear only when a pit and the related cabin or counterweight context exist. Without explicit coordinates, their single fallback marker is schematic and does not represent buffer count, selection, capacity, stroke, or approved placement.

### Machine and sheave

The traction-machine placeholder requires both an explicit position and explicit envelope. The traction sheave requires an explicit position and diameter. Partial input produces no component. Neither shape identifies a construction type or manufacturer.

### Suspension path

Suspension planning is separate from line rendering. A path is created only when an explicit `1:1` or `2:1` arrangement and at least two explicit path points are present. The line does not represent individual ropes and carries no rope diameter or rope count.

### Mechanical zones

The lower zone reflects an explicit pit volume. The upper zone requires explicit headroom and a known highest landing. Optional offsets are represented in the planning contract for future data sources. These zones are spatial planning regions, not safety clearances.

## View modes

The typed view-mode catalog prepares `Gesamtansicht`, `Kabine`, `Schacht`, `Mechanik`, `Türen`, `Antrieb`, `Schnittansicht`, and `Explosionsansicht`. Only Gesamtansicht, Mechanik, and Schnittansicht are currently selectable.

Mechanik makes cabin and shaft surfaces translucent while keeping rails, frame, counterweight, buffers, and any explicitly available machine or suspension elements prominent. Schnittansicht removes the obstructing cabin and shaft surfaces but leaves mechanical components visible. The view mode changes presentation only; it never mutates installation or mechanical geometry.

## Intentionally non-engineered

The current layer has no real rail profiles, guide shoes, detailed traction machine, brakes, governor, safety gear, realistic ropes, rope-count or diameter calculation, counterweight mass or balance calculation, structural loads, collision detection, movement simulation, door movement, CAD imports, fasteners, manufacturer-specific components, or EN 81 validation.

