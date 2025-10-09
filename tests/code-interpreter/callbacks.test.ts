/**
 * Callback Handling Tests
 * 
 * This test suite validates callback functionality:
 * - stdout/stderr callbacks
 * - result/error callbacks
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src';
import type { ExecutionError, Result, OutputMessage } from '../../src/code-interpreter/types';

describe('Callback Handling', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'callback_validation' },
      envs: { CI_TEST: 'callback_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should handle stdout callbacks', async () => {
    expect(interpreter).not.toBeNull();

    const stdoutMessages: string[] = [];

    const stdoutCallback = async (msg: OutputMessage): Promise<void> => {
      stdoutMessages.push(msg.content);
      console.log(`STDOUT: ${msg.content}`);
    };

    const code = `
print("Message 1")
print("Message 2")
print("Message 3")
{"test": "stdout_callback"}
`;

    const execution = await interpreter!.runCode(code, {
      language: 'python',
      onStdout: stdoutCallback
    });

    expect(execution.error).toBeUndefined();
    expect(stdoutMessages.length).toBeGreaterThan(0);
    console.log('Stdout callback test passed');
  });

  it('should handle result callbacks', async () => {
    expect(interpreter).not.toBeNull();

    const capturedResults: Result[] = [];

    const resultCallback = async (result: Result): Promise<void> => {
      capturedResults.push(result);
      console.log(`RESULT: ${JSON.stringify(result)}`);
    };

    const code = `
result_data = {"status": "completed", "value": 42}
print("Generating result")
result_data
`;

    const execution = await interpreter!.runCode(code, {
      language: 'python',
      onResult: resultCallback
    });

    expect(execution.error).toBeUndefined();
    expect(execution.result).toBeDefined();
    console.log('Result callback test passed');
  });

  it('should handle error callbacks', async () => {
    expect(interpreter).not.toBeNull();

    const capturedErrors: ExecutionError[] = [];

    const errorCallback = async (error: ExecutionError): Promise<void> => {
      capturedErrors.push(error);
      console.log(`ERROR: ${error.name}`);
    };

    const errorCode = `
print("Before error")
result = 10 / 0
print("After error")
`;

    const execution = await interpreter!.runCode(errorCode, {
      language: 'python',
      onError: errorCallback
    });

    expect(execution.error).not.toBeNull();
    expect(execution.error?.name).toContain('ZeroDivisionError');
    console.log('Error callback test passed');
  });
});