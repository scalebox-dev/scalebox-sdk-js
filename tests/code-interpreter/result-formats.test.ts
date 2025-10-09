/**
 * Result Format Tests
 * 
 * This test suite validates result format handling:
 * - Text format results
 * - JSON format results
 * - Complex data structures
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src/code-interpreter';

describe('Result Format Tests', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'result_format_validation' },
      envs: { CI_TEST: 'result_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should generate text format results', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
text_content = """
Test Report
===========
Status: Success
Duration: 1.23s
"""
print("Generated text result")
text_content
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.results?.length).toBeGreaterThan(0);
    console.log('Text format result test passed');
  });

  it('should generate JSON format results', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import json

data = {
    "status": "success",
    "execution": {
        "mode": "concurrent",
        "tasks": 8,
        "duration": 1.23
    },
    "metrics": {
        "throughput": 65,
        "success_rate": 100.0
    }
}

print("Generated JSON result")
data
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Generated JSON result')).toBe(true);
    console.log('JSON format result test passed');
  });

  it('should handle structured data results', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import pandas as pd
import numpy as np

# Generate sample data
data = pd.DataFrame({
    'id': range(50),
    'value': np.random.normal(50, 15, 50),
    'category': np.random.choice(['A', 'B', 'C'], 50)
})

stats = {
    'total_records': len(data),
    'mean_value': float(data['value'].mean()),
    'categories': data['category'].value_counts().to_dict()
}

print(f"Generated {stats['total_records']} records")
stats
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Generated 50 records')).toBe(true);
    console.log('Structured data result test passed');
  });

  it('should handle complex nested results', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
complex_data = {
    "metadata": {
        "timestamp": "2024-09-17T10:30:00Z",
        "type": "test"
    },
    "data": {
        "values": [1, 2, 3, 4, 5],
        "stats": {
            "sum": 15,
            "avg": 3.0
        }
    }
}

print("Generated complex nested data")
complex_data
`;

    const execution = await interpreter!.runCode(code, { language: 'python' });
    expect(execution.error).toBeUndefined();
    expect(execution.logs.stdout.includes('Generated complex nested data')).toBe(true);
    console.log('Complex nested result test passed');
  });
});