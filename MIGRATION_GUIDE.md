# E2B 到 Scalebox 迁移指南

本指南将帮助您从 E2B SDK 无缝迁移到 Scalebox SDK，享受完全一致的 API 体验。

## 快速迁移

### 1. 安装 Scalebox SDK

```bash
# 替换 E2B SDK
npm uninstall e2b
npm install @scalebox/sdk

# 或使用其他包管理器
yarn remove e2b
yarn add @scalebox/sdk

pnpm remove e2b
pnpm add @scalebox/sdk
```

### 2. 更新导入语句

```typescript
// 之前 (E2B)
import { Sandbox } from 'e2b'

// 现在 (Scalebox)
import { Sandbox } from '@scalebox/sdk'
```

### 3. 更新环境变量

```bash
# 之前 (E2B)
export E2B_API_KEY=your_e2b_api_key

# 现在 (Scalebox) - 支持两种方式
export SCALEBOX_API_KEY=your_scalebox_api_key
# 或者继续使用 E2B 环境变量名（向后兼容）
export E2B_API_KEY=your_scalebox_api_key
```

## 代码迁移示例

### 基本沙箱操作

```typescript
// E2B 代码
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create('base', {
  timeoutMs: 300000,
  metadata: { project: 'my-app' }
})

// Scalebox 代码 - 完全一致！
import { Sandbox } from '@scalebox/sdk'

const sandbox = await Sandbox.create('code-interpreter', { // 注意：使用 code-interpreter 而不是 base
  timeoutMs: 300000,
  metadata: { project: 'my-app' }
})
```

### 文件系统操作

```typescript
// E2B 和 Scalebox 完全一致
const sandbox = await Sandbox.create('code-interpreter')

// 文件操作
await sandbox.files.write('/tmp/test.txt', 'Hello World')
const content = await sandbox.files.read('/tmp/test.txt')
const files = await sandbox.files.list('/tmp')

// 目录操作
await sandbox.files.makeDir('/tmp/newdir')
await sandbox.files.move('/tmp/test.txt', '/tmp/newdir/test.txt')
await sandbox.files.remove('/tmp/newdir/test.txt')
```

### 命令执行

```typescript
// E2B 和 Scalebox 完全一致
const sandbox = await Sandbox.create('code-interpreter')

// 同步执行
const result = await sandbox.commands.run('ls -la')
console.log(result.stdout)

// 后台执行
const handle = await sandbox.commands.run('long-running-command', {
  background: true,
  onStdout: (data) => console.log('Output:', data)
})

const finalResult = await handle.wait()
```

### 沙箱管理

```typescript
// E2B 和 Scalebox 完全一致
const sandbox = await Sandbox.create('code-interpreter')

// 检查状态
const isRunning = await sandbox.isRunning()

// 设置超时
await sandbox.setTimeout(600000)

// 暂停和恢复
await sandbox.betaPause()
await sandbox.connect()

// 关闭沙箱
await sandbox.kill()
```

### 连接现有沙箱

```typescript
// E2B 和 Scalebox 完全一致
const sandbox = await Sandbox.create('code-interpreter')
const sandboxId = sandbox.sandboxId

// 连接到现有沙箱
const connectedSandbox = await Sandbox.connect(sandboxId)
```

### 列出沙箱

```typescript
// E2B 和 Scalebox 完全一致
const paginator = Sandbox.list()

while (paginator.hasNext) {
  const sandboxes = await paginator.nextItems()
  console.log(sandboxes)
}
```

## 主要差异

### 1. 默认模板

```typescript
// E2B 默认使用 'base' 模板
const sandbox = await Sandbox.create() // 使用 base 模板

// Scalebox 默认使用 'code-interpreter' 模板
const sandbox = await Sandbox.create() // 使用 code-interpreter 模板

// 建议：明确指定模板
const sandbox = await Sandbox.create('code-interpreter')
```

### 2. 模板选择

```typescript
// E2B 常用模板
await Sandbox.create('base')
await Sandbox.create('python')
await Sandbox.create('node')

// Scalebox 推荐模板
await Sandbox.create('code-interpreter') // 多语言代码解释器
await Sandbox.create('python')          // Python 专用
await Sandbox.create('nodejs')          // Node.js 专用
```

### 3. API 端点

```typescript
// E2B API 端点
const sandbox = await Sandbox.create('base', {
  apiUrl: 'https://api.e2b.dev'
})

// Scalebox API 端点
const sandbox = await Sandbox.create('code-interpreter', {
  apiUrl: 'https://api.scalebox.dev'
})
```

## 最佳实践

### 1. 明确指定模板

```typescript
// 推荐：明确指定模板
const sandbox = await Sandbox.create('code-interpreter', {
  timeoutMs: 300000,
  metadata: { project: 'my-app' }
})
```

### 2. 错误处理

```typescript
try {
  const sandbox = await Sandbox.create('code-interpreter')
  // 使用沙箱...
  await sandbox.kill()
} catch (error) {
  console.error('沙箱操作失败:', error)
}
```

### 3. 资源清理

```typescript
const sandbox = await Sandbox.create('code-interpreter')

try {
  // 使用沙箱...
} finally {
  // 确保清理资源
  await sandbox.kill()
}
```

## 功能对比

| 功能 | E2B | Scalebox | 状态 |
|------|-----|----------|------|
| 沙箱创建 | ✅ | ✅ | 完全兼容 |
| 沙箱连接 | ✅ | ✅ | 完全兼容 |
| 沙箱列表 | ✅ | ✅ | 完全兼容 |
| 文件系统 | ✅ | ✅ | 完全兼容 |
| 命令执行 | ✅ | ✅ | 完全兼容 |
| 伪终端 | ✅ | ✅ | 完全兼容 |
| 超时管理 | ✅ | ✅ | 完全兼容 |
| 暂停/恢复 | ✅ | ✅ | 完全兼容 |
| 指标监控 | ✅ | ✅ | 完全兼容 |

## 故障排除

### 1. 模板问题

如果遇到模板相关错误，请明确指定模板：

```typescript
// 避免使用默认模板
const sandbox = await Sandbox.create('code-interpreter')
```

### 2. API 密钥问题

确保设置了正确的 API 密钥：

```bash
# 方式 1：使用 Scalebox 环境变量
export SCALEBOX_API_KEY=your_api_key

# 方式 2：使用 E2B 环境变量（向后兼容）
export E2B_API_KEY=your_api_key
```

### 3. 网络问题

如果遇到网络问题，可以指定 API 端点：

```typescript
const sandbox = await Sandbox.create('code-interpreter', {
  apiUrl: 'https://api.scalebox.dev'
})
```

## 支持

如果您在迁移过程中遇到任何问题，请：

1. 查看 [Scalebox 文档](https://scalebox.dev/docs)
2. 检查 [GitHub Issues](https://github.com/scalebox/sdk-js/issues)
3. 联系 Scalebox 支持团队

## 总结

Scalebox SDK 提供了与 E2B 完全一致的 API 体验，让您可以无缝迁移。主要优势包括：

- ✅ **完全兼容**：API 调用方式完全一致
- ✅ **更好的性能**：优化的沙箱性能
- ✅ **更多功能**：支持更多语言和框架
- ✅ **更好的支持**：专业的支持团队
- ✅ **更低的成本**：更具竞争力的定价

开始您的 Scalebox 之旅吧！
