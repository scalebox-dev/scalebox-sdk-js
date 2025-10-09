/**
 * Multi-Language Support Tests
 * 
 * This test suite validates multi-language support:
 * - R language execution
 * - Node.js/JavaScript execution
 * - Bash shell commands
 * - Java execution
 * - TypeScript execution
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src/code-interpreter';

describe('Multi-Language Support', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'multi_language_validation' },
      envs: { CI_TEST: 'multi_lang_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  describe('R Language Support', () => {
    it('should execute basic R code', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
print("Hello from R!")
x <- 15
y <- 25
sum_result <- x + y
print(paste("Sum:", sum_result))
list(sum = sum_result)
`;

      const execution = await interpreter!.runCode(code, { language: 'r' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('Hello from R!')).toBe(true);
      console.log('R language basic execution test passed');
    });

    it('should perform R data analysis', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
# Create sample dataset
data <- data.frame(
  id = 1:50,
  value = rnorm(50, mean = 60, sd = 20)
)

print("Dataset created")
summary_stats <- summary(data$value)
print(summary_stats)

list(total_rows = nrow(data), summary = summary_stats)
`;

      const execution = await interpreter!.runCode(code, { language: 'r' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('Dataset created')).toBe(true);
      console.log('R data analysis test passed');
    });
  });

  describe('JavaScript Support', () => {
    it('should execute basic JavaScript code', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
console.log("Hello from JavaScript!");
const a = 11, b = 13;
console.log(\`Sum: \${a + b}\`);
({ sum: a + b, product: a * b })
`;

      const execution = await interpreter!.runCode(code, { language: 'javascript' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('Hello from JavaScript!')).toBe(true);
      console.log('JavaScript basic execution test passed');
    });

    it('should handle JavaScript async operations', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
async function run() {
  console.log("Async task started");
  await new Promise(r => setTimeout(r, 100));
  console.log("Async task completed");
  return { status: "done", value: 42 };
}
run();
`;

      const execution = await interpreter!.runCode(code, { language: 'javascript' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('Async task started')).toBe(true);
      console.log('JavaScript async operations test passed');
    });
  });

  describe('Bash Shell Support', () => {
    it('should execute basic bash commands', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
echo "Hello from Bash!"
NAME="scalebox"
echo "Hello, $NAME!"
whoami
`;

      const execution = await interpreter!.runCode(code, { language: 'bash' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('Hello from Bash!')).toBe(true);
      console.log('Bash basic execution test passed');
    });

    it('should handle file operations in bash', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
WORKDIR="/tmp/bash_test"
mkdir -p "$WORKDIR"
cd "$WORKDIR"
echo "test content" > test.txt
cat test.txt
echo "BASH_DONE"
`;

      const execution = await interpreter!.runCode(code, { language: 'bash' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('BASH_DONE')).toBe(true);
      console.log('Bash file operations test passed');
    });
  });

  describe('Java Support', () => {
    it('should execute basic Java code', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
System.out.println("Hello from Java!");
int x = 15;
int y = 25;
int sum = x + y;
System.out.println("Sum: " + sum);
sum;
`;

      const execution = await interpreter!.runCode(code, { language: 'java' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('Hello from Java!')).toBe(true);
      console.log('Java basic execution test passed');
    });
  });

  describe('TypeScript Support', () => {
    it('should execute basic TypeScript code', async () => {
      expect(interpreter).not.toBeNull();

      const code = `
console.log("Hello from TypeScript!");
const x: number = 14;
const y: number = 16;
const sum: number = x + y;
console.log(\`Sum: \${sum}\`);
`;

      const execution = await interpreter!.runCode(code, { language: 'typescript' });
      expect(execution.error).toBeUndefined();
      expect(execution.logs.stdout.includes('Hello from TypeScript!')).toBe(true);
      console.log('TypeScript basic execution test passed');
    });
  });
});