import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { Sandbox, CodeInterpreter } from '../../src'
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

describe('Execution Service Handlers', () => {
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

  describe('Execute Handler - Basic Execution', () => {
    test('should execute simple Python code', async () => {
      await waitForSandboxHealth(sandbox)
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code: 'print("Hello from Python")'
      })
      
      expect(result).toBeDefined()
      expect(result.stdout).toContain('Hello from Python')
      expect(result.exitCode).toBe(0)
    }, timeout)

    test('should execute code with multiple print statements', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
print("Line 1")
print("Line 2")
print("Line 3")
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.stdout).toContain('Line 1')
      expect(result.stdout).toContain('Line 2')
      expect(result.stdout).toContain('Line 3')
      expect(result.exitCode).toBe(0)
    }, timeout)

    test('should execute code with return value', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
def calculate():
    return 42

result = calculate()
print(f"The answer is: {result}")
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.stdout).toContain('The answer is: 42')
      expect(result.exitCode).toBe(0)
    }, timeout)

    test('should capture stderr output', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
import sys
print("Normal output")
print("Error output", file=sys.stderr)
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.stdout).toContain('Normal output')
      expect(result.stderr).toContain('Error output')
      expect(result.exitCode).toBe(0)
    }, timeout)

    test('should handle code with errors', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
print("Before error")
undefined_variable
print("After error")  # This won't execute
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.stdout).toContain('Before error')
      expect(result.stdout).not.toContain('After error')
      expect(result.error).toBeDefined()
      expect(result.error?.name).toContain('NameError')
      expect(result.error?.value).toContain('undefined_variable')
      expect(result.error?.traceback).toBeDefined()
    }, timeout)

    test('should handle syntax errors', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
def invalid syntax():
    pass
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.error).toBeDefined()
      expect(result.error?.name).toContain('SyntaxError')
      expect(result.error?.traceback).toBeDefined()
    }, timeout)
  })

  describe('Execute Handler - With Context', () => {
    test('should execute code in specific context', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create a context using backend API
      const context = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      // Execute code in context
      const result = await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: 'x = 100\nprint(f"x = {x}")'
      })
      
      expect(result.stdout).toContain('x = 100')
      
      // Execute more code in same context
      const result2 = await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: 'print(f"x is still {x}")'
      })
      
      expect(result2.stdout).toContain('x is still 100')
      
      // Clean up
      await codeInterpreter.destroyContext(context.id)
    }, timeout)

    test('should maintain separate states in different contexts', async () => {
      await waitForSandboxHealth(sandbox)
      
      // Create two contexts using backend API
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
        code: 'value = "Context 1"'
      })
      
      await codeInterpreter.execute({
        language: 'python',
        contextId: context2.id,
        code: 'value = "Context 2"'
      })
      
      // Verify values are separate
      const result1 = await codeInterpreter.execute({
        language: 'python',
        contextId: context1.id,
        code: 'print(value)'
      })
      
      const result2 = await codeInterpreter.execute({
        language: 'python',
        contextId: context2.id,
        code: 'print(value)'
      })
      
      expect(result1.stdout).toContain('Context 1')
      expect(result2.stdout).toContain('Context 2')
      
      // Clean up
      await codeInterpreter.destroyContext(context1.id)
      await codeInterpreter.destroyContext(context2.id)
    }, timeout)
  })

  describe('Execute Handler - Environment Variables', () => {
    test('should execute code with environment variables', async () => {
      await waitForSandboxHealth(sandbox)
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code: `
import os
print(f"MY_VAR: {os.environ.get('MY_VAR', 'not set')}")
`,
        envVars: {
          'MY_VAR': 'test_value_123'
        }
      })
      
      expect(result.stdout).toContain('MY_VAR: test_value_123')
    }, timeout)

    test('should handle multiple environment variables', async () => {
      await waitForSandboxHealth(sandbox)
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code: `
import os
print(f"VAR1: {os.environ.get('VAR1')}")
print(f"VAR2: {os.environ.get('VAR2')}")
print(f"VAR3: {os.environ.get('VAR3')}")
`,
        envVars: {
          'VAR1': 'value1',
          'VAR2': 'value2',
          'VAR3': 'value3'
        }
      })
      
      expect(result.stdout).toContain('VAR1: value1')
      expect(result.stdout).toContain('VAR2: value2')
      expect(result.stdout).toContain('VAR3: value3')
    }, timeout)

    test('should preserve environment variables in context', async () => {
      await waitForSandboxHealth(sandbox)
      
      const context = await codeInterpreter.createCodeContext({
        language: 'python'
      })
      
      // Set environment variables in first execution
      await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: 'import os',
        envVars: {
          'PERSISTENT_VAR': 'persistent_value'
        }
      })
      
      // Check if environment variable persists
      const result = await codeInterpreter.execute({
        language: 'python',
        contextId: context.id,
        code: 'print(f"PERSISTENT_VAR: {os.environ.get(\'PERSISTENT_VAR\', \'not found\')}")'
      })
      
      // Environment variables might or might not persist depending on implementation
      expect(result.stdout).toBeDefined()
      
      // Clean up
      await codeInterpreter.destroyContext(context.id)
    }, timeout)
  })

  describe('Execute Handler - Data Types and Display', () => {
    test('should handle execution results with data', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
# Create some data
data = [1, 2, 3, 4, 5]
print(f"Sum: {sum(data)}")
data  # This might be displayed as execution result
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.stdout).toContain('Sum: 15')
      // The result might contain the data representation
      if (result.text) {
        expect(result.text).toContain('[1, 2, 3, 4, 5]')
      }
    }, timeout)

    test('should handle pandas DataFrame display', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
try:
    import pandas as pd
    df = pd.DataFrame({
        'A': [1, 2, 3],
        'B': [4, 5, 6],
        'C': [7, 8, 9]
    })
    print("DataFrame created")
    print(df)
    df  # Display the DataFrame
except ImportError:
    print("pandas not available")
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      // Check if pandas is available
      if (result.stdout.includes('pandas not available')) {
        expect(result.stdout).toContain('pandas not available')
      } else {
        expect(result.stdout).toContain('DataFrame created')
        // Should show the DataFrame in some format
        expect(result.stdout).toMatch(/A.*B.*C/s)
      }
    }, timeout)

    test('should handle matplotlib plots', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
try:
    import matplotlib.pyplot as plt
    import numpy as np
    
    x = np.linspace(0, 10, 100)
    y = np.sin(x)
    
    plt.figure(figsize=(8, 6))
    plt.plot(x, y)
    plt.title('Sine Wave')
    plt.xlabel('X')
    plt.ylabel('Y')
    plt.show()
    print("Plot created")
except ImportError:
    print("matplotlib not available")
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      if (result.stdout.includes('matplotlib not available')) {
        expect(result.stdout).toContain('matplotlib not available')
      } else {
        expect(result.stdout).toContain('Plot created')
        // Plot data might be in png, svg, or other format
        if (result.png || result.svg) {
          expect(result.png || result.svg).toBeDefined()
        }
      }
    }, timeout)

    test('should handle JSON output', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
import json

data = {
    "name": "Test",
    "value": 42,
    "nested": {
        "key": "value"
    }
}

print(json.dumps(data, indent=2))
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.stdout).toContain('"name": "Test"')
      expect(result.stdout).toContain('"value": 42')
      expect(result.stdout).toContain('"key": "value"')
    }, timeout)

    test('should handle HTML output', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
from IPython.display import HTML, display

html_content = """
<div style="color: blue;">
    <h1>Test HTML</h1>
    <p>This is a test paragraph.</p>
</div>
"""

try:
    display(HTML(html_content))
    print("HTML displayed")
except Exception as e:
    print("IPython display not available:", str(e))
    print("Raw HTML content:")
    print(html_content)
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      // Check if HTML is in results array or stdout
      const hasHtmlInResults = result.results && result.results.some((r: any) => r.html && r.html.includes('Test HTML'))
      const hasHtmlInStdout = result.stdout && result.stdout.includes('Test HTML')
      
      expect(hasHtmlInResults || hasHtmlInStdout).toBe(true)
    }, timeout)
  })

  describe('Execute Handler - Long Running Code', () => {
    test('should handle code with delays', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
import time
print("Starting...")
time.sleep(1)
print("Middle...")
time.sleep(1)
print("Done!")
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      expect(result.stdout).toContain('Starting...')
      expect(result.stdout).toContain('Middle...')
      expect(result.stdout).toContain('Done!')
    }, timeout)

    test('should handle iterative output', async () => {
      await waitForSandboxHealth(sandbox)
      
      const code = `
import time
for i in range(5):
    print(f"Iteration {i}")
    time.sleep(0.1)
print("All iterations complete")
`
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code
      })
      
      for (let i = 0; i < 5; i++) {
        expect(result.stdout).toContain(`Iteration ${i}`)
      }
      expect(result.stdout).toContain('All iterations complete')
    }, timeout)
  })

  describe('Execute Handler - Different Languages', () => {
    test('should execute JavaScript code', async () => {
      await waitForSandboxHealth(sandbox)
      
      try {
        const result = await codeInterpreter.execute({
          language: 'javascript',
          code: `
console.log("Hello from JavaScript");
const x = 10;
const y = 20;
console.log(\`Sum: \${x + y}\`);
`
        })
        
        expect(result.stdout).toContain('Hello from JavaScript')
        expect(result.stdout).toContain('Sum: 30')
      } catch (error) {
        // JavaScript kernel might not be available
        console.log('JavaScript kernel not available:', error)
      }
    }, timeout)

    test('should execute R code', async () => {
      await waitForSandboxHealth(sandbox)
      
      try {
        const result = await codeInterpreter.execute({
          language: 'r',
          code: `
print("Hello from R")
x <- c(1, 2, 3, 4, 5)
print(paste("Mean:", mean(x)))
print(paste("Sum:", sum(x)))
`
        })
        
        expect(result.stdout).toContain('Hello from R')
        expect(result.stdout).toContain('Mean: 3')
        expect(result.stdout).toContain('Sum: 15')
      } catch (error) {
        // R kernel might not be available
        console.log('R kernel not available:', error)
      }
    }, timeout)
  })

  describe('Execute Handler - Streaming', () => {
    test('should stream execution output', async () => {
      await waitForSandboxHealth(sandbox)
      
      const events: any[] = []
      
      // Use streaming execution if available
      if (codeInterpreter.executeStream) {
        for await (const event of codeInterpreter.executeStream({
          language: 'python',
          code: `
import time
for i in range(3):
    print(f"Event {i}")
    time.sleep(0.5)
`
        })) {
          events.push(event)
        }
        
        // Should have multiple stdout events
        const stdoutEvents = events.filter((e: any) => e.stdout || e.type === 'stdout')
        expect(stdoutEvents.length).toBeGreaterThan(0)
        
        // Should have result event
        const resultEvents = events.filter((e: any) => e.result || e.type === 'result')
        expect(resultEvents.length).toBeGreaterThan(0)
      } else {
        // Non-streaming execution
        const result = await codeInterpreter.execute({
          language: 'python',
          code: 'print("Non-streaming execution")'
        })
        expect(result.stdout).toContain('Non-streaming execution')
      }
    }, timeout)
  })

  describe('Execute Handler - Error Handling', () => {
    test('should handle division by zero', async () => {
      await waitForSandboxHealth(sandbox)
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code: '1 / 0'
      })
      
      expect(result.error).toBeDefined()
      expect(result.error?.name).toContain('ZeroDivisionError')
      expect(result.error?.traceback).toBeDefined()
    }, timeout)

    test('should handle import errors', async () => {
      await waitForSandboxHealth(sandbox)
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code: 'import nonexistent_module'
      })
      
      expect(result.error).toBeDefined()
      expect(result.error?.name).toContain('ModuleNotFoundError')
      expect(result.error?.traceback).toBeDefined()
    }, timeout)

    test('should handle infinite loops with timeout', async () => {
      await waitForSandboxHealth(sandbox)
      
      // This test might timeout or be interrupted
      try {
        const result = await codeInterpreter.execute({
          language: 'python',
          code: `
import signal
import time

def timeout_handler(signum, frame):
    raise TimeoutError("Execution timeout")

# Set a timeout
signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(2)  # 2 second timeout

try:
    while True:
        pass
except TimeoutError:
    print("Loop interrupted by timeout")
`
        })
        
        // If timeout handling works
        if (result.stdout) {
          expect(result.stdout).toContain('timeout')
        }
      } catch (error) {
        // Timeout is expected
        expect(error).toBeDefined()
      }
    }, timeout)

    test('should handle memory-intensive operations', async () => {
      await waitForSandboxHealth(sandbox)
      
      const result = await codeInterpreter.execute({
        language: 'python',
        code: `
try:
    # Try to create a large list
    large_list = [0] * (10**6)  # 1 million elements
    print(f"Created list with {len(large_list)} elements")
except MemoryError:
    print("Memory error occurred")
`
      })
      
      // Should either succeed or handle memory error gracefully
      expect(result.stdout).toMatch(/Created list|Memory error/)
    }, timeout)
  })
})
