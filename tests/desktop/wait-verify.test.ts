import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Wait and Verify', () => {
  it('should wait and verify command success', async () => {
    const desktop = await Desktop.create({})
    
    // Test a command that should succeed
    const result = await desktop.waitAndVerify(
      'echo "test"',
      (result) => result.stdout.includes('test'),
      5,
      0.5
    )
    
    expect(result).toBe(true)
    
    await desktop.close()
  })

  it('should wait and verify command failure within timeout', async () => {
    const desktop = await Desktop.create({})
    
    // Test a command that should fail verification
    const result = await desktop.waitAndVerify(
      'echo "wrong output"',
      (result) => result.stdout.includes('expected'),
      2,
      0.5
    )
    
    expect(result).toBe(false)
    
    await desktop.close()
  })

  it('should verify file existence', async () => {
    const desktop = await Desktop.create({})
    
    // Create a test file first
    await desktop.executeCommand('touch /tmp/test_file.txt')
    
    // Wait and verify the file exists
    const result = await desktop.waitAndVerify(
      'test -f /tmp/test_file.txt',
      (result) => result.exitCode === 0,
      5,
      0.5
    )
    
    expect(result).toBe(true)
    
    // Clean up
    await desktop.executeCommand('rm -f /tmp/test_file.txt')
    
    await desktop.close()
  })

  it('should verify process is running', async () => {
    const desktop = await Desktop.create({})
    
    // Start a long-running process in background
    await desktop.executeCommand('sleep 10 &')
    
    // Wait and verify the process is running
    const result = await desktop.waitAndVerify(
      'pgrep sleep',
      (result) => result.stdout.trim().length > 0,
      5,
      0.5
    )
    
    expect(result).toBe(true)
    
    // Clean up - kill sleep processes
    await desktop.executeCommand('pkill sleep')
    
    await desktop.close()
  })

  it('should verify service startup', async () => {
    const desktop = await Desktop.create({})
    
    // This test simulates waiting for a service to start
    // We'll use a simple approach with a temporary file
    
    // Start a background process that creates a file after delay
    await desktop.executeCommand('(sleep 2 && touch /tmp/service_ready) &')
    
    // Wait and verify the service is ready
    const result = await desktop.waitAndVerify(
      'test -f /tmp/service_ready',
      (result) => result.exitCode === 0,
      5,
      0.5
    )
    
    expect(result).toBe(true)
    
    // Clean up
    await desktop.executeCommand('rm -f /tmp/service_ready')
    
    await desktop.close()
  })

  it('should handle command errors gracefully', async () => {
    const desktop = await Desktop.create({})
    
    // Test with a command that will throw errors but should still work
    const result = await desktop.waitAndVerify(
      'ls /nonexistent/directory',
      (result) => result.stderr.includes('No such file'),
      5,
      0.5
    )
    
    expect(result).toBe(true)
    
    await desktop.close()
  })

  it('should respect custom timeout and interval', async () => {
    const desktop = await Desktop.create({})
    
    const startTime = Date.now()
    
    // Test with short timeout and custom interval
    const result = await desktop.waitAndVerify(
      'echo "test"',
      (result) => result.stdout.includes('never_match'),
      1, // 1 second timeout
      0.2 // 0.2 second interval
    )
    
    const endTime = Date.now()
    const elapsed = (endTime - startTime) / 1000
    
    expect(result).toBe(false)
    expect(elapsed).toBeGreaterThanOrEqual(0.8) // Should be at least close to 1 second
    expect(elapsed).toBeLessThan(2) // But not much more than 1 second
    
    await desktop.close()
  })

  it('should verify port is listening', async () => {
    const desktop = await Desktop.create({})
    
    // Start a simple HTTP server in background
    await desktop.executeCommand('python3 -m http.server 8000 > /dev/null 2>&1 &')
    
    // Wait and verify the port is listening
    const result = await desktop.waitAndVerify(
      'netstat -tuln | grep ":8000 "',
      (result) => result.stdout.trim() !== '',
      10,
      0.5
    )
    
    expect(result).toBe(true)
    
    // Clean up
    await desktop.executeCommand('pkill -f "python3 -m http.server"')
    
    await desktop.close()
  })
})
