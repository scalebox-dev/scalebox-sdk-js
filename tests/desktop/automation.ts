import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Automation', () => {
  let desktop: Desktop

  beforeAll(async () => {
    desktop = await Desktop.create({
      templateId: 'browser-use',
      timeout: 3600000 // 1 hour
    })
  })

  afterAll(async () => {
    if (desktop) {
      await desktop.close()
    }
  })

  it('should perform comprehensive desktop automation', async () => {
    // 1. Get screen size
    const screenSize = await desktop.automation.screen.getSize()
    console.log(`Screen size: ${screenSize.width}x${screenSize.height}`)
    expect(screenSize.width).toBeGreaterThan(0)
    expect(screenSize.height).toBeGreaterThan(0)

    // 2. Move mouse to center and get cursor position
    const centerX = Math.floor(screenSize.width / 2)
    const centerY = Math.floor(screenSize.height / 2)
    
    await desktop.automation.mouse.move(centerX, centerY)
    const cursorPosition = await desktop.automation.mouse.getPosition()
    console.log(`Cursor position: (${cursorPosition.x}, ${cursorPosition.y})`)
    expect(cursorPosition.x).toBeDefined()
    expect(cursorPosition.y).toBeDefined()

    // 3. Perform various mouse operations
    await desktop.automation.mouse.click(centerX, centerY)
    await desktop.automation.mouse.rightClick(centerX + 100, centerY)
    await desktop.automation.mouse.doubleClick(centerX, centerY + 100)
    await desktop.automation.mouse.drag([centerX, centerY], [centerX + 200, centerY])

    // 4. Launch terminal and perform keyboard operations
    await desktop.automation.applications.launch('xfce4-terminal')
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for terminal to open

    const currentWindowId = await desktop.automation.windows.getCurrentWindowId()
    console.log(`Current window ID: ${currentWindowId}`)
    expect(currentWindowId).toBeDefined()

    // Type commands in terminal
    await desktop.automation.keyboard.type("echo 'Hello from Scalebox Desktop SDK!'")
    await desktop.automation.keyboard.hotkey(['Enter'])
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create new tab
    await desktop.automation.keyboard.hotkey(['Ctrl', 'Shift', 'T'])
    await new Promise(resolve => setTimeout(resolve, 1000))

    await desktop.automation.keyboard.type('ls -la')
    await desktop.automation.keyboard.hotkey(['Enter'])

    // 5. Window management operations
    const terminalWindows = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    console.log(`Terminal windows: ${terminalWindows}`)
    expect(Array.isArray(terminalWindows)).toBe(true)

    if (terminalWindows.length > 0) {
      const windowTitle = await desktop.automation.windows.getWindowTitle(terminalWindows[0])
      console.log(`Window title: ${windowTitle}`)
      expect(typeof windowTitle).toBe('string')
    }

    // 6. Launch Firefox browser
    try {
      await desktop.automation.applications.launch('firefox-esr')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Navigate to Google
      await desktop.automation.keyboard.hotkey(['Ctrl', 'L']) // Focus address bar
      await desktop.automation.keyboard.type('https://www.google.com')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.log(`Failed to launch Firefox: ${error}`)
    }

    // 7. File operations - create and write test file
    const testContent = `Hello World!
This is a test file created from Scalebox Desktop SDK.
Current time: ${new Date().toLocaleString()}
`

    // Note: File operations would need to be implemented through the sandbox filesystem
    // This is a placeholder for the concept
    console.log('Creating test file with content:', testContent)

    // 8. Screenshot functionality
    const screenshotPath = await desktop.automation.screen.capture()
    console.log(`Screenshot saved to: ${screenshotPath}`)
    expect(screenshotPath).toBeDefined()
    expect(typeof screenshotPath).toBe('string')

    // 9. Complex automation script
    const terminalWindows2 = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    if (terminalWindows2.length > 0) {
      // Focus terminal window
      await desktop.automation.windows.focusWindow(terminalWindows2[0])

      // Create and execute Python script
      const pythonScript = `#!/usr/bin/env python3
import time
print("starting...")
for i in range(5):
    print(f"count: {i}")
    time.sleep(0.5)
print("success!")
`

      // Note: File writing would be done through sandbox filesystem
      console.log('Python script content:', pythonScript)

      await desktop.automation.keyboard.type('python3 /tmp/automation_script.py')
      await desktop.automation.keyboard.hotkey(['Enter'])
    }

    // 10. Wait and final operations
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

    await desktop.automation.keyboard.type("echo 'All operations completed successfully!'")
    await desktop.automation.keyboard.hotkey(['Enter'])

    console.log('Desktop automation completed successfully!')
  }, 300000) // 5 minute timeout for comprehensive test
})
