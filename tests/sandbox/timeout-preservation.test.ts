import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Sandbox } from '../../src'
import { template } from '../template'

/**
 * Sandbox Timeout Preservation Test Suite
 * 
 * Tests to verify that Sandbox.connect() preserves existing timeout
 * when timeoutMs is not explicitly provided.
 * 
 * This addresses the bug where connect() was resetting timeout to 5 minutes.
 */
describe('Sandbox Timeout Preservation', () => {
  let createdSandboxes: string[] = []
  const DEFAULT_TIMEOUT = 60000

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

  it('should preserve existing timeout when connecting without timeoutMs', async () => {
    console.log('🔒 Testing timeout preservation on connect...')
    
    // Create sandbox with 30 minute timeout
    const initialTimeoutMs = 30 * 60 * 1000 // 30 minutes
    const sandbox = await Sandbox.create(template, {
      timeoutMs: initialTimeoutMs,
      metadata: { test: 'timeout-preservation' }
    })
    createdSandboxes.push(sandbox.sandboxId)
    
    console.log(`  ✓ Created sandbox with ${initialTimeoutMs / 1000}s timeout`)
    
    // Get initial timeout
    const initialInfo = await sandbox.getInfo()
    const initialTimeout = initialInfo.timeout
    console.log(`  ✓ Initial timeout: ${initialTimeout}s`)
    
    // Connect without passing timeoutMs - should preserve existing timeout
    const reconnected = await Sandbox.connect(sandbox.sandboxId)
    
    // Wait a moment for any updates to settle
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Get timeout after reconnection
    const reconnectedInfo = await reconnected.getInfo()
    const reconnectedTimeout = reconnectedInfo.timeout
    console.log(`  ✓ Timeout after connect: ${reconnectedTimeout}s`)
    
    // Verify timeout was preserved (allow 5 second tolerance for elapsed time)
    expect(reconnectedTimeout).toBeDefined()
    expect(initialTimeout).toBeDefined()
    
    // The timeout should not have been reset to 5 minutes (300 seconds)
    expect(reconnectedTimeout!).toBeGreaterThan(500) // Should be more than 5 minutes
    
    // The timeout should be close to original (within 10 seconds of elapsed time)
    const timeoutDifference = Math.abs(reconnectedTimeout! - initialTimeout!)
    expect(timeoutDifference).toBeLessThan(10) // Allow up to 10 seconds difference
    
    console.log(`✅ Timeout preserved: ${initialTimeout}s → ${reconnectedTimeout}s`)
  }, DEFAULT_TIMEOUT)

  it('should update timeout when explicitly provided on connect', async () => {
    console.log('📝 Testing explicit timeout update on connect...')
    
    // Create sandbox with 10 minute timeout
    const initialTimeoutMs = 10 * 60 * 1000 // 10 minutes
    const sandbox = await Sandbox.create(template, {
      timeoutMs: initialTimeoutMs,
      metadata: { test: 'timeout-update' }
    })
    createdSandboxes.push(sandbox.sandboxId)
    
    console.log(`  ✓ Created sandbox with ${initialTimeoutMs / 1000}s timeout`)
    
    // Get initial timeout
    const initialInfo = await sandbox.getInfo()
    const initialTimeout = initialInfo.timeout
    console.log(`  ✓ Initial timeout: ${initialTimeout}s`)
    
    // Connect with new timeout (15 minutes)
    const newTimeoutMs = 15 * 60 * 1000 // 15 minutes
    const reconnected = await Sandbox.connect(sandbox.sandboxId, {
      timeoutMs: newTimeoutMs
    })
    
    // Wait a moment for updates to settle
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Get timeout after reconnection
    const reconnectedInfo = await reconnected.getInfo()
    const reconnectedTimeout = reconnectedInfo.timeout
    console.log(`  ✓ Timeout after connect: ${reconnectedTimeout}s`)
    
    // Verify timeout was updated
    expect(reconnectedTimeout).toBeDefined()
    expect(initialTimeout).toBeDefined()
    expect(reconnectedTimeout!).toBeGreaterThan(initialTimeout!) // Should be extended
    
    // Should be close to new timeout value
    const expectedTimeout = newTimeoutMs / 1000
    const timeoutDifference = Math.abs(reconnectedTimeout! - expectedTimeout)
    expect(timeoutDifference).toBeLessThan(10) // Allow up to 10 seconds difference
    
    console.log(`✅ Timeout updated: ${initialTimeout}s → ${reconnectedTimeout}s`)
  }, DEFAULT_TIMEOUT)

  it('should preserve timeout after file operations', async () => {
    console.log('📁 Testing timeout preservation after file operations...')
    
    // Create sandbox with 20 minute timeout
    const initialTimeoutMs = 20 * 60 * 1000 // 20 minutes
    const sandbox = await Sandbox.create(template, {
      timeoutMs: initialTimeoutMs,
      metadata: { test: 'file-ops-timeout' }
    })
    createdSandboxes.push(sandbox.sandboxId)
    
    console.log(`  ✓ Created sandbox with ${initialTimeoutMs / 1000}s timeout`)
    
    // Get initial timeout
    const initialInfo = await sandbox.getInfo()
    const initialTimeout = initialInfo.timeout
    console.log(`  ✓ Initial timeout: ${initialTimeout}s`)
    
    // Perform file operations
    await sandbox.files.write('/tmp/test.txt', 'test data')
    console.log('  ✓ Performed file write operation')
    
    // Connect to the same sandbox (simulating reconnection after operations)
    const reconnected = await Sandbox.connect(sandbox.sandboxId)
    
    // Verify file exists
    const content = await reconnected.files.read('/tmp/test.txt')
    expect(content).toBe('test data')
    console.log('  ✓ File operation verified')
    
    // Get timeout after operations
    const finalInfo = await reconnected.getInfo()
    const finalTimeout = finalInfo.timeout
    console.log(`  ✓ Timeout after operations: ${finalTimeout}s`)
    
    // Verify timeout was not reset
    expect(finalTimeout).toBeDefined()
    expect(initialTimeout).toBeDefined()
    expect(finalTimeout!).toBeGreaterThan(500) // Should still be ~20 minutes
    
    const timeoutDifference = Math.abs(finalTimeout! - initialTimeout!)
    expect(timeoutDifference).toBeLessThan(15) // Allow up to 15 seconds difference
    
    console.log(`✅ Timeout preserved after file ops: ${initialTimeout}s → ${finalTimeout}s`)
  }, DEFAULT_TIMEOUT)

  it('should handle instance connect() method correctly', async () => {
    console.log('🔗 Testing instance connect() method...')
    
    // Create sandbox with custom timeout
    const initialTimeoutMs = 25 * 60 * 1000 // 25 minutes
    const sandbox = await Sandbox.create(template, {
      timeoutMs: initialTimeoutMs,
      metadata: { test: 'instance-connect' }
    })
    createdSandboxes.push(sandbox.sandboxId)
    
    console.log(`  ✓ Created sandbox with ${initialTimeoutMs / 1000}s timeout`)
    
    const initialInfo = await sandbox.getInfo()
    const initialTimeout = initialInfo.timeout
    console.log(`  ✓ Initial timeout: ${initialTimeout}s`)
    
    // Pause and reconnect using instance method
    await sandbox.betaPause()
    console.log('  ✓ Sandbox paused')
    
    await sandbox.connect() // Should resume with default timeout
    console.log('  ✓ Sandbox resumed')
    
    const reconnectedInfo = await sandbox.getInfo()
    const reconnectedTimeout = reconnectedInfo.timeout
    console.log(`  ✓ Timeout after resume: ${reconnectedTimeout}s`)
    
    // When resuming, timeout should be reset to default (5 minutes) to avoid immediate timeout
    expect(reconnectedTimeout).toBeDefined()
    
    // The timeout should be around 5 minutes (300 seconds), not the original 25 minutes
    // This is expected behavior to prevent timeout after long pause periods
    expect(reconnectedTimeout!).toBeGreaterThan(250) // At least 4+ minutes
    expect(reconnectedTimeout!).toBeLessThan(400) // Less than 7 minutes
    
    console.log(`✅ Instance connect() correctly set new timeout on resume: ${reconnectedTimeout}s`)
  }, DEFAULT_TIMEOUT * 2)

  it('should allow custom timeout when resuming paused sandbox', async () => {
    console.log('⏱️ Testing custom timeout on resume...')
    
    // Create sandbox
    const sandbox = await Sandbox.create(template, {
      timeoutMs: 20 * 60 * 1000, // 20 minutes
      metadata: { test: 'custom-resume-timeout' }
    })
    createdSandboxes.push(sandbox.sandboxId)
    
    console.log('  ✓ Created sandbox')
    
    // Pause the sandbox
    await sandbox.betaPause()
    console.log('  ✓ Sandbox paused')
    
    // Resume with custom timeout
    const customTimeoutMs = 15 * 60 * 1000 // 15 minutes
    await sandbox.connect({ timeoutMs: customTimeoutMs })
    console.log('  ✓ Sandbox resumed with custom timeout')
    
    const info = await sandbox.getInfo()
    const finalTimeout = info.timeout
    console.log(`  ✓ Final timeout: ${finalTimeout}s`)
    
    // Should be around 15 minutes
    expect(finalTimeout).toBeDefined()
    expect(finalTimeout!).toBeGreaterThan(800) // At least 13+ minutes
    expect(finalTimeout!).toBeLessThan(1000) // Less than 17 minutes
    
    console.log(`✅ Custom timeout on resume: ${finalTimeout}s`)
  }, DEFAULT_TIMEOUT * 2)

  it('should prevent timeout reset bug scenario', async () => {
    console.log('🐛 Testing original bug scenario...')
    
    // This test replicates the exact bug scenario reported:
    // 1. Create 30 minute sandbox
    // 2. Perform operations (like write file)
    // 3. Reconnect without timeoutMs
    // 4. Verify timeout is NOT reset to 5 minutes
    
    const sandbox = await Sandbox.create(template, {
      timeoutMs: 30 * 60 * 1000, // 30 minutes
      metadata: { test: 'bug-scenario' }
    })
    createdSandboxes.push(sandbox.sandboxId)
    
    console.log('  ✓ Created 30-minute sandbox')
    
    // Perform some operations
    await sandbox.files.write('/tmp/bug-test.txt', 'data')
    console.log('  ✓ Performed file write')
    
    // Somewhere in the code, reconnect happens without timeoutMs
    const reconnected = await Sandbox.connect(sandbox.sandboxId)
    console.log('  ✓ Reconnected without timeoutMs')
    
    const finalInfo = await reconnected.getInfo()
    const finalTimeout = finalInfo.timeout
    
    console.log(`  ✓ Final timeout: ${finalTimeout}s`)
    
    // The bug would cause timeout to be 300s (5 minutes)
    // The fix should keep it around 1800s (30 minutes)
    expect(finalTimeout).toBeDefined()
    
    // Assert that timeout is NOT 5 minutes (the bug behavior)
    expect(finalTimeout).not.toBeCloseTo(300, -1) // Not close to 300 seconds
    
    // Assert that timeout is still around 30 minutes
    expect(finalTimeout!).toBeGreaterThan(1700) // At least 28+ minutes remaining
    
    console.log(`✅ Bug prevented! Timeout remained at ${finalTimeout}s (not reset to 300s)`)
  }, DEFAULT_TIMEOUT)
})

