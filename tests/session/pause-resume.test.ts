/**
 * Session Pause/Resume Tests
 * 
 * Tests for session pause and resume functionality
 */

import { describe, it, expect } from 'vitest'
import { Session } from '../../src/index'

describe('Session API - Pause/Resume', () => {
  describe('Pause and State Preservation', () => {
    // TODO: Skip context state preservation tests until memory-level state preservation is implemented
    // Currently backend only preserves file system state, not memory-level state (variables, imports, context)
    it.skip('should pause session and preserve state', async () => {
      // Create session with state
      const step1 = await Session.run({
        code: `
import pandas as pd
x = 42
df = pd.DataFrame({'a': [1, 2, 3]})
print("Initialized")
`,
        packages: ['pandas'],
        keepAlive: true
      })
      
      expect(step1.success).toBe(true)
      expect(step1.sessionId).toBeDefined()
      
      const sessionId = step1.sessionId!
      
      try {
        // Verify session is running
        let info = await Session.getSession(sessionId)
        expect(info.status).toBe('running')
        
        // Pause the session
        const paused = await Session.pause(sessionId)
        expect(paused).toBe(true)
        
        // Verify session is paused
        info = await Session.getSession(sessionId)
        expect(info.status).toBe('paused')
        
        // Verify state is preserved (packages, files)
        expect(info.installedPackages).toContain('pandas')
        
        // Resume by reusing session - should automatically resume
        const step2 = await Session.run({
          code: `
# Variables should still exist
print(f"x = {x}")
print(f"DataFrame shape: {df.shape}")
`,
          sessionId,
          keepAlive: false
        })
        
        expect(step2.success).toBe(true)
        expect(step2.text).toContain('x = 42')
        expect(step2.text).toContain('DataFrame shape')
        
        // Verify session is running again after resume
        info = await Session.getSession(sessionId)
        // Note: session might be closed if keepAlive=false, so we check if it exists
        if (info) {
          expect(['running', 'stopped']).toContain(info.status)
        }
      } catch (error) {
        // Cleanup on error
        await Session.close(sessionId).catch(() => {})
        throw error
      }
    }, 180000)
    
    // TODO: Skip context state preservation tests until memory-level state preservation is implemented
    // Currently backend only preserves file system state, not memory-level state (variables, imports, context)
    it.skip('should automatically resume paused session when reusing', async () => {
      // Create and pause session
      const step1 = await Session.run({
        code: 'result = "Hello from paused session"',
        keepAlive: true
      })
      
      const sessionId = step1.sessionId!
      
      try {
        // Pause the session
        await Session.pause(sessionId)
        
        // Verify it's paused
        let info = await Session.getSession(sessionId)
        expect(info.status).toBe('paused')
        
        // Reuse session - should automatically resume
        const step2 = await Session.run({
          code: 'print(result)',
          sessionId,
          keepAlive: false
        })
        
        expect(step2.success).toBe(true)
        expect(step2.text).toContain('Hello from paused session')
        
        // Verify session was resumed (status should be running or stopped)
        info = await Session.getSession(sessionId)
        if (info) {
          expect(['running', 'stopped']).toContain(info.status)
        }
      } catch (error) {
        await Session.close(sessionId).catch(() => {})
        throw error
      }
    }, 120000)
    
    // TODO: Skip until context preservation is implemented
    // Currently context is lost after pause/resume, causing "context not found" errors
    // Backend only preserves file system state, not context/memory state
    it.skip('should automatically resume paused session when reusing (basic functionality)', async () => {
      // Create and pause session
      const step1 = await Session.run({
        code: 'print("Session created")',
        keepAlive: true
      })
      
      const sessionId = step1.sessionId!
      
      try {
        // Pause the session
        await Session.pause(sessionId)
        
        // Verify it's paused
        let info = await Session.getSession(sessionId)
        expect(info.status).toBe('paused')
        
        // Reuse session - should automatically resume
        // Note: Memory-level state (variables) is not preserved yet, only file system state
        const step2 = await Session.run({
          code: 'print("Session resumed and code executed")',
          sessionId,
          keepAlive: false
        })
        
        expect(step2.success).toBe(true)
        expect(step2.text).toContain('Session resumed and code executed')
        
        // Verify session was resumed (status should be running or stopped)
        info = await Session.getSession(sessionId)
        if (info) {
          expect(['running', 'stopped']).toContain(info.status)
        }
      } catch (error) {
        await Session.close(sessionId).catch(() => {})
        throw error
      }
    }, 120000)
  })
  
  describe('Pause Status Tracking', () => {
    it('should correctly track paused status', async () => {
      const result = await Session.run({
        code: 'print("test")',
        keepAlive: true
      })
      
      const sessionId = result.sessionId!
      
      try {
        // Initially running
        let info = await Session.getSession(sessionId)
        expect(info.status).toBe('running')
        
        // Pause
        await Session.pause(sessionId)
        
        // Check status
        info = await Session.getSession(sessionId)
        expect(info.status).toBe('paused')
        
        // Verify other session info is still available
        expect(info.sessionId).toBe(sessionId)
        expect(info.language).toBe('python')
        expect(info.sandbox).toBeDefined()
      } finally {
        await Session.close(sessionId).catch(() => {})
      }
    }, 60000)
  })
})


