/**
 * Error Handling Tests
 * 
 * This test suite validates error handling functionality:
 * - Exception catching and reporting
 * - Error callback handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src/code-interpreter';
import type { ExecutionError } from '../../src/code-interpreter/types';

describe('Error Handling', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'error_handling' },
      envs: { CI_TEST: 'error_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should handle Python syntax errors', async () => {
    expect(interpreter).not.toBeNull();

    const errorCode = `
def broken_function()
    return "This will fail"
`;

    const execution = await interpreter!.runCode(errorCode, { language: 'python' });
    expect(execution.error).not.toBeUndefined();
    expect(execution.error?.name).toContain('SyntaxError');
    console.log('Python syntax error test passed');
  });

  it('should handle runtime errors', async () => {
    expect(interpreter).not.toBeNull();

    const errorCode = `
print("Before error")
result = 10 / 0
print(f"After error: {result}")
`;

    const execution = await interpreter!.runCode(errorCode, { language: 'python' });
    expect(execution.error).not.toBeUndefined();
    expect(execution.error?.name).toContain('ZeroDivisionError');
    expect(execution.logs.stdout.includes('Before error')).toBe(true);
    console.log('Runtime error test passed');
  });

  it('should handle error callbacks', async () => {
    expect(interpreter).not.toBeNull();

    const errorCaptured: ExecutionError[] = [];

    const errorCallback = async (error: ExecutionError): Promise<void> => {
      errorCaptured.push(error);
      console.log(`Captured error: ${error.name}`);
    };

    const errorCode = `
print("Starting task")
result = 10 / 0
print("This should not print")
`;

    const execution = await interpreter!.runCode(errorCode, {
      language: 'python',
      onError: errorCallback
    });

    expect(execution.error).not.toBeUndefined();
    expect(execution.error?.name).toContain('ZeroDivisionError');
    console.log('Error callback test passed');
  });

  it('should handle import errors', async () => {
    expect(interpreter).not.toBeNull();

    const errorCode = `
import nonexistent_module
result = nonexistent_module.some_function()
`;

    const execution = await interpreter!.runCode(errorCode, { language: 'python' });
    expect(execution.error).not.toBeUndefined();
    expect(execution.error?.name).toContain('ModuleNotFoundError');
    console.log('Import error test passed');
  });

  it('should handle JavaScript errors', async () => {
    expect(interpreter).not.toBeNull();

    const jsErrorCode = `
function brokenFunction() {
    throw new Error("Test error");
}
brokenFunction();
`;

    const execution = await interpreter!.runCode(jsErrorCode, { language: 'javascript' });
    expect(execution.error).not.toBeUndefined();
    expect(execution.error?.name).toContain('Error');
    console.log('JavaScript error test passed');
  });
});
