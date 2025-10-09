import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Mouse Operations', () => {
  it('should move mouse', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.mouse.move(100, 200)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should perform mouse clicks', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.mouse.click(100, 200)
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.doubleClick(150, 250)
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.rightClick(200, 300)
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.middleClick(250, 350)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should perform mouse drag', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.mouse.drag([100, 100], [200, 200])
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should press and release mouse buttons', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.mouse.press('left')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.release('left')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.press('right')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.release('right')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.press('middle')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.release('middle')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should scroll mouse wheel', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.mouse.scroll('up', 3)
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.mouse.scroll('down', 5)
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should get cursor position', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const position = await desktop.automation.mouse.getPosition()
    
    expect(position).toBeDefined()
    expect(position.x).toBeDefined()
    expect(position.y).toBeDefined()
    expect(typeof position.x).toBe('number')
    expect(typeof position.y).toBe('number')
    expect(position.x).toBeGreaterThanOrEqual(0)
    expect(position.y).toBeGreaterThanOrEqual(0)
    
    await desktop.close()
  })
})
