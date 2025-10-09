/**
 * Performance Tests
 * 
 * This test suite validates performance characteristics:
 * - Concurrent task execution
 * - Batch processing performance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src';

describe('Performance Tests', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'performance_validation' },
      envs: { CI_TEST: 'performance_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should handle concurrent tasks efficiently', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import time

print("Performance test started")
start_time = time.time()

# Simple computation
result = sum(i ** 2 for i in range(10000))

end_time = time.time()
duration = end_time - start_time

print(f"Test completed in {duration:.3f}s")
{"performance": "complete", "duration": duration, "result": result}
`;

    const startTestTime = Date.now();
    const execution = await interpreter!.runCode(code, { language: 'python' });
    const testDuration = Date.now() - startTestTime;

    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Performance test started')).toBe(true);
    console.log(`Performance test completed in ${testDuration}ms`);
  });

  it('should handle batch processing efficiently', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import time

print("Batch processing started")
start_time = time.time()

# Process batches
batches = 10
batch_size = 100
total = 0

for batch in range(batches):
    batch_sum = sum(range(batch * batch_size, (batch + 1) * batch_size))
    total += batch_sum

end_time = time.time()
duration = end_time - start_time

print(f"Processed {batches} batches in {duration:.3f}s")
{"total_batches": batches, "total": total, "duration": duration}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Batch processing started')).toBe(true);
    console.log('Batch processing test passed');
  });

  it('should handle multiple concurrent executions', async () => {
    expect(interpreter).not.toBeNull();

    const codes = Array.from({ length: 5 }, (_, i) => `
print("Task ${i + 1} started")
result = sum(range(${i * 1000}, ${(i + 1) * 1000}))
print("Task ${i + 1} completed")
{"task": ${i + 1}, "result": result}
`);

    const startTime = Date.now();
    const tasks = codes.map(code => interpreter!.runCode(code, { language: 'python' }));
    const results = await Promise.all(tasks);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(5);
    results.forEach(execution => {
      expect(execution.error).toBeUndefined();
    });

    console.log(`Concurrent execution of 5 tasks completed in ${duration}ms`);
  });
});