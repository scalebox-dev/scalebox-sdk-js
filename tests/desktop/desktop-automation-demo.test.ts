import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Desktop } from '../../src'

describe('Desktop Automation Demo (based on testcomputeuse.py)', () => {
  let desktop: Desktop

  beforeAll(async () => {
    desktop = await Desktop.create({
      templateId: 'browser-use', // Same template as in testcomputeuse.py
      timeout: 3600000 // 1 hour timeout like in testcomputeuse.py
    })
  }, 60000)

  afterAll(async () => {
    if (desktop) {
      await desktop.close()
    }
  })

  it('should demonstrate desktop automation features', async () => {
    // 1. Basic mouse operations (as in testcomputeuse.py)
    console.log('执行鼠标操作...')
    
    // Get screen size
    const screenSize = await desktop.automation.screen.getSize()
    console.log(`屏幕尺寸: ${screenSize.width}x${screenSize.height}`)
    
    // Move mouse to center
    const centerX = Math.floor(screenSize.width / 2)
    const centerY = Math.floor(screenSize.height / 2)
    await desktop.automation.mouse.move(centerX, centerY)
    
    // Get cursor position
    const cursorPos = await desktop.automation.mouse.getPosition()
    console.log(`光标位置: (${cursorPos.x}, ${cursorPos.y})`)
    
    // Left click
    await desktop.automation.mouse.click(centerX, centerY)
    
    // Right click
    await desktop.automation.mouse.click(centerX + 100, centerY)
    
    // Double click
    await desktop.automation.mouse.doubleClick(centerX, centerY + 100)
    
    // Mouse drag
    await desktop.automation.mouse.drag([centerX, centerY], [centerX + 200, centerY])
    
    // Mouse scroll
    await desktop.automation.mouse.scroll('down', 2) // Scroll down 2 times
    await desktop.automation.mouse.scroll('up', 1) // Scroll up 1 time
    
    // 2. Keyboard operations (as in testcomputeuse.py)
    console.log('执行键盘操作...')
    
    // Open terminal
    await desktop.automation.applications.launch('xfce4-terminal')
    await desktop.automation.keyboard.wait(2000) // Wait 2 seconds
    
    // Get current window ID
    const currentWindow = await desktop.automation.windows.getCurrentWindowId()
    console.log(`当前窗口ID: ${currentWindow}`)
    
    // Input command
    await desktop.automation.keyboard.type("echo 'Hello from SBX Sandbox!'\n")
    
    // Special keys
    await desktop.automation.keyboard.hotkey(['Ctrl', 'Shift', 'T']) // New tab
    await desktop.automation.keyboard.wait(1000)
    
    await desktop.automation.keyboard.type('ls -la\n')
    
    // 3. Window management (as in testcomputeuse.py)
    console.log('执行窗口管理操作...')
    
    // Get all visible windows
    const terminalWindows = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    console.log(`终端窗口: ${terminalWindows}`)
    
    if (terminalWindows.length > 0) {
      // Get window title
      const windowTitle = await desktop.automation.windows.getWindowTitle(terminalWindows[0])
      console.log(`窗口标题: ${windowTitle}`)
    }
    
    // 4. Launch applications (as in testcomputeuse.py)
    console.log('启动其他应用程序...')
    
    // Try to launch firefox-esr as in testcomputeuse.py
    try {
      await desktop.automation.applications.launch('firefox-esr')
      await desktop.automation.keyboard.wait(3000)
      
      // In Firefox, input URL
      await desktop.automation.keyboard.hotkey(['Ctrl', 'L']) // Focus address bar
      await desktop.automation.keyboard.type('https://www.google.com')
      await desktop.automation.keyboard.press('Enter')
      
    } catch (error) {
      console.log(`启动Firefox失败: ${error}`)
    }
    
    // 5. File operations (as in testcomputeuse.py)
    console.log('执行文件操作...')
    
    // Create test file content
    const testContent = `Hello World!
This is a test file created from SBX Sandbox SDK.
Current time: ${new Date().toString()}
`
    
    // Write file using sandbox filesystem
    await desktop.sandbox.files.write('/tmp/test_file.txt', testContent)
    console.log('已创建测试文件')
    
    // 6. Screenshot functionality (as in testcomputeuse.py)
    console.log('执行截图操作...')
    
    // Capture screen
    const screenshot = await desktop.automation.screen.capture()
    console.log(`截图大小: ${screenshot.length} 字符`)
    
    // 7. Complex automation script (as in testcomputeuse.py)
    console.log('执行复杂自动化任务...')
    
    // Return to terminal window
    const terminalWindows2 = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    if (terminalWindows2.length > 0) {
      // Activate terminal window
      await desktop.automation.windows.focusWindow(terminalWindows2[0])
      
      // Create Python script and execute
      const pythonScript = `#!/usr/bin/env python3
import time
print("starting...")
for i in range(5):
    print(f"count: {i}")
time.sleep(0.5)
print("success!")
`
      
      const scriptPath = '/tmp/automation_script.py'
      await desktop.sandbox.files.write(scriptPath, pythonScript)
      
      await desktop.automation.keyboard.type(`python3 ${scriptPath}\n`)
    }
    
    // 8. Wait and timing operations (as in testcomputeuse.py)
    console.log('等待操作完成...')
    await desktop.automation.keyboard.wait(2000) // Wait 2 seconds
    
    // Show all functions completed
    await desktop.automation.keyboard.type("echo 'All successfully!'\n")
    
    console.log('演示完成!')
    
  }, 300000) // 5 minute timeout
})
