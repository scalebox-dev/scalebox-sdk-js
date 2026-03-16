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

一个用于在可控沙箱中执行多语言代码的 JavaScript SDK，支持同步与异步模式，以及多语言 Kernel（Python、R、Node.js、Deno/TypeScript、Java/IJAVA、Bash）。已提供全面的真实环境测试用例与脚本。

## 功能特性

### 🚀 高级 API（新功能！）
- **Session API**：一行代码执行，自动生命周期管理
- **智能缓存**：会话复用和依赖缓存，性能提升 10-100 倍
- **自动续期**：自动管理会话超时
- **进度追踪**：实时执行进度和性能洞察
- **类型安全**：完整的 TypeScript 支持，零 `any`

[📖 Session API 英文文档](./docs/SESSION_API.md) | [📖 中文文档](./docs/SESSION_API_ZH.md)

### 💪 核心功能
- 多语言内核：Python、R、Node.js、Deno/TypeScript、Java/IJAVA、Bash
- 同步 `Sandbox` 与异步 `AsyncSandbox` 执行
- 持久上下文：跨多次执行保留变量/状态
- 回调订阅：stdout、stderr、结果与错误
- 丰富结果格式：text、html、markdown、svg、png、jpeg、pdf、latex、json、javascript、chart、data 等
- 真实环境测试：覆盖同步/异步与多语言示例

## 环境要求
- Node.js 22+
- 可访问的 Scalebox 环境或本地服务

## 安装

[![npm](https://img.shields.io/badge/npm-@scalebox/sdk-red.svg)](https://www.npmjs.com/package/@scalebox/sdk)
[![yarn](https://img.shields.io/badge/yarn-add%20@scalebox/sdk-blue.svg)](https://yarnpkg.com/package/@scalebox/sdk)
[![pnpm](https://img.shields.io/badge/pnpm-add%20@scalebox/sdk-orange.svg)](https://pnpm.io/)

```bash
# 使用 npm
npm install @scalebox/sdk

# 使用 yarn
yarn add @scalebox/sdk

# 使用 pnpm
pnpm add @scalebox/sdk
```

## 配置

### 环境变量

SDK 支持从环境变量或 `.env` 文件读取配置：

| 变量名 | 必需 | 说明 | 默认值 |
|--------|------|------|--------|
| `SCALEBOX_API_KEY` | 是* | API 密钥用于身份验证 | - |
| `SCALEBOX_ACCESS_TOKEN` | 是* | 访问令牌（API 密钥的替代方案） | - |
| `SCALEBOX_API_URL` | 否 | API 端点 URL | `https://api.scalebox.dev` |
| `SCALEBOX_DOMAIN` | 否 | 沙箱自定义域名 | - |

*必须提供 `SCALEBOX_API_KEY` 或 `SCALEBOX_ACCESS_TOKEN` 其中之一。

### 配置示例

**使用环境变量：**
```bash
export SCALEBOX_API_KEY=your_api_key_here
export SCALEBOX_API_URL=https://api.scalebox.dev  # 可选
```

**使用 .env 文件：**
```env
# .env
SCALEBOX_API_KEY=your_api_key_here
SCALEBOX_API_URL=https://api.scalebox.dev  # 可选
```

**使用代码配置：**
```javascript
import { Sandbox } from '@scalebox/sdk'

const sandbox = await Sandbox.create('code-interpreter', {
  apiKey: 'your_api_key_here',
  apiUrl: 'https://api.scalebox.dev'  // 可选
})
```

## 快速开始

### 🚀 Session API（推荐）

最简单的代码执行方式 - 一切都自动处理！

```typescript
import { Session } from '@scalebox/sdk'

// 简单执行
const result = await Session.run({
  code: 'print("你好，Scalebox！")',
  language: 'python'
})

console.log(result.text)  // 你好，Scalebox！
```

**多步骤工作流与会话复用（快 10-100 倍）：**

```typescript
// 步骤 1：使用包初始化
const step1 = await Session.run({
  code: 'import pandas as pd; import numpy as np',
  packages: ['pandas', 'numpy'],
  keepAlive: true  // 保持会话以供复用
})

// 步骤 2：上传并处理数据（复用会话，包已安装！）
const step2 = await Session.run({
  code: 'df = pd.read_csv("data.csv"); print(df.head())',
  sessionId: step1.sessionId,
  files: { 'data.csv': csvData }
})

// 步骤 3：继续分析
const step3 = await Session.run({
  code: 'print(df.describe())',
  sessionId: step1.sessionId
})

// 完成后关闭
await Session.close(step1.sessionId!)
```

**暂停/恢复以优化成本：**

```typescript
// 创建会话并处理数据
const result = await Session.run({
  code: 'import pandas as pd; df = pd.read_csv("data.csv")',
  files: { 'data.csv': csvData },
  packages: ['pandas'],
  keepAlive: true
})

// 暂停以在等待外部数据期间节省资源
await Session.pause(result.sessionId!)

// 稍后：复用时会自动恢复
const result2 = await Session.run({
  code: 'print(df.describe())',
  sessionId: result.sessionId  // ✅ 自动恢复
})

// 完成后关闭
await Session.close(result.sessionId!)
```

**实时进度追踪：**

```typescript
const result = await Session.run({
  code: pythonCode,
  packages: ['pandas', 'matplotlib'],
  onProgress: (progress) => {
    console.log(`[${progress.stage}] ${progress.percent}% - ${progress.message}`)
  }
})

// 检查性能洞察
console.log('计时:', result.timing)
console.log('瓶颈:', result.insights.bottleneck)
console.log('建议:', result.insights.suggestions)
```

**对象存储挂载（S3 兼容）：**

```typescript
// 创建带对象存储挂载的会话
const result = await Session.run({
  code: `
    import os
    # 对象存储已挂载到指定的挂载点
    files = os.listdir('/mnt/oss')
    print(f'OSS 中的文件: {files}')
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

[📖 完整 Session API 指南](./docs/SESSION_API_ZH.md) | [📖 English Guide](./docs/SESSION_API.md) | [📁 更多示例](./examples/session-api.mts)

### 💪 低级 API（高级用法）

用于对沙箱生命周期的精细控制：

```javascript
import { Sandbox } from '@scalebox/sdk'

const sandbox = await Sandbox.create('code-interpreter', {
  timeoutMs: 300000, // 5分钟
  metadata: { test: 'example' }
})

// 检查沙箱状态
const isRunning = await sandbox.isRunning()
console.log('Sandbox is running:', isRunning)

// 获取沙箱信息
// ⚠️ 注意：getInfo() 返回公开的沙箱元数据
// 内部属性如 envdAccessToken 和 sandboxDomain 因安全原因被排除
// 如需访问这些属性，请直接使用 sandbox.sandboxId, sandbox.sandboxDomain
const info = await sandbox.getInfo()
console.log('Sandbox info:', info)

// 文件系统操作
const files = await sandbox.files.list("/")
console.log('Files:', files)

// 命令执行
const result = await sandbox.commands.run('echo "Hello World"')
console.log('Command output:', result.stdout)

// 清理
await sandbox.kill()
```

## 快速开始（代码解释器）
```javascript
import { CodeInterpreter } from '@scalebox/sdk'

async function main() {
    // ✅ 推荐：使用 CodeInterpreter.create() 静态方法
    const interpreter = await CodeInterpreter.create({
        templateId: 'code-interpreter'
    })
    
    const exec = await interpreter.runCode("print('hello from interpreter')", { language: "python" })
    console.log(exec.logs.stdout)
    
    await interpreter.close()
}

main()
```

## API 示例

### 沙箱管理
```javascript
import { Sandbox } from '@scalebox/sdk'

// 创建沙箱
const sandbox = await Sandbox.create('code-interpreter', {
  timeoutMs: 300000,
  metadata: { project: 'my-app' },
  envs: { NODE_ENV: 'production' }
})

// 创建带对象存储挂载的沙箱
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
// 对象存储已挂载到 /mnt/oss

// 连接到现有沙箱
const connectedSandbox = await Sandbox.connect('sandbox-id')

// 列出所有沙箱
const paginator = Sandbox.list()
while (paginator.hasNext) {
  const sandboxes = await paginator.nextItems()
  console.log(sandboxes)
}

// 沙箱操作
await sandbox.setTimeout(600000) // 10分钟
await sandbox.betaPause() // 暂停沙箱
await sandbox.kill() // 关闭沙箱
```

### 暂停和恢复操作

暂停沙箱以节省计算资源，同时保留文件系统状态。暂停的沙箱不消耗 CPU 或内存，仅消耗存储。

```javascript
// 暂停运行中的沙箱
await sandbox.betaPause()
console.log('沙箱已暂停 - 无计算成本')

// 使用 connect 恢复暂停的沙箱（统一端点）
// connect() 如果已暂停则自动恢复，如果正在运行则直接连接
await sandbox.connect()
console.log('沙箱已恢复并准备就绪')

// 恢复时更新超时时间
await sandbox.connect({ timeoutMs: 900000 }) // 15分钟

// 检查沙箱状态
const info = await sandbox.getInfo()
console.log('状态:', info.status) // 'running' | 'paused' | 'stopped'

// 静态 connect 方法（如果已暂停则自动恢复）
const connectedSandbox = await Sandbox.connect(sandboxId)
```

**优势：**
- **成本优化**：暂停的沙箱仅收取存储费用，不收取 CPU/RAM 费用
- **状态保留**：文件、已安装的包和文件系统状态都会保留
- **自动恢复**：使用 `connect()` 自动恢复暂停的沙箱
- **超时管理**：恢复时可以更新超时时间

**使用场景：**
- 执行之间的长时间空闲期
- 有间隔的批处理
- 不常用沙箱的成本优化

### 文件系统操作
```javascript
// 读取文件
const content = await sandbox.files.read('/path/to/file.txt')

// 写入文件
await sandbox.files.write('/path/to/file.txt', 'Hello World')

// 列出目录
const files = await sandbox.files.list('/home/user')

// 创建目录
await sandbox.files.makeDir('/home/user/newdir')

// 移动文件
await sandbox.files.move('/old/path', '/new/path')

// 删除文件
await sandbox.files.remove('/path/to/file.txt')
```

### 命令执行
```javascript
// 同步执行命令
const result = await sandbox.commands.run('ls -la')
console.log(result.stdout)
console.log(result.stderr)
console.log(result.exitCode)

// 后台执行命令
const handle = await sandbox.commands.run('long-running-command', {
  background: true
})

// 等待命令完成
const finalResult = await handle.wait()

// 杀死命令
await handle.kill()
```

### 伪终端操作
```javascript
// 启动伪终端
const pty = await sandbox.pty.start({
  cwd: '/home/user',
  envs: { PATH: '/usr/bin:/bin' }
})

// 发送数据
await pty.send('echo "Hello from PTY"')

// 等待输出
await pty.wait()
```

## 多语言示例
- Python：`language: "python"`
- R：`language: "r"`
- Node.js：`language: "nodejs"`
- Deno/TypeScript：`language: "typescript"`
- Java（IJAVA/纯Java）：`language: "ijava"` 或 `language: "java"`
- Bash：`language: "bash"`

示例（Node.js）：
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

示例（R）：
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

示例（Deno/TypeScript）：
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

示例（Java/IJAVA）：
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

示例（Bash）：
```javascript
import { Sandbox } from '@scalebox/sdk'

const sbx = await Sandbox.create()
const res = await sbx.runCode("echo 'Hello from Bash'", { language: "bash" })
console.log(res.logs.stdout)
```

## 上下文管理（Context）
上下文允许跨多次执行复用变量/状态，使用真实的 gRPC 服务：
```javascript
import { CodeInterpreter } from '@scalebox/sdk'

// ✅ 推荐：使用静态创建方法
const interpreter = await CodeInterpreter.create()

// 创建上下文（使用 gRPC）
const ctx = await interpreter.createCodeContext({ language: "python", cwd: "/tmp" })

await interpreter.runCode("counter = 0", { language: "python", context: ctx })
await interpreter.runCode("counter += 1; print(counter)", { language: "python", context: ctx })

// 销毁上下文（使用 gRPC）
await interpreter.destroyContext(ctx)

// 管理多个上下文
const pythonCtx = await interpreter.createCodeContext({ language: "python" })
const jsCtx = await interpreter.createCodeContext({ language: "nodejs" })

console.log('Active contexts:', interpreter.getContexts().length)
```

## 回调（可选）
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

## 结果格式（Result）
`Result` 可能包含如下数据字段：
- `text`, `html`, `markdown`, `svg`, `png`, `jpeg`, `pdf`, `latex`
- `jsonData`, `javascript`, `data`, `chart`
- `executionCount`, `isMainResult`, `extra`

可以通过 `Object.keys(result.formats)` 查看可用格式。

## 运行测试
项目 `test/` 目录包含全面的真实环境用例，覆盖：
- 同步与异步综合用例
- 多语言内核（Python、R、Node.js、Deno/TypeScript、Java/IJAVA、Bash）
- 上下文管理、回调与结果格式

```bash
# 运行所有测试
npm test

# 运行特定测试
npm run test:integration
```

## 常见问题（Troubleshooting）
- Import/依赖错误：请确认已正确安装依赖
- 外部内核不可用：确保环境已安装对应语言运行时（R/Node/Deno/JDK）与后端已启用该内核
- 超时/网络：检查网络与后端服务可达性，必要时增大 `timeout`/`requestTimeout`

## 技术栈

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![R](https://img.shields.io/badge/R-276DC3?logo=r&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Java](https://img.shields.io/badge/Java-ED8B00?logo=java&logoColor=white)
![Bash](https://img.shields.io/badge/Bash-4EAA25?logo=gnu-bash&logoColor=white)

## 平台支持

![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)
![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## 自动化发布流程

本项目使用 **semantic-release** 实现完全自动化的版本管理和发布。

### 📝 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
# 新功能 (自动发布 minor 版本)
git commit -m "feat: add new authentication method"

# 修复 bug (自动发布 patch 版本)  
git commit -m "fix: resolve timeout issue in sandbox"

# 重大变更 (自动发布 major 版本)
git commit -m "feat!: breaking change in API"

# 文档更新 (不触发发布)
git commit -m "docs: update installation guide"

# 性能优化 (自动发布 patch 版本)
git commit -m "perf: optimize memory usage"
```

### 🚀 发布流程

1. **提交代码** 使用规范的 commit 信息
2. **推送到 main** 分支
3. **CI 自动处理**：
   - ✅ 分析 commit 信息确定版本类型
   - ✅ 自动更新版本号
   - ✅ 生成 CHANGELOG.md
   - ✅ 创建 Git 标签
   - ✅ 发布到 npm
   - ✅ 创建 GitHub Release

### 📋 版本规则

| Commit 类型 | 版本递增 | 示例 |
|------------|---------|------|
| `feat:` | minor (0.1.0) | 新功能 |
| `fix:` | patch (0.0.1) | 修复 bug |
| `perf:` | patch (0.0.1) | 性能优化 |
| `feat!:` | major (1.0.0) | 重大变更 |
| `docs:` | - | 文档更新 |
| `chore:` | - | 构建/工具 |
| `test:` | - | 测试相关 |

## 许可证
本项目遵循 MIT 许可证条款。

