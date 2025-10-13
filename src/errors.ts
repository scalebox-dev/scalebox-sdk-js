/**
 * Error classes for Scalebox SDK
 */

export class ScaleboxError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message)
    this.name = 'ScaleboxError'
  }
}

export class SandboxError extends ScaleboxError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details)
    this.name = 'SandboxError'
  }
}

export class CodeInterpreterError extends ScaleboxError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details)
    this.name = 'CodeInterpreterError'
  }
}

export class InvalidArgumentError extends ScaleboxError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details)
    this.name = 'InvalidArgumentError'
  }
}

export class NotFoundError extends ScaleboxError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details)
    this.name = 'NotFoundError'
  }
}

export class NotEnoughSpaceError extends ScaleboxError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details)
    this.name = 'NotEnoughSpaceError'
  }
}

export class AuthenticationError extends ScaleboxError {
  constructor(message: string, code?: string, details?: any) {
    super(message, code, details)
    this.name = 'AuthenticationError'
  }
}

/**
 * Format sandbox timeout error message
 */
export function formatSandboxTimeoutError(timeout: number): string {
  return `Sandbox operation timed out after ${timeout}ms`
}