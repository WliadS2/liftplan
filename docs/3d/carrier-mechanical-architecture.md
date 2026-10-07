# Goods and Auto carrier mechanics

## Explicit data boundary

Both independent family configurations accept optional `CarrierMechanicalPlanning`. Structural schemas preserve unit-aware millimetres and dimensional provenance (`planning`, `verified`, `demo`, `visualization`). Production factories provide no mechanical data. Older v1 configurations remain valid: this is an additive optional contract, not a record-version change. The existing persistence boundary serializes planning data; no repository or file-export code changed.

`normalizeCarrierMechanics` takes only the normalized usable platform, shaft and guide-axis inputs plus explicit section data. It has no Passenger installation, React, Three.js, Zustand or simulation dependency. Each resulting part has a stable ID, attachment, provenance and millimetre AABB. Goods and Car retain independent engineering models and adapt these parts at their existing scene unit-conversion boundary.

| Part | Data and datum | Attachment |
| --- | --- | --- |
| Floor | Explicit thickness, existing platform footprint; top at usable floor | Moving |
| Carrier frame | Explicit orientation, spacing and four member sections; below floor/above usable height | Moving |
| Rails | Existing explicit axes plus explicit rectangular width/depth, declared shaft vertical bounds | Fixed |
| Shoes | Explicit section and upper/lower insets, existing guide axes | Moving |
| Buffers | Explicit X/Z and three explicit section boxes, base at declared pit floor | Fixed |

These are generic planning envelopes, not manufacturer rail profiles, shoe contact mechanisms, buffer technologies or certified parts. No dimensions come from load, speed or assumed clearances. Missing dependencies omit only dependent parts and yield structured `UNKNOWN` rule information. Invalid components do not hide the remaining normalizable scene.

## Spatial safety

The new family-specific `*.carrier.explicit-components` rules consume the pure shared component validator. They check construction issues, shaft containment, moving-section swept containment, usable-platform intrusion and actual fixed-component penetration. Existing family rules are unchanged. Boundary contact is not positive penetration; no tolerance or regulatory margin is added. Shoe/rail housing envelope interaction is exempt only for the declared guide relationship, not for buffers or other fixed obstacles. Explicit conflicts block carrier playback; missing optional sections do not fabricate unavailable equipment.

## Rendering and doors

Dedicated family assemblies still materialize their own scene contract. Shared technical materials make floor/frame/rails/shoes/buffers readable solids. The explicit floor replaces the coplanar schematic floor only in render policies, leaving usable planning bounds untouched. Vehicle geometry remains its declared body envelope, contacts, axles, wheelbase/track and overhang references; no invented tire/body dimensions are introduced.

`carrier-door-model.ts` derives side/role/landing identities and clear opening dimensions from scene openings. `carrier-door-display.ts` isolates the small visual-only frame, sill, track and leaf thicknesses in metres. They never enter engineering, collision, drawing or export models. Jambs/header are outside the usable opening. Two sliding leaves and a full-travel track are schematic visualization, not an engineering door selection. Every configured landing retains its own structures and leaf motion nodes.

## Motion and camera ownership

`CarrierSimulationDriver` advances exactly one controller and applies pure named-node transforms. Carrier frame/floor/shoes/platform doors and Goods loads or Car vehicle/reference geometry share one moving parent. Rails, buffers, shaft and landing structures are fixed; Car building-side approach references remain fixed. Only leaf motion nodes at the served landing receive door offsets. Door animation uses the existing separate visual timing profile, while vertical timing remains distance / declared nominal speed.

Local semantic camera follow retains manual orbit/pan/zoom and performs no per-frame fit. Door inspection selects the current landing using phase-boundary controller notifications and frames it locally; this view-only selection does not remove other landing geometry from the scene model. Gesamtansicht and Schnittansicht now frame the full installation with no carrier tracking. Goods Führungssystem follows the carrier/shoes with nearby rail context. See [installation/detail camera QA](../qa/installation-camera-qa.md).

## Deliberate exclusions

No traction machine, ropes, counterweight, hydraulic actuator, safety gear, real door operator/interlock or vehicle dynamics were added. No manufacturer models, regulatory limits, structural sizing, buffer performance or certification claims were introduced. The synthetic DEV sections are isolated in `carrier-mechanical-demo.ts`; no normal new project receives them. Drawings/PDF/DXF, Passenger implementations and frontend styling are unchanged.
