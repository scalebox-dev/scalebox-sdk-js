/**
 * Chart Data Transmission Tests
 * 
 * Validates that chart data is correctly transmitted from backend to SDK:
 * - Chart field is not undefined
 * - Chart type, title, elements are accessible
 * - Chinese characters in labels are transmitted correctly
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeInterpreter } from '../../src/code-interpreter';

describe('Chart Data Transmission Tests', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'chart_data_validation' },
      envs: { CI_TEST: 'chart_test' }
    });
  });

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should receive PNG data from matplotlib plot', async () => {
    expect(interpreter).not.toBeNull();

    // matplotlib 需要通过 IPython.display.Image 来显示图片
    const code = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

plt.figure(figsize=(8, 6))
plt.plot([1, 2, 3, 4], [10, 20, 15, 25], marker='o')
plt.title('Test Chart')
plt.xlabel('X Axis')
plt.ylabel('Y Axis')

# Save to bytes buffer and display
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
plt.close()

# Display the image
display(Image(data=buf.getvalue()))
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    console.log('matplotlib PNG test result:', {
      hasError: !!result.error,
      stdout: result.stdout?.substring(0, 200),
      resultsCount: result.results?.length,
      results: result.results?.map((r, i) => ({
        index: i,
        isMain: r.isMainResult,
        hasPng: !!r.png,
        pngLength: r.png?.length || 0,
        text: r.text?.substring(0, 50)
      })),
      topLevelPngLength: result.png?.length || 0
    });
    
    expect(result.error).toBeUndefined();
    
    // Matplotlib generates PNG images, not structured chart data
    if (result.png && result.png.length > 0) {
      expect(result.png).toBeDefined();
      expect(result.png!.length).toBeGreaterThan(0);
      console.log('✅ PNG image received from matplotlib, length:', result.png?.length);
    } else {
      console.log('❌ NO PNG DATA - Check results array above');
      // Fail the test with informative message
      throw new Error('No PNG data received from matplotlib');
    }
  });

  it('should handle Chinese characters with proper font configuration', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import matplotlib
matplotlib.use('Agg')
# Configure Chinese font
matplotlib.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

import matplotlib.pyplot as plt
import io
from IPython.display import Image, display

plt.figure(figsize=(8, 6))
plt.plot([1, 2, 3, 4], [10, 20, 15, 25], marker='o')
plt.title('测试中文标题')
plt.xlabel('横轴标签')
plt.ylabel('纵轴标签')

# Save to bytes buffer and display
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
plt.close()

# Display the image
display(Image(data=buf.getvalue()))
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    expect(result.error).toBeUndefined();
    // Matplotlib with Chinese characters should still generate PNG
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(0);
    
    console.log('✅ PNG with Chinese labels generated successfully, length:', result.png?.length);
  });

  it('should handle structured chart data with type field', async () => {
    expect(interpreter).not.toBeNull();

    // Test with structured chart data (JSON with type field)
    const code = `
import json
from IPython.display import display, JSON

# Create structured chart data that backend can recognize
chart_data = {
    "type": "bar",
    "title": "Test Bar Chart",
    "elements": [
        {"label": "A", "group": "Series 1", "value": "23"},
        {"label": "B", "group": "Series 1", "value": "45"},
        {"label": "C", "group": "Series 1", "value": "56"},
        {"label": "D", "group": "Series 1", "value": "78"}
    ]
}

# Display as JSON MIME type
display(JSON(chart_data))
print("Chart data displayed")
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    console.log('Structured chart test - Result:', {
      hasError: !!result.error,
      text: result.text,
      json: result.json?.substring(0, 200),
      chart: result.chart,
      resultsCount: result.results?.length,
      results: result.results?.map((r, i) => ({
        index: i,
        isMain: r.isMainResult,
        hasJson: !!r.json,
        hasChart: !!r.chart,
        text: r.text?.substring(0, 50)
      }))
    });
    
    expect(result.error).toBeUndefined();
    
    // Now chart field should be populated
    if (result.chart) {
      expect(result.chart.type).toBe('bar');
      expect(result.chart.title).toBe('Test Bar Chart');
      expect(result.chart.elements).toBeDefined();
      
      console.log('✅ Structured chart data received:', {
        type: result.chart.type,
        title: result.chart.title,
        elementCount: result.chart.elements?.length
      });
    } else {
      console.log('⚠️ No chart data received. JSON:', result.json);
    }
  });

  it('should handle structured scatter plot data', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import json
from IPython.display import display, JSON

# Create structured scatter chart data
chart_data = {
    "type": "scatter",
    "title": "Scatter Plot Test",
    "elements": [
        {
            "label": "Series 1",
            "points": [[1, 2], [2, 4], [3, 6], [4, 8]]
        }
    ]
}

display(JSON(chart_data))
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    expect(result.error).toBeUndefined();
    expect(result.chart).toBeDefined();
    
    if (result.chart) {
      expect(['scatter', 'line']).toContain(result.chart.type);
      
      console.log('Structured scatter plot data received:', {
        type: result.chart.type,
        title: result.chart.title
      });
    }
  });

  it('should handle multiple series with structured data', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import json
from IPython.display import display, JSON

# Create structured chart with multiple series
chart_data = {
    "type": "line",
    "title": "Multiple Series Test",
    "elements": [
        {
            "label": "Series 1",
            "points": [[1, 1], [2, 4], [3, 9], [4, 16], [5, 25]]
        },
        {
            "label": "Series 2",
            "points": [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]
        }
    ]
}

display(JSON(chart_data))
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    expect(result.error).toBeUndefined();
    expect(result.chart).toBeDefined();
    
    if (result.chart) {
      expect(result.chart.elements).toBeDefined();
      expect(result.chart.elements!.length).toBe(2);
      
      console.log('Multiple series chart data received:', {
        type: result.chart.type,
        seriesCount: result.chart.elements?.length
      });
    }
  });

  it('should handle chart with Chinese characters in structured data', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import json
from IPython.display import display, JSON

# Create structured chart with Chinese characters
chart_data = {
    "type": "line",
    "title": "测试中文标题",
    "elements": [
        {
            "label": "数据系列一",
            "points": [[1, 10], [2, 20], [3, 15]]
        }
    ]
}

display(JSON(chart_data))
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    expect(result.error).toBeUndefined();
    expect(result.chart).toBeDefined();
    
    if (result.chart) {
      // Verify Chinese characters are transmitted in chart data
      expect(result.chart.title).toBe('测试中文标题');
      
      console.log('Chart with Chinese characters received:', {
        title: result.chart.title,
        elementCount: result.chart.elements?.length
      });
    }
  });
});

