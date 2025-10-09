import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Screen Operations', () => {
  it('should get screen size', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const screenSize = await desktop.automation.screen.getSize()
    
    expect(screenSize).toBeDefined()
    expect(screenSize.width).toBeDefined()
    expect(screenSize.height).toBeDefined()
    expect(typeof screenSize.width).toBe('number')
    expect(typeof screenSize.height).toBe('number')
    expect(screenSize.width).toBeGreaterThan(0)
    expect(screenSize.height).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should capture screen', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const screenshot = await desktop.automation.screen.capture()
    
    expect(screenshot).toBeDefined()
    expect(typeof screenshot).toBe('string')
    expect(screenshot.length).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should capture screen region', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const screenshot = await desktop.automation.screen.capture(100, 100, 800, 600)
    
    expect(screenshot).toBeDefined()
    expect(typeof screenshot).toBe('string')
    expect(screenshot.length).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should take screenshot in bytes format', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const screenshot = await desktop.screenshot('bytes')
    
    expect(screenshot).toBeDefined()
    expect(Buffer.isBuffer(screenshot)).toBe(true)
    expect((screenshot as Buffer).length).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should take screenshot in stream format', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const screenshot = await desktop.screenshot('stream')
    
    expect(screenshot).toBeDefined()
    expect(screenshot instanceof ReadableStream).toBe(true)
    
    // Test reading from stream
    const reader = (screenshot as ReadableStream).getReader()
    const result = await reader.read()
    expect(result.value).toBeDefined()
    expect(Buffer.isBuffer(result.value)).toBe(true)
    
    await desktop.close()
  })

  it('should take screenshot with default format', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const screenshot = await desktop.screenshot()
    
    expect(screenshot).toBeDefined()
    expect(Buffer.isBuffer(screenshot)).toBe(true)
    expect((screenshot as Buffer).length).toBeGreaterThan(0)
    
    await desktop.close()
  })

  it('should find image on screen', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const position = await desktop.automation.screen.findImage('/path/to/image.png', 0.8)
    
    // This will be null in mock implementation
    expect(position).toBeNull()
    
    await desktop.close()
  })

  it('should find text on screen', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const position = await desktop.automation.screen.findText('Hello World')
    
    // This will be null in mock implementation
    expect(position).toBeNull()
    
    await desktop.close()
  })
})
