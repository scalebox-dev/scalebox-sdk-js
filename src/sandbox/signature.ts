/**
 * Signature URL generation utility
 * Uses SHA256 hash algorithm to generate secure file access signatures
 */

import { createHash } from 'crypto'

export type Operation = 'read' | 'write'

export interface Signature {
  signature: string
  expiration: number | null
}

/**
 * Generate a signature for file URL access
 * 
 * @param path File path
 * @param operation Operation type ('read' or 'write')
 * @param user Username (optional, defaults to empty string)
 * @param envdAccessToken Environment access token
 * @param expirationInSeconds Expiration time in seconds (optional)
 * @returns Signature object containing signature and expiration
 * 
 * @example
 * ```ts
 * const sig = getSignature('/path/to/file', 'read', 'user', 'token123', 3600)
 * // Returns: { signature: 'v1_abc123...', expiration: 1234567890 }
 * ```
 */
export function getSignature(
  path: string,
  operation: Operation,
  user: string | null | undefined,
  envdAccessToken: string,
  expirationInSeconds?: number
): Signature {
  if (!envdAccessToken) {
    throw new Error('Access token is not set and signature cannot be generated!')
  }

  // Calculate expiration time (Unix timestamp)
  const expiration = expirationInSeconds
    ? Math.floor(Date.now() / 1000) + expirationInSeconds
    : null

  // If user is null or undefined, set to empty string
  const normalizedUser = user || ''

  // Build signature string
  // Format: path:operation:user:envdAccessToken[:expiration]
  const raw = expiration
    ? `${path}:${operation}:${normalizedUser}:${envdAccessToken}:${expiration}`
    : `${path}:${operation}:${normalizedUser}:${envdAccessToken}`

  // Use SHA256 hash
  const digest = createHash('sha256').update(raw, 'utf-8').digest()

  // Base64 encode and remove padding (=)
  const encoded = digest.toString('base64').replace(/=+$/, '')

  // Return v1 format signature
  return {
    signature: `v1_${encoded}`,
    expiration
  }
}

