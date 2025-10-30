/**
 * Session API Examples
 * 
 * This file demonstrates the usage of the Session high-level API
 * for stateful code execution with automatic lifecycle management.
 */

import { Session } from '../src/index.js'
import * as fs from 'fs'

/**
 * Example 1: Simple One-Time Execution
 * 
 * Execute code without worrying about sandbox management.
 * Everything is handled automatically.
 */
async function example1_SimpleExecution() {
  console.log('\n=== Example 1: Simple One-Time Execution ===\n')
  
  const result = await Session.run({
    code: `
print("Hello, World!")
for i in range(5):
    print(f"Count: {i}")
    `,
    language: 'python'
  })
  
  console.log('Output:', result.text)
  console.log(`Execution time: ${result.timing.totalMs}ms`)
  console.log(`Success: ${result.success}`)
  
  // Sandbox automatically created and destroyed ✅
}

/**
 * Example 2: Execution with Files and Dependencies
 * 
 * Upload files and install packages automatically.
 */
async function example2_FilesAndPackages() {
  console.log('\n=== Example 2: Files and Dependencies ===\n')
  
  // Sample CSV data
  const csvData = `name,age,city
Alice,30,New York
Bob,25,London
Charlie,35,Tokyo`
  
  const result = await Session.run({
    code: `
import pandas as pd

df = pd.read_csv('data.csv')
print("Dataset Info:")
print(df)
print()
print("Statistics:")
print(df.describe())
    `,
    files: {
      'data.csv': csvData
    },
    packages: ['pandas'],
    onProgress: (progress) => {
      console.log(`[${progress.stage}] ${progress.percent.toFixed(0)}% - ${progress.message}`)
    }
  })
  
  console.log('\nOutput:')
  console.log(result.text)
  
  console.log('\nTiming Breakdown:')
  console.log(`  Total: ${result.timing.totalMs}ms`)
  console.log(`  Connecting: ${result.timing.stages.connecting}ms`)
  console.log(`  Uploading: ${result.timing.stages.uploading}ms`)
  console.log(`  Installing: ${result.timing.stages.installing}ms`)
  console.log(`  Executing: ${result.timing.stages.executing}ms`)
}

/**
 * Example 3: Multi-Step Workflow with Session Reuse
 * 
 * Demonstrates how to maintain state across multiple executions.
 */
async function example3_SessionReuse() {
  console.log('\n=== Example 3: Multi-Step Workflow ===\n')
  
  // Step 1: Initialize environment
  console.log('Step 1: Initialize environment')
  const step1 = await Session.run({
    code: `
import pandas as pd
import numpy as np
print("Environment initialized")
    `,
    packages: ['pandas', 'numpy'],
    keepAlive: true  // Keep sandbox alive
  })
  
  console.log(step1.text)
  const sessionId = step1.sessionId!
  console.log(`Session ID: ${sessionId}`)
  
  // Step 2: Create dataset
  console.log('\nStep 2: Create dataset')
  const step2 = await Session.run({
    code: `
# Variables from step1 are still available
data = np.random.randn(100, 3)
df = pd.DataFrame(data, columns=['A', 'B', 'C'])
print(f"Created dataset with shape: {df.shape}")
    `,
    sessionId,
    keepAlive: true
  })
  
  console.log(step2.text)
  
  // Step 3: Analyze data
  console.log('\nStep 3: Analyze data')
  const step3 = await Session.run({
    code: `
# df variable persists from step2
summary = df.describe()
print("Dataset Summary:")
print(summary)
    `,
    sessionId,
    keepAlive: false  // Cleanup after this
  })
  
  console.log(step3.text)
  
  console.log('\n✅ Session automatically cleaned up')
}

/**
 * Example 4: Data Analysis with Visualization
 * 
 * Demonstrates file download and result retrieval.
 */
async function example4_DataVisualization() {
  console.log('\n=== Example 4: Data Analysis with Visualization ===\n')
  
  const salesData = `month,revenue,expenses
Jan,10000,7000
Feb,12000,7500
Mar,15000,8000
Apr,13000,7800
May,16000,8500
Jun,18000,9000`
  
  const result = await Session.run({
    code: `
import pandas as pd
import matplotlib.pyplot as plt

# Load data
df = pd.read_csv('sales.csv')
print("Sales Data:")
print(df)
print()

# Calculate profit
df['profit'] = df['revenue'] - df['expenses']
print("Profit by month:")
print(df[['month', 'profit']])
print()

# Create visualization
plt.figure(figsize=(10, 6))
plt.plot(df['month'], df['revenue'], marker='o', label='Revenue')
plt.plot(df['month'], df['expenses'], marker='s', label='Expenses')
plt.plot(df['month'], df['profit'], marker='^', label='Profit')
plt.xlabel('Month')
plt.ylabel('Amount ($)')
plt.title('Sales Analysis')
plt.legend()
plt.grid(True)
plt.savefig('sales_chart.png', dpi=100, bbox_inches='tight')

# Save analysis results
df.to_csv('sales_analysis.csv', index=False)

print("Chart saved to sales_chart.png")
print("Analysis saved to sales_analysis.csv")
    `,
    files: {
      'sales.csv': salesData
    },
    packages: ['pandas', 'matplotlib'],
    downloadFiles: ['sales_chart.png', 'sales_analysis.csv']
  })
  
  console.log('Output:')
  console.log(result.text)
  
  console.log('\nDownloaded files:')
  for (const [path, content] of Object.entries(result.files || {})) {
    console.log(`  ${path}: ${content.length} bytes`)
  }
  
  // Validate and save files
  console.log('\n📁 Validating downloaded files...')
  
  // Validate CSV file
  if (result.files?.['sales_analysis.csv']) {
    const csvContent = result.files['sales_analysis.csv'].toString()
    const lines = csvContent.split('\n').filter(line => line.trim())
    console.log('\n✅ CSV file validated:')
    console.log(`  Lines: ${lines.length}`)
    console.log(`  Header: ${lines[0]}`)
    console.log(`  First data row: ${lines[1]}`)
    
    // Save to disk
    fs.writeFileSync('/tmp/sales_analysis.csv', result.files['sales_analysis.csv'])
    console.log('  Saved to: /tmp/sales_analysis.csv')
  } else {
    console.log('\n❌ CSV file not found')
  }
  
  // Validate PNG file
  if (result.files?.['sales_chart.png']) {
    const pngBuffer = result.files['sales_chart.png']
    const pngHeader = pngBuffer.slice(0, 8)
    const isPNG = pngHeader[0] === 0x89 && 
                  pngHeader[1] === 0x50 && 
                  pngHeader[2] === 0x4E && 
                  pngHeader[3] === 0x47
    
    console.log('\n✅ PNG file validated:')
    console.log(`  Size: ${pngBuffer.length} bytes`)
    console.log(`  Valid PNG header: ${isPNG}`)
    console.log(`  First 8 bytes: ${Array.from(pngHeader).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`)
    
    // Save to disk
    fs.writeFileSync('/tmp/sales_chart.png', pngBuffer)
    console.log('  Saved to: /tmp/sales_chart.png')
  } else {
    console.log('\n❌ PNG file not found')
  }
}

/**
 * Example 5: Real-Time Progress Tracking
 * 
 * Monitor execution progress in real-time.
 */
async function example5_ProgressTracking() {
  console.log('\n=== Example 5: Real-Time Progress Tracking ===\n')
  
  const progressLog: string[] = []
  
  const result = await Session.run({
    code: `
import time
import pandas as pd

print("Starting data processing...")

for i in range(5):
    time.sleep(1)
    print(f"Processing batch {i+1}/5...")

print("Data processing complete!")
    `,
    packages: ['pandas'],
    
    onProgress: (progress) => {
      const line = `[${progress.stage.padEnd(12)}] ${progress.percent.toFixed(0).padStart(3)}% | ${progress.message}`
      console.log(line)
      progressLog.push(line)
    },
    
    onStdout: (output) => {
      console.log(`  [stdout] ${output.trim()}`)
    }
  })
  
  console.log('\n✅ Execution completed')
  console.log(`\nTotal stages: ${progressLog.length}`)
  console.log(`Total time: ${result.timing.totalMs}ms`)
}

/**
 * Example 6: Performance Insights
 * 
 * Get automatic optimization suggestions.
 */
async function example6_PerformanceInsights() {
  console.log('\n=== Example 6: Performance Insights ===\n')
  
  // Simulate slow operation with many packages
  const result = await Session.run({
    code: `
import pandas as pd
import numpy as np

data = np.random.randn(1000, 10)
df = pd.DataFrame(data)
print(df.describe())
    `,
    packages: ['pandas', 'numpy', 'matplotlib', 'scipy']
  })
  
  console.log('Output:', result.text.slice(0, 200) + '...')
  
  console.log('\n📊 Timing Breakdown:')
  console.log(`  Total: ${result.timing.totalMs}ms`)
  for (const [stage, duration] of Object.entries(result.timing.stages)) {
    const percent = result.timing.distribution[stage as keyof typeof result.timing.distribution] || 0
    console.log(`  ${stage.padEnd(12)}: ${duration.toString().padStart(5)}ms (${percent.toFixed(1)}%)`)
  }
  
  if (result.insights) {
    console.log('\n💡 Performance Insights:')
    console.log(`  Bottleneck: ${result.insights.bottleneck}`)
    
    if (result.insights.suggestions) {
      console.log('\n  Optimization Suggestions:')
      result.insights.suggestions.forEach(suggestion => {
        console.log(`    • ${suggestion}`)
      })
    }
  }
}

/**
 * Example 7: Session Management
 * 
 * Monitor and manage active sessions.
 */
async function example7_SessionManagement() {
  console.log('\n=== Example 7: Session Management ===\n')
  
  // Create a few sessions
  const session1 = await Session.run({
    code: 'print("Session 1")',
    keepAlive: true
  })
  
  const session2 = await Session.run({
    code: 'print("Session 2")',
    language: 'python',
    keepAlive: true
  })
  
  // List all sessions
  console.log('Active sessions:')
  const sessions = await Session.listSessions()
  for (const session of sessions) {
    console.log(`\nSession ${session.sessionId}:`)
    console.log(`  Language: ${session.language}`)
    console.log(`  Created: ${session.createdAt.toISOString()}`)
    console.log(`  Expires: ${session.expiresAt?.toISOString()}`)
    
    // Get detailed info
    const info = await Session.getSession(session.sessionId)
    console.log(`  Status: ${info.status}`)
    console.log(`  Packages: ${info.installedPackages.join(', ') || 'none'}`)
    console.log(`  Files: ${info.uploadedFiles.length}`)
    console.log(`  Remaining: ${Math.floor(info.remainingTime! / 60000)} minutes`)
  }
  
  // Clean up
  console.log('\nCleaning up sessions...')
  await Session.close(session1.sessionId!)
  await Session.close(session2.sessionId!)
  console.log('✅ All sessions closed')
}

/**
 * Example 8: Advanced - Direct Sandbox Access
 * 
 * Use both high-level and low-level APIs together.
 */
async function example8_AdvancedUsage() {
  console.log('\n=== Example 8: Advanced - Direct Sandbox Access ===\n')
  
  // Create session with high-level API
  const result = await Session.run({
    code: 'print("Session created")',
    keepAlive: true
  })
  
  // Get direct sandbox reference
  const sandbox = result.sandbox!
  console.log(`Sandbox ID: ${sandbox.sandboxId}`)
  
  // Use low-level Sandbox API for advanced operations
  console.log('\nUsing low-level Sandbox API:')
  
  // File operations
  await sandbox.files.write('/workspace/custom_file.txt', 'Custom content')
  const content = await sandbox.files.read('/workspace/custom_file.txt')
  console.log(`  File content: ${content.toString()}`)
  
  // List files
  const files = await sandbox.files.list('/workspace')
  console.log(`  Files in workspace: ${files.length}`)
  
  // Get metrics (returns array with single latest data point)
  const metrics = await sandbox.getMetrics()
  console.log(`  CPU usage: ${metrics[0].cpuUsedPct.toFixed(2)}%`)
  console.log(`  Memory usage: ${(metrics[0].memUsed / 1024 / 1024).toFixed(2)}MB`)
  
  // Back to high-level API
  console.log('\nBack to high-level API:')
  const result2 = await Session.run({
    code: `
with open('/workspace/custom_file.txt', 'r') as f:
    content = f.read()
print(f"File content from Python: {content}")
    `,
    sessionId: result.sessionId
  })
  
  console.log('Output:', result2.text)
  
  // Clean up
  await Session.close(result.sessionId!)
  console.log('\n✅ Session closed')
}

/**
 * Example 9: Error Handling
 * 
 * Proper error handling and cleanup.
 */
async function example9_ErrorHandling() {
  console.log('\n=== Example 9: Error Handling ===\n')
  
  let sessionId: string | undefined
  
  try {
    // Intentionally cause an error
    const result = await Session.run({
      code: `
print("Before error")
x = 1 / 0  # This will raise an error
print("After error")  # This won't execute
      `,
      keepAlive: true
    })
    
    sessionId = result.sessionId
    
    // Check execution status
    if (!result.success) {
      console.log('❌ Execution failed')
      console.log('Exit code:', result.exitCode)
      console.log('Error output:')
      console.log(result.stderr)
    }
    
  } catch (error) {
    console.error('❌ SDK Error:', error)
  } finally {
    // Always clean up
    if (sessionId) {
      console.log('\nCleaning up session...')
      await Session.close(sessionId).catch(() => {
        console.log('Session already closed or expired')
      })
    }
  }
}

/**
 * Main function - Run all examples
 */
async function main() {
  console.log('🚀 Scalebox High-Level API Examples\n')
  console.log('These examples demonstrate the simplified Scalebox API')
  console.log('with automatic lifecycle management and intelligent caching.\n')
  
  try {
    // Run examples
    await example1_SimpleExecution()
    await example2_FilesAndPackages()
    await example3_SessionReuse()
    await example4_DataVisualization()
    await example5_ProgressTracking()
    await example6_PerformanceInsights()
    await example7_SessionManagement()
    await example8_AdvancedUsage()
    await example9_ErrorHandling()
    
    console.log('\n✅ All examples completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error)
    process.exit(1)
  }
}

// Run examples
main().catch(console.error)

