// Shared validation utilities for edge functions
// Provides input validation with length limits and type checking

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function validateString(
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; required?: boolean } = {}
): ValidationResult<string> {
  const { minLength = 0, maxLength = 50000, required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      return { success: false, error: `${fieldName} is required` };
    }
    return { success: true, data: '' };
  }

  if (typeof value !== 'string') {
    return { success: false, error: `${fieldName} must be a string` };
  }

  if (value.length < minLength) {
    return { success: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (value.length > maxLength) {
    return { success: false, error: `${fieldName} must be at most ${maxLength} characters` };
  }

  return { success: true, data: value };
}

export function validateArray<T>(
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; required?: boolean; itemValidator?: (item: unknown) => boolean } = {}
): ValidationResult<T[]> {
  const { minLength = 0, maxLength = 1000, required = true, itemValidator } = options;

  if (value === undefined || value === null) {
    if (required) {
      return { success: false, error: `${fieldName} is required` };
    }
    return { success: true, data: [] };
  }

  if (!Array.isArray(value)) {
    return { success: false, error: `${fieldName} must be an array` };
  }

  if (value.length < minLength) {
    return { success: false, error: `${fieldName} must have at least ${minLength} items` };
  }

  if (value.length > maxLength) {
    return { success: false, error: `${fieldName} must have at most ${maxLength} items` };
  }

  if (itemValidator) {
    for (let i = 0; i < value.length; i++) {
      if (!itemValidator(value[i])) {
        return { success: false, error: `${fieldName}[${i}] is invalid` };
      }
    }
  }

  return { success: true, data: value as T[] };
}

export function validateObject(
  value: unknown,
  fieldName: string,
  options: { required?: boolean } = {}
): ValidationResult<Record<string, unknown>> {
  const { required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      return { success: false, error: `${fieldName} is required` };
    }
    return { success: true, data: {} };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, error: `${fieldName} must be an object` };
  }

  return { success: true, data: value as Record<string, unknown> };
}

export function validateNumber(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number; required?: boolean } = {}
): ValidationResult<number> {
  const { min, max, required = true } = options;

  if (value === undefined || value === null) {
    if (required) {
      return { success: false, error: `${fieldName} is required` };
    }
    return { success: true, data: 0 };
  }

  if (typeof value !== 'number' || isNaN(value)) {
    return { success: false, error: `${fieldName} must be a number` };
  }

  if (min !== undefined && value < min) {
    return { success: false, error: `${fieldName} must be at least ${min}` };
  }

  if (max !== undefined && value > max) {
    return { success: false, error: `${fieldName} must be at most ${max}` };
  }

  return { success: true, data: value };
}

export function createValidationError(message: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
