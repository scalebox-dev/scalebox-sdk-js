/**
 * Session Reuse Tests
 * 
 * Tests for session reuse and state persistence
 */

import { describe, it, expect } from 'vitest'
import { Session } from '../../src/index'

describe('Session API - Session Reuse', () => {
  describe('Basic Session Reuse', () => {
    it('should maintain state across multiple executions', async () => {
      // Create session with variable
      const step1 = await Session.run({
        code: 'x = 42',
        language: 'python',
        keepAlive: true
      })
      
      expect(step1.success).toBe(true)
      expect(step1.sessionId).toBeDefined()
      
      const sessionId = step1.sessionId!
      
      try {
        // Reuse session - variable should persist
        const step2 = await Session.run({
          code: 'print(x * 2)',
          sessionId,
          keepAlive: true
        })
        
        expect(step2.success).toBe(true)
        expect(step2.text).toContain('84')
        
        // Third execution - variable still persists
        const step3 = await Session.run({
          code: 'y = x + 10; print(y)',
          sessionId,
          keepAlive: false  // Cleanup after this
        })
        
        expect(step3.success).toBe(true)
        expect(step3.text).toContain('52')
      } finally {
        // Cleanup
        await Session.close(sessionId).catch(() => {})
      }
    }, 120000)
    
    it('should return sandbox reference when keepAlive is true', async () => {
      const result = await Session.run({
        code: 'print("test")',
        keepAlive: true
      })
      
      expect(result.sessionId).toBeDefined()
      expect(result.sandbox).toBeDefined()
      expect(result.sandbox!.sandboxId).toBe(result.sessionId)
      
      // Cleanup
      await Session.close(result.sessionId!).catch(() => {})
    }, 60000)
  })
  
  describe('Package Installation Caching', () => {
    it('should cache installed packages across executions', async () => {
      // First execution - install numpy
      const step1 = await Session.run({
        code: 'import numpy as np; print(np.__version__)',
        packages: ['numpy'],
        keepAlive: true
      })
      
      expect(step1.success).toBe(true)
      const installTime1 = step1.timing.stages.installing || 0
      expect(installTime1).toBeGreaterThan(0)
      
      const sessionId = step1.sessionId!
      
      try {
        // Second execution - numpy should be cached
        const step2 = await Session.run({
          code: 'print(np.array([1, 2, 3]))',
          sessionId,
          packages: ['numpy'],  // Should skip installation
          keepAlive: false
        })
        
        expect(step2.success).toBe(true)
        const installTime2 = step2.timing.stages.installing || 0
        
        // Second execution should be much faster (no real installation)
        expect(installTime2).toBeLessThan(installTime1 / 2)
      } finally {
        await Session.close(sessionId).catch(() => {})
      }
    }, 180000)
  })
  
  describe('File Upload Caching', () => {
    it('should cache uploaded files across executions', async () => {
      const csvData = 'name,age\nAlice,30\nBob,25'
      
      // First execution - upload file
      const step1 = await Session.run({
        code: `
with open("data.csv") as f:
    content = f.read()
    print(content)
`,
        files: { 'data.csv': csvData },
        keepAlive: true
      })
      
      expect(step1.success).toBe(true)
      expect(step1.text).toContain('Alice')
      const uploadTime1 = step1.timing.stages.uploading || 0
      expect(uploadTime1).toBeGreaterThan(0)
      
      const sessionId = step1.sessionId!
      
      try {
        // Second execution - file should be cached
        const step2 = await Session.run({
          code: `
with open("data.csv") as f:
    lines = f.readlines()
    print(len(lines))
`,
          sessionId,
          files: { 'data.csv': csvData },  // Should skip upload
          keepAlive: false
        })
        
        expect(step2.success).toBe(true)
        const uploadTime2 = step2.timing.stages.uploading || 0
        
        // Second execution should skip upload
        expect(uploadTime2).toBe(0)
      } finally {
        await Session.close(sessionId).catch(() => {})
      }
    }, 120000)
  })
  
  describe('Session Management', () => {
    it('should list active sessions', async () => {
      const result = await Session.run({
        code: 'print("test")',
        keepAlive: true
      })
      
      const sessionId = result.sessionId!
      
      try {
        const sessions = await Session.listSessions()
        expect(sessions.length).toBeGreaterThan(0)
        
        const ourSession = sessions.find(s => s.sessionId === sessionId)
        expect(ourSession).toBeDefined()
        expect(ourSession!.language).toBe('python')
      } finally {
        await Session.close(sessionId)
      }
    }, 60000)
    
    it('should get session information', async () => {
      const result = await Session.run({
        code: 'import numpy',
        packages: ['numpy'],
        files: { 'test.txt': 'hello' },
        keepAlive: true
      })
      
      const sessionId = result.sessionId!
      
      try {
        const info = await Session.getSession(sessionId)
        
        expect(info.sessionId).toBe(sessionId)
        expect(info.language).toBe('python')
        expect(info.installedPackages).toContain('numpy')
        expect(info.uploadedFiles).toContain('test.txt')
        expect(info.status).toBe('running')
        expect(info.sandbox).toBeDefined()
      } finally {
        await Session.close(sessionId)
      }
    }, 120000)
    
    it('should manually extend session timeout', async () => {
      const result = await Session.run({
        code: 'print("test")',
        keepAlive: true,
        timeout: 300000  // 5 minutes
      })
      
      const sessionId = result.sessionId!
      
      try {
        // Extend timeout
        const renewal = await Session.keepAlive(sessionId, 600000)  // 10 minutes
        
        expect(renewal.sessionId).toBe(sessionId)
        expect(renewal.newTimeout).toBe(600000)
        expect(renewal.expiresAt).toBeDefined()
      } finally {
        await Session.close(sessionId)
      }
    }, 60000)
  })
})

