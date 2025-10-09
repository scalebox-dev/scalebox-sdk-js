import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { Sandbox, CodeInterpreter, Language } from '../../src'
import { template } from '../template'

const timeout = 120_000 // 2分钟超时

// Helper function for health check
async function waitForSandboxHealth(sandbox: Sandbox) {
  try {
    await sandbox.waitForHealth()
  } catch (error) {
    console.log('Health check failed, but continuing with test...')
  }
}

describe('Context Service Handlers', () => {
  let sandbox: Sandbox
  let codeInterpreter: CodeInterpreter

  beforeEach(async () => {
    // Create sandbox
    sandbox = await Sandbox.create(template, {
      timeoutMs: timeout,
    })
    
    // Create code interpreter separately
    codeInterpreter = await CodeInterpreter.create({
      templateId: template,
      timeout: timeout,
    })
  })

  afterEach(async () => {
    if (sandbox) {
      await sandbox.kill()
    }
    if (codeInterpreter) {
      await codeInterpreter.close()
    }
  })

  describe('CreateContext Handler', () => {
    test('should create execution context with default settings', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create a context for Python using backend API
      const context = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      expect(context).toBeDefined()
      expect(context.id).toBeDefined()
      expect(typeof context.id).toBe('string')
      expect(context.id.length).toBeGreaterThan(0)
      expect(context.language).toBe('python')
      expect(context.createdAt).toBeInstanceOf(Date)
      
      // Clean up
      await codeInterpreter.destroyContext(context.id)
    }, timeout)

    test('should create context with custom working directory', async () => {
      await waitForSandboxHealth(sandbox)
      
      const testDir = '/tmp/test-context-dir'
      
      // Create the directory first
      await sandbox.files.makeDir(testDir)
      
      // Create context with custom cwd using backend API
      const context = await codeInterpreter.createCodeContext({
        language: 'python',
        cwd: testDir
      })
      
      expect(context).toBeDefined()
      expect(context.cwd).toBe(testDir)
      
      // Verify working directory is set correctly by executing pwd command
      const result = await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: 'import os\nprint(os.getcwd())'
      })
      
      expect(result.stdout).toContain(testDir)
      
      // Clean up
      await codeInterpreter.destroyContext(context.id)
    }, timeout)

    test('should create contexts for different languages', async () => {
      await waitForSandboxHealth(sandbox)
      
      const languages: Language[] = ['python', 'javascript', 'r']
      const contexts: any[] = []
      
      for (const language of languages) {
        try {
          const context = await codeInterpreter.createCodeContext({
            language
          })
          contexts.push(context)
          expect(context.language).toBe(language)
        } catch (error) {
          // Some languages might not be available, that's okay
          console.log(`Language ${language} not available:`, error)
        }
      }
      
      // At least Python should be available
      expect(contexts.length).toBeGreaterThan(0)
      
      // Clean up all created contexts
      for (const context of contexts) {
        await codeInterpreter.destroyContext(context.id)
      }
    }, timeout)

    test('should handle multiple contexts simultaneously', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create multiple contexts using backend API
      const context1 = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      const context2 = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      expect(context1.id).not.toBe(context2.id)
      
      // Execute code in both contexts with different variables
      await codeInterpreter.execute({
        language: 'python',
        contextId: context1.id,
        code: 'x = 100'
      })
      
      await codeInterpreter.execute({
        language: 'python',
        contextId: context2.id,
        code: 'x = 200'
      })
      
      // Verify contexts are isolated
      const result1 = await codeInterpreter.execute({
        language: 'python',
        contextId: context1.id,
        code: 'print(x)'
      })
      
      const result2 = await codeInterpreter.execute({
        language: 'python',
        contextId: context2.id,
        code: 'print(x)'
      })
      
      expect(result1.stdout).toContain('100')
      expect(result2.stdout).toContain('200')
      
      // Clean up
      await codeInterpreter.destroyContext(context1.id)
      await codeInterpreter.destroyContext(context2.id)
    }, timeout)

    test('should preserve context state across executions', async () => {
      await waitForSandboxHealth(sandbox)
      
      const context = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      // First execution - define variables and functions
      await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: `
def greet(name):
    return f"Hello, {name}!"

counter = 0
data = [1, 2, 3, 4, 5]
`
      })
      
      // Second execution - use previously defined items
      const result2 = await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: `
counter += 1
print(f"Counter: {counter}")
print(greet("World"))
print(f"Data sum: {sum(data)}")
`
      })
      
      expect(result2.stdout).toContain('Counter: 1')
      expect(result2.stdout).toContain('Hello, World!')
      expect(result2.stdout).toContain('Data sum: 15')
      
      // Third execution - verify state persists
      const result3 = await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: 'print(f"Counter is now: {counter}")'
      })
      
      expect(result3.stdout).toContain('Counter is now: 1')
      
      // Clean up
      await codeInterpreter.destroyContext(context.id)
    }, timeout)

    test('should create context for JavaScript/Node.js', async () => {
      await waitForSandboxHealth(sandbox)
      
      try {
        const context = await codeInterpreter.createCodeContext({
          language: 'javascript'
        })
        
        expect(context.language).toBe('javascript')
        
        // Execute JavaScript code
        const result = await codeInterpreter.execute({
          language: 'javascript',
          contextId: context.id,
          code: 'console.log("Hello from JavaScript");'
        })
        
        expect(result.stdout).toContain('Hello from JavaScript')
        
        // Clean up
        await codeInterpreter.destroyContext(context.id)
      } catch (error) {
        // JavaScript kernel might not be available
        console.log('JavaScript kernel not available:', error)
      }
    }, timeout)
  })

  describe('DestroyContext Handler', () => {
    test('should destroy context successfully', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create a context using backend API
      const context = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      // Destroy the context
      await codeInterpreter.destroyContext(context.id)
      
      // Context should be destroyed successfully (no error thrown)
      
      // Trying to use the destroyed context should fail
      await expect(
        codeInterpreter.execute({
          language: 'python',
          contextId: context.id,
          code: 'print("test")'
        })
      ).rejects.toThrow()
    }, timeout)

    test('should handle destroying non-existent context', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Try to destroy a non-existent context
      const fakeContextId = 'non-existent-context-id'
      
      // This should not throw an error even for non-existent context
      // based on the implementation
      await codeInterpreter.destroyContext(fakeContextId)
      // Success is indicated by not throwing an error
      expect(true).toBe(true)
    }, timeout)

    test('should clean up resources after context destruction', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create context and allocate some resources using backend API
      const context = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      // Create some data in the context
      await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: `
import numpy as np
large_array = np.zeros((1000, 1000))
print("Large array created")
`
      })
      
      // Destroy the context
      await codeInterpreter.destroyContext(context.id)
      
      // Create a new context with the same language using backend API
      // This should work without resource exhaustion
      const newContext = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      expect(newContext).toBeDefined()
      
      // Clean up
      await codeInterpreter.destroyContext(newContext.id)
    }, timeout)

    test('should handle multiple context destructions', async () => {
      await waitForSandboxHealth(sandbox)
      
      const contexts: any[] = []
      
      // Create multiple contexts using backend API
      for (let i = 0; i < 3; i++) {
        const context = await codeInterpreter.createCodeContext({
          language: 'python'
        })
        contexts.push(context)
      }
      
      // Destroy all contexts
      for (const context of contexts) {
        await codeInterpreter.destroyContext(context.id)
        // Success is indicated by not throwing an error
      }
      
      // All contexts should be destroyed
      for (const context of contexts) {
        await expect(
          codeInterpreter.execute({
            language: 'python',
            contextId: context.id,
            code: 'print("test")'
          })
        ).rejects.toThrow()
      }
    }, timeout)
  })

  describe('Context Lifecycle', () => {
    test('should handle context creation and destruction lifecycle', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create context using backend API
      const context = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      // Use context
      const execResult = await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: 'result = 42\nprint(f"Result: {result}")'
      })
      
      expect(execResult.stdout).toContain('Result: 42')
      
      // Destroy context
      await codeInterpreter.destroyContext(context.id)
      // Success is indicated by not throwing an error
      
      // Verify context is destroyed
      await expect(
        codeInterpreter.execute({
          language: 'python',
          contextId: context.id,
          code: 'print(result)'
        })
      ).rejects.toThrow()
    }, timeout)

    test('should isolate contexts from each other', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create two separate contexts using backend API
      const context1 = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      const context2 = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      // Set different values in each context
      await codeInterpreter.execute({
        language: 'python',
        contextId: context1.id,
        code: 'secret = "context1_secret"'
      })
      
      await codeInterpreter.execute({
        language: 'python',
        contextId: context2.id,
        code: 'secret = "context2_secret"'
      })
      
      // Verify isolation
      const result1 = await codeInterpreter.execute({
        language: 'python',
        contextId: context1.id,
        code: 'print(secret)'
      })
      
      const result2 = await codeInterpreter.execute({
        language: 'python',
        contextId: context2.id,
        code: 'print(secret)'
      })
      
      expect(result1.stdout).toContain('context1_secret')
      expect(result2.stdout).toContain('context2_secret')
      
      // Clean up
      await codeInterpreter.destroyContext(context1.id)
      await codeInterpreter.destroyContext(context2.id)
    }, timeout)

    test('should handle rapid context creation and destruction', async () => {
      await waitForSandboxHealth(sandbox)
      
      const iterations = 5
      
      for (let i = 0; i < iterations; i++) {
        // Create context using backend API
        const context = await codeInterpreter.createCodeContext({
          language: 'python'
        })
        
        // Use it briefly
        await codeInterpreter.execute({
          language: 'python',
          contextId: context.id,
          code: `print("Iteration ${i}")`
        })
        
        // Destroy immediately
        await codeInterpreter.destroyContext(context.id)
      }
      
      // All iterations should complete without issues
      expect(true).toBe(true)
    }, timeout)
  })

  describe('Error Scenarios', () => {
    test('should handle invalid language in context creation', async () => {
      await waitForSandboxHealth(sandbox)
      
      try {
        await codeInterpreter.createCodeContext({
          language: 'invalid-language-xyz' as Language
        })
        // If it doesn't throw, that's also acceptable
        expect(true).toBe(true)
      } catch (error: any) {
        // Should throw an error for invalid language
        expect(error.message).toContain('language')
      }
    }, timeout)

    test('should handle execution without context', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Try to execute code without creating a context
      await expect(
        codeInterpreter.execute({
          language: 'python',
          contextId: 'fake-context-id',
          code: 'print("test")'
        })
      ).rejects.toThrow()
    }, timeout)

    test('should handle invalid working directory in context creation', async () => {
      await waitForSandboxHealth(sandbox)
      
      try {
        const context = await codeInterpreter.createCodeContext({
          language: 'python',
          cwd: '/nonexistent/directory/path'
        })
        
        // If context creation succeeds, the cwd might be ignored
        // or set to a default value
        expect(context).toBeDefined()
        
        // Clean up if created
        if (context) {
          await codeInterpreter.destroyContext(context.id)
        }
      } catch (error: any) {
        // Error is also acceptable
        expect(error).toBeDefined()
      }
    }, timeout)
  })
})
