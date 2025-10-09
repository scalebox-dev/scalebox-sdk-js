import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Keyboard Operations', () => {
  it('should type text', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.type('Hello, World!')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should press and release keys', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.press('Enter')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.release('Enter')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('Space')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.release('Space')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should press keys with modifiers', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.press('c', ['Ctrl'])
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('v', ['Ctrl'])
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('Tab', ['Shift'])
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should execute hotkeys', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.hotkey(['Ctrl', 'C'])
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.hotkey(['Ctrl', 'V'])
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.hotkey(['Ctrl', 'Alt', 'T'])
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should handle special key mappings', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    // Test various special keys that should be mapped
    await expect(
      desktop.automation.keyboard.press('Enter')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('escape')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('backspace')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('delete')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('tab')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should handle function keys', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.press('F1')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('F5')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('F12')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should handle arrow keys', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.press('up')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('down')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('left')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('right')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should handle modifier keys', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.press('shift')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('ctrl')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('alt')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.press('cmd')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should type text with special characters', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.type('Hello "World"!')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.type("It's a test with 'quotes'")
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.keyboard.type('Path: C:\\Users\\test')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should type text with custom chunk size and delay', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.keyboard.type('Custom typing test', 10, 50)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should wait specified time', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const startTime = Date.now()
    await desktop.automation.keyboard.wait(500) // 500ms
    const endTime = Date.now()
    
    expect(endTime - startTime).toBeGreaterThanOrEqual(450) // Allow some tolerance
    
    await desktop.close()
  })
})
