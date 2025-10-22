import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Sandbox } from '../../src/sandbox'

describe('Commands and PTY Fix Tests', () => {
  let sandbox: Sandbox

  beforeAll(async () => {
    console.log('🚀 Creating sandbox for Commands/PTY fix tests...')
    sandbox = await Sandbox.create({ templateId: 'base' })
    console.log(`✅ Sandbox created: ${sandbox.sandboxId}`)
  })

  afterAll(async () => {
    if (sandbox) {
      console.log('🧹 Cleaning up sandbox...')
      await sandbox.kill()
      console.log('✅ Sandbox killed')
    }
  })

  it('should execute simple commands', async () => {
    console.log('🧪 Testing Commands - Simple execution...')
    const result = await sandbox.commands.run('echo "Hello from Commands"')
    
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Hello from Commands')
    console.log('✅ Commands simple execution passed')
  })

  it('should execute background commands with callbacks', async () => {
    console.log('🧪 Testing Commands - Background execution...')
    let stdoutData = ''
    
    const handle = await sandbox.commands.run('echo "Background test"', {
      background: true,
      onStdout: (data) => {
        stdoutData += data
        console.log(`📤 Received: ${data.trim()}`)
      }
    })
    
    const bgResult = await handle.wait()
    
    expect(bgResult.exitCode).toBe(0)
    expect(bgResult.stdout).toContain('Background test')
    expect(handle.pid).toBeDefined()
    console.log(`✅ Commands background execution passed (PID: ${handle.pid})`)
  })

  it('should create and interact with PTY', async () => {
    console.log('🧪 Testing PTY - Basic interaction...')
    let ptyData = ''
    
    const pty = await sandbox.pty.start({
      size: { cols: 80, rows: 24 },
      onData: (data) => {
        const text = new TextDecoder().decode(data)
        ptyData += text
        console.log(`📤 PTY data: ${text.substring(0, 30)}...`)
      }
    })
    
    // Wait for PTY to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    expect(pty.pid).toBeDefined()
    console.log(`✅ PTY created successfully (PID: ${pty.pid})`)
    
    // Send command to PTY
    await pty.send('echo "Hello from PTY"\n')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Send exit command
    await pty.send('exit\n')
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('✅ PTY interaction completed')
  })

  it('should list processes', async () => {
    console.log('🧪 Testing process listing...')
    const processes = await sandbox.commands.list()
    
    expect(Array.isArray(processes)).toBe(true)
    console.log(`✅ Process listing passed (found ${processes.length} processes)`)
  })

  it('should handle command errors gracefully', async () => {
    console.log('🧪 Testing error handling...')
    const result = await sandbox.commands.run('nonexistentcommand 2>&1')
    
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toBeDefined()
    console.log('✅ Error handling test passed')
  })
})
