# Scalebox JavaScript SDK

[![npm version](https://img.shields.io/npm/v/@scalebox/sdk.svg)](https://www.npmjs.com/package/@scalebox/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@scalebox/sdk.svg)](https://www.npmjs.com/package/@scalebox/sdk)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@scalebox/sdk)](https://bundlephobia.com/package/@scalebox/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Build Status](https://github.com/scalebox-dev/scalebox-sdk-js/workflows/CI/badge.svg)](https://github.com/scalebox-dev/scalebox-sdk-js/actions)
[![Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen)](https://github.com/scalebox-dev/scalebox-sdk-js)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/scalebox-dev/scalebox-sdk-js/pulls)

A JavaScript SDK for executing multi-language code in controlled sandboxes, supporting both synchronous and asynchronous modes, as well as multi-language kernels (Python, R, Node.js, Deno/TypeScript, Java/IJAVA, Bash). Comprehensive real-world test cases and scripts are provided.

[中文文档](./README_cn.md)

## Features

### 🚀 High-Level API (New!)
- **Session API**: One-line code execution with automatic lifecycle management
- **Smart Caching**: 10-100x faster with session reuse and dependency caching
- **Auto Renewal**: Automatic session timeout management
- **Progress Tracking**: Real-time execution progress and performance insights
- **Type Safe**: Full TypeScript support with zero `any`

[📖 Session API Documentation](./docs/SESSION_API.md) | [📖 中文文档](./docs/SESSION_API_ZH.md)

### 💪 Core Features
- Multi-language kernels: Python, R, Node.js, Deno/TypeScript, Java/IJAVA, Bash
- Synchronous `Sandbox` and asynchronous `AsyncSandbox` execution
- Persistent context: Retain variables/state across multiple executions
- Callback subscriptions: stdout, stderr, results, and errors
- Rich result formats: text, html, markdown, svg, png, jpeg, pdf, latex, json, javascript, chart, data, and more
- Real-world testing: Comprehensive coverage with synchronous/asynchronous and multi-language examples

## Requirements
- Node.js 20+
- Access to Scalebox environment or local service

## Installation

[![npm](https://img.shields.io/badge/npm-@scalebox/sdk-red.svg)](https://www.npmjs.com/package/@scalebox/sdk)
[![yarn](https://img.shields.io/badge/yarn-add%20@scalebox/sdk-blue.svg)](https://yarnpkg.com/package/@scalebox/sdk)
[![pnpm](https://img.shields.io/badge/pnpm-add%20@scalebox/sdk-orange.svg)](https://pnpm.io/)

```bash
# Using npm
npm install @scalebox/sdk

# Using yarn
yarn add @scalebox/sdk

# Using pnpm
pnpm add @scalebox/sdk
```

## Configuration

### Environment Variables

The SDK supports reading configuration from environment variables or `.env` file:

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `SCALEBOX_API_KEY` | Yes* | API key for authentication | - |
| `SCALEBOX_ACCESS_TOKEN` | Yes* | Access token (alternative to API key) | - |
| `SCALEBOX_API_URL` | No | API endpoint URL | `https://api.scalebox.dev` |
| `SCALEBOX_DOMAIN` | No | Custom domain for sandboxes | - |

*Either `SCALEBOX_API_KEY` or `SCALEBOX_ACCESS_TOKEN` must be provided.

### Example Configuration

**Using environment variables:**
```bash
export SCALEBOX_API_KEY=your_api_key_here
export SCALEBOX_API_URL=https://api.scalebox.dev  # optional
```

**Using .env file:**
```env
# .env
SCALEBOX_API_KEY=your_api_key_here
SCALEBOX_API_URL=https://api.scalebox.dev  # optional
```

**Using code configuration:**
```javascript
import { Sandbox } from '@scalebox/sdk'

const sandbox = await Sandbox.create('code-interpreter', {
  apiKey: 'your_api_key_here',
  apiUrl: 'https://api.scalebox.dev'  // optional
})
```

## Quick Start

### 🚀 Session API (Recommended)

The simplest way to execute code - everything is handled automatically!

```typescript
import { Session } from '@scalebox/sdk'

// Simple execution
const result = await Session.run({
  code: 'print("Hello, Scalebox!")',
  language: 'python'
})

console.log(result.text)  // Hello, Scalebox!
```

**Multi-step workflow with session reuse (10-100x faster):**

```typescript
// Step 1: Initialize with packages
const step1 = await Session.run({
  code: 'import pandas as pd; import numpy as np',
  packages: ['pandas', 'numpy'],
  keepAlive: true  // Keep session for reuse
})

// Step 2: Upload and process data (reuses session, packages already installed!)
const step2 = await Session.run({
  code: 'df = pd.read_csv("data.csv"); print(df.head())',
  sessionId: step1.sessionId,
  files: { 'data.csv': csvData }
})

// Step 3: Continue analysis
const step3 = await Session.run({
  code: 'print(df.describe())',
  sessionId: step1.sessionId
})

// Close when done
await Session.close(step1.sessionId!)
```

**Pause/Resume for cost optimization:**

```typescript
// Create session and process data
const result = await Session.run({
  code: 'import pandas as pd; df = pd.read_csv("data.csv")',
  files: { 'data.csv': csvData },
  packages: ['pandas'],
  keepAlive: true
})

// Pause to save resources during long wait for external data
await Session.pause(result.sessionId!)

// Later: automatically resumed when reusing
const result2 = await Session.run({
  code: 'print(df.describe())',
  sessionId: result.sessionId  // ✅ Automatically resumes
})

// Close when done
await Session.close(result.sessionId!)
```

**Real-time progress tracking:**

```typescript
const result = await Session.run({
  code: pythonCode,
  packages: ['pandas', 'matplotlib'],
  onProgress: (progress) => {
    console.log(`[${progress.stage}] ${progress.percent}% - ${progress.message}`)
  }
})

// Check performance insights
console.log('Timing:', result.timing)
console.log('Bottleneck:', result.insights.bottleneck)
console.log('Suggestions:', result.insights.suggestions)
```

**Object storage mount (S3-compatible):**

```typescript
// Create session with object storage mounted
const result = await Session.run({
  code: `
    import os
    # Object storage is mounted at the specified mount point
    files = os.listdir('/mnt/oss')
    print(f'Files in OSS: {files}')
  `,
  objectStorage: {
    uri: 's3://my-bucket/data/',
    mountPoint: '/mnt/oss',
    accessKey: 'YOUR_ACCESS_KEY',
    secretKey: 'YOUR_SECRET_KEY',
    region: 'ap-east-1',
    endpoint: 'https://s3.ap-east-1.amazonaws.com'
  }
})
```

[📖 Complete Session API Guide](./docs/SESSION_API.md) | [📖 完整中文指南](./docs/SESSION_API_ZH.md) | [📁 More Examples](./examples/session-api.mts)

### 💪 Low-Level API (Advanced)

For fine-grained control over sandbox lifecycle:

```javascript
import { Sandbox } from '@scalebox/sdk'

const sandbox = await Sandbox.create('code-interpreter', {
  timeoutMs: 300000, // 5 minutes
  metadata: { test: 'example' }
})

// Check sandbox status
const isRunning = await sandbox.isRunning()
console.log('Sandbox is running:', isRunning)

// Get sandbox information
// ⚠️ Note: getInfo() returns public sandbox metadata
// Internal properties like envdAccessToken and sandboxDomain are excluded for security
// Use sandbox.sandboxId, sandbox.sandboxDomain directly if needed
const info = await sandbox.getInfo()
console.log('Sandbox info:', info)

// Filesystem operations
const files = await sandbox.files.list("/")
console.log('Files:', files)

// Command execution
const result = await sandbox.commands.run('echo "Hello World"')
console.log('Command output:', result.stdout)

// Cleanup
await sandbox.kill()
```

## Quick Start (Code Interpreter)
```javascript
import { CodeInterpreter } from '@scalebox/sdk'

async function main() {
    // ✅ Recommended: Use CodeInterpreter.create() static method
    const interpreter = await CodeInterpreter.create({
        templateId: 'code-interpreter'
    })
    
    const exec = await interpreter.runCode("print('hello from interpreter')", { language: "python" })
    console.log(exec.logs.stdout)
    
    await interpreter.close()
}

main()
```

## API Examples

### Sandbox Management
```javascript
import { Sandbox } from '@scalebox/sdk'

// Create sandbox
const sandbox = await Sandbox.create('code-interpreter', {
  timeoutMs: 300000,
  metadata: { project: 'my-app' },
  envs: { NODE_ENV: 'production' }
})

// Create sandbox with object storage mount
const sandboxWithOSS = await Sandbox.create('code-interpreter', {
  timeoutMs: 300000,
  objectStorage: {
    uri: 's3://my-bucket/data/',
    mountPoint: '/mnt/oss',
    accessKey: 'YOUR_ACCESS_KEY',
    secretKey: 'YOUR_SECRET_KEY',
    region: 'ap-east-1',
    endpoint: 'https://s3.ap-east-1.amazonaws.com'
  }
})
// Object storage is now mounted at /mnt/oss

// Connect to existing sandbox
const connectedSandbox = await Sandbox.connect('sandbox-id')

// List all sandboxes
const paginator = Sandbox.list()
while (paginator.hasNext) {
  const sandboxes = await paginator.nextItems()
  console.log(sandboxes)
}

// Sandbox operations
await sandbox.setTimeout(600000) // 10 minutes
await sandbox.betaPause() // Pause sandbox
await sandbox.kill() // Close sandbox
```

### Locality-Based Scheduling

Control where your sandbox is scheduled based on geographical preferences. By default, the system uses load-balanced scheduling across all available clusters.

```javascript
import { Sandbox, SandboxApi } from '@scalebox/sdk'

// Get available regions
const regions = await SandboxApi.getScaleboxRegions()
console.log('Available regions:', regions)
// Output: [{ id: 'us-east', name: 'US East (N. Virginia)' }, ...]

// Auto-detect region from source IP
const sandbox1 = await Sandbox.create('code-interpreter', {
  locality: {
    autoDetect: true  // Infers region from your IP address
  }
})

// Specify a preferred region (best-effort, allows fallback)
const sandbox2 = await Sandbox.create('code-interpreter', {
  locality: {
    region: 'us-east'  // Prefers us-east, but falls back if unavailable
  }
})

// WARNING: Hard constraint - use with caution
// This will fail with a 409 Conflict error if the region is unavailable
const sandbox3 = await Sandbox.create('code-interpreter', {
  locality: {
    region: 'us-east',
    force: true  // Hard constraint - may cause creation failures
  }
})
```

**Important Notes:**
- **Default behavior**: If `locality` is not specified, the system uses load-balanced scheduling (recommended for To B products to avoid single-point overheating)
- **Best-effort mode** (`force: false`, default): If the preferred region is unavailable, the system gracefully falls back to other available regions
- **Hard constraint mode** (`force: true`): Sandbox creation will fail with a 409 Conflict error if the requested region is unavailable, even if other regions have capacity. **WARNING**: Use with caution.
- **Use cases for `force: true`**: Strict compliance requirements, regulatory constraints, or data residency requirements
- **Recommended**: Use `force: false` (default) for most use cases to ensure high availability

### Pause and Resume Operations

Pause sandboxes to save compute resources while preserving filesystem state. Paused sandboxes don't consume CPU or memory, only storage.

```javascript
// Pause a running sandbox
await sandbox.betaPause()
console.log('Sandbox paused - no compute costs')

// Resume paused sandbox using connect (unified endpoint)
// connect() automatically resumes if paused, or connects if running
await sandbox.connect()
console.log('Sandbox resumed and ready')

// Resume with new timeout
await sandbox.connect({ timeoutMs: 900000 }) // 15 minutes

// Check sandbox status
const info = await sandbox.getInfo()
console.log('Status:', info.status) // 'running' | 'paused' | 'stopped'

// Static connect method (auto-resumes if paused)
const connectedSandbox = await Sandbox.connect(sandboxId)
```

**Benefits:**
- **Cost optimization**: Paused sandboxes only charge for storage, not CPU/RAM
- **State preservation**: Files, installed packages, and filesystem state are preserved
- **Automatic resume**: Use `connect()` to automatically resume paused sandboxes
- **Timeout management**: Update timeout when resuming

**Use cases:**
- Long idle periods between executions
- Batch processing with gaps
- Cost optimization for infrequently used sandboxes

**Sandbox API notes (low-level):** Create, pause, and resume default to **synchronous** behaviour: the backend waits until the operation reaches a terminal state (e.g. running, paused) before returning. Pass `isAsync: true` (createSandbox request) or `opts: { isAsync: true }` (pauseSandbox/resumeSandbox) to return immediately and poll with `getSandboxStatus` or `waitUntilStatus` if needed.

### Filesystem Operations
```javascript
// Read file
const content = await sandbox.files.read('/path/to/file.txt')

// Write file
await sandbox.files.write('/path/to/file.txt', 'Hello World')

// List directory
const files = await sandbox.files.list('/home/user')

// Create directory
await sandbox.files.makeDir('/home/user/newdir')

// Move file
await sandbox.files.move('/old/path', '/new/path')

// Remove file
await sandbox.files.remove('/path/to/file.txt')
```

### Command Execution
```javascript
// Execute command synchronously
const result = await sandbox.commands.run('ls -la')
console.log(result.stdout)
console.log(result.stderr)
console.log(result.exitCode)

// Execute command in background
const handle = await sandbox.commands.run('long-running-command', {
  background: true
})

// Wait for command to complete
const finalResult = await handle.wait()

// Kill command
await handle.kill()
```

### Pseudo-Terminal Operations
```javascript
// Start pseudo-terminal
const pty = await sandbox.pty.start({
  cwd: '/home/user',
  envs: { PATH: '/usr/bin:/bin' }
})

// Send data
await pty.send('echo "Hello from PTY"')

// Wait for output
await pty.wait()
```

## Multi-Language Examples
- Python: `language: "python"`
- R: `language: "r"`
- Node.js: `language: "nodejs"`
- Deno/TypeScript: `language: "typescript"`
- Java (IJAVA/pure Java): `language: "ijava"` or `language: "java"`
- Bash: `language: "bash"`

Example (Node.js):
```javascript
import { Sandbox } from '@scalebox/sdk'

const sbx = await Sandbox.create()
const code = `
console.log("Hello from Node.js!");
const x = 1 + 2; console.log(\`x=\${x}\`);
`
const result = await sbx.runCode(code, { language: "nodejs" })
console.log(result.logs.stdout)
```

Example (R):
```javascript
import { Sandbox } from '@scalebox/sdk'

const sbx = await Sandbox.create()
const code = `
print("Hello from R!")
x <- mean(c(1,2,3,4,5))
print(paste("mean:", x))
`
const res = await sbx.runCode(code, { language: "r" })
console.log(res.logs.stdout)
```

Example (Deno/TypeScript):
```javascript
import { Sandbox } from '@scalebox/sdk'

const sbx = await Sandbox.create()
const ts = `
console.log("Hello from Deno/TypeScript!")
const nums: number[] = [1,2,3]
console.log(nums.reduce((a,b)=>a+b, 0))
`
const res = await sbx.runCode(ts, { language: "typescript" })
console.log(res.logs.stdout)
```

Example (Java/IJAVA):
```javascript
import { Sandbox } from '@scalebox/sdk'

const sbx = await Sandbox.create()
const code = `
System.out.println("Hello from IJAVA!");
int a = 10, b = 20; System.out.println(a + b);
`
const res = await sbx.runCode(code, { language: "java" })
console.log(res.logs.stdout)
```

Example (Bash):
```javascript
import { Sandbox } from '@scalebox/sdk'

const sbx = await Sandbox.create()
const res = await sbx.runCode("echo 'Hello from Bash'", { language: "bash" })
console.log(res.logs.stdout)
```

## Context Management
Context allows reusing variables/state across multiple executions using real gRPC service:
```javascript
import { CodeInterpreter } from '@scalebox/sdk'

// ✅ Recommended: Use static create method
const interpreter = await CodeInterpreter.create()

// Create context (using gRPC)
const ctx = await interpreter.createCodeContext({ language: "python", cwd: "/tmp" })

await interpreter.runCode("counter = 0", { language: "python", context: ctx })
await interpreter.runCode("counter += 1; print(counter)", { language: "python", context: ctx })

// Destroy context (using gRPC)
await interpreter.destroyContext(ctx)

// Manage multiple contexts
const pythonCtx = await interpreter.createCodeContext({ language: "python" })
const jsCtx = await interpreter.createCodeContext({ language: "nodejs" })

console.log('Active contexts:', interpreter.getContexts().length)
```

## Callbacks (Optional)
```javascript
import { Sandbox } from '@scalebox/sdk'

const sbx = await Sandbox.create()

function onStdout(msg) {
    console.log("STDOUT:", msg.content)
}

function onStderr(msg) {
    console.log("STDERR:", msg.content)
}

function onResult(res) {
    console.log("RESULT formats:", Object.keys(res.formats))
}

function onError(err) {
    console.log("ERROR:", err.name, err.value)
}

await sbx.runCode(
    "print('with callbacks')",
    { 
        language: "python",
        onStdout,
        onStderr,
        onResult,
        onError
    }
)
```

## Result Formats
`Result` may contain the following data fields:
- `text`, `html`, `markdown`, `svg`, `png`, `jpeg`, `pdf`, `latex`
- `jsonData`, `javascript`, `data`, `chart`
- `executionCount`, `isMainResult`, `extra`

You can view available formats via `Object.keys(result.formats)`.

## Running Tests
The `test/` directory contains comprehensive real-world use cases covering:
- Synchronous and asynchronous comprehensive use cases
- Multi-language kernels (Python, R, Node.js, Deno/TypeScript, Java/IJAVA, Bash)
- Context management, callbacks, and result formats

```bash
# Run all tests
npm test

# Run specific tests
npm run test:integration
```

## Troubleshooting
- Import/dependency errors: Ensure dependencies are properly installed
- External kernels unavailable: Ensure environment has corresponding language runtime (R/Node/Deno/JDK) installed and backend has enabled the kernel
- Timeout/network: Check network and backend service reachability, increase `timeout`/`requestTimeout` if necessary

## Tech Stack

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![R](https://img.shields.io/badge/R-276DC3?logo=r&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?logo=java&logoColor=white)
![Bash](https://img.shields.io/badge/Bash-4EAA25?logo=gnu-bash&logoColor=white)

## Platform Support

![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)
![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Automated Release Process

This project uses **semantic-release** for fully automated version management and releases.

### 📝 Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# New feature (automatically publish minor version)
git commit -m "feat: add new authentication method"

# Bug fix (automatically publish patch version)
git commit -m "fix: resolve timeout issue in sandbox"

# Breaking change (automatically publish major version)
git commit -m "feat!: breaking change in API"

# Documentation update (does not trigger release)
git commit -m "docs: update installation guide"

# Performance optimization (automatically publish patch version)
git commit -m "perf: optimize memory usage"
```

### 🚀 Release Process

1. **Commit code** using standardized commit message
2. **Push to main** branch
3. **CI automatically handles**:
   - ✅ Analyze commit messages to determine version type
   - ✅ Automatically update version number
   - ✅ Generate CHANGELOG.md
   - ✅ Create Git tag
   - ✅ Publish to npm
   - ✅ Create GitHub Release

### 📋 Version Rules

| Commit Type | Version Increment | Example |
|------------|---------|------|
| `feat:` | minor (0.1.0) | New feature |
| `fix:` | patch (0.0.1) | Bug fix |
| `perf:` | patch (0.0.1) | Performance optimization |
| `feat!:` | major (1.0.0) | Breaking change |
| `docs:` | - | Documentation update |
| `chore:` | - | Build/tools |
| `test:` | - | Testing related |

## License
This project is licensed under the MIT License.
