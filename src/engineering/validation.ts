export const VALIDATION_STATES = [
  'not-checked',
  'incomplete',
  'valid',
  'invalid',
] as const

export type ValidationState = (typeof VALIDATION_STATES)[number]

export const VALIDATION_SEVERITIES = ['info', 'warning', 'error'] as const

export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number]

export interface ValidationIssue<Code extends string = string> {
  readonly code: Code
  readonly severity: ValidationSeverity
  readonly path?: readonly (string | number)[]
  readonly messageKey: string
  readonly context?: Readonly<Record<string, unknown>>
}

export interface TechnicalValidationResult<Code extends string = string> {
  readonly state: ValidationState
  readonly issues: readonly ValidationIssue<Code>[]
}
