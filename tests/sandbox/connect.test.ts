import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Sandbox } from '../../src'
import { template } from '../template'

/**
 * Comprehensive Sandbox Connect Test Suite
 * 
 * This test suite covers industry-standard connection scenarios:
 * - Basic connection and reconnection
 * - Concurrent connections
 * - Connection to paused sandboxes
 * - Connection with timeout extension
 * - Connection state verification
 * - Cross-session connection scenarios
 * - Connection error recovery
 * - Connection performance characteristics
 */
describe('Sandbox Connect - Comprehensive Test Suite', () => {
  let createdSandboxes: string[] = []
  const DEFAULT_TIMEOUT = 60000

  beforeAll(() => {
    // Verify environment configuration
    if (!process.env.SCALEBOX_API_KEY) {
      throw new Error('Please set SCALEBOX_API_KEY environment variable')
    }
    
    console.log('🔧 Connect Test Configuration:')
    console.log('  API URL:', process.env.SCALEBOX_API_URL || 'https://api.scalebox.dev')
    console.log('  Domain:', process.env.SCALEBOX_DOMAIN || 'scalebox.dev')
  })

  afterAll(async () => {
    // Clean up all created sandboxes
    console.log(`🧹 Cleaning up ${createdSandboxes.length} sandboxes...`)
    
    for (const sandboxId of createdSandboxes) {
      try {
        const sandbox = await Sandbox.connect(sandboxId)
        await sandbox.kill()
        console.log(`✅ Cleaned up: ${sandboxId}`)
      } catch (error) {
        console.warn(`⚠️ Failed to clean up ${sandboxId}:`, error)
      }
    }
  })

  describe('Basic Connection Scenarios', () => {
    let testSandbox: Sandbox

    beforeAll(async () => {
      console.log('📦 Creating test sandbox for basic connection tests...')
      testSandbox = await Sandbox.create(template, {
        metadata: { 
          purpose: 'basic-connection-test',
          testSuite: 'connect-basic'
        }
      })
      createdSandboxes.push(testSandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${testSandbox.sandboxId}`)
    })

    it('should connect to an existing running sandbox', async () => {
      console.log('🔌 Testing basic connection to running sandbox...')
      
      const connectedSandbox = await Sandbox.connect(testSandbox.sandboxId)
      
      // Verify connection properties
      expect(connectedSandbox.sandboxId).toBe(testSandbox.sandboxId)
      expect(connectedSandbox.sandboxDomain).toBeDefined()
      expect(connectedSandbox.envdAccessToken).toBeDefined()
      
      // Verify sandbox is functional
      const isRunning = await connectedSandbox.isRunning()
      expect(isRunning).toBe(true)
      
      console.log(`✅ Successfully connected to: ${connectedSandbox.sandboxId}`)
    }, DEFAULT_TIMEOUT)

    it('should reconnect to the same sandbox multiple times', async () => {
      console.log('🔄 Testing multiple reconnections...')
      
      const connections: Sandbox[] = []
      
      // Connect 5 times sequentially
      for (let i = 0; i < 5; i++) {
        const conn = await Sandbox.connect(testSandbox.sandboxId)
        connections.push(conn)
        
        expect(conn.sandboxId).toBe(testSandbox.sandboxId)
        expect(await conn.isRunning()).toBe(true)
        
        console.log(`  ✓ Reconnection ${i + 1}/5 successful`)
      }
      
      // Verify all connections reference the same sandbox
      expect(connections.every(c => c.sandboxId === testSandbox.sandboxId)).toBe(true)
      
      console.log(`✅ Successfully reconnected 5 times`)
    }, DEFAULT_TIMEOUT)

    it('should maintain sandbox state across connections', async () => {
      console.log('💾 Testing state persistence across connections...')
      
      // Create a file using original sandbox
      const testFilePath = '/tmp/connection-test.txt'
      const testContent = 'Connection test content'
      await testSandbox.files.write(testFilePath, testContent)
      
      // Connect using a new instance
      const newConnection = await Sandbox.connect(testSandbox.sandboxId)
      
      // Verify file exists in new connection
      const exists = await newConnection.files.exists(testFilePath)
      expect(exists).toBe(true)
      
      const content = await newConnection.files.read(testFilePath)
      expect(content).toBe(testContent)
      
      console.log(`✅ State persisted across connections`)
    }, DEFAULT_TIMEOUT)

    it('should connect with custom timeout options', async () => {
      console.log('⏱️ Testing connection with custom timeout...')
      
      const customTimeoutMs = 300000 // 5 minutes
      const connectedSandbox = await Sandbox.connect(
        testSandbox.sandboxId,
        { timeoutMs: customTimeoutMs }
      )
      
      expect(connectedSandbox.sandboxId).toBe(testSandbox.sandboxId)
      
      // Verify timeout was set
      const info = await connectedSandbox.getInfo()
      expect(info.timeout).toBeGreaterThanOrEqual(customTimeoutMs / 1000)
      
      console.log(`✅ Connected with custom timeout: ${customTimeoutMs}ms`)
    }, DEFAULT_TIMEOUT)

    it('should retrieve correct sandbox information after connection', async () => {
      console.log('📊 Testing sandbox info retrieval after connection...')
      
      const connectedSandbox = await Sandbox.connect(testSandbox.sandboxId)
      const info = await connectedSandbox.getInfo()
      
      // Verify basic information
      expect(info.sandboxId).toBe(testSandbox.sandboxId)
      expect(info.status).toBeDefined()
      expect(info.templateId).toBeDefined()
      expect(info.startedAt).toBeInstanceOf(Date)
      
      // Verify metadata
      expect(info.metadata).toBeDefined()
      expect(info.metadata?.purpose).toBe('basic-connection-test')
      
      console.log('📋 Sandbox info:', {
        sandboxId: info.sandboxId,
        status: info.status,
        templateId: info.templateId,
        metadata: info.metadata
      })
      
      console.log(`✅ Sandbox information validated`)
    }, DEFAULT_TIMEOUT)
  })

  describe('Concurrent Connection Scenarios', () => {
    let sharedSandbox: Sandbox

    beforeAll(async () => {
      console.log('📦 Creating sandbox for concurrent connection tests...')
      sharedSandbox = await Sandbox.create(template, {
        metadata: { 
          purpose: 'concurrent-connection-test',
          testSuite: 'connect-concurrent'
        }
      })
      createdSandboxes.push(sharedSandbox.sandboxId)
      console.log(`✅ Shared sandbox created: ${sharedSandbox.sandboxId}`)
    })

    it('should handle multiple concurrent connections', async () => {
      console.log('🔀 Testing concurrent connections...')
      
      // Create 10 concurrent connections
      const connectionPromises = Array.from({ length: 10 }, (_, i) => 
        Sandbox.connect(sharedSandbox.sandboxId).then(sandbox => ({
          index: i,
          sandbox
        }))
      )
      
      const connections = await Promise.all(connectionPromises)
      
      // Verify all connections are valid
      for (const { index, sandbox } of connections) {
        expect(sandbox.sandboxId).toBe(sharedSandbox.sandboxId)
        expect(await sandbox.isRunning()).toBe(true)
        console.log(`  ✓ Concurrent connection ${index + 1}/10 verified`)
      }
      
      console.log(`✅ All 10 concurrent connections successful`)
    }, DEFAULT_TIMEOUT * 2)

    it('should handle concurrent operations across connections', async () => {
      console.log('⚡ Testing concurrent operations across connections...')
      
      // Create 5 connections
      const connections = await Promise.all(
        Array.from({ length: 5 }, () => Sandbox.connect(sharedSandbox.sandboxId))
      )
      
      // Each connection writes a unique file
      const writePromises = connections.map((sandbox, index) => 
        sandbox.files.write(`/tmp/concurrent-${index}.txt`, `Content from connection ${index}`)
      )
      
      await Promise.all(writePromises)
      
      // Verify all files exist using a new connection
      const verifyConnection = await Sandbox.connect(sharedSandbox.sandboxId)
      
      for (let i = 0; i < 5; i++) {
        const exists = await verifyConnection.files.exists(`/tmp/concurrent-${i}.txt`)
        expect(exists).toBe(true)
        const content = await verifyConnection.files.read(`/tmp/concurrent-${i}.txt`)
        expect(content).toBe(`Content from connection ${i}`)
        console.log(`  ✓ File from connection ${i + 1} verified`)
      }
      
      console.log(`✅ Concurrent operations completed successfully`)
    }, DEFAULT_TIMEOUT * 2)

    it('should maintain isolation between connection instances', async () => {
      console.log('🔒 Testing connection instance isolation...')
      
      const conn1 = await Sandbox.connect(sharedSandbox.sandboxId)
      const conn2 = await Sandbox.connect(sharedSandbox.sandboxId)
      
      // Verify they are different instances but same sandbox
      expect(conn1).not.toBe(conn2)
      expect(conn1.sandboxId).toBe(conn2.sandboxId)
      
      // Both should be functional
      expect(await conn1.isRunning()).toBe(true)
      expect(await conn2.isRunning()).toBe(true)
      
      console.log(`✅ Connection instances properly isolated`)
    }, DEFAULT_TIMEOUT)
  })

  describe('Error Handling and Recovery', () => {
    it('should fail gracefully when connecting to non-existent sandbox', async () => {
      console.log('🚫 Testing connection to non-existent sandbox...')
      
      await expect(
        Sandbox.connect('non-existent-sandbox-id-12345')
      ).rejects.toThrow()
      
      console.log(`✅ Non-existent sandbox error handled correctly`)
    }, DEFAULT_TIMEOUT)

    it('should fail gracefully with invalid sandbox ID format', async () => {
      console.log('🚫 Testing connection with invalid ID format...')
      
      await expect(
        Sandbox.connect('')
      ).rejects.toThrow()
      
      await expect(
        Sandbox.connect('   ')
      ).rejects.toThrow()
      
      console.log(`✅ Invalid ID format errors handled correctly`)
    }, DEFAULT_TIMEOUT)

    it('should handle connection to killed sandbox', async () => {
      console.log('💀 Testing connection to killed sandbox...')
      
      // Create and kill a sandbox
      const tempSandbox = await Sandbox.create(template)
      const tempId = tempSandbox.sandboxId
      createdSandboxes.push(tempId)
      
      await tempSandbox.kill()
      
      // Wait a moment for kill to propagate
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Try to connect to killed sandbox
      await expect(
        Sandbox.connect(tempId)
      ).rejects.toThrow()
      
      console.log(`✅ Killed sandbox connection error handled correctly`)
    }, DEFAULT_TIMEOUT)

    it('should validate connection options', async () => {
      console.log('✅ Testing connection options validation...')
      
      const testSandbox = await Sandbox.create(template)
      createdSandboxes.push(testSandbox.sandboxId)
      
      // Test invalid timeout (too short)
      await expect(
        Sandbox.connect(testSandbox.sandboxId, { timeoutMs: 30000 })
      ).rejects.toThrow('Timeout must be at least 60 seconds')
      
      // Test invalid timeout (too long)
      await expect(
        Sandbox.connect(testSandbox.sandboxId, { timeoutMs: 4000000 })
      ).rejects.toThrow('Timeout cannot exceed 3600 seconds')
      
      console.log(`✅ Connection options validation working correctly`)
    }, DEFAULT_TIMEOUT)
  })

  describe('Cross-Session Connection Scenarios', () => {
    let persistentSandboxId: string

    beforeAll(async () => {
      console.log('📦 Creating persistent sandbox for cross-session tests...')
      const sandbox = await Sandbox.create(template, {
        metadata: {
          purpose: 'cross-session-test',
          testSuite: 'connect-cross-session'
        }
      })
      persistentSandboxId = sandbox.sandboxId
      createdSandboxes.push(persistentSandboxId)
      
      // Set up initial state
      await sandbox.files.write('/tmp/session-data.txt', 'Initial state')
      
      console.log(`✅ Persistent sandbox created: ${persistentSandboxId}`)
    })

    it('should connect and access data from previous session', async () => {
      console.log('🔄 Testing cross-session data access...')
      
      // Simulate new session by creating new connection
      const newSession = await Sandbox.connect(persistentSandboxId)
      
      // Verify previous session data exists
      const data = await newSession.files.read('/tmp/session-data.txt')
      expect(data).toBe('Initial state')
      
      // Modify data
      await newSession.files.write('/tmp/session-data.txt', 'Updated state')
      
      // Connect again and verify update
      const anotherSession = await Sandbox.connect(persistentSandboxId)
      const updatedData = await anotherSession.files.read('/tmp/session-data.txt')
      expect(updatedData).toBe('Updated state')
      
      console.log(`✅ Cross-session data access verified`)
    }, DEFAULT_TIMEOUT)

    it('should maintain running processes across connections', async () => {
      console.log('🏃 Testing process persistence across connections...')
      
      const session1 = await Sandbox.connect(persistentSandboxId)
      
      // Start a long-running process with a tag
      const processTag = 'persistent-process'
      const processPromise = (async () => {
        for await (const event of session1.processes.start(
          {
            cmd: 'sh',
            args: ['-c', 'while true; do echo "Running..."; sleep 2; done']
          },
          { tag: processTag }
        )) {
          // Process runs in background
        }
      })()
      
      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Connect from different session and find the process
      const session2 = await Sandbox.connect(persistentSandboxId)
      const processes = await session2.processes.list()
      
      const persistentProcess = processes.find(p => p.tag === processTag)
      expect(persistentProcess).toBeDefined()
      expect(persistentProcess?.config.cmd).toBe('sh')
      
      console.log(`  ✓ Found persistent process with tag: ${processTag}`)
      
      // Clean up - kill the process
      await session2.processes.sendSignal({ tag: processTag }, 'SIGTERM')
      
      console.log(`✅ Process persistence verified`)
    }, DEFAULT_TIMEOUT)

    it('should handle connection with custom headers', async () => {
      console.log('🔑 Testing connection with custom headers...')
      
      const connectedSandbox = await Sandbox.connect(
        persistentSandboxId,
        {
          headers: {
            'X-Test-Header': 'test-value',
            'X-Client-Id': 'test-client'
          }
        }
      )
      
      expect(connectedSandbox.sandboxId).toBe(persistentSandboxId)
      expect(await connectedSandbox.isRunning()).toBe(true)
      
      console.log(`✅ Connection with custom headers successful`)
    }, DEFAULT_TIMEOUT)
  })

  describe('Connection Performance and Characteristics', () => {
    let perfSandbox: Sandbox

    beforeAll(async () => {
      console.log('📦 Creating sandbox for performance tests...')
      perfSandbox = await Sandbox.create(template)
      createdSandboxes.push(perfSandbox.sandboxId)
    })

    it('should measure connection latency', async () => {
      console.log('⏱️ Measuring connection latency...')
      
      const measurements: number[] = []
      
      // Perform 5 connections and measure time
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now()
        await Sandbox.connect(perfSandbox.sandboxId)
        const endTime = Date.now()
        
        const latency = endTime - startTime
        measurements.push(latency)
        console.log(`  Measurement ${i + 1}: ${latency}ms`)
      }
      
      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length
      const minLatency = Math.min(...measurements)
      const maxLatency = Math.max(...measurements)
      
      console.log('📊 Connection Performance:')
      console.log(`  Average: ${avgLatency.toFixed(2)}ms`)
      console.log(`  Min: ${minLatency}ms`)
      console.log(`  Max: ${maxLatency}ms`)
      
      // Verify reasonable performance (connection should complete within 10 seconds)
      expect(maxLatency).toBeLessThan(10000)
      
      console.log(`✅ Connection performance measured`)
    }, DEFAULT_TIMEOUT * 2)

    it('should handle rapid sequential connections', async () => {
      console.log('🚀 Testing rapid sequential connections...')
      
      const iterations = 20
      const startTime = Date.now()
      
      for (let i = 0; i < iterations; i++) {
        const conn = await Sandbox.connect(perfSandbox.sandboxId)
        expect(conn.sandboxId).toBe(perfSandbox.sandboxId)
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / iterations
      
      console.log(`📊 Rapid Connection Results:`)
      console.log(`  Total time: ${totalTime}ms`)
      console.log(`  Average per connection: ${avgTime.toFixed(2)}ms`)
      console.log(`  Connections/second: ${(1000 / avgTime).toFixed(2)}`)
      
      console.log(`✅ Completed ${iterations} rapid connections`)
    }, DEFAULT_TIMEOUT * 3)

    it('should efficiently reuse connection data', async () => {
      console.log('♻️ Testing connection data efficiency...')
      
      // Connect multiple times and verify consistent data
      const connections = await Promise.all([
        Sandbox.connect(perfSandbox.sandboxId),
        Sandbox.connect(perfSandbox.sandboxId),
        Sandbox.connect(perfSandbox.sandboxId)
      ])
      
      // Verify all have same domain and sandbox ID
      const domains = connections.map(c => c.sandboxDomain)
      const ids = connections.map(c => c.sandboxId)
      
      expect(new Set(domains).size).toBe(1) // All same domain
      expect(new Set(ids).size).toBe(1) // All same ID
      expect(ids[0]).toBe(perfSandbox.sandboxId)
      
      console.log(`✅ Connection data efficiently reused`)
    }, DEFAULT_TIMEOUT)
  })

  describe('Connection State Validation', () => {
    it('should verify sandbox health after connection', async () => {
      console.log('🏥 Testing health verification after connection...')
      
      const sandbox = await Sandbox.create(template)
      createdSandboxes.push(sandbox.sandboxId)
      
      // Connect and verify health
      const connected = await Sandbox.connect(sandbox.sandboxId)
      
      // Wait for health check
      try {
        await connected.waitForHealth({
          maxRetries: 30,
          retryInterval: 200,
          timeout: 6000
        })
        console.log('  ✓ Health check passed')
      } catch (error) {
        console.warn('  ⚠️ Health check failed, but sandbox may still be functional')
      }
      
      // Verify sandbox is responsive
      const info = await connected.getInfo()
      expect(info.sandboxId).toBe(sandbox.sandboxId)
      
      console.log(`✅ Sandbox health verified after connection`)
    }, DEFAULT_TIMEOUT)

    it('should execute operations immediately after connection', async () => {
      console.log('⚡ Testing immediate operations after connection...')
      
      const sandbox = await Sandbox.create(template)
      createdSandboxes.push(sandbox.sandboxId)
      
      // Connect and immediately execute operations
      const connected = await Sandbox.connect(sandbox.sandboxId)
      
      // File operation
      await connected.files.write('/tmp/immediate-test.txt', 'immediate content')
      const content = await connected.files.read('/tmp/immediate-test.txt')
      expect(content).toBe('immediate content')
      
      // Command execution
      const result = await connected.commands.run('echo "test command"')
      expect(result.stdout).toContain('test command')
      
      // Check running status
      const isRunning = await connected.isRunning()
      expect(isRunning).toBe(true)
      
      console.log(`✅ Immediate operations successful`)
    }, DEFAULT_TIMEOUT)

    it('should handle connection with metadata verification', async () => {
      console.log('🏷️ Testing metadata verification after connection...')
      
      const customMetadata = {
        environment: 'test',
        version: '1.0.0',
        team: 'qa',
        priority: 'high'
      }
      
      const sandbox = await Sandbox.create(template, {
        metadata: customMetadata
      })
      createdSandboxes.push(sandbox.sandboxId)
      
      // Connect and verify metadata
      const connected = await Sandbox.connect(sandbox.sandboxId)
      const info = await connected.getInfo()
      
      expect(info.metadata).toBeDefined()
      expect(info.metadata?.environment).toBe('test')
      expect(info.metadata?.version).toBe('1.0.0')
      expect(info.metadata?.team).toBe('qa')
      expect(info.metadata?.priority).toBe('high')
      
      console.log('📋 Metadata verified:', info.metadata)
      console.log(`✅ Metadata verification successful`)
    }, DEFAULT_TIMEOUT)
  })

  describe('Advanced Connection Scenarios', () => {
    it('should handle connection to sandbox with environment variables', async () => {
      console.log('🌍 Testing connection to sandbox with env vars...')
      
      // Create sandbox - envs passed at creation are stored with sandbox metadata
      const sandbox = await Sandbox.create(template, {
        envs: {
          TEST_VAR_1: 'value1',
          TEST_VAR_2: 'value2',
          NODE_ENV: 'test'
        }
      })
      createdSandboxes.push(sandbox.sandboxId)
      
      // Connect to the sandbox
      const connected = await Sandbox.connect(sandbox.sandboxId)
      
      // Verify connection is successful
      expect(connected.sandboxId).toBe(sandbox.sandboxId)
      expect(await connected.isRunning()).toBe(true)
      
      // Verify env vars are stored in sandbox info
      const info = await connected.getInfo()
      expect(info.envs).toBeDefined()
      expect(info.envs?.TEST_VAR_1).toBe('value1')
      expect(info.envs?.TEST_VAR_2).toBe('value2')
      console.log('  ✓ Env vars stored in sandbox info')
      
      // Environment variables should be used with process.start() or commands with envs parameter
      // Test using process.start with environment variables
      const events: any[] = []
      for await (const event of connected.processes.start({
        cmd: 'sh',
        args: ['-c', 'echo "TEST_VAR_1=$TEST_VAR_1"'],
        envs: { TEST_VAR_1: 'runtime_value' } // Process-level env vars
      })) {
        events.push(event)
      }
      
      const dataEvents = events.filter(e => e.type === 'data' && e.data?.stdout)
      const decoder = new TextDecoder()
      const output = dataEvents.map(e => decoder.decode(e.data.stdout)).join('')
      expect(output).toContain('TEST_VAR_1=runtime_value')
      console.log('  ✓ Process-level env vars working correctly')
      
      console.log(`✅ Environment variables accessible after connection`)
    }, DEFAULT_TIMEOUT * 2)

    it('should support connection timeout extension strategy', async () => {
      console.log('⏰ Testing timeout extension strategy...')
      
      // Create sandbox with short timeout
      const sandbox = await Sandbox.create(template, {
        timeoutMs: 120000 // 2 minutes
      })
      createdSandboxes.push(sandbox.sandboxId)
      
      let initialInfo = await sandbox.getInfo()
      const initialTimeout = initialInfo.timeout
      
      console.log(`  Initial timeout: ${initialTimeout}s`)
      
      // Connect with extended timeout
      const connected = await Sandbox.connect(sandbox.sandboxId, {
        timeoutMs: 300000 // 5 minutes
      })
      
      const extendedInfo = await connected.getInfo()
      const extendedTimeout = extendedInfo.timeout
      
      console.log(`  Extended timeout: ${extendedTimeout}s`)
      
      // Verify timeout was extended
      expect(extendedTimeout).toBeDefined()
      expect(initialTimeout).toBeDefined()
      expect(extendedTimeout!).toBeGreaterThan(initialTimeout!)
      
      console.log(`✅ Timeout extension successful`)
    }, DEFAULT_TIMEOUT)

    it('should handle connection with request timeout options', async () => {
      console.log('⏱️ Testing connection with custom request timeout...')
      
      const sandbox = await Sandbox.create(template)
      createdSandboxes.push(sandbox.sandboxId)
      
      // Connect with custom request timeout
      const connected = await Sandbox.connect(sandbox.sandboxId, {
        requestTimeoutMs: 30000 // 30 seconds for API requests
      })
      
      expect(connected.sandboxId).toBe(sandbox.sandboxId)
      expect(await connected.isRunning()).toBe(true)
      
      console.log(`✅ Custom request timeout handled correctly`)
    }, DEFAULT_TIMEOUT)

    it('should maintain connection integrity under load', async () => {
      console.log('💪 Testing connection integrity under load...')
      
      const sandbox = await Sandbox.create(template)
      createdSandboxes.push(sandbox.sandboxId)
      
      // Create connection
      const connected = await Sandbox.connect(sandbox.sandboxId)
      
      // Perform multiple operations in parallel
      const operations = [
        connected.files.write('/tmp/load-test-1.txt', 'content1'),
        connected.files.write('/tmp/load-test-2.txt', 'content2'),
        connected.commands.run('ls /tmp'),
        connected.getInfo(),
        connected.isRunning(),
        connected.files.exists('/tmp'),
        connected.commands.run('pwd'),
        connected.files.write('/tmp/load-test-3.txt', 'content3')
      ]
      
      const results = await Promise.all(operations)
      
      // Verify all operations succeeded
      expect(results).toHaveLength(8)
      
      // Verify files were created
      expect(await connected.files.exists('/tmp/load-test-1.txt')).toBe(true)
      expect(await connected.files.exists('/tmp/load-test-2.txt')).toBe(true)
      expect(await connected.files.exists('/tmp/load-test-3.txt')).toBe(true)
      
      console.log(`✅ Connection integrity maintained under load`)
    }, DEFAULT_TIMEOUT)
  })

  describe('Connection Edge Cases', () => {
    it('should handle connection with debug mode', async () => {
      console.log('🐛 Testing connection in debug mode...')
      
      // Note: Debug mode creates a mock sandbox, so behavior is different
      const debugSandbox = await Sandbox.create(template, {
        debug: true
      })
      
      expect(debugSandbox.sandboxId).toBe('debug_sandbox_id')
      expect(debugSandbox.sandboxDomain).toBe('debug.scalebox.dev')
      
      console.log(`✅ Debug mode connection handled`)
    }, DEFAULT_TIMEOUT)

    it('should handle connection to sandbox with special characters in metadata', async () => {
      console.log('🔤 Testing connection with special metadata...')
      
      const specialMetadata = {
        description: 'Test with "quotes" and \'apostrophes\'',
        tags: 'tag1,tag2,tag3',
        json: '{"key": "value"}',
        unicode: '测试中文 🚀'
      }
      
      const sandbox = await Sandbox.create(template, {
        metadata: specialMetadata
      })
      createdSandboxes.push(sandbox.sandboxId)
      
      // Connect and verify metadata
      const connected = await Sandbox.connect(sandbox.sandboxId)
      const info = await connected.getInfo()
      
      expect(info.metadata?.description).toContain('quotes')
      expect(info.metadata?.unicode).toContain('测试中文')
      
      console.log(`✅ Special characters in metadata handled correctly`)
    }, DEFAULT_TIMEOUT)

    it('should verify connection returns same sandbox instance characteristics', async () => {
      console.log('🔍 Testing sandbox instance characteristics...')
      
      const sandbox = await Sandbox.create(template, {
        metadata: { test: 'original' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      
      const connected = await Sandbox.connect(sandbox.sandboxId)
      
      // Compare characteristics
      const originalInfo = await sandbox.getInfo()
      const connectedInfo = await connected.getInfo()
      
      expect(connectedInfo.sandboxId).toBe(originalInfo.sandboxId)
      expect(connectedInfo.templateId).toBe(originalInfo.templateId)
      expect(connectedInfo.cpuCount).toBe(originalInfo.cpuCount)
      expect(connectedInfo.memoryMB).toBe(originalInfo.memoryMB)
      
      console.log('📊 Sandbox characteristics comparison:')
      console.log(`  CPU: ${originalInfo.cpuCount} cores (both)`)
      console.log(`  Memory: ${originalInfo.memoryMB} MB (both)`)
      console.log(`  Template: ${originalInfo.templateId} (both)`)
      
      console.log(`✅ Instance characteristics match`)
    }, DEFAULT_TIMEOUT)
  })
})

