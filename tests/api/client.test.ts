import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'

describe('API Client', () => {
  let client: ApiClient
  let testSandboxId: string | null = null

  beforeEach(async () => {
    const config = new ConnectionConfig()
    client = new ApiClient(config)
  })

  afterEach(async () => {
    // Clean up test sandbox if it exists
    if (testSandboxId && client) {
      try {
        await client.deleteSandbox(testSandboxId)
      } catch (error) {
        // Ignore cleanup errors
        console.warn('Failed to cleanup sandbox:', error)
      }
      testSandboxId = null
    }
  })
  it('should create API client with default config', () => {
    expect(client).toBeDefined()
  })

  it('should create API client with custom config', () => {
    const config = new ConnectionConfig({
      apiUrl: 'https://api.test.com'
    })
    const customClient = new ApiClient(config)
    
    expect(customClient).toBeDefined()
  })

  it('should create sandbox', async () => {
    const sandboxInfo = await client.createSandbox({
      template: 'base',
      timeout: 300,
      metadata: { test: 'api-client' },
      envVars: { NODE_ENV: 'test' }
    })
    
    // Store sandbox ID for cleanup
    testSandboxId = sandboxInfo.sandboxId
    
    expect(sandboxInfo).toBeDefined()
    expect(sandboxInfo.sandboxId).toBeDefined()
    expect(sandboxInfo.templateId).toBeDefined()
    expect(sandboxInfo.status).toBeDefined()
    expect(sandboxInfo.createdAt).toBeDefined()
  })

  it('should get sandbox', async () => {
    // First create a sandbox to get a real ID
    const createdSandbox = await client.createSandbox({
      template: 'base',
      timeout: 300,
      metadata: { test: 'get-sandbox' }
    })
    
    // Store sandbox ID for cleanup
    testSandboxId = createdSandbox.sandboxId
    
    const sandboxInfo = await client.getSandbox(createdSandbox.sandboxId)
    
    expect(sandboxInfo).toBeDefined()
    expect(sandboxInfo.sandboxId).toBe(createdSandbox.sandboxId)
    expect(sandboxInfo.status).toBeDefined()
    expect(sandboxInfo.createdAt).toBeDefined()
    expect(sandboxInfo.templateId).toBeDefined()
  })

  it('should list sandboxes', async () => {
    const result = await client.listSandboxes({
      limit: 10,
      nextToken: undefined
    })
    
    expect(result).toBeDefined()
    expect(result.sandboxes).toBeDefined()
    expect(Array.isArray(result.sandboxes)).toBe(true)
    expect(result.sandboxes.length).toBeGreaterThan(0)
    
    // Verify the structure of sandbox objects
    if (result.sandboxes.length > 0) {
      const sandbox = result.sandboxes[0]
      expect(sandbox.sandboxId).toBeDefined()
      expect(sandbox.templateId).toBeDefined()
      expect(sandbox.status).toBeDefined()
      expect(sandbox.createdAt).toBeDefined()
    }
  })

  it('should delete sandbox', async () => {
    // First create a sandbox to delete
    const createdSandbox = await client.createSandbox({
      template: 'base',
      timeout: 300,
      metadata: { test: 'delete-sandbox' }
    })
    
    // Don't store for cleanup since we're deleting it
    await expect(
      client.deleteSandbox(createdSandbox.sandboxId)
    ).resolves.not.toThrow()
  })

  it('should get sandbox metrics', async () => {
    // First create a sandbox to get metrics for
    const createdSandbox = await client.createSandbox({
      template: 'base',
      timeout: 300,
      metadata: { test: 'metrics-sandbox' }
    })
    
    // Store sandbox ID for cleanup
    testSandboxId = createdSandbox.sandboxId
    
    const metrics = await client.getSandboxMetrics(createdSandbox.sandboxId)
    
    expect(metrics).toBeDefined()
    expect(metrics.cpuUsedPct).toBeDefined()
    expect(metrics.cpuCount).toBeDefined()
    expect(metrics.memUsed).toBeDefined()
    expect(metrics.memTotal).toBeDefined()
    expect(metrics.diskUsed).toBeDefined()
    expect(metrics.diskTotal).toBeDefined()
    expect(metrics.timestamp).toBeDefined()
  })

  // NOTE: This test is skipped because the backend implementation is not yet available.
  // It should be enabled once the backend supports pause/resume functionality.
  it.skip('should pause and resume sandbox', async () => {
    // First create a sandbox to pause/resume
    const createdSandbox = await client.createSandbox({
      template: 'base',
      timeout: 300,
      metadata: { test: 'pause-resume-sandbox' }
    })
    
    // Store sandbox ID for cleanup
    testSandboxId = createdSandbox.sandboxId
    
    await expect(
      client.pauseSandbox(createdSandbox.sandboxId)
    ).resolves.not.toThrow()
    
    await expect(
      client.resumeSandbox(createdSandbox.sandboxId)
    ).resolves.not.toThrow()
  })

  it('should update sandbox timeout', async () => {
    // First create a sandbox to update timeout for
    const createdSandbox = await client.createSandbox({
      template: 'base',
      timeout: 300,
      metadata: { test: 'timeout-sandbox' }
    })
    
    // Store sandbox ID for cleanup
    testSandboxId = createdSandbox.sandboxId
    
    await expect(
      client.updateSandboxTimeout(createdSandbox.sandboxId, 600)
    ).resolves.not.toThrow()
  })
})
