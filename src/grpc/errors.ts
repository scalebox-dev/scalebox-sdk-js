/**
 * gRPC Error Utilities
 * 
 * Provides helper functions for identifying and handling Connect RPC errors.
 * These utilities make it easier to handle specific error conditions in a type-safe way.
 * 
 * Connect RPC uses standard gRPC error codes (Code enum) for error classification:
 * - DeadlineExceeded: Request timeout
 * - Canceled: Request was canceled
 * - NotFound: Resource not found
 * - Unauthenticated: Authentication required
 * - PermissionDenied: Access denied
 * - ResourceExhausted: Rate limit or quota exceeded
 * - InvalidArgument: Invalid request parameters
 * - Unavailable: Service temporarily unavailable
 * - Aborted: Operation aborted (usually retryable)
 * 
 * Usage:
 * ```typescript
 * try {
 *   await api.filesystem.stat({ path: '/file.txt' });
 * } catch (err) {
 *   if (isGrpcNotFoundError(err)) {
 *     console.log('File not found');
 *   } else if (isGrpcAuthError(err)) {
 *     console.log('Authentication required');
 *   } else if (isGrpcRetryableError(err)) {
 *     console.log('Temporary error, can retry');
 *   }
 * }
 * ```
 */

import { Code, ConnectError } from '@connectrpc/connect'

// Re-export ConnectError and Code for convenience
export { Code, ConnectError }

/**
 * Check if error is a timeout error
 * 
 * @param err - Error to check
 * @returns True if error is a deadline exceeded (timeout) error
 */
export function isGrpcTimeoutError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.DeadlineExceeded
}

/**
 * Check if error is a cancellation error
 * 
 * @param err - Error to check
 * @returns True if error is a canceled operation error
 */
export function isGrpcCancellationError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.Canceled
}

/**
 * Check if error is a not found error
 * 
 * @param err - Error to check
 * @returns True if error indicates resource was not found
 */
export function isGrpcNotFoundError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.NotFound
}

/**
 * Check if error is an authentication error
 * 
 * @param err - Error to check
 * @returns True if error indicates missing or invalid authentication
 */
export function isGrpcAuthError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.Unauthenticated
}

/**
 * Check if error is a permission error
 * 
 * @param err - Error to check
 * @returns True if error indicates insufficient permissions
 */
export function isGrpcPermissionError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.PermissionDenied
}

/**
 * Check if error is a resource exhausted error
 * 
 * @param err - Error to check
 * @returns True if error indicates rate limit or quota exceeded
 */
export function isGrpcResourceExhaustedError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.ResourceExhausted
}

/**
 * Check if error is an invalid argument error
 * 
 * @param err - Error to check
 * @returns True if error indicates invalid request parameters
 */
export function isGrpcInvalidArgumentError(err: unknown): boolean {
  return err instanceof ConnectError && err.code === Code.InvalidArgument
}

/**
 * Extract error message from any error type
 * 
 * Safely extracts error message from Connect errors, standard errors, or any other value.
 * 
 * @param err - Error of any type
 * @returns Human-readable error message
 */
export function getGrpcErrorMessage(err: unknown): string {
  if (err instanceof ConnectError) {
    return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return String(err)
}

/**
 * Check if error is retryable
 * 
 * Determines if an error represents a temporary condition that may succeed on retry.
 * Returns true for errors like service unavailable, resource exhausted, or aborted operations.
 * 
 * @param err - Error to check
 * @returns True if error is potentially retryable
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (err) {
 *   if (isGrpcRetryableError(err)) {
 *     // Implement retry logic
 *     await delay(1000);
 *     await someOperation();
 *   } else {
 *     throw err; // Non-retryable error
 *   }
 * }
 * ```
 */
export function isGrpcRetryableError(err: unknown): boolean {
  if (!(err instanceof ConnectError)) {
    return false
  }
  return [
    Code.Unavailable,
    Code.ResourceExhausted,
    Code.Aborted
  ].includes(err.code)
}
