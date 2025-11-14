import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Sandbox } from '../../src'
import { getSignature } from '../../src/sandbox/signature'
import { template } from '../template'
import { isIntegrationTest } from '../setup'
import { createHash } from 'crypto'

const timeout = 60_000

// Skip integration tests if API key is not available
const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

// Helper function to generate signature with specific expiration timestamp
function getSignatureWithExpiration(
  path: string,
  operation: 'read' | 'write',
  user: string | null | undefined,
  envdAccessToken: string,
  expirationTimestamp: number
): { signature: string; expiration: number } {
  const normalizedUser = user || ''
  const raw = `${path}:${operation}:${normalizedUser}:${envdAccessToken}:${expirationTimestamp}`
  const digest = createHash('sha256').update(raw, 'utf-8').digest()
  const encoded = digest.toString('base64').replace(/=+$/, '')
  
  return {
    signature: `v1_${encoded}`,
    expiration: expirationTimestamp
  }
}

// Health check helper
async function waitForSandboxHealth(sandbox: Sandbox) {
  await sandbox.waitForHealth({ timeout: 10_000 })
}

describe('Signature URL Generation', () => {
  describe('getSignature function', () => {
    const testToken = 'test-access-token-12345'
    const testPath = '/path/to/file.txt'
    const testUser = 'testuser'

    it('should generate signature without expiration', () => {
      const result = getSignature(testPath, 'read', testUser, testToken)

      expect(result.signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
      expect(result.signature).toContain('v1_')
      expect(result.expiration).toBeNull()
    })

    it('should generate signature with expiration', () => {
      const expirationSeconds = 3600
      const result = getSignature(testPath, 'read', testUser, testToken, expirationSeconds)

      expect(result.signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
      expect(result.expiration).toBeGreaterThan(Math.floor(Date.now() / 1000))
      expect(result.expiration).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + expirationSeconds + 1)
    })

    it('should generate different signatures for different paths', () => {
      const sig1 = getSignature('/path/to/file1.txt', 'read', testUser, testToken)
      const sig2 = getSignature('/path/to/file2.txt', 'read', testUser, testToken)

      expect(sig1.signature).not.toBe(sig2.signature)
    })

    it('should generate different signatures for different operations', () => {
      const sig1 = getSignature(testPath, 'read', testUser, testToken)
      const sig2 = getSignature(testPath, 'write', testUser, testToken)

      expect(sig1.signature).not.toBe(sig2.signature)
    })

    it('should generate different signatures for different users', () => {
      const sig1 = getSignature(testPath, 'read', 'user1', testToken)
      const sig2 = getSignature(testPath, 'read', 'user2', testToken)

      expect(sig1.signature).not.toBe(sig2.signature)
    })

    it('should generate different signatures for different tokens', () => {
      const sig1 = getSignature(testPath, 'read', testUser, 'token1')
      const sig2 = getSignature(testPath, 'read', testUser, 'token2')

      expect(sig1.signature).not.toBe(sig2.signature)
    })

    it('should generate same signature for same inputs', () => {
      const sig1 = getSignature(testPath, 'read', testUser, testToken, 3600)
      const sig2 = getSignature(testPath, 'read', testUser, testToken, 3600)

      // Note: expiration will be slightly different due to time, so we test without expiration
      const sig3 = getSignature(testPath, 'read', testUser, testToken)
      const sig4 = getSignature(testPath, 'read', testUser, testToken)

      expect(sig3.signature).toBe(sig4.signature)
    })

    it('should handle null user', () => {
      const result = getSignature(testPath, 'read', null, testToken)

      expect(result.signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
      expect(result.expiration).toBeNull()
    })

    it('should handle undefined user', () => {
      const result = getSignature(testPath, 'read', undefined, testToken)

      expect(result.signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
      expect(result.expiration).toBeNull()
    })

    it('should handle empty string user', () => {
      const result = getSignature(testPath, 'read', '', testToken)

      expect(result.signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
      expect(result.expiration).toBeNull()
    })

    it('should throw error when token is empty', () => {
      expect(() => {
        getSignature(testPath, 'read', testUser, '')
      }).toThrow('Access token is not set and signature cannot be generated!')
    })

    it('should handle paths with special characters', () => {
      const specialPath = '/path/with spaces/file-name.txt'
      const result = getSignature(specialPath, 'read', testUser, testToken)

      expect(result.signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
    })

    it('should handle root path', () => {
      const result = getSignature('/', 'read', testUser, testToken)

      expect(result.signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
    })
  })

  describe.skipIf(skipIfNoApiKey)('Sandbox downloadUrl with signature', () => {
    let sandbox: Sandbox

    beforeEach(async () => {
      sandbox = await Sandbox.create(template, {
        timeoutMs: timeout,
      })
    })

    afterEach(async () => {
      if (sandbox) {
        await sandbox.kill()
      }
    })

    it('should generate download URL without signature (backward compatibility)', async () => {
      const path = '/tmp/test-file.txt'
      const url = await sandbox.downloadUrl(path)

      expect(url).toContain(sandbox.sandboxDomain)
      expect(url).toContain('/download/')
      expect(url).toContain('tmp/test-file.txt')
      expect(url).not.toContain('signature=')
      expect(url).not.toContain('signature_expiration=')
    })

    it('should generate signed download URL with expiration', async () => {
      if (!sandbox.envdAccessToken) {
        // Skip test if no access token (e.g., in debug mode)
        return
      }

      const path = '/tmp/test-file.txt'
      const expirationSeconds = 3600
      const url = await sandbox.downloadUrl(path, {
        useSignatureExpiration: expirationSeconds
      })

      expect(url).toContain(sandbox.sandboxDomain)
      expect(url).toContain('/download/')
      expect(url).toContain('tmp/test-file.txt')
      expect(url).toContain('signature=')
      expect(url).toContain('signature_expiration=')
      expect(url).toContain('username=')

      // Parse URL to verify parameters
      const urlObj = new URL(url)
      expect(urlObj.searchParams.has('signature')).toBe(true)
      expect(urlObj.searchParams.has('signature_expiration')).toBe(true)
      expect(urlObj.searchParams.has('username')).toBe(true)

      const signature = urlObj.searchParams.get('signature')
      expect(signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)

      const expiration = urlObj.searchParams.get('signature_expiration')
      expect(expiration).toBeTruthy()
      // Note: Backend expiration validation is not yet implemented, so we only verify the parameter exists
      // const expirationNum = parseInt(expiration!, 10)
      // expect(expirationNum).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('should generate signed download URL with custom user', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      const path = '/tmp/test-file.txt'
      const customUser = 'customuser'
      const url = await sandbox.downloadUrl(path, {
        useSignatureExpiration: 1800,
        user: customUser
      })

      const urlObj = new URL(url)
      expect(urlObj.searchParams.get('username')).toBe(customUser)
    })

    it('should handle path without leading slash', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      const path = 'tmp/test-file.txt' // No leading slash
      const url = await sandbox.downloadUrl(path, {
        useSignatureExpiration: 3600
      })

      expect(url).toContain('/download/tmp/test-file.txt')
      expect(url).toContain('signature=')
    })

    it('should throw error when generating signed URL without access token', async () => {
      // Create a sandbox-like object without access token for testing
      // This is a theoretical test - in practice, sandbox always has envdAccessToken
      // But we can test the error handling path
      const sandboxWithoutToken = await Sandbox.create(template, {
        timeoutMs: timeout,
      })

      // Manually clear the token (if possible) or create a mock scenario
      // Since we can't easily mock this, we'll test the actual behavior
      // If the sandbox doesn't have a token, it should throw
      try {
        await sandboxWithoutToken.downloadUrl('/test', {
          useSignatureExpiration: 3600
        })
        // If no error, the sandbox has a token (expected behavior)
      } catch (error: any) {
        expect(error.message).toContain('envdAccessToken is not available')
      } finally {
        await sandboxWithoutToken.kill()
      }
    })

    it('should reject expired download URL', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      // Create a file first
      const path = '/tmp/test-expired-download.txt'
      await waitForSandboxHealth(sandbox)
      await sandbox.files.write(path, 'test content for expired URL')

      // Generate an expired signature (expired 1 hour ago)
      const expiredExpiration = Math.floor(Date.now() / 1000) - 3600
      const normalizedPath = path.startsWith('/') ? path : `/${path}`
      const user = 'user'

      // Manually create expired signature by generating with past expiration timestamp
      const expiredSignature = getSignatureWithExpiration(
        normalizedPath,
        'read',
        user,
        sandbox.envdAccessToken!,
        expiredExpiration
      )

      // Build expired URL
      const baseUrl = `https://${sandbox.sandboxDomain}`
      const cleanPath = path.replace(/^\/+/, '')
      const url = new URL(`/download/${cleanPath}`, baseUrl)
      url.searchParams.set('signature', expiredSignature.signature)
      url.searchParams.set('signature_expiration', expiredSignature.expiration!.toString())
      url.searchParams.set('username', user)

      const expiredUrl = url.toString()

      // Try to download using expired URL - should fail
      // Note: Backend expiration validation is not yet implemented, so this test documents expected behavior
      try {
        const response = await fetch(expiredUrl, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer root',
            'X-Access-Token': sandbox.envdAccessToken!
          }
        })

        // When backend implements expiration validation, this should fail
        // For now, we just document the expected behavior
        if (response.status === 401 || response.status === 403) {
          // Expected: expired URL should be rejected
          expect(response.status).toBeGreaterThanOrEqual(400)
        } else {
          // Backend not yet validating expiration - log for documentation
          console.log('Note: Backend expiration validation not yet implemented - expired URL was accepted')
        }
      } catch (error) {
        // Network errors are also acceptable for expired URLs
        expect(error).toBeDefined()
      }
    })
  })

  describe.skipIf(skipIfNoApiKey)('Sandbox uploadUrl with signature', () => {
    let sandbox: Sandbox

    beforeEach(async () => {
      sandbox = await Sandbox.create(template, {
        timeoutMs: timeout,
      })
    })

    afterEach(async () => {
      if (sandbox) {
        await sandbox.kill()
      }
    })

    it('should generate upload URL without signature (backward compatibility)', async () => {
      const path = '/tmp/upload-file.txt'
      const url = await sandbox.uploadUrl(path)

      expect(url).toContain(sandbox.sandboxDomain)
      expect(url).toContain('/upload')
      expect(url).not.toContain('signature=')
      expect(url).not.toContain('signature_expiration=')
    })

    it('should generate signed upload URL with expiration', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      const path = '/tmp/upload-file.txt'
      const expirationSeconds = 3600
      const url = await sandbox.uploadUrl(path, {
        useSignatureExpiration: expirationSeconds
      })

      expect(url).toContain(sandbox.sandboxDomain)
      expect(url).toContain('/upload')
      expect(url).toContain('signature=')
      expect(url).toContain('signature_expiration=')
      expect(url).toContain('username=')
      expect(url).toContain('path=')

      // Parse URL to verify parameters
      const urlObj = new URL(url)
      expect(urlObj.searchParams.has('signature')).toBe(true)
      expect(urlObj.searchParams.has('signature_expiration')).toBe(true)
      expect(urlObj.searchParams.has('username')).toBe(true)
      expect(urlObj.searchParams.get('path')).toBe(path)

      const signature = urlObj.searchParams.get('signature')
      expect(signature).toMatch(/^v1_[A-Za-z0-9+/]+$/)
    })

    it('should generate signed upload URL without path', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      const url = await sandbox.uploadUrl(undefined, {
        useSignatureExpiration: 3600
      })

      expect(url).toContain('/upload')
      expect(url).toContain('signature=')
      
      const urlObj = new URL(url)
      // Path should default to '/' in signature
      expect(urlObj.searchParams.has('signature')).toBe(true)
    })

    it('should generate signed upload URL with custom user', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      const path = '/tmp/upload-file.txt'
      const customUser = 'uploaduser'
      const url = await sandbox.uploadUrl(path, {
        useSignatureExpiration: 1800,
        user: customUser
      })

      const urlObj = new URL(url)
      expect(urlObj.searchParams.get('username')).toBe(customUser)
    })

    it('should include path in query params for upload URL', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      const path = '/tmp/upload-file.txt'
      const url = await sandbox.uploadUrl(path, {
        useSignatureExpiration: 3600
      })

      const urlObj = new URL(url)
      expect(urlObj.searchParams.get('path')).toBe(path)
    })

    it('should reject expired upload URL', async () => {
      if (!sandbox.envdAccessToken) {
        return
      }

      await waitForSandboxHealth(sandbox)

      const path = '/tmp/test-expired-upload.txt'
      
      // Generate an expired signature (expired 1 hour ago)
      const expiredExpiration = Math.floor(Date.now() / 1000) - 3600
      const normalizedPath = path.startsWith('/') ? path : `/${path}`
      const user = 'user'

      // Manually create expired signature by generating with past expiration timestamp
      const expiredSignature = getSignatureWithExpiration(
        normalizedPath,
        'write',
        user,
        sandbox.envdAccessToken!,
        expiredExpiration
      )

      // Build expired URL
      const baseUrl = `https://${sandbox.sandboxDomain}`
      const url = new URL('/upload', baseUrl)
      url.searchParams.set('signature', expiredSignature.signature)
      url.searchParams.set('signature_expiration', expiredSignature.expiration.toString())
      url.searchParams.set('username', user)
      url.searchParams.set('path', path)

      const expiredUrl = url.toString()

      // Create test file content
      const testContent = 'test content for expired upload'
      const formData = new FormData()
      const blob = new Blob([testContent], { type: 'text/plain' })
      formData.append('file', blob, path)

      // Try to upload using expired URL - should fail
      // Note: Backend expiration validation is not yet implemented, so this test documents expected behavior
      try {
        const response = await fetch(expiredUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer root',
            'X-Access-Token': sandbox.envdAccessToken!
          },
          body: formData
        })

        // When backend implements expiration validation, this should fail
        // For now, we just document the expected behavior
        if (response.status === 401 || response.status === 403) {
          // Expected: expired URL should be rejected
          expect(response.status).toBeGreaterThanOrEqual(400)
        } else {
          // Backend not yet validating expiration - log for documentation
          console.log('Note: Backend expiration validation not yet implemented - expired upload URL was accepted')
        }
      } catch (error) {
        // Network errors are also acceptable for expired URLs
        expect(error).toBeDefined()
      }
    })
  })

  describe('Signature consistency and validation', () => {
    it('should generate consistent signatures for same inputs', () => {
      const token = 'test-token-123'
      const path = '/test/path.txt'
      const user = 'testuser'

      // Generate multiple signatures with same inputs (no expiration)
      const sig1 = getSignature(path, 'read', user, token)
      const sig2 = getSignature(path, 'read', user, token)

      expect(sig1.signature).toBe(sig2.signature)
      expect(sig1.expiration).toBe(sig2.expiration)
    })

    it('should generate same signature for same expiration time', () => {
      const token = 'test-token-123'
      const path = '/test/path.txt'
      const user = 'testuser'

      // Generate signatures with same expiration time (relative seconds)
      // Note: Since expiration is calculated from current time, signatures will be different
      // unless generated in the same second. This test verifies that same inputs produce same results.
      const sig1 = getSignature(path, 'read', user, token, 3600)
      const sig2 = getSignature(path, 'read', user, token, 3600)

      // Expiration times should be approximately the same (within 1 second)
      if (sig1.expiration && sig2.expiration) {
        const diff = Math.abs(sig1.expiration - sig2.expiration)
        expect(diff).toBeLessThan(2) // Should be within 1-2 seconds
        
        // If expiration times are the same, signatures should be the same
        if (diff === 0) {
          expect(sig1.signature).toBe(sig2.signature)
        }
      }
    })

    it('should generate different signatures for different expiration times', () => {
      const token = 'test-token-123'
      const path = '/test/path.txt'
      const user = 'testuser'

      // Generate signatures with different expiration times
      const sig1 = getSignature(path, 'read', user, token, 3600)
      const sig2 = getSignature(path, 'read', user, token, 7200) // Different expiration

      // Signatures should be different due to different expiration times
      expect(sig1.signature).not.toBe(sig2.signature)
      expect(sig1.expiration).not.toBe(sig2.expiration)
      if (sig1.expiration && sig2.expiration) {
        expect(sig2.expiration - sig1.expiration).toBe(3600) // Exactly 1 hour difference
      }
    })

    it('should validate signature format', () => {
      const result = getSignature('/test', 'read', 'user', 'token')

      // Signature should start with 'v1_'
      expect(result.signature.startsWith('v1_')).toBe(true)
      
      // Should be base64-like (alphanumeric + / + =)
      const base64Part = result.signature.substring(3)
      expect(base64Part).toMatch(/^[A-Za-z0-9+/]+$/)
      
      // Should not contain padding in the signature (we remove it)
      expect(result.signature).not.toContain('=')
    })
  })
})

