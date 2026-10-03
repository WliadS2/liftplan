# Unit conventions

## Canonical engineering units

LiftPlan stores and calculates engineering values in the following units unless an approved domain specification introduces an explicit alternative:

- dimensions and distances: millimetres (`mm`);
- mass and load values: kilograms (`kg`);
- duration: seconds (`s`);
- speed: metres per second (`m/s`) where appropriate.

A property name or type must make its unit unambiguous. Raw, unitless numbers must not cross an engineering module boundary.

## Three.js units

One Three.js world unit equals one metre. Engineering dimensions remain in millimetres until they cross the rendering boundary. Conversion must use the functions exported by `src/engineering/units.ts`; inline division or multiplication in rendering components is not allowed.

## Conversion rules

- Convert only at explicit system boundaries.
- Do not repeatedly convert values back and forth inside a calculation.
- Preserve the canonical engineering value as the source of truth; render-space values are derived.
- Parsing, formatting, and locale display are separate from unit conversion.
- Rounding and tolerances require an approved engineering rule. Do not introduce them as convenience behavior.
