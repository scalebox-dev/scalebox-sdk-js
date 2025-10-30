/**
 * Session API Basic Tests
 * 
 * Tests for the high-level Session API with automatic lifecycle management
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Session } from '../../src/index'

describe('Session API - Basic Tests', () => {
  describe('Simple Execution', () => {
    it('should execute simple Python code', async () => {
      const result = await Session.run({
        code: 'print("Hello, World!")',
        language: 'python'
      })
      
      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.text).toContain('Hello, World!')
      expect(result.stdout).toContain('Hello, World!')
      expect(result.timing).toBeDefined()
      expect(result.timing.totalMs).toBeGreaterThan(0)
    }, 60000)
    
    it('should execute simple JavaScript code', async () => {
      const result = await Session.run({
        code: 'console.log("Hello from JS")',
        language: 'javascript'
      })
      
      expect(result.success).toBe(true)
      expect(result.text).toContain('Hello from JS')
    }, 60000)
    
    it('should handle stderr output', async () => {
      const result = await Session.run({
        code: 'import sys; sys.stderr.write("Error message\\n")',
        language: 'python'
      })
      
      expect(result.stderr).toContain('Error message')
    }, 60000)
  })
  
  describe('Timing Statistics', () => {
    it('should provide detailed timing statistics', async () => {
      const result = await Session.run({
        code: 'print("test")',
        language: 'python'
      })
      
      expect(result.timing).toBeDefined()
      expect(result.timing.totalMs).toBeGreaterThan(0)
      expect(result.timing.stages).toBeDefined()
      expect(result.timing.stages.connecting).toBeGreaterThan(0)
      expect(result.timing.stages.executing).toBeGreaterThan(0)
      expect(result.timing.distribution).toBeDefined()
    }, 60000)
    
    it('should provide performance insights for slow operations', async () => {
      const result = await Session.run({
        code: 'import time; time.sleep(0.1); print("done")',
        language: 'python'
      })
      
      expect(result.insights).toBeDefined()
      if (result.insights?.bottleneck) {
        expect(['connecting', 'executing', 'installing']).toContain(result.insights.bottleneck)
      }
    }, 60000)
  })
  
  describe('Progress Tracking', () => {
    it('should report progress during execution', async () => {
      const progressUpdates: string[] = []
      
      const result = await Session.run({
        code: 'print("test")',
        language: 'python',
        onProgress: (progress) => {
          progressUpdates.push(progress.stage)
        }
      })
      
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates).toContain('initializing')
      expect(progressUpdates).toContain('connecting')
      expect(progressUpdates).toContain('executing')
      expect(progressUpdates).toContain('completed')
    }, 60000)
    
    it('should report real-time stdout', async () => {
      const stdoutLines: string[] = []
      
      const result = await Session.run({
        code: 'for i in range(3): print(f"Line {i}")',
        language: 'python',
        onStdout: (output) => {
          stdoutLines.push(output.trim())
        }
      })
      
      expect(stdoutLines.length).toBeGreaterThan(0)
      expect(result.success).toBe(true)
    }, 60000)
  })
  
  describe('Error Handling', () => {
    it('should handle code execution errors', async () => {
      const result = await Session.run({
        code: 'print(1 / 0)',  // Division by zero
        language: 'python'
      })
      
      expect(result.success).toBe(false)
      expect(result.exitCode).not.toBe(0)
      // Error information should be in the error field
      expect(result.error).toBeDefined()
      expect(result.error?.name).toBe('ZeroDivisionError')
      expect(result.error?.message).toContain('division by zero')
    }, 60000)
    
    it('should handle syntax errors', async () => {
      const result = await Session.run({
        code: 'print("unclosed string',
        language: 'python'
      })
      
      expect(result.success).toBe(false)
      // Error information should be present
      expect(result.error).toBeDefined()
      expect(result.error?.name).toBeDefined()
      expect(result.error?.message.length).toBeGreaterThan(0)
    }, 60000)
  })
})

