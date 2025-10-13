# Authentication Guide

## Overview

Scalebox SDK uses different authentication mechanisms for different types of operations:

1. **Management API** (REST): Uses `X-API-KEY` header
2. **gRPC Services**: Uses `Authorization: Bearer root` header

## Authentication Details

### 1. Management API Authentication

**Used for:**
- Creating sandboxes
- Listing sandboxes
- Getting sandbox information
- Deleting sandboxes
- Managing sandbox lifecycle

**Authentication Method:**
```
Header: X-API-KEY
Value: <your-api-key>
```

**Implementation:**
- Handled by `ApiClient` class in `src/api/index.ts`
- API key is obtained from:
  1. Constructor parameter
  2. Environment variable `SCALEBOX_API_KEY`

**Example:**
```typescript
const client = new ApiClient(connectionConfig)
// Automatically adds X-API-KEY header to all requests
```

### 2. gRPC Services Authentication

**Used for:**
- Filesystem operations (read, write, list, delete files)
- Process management (start, stop, stream I/O)
- Code execution (execute code, stream results)
- Context management (create, destroy contexts)

**Authentication Method (TWO headers required):**
```
Header 1: Authorization
Value: Bearer root

Header 2: X-Access-Token
Value: <envdAccessToken from sandbox creation>
```

**Implementation:**
- Handled by `GrpcClient` class in `src/grpc/client.ts`
- Both authentication headers set in transport interceptor
- `envdAccessToken` obtained from sandbox creation API response

**Services:**
- `Filesystem` service → file operations via gRPC
- `Process` service → process management via gRPC
- `ExecutionService` → code execution via gRPC
- `ContextService` → context management via gRPC

**Example:**
```typescript
// GrpcClient automatically adds Authorization: Bearer root
const grpcClient = new GrpcClient(connectionConfig, sandboxDomain)
```

## Connection Flow

### Creating a Sandbox

1. **API Request** (with X-API-KEY):
   ```
   POST /sandboxes
   Headers: X-API-KEY: <api-key>
   ```

2. **API Response**:
   ```json
   {
     "sandboxId": "sbx-xxx",
     "sandboxDomain": "sbx-xxx.scalebox.dev",
     "envdAccessToken": "token-xxx"
   }
   ```

3. **gRPC Connection** (with two headers):
   - Connect to: `https://sbx-xxx.scalebox.dev`
   - Header 1: `Authorization: Bearer root`
   - Header 2: `X-Access-Token: token-xxx`

### Important Notes

1. **sandboxDomain is Required**
   - Must be obtained from sandbox creation API response
   - No default/fallback values allowed
   - Used as the gRPC endpoint

2. **envdAccessToken Usage**
   - **Required for gRPC authentication** as `X-Access-Token` header
   - Also used for HTTP API file upload/download operations
   - Must be obtained from sandbox creation API response

3. **gRPC Authentication Requirements**
   - Always uses `Authorization: Bearer root` (fixed)
   - PLUS `X-Access-Token: <envdAccessToken>` (from API)
   - Both headers are required for all gRPC requests
   - No per-request authentication variations

## Code Examples

### Management API (REST)

```typescript
import { Sandbox } from '@scalebox/sdk'

// API key is used here (X-API-KEY)
const sandbox = await Sandbox.create('code-interpreter', {
  apiKey: process.env.SCALEBOX_API_KEY
})
```

### gRPC Operations

```typescript
// After sandbox is created, gRPC operations use Bearer root
await sandbox.files.write('/tmp/hello.txt', 'Hello World')
await sandbox.files.read('/tmp/hello.txt')

// Code execution via gRPC
const interpreter = await CodeInterpreter.create()
const result = await interpreter.execute({
  language: 'python',
  code: 'print("Hello")'
})
```

## Security Considerations

1. **API Key Protection**
   - Never commit API keys to source control
   - Use environment variables
   - Rotate keys regularly

2. **sandboxDomain Validation**
   - Always use the domain returned by the API
   - Do not construct domains manually
   - Validate domain format before use

3. **Transport Security**
   - All connections use HTTPS/TLS
   - Localhost connections use HTTP for development
   - gRPC uses Connect protocol over HTTPS

## Troubleshooting

### "unknown user" Error
- **Cause**: Missing or incorrect gRPC authentication headers
- **Fix**: Ensure BOTH headers are set:
  - `Authorization: Bearer root`
  - `X-Access-Token: <envdAccessToken>`
- **Check**: `GrpcClient` interceptor configuration and envdAccessToken value

### "Unauthenticated" Error (Management API)
- **Cause**: Missing or invalid X-API-KEY
- **Fix**: Check API key configuration
- **Check**: Environment variables and constructor params

### "Failed to parse URL" Error
- **Cause**: Invalid sandboxDomain
- **Fix**: Ensure sandboxDomain includes protocol (https://)
- **Check**: `GrpcClient` constructor URL formation logic

## Architecture Summary

```
Management API (REST)                    gRPC Services
     ↓                                        ↓
X-API-KEY: <api-key>          Authorization: Bearer root
     ↓                         X-Access-Token: <envdAccessToken>
api.scalebox.dev              <sandboxDomain>.scalebox.dev
     ↓                                        ↓
Create/Manage Sandboxes       Filesystem/Process/Code Execution
     ↓                                        ↑
     └─────── envdAccessToken ───────────────┘
```
