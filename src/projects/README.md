# Projects

Project use cases and persistence ports belong here. Browser-local storage is implemented through the `ProjectRepository` port with an IndexedDB adapter; no backend dependency is present.

The persisted `planningData` is the serializable editable input draft, including temporarily structurally invalid states. `project.configuration` remains the last structurally valid value consumed by engineering, 3D, drawing, PDF, and DXF adapters. Derived output is never stored.

Storage schema version `1` is parsed through the explicit migration boundary before load. `.liftplan.json` files use the same strict project record plus optional immutable version snapshots. Unknown fields and unsupported schema versions fail explicitly instead of being discarded. The development Mechanical Demo is ephemeral and is not autosaved.
