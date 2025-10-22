import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop VNC Stream', () => {
  it('should have VNC server instance accessible', async () => {
    const desktop = await Desktop.create({})
    
    expect(desktop.stream).toBeDefined()
    expect(desktop.stream.port).toBeDefined()
    expect(typeof desktop.stream.port).toBe('number')
    expect(desktop.stream.readonly).toBeDefined()
    expect(typeof desktop.stream.readonly).toBe('boolean')
    
    await desktop.close()
  })

  it('should start VNC server', async () => {
    const desktop = await Desktop.create({})
    
    await expect(
      desktop.stream.start()
    ).resolves.not.toThrow()
    
    // Test that server is running after start
    expect(desktop.stream.port).toBeGreaterThan(0)
    expect(desktop.stream.isRunning()).toBe(true)
    expect(desktop.stream.status).toBe('running')
    
    await desktop.close()
  })

  it('should start VNC server with custom port', async () => {
    const desktop = await Desktop.create({})
    
    const customVncPort = 5901
    const customPort = 6081
    
    await expect(
      desktop.stream.start({
        vncPort: customVncPort,
        port: customPort
      })
    ).resolves.not.toThrow()
    
    expect(desktop.stream.port).toBe(customPort)
    expect(desktop.stream.status).toBe('running')
    
    await desktop.close()
  })

  it('should start VNC server with authentication', async () => {
    const desktop = await Desktop.create({})
    
    await expect(
      desktop.stream.start({ requireAuth: true })
    ).resolves.not.toThrow()
    
    // Test that password is generated when auth is enabled
    expect(desktop.stream.password).toBeDefined()
    expect(typeof desktop.stream.password).toBe('string')
    expect(desktop.stream.password!.length).toBeGreaterThan(0)
    expect(desktop.stream.status).toBe('running')
    
    await desktop.close()
  })

  it('should get connection URL', async () => {
    const desktop = await Desktop.create({})
    
    await desktop.stream.start()
    
    const url = desktop.stream.getConnectionUrl()
    expect(url).toBeDefined()
    expect(typeof url).toBe('string')
    
    const urlWithParams = desktop.stream.getConnectionUrl({
      autoConnect: true,
      viewOnly: false,
      resize: 'scale'
    })
    expect(urlWithParams).toBeDefined()
    expect(typeof urlWithParams).toBe('string')
    expect(urlWithParams.includes('autoconnect=true')).toBe(true)
    expect(urlWithParams.includes('resize=scale')).toBe(true)
    
    await desktop.close()
  })

  it('should get auth key when authentication is enabled', async () => {
    const desktop = await Desktop.create({})
    
    await desktop.stream.start({ requireAuth: true })
    
    const authKey = desktop.stream.getAuthKey()
    expect(authKey).toBeDefined()
    expect(typeof authKey).toBe('string')
    expect(authKey.length).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should stop VNC server', async () => {
    const desktop = await Desktop.create({})
    
    await desktop.stream.start()
    
    await expect(
      desktop.stream.stop()
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should handle start/stop cycle', async () => {
    const desktop = await Desktop.create({})
    
    // Start server
    await desktop.stream.start()
    
    // Stop server
    await desktop.stream.stop()
    
    // Start again
    await expect(
      desktop.stream.start()
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should start VNC server with window ID', async () => {
    const desktop = await Desktop.create({})
    
    // Launch an application first to get a window
    await desktop.automation.applications.launch('xfce4-terminal')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const currentWindowId = await desktop.automation.windows.getCurrentWindowId()
    
    await expect(
      desktop.stream.start({ windowId: currentWindowId })
    ).resolves.not.toThrow()
    
    expect(desktop.stream.status).toBe('running')
    
    await desktop.close()
  })

  it('should check if VNC server is running', async () => {
    const desktop = await Desktop.create({})
    
    expect(desktop.stream.isRunning()).toBe(false)
    expect(desktop.stream.status).toBe('idle')
    
    await desktop.stream.start()
    
    expect(desktop.stream.isRunning()).toBe(true)
    expect(desktop.stream.status).toBe('running')
    
    await desktop.stream.stop()
    
    expect(desktop.stream.isRunning()).toBe(false)
    expect(desktop.stream.status).toBe('idle')
    
    await desktop.close()
  })

  it('should restart VNC server', async () => {
    const desktop = await Desktop.create({})
    
    await desktop.stream.start({ port: 6080 })
    expect(desktop.stream.port).toBe(6080)
    expect(desktop.stream.isRunning()).toBe(true)
    
    // Restart with new port
    await desktop.stream.restart({ port: 6081 })
    expect(desktop.stream.port).toBe(6081)
    expect(desktop.stream.isRunning()).toBe(true)
    
    await desktop.close()
  })

  it('should throw error when starting already running server', async () => {
    const desktop = await Desktop.create({})
    
    await desktop.stream.start()
    
    await expect(
      desktop.stream.start()
    ).rejects.toThrow('Stream is already running')
    
    await desktop.close()
  })

  it('should handle stopping non-running server (idempotent)', async () => {
    const desktop = await Desktop.create({})
    
    // stop() 是幂等操作，不会抛出错误
    await expect(
      desktop.stream.stop()
    ).resolves.not.toThrow()
    
    // 状态应该是 idle
    expect(desktop.stream.status).toBe('idle')
    
    await desktop.close()
  })
})
