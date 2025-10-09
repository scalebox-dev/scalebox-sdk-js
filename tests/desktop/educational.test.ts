import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Desktop } from '../../src'

describe('Educational', () => {
  let desktop: Desktop

  beforeAll(async () => {
    desktop = await Desktop.create({
      templateId: 'desktop',
      timeout: 600000 // 10 minutes
    })
  })

  afterAll(async () => {
    if (desktop) {
      await desktop.close()
    }
  })

  it('should demonstrate programming environment setup', async () => {
    // Launch terminal for programming demonstration
    await desktop.automation.applications.launch('xfce4-terminal')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Create a programming demonstration
    const terminalWindows = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    if (terminalWindows.length > 0) {
      await desktop.automation.windows.focusWindow(terminalWindows[0])

      // Demonstrate Python programming
      await desktop.automation.keyboard.type('# Python Programming Demo\n')
      await desktop.automation.keyboard.type('print("Hello, Students!")\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      await desktop.automation.keyboard.type('name = input("What is your name? ")\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      await desktop.automation.keyboard.type('print(f"Nice to meet you, {name}!")\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Demonstrate loop
      await desktop.automation.keyboard.type('for i in range(3):\n')
      await desktop.automation.keyboard.type('    print(f"Count: {i}")\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Save and run the script
      await desktop.automation.keyboard.type('python3 demo.py\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 2000))

      console.log('Programming demonstration completed')
    }
  }, 120000)

  it('should demonstrate file operations and text editing', async () => {
    // Launch text editor (using xfce4-terminal as text editor)
    await desktop.automation.applications.launch('xfce4-terminal')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const terminalWindows = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    if (terminalWindows.length > 0) {
      await desktop.automation.windows.focusWindow(terminalWindows[0])

      // Create educational content
      const educationalContent = `# Educational Content Demo

## Introduction to Desktop Automation
This is a demonstration of desktop automation capabilities.

### Features Demonstrated:
1. Text editing and formatting
2. File operations
3. Window management
4. Keyboard shortcuts

### Code Example:
\`\`\`python
def hello_world():
    print("Hello from Scalebox Desktop SDK!")
    return "Success!"

# Execute the function
result = hello_world()
print(f"Result: {result}")
\`\`\`

### Next Steps:
- Save this file
- Run the code
- Test different scenarios

Created: ${new Date().toLocaleString()}
`

      // Type the educational content
      await desktop.automation.keyboard.type(educationalContent)

      // Demonstrate text editing features
      await desktop.automation.keyboard.hotkey(['Ctrl', 'A']) // Select all
      await desktop.automation.keyboard.hotkey(['Ctrl', 'C']) // Copy
      await desktop.automation.keyboard.hotkey(['Ctrl', 'V']) // Paste
      await desktop.automation.keyboard.hotkey(['Ctrl', 'Z']) // Undo
      await desktop.automation.keyboard.hotkey(['Ctrl', 'Y']) // Redo

      // Save the file
      await desktop.automation.keyboard.hotkey(['Ctrl', 'S'])
      await new Promise(resolve => setTimeout(resolve, 1000))
      await desktop.automation.keyboard.type('/tmp/educational_demo.txt')
      await desktop.automation.keyboard.hotkey(['Enter'])

      console.log('File operations demonstration completed')
    }
  }, 120000)

  it('should demonstrate interactive learning scenarios', async () => {
    // Launch multiple applications for interactive demo
    await desktop.automation.applications.launch('xfce4-terminal')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await desktop.automation.applications.launch('firefox-esr')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Switch between applications to demonstrate multitasking
    const terminalWindows = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    const firefoxWindows = await desktop.automation.windows.getApplicationWindows('firefox-esr')

    if (terminalWindows.length > 0 && firefoxWindows.length > 0) {
      // Focus terminal
      await desktop.automation.windows.focusWindow(terminalWindows[0])
      await desktop.automation.keyboard.type('echo "Working in terminal..."\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Switch to browser
      await desktop.automation.windows.focusWindow(firefoxWindows[0])
      await desktop.automation.keyboard.type('# Interactive Learning Demo\n')
      await desktop.automation.keyboard.type('This demonstrates switching between applications.\n')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Switch back to terminal
      await desktop.automation.windows.focusWindow(terminalWindows[0])
      await desktop.automation.keyboard.type('ls -la\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Demonstrate window management
      await desktop.automation.windows.resizeWindow(terminalWindows[0], 800, 600)
      await desktop.automation.windows.moveWindow(terminalWindows[0], 100, 100)
      
      await desktop.automation.windows.resizeWindow(firefoxWindows[0], 600, 400)
      await desktop.automation.windows.moveWindow(firefoxWindows[0], 200, 200)

      // Take screenshot of the learning environment
      const screenshot = await desktop.automation.screen.capture()
      expect(screenshot).toBeDefined()
      expect(typeof screenshot).toBe('string')

      console.log('Interactive learning demonstration completed')
    }
  }, 120000)

  it('should demonstrate step-by-step tutorial workflow', async () => {
    // Step 1: Open terminal
    await desktop.automation.applications.launch('xfce4-terminal')
    await new Promise(resolve => setTimeout(resolve, 2000))

    const terminalWindows = await desktop.automation.windows.getApplicationWindows('xfce4-terminal')
    if (terminalWindows.length > 0) {
      await desktop.automation.windows.focusWindow(terminalWindows[0])

      // Step 2: Create a Python script
      await desktop.automation.keyboard.type('cat > tutorial.py << EOF\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await desktop.automation.keyboard.type('#!/usr/bin/env python3\n')
      await desktop.automation.keyboard.type('"""Tutorial Script"""\n')
      await desktop.automation.keyboard.type('\n')
      await desktop.automation.keyboard.type('def main():\n')
      await desktop.automation.keyboard.type('    print("Welcome to the tutorial!")\n')
      await desktop.automation.keyboard.type('    name = input("Enter your name: ")\n')
      await desktop.automation.keyboard.type('    print(f"Hello, {name}!")\n')
      await desktop.automation.keyboard.type('\n')
      await desktop.automation.keyboard.type('if __name__ == "__main__":\n')
      await desktop.automation.keyboard.type('    main()\n')
      await desktop.automation.keyboard.type('EOF\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 3: Make script executable
      await desktop.automation.keyboard.type('chmod +x tutorial.py\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 4: Run the script
      await desktop.automation.keyboard.type('python3 tutorial.py\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 5: Show file contents
      await desktop.automation.keyboard.type('cat tutorial.py\n')
      await desktop.automation.keyboard.hotkey(['Enter'])
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('Step-by-step tutorial workflow completed')
    }
  }, 120000)
})
