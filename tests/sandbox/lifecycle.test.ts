import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Sandbox } from '../../src'

// Uses environment variables (SCALEBOX_API_KEY must be set before running)

describe('Sandbox Lifecycle Management', () => {
  let createdSandboxes: string[] = []

  beforeAll(() => {
    // Verify environment variable configuration
    if (!process.env.SCALEBOX_API_KEY) {
      throw new Error('Please set SCALEBOX_API_KEY environment variable')
    }
    
    console.log('🔧 API Configuration:')
    console.log('  API URL:', process.env.SCALEBOX_API_URL || 'https://api.scalebox.dev')
    console.log('  Domain:', process.env.SCALEBOX_DOMAIN || 'scalebox.dev')
    console.log('  API Key:', process.env.SCALEBOX_API_KEY ? 'Configured' : 'Not configured')
  })

  afterAll(async () => {
    // Clean up created sandboxes
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

  describe('Parameter Conversion Validation', () => {
    it('should correctly convert camelCase to snake_case', async () => {
      console.log('🧪 Testing parameter conversion logic...')
      
      // Use code-interpreter template for testing (skip base template)
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 300000, // 5 minutes
        metadata: { 
          testType: 'parameterConversion',
          timestamp: new Date().toISOString()
        },
        envs: {
          TEST_VAR: 'conversion-test',
          NODE_ENV: 'test'
        },
        allowInternetAccess: true,
        secure: true
      })
      
      createdSandboxes.push(sandbox.sandboxId)
      
      expect(sandbox.sandboxId).toBeDefined()
      console.log(`✅ Sandbox created successfully: ${sandbox.sandboxId}`)
      
      // Verify returned information format is correct
      const info = await sandbox.getInfo()
      expect(info.sandboxId).toBe(sandbox.sandboxId)
      expect(info.metadata).toBeDefined()
      
      console.log('📋 Sandbox information:', {
        sandboxId: info.sandboxId,
        templateId: info.templateId,
        status: info.status,
        metadata: info.metadata
      })
    }, 60000)

    it('should handle minimal parameter set', async () => {
      console.log('🧪 Testing minimal parameter set...')
      
      // Use only required parameters
      const sandbox = await Sandbox.create('code-interpreter')
      createdSandboxes.push(sandbox.sandboxId)
      
      expect(sandbox.sandboxId).toBeDefined()
      expect(sandbox.sandboxDomain).toBeDefined()
      
      console.log(`✅ Minimal parameter creation successful: ${sandbox.sandboxId}`)
    }, 60000)

    it('should correctly handle timeout validation', async () => {
      console.log('🧪 Testing timeout validation...')
      
      // Test minimum timeout limit
      await expect(
        Sandbox.create('code-interpreter', { timeoutMs: 30000 }) // 30 seconds, below minimum
      ).rejects.toThrow('Timeout must be at least 60 seconds')
      
      // Test maximum timeout limit
      await expect(
        Sandbox.create('code-interpreter', { timeoutMs: 4000000 }) // Over 1 hour
      ).rejects.toThrow('Timeout cannot exceed 3600 seconds')
      
      console.log('✅ Timeout validation working correctly')
    })
  })

  describe('Connection and Status Management', () => {
    let testSandbox: Sandbox

    beforeAll(async () => {
      console.log('📦 Creating test sandbox...')
      testSandbox = await Sandbox.create('code-interpreter', {
        metadata: { purpose: 'connection-test' }
      })
      createdSandboxes.push(testSandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${testSandbox.sandboxId}`)
    })

    it('should get sandbox information', async () => {
      console.log('📋 Getting sandbox information...')
      
      const info = await testSandbox.getInfo()
      
      expect(info.sandboxId).toBe(testSandbox.sandboxId)
      expect(info.status).toBeDefined()
      expect(info.templateId).toBeDefined()
      
      console.log('📊 Sandbox status:', {
        id: info.sandboxId,
        status: info.status,
        templateId: info.templateId,
        startedAt: info.startedAt
      })
    })

    it('should check running status', async () => {
      console.log('🔍 Checking running status...')
      
      const isRunning = await testSandbox.isRunning()
      console.log(`🏃 Running status: ${isRunning}`)
      
      expect(typeof isRunning).toBe('boolean')
    })

    it('should connect to existing sandbox', async () => {
      console.log('🔌 Connecting to existing sandbox...')
      
      const connectedSandbox = await Sandbox.connect(testSandbox.sandboxId)
      
      expect(connectedSandbox.sandboxId).toBe(testSandbox.sandboxId)
      expect(connectedSandbox.sandboxDomain).toBeDefined()
      expect(connectedSandbox.envdAccessToken).toBeDefined()
      
      // Verify the connected sandbox is functional
      const isRunning = await connectedSandbox.isRunning()
      expect(isRunning).toBe(true)
      
      console.log(`✅ Connection successful: ${connectedSandbox.sandboxId}`)
      console.log(`   Domain: ${connectedSandbox.sandboxDomain}`)
      console.log(`   Status: running`)
    })
  })

  describe('Pause and Resume Operations', () => {
    // Each test creates its own sandbox to avoid state interference

    it('should pause a running sandbox', async () => {
      console.log('⏸️ Testing pause operation...')
      
      // Create a fresh sandbox for this test
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 600000,
        metadata: { purpose: 'pause-test' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${sandbox.sandboxId}`)
      
      // Verify sandbox is running
      const isRunningBefore = await sandbox.isRunning()
      expect(isRunningBefore).toBe(true)
      console.log(`   Status before pause: running`)
      
      // Pause the sandbox - backend returns after state transition is complete
      const paused = await sandbox.betaPause()
      expect(paused).toBe(true)
      console.log(`✅ Sandbox pause completed`)
      
      // Verify sandbox is paused (backend guarantees state is paused when API returns)
      const info = await sandbox.getInfo()
      expect(info.status).toBe('paused')
      
      const isRunningAfter = await sandbox.isRunning()
      expect(isRunningAfter).toBe(false)
      console.log(`   Status after pause: ${info.status}`)
    }, 90000)

    it('should resume a paused sandbox using connect', async () => {
      console.log('▶️ Testing resume operation via connect...')
      
      // Create a fresh sandbox for this test
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 600000,
        metadata: { purpose: 'resume-test' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${sandbox.sandboxId}`)
      
      // Pause the sandbox first
      const paused = await sandbox.betaPause()
      expect(paused).toBe(true)
      
      // Verify sandbox is paused (backend guarantees state is paused when API returns)
      const infoBefore = await sandbox.getInfo()
      expect(infoBefore.status).toBe('paused')
      console.log(`   Status before resume: ${infoBefore.status}`)
      
      // Resume using connect (unified endpoint) - backend returns after state transition is complete
      await sandbox.connect()
      console.log(`✅ Sandbox connection completed (auto-resumed)`)
      
      // Verify sandbox is running (backend guarantees state is running when API returns)
      const infoAfter = await sandbox.getInfo()
      expect(infoAfter.status).toBe('running')
      
      const isRunningAfter = await sandbox.isRunning()
      expect(isRunningAfter).toBe(true)
      console.log(`   Status after resume: ${infoAfter.status}`)
    }, 120000)

    it('should reject pause on already paused sandbox', async () => {
      console.log('⏸️ Testing double pause rejection...')
      
      // Create a fresh sandbox for this test
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 600000,
        metadata: { purpose: 'double-pause-test' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${sandbox.sandboxId}`)
      
      // Pause the sandbox first
      const paused = await sandbox.betaPause()
      expect(paused).toBe(true)
      
      // Verify sandbox is paused (backend guarantees state is paused when API returns)
      const info = await sandbox.getInfo()
      expect(info.status).toBe('paused')
      console.log(`   Current status: ${info.status}`)
      
      // Try to pause again - should be rejected by backend
      await expect(sandbox.betaPause()).rejects.toThrow()
      console.log(`✅ Double pause correctly rejected`)
      
      // Verify sandbox is still paused
      const infoAfter = await sandbox.getInfo()
      expect(infoAfter.status).toBe('paused')
      console.log(`   Status after rejected pause: ${infoAfter.status}`)
    }, 60000)

    it('should resume paused sandbox with timeout update', async () => {
      console.log('⏸️ Pausing sandbox for timeout update test...')
      
      // Create a fresh sandbox for this test
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 600000,
        metadata: { purpose: 'timeout-update-test' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${sandbox.sandboxId}`)
      
      // Pause the sandbox - backend returns after state transition is complete
      await sandbox.betaPause()
      
      // Verify sandbox is paused (backend guarantees state is paused when API returns)
      const infoBefore = await sandbox.getInfo()
      expect(infoBefore.status).toBe('paused')
      console.log(`   Status before resume: ${infoBefore.status}`)
      
      // Resume with new timeout - backend returns after state transition is complete
      const newTimeoutMs = 900000 // 15 minutes
      await sandbox.connect({ timeoutMs: newTimeoutMs })
      console.log(`✅ Sandbox resumed with new timeout: ${newTimeoutMs}ms`)
      
      // Verify sandbox is running (backend guarantees state is running when API returns)
      const infoAfter = await sandbox.getInfo()
      expect(infoAfter.status).toBe('running')
      
      const isRunningAfter = await sandbox.isRunning()
      expect(isRunningAfter).toBe(true)
      console.log(`   Status after resume: ${infoAfter.status}`)
    }, 120000)

    it('should connect to paused sandbox using static connect method', async () => {
      console.log('⏸️ Pausing sandbox for static connect test...')
      
      // Create a fresh sandbox for this test
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 600000,
        metadata: { purpose: 'static-connect-test' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${sandbox.sandboxId}`)
      
      // Pause the sandbox - backend returns after state transition is complete
      await sandbox.betaPause()
      
      // Verify sandbox is paused (backend guarantees state is paused when API returns)
      const infoBefore = await sandbox.getInfo()
      expect(infoBefore.status).toBe('paused')
      console.log(`   Status before static connect: ${infoBefore.status}`)
      
      // Use static connect method (should auto-resume) - backend returns after state transition is complete
      const connectedSandbox = await Sandbox.connect(sandbox.sandboxId)
      expect(connectedSandbox.sandboxId).toBe(sandbox.sandboxId)
      console.log(`✅ Static connect successful (auto-resumed)`)
      
      // Verify sandbox is running (backend guarantees state is running when API returns)
      const isRunning = await connectedSandbox.isRunning()
      expect(isRunning).toBe(true)
      
      const infoAfter = await connectedSandbox.getInfo()
      expect(infoAfter.status).toBe('running')
      console.log(`   Status after static connect: ${infoAfter.status}`)
    }, 120000)

    it('should preserve sandbox functionality after pause/resume', async () => {
      console.log('🧪 Testing functionality preservation after pause/resume...')
      
      // Create a fresh sandbox for this test
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 600000,
        metadata: { purpose: 'functionality-preservation-test' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      console.log(`✅ Test sandbox created: ${sandbox.sandboxId}`)
      
      // Execute a command before pause
      const resultBefore = await sandbox.commands.run('echo "test-before-pause"')
      expect(resultBefore.stdout).toContain('test-before-pause')
      console.log(`   Command before pause: ✅`)
      
      // Pause - backend returns after state transition is complete
      await sandbox.betaPause()
      const pausedInfo = await sandbox.getInfo()
      expect(pausedInfo.status).toBe('paused')
      console.log(`   Sandbox paused`)
      
      // Resume - backend returns after state transition is complete
      await sandbox.connect()
      const resumedInfo2 = await sandbox.getInfo()
      expect(resumedInfo2.status).toBe('running')
      console.log(`   Sandbox resumed`)
      
      // Execute a command after resume
      const resultAfter = await sandbox.commands.run('echo "test-after-resume"')
      expect(resultAfter.stdout).toContain('test-after-resume')
      console.log(`   Command after resume: ✅`)
      
      console.log(`✅ Functionality preserved after pause/resume`)
    }, 120000)
  })

  describe('autoPause (lifecycle)', () => {
    it('should default autoPause to false when not specified', async () => {
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 300000,
        metadata: { purpose: 'autopause-default-lifecycle' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      const info = await sandbox.getInfo()
      expect(info.autoPause).toBe(false)
    }, 60000)

    it('should reflect autoPause in getInfo when created with autoPause: true', async () => {
      const sandbox = await Sandbox.create('code-interpreter', {
        timeoutMs: 300000,
        autoPause: true,
        metadata: { purpose: 'autopause-enabled-lifecycle' }
      })
      createdSandboxes.push(sandbox.sandboxId)
      const info = await sandbox.getInfo()
      expect(info.autoPause).toBe(true)
    }, 60000)
  })

  describe('Error Handling Validation', () => {
    it('should correctly handle non-existent sandbox', async () => {
      console.log('🧪 Testing non-existent sandbox connection...')
      
      await expect(
        Sandbox.connect('non-existent-sandbox-id')
      ).rejects.toThrow()
      
      console.log('✅ Correctly handled non-existent sandbox')
    })

    it('should correctly handle invalid template', async () => {
      console.log('🧪 Testing invalid template...')
      
      await expect(
        Sandbox.create('invalid-template-name')
      ).rejects.toThrow()
      
      console.log('✅ Correctly handled invalid template')
    })
  })
})
