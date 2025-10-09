import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Desktop } from '../../src'

describe('Web Automation', () => {
  let desktop: Desktop

  beforeAll(async () => {
    desktop = await Desktop.create({
      templateId: 'browser-use',
      timeout: 600000 // 10 minutes
    })
  })

  afterAll(async () => {
    if (desktop) {
      await desktop.close()
    }
  })

  it('should perform web browser automation', async () => {
    // Launch Firefox browser
    await desktop.automation.applications.launch('firefox-esr')
    await new Promise(resolve => setTimeout(resolve, 3000)) // Wait for browser to load

    // Navigate to Google
    await desktop.automation.keyboard.hotkey(['Ctrl', 'L']) // Focus address bar
    await desktop.automation.keyboard.type('https://www.google.com')
    await desktop.automation.keyboard.hotkey(['Enter'])
    await new Promise(resolve => setTimeout(resolve, 3000)) // Wait for page to load

    // Perform search
    await desktop.automation.keyboard.type('Scalebox Desktop Automation')
    await desktop.automation.keyboard.hotkey(['Enter'])
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for search results

    // Take screenshot of search results
    const screenshot = await desktop.automation.screen.capture()
    expect(screenshot).toBeDefined()
    expect(typeof screenshot).toBe('string')

    console.log('Web automation completed successfully')
  }, 120000) // 2 minute timeout

  it('should handle multiple browser tabs', async () => {
    // Open new tab
    await desktop.automation.keyboard.hotkey(['Ctrl', 'T'])
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Navigate to different website
    await desktop.automation.keyboard.hotkey(['Ctrl', 'L'])
    await desktop.automation.keyboard.type('https://www.github.com')
    await desktop.automation.keyboard.hotkey(['Enter'])
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Switch between tabs
    await desktop.automation.keyboard.hotkey(['Ctrl', 'Tab'])
    await new Promise(resolve => setTimeout(resolve, 1000))
    await desktop.automation.keyboard.hotkey(['Ctrl', 'Shift', 'Tab'])
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Close current tab
    await desktop.automation.keyboard.hotkey(['Ctrl', 'W'])
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('Multiple tab handling completed')
  }, 120000)

  it('should perform form interactions', async () => {
    // Navigate to a form page (example)
    await desktop.automation.keyboard.hotkey(['Ctrl', 'L'])
    await desktop.automation.keyboard.type('https://httpbin.org/forms/post')
    await desktop.automation.keyboard.hotkey(['Enter'])
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Fill form fields (simulated)
    await desktop.automation.keyboard.type('John Doe')
    await desktop.automation.keyboard.hotkey(['Tab'])
    await desktop.automation.keyboard.type('john.doe@example.com')
    await desktop.automation.keyboard.hotkey(['Tab'])
    await desktop.automation.keyboard.type('This is a test message')
    await desktop.automation.keyboard.hotkey(['Tab'])

    // Submit form (simulated)
    await desktop.automation.keyboard.hotkey(['Enter'])

    console.log('Form interaction completed')
  }, 120000)
})
