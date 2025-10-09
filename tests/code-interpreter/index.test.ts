/**
 * Code Interpreter Test Suite
 * 
 * This is the main test runner for all code interpreter tests.
 * It provides a comprehensive test suite covering:
 * - Basic operations
 * - Multi-language support
 * - Context management
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src/code-interpreter';

describe('Code Interpreter Test Suite', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    console.log('🚀 Starting Code Interpreter Test Suite...');
    
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'comprehensive_code_interpreter_validation' },
      envs: { CI_TEST: 'comprehensive_test' }
    });
    
    console.log(`✅ Created test interpreter: ${interpreter.getSandbox().sandboxId}`);
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
      console.log('🧹 Cleaned up test interpreter');
    }
  });

  it('should validate interpreter creation', async () => {
    expect(interpreter).not.toBeNull();
    expect(interpreter?.getSandbox().sandboxId).toBeDefined();
    console.log('✅ Sandbox creation validated');
  });

  it('should run basic Python execution', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
print("Code Interpreter Test Suite - Python Test")
result = sum(range(100))
print(f"Result: {result}")
{"test": "basic_python", "result": result}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Code Interpreter Test Suite')).toBe(true);
    console.log('✅ Basic Python execution passed');
  });

  it('should run JavaScript execution', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
console.log("Code Interpreter Test Suite - JavaScript Test");
const result = Array.from({length: 100}, (_, i) => i).reduce((a, b) => a + b, 0);
console.log(\`Result: \${result}\`);
({ test: "javascript", result });
`;

    const execution = await interpreter!.runCode(code, { language: 'javascript' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Code Interpreter Test Suite')).toBe(true);
    console.log('✅ JavaScript execution passed');
  });

  it('should run R language execution', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
print("Code Interpreter Test Suite - R Test")
x <- 1:100
result <- sum(x)
print(paste("Result:", result))
list(test = "r_language", result = result)
`;

    const execution = await interpreter!.runCode(code, { language: 'r' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Code Interpreter Test Suite')).toBe(true);
    console.log('✅ R language execution passed');
  });

  it('should run concurrent execution', async () => {
    expect(interpreter).not.toBeNull();

    const codes = [
      'print("Task 1"); {"task": 1, "result": 10}',
      'print("Task 2"); {"task": 2, "result": 20}',
      'print("Task 3"); {"task": 3, "result": 30}'
    ];

    const tasks = codes.map(code => interpreter!.runCode(code, { language: 'python' }));
    const results = await Promise.all(tasks);
    
    expect(results).toHaveLength(3);
    results.forEach(execution => {
      expect(execution.error).toBeUndefined();
    });
    
    console.log('✅ Concurrent execution passed');
  });

  it('should handle context management', async () => {
    expect(interpreter).not.toBeNull();

    const context = await interpreter!.createCodeContext({
      language: 'python',
      cwd: '/tmp'
    });

    const setupCode = `
counter = 0
def increment():
    global counter
    counter += 1
    return counter

result = increment()
print(f"Setup complete, counter: {result}")
`;

    const setupExec = await interpreter!.runCode(setupCode, { context, language: 'python' });
    expect(setupExec.error).toBeUndefined();

    const useCode = `
print(f"Current counter: {counter}")
increment()
print(f"After increment: {counter}")
`;

    const useExec = await interpreter!.runCode(useCode, { context, language: 'python' });
    expect(useExec.error).toBeUndefined();

    await interpreter!.destroyContext(context.id);
    console.log('✅ Context management passed');
  });

  it('should handle error gracefully', async () => {
    expect(interpreter).not.toBeNull();

    const errorCode = `
print("Before error")
result = 10 / 0
print("After error")
`;

    const execution = await interpreter!.runCode(errorCode, { language: 'python' });
    expect(execution.error).not.toBeNull();
    expect(execution.error?.name).toContain('ZeroDivisionError');
    console.log('✅ Error handling passed');
  });
});