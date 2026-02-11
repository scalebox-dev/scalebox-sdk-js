import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'

describe('API Client - getSandboxStatus and waitUntilStatus', () => {
  let client: ApiClient

  beforeEach(() => {
    const config = new ConnectionConfig({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key'
    })
    client = new ApiClient(config)
  })

  describe('waitUntilStatus', () => {
    it('should resolve immediately when current status is in targetStatuses', async () => {
      vi.spyOn(client, 'getSandboxStatus').mockResolvedValue({
        sandboxId: 'sbx-1',
        status: 'running',
        updatedAt: new Date().toISOString()
      })
      const result = await client.waitUntilStatus('sbx-1', ['running', 'failed'], { timeoutMs: 5000 })
      expect(result.status).toBe('running')
      expect(result.sandboxId).toBe('sbx-1')
      expect(client.getSandboxStatus).toHaveBeenCalledTimes(1)
    })

    it('should resolve when status becomes target after multiple polls', async () => {
      let callCount = 0
      vi.spyOn(client, 'getSandboxStatus').mockImplementation(async () => {
        callCount++
        if (callCount < 2) {
          return { sandboxId: 'sbx-1', status: 'pausing', updatedAt: new Date().toISOString() }
        }
        return { sandboxId: 'sbx-1', status: 'paused', updatedAt: new Date().toISOString() }
      })
      const result = await client.waitUntilStatus('sbx-1', ['paused', 'failed'], { timeoutMs: 10000, intervalMs: 50 })
      expect(result.status).toBe('paused')
      expect(callCount).toBe(2)
    })

    it('should throw on timeout when status never reaches target', async () => {
      vi.spyOn(client, 'getSandboxStatus').mockResolvedValue({
        sandboxId: 'sbx-1',
        status: 'pausing',
        updatedAt: new Date().toISOString()
      })
      await expect(
        client.waitUntilStatus('sbx-1', ['paused', 'failed'], { timeoutMs: 200, intervalMs: 100 })
      ).rejects.toThrow(/timed out/)
    })

    it('should throw when abort signal is triggered', async () => {
      vi.spyOn(client, 'getSandboxStatus').mockResolvedValue({
        sandboxId: 'sbx-1',
        status: 'pausing',
        updatedAt: new Date().toISOString()
      })
      const ac = new AbortController()
      const p = client.waitUntilStatus('sbx-1', ['paused'], { timeoutMs: 5000, intervalMs: 200, signal: ac.signal })
      ac.abort()
      await expect(p).rejects.toThrow(/aborted/)
    })
  })
})
