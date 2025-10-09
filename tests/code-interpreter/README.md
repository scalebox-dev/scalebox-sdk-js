# Code Interpreter Test Suite

This directory contains comprehensive tests for the Code Interpreter functionality in the ScaleBox SDK.

## Test Structure

The test suite is organized into the following categories:

### 📁 Test Files

- **`index.test.ts`** - Main test runner and comprehensive test suite
- **`basic-operations.test.ts`** - Basic code execution and operations
- **`callbacks.test.ts`** - Callback handling and event processing
- **`context-management.test.ts`** - Context creation, state management, and cleanup
- **`performance.test.ts`** - Performance testing and optimization
- **`error-handling.test.ts`** - Error handling and recovery
- **`result-formats.test.ts`** - Result format generation and processing
- **`multi-language.test.ts`** - Multi-language support (Python, R, JavaScript, Bash, Java, TypeScript)
- **`advanced-features.test.ts`** - Advanced features like WebSocket simulation, real-time streaming

## 🧪 Test Categories

### 1. Basic Operations
- Sandbox creation and initialization
- Basic code execution (Python, JavaScript, R)
- Concurrent code execution
- Data science workflows

### 2. Callback Handling
- stdout/stderr callbacks
- result/error callbacks
- Concurrent callback processing
- Complex callback scenarios

### 3. Context Management
- Context creation and destruction
- State persistence across executions
- Multi-language context support
- Context isolation

### 4. Performance Testing
- Concurrent task execution
- Batch processing performance
- Memory-intensive operations
- High-frequency operations

### 5. Error Handling
- Syntax errors
- Runtime errors
- Timeout errors
- Memory errors
- Error recovery

### 6. Result Formats
- Text format results
- Mixed format results (HTML, JSON, Markdown, Charts)
- Real-time data results
- Structured data results

### 7. Multi-Language Support
- **Python**: Basic execution, data science, async operations
- **R**: Data analysis, visualization, statistics
- **JavaScript/Node.js**: Basic execution, promises, data processing
- **Bash**: Shell commands, file operations, pipelines
- **Java**: Basic execution, OOP features, collections
- **TypeScript/Deno**: TypeScript features, async/await, file operations

### 8. Advanced Features
- WebSocket simulation
- Real-time data streaming
- Complex workflow orchestration
- Advanced concurrency patterns
- Distributed task coordination

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Basic operations
npm test -- basic-operations

# Multi-language support
npm test -- multi-language

# Performance tests
npm test -- performance
```

### Run Individual Test Files
```bash
npm test -- tests/code-interpreter/basic-operations.test.ts
```

## 📊 Test Metrics

The test suite provides comprehensive coverage of:

- **Total Test Cases**: 50+ individual test cases
- **Supported Languages**: 6 (Python, R, JavaScript, Bash, Java, TypeScript)
- **Test Categories**: 8 major categories
- **Performance Benchmarks**: CPU, IO, memory, and concurrency tests
- **Error Scenarios**: 10+ different error conditions

## 🔧 Test Configuration

### Environment Variables
- `CI_TEST`: Test environment identifier
- `TEST_SUITE`: Test suite identifier
- `DEBUG`: Enable debug logging

### Timeout Settings
- Default timeout: 3600 seconds (1 hour)
- Individual test timeout: 30 seconds
- Performance test timeout: 60 seconds

### Sandbox Configuration
- Template: `code-interpreter`
- Debug mode: Enabled
- Metadata: Test validation information

## 📈 Test Results

The test suite provides detailed reporting including:

- **Pass/Fail Status**: Individual test results
- **Execution Time**: Performance metrics
- **Error Details**: Comprehensive error reporting
- **Success Rate**: Overall test suite success rate
- **Coverage Report**: Feature coverage analysis

## 🛠️ Troubleshooting

### Common Issues

1. **Sandbox Creation Failures**
   - Check network connectivity
   - Verify template availability
   - Check resource limits

2. **Timeout Errors**
   - Increase timeout values
   - Check system performance
   - Monitor resource usage

3. **Context Management Issues**
   - Ensure proper cleanup
   - Check context isolation
   - Verify state persistence

### Debug Mode

Enable debug mode for detailed logging:
```typescript
const sandbox = await AsyncSandbox.create({
  debug: true,
  // ... other options
});
```

## 📝 Contributing

When adding new tests:

1. Follow the existing test structure
2. Include comprehensive error handling
3. Add performance metrics where applicable
4. Update this README with new test categories
5. Ensure tests are language-agnostic where possible

## 🔍 Test Validation

Each test validates:

- ✅ Correct execution
- ✅ Expected output
- ✅ Error handling
- ✅ Performance characteristics
- ✅ Resource cleanup
- ✅ Cross-language compatibility
