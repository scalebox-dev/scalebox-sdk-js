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

    // NOTE: This test is skipped because the backend implementation is not yet available.
    // It should be enabled once the backend supports sandbox connection functionality.
    it.skip('should connect to existing sandbox', async () => {
      console.log('🔌 Connecting to existing sandbox...')
      
      const connectedSandbox = await Sandbox.connect(testSandbox.sandboxId)
      
      expect(connectedSandbox.sandboxId).toBe(testSandbox.sandboxId)
      console.log(`✅ Connection successful: ${connectedSandbox.sandboxId}`)
    })
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
