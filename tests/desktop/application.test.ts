import { describe, it, expect } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Application Management', () => {
  it('should launch application', async () => {
    const desktop = await Desktop.create({
      timeout: 300000 // 5 minutes for safety
    })
    
    await expect(
      desktop.automation.applications.launch('xfce4-terminal')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.applications.launch('firefox-esr')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should launch application with URI', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.applications.launch('firefox-esr', 'https://www.google.com')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should get running applications', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const applications = await desktop.automation.applications.getRunningApplications()
    
    expect(applications).toBeDefined()
    expect(Array.isArray(applications)).toBe(true)
    
    await desktop.close()
  })

  it('should check if application is running', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    const isRunning = await desktop.automation.applications.isApplicationRunning('xfce4-terminal')
    
    expect(typeof isRunning).toBe('boolean')
    
    await desktop.close()
  })

  it('should close application', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.applications.closeApplication('xfce4-terminal')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })

  it('should open file or URL', async () => {
    const desktop = await Desktop.create({
      timeout: 300000
    })
    
    await expect(
      desktop.automation.applications.open('https://www.example.com')
    ).resolves.not.toThrow()
    
    await expect(
      desktop.automation.applications.open('/tmp')
    ).resolves.not.toThrow()
    
    await desktop.close()
  })
})
