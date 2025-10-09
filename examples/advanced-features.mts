/**
 * Advanced Scalebox SDK Features Example
 * 
 * This example demonstrates the enhanced features including:
 * - File system monitoring
 * - Process management  
 * - gRPC-based operations
 * - Domain and authentication handling
 */

import { Sandbox } from '@scalebox/sdk'

async function main() {
  console.log('🚀 Starting Scalebox Advanced Features Demo')
  
  // Create sandbox with enhanced configuration
  const sandbox = await Sandbox.create({
    template: 'base',
    debug: true, // Enable debug logging
    logger: {
      info: (msg, ...args) => console.log('ℹ️', msg, ...args),
      debug: (msg, ...args) => console.log('🐛', msg, ...args),
      warn: (msg, ...args) => console.warn('⚠️', msg, ...args),
      error: (msg, ...args) => console.error('❌', msg, ...args)
    }
  })
  
  console.log(`📦 Sandbox created: ${sandbox.sandboxId}`)
  console.log(`🌐 Sandbox domain: ${sandbox.sandboxDomain}`)

  try {
    // === File System Operations ===
    console.log('\n📂 === File System Operations ===')
    
    // Create some test files
    await sandbox.files.write('/workspace/test.txt', 'Hello Scalebox!')
    await sandbox.files.makeDir('/workspace/testdir')
    await sandbox.files.write('/workspace/testdir/nested.txt', 'Nested file content')
    
    // List directory with gRPC
    console.log('\n📋 Listing directory via gRPC:')
    const entries = await sandbox.files.list('/workspace', { recursive: true })
    entries.forEach(entry => {
      console.log(`  ${entry.type === 'directory' ? '📁' : '📄'} ${entry.path} (${entry.size} bytes)`)
    })

    // === File System Monitoring ===
    console.log('\n👀 === File System Monitoring ===')
    
    // Method 1: Streaming file watcher
    console.log('Starting streaming file watcher...')
    const watchPromise = (async () => {
      let eventCount = 0
      for await (const event of sandbox.files.watchDir('/workspace', { recursive: true })) {
        console.log(`👀 File event: ${event.type} - ${event.name}`)
        eventCount++
        if (eventCount >= 3) break // Stop after 3 events
      }
    })()
    
    // Method 2: Polling-based watcher
    console.log('Creating polling-based watcher...')
    const watcher = await sandbox.files.createWatcher('/workspace', { recursive: true })
    console.log(`📝 Created watcher: ${watcher.id}`)
    
    // Generate some file events
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait a bit
    await sandbox.files.write('/workspace/new-file.txt', 'New content')
    await sandbox.files.move('/workspace/test.txt', '/workspace/renamed-test.txt')
    await sandbox.files.remove('/workspace/new-file.txt')
    
    // Wait for streaming events
    await watchPromise
    
    // Check polling watcher events
    const events = await watcher.getEvents()
    console.log(`📝 Polling watcher found ${events.length} events:`)
    events.forEach(event => {
      console.log(`  - ${event.type}: ${event.name}`)
    })
    
    // Clean up watcher
    await watcher.remove()
    console.log('📝 Watcher removed')

    // === Process Management ===
    console.log('\n⚙️ === Process Management ===')
    
    // List current processes
    console.log('📋 Current processes:')
    const processes = await sandbox.processes.list()
    processes.forEach(proc => {
      console.log(`  - PID ${proc.pid}: ${proc.config.cmd} ${proc.config.args?.join(' ') || ''}`)
    })
    
    // Start a long-running process
    console.log('\n🚀 Starting a long-running process...')
    const processPromise = (async () => {
      let output = ''
      for await (const event of sandbox.processes.start({
        cmd: 'bash',
        args: ['-c', 'for i in {1..5}; do echo "Count: $i"; sleep 1; done; echo "Done!"']
      }, { tag: 'counter-process' })) {
        
        if (event.type === 'start') {
          console.log(`🚀 Process started with PID: ${event.data?.pid}`)
        } else if (event.type === 'data') {
          if (event.data?.stdout) {
            const text = new TextDecoder().decode(event.data.stdout)
            output += text
            console.log(`📤 stdout: ${text.trim()}`)
          }
          if (event.data?.stderr) {
            const text = new TextDecoder().decode(event.data.stderr)
            console.log(`📤 stderr: ${text.trim()}`)
          }
        } else if (event.type === 'end') {
          console.log(`🏁 Process ended with exit code: ${event.data?.exitCode}`)
          break
        }
      }
      return output
    })()
    
    // Wait for the process to complete
    const processOutput = await processPromise
    console.log('✅ Process completed')
    
    // Start an interactive process (PTY)
    console.log('\n🖥️ Starting interactive shell...')
    const ptyPromise = (async () => {
      for await (const event of sandbox.processes.start({
        cmd: 'bash'
      }, { 
        tag: 'interactive-shell',
        pty: { size: { cols: 80, rows: 24 } }
      })) {
        
        if (event.type === 'start') {
          console.log(`🖥️ Interactive shell started with PID: ${event.data?.pid}`)
          
          // Send some commands
          await sandbox.processes.sendPtyInput(
            { tag: 'interactive-shell' }, 
            'echo "Hello from PTY!"\n'
          )
          await new Promise(resolve => setTimeout(resolve, 500))
          
          await sandbox.processes.sendPtyInput(
            { tag: 'interactive-shell' }, 
            'ls -la /workspace\n'
          )
          await new Promise(resolve => setTimeout(resolve, 500))
          
          await sandbox.processes.sendPtyInput(
            { tag: 'interactive-shell' }, 
            'exit\n'
          )
        } else if (event.type === 'data') {
          if (event.data?.pty) {
            const text = new TextDecoder().decode(event.data.pty)
            console.log(`🖥️ pty: ${text.trim()}`)
          }
        } else if (event.type === 'end') {
          console.log(`🏁 Interactive shell ended with exit code: ${event.data?.exitCode}`)
          break
        }
      }
    })()
    
    await ptyPromise
    console.log('✅ Interactive shell completed')
    
    // === Process Control ===
    console.log('\n🎛️ === Process Control ===')
    
    // Start a process we'll control
    const controlProcessPromise = (async () => {
      for await (const event of sandbox.processes.start({
        cmd: 'sleep',
        args: ['30']  // Sleep for 30 seconds
      }, { tag: 'controlled-process' })) {
        
        if (event.type === 'start') {
          console.log(`🎛️ Controlled process started with PID: ${event.data?.pid}`)
          
          // Wait 2 seconds then send SIGTERM
          setTimeout(async () => {
            console.log('📡 Sending SIGTERM to controlled process...')
            await sandbox.processes.sendSignal(
              { tag: 'controlled-process' }, 
              'SIGTERM'
            )
          }, 2000)
        } else if (event.type === 'end') {
          console.log(`🏁 Controlled process ended with exit code: ${event.data?.exitCode}`)
          break
        }
      }
    })()
    
    await controlProcessPromise
    console.log('✅ Process control demonstration completed')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...')
    await sandbox.close()
    console.log('✅ Sandbox closed')
  }
}

main().catch(console.error)
