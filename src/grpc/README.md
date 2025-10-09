# gRPC Module

## Overview

The gRPC module provides a Connect RPC protocol-based client implementation for communicating with Scalebox sandbox services. This module offers clients for core services including filesystem operations, process management, code execution, and context management.

## Module Structure

```
src/grpc/
├── index.ts       # Main entry - unified export of all functionality
├── client.ts      # GrpcClient class - filesystem and process services
├── api.ts         # API factory functions - create complete service clients
└── errors.ts      # Error handling utilities - gRPC error type checking
```

### File Descriptions

#### index.ts
Main entry file for the module, providing unified exports of all functionality:
- Core client classes and factory functions
- API factory functions and types
- Error handling utilities
- Generated protobuf types

#### client.ts
Provides the `GrpcClient` class for accessing basic services:
- **Filesystem Service**: File operations (read, write, list, watch, etc.)
- **Process Service**: Process management (start, stop, I/O streams, etc.)

#### api.ts
Provides the `createScaleboxApi` factory function to create a complete API client:
- Filesystem Service
- Process Service
- ExecutionService (code execution)
- ContextService (context management)

#### errors.ts
Provides error handling utility functions:
- Error type checking (timeout, authentication, permission, etc.)
- Error message extraction
- Retryable error detection

## Usage

### Method 1: Using Complete API Factory (Recommended)

```typescript
import { createScaleboxApi } from './grpc';

const api = createScaleboxApi(connectionConfig, accessToken);

// Use filesystem service
const files = await api.filesystem.listDir({ path: '/workspace' });

// Use execution service
const stream = await api.execution.execute({
  code: 'print("Hello, World!")',
  language: 'python'
});

// Use context service
const context = await api.context.createContext({
  language: 'python',
  cwd: '/workspace'
});

// Use process service
const processStream = await api.process.start({
  process: {
    cmd: 'python',
    args: ['script.py']
  }
});
```

### Method 2: Using GrpcClient Class

```typescript
import { GrpcClient } from './grpc';

const client = new GrpcClient(
  connectionConfig,
  'sandbox-domain.example.com',
  'access-token'
);

// Use filesystem service
const stat = await client.filesystem.stat({ path: '/file.txt' });

// Use process service
const processes = await client.process.list({});

// Clean up resources
client.close();
```

### Method 3: Using Factory Function

```typescript
import { createGrpcClient } from './grpc';

const client = createGrpcClient(
  connectionConfig,
  'sandbox-domain.example.com',
  'access-token'
);
```

## Error Handling

Use error utility functions for type-safe error handling:

```typescript
import {
  isGrpcTimeoutError,
  isGrpcAuthError,
  isGrpcNotFoundError,
  isGrpcRetryableError,
  getGrpcErrorMessage
} from './grpc';

try {
  await api.filesystem.stat({ path: '/file.txt' });
} catch (err) {
  if (isGrpcNotFoundError(err)) {
    console.log('File not found');
  } else if (isGrpcAuthError(err)) {
    console.log('Authentication failed');
  } else if (isGrpcTimeoutError(err)) {
    console.log('Request timeout');
  } else if (isGrpcRetryableError(err)) {
    console.log('Temporary error, can retry');
    // Implement retry logic
  } else {
    console.error('Error:', getGrpcErrorMessage(err));
  }
}
```

## Available Error Check Functions

- `isGrpcTimeoutError(err)` - Check if error is a timeout error
- `isGrpcCancellationError(err)` - Check if error is a cancellation error
- `isGrpcNotFoundError(err)` - Check if error is a resource not found error
- `isGrpcAuthError(err)` - Check if error is an authentication error
- `isGrpcPermissionError(err)` - Check if error is a permission error
- `isGrpcResourceExhaustedError(err)` - Check if error is a resource exhausted error
- `isGrpcInvalidArgumentError(err)` - Check if error is an invalid argument error
- `isGrpcRetryableError(err)` - Check if error is retryable
- `getGrpcErrorMessage(err)` - Extract error message

## Connect RPC Protocol

This module uses the Connect RPC protocol, a modern RPC framework with the following advantages:

### Compatibility
- Supports HTTP/1.1 and HTTP/2
- Can traverse enterprise proxies and firewalls
- Compatible with standard load balancers (Nginx, HAProxy, CloudFlare)

### Features
- Type-safe client and server
- Supports streaming RPC (unary and bidirectional streams)
- Automatic protobuf serialization/deserialization
- Built-in interceptor support (for authentication, logging, etc.)

### Transport Formats
- JSON format (default): Easy to debug
- Binary format: High-performance scenarios

## Authentication

All clients support Bearer Token authentication:

```typescript
// Pass via constructor parameter
const client = new GrpcClient(config, domain, 'your-access-token');

// Or via API factory function
const api = createScaleboxApi(config, 'your-access-token');
```

Authentication tokens are automatically added to the `Authorization` header of all requests:
```
Authorization: Bearer your-access-token
```

## Service List

### Filesystem Service
Filesystem operations service:
- `stat` - Get file/directory information
- `listDir` - List directory contents
- `move` - Move/rename files
- `makeDir` - Create directory
- `remove` - Delete file/directory
- `watchDir` - Watch directory changes
- `createWatcher` - Create file watcher
- `getWatcherEvents` - Get watcher events
- `removeWatcher` - Remove watcher

### Process Service
Process management service:
- `list` - List all processes
- `start` - Start new process (streaming response)
- `connect` - Connect to existing process (streaming response)
- `update` - Update process configuration
- `streamInput` - Stream input to process
- `sendInput` - Send input to process
- `sendSignal` - Send signal to process

### ExecutionService
Code execution service:
- `execute` - Execute code (streaming response)

### ContextService
Context management service:
- `createContext` - Create execution context
- `destroyContext` - Destroy execution context

## Type System

All protobuf-generated types can be imported from the module:

```typescript
import type {
  // Filesystem types
  EntryInfo,
  FileType,
  StatRequest,
  ListDirRequest,
  
  // Process types
  ProcessInfo,
  ProcessConfig,
  ProcessEvent,
  
  // Execution types
  ExecuteRequest,
  ExecuteResponse,
  
  // Context types
  Context,
  CreateContextRequest
} from './grpc';
```

## Architecture Design

### Layered Structure

```
User Code
    ↓
index.ts (unified entry)
    ↓
├── client.ts (basic services)
├── api.ts (complete API)
└── errors.ts (error handling)
    ↓
@connectrpc/connect (RPC framework)
    ↓
generated/api_pb.ts (generated types)
    ↓
gRPC Server
```

### Design Principles

1. **Single Responsibility**: Each file focuses on specific functionality
2. **Type Safety**: Fully leverage TypeScript's type system
3. **Ease of Use**: Provide multiple usage patterns for different scenarios
4. **Extensibility**: Clear module separation, easy to add new services
5. **Error Handling**: Comprehensive error checking and handling utilities

## Latest Improvements (2025-01)

### Directory Structure Optimization
- ✅ Flat structure: Removed `client/` subdirectory
- ✅ File renaming: `rpc.ts` → `errors.ts` (clearer naming)
- ✅ Unified entry: Created `index.ts` as main module entry

### Code Optimization
- ✅ Import statements sorted alphabetically
- ✅ Complete JSDoc documentation comments
- ✅ Type-safe exports
- ✅ Zero linter errors

### Documentation Improvements
- ✅ All classes and functions have detailed comments
- ✅ Rich usage examples provided
- ✅ Clear architecture descriptions

## Dependencies

- `@connectrpc/connect`: Connect RPC client core
- `@connectrpc/connect-web`: Web transport layer implementation
- `@bufbuild/protobuf`: Protocol Buffers runtime
- Internal dependencies: `../connectionConfig`, `../generated/api_pb.js`

## Related Modules

- `../code-interpreter`: Code interpreter module (uses ExecutionService and ContextService)
- `../sandbox`: Sandbox module (uses Filesystem and Process services)
- `../generated`: Auto-generated protobuf type definitions

## Contributing

1. Maintain consistent code style
2. Add complete type annotations and documentation for new features
3. Update related tests
4. Update this README document

## License

Consistent with the main project License
