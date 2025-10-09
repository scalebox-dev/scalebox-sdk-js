import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Window Management', () => {
  it('should get current window ID', async () => {
    const desktop = await Desktop.create({})
    
    const windowId = await desktop.automation.windows.getCurrentWindowId()
    
    expect(windowId).toBeDefined()
    expect(typeof windowId).toBe('string')
    expect(windowId.length).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should get window title', async () => {
    const desktop = await Desktop.create({})
    
    const windowId = await desktop.automation.windows.getCurrentWindowId()
    const title = await desktop.automation.windows.getWindowTitle(windowId)
    
    expect(title).toBeDefined()
    expect(typeof title).toBe('string')
    
    await desktop.close()
  })

  it('should get application windows', async () => {
    const desktop = await Desktop.create({})
    
    const windows = await desktop.automation.windows.getApplicationWindows('terminal')
    
    expect(windows).toBeDefined()
    expect(Array.isArray(windows)).toBe(true)
    
    await desktop.close()
  })

  it('should get all windows', async () => {
    const desktop = await Desktop.create({})
    
    const windows = await desktop.automation.windows.getAllWindows()
    
    expect(windows).toBeDefined()
    expect(Array.isArray(windows)).toBe(true)
    
    await desktop.close()
  })

  it('should focus window', async () => {
    const desktop = await Desktop.create({})
    
    const windowId = await desktop.automation.windows.getCurrentWindowId()
    
    await expect(
      desktop.automation.windows.focusWindow(windowId)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should close window', async () => {
    const desktop = await Desktop.create({})
    
    const windowId = await desktop.automation.windows.getCurrentWindowId()
    
    await expect(
      desktop.automation.windows.closeWindow(windowId)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should minimize and maximize window', async () => {
    const desktop = await Desktop.create({})
    
    const windowId = await desktop.automation.windows.getCurrentWindowId()
    
    await expect(
      desktop.automation.windows.minimizeWindow(windowId)
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.windows.maximizeWindow(windowId)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should resize and move window', async () => {
    const desktop = await Desktop.create({})
    
    const windowId = await desktop.automation.windows.getCurrentWindowId()
    
    await expect(
      desktop.automation.windows.resizeWindow(windowId, 800, 600)
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.windows.moveWindow(windowId, 100, 100)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })
})
