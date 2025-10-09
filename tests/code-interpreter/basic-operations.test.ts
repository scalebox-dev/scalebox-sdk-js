/**
 * Basic Code Interpreter Operations Tests
 * 
 * This test suite validates core functionality of the CodeInterpreter:
 * - Basic code execution (Python)
 * - Concurrent code execution
 * - Data science operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src';

describe('Basic Code Interpreter Operations', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'basic_operations' },
      envs: { CI_TEST: 'basic_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should execute basic Python code', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
print("Hello from Python!")
x = 10
y = 20
result = x + y
print(f"Result: {result}")
{"test": "basic_python", "result": result}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Hello from Python!')).toBe(true);
    expect(execution.logs.stdout.includes('Result: 30')).toBe(true);
    console.log('Basic Python execution test passed');
  });

  it('should execute concurrent code', async () => {
    expect(interpreter).not.toBeNull();

    const codes = [
      'print("Task 1"); {"task": 1, "value": 10}',
      'print("Task 2"); {"task": 2, "value": 20}',
      'print("Task 3"); {"task": 3, "value": 30}'
    ];

    const startTime = Date.now();
    const tasks = codes.map(code => interpreter!.runCode(code, { language: 'python' }));
    const results = await Promise.all(tasks);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(3);
    results.forEach(execution => {
      expect(execution.error).toBeUndefined();
    });

    console.log(`Concurrent execution completed in ${duration}ms`);
  });

  it('should execute data science operations', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import pandas as pd
import numpy as np

# Create sample data
data = pd.DataFrame({
    'value': np.random.randn(100),
    'category': np.random.choice(['A', 'B', 'C'], 100)
})

# Calculate statistics
stats = {
    'total_records': len(data),
    'mean_value': float(data['value'].mean()),
    'categories': data['category'].value_counts().to_dict()
}

print(f"Processed {stats['total_records']} records")
stats
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Processed 100 records')).toBe(true);
    console.log('Data science operations test passed');
  });
});
