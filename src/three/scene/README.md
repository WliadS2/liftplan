# Scene

React Three Fiber scene composition and scene lifecycle code belong here. Scene code consumes prepared geometry and read-only domain outputs.

`LiftFamilyViewport` is the family dispatch boundary. It preserves the established passenger viewport and routes available Waren-/Lastenaufzug technical models to `GoodsLiftViewport`; unsupported families return an explicit unavailable state. Family view modes, render models, and camera targets stay inside their dedicated renderer instead of accumulating in one conditional scene.
