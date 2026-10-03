import { z } from 'zod'
import {
  getLiftTypeDefinition,
  registeredLiftFamilySchema,
  type RegisteredLiftConfiguration,
} from './lift-type-registry'

export interface StructuralValidationIssue {
  readonly code: string
  readonly path: readonly (string | number)[]
  readonly messageKey: 'validation.configuration.invalid'
}

export interface StructuralValidationResult {
  readonly status: 'valid' | 'invalid'
  readonly configuration?: RegisteredLiftConfiguration
  readonly issues: readonly StructuralValidationIssue[]
}

const configurationIdentitySchema = z.object({
  family: registeredLiftFamilySchema,
  schemaVersion: z.string(),
})

function mapIssues(issues: readonly z.ZodIssue[]): StructuralValidationIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    path: issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number',
    ),
    messageKey: 'validation.configuration.invalid',
  }))
}

export function validateLiftConfiguration(
  input: unknown,
): StructuralValidationResult {
  const identity = configurationIdentitySchema.safeParse(input)

  if (!identity.success) {
    return {
      status: 'invalid',
      issues: mapIssues(identity.error.issues),
    }
  }

  const result = getLiftTypeDefinition(
    identity.data.family,
  ).configurationSchema.safeParse(input)

  if (!result.success) {
    return {
      status: 'invalid',
      issues: mapIssues(result.error.issues),
    }
  }

  return {
    status: 'valid',
    configuration: result.data,
    issues: [],
  }
}
