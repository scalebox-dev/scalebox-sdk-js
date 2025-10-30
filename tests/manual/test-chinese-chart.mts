#!/usr/bin/env node
/**
 * 手动测试脚本：生成带中文的图表并保存为图片
 * 运行: node --loader ts-node/esm tests/manual/test-chinese-chart.mts
 */
import { CodeInterpreter } from '../../src/index.js';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'test-output');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function testChineseChart() {
  console.log('🚀 开始测试中文图表生成...\n');
  
  let interpreter: CodeInterpreter | null = null;
  
  try {
    // 创建 CodeInterpreter 实例
    console.log('1️⃣ 创建 CodeInterpreter...');
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'chinese_chart_manual' }
    });
    console.log('✅ CodeInterpreter 创建成功\n');
    
    // 测试1: 带中文标题和标签的折线图
    console.log('2️⃣ 测试带中文标题的折线图...');
    const lineChartCode = `
import matplotlib
matplotlib.use('Agg')
# 配置中文字体
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'DejaVu Sans', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import numpy as np
import io
from IPython.display import Image, display

# 创建数据
x = np.linspace(0, 10, 100)
y1 = np.sin(x)
y2 = np.cos(x)

# 创建图表
plt.figure(figsize=(10, 6))
plt.plot(x, y1, 'b-', linewidth=2, label='正弦波')
plt.plot(x, y2, 'r--', linewidth=2, label='余弦波')
plt.title('三角函数图表示例', fontsize=16, fontweight='bold')
plt.xlabel('时间 (秒)', fontsize=12)
plt.ylabel('振幅', fontsize=12)
plt.legend(loc='upper right', fontsize=10)
plt.grid(True, alpha=0.3)

# 保存并显示
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
print("✅ 折线图生成成功")
`;

    const result1 = await interpreter.runCode(lineChartCode, { language: 'python' });
    
    if (result1.error) {
      console.error('❌ 错误:', result1.error);
    } else if (result1.png && result1.png.length > 0) {
      const filename = 'chinese-line-chart.png';
      const filepath = path.join(OUTPUT_DIR, filename);
      
      // 将 base64 转换为 buffer 并保存
      const buffer = Buffer.from(result1.png, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      console.log(`✅ 折线图保存成功: ${filepath}`);
      console.log(`   文件大小: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`   Base64 长度: ${result1.png.length} 字符\n`);
    } else {
      console.log('⚠️ 未收到 PNG 数据\n');
    }
    
    // 测试2: 带中文标签的柱状图
    console.log('3️⃣ 测试带中文标签的柱状图...');
    const barChartCode = `
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'DejaVu Sans', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import numpy as np
import io
from IPython.display import Image, display

# 中文类别和数据
categories = ['北京', '上海', '广州', '深圳', '杭州']
values = [850, 920, 680, 750, 620]
colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8']

# 创建柱状图
fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.bar(categories, values, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)

# 添加数值标签
for bar in bars:
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height,
            f'{height}万',
            ha='center', va='bottom', fontsize=10, fontweight='bold')

ax.set_title('2024年中国主要城市人口统计', fontsize=16, fontweight='bold', pad=20)
ax.set_xlabel('城市', fontsize=12)
ax.set_ylabel('人口 (万人)', fontsize=12)
ax.set_ylim(0, max(values) * 1.15)
ax.grid(axis='y', alpha=0.3, linestyle='--')

# 保存并显示
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
print("✅ 柱状图生成成功")
`;

    const result2 = await interpreter.runCode(barChartCode, { language: 'python' });
    
    if (result2.error) {
      console.error('❌ 错误:', result2.error);
    } else if (result2.png && result2.png.length > 0) {
      const filename = 'chinese-bar-chart.png';
      const filepath = path.join(OUTPUT_DIR, filename);
      
      const buffer = Buffer.from(result2.png, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      console.log(`✅ 柱状图保存成功: ${filepath}`);
      console.log(`   文件大小: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`   Base64 长度: ${result2.png.length} 字符\n`);
    } else {
      console.log('⚠️ 未收到 PNG 数据\n');
    }
    
    // 测试3: 复杂的中文饼图
    console.log('4️⃣ 测试带中文的饼图...');
    const pieChartCode = `
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'DejaVu Sans', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

# 数据
labels = ['研发部门', '销售部门', '市场部门', '行政部门', '财务部门']
sizes = [35, 25, 20, 12, 8]
colors = ['#ff9999', '#66b3ff', '#99ff99', '#ffcc99', '#ff99cc']
explode = (0.1, 0, 0, 0, 0)  # 突出显示第一块

# 创建饼图
fig, ax = plt.subplots(figsize=(10, 8))
wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, colors=colors,
                                    autopct='%1.1f%%', shadow=True, startangle=90)

# 美化文本
for text in texts:
    text.set_fontsize(12)
    text.set_fontweight('bold')
    
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontsize(10)
    autotext.set_fontweight('bold')

ax.set_title('公司人员分布情况', fontsize=16, fontweight='bold', pad=20)
ax.axis('equal')

# 保存并显示
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
print("✅ 饼图生成成功")
`;

    const result3 = await interpreter.runCode(pieChartCode, { language: 'python' });
    
    if (result3.error) {
      console.error('❌ 错误:', result3.error);
    } else if (result3.png && result3.png.length > 0) {
      const filename = 'chinese-pie-chart.png';
      const filepath = path.join(OUTPUT_DIR, filename);
      
      const buffer = Buffer.from(result3.png, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      console.log(`✅ 饼图保存成功: ${filepath}`);
      console.log(`   文件大小: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`   Base64 长度: ${result3.png.length} 字符\n`);
    } else {
      console.log('⚠️ 未收到 PNG 数据\n');
    }
    
    console.log('═'.repeat(60));
    console.log('🎉 所有测试完成！');
    console.log(`📁 图片保存位置: ${OUTPUT_DIR}`);
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
    throw error;
  } finally {
    if (interpreter) {
      console.log('\n🧹 清理资源...');
      await interpreter.close();
      console.log('✅ 清理完成');
    }
  }
}

// 运行测试
testChineseChart().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});

