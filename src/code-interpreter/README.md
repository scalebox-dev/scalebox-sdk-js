# Code Interpreter Module

## 概述

Code Interpreter 模块提供了一个完整的代码执行引擎，支持多种编程语言的实时执行和状态管理。该模块基于 Connect RPC 协议实现，提供了类型安全、流式处理和丰富的输出格式支持。

## 架构设计

### 模块结构

```
src/code-interpreter/
├── index.ts          # 主入口 - CodeInterpreter 类实现
├── client.ts         # Connect RPC 客户端 - 执行和上下文服务
├── parser.ts         # 输出解析器 - 处理流式响应
├── types.ts          # 类型定义 - 完整的 TypeScript 类型系统
└── README.md         # 本文档
```

### 核心组件

#### 1. CodeInterpreter (index.ts)
主要的用户接口类，提供以下功能：
- 代码执行（同步和流式）
- 上下文管理（创建、销毁、查询）
- 异步执行处理
- 资源清理

#### 2. RPC Clients (client.ts)
Connect RPC 客户端实现：
- **ExecutionServiceClient**: 流式代码执行服务
- **ContextServiceClient**: 状态上下文管理服务
- 基于 Protocol Buffers 的类型安全通信
- 支持 HTTP/1.1 和 HTTP/2

#### 3. Output Parser (parser.ts)
处理执行响应流：
- **Logs**: 聚合 stdout/stderr 输出
- **Execution**: 累积执行数据和结果
- **parseOutput**: 主解析函数，处理多种事件类型
- **executionToResult**: 转换为最终结果格式

#### 4. Type Definitions (types.ts)
完整的 TypeScript 类型系统：
- 执行选项和结果类型
- 上下文和语言定义
- 图表类型（线图、散点图、柱状图等）
- 流式响应接口

## 技术特性

### 1. Connect RPC 通信
- 使用 @connectrpc/connect 进行 RPC 通信
- 自动 protobuf 序列化/反序列化
- 流式响应支持
- 类型安全的请求/响应

### 2. 流式执行
```typescript
// 实时流式代码执行
for await (const response of interpreter.executeStream({
  language: 'python',
  code: 'print("Hello, World!")',
  onStdout: (msg) => console.log(msg.content)
})) {
  // 处理每个流式响应
}
```

### 3. 状态上下文
类似 Jupyter Kernel 的执行上下文：
- 跨多次执行保持变量和状态
- 隔离的执行环境
- 可配置工作目录和环境变量

### 4. 丰富的输出格式
支持多种输出类型：
- 文本输出 (stdout/stderr)
- 富媒体 (HTML, SVG, PNG, PDF)
- 图表 (线图、散点图、柱状图、饼图等)
- JSON 数据
- Markdown 和 LaTeX

### 5. 回调处理器
实时事件回调：
- `onStdout`: 标准输出处理
- `onStderr`: 错误输出处理
- `onResult`: 结果处理
- `onError`: 错误处理
- `onExit`: 退出码处理

## 使用示例

### 基本使用

```typescript
import { CodeInterpreter } from './code-interpreter'

// 创建代码解释器
const interpreter = await CodeInterpreter.create({
  templateId: 'code-interpreter',
  timeout: 60000
})

// 执行代码
const result = await interpreter.execute({
  language: 'python',
  code: 'print("Hello, World!")'
})

console.log(result.stdout) // "Hello, World!\n"
```

### 流式执行

```typescript
// 使用流式执行获取实时反馈
for await (const response of interpreter.executeStream({
  language: 'python',
  code: 'import time\nfor i in range(5):\n    print(i)\n    time.sleep(1)',
  onStdout: (msg) => {
    console.log('实时输出:', msg.content)
  }
})) {
  // 处理流式响应
}
```

### 上下文管理

```typescript
// 创建持久化上下文
const context = await interpreter.createCodeContext({
  language: 'python',
  cwd: '/workspace'
})

// 在上下文中执行多次代码
await interpreter.runCode('x = 42', {
  language: 'python',
  context
})

await interpreter.runCode('print(x * 2)', {
  language: 'python',
  context
}) // 输出: 84

// 清理上下文
await interpreter.destroyContext(context)
```

### 回调处理

```typescript
const result = await interpreter.runCode(
  'import matplotlib.pyplot as plt\nplt.plot([1,2,3])',
  {
    language: 'python',
    onStdout: (msg) => console.log('输出:', msg.content),
    onStderr: (msg) => console.error('错误:', msg.content),
    onResult: (result) => {
      if (result.png) {
        console.log('生成了图表')
      }
    },
    onError: (error) => console.error('执行失败:', error.message)
  }
)
```

### 资源清理

```typescript
// 关闭解释器并清理所有资源
await interpreter.close()
```

## API 文档

### CodeInterpreter 类

#### 静态方法
- `create(opts?)`: 创建新的代码解释器实例

#### 实例方法
- `execute(opts)`: 执行代码（基本接口）
- `executeStream(opts)`: 流式执行代码
- `runCode(code, opts)`: 执行代码（完整接口）
- `runCodeAsync(code, opts)`: 异步后台执行
- `createContext(opts)`: 创建执行上下文
- `createCodeContext(opts)`: 创建代码上下文（推荐）
- `destroyContext(context)`: 销毁上下文
- `getContexts()`: 获取所有上下文
- `getContext(id)`: 获取特定上下文
- `getSandbox()`: 获取底层 Sandbox 实例
- `close()`: 关闭解释器并清理资源

#### 属性
- `jupyterUrl`: Jupyter 服务 URL

### 类型定义

详见 `types.ts` 文件，主要类型包括：

- `Language`: 支持的编程语言
- `CodeContext`: 执行上下文
- `CodeInterpreterOpts`: 解释器选项
- `CodeExecutionOpts`: 代码执行选项
- `ExecutionResult`: 执行结果
- `ExecutionResponse`: 流式响应
- `Result`: 富媒体结果
- `ChartTypes`: 图表类型

## 代码规范

### 文件组织
1. 所有 import 按字母顺序排列
2. 类型导入使用 `import type` 语法
3. 同一包的导入合并在一起
4. 值导入和类型导入分开

### 文档注释
- 所有公共 API 都有完整的 JSDoc 注释
- 包含参数说明、返回值说明和使用示例
- 复杂逻辑有内联注释说明

### 错误处理
- 使用 `handleConnectError` 统一处理错误
- 所有异步操作都有错误捕获
- 提供有意义的错误消息

## 最新改进（2025-01）

### 1. 文件重命名
- `generatedClient.ts` → `client.ts` (更简洁清晰)

### 2. Import 优化
- 合并同一包的 import 语句
- 按字母顺序排列所有 import
- 正确区分类型导入和值导入
- 移除未使用的 import

### 3. 文档完善
- 为所有类、方法、函数添加详细的 JSDoc 注释
- 增加使用示例和参数说明
- 添加架构说明和设计理念

### 4. 代码质量
- 所有文件通过 TypeScript 编译检查
- 没有 linter 错误
- 遵循一致的代码风格

## 与 Python SDK 的对比

| 特性 | Python SDK | JavaScript SDK | 状态 |
|------|-----------|---------------|------|
| 流式执行 | ✅ async for | ✅ AsyncGenerator | ✅ |
| gRPC 通信 | ✅ Connect | ✅ Connect | ✅ |
| 输出解析 | ✅ parse_output | ✅ parseOutput | ✅ |
| 上下文管理 | ✅ create/destroy | ✅ create/destroy | ✅ |
| 图表支持 | ✅ Chart types | ✅ Chart types | ✅ |
| 回调处理 | ✅ Callbacks | ✅ OutputHandlers | ✅ |
| 类型安全 | ⚠️ 运行时 | ✅ 编译时 | ✅ |

## 依赖项

- `@connectrpc/connect`: Connect RPC 客户端
- `@connectrpc/connect-web`: Web 传输层
- `@bufbuild/protobuf`: Protocol Buffers 运行时
- 内部依赖: `../sandbox`, `../api`, `../connectionConfig`

## 贡献指南

1. 保持代码风格一致
2. 添加完整的类型注解
3. 为新功能编写文档和示例
4. 确保所有测试通过
5. 更新 README 说明

## License

与项目主 License 保持一致