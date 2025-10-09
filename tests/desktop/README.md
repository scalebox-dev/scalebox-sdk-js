# Desktop Automation Tests

This directory contains comprehensive tests for the Scalebox Desktop SDK, covering various desktop automation scenarios and use cases.

## Test Files Overview

### Core Functionality Tests

- **`create.test.ts`** - Desktop creation and connection tests
- **`mouse.test.ts`** - Mouse operations (clicks, movements, drags)
- **`keyboard.test.ts`** - Keyboard operations (typing, shortcuts, hotkeys)
- **`window.test.ts`** - Window management operations
- **`application.test.ts`** - Application lifecycle management
- **`screen.test.ts`** - Screen capture and display operations

### Comprehensive Example Tests

- **`automation.ts`** - Complete desktop automation demonstration
- **`operations.ts`** - Basic desktop operations integration examples
- **`web-automation.ts`** - Web browser automation scenarios
- **`gui-applications.ts`** - GUI application testing workflows
- **`educational.ts`** - Educational and tutorial demonstrations

## Test Categories

### 1. Basic Operations
Tests fundamental desktop automation capabilities:
- Mouse movements, clicks, and drags
- Keyboard input and shortcuts
- Window management
- Application launching and control
- Screen capture and analysis

### 2. Web Automation
Demonstrates browser automation scenarios:
- Website navigation
- Form interactions
- Multi-tab management
- Search operations
- Web application testing

### 3. GUI Application Testing
Covers desktop application testing:
- GUI application interactions
- Multi-window management
- Application lifecycle testing
- User interface automation
- Cross-application workflows

### 4. Educational Demonstrations
Shows educational use cases:
- Programming environment setup
- Interactive learning scenarios
- Step-by-step tutorials
- File operations and text editing
- Multi-application workflows

## Test Structure

Each test file follows a consistent structure:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Desktop } from '../../src'

describe('Test Category', () => {
  let desktop: Desktop

  beforeAll(async () => {
    desktop = await Desktop.create({
      templateId: 'desktop',
      timeout: 300000,
      apiKey: 'test-api-key'
    })
  })

  afterAll(async () => {
    if (desktop) {
      await desktop.close()
    }
  })

  it('should perform specific test', async () => {
    // Test implementation
  })
})
```

## Key Features Tested

### Mouse Operations
- Move mouse to specific coordinates
- Left, right, middle, and double clicks
- Mouse drag operations
- Button press and release
- Cursor position tracking

### Keyboard Operations
- Text input and typing
- Special key combinations
- Modifier keys (Ctrl, Alt, Shift)
- Hotkey sequences
- Key press and release

### Window Management
- Get current window information
- Window title and ID retrieval
- Application window discovery
- Window focus and activation
- Window operations (minimize, maximize, resize, move)
- Window closing

### Application Management
- Application launching
- Running application detection
- Application lifecycle control
- Multi-application workflows
- Application termination

### Screen Operations
- Screen size detection
- Full and partial screen capture
- Image recognition (placeholder)
- Text recognition (placeholder)
- Display information

## Usage Examples

### Basic Desktop Operations
```typescript
// Create desktop instance
const desktop = await Desktop.create({
  templateId: 'desktop',
  timeout: 300000
})

// Mouse operations
await desktop.automation.mouse.move(100, 200)
await desktop.automation.mouse.click(100, 200)
await desktop.automation.mouse.drag([100, 100], [200, 200])

// Keyboard operations
await desktop.automation.keyboard.type('Hello World')
await desktop.automation.keyboard.hotkey(['Ctrl', 'C'])

// Window management
const windowId = await desktop.automation.windows.getCurrentWindowId()
await desktop.automation.windows.focusWindow(windowId)

// Application management
await desktop.automation.applications.launch('firefox')
const isRunning = await desktop.automation.applications.isApplicationRunning('firefox')

// Screen operations
const screenSize = await desktop.automation.screen.getSize()
const screenshot = await desktop.automation.screen.capture()

// Cleanup
await desktop.close()
```

### Web Automation
```typescript
// Launch browser and navigate
await desktop.automation.applications.launch('firefox')
await desktop.automation.keyboard.hotkey(['Ctrl', 'L'])
await desktop.automation.keyboard.type('https://www.google.com')
await desktop.automation.keyboard.hotkey(['Enter'])

// Perform search
await desktop.automation.keyboard.type('Scalebox Desktop SDK')
await desktop.automation.keyboard.hotkey(['Enter'])
```

### GUI Application Testing
```typescript
// Launch and interact with GUI application
await desktop.automation.applications.launch('gedit')
const windows = await desktop.automation.windows.getApplicationWindows('gedit')
if (windows.length > 0) {
  await desktop.automation.windows.focusWindow(windows[0])
  await desktop.automation.keyboard.type('Hello from automation!')
  await desktop.automation.keyboard.hotkey(['Ctrl', 'S'])
}
```

## Test Configuration

### Timeout Settings
- Basic operations: 30 seconds
- Comprehensive demos: 2-5 minutes
- Web automation: 2 minutes
- GUI testing: 2 minutes
- Educational demos: 2 minutes

### Template Requirements
- `desktop` - Standard desktop environment
- `browser-use` - Browser automation environment

### API Configuration
All tests use mock API keys for testing:
```typescript
apiKey: 'test-api-key'
```

## Running Tests

### Individual Example Files
```bash
npm test tests/desktop/mouse.test.ts
npm test tests/desktop/automation.ts
```

### All Desktop Tests
```bash
npm test tests/desktop/
```

### Specific Example Categories
```bash
# Basic operations
npm test tests/desktop/operations.ts

# Web automation
npm test tests/desktop/web-automation.ts

# GUI applications
npm test tests/desktop/gui-applications.ts

# Educational examples
npm test tests/desktop/educational.ts
```

## Test Data and Cleanup

### Resource Management
- Each test creates its own desktop instance
- Proper cleanup in `afterAll` hooks
- Timeout handling for long-running operations
- Error handling and recovery

### Test Isolation
- Independent test execution
- No shared state between tests
- Clean environment for each test
- Proper resource disposal

## Best Practices

### Test Organization
- Group related functionality
- Use descriptive test names
- Include setup and teardown
- Handle async operations properly

### Error Handling
- Graceful failure handling
- Proper resource cleanup
- Timeout management
- Exception propagation

### Performance Considerations
- Reasonable timeout values
- Efficient resource usage
- Parallel test execution support
- Memory management

## Future Enhancements

### Planned Features
- Image recognition testing
- Text recognition testing
- Advanced window management
- Multi-monitor support
- Performance benchmarking

### Test Coverage
- Edge case handling
- Error condition testing
- Performance testing
- Stress testing
- Integration testing

## Contributing

When adding new desktop tests:

1. Follow the existing test structure
2. Use appropriate timeouts
3. Include proper cleanup
4. Add descriptive comments
5. Test both success and failure scenarios
6. Update this README if adding new test categories
