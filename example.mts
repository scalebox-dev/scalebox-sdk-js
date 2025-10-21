/**
 * Scalebox JavaScript SDK 示例
 * 基于 scalebox-sdk-py 的实际业务场景
 */

import { Sandbox, CodeInterpreter } from './dist/index.js'

async function main() {
  console.log('🚀 Scalebox JavaScript SDK 示例')
  
  try {
    // 创建代码解释器
    console.log('📝 创建代码解释器...')
    const interpreter = await CodeInterpreter.create({
      templateId: 'base',
      timeout: 300
    })

    // 执行 Python 代码
    console.log('🐍 执行 Python 代码...')
    const pythonResult = await interpreter.runCode(`
import numpy as np
import matplotlib.pyplot as plt

# 生成数据
x = np.linspace(0, 10, 100)
y = np.sin(x)

# 创建图表
plt.figure(figsize=(8, 6))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Sine Wave')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)
plt.show()

print("图表已生成")
`, { language: 'python' })

    console.log('Python 执行结果:')
    console.log('成功:', pythonResult.success)
    console.log('执行时间:', pythonResult.executionTime + 'ms')
    console.log('输出:', pythonResult.logs.stdout)

    // 执行 JavaScript 代码
    console.log('🟨 执行 JavaScript 代码...')
    const jsResult = await interpreter.runCode(`
const data = [1, 2, 3, 4, 5];
const sum = data.reduce((a, b) => a + b, 0);
console.log('数组:', data);
console.log('总和:', sum);
`, { language: 'javascript' })

    console.log('JavaScript 执行结果:')
    console.log('成功:', jsResult.success)
    console.log('输出:', jsResult.logs.stdout)

    // 演示上下文管理
    console.log('🔄 演示上下文管理...')
    const context = await interpreter.createContext({ language: 'python' })
    console.log(`创建上下文: ${context.id}`)
    
    // 使用上下文执行多个代码块
    await interpreter.runCode('counter = 0', { language: 'python', context })
    await interpreter.runCode('counter += 1; print(f"Counter: {counter}")', { language: 'python', context })
    
    // 清理上下文
    await interpreter.destroyContext(context)
    console.log('上下文已销毁')

    // 清理资源
    console.log('🧹 清理资源...')
    await interpreter.close()
    console.log('✅ 示例完成!')

  } catch (error) {
    console.error('❌ 错误:', error)
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}