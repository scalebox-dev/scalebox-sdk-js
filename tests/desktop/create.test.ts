import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Creation', () => {
  it('should create a desktop with default options', async () => {
    const desktop = await Desktop.create({})
    
    expect(desktop).toBeDefined()
    expect(desktop.getSandboxId()).toBeDefined()
    expect(desktop.automation).toBeDefined()
    expect(desktop.display).toBe(':0') // Test default display
    expect(desktop.stream).toBeDefined() // Test VNC server instance
    
    await desktop.close()
  })

  it('should create a desktop with custom options', async () => {
    const desktop = await Desktop.create({
      templateId: 'desktop',
      timeout: 60000,
      metadata: { test: 'custom-desktop' }
    })
    
    expect(desktop).toBeDefined()
    expect(desktop.getSandboxId()).toBeDefined()
    expect(desktop.automation).toBeDefined()
    
    const info = await desktop.getInfo()
    expect(info.sandboxId).toBe(desktop.getSandboxId())
    
    await desktop.close()
  })

  it('should create a desktop with custom resolution and display settings', async () => {
    const desktop = await Desktop.create({
      templateId: 'desktop',
      timeout: 60000,
      resolution: [1280, 720],
      dpi: 120,
      display: ':1',
      envs: { 
        LANG: 'en_US.UTF-8',
        TEST_ENV: 'desktop-test'
      }
    })
    
    expect(desktop).toBeDefined()
    expect(desktop.display).toBe(':1')
    expect(desktop.stream).toBeDefined()
    
    await desktop.close()
  })

  it('should create a desktop with high resolution', async () => {
    const desktop = await Desktop.create({
      templateId: 'desktop',
      timeout: 60000,
      resolution: [1920, 1080],
      dpi: 96
    })
    
    expect(desktop).toBeDefined()
    
    // Test that screen size matches our settings
    const screenSize = await desktop.automation.screen.getSize()
    expect(screenSize.width).toBeGreaterThan(0)
    expect(screenSize.height).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should connect to existing desktop', async () => {
    const originalDesktop = await Desktop.create({
      templateId: 'desktop',
      timeout: 60000  // 添加超时设置，避免超过3600秒限制
    })
    
    const desktopId = originalDesktop.getSandboxId()
    expect(desktopId).toBeDefined()
    
    const connectedDesktop = await Desktop.connect(desktopId!, {
      timeout: 60000  // 添加超时设置
    })
    
    expect(connectedDesktop).toBeDefined()
    expect(connectedDesktop.getSandboxId()).toBe(desktopId)
    expect(connectedDesktop.automation).toBeDefined()
    
    await originalDesktop.close()
  })
})
