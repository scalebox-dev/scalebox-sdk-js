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
    
    await desktop.close()
  })

  it('should start VNC server with custom port', async () => {
    const desktop = await Desktop.create({})
    
    const customVncPort = 5901
    const customPort = 6081
    
    await expect(
      desktop.stream.start(customVncPort, customPort)
    ).resolves.not.toThrow()
    
    expect(desktop.stream.port).toBe(customPort)
    
    await desktop.close()
  })

  it('should start VNC server with authentication', async () => {
    const desktop = await Desktop.create({})
    
    await expect(
      desktop.stream.start(undefined, undefined, true)
    ).resolves.not.toThrow()
    
    // Test that password is generated when auth is enabled
    expect(desktop.stream.password).toBeDefined()
    expect(typeof desktop.stream.password).toBe('string')
    expect(desktop.stream.password!.length).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should get connection URL', async () => {
    const desktop = await Desktop.create({})
    
    await desktop.stream.start()
    
    const url = desktop.stream.getConnectionUrl()
    expect(url).toBeDefined()
    expect(typeof url).toBe('string')
    
    const urlWithParams = desktop.stream.getConnectionUrl(true, false, 'scale')
    expect(urlWithParams).toBeDefined()
    expect(typeof urlWithParams).toBe('string')
    expect(urlWithParams.includes('autoconnect=true')).toBe(true)
    expect(urlWithParams.includes('resize=scale')).toBe(true)
    
    await desktop.close()
  })

  it('should get auth key when authentication is enabled', async () => {
    const desktop = await Desktop.create({})
    
    await desktop.stream.start(undefined, undefined, true) // Enable auth
    
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
      desktop.stream.start(undefined, undefined, false, currentWindowId)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })
})
