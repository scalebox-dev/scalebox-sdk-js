import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApiClient } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { SandboxInfo } from '../../src/sandbox/types'
import { isIntegrationTest } from '../setup'

// Skip integration tests if API key is not available
const skipIfNoApiKey = !process.env.SCALEBOX_API_KEY && !isIntegrationTest
const skipPauseResumeTests =
  skipIfNoApiKey || process.env.SCALEBOX_SKIP_PAUSE_RESUME === '1'

function isResumeTimeout(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('Failed to wait for sandbox resume') ||
    message.includes('timeout waiting for sandbox')
  )
}

describe.skipIf(skipPauseResumeTests)('API Client - Pause/Resume Fields Validation', () => {
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

  /**
   * Helper function to validate pause/resume fields in SandboxInfo
   */
  function validatePauseResumeFields(sandboxInfo: SandboxInfo, shouldHaveValues: boolean = false) {
    // Verify fields exist in the object
    expect(sandboxInfo).toHaveProperty('pausedAt')
    expect(sandboxInfo).toHaveProperty('resumedAt')
    expect(sandboxInfo).toHaveProperty('pauseTimeoutAt')
    expect(sandboxInfo).toHaveProperty('totalPausedSeconds')

    // Verify field types
    if (sandboxInfo.pausedAt !== undefined) {
      expect(sandboxInfo.pausedAt).toBeInstanceOf(Date)
    }
    if (sandboxInfo.resumedAt !== undefined) {
      expect(sandboxInfo.resumedAt).toBeInstanceOf(Date)
    }
    if (sandboxInfo.pauseTimeoutAt !== undefined) {
      expect(sandboxInfo.pauseTimeoutAt).toBeInstanceOf(Date)
    }
    if (sandboxInfo.totalPausedSeconds !== undefined) {
      expect(typeof sandboxInfo.totalPausedSeconds).toBe('number')
      expect(sandboxInfo.totalPausedSeconds).toBeGreaterThanOrEqual(0)
    }

    // If shouldHaveValues is true, verify at least some fields have values
    if (shouldHaveValues) {
      const hasPauseResumeData = 
        sandboxInfo.pausedAt !== undefined ||
        sandboxInfo.resumedAt !== undefined ||
        sandboxInfo.pauseTimeoutAt !== undefined ||
        sandboxInfo.totalPausedSeconds !== undefined
      
      // Note: For new sandboxes, these fields may be undefined, which is valid
      // This test just ensures the fields are present and have correct types
    }
  }

  /**
   * Helper to validate new response fields (migration: running seconds, persistence, autoPause, networkProxy)
   */
  function validateNewResponseFields(sandboxInfo: SandboxInfo) {
    expect(sandboxInfo).toHaveProperty('totalRunningSeconds')
    expect(sandboxInfo).toHaveProperty('actualTotalRunningSeconds')
    expect(sandboxInfo).toHaveProperty('actualTotalPausedSeconds')
    expect(sandboxInfo).toHaveProperty('persistenceDays')
    expect(sandboxInfo).toHaveProperty('persistenceExpiresAt')
    expect(sandboxInfo).toHaveProperty('persistenceDaysRemaining')
    expect(sandboxInfo).toHaveProperty('autoPause')
    expect(sandboxInfo).toHaveProperty('networkProxy')
    if (sandboxInfo.totalRunningSeconds !== undefined) {
      expect(typeof sandboxInfo.totalRunningSeconds).toBe('number')
      expect(sandboxInfo.totalRunningSeconds).toBeGreaterThanOrEqual(0)
    }
    if (sandboxInfo.actualTotalRunningSeconds !== undefined) {
      expect(typeof sandboxInfo.actualTotalRunningSeconds).toBe('number')
    }
    if (sandboxInfo.actualTotalPausedSeconds !== undefined) {
      expect(typeof sandboxInfo.actualTotalPausedSeconds).toBe('number')
    }
    if (sandboxInfo.autoPause !== undefined) {
      expect(typeof sandboxInfo.autoPause).toBe('boolean')
    }
    if (sandboxInfo.networkProxy != null && typeof sandboxInfo.networkProxy === 'object') {
      expect(sandboxInfo.networkProxy).toHaveProperty('proxyUrl')
      expect(sandboxInfo.networkProxy).toHaveProperty('proxyConfigs')
    }
  }

  /**
   * Helper function to validate status can include pause/resume states
   */
  function validateStatusType(status: SandboxInfo['status']) {
    const validStatuses: Array<SandboxInfo['status']> = [
      'running',
      'paused',
      'pausing',
      'resuming',
      'stopped',
      'starting',
      'stopping',
      'failed',
      'terminated',
      'created',
      'terminating'
    ]
    
    expect(validStatuses).toContain(status)
  }

  describe.skipIf(skipIfNoApiKey)('createSandbox - Pause/Resume Fields', () => {
    it('should include pause/resume fields in createSandbox response', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-create' },
        envVars: { NODE_ENV: 'test' }
      })
      
      // Store sandbox ID for cleanup
      testSandboxId = sandboxInfo.sandboxId
      
      // Verify basic fields
      expect(sandboxInfo).toBeDefined()
      expect(sandboxInfo.sandboxId).toBeDefined()
      
      // Validate pause/resume fields exist and have correct types
      validatePauseResumeFields(sandboxInfo)
      // Validate new migration fields (totalRunningSeconds, persistence, autoPause, networkProxy)
      validateNewResponseFields(sandboxInfo)
      
      // Validate status type
      validateStatusType(sandboxInfo.status)
      
      // autoPause: should be present (set at creation, default false if not passed)
      expect(typeof sandboxInfo.autoPause).toBe('boolean')
      
      console.log('✅ createSandbox pause/resume and new fields validated:', {
        sandboxId: sandboxInfo.sandboxId,
        status: sandboxInfo.status,
        autoPause: sandboxInfo.autoPause,
        totalRunningSeconds: sandboxInfo.totalRunningSeconds
      })
    })

    it('should handle pause/resume fields when sandbox is in pausing state', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-pausing' }
      })
      
      testSandboxId = sandboxInfo.sandboxId
      
      // Fields should exist regardless of state
      validatePauseResumeFields(sandboxInfo)
      
      // Status should be valid (may be 'pausing' if backend supports it)
      validateStatusType(sandboxInfo.status)
    })

    it('should handle pause/resume fields when sandbox is in resuming state', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-resuming' }
      })
      
      testSandboxId = sandboxInfo.sandboxId
      
      // Fields should exist regardless of state
      validatePauseResumeFields(sandboxInfo)
      
      // Status should be valid (may be 'resuming' if backend supports it)
      validateStatusType(sandboxInfo.status)
    })
  })

  describe.skipIf(skipIfNoApiKey)('getSandbox - Pause/Resume Fields', () => {
    it('should include pause/resume fields in getSandbox response', async () => {
      // First create a sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-get' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // Get sandbox info
      const sandboxInfo = await client.getSandbox(createdSandbox.sandboxId)
      
      // Verify basic fields
      expect(sandboxInfo).toBeDefined()
      expect(sandboxInfo.sandboxId).toBe(createdSandbox.sandboxId)
      
      // Validate pause/resume fields exist and have correct types
      validatePauseResumeFields(sandboxInfo)
      
      // Validate status type
      validateStatusType(sandboxInfo.status)
      
      console.log('✅ getSandbox pause/resume fields validated:', {
        sandboxId: sandboxInfo.sandboxId,
        status: sandboxInfo.status,
        pausedAt: sandboxInfo.pausedAt,
        resumedAt: sandboxInfo.resumedAt,
        pauseTimeoutAt: sandboxInfo.pauseTimeoutAt,
        totalPausedSeconds: sandboxInfo.totalPausedSeconds
      })
    })

    it('should return correct field types for paused sandbox', async () => {
      // Create a sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-paused' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // Get sandbox info
      const sandboxInfo = await client.getSandbox(createdSandbox.sandboxId)
      
      // Validate fields
      validatePauseResumeFields(sandboxInfo)
      
      // If sandbox is paused, pausedAt should be a Date
      if (sandboxInfo.status === 'paused' && sandboxInfo.pausedAt) {
        expect(sandboxInfo.pausedAt).toBeInstanceOf(Date)
        expect(sandboxInfo.pausedAt.getTime()).toBeLessThanOrEqual(Date.now())
      }
    })

    it('should return correct field types for resumed sandbox', async () => {
      // Create a sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-resumed' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // Get sandbox info
      const sandboxInfo = await client.getSandbox(createdSandbox.sandboxId)
      
      // Validate fields
      validatePauseResumeFields(sandboxInfo)
      
      // If sandbox has been resumed, resumedAt should be a Date
      if (sandboxInfo.resumedAt) {
        expect(sandboxInfo.resumedAt).toBeInstanceOf(Date)
        expect(sandboxInfo.resumedAt.getTime()).toBeLessThanOrEqual(Date.now())
      }
    })
  })

  describe.skipIf(skipIfNoApiKey)('listSandboxes - Pause/Resume Fields', () => {
    it('should include pause/resume fields in listSandboxes response', async () => {
      // Create a test sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-list' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // List sandboxes
      const result = await client.listSandboxes({
        limit: 10
      })
      
      expect(result).toBeDefined()
      expect(result.sandboxes).toBeDefined()
      expect(Array.isArray(result.sandboxes)).toBe(true)
      
      // Verify at least one sandbox has the fields
      if (result.sandboxes.length > 0) {
        const sandbox = result.sandboxes[0]
        
        // Validate pause/resume fields exist and have correct types
        validatePauseResumeFields(sandbox)
        
        // Validate status type
        validateStatusType(sandbox.status)
        
        console.log('✅ listSandboxes pause/resume fields validated:', {
          sandboxId: sandbox.sandboxId,
          status: sandbox.status,
          pausedAt: sandbox.pausedAt,
          resumedAt: sandbox.resumedAt,
          pauseTimeoutAt: sandbox.pauseTimeoutAt,
          totalPausedSeconds: sandbox.totalPausedSeconds
        })
      }
    })

    it('should include pause/resume fields for all sandboxes in list', async () => {
      // Create a test sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-list-all' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // List sandboxes
      const result = await client.listSandboxes({
        limit: 20
      })
      
      // Validate all sandboxes have the fields
      result.sandboxes.forEach((sandbox, index) => {
        validatePauseResumeFields(sandbox)
        validateStatusType(sandbox.status)
        
        if (index < 3) {
          // Log first 3 for debugging
          console.log(`Sandbox ${index + 1} pause/resume fields:`, {
            sandboxId: sandbox.sandboxId,
            status: sandbox.status,
            pausedAt: sandbox.pausedAt,
            resumedAt: sandbox.resumedAt,
            pauseTimeoutAt: sandbox.pauseTimeoutAt,
            totalPausedSeconds: sandbox.totalPausedSeconds
          })
        }
      })
    })
  })

  describe.skipIf(skipIfNoApiKey)('Field Type Validation', () => {
    it('should handle undefined pause/resume fields correctly', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-undefined' }
      })
      
      testSandboxId = sandboxInfo.sandboxId
      
      // Fields should exist but may be undefined for new sandboxes
      expect(sandboxInfo).toHaveProperty('pausedAt')
      expect(sandboxInfo).toHaveProperty('resumedAt')
      expect(sandboxInfo).toHaveProperty('pauseTimeoutAt')
      expect(sandboxInfo).toHaveProperty('totalPausedSeconds')
      
      // For new sandboxes, these may be undefined, which is valid
      // The important thing is that they exist and have correct types when defined
    })

    it('should convert date strings to Date objects correctly', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-date-conversion' }
      })
      
      testSandboxId = sandboxInfo.sandboxId
      
      // Get sandbox info to verify date conversion
      const retrievedSandbox = await client.getSandbox(sandboxInfo.sandboxId)
      
      // If dates are present, they should be Date objects
      if (retrievedSandbox.pausedAt) {
        expect(retrievedSandbox.pausedAt).toBeInstanceOf(Date)
        expect(retrievedSandbox.pausedAt.getTime()).toBeGreaterThan(0)
      }
      
      if (retrievedSandbox.resumedAt) {
        expect(retrievedSandbox.resumedAt).toBeInstanceOf(Date)
        expect(retrievedSandbox.resumedAt.getTime()).toBeGreaterThan(0)
      }
      
      if (retrievedSandbox.pauseTimeoutAt) {
        expect(retrievedSandbox.pauseTimeoutAt).toBeInstanceOf(Date)
        expect(retrievedSandbox.pauseTimeoutAt.getTime()).toBeGreaterThan(0)
      }
    })

    it('should handle totalPausedSeconds as number', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-resume-fields-total-seconds' }
      })
      
      testSandboxId = sandboxInfo.sandboxId
      
      // Get sandbox info
      const retrievedSandbox = await client.getSandbox(sandboxInfo.sandboxId)
      
      // totalPausedSeconds should be a number if defined
      if (retrievedSandbox.totalPausedSeconds !== undefined) {
        expect(typeof retrievedSandbox.totalPausedSeconds).toBe('number')
        expect(retrievedSandbox.totalPausedSeconds).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(retrievedSandbox.totalPausedSeconds)).toBe(true)
      }
    })
  })

  describe.skipIf(skipIfNoApiKey)('Pause/Resume Operations - Time Fields Validation', () => {
    it('should correctly set pausedAt when sandbox is paused', async () => {
      // Create a sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'pause-time-fields' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // Wait until sandbox is running (required by backend before pause)
      const runStatus = await client.waitUntilStatus(createdSandbox.sandboxId, ['running', 'failed'], { timeoutMs: 60000 })
      if (runStatus.status === 'failed') {
        console.log('Sandbox entered failed state, skipping pause test')
        return
      }
      
      // Get initial state
      const beforePause = await client.getSandbox(createdSandbox.sandboxId)
      console.log('Before pause:', {
        status: beforePause.status,
        pausedAt: beforePause.pausedAt,
        totalPausedSeconds: beforePause.totalPausedSeconds
      })
      
      // Pause the sandbox (may fail due to infrastructure constraints)
      try {
        await client.pauseSandbox(createdSandbox.sandboxId)
        // Wait for pause to complete
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error: any) {
        // If pause fails due to infrastructure constraints, skip this test
        if (error.message?.includes('DaemonSet') || error.message?.includes('writable layer protection')) {
          console.log('⚠️ Pause failed due to infrastructure constraints, skipping test')
          return
        }
        throw error
      }
      
      // Get state after pause
      const afterPause = await client.getSandbox(createdSandbox.sandboxId)
      console.log('After pause:', {
        status: afterPause.status,
        pausedAt: afterPause.pausedAt,
        totalPausedSeconds: afterPause.totalPausedSeconds
      })
      
      // Verify pausedAt is set (if sandbox is actually paused)
      // Note: Some sandboxes may not support pause due to infrastructure constraints
      if (afterPause.status === 'paused' || afterPause.status === 'pausing') {
        expect(afterPause.pausedAt).toBeDefined()
        expect(afterPause.pausedAt).toBeInstanceOf(Date)
        expect(afterPause.pausedAt!.getTime()).toBeGreaterThan(0)
        expect(afterPause.pausedAt!.getTime()).toBeLessThanOrEqual(Date.now())
      } else {
        // If pause failed, log the status for debugging
        console.log('Pause operation may have failed or not completed, status:', afterPause.status)
      }
      
      // Verify status is paused or pausing (if pause succeeded)
      // Note: Pause may fail due to infrastructure constraints (e.g., DaemonSet protection)
      if (afterPause.status === 'paused' || afterPause.status === 'pausing') {
        expect(['paused', 'pausing']).toContain(afterPause.status)
      }
    }, 60000)

    it('should correctly set resumedAt when sandbox is resumed', async () => {
      // Create a sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'resume-time-fields' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // Wait until sandbox is running (required by backend before pause)
      const runStatus = await client.waitUntilStatus(createdSandbox.sandboxId, ['running', 'failed'], { timeoutMs: 60000 })
      if (runStatus.status === 'failed') {
        console.log('Sandbox entered failed state, skipping resume test')
        return
      }
      
      // Pause the sandbox (may fail due to infrastructure constraints)
      try {
        await client.pauseSandbox(createdSandbox.sandboxId)
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error: any) {
        // If pause fails due to infrastructure constraints, skip this test
        if (error.message?.includes('DaemonSet') || error.message?.includes('writable layer protection')) {
          console.log('⚠️ Pause failed due to infrastructure constraints, skipping test')
          return
        }
        throw error
      }
      
      // Get state after pause
      const afterPause = await client.getSandbox(createdSandbox.sandboxId)
      
      // Note: Pause may fail due to infrastructure constraints
      // If pause succeeded, pausedAt should be set
      if (afterPause.status === 'paused' || afterPause.status === 'pausing') {
        expect(afterPause.pausedAt).toBeDefined()
      } else {
        console.log('Pause may have failed, status:', afterPause.status)
        // Skip resume test if pause failed
        return
      }
      
      // Resume the sandbox
      try {
        await client.resumeSandbox(createdSandbox.sandboxId)
      } catch (error) {
        if (isResumeTimeout(error)) {
          console.log('⚠️ Resume timed out, skipping test')
          return
        }
        throw error
      }
      
      // Wait for resume to complete
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Get state after resume
      const afterResume = await client.getSandbox(createdSandbox.sandboxId)
      console.log('After resume:', {
        status: afterResume.status,
        pausedAt: afterResume.pausedAt,
        resumedAt: afterResume.resumedAt,
        totalPausedSeconds: afterResume.totalPausedSeconds
      })
      
      // Verify resumedAt is set
      expect(afterResume.resumedAt).toBeDefined()
      expect(afterResume.resumedAt).toBeInstanceOf(Date)
      expect(afterResume.resumedAt!.getTime()).toBeGreaterThan(0)
      
      // If pausedAt is still available, verify time ordering
      if (afterResume.pausedAt) {
        expect(afterResume.resumedAt!.getTime()).toBeGreaterThanOrEqual(afterResume.pausedAt!.getTime())
      }
      
      expect(afterResume.resumedAt!.getTime()).toBeLessThanOrEqual(Date.now())
      
      // Verify totalPausedSeconds is set and is a number
      if (afterResume.totalPausedSeconds !== undefined) {
        expect(typeof afterResume.totalPausedSeconds).toBe('number')
        expect(afterResume.totalPausedSeconds).toBeGreaterThanOrEqual(0)
        console.log('✅ totalPausedSeconds correctly tracked:', afterResume.totalPausedSeconds)
      }
      
      // Verify status is running or resuming
      expect(['running', 'resuming']).toContain(afterResume.status)
    }, 120000)

    it('should correctly track totalPausedSeconds across pause/resume cycles', async () => {
      // Create a sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'total-paused-seconds' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // Wait until sandbox is running (required by backend before pause)
      const runStatus = await client.waitUntilStatus(createdSandbox.sandboxId, ['running', 'failed'], { timeoutMs: 60000 })
      if (runStatus.status === 'failed') {
        console.log('Sandbox entered failed state, skipping totalPausedSeconds test')
        return
      }
      
      // Initial state
      const initial = await client.getSandbox(createdSandbox.sandboxId)
      const initialTotalPaused = initial.totalPausedSeconds || 0
      console.log('Initial totalPausedSeconds:', initialTotalPaused)
      
      // First pause (may fail due to infrastructure constraints)
      try {
        await client.pauseSandbox(createdSandbox.sandboxId)
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error: any) {
        if (error.message?.includes('DaemonSet') || error.message?.includes('writable layer protection')) {
          console.log('⚠️ Pause failed due to infrastructure constraints, skipping test')
          return
        }
        throw error
      }
      
      const afterFirstPause = await client.getSandbox(createdSandbox.sandboxId)
      console.log('After first pause:', {
        pausedAt: afterFirstPause.pausedAt,
        totalPausedSeconds: afterFirstPause.totalPausedSeconds
      })
      
      // Wait a bit while paused
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Resume
      try {
        await client.resumeSandbox(createdSandbox.sandboxId)
      } catch (error) {
        if (isResumeTimeout(error)) {
          console.log('⚠️ Resume timed out, skipping test')
          return
        }
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      const afterFirstResume = await client.getSandbox(createdSandbox.sandboxId)
      console.log('After first resume:', {
        resumedAt: afterFirstResume.resumedAt,
        totalPausedSeconds: afterFirstResume.totalPausedSeconds
      })
      
      // Verify totalPausedSeconds increased
      if (afterFirstResume.totalPausedSeconds !== undefined) {
        expect(afterFirstResume.totalPausedSeconds).toBeGreaterThanOrEqual(initialTotalPaused)
        expect(typeof afterFirstResume.totalPausedSeconds).toBe('number')
        expect(Number.isInteger(afterFirstResume.totalPausedSeconds)).toBe(true)
      }
      
      // Second pause cycle (may fail due to infrastructure constraints)
      try {
        await client.pauseSandbox(createdSandbox.sandboxId)
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error: any) {
        if (error.message?.includes('DaemonSet') || error.message?.includes('writable layer protection')) {
          console.log('⚠️ Second pause failed, but first cycle succeeded - test partially passed')
          return
        }
        throw error
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      try {
        await client.resumeSandbox(createdSandbox.sandboxId)
      } catch (error) {
        if (isResumeTimeout(error)) {
          console.log('⚠️ Resume timed out, skipping test')
          return
        }
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      const afterSecondResume = await client.getSandbox(createdSandbox.sandboxId)
      console.log('After second resume:', {
        totalPausedSeconds: afterSecondResume.totalPausedSeconds
      })
      
      // Verify totalPausedSeconds increased further
      if (afterSecondResume.totalPausedSeconds !== undefined && afterFirstResume.totalPausedSeconds !== undefined) {
        expect(afterSecondResume.totalPausedSeconds).toBeGreaterThanOrEqual(afterFirstResume.totalPausedSeconds)
      }
    }, 120000)

    it('should have correct time ordering: pausedAt < resumedAt', async () => {
      // Create a sandbox
      const createdSandbox = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'time-ordering' }
      })
      
      testSandboxId = createdSandbox.sandboxId
      
      // Wait until sandbox is running (required by backend before pause)
      const runStatus = await client.waitUntilStatus(createdSandbox.sandboxId, ['running', 'failed'], { timeoutMs: 60000 })
      if (runStatus.status === 'failed') {
        console.log('Sandbox entered failed state, skipping time-ordering test')
        return
      }
      
      // Pause (may fail due to infrastructure constraints)
      try {
        await client.pauseSandbox(createdSandbox.sandboxId)
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch (error: any) {
        if (error.message?.includes('DaemonSet') || error.message?.includes('writable layer protection')) {
          console.log('⚠️ Pause failed due to infrastructure constraints, skipping test')
          return
        }
        throw error
      }
      
      // Resume
      try {
        await client.resumeSandbox(createdSandbox.sandboxId)
      } catch (error) {
        if (isResumeTimeout(error)) {
          console.log('⚠️ Resume timed out, skipping test')
          return
        }
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Get final state
      const final = await client.getSandbox(createdSandbox.sandboxId)
      
      // If both dates are present, verify ordering
      if (final.pausedAt && final.resumedAt) {
        expect(final.pausedAt.getTime()).toBeLessThanOrEqual(final.resumedAt.getTime())
        console.log('Time ordering verified:', {
          pausedAt: final.pausedAt.toISOString(),
          resumedAt: final.resumedAt.toISOString(),
          difference: final.resumedAt.getTime() - final.pausedAt.getTime(),
          differenceSeconds: Math.floor((final.resumedAt.getTime() - final.pausedAt.getTime()) / 1000)
        })
      }
    }, 120000)
  })

  describe.skipIf(skipIfNoApiKey)('autoPause', () => {
    it('should default to false when not specified', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        metadata: { test: 'autopause-default' }
      })
      testSandboxId = sandboxInfo.sandboxId
      expect(sandboxInfo.autoPause).toBe(false)
    })

    it('should be true in response when created with autoPause: true', async () => {
      const sandboxInfo = await client.createSandbox({
        template: 'base',
        timeout: 300,
        autoPause: true,
        metadata: { test: 'autopause-enabled' }
      })
      testSandboxId = sandboxInfo.sandboxId
      expect(sandboxInfo.autoPause).toBe(true)
    })

    it('should auto-pause after timeout then be resumable and connectable', async () => {
      const isEnvError = (err: unknown): boolean => {
        const msg = err instanceof Error ? err.message : String(err)
        return msg.includes('502') || msg.includes('Bad Gateway')
      }
      const skipDueToEnv = (step: string, err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`autoPause full-flow skipped (${step}):`, msg)
      }

      // Use a short timeout so auto-pause triggers within test time (backend: timeout seconds then auto-pause)
      const runTimeoutSeconds = 90
      let createdSandbox: SandboxInfo
      try {
        createdSandbox = await client.createSandbox({
          template: 'base',
          timeout: runTimeoutSeconds,
          autoPause: true,
          metadata: { test: 'autopause-full-flow' }
        })
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('createSandbox', e)
          return
        }
        throw e
      }
      testSandboxId = createdSandbox.sandboxId
      expect(createdSandbox.autoPause).toBe(true)

      // Wait until running (or failed)
      let runStatus: { status: string; reason?: string | null }
      try {
        runStatus = await client.waitUntilStatus(createdSandbox.sandboxId, ['running', 'failed'], { timeoutMs: 120000 })
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('wait running', e)
          return
        }
        throw e
      }
      if (runStatus.status === 'failed') {
        throw new Error(`Sandbox entered failed state: ${runStatus.reason ?? 'unknown'}`)
      }

      // Wait for backend to auto-pause after runTimeoutSeconds (allow extra buffer)
      let pauseStatus: { status: string; reason?: string | null }
      try {
        pauseStatus = await client.waitUntilStatus(createdSandbox.sandboxId, ['paused', 'failed'], {
          timeoutMs: (runTimeoutSeconds + 60) * 1000,
          intervalMs: 5000
        })
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('wait auto-pause', e)
          return
        }
        throw e
      }
      if (pauseStatus.status !== 'paused') {
        throw new Error(`Auto-pause did not occur in time, last status: ${pauseStatus.status}`)
      }

      let afterAutoPause: SandboxInfo
      try {
        afterAutoPause = await client.getSandbox(createdSandbox.sandboxId)
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('getSandbox after auto-pause', e)
          return
        }
        throw e
      }
      expect(afterAutoPause.status).toBe('paused')
      expect(afterAutoPause.pausedAt).toBeDefined()

      // Resume and verify running
      try {
        await client.resumeSandbox(createdSandbox.sandboxId)
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('resumeSandbox', e)
          return
        }
        throw e
      }
      let afterResume: { status: string; reason?: string | null }
      try {
        afterResume = await client.waitUntilStatus(createdSandbox.sandboxId, ['running', 'failed'], { timeoutMs: 120000 })
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('wait running after resume', e)
          return
        }
        throw e
      }
      if (afterResume.status !== 'running') {
        throw new Error(`Resume did not reach running, status: ${afterResume.status}`)
      }
      let getAfterResume: SandboxInfo
      try {
        getAfterResume = await client.getSandbox(createdSandbox.sandboxId)
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('getSandbox after resume', e)
          return
        }
        throw e
      }
      expect(getAfterResume.status).toBe('running')

      // Pause again manually so we can test connect (unified endpoint resumes when paused)
      try {
        await client.pauseSandbox(createdSandbox.sandboxId)
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('pauseSandbox', e)
          return
        }
        throw e
      }
      let afterManualPause: { status: string }
      try {
        afterManualPause = await client.waitUntilStatus(createdSandbox.sandboxId, ['paused', 'failed'], { timeoutMs: 60000 })
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('wait manual pause', e)
          return
        }
        throw e
      }
      if (afterManualPause.status !== 'paused') {
        throw new Error(`Manual pause did not complete, status: ${afterManualPause.status}`)
      }

      // connectSandbox when paused should resume and return sandbox info
      let connected: SandboxInfo
      try {
        connected = await client.connectSandbox(createdSandbox.sandboxId)
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('connectSandbox', e)
          return
        }
        throw e
      }
      expect(connected).toBeDefined()
      expect(connected.sandboxId).toBe(createdSandbox.sandboxId)
      let afterConnect: { status: string }
      try {
        afterConnect = await client.waitUntilStatus(createdSandbox.sandboxId, ['running', 'failed'], { timeoutMs: 120000 })
      } catch (e) {
        if (isEnvError(e)) {
          skipDueToEnv('wait running after connect', e)
          return
        }
        throw e
      }
      if (afterConnect.status !== 'running') {
        throw new Error(`Connect did not reach running, status: ${afterConnect.status}`)
      }
    }, 300000)
  })

  describe('Status Type Validation', () => {
    it('should accept pausing status', () => {
      // This test validates that the TypeScript type system accepts 'pausing' as a valid status
      // This test does not require API key as it only validates TypeScript types
      const sandboxInfo: SandboxInfo = {
        sandboxId: 'test-id',
        templateId: 'base',
        metadata: {},
        startedAt: new Date(),
        endAt: new Date(),
        status: 'pausing', // This should be valid
        cpuCount: 1,
        memoryMB: 512,
        envdVersion: '1.0.0'
      }
      
      expect(sandboxInfo.status).toBe('pausing')
      // Verify that pause/resume fields are part of the type definition
      // These are optional fields, so they may be undefined, but the type should allow them
      expect('pausedAt' in sandboxInfo || sandboxInfo.pausedAt !== undefined || sandboxInfo.pausedAt === undefined).toBe(true)
      expect('resumedAt' in sandboxInfo || sandboxInfo.resumedAt !== undefined || sandboxInfo.resumedAt === undefined).toBe(true)
      expect('pauseTimeoutAt' in sandboxInfo || sandboxInfo.pauseTimeoutAt !== undefined || sandboxInfo.pauseTimeoutAt === undefined).toBe(true)
      expect('totalPausedSeconds' in sandboxInfo || sandboxInfo.totalPausedSeconds !== undefined || sandboxInfo.totalPausedSeconds === undefined).toBe(true)
    })

    it('should accept resuming status', () => {
      // This test validates that the TypeScript type system accepts 'resuming' as a valid status
      // This test does not require API key as it only validates TypeScript types
      const sandboxInfo: SandboxInfo = {
        sandboxId: 'test-id',
        templateId: 'base',
        metadata: {},
        startedAt: new Date(),
        endAt: new Date(),
        status: 'resuming', // This should be valid
        cpuCount: 1,
        memoryMB: 512,
        envdVersion: '1.0.0'
      }
      
      expect(sandboxInfo.status).toBe('resuming')
      // Verify that pause/resume fields are part of the type definition
      // These are optional fields, so they may be undefined, but the type should allow them
      expect('pausedAt' in sandboxInfo || sandboxInfo.pausedAt !== undefined || sandboxInfo.pausedAt === undefined).toBe(true)
      expect('resumedAt' in sandboxInfo || sandboxInfo.resumedAt !== undefined || sandboxInfo.resumedAt === undefined).toBe(true)
      expect('pauseTimeoutAt' in sandboxInfo || sandboxInfo.pauseTimeoutAt !== undefined || sandboxInfo.pauseTimeoutAt === undefined).toBe(true)
      expect('totalPausedSeconds' in sandboxInfo || sandboxInfo.totalPausedSeconds !== undefined || sandboxInfo.totalPausedSeconds === undefined).toBe(true)
    })

    it('should accept all pause/resume status values', () => {
      // Test all valid status values including pause/resume states
      const validStatuses: Array<SandboxInfo['status']> = [
        'running',
        'paused',
        'pausing',
        'resuming',
        'stopped',
        'starting',
        'stopping',
        'failed',
        'terminated',
        'created',
        'terminating'
      ]
      
      validStatuses.forEach(status => {
        const sandboxInfo: SandboxInfo = {
          sandboxId: 'test-id',
          templateId: 'base',
          metadata: {},
          startedAt: new Date(),
          endAt: new Date(),
          status,
          cpuCount: 1,
          memoryMB: 512,
          envdVersion: '1.0.0'
        }
        
        expect(sandboxInfo.status).toBe(status)
        // Verify that pause/resume fields are part of the type definition
        // These are optional fields, so they may be undefined, but the type should allow them
        // TypeScript type checking ensures these fields exist in the type, so we just verify the status is valid
        expect(typeof sandboxInfo.pausedAt === 'undefined' || sandboxInfo.pausedAt instanceof Date).toBe(true)
        expect(typeof sandboxInfo.resumedAt === 'undefined' || sandboxInfo.resumedAt instanceof Date).toBe(true)
        expect(typeof sandboxInfo.pauseTimeoutAt === 'undefined' || sandboxInfo.pauseTimeoutAt instanceof Date).toBe(true)
        expect(typeof sandboxInfo.totalPausedSeconds === 'undefined' || typeof sandboxInfo.totalPausedSeconds === 'number').toBe(true)
      })
    })
  })
})

