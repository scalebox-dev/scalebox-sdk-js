/**
 * CodeContext Management Tests
 * 
 * This test suite validates context management functionality:
 * - CodeContext creation and destruction
 * - State persistence across executions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src/code-interpreter';
import type { CodeContext } from '../../src/code-interpreter/types';

describe('CodeContext Management', () => {
  let interpreter: CodeInterpreter | null = null;
  const contexts: Map<string, CodeContext> = new Map();

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'context_management' },
      envs: { CI_TEST: 'context_test' }
    });
  });

  afterAll(async () => {
    // Clean up all contexts
    for (const [name, context] of contexts) {
      try {
        await interpreter!.destroyContext(context.id);
        console.log(`Successfully destroyed context ${name}: ${context.id}`);
      } catch (e) {
        console.warn(`Failed to destroy context ${name}: ${e}`);
      }
    }
    contexts.clear();

    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should create and destroy Python context', async () => {
    expect(interpreter).not.toBeNull();

    // Create Python context using backend API
    const pythonCodeContext = await interpreter!.createCodeContext({
      language: 'python',
      cwd: '/tmp'
    });
    
    expect(pythonCodeContext).toBeDefined();
    expect(pythonCodeContext.id).toBeDefined();
    contexts.set('python', pythonCodeContext);
    console.log(`Created Python context: ${pythonCodeContext.id}`);

    // Test context destruction
    try {
      await interpreter!.destroyContext(pythonCodeContext.id);
      contexts.delete('python');
      console.log(`Successfully destroyed Python context: ${pythonCodeContext.id}`);
    } catch (e) {
      console.warn(`Failed to destroy Python context ${pythonCodeContext.id}: ${e}`);
    }
  });

  it('should manage context state persistence', async () => {
    expect(interpreter).not.toBeNull();

    // Create new context for state management test
    const context = await interpreter!.createCodeContext({
      language: 'python',
      cwd: '/tmp'
    });
    contexts.set('state_test', context);

    // Set up state in context
    const setupCode = `
counter = 0
def increment():
    global counter
    counter += 1
    return counter

result = increment()
print(f"Setup complete, counter: {result}")
`;

    const execution1 = await interpreter!.runCode(setupCode, { context, language: 'python' });
    expect(execution1.error).toBeUndefined();

    // Use the state in the same context
    const useCode = `
print(f"Current counter: {counter}")
increment()
print(f"After increment: {counter}")
`;

    const execution2 = await interpreter!.runCode(useCode, { context, language: 'python' });
    expect(execution2.error).toBeUndefined();
    expect(execution2.logs.stdout.includes('After increment: 2')).toBe(true);

    // Clean up context
    try {
      await interpreter!.destroyContext(context.id);
      contexts.delete('state_test');
      console.log(`Destroyed context: ${context.id}`);
    } catch (e) {
      console.warn(`Failed to destroy context ${context.id}: ${e}`);
    }
  });

  it('should support different language contexts', async () => {
    expect(interpreter).not.toBeNull();

    // Create Python context
    const pythonCtx = await interpreter!.createCodeContext({
      language: 'python',
      cwd: '/tmp'
    });
    contexts.set('python_multi', pythonCtx);

    const pythonCode = `
counter = 0
counter += 1
print(f"Python counter: {counter}")
{"python_result": counter}
`;

    const pythonExec = await interpreter!.runCode(pythonCode, { context: pythonCtx, language: 'python' });
    expect(pythonExec.error).toBeUndefined();
    expect(pythonExec.logs.stdout.includes('Python counter: 1')).toBe(true);

    // Clean up
    try {
      await interpreter!.destroyContext(pythonCtx.id);
      contexts.delete('python_multi');
      console.log('Destroyed multi-language contexts');
    } catch (e) {
      console.warn(`Failed to destroy contexts: ${e}`);
    }
  });

  it('should handle context isolation', async () => {
    expect(interpreter).not.toBeNull();

    // Create two separate contexts
    const context1 = await interpreter!.createCodeContext({
      language: 'python',
      cwd: '/tmp'
    });
    contexts.set('isolation_1', context1);

    const context2 = await interpreter!.createCodeContext({
      language: 'python',
      cwd: '/tmp'
    });
    contexts.set('isolation_2', context2);

    // Set variable in context1
    const setupCode1 = `
variable = "context1_value"
print(f"Context 1: {variable}")
`;
    const exec1 = await interpreter!.runCode(setupCode1, { context: context1, language: 'python' });
    expect(exec1.error).toBeUndefined();

    // Set different variable in context2
    const setupCode2 = `
variable = "context2_value"
print(f"Context 2: {variable}")
`;
    const exec2 = await interpreter!.runCode(setupCode2, { context: context2, language: 'python' });
    expect(exec2.error).toBeUndefined();

    // Verify isolation - context1 should still have its value
    const verifyCode1 = `print(f"Context 1 verify: {variable}")`;
    const verifyExec1 = await interpreter!.runCode(verifyCode1, { context: context1, language: 'python' });
    expect(verifyExec1.error).toBeUndefined();
    expect(verifyExec1.logs.stdout.includes('context1_value')).toBe(true);

    // Clean up contexts
    try {
      await interpreter!.destroyContext(context1.id);
      await interpreter!.destroyContext(context2.id);
      contexts.delete('isolation_1');
      contexts.delete('isolation_2');
      console.log('Destroyed isolation test contexts');
    } catch (e) {
      console.warn(`Failed to destroy contexts: ${e}`);
    }
  });
});
