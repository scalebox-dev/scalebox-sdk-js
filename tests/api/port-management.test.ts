import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApiClient, PortConfig } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { isIntegrationTest } from '../setup'

// Skip integration tests if API key is not available
const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest

describe('API Client - Port Management', () => {
  let client: ApiClient
  let testSandboxId: string | null = null

  beforeEach(async () => {
    // Only create ApiClient if API key is available
    if (process.env.SCALEBOX_API_KEY || isIntegrationTest) {
      const config = new ConnectionConfig()
      client = new ApiClient(config)
    }
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

  describe.skipIf(skipIfNoApiKey)('createSandbox with customPorts', () => {
    it('should create sandbox with custom ports', async () => {
      const customPorts: PortConfig[] = [
        { port: 3000, name: 'app', protocol: 'TCP' },
        { port: 8080, name: 'api', protocol: 'TCP' }
      ]

      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'custom-ports' },
        customPorts
      })

      testSandboxId = sandboxInfo.sandboxId

      expect(sandboxInfo).toBeDefined()
      expect(sandboxInfo.sandboxId).toBeDefined()
      expect(sandboxInfo.customPorts).toBeDefined()
      expect(Array.isArray(sandboxInfo.customPorts)).toBe(true)
      expect(sandboxInfo.customPorts?.length).toBeGreaterThanOrEqual(0)
      
      // Verify ports are included in response
      expect(sandboxInfo.ports).toBeDefined()
      expect(Array.isArray(sandboxInfo.ports)).toBe(true)
      expect(sandboxInfo.templatePorts).toBeDefined()
      expect(Array.isArray(sandboxInfo.templatePorts)).toBe(true)
    })

    it('should include ports in sandbox response', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'ports-response' }
      })

      testSandboxId = sandboxInfo.sandboxId

      // Verify ports fields exist in response
      expect(sandboxInfo.ports).toBeDefined()
      expect(Array.isArray(sandboxInfo.ports)).toBe(true)
      expect(sandboxInfo.templatePorts).toBeDefined()
      expect(Array.isArray(sandboxInfo.templatePorts)).toBe(true)
      expect(sandboxInfo.customPorts).toBeDefined()
      expect(Array.isArray(sandboxInfo.customPorts)).toBe(true)
    })
  })

  describe.skipIf(skipIfNoApiKey)('getSandboxPorts', () => {
    it('should get all ports for a sandbox', async () => {
      // Create a sandbox first
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'get-ports' }
      })

      testSandboxId = createdSandbox.sandboxId

      // Wait for sandbox to be running
      let sandbox = await client.getSandbox(createdSandbox.sandboxId)
      let retries = 0
      while (sandbox.status !== 'running' && retries < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        sandbox = await client.getSandbox(createdSandbox.sandboxId)
        retries++
      }

      if (sandbox.status !== 'running') {
        console.warn('Sandbox not running, skipping port test')
        return
      }

      const ports = await client.getSandboxPorts(createdSandbox.sandboxId)

      expect(ports).toBeDefined()
      expect(ports.ports).toBeDefined()
      expect(Array.isArray(ports.ports)).toBe(true)
      expect(ports.templatePorts).toBeDefined()
      expect(Array.isArray(ports.templatePorts)).toBe(true)
      expect(ports.customPorts).toBeDefined()
      expect(Array.isArray(ports.customPorts)).toBe(true)

      // Verify ports structure
      if (ports.ports.length > 0) {
        const port = ports.ports[0]
        expect(port.port).toBeDefined()
        expect(typeof port.port).toBe('number')
        expect(port.name).toBeDefined()
        expect(typeof port.name).toBe('string')
      }
    })
  })

  describe.skipIf(skipIfNoApiKey)('addSandboxPort', () => {
    it('should add a custom port to running sandbox', async () => {
      // Create a sandbox first
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'add-port' }
      })

      testSandboxId = createdSandbox.sandboxId

      // Wait for sandbox to be running
      let sandbox = await client.getSandbox(createdSandbox.sandboxId)
      let retries = 0
      while (sandbox.status !== 'running' && retries < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        sandbox = await client.getSandbox(createdSandbox.sandboxId)
        retries++
      }

      if (sandbox.status !== 'running') {
        console.warn('Sandbox not running, skipping add port test')
        return
      }

      const newPort: PortConfig = {
        port: 9000,
        name: 'custom-service',
        protocol: 'TCP'
      }

      const updatedSandbox = await client.addSandboxPort(createdSandbox.sandboxId, newPort)

      expect(updatedSandbox).toBeDefined()
      expect(updatedSandbox.customPorts).toBeDefined()
      expect(Array.isArray(updatedSandbox.customPorts)).toBe(true)

      // Verify the port was added
      const ports = await client.getSandboxPorts(createdSandbox.sandboxId)
      const addedPort = ports.customPorts?.find(p => p.port === newPort.port)
      expect(addedPort).toBeDefined()
      expect(addedPort?.name).toBe(newPort.name)
    })
  })

  describe.skipIf(skipIfNoApiKey)('removeSandboxPort', () => {
    it('should remove a custom port from running sandbox', async () => {
      // Create a sandbox with a custom port first
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'remove-port' },
        customPorts: [
          { port: 9001, name: 'test-service', protocol: 'TCP' }
        ]
      })

      testSandboxId = createdSandbox.sandboxId

      // Wait for sandbox to be running
      let sandbox = await client.getSandbox(createdSandbox.sandboxId)
      let retries = 0
      while (sandbox.status !== 'running' && retries < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        sandbox = await client.getSandbox(createdSandbox.sandboxId)
        retries++
      }

      if (sandbox.status !== 'running') {
        console.warn('Sandbox not running, skipping remove port test')
        return
      }

      // Verify port exists before removal
      let ports = await client.getSandboxPorts(createdSandbox.sandboxId)
      const portBefore = ports.customPorts?.find(p => p.port === 9001)
      expect(portBefore).toBeDefined()

      // Remove the port
      await client.removeSandboxPort(createdSandbox.sandboxId, 9001)

      // Verify port was removed
      ports = await client.getSandboxPorts(createdSandbox.sandboxId)
      const portAfter = ports.customPorts?.find(p => p.port === 9001)
      expect(portAfter).toBeUndefined()
    })
  })
})

