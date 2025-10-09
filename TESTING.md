# 测试运行指南

本文档说明如何运行 Scalebox SDK 的测试，特别是如何按目录层级顺序运行测试以避免后端并发限制。

## 测试目录结构

```
tests/
├── api/                    # API 基础测试（不依赖沙箱）
├── code_interpreter/       # 代码解释器测试（轻量级）
├── desktop/               # 桌面应用测试（中等复杂度）
├── sandbox/               # 沙箱测试（最复杂，需要沙箱资源）
└── integration/           # 集成测试（端到端）
```

## 运行方式

### 1. 运行所有测试（并发，可能遇到后端限制）

```bash
# 运行所有测试
pnpm test

# 运行特定目录的测试
pnpm test:api
pnpm test:code-interpreter
pnpm test:desktop
pnpm test:sandbox
pnpm test:integration
```

### 2. 按目录层级顺序运行测试（推荐）

为了避免后端并发限制，建议按以下顺序运行测试：

#### 使用 npm-run-all（简单方式）

```bash
# 运行所有测试目录（包括集成测试）
pnpm test:sequential

# 跳过集成测试
pnpm test:sequential:no-integration
```

#### 使用 Bash 脚本（推荐）

```bash
# 运行所有测试目录（包括集成测试）
pnpm test:sequential:script

# 跳过集成测试
pnpm test:sequential:script:no-integration

# 或者直接运行脚本
./scripts/run-tests-sequential.sh
./scripts/run-tests-sequential.sh --no-integration
```

#### 使用 Node.js 脚本（跨平台）

```bash
# 运行所有测试目录（包括集成测试）
pnpm test:sequential:node

# 跳过集成测试
pnpm test:sequential:node:no-integration

# 或者直接运行脚本
node scripts/run-tests-sequential.js
node scripts/run-tests-sequential.js --no-integration
```

## 测试执行顺序

测试按以下顺序执行，确保资源使用最优化：

1. **API 测试** (`tests/api/`) - 基础 API 功能测试
2. **代码解释器测试** (`tests/code_interpreter/`) - 轻量级代码执行测试
3. **桌面应用测试** (`tests/desktop/`) - 桌面自动化测试
4. **沙箱测试** (`tests/sandbox/`) - 沙箱环境测试（最复杂）
5. **集成测试** (`tests/integration/`) - 端到端测试

## 环境变量

### 必需的环境变量

```bash
# Scalebox API 密钥
export SCALEBOX_API_KEY="your-api-key-here"
```

### 可选的环境变量

```bash
# 启用调试模式
export SCALEBOX_DEBUG=1

# 启用集成测试
export SCALEBOX_INTEGRATION_TEST=1
```

## 测试配置

测试配置在 `vitest.config.ts` 中定义：

- **测试超时**: 5 分钟（适合沙箱操作）
- **环境**: Node.js
- **设置文件**: `tests/setup.ts`

## 故障排除

### 常见问题

1. **后端并发限制**
   - 使用顺序测试运行器：`pnpm test:sequential:node`
   - 避免同时运行多个测试目录

2. **沙箱资源不足**
   - 确保 API 密钥有效
   - 检查网络连接
   - 使用 `--no-integration` 跳过集成测试

3. **测试超时**
   - 检查网络连接
   - 确保 API 密钥有效
   - 考虑增加超时时间

### 调试模式

```bash
# 启用调试模式运行测试
SCALEBOX_DEBUG=1 pnpm test:sequential:node
```

## 持续集成

在 CI/CD 环境中，建议使用：

```bash
# 生产环境测试（跳过集成测试）
pnpm test:sequential:node:no-integration

# 完整测试（包括集成测试）
pnpm test:sequential:node
```

## 性能优化

1. **并行运行**: 在同一个测试目录内，测试可以并行运行
2. **顺序执行**: 不同测试目录之间顺序执行，避免资源冲突
3. **资源清理**: 每个测试目录完成后自动清理资源
4. **延迟执行**: 测试目录之间有 2 秒延迟，确保资源完全释放

## 监控和报告

测试运行器提供详细的执行报告：

- ✅ 通过的测试目录
- ❌ 失败的测试目录
- ⏱️ 执行时间统计
- 📊 总体测试结果

失败时会显示具体的失败目录，便于快速定位问题。
