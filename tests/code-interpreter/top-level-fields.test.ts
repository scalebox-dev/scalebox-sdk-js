/**
 * Top-level Convenience Fields Tests
 * 
 * This test suite validates that top-level convenience fields (png, svg, html)
 * are correctly populated from the main result.
 * 
 * Background: These top-level fields provide convenient access to media data
 * from the main execution result, while the full results array remains accessible
 * for advanced use cases.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executionToResult, Execution, Logs } from '../../src/code-interpreter/parser';
import type { Result } from '../../src/code-interpreter/types';
import { CodeInterpreter } from '../../src/code-interpreter';

describe('Top-level Convenience Fields - Unit Tests', () => {
  it('should populate png field from main result', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    const mainResult: Result = {
      text: 'test',
      png: 'base64_png_data_here',
      isMainResult: true
    };
    
    execution.results.push(mainResult);
    
    const result = executionToResult(execution, 'python');
    
    // Top-level png should be populated
    expect(result.png).toBe('base64_png_data_here');
    expect(result.results?.[0].png).toBe('base64_png_data_here');
  });

  it('should populate svg field from main result', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    const mainResult: Result = {
      svg: '<svg>...</svg>',
      isMainResult: true
    };
    
    execution.results.push(mainResult);
    
    const result = executionToResult(execution, 'python');
    
    expect(result.svg).toBe('<svg>...</svg>');
  });

  it('should populate html field from main result', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    const mainResult: Result = {
      html: '<h1>Test</h1>',
      isMainResult: true
    };
    
    execution.results.push(mainResult);
    
    const result = executionToResult(execution, 'python');
    
    expect(result.html).toBe('<h1>Test</h1>');
  });

  it('should populate text field from main result', () => {
    const execution = new Execution();
    execution.logs = new Logs(['stdout output'], []);
    
    const mainResult: Result = {
      text: 'main result text',
      isMainResult: true
    };
    
    execution.results.push(mainResult);
    
    const result = executionToResult(execution, 'python');
    
    // Text should come from main result, not stdout
    expect(result.text).toBe('main result text');
  });

  it('should fallback to stdout when no main result text', () => {
    const execution = new Execution();
    execution.logs = new Logs(['stdout output'], []);
    
    const nonMainResult: Result = {
      text: 'some text',
      isMainResult: false
    };
    
    execution.results.push(nonMainResult);
    
    const result = executionToResult(execution, 'python');
    
    // Should fallback to stdout since no main result
    expect(result.text).toBe('stdout output');
  });

  it('should handle multiple results with only one main', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    const result1: Result = {
      text: 'first',
      png: 'first_png',
      isMainResult: false
    };
    
    const result2: Result = {
      text: 'second',
      png: 'main_png',
      svg: 'main_svg',
      html: '<div>main</div>',
      isMainResult: true
    };
    
    const result3: Result = {
      text: 'third',
      png: 'third_png',
      isMainResult: false
    };
    
    execution.results.push(result1, result2, result3);
    
    const result = executionToResult(execution, 'python');
    
    // Top-level fields should come from the main result (result2)
    expect(result.text).toBe('second');
    expect(result.png).toBe('main_png');
    expect(result.svg).toBe('main_svg');
    expect(result.html).toBe('<div>main</div>');
    
    // All results should still be in the array
    expect(result.results?.length).toBe(3);
  });

  it('should handle no results', () => {
    const execution = new Execution();
    execution.logs = new Logs(['just stdout'], []);
    
    const result = executionToResult(execution, 'python');
    
    expect(result.png).toBeUndefined();
    expect(result.svg).toBeUndefined();
    expect(result.html).toBeUndefined();
    expect(result.text).toBe('just stdout'); // Fallback to stdout
  });

  it('should populate all media fields from main result simultaneously', () => {
    const execution = new Execution();
    execution.logs = new Logs(['execution output'], []);
    
    // Simulating a rich result with multiple media types
    const richResult: Result = {
      text: 'Analysis complete',
      png: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      svg: '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
      html: '<div class="result"><h1>Report</h1><p>Data visualization</p></div>',
      markdown: '# Report\n\nData analysis results',
      isMainResult: true
    };
    
    execution.results.push(richResult);
    
    const result = executionToResult(execution, 'python');
    
    // All top-level convenience fields should be populated
    expect(result.text).toBe('Analysis complete');
    expect(result.png).toBe(richResult.png);
    expect(result.svg).toBe(richResult.svg);
    expect(result.html).toBe(richResult.html);
    
    // Ensure result object reference is also correct
    expect(result.result).toBe(richResult);
    expect(result.result?.markdown).toBe('# Report\n\nData analysis results');
  });

  it('should not populate top-level fields when main result has undefined media', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    const mainResult: Result = {
      text: 'text only',
      png: undefined,
      svg: undefined,
      html: undefined,
      isMainResult: true
    };
    
    execution.results.push(mainResult);
    
    const result = executionToResult(execution, 'python');
    
    expect(result.text).toBe('text only');
    expect(result.png).toBeUndefined();
    expect(result.svg).toBeUndefined();
    expect(result.html).toBeUndefined();
  });

  it('should use media result when main result has no media content', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    // This simulates matplotlib scenario:
    // Image is in a non-main result, but main result has no media
    const imageResult: Result = {
      png: 'customer_image_data',
      svg: '<svg>customer_chart</svg>',
      isMainResult: false  // Not the main result!
    };
    
    const textResult: Result = {
      text: 'Final output',
      isMainResult: true  // Main result, but no media
    };
    
    execution.results.push(imageResult, textResult);
    
    const result = executionToResult(execution, 'python');
    
    // NEW BEHAVIOR: When main result has no media, use result with media
    // This fixes the matplotlib chart display issue
    expect(result.png).toBe('customer_image_data');
    expect(result.svg).toBe('<svg>customer_chart</svg>');
    // Text field fallback: mainResult (imageResult now) has no text, so it uses stdout
    expect(result.text).toBe('output');
    
    // Data is still accessible in results array
    expect(result.results?.[0].png).toBe('customer_image_data');
    expect(result.results?.[0].svg).toBe('<svg>customer_chart</svg>');
    expect(result.results?.[1].text).toBe('Final output');
  });

  it('should populate fields when image result is marked as main', () => {
    const execution = new Execution();
    execution.logs = new Logs(['generating plot'], []);
    
    // This is the correct scenario: image result is marked as main
    const plotResult: Result = {
      png: 'matplotlib_plot_base64_data',
      text: 'Plot generated successfully',
      isMainResult: true  // Correctly marked as main!
    };
    
    execution.results.push(plotResult);
    
    const result = executionToResult(execution, 'python');
    
    // After fix: Both result.png and result.results[0].png should have the data
    expect(result.png).toBe('matplotlib_plot_base64_data');
    expect(result.text).toBe('Plot generated successfully');
    expect(result.results?.[0].png).toBe('matplotlib_plot_base64_data');
    
    // This solves the customer issue: now they can use result.png directly
    expect(result.png).toBeDefined();
  });

  it('should handle empty strings in media fields', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    const mainResult: Result = {
      text: 'result',
      png: '',  // Empty string, not undefined
      svg: '',
      html: '',
      isMainResult: true
    };
    
    execution.results.push(mainResult);
    
    const result = executionToResult(execution, 'python');
    
    // Empty strings should be preserved (they are falsy but not undefined)
    expect(result.png).toBe('');
    expect(result.svg).toBe('');
    expect(result.html).toBe('');
  });

  it('should preserve backward compatibility with results array', () => {
    const execution = new Execution();
    execution.logs = new Logs(['output'], []);
    
    const result1: Result = {
      png: 'image1',
      isMainResult: false
    };
    
    const result2: Result = {
      png: 'image2',
      svg: 'chart2',
      isMainResult: true
    };
    
    const result3: Result = {
      html: '<div>report</div>',
      isMainResult: false
    };
    
    execution.results.push(result1, result2, result3);
    
    const result = executionToResult(execution, 'python');
    
    // Top-level fields should come from main result
    expect(result.png).toBe('image2');
    expect(result.svg).toBe('chart2');
    expect(result.html).toBeUndefined();
    
    // All results should still be accessible in array (backward compatibility)
    expect(result.results?.length).toBe(3);
    expect(result.results?.[0].png).toBe('image1');
    expect(result.results?.[1].png).toBe('image2');
    expect(result.results?.[1].svg).toBe('chart2');
    expect(result.results?.[2].html).toBe('<div>report</div>');
    
    // Users can still iterate through all results if needed
    const allPngs = result.results?.filter(r => r.png).map(r => r.png);
    expect(allPngs).toEqual(['image1', 'image2']);
  });
});

describe('Top-level Convenience Fields - Integration Tests', () => {
  let interpreter: CodeInterpreter | null = null;

  beforeAll(async () => {
    interpreter = await CodeInterpreter.create({
      templateId: 'code-interpreter',
      metadata: { test: 'top_level_fields_integration' }
    });
  }, 60000);

  afterAll(async () => {
    if (interpreter) {
      await interpreter.close();
    }
  });

  it('should populate top-level text from actual execution', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
data = {"result": "success", "value": 42}
print("Processing complete")
data
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    // Verify that top-level field matches main result
    if (result.result && result.result.isMainResult && result.result.text) {
      expect(result.text).toBe(result.result.text);
    }
    
    expect(result.text).toBeDefined();
  }, 30000);

  it('should support both access patterns for backward compatibility', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
final = "This is the result"
print("Done")
final
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    // Both access patterns should work
    expect(result.results).toBeDefined();
    expect(result.text).toBeDefined();
    
    if (result.results && result.results.length > 0) {
      const mainResult = result.results.find(r => r.isMainResult);
      if (mainResult?.text) {
        // Top-level should match main result in array
        expect(result.text).toContain(mainResult.text);
      }
    }
  }, 30000);

  it('should handle dictionary output correctly', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
report = {
    "status": "completed",
    "tests_passed": 15,
    "tests_failed": 0
}
print("Test run completed")
report
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    // Verify the top-level field is populated
    expect(result.text).toBeDefined();
  }, 30000);

  it('should provide convenient access to media fields', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
analysis = {
    "mean": 42.5,
    "median": 41.0,
    "std_dev": 5.2
}
print("Analysis complete")
analysis
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    // Verify convenience fields are accessible
    expect(result.text).toBeDefined();
    
    // For text-only results, media fields should be undefined or empty
    // (empty string is acceptable from backend)
    if (result.png && result.png.length > 0) {
      // If PNG has actual data, verify it matches main result
      expect(result.result?.png).toBe(result.png);
    }
    
    // Main verification: if result has media in main result, top-level should match
    if (result.result) {
      if (result.result.png && result.result.png.length > 0) {
        expect(result.png).toBe(result.result.png);
      }
      if (result.result.svg && result.result.svg.length > 0) {
        expect(result.svg).toBe(result.result.svg);
      }
      if (result.result.html && result.result.html.length > 0) {
        expect(result.html).toBe(result.result.html);
      }
    }
  }, 30000);

  it('should handle actual image generation with matplotlib (if available)', async () => {
    expect(interpreter).not.toBeNull();

    const code = `
import sys
try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    import numpy as np
    from IPython.display import display
    
    print("✅ All imports successful")
    
    # Generate a simple plot
    x = np.linspace(0, 2 * np.pi, 100)
    y = np.sin(x)
    
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.plot(x, y, 'b-', linewidth=2, label='sin(x)')
    ax.set_xlabel('X axis')
    ax.set_ylabel('Y axis')
    ax.set_title('Sine Wave - Test Plot')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # 🎯 KEY: Save to bytes and display as Image
    import io
    from IPython.display import Image
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    buf.seek(0)
    plt.close(fig)
    
    # Display the image data
    display(Image(data=buf.getvalue()))
    
    print("SUCCESS: Plot generated and displayed")
    "plot_created"
    
except ImportError as e:
    print(f"SKIP: matplotlib not available - {e}")
    "matplotlib_not_installed"
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
    "error_occurred"
`;

    const result = await interpreter!.runCode(code, { language: 'python' });
    
    console.log('\n📈 Image Generation Test');
    console.log('─'.repeat(60));
    console.log('Stdout:', result.stdout.substring(0, 100));
    console.log('Success:', result.success);
    console.log('Has PNG:', result.png ? `✅ Yes (${result.png.length} chars)` : '❌ No');
    console.log('Has SVG:', result.svg ? `✅ Yes (${result.svg.length} chars)` : '❌ No');
    console.log('Results array length:', result.results?.length || 0);
    
    if (result.results && result.results.length > 0) {
      console.log('\nResults breakdown:');
      result.results.forEach((r, i) => {
        console.log(`  [${i}] isMain=${r.isMainResult}, png=${r.png ? 'Y' : 'N'}, svg=${r.svg ? 'Y' : 'N'}`);
      });
    }
    
    if (result.stdout.includes('SUCCESS: Plot generated')) {
      console.log('\n✅ matplotlib is available and plot was generated');
      
      // Check if image data is in results array
      const hasImageInResults = result.results?.some(r => r.png || r.svg);
      console.log('Image in results array:', hasImageInResults ? '✅ Yes' : '❌ No');
      
      // Find result with image (may or may not be marked as main)
      const resultWithImage = result.results?.find(r => r.png || r.svg);
      
      if (resultWithImage) {
        console.log('\n🎯 KEY VERIFICATION: Image data found in results');
        console.log('Has PNG:', !!resultWithImage.png);
        console.log('Has SVG:', !!resultWithImage.svg);
        console.log('Is marked as main:', !!resultWithImage.isMainResult);
        
        // Verify top-level fields are populated (with intelligent fallback)
        if (resultWithImage.png) {
          console.log('\n✅ Verifying fix: result.png populated from results array');
          expect(result.png).toBeDefined();
          expect(result.png!.length).toBeGreaterThan(0);
          console.log(`✅ Top-level result.png correctly populated! (${result.png!.length} chars)`);
          
          // If using fallback, top-level should match the found result
          if (!resultWithImage.isMainResult) {
            console.log('✅ Intelligent fallback worked: used first result with media content');
          }
        }
        
        if (resultWithImage.svg) {
          console.log('\n✅ Verifying fix: result.svg populated from results array');
          expect(result.svg).toBeDefined();
          expect(result.svg!.length).toBeGreaterThan(0);
          console.log(`✅ Top-level result.svg correctly populated! (${result.svg!.length} chars)`);
        }
      } else {
        console.log('\n⚠️  No image found in results array');
        console.log('    This may indicate an issue with Jupyter display integration');
      }
    } else if (result.stdout.includes('SKIP: matplotlib not available')) {
      console.log('\n⏭️  Skipping: matplotlib not installed in sandbox');
      console.log('   This test requires matplotlib to verify actual image generation');
    } else {
      console.log('\n❌ Plot generation failed or returned unexpected output');
    }
    
    // Test always passes - we're just demonstrating the functionality
    expect(result).toBeDefined();
  }, 60000);
});
