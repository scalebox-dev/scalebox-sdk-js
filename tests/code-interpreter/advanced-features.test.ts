/**
 * Advanced Features Tests
 * 
 * This test suite validates advanced functionality:
 * - Complex workflow orchestration
 * - Advanced concurrency patterns
 * - Task coordination
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src/code-interpreter';

describe('Advanced Features', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'advanced_features_validation' },
      envs: { CI_TEST: 'advanced_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should handle complex workflows', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import time

print("Starting workflow...")
start_time = time.time()

# Simulate workflow steps
steps = ["collect", "process", "analyze", "report"]
results = {}

for step in steps:
    print(f"Executing step: {step}")
    time.sleep(0.1)
    results[step] = f"{step}_completed"

total_time = time.time() - start_time

print(f"Workflow completed in {total_time:.3f}s")
{
    "total_steps": len(steps),
    "completed_steps": len(results),
    "execution_time": total_time,
    "results": results
}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Starting workflow')).toBe(true);
    console.log('Complex workflow test passed');
  });

  it('should handle concurrent operations', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
from concurrent.futures import ThreadPoolExecutor
import time

print("Starting concurrent operations...")

def cpu_task(task_id):
    result = sum(i ** 2 for i in range(10000))
    return {"task_id": task_id, "result": result}

# Execute tasks concurrently
with ThreadPoolExecutor(max_workers=4) as executor:
    tasks = list(range(5))
    results = list(executor.map(cpu_task, tasks))

print(f"Completed {len(results)} concurrent tasks")
{
    "total_tasks": len(results),
    "results": results
}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Starting concurrent operations')).toBe(true);
    console.log('Concurrent operations test passed');
  });

  it('should handle task coordination', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import time

print("Starting task coordination...")

class TaskCoordinator:
    def __init__(self):
        self.tasks = []
        self.results = {}
    
    def add_task(self, task_id, task_func):
        self.tasks.append({"id": task_id, "func": task_func})
        print(f"Added task: {task_id}")
    
    def execute_tasks(self):
        for task in self.tasks:
            result = task["func"]()
            self.results[task["id"]] = result
            print(f"Completed task: {task['id']}")
        return self.results

# Create coordinator
coordinator = TaskCoordinator()

# Add tasks
coordinator.add_task("task1", lambda: sum(range(100)))
coordinator.add_task("task2", lambda: sum(range(200)))
coordinator.add_task("task3", lambda: sum(range(300)))

# Execute tasks
results = coordinator.execute_tasks()

print(f"Task coordination completed: {len(results)} tasks")
{
    "total_tasks": len(results),
    "completed": len(results),
    "results": results
}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Starting task coordination')).toBe(true);
    console.log('Task coordination test passed');
  });

  it('should handle data pipelines', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
print("Starting data pipeline...")

# Pipeline stages
def collect_data():
    print("Stage 1: Collecting data")
    return list(range(100))

def transform_data(data):
    print("Stage 2: Transforming data")
    return [x * 2 for x in data]

def analyze_data(data):
    print("Stage 3: Analyzing data")
    return {
        "count": len(data),
        "sum": sum(data),
        "avg": sum(data) / len(data)
    }

# Execute pipeline
raw_data = collect_data()
transformed_data = transform_data(raw_data)
analysis = analyze_data(transformed_data)

print("Pipeline completed")
{
    "pipeline_stages": 3,
    "analysis": analysis
}
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Starting data pipeline')).toBe(true);
    console.log('Data pipeline test passed');
  });
});