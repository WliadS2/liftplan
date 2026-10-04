# Technical validation

## Purpose

Data-shape validation and technical validation are separate concerns. Zod schemas can establish that configuration data has the expected structure. Technical validators determine whether a sufficiently complete configuration satisfies approved rules.

The configuration boundary provides structural validation with stable issue codes, paths, and presentation message keys. The passenger mechanical transform additionally returns local construction sanity results. The spatial-validation layer composes the normalized installation, mechanical, door, drive, safety, and simulation-envelope models into cross-system geometric checks. These checks use only supplied geometry, add no required clearances, and do not represent certification or load verification. An `ok` spatial state means the available geometric checks passed, not engineering approval.

## Result model

Technical validation returns a structured `TechnicalValidationResult` rather than a boolean or customer-facing sentence. The result contains:

- a state: `not-checked`, `incomplete`, `valid`, or `invalid`;
- a list of issues;
- a stable machine-readable issue code;
- severity: `info`, `warning`, or `error`;
- an optional configuration path;
- a message key for German presentation copy;
- optional structured context that does not contain preformatted UI text.

This allows the UI, exports, and future APIs to present the same decision consistently without embedding engineering logic in those consumers.

## Rule requirements

- Every rule must cite or be traceable to an approved source before implementation.
- Missing information produces an explicit incomplete state; it must not trigger invented fallback values.
- Validators should be deterministic and side-effect free.
- Validation issues should identify the affected configuration path when possible.
- UI code translates message keys into German and must not reinterpret the technical outcome.
- Warnings do not silently become errors, and errors do not silently become warnings.

No certified technical rules are defined in the current foundation. The implemented spatial rules are geometric or structural planning checks only; see [Spatial validation](spatial-validation.md).
