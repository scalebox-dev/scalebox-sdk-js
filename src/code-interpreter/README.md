# Code Interpreter Module

## Overview

The Code Interpreter module provides a complete code execution engine that supports real-time execution and state management for multiple programming languages. This module is implemented based on the Connect RPC protocol and provides type-safe, streaming, and rich output format support.

## Architecture Design

### Module Structure

```
src/code-interpreter/
├── index.ts          # Main entry - CodeInterpreter class implementation
├── client.ts         # Connect RPC client - execution and context services
├── parser.ts         # Output parser - processes streaming responses
├── types.ts          # Type definitions - complete TypeScript type system
└── README.md         # This document
```

### Core Components

#### 1. CodeInterpreter (index.ts)
Main user interface class providing the following functionality:
- Code execution (synchronous and streaming)
- Context management (create, destroy, query)
- Asynchronous execution handling
- Resource cleanup

#### 2. RPC Clients (client.ts)
Connect RPC client implementation:
- **ExecutionServiceClient**: Streaming code execution service
- **ContextServiceClient**: State context management service
- Type-safe communication based on Protocol Buffers
- Supports HTTP/1.1 and HTTP/2

#### 3. Output Parser (parser.ts)
Handles execution response streams:
- **Logs**: Aggregates stdout/stderr output
- **Execution**: Accumulates execution data and results
- **parseOutput**: Main parsing function, handles multiple event types
- **executionToResult**: Converts to final result format

#### 4. Type Definitions (types.ts)
Complete TypeScript type system:
- Execution options and result types
- Context and language definitions
- Chart types (line chart, scatter plot, bar chart, etc.)
- Streaming response interfaces

## Technical Features

### 1. Connect RPC Communication
- Uses @connectrpc/connect for RPC communication
- Automatic protobuf serialization/deserialization
- Streaming response support
- Type-safe requests/responses

### 2. Streaming Execution
```typescript
// Real-time streaming code execution
for await (const response of interpreter.executeStream({
  language: 'python',
  code: 'print("Hello, World!")',
  onStdout: (msg) => console.log(msg.content)
})) {
  // Process each streaming response
}
```

### 3. State Context
Execution context similar to Jupyter Kernel:
- Maintain variables and state across multiple executions
- Isolated execution environment
- Configurable working directory and environment variables

### 4. Rich Output Formats
Supports multiple output types:
- Text output (stdout/stderr)
- Rich media (HTML, SVG, PNG, PDF)
- Charts (line, scatter, bar, pie, etc.)
- JSON data
- Markdown and LaTeX

### 5. Callback Handlers
Real-time event callbacks:
- `onStdout`: Standard output handler
- `onStderr`: Error output handler
- `onResult`: Result handler
- `onError`: Error handler
- `onExit`: Exit code handler

## Usage Examples

### Basic Usage

```typescript
import { CodeInterpreter } from './code-interpreter'

// Create code interpreter
const interpreter = await CodeInterpreter.create({
  templateId: 'code-interpreter',
  timeout: 60000
})

// Execute code
const result = await interpreter.execute({
  language: 'python',
  code: 'print("Hello, World!")'
})

console.log(result.stdout) // "Hello, World!\n"
```

### Streaming Execution

```typescript
// Use streaming execution for real-time feedback
for await (const response of interpreter.executeStream({
  language: 'python',
  code: 'import time\nfor i in range(5):\n    print(i)\n    time.sleep(1)',
  onStdout: (msg) => {
    console.log('Real-time output:', msg.content)
  }
})) {
  // Process streaming response
}
```

### Context Management

```typescript
// Create persistent context
const context = await interpreter.createCodeContext({
  language: 'python',
  cwd: '/workspace'
})

// Execute code multiple times in context
await interpreter.runCode('x = 42', {
  language: 'python',
  context
})

await interpreter.runCode('print(x * 2)', {
  language: 'python',
  context
}) // Output: 84

// Cleanup context
await interpreter.destroyContext(context)
```

### Callback Handling

```typescript
const result = await interpreter.runCode(
  'import matplotlib.pyplot as plt\nplt.plot([1,2,3])',
  {
    language: 'python',
    onStdout: (msg) => console.log('Output:', msg.content),
    onStderr: (msg) => console.error('Error:', msg.content),
    onResult: (result) => {
      if (result.png) {
        console.log('Chart generated')
      }
    },
    onError: (error) => console.error('Execution failed:', error.message)
  }
)
```

### Resource Cleanup

```typescript
// Close interpreter and cleanup all resources
await interpreter.close()
```

## API Documentation

### CodeInterpreter Class

#### Static Methods
- `create(opts?)`: Create new code interpreter instance

#### Instance Methods
- `execute(opts)`: Execute code (basic interface)
- `executeStream(opts)`: Stream code execution
- `runCode(code, opts)`: Execute code (complete interface)
- `runCodeAsync(code, opts)`: Asynchronous background execution
- `createContext(opts)`: Create execution context
- `createCodeContext(opts)`: Create code context (recommended)
- `destroyContext(context)`: Destroy context
- `getContexts()`: Get all contexts
- `getContext(id)`: Get specific context
- `getSandbox()`: Get underlying Sandbox instance
- `close()`: Close interpreter and cleanup resources

#### Properties
- `jupyterUrl`: Jupyter service URL

### Type Definitions

See `types.ts` file for main types including:

- `Language`: Supported programming languages
- `CodeContext`: Execution context
- `CodeInterpreterOpts`: Interpreter options
- `CodeExecutionOpts`: Code execution options
- `ExecutionResult`: Execution result
- `ExecutionResponse`: Streaming response
- `Result`: Rich media result
- `ChartTypes`: Chart types

## Code Standards

### File Organization
1. All imports sorted alphabetically
2. Type imports use `import type` syntax
3. Imports from same package are merged
4. Value imports and type imports are separated

### Documentation Comments
- All public APIs have complete JSDoc comments
- Include parameter descriptions, return value descriptions, and usage examples
- Complex logic has inline comment explanations

### Error Handling
- Use `handleConnectError` for unified error handling
- All asynchronous operations have error catching
- Provide meaningful error messages

## Latest Improvements (2025-01)

### 1. File Renaming
- `generatedClient.ts` → `client.ts` (more concise and clear)

### 2. Import Optimization
- Merge import statements from same package
- Sort all imports alphabetically
- Correctly distinguish type imports and value imports
- Remove unused imports

### 3. Documentation Enhancement
- Add detailed JSDoc comments for all classes, methods, and functions
- Add usage examples and parameter descriptions
- Add architecture descriptions and design philosophy

### 4. Code Quality
- All files pass TypeScript compilation checks
- No linter errors
- Follow consistent code style

## Comparison with Python SDK

| Feature | Python SDK | JavaScript SDK | Status |
|---------|-----------|---------------|------|
| Streaming execution | ✅ async for | ✅ AsyncGenerator | ✅ |
| gRPC communication | ✅ Connect | ✅ Connect | ✅ |
| Output parsing | ✅ parse_output | ✅ parseOutput | ✅ |
| Context management | ✅ create/destroy | ✅ create/destroy | ✅ |
| Chart support | ✅ Chart types | ✅ Chart types | ✅ |
| Callback handling | ✅ Callbacks | ✅ OutputHandlers | ✅ |
| Type safety | ⚠️ Runtime | ✅ Compile-time | ✅ |

## Dependencies

- `@connectrpc/connect`: Connect RPC client
- `@connectrpc/connect-web`: Web transport layer
- `@bufbuild/protobuf`: Protocol Buffers runtime
- Internal dependencies: `../sandbox`, `../api`, `../connectionConfig`

## Contributing Guidelines

1. Maintain consistent code style
2. Add complete type annotations
3. Write documentation and examples for new features
4. Ensure all tests pass
5. Update README descriptions

## License

Consistent with the project's main license
