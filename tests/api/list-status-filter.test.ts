import { describe, it, expect, beforeEach } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { Sandbox } from '../../src'
import { isIntegrationTest } from '../setup'

// Skip integration tests if API key is not available
const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

describe('API Client - List Sandboxes with Status Filter', () => {
  let client: ApiClient

  beforeEach(async () => {
    // Only create ApiClient if API key is available
    if (process.env.SCALEBOX_API_KEY || isIntegrationTest) {
      const config = new ConnectionConfig()
      client = new ApiClient(config)
    }
  })

  describe.skipIf(skipIfNoApiKey)('listSandboxes with status filter', () => {
    it('should filter sandboxes by status', async () => {
      // List only running sandboxes
      const runningResult = await client.listSandboxes({
        query: {
          status: ['running']
        },
        limit: 10
      })

      expect(runningResult).toBeDefined()
      expect(runningResult.sandboxes).toBeDefined()
      expect(Array.isArray(runningResult.sandboxes)).toBe(true)

      // Verify all returned sandboxes have running status
      runningResult.sandboxes.forEach(sandbox => {
        expect(sandbox.status).toBe('running')
      })
    })

    it('should filter sandboxes by multiple statuses (uses first)', async () => {
      // List sandboxes with multiple statuses (only first is used)
      const result = await client.listSandboxes({
        query: {
          status: ['running', 'paused']
        },
        limit: 10
      })

      expect(result).toBeDefined()
      expect(result.sandboxes).toBeDefined()
      expect(Array.isArray(result.sandboxes)).toBe(true)

      // All should have 'running' status (first in array)
      result.sandboxes.forEach(sandbox => {
        expect(sandbox.status).toBe('running')
      })
    })

    it('should filter sandboxes by paused status', async () => {
      const pausedResult = await client.listSandboxes({
        query: {
          status: ['paused']
        },
        limit: 10
      })

      expect(pausedResult).toBeDefined()
      expect(pausedResult.sandboxes).toBeDefined()
      expect(Array.isArray(pausedResult.sandboxes)).toBe(true)

      // Verify all returned sandboxes have paused status
      pausedResult.sandboxes.forEach(sandbox => {
        expect(sandbox.status).toBe('paused')
      })
    })

    it('should filter sandboxes by created status', async () => {
      const createdResult = await client.listSandboxes({
        query: {
          status: ['created']
        },
        limit: 10
      })

      expect(createdResult).toBeDefined()
      expect(createdResult.sandboxes).toBeDefined()
      expect(Array.isArray(createdResult.sandboxes)).toBe(true)

      // Verify all returned sandboxes have created status
      createdResult.sandboxes.forEach(sandbox => {
        expect(sandbox.status).toBe('created')
      })
    })

    it('should list all sandboxes without status filter', async () => {
      const allResult = await client.listSandboxes({
        limit: 10
      })

      expect(allResult).toBeDefined()
      expect(allResult.sandboxes).toBeDefined()
      expect(Array.isArray(allResult.sandboxes)).toBe(true)

      // Should return sandboxes with various statuses
      if (allResult.sandboxes.length > 0) {
        const statuses = new Set(allResult.sandboxes.map(s => s.status))
        expect(statuses.size).toBeGreaterThanOrEqual(1)
      }
    })

    it('should support all valid status values', async () => {
      const validStatuses: Array<'created' | 'starting' | 'running' | 'pausing' | 'paused' | 'resuming' | 'terminating' | 'terminated' | 'failed'> = [
        'created',
        'starting',
        'running',
        'pausing',
        'paused',
        'resuming',
        'terminating',
        'terminated',
        'failed'
      ]

      for (const status of validStatuses) {
        const result = await client.listSandboxes({
          query: {
            status: [status]
          },
          limit: 5
        })

        expect(result).toBeDefined()
        expect(result.sandboxes).toBeDefined()
        expect(Array.isArray(result.sandboxes)).toBe(true)

        // Verify all returned sandboxes have the requested status
        result.sandboxes.forEach(sandbox => {
          expect(sandbox.status).toBe(status)
        })
      }
    })
  })

  describe.skipIf(skipIfNoApiKey)('Sandbox.list with status filter', () => {
    it('should use status filter in Sandbox.list', async () => {
      const paginator = Sandbox.list({
        query: {
          status: ['running']
        },
        limit: 10
      })

      expect(paginator).toBeDefined()
      expect(paginator.hasNext).toBeDefined()
      expect(typeof paginator.hasNext).toBe('boolean')

      if (paginator.hasNext) {
        const sandboxes = await paginator.nextItems()
        expect(Array.isArray(sandboxes)).toBe(true)

        // Verify all returned sandboxes have running status
        sandboxes.forEach(sandbox => {
          expect(sandbox.status).toBe('running')
        })
      }
    })

    it('should iterate through paginated results with status filter', async () => {
      const paginator = Sandbox.list({
        query: {
          status: ['running']
        },
        limit: 5
      })

      let count = 0
      const maxIterations = 3 // Limit iterations to avoid long test

      while (paginator.hasNext && count < maxIterations) {
        const sandboxes = await paginator.nextItems()
        expect(Array.isArray(sandboxes)).toBe(true)

        // Verify all returned sandboxes have running status
        sandboxes.forEach(sandbox => {
          expect(sandbox.status).toBe('running')
          expect(sandbox.sandboxId).toBeDefined()
          expect(sandbox.templateId).toBeDefined()
        })

        count++
      }
    })
  })
})

