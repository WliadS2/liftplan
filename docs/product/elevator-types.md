# Planned lift families

LiftPlan uses stable internal family identifiers and keeps family-specific behavior behind a common definition contract. Inclusion in this list describes product scope only; it does not imply that a family is implemented or that technical rules are known.

## Initial families

- **Personenaufzug** (`passenger`): lifts configured for transporting people.
- **Warenaufzug / Lastenaufzug** (`goods`): lifts configured around the transport of goods or loads. Product and regulatory distinctions must be confirmed before family-specific rules are implemented.
- **Autoaufzug** (`car`): lifts configured for transporting vehicles.
- **Kleingüteraufzug** (`small-goods`): lifts configured for smaller goods. No dimensional classification is encoded yet.
- **Bettenaufzug** (`hospital-bed`): lifts whose configuration must account for bed transport workflows.
- **Homelift** (`home`): lifts intended for the home-lift product family.
- **Plattformlift** (`platform`): platform-based lift systems.

## Later families

- **Schwerlastaufzug** (`heavy-duty`): reserved for a future heavy-load family.
- **Spezialaufzug** (`special`): reserved for installations whose requirements do not fit a standard family.

## Extension model

Each implemented family will provide its own:

- configuration schema and explicitly approved defaults;
- technical validation rules;
- engineering calculations;
- geometry configuration mapping;
- supported load types;
- UI section descriptors.

Shared application, project, document, rendering, and utility modules must remain family-agnostic. A family must not infer technical values from another family merely to satisfy the common contract.
