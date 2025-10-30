# 📝 中文字体配置指南

## 当前可用字体

在 Code Interpreter 沙箱环境中，已预装以下中文字体：

| 字体名称 | 字体包 | 推荐用途 |
|---------|-------|---------|
| **WenQuanYi Micro Hei** | fonts-wqy-microhei | ✅ **推荐使用** - 黑体，显示清晰 |
| **WenQuanYi Zen Hei** | fonts-wqy-zenhei | ✅ **推荐使用** - 正黑体，适合标题 |

## 快速使用

### matplotlib 配置（推荐）

```python
import matplotlib
matplotlib.use('Agg')

# 配置中文字体（必需）
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False  # 解决负号显示问题

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

# 创建图表
plt.figure(figsize=(8, 6))
plt.plot([1, 2, 3, 4], [10, 20, 15, 25], marker='o')
plt.title('中文标题示例')
plt.xlabel('横轴标签')
plt.ylabel('纵轴标签')

# 保存并显示
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
```

### TypeScript/JavaScript 使用

```typescript
import { CodeInterpreter } from '@scalebox/sdk';

const interpreter = await CodeInterpreter.create({
  templateId: 'code-interpreter'
});

const code = `
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

plt.figure(figsize=(8, 6))
plt.plot([1, 2, 3], [10, 20, 15])
plt.title('销售数据')
plt.xlabel('月份')
plt.ylabel('销量')

buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
`;

const result = await interpreter.runCode(code, { language: 'python' });

// 获取生成的图片
if (result.png) {
  console.log('图片大小:', result.png.length, '字符');
  // result.png 是 base64 编码的 PNG 图片
}
```

## 完整示例

### 柱状图（带中文）

```python
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

# 数据
categories = ['北京', '上海', '广州', '深圳']
values = [850, 920, 680, 750]

# 创建柱状图
plt.figure(figsize=(10, 6))
plt.bar(categories, values, color='#4ECDC4', alpha=0.8)
plt.title('2024年城市人口统计', fontsize=14, fontweight='bold')
plt.xlabel('城市', fontsize=12)
plt.ylabel('人口（万）', fontsize=12)
plt.grid(axis='y', alpha=0.3)

# 保存并显示
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
```

### 饼图（带中文）

```python
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

# 数据
labels = ['研发', '销售', '市场', '行政']
sizes = [35, 25, 20, 20]
colors = ['#ff9999', '#66b3ff', '#99ff99', '#ffcc99']

# 创建饼图
plt.figure(figsize=(8, 8))
plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', 
        shadow=True, startangle=90)
plt.title('部门人员分布', fontsize=14, fontweight='bold')
plt.axis('equal')

# 保存并显示
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
```

## 常见问题

### ❓ 为什么会出现方框（豆腐块）？

**原因**：没有配置中文字体，matplotlib 使用默认字体无法显示中文。

**解决**：在代码开头添加字体配置：
```python
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
```

### ❓ 负号显示为方框？

**原因**：matplotlib 默认使用 Unicode 负号，但某些字体不支持。

**解决**：禁用 Unicode 负号：
```python
matplotlib.rcParams['axes.unicode_minus'] = False
```

### ❓ 可以使用其他字体吗？

**当前限制**：沙箱环境只预装了 WenQuanYi 系列字体。

**未来计划**：我们正在评估添加更多字体（如 Noto Sans CJK），届时会更新本文档。

### ❓ 为什么要设置 `matplotlib.use('Agg')`？

**原因**：沙箱环境是非图形化环境，需要使用 Agg（Anti-Grain Geometry）后端。

**说明**：这是标准做法，所有非交互式环境都需要此配置。

## 字体配置模板

### 最小配置（推荐）

```python
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display
```

### 完整配置（可选）

```python
import matplotlib
matplotlib.use('Agg')

# 字体配置
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'WenQuanYi Zen Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

# 图表样式配置（可选）
matplotlib.rcParams['figure.figsize'] = (10, 6)
matplotlib.rcParams['figure.dpi'] = 100
matplotlib.rcParams['savefig.dpi'] = 150
matplotlib.rcParams['savefig.bbox'] = 'tight'

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display
```

## 验证字体配置

### 检查可用字体

```python
import matplotlib.font_manager as fm

# 列出所有包含 "wqy" 的字体
fonts = [f.name for f in fm.fontManager.ttflist if 'wqy' in f.name.lower()]
print('可用的中文字体:', fonts)

# 输出示例：
# 可用的中文字体: ['WenQuanYi Micro Hei', 'WenQuanYi Zen Hei']
```

### 测试中文显示

```python
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

# 简单测试
plt.figure(figsize=(6, 4))
plt.text(0.5, 0.5, '中文显示测试', fontsize=24, ha='center', va='center')
plt.xlim(0, 1)
plt.ylim(0, 1)
plt.axis('off')

buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
```

如果看到 "中文显示测试" 文字清晰显示，说明配置成功！

## 其他绘图库

### seaborn

```python
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import seaborn as sns
import pandas as pd
import io
from IPython.display import Image, display

# seaborn 使用 matplotlib 的字体配置
data = pd.DataFrame({
    '月份': ['1月', '2月', '3月', '4月'],
    '销量': [150, 230, 180, 250]
})

plt.figure(figsize=(8, 6))
sns.barplot(data=data, x='月份', y='销量')
plt.title('月度销量统计')

buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
plt.close()

display(Image(data=buf.getvalue()))
```

### plotly（注意事项）

```python
import plotly.graph_objects as go
import io
from IPython.display import Image, display

# plotly 需要使用 orca 或 kaleido 导出静态图片
# 如果只需要交互式图表，可以直接使用 plotly.show()
# 注意：plotly 的字体配置方式不同

fig = go.Figure(data=[
    go.Bar(x=['北京', '上海', '广州'], y=[850, 920, 680])
])

fig.update_layout(
    title='城市人口',
    font=dict(family='WenQuanYi Micro Hei', size=12)
)

# 导出为图片（需要 kaleido）
img_bytes = fig.to_image(format='png')
display(Image(data=img_bytes))
```

## 最佳实践

### 1. 始终配置字体

在任何使用 matplotlib 的代码开头添加字体配置，即使不确定是否会用到中文。

### 2. 使用备用字体

```python
# 提供多个备用字体
matplotlib.rcParams['font.sans-serif'] = [
    'WenQuanYi Micro Hei',  # 首选
    'WenQuanYi Zen Hei',    # 备用
    'sans-serif'            # 最终备用
]
```

### 3. 统一配置管理

```python
# config.py
def setup_chinese_fonts():
    """统一的中文字体配置"""
    import matplotlib
    matplotlib.use('Agg')
    matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
    matplotlib.rcParams['axes.unicode_minus'] = False
    matplotlib.rcParams['savefig.bbox'] = 'tight'
    matplotlib.rcParams['savefig.dpi'] = 150

# 在绘图前调用
setup_chinese_fonts()
```

### 4. 错误处理

```python
import matplotlib
matplotlib.use('Agg')

try:
    matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
    matplotlib.rcParams['axes.unicode_minus'] = False
except Exception as e:
    print(f'字体配置失败: {e}')
    # 继续执行，使用默认字体
```

## 未来改进

我们正在计划以下改进：

- [ ] 添加 Noto Sans CJK 字体（更完整的中日韩字符支持）
- [ ] 添加 DejaVu 系列字体（更好的西文显示）
- [ ] 添加 Emoji 字体支持
- [ ] 全局 matplotlib 配置（无需手动设置）

## 技术说明

### 为什么不设置 ASCII 编码？

**错误做法**：
```python
# ❌ 错误 - 不要这样做！
import sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii')
```

**原因**：
- ASCII 只支持 0-127 范围的字符（仅英文）
- 中文字符的 Unicode 编码范围在 19968-40959
- 使用 ASCII 会导致 `UnicodeEncodeError`

**正确做法**：
- 保持默认的 UTF-8 编码
- 配置支持中文的字体文件

### 编码 vs 字体

| 问题类型 | 症状 | 解决方法 |
|---------|------|---------|
| **编码问题** | 显示为 `ä¸­æ–‡` | 使用 UTF-8 编码 |
| **字体问题** | 显示为 `☐☐` (方框) | 配置中文字体 |

当前问题属于**字体问题**，不是编码问题。

## 支持与反馈

如果您在使用中文字体时遇到问题，请：

1. 检查是否添加了字体配置代码
2. 确认使用的字体名称正确（区分大小写）
3. 查看是否有相关错误信息

需要帮助？欢迎联系技术支持！

---

**最后更新**: 2024-10-30  
**适用版本**: @scalebox/sdk >= 3.1.2

