/**
 * Simple Code Interpreter Tests
 * 
 * Basic tests for CodeInterpreter functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src';

describe('Simple Code Interpreter Tests', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'simple_code_interpreter_validation' },
      envs: { CI_TEST: 'simple_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should create code interpreter', async () => {
    expect(interpreter).not.toBeNull();
    expect(interpreter?.getSandbox().sandboxId).toBeDefined();
    console.log(`Created CodeInterpreter with sandbox ID: ${interpreter?.getSandbox().sandboxId}`);
  });

  it('should execute basic Python code', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
print("Hello from Python!")
x = 10
y = 20
result = x + y
print(f"Result: {result}")
{"test": "python", "result": result}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Hello from Python!')).toBe(true);
    expect(execution.logs.stdout.includes('Result: 30')).toBe(true);
    console.log('Python execution test passed');
  });

  it('should execute JavaScript code', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
console.log("Hello from JavaScript!");
const x = 15;
const y = 25;
const result = x + y;
console.log(\`Result: \${result}\`);
({ test: "javascript", result });
`;

    const execution = await interpreter!.runCode(code, { language: 'javascript' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Hello from JavaScript!')).toBe(true);
    expect(execution.logs.stdout.includes('Result: 40')).toBe(true);
    console.log('JavaScript execution test passed');
  });

  it('should handle errors gracefully', async () => {
    expect(interpreter).not.toBeNull();

    const errorCode = `
print("Before error")
result = 10 / 0  # This will cause a division by zero error
print("After error")  # This should not execute
`;

    const execution = await interpreter!.runCode(errorCode, { language: 'python' });
    expect(execution.error).not.toBeNull();
    expect(execution.error?.name).toContain('ZeroDivisionError');
    expect(execution.logs.stdout.includes('Before error')).toBe(true);
    expect(execution.logs.stdout.includes('After error')).toBe(false);
    console.log('Error handling test passed');
  });

  it('should create and use context', async () => {
    expect(interpreter).not.toBeNull();

    // Create context using backend API
    const context = await interpreter!.createCodeContext({
      language: 'python',
      cwd: '/tmp'
    });

    // Setup code
    const setupCode = `
counter = 0
def increment():
    global counter
    counter += 1
    return counter

result = increment()
print(f"Setup complete, counter: {result}")
`;

    const setupExecution = await interpreter!.runCode(setupCode, { context, language: 'python' });
    expect(setupExecution.error).toBeUndefined();

    // Use context
    const useCode = `
print(f"Using context, current counter: {counter}")
increment()
print(f"After increment: {counter}")
`;

    const useExecution = await interpreter!.runCode(useCode, { context, language: 'python' });
    expect(useExecution.error).toBeUndefined();

    // Cleanup
    await interpreter!.destroyContext(context.id);
    console.log('Context management test passed');
  });
});
