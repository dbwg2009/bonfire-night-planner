// Minimal JSON Schema subset used for MCP tool/prompt inputs, plus a validator
// for exactly that subset. Keeping it hand-rolled avoids pulling zod + the MCP
// SDK into the Pages Functions bundle.

export interface JsonSchema {
  type?: string | string[]
  description?: string
  enum?: readonly (string | number | null)[]
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
}

// ─── Builders ──────────────────────────────────────────────────────────────────

export const s = {
  str: (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'string', description, ...extra }),
  num: (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'number', description, ...extra }),
  int: (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'integer', description, ...extra }),
  bool: (description: string): JsonSchema => ({ type: 'boolean', description }),
  enum: (values: readonly string[], description: string): JsonSchema => ({ type: 'string', enum: values, description }),
  arr: (items: JsonSchema, description: string): JsonSchema => ({ type: 'array', items, description }),
  nullable: (schema: JsonSchema): JsonSchema => ({
    ...schema,
    type: [...(Array.isArray(schema.type) ? schema.type : [schema.type ?? 'string']), 'null'],
    ...(schema.enum ? { enum: [...schema.enum, null] } : {})
  }),
  obj: (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
    type: 'object', properties, required, additionalProperties: false
  }),
  date: (description: string) => s.str(description, { pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  time: (description: string) => s.str(description, { pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$' })
}

// ─── Validator ─────────────────────────────────────────────────────────────────

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function matchesType(v: unknown, type: string): boolean {
  const t = typeOf(v)
  return t === type || (type === 'number' && t === 'integer')
}

// Returns a list of human-readable problems; empty means valid.
export function validate(value: unknown, schema: JsonSchema, path = 'arguments'): string[] {
  const errors: string[] = []
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some(t => matchesType(value, t))) {
      return [`${path} must be ${types.join(' or ')}`]
    }
  }
  if (schema.enum && !schema.enum.includes(value as string | number | null)) {
    errors.push(`${path} must be one of: ${schema.enum.map(e => JSON.stringify(e)).join(', ')}`)
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} must be at least ${schema.minLength} characters`)
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} must be at most ${schema.maxLength} characters`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path} has an invalid format (expected ${schema.pattern})`)
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be ≥ ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be ≤ ${schema.maximum}`)
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validate(item, schema.items!, `${path}[${i}]`)))
  }
  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (obj[key] === undefined) errors.push(`${path}.${key} is required`)
    }
    for (const [key, v] of Object.entries(obj)) {
      const prop = schema.properties?.[key]
      if (!prop) {
        if (schema.additionalProperties === false) errors.push(`${path}.${key} is not a recognised field`)
        continue
      }
      if (v !== undefined) errors.push(...validate(v, prop, `${path}.${key}`))
    }
  }
  return errors
}
